import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiDroplet,
  FiAlertTriangle,
  FiCheckCircle,
  FiTrendingUp,
  FiTrendingDown,
  FiMinus,
} from "react-icons/fi";
import DashboardSidebar from "../components/DashboardSidebar";
import { useSensorData } from "../hooks/useSensorData";
import { useAuth } from "../context/AuthContext";
import "./SensorPage.css";

const COMFORT_MIN = 35;
const COMFORT_MAX = 70;
const ABS_MIN = 0;
const ABS_MAX = 100;

const fmt = (v) => (typeof v === "number" ? `${v.toFixed(1)}%` : "--");

const getStatus = (h) => {
  if (typeof h !== "number") return { label: "Unavailable", tone: "warning" };
  if (h < 25) return { label: "Very Dry", tone: "danger" };
  if (h < 35) return { label: "Dry", tone: "warning" };
  if (h <= 70) return { label: "Comfortable", tone: "safe" };
  if (h <= 80) return { label: "Humid", tone: "warning" };
  return { label: "Very Humid", tone: "danger" };
};

const clampPct = (v, min, max) =>
  Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

const formatTs = (value) => {
  if (!value) return "Waiting…";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Waiting…";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
};

const CIRCUMFERENCE = 2 * Math.PI * 54;

function Gauge({ pct }) {
  const offset = CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, pct / 100)));
  return (
    <div className="sensor-gauge-wrap">
      <svg className="sensor-gauge-svg" viewBox="0 0 120 120">
        <circle className="sensor-gauge-bg" cx="60" cy="60" r="54" />
        <circle
          className="sensor-gauge-fill"
          cx="60"
          cy="60"
          r="54"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="sensor-gauge-center">
        <span className="sensor-gauge-pct">{Math.round(pct)}%</span>
        <span className="sensor-gauge-sub">humidity</span>
      </div>
    </div>
  );
}

export default function HumidityPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { current, recent, error, isLoading } = useSensorData();

  const hum = typeof current.humidity === "number" ? current.humidity : null;
  const status = getStatus(hum);
  const gaugePct = hum !== null ? clampPct(hum, ABS_MIN, ABS_MAX) : 0;
  const rangePct = hum !== null ? clampPct(hum, COMFORT_MIN, COMFORT_MAX) : 0;

  const prevHum =
    recent.length >= 2
      ? (typeof recent[1]?.humidity === "number" ? recent[1].humidity : null)
      : null;
  const delta = hum !== null && prevHum !== null ? hum - prevHum : null;

  const TrendIcon =
    delta === null ? FiMinus : delta > 0.5 ? FiTrendingUp : delta < -0.5 ? FiTrendingDown : FiMinus;
  const trendClass =
    delta === null ? "flat" : delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";

  const humVals = recent.map((r) => r.humidity).filter((v) => typeof v === "number");
  const stats = [
    { label: "Min (session)", value: humVals.length ? fmt(Math.min(...humVals)) : "--" },
    { label: "Max (session)", value: humVals.length ? fmt(Math.max(...humVals)) : "--" },
    { label: "Ideal range", value: `${COMFORT_MIN}–${COMFORT_MAX}%` },
    { label: "Last updated", value: formatTs(current.recorded_at) },
    {
      label: "Change from previous",
      value: delta !== null ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%` : "--",
      trend: trendClass,
      TIcon: TrendIcon,
    },
  ];

  return (
    <div
      className="sensor-root"
      style={{
        "--sensor-accent": "#7fd2ff",
        "--sensor-accent2": "#3ba3d8",
        "--sensor-accent-glow": "rgba(127, 210, 255, 0.4)",
      }}
    >
      <div className="sensor-shell">
        <DashboardSidebar onLogout={logout} activeTab="Humidity" onNavigate={navigate} />
        <main className="sensor-main">
          {/* Header */}
          <div className="sensor-page-header">
            <div className="sensor-page-header__left">
              <p className="sensor-page-brand">ComfortSync · Sensors</p>
              <div className="sensor-page-title-row">
                <FiDroplet style={{ fontSize: "2rem", color: "#7fd2ff" }} />
                <h1 className="sensor-page-title">Humidity</h1>
                <span className="sensor-live-badge">
                  <span className="sensor-live-badge__dot" />
                  Live
                </span>
              </div>
            </div>
            <button className="sensor-back-btn" onClick={() => navigate("/dashboard")}>
              <FiArrowLeft /> Dashboard
            </button>
          </div>

          {error && <div className="sensor-error-banner">{error}</div>}

          {/* Hero */}
          <div className="sensor-hero-card">
            <div className="sensor-hero-card__left">
              <p className="sensor-card-label">Current relative humidity</p>
              <div>
                <span className="sensor-hero-value">
                  {hum !== null ? hum.toFixed(1) : "--"}
                </span>
                <span className="sensor-hero-unit">%</span>
              </div>
              <span className={`sensor-hero-status sensor-hero-status--${status.tone}`}>
                {status.tone === "safe" ? <FiCheckCircle /> : <FiAlertTriangle />}
                {status.label}
              </span>
              <p className="sensor-hero-timestamp">Updated {formatTs(current.recorded_at)}</p>
            </div>
            <Gauge pct={gaugePct} />
          </div>

          {/* Stats */}
          <div className="sensor-grid-3" style={{ marginBottom: 22 }}>
            {stats.map(({ label, value, trend, TIcon }) => (
              <div key={label} className="sensor-card sensor-stat">
                <p className="sensor-card-label">{label}</p>
                <span className="sensor-stat__value">{value}</span>
                {trend && TIcon && (
                  <span className={`sensor-stat__trend sensor-stat__trend--${trend}`}>
                    <TIcon />
                    {trend === "flat" ? "Stable" : trend === "up" ? "Rising" : "Falling"}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Comfort range bar */}
          <div className="sensor-card" style={{ marginBottom: 22 }}>
            <p className="sensor-card-label">Position in ideal humidity band</p>
            <div style={{ marginTop: 14 }}>
              <div className="sensor-range__labels">
                <span>{COMFORT_MIN}% (min)</span>
                <span>{hum !== null ? fmt(hum) : "--"}</span>
                <span>{COMFORT_MAX}% (max)</span>
              </div>
              <div className="sensor-range__track" style={{ marginTop: 8 }}>
                <div
                  className="sensor-range__fill"
                  style={{ width: `${Math.min(rangePct, 100)}%` }}
                />
                {hum !== null && (
                  <div
                    className="sensor-range__thumb"
                    style={{ left: `${Math.min(rangePct, 100)}%` }}
                  />
                )}
              </div>
            </div>
            <div className="sensor-comfort-row" style={{ marginTop: 18 }}>
              <div className="sensor-comfort-zone sensor-comfort-zone--danger">
                <div className="sensor-comfort-zone__range">{"< 25%"}</div>
                <div className="sensor-comfort-zone__label">Very Dry</div>
              </div>
              <div className="sensor-comfort-zone sensor-comfort-zone--warning">
                <div className="sensor-comfort-zone__range">25–35%</div>
                <div className="sensor-comfort-zone__label">Dry</div>
              </div>
              <div className="sensor-comfort-zone sensor-comfort-zone--safe">
                <div className="sensor-comfort-zone__range">35–70%</div>
                <div className="sensor-comfort-zone__label">Ideal</div>
              </div>
              <div className="sensor-comfort-zone sensor-comfort-zone--warning">
                <div className="sensor-comfort-zone__range">70–80%</div>
                <div className="sensor-comfort-zone__label">Humid</div>
              </div>
              <div className="sensor-comfort-zone sensor-comfort-zone--danger">
                <div className="sensor-comfort-zone__range">{"> 80%"}</div>
                <div className="sensor-comfort-zone__label">Very Humid</div>
              </div>
            </div>
          </div>

          {/* Recent readings */}
          <div className="sensor-card">
            <p className="sensor-card-label">Recent readings</p>
            {isLoading ? (
              <div className="sensor-empty">
                <FiDroplet />
                <p>Loading…</p>
              </div>
            ) : recent.length === 0 ? (
              <div className="sensor-empty">
                <FiDroplet />
                <p>No recent readings available.</p>
              </div>
            ) : (
              <div className="sensor-history-list" style={{ marginTop: 14 }}>
                {recent.map((r, i) => {
                  const v = typeof r.humidity === "number" ? r.humidity : null;
                  const barPct = v !== null ? clampPct(v, ABS_MIN, ABS_MAX) : 0;
                  return (
                    <div key={r.id ?? i} className="sensor-history-item">
                      <span className="sensor-history-item__time">{formatTs(r.recorded_at)}</span>
                      <div className="sensor-history-item__bar-wrap">
                        <div className="sensor-history-item__bar" style={{ width: `${barPct}%` }} />
                      </div>
                      <span className="sensor-history-item__value">
                        {v !== null ? `${v.toFixed(1)}%` : "--"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="sensor-note">
              <span className="sensor-note__icon">ℹ</span>
              Relative humidity is measured using a DHT sensor. Ideal indoor humidity is between 35 % and 70 %.
              Values outside this range can affect breathing comfort and cause condensation or static electricity.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

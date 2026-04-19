import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiThermometer,
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

const COMFORT_MIN = 18;
const COMFORT_MAX = 26;
const ABS_MIN = 10;
const ABS_MAX = 45;

const fmt = (v, unit = "°C") =>
  typeof v === "number" ? `${v.toFixed(1)}${unit}` : "--";

const getStatus = (temp) => {
  if (typeof temp !== "number") return { label: "Unavailable", tone: "warning" };
  if (temp < 16) return { label: "Too Cold", tone: "warning" };
  if (temp >= 16 && temp < 18) return { label: "Cool", tone: "warning" };
  if (temp >= 18 && temp <= 26) return { label: "Comfortable", tone: "safe" };
  if (temp > 26 && temp <= 30) return { label: "Warm", tone: "warning" };
  return { label: "Too Hot", tone: "danger" };
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
        <span className="sensor-gauge-sub">of range</span>
      </div>
    </div>
  );
}

export default function TemperaturePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { current, recent, error, isLoading } = useSensorData();

  const temp = typeof current.temperature === "number" ? current.temperature : null;
  const status = getStatus(temp);
  const pct = temp !== null ? clampPct(temp, ABS_MIN, ABS_MAX) : 0;
  const rangePct = temp !== null ? clampPct(temp, COMFORT_MIN, COMFORT_MAX) : 0;

  const prevTemp =
    recent.length >= 2
      ? (typeof recent[1]?.temperature === "number" ? recent[1].temperature : null)
      : null;
  const delta = temp !== null && prevTemp !== null ? temp - prevTemp : null;

  const TrendIcon =
    delta === null ? FiMinus : delta > 0.1 ? FiTrendingUp : delta < -0.1 ? FiTrendingDown : FiMinus;
  const trendClass =
    delta === null ? "flat" : delta > 0.1 ? "up" : delta < -0.1 ? "down" : "flat";

  const stats = [
    { label: "Min (session)", value: fmt(Math.min(...recent.map((r) => r.temperature).filter(Boolean))) },
    { label: "Max (session)", value: fmt(Math.max(...recent.map((r) => r.temperature).filter(Boolean))) },
    { label: "Comfort range", value: `${COMFORT_MIN}–${COMFORT_MAX} °C` },
    { label: "Last updated", value: formatTs(current.recorded_at) },
  ];

  return (
    <div className="sensor-root" style={{ "--sensor-accent": "#ff9ab0", "--sensor-accent2": "#ff6080", "--sensor-accent-glow": "rgba(255, 154, 176, 0.4)" }}>
      <div className="sensor-shell">
        <DashboardSidebar onLogout={logout} activeTab="Temperature" onNavigate={navigate} />
        <main className="sensor-main">
          {/* Header */}
          <div className="sensor-page-header">
            <div className="sensor-page-header__left">
              <p className="sensor-page-brand">ComfortSync · Sensors</p>
              <div className="sensor-page-title-row">
                <FiThermometer style={{ fontSize: "2rem", color: "#ff9ab0" }} />
                <h1 className="sensor-page-title">Temperature</h1>
                <span className="sensor-live-badge"><span className="sensor-live-badge__dot" />Live</span>
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
              <p className="sensor-card-label">Current reading</p>
              <div>
                <span className="sensor-hero-value">
                  {temp !== null ? temp.toFixed(1) : "--"}
                </span>
                <span className="sensor-hero-unit">°C</span>
              </div>
              <span className={`sensor-hero-status sensor-hero-status--${status.tone}`}>
                {status.tone === "safe" ? <FiCheckCircle /> : <FiAlertTriangle />}
                {status.label}
              </span>
              <p className="sensor-hero-timestamp">Updated {formatTs(current.recorded_at)}</p>
            </div>
            <Gauge pct={pct} />
          </div>

          {/* Stats */}
          <div className="sensor-grid-3" style={{ marginBottom: 22 }}>
            {stats.map(({ label, value }) => (
              <div key={label} className="sensor-card sensor-stat">
                <p className="sensor-card-label">{label}</p>
                <span className="sensor-stat__value">{value}</span>
              </div>
            ))}
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Change from previous</p>
              <span className="sensor-stat__value">
                {delta !== null ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} °C` : "--"}
              </span>
              <span className={`sensor-stat__trend sensor-stat__trend--${trendClass}`}>
                <TrendIcon />
                {trendClass === "flat" ? "Stable" : trendClass === "up" ? "Rising" : "Falling"}
              </span>
            </div>
          </div>

          {/* Comfort range bar */}
          <div className="sensor-card" style={{ marginBottom: 22 }}>
            <p className="sensor-card-label">Position in comfort range</p>
            <div style={{ marginTop: 14 }}>
              <div className="sensor-range__labels">
                <span>{COMFORT_MIN} °C (min)</span>
                <span>{temp !== null ? fmt(temp) : "--"}</span>
                <span>{COMFORT_MAX} °C (max)</span>
              </div>
              <div className="sensor-range__track" style={{ marginTop: 8 }}>
                <div className="sensor-range__fill" style={{ width: `${Math.min(rangePct, 100)}%` }} />
                {temp !== null && (
                  <div className="sensor-range__thumb" style={{ left: `${Math.min(rangePct, 100)}%` }} />
                )}
              </div>
            </div>
            <div className="sensor-comfort-row" style={{ marginTop: 18 }}>
              <div className="sensor-comfort-zone sensor-comfort-zone--warning">
                <div className="sensor-comfort-zone__range">{'< 18 °C'}</div>
                <div className="sensor-comfort-zone__label">Too Cold</div>
              </div>
              <div className="sensor-comfort-zone sensor-comfort-zone--safe">
                <div className="sensor-comfort-zone__range">18–26 °C</div>
                <div className="sensor-comfort-zone__label">Comfortable</div>
              </div>
              <div className="sensor-comfort-zone sensor-comfort-zone--warning">
                <div className="sensor-comfort-zone__range">26–30 °C</div>
                <div className="sensor-comfort-zone__label">Warm</div>
              </div>
              <div className="sensor-comfort-zone sensor-comfort-zone--danger">
                <div className="sensor-comfort-zone__range">{'> 30 °C'}</div>
                <div className="sensor-comfort-zone__label">Too Hot</div>
              </div>
            </div>
          </div>

          {/* Recent readings */}
          <div className="sensor-card">
            <p className="sensor-card-label">Recent readings</p>
            {isLoading ? (
              <div className="sensor-empty"><FiThermometer /><p>Loading…</p></div>
            ) : recent.length === 0 ? (
              <div className="sensor-empty"><FiThermometer /><p>No recent readings available.</p></div>
            ) : (
              <div className="sensor-history-list" style={{ marginTop: 14 }}>
                {recent.map((r, i) => {
                  const v = typeof r.temperature === "number" ? r.temperature : null;
                  const barPct = v !== null ? clampPct(v, ABS_MIN, ABS_MAX) : 0;
                  return (
                    <div key={r.id ?? i} className="sensor-history-item">
                      <span className="sensor-history-item__time">{formatTs(r.recorded_at)}</span>
                      <div className="sensor-history-item__bar-wrap">
                        <div className="sensor-history-item__bar" style={{ width: `${barPct}%` }} />
                      </div>
                      <span className="sensor-history-item__value">{v !== null ? `${v.toFixed(1)} °C` : "--"}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="sensor-note">
              <span className="sensor-note__icon">ℹ</span>
              Temperature is measured using a DHT sensor. Human comfort is typically between 18 °C and 26 °C. 
              The fan activates automatically when the room exceeds 29 °C.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

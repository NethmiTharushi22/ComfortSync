import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiSun,
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

const ABS_MAX = 1000;

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

const getStatus = (lux) => {
  if (typeof lux !== "number") return { label: "Unavailable", tone: "warning" };
  if (lux < 50)  return { label: "Dark",       tone: "warning" };
  if (lux < 120) return { label: "Dim",        tone: "warning" };
  if (lux < 500) return { label: "Adequate",   tone: "safe" };
  if (lux < 800) return { label: "Bright",     tone: "safe" };
  return              { label: "Very Bright", tone: "warning" };
};

const ZONES = [
  { label: "Dark",       range: "0–50 lux",    tone: "warning", note: "Insufficient for tasks" },
  { label: "Dim",        range: "50–120 lux",  tone: "warning", note: "Comfortable for rest" },
  { label: "Adequate",   range: "120–500 lux", tone: "safe",    note: "Good for most activities" },
  { label: "Bright",     range: "500–800 lux", tone: "safe",    note: "Suitable for reading/work" },
  { label: "Very Bright",range: "> 800 lux",   tone: "warning", note: "May cause glare" },
];

const clampPct = (v, min, max) =>
  Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

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
        <span className="sensor-gauge-sub">of scale</span>
      </div>
    </div>
  );
}

export default function LightPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { current, recent, error, isLoading } = useSensorData();

  const lux = typeof current.light === "number" ? current.light : null;
  const status = getStatus(lux);
  const gaugePct = lux !== null ? clampPct(lux, 0, ABS_MAX) : 0;
  const activeZone = ZONES.findIndex(({ label }) => label === status.label);

  const prevLux =
    recent.length >= 2
      ? (typeof recent[1]?.light === "number" ? recent[1].light : null)
      : null;
  const delta = lux !== null && prevLux !== null ? lux - prevLux : null;
  const TrendIcon =
    delta === null ? FiMinus : delta > 1 ? FiTrendingUp : delta < -1 ? FiTrendingDown : FiMinus;
  const trendClass =
    delta === null ? "flat" : delta > 1 ? "up" : delta < -1 ? "down" : "flat";

  const luxVals = recent.map((r) => r.light).filter((v) => typeof v === "number");

  return (
    <div
      className="sensor-root"
      style={{
        "--sensor-accent": "#ffe27a",
        "--sensor-accent2": "#d4a800",
        "--sensor-accent-glow": "rgba(255, 226, 122, 0.4)",
      }}
    >
      <div className="sensor-shell">
        <DashboardSidebar onLogout={logout} activeTab="Light" onNavigate={navigate} />
        <main className="sensor-main">
          {/* Header */}
          <div className="sensor-page-header">
            <div className="sensor-page-header__left">
              <p className="sensor-page-brand">ComfortSync · Sensors</p>
              <div className="sensor-page-title-row">
                <FiSun style={{ fontSize: "2rem", color: "#ffe27a" }} />
                <h1 className="sensor-page-title">Light Intensity</h1>
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
              <p className="sensor-card-label">Current light intensity</p>
              <div>
                <span className="sensor-hero-value">
                  {lux !== null ? Math.round(lux) : "--"}
                </span>
                <span className="sensor-hero-unit">lux</span>
              </div>
              <span className={`sensor-hero-status sensor-hero-status--${status.tone}`}>
                {status.tone === "safe" ? <FiCheckCircle /> : <FiAlertTriangle />}
                {status.label}
              </span>
              <p className="sensor-hero-timestamp">Updated {formatTs(current.recorded_at)}</p>
            </div>
            <Gauge pct={gaugePct} />
          </div>

          {/* Stats grid */}
          <div className="sensor-grid-3" style={{ marginBottom: 22 }}>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Session peak (lux)</p>
              <span className="sensor-stat__value">
                {luxVals.length ? Math.max(...luxVals).toFixed(0) : "--"}
              </span>
            </div>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Session min (lux)</p>
              <span className="sensor-stat__value">
                {luxVals.length ? Math.min(...luxVals).toFixed(0) : "--"}
              </span>
            </div>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Change from previous</p>
              <span className="sensor-stat__value">
                {delta !== null ? `${delta > 0 ? "+" : ""}${delta.toFixed(0)} lux` : "--"}
              </span>
              <span className={`sensor-stat__trend sensor-stat__trend--${trendClass}`}>
                <TrendIcon />
                {trendClass === "flat" ? "Stable" : trendClass === "up" ? "Rising" : "Falling"}
              </span>
            </div>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Auto-light threshold</p>
              <span className="sensor-stat__value">120 lux</span>
              <span className="sensor-stat__label">Lights turn on below this</span>
            </div>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Lights currently</p>
              <span className="sensor-stat__value" style={{ fontSize: "1.1rem" }}>
                {lux !== null ? (lux < 300 ? "ON" : "OFF") : "--"}
              </span>
            </div>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Last updated</p>
              <span className="sensor-stat__value" style={{ fontSize: "1rem" }}>
                {formatTs(current.recorded_at)}
              </span>
            </div>
          </div>

          {/* Comfort zones */}
          <div className="sensor-card" style={{ marginBottom: 22 }}>
            <p className="sensor-card-label">Lighting zones</p>
            <div className="sensor-comfort-row" style={{ marginTop: 14, flexWrap: "wrap" }}>
              {ZONES.map(({ label, range, tone, note }, i) => (
                <div
                  key={label}
                  className={`sensor-comfort-zone sensor-comfort-zone--${tone}`}
                  style={i === activeZone ? { outline: "2px solid rgba(255, 226, 122, 0.45)" } : {}}
                >
                  <div className="sensor-comfort-zone__range">{range}</div>
                  <div className="sensor-comfort-zone__label">{label}</div>
                  <div className="sensor-comfort-zone__label" style={{ marginTop: 6, fontSize: "0.7rem", opacity: 0.75 }}>
                    {note}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent readings */}
          <div className="sensor-card">
            <p className="sensor-card-label">Recent light readings</p>
            {isLoading ? (
              <div className="sensor-empty">
                <FiSun />
                <p>Loading…</p>
              </div>
            ) : recent.length === 0 ? (
              <div className="sensor-empty">
                <FiSun />
                <p>No recent readings available.</p>
              </div>
            ) : (
              <div className="sensor-history-list" style={{ marginTop: 14 }}>
                {recent.map((r, i) => {
                  const v = typeof r.light === "number" ? r.light : null;
                  const barPct = v !== null ? clampPct(v, 0, ABS_MAX) : 0;
                  return (
                    <div key={r.id ?? i} className="sensor-history-item">
                      <span className="sensor-history-item__time">{formatTs(r.recorded_at)}</span>
                      <div className="sensor-history-item__bar-wrap">
                        <div className="sensor-history-item__bar" style={{ width: `${barPct}%` }} />
                      </div>
                      <span className="sensor-history-item__value">
                        {v !== null ? `${v.toFixed(0)} lux` : "--"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="sensor-note">
              <span className="sensor-note__icon">ℹ</span>
              Light intensity is measured in lux using an LDR (light-dependent resistor) or ambient light sensor.
              ComfortSync automatically controls indoor lighting when readings fall below 120 lux or rise above 300 lux.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

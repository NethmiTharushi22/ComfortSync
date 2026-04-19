import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiWind,
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

// air_percent: 100% = clean, 0% = full of gas
// gasLevel = 100 - air_percent
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

const getStatus = (gasLevel) => {
  if (typeof gasLevel !== "number") return { label: "Unavailable", tone: "warning" };
  if (gasLevel < 20) return { label: "Clean Air", tone: "safe" };
  if (gasLevel < 30) return { label: "Low", tone: "safe" };
  if (gasLevel < 60) return { label: "Moderate", tone: "warning" };
  return { label: "High – Ventilate", tone: "danger" };
};

const clampPct = (v, min, max) =>
  Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

const CIRCUMFERENCE = 2 * Math.PI * 54;

function Gauge({ pct, label }) {
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
        <span className="sensor-gauge-sub">{label}</span>
      </div>
    </div>
  );
}

const RAW_LEVELS = [
  { label: "Clean", min: 0, max: 400, tone: "safe" },
  { label: "Moderate", min: 400, max: 700, tone: "warning" },
  { label: "High", min: 700, max: 1000, tone: "warning" },
  { label: "Very High", min: 1000, max: 1500, tone: "danger" },
];

export default function GasPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { current, recent, error, isLoading } = useSensorData();

  const airPct = typeof current.air_percent === "number" ? current.air_percent : null;
  const rawGas = typeof current.gas === "number" ? current.gas : null;
  const gasLevel = airPct !== null ? Math.max(0, Math.min(100, 100 - airPct)) : null;
  const status = getStatus(gasLevel);

  const prevAirPct =
    recent.length >= 2
      ? (typeof recent[1]?.air_percent === "number" ? recent[1].air_percent : null)
      : null;
  const prevGasLevel = prevAirPct !== null ? 100 - prevAirPct : null;
  const delta = gasLevel !== null && prevGasLevel !== null ? gasLevel - prevGasLevel : null;

  const TrendIcon =
    delta === null ? FiMinus : delta > 0.5 ? FiTrendingUp : delta < -0.5 ? FiTrendingDown : FiMinus;
  const trendClass =
    delta === null ? "flat" : delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";

  const gasVals = recent
    .map((r) => (typeof r.air_percent === "number" ? 100 - r.air_percent : null))
    .filter((v) => v !== null);

  return (
    <div
      className="sensor-root"
      style={{
        "--sensor-accent": "#f1da74",
        "--sensor-accent2": "#d4a800",
        "--sensor-accent-glow": "rgba(241, 218, 116, 0.4)",
      }}
    >
      <div className="sensor-shell">
        <DashboardSidebar onLogout={logout} activeTab="Gas" onNavigate={navigate} />
        <main className="sensor-main">
          {/* Header */}
          <div className="sensor-page-header">
            <div className="sensor-page-header__left">
              <p className="sensor-page-brand">ComfortSync · Sensors</p>
              <div className="sensor-page-title-row">
                <FiWind style={{ fontSize: "2rem", color: "#f1da74" }} />
                <h1 className="sensor-page-title">Gas / Air Quality</h1>
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

          {/* Hero row: two gauges */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) auto",
              gap: 24,
              alignItems: "center",
              marginBottom: 22,
            }}
            className="sensor-hero-card"
          >
            <div className="sensor-hero-card__left">
              <p className="sensor-card-label">Gas saturation level</p>
              <div>
                <span className="sensor-hero-value">
                  {gasLevel !== null ? gasLevel.toFixed(1) : "--"}
                </span>
                <span className="sensor-hero-unit">%</span>
              </div>
              {airPct !== null && (
                <p style={{ margin: "4px 0 0", color: "rgba(214,237,231,0.6)", fontSize: "0.9rem" }}>
                  Air quality: <strong style={{ color: "#8ef4ca" }}>{airPct.toFixed(1)}% clean</strong>
                  {rawGas !== null && <> · Raw MQ135: <strong style={{ color: "#f1da74" }}>{rawGas.toFixed(0)} ppm</strong></>}
                </p>
              )}
              <span className={`sensor-hero-status sensor-hero-status--${status.tone}`}>
                {status.tone === "safe" ? <FiCheckCircle /> : <FiAlertTriangle />}
                {status.label}
              </span>
              <p className="sensor-hero-timestamp">Updated {formatTs(current.recorded_at)}</p>
            </div>
            <Gauge pct={gasLevel ?? 0} label="gas level" />
          </div>

          {/* Stats grid */}
          <div className="sensor-grid-3" style={{ marginBottom: 22 }}>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Air quality %</p>
              <span className="sensor-stat__value">
                {airPct !== null ? `${airPct.toFixed(1)}%` : "--"}
              </span>
            </div>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Raw MQ135 (ppm)</p>
              <span className="sensor-stat__value">
                {rawGas !== null ? rawGas.toFixed(0) : "--"}
              </span>
            </div>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Session peak gas %</p>
              <span className="sensor-stat__value">
                {gasVals.length ? `${Math.max(...gasVals).toFixed(1)}%` : "--"}
              </span>
            </div>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Session min gas %</p>
              <span className="sensor-stat__value">
                {gasVals.length ? `${Math.min(...gasVals).toFixed(1)}%` : "--"}
              </span>
            </div>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Change from previous</p>
              <span className="sensor-stat__value">
                {delta !== null ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%` : "--"}
              </span>
              <span className={`sensor-stat__trend sensor-stat__trend--${trendClass}`}>
                <TrendIcon />
                {trendClass === "flat" ? "Stable" : trendClass === "up" ? "Rising" : "Falling"}
              </span>
            </div>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Last updated</p>
              <span className="sensor-stat__value" style={{ fontSize: "1rem" }}>
                {formatTs(current.recorded_at)}
              </span>
            </div>
          </div>

          {/* MQ135 raw level bands */}
          <div className="sensor-card" style={{ marginBottom: 22 }}>
            <p className="sensor-card-label">MQ135 raw reading bands</p>
            <div className="sensor-comfort-row" style={{ marginTop: 14 }}>
              {RAW_LEVELS.map(({ label, min, max, tone }) => {
                const isActive =
                  rawGas !== null && rawGas >= min && rawGas < max;
                return (
                  <div
                    key={label}
                    className={`sensor-comfort-zone sensor-comfort-zone--${tone}`}
                    style={isActive ? { outline: "2px solid rgba(108,240,189,0.5)" } : {}}
                  >
                    <div className="sensor-comfort-zone__range">
                      {min}–{max} ppm
                    </div>
                    <div className="sensor-comfort-zone__label">{label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent readings */}
          <div className="sensor-card">
            <p className="sensor-card-label">Recent air quality readings</p>
            {isLoading ? (
              <div className="sensor-empty">
                <FiWind />
                <p>Loading…</p>
              </div>
            ) : recent.length === 0 ? (
              <div className="sensor-empty">
                <FiWind />
                <p>No recent readings available.</p>
              </div>
            ) : (
              <div className="sensor-history-list" style={{ marginTop: 14 }}>
                {recent.map((r, i) => {
                  const ap = typeof r.air_percent === "number" ? r.air_percent : null;
                  const gl = ap !== null ? 100 - ap : null;
                  return (
                    <div key={r.id ?? i} className="sensor-history-item">
                      <span className="sensor-history-item__time">{formatTs(r.recorded_at)}</span>
                      <div className="sensor-history-item__bar-wrap">
                        <div
                          className="sensor-history-item__bar"
                          style={{ width: `${gl ?? 0}%` }}
                        />
                      </div>
                      <span className="sensor-history-item__value">
                        {gl !== null ? `${gl.toFixed(1)}%` : "--"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="sensor-note">
              <span className="sensor-note__icon">ℹ</span>
              The MQ135 gas sensor measures the concentration of harmful gases including CO₂, NH₃, NOₓ, alcohol, benzene, and smoke.
              Air quality percentage represents how clean the air is — 100 % is fully clean. Fan activates when gas readings exceed 800 ppm.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

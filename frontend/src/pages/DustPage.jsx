import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiCloud,
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

const ABS_MAX = 500;

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

// EPA PM2.5 → AQI
const PM25_BREAKPOINTS = [
  { cLow: 0.0,   cHigh: 9.0,   iLow: 0,   iHigh: 50,  label: "Good",                         tone: "safe" },
  { cLow: 9.1,   cHigh: 35.4,  iLow: 51,  iHigh: 100, label: "Moderate",                     tone: "warning" },
  { cLow: 35.5,  cHigh: 55.4,  iLow: 101, iHigh: 150, label: "Unhealthy for Sensitive Groups",tone: "warning" },
  { cLow: 55.5,  cHigh: 125.4, iLow: 151, iHigh: 200, label: "Unhealthy",                     tone: "danger" },
  { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300, label: "Very Unhealthy",                tone: "danger" },
  { cLow: 225.5, cHigh: 500.4, iLow: 301, iHigh: 500, label: "Hazardous",                     tone: "danger" },
];

const getAqi = (pm25) => {
  if (typeof pm25 !== "number" || !Number.isFinite(pm25) || pm25 < 0) {
    return { value: null, label: "Unavailable", tone: "warning", bp: null };
  }
  const t = Math.floor(pm25 * 10) / 10;
  const bp = PM25_BREAKPOINTS.find((b) => t >= b.cLow && t <= b.cHigh) ?? PM25_BREAKPOINTS.at(-1);
  const aqi = Math.round(
    ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (t - bp.cLow) + bp.iLow
  );
  return { value: Math.min(aqi, 500), label: bp.label, tone: bp.tone, bp };
};

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
        <span className="sensor-gauge-sub">of max AQI</span>
      </div>
    </div>
  );
}

export default function DustPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { current, recent, error, isLoading } = useSensorData();

  const dust = typeof current.dust === "number" ? current.dust : null;
  const { value: aqiVal, label: aqiLabel, tone: aqiTone, bp: activeBp } = getAqi(dust);
  const gaugePct = aqiVal !== null ? clampPct(aqiVal, 0, 500) : 0;

  const prevDust =
    recent.length >= 2
      ? (typeof recent[1]?.dust === "number" ? recent[1].dust : null)
      : null;
  const delta = dust !== null && prevDust !== null ? dust - prevDust : null;
  const TrendIcon =
    delta === null ? FiMinus : delta > 0.5 ? FiTrendingUp : delta < -0.5 ? FiTrendingDown : FiMinus;
  const trendClass =
    delta === null ? "flat" : delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";

  const dustVals = recent.map((r) => r.dust).filter((v) => typeof v === "number");

  return (
    <div
      className="sensor-root"
      style={{
        "--sensor-accent": "#c8a8f0",
        "--sensor-accent2": "#9060d8",
        "--sensor-accent-glow": "rgba(200, 168, 240, 0.4)",
      }}
    >
      <div className="sensor-shell">
        <DashboardSidebar onLogout={logout} activeTab="Dust" onNavigate={navigate} />
        <main className="sensor-main">
          {/* Header */}
          <div className="sensor-page-header">
            <div className="sensor-page-header__left">
              <p className="sensor-page-brand">ComfortSync · Sensors</p>
              <div className="sensor-page-title-row">
                <FiCloud style={{ fontSize: "2rem", color: "#c8a8f0" }} />
                <h1 className="sensor-page-title">Dust / PM2.5</h1>
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
              <p className="sensor-card-label">Current PM2.5 concentration</p>
              <div>
                <span className="sensor-hero-value">
                  {dust !== null ? dust.toFixed(1) : "--"}
                </span>
                <span className="sensor-hero-unit">µg/m³</span>
              </div>
              {aqiVal !== null && (
                <p style={{ margin: "4px 0 0", color: "rgba(214,237,231,0.6)", fontSize: "0.9rem" }}>
                  AQI: <strong style={{ color: "#c8a8f0" }}>{aqiVal}</strong>
                </p>
              )}
              <span className={`sensor-hero-status sensor-hero-status--${aqiTone}`}>
                {aqiTone === "safe" ? <FiCheckCircle /> : <FiAlertTriangle />}
                {aqiLabel}
              </span>
              <p className="sensor-hero-timestamp">Updated {formatTs(current.recorded_at)}</p>
            </div>
            <Gauge pct={gaugePct} />
          </div>

          {/* Stats */}
          <div className="sensor-grid-3" style={{ marginBottom: 22 }}>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">AQI value</p>
              <span className="sensor-stat__value">{aqiVal ?? "--"}</span>
            </div>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">AQI category</p>
              <span className="sensor-stat__value" style={{ fontSize: "1.1rem" }}>
                {aqiLabel}
              </span>
            </div>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Session peak (µg/m³)</p>
              <span className="sensor-stat__value">
                {dustVals.length ? Math.max(...dustVals).toFixed(1) : "--"}
              </span>
            </div>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Session min (µg/m³)</p>
              <span className="sensor-stat__value">
                {dustVals.length ? Math.min(...dustVals).toFixed(1) : "--"}
              </span>
            </div>
            <div className="sensor-card sensor-stat">
              <p className="sensor-card-label">Change from previous</p>
              <span className="sensor-stat__value">
                {delta !== null ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} µg/m³` : "--"}
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

          {/* EPA AQI breakpoints table */}
          <div className="sensor-card" style={{ marginBottom: 22 }}>
            <p className="sensor-card-label">EPA PM2.5 AQI breakpoints</p>
            <div className="sensor-aqi-band" style={{ marginTop: 14 }}>
              {PM25_BREAKPOINTS.map((bp) => {
                const isActive = activeBp === bp;
                return (
                  <div
                    key={bp.label}
                    className={`sensor-aqi-row sensor-aqi-row--${bp.tone}${isActive ? " sensor-aqi-row--active" : ""}`}
                  >
                    <span className="sensor-aqi-row__label">{bp.label}</span>
                    <span className="sensor-aqi-row__range">
                      {bp.cLow}–{bp.cHigh} µg/m³
                    </span>
                    <span className="sensor-aqi-row__index">
                      {bp.iLow}–{bp.iHigh}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent readings */}
          <div className="sensor-card">
            <p className="sensor-card-label">Recent PM2.5 readings</p>
            {isLoading ? (
              <div className="sensor-empty">
                <FiCloud />
                <p>Loading…</p>
              </div>
            ) : recent.length === 0 ? (
              <div className="sensor-empty">
                <FiCloud />
                <p>No recent readings available.</p>
              </div>
            ) : (
              <div className="sensor-history-list" style={{ marginTop: 14 }}>
                {recent.map((r, i) => {
                  const v = typeof r.dust === "number" ? r.dust : null;
                  const barPct = v !== null ? clampPct(v, 0, ABS_MAX) : 0;
                  return (
                    <div key={r.id ?? i} className="sensor-history-item">
                      <span className="sensor-history-item__time">{formatTs(r.recorded_at)}</span>
                      <div className="sensor-history-item__bar-wrap">
                        <div
                          className="sensor-history-item__bar"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <span className="sensor-history-item__value">
                        {v !== null ? `${v.toFixed(1)} µg/m³` : "--"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="sensor-note">
              <span className="sensor-note__icon">ℹ</span>
              PM2.5 refers to fine particulate matter 2.5 micrometres or smaller. The AQI is calculated using EPA breakpoints.
              The ventilation fan activates automatically when dust concentration exceeds 40 µg/m³.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  FiBell,
  FiCloud,
  FiDroplet,
  FiSun,
  FiThermometer,
  FiTrendingUp,
  FiWind,
  FiZap,
} from "react-icons/fi";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import DashboardHeader from "../components/DashboardHeader";
import DashboardSidebar from "../components/DashboardSidebar";
import "./Dashboard.css";

const tabs = ["Dashboard", "Analytics", "Settings"];

const forecast = [
  { label: "Temperature", value: "+1.8 C", note: "Likely to rise by evening" },
  { label: "Humidity", value: "+4%", note: "Indoor moisture trend increasing" },
  { label: "Gas level", value: "+12 ppm", note: "Peak cooking period expected" },
  { label: "Dust level", value: "+8 ug/m3", note: "Windows open scenario detected" },
];

const hourlySeries = [
  { time: "08:00", temp: 24.8, humidity: 54, gas: 62, dust: 34 },
  { time: "10:00", temp: 25.4, humidity: 55, gas: 66, dust: 36 },
  { time: "12:00", temp: 26.2, humidity: 57, gas: 72, dust: 42 },
  { time: "14:00", temp: 26.9, humidity: 59, gas: 81, dust: 48 },
  { time: "16:00", temp: 27.4, humidity: 60, gas: 84, dust: 52 },
  { time: "18:00", temp: 28.1, humidity: 62, gas: 91, dust: 58 },
];

const clampPercent = (value, max) => `${Math.min((value / max) * 100, 100)}%`;
const POLL_INTERVAL_MS = 5000;

const DEFAULT_REALTIME = {
  temperature: 26.4,
  humidity: 58,
  gas: 84,
  light: 72,
  dust: 46,
};

const FALLBACK_DEVICES = [
  {
    label: "Ventilation Fan",
    description: "Waiting for live device status",
    state: "OFF",
    tone: "safe",
  },
  {
    label: "Lights Control",
    description: "Waiting for live light data",
    state: "DIM",
    tone: "safe",
  },
];

const numberOrFallback = (value, fallback) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const getAqiSummary = (dust, gas) => {
  const dustScore = Math.min(Math.round((dust / 150) * 300), 300);
  const gasScore = Math.min(Math.round((gas / 1000) * 220), 220);
  const aqi = Math.max(18, Math.min(300, Math.round(dustScore * 0.65 + gasScore * 0.35)));

  if (aqi <= 50) {
    return { value: aqi, label: "Good", tone: "safe", note: "Air quality is stable and comfortable." };
  }

  if (aqi <= 100) {
    return {
      value: aqi,
      label: "Moderate",
      tone: "warning",
      note: "Sensitive users may notice slight discomfort.",
    };
  }

  return {
    value: aqi,
    label: "Unhealthy",
    tone: "danger",
    note: "Ventilation is recommended to improve indoor air.",
  };
};

const formatDelta = (currentValue, previousValue, unit) => {
  if (typeof currentValue !== "number" || typeof previousValue !== "number") {
    return "Waiting for trend data";
  }

  const delta = currentValue - previousValue;
  if (Math.abs(delta) < 0.1) {
    return "Stable since previous reading";
  }

  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} ${unit} from previous reading`;
};

const formatTimestamp = (value) => {
  if (!value) {
    return "Waiting for live timestamp";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Waiting for live timestamp";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    month: "short",
    day: "numeric",
  }).format(parsed);
};

export default function Dashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardError, setDashboardError] = useState("");
  const [activeTab, setActiveTab] = useState("Dashboard");

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        const { data } = await api.get("/api/sensors/dashboard");
        if (!isMounted) {
          return;
        }

        setDashboardData(data);
        setDashboardError("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          error.response?.data?.detail ||
          error.message ||
          "Unable to load live dashboard data.";
        setDashboardError(message);
      }
    };

    loadDashboard();
    const intervalId = window.setInterval(loadDashboard, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleRefresh = async () => {
    try {
      const { data } = await api.get("/api/sensors/dashboard");
      setDashboardData(data);
      setDashboardError("");
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        error.message ||
        "Unable to load live dashboard data.";
      setDashboardError(message);
    }
  };

  const liveReading = dashboardData?.current;
  const previousReading = dashboardData?.recent_readings?.[1];
  const realtime = {
    temperature: numberOrFallback(liveReading?.temperature, DEFAULT_REALTIME.temperature),
    humidity: numberOrFallback(liveReading?.humidity, DEFAULT_REALTIME.humidity),
    gas: numberOrFallback(liveReading?.gas, DEFAULT_REALTIME.gas),
    light: numberOrFallback(liveReading?.light, DEFAULT_REALTIME.light),
    dust: numberOrFallback(liveReading?.dust, DEFAULT_REALTIME.dust),
  };
  const alertItems =
    dashboardData?.alerts?.length
      ? dashboardData.alerts
      : [
          {
            title: "Realtime sync active",
            detail: "Waiting for backend data. Default sensor placeholders are visible.",
            tone: "safe",
          },
        ];
  const hasAlerts =
    Boolean(dashboardError) ||
    alertItems.some((alert) => alert.tone === "warning" || alert.tone === "danger");
  const deviceItems = dashboardData?.devices?.length ? dashboardData.devices : FALLBACK_DEVICES;
  const latestUpdated = formatTimestamp(liveReading?.recorded_at);
  const aqi = getAqiSummary(realtime.dust, realtime.gas);
  const aqiGaugeStyle = {
    "--aqi-angle": `${Math.min((aqi.value / 300) * 180, 180)}deg`,
  };

  const sensorCards = [
    {
      label: "Temperature",
      value: realtime.temperature,
      unit: "C",
      note: formatDelta(realtime.temperature, previousReading?.temperature, "C"),
      tone: "rose",
      icon: <FiThermometer />,
    },
    {
      label: "Humidity",
      value: realtime.humidity,
      unit: "%",
      note: formatDelta(realtime.humidity, previousReading?.humidity, "%"),
      tone: "sky",
      icon: <FiDroplet />,
    },
    {
      label: "Total gas level",
      value: realtime.gas,
      unit: "ppm",
      note: formatDelta(realtime.gas, previousReading?.gas, "ppm"),
      tone: realtime.gas >= 800 ? "rose" : "gold",
      icon: <FiCloud />,
    },
    {
      label: "Light intensity",
      value: realtime.light,
      unit: "lux",
      note: formatDelta(realtime.light, previousReading?.light, "lux"),
      tone: "mint",
      icon: <FiSun />,
    },
    {
      label: "Dust level",
      value: realtime.dust,
      unit: "ug/m3",
      note: formatDelta(realtime.dust, previousReading?.dust, "ug/m3"),
      tone: realtime.dust >= 40 ? "gold" : "mint",
      icon: <FiWind />,
    },
  ];

  return (
    <main className="dashboard-root">
      <section className="dashboard-shell">
        <DashboardSidebar onLogout={logout} />

        <section className="dashboard-main">
          <DashboardHeader
            isAuthenticated={isAuthenticated}
            userEmail={user?.email}
            hasAlerts={hasAlerts}
          />

          <div className="dashboard-tabs" role="tablist" aria-label="Dashboard views">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={`dashboard-tab ${activeTab === tab ? "dashboard-tab--active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "Dashboard" ? (
            <section className="dashboard-grid">
              <article className="dashboard-card dashboard-card--hero">
                <div className="dashboard-card__header">
                  <div>
                    <p className="dashboard-card-label">Realtime environmental values</p>
                    <h2>All sensors</h2>
                  </div>
                  <button type="button" className="dashboard-pill-button" onClick={handleRefresh}>
                    Refresh live data
                  </button>
                </div>

                <p className="dashboard-card-label">Last update: {latestUpdated}</p>

                <div className="dashboard-sensor-grid">
                  {sensorCards.map((card) => (
                    <article key={card.label} className="dashboard-sensor-card">
                      <div className="dashboard-sensor-card__top">
                        <p className="dashboard-card-label">{card.label}</p>
                        <span className={`dashboard-stat__icon dashboard-stat__icon--${card.tone}`}>
                          {card.icon}
                        </span>
                      </div>
                      <p className="dashboard-stat__value">
                        {card.value}
                        <span> {card.unit}</span>
                      </p>
                      <p
                        className={`dashboard-stat__delta ${
                          card.tone === "gold" || card.tone === "rose"
                            ? "dashboard-stat__delta--warning"
                            : ""
                        }`}
                      >
                        {card.note}
                      </p>
                    </article>
                  ))}
                </div>
              </article>

              <article className="dashboard-card dashboard-card--controls">
                <div className="dashboard-card__header">
                  <div>
                    <p className="dashboard-card-label">Device status</p>
                    <h2>Device controls</h2>
                  </div>
                  <FiZap className="dashboard-card__trend" />
                </div>

                <div className="dashboard-device-panel">
                  <article className="dashboard-control-card">
                    <div className="dashboard-control-card__icon">
                      <FiWind />
                    </div>
                    <div className="dashboard-control-card__content">
                      <strong>{deviceItems[0]?.label ?? "Ventilation Fan"}</strong>
                      <p>{deviceItems[0]?.description ?? "Auto Mode Active"}</p>
                    </div>
                    <span className="dashboard-control-card__pill">
                      {deviceItems[0]?.state ?? "OFF"}
                    </span>
                  </article>

                  <article className="dashboard-light-card">
                    <div className="dashboard-light-card__header">
                      <strong>{deviceItems[1]?.label ?? "Lights Control"}</strong>
                      <span>&gt;</span>
                    </div>

                    <div className="dashboard-light-card__bulbs" aria-hidden="true">
                      <span className="dashboard-light-bulb dashboard-light-bulb--off" />
                      <span className="dashboard-light-bulb dashboard-light-bulb--off" />
                      <span className="dashboard-light-bulb dashboard-light-bulb--active" />
                      <span className="dashboard-light-bulb dashboard-light-bulb--dim" />
                    </div>

                    <div className="dashboard-light-card__status">
                      <strong>{deviceItems[1]?.state ?? "DIM"}</strong>
                      <button type="button" className="dashboard-light-switch" aria-label="Lights on">
                        <span />
                      </button>
                    </div>

                    <p className="dashboard-light-card__meta">
                      {deviceItems[1]?.description ?? "Balanced indoor lighting"}: {realtime.light} lux
                    </p>
                  </article>
                </div>
              </article>

              <article className="dashboard-card dashboard-card--alerts">
                <div className="dashboard-card__header">
                  <div>
                    <p className="dashboard-card-label">Notifications</p>
                    <h2>Active alerts</h2>
                  </div>
                  <button type="button" className="dashboard-alert-button" onClick={handleRefresh}>
                    Refresh data
                  </button>
                </div>

                {dashboardError ? <p className="dashboard-alert-banner">{dashboardError}</p> : null}

                <div className="dashboard-alert-list">
                  {alertItems.map((alert) => (
                    <article
                      key={alert.title}
                      className={`dashboard-alert-item dashboard-alert-item--${alert.tone}`}
                    >
                      <div className="dashboard-alert-item__icon">
                        <FiBell />
                      </div>
                      <div className="dashboard-alert-item__content">
                        <strong>{alert.title}</strong>
                        <p>{alert.detail}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </article>

              <article className="dashboard-card dashboard-card--insights">
                <div className="dashboard-card__header">
                  <div>
                    <p className="dashboard-card-label">Predictive insights</p>
                    <h2>Next hours outlook</h2>
                  </div>
                  <FiTrendingUp className="dashboard-card__trend" />
                </div>

                <div className="dashboard-insight-list">
                  {forecast.slice(0, 3).map((item) => (
                    <article key={item.label} className="dashboard-insight-item">
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.note}</p>
                      </div>
                      <span>{item.value}</span>
                    </article>
                  ))}
                </div>
              </article>

              <article className="dashboard-card dashboard-card--aqi">
                <div className="dashboard-card__header">
                  <div>
                    <p className="dashboard-card-label">AQI gauge</p>
                    <h2>Indoor air quality</h2>
                  </div>
                  <FiWind className="dashboard-card__trend" />
                </div>

                <div className="dashboard-aqi-panel">
                  <div className="dashboard-aqi-gauge" style={aqiGaugeStyle}>
                    <div className="dashboard-aqi-gauge__arc" />
                    <div className={`dashboard-aqi-gauge__needle dashboard-aqi-gauge__needle--${aqi.tone}`} />
                    <div className="dashboard-aqi-gauge__center">
                      <strong>{aqi.value}</strong>
                      <span>{aqi.label}</span>
                    </div>
                  </div>

                  <div className="dashboard-aqi-scale" aria-hidden="true">
                    <span>0</span>
                    <span>150</span>
                    <span>300</span>
                  </div>

                  <div className={`dashboard-aqi-summary dashboard-aqi-summary--${aqi.tone}`}>
                    <strong>{aqi.label}</strong>
                    <p>{aqi.note}</p>
                  </div>
                </div>
              </article>
            </section>
          ) : null}

          {activeTab === "Analytics" ? (
            <Analytics
              forecast={forecast}
              hourlySeries={hourlySeries}
              clampPercent={clampPercent}
            />
          ) : null}

          {activeTab === "Settings" ? <Settings /> : null}
        </section>
      </section>
    </main>
  );
}

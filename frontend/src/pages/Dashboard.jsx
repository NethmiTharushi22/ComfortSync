import { useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiBell,
  FiCloud,
  FiDroplet,
  FiSun,
  FiThermometer,
  FiTrendingUp,
  FiWind,
  FiZap,
} from "react-icons/fi";
import Analytics from "./Analytics";
import Settings from "./Settings";
import { useAuth } from "../context/AuthContext";
import DashboardHeader from "../components/DashboardHeader";
import DashboardSidebar from "../components/DashboardSidebar";
import {
  addSampleReading,
  getLatestReadings,
  upsertUserProfile,
} from "../firebase/comfortsyncRepository";
import "./Dashboard.css";

const tabs = ["Dashboard", "Analytics", "Settings"];

const gasBreakdown = [
  { name: "CO2", value: 84, unit: "ppm", tone: "mint" },
  { name: "VOC", value: 153, unit: "index", tone: "gold" },
  { name: "LPG", value: 18, unit: "ppm", tone: "sky" },
  { name: "Methane", value: 11, unit: "ppm", tone: "rose" },
];

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

export default function Dashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  const [readings, setReadings] = useState([]);
  const [firebaseError, setFirebaseError] = useState("");
  const [activeTab, setActiveTab] = useState("Dashboard");

  useEffect(() => {
    if (isAuthenticated) {
      upsertUserProfile(user).catch((error) => {
        setFirebaseError(error.message);
      });
    }

    getLatestReadings()
      .then(setReadings)
      .catch((error) => {
        setFirebaseError(error.message);
      });
  }, [isAuthenticated, user]);

  const handleAddSample = async () => {
    setFirebaseError("");

    try {
      await addSampleReading();
      const latest = await getLatestReadings();
      setReadings(latest);
    } catch (error) {
      setFirebaseError(error.message);
    }
  };

  const liveReading = readings[0];
  const realtime = {
    temperature: liveReading?.temperature ?? 26.4,
    humidity: liveReading?.humidity ?? 58,
    gas: liveReading?.co2 ?? 84,
    light: 72,
    dust: 46,
  };

  const alertItems = [
    realtime.gas > 80
      ? {
          title: "Gas level increased",
          detail: `Total gas level is ${realtime.gas} ppm and moving above the safe comfort band.`,
          tone: "danger",
        }
      : null,
    realtime.dust > 40
      ? {
          title: "Dust level increased",
          detail: `Dust concentration reached ${realtime.dust} ug/m3 and needs ventilation.`,
          tone: "warning",
        }
      : null,
    {
      title: "Realtime sync active",
      detail: "Sensor stream is updating and dashboard widgets are in live preview mode.",
      tone: "safe",
    },
  ].filter(Boolean);

  const hasAlerts = Boolean(firebaseError) || alertItems.length > 1;

  const sensorCards = [
    {
      label: "Temperature",
      value: realtime.temperature,
      unit: "C",
      note: "+0.6 from last hour",
      tone: "rose",
      icon: <FiThermometer />,
    },
    {
      label: "Humidity",
      value: realtime.humidity,
      unit: "%",
      note: "+2 stable rise",
      tone: "sky",
      icon: <FiDroplet />,
    },
    {
      label: "Total gas level",
      value: realtime.gas,
      unit: "ppm",
      note: "Alert threshold nearby",
      tone: "gold",
      icon: <FiCloud />,
    },
    {
      label: "Light intensity",
      value: realtime.light,
      unit: "%",
      note: "Daylight supported",
      tone: "mint",
      icon: <FiSun />,
    },
    {
      label: "Dust level",
      value: realtime.dust,
      unit: "ug/m3",
      note: "Moderate particulate load",
      tone: "gold",
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
                  <button type="button" className="dashboard-pill-button" onClick={handleAddSample}>
                    Refresh preview
                  </button>
                </div>

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

              <article className="dashboard-card dashboard-card--gases">
                <div className="dashboard-card__header">
                  <div>
                    <p className="dashboard-card-label">Gas composition</p>
                    <h2>Detected gases and levels</h2>
                  </div>
                  <FiCloud className="dashboard-card__trend" />
                </div>

                <div className="dashboard-gas-list">
                  {gasBreakdown.map((gas) => (
                    <article key={gas.name} className="dashboard-gas-item">
                      <div className="dashboard-gas-item__meta">
                        <strong>{gas.name}</strong>
                        <span>
                          {gas.value} {gas.unit}
                        </span>
                      </div>
                      <div className="dashboard-gas-item__track">
                        <span
                          className={`dashboard-gas-item__fill dashboard-gas-item__fill--${gas.tone}`}
                          style={{ width: clampPercent(gas.value, gas.unit === "index" ? 200 : 100) }}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </article>

              <article className="dashboard-card dashboard-card--alerts">
                <div className="dashboard-card__header">
                  <div>
                    <p className="dashboard-card-label">Notifications</p>
                    <h2>Active alerts</h2>
                  </div>
                  <button type="button" className="dashboard-alert-button" onClick={handleAddSample}>
                    Refresh data
                  </button>
                </div>

                {firebaseError ? <p className="dashboard-alert-banner">{firebaseError}</p> : null}

                <div className="dashboard-alert-list">
                  {alertItems.map((alert) => (
                    <article
                      key={alert.title}
                      className={`dashboard-alert-item dashboard-alert-item--${alert.tone}`}
                    >
                      <div className="dashboard-alert-item__icon">
                        <FiBell />
                      </div>
                      <div>
                        <strong>{alert.title}</strong>
                        <p>{alert.detail}</p>
                      </div>
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
                      <strong>Ventilation Fan</strong>
                      <p>Auto Mode Active</p>
                    </div>
                    <span className="dashboard-control-card__pill">ON</span>
                  </article>

                  <article className="dashboard-light-card">
                    <div className="dashboard-light-card__header">
                      <strong>Lights Control</strong>
                      <span>&gt;</span>
                    </div>

                    <div className="dashboard-light-card__bulbs" aria-hidden="true">
                      <span className="dashboard-light-bulb dashboard-light-bulb--off" />
                      <span className="dashboard-light-bulb dashboard-light-bulb--off" />
                      <span className="dashboard-light-bulb dashboard-light-bulb--active" />
                      <span className="dashboard-light-bulb dashboard-light-bulb--dim" />
                    </div>

                    <div className="dashboard-light-card__status">
                      <strong>Medium</strong>
                      <button type="button" className="dashboard-light-switch" aria-label="Lights on">
                        <span />
                      </button>
                    </div>

                    <p className="dashboard-light-card__meta">Current Brightness: 400 lux</p>
                  </article>
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

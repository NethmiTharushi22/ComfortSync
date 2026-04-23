import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FiCloud,
  FiDroplet,
  FiSun,
  FiThermometer,
  FiTrendingUp,
  FiWind,
} from "react-icons/fi";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import DashboardHeader from "../components/DashboardHeader";
import DashboardSidebar from "../components/DashboardSidebar";
import "./Dashboard.css";
import "./Analytics.css";

const chartPalette = {
  mint: "#84f2bf",
  sky: "#7fd2ff",
  gold: "#f1da74",
  rose: "#ff9ab0",
  aqua: "#75eff1",
};

const rangeOptions = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const sensorOptions = [
  { value: "", label: "All sensors" },
  { value: "ESP32_ComfortSync", label: "ESP32_ComfortSync" },
];

const dataModeOptions = [
  { value: "", label: "All modes" },
  { value: "accelerated_demo", label: "Accelerated demo" },
];

const defaultRanges = {
  temperature: "day",
  dust: "day",
  gas: "day",
  humidity: "day",
  light: "day",
};

const formatTimestampLabel = (value) => {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsed);
};

const formatDayLabel = (value) => {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
  }).format(parsed);
};

const formatDateLabel = (value) => {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(parsed);
};

const average = (values) => {
  const clean = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!clean.length) return null;
  return Number((clean.reduce((sum, value) => sum + value, 0) / clean.length).toFixed(2));
};

const bucketReadings = (readings, keyFn, labelFn) => {
  const buckets = new Map();

  readings.forEach((reading) => {
    const key = keyFn(reading);
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(reading);
  });

  return Array.from(buckets.entries()).map(([key, bucket], index) => ({
    index: index + 1,
    time: labelFn(bucket[0]),
    temperature: average(bucket.map((r) => r.temperature)),
    humidity: average(bucket.map((r) => r.humidity)),
    dust: average(bucket.map((r) => r.dust)),
    light: average(bucket.map((r) => r.light)),
    air_percent: average(bucket.map((r) => r.air_percent)),
  }));
};

const groupReadings = (readings, range) => {
  if (!Array.isArray(readings) || !readings.length) {
    return [];
  }

  const sorted = [...readings].sort(
    (a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)
  );

  if (range === "day") {
    return sorted.slice(-24).map((reading, index) => ({
      index: index + 1,
      time: formatTimestampLabel(reading.recorded_at),
      temperature: reading.temperature ?? null,
      humidity: reading.humidity ?? null,
      dust: reading.dust ?? null,
      light: reading.light ?? null,
      air_percent: reading.air_percent ?? null,
    }));
  }

  if (range === "week") {
    const source = sorted.slice(-60);
    return bucketReadings(
      source,
      (reading) => new Date(reading.recorded_at).toDateString(),
      (reading) => formatDayLabel(reading.recorded_at)
    ).slice(-7);
  }

  const source = sorted.slice(-120);
  return bucketReadings(
    source,
    (reading) => {
      const d = new Date(reading.recorded_at);
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    },
    (reading) => formatDateLabel(reading.recorded_at)
  ).slice(-30);
};

const formatComparisonValue = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "--";

const getComparisonDelta = (current, next) => {
  if (
    typeof current !== "number" ||
    !Number.isFinite(current) ||
    typeof next !== "number" ||
    !Number.isFinite(next)
  ) {
    return { delta: "--", direction: "unknown" };
  }

  const raw = next - current;
  if (Math.abs(raw) < 0.01) {
    return { delta: "0.00", direction: "stable" };
  }

  return {
    delta: raw > 0 ? `+${raw.toFixed(2)}` : raw.toFixed(2),
    direction: raw > 0 ? "increasing" : "decreasing",
  };
};

function AnalyticsTooltip({ active, payload, label, unitMap = {} }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="analytics-tooltip">
      <strong>{label}</strong>
      <div className="analytics-tooltip__list">
        {payload.map((entry) => (
          <p key={entry.dataKey}>
            <span style={{ backgroundColor: entry.color }} />
            {entry.name}: {entry.value}
            {unitMap[entry.dataKey] ? ` ${unitMap[entry.dataKey]}` : ""}
          </p>
        ))}
      </div>
    </div>
  );
}

function RangeSelect({ value, onChange }) {
  return (
    <label className="analytics-range-select">
      <span>Range</span>
      <select value={value} onChange={onChange} aria-label="Select time range">
        {rangeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const [timeRanges, setTimeRanges] = useState(defaultRanges);
  const [dashboardData, setDashboardData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sensorIdFilter, setSensorIdFilter] = useState("");
  const [dataModeFilter, setDataModeFilter] = useState("");

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  const handleRangeChange = (chartKey) => (event) => {
    const nextRange = event.target.value;
    setTimeRanges((current) => ({
      ...current,
      [chartKey]: nextRange,
    }));
  };

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setIsLoading(true);

        const params = {
          sensor_id: sensorIdFilter || undefined,
          data_mode: dataModeFilter || undefined,
        };

        const [dashboardResponse, forecastResponse] = await Promise.all([
          api.get("/api/sensors/dashboard", { params }),
          fetch("http://localhost:8000/api/forecast/latest"),
        ]);

        const forecastJson = forecastResponse.ok ? await forecastResponse.json() : null;

        setDashboardData(dashboardResponse.data);
        setForecastData(forecastJson?.forecast ?? null);
      } catch (error) {
        console.error("Analytics load error:", error);
        setDashboardData(null);
        setForecastData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [sensorIdFilter, dataModeFilter]);

  const sortedReadings = useMemo(() => {
    return [...(dashboardData?.recent_readings ?? [])].sort(
      (a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)
    );
  }, [dashboardData]);

  const temperatureData = useMemo(
    () => groupReadings(sortedReadings, timeRanges.temperature),
    [sortedReadings, timeRanges.temperature]
  );

  const dustData = useMemo(
    () => groupReadings(sortedReadings, timeRanges.dust),
    [sortedReadings, timeRanges.dust]
  );

  const gasData = useMemo(
    () => groupReadings(sortedReadings, timeRanges.gas),
    [sortedReadings, timeRanges.gas]
  );

  const humidityData = useMemo(
    () => groupReadings(sortedReadings, timeRanges.humidity),
    [sortedReadings, timeRanges.humidity]
  );

  const lightData = useMemo(
    () => groupReadings(sortedReadings, timeRanges.light),
    [sortedReadings, timeRanges.light]
  );

  const comparisonItems = useMemo(() => {
    const current = dashboardData?.current ?? {};

    return [
      {
        label: "Temperature",
        current: current.temperature,
        forecast: forecastData?.temperature?.predicted_next,
        unit: "°C",
      },
      {
        label: "Humidity",
        current: current.humidity,
        forecast: forecastData?.humidity?.predicted_next,
        unit: "%",
      },
      {
        label: "Air Quality",
        current: current.air_percent,
        forecast: forecastData?.air_percent?.predicted_next,
        unit: "%",
      },
      {
        label: "Dust",
        current: current.dust,
        forecast: forecastData?.dust_concentration?.predicted_next,
        unit: "ug/m3",
      },
    ];
  }, [dashboardData, forecastData]);

  return (
    <main className="dashboard-root">
      <section className="dashboard-shell">
        <DashboardSidebar onLogout={handleLogout} activeTab="Analytics" onNavigate={navigate} />

        <section className="dashboard-main">
          <DashboardHeader
            isAuthenticated={isAuthenticated}
            userEmail={user?.email}
            hasAlerts={false}
            alertItems={[]}
            latestAlertAt={dashboardData?.current?.recorded_at ?? null}
          />

          <div className="dashboard-tabs" role="tablist" aria-label="Dashboard views">
            {["Dashboard", "Analytics", "Chat"].map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={tab === "Analytics"}
                className={`dashboard-tab ${tab === "Analytics" ? "dashboard-tab--active" : ""}`}
                onClick={() => navigate(`/${tab.toLowerCase()}`)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="dashboard-card" style={{ marginBottom: "18px" }}>
            <div className="dashboard-card__header">
              <div>
                <p className="dashboard-card-label">Analytics filters</p>
                <h2>Filter the data source</h2>
              </div>
            </div>

            <div className="dashboard-control-segment">
              <label className="analytics-range-select">
                <span>Sensor</span>
                <select
                  value={sensorIdFilter}
                  onChange={(event) => setSensorIdFilter(event.target.value)}
                >
                  {sensorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="analytics-range-select">
                <span>Data mode</span>
                <select
                  value={dataModeFilter}
                  onChange={(event) => setDataModeFilter(event.target.value)}
                >
                  {dataModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <section className="analytics-grid">
            <article className="analytics-card analytics-card--chart">
              <div className="analytics-card__header">
                <div>
                  <p className="analytics-card__label">Temperature</p>
                  <h2>Temperature trend</h2>
                </div>

                <div className="analytics-card__actions">
                  <RangeSelect
                    value={timeRanges.temperature}
                    onChange={handleRangeChange("temperature")}
                  />
                  <span className="analytics-card__badge analytics-card__badge--rose">
                    <FiThermometer />
                  </span>
                </div>
              </div>

              <p className="analytics-card__note">
                Switch between day, week, and month views to inspect temperature movement over time.
              </p>

              <div className="analytics-chart-wrap">
                {isLoading ? (
                  <p className="dashboard-card-label">Loading chart...</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={temperatureData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(173, 231, 211, 0.08)" strokeDasharray="4 4" />
                      <XAxis dataKey="time" stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} />
                      <Tooltip content={<AnalyticsTooltip unitMap={{ temperature: "C" }} />} />
                      <Line type="monotone" dataKey="temperature" name="Temperature" stroke={chartPalette.rose} strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className="analytics-card analytics-card--chart">
              <div className="analytics-card__header">
                <div>
                  <p className="analytics-card__label">Comparative analysis</p>
                  <h2>Current vs forecast</h2>
                </div>
                <span className="analytics-card__badge analytics-card__badge--gold">
                  <FiTrendingUp />
                </span>
              </div>

              <p className="analytics-card__note">
                Compare the latest live reading with the next predicted value for each key metric.
              </p>

              <div className="analytics-insight-list">
                {comparisonItems.map((item) => {
                  const comparison = getComparisonDelta(item.current, item.forecast);

                  return (
                    <article key={item.label} className="analytics-insight-item">
                      <div>
                        <strong>{item.label}</strong>
                        <p>
                          Current: {formatComparisonValue(item.current)} {item.unit} | Next:{" "}
                          {formatComparisonValue(item.forecast)} {item.unit}
                        </p>
                      </div>
                      <span>
                        {comparison.delta} ({comparison.direction})
                      </span>
                    </article>
                  );
                })}
              </div>
            </article>

            <article className="analytics-card analytics-card--chart">
              <div className="analytics-card__header">
                <div>
                  <p className="analytics-card__label">Dust</p>
                  <h2>Dust levels</h2>
                </div>

                <div className="analytics-card__actions">
                  <RangeSelect value={timeRanges.dust} onChange={handleRangeChange("dust")} />
                  <span className="analytics-card__badge analytics-card__badge--mint">
                    <FiWind />
                  </span>
                </div>
              </div>

              <p className="analytics-card__note">
                Use the range selector to compare short-term spikes against longer particulate patterns.
              </p>

              <div className="analytics-chart-wrap">
                {isLoading ? (
                  <p className="dashboard-card-label">Loading chart...</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dustData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dustFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartPalette.mint} stopOpacity={0.48} />
                          <stop offset="95%" stopColor={chartPalette.mint} stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(173, 231, 211, 0.08)" strokeDasharray="4 4" />
                      <XAxis dataKey="time" stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} />
                      <Tooltip content={<AnalyticsTooltip unitMap={{ dust: "ug/m3" }} />} />
                      <Area type="monotone" dataKey="dust" name="Dust" stroke={chartPalette.mint} strokeWidth={3} fill="url(#dustFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className="analytics-card analytics-card--chart">
              <div className="analytics-card__header">
                <div>
                  <p className="analytics-card__label">Air quality</p>
                  <h2>Air quality trend</h2>
                </div>

                <div className="analytics-card__actions">
                  <RangeSelect value={timeRanges.gas} onChange={handleRangeChange("gas")} />
                  <span className="analytics-card__badge analytics-card__badge--gold">
                    <FiCloud />
                  </span>
                </div>
              </div>

              <p className="analytics-card__note">
                The air-quality chart now reflects real recent backend readings.
              </p>

              <div className="analytics-chart-wrap">
                {isLoading ? (
                  <p className="dashboard-card-label">Loading chart...</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={gasData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(173, 231, 211, 0.08)" strokeDasharray="4 4" />
                      <XAxis dataKey="time" stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} minTickGap={14} />
                      <YAxis stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} />
                      <Tooltip content={<AnalyticsTooltip unitMap={{ air_percent: "%" }} />} />
                      <Line type="monotone" dataKey="air_percent" name="Air Quality" stroke={chartPalette.gold} strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className="analytics-card analytics-card--chart">
              <div className="analytics-card__header">
                <div>
                  <p className="analytics-card__label">Humidity</p>
                  <h2>Humidity trend</h2>
                </div>

                <div className="analytics-card__actions">
                  <RangeSelect
                    value={timeRanges.humidity}
                    onChange={handleRangeChange("humidity")}
                  />
                  <span className="analytics-card__badge analytics-card__badge--sky">
                    <FiDroplet />
                  </span>
                </div>
              </div>

              <p className="analytics-card__note">
                Compare humidity behavior by day, across the week, or over a month using real readings.
              </p>

              <div className="analytics-chart-wrap">
                {isLoading ? (
                  <p className="dashboard-card-label">Loading chart...</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={humidityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="humidityFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartPalette.sky} stopOpacity={0.42} />
                          <stop offset="95%" stopColor={chartPalette.sky} stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(173, 231, 211, 0.08)" strokeDasharray="4 4" />
                      <XAxis dataKey="time" stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} />
                      <Tooltip content={<AnalyticsTooltip unitMap={{ humidity: "%" }} />} />
                      <Area type="monotone" dataKey="humidity" name="Humidity" stroke={chartPalette.sky} strokeWidth={3} fill="url(#humidityFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className="analytics-card analytics-card--chart">
              <div className="analytics-card__header">
                <div>
                  <p className="analytics-card__label">Light</p>
                  <h2>Light levels</h2>
                </div>

                <div className="analytics-card__actions">
                  <RangeSelect value={timeRanges.light} onChange={handleRangeChange("light")} />
                  <span className="analytics-card__badge analytics-card__badge--aqua">
                    <FiSun />
                  </span>
                </div>
              </div>

              <p className="analytics-card__note">
                Switch the light chart between daily, weekly, and monthly snapshots from real data.
              </p>

              <div className="analytics-chart-wrap">
                {isLoading ? (
                  <p className="dashboard-card-label">Loading chart...</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lightData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barCategoryGap={8}>
                      <CartesianGrid stroke="rgba(173, 231, 211, 0.08)" strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="time" stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} />
                      <Tooltip content={<AnalyticsTooltip unitMap={{ light: "lux" }} />} />
                      <Bar dataKey="light" name="Light" fill={chartPalette.aqua} radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
          </section>
        </section>
      </section>
    </main>
  );
}
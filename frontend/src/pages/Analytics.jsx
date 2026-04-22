import { useState } from "react";
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

const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const defaultRanges = {
  temperature: "day",
  dust: "day",
  gas: "day",
  humidity: "day",
  light: "day",
};

const defaultForecast = [
  { label: "Temperature", value: "+1.8 C", note: "Likely to rise by evening" },
  { label: "Humidity", value: "+4%", note: "Indoor moisture trend increasing" },
  { label: "Gas level", value: "+12 ppm", note: "Peak cooking period expected" },
  { label: "Dust level", value: "+8 ug/m3", note: "Windows open scenario detected" },
];

const defaultHourlySeries = [
  { time: "08:00", temp: 24.8, humidity: 54, gas: 62, dust: 34 },
  { time: "10:00", temp: 25.4, humidity: 55, gas: 66, dust: 36 },
  { time: "12:00", temp: 26.2, humidity: 57, gas: 72, dust: 42 },
  { time: "14:00", temp: 26.9, humidity: 59, gas: 81, dust: 48 },
  { time: "16:00", temp: 27.4, humidity: 60, gas: 84, dust: 52 },
  { time: "18:00", temp: 28.1, humidity: 62, gas: 91, dust: 58 },
];

const roundValue = (value, digits = 0) => Number(value.toFixed(digits));

const buildDailyMockData = (hourlySeries = []) => {
  const source = hourlySeries.length
    ? hourlySeries
    : [
        { temp: 24.8, humidity: 54, gas: 62, dust: 34 },
        { temp: 25.4, humidity: 55, gas: 66, dust: 36 },
        { temp: 26.2, humidity: 57, gas: 72, dust: 42 },
        { temp: 26.9, humidity: 59, gas: 81, dust: 48 },
        { temp: 27.4, humidity: 60, gas: 84, dust: 52 },
        { temp: 28.1, humidity: 62, gas: 91, dust: 58 },
      ];

  return Array.from({ length: 24 }, (_, hour) => {
    const sample = source[hour % source.length];
    const wave = Math.sin((hour / 24) * Math.PI * 2);
    const microShift = (hour % 4) - 1.5;

    return {
      time: `${String(hour).padStart(2, "0")}:00`,
      temp: roundValue(sample.temp + wave * 1.8 + microShift * 0.12, 1),
      humidity: Math.round(sample.humidity + wave * 5 + (hour % 3)),
      dust: Math.max(18, Math.round(sample.dust + wave * 7 + (hour % 5) * 2)),
      light: Math.max(0, Math.round(Math.sin(((hour - 6) / 12) * Math.PI) * 420)),
      co2: Math.max(48, Math.round(sample.gas + wave * 10 + (hour % 6) * 3)),
    };
  });
};

const buildWeeklyMockData = (dailyData) =>
  weekLabels.map((label, index) => {
    const sample = dailyData[(index * 3) % dailyData.length];
    const wave = Math.sin((index / weekLabels.length) * Math.PI * 2);

    return {
      time: label,
      temp: roundValue(sample.temp + wave * 1.2 + index * 0.2, 1),
      humidity: Math.round(sample.humidity + wave * 4 + index),
      dust: Math.max(16, Math.round(sample.dust + wave * 5 + index * 1.4)),
      light: Math.max(40, Math.round(sample.light * 0.62 + 90 + wave * 45)),
      co2: Math.max(52, Math.round(sample.co2 + wave * 9 + index * 2)),
    };
  });

const buildMonthlyMockData = (dailyData) =>
  Array.from({ length: 30 }, (_, index) => {
    const sample = dailyData[index % dailyData.length];
    const wave = Math.sin((index / 30) * Math.PI * 2);
    const trend = index * 0.18;

    return {
      time: `D${index + 1}`,
      temp: roundValue(sample.temp + wave * 1.5 + trend * 0.08, 1),
      humidity: Math.round(sample.humidity + wave * 5 + trend),
      dust: Math.max(18, Math.round(sample.dust + wave * 6 + trend * 1.4)),
      light: Math.max(25, Math.round(sample.light * 0.5 + 100 + wave * 85)),
      co2: Math.max(50, Math.round(sample.co2 + wave * 11 + trend * 1.6)),
    };
  });

const buildTimeSeriesData = (hourlySeries, range) => {
  const dailyData = buildDailyMockData(hourlySeries);

  if (range === "week") {
    return buildWeeklyMockData(dailyData);
  }

  if (range === "month") {
    return buildMonthlyMockData(dailyData);
  }

  return dailyData;
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

export default function Analytics({ forecast, hourlySeries }) {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [timeRanges, setTimeRanges] = useState(defaultRanges);

  const predictiveItems =
    forecast?.length
      ? forecast
      : defaultForecast;

  const series = hourlySeries?.length ? hourlySeries : defaultHourlySeries;

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

  const temperatureData = buildTimeSeriesData(series, timeRanges.temperature);
  const dustData = buildTimeSeriesData(series, timeRanges.dust);
  const gasData = buildTimeSeriesData(series, timeRanges.gas);
  const humidityData = buildTimeSeriesData(series, timeRanges.humidity);
  const lightData = buildTimeSeriesData(series, timeRanges.light);

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
            latestAlertAt={null}
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
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={temperatureData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(173, 231, 211, 0.08)" strokeDasharray="4 4" />
              <XAxis dataKey="time" stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} />
              <Tooltip content={<AnalyticsTooltip unitMap={{ temp: "C" }} />} />
              <Line type="monotone" dataKey="temp" name="Temperature" stroke={chartPalette.rose} strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
            </article>

            <article className="analytics-card analytics-card--chart">
        <div className="analytics-card__header">
          <div>
            <p className="analytics-card__label">Predictive insights</p>
            <h2>Next hours outlook</h2>
          </div>
          <span className="analytics-card__badge analytics-card__badge--gold">
            <FiTrendingUp />
          </span>
        </div>

        <p className="analytics-card__note">
          Forecast details stay visible on analytics so you can compare projected changes with the charts.
        </p>

        <div className="analytics-insight-list">
          {predictiveItems.map((item) => (
            <article key={item.label} className="analytics-insight-item">
              <div>
                <strong>{item.label}</strong>
                <p>{item.note}</p>
              </div>
              <span>{item.value}</span>
            </article>
          ))}
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
        </div>
            </article>

            <article className="analytics-card analytics-card--chart">
        <div className="analytics-card__header">
          <div>
            <p className="analytics-card__label">Gases</p>
            <h2>Gas trend</h2>
          </div>

          <div className="analytics-card__actions">
            <RangeSelect value={timeRanges.gas} onChange={handleRangeChange("gas")} />
            <span className="analytics-card__badge analytics-card__badge--gold">
              <FiCloud />
            </span>
          </div>
        </div>

        <p className="analytics-card__note">
          The gas graph now supports day, week, and month time-series views in a single line chart.
        </p>

        <div className="analytics-chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={gasData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="rgba(173, 231, 211, 0.08)" strokeDasharray="4 4" />
              <XAxis dataKey="time" stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} minTickGap={14} />
              <YAxis stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} />
              <Tooltip content={<AnalyticsTooltip unitMap={{ co2: "ppm" }} />} />
              <Line type="monotone" dataKey="co2" name="CO2" stroke={chartPalette.rose} strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
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
          Compare humidity behavior by day, across the week, or over a month from the same card.
        </p>

        <div className="analytics-chart-wrap">
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
          Switch the light chart between daily, weekly, and monthly time-series snapshots.
        </p>

        <div className="analytics-chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lightData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barCategoryGap={8}>
              <CartesianGrid stroke="rgba(173, 231, 211, 0.08)" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="time" stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis stroke="rgba(226, 242, 236, 0.54)" tickLine={false} axisLine={false} />
              <Tooltip content={<AnalyticsTooltip unitMap={{ light: "lux" }} />} />
              <Bar dataKey="light" name="Light" fill={chartPalette.aqua} radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
            </article>
          </section>
        </section>
      </section>
    </main>
  );
}

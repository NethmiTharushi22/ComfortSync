import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import AnalyticsSectionCard from "./AnalyticsSectionCard";
import { getTemporalTrendAnalysis } from "../../api/analysisApi";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const TARGET_OPTIONS = ["temperature", "humidity", "air_percent", "light_lux"];

export default function TemporalTrendPanel() {
  const [target, setTarget] = useState("temperature");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const result = await getTemporalTrendAnalysis(target);
        const firstResult = result.data?.results?.[0] || null;
        setAnalysis(firstResult);
      } catch (err) {
        setError(err.message || "Failed to load temporal trend analysis");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [target]);

  const controls = (
    <select
      className="analytics-select"
      value={target}
      onChange={(e) => setTarget(e.target.value)}
    >
      {TARGET_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );

  if (loading) {
    return (
      <AnalyticsSectionCard
        title="Temporal Trend Analysis"
        label="Machine learning analysis"
        controls={controls}
        className="analytics-card--full"
      >
        <div className="analytics-loading">Loading temporal trend analysis...</div>
      </AnalyticsSectionCard>
    );
  }

  if (error || !analysis?.success) {
    return (
      <AnalyticsSectionCard
        title="Temporal Trend Analysis"
        label="Machine learning analysis"
        controls={controls}
        className="analytics-card--full"
      >
        <div className="analytics-error">{error || "No temporal trend data found."}</div>
      </AnalyticsSectionCard>
    );
  }

  const chartData = {
    labels: analysis.chart_data.map((item) =>
      new Date(item.recorded_at).toLocaleString()
    ),
    datasets: [
  {
    label: `Actual ${analysis.target_field}`,
    data: analysis.chart_data.map((item) => item.actual),
    borderColor: "#00E5FF", // bright cyan
    backgroundColor: "rgba(0, 229, 255, 0.2)",
    pointBackgroundColor: "#00E5FF",
    pointRadius: 3,
    tension: 0.3,
  },
  {
    label: `Predicted ${analysis.target_field}`,
    data: analysis.chart_data.map((item) => item.predicted),
    borderColor: "#FF6B6B", // soft red
    backgroundColor: "rgba(255, 107, 107, 0.2)",
    pointBackgroundColor: "#FF6B6B",
    pointRadius: 3,
    tension: 0.3,
  },
    ],
  };

  return (
    <AnalyticsSectionCard
      title="Temporal Trend Analysis"
      label="Machine learning analysis"
      controls={controls}
      className="analytics-card--full"
    >
      <div className="analytics-metrics">
        <div className="analytics-metric">
          <p className="analytics-metric-label">Target</p>
          <p className="analytics-metric-value">{analysis.target_field}</p>
        </div>
        <div className="analytics-metric">
          <p className="analytics-metric-label">MAE</p>
          <p className="analytics-metric-value">{analysis.mean_absolute_error}</p>
        </div>
        <div className="analytics-metric">
          <p className="analytics-metric-label">R²</p>
          <p className="analytics-metric-value">{analysis.r2_score}</p>
        </div>
      </div>

      <div className="analytics-chart-shell">
        <Line data={chartData} />
      </div>

      <div className="analytics-insight">{analysis.insight}</div>
    </AnalyticsSectionCard>
  );
}
import { useEffect, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import AnalyticsSectionCard from "./AnalyticsSectionCard";
import { getCorrelationAnalysis } from "../../api/analysisApi";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const TARGET_OPTIONS = [
  "temperature",
  "humidity",
  "air_percent",
  "dust_concentration",
  "mq135_raw",
  "light_lux",
];

export default function CorrelationAnalysisPanel() {
  const [target, setTarget] = useState("air_percent");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const result = await getCorrelationAnalysis(target);
        const firstResult = result.data?.results?.[0] || null;
        setAnalysis(firstResult);
      } catch (err) {
        setError(err.message || "Failed to load correlation analysis");
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
        title="Correlation Analysis"
        label="Feature importance"
        controls={controls}
        className="analytics-card--full"
      >
        <div className="analytics-loading">Loading correlation analysis...</div>
      </AnalyticsSectionCard>
    );
  }

  if (error || !analysis?.success) {
    return (
      <AnalyticsSectionCard
        title="Correlation Analysis"
        label="Feature importance"
        controls={controls}
        className="analytics-card--full"
      >
        <div className="analytics-error">{error || "No correlation analysis data found."}</div>
      </AnalyticsSectionCard>
    );
  }

  const importanceChartData = {
    labels: analysis.feature_importance.map((item) => item.feature),
    datasets: [
      {
        label: "Feature Importance",
        data: analysis.feature_importance.map((item) => item.importance),
        backgroundColor: [
          "#00E5FF",
          "#7C4DFF",
          "#00C853",
          "#FFB300",
          "#FF6B6B",
          "#26C6DA",
        ],
        borderColor: [
          "#00E5FF",
          "#7C4DFF",
          "#00C853",
          "#FFB300",
          "#FF6B6B",
          "#26C6DA",
        ],
        borderWidth: 1,
      },
    ],
  };

  const predictionChartData = {
    labels: analysis.prediction_chart_data.map((_, index) => index + 1),
    datasets: [
      {
        label: "Actual",
        data: analysis.prediction_chart_data.map((item) => item.actual),
        borderColor: "#00E5FF",
        backgroundColor: "rgba(0, 229, 255, 0.2)",
        pointBackgroundColor: "#00E5FF",
        pointBorderColor: "#00E5FF",
        pointRadius: 3,
        tension: 0.3,
      },
      {
        label: "Predicted",
        data: analysis.prediction_chart_data.map((item) => item.predicted),
        borderColor: "#FF6B6B",
        backgroundColor: "rgba(255, 107, 107, 0.2)",
        pointBackgroundColor: "#FF6B6B",
        pointBorderColor: "#FF6B6B",
        pointRadius: 3,
        tension: 0.3,
      },
    ],
  };

  return (
    <AnalyticsSectionCard
      title="Correlation Analysis"
      label="Feature importance"
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
        <Bar data={importanceChartData} />
      </div>

      <div className="analytics-chart-shell">
        <Line data={predictionChartData} />
      </div>

      <div className="analytics-insight">{analysis.insight}</div>
    </AnalyticsSectionCard>
  );
}
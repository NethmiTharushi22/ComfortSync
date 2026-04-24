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
import { getAnomalyDetection } from "../../api/analysisApi";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function AnomalyDetectionPanel() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const result = await getAnomalyDetection();
        setAnalysis(result.data);
      } catch (err) {
        setError(err.message || "Failed to load anomaly detection");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <AnalyticsSectionCard
        title="Anomaly Detection"
        label="Environmental anomalies"
        className="analytics-card--half"
      >
        <div className="analytics-loading">Loading anomaly detection...</div>
      </AnalyticsSectionCard>
    );
  }

  if (error || !analysis) {
    return (
      <AnalyticsSectionCard
        title="Anomaly Detection"
        label="Environmental anomalies"
        className="analytics-card--half"
      >
        <div className="analytics-error">{error || "No anomaly detection data found."}</div>
      </AnalyticsSectionCard>
    );
  }

  const chartData = {
    labels: analysis.chart_data.map((item) =>
      new Date(item.recorded_at).toLocaleString()
    ),
    datasets: [
      {
        label: "Temperature",
        data: analysis.chart_data.map((item) => item.temperature),
        borderColor: "#00E5FF",
        backgroundColor: "rgba(0, 229, 255, 0.15)",
        pointBackgroundColor: "#00E5FF",
        pointBorderColor: "#00E5FF",
        pointRadius: 2,
        borderWidth: 2,
        tension: 0.3,
      },
      {
        label: "Anomaly markers",
        data: analysis.chart_data.map((item) =>
          item.anomaly === 1 ? item.temperature : null
        ),
        borderColor: "#FF5252",
        backgroundColor: "#FF5252",
        pointBackgroundColor: "#FF5252",
        pointBorderColor: "#FFFFFF",
        pointRadius: 5,
        pointHoverRadius: 7,
        showLine: false,
      },
    ],
  };

  return (
    <AnalyticsSectionCard
      title="Anomaly Detection"
      label="Environmental anomalies"
      className="analytics-card--half"
    >
      <div className="analytics-metrics">
        <div className="analytics-metric">
          <p className="analytics-metric-label">Model</p>
          <p className="analytics-metric-value">{analysis.model}</p>
        </div>
        <div className="analytics-metric">
          <p className="analytics-metric-label">Records</p>
          <p className="analytics-metric-value">{analysis.total_records}</p>
        </div>
        <div className="analytics-metric">
          <p className="analytics-metric-label">Anomalies</p>
          <p className="analytics-metric-value">{analysis.anomaly_count}</p>
        </div>
      </div>

      <div className="analytics-chart-shell">
        <Line data={chartData} />
      </div>

      <div className="analytics-insight">{analysis.insight}</div>
    </AnalyticsSectionCard>
  );
}
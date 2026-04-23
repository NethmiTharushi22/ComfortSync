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
import { getThresholdAlerts } from "../../api/analysisApi";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function ThresholdAlertsPanel() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const result = await getThresholdAlerts();
        setAnalysis(result.data);
      } catch (err) {
        setError(err.message || "Failed to load threshold alerts");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <AnalyticsSectionCard
        title="Threshold-Based Alerts"
        label="ML alert detection"
        className="analytics-card--half"
      >
        <div className="analytics-loading">Loading threshold alerts...</div>
      </AnalyticsSectionCard>
    );
  }

  if (error || !analysis) {
    return (
      <AnalyticsSectionCard
        title="Threshold-Based Alerts"
        label="ML alert detection"
        className="analytics-card--half"
      >
        <div className="analytics-error">
          {error || "No threshold alert data found."}
        </div>
      </AnalyticsSectionCard>
    );
  }

  const chartData = {
    labels: analysis.alert_data.map((item) =>
      new Date(item.recorded_at).toLocaleTimeString()
    ),
    datasets: [
      {
        label: "Temperature",
        data: analysis.alert_data.map((item) => item.temperature),
        borderColor: "#00E5FF",
        backgroundColor: "rgba(0, 229, 255, 0.15)",
        pointBackgroundColor: "#00E5FF",
        pointBorderColor: "#00E5FF",
        pointRadius: 2,
        borderWidth: 2,
        tension: 0.3,
      },
      {
        label: "Alerts",
        data: analysis.alert_data.map((item) =>
          item.alert === 1 ? item.temperature : null
        ),
        borderColor: "#FFB300",
        backgroundColor: "#FFB300",
        pointBackgroundColor: "#FFB300",
        pointBorderColor: "#FFFFFF",
        pointRadius: 5,
        pointHoverRadius: 7,
        showLine: false,
      },
    ],
  };

  return (
    <AnalyticsSectionCard
      title="Threshold-Based Alerts"
      label="ML alert detection"
      className="analytics-card--half"
    >
      <div className="analytics-metrics">
        <div className="analytics-metric">
          <p className="analytics-metric-label">Model</p>
          <p className="analytics-metric-value">{analysis.model}</p>
        </div>

        <div className="analytics-metric">
          <p className="analytics-metric-label">Records</p>
          <p className="analytics-metric-value">
            {analysis.total_records}
          </p>
        </div>

        <div className="analytics-metric">
          <p className="analytics-metric-label">Alerts</p>
          <p className="analytics-metric-value">
            {analysis.alert_count}
          </p>
        </div>
      </div>

      <div className="analytics-chart-shell">
        <Line data={chartData} />
      </div>

      <div className="analytics-insight">{analysis.insight}</div>
    </AnalyticsSectionCard>
  );
}
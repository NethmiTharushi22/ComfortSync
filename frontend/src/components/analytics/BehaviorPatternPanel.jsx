import { useEffect, useState } from "react";
import AnalyticsSectionCard from "./AnalyticsSectionCard";
import { getBehaviorPatternAnalysis } from "../../api/analysisApi";

export default function BehaviorPatternPanel() {
  const [clusters, setClusters] = useState(4);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const result = await getBehaviorPatternAnalysis(clusters);
        setAnalysis(result.data);
      } catch (err) {
        setError(err.message || "Failed to load behavior pattern analysis");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [clusters]);

  const controls = (
    <select
      className="analytics-select"
      value={clusters}
      onChange={(e) => setClusters(Number(e.target.value))}
    >
      {[3, 4, 5].map((value) => (
        <option key={value} value={value}>
          {value} clusters
        </option>
      ))}
    </select>
  );

  if (loading) {
    return (
      <AnalyticsSectionCard
        title="Behavior Pattern Analysis"
        label="Usage patterns"
        controls={controls}
        className="analytics-card--half"
      >
        <div className="analytics-loading">Loading behavior pattern analysis...</div>
      </AnalyticsSectionCard>
    );
  }

  if (error || !analysis) {
    return (
      <AnalyticsSectionCard
        title="Behavior Pattern Analysis"
        label="Usage patterns"
        controls={controls}
        className="analytics-card--half"
      >
        <div className="analytics-error">{error || "No behavior pattern data found."}</div>
      </AnalyticsSectionCard>
    );
  }

  return (
    <AnalyticsSectionCard
      title="Behavior Pattern Analysis"
      label="Usage patterns"
      controls={controls}
      className="analytics-card--half"
    >
      <div className="analytics-metrics">
        <div className="analytics-metric">
          <p className="analytics-metric-label">Model</p>
          <p className="analytics-metric-value">{analysis.model}</p>
        </div>
        <div className="analytics-metric">
          <p className="analytics-metric-label">Clusters</p>
          <p className="analytics-metric-value">{analysis.n_clusters}</p>
        </div>
        <div className="analytics-metric">
          <p className="analytics-metric-label">Records</p>
          <p className="analytics-metric-value">{analysis.total_records}</p>
        </div>
      </div>

      <div className="analytics-summary-grid">
        {analysis.cluster_summary.map((cluster) => (
          <div key={cluster.cluster} className="analytics-summary-card">
            <strong>Cluster {cluster.cluster}</strong>
            <p>Count: {cluster.count}</p>
            <p>Temp: {cluster.temperature}</p>
            <p>Humidity: {cluster.humidity}</p>
            <p>Air: {cluster.air_percent}</p>
            <p>Dust: {cluster.dust_concentration}</p>
          </div>
        ))}
      </div>

      <div className="analytics-insight">{analysis.insight}</div>
    </AnalyticsSectionCard>
  );
}
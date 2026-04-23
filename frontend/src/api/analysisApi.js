const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function handleResponse(response, errorMessage) {
  if (!response.ok) {
    throw new Error(errorMessage);
  }
  return response.json();
}

export async function getTemporalTrendAnalysis(targetField) {
  const response = await fetch(
    `${API_BASE_URL}/api/analysis/temporal-trend?target_fields=${encodeURIComponent(targetField)}`
  );
  return handleResponse(response, "Failed to fetch temporal trend analysis");
}

export async function getAnomalyDetection(limit = 5000) {
  const response = await fetch(
    `${API_BASE_URL}/api/analysis/anomaly-detection?limit=${limit}`
  );
  return handleResponse(response, "Failed to fetch anomaly detection");
}

export async function getCorrelationAnalysis(targetField) {
  const response = await fetch(
    `${API_BASE_URL}/api/analysis/correlation-analysis?target_field=${encodeURIComponent(targetField)}`
  );
  return handleResponse(response, "Failed to fetch correlation analysis");
}

export async function getBehaviorPatternAnalysis(nClusters = 4) {
  const response = await fetch(
    `${API_BASE_URL}/api/analysis/behavior-pattern-analysis?n_clusters=${nClusters}`
  );
  return handleResponse(response, "Failed to fetch behavior pattern analysis");
}

export async function getThresholdAlerts(limit = 5000) {
  const response = await fetch(
    `${API_BASE_URL}/api/analysis/threshold-alerts?limit=${limit}`
  );
  return handleResponse(response, "Failed to fetch threshold alerts");
}
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DashboardHeader from "../components/DashboardHeader";
import DashboardSidebar from "../components/DashboardSidebar";
import TemporalTrendPanel from "../components/analytics/TemporalTrendPanel";
import CorrelationAnalysisPanel from "../components/analytics/CorrelationAnalysisPanel";
import AnomalyDetectionPanel from "../components/analytics/AnomalyDetectionPanel";
import BehaviorPatternPanel from "../components/analytics/BehaviorPatternPanel";
import ThresholdAlertsPanel from "../components/analytics/ThresholdAlertsPanel";
import "./Dashboard.css";
import "./MLAnalytics.css";

export default function MLAnalytics() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  return (
    <main className="dashboard-root">
      <section className="dashboard-shell">
        <DashboardSidebar
          onLogout={handleLogout}
          activeTab="ML Analytics"
          onNavigate={navigate}
        />

        <section className="dashboard-main">
          <DashboardHeader
            isAuthenticated={isAuthenticated}
            userEmail={user?.email}
            hasAlerts={false}
            alertItems={[]}
            latestAlertAt={null}
          />

          <div className="analytics-page-header">
            <div>
              <p className="analytics-eyebrow">Machine learning workspace</p>
              <h1 className="analytics-title">Analytics & Insights</h1>
              <p className="analytics-subtitle">
                Explore temporal trends, anomalies, learned sensor relationships,
                behavior patterns, and ML-based alert signals for the Comfort System.
              </p>
            </div>
          </div>

          <section className="analytics-grid">
            <TemporalTrendPanel />
            <CorrelationAnalysisPanel />
            <AnomalyDetectionPanel />
            <BehaviorPatternPanel />
            <ThresholdAlertsPanel />
          </section>
        </section>
      </section>
    </main>
  );
}
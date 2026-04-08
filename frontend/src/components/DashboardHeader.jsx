import { FiBell } from "react-icons/fi";
import { isFirebaseConfigured } from "../firebase/config";

export default function DashboardHeader({ isAuthenticated, userEmail, hasAlerts }) {
  return (
    <header className="dashboard-header">
      <div>
        <p className="dashboard-brand">ComfortSync</p>
        <div className="dashboard-heading-row">
          <h1 className="dashboard-title">Indoor Comfort Dashboard</h1>
          <span className="dashboard-live-badge">
            <span className="dashboard-live-badge__dot" />
            {isFirebaseConfigured ? "Live" : "Preview"}
          </span>
        </div>
        <p className="dashboard-user">
          Viewing as <strong>{isAuthenticated ? userEmail : "guest preview"}</strong>
        </p>
      </div>

      <div className="dashboard-header__notifications">
        <div className="dashboard-notify" aria-hidden="true">
          <FiBell />
          {hasAlerts ? <span className="dashboard-notify__ping" /> : null}
        </div>
      </div>
    </header>
  );
}

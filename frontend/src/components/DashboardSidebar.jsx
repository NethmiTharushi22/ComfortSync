import { FiActivity, FiGrid, FiHome, FiLogOut, FiSettings } from "react-icons/fi";

const staticIcons = [FiHome, FiGrid, FiSettings];

export default function DashboardSidebar({ onLogout }) {
  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-sidebar__brand">
        <div className="dashboard-sidebar__brand-mark">
          <FiActivity />
        </div>
      </div>

      <div className="dashboard-sidebar__nav" aria-hidden="true">
        {staticIcons.map((Icon, index) => (
          <span
            key={Icon.displayName || Icon.name || index}
            className={`dashboard-sidebar__icon dashboard-sidebar__icon--static${
              index === 0 ? " dashboard-sidebar__icon--active" : ""
            }`}
          >
            <Icon />
          </span>
        ))}
      </div>

      <div className="dashboard-sidebar__footer">
        <button
          type="button"
          className="dashboard-sidebar__icon dashboard-sidebar__icon--muted dashboard-sidebar__action"
          onClick={onLogout}
          aria-label="Log out"
        >
          <FiLogOut />
        </button>
      </div>
    </aside>
  );
}

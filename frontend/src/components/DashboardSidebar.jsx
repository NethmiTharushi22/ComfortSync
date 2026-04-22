import { FiActivity, FiGrid, FiHome, FiLogOut, FiMessageSquare, FiSettings } from "react-icons/fi";

const navItems = [
  { Icon: FiHome, label: "Dashboard", path: "/dashboard" },
  { Icon: FiGrid, label: "Analytics", path: "/analytics" },
  { Icon: FiMessageSquare, label: "Chat", path: "/chat" },
  { Icon: FiSettings, label: "Settings", path: "/settings" },
];

export default function DashboardSidebar({ onLogout, activeTab, onNavigate }) {
  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-sidebar__brand">
        <div className="dashboard-sidebar__brand-mark">
          <FiActivity />
        </div>
      </div>

      <div className="dashboard-sidebar__nav">
        {navItems.map(({ Icon, label, path }, index) =>
          path ? (
            <button
              key={label}
              type="button"
              className={`dashboard-sidebar__icon dashboard-sidebar__action${
                (label === "Dashboard" && activeTab === "Dashboard") ||
                (label === "Analytics" && activeTab === "Analytics") ||
                (label === "Chat" && activeTab === "Chat") ||
                (label === "Settings" && activeTab === "Settings") ||
                (index === 0 && activeTab === "Dashboard")
                  ? " dashboard-sidebar__icon--active"
                  : ""
              }`}
              onClick={() => onNavigate?.(path)}
              aria-label={label}
              aria-pressed={Boolean(
                (label === "Dashboard" && activeTab === "Dashboard") ||
                  (label === "Analytics" && activeTab === "Analytics") ||
                  (label === "Chat" && activeTab === "Chat") ||
                  (label === "Settings" && activeTab === "Settings"),
              )}
            >
              <Icon />
            </button>
          ) : (
            <span
              key={label}
              className="dashboard-sidebar__icon dashboard-sidebar__icon--static"
              aria-hidden="true"
            >
              <Icon />
            </span>
          ),
        )}
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

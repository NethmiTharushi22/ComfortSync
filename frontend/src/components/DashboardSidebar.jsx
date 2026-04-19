import {
  FiActivity,
  FiCloud,
  FiDroplet,
  FiGrid,
  FiHome,
  FiLogOut,
  FiMessageSquare,
  FiSettings,
  FiSun,
  FiThermometer,
  FiWind,
} from "react-icons/fi";

const navItems = [
  { Icon: FiHome,        label: "Dashboard",   path: "/dashboard" },
  { Icon: FiGrid,        label: "Overview" },
  { Icon: FiMessageSquare, label: "Chat",      path: "/chat" },
  { Icon: FiThermometer, label: "Temperature", path: "/sensors/temperature" },
  { Icon: FiDroplet,     label: "Humidity",    path: "/sensors/humidity" },
  { Icon: FiWind,        label: "Gas",         path: "/sensors/gas" },
  { Icon: FiCloud,       label: "Dust",        path: "/sensors/dust" },
  { Icon: FiSun,         label: "Light",       path: "/sensors/light" },
  { Icon: FiSettings,    label: "Settings" },
];

const SENSOR_LABELS = new Set(["Temperature", "Humidity", "Gas", "Dust", "Light"]);

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
              title={label}
              className={`dashboard-sidebar__icon dashboard-sidebar__action${
                (label === "Dashboard" && activeTab === "Dashboard") ||
                (label === "Chat" && activeTab === "Chat") ||
                (SENSOR_LABELS.has(label) && activeTab === label)
                  ? " dashboard-sidebar__icon--active"
                  : ""
              }`}
              onClick={() => onNavigate?.(path)}
              aria-label={label}
              aria-pressed={Boolean(
                (label === "Dashboard" && activeTab === "Dashboard") ||
                  (label === "Chat" && activeTab === "Chat") ||
                  (SENSOR_LABELS.has(label) && activeTab === label),
              )}
            >
              <Icon />
            </button>
          ) : (
            <span
              key={label}
              title={label}
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

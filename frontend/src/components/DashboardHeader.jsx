import { useEffect, useRef, useState } from "react";
import { FiBell } from "react-icons/fi";
import { isFirebaseConfigured } from "../firebase/config";

const formatRelativeAlertTime = (value) => {
  if (!value) {
    return "Just now";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Just now";
  }

  const diffSeconds = Math.max(0, Math.round((Date.now() - parsed.getTime()) / 1000));
  if (diffSeconds < 10) {
    return "Just now";
  }
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};

export default function DashboardHeader({
  isAuthenticated,
  userEmail,
  hasAlerts,
  alertItems = [],
  latestAlertAt,
}) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [hasFreshAlert, setHasFreshAlert] = useState(false);
  const containerRef = useRef(null);
  const seenAlertKeysRef = useRef(new Set());
  const hasInitializedAlertsRef = useRef(false);
  const notificationItems = alertItems.length
    ? alertItems.map((alert) => ({
        ...alert,
        relativeTime: formatRelativeAlertTime(latestAlertAt),
      }))
    : [
        {
          title: "No active alerts",
          detail: "New indoor monitoring alerts will appear here.",
          tone: "safe",
          relativeTime: "Just now",
        },
      ];

  useEffect(() => {
    const activeAlertKeys = alertItems
      .filter((alert) => alert.tone === "warning" || alert.tone === "danger")
      .map((alert) => `${alert.tone}:${alert.title}:${alert.detail}`);

    if (!hasInitializedAlertsRef.current) {
      seenAlertKeysRef.current = new Set(activeAlertKeys);
      hasInitializedAlertsRef.current = true;
      return;
    }

    const unseenAlertKeys = activeAlertKeys.filter((key) => !seenAlertKeysRef.current.has(key));
    if (!unseenAlertKeys.length) {
      return;
    }

    unseenAlertKeys.forEach((key) => seenAlertKeysRef.current.add(key));
    setHasFreshAlert(true);

    const timeoutId = window.setTimeout(() => {
      setHasFreshAlert(false);
    }, 4200);

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(660, audioContext.currentTime + 0.18);
      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.24);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.24);
      oscillator.onended = () => {
        audioContext.close().catch(() => {});
      };
    } catch {}

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [alertItems]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

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

      <div className="dashboard-header__notifications" ref={containerRef}>
        <button
          type="button"
          className={`dashboard-notify ${hasFreshAlert ? "dashboard-notify--fresh" : ""}`}
          aria-label="Open notifications"
          aria-expanded={isNotificationsOpen}
          onClick={() => {
            setHasFreshAlert(false);
            setIsNotificationsOpen((current) => !current);
          }}
        >
          <FiBell />
          {hasAlerts ? <span className="dashboard-notify__ping" /> : null}
        </button>

        {isNotificationsOpen ? (
          <div className="dashboard-notify-panel" role="dialog" aria-label="Notifications">
            <div className="dashboard-notify-panel__header">
              <strong>Active alerts</strong>
              <span>{notificationItems.length}</span>
            </div>

            <div className="dashboard-notify-panel__list">
              {notificationItems.map((alert) => (
                <article
                  key={`${alert.title}-${alert.relativeTime}`}
                  className={`dashboard-notify-item dashboard-notify-item--${alert.tone}`}
                >
                  <div className="dashboard-notify-item__top">
                    <div className="dashboard-notify-item__headline">
                      <span className={`dashboard-notify-item__tone dashboard-notify-item__tone--${alert.tone}`}>
                        {alert.tone}
                      </span>
                      <strong>{alert.title}</strong>
                    </div>
                    <span>{alert.relativeTime}</span>
                  </div>
                  <p>{alert.detail}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiClock,
  FiCloud,
  FiDroplet,
  FiMessageSquare,
  FiPlus,
  FiSun,
  FiThermometer,
  FiTrash2,
  FiWind,
} from "react-icons/fi";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import DashboardHeader from "../components/DashboardHeader";
import DashboardSidebar from "../components/DashboardSidebar";
import "./Dashboard.css";
import "./ChatPage.css";

const POLL_INTERVAL_MS = 5000;
const DASHBOARD_CACHE_KEY = "comfortsync.dashboard.snapshot";

const readDashboardCache = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(DASHBOARD_CACHE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

const writeDashboardCache = (value) => {
  if (typeof window === "undefined" || !value) {
    return;
  }

  try {
    window.sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(value));
  } catch {}
};

const readNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const PM25_AQI_BREAKPOINTS = [
  { cLow: 0.0, cHigh: 9.0, iLow: 0, iHigh: 50, label: "Good", tone: "safe", note: "PM2.5 levels are in the healthy range." },
  { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100, label: "Moderate", tone: "warning", note: "Air quality is acceptable, but unusually sensitive people should monitor exposure." },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150, label: "Unhealthy for Sensitive Groups", tone: "warning", note: "People with breathing issues should reduce prolonged exposure." },
  { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200, label: "Unhealthy", tone: "danger", note: "Everyone may begin to feel health effects from the PM2.5 level." },
  { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300, label: "Very Unhealthy", tone: "danger", note: "Health warnings apply to everyone at this PM2.5 concentration." },
  { cLow: 225.5, cHigh: 325.4, iLow: 301, iHigh: 400, label: "Hazardous", tone: "danger", note: "Emergency conditions: avoid exposure and improve ventilation immediately." },
  { cLow: 325.5, cHigh: 500.4, iLow: 401, iHigh: 500, label: "Hazardous", tone: "danger", note: "Emergency conditions: avoid exposure and improve ventilation immediately." },
];

const getPm25AqiSummary = (pm25) => {
  if (typeof pm25 !== "number" || !Number.isFinite(pm25) || pm25 < 0) {
    return {
      value: null,
      label: "Unavailable",
      tone: "warning",
      note: "Waiting for a live PM2.5 reading from the database.",
    };
  }

  const truncatedPm25 = Math.floor(pm25 * 10) / 10;
  const breakpoint =
    PM25_AQI_BREAKPOINTS.find((item) => truncatedPm25 >= item.cLow && truncatedPm25 <= item.cHigh) ??
    PM25_AQI_BREAKPOINTS[PM25_AQI_BREAKPOINTS.length - 1];

  const aqiValue = Math.round(
    ((breakpoint.iHigh - breakpoint.iLow) / (breakpoint.cHigh - breakpoint.cLow)) *
      (truncatedPm25 - breakpoint.cLow) +
      breakpoint.iLow,
  );

  return {
    value: Math.min(aqiValue, 500),
    label: breakpoint.label,
    tone: breakpoint.tone,
    note: breakpoint.note,
  };
};

const getGasSummary = (airPercent) => {
  if (typeof airPercent !== "number" || !Number.isFinite(airPercent) || airPercent < 0) {
    return {
      value: null,
      label: "Unavailable",
      tone: "warning",
      note: "Waiting for a live air quality percentage from the database.",
    };
  }

  const gasLevel = Math.min(100, Math.max(0, 100 - airPercent));

  if (gasLevel >= 60) {
    return {
      value: gasLevel,
      label: "High",
      tone: "danger",
      note: "Gas level is high, so ventilation is recommended.",
    };
  }

  if (gasLevel >= 30) {
    return {
      value: gasLevel,
      label: "Moderate",
      tone: "warning",
      note: "Gas level is rising and should be watched.",
    };
  }

  return {
    value: gasLevel,
    label: "Low",
    tone: "safe",
    note: "Gas level is low and indoor air looks stable.",
  };
};

const formatTimestamp = (value) => {
  if (!value) {
    return "Waiting for live timestamp";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Waiting for live timestamp";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    month: "short",
    day: "numeric",
  }).format(parsed);
};

const formatChatRelativeTime = (value) => {
  if (!value) {
    return "Just now";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Just now";
  }

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(parsed);
};

const toChatHistorySummary = (history) => ({
  id: history.id,
  user_email: history.user_email,
  title: history.title,
  preview: history.preview,
  created_at: history.created_at,
  updated_at: history.updated_at,
  last_message_at: history.last_message_at,
  message_count: history.message_count,
});

const upsertChatHistorySummary = (items, history) => {
  const nextItem = toChatHistorySummary(history);
  const remaining = items.filter((item) => item.id !== nextItem.id);
  return [nextItem, ...remaining].sort(
    (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
  );
};

const buildAssistantReply = ({ prompt, dashboardData, latestUpdated, aqi, gasSummary }) => {
  const normalizedPrompt = prompt.trim().toLowerCase();
  const current = dashboardData?.current ?? {};
  const temperature = readNumber(current.temperature);
  const humidity = readNumber(current.humidity);
  const dust = readNumber(current.dust);
  const light = readNumber(current.light);
  const airPercent = readNumber(current.air_percent);

  if (normalizedPrompt.includes("gas") || normalizedPrompt.includes("air")) {
    return `Gas status is ${gasSummary.label.toLowerCase()} right now${
      typeof gasSummary.value === "number" ? ` at ${gasSummary.value.toFixed(1)}%` : ""
    }. ${gasSummary.note} Last live update was ${latestUpdated}.`;
  }

  if (normalizedPrompt.includes("dust") || normalizedPrompt.includes("aqi")) {
    return `Current PM2.5 AQI is ${aqi.value ?? "--"} and the room is marked as ${aqi.label.toLowerCase()}. ${aqi.note}`;
  }

  if (normalizedPrompt.includes("temperature")) {
    return `The latest room temperature is ${
      typeof temperature === "number" ? `${temperature.toFixed(1)} C` : "not available yet"
    }. ${
      typeof temperature === "number" && temperature >= 30
        ? "That is above the comfort range, so airflow or cooling would help."
        : "It is currently within a more comfortable range."
    }`;
  }

  if (normalizedPrompt.includes("humidity")) {
    return `Humidity is ${
      typeof humidity === "number" ? `${humidity.toFixed(1)}%` : "not available yet"
    }. ${
      typeof humidity === "number" && (humidity < 35 || humidity > 70)
        ? "It is outside the ideal band, so the room should be monitored."
        : "It is currently close to the ideal indoor range."
    }`;
  }

  if (normalizedPrompt.includes("light")) {
    return `Light intensity is ${
      typeof light === "number" ? `${light.toFixed(1)} lux` : "not available yet"
    }. ${
      typeof light === "number" && light < 120
        ? "The room looks dim, so switching lights on would make sense."
        : "Lighting looks adequate from the latest reading."
    }`;
  }

  return `Here’s a quick room summary from the latest reading at ${latestUpdated}: temperature ${
    typeof temperature === "number" ? `${temperature.toFixed(1)} C` : "--"
  }, humidity ${
    typeof humidity === "number" ? `${humidity.toFixed(1)}%` : "--"
  }, air quality ${
    typeof airPercent === "number" ? `${airPercent.toFixed(1)}%` : "--"
  }, dust ${typeof dust === "number" ? `${dust.toFixed(1)} ug/m3` : "--"}. Ask me about gas, AQI, temperature, humidity, or lighting and I’ll focus on that.`;
};

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [dashboardData, setDashboardData] = useState(() => readDashboardCache());
  const [dashboardError, setDashboardError] = useState("");
  const [chatHistories, setChatHistories] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [activeChat, setActiveChat] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState("");

  const userEmail = user?.email ?? "";

  const fetchDashboard = async () => {
    try {
      const { data } = await api.get("/api/sensors/dashboard", {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      setDashboardData(data);
      writeDashboardCache(data);
      setDashboardError("");
      return data;
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        error.message ||
        "Unable to load live dashboard data.";
      setDashboardError(message);
      throw error;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        await fetchDashboard();
      } catch {
        if (!isMounted) {
          return;
        }
      }
    };

    loadDashboard();
    const intervalId = window.setInterval(loadDashboard, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const loadChatHistory = async (chatId) => {
    if (!chatId || !userEmail) {
      return null;
    }

    setIsChatLoading(true);

    try {
      const { data } = await api.get(`/api/chat-histories/${chatId}`, {
        params: { user_email: userEmail },
      });
      setActiveChat(data);
      setActiveChatId(data.id);
      setChatError("");
      return data;
    } catch (error) {
      setChatError(error.response?.data?.detail || "Unable to load chat history.");
      throw error;
    } finally {
      setIsChatLoading(false);
    }
  };

  const loadChatHistories = async ({ preferredChatId } = {}) => {
    if (!userEmail) {
      return [];
    }

    setIsChatLoading(true);

    try {
      const { data } = await api.get("/api/chat-histories", {
        params: { user_email: userEmail },
      });
      setChatHistories(data);
      setChatError("");

      const nextChatId =
        preferredChatId ||
        (data.some((item) => item.id === activeChatId) ? activeChatId : data[0]?.id || "");

      if (nextChatId) {
        await loadChatHistory(nextChatId);
      } else {
        setActiveChat(null);
        setActiveChatId("");
      }

      return data;
    } catch (error) {
      setChatError(error.response?.data?.detail || "Unable to load chat histories.");
      throw error;
    } finally {
      setIsChatLoading(false);
    }
  };

  const createChatHistory = async (initialTitle) => {
    if (!userEmail) {
      return null;
    }

    setIsCreatingChat(true);

    try {
      const { data } = await api.post("/api/chat-histories", {
        user_email: userEmail,
        title: initialTitle,
      });
      setChatHistories((current) => upsertChatHistorySummary(current, data));
      setActiveChat(data);
      setActiveChatId(data.id);
      setChatError("");
      return data;
    } catch (error) {
      setChatError(error.response?.data?.detail || "Unable to create a new chat.");
      throw error;
    } finally {
      setIsCreatingChat(false);
    }
  };

  useEffect(() => {
    if (!userEmail) {
      return;
    }

    loadChatHistories().catch(() => {});
  }, [userEmail]);

  const liveReading = dashboardData?.current;
  const alertItems = dashboardData?.alerts ?? [];
  const hasAlerts =
    Boolean(dashboardError) ||
    alertItems.some((alert) => alert.tone === "warning" || alert.tone === "danger");
  const latestUpdated = formatTimestamp(liveReading?.recorded_at);
  const aqi = getPm25AqiSummary(liveReading?.dust);
  const gasSummary = getGasSummary(liveReading?.air_percent);

  const handleCreateChat = async () => {
    await createChatHistory("New chat");
  };

  const handleDeleteChat = async (chatId) => {
    if (!userEmail || !chatId) {
      return;
    }

    setDeletingChatId(chatId);

    try {
      await api.delete(`/api/chat-histories/${chatId}`, {
        params: { user_email: userEmail },
      });

      const remaining = chatHistories.filter((item) => item.id !== chatId);
      setChatHistories(remaining);
      setChatError("");

      if (activeChatId === chatId) {
        const nextChatId = remaining[0]?.id || "";
        setActiveChatId(nextChatId);
        if (nextChatId) {
          await loadChatHistory(nextChatId);
        } else {
          setActiveChat(null);
        }
      }
    } catch (error) {
      setChatError(error.response?.data?.detail || "Unable to delete chat history.");
    } finally {
      setDeletingChatId("");
    }
  };

  const handleSendChat = async (event) => {
    event.preventDefault();

    const trimmedMessage = chatInput.trim();
    if (!trimmedMessage || !userEmail) {
      return;
    }

    setIsSendingChat(true);

    try {
      let chatId = activeChatId;
      if (!chatId) {
        const created = await createChatHistory(trimmedMessage);
        chatId = created?.id || "";
      }

      if (!chatId) {
        return;
      }

      const { data: userHistory } = await api.post(`/api/chat-histories/${chatId}/messages`, {
        user_email: userEmail,
        role: "user",
        content: trimmedMessage,
      });

      setActiveChat(userHistory);
      setChatHistories((current) => upsertChatHistorySummary(current, userHistory));

      const assistantReply = buildAssistantReply({
        prompt: trimmedMessage,
        dashboardData,
        latestUpdated,
        aqi,
        gasSummary,
      });

      const { data: assistantHistory } = await api.post(`/api/chat-histories/${chatId}/messages`, {
        user_email: userEmail,
        role: "assistant",
        content: assistantReply,
      });

      setActiveChat(assistantHistory);
      setActiveChatId(assistantHistory.id);
      setChatHistories((current) => upsertChatHistorySummary(current, assistantHistory));
      setChatInput("");
      setChatError("");
    } catch (error) {
      setChatError(error.response?.data?.detail || "Unable to send the chat message.");
    } finally {
      setIsSendingChat(false);
    }
  };

  return (
    <main className="dashboard-root">
      <section className="dashboard-shell">
        <DashboardSidebar
          onLogout={logout}
          activeTab="Chat"
          onNavigate={navigate}
        />

        <section className="dashboard-main">
          <DashboardHeader
            isAuthenticated={isAuthenticated}
            userEmail={user?.email}
            hasAlerts={hasAlerts}
            alertItems={alertItems}
            latestAlertAt={liveReading?.recorded_at}
          />

          <section className="dashboard-chat-grid">
            <aside className="dashboard-card dashboard-chat-history">
              <div className="dashboard-chat-history__header">
                <div>
                  <p className="dashboard-card-label">Stored conversations</p>
                  <h2>Chat history</h2>
                </div>
                <button
                  type="button"
                  className="dashboard-chat-create"
                  onClick={handleCreateChat}
                  disabled={isCreatingChat}
                >
                  <FiPlus />
                  {isCreatingChat ? "Creating..." : "New"}
                </button>
              </div>

              <div className="dashboard-chat-history__list">
                {chatHistories.length ? (
                  chatHistories.map((history) => (
                    <article
                      key={history.id}
                      className={`dashboard-chat-history__item${
                        activeChatId === history.id ? " dashboard-chat-history__item--active" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="dashboard-chat-history__select"
                        onClick={() => loadChatHistory(history.id)}
                      >
                        <strong>{history.title}</strong>
                        <p>{history.preview}</p>
                        <span>
                          <FiClock />
                          {formatChatRelativeTime(history.last_message_at || history.updated_at)}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="dashboard-chat-history__delete"
                        onClick={() => handleDeleteChat(history.id)}
                        disabled={deletingChatId === history.id}
                        aria-label={`Delete ${history.title}`}
                      >
                        <FiTrash2 />
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="dashboard-chat-history__empty">
                    <FiMessageSquare />
                    <p>No saved chats yet. Start a new conversation to create one.</p>
                  </div>
                )}
              </div>
            </aside>

            <article className="dashboard-card dashboard-chat-card">
              <div className="dashboard-card__header">
                <div>
                  <p className="dashboard-card-label">ComfortSync assistant</p>
                  <h2>{activeChat?.title ?? "Chatbot workspace"}</h2>
                </div>
                <span className="dashboard-chat-badge">
                  <FiMessageSquare />
                  History enabled
                </span>
              </div>

              <div className="dashboard-chat-hero">
                <div>
                  <p className="dashboard-card-label">Smart indoor assistant</p>
                  <h3>Your air-quality copilot</h3>
                  <p className="dashboard-chat-hero__copy">
                    Each conversation is saved in the database, so you can revisit past questions and room summaries.
                  </p>
                </div>

                <div className="dashboard-chat-quick-actions" aria-label="Suggested prompts">
                  <button type="button" className="dashboard-chat-chip" onClick={() => setChatInput("Explain the gas trend in this room.")}>
                    Explain gas trend
                  </button>
                  <button type="button" className="dashboard-chat-chip" onClick={() => setChatInput("Give me a room safety summary.")}>
                    Room safety summary
                  </button>
                  <button type="button" className="dashboard-chat-chip" onClick={() => setChatInput("What device action do you suggest right now?")}>
                    Suggest device action
                  </button>
                </div>
              </div>

              {chatError ? <p className="dashboard-alert-banner">{chatError}</p> : null}

              <div className="dashboard-chat-thread">
                {isChatLoading ? (
                  <div className="dashboard-chat-empty-state">
                    <p>Loading chat history...</p>
                  </div>
                ) : activeChat?.messages?.length ? (
                  activeChat.messages.map((message) => (
                    <article
                      key={message.id}
                      className={`dashboard-chat-message dashboard-chat-message--${message.role}`}
                    >
                      <strong>{message.role === "assistant" ? "ComfortBot" : "You"}</strong>
                      <p>{message.content}</p>
                      <span className="dashboard-chat-message__time">
                        {formatChatRelativeTime(message.created_at)}
                      </span>
                    </article>
                  ))
                ) : (
                  <div className="dashboard-chat-empty-state">
                    <FiMessageSquare />
                    <p>Pick a chat from the left or start a new one to save messages.</p>
                  </div>
                )}
              </div>

              <form className="dashboard-chat-composer" onSubmit={handleSendChat}>
                <input
                  type="text"
                  className="dashboard-chat-input"
                  placeholder="Ask about temperature, air quality, gas, or device actions..."
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  disabled={isSendingChat}
                />
                <button
                  type="submit"
                  className="dashboard-chat-send"
                  disabled={isSendingChat || !chatInput.trim()}
                >
                  {isSendingChat ? "Sending..." : "Send"}
                </button>
              </form>
            </article>
          </section>
        </section>
      </section>
    </main>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCloud,
  FiClock,
  FiTrash2,
  FiDroplet,
  FiMessageSquare,
  FiPlus,
  FiSun,
  FiThermometer,
  FiTrendingUp,
  FiWind,
  FiZap,
} from "react-icons/fi";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import DashboardHeader from "../components/DashboardHeader";
import DashboardSidebar from "../components/DashboardSidebar";
import "./Dashboard.css";

const tabs = ["Dashboard", "Analytics", "Chat"];

const staticForecast = [
  { label: "Temperature", value: "+1.8 C", note: "Likely to rise by evening" },
  { label: "Humidity", value: "+4%", note: "Indoor moisture trend increasing" },
  { label: "Gas level", value: "+12 ppm", note: "Peak cooking period expected" },
  { label: "Dust level", value: "+8 ug/m3", note: "Windows open scenario detected" },
];

const hourlySeries = [
  { time: "08:00", temp: 24.8, humidity: 54, gas: 62, dust: 34 },
  { time: "10:00", temp: 25.4, humidity: 55, gas: 66, dust: 36 },
  { time: "12:00", temp: 26.2, humidity: 57, gas: 72, dust: 42 },
  { time: "14:00", temp: 26.9, humidity: 59, gas: 81, dust: 48 },
  { time: "16:00", temp: 27.4, humidity: 60, gas: 84, dust: 52 },
  { time: "18:00", temp: 28.1, humidity: 62, gas: 91, dust: 58 },
];

const clampPercent = (value, max) => `${Math.min((value / max) * 100, 100)}%`;
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

const formatMetricValue = (value) => (typeof value === "number" ? value : "--");

const buildControlPayload = (nextValues, currentValues) => {
  return {
    mode: nextValues.mode ?? currentValues.controlMode,
    fan_state: nextValues.fan_state ?? currentValues.fanManualState,
    light_state: nextValues.light_state ?? currentValues.lightManualState,
  };
};

const PM25_AQI_BREAKPOINTS = [
  { cLow: 0.0, cHigh: 9.0, iLow: 0, iHigh: 50, label: "Good", tone: "safe", note: "PM2.5 levels are in the healthy range." },
  {
    cLow: 9.1,
    cHigh: 35.4,
    iLow: 51,
    iHigh: 100,
    label: "Moderate",
    tone: "warning",
    note: "Air quality is acceptable, but unusually sensitive people should monitor exposure.",
  },
  {
    cLow: 35.5,
    cHigh: 55.4,
    iLow: 101,
    iHigh: 150,
    label: "Unhealthy for Sensitive Groups",
    tone: "warning",
    note: "People with breathing issues should reduce prolonged exposure.",
  },
  {
    cLow: 55.5,
    cHigh: 125.4,
    iLow: 151,
    iHigh: 200,
    label: "Unhealthy",
    tone: "danger",
    note: "Everyone may begin to feel health effects from the PM2.5 level.",
  },
  {
    cLow: 125.5,
    cHigh: 225.4,
    iLow: 201,
    iHigh: 300,
    label: "Very Unhealthy",
    tone: "danger",
    note: "Health warnings apply to everyone at this PM2.5 concentration.",
  },
  {
    cLow: 225.5,
    cHigh: 325.4,
    iLow: 301,
    iHigh: 400,
    label: "Hazardous",
    tone: "danger",
    note: "Emergency conditions: avoid exposure and improve ventilation immediately.",
  },
  {
    cLow: 325.5,
    cHigh: 500.4,
    iLow: 401,
    iHigh: 500,
    label: "Hazardous",
    tone: "danger",
    note: "Emergency conditions: avoid exposure and improve ventilation immediately.",
  },
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
    note: `${breakpoint.note}`,
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

const formatDelta = (currentValue, previousValue, unit) => {
  if (typeof currentValue !== "number" || typeof previousValue !== "number") {
    return "Waiting for trend data";
  }

  const delta = currentValue - previousValue;
  if (Math.abs(delta) < 0.1) {
    return "Stable since previous reading";
  }

  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} ${unit} from previous reading`;
};

const formatAirQualityDelta = (currentValue, previousValue) => {
  if (typeof currentValue !== "number" || typeof previousValue !== "number") {
    return "Waiting for air quality trend";
  }

  const delta = currentValue - previousValue;
  if (Math.abs(delta) < 0.1) {
    return "Air quality percentage is stable";
  }

  if (delta > 0) {
    return `+${delta.toFixed(1)}% air quality improvement`;
  }

  return `${delta.toFixed(1)}% air quality drop`;
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

function ChatPanel({
  histories,
  activeChat,
  activeChatId,
  chatInput,
  onInputChange,
  onQuickAction,
  onCreateChat,
  onSelectChat,
  onDeleteChat,
  onSend,
  isLoading,
  isCreating,
  isSending,
  deletingChatId,
  chatError,
}) {
  return (
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
            onClick={onCreateChat}
            disabled={isCreating}
          >
            <FiPlus />
            {isCreating ? "Creating..." : "New"}
          </button>
        </div>

        <div className="dashboard-chat-history__list">
          {histories.length ? (
            histories.map((history) => (
              <article
                key={history.id}
                className={`dashboard-chat-history__item${
                  activeChatId === history.id ? " dashboard-chat-history__item--active" : ""
                }`}
              >
                <button
                  type="button"
                  className="dashboard-chat-history__select"
                  onClick={() => onSelectChat(history.id)}
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
                  onClick={() => onDeleteChat(history.id)}
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
              Each conversation is now saved in the database, so you can revisit past questions and room summaries.
            </p>
          </div>

          <div className="dashboard-chat-quick-actions" aria-label="Suggested prompts">
            <button type="button" className="dashboard-chat-chip" onClick={() => onQuickAction("Explain the gas trend in this room.")}>
              Explain gas trend
            </button>
            <button type="button" className="dashboard-chat-chip" onClick={() => onQuickAction("Give me a room safety summary.")}>
              Room safety summary
            </button>
            <button type="button" className="dashboard-chat-chip" onClick={() => onQuickAction("What device action do you suggest right now?")}>
              Suggest device action
            </button>
          </div>
        </div>

        {chatError ? <p className="dashboard-alert-banner">{chatError}</p> : null}

        <div className="dashboard-chat-thread">
          {isLoading ? (
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

        <form className="dashboard-chat-composer" onSubmit={onSend}>
          <input
            type="text"
            className="dashboard-chat-input"
            placeholder="Ask about temperature, air quality, gas, or device actions..."
            value={chatInput}
            onChange={(event) => onInputChange(event.target.value)}
            disabled={isSending}
          />
          <button type="submit" className="dashboard-chat-send" disabled={isSending || !chatInput.trim()}>
            {isSending ? "Sending..." : "Send"}
          </button>
        </form>
      </article>
    </section>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const [dashboardData, setDashboardData] = useState(() => readDashboardCache());
  const [dashboardError, setDashboardError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [controlMode, setControlMode] = useState("AUTO");
  const [fanManualState, setFanManualState] = useState(false);
  const [lightManualState, setLightManualState] = useState(false);
  const [isSavingControl, setIsSavingControl] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [chatHistories, setChatHistories] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [activeChat, setActiveChat] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState("");

  const [comfortData, setComfortData] = useState(null);
  const [comfortLoading, setComfortLoading] = useState(false);

  const userEmail = user?.email ?? "";

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  const fetchDashboard = async ({ manual = false } = {}) => {
    if (manual) {
      setIsRefreshing(true);
    }

    try {
      const { data } = await api.get("/api/sensors/dashboard", {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        params: manual ? { refreshAt: Date.now() } : undefined,
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
    } finally {
      if (manual) {
        setIsRefreshing(false);
      }
    }
  };

  const fetchComfortData = async () => {
    try {
      setComfortLoading(true);

      const response = await fetch("http://localhost:8000/api/comfort/latest");
      if (!response.ok) {
        throw new Error("Failed to fetch comfort prediction");
      }

      const data = await response.json();
      setComfortData(data);
    } catch (error) {
      console.error("Comfort fetch error:", error);
      setComfortData(null);
    } finally {
      setComfortLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        await fetchDashboard();
        await fetchComfortData();

        if (!isMounted) {
          return;
        }
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
    if (activeTab !== "Chat" || !userEmail) {
      return;
    }

    loadChatHistories().catch(() => {});
  }, [activeTab, userEmail]);

  const handleRefresh = async () => {
    try {
      await fetchDashboard({ manual: true });
      await fetchComfortData();
    } catch {}
  };

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

      const agentResponse = await fetch("http://localhost:8000/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmedMessage }),
      });

      if (!agentResponse.ok) {
        throw new Error("Failed to get agent reply");
      }

      const agentData = await agentResponse.json();
      const assistantReply = agentData.reply;

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

  useEffect(() => {
    const controls = dashboardData?.controls;
    if (!controls || isSavingControl) {
      return;
    }

    setControlMode(controls.mode === "MANUAL" ? "MANUAL" : "AUTO");
    setFanManualState(Boolean(controls.fan_state));
    setLightManualState(Boolean(controls.light_state));
  }, [dashboardData, isSavingControl]);

  const saveDeviceControl = async (nextValues = {}) => {
    setIsSavingControl(true);

    try {
      const payload = buildControlPayload(nextValues, {
        controlMode,
        fanManualState,
        lightManualState,
      });

      await api.post("/api/device-controls", payload);

      setControlMode(payload.mode);
      setFanManualState(payload.fan_state);
      setLightManualState(payload.light_state);
      setDashboardData((current) =>
        current
          ? {
              ...current,
              controls: payload,
            }
          : current,
      );
      writeDashboardCache({
        ...(dashboardData ?? {}),
        controls: payload,
      });
      setDashboardError("");
    } catch (error) {
      console.error("Failed to save device control", error);
      setDashboardError(error.response?.data?.detail || "Unable to save control settings.");
      throw error;
    } finally {
      setIsSavingControl(false);
    }
  };

  const getComfortColor = (label) => {
    switch (label) {
      case "Comfortable":
        return "text-green-600";
      case "Moderate":
        return "text-yellow-600";
      case "Uncomfortable":
        return "text-orange-600";
      case "Hazardous":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getComfortReason = (inputs) => {
    if (!inputs) return "No explanation available.";

    const reasons = [];

    if (inputs.temperature > 28) reasons.push("high temperature");
    if (inputs.humidity > 60) reasons.push("high humidity");
    if (inputs.light_lux < 300) reasons.push("low lighting");
    if (inputs.dust_concentration > 250) reasons.push("elevated dust");
    if (inputs.air_percent < 60) reasons.push("poor air quality");

    if (reasons.length === 0) {
      return "Conditions are generally within a comfortable range.";
    }

    return `Main factors: ${reasons.join(", ")}.`;
  };

  const liveReading = dashboardData?.current;
  const previousReading = dashboardData?.recent_readings?.[1];

  const realtime = {
    temperature: readNumber(liveReading?.temperature),
    humidity: readNumber(liveReading?.humidity),
    gas: readNumber(liveReading?.gas),
    airPercent: readNumber(liveReading?.air_percent),
    light: readNumber(liveReading?.light),
    dust: readNumber(liveReading?.dust),
  };

  const alertItems = dashboardData?.alerts ?? [];
  const hasAlerts =
    Boolean(dashboardError) ||
    alertItems.some((alert) => alert.tone === "warning" || alert.tone === "danger");

  const deviceItems = dashboardData?.devices ?? [];
  const latestUpdated = formatTimestamp(liveReading?.recorded_at);
  const aqi = getPm25AqiSummary(liveReading?.dust);
  const gasSummary = getGasSummary(liveReading?.air_percent);
  const gasPrediction = dashboardData?.gas_prediction;
  const manualControlsDisabled = controlMode !== "MANUAL" || isSavingControl;

  const aqiGaugeStyle = {
    "--aqi-angle": `${Math.min(((aqi.value ?? 0) / 500) * 180, 180)}deg`,
  };

  const gasGaugeStyle = {
    "--aqi-angle": `${Math.min(((gasSummary.value ?? 0) / 100) * 180, 180)}deg`,
  };

  const sensorCards = [
    {
      label: "Temperature",
      value: realtime.temperature,
      unit: "C",
      note: formatDelta(realtime.temperature, previousReading?.temperature, "C"),
      tone: "rose",
      icon: <FiThermometer />,
    },
    {
      label: "Humidity",
      value: realtime.humidity,
      unit: "%",
      note: formatDelta(realtime.humidity, previousReading?.humidity, "%"),
      tone: "sky",
      icon: <FiDroplet />,
    },
    {
      label: "Air quality level",
      value: realtime.airPercent,
      unit: "%",
      note: formatAirQualityDelta(realtime.airPercent, previousReading?.air_percent),
      tone:
        realtime.airPercent >= 75 ? "mint" : realtime.airPercent >= 50 ? "gold" : "rose",
      icon: <FiCloud />,
    },
    {
      label: "Light intensity",
      value: realtime.light,
      unit: "lux",
      note: formatDelta(realtime.light, previousReading?.light, "lux"),
      tone: "mint",
      icon: <FiSun />,
    },
    {
      label: "Dust level",
      value: realtime.dust,
      unit: "ug/m3",
      note: formatDelta(realtime.dust, previousReading?.dust, "ug/m3"),
      tone: realtime.dust >= 40 ? "gold" : "mint",
      icon: <FiWind />,
    },
  ];

  const forecast = [
    staticForecast[0],
    staticForecast[1],
    gasPrediction?.predicted_value != null
      ? {
          label: "Gas level",
          value: `${gasPrediction.predicted_value.toFixed(1)} ${gasPrediction.unit}`,
          note: gasPrediction.note,
        }
      : {
          label: "Gas level",
          value: "--",
          note: gasPrediction?.note ?? "Prediction will appear after enough gas readings are available.",
        },
    staticForecast[3],
  ];

  return (
    <main className="dashboard-root">
      <section className="dashboard-shell">
        <DashboardSidebar onLogout={handleLogout} activeTab="Dashboard" onNavigate={navigate} />

        <section className="dashboard-main">
          <DashboardHeader
            isAuthenticated={isAuthenticated}
            userEmail={user?.email}
            hasAlerts={hasAlerts}
            alertItems={alertItems}
            latestAlertAt={liveReading?.recorded_at}
          />

          <div className="dashboard-tabs" role="tablist" aria-label="Dashboard views">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={`dashboard-tab ${
                  activeTab === tab ? "dashboard-tab--active" : ""
                }`}
                onClick={() => {
                  if (tab === "Dashboard") {
                    setActiveTab(tab);
                    return;
                  }

                  navigate(`/${tab.toLowerCase()}`);
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "Dashboard" ? (
            <section className="dashboard-grid">
              <article className="dashboard-card dashboard-card--hero">
                <div className="dashboard-card__header">
                  <div>
                    <p className="dashboard-card-label">Realtime environmental values</p>
                    <h2>All sensors</h2>
                  </div>
                  <button
                    type="button"
                    className="dashboard-pill-button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    aria-busy={isRefreshing}
                  >
                    {isRefreshing ? "Refreshing..." : "Refresh live data"}
                  </button>
                </div>

                <p className="dashboard-card-label">Last update: {latestUpdated}</p>

                <div className="dashboard-sensor-grid">
                  {sensorCards.map((card) => (
                    <article key={card.label} className="dashboard-sensor-card">
                      <div className="dashboard-sensor-card__top">
                        <p className="dashboard-card-label">{card.label}</p>
                        <span className={`dashboard-stat__icon dashboard-stat__icon--${card.tone}`}>
                          {card.icon}
                        </span>
                      </div>
                      <p className="dashboard-stat__value">
                        {formatMetricValue(card.value)}
                        <span> {card.unit}</span>
                      </p>
                      <p
                        className={`dashboard-stat__delta ${
                          card.tone === "gold" || card.tone === "rose"
                            ? "dashboard-stat__delta--warning"
                            : ""
                        }`}
                      >
                        {card.note}
                      </p>
                    </article>
                  ))}
                </div>
              </article>

              <article className="dashboard-card dashboard-card--predictions">
                <div className="dashboard-card__header">
                  <div>
                    <p className="dashboard-card-label">Machine learning insight</p>
                    <h2>AI Comfort Prediction</h2>
                  </div>
                  <FiZap className="dashboard-card__trend" />
                </div>

                {comfortLoading ? (
                  <p className="dashboard-card-label">Loading prediction...</p>
                ) : comfortData ? (
                  <div className="dashboard-insight-list">
                    <article className="dashboard-insight-item">
                      <div>
                        <strong className={getComfortColor(comfortData.comfort_label)}>
                          {comfortData.comfort_label}
                        </strong>
                        <p>{getComfortReason(comfortData.inputs)}</p>
                      </div>
                      <span>{formatTimestamp(comfortData.raw_document?.recorded_at)}</span>
                    </article>
                  </div>
                ) : (
                  <p className="dashboard-card-label">Prediction unavailable</p>
                )}
              </article>

              <article className="dashboard-card dashboard-card--controls">
                <div className="dashboard-card__header">
                  <div>
                    <p className="dashboard-card-label">Device status</p>
                    <h2>Device controls</h2>
                  </div>
                  <div className="dashboard-controls-header-actions">
                    <div className="dashboard-control-segment" role="group" aria-label="Dashboard control mode">
                      <button
                        type="button"
                        className={`dashboard-control-button ${
                          controlMode === "AUTO" ? "dashboard-control-button--active" : ""
                        }`}
                        onClick={() => saveDeviceControl({ mode: "AUTO" })}
                        disabled={isSavingControl}
                      >
                        Auto
                      </button>
                      <button
                        type="button"
                        className={`dashboard-control-button ${
                          controlMode === "MANUAL" ? "dashboard-control-button--active" : ""
                        }`}
                        onClick={() => saveDeviceControl({ mode: "MANUAL" })}
                        disabled={isSavingControl}
                      >
                        Manual
                      </button>
                    </div>
                  </div>
                </div>

                <div className="dashboard-device-panel">
                  <article className="dashboard-control-card">
                    <div className="dashboard-control-card__icon">
                      <FiWind />
                    </div>
                    <div className="dashboard-control-card__content">
                      <strong>{deviceItems[0]?.label ?? "--"}</strong>
                      <p>{deviceItems[0]?.description ?? "Waiting for live device data."}</p>
                      <div className="dashboard-control-stack">
                        <div className="dashboard-control-segment" role="group" aria-label="Fan control">
                          <button
                            type="button"
                            className={`dashboard-control-button ${
                              fanManualState ? "dashboard-control-button--active" : ""
                            }`}
                            onClick={() => saveDeviceControl({ fan_state: true })}
                            disabled={manualControlsDisabled}
                          >
                            Fan on
                          </button>
                          <button
                            type="button"
                            className={`dashboard-control-button ${
                              !fanManualState ? "dashboard-control-button--active" : ""
                            }`}
                            onClick={() => saveDeviceControl({ fan_state: false })}
                            disabled={manualControlsDisabled}
                          >
                            Fan off
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="dashboard-light-card">
                    <div className="dashboard-light-card__header">
                      <strong>{deviceItems[1]?.label ?? "--"}</strong>
                      <div className="dashboard-light-card__hero" aria-hidden="true">
                        <span className="dashboard-light-bulb dashboard-light-bulb--off" />
                        <span className="dashboard-light-bulb dashboard-light-bulb--dim" />
                        <span className="dashboard-light-bulb dashboard-light-bulb--active" />
                      </div>
                    </div>

                    <div className="dashboard-control-stack">
                      <div className="dashboard-control-segment" role="group" aria-label="Light control">
                        <button
                          type="button"
                          className={`dashboard-control-button ${
                            lightManualState ? "dashboard-control-button--active" : ""
                          }`}
                          onClick={() => saveDeviceControl({ light_state: true })}
                          disabled={manualControlsDisabled}
                        >
                          Light on
                        </button>
                        <button
                          type="button"
                          className={`dashboard-control-button ${
                            !lightManualState ? "dashboard-control-button--active" : ""
                          }`}
                          onClick={() => saveDeviceControl({ light_state: false })}
                          disabled={manualControlsDisabled}
                        >
                          Light off
                        </button>
                      </div>
                    </div>

                    <p className="dashboard-light-card__meta">
                      {`${deviceItems[1]?.description ?? "Waiting for live light data."} : ${formatMetricValue(
                        realtime.light,
                      )} lux`}
                    </p>
                  </article>
                </div>
              </article>

              <article className="dashboard-card dashboard-card--aqi">
                <div className="dashboard-card__header">
                  <div>
                    <p className="dashboard-card-label">Gas level gauge</p>
                    <h2>Current gas level</h2>
                  </div>
                  <FiCloud className="dashboard-card__trend" />
                </div>

                <div className="dashboard-aqi-panel">
                  <div
                    className={`dashboard-aqi-gauge dashboard-aqi-gauge--${gasSummary.tone}`}
                    style={gasGaugeStyle}
                  >
                    <div className="dashboard-aqi-gauge__arc" />
                    <div className={`dashboard-aqi-gauge__needle dashboard-aqi-gauge__needle--${gasSummary.tone}`} />
                    <div className="dashboard-aqi-gauge__center">
                      <strong>
                        {typeof gasSummary.value === "number" ? gasSummary.value.toFixed(1) : "--"}
                      </strong>
                      <span>{gasSummary.label}</span>
                    </div>
                  </div>

                  <div className="dashboard-aqi-scale" aria-hidden="true">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                  </div>

                  <div className={`dashboard-aqi-summary dashboard-aqi-summary--${gasSummary.tone}`}>
                    <strong>{gasSummary.label}</strong>
                    <p>{gasSummary.note}</p>
                  </div>
                </div>
              </article>

              <article className="dashboard-card dashboard-card--insights">
                <div className="dashboard-card__header">
                  <div>
                    <p className="dashboard-card-label">Predictive insights</p>
                    <h2>Next hours outlook</h2>
                  </div>
                  <FiTrendingUp className="dashboard-card__trend" />
                </div>

                <div className="dashboard-insight-list">
                  {forecast.slice(0, 3).map((item) => (
                    <article key={item.label} className="dashboard-insight-item">
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.note}</p>
                      </div>
                      <span>{item.value}</span>
                    </article>
                  ))}
                </div>
              </article>

              <article className="dashboard-card dashboard-card--aqi">
                <div className="dashboard-card__header">
                  <div>
                    <p className="dashboard-card-label">EPA PM2.5 AQI</p>
                    <h2>Standard air quality index</h2>
                  </div>
                  <FiWind className="dashboard-card__trend" />
                </div>

                <div className="dashboard-aqi-panel">
                  <div
                    className={`dashboard-aqi-gauge dashboard-aqi-gauge--${aqi.tone}`}
                    style={aqiGaugeStyle}
                  >
                    <div className="dashboard-aqi-gauge__arc" />
                    <div className={`dashboard-aqi-gauge__needle dashboard-aqi-gauge__needle--${aqi.tone}`} />
                    <div className="dashboard-aqi-gauge__center">
                      <strong>{aqi.value ?? "--"}</strong>
                      <span>{aqi.label}</span>
                    </div>
                  </div>

                  <div className="dashboard-aqi-scale" aria-hidden="true">
                    <span>0</span>
                    <span>100</span>
                    <span>500</span>
                  </div>

                  <div className={`dashboard-aqi-summary dashboard-aqi-summary--${aqi.tone}`}>
                    <strong>{aqi.label}</strong>
                    <p>{aqi.note}</p>
                  </div>
                </div>
              </article>
            </section>
          ) : null}

          {activeTab === "Chat" ? (
            <ChatPanel
              histories={chatHistories}
              activeChat={activeChat}
              activeChatId={activeChatId}
              chatInput={chatInput}
              onInputChange={setChatInput}
              onQuickAction={setChatInput}
              onCreateChat={handleCreateChat}
              onSelectChat={loadChatHistory}
              onDeleteChat={handleDeleteChat}
              onSend={handleSendChat}
              isLoading={isChatLoading}
              isCreating={isCreatingChat}
              isSending={isSendingChat}
              deletingChatId={deletingChatId}
              chatError={chatError}
            />
          ) : null}
        </section>
      </section>
    </main>
  );
}

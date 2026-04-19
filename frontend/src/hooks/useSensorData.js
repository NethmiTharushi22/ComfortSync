import { useEffect, useRef, useState } from "react";
import api from "../api/axios";

const POLL_INTERVAL_MS = 5000;
const CACHE_KEY = "comfortsync.sensorpage.snapshot";

const readCache = () => {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeCache = (value) => {
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {}
};

export function useSensorData() {
  const [data, setData] = useState(() => readCache());
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(!readCache());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetch = async () => {
      try {
        const { data: result } = await api.get("/api/sensors/dashboard", {
          headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        });
        if (!mountedRef.current) return;
        setData(result);
        writeCache(result);
        setError("");
      } catch (err) {
        if (!mountedRef.current) return;
        setError(
          err.response?.data?.detail ||
            err.message ||
            "Unable to load sensor data."
        );
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    };

    fetch();
    const id = window.setInterval(fetch, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, []);

  const current = data?.current ?? {};
  const recent = data?.recent_readings ?? [];

  return { current, recent, error, isLoading };
}

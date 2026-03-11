import { useAuth } from "../context/AuthContext";
import {
  addSampleReading,
  getLatestReadings,
  upsertUserProfile,
} from "../firebase/comfortsyncRepository";
import { isFirebaseConfigured } from "../firebase/config";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  const [readings, setReadings] = useState([]);
  const [firebaseError, setFirebaseError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      upsertUserProfile(user).catch((error) => {
        setFirebaseError(error.message);
      });
    }

    getLatestReadings()
      .then(setReadings)
      .catch((error) => {
        setFirebaseError(error.message);
      });
  }, [isAuthenticated, user]);

  const handleAddSample = async () => {
    setFirebaseError("");

    try {
      await addSampleReading();
      const latest = await getLatestReadings();
      setReadings(latest);
    } catch (error) {
      setFirebaseError(error.message);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "radial-gradient(circle at top, rgba(232, 97, 74, 0.2), transparent 35%), linear-gradient(135deg, #101722, #162130 50%, #1f3146)",
      }}
    >
      <section
        style={{
          width: "min(720px, 100%)",
          padding: "40px",
          borderRadius: "24px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(9, 14, 20, 0.72)",
          color: "#fff",
        }}
      >
        <p style={{ marginTop: 0, color: "#f59e0b", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          ComfortSync
        </p>
        <h1 style={{ marginTop: 0 }}>Dashboard</h1>
        <p>
          Viewing as{" "}
          <strong>{isAuthenticated ? user?.email : "guest preview"}</strong>
        </p>
        <p>
          Firebase status: <strong>{isFirebaseConfigured ? "configured" : "not configured"}</strong>
        </p>
        <p style={{ color: "rgba(255,255,255,0.72)" }}>
          Firestore does not use SQL tables. A `users` collection will be created automatically the
          first time a signed-in user opens this dashboard.
        </p>
        <button
          type="button"
          onClick={handleAddSample}
          style={{
            marginTop: "12px",
            marginRight: "12px",
            padding: "12px 18px",
            borderRadius: "999px",
            border: 0,
            background: "#14b8a6",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Add sample Firestore reading
        </button>
        {isAuthenticated ? (
          <button
            type="button"
            onClick={logout}
            style={{
              marginTop: "16px",
              padding: "12px 18px",
              borderRadius: "999px",
              border: 0,
              background: "#e8614a",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        ) : null}
        {firebaseError ? (
          <p style={{ marginTop: "18px", color: "#fca5a5" }}>{firebaseError}</p>
        ) : null}
        {readings.length ? (
          <div style={{ marginTop: "24px" }}>
            <h2 style={{ fontSize: "1.1rem" }}>Latest Firestore readings</h2>
            {readings.map((reading) => (
              <div
                key={reading.id}
                style={{
                  marginTop: "10px",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                <strong>{reading.room}</strong>
                <p style={{ margin: "6px 0 0" }}>
                  CO2: {reading.co2} ppm, Temp: {reading.temperature} C, Humidity: {reading.humidity}%
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

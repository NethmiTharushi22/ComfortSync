const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export default function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">ComfortSync</p>
        <h1>React + Vite frontend ready.</h1>
        <p className="copy">
          The FastAPI backend is expected at <code>{apiBaseUrl}</code>.
        </p>
        <div className="actions">
          <a href={apiBaseUrl} target="_blank" rel="noreferrer">
            Open API
          </a>
          <a href={`${apiBaseUrl}/docs`} target="_blank" rel="noreferrer">
            Swagger Docs
          </a>
        </div>
      </section>
    </main>
  );
}

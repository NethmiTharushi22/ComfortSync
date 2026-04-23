export default function AnalyticsSectionCard({
  title,
  label,
  controls,
  children,
  className = "",
}) {
  return (
    <article className={`analytics-card ${className}`.trim()}>
      <div className="analytics-card-header">
        <div>
          <p className="analytics-card-label">{label}</p>
          <h2>{title}</h2>
        </div>

        {controls ? <div className="analytics-controls">{controls}</div> : null}
      </div>

      {children}
    </article>
  );
}
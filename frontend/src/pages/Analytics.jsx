import { FiActivity, FiCloud, FiDroplet, FiSun, FiThermometer, FiWind } from "react-icons/fi";
import "./Analytics.css";

export default function Analytics({ forecast, hourlySeries, clampPercent }) {
  const graphs = [
    {
      key: "temp",
      label: "Temperature",
      value: `${hourlySeries.at(-1)?.temp ?? 28.1} C`,
      note: forecast[0]?.value ?? "+1.8 C",
      icon: <FiThermometer />,
      tone: "rose",
      max: 32,
      points: hourlySeries.map((point) => ({ time: point.time, value: point.temp })),
    },
    {
      key: "humidity",
      label: "Humidity",
      value: `${hourlySeries.at(-1)?.humidity ?? 62}%`,
      note: forecast[1]?.value ?? "+4%",
      icon: <FiDroplet />,
      tone: "sky",
      max: 80,
      points: hourlySeries.map((point) => ({ time: point.time, value: point.humidity })),
    },
    {
      key: "gas",
      label: "Gas level",
      value: `${hourlySeries.at(-1)?.gas ?? 91} ppm`,
      note: forecast[2]?.value ?? "+12 ppm",
      icon: <FiCloud />,
      tone: "gold",
      max: 120,
      points: hourlySeries.map((point) => ({ time: point.time, value: point.gas })),
    },
    {
      key: "dust",
      label: "Dust level",
      value: `${hourlySeries.at(-1)?.dust ?? 58} ug/m3`,
      note: forecast[3]?.value ?? "+8 ug/m3",
      icon: <FiWind />,
      tone: "mint",
      max: 80,
      points: hourlySeries.map((point) => ({ time: point.time, value: point.dust })),
    },
    {
      key: "light",
      label: "Light intensity",
      value: "400 lux",
      note: "Medium brightness band",
      icon: <FiSun />,
      tone: "amber",
      max: 500,
      points: [
        { time: "08:00", value: 120 },
        { time: "10:00", value: 220 },
        { time: "12:00", value: 430 },
        { time: "14:00", value: 410 },
        { time: "16:00", value: 360 },
        { time: "18:00", value: 180 },
      ],
    },
    {
      key: "comfort",
      label: "Overall activity",
      value: "Stable",
      note: "Realtime trend remains manageable",
      icon: <FiActivity />,
      tone: "aqua",
      max: 100,
      points: [
        { time: "08:00", value: 56 },
        { time: "10:00", value: 61 },
        { time: "12:00", value: 68 },
        { time: "14:00", value: 72 },
        { time: "16:00", value: 69 },
        { time: "18:00", value: 66 },
      ],
    },
  ];

  return (
    <section className="analytics-grid">
      {graphs.map((graph) => (
        <article key={graph.key} className="analytics-card analytics-card--graph">
          <div className="analytics-card__header">
            <div>
              <p className="analytics-card__label">{graph.label}</p>
              <h2>{graph.value}</h2>
            </div>
            <span className={`analytics-card__badge analytics-card__badge--${graph.tone}`}>
              {graph.icon}
            </span>
          </div>

          <p className="analytics-card__note">{graph.note}</p>

          <div className="analytics-graph">
            <div className="analytics-graph__grid" />
            <div className={`analytics-graph__line analytics-graph__line--${graph.tone}`} />
            <div className="analytics-graph__bars">
              {graph.points.map((point) => (
                <div key={point.time} className="analytics-graph__bar-group">
                  <span
                    className={`analytics-graph__bar analytics-graph__bar--${graph.tone}`}
                    style={{ height: clampPercent(point.value, graph.max) }}
                  />
                  <small>{point.time}</small>
                </div>
              ))}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

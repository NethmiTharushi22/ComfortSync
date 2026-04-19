from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from app.services.comfort_engine import analyze_comfort


QUESTION_HINTS = {
    "gas": ("gas", "air quality", "air", "smell", "mq135", "co2"),
    "dust": ("dust", "pm", "pm2.5", "aqi"),
    "temperature": ("temperature", "temp", "hot", "warm", "cold"),
    "humidity": ("humidity", "humid", "dry"),
    "light": ("light", "lighting", "lux", "bright", "dim"),
    "study": ("study", "work", "reading", "focus"),
    "safety": ("safe", "safety", "danger", "hazard"),
    "action": ("what should", "suggest", "recommend", "do now", "action"),
    "summary": ("summary", "overall", "room condition", "status", "comfortable"),
    "trend": ("trend", "changed", "history", "last", "recent"),
}


def _contains_any(message: str, words: Iterable[str]) -> bool:
    return any(word in message for word in words)


def _fmt(value: Any, suffix: str = "") -> str:
    return f"{value:.1f}{suffix}" if isinstance(value, (int, float)) else "unavailable"


def _trend_summary(recent_readings: list[dict[str, Any]] | None) -> str:
    if not recent_readings or len(recent_readings) < 2:
        return "There is not enough history yet to describe a recent trend."

    first = recent_readings[-1]
    latest = recent_readings[0]

    pieces: list[str] = []
    for field, label, suffix in [
        ("temperature", "temperature", "°C"),
        ("humidity", "humidity", "%"),
        ("light", "light", " lux"),
        ("dust", "dust", " µg/m³"),
        ("air_percent", "air quality", "%"),
    ]:
        start = first.get(field)
        end = latest.get(field)
        if isinstance(start, (int, float)) and isinstance(end, (int, float)):
            delta = end - start
            if abs(delta) >= 0.5:
                direction = "increased" if delta > 0 else "decreased"
                pieces.append(f"{label} has {direction} from {start:.1f}{suffix} to {end:.1f}{suffix}")

    return "; ".join(pieces) + "." if pieces else "Recent readings look fairly stable overall."


def build_assistant_reply(message: str, dashboard_snapshot: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    normalized = message.strip().lower()
    insight = analyze_comfort(
        dashboard_snapshot.get("current"),
        alerts=dashboard_snapshot.get("alerts") or [],
        status=dashboard_snapshot.get("status"),
    )
    metrics = insight["metrics"]
    current = dashboard_snapshot.get("current") or {}

    temp = current.get("temperature")
    humidity = current.get("humidity")
    light = current.get("light")
    dust = current.get("dust")
    air_percent = current.get("air_percent")
    aqi = metrics["aqi"]
    gas = metrics["gas"]
    trend = _trend_summary(dashboard_snapshot.get("recent_readings"))

    if _contains_any(normalized, QUESTION_HINTS["gas"]):
        reply = (
            f"The gas condition is {gas['label'].lower()} right now"
            f" with an estimated gas level of {_fmt(gas['value'], '%')}. {gas['note']}"
            f" The last synced reading was {insight['latest_updated'] or 'recently'}"
        )
    elif _contains_any(normalized, QUESTION_HINTS["dust"]):
        reply = (
            f"The current dust reading is {_fmt(dust, ' µg/m³')} and the PM2.5 AQI category is {aqi['label']}."
            f" {aqi['note']}"
        )
    elif _contains_any(normalized, QUESTION_HINTS["temperature"]):
        reply = (
            f"The room temperature is {_fmt(temp, '°C')}. "
            + (
                "That is above the comfortable indoor range, so airflow or cooling would help."
                if isinstance(temp, (int, float)) and temp >= 30
                else "That is within a more comfortable indoor range."
            )
        )
    elif _contains_any(normalized, QUESTION_HINTS["humidity"]):
        reply = (
            f"Humidity is {_fmt(humidity, '%')}. "
            + (
                "It is outside the ideal indoor band, so the room may feel sticky or dry."
                if isinstance(humidity, (int, float)) and (humidity < 35 or humidity > 70)
                else "It is close to the ideal indoor humidity band."
            )
        )
    elif _contains_any(normalized, QUESTION_HINTS["light"]):
        reply = (
            f"The current light level is {_fmt(light, ' lux')}. "
            + (
                "That is dim for focused study or work, so brighter lighting is recommended."
                if isinstance(light, (int, float)) and light < 200
                else "That should be adequate for normal indoor activity."
            )
        )
    elif _contains_any(normalized, QUESTION_HINTS["study"]):
        reply = (
            f"For study or desk work, this room is currently rated {insight['comfort_label'].lower()} with a comfort score of {insight['comfort_score']}/100. "
            f"The main issue is {insight['priority_issue'].lower()}. "
            f"Best next step: {insight['recommendations'][0]}"
        )
    elif _contains_any(normalized, QUESTION_HINTS["safety"]):
        reply = (
            f"The room safety status is {insight['comfort_label'].lower()}. "
            f"Top concern: {insight['priority_issue']}. "
            f"Current gas status is {gas['label'].lower()} and AQI category is {aqi['label'].lower()}."
        )
    elif _contains_any(normalized, QUESTION_HINTS["action"]):
        reply = (
            f"The first action I recommend is: {insight['recommendations'][0]} "
            f"This is based on the latest readings for temperature {_fmt(temp, '°C')}, humidity {_fmt(humidity, '%')}, "
            f"light {_fmt(light, ' lux')}, dust {_fmt(dust, ' µg/m³')}, and air quality {_fmt(air_percent, '%')}."
        )
    elif _contains_any(normalized, QUESTION_HINTS["trend"]):
        reply = trend
    else:
        issue_bits = metrics.get("issue_notes") or []
        issue_sentence = " ".join(issue_bits[:2]) if issue_bits else "No major comfort issue is visible right now."
        reply = (
            f"The room is currently {insight['comfort_label'].lower()} with a comfort score of {insight['comfort_score']}/100. "
            f"Priority issue: {insight['priority_issue']}. {issue_sentence} "
            f"Recommended action: {insight['recommendations'][0]}"
        )

    return reply.strip(), insight

from __future__ import annotations

from typing import Any


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _score_band(value: float | None, *, ideal_low: float, ideal_high: float, warn_low: float | None = None, warn_high: float | None = None, max_points: int = 20) -> int:
    if value is None:
        return 0

    if ideal_low <= value <= ideal_high:
        return max_points

    warn_low = ideal_low if warn_low is None else warn_low
    warn_high = ideal_high if warn_high is None else warn_high

    if warn_low <= value <= warn_high:
        return int(max_points * 0.6)

    return int(max_points * 0.2)


PM25_AQI_BREAKPOINTS = [
    {"cLow": 0.0, "cHigh": 9.0, "iLow": 0, "iHigh": 50, "label": "Good", "tone": "safe"},
    {"cLow": 9.1, "cHigh": 35.4, "iLow": 51, "iHigh": 100, "label": "Moderate", "tone": "warning"},
    {"cLow": 35.5, "cHigh": 55.4, "iLow": 101, "iHigh": 150, "label": "Unhealthy for Sensitive Groups", "tone": "warning"},
    {"cLow": 55.5, "cHigh": 125.4, "iLow": 151, "iHigh": 200, "label": "Unhealthy", "tone": "danger"},
    {"cLow": 125.5, "cHigh": 225.4, "iLow": 201, "iHigh": 300, "label": "Very Unhealthy", "tone": "danger"},
    {"cLow": 225.5, "cHigh": 500.4, "iLow": 301, "iHigh": 500, "label": "Hazardous", "tone": "danger"},
]


def get_pm25_aqi_summary(pm25: float | None) -> dict[str, Any]:
    if pm25 is None or pm25 < 0:
        return {"value": None, "label": "Unavailable", "tone": "warning", "note": "Waiting for a PM2.5 reading."}

    truncated_pm25 = int(pm25 * 10) / 10
    breakpoint = next((item for item in PM25_AQI_BREAKPOINTS if item["cLow"] <= truncated_pm25 <= item["cHigh"]), PM25_AQI_BREAKPOINTS[-1])
    aqi_value = round(((breakpoint["iHigh"] - breakpoint["iLow"]) / (breakpoint["cHigh"] - breakpoint["cLow"])) * (truncated_pm25 - breakpoint["cLow"]) + breakpoint["iLow"])
    return {
        "value": min(aqi_value, 500),
        "label": breakpoint["label"],
        "tone": breakpoint["tone"],
        "note": f"PM2.5 condition is {breakpoint['label'].lower()} based on the latest reading.",
    }


def get_gas_summary(air_percent: float | None) -> dict[str, Any]:
    if air_percent is None:
        return {"value": None, "label": "Unavailable", "tone": "warning", "note": "Waiting for an air-quality percentage reading."}

    gas_level = _clamp(100.0 - air_percent, 0.0, 100.0)
    if gas_level >= 60:
        return {"value": round(gas_level, 1), "label": "High", "tone": "danger", "note": "Ventilation is recommended immediately."}
    if gas_level >= 30:
        return {"value": round(gas_level, 1), "label": "Moderate", "tone": "warning", "note": "Gas level is rising and should be watched."}
    return {"value": round(gas_level, 1), "label": "Low", "tone": "safe", "note": "Gas level is low and stable."}


def analyze_comfort(current: dict[str, Any] | None, *, alerts: list[dict[str, Any]] | None = None, status: str | None = None) -> dict[str, Any]:
    current = current or {}
    alerts = alerts or []

    temperature = current.get("temperature")
    humidity = current.get("humidity")
    light = current.get("light")
    dust = current.get("dust")
    air_percent = current.get("air_percent")
    recorded_at = current.get("recorded_at")

    aqi = get_pm25_aqi_summary(dust)
    gas = get_gas_summary(air_percent)

    scores = {
        "temperature": _score_band(temperature, ideal_low=22, ideal_high=28, warn_low=20, warn_high=30),
        "humidity": _score_band(humidity, ideal_low=40, ideal_high=60, warn_low=35, warn_high=70),
        "light": _score_band(light, ideal_low=300, ideal_high=500, warn_low=200, warn_high=800),
        "dust": _score_band(dust, ideal_low=0, ideal_high=12, warn_low=0, warn_high=35),
        "gas": _score_band(air_percent, ideal_low=75, ideal_high=100, warn_low=60, warn_high=100),
    }

    comfort_score = int(sum(scores.values()))

    if gas["tone"] == "danger" or aqi["tone"] == "danger":
        comfort_label = "Hazardous"
    elif comfort_score >= 80:
        comfort_label = "Comfortable"
    elif comfort_score >= 60:
        comfort_label = "Moderate"
    elif comfort_score >= 35:
        comfort_label = "Uncomfortable"
    else:
        comfort_label = "Hazardous"

    issues: list[tuple[str, str]] = []
    if temperature is not None and temperature >= 30:
        issues.append(("High temperature", f"Temperature is {temperature:.1f}°C, which is above the comfort range."))
    elif temperature is not None and temperature < 20:
        issues.append(("Low temperature", f"Temperature is {temperature:.1f}°C, which feels a bit cool indoors."))

    if humidity is not None and humidity > 70:
        issues.append(("High humidity", f"Humidity is {humidity:.0f}%, which can make the room feel sticky."))
    elif humidity is not None and humidity < 35:
        issues.append(("Low humidity", f"Humidity is {humidity:.0f}%, which may feel dry."))

    if light is not None and light < 200:
        issues.append(("Low lighting", f"Light is {light:.1f} lux, which is too dim for comfortable study or work."))
    elif light is not None and light > 1000:
        issues.append(("Excessive lighting", f"Light is {light:.1f} lux, which may feel too bright indoors."))

    if dust is not None and dust >= 35:
        issues.append(("Dust level elevated", f"Dust is {dust:.1f} µg/m³, which affects air quality."))

    if gas["label"] in {"High", "Moderate"}:
        issues.append((f"{gas['label']} gas level", gas["note"]))

    priority_issue = issues[0][0] if issues else "No major issue detected"

    recommendations: list[str] = []
    if any(name in {"High temperature", "High humidity"} for name, _ in issues):
        recommendations.append("Increase ventilation or switch on the fan to improve airflow.")
    if any(name in {"Low lighting"} for name, _ in issues):
        recommendations.append("Increase room lighting for study or desk work.")
    if any(name in {"Dust level elevated", "High gas level", "Moderate gas level"} for name, _ in issues):
        recommendations.append("Open windows or improve ventilation to reduce pollutants.")
    if not recommendations:
        recommendations.append("Current readings look fairly stable. Keep monitoring the room conditions.")

    issue_notes = [detail for _, detail in issues[:3]]

    return {
        "comfort_score": comfort_score,
        "comfort_label": comfort_label,
        "priority_issue": priority_issue,
        "latest_updated": recorded_at,
        "recommendations": recommendations,
        "status": status or "unknown",
        "metrics": {
            "temperature": temperature,
            "humidity": humidity,
            "light": light,
            "dust": dust,
            "air_percent": air_percent,
            "aqi": aqi,
            "gas": gas,
            "alerts": alerts,
            "issue_notes": issue_notes,
        },
    }

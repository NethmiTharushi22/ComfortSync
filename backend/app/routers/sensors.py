from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from firebase_admin import firestore

from app.db import get_db
from app.config import settings
from app.models.schemas import (
    DashboardAlertOut,
    DashboardSnapshotOut,
    DeviceStatusOut,
    SensorReadingOut,
)

router = APIRouter()

FIELD_ALIASES = {
    "temperature": ("temperature", "temp"),
    "humidity": ("humidity",),
    "gas": ("gas", "co2", "gas_level", "gasLevel", "co2_level", "co2Level", "mq135_raw"),
    "dust": ("dust", "dust_level", "dustLevel", "pm25", "pm2_5", "pm", "dust_concentration"),
    "light": ("light", "light_level", "lightLevel", "light_intensity", "lightIntensity", "lux", "light_lux"),
    "fan_status": ("fan_status", "fanState"),
    "light_status": ("light_status", "lightState"),
}

TIMESTAMP_FIELDS = ("createdAt", "timestamp", "recordedAt", "created_at", "recorded_at", "time")


def _first_present(payload: dict[str, Any], names: tuple[str, ...]) -> Any:
    for name in names:
        value = payload.get(name)
        if value is not None:
            return value
    return None


def _to_float(value: Any) -> float | None:
    if value is None or value == "":
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_iso8601(value: Any) -> str | None:
    if value is None:
        return None

    if hasattr(value, "isoformat"):
        iso_value = value.isoformat()
        return iso_value.replace("+00:00", "Z")

    if isinstance(value, str):
        return value

    return None


def _normalize_reading(document) -> SensorReadingOut:
    payload = document.to_dict() or {}
    recorded_at = _to_iso8601(_first_present(payload, TIMESTAMP_FIELDS))

    return SensorReadingOut(
        id=document.id,
        temperature=_to_float(_first_present(payload, FIELD_ALIASES["temperature"])),
        humidity=_to_float(_first_present(payload, FIELD_ALIASES["humidity"])),
        gas=_to_float(_first_present(payload, FIELD_ALIASES["gas"])),
        dust=_to_float(_first_present(payload, FIELD_ALIASES["dust"])),
        light=_to_float(_first_present(payload, FIELD_ALIASES["light"])),
        recorded_at=recorded_at,
    )


def _build_alerts(reading: SensorReadingOut) -> list[DashboardAlertOut]:
    alerts: list[DashboardAlertOut] = []

    if reading.gas is not None and reading.gas >= 800:
        alerts.append(
            DashboardAlertOut(
                title="Gas level increased",
                detail=f"Current gas reading is {reading.gas:.0f} ppm and needs ventilation.",
                tone="danger",
            )
        )

    if reading.dust is not None and reading.dust >= 40:
        alerts.append(
            DashboardAlertOut(
                title="Dust level increased",
                detail=f"Dust concentration reached {reading.dust:.1f} ug/m3 and should be reduced.",
                tone="warning",
            )
        )

    if reading.temperature is not None and reading.temperature >= 30:
        alerts.append(
            DashboardAlertOut(
                title="Temperature is above comfort range",
                detail=f"Room temperature is {reading.temperature:.1f} C and may feel uncomfortable.",
                tone="warning",
            )
        )

    if reading.humidity is not None and (reading.humidity < 35 or reading.humidity > 70):
        alerts.append(
            DashboardAlertOut(
                title="Humidity is outside the ideal band",
                detail=f"Humidity is currently {reading.humidity:.0f}% and should be monitored.",
                tone="warning",
            )
        )

    alerts.append(
        DashboardAlertOut(
            title="Realtime sync active",
            detail="Dashboard values are being read from the latest backend sensor data.",
            tone="safe",
        )
    )

    return alerts


def _build_devices(reading: SensorReadingOut, payload: dict[str, Any] | None = None) -> list[DeviceStatusOut]:
    payload = payload or {}
    fan_on = (
        (reading.gas is not None and reading.gas >= 800)
        or (reading.dust is not None and reading.dust >= 40)
        or (reading.temperature is not None and reading.temperature >= 29)
    )
    light_value = reading.light if reading.light is not None else 0
    fan_state = _first_present(payload, FIELD_ALIASES["fan_status"])
    light_state_from_payload = _first_present(payload, FIELD_ALIASES["light_status"])

    if str(fan_state).upper() in {"ON", "OFF"}:
        fan_is_on = str(fan_state).upper() == "ON"
    else:
        fan_is_on = fan_on

    if str(light_state_from_payload).upper() in {"ON", "OFF", "DIM"}:
        light_state = str(light_state_from_payload).upper()
        if light_state == "ON":
            light_description = "Brightness boosted for low ambient light"
            light_tone = "warning"
        elif light_state == "DIM":
            light_description = "Balanced indoor lighting"
            light_tone = "safe"
        else:
            light_description = "Daylight is sufficient"
            light_tone = "safe"
    elif light_value < 120:
        light_state = "ON"
        light_description = "Brightness boosted for low ambient light"
        light_tone = "warning"
    elif light_value < 300:
        light_state = "DIM"
        light_description = "Balanced indoor lighting"
        light_tone = "safe"
    else:
        light_state = "OFF"
        light_description = "Daylight is sufficient"
        light_tone = "safe"

    return [
        DeviceStatusOut(
            label="Ventilation Fan",
            description="Auto Mode Active" if fan_is_on else "Standby Mode",
            state="ON" if fan_is_on else "OFF",
            tone="warning" if fan_is_on else "safe",
        ),
        DeviceStatusOut(
            label="Lights Control",
            description=light_description,
            state=light_state,
            tone=light_tone,
        ),
    ]


def _overall_status(alerts: list[DashboardAlertOut]) -> str:
    tones = {alert.tone for alert in alerts}
    if "danger" in tones:
        return "critical"
    if "warning" in tones:
        return "attention"
    return "stable"


def _load_recent_documents(collection):
    for field_name in TIMESTAMP_FIELDS:
        try:
            documents = list(
                collection.order_by(field_name, direction=firestore.Query.DESCENDING)
                .limit(12)
                .stream()
            )
            if documents:
                return documents
        except Exception:
            continue

    return list(collection.limit(12).stream())


@router.get("/dashboard", response_model=DashboardSnapshotOut)
def get_dashboard_snapshot() -> DashboardSnapshotOut:
    db = get_db()
    collection = db.collection(settings.sensor_collection)

    try:
        documents = _load_recent_documents(collection)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to load sensor readings.") from exc

    if not documents:
        empty = SensorReadingOut(id="latest")
        alerts = [
            DashboardAlertOut(
                title="No sensor data yet",
                detail=f"The {settings.sensor_collection} collection is empty, so live values are not available.",
                tone="warning",
            )
        ]
        return DashboardSnapshotOut(
            current=empty,
            alerts=alerts,
            devices=_build_devices(empty, {}),
            recent_readings=[],
            status="attention",
        )

    normalized = [
        {"reading": _normalize_reading(document), "payload": document.to_dict() or {}}
        for document in documents
    ]
    normalized.sort(
        key=lambda item: item["reading"].recorded_at
        or datetime.min.replace(tzinfo=timezone.utc).isoformat(),
        reverse=True,
    )

    current = normalized[0]["reading"]
    current_payload = normalized[0]["payload"]
    alerts = _build_alerts(current)

    return DashboardSnapshotOut(
        current=current,
        alerts=alerts,
        devices=_build_devices(current, current_payload),
        recent_readings=[item["reading"] for item in normalized[:6]],
        status=_overall_status(alerts),
    )

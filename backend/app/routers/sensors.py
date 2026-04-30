from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from firebase_admin import firestore

from app.db import get_db
from app.config import settings
from app.models.schemas import (
    DashboardAlertOut,
    DashboardSnapshotOut,
    DeviceStatusOut,
    SensorReadingOut,
)
from app.routers.device_controls import get_current_device_controls

router = APIRouter()
ALERT_RETENTION_HOURS = 36

FIELD_ALIASES = {
    "temperature": ("temperature", "temp"),
    "humidity": ("humidity",),
    "gas": ("gas", "co2", "gas_level", "gasLevel", "co2_level", "co2Level", "mq135_raw"),
    "air_percent": ("air_percent", "airPercent", "air_quality_percent", "airQualityPercent"),
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
        air_percent=_to_float(_first_present(payload, FIELD_ALIASES["air_percent"])),
        dust=_to_float(_first_present(payload, FIELD_ALIASES["dust"])),
        light=_to_float(_first_present(payload, FIELD_ALIASES["light"])),
        recorded_at=recorded_at,
    )


def _parse_recorded_at(value: str | None) -> datetime | None:
    if not value:
        return None

    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def _alerts_are_active(reading: SensorReadingOut) -> bool:
    recorded_at = _parse_recorded_at(reading.recorded_at)
    if recorded_at is None:
        return False

    age = datetime.now(timezone.utc) - recorded_at
    return age.total_seconds() <= ALERT_RETENTION_HOURS * 3600


def _build_alerts(reading: SensorReadingOut) -> list[DashboardAlertOut]:
    if not _alerts_are_active(reading):
        return []

    alerts: list[DashboardAlertOut] = []

    gas_level = None
    if reading.air_percent is not None:
        gas_level = max(0.0, min(100.0, 100.0 - reading.air_percent))

    if gas_level is not None and gas_level >= 60:
        alerts.append(
            DashboardAlertOut(
                title="Gas level increased",
                detail=f"Current gas level is {gas_level:.1f}% and ventilation is recommended.",
                tone="danger",
            )
        )
    elif gas_level is not None and gas_level >= 30:
        alerts.append(
            DashboardAlertOut(
                title="Gas level rising",
                detail=f"Current gas level is {gas_level:.1f}% and should be monitored.",
                tone="warning",
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
            title="Scheduled sync active",
            detail="Dashboard values reflect the latest backend sensor data from the most recent scheduled refresh.",
            tone="safe",
        )
    )

    return alerts


def _coerce_device_state(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        if value == 1:
            return True
        if value == 0:
            return False

    if isinstance(value, str):
        normalized = value.strip().upper()
        if normalized in {"1", "ON", "TRUE", "HIGH"}:
            return True
        if normalized in {"0", "OFF", "FALSE", "LOW"}:
            return False
        if normalized == "DIM":
            return True

    return None


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
    fan_is_on = _coerce_device_state(fan_state)
    if fan_is_on is None:
        fan_is_on = fan_on

    light_is_on = _coerce_device_state(light_state_from_payload)
    if light_is_on is None:
        light_is_on = light_value < 300

    return [
        DeviceStatusOut(
            label="Ventilation Fan",
            description="ON" if fan_is_on else "OFF",
        ),
        DeviceStatusOut(
            label="Lights Control",
            description="ON" if light_is_on else "OFF",
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
                .limit(200)
                .stream()
            )
            if documents:
                return documents
        except Exception:
            continue

    return list(collection.limit(200).stream())


def _matches_filters(payload: dict[str, Any], sensor_id: str | None, data_mode: str | None) -> bool:
    if sensor_id and str(payload.get("sensor_id", "")).strip() != sensor_id:
        return False

    if data_mode and str(payload.get("data_mode", "")).strip() != data_mode:
        return False

    return True


@router.get("/dashboard", response_model=DashboardSnapshotOut)
def get_dashboard_snapshot(
    sensor_id: str | None = Query(default=None),
    data_mode: str | None = Query(default=None),
) -> DashboardSnapshotOut:
    db = get_db()
    collection = db.collection(settings.sensor_collection)
    controls = get_current_device_controls(db)

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
            controls=controls,
            status="attention",
        )

    normalized = []
    for document in documents:
        payload = document.to_dict() or {}
        if not _matches_filters(payload, sensor_id, data_mode):
            continue
        normalized.append(
            {
                "reading": _normalize_reading(document),
                "payload": payload,
            }
        )

    normalized.sort(
        key=lambda item: item["reading"].recorded_at
        or datetime.min.replace(tzinfo=timezone.utc).isoformat(),
        reverse=True,
    )

    if not normalized:
        empty = SensorReadingOut(id="latest")
        alerts = [
            DashboardAlertOut(
                title="No matching sensor data",
                detail="No records matched the selected filter values.",
                tone="warning",
            )
        ]
        return DashboardSnapshotOut(
            current=empty,
            alerts=alerts,
            devices=_build_devices(empty, {}),
            recent_readings=[],
            controls=controls,
            status="attention",
        )

    current = normalized[0]["reading"]
    current_payload = normalized[0]["payload"]
    alerts = _build_alerts(current)

    return DashboardSnapshotOut(
        current=current,
        alerts=alerts,
        devices=_build_devices(current, current_payload),
        recent_readings=[item["reading"] for item in normalized[:30]],
        controls=controls,
        status=_overall_status(alerts),
    )

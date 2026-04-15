from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.db import get_db
from app.models.schemas import DeviceControlOut, DeviceControlUpdate

router = APIRouter()


def _controls_document(db):
    return (
        db.collection(settings.device_controls_collection)
        .document(settings.device_controls_document_id)
    )


def _normalize_controls(payload: dict[str, Any] | None = None) -> DeviceControlOut:
    payload = payload or {}
    mode = str(payload.get("mode") or "AUTO").upper()

    return DeviceControlOut(
        mode="MANUAL" if mode == "MANUAL" else "AUTO",
        fan_state=bool(payload.get("fan_state", False)),
        light_state=bool(payload.get("light_state", False)),
    )


def get_current_device_controls(db=None) -> DeviceControlOut:
    db = db or get_db()

    try:
        snapshot = _controls_document(db).get()
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to load device controls.") from exc

    if not snapshot.exists:
        return DeviceControlOut()

    return _normalize_controls(snapshot.to_dict())


@router.post("/device-controls", response_model=DeviceControlOut)
def save_device_controls(payload: DeviceControlUpdate) -> DeviceControlOut:
    db = get_db()
    controls = _normalize_controls(payload.model_dump())

    try:
        _controls_document(db).set(
            {
                **controls.model_dump(),
                "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
        )
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to save device controls.") from exc

    return controls

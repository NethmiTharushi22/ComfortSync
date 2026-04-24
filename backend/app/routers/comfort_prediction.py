from fastapi import APIRouter, HTTPException
from google.cloud.firestore_v1 import Query

from app.db import get_db
from app.services.comfort_model_service import predict_comfort_label

router = APIRouter()


@router.post("/predict")
def predict_comfort(payload: dict):
    try:
        temperature = float(payload.get("temperature"))
        humidity = float(payload.get("humidity"))
        light_lux = float(payload.get("light_lux"))
        dust_concentration = float(payload.get("dust_concentration"))
        air_percent = float(payload.get("air_percent"))
        mq135_raw = float(payload.get("mq135_raw"))

        fan_status = str(payload.get("fan_status", "OFF"))
        light_status = str(payload.get("light_status", "OFF"))
        source_dataset = str(payload.get("source_dataset", "live_esp32"))

        label = predict_comfort_label(
            temperature=temperature,
            humidity=humidity,
            light_lux=light_lux,
            dust_concentration=dust_concentration,
            air_percent=air_percent,
            mq135_raw=mq135_raw,
            fan_status=fan_status,
            light_status=light_status,
            source_dataset=source_dataset,
        )

        return {
            "comfort_label": label,
            "inputs": {
                "temperature": temperature,
                "humidity": humidity,
                "light_lux": light_lux,
                "dust_concentration": dust_concentration,
                "air_percent": air_percent,
                "mq135_raw": mq135_raw,
                "fan_status": fan_status,
                "light_status": light_status,
                "source_dataset": source_dataset,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latest")
def predict_latest_comfort():
    try:
        db = get_db()

        # Change "sensor_readings" if your collection has a different name
        docs = (
            db.collection("sensor_data")
            .order_by("recorded_at", direction=Query.DESCENDING)
            .limit(1)
            .stream()
        )

        latest_doc = None
        for doc in docs:
            latest_doc = doc.to_dict()

        if not latest_doc:
            raise HTTPException(status_code=404, detail="No sensor readings found")

        temperature = float(latest_doc.get("temperature", 0))
        humidity = float(latest_doc.get("humidity", 0))
        light_lux = float(latest_doc.get("light_lux", 0))
        dust_concentration = float(latest_doc.get("dust_concentration", 0))
        air_percent = float(latest_doc.get("air_percent", 0))
        mq135_raw = float(latest_doc.get("mq135_raw", 0))

        fan_status = "ON" if temperature > 28 else "OFF"
        light_status = "ON" if light_lux < 300 else "OFF"

        label = predict_comfort_label(
            temperature=temperature,
            humidity=humidity,
            light_lux=light_lux,
            dust_concentration=dust_concentration,
            air_percent=air_percent,
            mq135_raw=mq135_raw,
            fan_status=fan_status,
            light_status=light_status,
            source_dataset="live_esp32",
        )

        return {
            "comfort_label": label,
            "inputs": {
                "temperature": temperature,
                "humidity": humidity,
                "light_lux": light_lux,
                "dust_concentration": dust_concentration,
                "air_percent": air_percent,
                "mq135_raw": mq135_raw,
                "fan_status": fan_status,
                "light_status": light_status,
                "source_dataset": "live_esp32",
            },
            "raw_document": latest_doc,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
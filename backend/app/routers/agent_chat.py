from fastapi import APIRouter, HTTPException

from app.services.agent_analytics import get_latest_reading, get_recent_readings, build_analytics_summary
from app.services.agent_llm_service import generate_agent_reply
from app.services.comfort_model_service import predict_comfort_label

router = APIRouter()


@router.post("/chat")
def agent_chat(payload: dict):
    try:
        message = str(payload.get("message", "")).strip()
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")

        latest = get_latest_reading("sensor_readings")
        if not latest:
            raise HTTPException(status_code=404, detail="No live sensor readings found")

        temperature = float(latest.get("temperature", 0))
        humidity = float(latest.get("humidity", 0))
        light_lux = float(latest.get("light_lux", 0))
        dust_concentration = float(latest.get("dust_concentration", 0))
        air_percent = float(latest.get("air_percent", 0))
        mq135_raw = float(latest.get("mq135_raw", 0))

        fan_status = "ON" if temperature > 28 else "OFF"
        light_status = "ON" if light_lux < 300 else "OFF"

        comfort_label = predict_comfort_label(
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

        recent = get_recent_readings(limit=10, collection_name="sensor_readings")
        analytics = build_analytics_summary(recent)

        reply = generate_agent_reply(
            user_message=message,
            latest_reading={
                "temperature": temperature,
                "humidity": humidity,
                "light_lux": light_lux,
                "dust_concentration": dust_concentration,
                "air_percent": air_percent,
                "mq135_raw": mq135_raw,
                "fan_status": fan_status,
                "light_status": light_status,
                "recorded_at": latest.get("recorded_at"),
            },
            comfort_label=comfort_label,
            analytics=analytics,
        )

        return {
            "reply": reply,
            "comfort_label": comfort_label,
            "analytics": analytics,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
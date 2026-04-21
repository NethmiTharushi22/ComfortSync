from statistics import mean
from google.cloud.firestore_v1 import Query

from app.db import get_db


def get_latest_reading(collection_name: str = "sensor_readings"):
    db = get_db()
    docs = (
        db.collection(collection_name)
        .order_by("recorded_at", direction=Query.DESCENDING)
        .limit(1)
        .stream()
    )

    latest_doc = None
    for doc in docs:
        latest_doc = doc.to_dict()

    return latest_doc


def get_recent_readings(limit: int = 10, collection_name: str = "sensor_readings"):
    db = get_db()
    docs = (
        db.collection(collection_name)
        .order_by("recorded_at", direction=Query.DESCENDING)
        .limit(limit)
        .stream()
    )

    readings = [doc.to_dict() for doc in docs]
    readings.reverse()
    return readings


def compute_trend(values):
    clean = [v for v in values if isinstance(v, (int, float))]
    if len(clean) < 2:
        return "stable"

    if clean[-1] > clean[0]:
        return "increasing"
    if clean[-1] < clean[0]:
        return "decreasing"
    return "stable"


def build_analytics_summary(readings):
    if not readings:
        return {
            "temperature_trend": "unknown",
            "humidity_trend": "unknown",
            "light_trend": "unknown",
            "dust_trend": "unknown",
            "air_trend": "unknown",
            "averages": {},
        }

    temps = [r.get("temperature") for r in readings]
    humidity = [r.get("humidity") for r in readings]
    light = [r.get("light_lux") for r in readings]
    dust = [r.get("dust_concentration") for r in readings]
    air = [r.get("air_percent") for r in readings]

    def safe_mean(series):
        clean = [v for v in series if isinstance(v, (int, float))]
        return round(mean(clean), 2) if clean else None

    return {
        "temperature_trend": compute_trend(temps),
        "humidity_trend": compute_trend(humidity),
        "light_trend": compute_trend(light),
        "dust_trend": compute_trend(dust),
        "air_trend": compute_trend(air),
        "averages": {
            "temperature": safe_mean(temps),
            "humidity": safe_mean(humidity),
            "light_lux": safe_mean(light),
            "dust_concentration": safe_mean(dust),
            "air_percent": safe_mean(air),
        },
    }
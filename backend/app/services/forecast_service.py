from statistics import mean
from sklearn.linear_model import LinearRegression
import numpy as np

from app.db import get_db
from google.cloud.firestore_v1 import Query


FORECAST_FIELDS = [
    "temperature",
    "humidity",
    "light_lux",
    "air_percent",
    "dust_concentration",
]


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


def compute_trend_from_slope(slope: float, threshold: float = 0.1) -> str:
    if slope > threshold:
        return "increasing"
    if slope < -threshold:
        return "decreasing"
    return "stable"


def forecast_next_value(values):
    clean = [v for v in values if isinstance(v, (int, float))]
    if len(clean) < 2:
        return {
            "current": clean[-1] if clean else None,
            "predicted_next": clean[-1] if clean else None,
            "trend": "stable",
            "slope": 0.0,
        }

    x = np.array(range(len(clean))).reshape(-1, 1)
    y = np.array(clean)

    model = LinearRegression()
    model.fit(x, y)

    next_x = np.array([[len(clean)]])
    predicted = float(model.predict(next_x)[0])
    slope = float(model.coef_[0])

    return {
        "current": float(clean[-1]),
        "predicted_next": round(predicted, 2),
        "trend": compute_trend_from_slope(slope),
        "slope": round(slope, 4),
    }


def build_forecast_summary(limit: int = 10, collection_name: str = "sensor_readings"):
    readings = get_recent_readings(limit=limit, collection_name=collection_name)

    if not readings:
        return {}

    result = {}
    for field in FORECAST_FIELDS:
        values = [r.get(field) for r in readings]
        result[field] = forecast_next_value(values)

    return result
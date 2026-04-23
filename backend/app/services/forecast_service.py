from statistics import mean
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from app.config import settings
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


# =========================================================
# YOUR ML-BASED 5-MIN FORECAST PART
# =========================================================

BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = BASE_DIR / "comfort_model_best.pkl"
FEATURES_PATH = BASE_DIR / "feature_columns.pkl"
SCALER_PATH = BASE_DIR / "feature_scaler.pkl"


def _get_latest_sensor_rows(limit: int = 220):
    db = get_db()

    docs = (
        db.collection(settings.sensor_collection)
        .order_by("recorded_at", direction=Query.DESCENDING)
        .limit(limit)
        .stream()
    )

    rows = [doc.to_dict() for doc in docs]
    rows.reverse()
    return rows


def _build_features(df: pd.DataFrame, feature_cols):
    df = df.copy()

    df["recorded_at"] = pd.to_datetime(df["recorded_at"], errors="coerce")
    df = df.dropna(subset=["recorded_at"]).sort_values("recorded_at").reset_index(drop=True)

    required_cols = [
        "temperature",
        "humidity",
        "mq135_raw",
        "dust_concentration",
        "light_lux",
    ]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns for ML prediction: {missing}")

    # Smooth noisy columns
    df["mq135_smooth"] = df["mq135_raw"].rolling(10, min_periods=1).mean()
    df["dust_smooth"] = df["dust_concentration"].rolling(10, min_periods=1).mean()

    # Temperature features
    df["temp_last"] = df["temperature"]
    df["temp_ma_1min"] = df["temperature"].rolling(12).mean()
    df["temp_ma_5min"] = df["temperature"].rolling(60).mean()
    df["temp_ma_15min"] = df["temperature"].rolling(180).mean()
    df["temp_std_5min"] = df["temperature"].rolling(60).std()
    df["temp_trend_1"] = df["temperature"].diff()
    df["temp_trend_12"] = df["temperature"].diff(12)

    # Humidity features
    df["hum_last"] = df["humidity"]
    df["hum_ma_1min"] = df["humidity"].rolling(12).mean()
    df["hum_ma_5min"] = df["humidity"].rolling(60).mean()
    df["hum_ma_15min"] = df["humidity"].rolling(180).mean()
    df["hum_std_5min"] = df["humidity"].rolling(60).std()
    df["hum_trend_1"] = df["humidity"].diff()
    df["hum_trend_12"] = df["humidity"].diff(12)

    # MQ135 features
    df["mq_last"] = df["mq135_smooth"]
    df["mq_ma_1min"] = df["mq135_smooth"].rolling(12).mean()
    df["mq_ma_5min"] = df["mq135_smooth"].rolling(60).mean()
    df["mq_std_5min"] = df["mq135_smooth"].rolling(60).std()
    df["mq_trend_12"] = df["mq135_smooth"].diff(12)

    # Dust features
    df["dust_last"] = df["dust_smooth"]
    df["dust_ma_1min"] = df["dust_smooth"].rolling(12).mean()
    df["dust_ma_5min"] = df["dust_smooth"].rolling(60).mean()
    df["dust_std_5min"] = df["dust_smooth"].rolling(60).std()
    df["dust_trend_12"] = df["dust_smooth"].diff(12)

    # Light features
    df["light_last"] = df["light_lux"]
    df["light_ma_1min"] = df["light_lux"].rolling(12).mean()
    df["light_ma_5min"] = df["light_lux"].rolling(60).mean()
    df["light_std_5min"] = df["light_lux"].rolling(60).std()
    df["light_trend_12"] = df["light_lux"].diff(12)

    # Time features
    df["hour"] = df["recorded_at"].dt.hour
    df["minute"] = df["recorded_at"].dt.minute
    df["second"] = df["recorded_at"].dt.second

    # Lag features
    df["temp_lag_1"] = df["temperature"].shift(1)
    df["temp_lag_12"] = df["temperature"].shift(12)
    df["temp_lag_60"] = df["temperature"].shift(60)

    df["hum_lag_1"] = df["humidity"].shift(1)
    df["hum_lag_12"] = df["humidity"].shift(12)
    df["hum_lag_60"] = df["humidity"].shift(60)

    df = df.dropna().reset_index(drop=True)

    if df.empty:
        raise ValueError("Not enough recent rows to build ML forecast features")

    return df[feature_cols].iloc[[-1]].copy()


def build_ml_forecast_summary(limit: int = 220) -> dict[str, Any]:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")
    if not FEATURES_PATH.exists():
        raise FileNotFoundError(f"Feature columns file not found: {FEATURES_PATH}")
    if not SCALER_PATH.exists():
        raise FileNotFoundError(f"Scaler file not found: {SCALER_PATH}")

    model = joblib.load(MODEL_PATH)
    feature_cols = joblib.load(FEATURES_PATH)
    scaler = joblib.load(SCALER_PATH)

    rows = _get_latest_sensor_rows(limit=limit)
    if not rows:
        return {}

    df = pd.DataFrame(rows)
    latest = df.sort_values("recorded_at").iloc[-1].to_dict()

    X = _build_features(df, feature_cols)
    X_scaled = scaler.transform(X)

    pred = model.predict(X_scaled)[0]

    return {
        "latest": {
            "temperature": latest.get("temperature"),
            "humidity": latest.get("humidity"),
            "mq135_raw": latest.get("mq135_raw"),
            "dust_concentration": latest.get("dust_concentration"),
            "light_lux": latest.get("light_lux"),
            "recorded_at": str(latest.get("recorded_at")),
        },
        "prediction_5min": {
            "temperature_5min": round(float(pred[0]), 2),
            "humidity_5min": round(float(pred[1]), 2),
            "mq135_5min": round(float(pred[2]), 2),
            "dust_5min": round(float(pred[3]), 2),
            "light_5min": round(float(pred[4]), 2),
        },
    }

from pathlib import Path
from datetime import datetime

import pandas as pd
from sklearn.ensemble import IsolationForest


FEATURES = [
    "temperature",
    "humidity",
    "air_percent",
    "dust_concentration",
    "mq135_raw",
    "light_lux",
]

TIME_FIELD = "recorded_at"


def get_csv_path(csv_file_name: str = "sensor_data_export.csv") -> Path:
    current_folder = Path(__file__).resolve().parent
    return current_folder / csv_file_name


def run_threshold_alerts(
    limit: int = 5000,
    csv_file_name: str = "sensor_data_export.csv"
):
    csv_path = get_csv_path(csv_file_name)

    if not csv_path.exists():
        raise ValueError(f"CSV file not found: {csv_path}")

    df = pd.read_csv(csv_path)

    if df.empty:
        raise ValueError("CSV file is empty.")

    required_columns = FEATURES + [TIME_FIELD]

    for col in required_columns:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}")

    work_df = df.copy()

    work_df[TIME_FIELD] = pd.to_datetime(work_df[TIME_FIELD], errors="coerce", utc=True)

    for col in FEATURES:
        work_df[col] = pd.to_numeric(work_df[col], errors="coerce")

    work_df = work_df.dropna(subset=required_columns)
    work_df = work_df.sort_values(TIME_FIELD)

    if limit and len(work_df) > limit:
        work_df = work_df.tail(limit)

    if len(work_df) < 20:
        raise ValueError("Not enough data for threshold alerts.")

    X = work_df[FEATURES]

    model = IsolationForest(
        n_estimators=100,
        contamination=0.05,
        random_state=42
    )

    model.fit(X)

    predictions = model.predict(X)

    # Convert to alert flag
    work_df["alert"] = [1 if p == -1 else 0 for p in predictions]

    alert_data = []

    for _, row in work_df.tail(200).iterrows():
        alert_data.append({
            "recorded_at": row[TIME_FIELD].isoformat(),
            "temperature": float(row["temperature"]),
            "humidity": float(row["humidity"]),
            "air_percent": float(row["air_percent"]),
            "dust_concentration": float(row["dust_concentration"]),
            "mq135_raw": float(row["mq135_raw"]),
            "light_lux": float(row["light_lux"]),
            "alert": int(row["alert"])
        })

    alert_count = work_df["alert"].sum()

    insight = (
        f"The threshold-based alert system uses a machine learning anomaly detection model "
        f"to identify abnormal environmental conditions. A total of {alert_count} alerts "
        f"were triggered based on unusual sensor patterns rather than fixed thresholds."
    )

    return {
        "analysis_type": "threshold_based_alerts",
        "model": "IsolationForest",
        "total_records": int(len(work_df)),
        "alert_count": int(alert_count),
        "features_used": FEATURES,
        "alert_data": alert_data,
        "insight": insight,
        "created_at": datetime.utcnow().isoformat()
    }
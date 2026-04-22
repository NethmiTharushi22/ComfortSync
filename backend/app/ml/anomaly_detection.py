from pathlib import Path
from datetime import datetime

import pandas as pd
from sklearn.ensemble import IsolationForest


TIME_FIELD = "recorded_at"

FEATURES = [
    "temperature",
    "humidity",
    "air_percent",
    "dust_concentration",
    "mq135_raw",
    "light_lux",
]


def get_csv_path(csv_file_name: str = "sensor_data_export.csv") -> Path:
    current_folder = Path(__file__).resolve().parent
    return current_folder / csv_file_name


def run_anomaly_detection(
    limit: int = 5000,
    csv_file_name: str = "sensor_data_export.csv"
):
    csv_path = get_csv_path(csv_file_name)

    if not csv_path.exists():
        raise ValueError(f"CSV file not found: {csv_path}")

    df = pd.read_csv(csv_path)

    if df.empty:
        raise ValueError("CSV file is empty.")

    if TIME_FIELD not in df.columns:
        raise ValueError(f"Missing time field: {TIME_FIELD}")

    df[TIME_FIELD] = pd.to_datetime(df[TIME_FIELD], errors="coerce", utc=True)

    df = df.dropna(subset=[TIME_FIELD])
    df = df.sort_values(TIME_FIELD)

    # Keep only needed features
    work_df = df.copy()

    for col in FEATURES:
        work_df[col] = pd.to_numeric(work_df[col], errors="coerce")

    work_df = work_df.dropna(subset=FEATURES)

    if limit and len(work_df) > limit:
        work_df = work_df.tail(limit)

    if len(work_df) < 20:
        raise ValueError("Not enough data for anomaly detection.")

    X = work_df[FEATURES]

    model = IsolationForest(
        n_estimators=100,
        contamination=0.05,  # 5% anomalies
        random_state=42
    )

    model.fit(X)

    predictions = model.predict(X)

    # Convert:
    #  1 → normal
    # -1 → anomaly
    work_df["anomaly"] = [1 if p == -1 else 0 for p in predictions]

    chart_data = []

    for _, row in work_df.tail(200).iterrows():
        chart_data.append({
            "recorded_at": row[TIME_FIELD].isoformat(),
            "temperature": float(row["temperature"]),
            "humidity": float(row["humidity"]),
            "air_percent": float(row["air_percent"]),
            "dust_concentration": float(row["dust_concentration"]),
            "mq135_raw": float(row["mq135_raw"]),
            "light_lux": float(row["light_lux"]),
            "anomaly": int(row["anomaly"])
        })

    anomaly_count = work_df["anomaly"].sum()

    insight = (
        f"The anomaly detection model identified {anomaly_count} unusual sensor readings. "
        f"These anomalies indicate abnormal environmental conditions such as sudden spikes "
        f"in dust concentration, gas levels, or unexpected temperature changes."
    )

    return {
        "analysis_type": "anomaly_detection",
        "model": "IsolationForest",
        "total_records": len(work_df),
        "anomaly_count": int(anomaly_count),
        "features_used": FEATURES,
        "insight": insight,
        "chart_data": chart_data,
        "created_at": datetime.utcnow().isoformat()
    }
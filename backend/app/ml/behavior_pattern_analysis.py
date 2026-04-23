from pathlib import Path
from datetime import datetime

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


FEATURE_COLUMNS = [
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


def run_behavior_pattern_analysis(
    n_clusters: int = 4,
    limit: int = 5000,
    csv_file_name: str = "sensor_data_export.csv",
):
    if n_clusters < 2:
        raise ValueError("n_clusters must be at least 2.")

    csv_path = get_csv_path(csv_file_name)

    if not csv_path.exists():
        raise ValueError(f"CSV file not found: {csv_path}")

    df = pd.read_csv(csv_path)

    if df.empty:
        raise ValueError("CSV file is empty.")

    required_columns = FEATURE_COLUMNS + [TIME_FIELD]

    for col in required_columns:
        if col not in df.columns:
            raise ValueError(f"Missing required column in CSV: {col}")

    work_df = df.copy()

    work_df[TIME_FIELD] = pd.to_datetime(work_df[TIME_FIELD], errors="coerce", utc=True)

    for col in FEATURE_COLUMNS:
        work_df[col] = pd.to_numeric(work_df[col], errors="coerce")

    work_df = work_df.dropna(subset=required_columns)
    work_df = work_df.sort_values(TIME_FIELD)

    if limit and len(work_df) > limit:
        work_df = work_df.tail(limit)

    if len(work_df) < n_clusters * 5:
        raise ValueError("Not enough valid records for clustering analysis.")

    X = work_df[FEATURE_COLUMNS]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = KMeans(
        n_clusters=n_clusters,
        random_state=42,
        n_init=10
    )

    cluster_labels = model.fit_predict(X_scaled)
    work_df["cluster"] = cluster_labels

    cluster_summary = (
        work_df.groupby("cluster")[FEATURE_COLUMNS]
        .mean()
        .round(2)
        .reset_index()
    )

    cluster_counts = (
        work_df["cluster"]
        .value_counts()
        .sort_index()
        .to_dict()
    )

    cluster_summary_data = []
    for _, row in cluster_summary.iterrows():
        cluster_summary_data.append({
            "cluster": int(row["cluster"]),
            "temperature": float(row["temperature"]),
            "humidity": float(row["humidity"]),
            "air_percent": float(row["air_percent"]),
            "dust_concentration": float(row["dust_concentration"]),
            "mq135_raw": float(row["mq135_raw"]),
            "light_lux": float(row["light_lux"]),
            "count": int(cluster_counts.get(int(row["cluster"]), 0))
        })

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
            "cluster": int(row["cluster"]),
        })

    largest_cluster = max(cluster_counts, key=cluster_counts.get)

    insight = (
        f"The K-Means clustering model grouped the sensor readings into {n_clusters} "
        f"behavior patterns. The largest pattern was cluster {largest_cluster}, which "
        f"represents the most common environmental condition observed in the Comfort System."
    )

    return {
        "analysis_type": "behavior_pattern_analysis",
        "model": "KMeans",
        "n_clusters": n_clusters,
        "features_used": FEATURE_COLUMNS,
        "total_records": int(len(work_df)),
        "cluster_counts": {str(k): int(v) for k, v in cluster_counts.items()},
        "cluster_summary": cluster_summary_data,
        "chart_data": chart_data,
        "insight": insight,
        "created_at": datetime.utcnow().isoformat(),
    }
from pathlib import Path
from datetime import datetime

import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score


TIME_FIELD = "recorded_at"

DEFAULT_TARGET_FIELDS = [
    "temperature",
    "humidity",
    "air_percent",
    "mq135_raw",
    "light_lux",
]


def get_csv_path(csv_file_name: str = "sensor_data_export.csv") -> Path:
    
    current_folder = Path(__file__).resolve().parent
    return current_folder / csv_file_name


def train_model_for_single_target(df: pd.DataFrame, target_field: str):
    

    if target_field not in df.columns:
        return {
            "target_field": target_field,
            "success": False,
            "error": f"Missing target field in CSV data: {target_field}"
        }

    work_df = df.copy()

    work_df[target_field] = pd.to_numeric(work_df[target_field], errors="coerce")
    work_df = work_df.dropna(subset=[TIME_FIELD, target_field])
    work_df = work_df.sort_values(TIME_FIELD)

    if len(work_df) < 20:
        return {
            "target_field": target_field,
            "success": False,
            "error": "Not enough valid records for temporal trend analysis. Need at least 20 records."
        }

    # Time-based ML features
    work_df["hour"] = work_df[TIME_FIELD].dt.hour
    work_df["minute"] = work_df[TIME_FIELD].dt.minute
    work_df["day"] = work_df[TIME_FIELD].dt.day
    work_df["day_of_week"] = work_df[TIME_FIELD].dt.dayofweek
    work_df["time_index"] = range(len(work_df))

    features = [
        "time_index",
        "hour",
        "minute",
        "day",
        "day_of_week",
    ]

    X = work_df[features]
    y = work_df[target_field]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        shuffle=False
    )

    model = RandomForestRegressor(
        n_estimators=100,
        random_state=42
    )

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    test_df = work_df.iloc[len(X_train):].copy()
    test_df["actual"] = y_test.values
    test_df["predicted"] = y_pred

    # Only send last 100 points to frontend
    chart_df = test_df.tail(100)

    chart_data = []

    for _, row in chart_df.iterrows():
        chart_data.append({
            "recorded_at": row[TIME_FIELD].isoformat(),
            "actual": round(float(row["actual"]), 2),
            "predicted": round(float(row["predicted"]), 2)
        })

    insight = (
        f"The temporal trend model predicted {target_field} using time-based "
        f"features from recorded_at. The Mean Absolute Error is "
        f"{round(float(mae), 2)}, meaning predictions are off by about "
        f"{round(float(mae), 2)} units on average."
    )

    return {
        "target_field": target_field,
        "success": True,
        "model": "RandomForestRegressor",
        "total_records": len(work_df),
        "training_records": len(X_train),
        "testing_records": len(X_test),
        "mean_absolute_error": round(float(mae), 3),
        "r2_score": round(float(r2), 3),
        "insight": insight,
        "chart_data": chart_data
    }


def run_temporal_trend_analysis(
    target_fields=None,
    limit: int = 5000,
    csv_file_name: str = "sensor_data_export.csv"
):
    """
    Runs temporal trend analysis using local CSV data instead of Firestore.
    """

    if target_fields is None:
        target_fields = DEFAULT_TARGET_FIELDS

    csv_path = get_csv_path(csv_file_name)

    if not csv_path.exists():
        raise ValueError(f"CSV file not found: {csv_path}")

    df = pd.read_csv(csv_path)

    if df.empty:
        raise ValueError("CSV file is empty.")

    if TIME_FIELD not in df.columns:
        raise ValueError(f"Missing required time field in CSV: {TIME_FIELD}")

    # Convert recorded_at to datetime
    df[TIME_FIELD] = pd.to_datetime(df[TIME_FIELD], errors="coerce", utc=True)

    # Remove invalid timestamps
    df = df.dropna(subset=[TIME_FIELD])

    # Sort by time
    df = df.sort_values(TIME_FIELD)

    # Limit rows if needed
    if limit and len(df) > limit:
        df = df.tail(limit)

    if len(df) < 20:
        raise ValueError("Not enough valid timestamp records for temporal trend analysis.")

    results = []

    for target_field in target_fields:
        result = train_model_for_single_target(df, target_field)
        results.append(result)

    successful_results = [
        result for result in results
        if result.get("success") is True
    ]

    failed_results = [
        result for result in results
        if result.get("success") is False
    ]

    summary = {
        "analysis_type": "temporal_trend_analysis",
        "data_source": "local_csv",
        "csv_file": str(csv_path),
        "time_field": TIME_FIELD,
        "target_fields": target_fields,
        "successful_targets": len(successful_results),
        "failed_targets": len(failed_results),
        "results": results,
        "created_at": datetime.utcnow().isoformat()
    }

    return summary
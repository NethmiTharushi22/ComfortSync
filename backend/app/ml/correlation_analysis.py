from pathlib import Path
from datetime import datetime

import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score


ALL_FIELDS = [
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


def run_single_feature_importance_model(df: pd.DataFrame, target_field: str):
    if target_field not in df.columns:
        return {
            "target_field": target_field,
            "success": False,
            "error": f"Missing target field in CSV: {target_field}"
        }

    features = [col for col in ALL_FIELDS if col != target_field]

    if not features:
        return {
            "target_field": target_field,
            "success": False,
            "error": "No feature columns available."
        }

    required_columns = features + [target_field]

    work_df = df.copy()

    for col in required_columns:
        work_df[col] = pd.to_numeric(work_df[col], errors="coerce")

    work_df = work_df.dropna(subset=required_columns)

    if len(work_df) < 20:
        return {
            "target_field": target_field,
            "success": False,
            "error": "Not enough valid records for analysis."
        }

    X = work_df[features]
    y = work_df[target_field]

    split_index = int(len(work_df) * 0.8)

    X_train = X.iloc[:split_index]
    X_test = X.iloc[split_index:]
    y_train = y.iloc[:split_index]
    y_test = y.iloc[split_index:]

    if len(X_train) < 10 or len(X_test) < 5:
        return {
            "target_field": target_field,
            "success": False,
            "error": "Not enough records after train/test split."
        }

    model = RandomForestRegressor(
        n_estimators=200,
        random_state=42
    )

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    importance_data = []
    for feature_name, importance in zip(features, model.feature_importances_):
        importance_data.append({
            "feature": feature_name,
            "importance": round(float(importance), 4)
        })

    importance_data = sorted(
        importance_data,
        key=lambda item: item["importance"],
        reverse=True
    )

    top_feature = importance_data[0]["feature"] if importance_data else "unknown"

    prediction_chart_data = []
    for idx in range(len(y_test)):
        prediction_chart_data.append({
            "actual": round(float(y_test.iloc[idx]), 2),
            "predicted": round(float(y_pred[idx]), 2)
        })

    insight = (
        f"The Random Forest model was trained to predict {target_field} using the other "
        f"sensor readings. The most influential feature for {target_field} was {top_feature}."
    )

    return {
        "target_field": target_field,
        "success": True,
        "model": "RandomForestRegressor",
        "features_used": features,
        "total_records": int(len(work_df)),
        "training_records": int(len(X_train)),
        "testing_records": int(len(X_test)),
        "mean_absolute_error": round(float(mae), 3),
        "r2_score": round(float(r2), 3),
        "feature_importance": importance_data,
        "prediction_chart_data": prediction_chart_data[:100],
        "insight": insight
    }


def run_correlation_analysis(
    target_fields=None,
    limit: int = 5000,
    csv_file_name: str = "sensor_data_export.csv",
):
    csv_path = get_csv_path(csv_file_name)

    if not csv_path.exists():
        raise ValueError(f"CSV file not found: {csv_path}")

    df = pd.read_csv(csv_path)

    if df.empty:
        raise ValueError("CSV file is empty.")

    for col in ALL_FIELDS:
        if col not in df.columns:
            raise ValueError(f"Missing required column in CSV: {col}")

    if limit and len(df) > limit:
        df = df.tail(limit)

    if target_fields is None:
        raise ValueError("target_fields is required.")

    results = []

    for target_field in target_fields:
        result = run_single_feature_importance_model(df, target_field)
        results.append(result)

    successful_results = [
        result for result in results
        if result.get("success") is True
    ]

    failed_results = [
        result for result in results
        if result.get("success") is False
    ]

    return {
        "analysis_type": "correlation_feature_importance",
        "model": "RandomForestRegressor",
        "data_source": "local_csv",
        "csv_file": str(csv_path),
        "target_fields": target_fields,
        "successful_targets": len(successful_results),
        "failed_targets": len(failed_results),
        "results": results,
        "created_at": datetime.utcnow().isoformat()
    }
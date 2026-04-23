from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.preprocessing import MinMaxScaler
import joblib

# XGBoost
from xgboost import XGBRegressor

# =========================
# PATHS
# =========================
BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "dataset" / "indoorenvdata.csv"

MODEL_DIR = Path(__file__).resolve().parent

RF_MODEL_PATH = MODEL_DIR / "comfort_model_rf.pkl"
XGB_MODEL_PATH = MODEL_DIR / "comfort_model_xgb.pkl"
BEST_MODEL_PATH = MODEL_DIR / "comfort_model_best.pkl"

FEATURES_PATH = MODEL_DIR / "feature_columns.pkl"
SCALER_PATH = MODEL_DIR / "feature_scaler.pkl"
BEST_MODEL_INFO_PATH = MODEL_DIR / "best_model_info.pkl"

# =========================
# LOAD DATA
# =========================
df = pd.read_csv(DATA_PATH)
print("Loaded dataset from:", DATA_PATH)
print(df.head())
print(f"\nTotal raw rows loaded: {len(df)}")

# =========================
# TIMESTAMP CLEANING
# =========================
df["recorded_at"] = pd.to_datetime(df["recorded_at"], errors="coerce")

before_drop_timestamp = len(df)
df = df.dropna(subset=["recorded_at"])
after_drop_timestamp = len(df)

print(f"Rows before dropping invalid timestamps: {before_drop_timestamp}")
print(f"Rows after dropping invalid timestamps:  {after_drop_timestamp}")
print(f"Timestamp rows removed:                  {before_drop_timestamp - after_drop_timestamp}")

df = df.sort_values("recorded_at").reset_index(drop=True)

# =========================
# KEEP ONLY NEEDED COLUMNS
# =========================
base_sensor_cols = [
    "temperature",
    "humidity",
    "mq135_raw",
    "dust_concentration",
    "light_lux",
]

df = df[base_sensor_cols + ["recorded_at"]].copy()
print(f"\nRows after selecting columns: {len(df)}")

# =========================
# SMOOTH NOISY COLUMNS
# =========================
df["mq135_smooth"] = df["mq135_raw"].rolling(window=10, min_periods=1).mean()
df["dust_smooth"] = df["dust_concentration"].rolling(window=10, min_periods=1).mean()

# =========================
# FEATURE ENGINEERING
# =========================
# 5 sec interval assumed:
# 12 rows = 1 min
# 60 rows = 5 min
# 180 rows = 15 min

df["temp_last"] = df["temperature"]
df["temp_ma_1min"] = df["temperature"].rolling(12, min_periods=12).mean()
df["temp_ma_5min"] = df["temperature"].rolling(60, min_periods=60).mean()
df["temp_ma_15min"] = df["temperature"].rolling(180, min_periods=180).mean()
df["temp_std_5min"] = df["temperature"].rolling(60, min_periods=60).std()
df["temp_trend_1"] = df["temperature"].diff()
df["temp_trend_12"] = df["temperature"].diff(12)

df["hum_last"] = df["humidity"]
df["hum_ma_1min"] = df["humidity"].rolling(12, min_periods=12).mean()
df["hum_ma_5min"] = df["humidity"].rolling(60, min_periods=60).mean()
df["hum_ma_15min"] = df["humidity"].rolling(180, min_periods=180).mean()
df["hum_std_5min"] = df["humidity"].rolling(60, min_periods=60).std()
df["hum_trend_1"] = df["humidity"].diff()
df["hum_trend_12"] = df["humidity"].diff(12)

df["mq_last"] = df["mq135_smooth"]
df["mq_ma_1min"] = df["mq135_smooth"].rolling(12, min_periods=12).mean()
df["mq_ma_5min"] = df["mq135_smooth"].rolling(60, min_periods=60).mean()
df["mq_std_5min"] = df["mq135_smooth"].rolling(60, min_periods=60).std()
df["mq_trend_12"] = df["mq135_smooth"].diff(12)

df["dust_last"] = df["dust_smooth"]
df["dust_ma_1min"] = df["dust_smooth"].rolling(12, min_periods=12).mean()
df["dust_ma_5min"] = df["dust_smooth"].rolling(60, min_periods=60).mean()
df["dust_std_5min"] = df["dust_smooth"].rolling(60, min_periods=60).std()
df["dust_trend_12"] = df["dust_smooth"].diff(12)

df["light_last"] = df["light_lux"]
df["light_ma_1min"] = df["light_lux"].rolling(12, min_periods=12).mean()
df["light_ma_5min"] = df["light_lux"].rolling(60, min_periods=60).mean()
df["light_std_5min"] = df["light_lux"].rolling(60, min_periods=60).std()
df["light_trend_12"] = df["light_lux"].diff(12)

# Time-based features
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

before_drop_rolling = len(df)
df = df.dropna().reset_index(drop=True)
after_drop_rolling = len(df)

print(f"\nRows before dropping rolling NaNs: {before_drop_rolling}")
print(f"Rows after dropping rolling NaNs:  {after_drop_rolling}")
print(f"Rows removed by rolling features:  {before_drop_rolling - after_drop_rolling}")

# =========================
# CREATE FUTURE TARGETS (5 MIN )
# =========================

# 5 min = 60 rows

df["temp_5min"] = df["temperature"].shift(-60)
df["hum_5min"] = df["humidity"].shift(-60)
df["mq_5min"] = df["mq135_raw"].shift(-60)
df["dust_5min"] = df["dust_concentration"].shift(-60)
df["light_5min"] = df["light_lux"].shift(-60)

before_drop_targets = len(df)
df = df.dropna().reset_index(drop=True)
after_drop_targets = len(df)

print(f"\nRows before dropping target NaNs: {before_drop_targets}")
print(f"Rows after dropping target NaNs:  {after_drop_targets}")
print(f"Rows removed by future shifts:    {before_drop_targets - after_drop_targets}")

# =========================
# DEFINE FEATURES AND TARGETS
# =========================
feature_cols = [
    "temp_last", "temp_ma_1min", "temp_ma_5min", "temp_ma_15min", "temp_std_5min", "temp_trend_1", "temp_trend_12",
    "hum_last", "hum_ma_1min", "hum_ma_5min", "hum_ma_15min", "hum_std_5min", "hum_trend_1", "hum_trend_12",
    "mq_last", "mq_ma_1min", "mq_ma_5min", "mq_std_5min", "mq_trend_12",
    "dust_last", "dust_ma_1min", "dust_ma_5min", "dust_std_5min", "dust_trend_12",
    "light_last", "light_ma_1min", "light_ma_5min", "light_std_5min", "light_trend_12",
    "hour", "minute", "second",
    "temp_lag_1", "temp_lag_12", "temp_lag_60",
    "hum_lag_1", "hum_lag_12", "hum_lag_60",
]

target_cols = [
    "temp_5min",
    "hum_5min",
    "mq_5min",
    "dust_5min",
    "light_5min",
]

X = df[feature_cols].copy()
y = df[target_cols].copy()

print(f"\nFinal usable rows for modeling: {len(X)}")
print(f"Feature columns count:          {X.shape[1]}")
print(f"Target columns count:           {y.shape[1]}")

# =========================
# TRAIN / TEST SPLIT
# =========================
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, shuffle=False
)

print("\nTrain-test split summary:")
print(f"X_train rows: {len(X_train)}")
print(f"X_test rows:  {len(X_test)}")
print(f"y_train rows: {len(y_train)}")
print(f"y_test rows:  {len(y_test)}")
print(f"Training %:   {len(X_train) / len(X) * 100:.2f}%")
print(f"Testing %:    {len(X_test) / len(X) * 100:.2f}%")

# =========================
# NORMALIZE FEATURES
# =========================
scaler = MinMaxScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# =========================
# DEFINE MODELS
# =========================
rf_model = MultiOutputRegressor(
    RandomForestRegressor(
        n_estimators=200,
        max_depth=12,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
)

xgb_model = MultiOutputRegressor(
    XGBRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
        objective="reg:squarederror"
    )
)

# =========================
# TRAIN + EVALUATE FUNCTION
# =========================
def evaluate_model(model, model_name, X_train_data, X_test_data, y_train_data, y_test_data, target_names):
    print(f"\n{'=' * 50}")
    print(f"Training {model_name}")
    print(f"{'=' * 50}")

    model.fit(X_train_data, y_train_data)
    y_pred_local = model.predict(X_test_data)

    overall_mae_local = mean_absolute_error(y_test_data, y_pred_local)
    overall_r2_local = r2_score(y_test_data, y_pred_local)

    print(f"\n{model_name} Overall Evaluation:")
    print("Overall MAE:", overall_mae_local)
    print("Overall R2 :", overall_r2_local)

    per_target_results = {}
    print(f"\n{model_name} Per-target evaluation:")
    for i, col in enumerate(target_names):
        col_mae = mean_absolute_error(y_test_data.iloc[:, i], y_pred_local[:, i])
        col_r2 = r2_score(y_test_data.iloc[:, i], y_pred_local[:, i])
        per_target_results[col] = {"MAE": col_mae, "R2": col_r2}
        print(f"{col:10s} -> MAE: {col_mae:.4f} | R2: {col_r2:.4f}")

    return model, y_pred_local, overall_mae_local, overall_r2_local, per_target_results

# =========================
# TRAIN BOTH MODELS
# =========================
rf_model, rf_pred, rf_mae, rf_r2, rf_per_target = evaluate_model(
    rf_model, "Random Forest", X_train_scaled, X_test_scaled, y_train, y_test, target_cols
)

xgb_model, xgb_pred, xgb_mae, xgb_r2, xgb_per_target = evaluate_model(
    xgb_model, "XGBoost", X_train_scaled, X_test_scaled, y_train, y_test, target_cols
)

# =========================
# NAIVE BASELINE
# =========================
print("\nNaive baseline evaluation:")

naive_preds = np.column_stack([
    X_test["temp_last"].values,
    X_test["hum_last"].values,
    X_test["mq_last"].values,
    X_test["dust_last"].values,
    X_test["light_last"].values,
])

for i, col in enumerate(target_cols):
    col_mae = mean_absolute_error(y_test.iloc[:, i], naive_preds[:, i])
    col_r2 = r2_score(y_test.iloc[:, i], naive_preds[:, i])
    print(f"{col:10s} -> MAE: {col_mae:.4f} | R2: {col_r2:.4f}")

# =========================
# SAVE BOTH MODELS
# =========================
joblib.dump(rf_model, RF_MODEL_PATH)
joblib.dump(xgb_model, XGB_MODEL_PATH)
joblib.dump(feature_cols, FEATURES_PATH)
joblib.dump(scaler, SCALER_PATH)

print(f"\nRandom Forest model saved to: {RF_MODEL_PATH}")
print(f"XGBoost model saved to:       {XGB_MODEL_PATH}")
print(f"Feature columns saved to:     {FEATURES_PATH}")
print(f"Scaler saved to:              {SCALER_PATH}")

# =========================
# CHOOSE AND SAVE BEST MODEL
# =========================
# Lower MAE is better
if xgb_mae < rf_mae:
    best_model = xgb_model
    best_model_name = "XGBoost"
    best_model_mae = xgb_mae
    best_model_r2 = xgb_r2
else:
    best_model = rf_model
    best_model_name = "Random Forest"
    best_model_mae = rf_mae
    best_model_r2 = rf_r2

joblib.dump(best_model, BEST_MODEL_PATH)

best_model_info = {
    "best_model_name": best_model_name,
    "best_model_mae": best_model_mae,
    "best_model_r2": best_model_r2,
    "target_cols": target_cols,
    "feature_cols": feature_cols,
}

joblib.dump(best_model_info, BEST_MODEL_INFO_PATH)

print(f"\nBest model selected: {best_model_name}")
print(f"Best model MAE:      {best_model_mae}")
print(f"Best model R2:       {best_model_r2}")
print(f"Best model saved to: {BEST_MODEL_PATH}")
print(f"Best model info to:  {BEST_MODEL_INFO_PATH}")
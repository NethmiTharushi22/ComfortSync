from pathlib import Path
import joblib
import pandas as pd

MODEL = None
LABEL_ENCODER = None


def load_comfort_artifacts():
    global MODEL, LABEL_ENCODER

    if MODEL is None or LABEL_ENCODER is None:
        base = Path("app/ml")
        MODEL = joblib.load(base / "comfortsync_project_model.joblib")
        LABEL_ENCODER = joblib.load(base / "label_encoder.joblib")


def predict_comfort_label(
    temperature: float,
    humidity: float,
    light_lux: float,
    dust_concentration: float,
    air_percent: float,
    mq135_raw: float,
    fan_status: str,
    light_status: str,
    source_dataset: str = "live_esp32",
):
    load_comfort_artifacts()

    row = pd.DataFrame([{
        "temperature": temperature,
        "humidity": humidity,
        "light_lux": light_lux,
        "dust_concentration": dust_concentration,
        "air_percent": air_percent,
        "mq135_raw": mq135_raw,
        "fan_status": fan_status,
        "light_status": light_status,
        "source_dataset": source_dataset,
    }])

    pred = MODEL.predict(row)[0]
    label = LABEL_ENCODER.inverse_transform([pred])[0]
    return label
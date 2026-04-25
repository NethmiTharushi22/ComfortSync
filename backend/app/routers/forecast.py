from fastapi import APIRouter, HTTPException
from app.services.forecast_service import (
    build_forecast_summary,
    build_ml_forecast_summary,
)

router = APIRouter()


@router.get("/latest")
def get_latest_forecast():
    try:
        forecast = build_forecast_summary(limit=10, collection_name="sensor_data")

        if not forecast:
            raise HTTPException(status_code=404, detail="No readings available for forecasting")

        return {
            "forecast": forecast
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/next-5min")
def get_ml_forecast():
    try:
        forecast = build_ml_forecast_summary(limit=220)

        if not forecast:
            raise HTTPException(status_code=404, detail="No ML forecast available")

        return {
            "forecast": forecast
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
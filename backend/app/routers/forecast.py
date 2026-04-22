from fastapi import APIRouter, HTTPException
from app.services.forecast_service import build_forecast_summary

router = APIRouter()


@router.get("/latest")
def get_latest_forecast():
    try:
        forecast = build_forecast_summary(limit=10, collection_name="sensor_readings")

        if not forecast:
            raise HTTPException(status_code=404, detail="No readings available for forecasting")

        return {
            "forecast": forecast
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
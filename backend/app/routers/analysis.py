from fastapi import APIRouter, HTTPException, Query

from app.ml.temporal_trend import run_temporal_trend_analysis
from app.ml.anomaly_detection import run_anomaly_detection
from app.ml.correlation_analysis import run_correlation_analysis
from app.ml.behavior_pattern_analysis import run_behavior_pattern_analysis
from app.ml.threshold_alerts import run_threshold_alerts

router = APIRouter(
    prefix="/analysis",
    tags=["ML Analysis"]
)



@router.get("/temporal-trend")
def temporal_trend_analysis(
    target_fields: str = Query(
        "temperature,humidity,air_percent,mq135_raw,light_lux"
    ),
    limit: int = Query(5000),
    csv_file_name: str = Query("sensor_data_export.csv")
):
    try:
        fields = [
            field.strip()
            for field in target_fields.split(",")
            if field.strip()
        ]

        result = run_temporal_trend_analysis(
            target_fields=fields,
            limit=limit,
            csv_file_name=csv_file_name
        )

        return {
            "success": True,
            "data": result
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.get("/anomaly-detection")
def anomaly_detection(
    limit: int = Query(5000),
    csv_file_name: str = Query("sensor_data_export.csv")
):
    try:
        result = run_anomaly_detection(
            limit=limit,
            csv_file_name=csv_file_name
        )

        return {
            "success": True,
            "data": result
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.get("/correlation-analysis")
def correlation_analysis(
    target_field: str = Query("air_percent"),
    limit: int = Query(5000),
    csv_file_name: str = Query("sensor_data_export.csv")
):
    try:
        result = run_correlation_analysis(
            target_fields=[target_field],
            limit=limit,
            csv_file_name=csv_file_name
        )

        return {
            "success": True,
            "data": result
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.get("/behavior-pattern-analysis")
def behavior_pattern_analysis(
    n_clusters: int = Query(4),
    limit: int = Query(5000),
    csv_file_name: str = Query("sensor_data_export.csv")
):
    try:
        result = run_behavior_pattern_analysis(
            n_clusters=n_clusters,
            limit=limit,
            csv_file_name=csv_file_name
        )

        return {
            "success": True,
            "data": result
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.get("/threshold-alerts")
def threshold_alerts(
    limit: int = Query(5000),
    csv_file_name: str = Query("sensor_data_export.csv")
):
    try:
        result = run_threshold_alerts(
            limit=limit,
            csv_file_name=csv_file_name
        )

        return {
            "success": True,
            "data": result
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
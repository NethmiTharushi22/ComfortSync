from fastapi import APIRouter, HTTPException, Query

from app.ml.temporal_trend import run_temporal_trend_analysis

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
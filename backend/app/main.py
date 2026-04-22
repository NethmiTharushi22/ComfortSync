from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.auth import router as auth_router
from app.routers.chat_histories import router as chat_histories_router
from app.routers.device_controls import router as device_controls_router
from app.routers.sensors import router as sensors_router
from app.routers.comfort_prediction import router as comfort_prediction_router
from app.routers.agent_chat import router as agent_chat_router
from app.routers.forecast import router as forecast_router

app = FastAPI(title="ComfortSync API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "ComfortSync API is running"}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(sensors_router, prefix="/api/sensors", tags=["sensors"])
app.include_router(device_controls_router, prefix="/api", tags=["device-controls"])
app.include_router(chat_histories_router, prefix="/api", tags=["chat-histories"])
app.include_router(comfort_prediction_router, prefix="/api/comfort", tags=["comfort"])
app.include_router(agent_chat_router, prefix="/api/agent", tags=["agent"])
app.include_router(forecast_router, prefix="/api/forecast", tags=["forecast"])
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.chat_histories import router as chat_histories_router
from app.routers.device_controls import router as device_controls_router
from app.routers.sensors import router as sensors_router

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


app.include_router(sensors_router, prefix="/api/sensors", tags=["sensors"])
app.include_router(device_controls_router, prefix="/api", tags=["device-controls"])
app.include_router(chat_histories_router, prefix="/api", tags=["chat-histories"])

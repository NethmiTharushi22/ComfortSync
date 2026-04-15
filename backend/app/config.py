from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ComfortSync API"
    debug: str | bool = True
    sensor_collection: str = "sensor_readings"
    device_controls_collection: str = "device_controls"
    device_controls_document_id: str = "current"
    chat_history_collection: str = "chat_histories"
    firebase_credentials_path: str | None = None
    firebase_project_id: str | None = None
    firebase_client_email: str | None = None
    firebase_private_key: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

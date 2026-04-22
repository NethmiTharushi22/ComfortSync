from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ComfortSync API"
    debug: str | bool = True
    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    remember_me_expire_minutes: int = 60 * 24 * 30
    sensor_collection: str = "sensor_readings"
    device_controls_collection: str = "device_controls"
    device_controls_document_id: str = "current"
    chat_history_collection: str = "chat_histories"
    firebase_credentials_path: str | None = None
    firebase_project_id: str | None = None
    firebase_client_email: str | None = None
    firebase_private_key: str | None = None
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: EmailStr
    username: str
    phone: str | None = None
    avatar_url: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class SensorReadingOut(BaseModel):
    id: str
    temperature: float | None = None
    humidity: float | None = None
    gas: float | None = None
    air_percent: float | None = None
    dust: float | None = None
    light: float | None = None
    recorded_at: str | None = None


class DeviceControlsBase(BaseModel):
    mode: str = "AUTO"
    fan_state: bool = False
    light_state: bool = False


class DeviceControlUpdate(DeviceControlsBase):
    pass


class DeviceControlOut(DeviceControlsBase):
    model_config = ConfigDict(from_attributes=True)


class DashboardAlertOut(BaseModel):
    title: str
    detail: str
    tone: str


class DeviceStatusOut(BaseModel):
    label: str
    description: str


class DashboardSnapshotOut(BaseModel):
    current: SensorReadingOut
    alerts: list[DashboardAlertOut]
    devices: list[DeviceStatusOut]
    recent_readings: list[SensorReadingOut]
    controls: DeviceControlOut
    status: str


class ChatMessageCreate(BaseModel):
    user_email: EmailStr
    role: Literal["user", "assistant"] = "user"
    content: str = Field(min_length=1, max_length=4000)


class ChatMessageOut(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: str


class ChatHistoryCreate(BaseModel):
    user_email: EmailStr
    title: str | None = Field(default=None, max_length=120)


class ChatHistoryUpdate(BaseModel):
    user_email: EmailStr
    title: str = Field(min_length=1, max_length=120)


class ChatHistoryListItemOut(BaseModel):
    id: str
    user_email: EmailStr
    title: str
    preview: str
    created_at: str
    updated_at: str
    last_message_at: str | None = None
    message_count: int = 0


class ChatHistoryOut(ChatHistoryListItemOut):
    messages: list[ChatMessageOut]

from pydantic import BaseModel, ConfigDict, EmailStr


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
    dust: float | None = None
    light: float | None = None
    recorded_at: str | None = None


class DashboardAlertOut(BaseModel):
    title: str
    detail: str
    tone: str


class DeviceStatusOut(BaseModel):
    label: str
    description: str
    state: str
    tone: str


class DashboardSnapshotOut(BaseModel):
    current: SensorReadingOut
    alerts: list[DashboardAlertOut]
    devices: list[DeviceStatusOut]
    recent_readings: list[SensorReadingOut]
    status: str

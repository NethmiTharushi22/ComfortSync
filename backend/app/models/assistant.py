from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


class AssistantChatRequest(BaseModel):
    user_email: EmailStr
    message: str = Field(min_length=1, max_length=4000)
    history_id: str | None = None


class AssistantInsight(BaseModel):
    comfort_score: int
    comfort_label: Literal["Comfortable", "Moderate", "Uncomfortable", "Hazardous", "Unavailable"]
    priority_issue: str
    latest_updated: str | None = None
    recommendations: list[str] = []
    status: str = "unknown"
    metrics: dict[str, Any] = {}


class AssistantChatResponse(BaseModel):
    reply: str
    insight: AssistantInsight

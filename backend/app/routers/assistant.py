from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.db import get_db
from app.models.assistant import AssistantChatRequest, AssistantChatResponse, AssistantInsight
from app.models.schemas import ChatMessageCreate, ChatHistoryOut, DashboardSnapshotOut
from app.routers.chat_histories import append_chat_message, create_chat_history
from app.routers.sensors import get_dashboard_snapshot
from app.services.assistant_service import build_assistant_reply

router = APIRouter()


@router.post("/chat", response_model=AssistantChatResponse)
def assistant_chat(payload: AssistantChatRequest) -> AssistantChatResponse:
    try:
        snapshot_model: DashboardSnapshotOut = get_dashboard_snapshot()
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to load dashboard context for the assistant.") from exc

    snapshot = snapshot_model.model_dump()
    reply, insight_payload = build_assistant_reply(payload.message, snapshot)

    if payload.history_id:
        append_chat_message(
            payload.history_id,
            ChatMessageCreate(user_email=payload.user_email, role="user", content=payload.message),
        )
        append_chat_message(
            payload.history_id,
            ChatMessageCreate(user_email=payload.user_email, role="assistant", content=reply),
        )

    return AssistantChatResponse(reply=reply, insight=AssistantInsight(**insight_payload))

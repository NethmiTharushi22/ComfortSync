from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.db import get_db
from app.models.schemas import (
    ChatHistoryCreate,
    ChatHistoryListItemOut,
    ChatHistoryOut,
    ChatHistoryUpdate,
    ChatMessageCreate,
    ChatMessageOut,
)

router = APIRouter()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _chat_collection(db):
    return db.collection(settings.chat_history_collection)


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _normalize_message(payload: dict | None) -> ChatMessageOut:
    payload = payload or {}
    created_at = payload.get("created_at")
    if not isinstance(created_at, str) or not created_at:
        created_at = _utc_now()

    role = str(payload.get("role") or "user").lower()

    return ChatMessageOut(
        id=str(payload.get("id") or uuid4().hex),
        role="assistant" if role == "assistant" else "user",
        content=str(payload.get("content") or "").strip(),
        created_at=created_at,
    )


def _derive_preview(messages: list[ChatMessageOut]) -> str:
    if not messages:
        return "No messages yet"

    preview_source = next(
        (message.content for message in reversed(messages) if message.content.strip()),
        messages[-1].content,
    )
    preview = preview_source.strip()
    return preview if len(preview) <= 88 else f"{preview[:85].rstrip()}..."


def _derive_title(raw_title: str | None, messages: list[ChatMessageOut]) -> str:
    title = (raw_title or "").strip()
    if title and title != "New chat":
        return title[:120]

    first_user_message = next((message.content for message in messages if message.role == "user"), "")
    first_user_message = first_user_message.strip()
    if not first_user_message:
        return "New chat"

    return first_user_message[:57].rstrip() + ("..." if len(first_user_message) > 57 else "")


def _history_from_document(document, include_messages: bool = False):
    payload = document.to_dict() or {}
    messages = [
        message
        for message in (_normalize_message(item) for item in payload.get("messages", []))
        if message.content
    ]
    messages.sort(key=lambda item: item.created_at)

    title = _derive_title(payload.get("title"), messages)
    created_at = payload.get("created_at") if isinstance(payload.get("created_at"), str) else _utc_now()
    updated_at = payload.get("updated_at") if isinstance(payload.get("updated_at"), str) else created_at
    last_message_at = messages[-1].created_at if messages else None

    history = {
        "id": document.id,
        "user_email": str(payload.get("user_email") or ""),
        "title": title,
        "preview": _derive_preview(messages),
        "created_at": created_at,
        "updated_at": updated_at,
        "last_message_at": last_message_at,
        "message_count": len(messages),
    }

    if include_messages:
        return ChatHistoryOut(**history, messages=messages)

    return ChatHistoryListItemOut(**history)


def _load_chat_or_404(db, chat_id: str):
    try:
        snapshot = _chat_collection(db).document(chat_id).get()
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to load chat history.") from exc

    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Chat history not found.")

    return snapshot


def _assert_owner(payload: dict, user_email: str) -> None:
    owner = _normalize_email(str(payload.get("user_email") or ""))
    if owner != _normalize_email(user_email):
        raise HTTPException(status_code=404, detail="Chat history not found.")


@router.get("/chat-histories", response_model=list[ChatHistoryListItemOut])
def list_chat_histories(user_email: str = Query(..., min_length=3)) -> list[ChatHistoryListItemOut]:
    db = get_db()
    normalized_email = _normalize_email(user_email)

    try:
        documents = list(
            _chat_collection(db)
            .where("user_email", "==", normalized_email)
            .stream()
        )
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to list chat histories.") from exc

    histories = [_history_from_document(document) for document in documents]
    return sorted(histories, key=lambda item: item.updated_at, reverse=True)


@router.post("/chat-histories", response_model=ChatHistoryOut)
def create_chat_history(payload: ChatHistoryCreate) -> ChatHistoryOut:
    db = get_db()
    document = _chat_collection(db).document()
    now = _utc_now()
    title = _derive_title(payload.title, [])

    record = {
        "user_email": _normalize_email(str(payload.user_email)),
        "title": title,
        "messages": [],
        "created_at": now,
        "updated_at": now,
    }

    try:
        document.set(record)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to create chat history.") from exc

    return ChatHistoryOut(
        id=document.id,
        user_email=_normalize_email(str(payload.user_email)),
        title=title,
        preview="No messages yet",
        created_at=now,
        updated_at=now,
        last_message_at=None,
        message_count=0,
        messages=[],
    )


@router.get("/chat-histories/{chat_id}", response_model=ChatHistoryOut)
def get_chat_history(chat_id: str, user_email: str = Query(..., min_length=3)) -> ChatHistoryOut:
    db = get_db()
    snapshot = _load_chat_or_404(db, chat_id)
    payload = snapshot.to_dict() or {}
    _assert_owner(payload, user_email)
    return _history_from_document(snapshot, include_messages=True)


@router.patch("/chat-histories/{chat_id}", response_model=ChatHistoryOut)
def rename_chat_history(chat_id: str, payload: ChatHistoryUpdate) -> ChatHistoryOut:
    db = get_db()
    snapshot = _load_chat_or_404(db, chat_id)
    existing = snapshot.to_dict() or {}
    _assert_owner(existing, payload.user_email)

    updated_record = {
        **existing,
        "title": _derive_title(payload.title, []),
        "updated_at": _utc_now(),
    }

    try:
        _chat_collection(db).document(chat_id).set(updated_record)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to update chat history.") from exc

    refreshed = _chat_collection(db).document(chat_id).get()
    return _history_from_document(refreshed, include_messages=True)


@router.post("/chat-histories/{chat_id}/messages", response_model=ChatHistoryOut)
def append_chat_message(chat_id: str, payload: ChatMessageCreate) -> ChatHistoryOut:
    db = get_db()
    snapshot = _load_chat_or_404(db, chat_id)
    existing = snapshot.to_dict() or {}
    _assert_owner(existing, payload.user_email)

    messages = [
        message.model_dump()
        for message in (
            _normalize_message(item) for item in existing.get("messages", [])
        )
        if message.content
    ]
    new_message = ChatMessageOut(
        id=uuid4().hex,
        role=payload.role,
        content=payload.content.strip(),
        created_at=_utc_now(),
    )
    messages.append(new_message.model_dump())

    normalized_messages = [_normalize_message(item) for item in messages]
    record = {
        **existing,
        "messages": [message.model_dump() for message in normalized_messages],
        "title": _derive_title(existing.get("title"), normalized_messages),
        "updated_at": new_message.created_at,
    }

    try:
        _chat_collection(db).document(chat_id).set(record)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to save chat message.") from exc

    refreshed = _chat_collection(db).document(chat_id).get()
    return _history_from_document(refreshed, include_messages=True)


@router.delete("/chat-histories/{chat_id}")
def delete_chat_history(chat_id: str, user_email: str = Query(..., min_length=3)) -> dict[str, str]:
    db = get_db()
    snapshot = _load_chat_or_404(db, chat_id)
    payload = snapshot.to_dict() or {}
    _assert_owner(payload, user_email)

    try:
        _chat_collection(db).document(chat_id).delete()
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unable to delete chat history.") from exc

    return {"status": "deleted", "id": chat_id}

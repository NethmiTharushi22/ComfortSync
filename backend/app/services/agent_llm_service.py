from app.config import settings


def get_groq_client():
    try:
        from groq import Groq
    except ImportError as exc:
        raise RuntimeError(
            "Groq SDK is not installed. Add `groq` to backend dependencies to enable agent chat."
        ) from exc

    api_key = settings.groq_api_key
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")
    return Groq(api_key=api_key)


def generate_agent_reply(
    user_message: str,
    latest_reading: dict,
    comfort_label: str,
    analytics: dict,
    forecast: dict,
) -> str:
    client = get_groq_client()

    question_type = "general"
    lower_q = user_message.lower()

    if "why" in lower_q:
        question_type = "explanation"
    elif "trend" in lower_q or "analytics" in lower_q or "average" in lower_q:
        question_type = "analytics"
    elif "forecast" in lower_q or "next" in lower_q or "expected" in lower_q or "future" in lower_q:
        question_type = "forecast"
    elif "compare" in lower_q or "difference" in lower_q or "versus" in lower_q or "vs" in lower_q:
        question_type = "comparison"
    elif "what should i do" in lower_q or "suggest" in lower_q or "recommend" in lower_q:
        question_type = "action"
    elif "where" in lower_q or "which section" in lower_q or "what should i look at" in lower_q:
        question_type = "navigation"
    elif "safe" in lower_q or "comfortable" in lower_q or "status" in lower_q:
        question_type = "status"

    system_prompt = """
You are ComfortSync, an intelligent indoor comfort assistant for an IoT dashboard.

You help users understand live room conditions using sensor readings, analytics, a comfort prediction model, and short-term forecasting.

The dashboard has these sections:
- AI Comfort Prediction
- Next reading outlook
- Device controls
- Gas level gauge
- EPA PM2.5 AQI
- Temperature trend
- Humidity trend
- Air quality trend
- Dust levels
- Light levels
- Current vs forecast

Response style:
- Sound natural, polished, and easy to understand.
- Be concise, but not abrupt.
- Speak like a smart assistant, not a research paper.
- Avoid sounding repetitive or robotic.
- Do not list every number unless the user asks for detailed analytics.
- Highlight the most important issue first.
- When useful, end with a practical suggestion.
- When relevant, explicitly mention which dashboard section the user should check.

Rules:
- Only use the information provided.
- Do not invent values or hidden causes.
- If the user asks for analytics, mention the relevant trend section.
- If the user asks for forecast, mention the Current vs Forecast or Next reading outlook section when relevant.
- If the user asks why the room is uncomfortable, refer to the most relevant dashboard sections.
- If the user asks what to do, give practical recommendations.
- If the room is comfortable, say that clearly and positively.

Good examples of dashboard guidance:
- "You can confirm that in the Temperature trend section."
- "The Current vs Forecast card shows that comparison more clearly."
- "The AI Comfort Prediction card is the best place to start."
"""

    user_prompt = f"""
User question:
{user_message}

Question type:
{question_type}

Live sensor reading:
{latest_reading}

Predicted comfort label:
{comfort_label}

Analytics summary:
{analytics}

Forecast summary:
{forecast}
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.6,
    )

    return response.choices[0].message.content.strip()

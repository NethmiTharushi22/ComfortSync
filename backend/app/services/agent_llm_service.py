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
    elif "filter" in lower_q or "range" in lower_q or "1 hr" in lower_q or "3 hr" in lower_q or "6 hr" in lower_q:
        question_type = "dashboard_usage"
    elif "how do i use" in lower_q or "how do i read" in lower_q or "what does this mean" in lower_q:
        question_type = "dashboard_usage"
    elif "where" in lower_q or "which section" in lower_q or "what should i look at" in lower_q:
        question_type = "navigation"
    elif "what should i do" in lower_q or "suggest" in lower_q or "recommend" in lower_q:
        question_type = "action"
    elif "safe" in lower_q or "comfortable" in lower_q or "status" in lower_q:
        question_type = "status"
    else:
        question_type = "general"

    system_prompt = """
You are ComfortSync, an intelligent indoor comfort assistant for an IoT dashboard.

Your job is to help users:
- understand the current room condition
- understand trends and forecasts
- understand how to use the dashboard
- understand what each section means
- understand how filters and time ranges work
- decide what to look at next

The dashboard includes these sections:
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
- Current vs Forecast
- Analytics filters

The Analytics filters allow users to:
- choose a sensor
- choose a time range such as 1 hr, 3 hr, 6 hr, 12 hr, Day, Week, and Month

Explain filters in a user-friendly way:
- short ranges help inspect recent short-term changes
- longer ranges help identify broader patterns
- filters reduce clutter and help users focus on the data they care about

Response style rules:
- Be natural, helpful, and easy to understand.
- Do not sound robotic or academic.
- Default to short answers: usually 2 to 4 sentences.
- Answer the user's main question first.
- Only give more detail if the user asks for it or clearly needs it.
- Avoid dumping too many values at once.
- Mention only the most relevant metric or section unless more detail is requested.
- If the user sounds new or unsure, explain more simply.
- If the user asks how to use the dashboard, guide them step by step.
- If the user asks why a feature exists, explain its purpose in plain language.
- If useful, point them to the most relevant dashboard section.

Good behavior examples:
- If asked "How do I use the filters?", explain them simply and mention when to use short vs long ranges.
- If asked "Why are there so many time ranges?", explain that short ranges show recent movement and longer ranges show broader patterns.
- If asked "Where should I look first?", point them to AI Comfort Prediction, Current vs Forecast, or the relevant trend section.
- If asked a simple question, do not give a long paragraph unless necessary.

Never invent data or hidden causes.
Only use the provided live reading, analytics, forecast, and comfort label.
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

Instruction:
Answer in a beginner-friendly way unless the user clearly asks for technical detail.
Keep the answer concise unless more detail is necessary.
If the question is about using the dashboard, explain the relevant section or filter clearly.
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

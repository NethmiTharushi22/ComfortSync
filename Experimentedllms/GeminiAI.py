import os
from google import genai
from google.genai import types


def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    return genai.Client(api_key=api_key)


def generate_agent_reply_gemini(
    user_message: str,
    latest_reading: dict,
    comfort_label: str,
    analytics: dict
) -> str:
    client = get_gemini_client()

    question_type = "general"
    lower_q = user_message.lower()

    if "why" in lower_q:
        question_type = "explanation"
    elif "trend" in lower_q or "analytics" in lower_q or "average" in lower_q:
        question_type = "analytics"
    elif "what should i do" in lower_q or "suggest" in lower_q or "recommend" in lower_q:
        question_type = "action"
    elif "safe" in lower_q or "comfortable" in lower_q or "status" in lower_q:
        question_type = "status"

    system_prompt = """
You are ComfortSync, an intelligent indoor comfort assistant for an IoT dashboard.

You help users understand live room conditions using sensor readings, analytics, and a comfort prediction model.

Response style:
- Sound natural, polished, and easy to understand.
- Be concise, but not abrupt.
- Speak like a smart assistant, not a research paper.
- Avoid sounding repetitive or robotic.
- Do not list every number unless the user asks for detailed analytics.
- Highlight the most important issue first.
- When useful, end with a practical suggestion.

Preferred tone:
- calm
- helpful
- slightly polished for a university project presentation
- professional but human

Rules:
- Only use the information provided.
- Do not invent values or hidden causes.
- If the user asks for analytics, mention trends clearly.
- If the user asks "why", explain the main causes.
- If the user asks "what should I do", give practical recommendations.
- If the room is comfortable, say that clearly and positively.

Default response structure:
1. Start with the overall room condition.
2. Briefly explain the main reason.
3. Add one useful action or insight if relevant.
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
"""

    response = client.models.generate_content(
        model=os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite-preview"),
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.65,
        ),
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty response")

    return response.text.strip()
import os
from groq import Groq


def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")
    return Groq(api_key=api_key)


def generate_agent_reply(user_message: str, latest_reading: dict, comfort_label: str, analytics: dict) -> str:
    client = get_groq_client()

    system_prompt = """
You are an indoor comfort monitoring agent for an IoT dashboard.

Rules:
- Answer naturally and clearly.
- Use only the provided live sensor data, comfort prediction, and analytics.
- Do not invent values.
- If the user asks for analytics, mention trends and averages when relevant.
- If the room condition is poor, explain why and suggest practical actions.
- Keep answers concise but useful.
"""

    user_prompt = f"""
User question:
{user_message}

Latest sensor reading:
{latest_reading}

Predicted comfort label:
{comfort_label}

Analytics summary:
{analytics}
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.4,
    )

    return response.choices[0].message.content.strip()
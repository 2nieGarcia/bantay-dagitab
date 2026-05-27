"""LLM client for the chatbot view.

Per paper §IV.B and §VII.A.4, the Django chatbot view calls an external
LLM API directly (Groq, Ollama, or any OpenAI-compatible endpoint). No
intermediate FastAPI hop. The FastAPI ML service exists separately for
anomaly detection and forecasting (paper Table IV.C.2).
"""

import logging
import os

from openai import OpenAI, OpenAIError

logger = logging.getLogger(__name__)

SYSTEM_PROMPTS = {
    "en": (
        "You are Bantay-Dagitab's residential energy assistant for post-paid "
        "MERALCO households in Metro Manila. You will be given the user's "
        "recent MERALCO bills (OCR-digitized), recent anomaly alerts, and "
        "live IoT sub-meter readings. Use this context to answer the user's "
        "question in plain, practical English. Do not switch to Filipino or "
        "Taglish unless the user explicitly writes in Filipino. When comparing "
        "bills, cite the billing period and amount. When discussing anomalies, "
        "cite the timestamp and the device. Recommend specific, low-cost "
        "behavioural changes when relevant. Keep responses under 180 words. "
        "If the context lacks the data needed to answer, say so honestly."
    ),
    "fil": (
        "Ikaw ang energy assistant ng Bantay-Dagitab para sa mga post-paid na "
        "kabahayan ng MERALCO sa Metro Manila. Bibigyan ka ng pinakabagong "
        "MERALCO bills (digitized sa pamamagitan ng OCR), mga anomaly alert, "
        "at live na IoT sub-meter readings ng user. Gamitin mo ang impormasyong "
        "ito para sagutin ang tanong sa malinaw at praktikal na Filipino. Huwag "
        "lumipat sa Ingles maliban kung English ang ginamit ng user. Kapag "
        "naghahambing ng bill, banggitin ang billing period at halaga. Kapag "
        "tinatalakay ang anomaly, banggitin ang oras at device. Magmungkahi ng "
        "tiyak, murang pagbabago sa gawi kung may kinalaman. Huwag lalampas ng "
        "180 salita. Kung kulang ang impormasyon, sabihin mong walang sapat na "
        "datos."
    ),
}

FALLBACK_RESPONSES = {
    "en": (
        "The energy assistant is temporarily unavailable. Please try again in a "
        "moment. Your question has been recorded."
    ),
    "fil": (
        "Pansamantalang hindi available ang energy assistant. Pakisubukang muli "
        "mamaya. Naitala na ang iyong tanong."
    ),
}


def _system_prompt_for(lang: str) -> str:
    return SYSTEM_PROMPTS.get(lang, SYSTEM_PROMPTS["en"])


def _fallback_for(lang: str) -> str:
    return FALLBACK_RESPONSES.get(lang, FALLBACK_RESPONSES["en"])


class LLMClient:
    """Calls an OpenAI-compatible LLM endpoint (Groq cloud or Ollama local).

    Reads its configuration from environment variables; returns a canned
    fallback string when misconfigured or when the upstream LLM errors,
    so the chatbot endpoint never raises 5xx on transient LLM issues.
    """

    @staticmethod
    def _format_bills(bills: list) -> str:
        if not bills:
            return "  (no bills digitized yet)"
        return "\n".join(
            f"- {b['billing_period']}: {b['total_kwh_consumed']} kWh, "
            f"PHP {b['total_bill_php']:.2f} (account {b['meralco_account_number']}, "
            f"scanned {b['scan_timestamp']})"
            for b in bills
        )

    @staticmethod
    def _format_anomalies(anomalies: list) -> str:
        if not anomalies:
            return "  (no anomalies in the last 10 alerts)"
        return "\n".join(
            f"- {a['timestamp']} on {a['device_id']}: {a['type']}, "
            f"actual {a['actual_wattage']} W (expected {a['expected_range']}). "
            f"Note: {a['message']}"
            for a in anomalies
        )

    @staticmethod
    def _format_live(ctx: dict) -> str:
        today_kwh = ctx.get("today_kwh_so_far", 0)
        latest = ctx.get("latest_reading")
        lines = [f"- Today's consumption so far: {today_kwh} kWh"]
        if latest:
            lines.append(
                f"- Latest reading: {latest['avg_wattage']} W at {latest['timestamp']} "
                f"on {latest['device_id']}"
            )
        else:
            lines.append("- Latest reading: (no IoT readings recorded yet)")
        return "\n".join(lines)

    @classmethod
    def _build_user_message(cls, query: str, context: dict) -> str:
        return (
            f"Current time: {context.get('now')}\n\n"
            f"User question: {query}\n\n"
            f"Current billing period summary:\n"
            f"- Period: {context.get('billing_period', 'N/A')}\n"
            f"- Consumption: {context.get('total_kwh_consumed', 0)} kWh\n"
            f"- Amount: PHP {context.get('total_bill_php', 0)}\n"
            f"- Anomalies flagged this period: {context.get('anomalies_flagged', 0)}\n\n"
            f"Recent MERALCO bills (most recent first):\n"
            f"{cls._format_bills(context.get('recent_bills', []))}\n\n"
            f"Recent anomaly alerts (most recent first):\n"
            f"{cls._format_anomalies(context.get('recent_anomalies', []))}\n\n"
            f"Live IoT telemetry:\n"
            f"{cls._format_live(context)}\n"
        )

    @classmethod
    def get_chat_response(cls, payload: dict) -> str:
        base_url = os.environ.get("LLM_BASE_URL")
        api_key = os.environ.get("LLM_API_KEY")
        model = os.environ.get("LLM_MODEL")
        timeout = float(os.environ.get("LLM_TIMEOUT_SECONDS", "30"))
        lang = payload.get("lang", "en")

        if not (base_url and api_key and model):
            logger.warning(
                "LLM not configured (LLM_BASE_URL/LLM_API_KEY/LLM_MODEL missing); returning fallback."
            )
            return _fallback_for(lang)

        client = OpenAI(base_url=base_url, api_key=api_key, timeout=timeout)
        user_message = cls._build_user_message(
            query=payload.get("user_query", ""),
            context=payload.get("context", {}),
        )

        try:
            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": _system_prompt_for(lang)},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.4,
                max_tokens=400,
            )
            text = (completion.choices[0].message.content or "").strip()
            return text or _fallback_for(lang)
        except OpenAIError as exc:
            logger.exception("LLM call failed: %s", exc)
            return _fallback_for(lang)

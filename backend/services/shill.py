import json
from collections import defaultdict
from datetime import datetime
from groq import AsyncGroq
from ..config import settings

client = AsyncGroq(api_key=settings.GROQ_API_KEY)


def compute_shill_score(bid_history: list[dict], user_id: str) -> tuple[float, str]:
    """Rule-based shill score (0-1). Returns (score, reason)."""
    if len(bid_history) < 3:
        return 0.0, ""

    user_bids = [b for b in bid_history if b["user_id"] == user_id]
    if len(user_bids) < 2:
        return 0.0, ""

    score = 0.0
    reasons = []

    # Rule 1: Bid velocity — more than 3 bids in 30 seconds
    now = datetime.utcnow()
    recent = [
        b for b in user_bids
        if (now - datetime.fromisoformat(b["placed_at"])).seconds < 30
    ]
    if len(recent) >= 3:
        score += 0.4
        reasons.append("high bid velocity")

    # Rule 2: Always bidding exactly after the same opponent
    if len(bid_history) >= 4:
        opponent_pairs: dict[str, int] = defaultdict(int)
        for i in range(1, len(bid_history)):
            prev = bid_history[i - 1]
            curr = bid_history[i]
            if curr["user_id"] == user_id and prev["user_id"] != user_id:
                opponent_pairs[prev["user_id"]] += 1
        for _opp, count in opponent_pairs.items():
            if count >= 3:
                score += 0.3
                reasons.append("always counter-bidding same user")
                break

    # Rule 3: Suspiciously small increments across consecutive own bids
    amounts = [b["amount"] for b in user_bids]
    if len(amounts) >= 2:
        increments = [amounts[i] - amounts[i - 1] for i in range(1, len(amounts))]
        if all(inc <= 10 for inc in increments) and len(increments) >= 2:
            score += 0.2
            reasons.append("suspiciously small increments")

    return min(score, 1.0), ", ".join(reasons) if reasons else ""


async def llm_shill_check(
    item_name: str,
    bid_history: list[dict],
    suspicious_user: str,
) -> dict:
    """LLM-based deeper shill analysis for flagged users."""
    summary = "\n".join([
        f"{b['bidder']} bid ₹{b['amount']} at {b['placed_at']}"
        for b in bid_history[-10:]
    ])

    resp = await client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{
            "role": "user",
            "content": f"""Analyze this auction bid history for shill bidding (fake bids to inflate price).

Item: {item_name}
Suspicious user: {suspicious_user}
Bid history (last 10):
{summary}

Shill bidding signs: bidding against yourself via another account, artificially inflating prices, bid withdrawal patterns.

Answer as JSON: {{"is_shill": true/false, "confidence": "low/medium/high", "explanation": "one sentence"}}
Return ONLY JSON."""
        }],
        max_tokens=100,
        temperature=0.2,
    )
    try:
        return json.loads(resp.choices[0].message.content.strip())
    except Exception:
        return {"is_shill": False, "confidence": "low", "explanation": "Analysis failed."}

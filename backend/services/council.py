import asyncio
import json
from groq import AsyncGroq
from ..config import settings, COUNCIL_MODELS, CHAIRMAN_MODEL

client = AsyncGroq(api_key=settings.GROQ_API_KEY)


async def _ask_model(model: str, item_name: str, base_price: int,
                     description: str = "") -> str:
    desc_line = f"\nDescription: {description}" if description else ""
    resp = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content":
            f"""You are an auction expert. Estimate the fair market value for this item.

Item: {item_name}{desc_line}
Opening Price: \u20b9{base_price:,}

Provide: (1) Fair value range low-high, (2) Whether opening price is fair/low/high,
(3) Confidence (low/medium/high), (4) One sentence reasoning. Be concise."""
        }],
        max_tokens=200, temperature=0.7,
    )
    return resp.choices[0].message.content


async def _review_opinions(model: str, opinions: list[str], own_index: int) -> str:
    label = "ABCD"
    others = [f"Expert {label[i]}: {op}" for i, op in enumerate(opinions)]
    resp = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content":
            f"""Review these auction valuation opinions (anonymized):
{chr(10).join(others)}
You are Expert {label[own_index]}. Which estimate is most accurate and why? (2 sentences)"""
        }],
        max_tokens=150, temperature=0.5,
    )
    return resp.choices[0].message.content


async def _chairman_synthesize(item_name: str, base_price: int, description: str,
                                opinions: list[str], reviews: list[str]) -> dict:
    desc_line = f"\nDescription: {description}" if description else ""
    opinions_text = "\n".join([f"Model {i+1}: {op}" for i, op in enumerate(opinions)])
    reviews_text = "\n".join([f"Review {i+1}: {r}" for i, r in enumerate(reviews)])
    resp = await client.chat.completions.create(
        model=CHAIRMAN_MODEL,
        messages=[{"role": "user", "content":
            f"""You are the Chairman of an AI Valuation Council for a fantasy auction.

Item: {item_name}{desc_line}
Opening Price: \u20b9{base_price:,}

Council opinions:
{opinions_text}

Cross-reviews:
{reviews_text}

Synthesize a final verdict as JSON. This is an AI estimate to guide bidders, not a definitive price.
{{
  "fair_value_low": <number>,
  "fair_value_high": <number>,
  "opening_assessment": "underpriced|fair|overpriced",
  "consensus_confidence": "low|medium|high",
  "suggested_max_bid": <number>,
  "chairman_summary": "<one sentence AI guidance>"
}}
Return ONLY the JSON."""
        }],
        max_tokens=250, temperature=0.3,
    )
    try:
        text = resp.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception:
        return {
            "fair_value_low": base_price,
            "fair_value_high": int(base_price * 1.5),
            "opening_assessment": "fair",
            "consensus_confidence": "low",
            "suggested_max_bid": int(base_price * 1.3),
            "chairman_summary": "Council could not reach consensus on this item.",
        }


async def get_council_valuation(item_name: str, base_price: int,
                                 description: str = "", photo_url: str = "") -> dict:
    """3-stage LLM council. Returns chairman verdict with individual opinions."""
    opinions = await asyncio.gather(*[
        _ask_model(m, item_name, base_price, description) for m in COUNCIL_MODELS
    ])
    reviews = await asyncio.gather(*[
        _review_opinions(COUNCIL_MODELS[i], list(opinions), i)
        for i in range(len(COUNCIL_MODELS))
    ])
    verdict = await _chairman_synthesize(
        item_name, base_price, description, list(opinions), list(reviews)
    )
    verdict["council_opinions"] = list(opinions)
    verdict["is_fallback"] = False
    return verdict

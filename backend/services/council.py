import asyncio
import json
from groq import AsyncGroq
from ..config import settings, COUNCIL_MODELS, CHAIRMAN_MODEL

client = AsyncGroq(api_key=settings.GROQ_API_KEY)


async def _ask_model(model: str, item_name: str, base_price: int) -> str:
    """Stage 1: get independent opinion from one model."""
    resp = await client.chat.completions.create(
        model=model,
        messages=[{
            "role": "user",
            "content": f"""You are an auction expert. Estimate the fair market value for this auction item.

Item: {item_name}
Base/Opening Price: ₹{base_price}

Provide:
1. Fair value range (low and high estimate)
2. Whether the opening price is fair, low, or high
3. Your confidence (low/medium/high)
4. One sentence reasoning

Be concise. Numbers only for the range."""
        }],
        max_tokens=200,
        temperature=0.7,
    )
    return resp.choices[0].message.content


async def _review_opinions(model: str, opinions: list[str], own_index: int) -> str:
    """Stage 2: each model reviews all opinions (anonymized)."""
    label = "ABCD"
    others = [f"Expert {label[i]}: {op}" for i, op in enumerate(opinions)]

    resp = await client.chat.completions.create(
        model=model,
        messages=[{
            "role": "user",
            "content": f"""You previously gave an auction valuation. Now review these expert opinions (anonymized):

{chr(10).join(others)}

Your own opinion was Expert {label[own_index]}.

Rank these from most to least accurate. State which estimate you agree with most and why in 2 sentences."""
        }],
        max_tokens=150,
        temperature=0.5,
    )
    return resp.choices[0].message.content


async def _chairman_synthesize(
    item_name: str,
    base_price: int,
    opinions: list[str],
    reviews: list[str],
) -> dict:
    """Stage 3: Chairman synthesizes final verdict."""
    opinions_text = "\n".join([f"Model {i+1}: {op}" for i, op in enumerate(opinions)])
    reviews_text = "\n".join([f"Review {i+1}: {rev}" for i, rev in enumerate(reviews)])

    resp = await client.chat.completions.create(
        model=CHAIRMAN_MODEL,
        messages=[{
            "role": "user",
            "content": f"""You are the Chairman of the LLM Valuation Council for an auction.

Item: {item_name}
Opening Price: ₹{base_price}

Council opinions:
{opinions_text}

Cross-reviews:
{reviews_text}

Synthesize a final verdict as JSON:
{{
  "fair_value_low": <number>,
  "fair_value_high": <number>,
  "opening_assessment": "underpriced|fair|overpriced",
  "consensus_confidence": "low|medium|high",
  "suggested_max_bid": <number>,
  "chairman_summary": "<one sentence>"
}}

Return ONLY the JSON, no other text."""
        }],
        max_tokens=200,
        temperature=0.3,
    )
    try:
        return json.loads(resp.choices[0].message.content.strip())
    except Exception:
        return {
            "fair_value_low": base_price,
            "fair_value_high": int(base_price * 1.5),
            "opening_assessment": "fair",
            "consensus_confidence": "low",
            "suggested_max_bid": int(base_price * 1.3),
            "chairman_summary": "Council could not reach consensus.",
        }


async def get_council_valuation(item_name: str, base_price: int) -> dict:
    """Full 3-stage LLM council valuation. Returns chairman verdict."""
    # Stage 1: parallel independent opinions
    opinions = await asyncio.gather(*[
        _ask_model(m, item_name, base_price) for m in COUNCIL_MODELS
    ])

    # Stage 2: parallel cross-reviews
    reviews = await asyncio.gather(*[
        _review_opinions(COUNCIL_MODELS[i], list(opinions), i)
        for i in range(len(COUNCIL_MODELS))
    ])

    # Stage 3: chairman synthesis
    verdict = await _chairman_synthesize(item_name, base_price, list(opinions), list(reviews))
    verdict["council_opinions"] = list(opinions)
    return verdict

from groq import AsyncGroq
from ..config import settings

client = AsyncGroq(api_key=settings.GROQ_API_KEY)


async def generate_commentary(
    item_name: str,
    current_bid: int,
    base_price: int,
    bidder_count: int,
    seconds_left: int,
    bid_history: list[dict],
    event_type: str = "bid",  # bid | starting | closing | sold | unsold
) -> str:
    """Generate a short auctioneer commentary line. Returns full text (non-streaming for broadcast)."""
    recent_bids = bid_history[-3:] if bid_history else []
    bid_summary = ", ".join([f"{b['bidder']} bid ₹{b['amount']}" for b in recent_bids])

    prompts = {
        "bid": (
            f"Generate ONE short, exciting auctioneer line (max 15 words) for: {item_name}, "
            f"current bid ₹{current_bid} (from ₹{base_price} opening), "
            f"{bidder_count} active bidders, {seconds_left}s left. "
            f"Recent: {bid_summary}. Sound like a live cricket auction commentator."
        ),
        "starting": (
            f"Generate ONE exciting opening line (max 15 words) for item: {item_name}, "
            f"opening at ₹{base_price}. Sound like IPL auction host."
        ),
        "closing": (
            f"Generate ONE urgent closing line (max 12 words), "
            f"₹{current_bid} bid, {seconds_left} seconds left on {item_name}!"
        ),
        "sold": (
            f"Generate ONE dramatic SOLD announcement (max 12 words) for {item_name} at ₹{current_bid}!"
        ),
        "unsold": (
            f"Generate ONE brief unsold announcement (max 10 words) for {item_name}. Keep it professional."
        ),
    }

    resp = await client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompts.get(event_type, prompts["bid"])}],
        max_tokens=60,
        temperature=0.9,
    )
    return resp.choices[0].message.content.strip().strip('"')


async def stream_commentary(
    item_name: str,
    current_bid: int,
    base_price: int,
    bidder_count: int,
    seconds_left: int,
):
    """Async generator that streams commentary tokens (for SSE)."""
    prompt = (
        f"Generate ONE short exciting auctioneer comment (max 15 words) for {item_name}, "
        f"bid ₹{current_bid}, {bidder_count} bidders, {seconds_left}s left. Cricket IPL auction style."
    )

    stream = await client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=60,
        temperature=0.9,
        stream=True,
    )

    async for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content

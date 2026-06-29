from pydantic import BaseModel
from typing import Optional


class RoomCreate(BaseModel):
    name: str
    admin_name: str
    budget: int = 50000
    scheduled_at: Optional[str] = None   # ISO-8601 UTC, e.g. "2026-06-30T14:00:00Z"
    bid_duration: int = 30               # seconds per bid after first bid
    first_bid_duration: int = 120        # seconds for the opening / first-bid window


class RoomJoin(BaseModel):
    code: str
    display_name: str
    budget: int = 10000


class ItemCreate(BaseModel):
    name: str
    description: str = ""
    base_price: int
    order_index: int = 0
    photo_url: Optional[str] = None


class BidRequest(BaseModel):
    amount: int


class WSMessage(BaseModel):
    type: str
    data: dict


class RoomState(BaseModel):
    room_id: str
    status: str
    participants: list
    current_item: Optional[dict]
    bid_history: list
    items_remaining: int

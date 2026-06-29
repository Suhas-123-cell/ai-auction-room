from pydantic import BaseModel
from typing import Optional


class RoomCreate(BaseModel):
    name: str
    admin_name: str
    budget: int = 50000


class RoomJoin(BaseModel):
    code: str
    display_name: str
    budget: int = 10000


class ItemCreate(BaseModel):
    name: str
    description: str = ""
    base_price: int
    order_index: int = 0


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

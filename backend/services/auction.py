import asyncio
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional
from .council import get_council_valuation
from .auctioneer import generate_commentary
from .shill import compute_shill_score
from ..config import settings


@dataclass
class BidRecord:
    user_id: str
    bidder: str
    amount: int
    placed_at: str
    shill_score: float = 0.0


@dataclass
class ItemState:
    id: str
    name: str
    description: str
    base_price: int
    order_index: int
    current_bid: int = 0
    highest_bidder_id: Optional[str] = None
    highest_bidder_name: Optional[str] = None
    bid_history: list = field(default_factory=list)
    status: str = "pending"
    council_valuation: Optional[dict] = None
    timer_seconds: int = 0
    photo_url: Optional[str] = None


@dataclass
class ParticipantState:
    user_id: str
    display_name: str
    role: str
    budget: int
    spent: int = 0
    connected: bool = True


@dataclass
class RoomState:
    room_id: str
    room_name: str
    status: str = "lobby"
    participants: dict = field(default_factory=dict)
    items: list = field(default_factory=list)
    current_item_index: int = -1
    timer_task: Optional[asyncio.Task] = None
    latest_commentary: str = ""
    bid_duration: int = 30          # timer reset on each bid
    first_bid_duration: int = 120   # opening window per item
    scheduled_at: Optional[str] = None


class AuctionService:
    def __init__(self, ws_manager):
        self.manager = ws_manager
        self.rooms: dict[str, RoomState] = {}

    def get_or_create_room(
        self,
        room_id: str,
        room_name: str,
        bid_duration: int = 30,
        first_bid_duration: int = 120,
        scheduled_at: Optional[str] = None,
    ) -> RoomState:
        if room_id not in self.rooms:
            self.rooms[room_id] = RoomState(
                room_id=room_id,
                room_name=room_name,
                bid_duration=bid_duration,
                first_bid_duration=first_bid_duration,
                scheduled_at=scheduled_at,
            )
        return self.rooms[room_id]

    def get_room(self, room_id: str) -> Optional[RoomState]:
        return self.rooms.get(room_id)

    def room_state_dict(self, room: RoomState) -> dict:
        current_item = None
        if 0 <= room.current_item_index < len(room.items):
            item = room.items[room.current_item_index]
            current_item = {
                "id": item.id,
                "name": item.name,
                "description": item.description,
                "base_price": item.base_price,
                "photo_url": item.photo_url,
                "current_bid": item.current_bid,
                "highest_bidder": item.highest_bidder_name,
                "bid_history": [
                    {"bidder": b.bidder, "amount": b.amount,
                     "placed_at": b.placed_at, "shill_score": b.shill_score}
                    for b in item.bid_history[-20:]
                ],
                "status": item.status,
                "timer_seconds": item.timer_seconds,
                "council_valuation": item.council_valuation,
            }
        return {
            "room_id": room.room_id,
            "room_name": room.room_name,
            "status": room.status,
            "participants": [vars(p) for p in room.participants.values()],
            "current_item": current_item,
            "items_total": len(room.items),
            "items_completed": sum(1 for i in room.items if i.status in ("sold", "unsold")),
            "latest_commentary": room.latest_commentary,
            "bid_duration": room.bid_duration,
            "first_bid_duration": room.first_bid_duration,
            "scheduled_at": room.scheduled_at,
        }

    async def add_participant(
        self,
        room_id: str,
        room_name: str,
        user_id: str,
        display_name: str,
        role: str,
        budget: int,
        bid_duration: int = 30,
        first_bid_duration: int = 120,
        scheduled_at: Optional[str] = None,
    ):
        room = self.get_or_create_room(
            room_id, room_name, bid_duration, first_bid_duration, scheduled_at
        )
        room.participants[user_id] = ParticipantState(
            user_id=user_id,
            display_name=display_name,
            role=role,
            budget=budget,
        )
        await self.manager.broadcast_to_room(room_id, {
            "type": "participant_update",
            "data": {"participants": [vars(p) for p in room.participants.values()]},
        })

    async def mark_disconnected(self, room_id: str, user_id: str):
        room = self.get_room(room_id)
        if room and user_id in room.participants:
            room.participants[user_id].connected = False
            await self.manager.broadcast_to_room(room_id, {
                "type": "participant_update",
                "data": {"participants": [vars(p) for p in room.participants.values()]},
            })

    async def load_items(self, room_id: str, items: list[dict]):
        room = self.get_room(room_id)
        if not room:
            return
        room.items = [
            ItemState(
                id=item["id"],
                name=item["name"],
                description=item.get("description", ""),
                base_price=item["base_price"],
                order_index=item.get("order_index", i),
                current_bid=item["base_price"],
                photo_url=item.get("photo_url"),
            )
            for i, item in enumerate(sorted(items, key=lambda x: x.get("order_index", 0)))
        ]

    async def start_auction(self, room_id: str, user_id: str) -> dict:
        room = self.get_room(room_id)
        if not room or room.status != "lobby":
            return {"error": "Room not in lobby state"}
        participant = room.participants.get(user_id)
        if not participant or participant.role != "admin":
            return {"error": "Only admin can start auction"}
        await self._do_start(room_id)
        return {"ok": True}

    async def start_auction_auto(self, room_id: str):
        """Start auction triggered by scheduler — no admin check."""
        room = self.get_room(room_id)
        if not room or room.status != "lobby":
            return
        await self._do_start(room_id)

    async def _do_start(self, room_id: str):
        room = self.get_room(room_id)
        room.status = "auction"
        # Persist status to DB
        try:
            from ..database import get_supabase
            get_supabase().table("rooms").update({"status": "auction"}).eq("id", room_id).execute()
        except Exception as e:
            print(f"DB status update failed: {e}")
        await self.manager.broadcast_to_room(room_id, {
            "type": "auction_started",
            "data": {"status": "auction"},
        })
        await self._advance_to_next_item(room_id)

    async def _advance_to_next_item(self, room_id: str):
        room = self.get_room(room_id)
        if not room:
            return

        next_index = room.current_item_index + 1
        if next_index >= len(room.items):
            await self._complete_auction(room_id)
            return

        room.current_item_index = next_index
        item = room.items[next_index]
        item.status = "active"
        # Opening window: first_bid_duration gives bidders time to see the item
        item.timer_seconds = room.first_bid_duration

        asyncio.create_task(self._fetch_council(room_id, item))

        try:
            commentary = await generate_commentary(
                item.name, item.base_price, item.base_price, 0,
                item.timer_seconds, [], event_type="starting",
            )
            room.latest_commentary = commentary
        except Exception:
            room.latest_commentary = f"Up next: {item.name}! Opening at ₹{item.base_price}!"

        await self.manager.broadcast_to_room(room_id, {
            "type": "item_started",
            "data": {
                "item": {
                    "id": item.id,
                    "name": item.name,
                    "description": item.description,
                    "base_price": item.base_price,
                    "photo_url": item.photo_url,
                    "current_bid": item.current_bid,
                    "timer_seconds": item.timer_seconds,
                    "council_valuation": None,
                },
                "commentary": room.latest_commentary,
            },
        })

        if room.timer_task and not room.timer_task.done():
            room.timer_task.cancel()
        room.timer_task = asyncio.create_task(self._run_timer(room_id))

    async def _fetch_council(self, room_id: str, item: ItemState):
        try:
            valuation = await get_council_valuation(item.name, item.base_price)
            item.council_valuation = valuation
            await self.manager.broadcast_to_room(room_id, {
                "type": "council_valuation",
                "data": {"item_id": item.id, "valuation": valuation},
            })
        except Exception as e:
            print(f"Council valuation failed for {item.name}: {e}")

    async def _run_timer(self, room_id: str):
        room = self.get_room(room_id)
        if not room:
            return
        try:
            while True:
                await asyncio.sleep(1)
                room = self.get_room(room_id)
                if not room or room.current_item_index < 0:
                    break
                item = room.items[room.current_item_index]
                if item.status != "active":
                    break

                item.timer_seconds -= 1
                await self.manager.broadcast_to_room(room_id, {
                    "type": "timer_tick",
                    "data": {"seconds_left": item.timer_seconds},
                })

                if item.timer_seconds in (10, 5):
                    try:
                        bidder_count = len(set(b.user_id for b in item.bid_history))
                        commentary = await generate_commentary(
                            item.name, item.current_bid, item.base_price,
                            bidder_count, item.timer_seconds,
                            [{"bidder": b.bidder, "amount": b.amount} for b in item.bid_history[-3:]],
                            event_type="closing",
                        )
                        room.latest_commentary = commentary
                        await self.manager.broadcast_to_room(room_id, {
                            "type": "commentary_update",
                            "data": {"commentary": commentary},
                        })
                    except Exception:
                        pass

                if item.timer_seconds <= 0:
                    await self._resolve_item(room_id)
                    break
        except asyncio.CancelledError:
            pass

    async def place_bid(self, room_id: str, user_id: str, amount: int) -> dict:
        room = self.get_room(room_id)
        if not room or room.status != "auction":
            return {"error": "Auction not active"}
        if room.current_item_index < 0:
            return {"error": "No active item"}

        item = room.items[room.current_item_index]
        if item.status != "active":
            return {"error": "Item not active"}
        if item.timer_seconds <= 0:
            return {"error": "Bidding time expired"}

        participant = room.participants.get(user_id)
        if not participant:
            return {"error": "Not in room"}
        if amount <= item.current_bid:
            return {"error": f"Bid must be higher than ₹{item.current_bid}"}

        remaining_budget = participant.budget - participant.spent
        if amount > remaining_budget:
            return {"error": f"Insufficient budget. Available: ₹{remaining_budget}"}

        bid = BidRecord(
            user_id=user_id,
            bidder=participant.display_name,
            amount=amount,
            placed_at=datetime.utcnow().isoformat(),
        )

        bid_history_dicts = [
            {"user_id": b.user_id, "amount": b.amount, "placed_at": b.placed_at}
            for b in item.bid_history
        ]
        shill_score, shill_reason = compute_shill_score(bid_history_dicts, user_id)
        bid.shill_score = shill_score

        item.bid_history.append(bid)
        item.current_bid = amount
        item.highest_bidder_id = user_id
        item.highest_bidder_name = participant.display_name

        # Full timer reset on every bid — "going, going, gone" style
        item.timer_seconds = room.bid_duration

        try:
            bidder_count = len(set(b.user_id for b in item.bid_history))
            commentary = await generate_commentary(
                item.name, amount, item.base_price, bidder_count,
                item.timer_seconds,
                [{"bidder": b.bidder, "amount": b.amount} for b in item.bid_history[-3:]],
                event_type="bid",
            )
            room.latest_commentary = commentary
        except Exception:
            room.latest_commentary = f"{participant.display_name} bids ₹{amount}!"

        await self.manager.broadcast_to_room(room_id, {
            "type": "bid_update",
            "data": {
                "item_id": item.id,
                "current_bid": item.current_bid,
                "highest_bidder": item.highest_bidder_name,
                "bid_history": [
                    {"bidder": b.bidder, "amount": b.amount,
                     "placed_at": b.placed_at, "shill_score": b.shill_score}
                    for b in item.bid_history[-20:]
                ],
                "timer_seconds": item.timer_seconds,
                "commentary": room.latest_commentary,
            },
        })

        if shill_score >= 0.6:
            admin_ids = [uid for uid, p in room.participants.items() if p.role == "admin"]
            for admin_id in admin_ids:
                await self.manager.send_to_user(room_id, admin_id, {
                    "type": "shill_alert",
                    "data": {
                        "user_id": user_id,
                        "bidder": participant.display_name,
                        "score": shill_score,
                        "reason": shill_reason,
                    },
                })

        return {"ok": True, "current_bid": amount}

    async def _resolve_item(self, room_id: str):
        room = self.get_room(room_id)
        if not room or room.current_item_index < 0:
            return

        item = room.items[room.current_item_index]

        if item.highest_bidder_id and item.current_bid >= item.base_price:
            item.status = "sold"
            winner = room.participants.get(item.highest_bidder_id)
            if winner:
                winner.spent += item.current_bid
            try:
                commentary = await generate_commentary(
                    item.name, item.current_bid, item.base_price,
                    0, 0, [], event_type="sold",
                )
                room.latest_commentary = commentary
            except Exception:
                room.latest_commentary = (
                    f"SOLD! {item.name} to {item.highest_bidder_name} for ₹{item.current_bid}!"
                )
        else:
            item.status = "unsold"
            try:
                commentary = await generate_commentary(
                    item.name, item.current_bid, item.base_price,
                    0, 0, [], event_type="unsold",
                )
                room.latest_commentary = commentary
            except Exception:
                room.latest_commentary = f"{item.name} goes unsold."

        await self.manager.broadcast_to_room(room_id, {
            "type": "item_resolved",
            "data": {
                "item_id": item.id,
                "status": item.status,
                "winner": item.highest_bidder_name,
                "price": item.current_bid,
                "commentary": room.latest_commentary,
            },
        })

        await asyncio.sleep(3)
        await self._advance_to_next_item(room_id)

    async def _complete_auction(self, room_id: str):
        room = self.get_room(room_id)
        if not room:
            return
        room.status = "completed"
        try:
            from ..database import get_supabase
            get_supabase().table("rooms").update({"status": "completed"}).eq("id", room_id).execute()
        except Exception as e:
            print(f"DB complete update failed: {e}")

        results = [
            {
                "id": item.id,
                "name": item.name,
                "base_price": item.base_price,
                "sold_price": item.current_bid if item.status == "sold" else None,
                "winner": item.highest_bidder_name,
                "status": item.status,
                "bid_count": len(item.bid_history),
            }
            for item in room.items
        ]
        await self.manager.broadcast_to_room(room_id, {
            "type": "auction_completed",
            "data": {
                "results": results,
                "participants": [vars(p) for p in room.participants.values()],
            },
        })

    async def admin_next_item(self, room_id: str, user_id: str) -> dict:
        room = self.get_room(room_id)
        if not room:
            return {"error": "Room not found"}
        participant = room.participants.get(user_id)
        if not participant or participant.role != "admin":
            return {"error": "Admin only"}
        if room.timer_task and not room.timer_task.done():
            room.timer_task.cancel()
        await self._advance_to_next_item(room_id)
        return {"ok": True}

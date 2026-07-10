import asyncio
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional
from .council import get_council_valuation
from .auctioneer import generate_commentary
from .shill import compute_shill_score, llm_shill_check
from ..config import settings


@dataclass
class BidRecord:
    user_id: str
    bidder: str
    amount: int
    placed_at: str
    shill_score: float = 0.0
    shill_reason: str = ""


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
    bid_duration: int = 30
    first_bid_duration: int = 120
    scheduled_at: Optional[str] = None


class AuctionService:
    def __init__(self, ws_manager):
        self.manager = ws_manager
        self.rooms: dict[str, RoomState] = {}
        self._bid_locks: dict[str, asyncio.Lock] = {}

    def _get_lock(self, room_id: str) -> asyncio.Lock:
        if room_id not in self._bid_locks:
            self._bid_locks[room_id] = asyncio.Lock()
        return self._bid_locks[room_id]

    def get_or_create_room(self, room_id, room_name, bid_duration=30,
                            first_bid_duration=120, scheduled_at=None):
        if room_id not in self.rooms:
            self.rooms[room_id] = RoomState(
                room_id=room_id, room_name=room_name,
                bid_duration=bid_duration, first_bid_duration=first_bid_duration,
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
                "id": item.id, "name": item.name, "description": item.description,
                "base_price": item.base_price, "photo_url": item.photo_url,
                "current_bid": item.current_bid, "highest_bidder": item.highest_bidder_name,
                "bid_history": [
                    {"bidder": b.bidder, "amount": b.amount,
                     "placed_at": b.placed_at, "shill_score": b.shill_score}
                    for b in item.bid_history[-20:]
                ],
                "status": item.status, "timer_seconds": item.timer_seconds,
                "council_valuation": item.council_valuation,
            }
        return {
            "room_id": room.room_id, "room_name": room.room_name, "status": room.status,
            "participants": [vars(p) for p in room.participants.values()],
            "current_item": current_item,
            "items_total": len(room.items),
            "items_completed": sum(1 for i in room.items if i.status in ("sold", "unsold")),
            "latest_commentary": room.latest_commentary,
            "bid_duration": room.bid_duration, "first_bid_duration": room.first_bid_duration,
            "scheduled_at": room.scheduled_at,
            "items_queue": [
                {"id": item.id, "name": item.name, "photo_url": item.photo_url,
                 "status": item.status, "base_price": item.base_price,
                 "current_bid": item.current_bid}
                for item in room.items
            ],
        }

    async def add_participant(self, room_id, room_name, user_id, display_name,
                               role, budget, spent=0, bid_duration=30,
                               first_bid_duration=120, scheduled_at=None):
        room = self.get_or_create_room(room_id, room_name, bid_duration,
                                        first_bid_duration, scheduled_at)
        room.participants[user_id] = ParticipantState(
            user_id=user_id, display_name=display_name, role=role,
            budget=budget, spent=spent,
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
        """Load items from DB rows, restoring persisted bid/status state."""
        room = self.get_room(room_id)
        if not room:
            return
        room.items = [
            ItemState(
                id=item["id"], name=item["name"],
                description=item.get("description") or "",
                base_price=item["base_price"],
                order_index=item.get("order_index", i),
                current_bid=item.get("current_bid") or item["base_price"],
                status=item.get("status", "pending"),
                highest_bidder_id=item.get("winner_id"),
                highest_bidder_name=item.get("winner_name"),
                photo_url=item.get("photo_url"),
            )
            for i, item in enumerate(sorted(items, key=lambda x: x.get("order_index", 0)))
        ]

    async def reconstruct_state(self, room_id: str, db_status: str):
        """Recover in-memory auction state from DB after reconnect or restart."""
        room = self.get_room(room_id)
        if not room or not room.items:
            return
        if db_status == "auction" and room.status == "lobby":
            room.status = "auction"
            active_idx = next(
                (i for i, item in enumerate(room.items) if item.status == "active"), None
            )
            if active_idx is not None:
                room.current_item_index = active_idx
                item = room.items[active_idx]
                if item.timer_seconds <= 0:
                    item.timer_seconds = room.bid_duration
                if room.timer_task is None or room.timer_task.done():
                    room.timer_task = asyncio.create_task(self._run_timer(room_id))
            else:
                pending_idx = next(
                    (i for i, item in enumerate(room.items) if item.status == "pending"), None
                )
                if pending_idx is not None:
                    room.current_item_index = pending_idx - 1
                    asyncio.create_task(self._advance_to_next_item(room_id))
                else:
                    asyncio.create_task(self._complete_auction(room_id))
        elif db_status == "completed":
            room.status = "completed"

    # ── Persistence (fire-and-forget) ──────────────────────────────────

    async def _persist_bid(self, room_id, item_id, bid: BidRecord, current_bid, winner_id):
        try:
            from ..database import get_supabase
            sb = get_supabase()
            sb.table("bids").insert({
                "item_id": item_id, "room_id": room_id,
                "bidder_id": bid.user_id, "bidder_name": bid.bidder,
                "amount": bid.amount, "shill_score": bid.shill_score,
                "placed_at": bid.placed_at,
            }).execute()
            sb.table("items").update({
                "current_bid": current_bid, "winner_id": winner_id,
                "winner_name": bid.bidder,
            }).eq("id", item_id).execute()
        except Exception as e:
            print(f"[persist_bid] {e}")

    async def _persist_item_resolved(self, item: ItemState):
        try:
            from ..database import get_supabase
            upd: dict = {"status": item.status}
            if item.status == "sold":
                upd.update({
                    "sold_price": item.current_bid, "current_bid": item.current_bid,
                    "winner_id": item.highest_bidder_id,
                    "winner_name": item.highest_bidder_name,
                })
            get_supabase().table("items").update(upd).eq("id", item.id).execute()
        except Exception as e:
            print(f"[persist_resolved] {e}")

    async def _persist_participant_spent(self, room_id, user_id, spent):
        try:
            from ..database import get_supabase
            get_supabase().table("room_participants").update({"spent": spent}).eq(
                "room_id", room_id).eq("user_id", user_id).execute()
        except Exception as e:
            print(f"[persist_spent] {e}")

    # ── Lifecycle ───────────────────────────────────────────────────────

    async def start_auction(self, room_id: str, user_id: str) -> dict:
        room = self.get_room(room_id)
        if not room or room.status != "lobby":
            return {"error": "Room not in lobby state"}
        p = room.participants.get(user_id)
        if not p or p.role != "admin":
            return {"error": "Only admin can start auction"}
        await self._do_start(room_id)
        return {"ok": True}

    async def start_auction_auto(self, room_id: str):
        room = self.get_room(room_id)
        if not room or room.status != "lobby":
            return
        await self._do_start(room_id)

    async def _do_start(self, room_id: str):
        room = self.get_room(room_id)
        room.status = "auction"
        try:
            from ..database import get_supabase
            get_supabase().table("rooms").update({"status": "auction"}).eq("id", room_id).execute()
        except Exception as e:
            print(f"[_do_start] {e}")
        await self.manager.broadcast_to_room(room_id, {
            "type": "auction_started", "data": {"status": "auction"},
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
        item.timer_seconds = room.first_bid_duration
        asyncio.create_task(self._fetch_council(room_id, item))
        try:
            commentary = await generate_commentary(
                item.name, item.base_price, item.base_price, 0,
                item.timer_seconds, [], event_type="starting",
            )
            room.latest_commentary = commentary
        except Exception:
            room.latest_commentary = f"Up next: {item.name}! Opening at \u20b9{item.base_price:,}!"
        await self.manager.broadcast_to_room(room_id, {
            "type": "item_started",
            "data": {
                "item": {
                    "id": item.id, "name": item.name, "description": item.description,
                    "base_price": item.base_price, "photo_url": item.photo_url,
                    "current_bid": item.current_bid, "timer_seconds": item.timer_seconds,
                    "status": item.status, "council_valuation": None,
                },
                "commentary": room.latest_commentary,
            },
        })
        if room.timer_task and not room.timer_task.done():
            room.timer_task.cancel()
        room.timer_task = asyncio.create_task(self._run_timer(room_id))

    async def _fetch_council(self, room_id: str, item: ItemState):
        try:
            valuation = await get_council_valuation(
                item.name, item.base_price,
                description=item.description, photo_url=item.photo_url,
            )
            item.council_valuation = valuation
            await self.manager.broadcast_to_room(room_id, {
                "type": "council_valuation",
                "data": {"item_id": item.id, "valuation": valuation},
            })
        except Exception as e:
            print(f"[council] {item.name}: {e}")
            fallback = {
                "fair_value_low": item.base_price,
                "fair_value_high": int(item.base_price * 1.5),
                "opening_assessment": "fair", "consensus_confidence": "low",
                "suggested_max_bid": int(item.base_price * 1.2),
                "chairman_summary": "AI council temporarily unavailable.",
                "council_opinions": [], "is_fallback": True,
            }
            item.council_valuation = fallback
            await self.manager.broadcast_to_room(room_id, {
                "type": "council_valuation",
                "data": {"item_id": item.id, "valuation": fallback},
            })

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
                    "type": "timer_tick", "data": {"seconds_left": item.timer_seconds},
                })
                if item.timer_seconds in (10, 5):
                    try:
                        bidder_count = len(set(b.user_id for b in item.bid_history))
                        commentary = await generate_commentary(
                            item.name, item.current_bid, item.base_price, bidder_count,
                            item.timer_seconds,
                            [{"bidder": b.bidder, "amount": b.amount} for b in item.bid_history[-3:]],
                            event_type="closing",
                        )
                        room.latest_commentary = commentary
                        await self.manager.broadcast_to_room(room_id, {
                            "type": "commentary_update", "data": {"commentary": commentary},
                        })
                    except Exception:
                        pass
                if item.timer_seconds <= 0:
                    await self._resolve_item(room_id)
                    break
        except asyncio.CancelledError:
            pass

    async def place_bid(self, room_id: str, user_id: str, amount: int) -> dict:
        async with self._get_lock(room_id):
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
                return {"error": f"Bid must beat current \u20b9{item.current_bid:,}"}
            remaining = participant.budget - participant.spent
            if amount > remaining:
                return {"error": f"Insufficient budget — \u20b9{remaining:,} remaining"}

            bid_history_dicts = [
                {"user_id": b.user_id, "amount": b.amount, "placed_at": b.placed_at}
                for b in item.bid_history
            ]
            shill_score, shill_reason = compute_shill_score(bid_history_dicts, user_id)
            bid = BidRecord(
                user_id=user_id, bidder=participant.display_name,
                amount=amount, placed_at=datetime.now(timezone.utc).isoformat(),
                shill_score=shill_score, shill_reason=shill_reason,
            )
            item.bid_history.append(bid)
            item.current_bid = amount
            item.highest_bidder_id = user_id
            item.highest_bidder_name = participant.display_name
            item.timer_seconds = room.bid_duration
            asyncio.create_task(self._persist_bid(room_id, item.id, bid, amount, user_id))
            saved_shill_score = shill_score
            saved_shill_reason = shill_reason

        # Outside lock: commentary + broadcast
        room = self.get_room(room_id)
        item = room.items[room.current_item_index]
        participant = room.participants.get(user_id)
        try:
            bidder_count = len(set(b.user_id for b in item.bid_history))
            commentary = await generate_commentary(
                item.name, amount, item.base_price, bidder_count, item.timer_seconds,
                [{"bidder": b.bidder, "amount": b.amount} for b in item.bid_history[-3:]],
                event_type="bid",
            )
            room.latest_commentary = commentary
        except Exception:
            room.latest_commentary = f"{participant.display_name} bids \u20b9{amount:,}!"

        await self.manager.broadcast_to_room(room_id, {
            "type": "bid_update",
            "data": {
                "item_id": item.id, "current_bid": item.current_bid,
                "highest_bidder": item.highest_bidder_name,
                "bid_history": [
                    {"bidder": b.bidder, "amount": b.amount,
                     "placed_at": b.placed_at, "shill_score": b.shill_score}
                    for b in item.bid_history[-20:]
                ],
                "timer_seconds": item.timer_seconds, "commentary": room.latest_commentary,
            },
        })

        if saved_shill_score >= 0.5:
            admin_ids = [uid for uid, p in room.participants.items() if p.role == "admin"]
            for admin_id in admin_ids:
                await self.manager.send_to_user(room_id, admin_id, {
                    "type": "shill_alert",
                    "data": {
                        "user_id": user_id, "bidder": participant.display_name,
                        "score": saved_shill_score,
                        "reason": saved_shill_reason or "suspicious pattern",
                    },
                })
            if saved_shill_score >= 0.7:
                asyncio.create_task(
                    self._deep_shill_check(room_id, item, user_id,
                                            participant.display_name, admin_ids)
                )
        return {"ok": True, "current_bid": amount}

    async def _deep_shill_check(self, room_id, item, user_id, display_name, admin_ids):
        try:
            bids = [{"bidder": b.bidder, "amount": b.amount, "placed_at": b.placed_at}
                    for b in item.bid_history]
            result = await llm_shill_check(item.name, bids, display_name)
            if result.get("is_shill"):
                for admin_id in admin_ids:
                    await self.manager.send_to_user(room_id, admin_id, {
                        "type": "shill_alert",
                        "data": {
                            "user_id": user_id, "bidder": display_name, "score": 0.85,
                            "reason": f"AI: {result.get('explanation','suspicious')} ({result.get('confidence','low')} confidence)",
                        },
                    })
        except Exception as e:
            print(f"[shill_llm] {e}")

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
                asyncio.create_task(
                    self._persist_participant_spent(room_id, item.highest_bidder_id, winner.spent)
                )
            try:
                commentary = await generate_commentary(
                    item.name, item.current_bid, item.base_price, 0, 0, [], event_type="sold",
                )
                room.latest_commentary = commentary
            except Exception:
                room.latest_commentary = (
                    f"SOLD! {item.name} to {item.highest_bidder_name} for \u20b9{item.current_bid:,}!"
                )
        else:
            item.status = "unsold"
            try:
                commentary = await generate_commentary(
                    item.name, item.current_bid, item.base_price, 0, 0, [], event_type="unsold",
                )
                room.latest_commentary = commentary
            except Exception:
                room.latest_commentary = f"{item.name} goes unsold."

        asyncio.create_task(self._persist_item_resolved(item))
        await self.manager.broadcast_to_room(room_id, {
            "type": "item_resolved",
            "data": {
                "item_id": item.id, "status": item.status,
                "winner": item.highest_bidder_name, "price": item.current_bid,
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
            print(f"[complete] {e}")
        results = [
            {
                "id": item.id, "name": item.name, "description": item.description,
                "photo_url": item.photo_url, "base_price": item.base_price,
                "sold_price": item.current_bid if item.status == "sold" else None,
                "current_bid": item.current_bid,
                "winner": item.highest_bidder_name,
                "winner_name": item.highest_bidder_name,
                "status": item.status, "bid_count": len(item.bid_history),
            }
            for item in room.items
        ]
        await self.manager.broadcast_to_room(room_id, {
            "type": "auction_completed",
            "data": {"results": results, "participants": [vars(p) for p in room.participants.values()]},
        })

    async def admin_next_item(self, room_id: str, user_id: str) -> dict:
        room = self.get_room(room_id)
        if not room:
            return {"error": "Room not found"}
        p = room.participants.get(user_id)
        if not p or p.role != "admin":
            return {"error": "Admin only"}
        if room.timer_task and not room.timer_task.done():
            room.timer_task.cancel()
        if 0 <= room.current_item_index < len(room.items):
            current = room.items[room.current_item_index]
            if current.status == "active":
                current.status = "unsold"
                asyncio.create_task(self._persist_item_resolved(current))
        await self._advance_to_next_item(room_id)
        return {"ok": True}

import random
import string
from fastapi import APIRouter, HTTPException, Header, Depends, UploadFile, File
from ..database import verify_token, get_supabase
from ..services.registry import auction_service
from ..models import RoomCreate, RoomJoin, ItemCreate

router = APIRouter()


def get_user_id(authorization: str = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload["sub"]


@router.post("/create")
async def create_room(body: RoomCreate, user_id: str = Depends(get_user_id)):
    sb = get_supabase()
    code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    room = sb.table("rooms").insert({
        "code": code,
        "name": body.name,
        "admin_id": user_id,
        "bid_duration": body.bid_duration,
        "first_bid_duration": body.first_bid_duration,
        **( {"scheduled_at": body.scheduled_at} if body.scheduled_at else {} ),
    }).execute()

    room_data = room.data[0]

    # Auto-join creator as admin
    sb.table("room_participants").insert({
        "room_id": room_data["id"],
        "user_id": user_id,
        "display_name": body.admin_name,
        "role": "admin",
        "budget": body.budget,
    }).execute()

    return room_data


@router.post("/join")
async def join_room(body: RoomJoin, user_id: str = Depends(get_user_id)):
    sb = get_supabase()
    room = sb.table("rooms").select("*").eq("code", body.code).execute()
    if not room.data:
        raise HTTPException(status_code=404, detail="Room not found")

    room_data = room.data[0]
    if room_data["status"] == "completed":
        raise HTTPException(status_code=400, detail="Auction already completed")

    sb.table("room_participants").upsert({
        "room_id": room_data["id"],
        "user_id": user_id,
        "display_name": body.display_name,
        "role": "bidder",
        "budget": body.budget,
    }).execute()

    return room_data


@router.get("/mine")
async def my_rooms(user_id: str = Depends(get_user_id)):
    sb = get_supabase()
    rooms = (
        sb.table("rooms")
        .select("id,name,code,status,created_at,scheduled_at,bid_duration,first_bid_duration")
        .eq("admin_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    result = []
    for r in rooms.data:
        items_r = sb.table("items").select("id,name,status,current_bid,base_price").eq("room_id", r["id"]).execute()
        bids_r  = sb.table("bids").select("id").eq("room_id", r["id"]).execute()
        result.append({
            **r,
            "items": items_r.data,
            "total_bids": len(bids_r.data),
        })
    return result



@router.get("/bids/mine")
async def my_bids(user_id: str = Depends(get_user_id)):
    sb = get_supabase()
    bids = (
        sb.table("bids")
        .select("*, items(name, photo_url), rooms(name, status, code)")
        .eq("bidder_id", user_id)
        .order("placed_at", desc=True)
        .execute()
    )
    return bids.data


@router.delete("/bids/{bid_id}")
async def delete_bid(bid_id: str, user_id: str = Depends(get_user_id)):
    sb = get_supabase()
    bid = sb.table("bids").select("bidder_id, room_id").eq("id", bid_id).execute()
    if not bid.data:
        raise HTTPException(status_code=404, detail="Bid not found")
    b = bid.data[0]
    if b["bidder_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your bid")
    # Only allow deleting bids from completed rooms
    room = sb.table("rooms").select("status").eq("id", b["room_id"]).execute()
    if room.data and room.data[0]["status"] != "completed":
        raise HTTPException(status_code=400, detail="Can only remove bids from completed auctions")
    sb.table("bids").delete().eq("id", bid_id).execute()
    return {"ok": True}

@router.get("/{room_id}")
async def get_room(room_id: str, user_id: str = Depends(get_user_id)):
    sb = get_supabase()
    room = sb.table("rooms").select("*").eq("id", room_id).execute()
    if not room.data:
        raise HTTPException(status_code=404, detail="Room not found")

    items = sb.table("items").select("*").eq("room_id", room_id).order("order_index").execute()
    participants = sb.table("room_participants").select("*").eq("room_id", room_id).execute()

    return {
        **room.data[0],
        "items": items.data,
        "participants": participants.data,
    }


@router.post("/{room_id}/items")
async def add_item(room_id: str, body: ItemCreate, user_id: str = Depends(get_user_id)):
    sb = get_supabase()
    participant = (
        sb.table("room_participants")
        .select("role")
        .eq("room_id", room_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not participant.data or participant.data[0]["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    item = sb.table("items").insert({
        "room_id": room_id,
        "name": body.name,
        "description": body.description,
        "base_price": body.base_price,
        "order_index": body.order_index,
        **({"photo_url": body.photo_url} if body.photo_url else {}),
    }).execute()
    row = item.data[0]
    # If auction is live, append to in-memory queue and notify clients
    room_state = auction_service.get_room(room_id)
    if room_state:
        from ..services.auction import ItemState
        import asyncio
        new_item = ItemState(
            id=row["id"], name=row["name"],
            description=row.get("description", ""),
            base_price=row["base_price"],
            order_index=len(room_state.items),
            current_bid=row["base_price"],
            photo_url=row.get("photo_url"),
        )
        room_state.items.append(new_item)
        asyncio.create_task(auction_service.manager.broadcast_to_room(room_id, {
            "type": "item_added",
            "data": {
                "id": row["id"], "name": row["name"],
                "description": row.get("description",""),
                "base_price": row["base_price"],
                "photo_url": row.get("photo_url"),
                "items_total": len(room_state.items),
            },
        }))
    return row


@router.get("/{room_id}/results")
async def get_results(room_id: str, user_id: str = Depends(get_user_id)):
    sb = get_supabase()
    items = sb.table("items").select("*").eq("room_id", room_id).order("order_index").execute()
    participants = sb.table("room_participants").select("*").eq("room_id", room_id).execute()
    bids = sb.table("bids").select("*").eq("room_id", room_id).execute()
    # Map DB column names to frontend-expected field names
    mapped_items = [
        {**item, "winner": item.get("winner_name"), "sold_price": item.get("sold_price") or item.get("current_bid") if item.get("status") == "sold" else None}
        for item in items.data
    ]
    return {
        "items": mapped_items,
        "participants": participants.data,
        "total_bids": len(bids.data),
    }



@router.post("/{room_id}/items/{item_id}/photo")
async def upload_item_photo(
    room_id: str,
    item_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_user_id),
):
    sb = get_supabase()
    content = await file.read()
    ext = (file.filename or "photo.jpg").rsplit(".", 1)[-1].lower()
    path = f"{room_id}/{item_id}.{ext}"
    sb.storage.from_("item-photos").upload(
        path, content,
        {"content-type": file.content_type or "image/jpeg", "upsert": "true"}
    )
    pub_url = sb.storage.from_("item-photos").get_public_url(path)
    sb.table("items").update({"photo_url": pub_url}).eq("id", item_id).execute()
    return {"photo_url": pub_url}


import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import settings
from .database import verify_token, get_supabase
from .ws_manager import ConnectionManager
from .services.auction import AuctionService
from .services.auctioneer import stream_commentary
from .routers import auth, rooms

manager = ConnectionManager()
auction_service = AuctionService(manager)

app = FastAPI(title="AI Auction Room")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(rooms.router, prefix="/api/rooms", tags=["rooms"])


@app.websocket("/ws/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...),
):
    # Authenticate the connecting user
    payload = verify_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    user_id = payload["sub"]

    # Verify room exists in Supabase
    sb = get_supabase()
    room_data = sb.table("rooms").select("*").eq("id", room_id).execute()
    if not room_data.data:
        await websocket.close(code=4004)
        return

    room_info = room_data.data[0]

    # Verify participant is registered for this room
    participant_data = (
        sb.table("room_participants")
        .select("*")
        .eq("room_id", room_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not participant_data.data:
        await websocket.close(code=4003)
        return

    participant = participant_data.data[0]

    await manager.connect(room_id, user_id, websocket)

    # Register participant in in-memory auction state
    await auction_service.add_participant(
        room_id,
        room_info["name"],
        user_id,
        participant["display_name"],
        participant["role"],
        participant["budget"],
    )

    # Lazily load items the first time anyone connects to this room
    room_state = auction_service.get_room(room_id)
    if room_state and not room_state.items:
        items_data = (
            sb.table("items")
            .select("*")
            .eq("room_id", room_id)
            .order("order_index")
            .execute()
        )
        if items_data.data:
            await auction_service.load_items(room_id, items_data.data)

    # Send full current state to this specific client
    await manager.send_to_user(room_id, user_id, {
        "type": "room_state",
        "data": auction_service.room_state_dict(auction_service.get_room(room_id)),
    })

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")
            data = msg.get("data", {})

            if msg_type == "place_bid":
                result = await auction_service.place_bid(
                    room_id, user_id, data.get("amount", 0)
                )
                if "error" in result:
                    await manager.send_to_user(room_id, user_id, {
                        "type": "error",
                        "data": result,
                    })

            elif msg_type == "start_auction":
                result = await auction_service.start_auction(room_id, user_id)
                if "error" in result:
                    await manager.send_to_user(room_id, user_id, {
                        "type": "error",
                        "data": result,
                    })

            elif msg_type == "next_item":
                result = await auction_service.admin_next_item(room_id, user_id)
                if result and "error" in result:
                    await manager.send_to_user(room_id, user_id, {
                        "type": "error",
                        "data": result,
                    })

            elif msg_type == "ping":
                await manager.send_to_user(room_id, user_id, {"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(room_id, user_id)
        await auction_service.mark_disconnected(room_id, user_id)


@app.get("/api/rooms/{room_id}/commentary/stream")
async def commentary_stream(room_id: str, token: str = Query(...)):
    """SSE endpoint for streaming auctioneer commentary tokens."""
    payload = verify_token(token)
    if not payload:
        return {"error": "Unauthorized"}

    room = auction_service.get_room(room_id)
    if not room or room.current_item_index < 0:
        return {"error": "No active auction"}

    item = room.items[room.current_item_index]

    async def event_stream():
        async for token_text in stream_commentary(
            item.name,
            item.current_bid,
            item.base_price,
            len(set(b.user_id for b in item.bid_history if hasattr(b, "user_id"))),
            item.timer_seconds,
        ):
            yield f"data: {json.dumps({'token': token_text})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
async def health():
    return {"status": "ok"}

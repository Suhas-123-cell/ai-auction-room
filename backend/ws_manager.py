from fastapi import WebSocket
import json


class ConnectionManager:
    def __init__(self):
        # room_id -> {user_id -> WebSocket}
        self.rooms: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, room_id: str, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = {}
        self.rooms[room_id][user_id] = websocket

    def disconnect(self, room_id: str, user_id: str):
        if room_id in self.rooms:
            self.rooms[room_id].pop(user_id, None)

    async def broadcast_to_room(self, room_id: str, message: dict):
        if room_id not in self.rooms:
            return
        dead = []
        for user_id, ws in self.rooms[room_id].items():
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(user_id)
        for uid in dead:
            self.rooms[room_id].pop(uid, None)

    async def send_to_user(self, room_id: str, user_id: str, message: dict):
        ws = self.rooms.get(room_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                self.rooms.get(room_id, {}).pop(user_id, None)

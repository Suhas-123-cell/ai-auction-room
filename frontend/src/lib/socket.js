const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000'

export function createRoomSocket(roomId, token, handlers) {
  const ws = new WebSocket(`${WS_BASE}/ws/${roomId}?token=${token}`)
  ws.onopen    = () => handlers.onOpen?.()
  ws.onclose   = (e) => handlers.onClose?.(e)
  ws.onerror   = (e) => handlers.onError?.(e)
  ws.onmessage = (e) => { try { handlers.onMessage?.(JSON.parse(e.data)) } catch {} }
  const send = (type, data = {}) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, data }))
  }
  return { ws, send }
}

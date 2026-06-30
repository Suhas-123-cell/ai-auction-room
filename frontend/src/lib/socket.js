// Derive WebSocket base URL:
// - If VITE_API_URL is set (separate deploy): convert https://host → wss://host
// - If empty (same-origin deploy or dev): use window.location so Vite proxy works in dev
//   and the same host works in prod
const _api = import.meta.env.VITE_API_URL || ''
const WS_BASE = _api
  ? _api.replace(/^http/, 'ws')
  : `${typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws'}://${typeof window !== 'undefined' ? window.location.host : 'localhost:8000'}`

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

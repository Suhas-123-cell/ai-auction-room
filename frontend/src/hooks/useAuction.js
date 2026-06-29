import { useEffect, useRef, useState, useCallback } from 'react'
import { createRoomSocket } from '../lib/socket.js'
import { getToken } from '../lib/supabase.js'

const INIT = {
  status: 'lobby', roomName: '', participants: [], currentItem: null,
  itemsTotal: 0, itemsCompleted: 0, latestCommentary: '',
  results: null, shillAlerts: [], error: null, connected: false,
}

export function useAuction(roomId) {
  const [state, setState] = useState(INIT)
  const sendRef = useRef(null)

  const patch = (delta) => setState(s => ({ ...s, ...delta }))

  useEffect(() => {
    if (!roomId) return
    let mounted = true

    getToken().then(token => {
      if (!mounted || !token) return
      const { ws, send } = createRoomSocket(roomId, token, {
        onOpen:  () => patch({ connected: true, error: null }),
        onClose: () => patch({ connected: false }),
        onError: () => patch({ error: 'Connection lost. Refresh to reconnect.' }),
        onMessage: (msg) => {
          if (!mounted) return
          switch (msg.type) {
            case 'room_state':
              patch({
                status: msg.data.status, roomName: msg.data.room_name,
                participants: msg.data.participants, currentItem: msg.data.current_item,
                itemsTotal: msg.data.items_total, itemsCompleted: msg.data.items_completed,
                latestCommentary: msg.data.latest_commentary,
              }); break
            case 'participant_update': patch({ participants: msg.data.participants }); break
            case 'auction_started':   patch({ status: 'auction' }); break
            case 'item_started':
              patch({ currentItem: msg.data.item, latestCommentary: msg.data.commentary }); break
            case 'bid_update':
              setState(s => ({ ...s,
                currentItem: s.currentItem ? {
                  ...s.currentItem,
                  current_bid: msg.data.current_bid, highest_bidder: msg.data.highest_bidder,
                  bid_history: msg.data.bid_history, timer_seconds: msg.data.timer_seconds,
                } : null,
                latestCommentary: msg.data.commentary,
              })); break
            case 'timer_tick':
              setState(s => ({ ...s, currentItem: s.currentItem
                ? { ...s.currentItem, timer_seconds: msg.data.seconds_left } : null })); break
            case 'council_valuation':
              setState(s => ({ ...s, currentItem: s.currentItem?.id === msg.data.item_id
                ? { ...s.currentItem, council_valuation: msg.data.valuation } : s.currentItem })); break
            case 'commentary_update': patch({ latestCommentary: msg.data.commentary }); break
            case 'item_resolved':
              setState(s => ({ ...s, itemsCompleted: s.itemsCompleted + 1,
                currentItem: s.currentItem ? { ...s.currentItem, status: msg.data.status } : null,
                latestCommentary: msg.data.commentary,
              })); break
            case 'auction_completed': patch({ status: 'completed', results: msg.data }); break
            case 'item_added':
              setState(s => ({ ...s, itemsTotal: msg.data.items_total })); break
            case 'shill_alert':
              setState(s => ({ ...s, shillAlerts: [msg.data, ...s.shillAlerts.slice(0,4)] })); break
            case 'error': patch({ error: msg.data.message }); break
          }
        },
      })
      sendRef.current = send
      return () => { mounted = false; ws.close() }
    })
    return () => { mounted = false }
  }, [roomId])

  return {
    ...state,
    placeBid:     useCallback((amount) => sendRef.current?.('place_bid', { amount }), []),
    startAuction: useCallback(() => sendRef.current?.('start_auction'), []),
    nextItem:     useCallback(() => sendRef.current?.('next_item'), []),
    sendMsg:      useCallback((type, data) => sendRef.current?.(type, data), []),
  }
}

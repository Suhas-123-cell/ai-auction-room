import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useAuction } from '../hooks/useAuction.js'
import { getToken } from '../lib/supabase.js'
import ItemDisplay from '../components/ItemDisplay.jsx'
import BidPanel from '../components/BidPanel.jsx'
import BidFeed from '../components/BidFeed.jsx'
import CouncilValuation from '../components/CouncilValuation.jsx'
import AuctioneerTicker from '../components/AuctioneerTicker.jsx'
import ParticipantsList from '../components/ParticipantsList.jsx'

const API        = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const TIMER_TOTAL = Number(import.meta.env.VITE_AUCTION_TIMER ?? 30)

export default function AuctionRoom() {
  const { roomId } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const auction = useAuction(roomId)
  const { status, roomName, participants, currentItem,
          itemsTotal, itemsCompleted, latestCommentary,
          results, shillAlerts, error, connected,
          placeBid, startAuction, nextItem } = auction

  const [roomCode, setRoomCode]         = useState('')
  const [councilLoading, setCLoading]   = useState(false)

  const me      = participants.find(p => p.user_id === user?.id)
  const isAdmin = me?.role === 'admin'

  useEffect(() => {
    if (!roomId) return
    getToken().then(token =>
      fetch(`${API}/api/rooms/${roomId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.code) setRoomCode(d.code) })
        .catch(()=>{})
    )
  }, [roomId])

  useEffect(() => {
    if (currentItem?.status === 'active' && !currentItem.council_valuation) setCLoading(true)
    else setCLoading(false)
  }, [currentItem?.id, currentItem?.council_valuation])

  useEffect(() => {
    if (status === 'completed') setTimeout(() => nav(`/room/${roomId}/results`, { state: { results, roomName } }), 2500)
  }, [status])

  if (!connected && !error) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}>
      <span className="spinner" style={{width:24,height:24,borderWidth:3}} />
      <span style={{color:'var(--text-3)',fontSize:13}}>Connecting to auction room…</span>
    </div>
  )

  /* ── LOBBY ── */
  if (status === 'lobby') return (
    <>
      <header className="app-header">
        <span className="logo">AI Auction Room</span>
        <div className="header-right">
          <span className="badge pending">{status}</span>
          <span style={{fontSize:12,color:'var(--text-3)'}}>{participants.length} joined</span>
        </div>
      </header>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'calc(100vh - 52px)',gap:28,padding:32}}>
        <div style={{textAlign:'center'}}>
          <p style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Auction Room</p>
          <h1 style={{fontSize:28,fontWeight:800}}>{roomName}</h1>
        </div>
        {roomCode && (
          <div style={{textAlign:'center'}}>
            <p style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>Share this code</p>
            <div className="lobby-code">{roomCode}</div>
            <p className="lobby-hint">Others join from the dashboard using this code</p>
          </div>
        )}
        <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',maxWidth:500}}>
          {participants.map(p => (
            <div key={p.user_id} className="lobby-chip">
              <span className="participant-dot" />{p.display_name}
              {p.role==='admin' && <span className="participant-role">admin</span>}
            </div>
          ))}
        </div>
        {isAdmin
          ? <div style={{textAlign:'center'}}>
              <button className="btn btn-primary" style={{width:200,marginBottom:8}} onClick={startAuction}>Start Auction</button>
              <p style={{fontSize:12,color:'var(--text-3)'}}>{itemsTotal} items queued</p>
            </div>
          : <p style={{color:'var(--text-3)',fontSize:13}}>Waiting for admin to start the auction…</p>
        }
        {error && <div className="error-msg">{error}</div>}
      </div>
    </>
  )

  /* ── AUCTION ── */
  const bids = currentItem?.bid_history ?? []

  return (
    <>
      <header className="app-header">
        <span className="logo">{roomName || 'Auction Room'}</span>
        <div className="header-right">
          <span className="badge active" style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'var(--amber)',animation:'pulse 1.5s infinite',display:'inline-block'}} />
            Live
          </span>
          <span style={{fontSize:12,color:'var(--text-3)'}}>{itemsCompleted}/{itemsTotal}</span>
          <span style={{fontSize:12,color:connected?'var(--green)':'var(--red)',display:'flex',alignItems:'center',gap:4}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:'currentColor',display:'inline-block'}} />
            {connected ? 'Connected' : 'Reconnecting'}
          </span>
        </div>
      </header>

      <div className="auction-room">
        {/* LEFT */}
        <div className="auction-left">
          {error && <div className="error-msg">{error}</div>}
          {isAdmin && shillAlerts.map((a, i) => (
            <div key={i} className="shill-alert">
              <span style={{color:'var(--red)',fontWeight:700,flexShrink:0}}>!</span>
              <span className="shill-alert-text">
                <strong>{a.bidder}</strong> flagged for shill bidding{a.reason ? ` — ${a.reason}` : ''}
                {' '}(score: {(a.score*100).toFixed(0)}%)
              </span>
            </div>
          ))}
          <ItemDisplay item={currentItem} timerTotal={TIMER_TOTAL} />
          <CouncilValuation valuation={currentItem?.council_valuation} loading={councilLoading} />
          {itemsTotal > 1 && (
            <div className="items-queue panel">
              <div className="items-queue-header">Item Queue</div>
              <div className="item-queue-row active">
                <span className="item-queue-name">{currentItem?.name ?? '—'}</span>
                <span className="badge active">now</span>
              </div>
              <div className="item-queue-row" style={{padding:'8px 14px'}}>
                <span style={{fontSize:12,color:'var(--text-3)'}}>
                  {Math.max(0, itemsTotal - itemsCompleted - 1)} more items remaining
                </span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="auction-right">
          {isAdmin && (
            <div className="admin-controls">
              <button className="admin-btn next" onClick={nextItem}>Skip Item</button>
            </div>
          )}
          <BidPanel
            currentBid={currentItem?.current_bid ?? 0}
            highestBidder={currentItem?.highest_bidder}
            onBid={placeBid}
            disabled={!connected || currentItem?.status !== 'active' || (currentItem?.timer_seconds ?? 0) <= 0}
          />
          <div className="panel-header" style={{padding:'10px 16px'}}>
            <span className="panel-label">Live Bid Feed</span>
            <span style={{fontSize:12,color:'var(--text-3)'}}>{bids.length} bids</span>
          </div>
          <BidFeed bids={bids} currentBid={currentItem?.current_bid} />
          <div className="divider" />
          <ParticipantsList participants={participants} />
        </div>

        <AuctioneerTicker commentary={latestCommentary} />
      </div>

      {status === 'completed' && (
        <div className="overlay">
          <div className="overlay-card">
            <div className="big-text">Auction Complete</div>
            <p style={{color:'var(--text-3)',fontSize:14,marginTop:8}}>Redirecting to results…</p>
          </div>
        </div>
      )}
    </>
  )
}

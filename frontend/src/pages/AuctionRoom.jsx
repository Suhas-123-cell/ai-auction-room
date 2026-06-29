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
import Timer from '../components/Timer.jsx'

const API        = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const TIMER_TOTAL = Number(import.meta.env.VITE_AUCTION_TIMER ?? 30)

export default function AuctionRoom() {
  const { roomId } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const {
    status, roomName, participants, currentItem,
    itemsTotal, itemsCompleted, latestCommentary,
    results, shillAlerts, error, connected,
    placeBid, startAuction, nextItem,
  } = useAuction(roomId)

  const [roomCode,      setRoomCode]   = useState('')
  const [scheduledAt,   setScheduledAt] = useState(null)
  const [countdown,     setCountdown]   = useState('')
  const [councilLoading, setCLoading]  = useState(false)

  const me      = participants.find(p => p.user_id === user?.id)
  const isAdmin = me?.role === 'admin'
  const lotNum  = (itemsCompleted ?? 0) + 1

  useEffect(() => {
    if (!roomId) return
    getToken().then(token =>
      fetch(`${API}/api/rooms/${roomId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.code) setRoomCode(d.code)
          if (d?.scheduled_at) setScheduledAt(new Date(d.scheduled_at))
        })
        .catch(()=>{})
    )
  }, [roomId])

  useEffect(() => {
    if (!scheduledAt) return
    const tick = () => {
      const diff = scheduledAt - Date.now()
      if (diff <= 0) { setCountdown('Starting now…'); return }
      const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000)
      setCountdown(h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`)
    }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [scheduledAt])

  useEffect(() => {
    if (currentItem?.status==='active' && !currentItem.council_valuation) setCLoading(true)
    else setCLoading(false)
  }, [currentItem?.id, currentItem?.council_valuation])

  useEffect(() => {
    if (status==='completed') setTimeout(() => nav(`/room/${roomId}/results`,{state:{results,roomName}}), 2500)
  }, [status])

  if (!connected && !error) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}>
      <span className="spinner" style={{width:28,height:28,borderWidth:3}} />
      <span style={{color:'var(--text-2)',fontSize:14}}>Connecting to auction room…</span>
    </div>
  )

  /* ── LOBBY ── */
  if (status==='lobby') return (
    <>
      <header className="app-header">
        <div className="logo">AI <span>Auction</span> Room</div>
        <div className="header-right">
          <span className="badge pending">Lobby</span>
          <span style={{fontSize:12,color:'var(--text-3)'}}>{participants.length} joined</span>
        </div>
      </header>
      <div className="lobby-page">
        <h1 className="lobby-room-name">{roomName}</h1>
        {roomCode && (
          <div className="lobby-code-wrap">
            <div className="lobby-code-label">Share this code to invite bidders</div>
            <div className="lobby-code">{roomCode}</div>
            <p className="lobby-hint">Others join from the dashboard using this code</p>
          </div>
        )}
        <div className="lobby-participants">
          {participants.map(p => (
            <div key={p.user_id} className="lobby-chip">
              <span className="pdot" />
              {p.display_name}
              {p.role==='admin' && <span className="role-tag">admin</span>}
            </div>
          ))}
        </div>
        {isAdmin ? (
          <div style={{textAlign:'center'}}>
            {scheduledAt && countdown && (
              <div style={{marginBottom:16,padding:'12px 24px',background:'rgba(201,168,76,0.08)',border:'1px solid var(--gold-border)',borderRadius:'var(--r)',display:'inline-block'}}>
                <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>Scheduled start</div>
                <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:700,color:'var(--gold)'}}>{countdown}</div>
                <div style={{fontSize:11,color:'var(--text-3)',marginTop:4}}>{scheduledAt.toLocaleString()}</div>
              </div>
            )}
            <button className="btn btn-primary" style={{width:220,marginBottom:8}} onClick={startAuction}>
              🔨 {scheduledAt ? 'Start Now (override)' : 'Start Auction'}
            </button>
            <p style={{fontSize:12,color:'var(--text-3)'}}>{itemsTotal} item{itemsTotal!==1?'s':''} queued</p>
          </div>
        ) : (
          <div style={{textAlign:'center'}}>
            {scheduledAt && countdown && (
              <div style={{marginBottom:16,padding:'12px 24px',background:'rgba(201,168,76,0.08)',border:'1px solid var(--gold-border)',borderRadius:'var(--r)',display:'inline-block'}}>
                <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>Auction starts in</div>
                <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:700,color:'var(--gold)'}}>{countdown}</div>
                <div style={{fontSize:11,color:'var(--text-3)',marginTop:4}}>{scheduledAt.toLocaleString()}</div>
              </div>
            )}
            <p style={{color:'var(--text-3)',fontSize:14}}>Waiting for the auctioneer to begin…</p>
          </div>
        )}
        {error && <div className="error-msg">{error}</div>}
      </div>
    </>
  )

  /* ── AUCTION ── */
  const bids = currentItem?.bid_history ?? []

  return (
    <>
      <header className="app-header">
        <div className="logo">AI <span>Auction</span> Room</div>
        <div className="header-right" style={{gap:12}}>
          <span className="badge active" style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'var(--green)',animation:'livePulse 2s infinite',display:'inline-block'}} />
            Live
          </span>
          <span style={{fontSize:12,color:'var(--text-2)',fontFamily:'var(--mono)'}}>
            {itemsCompleted}/{itemsTotal} items
          </span>
          <span style={{fontSize:12,display:'flex',alignItems:'center',gap:4,color:connected?'var(--green)':'var(--red)'}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:'currentColor',display:'inline-block'}} />
            {connected ? roomName : 'Reconnecting…'}
          </span>
        </div>
      </header>

      <div className="auction-wrapper">
        {/* LEFT */}
        <div className="auction-left">
          {error && <div className="shill-alert"><span className="shill-alert-icon">⚠</span>{error}</div>}

          {isAdmin && shillAlerts.map((a,i) => (
            <div key={i} className="shill-alert">
              <span className="shill-alert-icon">🚨</span>
              <span><strong>{a.bidder}</strong> flagged for shill bidding — {a.reason ?? 'suspicious pattern'} (score: {((a.score??0)*100).toFixed(0)}%)</span>
            </div>
          ))}

          <ItemDisplay item={currentItem} lotNumber={lotNum} timerTotal={TIMER_TOTAL} />
          <CouncilValuation valuation={currentItem?.council_valuation} loading={councilLoading} />

          {itemsTotal > 1 && (
            <div className="queue-card">
              <div className="queue-header">Item Queue</div>
              <div className="queue-row now">
                <span className="queue-name">{currentItem?.name ?? '—'}</span>
                <span className="badge active">now</span>
              </div>
              <div className="queue-row">
                <span className="queue-name" style={{color:'var(--text-3)',fontSize:13}}>
                  {Math.max(0,itemsTotal-itemsCompleted-1)} more items remaining
                </span>
                <span className="queue-base">of {itemsTotal} total</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="auction-right">
          {isAdmin && (
            <div className="admin-controls">
              <button className="admin-btn next" onClick={nextItem}>⏭ Skip Item</button>
            </div>
          )}

          <Timer
            seconds={currentItem?.timer_seconds ?? 0}
            total={TIMER_TOTAL}
          />

          <BidPanel
            currentBid={currentItem?.current_bid ?? 0}
            highestBidder={currentItem?.highest_bidder}
            onBid={placeBid}
            disabled={!connected || currentItem?.status!=='active' || (currentItem?.timer_seconds??0)<=0}
          />

          <BidFeed bids={bids} currentBid={currentItem?.current_bid} />
          <ParticipantsList participants={participants} />
        </div>

        <AuctioneerTicker commentary={latestCommentary} />
      </div>

      {status==='completed' && (
        <div className="overlay">
          <div className="overlay-card">
            <div className="overlay-title">🔨 Auction Complete</div>
            <p className="overlay-sub">Redirecting to results…</p>
          </div>
        </div>
      )}
    </>
  )
}

import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
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

const API        = import.meta.env.VITE_API_URL || ''
const TIMER_TOTAL = Number(import.meta.env.VITE_AUCTION_TIMER ?? 30)

export default function AuctionRoom() {
  const { roomId } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const {
    status, roomName, participants, currentItem,
    itemsTotal, itemsCompleted, latestCommentary,
    results, shillAlerts, error, connected,
    placeBid, startAuction, nextItem, sendMsg, itemsQueue,
  } = useAuction(roomId)

  const [roomCode,      setRoomCode]   = useState('')
  const [scheduledAt,   setScheduledAt] = useState(null)
  const [countdown,     setCountdown]   = useState('')
  const [councilLoading, setCLoading]  = useState(false)
  const [showAddItem,   setShowAddItem] = useState(false)
  const [newItem,       setNewItem]     = useState({name:'',description:'',base_price:500})
  const [newItemFile,   setNewItemFile] = useState(null)
  const [newItemPreview,setNewItemPrev] = useState('')
  const [addingItem,    setAddingItem]  = useState(false)
  const [addItemErr,    setAddItemErr]  = useState('')

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


  async function addItemToRoom(e) {
    e.preventDefault()
    if (!newItem.name.trim()) return setAddItemErr('Name is required')
    if (!newItemFile) return setAddItemErr('Photo is required')
    setAddingItem(true); setAddItemErr('')
    try {
      const token = await getToken()
      const r = await fetch(`${API}/api/rooms/${roomId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...newItem, base_price: Number(newItem.base_price), order_index: 999 }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail ?? 'Failed') }
      const row = await r.json()
      const fd = new FormData(); fd.append('file', newItemFile)
      await fetch(`${API}/api/rooms/${roomId}/items/${row.id}/photo`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      })
      setNewItem({name:'',description:'',base_price:500})
      setNewItemFile(null); setNewItemPrev(''); setShowAddItem(false)
    } catch(ex) { setAddItemErr(ex.message) }
    finally { setAddingItem(false) }
  }

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
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <button onClick={()=>nav('/dashboard')} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:13,padding:'4px 0',display:'flex',alignItems:'center',gap:6}}>
            ← Dashboard
          </button>
          <div className="logo">AI <span>Auction</span> Room</div>
        </div>
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
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:20}}>
          {scheduledAt && countdown && (
            <div style={{
              padding:'20px 48px',
              background:'rgba(201,168,76,0.07)',
              border:'1px solid var(--gold-border)',
              borderRadius:'var(--r)',
              textAlign:'center',
            }}>
              <div style={{fontSize:10,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:8}}>
                {isAdmin ? 'Scheduled start' : 'Auction starts in'}
              </div>
              <div style={{fontFamily:'var(--mono)',fontSize:30,fontWeight:700,color:'var(--gold)',letterSpacing:'0.04em'}}>
                {countdown}
              </div>
              <div style={{fontSize:11,color:'var(--text-3)',marginTop:8}}>
                {scheduledAt.toLocaleString()}
              </div>
            </div>
          )}
          {isAdmin ? (
            <>
              <button className="btn btn-primary" style={{width:260}} onClick={startAuction}>
                🔨 {scheduledAt ? 'Start Now (override schedule)' : 'Start Auction'}
              </button>
              <p style={{fontSize:12,color:'var(--text-3)',margin:0}}>
                {itemsTotal} item{itemsTotal!==1?'s':''} queued
              </p>
            </>
          ) : (
            <p style={{color:'var(--text-3)',fontSize:14,margin:0}}>
              Waiting for the auctioneer to begin…
            </p>
          )}
        </div>
        {error && <div className="error-msg">{error}</div>}
      </div>
    </>
  )

  /* ── AUCTION ── */
  const bids = currentItem?.bid_history ?? []

  return (
    <>
      <header className="app-header">
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <button onClick={()=>nav('/dashboard')} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:13,padding:'4px 0',display:'flex',alignItems:'center',gap:6}}>
            ← Dashboard
          </button>
          <div className="logo">AI <span>Auction</span> Room</div>
        </div>
        <div className="header-right" style={{gap:12}}>
          {isAdmin && (
            <button onClick={()=>setShowAddItem(true)} style={{background:'rgba(201,168,76,0.1)',border:'1px solid var(--gold-border)',color:'var(--gold)',borderRadius:'var(--r-sm)',padding:'5px 12px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
              + Add Item
            </button>
          )}
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

          {itemsQueue.length > 0 && (
            <div className="queue-card">
              <div className="queue-header">
                Item Queue
                <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text-3)',fontWeight:400,marginLeft:8}}>
                  {itemsCompleted}/{itemsTotal} done
                </span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {itemsQueue.map((item, idx) => {
                  const isCurrent = item.id === currentItem?.id
                  const isDone    = item.status === 'sold' || item.status === 'unsold'
                  return (
                    <div key={item.id} style={{
                      display:'flex',alignItems:'center',gap:10,padding:'6px 8px',
                      borderRadius:'var(--r-sm)',
                      background: isCurrent ? 'rgba(201,168,76,0.08)' : 'transparent',
                      border: isCurrent ? '1px solid var(--gold-border)' : '1px solid transparent',
                      opacity: isDone ? 0.45 : 1,
                    }}>
                      <div style={{
                        width:36,height:36,borderRadius:6,flexShrink:0,overflow:'hidden',
                        background:'var(--bg-raise)',border:'1px solid rgba(255,255,255,0.08)'
                      }}>
                        {item.photo_url
                          ? <img src={item.photo_url} alt={item.name} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                          : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'var(--text-3)'}}>🖼</div>
                        }
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{
                          fontSize:13,fontWeight:600,
                          color: isCurrent ? 'var(--gold)' : isDone ? 'var(--text-3)' : 'var(--text-1)',
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'
                        }}>{item.name}</div>
                        <div style={{fontSize:11,color:'var(--text-3)',fontFamily:'var(--mono)'}}>
                          ₹{(item.current_bid || item.base_price).toLocaleString()}
                        </div>
                      </div>
                      {isCurrent && <span className="badge active" style={{fontSize:10,padding:'2px 6px'}}>live</span>}
                      {item.status==='sold'   && <span style={{fontSize:10,color:'var(--green)',fontWeight:700}}>SOLD</span>}
                      {item.status==='unsold' && <span style={{fontSize:10,color:'var(--red)',fontWeight:700}}>PASS</span>}
                      {!isCurrent && !isDone  && <span style={{fontSize:10,color:'var(--text-3)'}}>{'#'+(idx+1)}</span>}
                    </div>
                  )
                })}
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
      {/* Add Item Modal */}
      {showAddItem && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}} onClick={()=>setShowAddItem(false)}>
          <div style={{background:'var(--bg-card)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'var(--r)',padding:28,width:400,maxWidth:'90vw'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h3 style={{margin:0,fontSize:16,fontFamily:'var(--serif)'}}>Add Item to Queue</h3>
              <button onClick={()=>setShowAddItem(false)} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:20,lineHeight:1}}>×</button>
            </div>
            <form onSubmit={addItemToRoom} style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:10,color:'var(--gold)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',display:'block',marginBottom:5}}>Item Name *</label>
                <input className="form-input" placeholder="e.g. Vintage Rolex Daytona" required value={newItem.name} onChange={e=>setNewItem(p=>({...p,name:e.target.value}))} />
              </div>
              <div>
                <label style={{fontSize:10,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',display:'block',marginBottom:5}}>Description <span style={{fontWeight:400,textTransform:'none',letterSpacing:0}}>(optional)</span></label>
                <textarea className="form-input" placeholder="Provenance, condition, edition notes…" rows={2}
                  value={newItem.description} onChange={e=>setNewItem(p=>({...p,description:e.target.value}))}
                  style={{resize:'vertical',fontFamily:'var(--sans)',fontSize:13}} />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={{fontSize:10,color:'var(--gold)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',display:'block',marginBottom:5}}>Starting Bid ₹ *</label>
                  <input className="form-input mono" type="number" min="1" required value={newItem.base_price} onChange={e=>setNewItem(p=>({...p,base_price:e.target.value}))} />
                </div>
                <div>
                  <label style={{fontSize:10,color:'var(--gold)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',display:'block',marginBottom:5}}>Photo *</label>
                  <label style={{cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                    background:'var(--bg-raise)',
                    border: newItemPreview ? '1px solid rgba(255,255,255,0.15)' : '1px dashed rgba(239,68,68,0.6)',
                    borderRadius:'var(--r-sm)',height:60,overflow:'hidden',position:'relative'}}>
                    {newItemPreview
                      ? <img src={newItemPreview} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                      : <div style={{textAlign:'center'}}>
                          <div style={{fontSize:18,marginBottom:2}}>📷</div>
                          <div style={{fontSize:9,color:'rgba(239,68,68,0.9)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em'}}>Required</div>
                        </div>
                    }
                    <input type="file" accept="image/*" style={{position:'absolute',inset:0,opacity:0,cursor:'pointer'}}
                      onChange={e=>{const f=e.target.files?.[0];if(f){setNewItemFile(f);setNewItemPrev(URL.createObjectURL(f))}}} />
                  </label>
                </div>
              </div>
              {addItemErr && <div style={{fontSize:12,color:'var(--red)',padding:'6px 0'}}>{addItemErr}</div>}
              <button className="btn btn-primary" type="submit" disabled={addingItem} style={{marginTop:2}}>
                {addingItem ? 'Adding to queue…' : '+ Add to Queue'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

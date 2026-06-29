import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { getToken } from '../lib/supabase.js'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function post(path, body, token) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!r.ok) { const d = await r.json().catch(()=>({})); throw new Error(d.detail ?? 'Request failed') }
  return r.json()
}

const EMPTY_ITEM = { name:'', description:'', base_price:500, photo_url:'' }

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const nav = useNavigate()
  const [mode, setMode]   = useState(null)
  const [busy, setBusy]   = useState(false)
  const [err,  setErr]    = useState('')

  // Create
  const [roomName, setRoomName] = useState('')
  const [adminName,setAdmin]    = useState('')
  const [budget,   setBudget]   = useState(50000)
  const [items,    setItems]    = useState([{ ...EMPTY_ITEM }])

  // Join
  const [code,    setCode]    = useState('')
  const [dname,   setDname]   = useState('')
  const [jBudget, setJBudget] = useState(10000)

  // My Bids
  const [bids,      setBids]      = useState([])
  const [bidsLoad,  setBidsLoad]  = useState(false)
  const [deleting,  setDeleting]  = useState(null)

  const loadBids = useCallback(async () => {
    setBidsLoad(true)
    try {
      const token = await getToken()
      const r = await fetch(`${API}/api/rooms/bids/mine`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (r.ok) setBids(await r.json())
    } finally { setBidsLoad(false) }
  }, [])

  useEffect(() => { if (mode === 'bids') loadBids() }, [mode, loadBids])

  async function deleteBid(bid) {
    if (!window.confirm(`Remove bid of ₹${bid.amount.toLocaleString()} from "${bid.rooms?.name}"?`)) return
    setDeleting(bid.id)
    try {
      const token = await getToken()
      const r = await fetch(`${API}/api/rooms/bids/${bid.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })
      if (r.ok) setBids(p => p.filter(b => b.id !== bid.id))
      else { const d = await r.json(); setErr(d.detail ?? 'Delete failed') }
    } finally { setDeleting(null) }
  }

  async function create(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const token = await getToken()
      const room  = await post('/api/rooms/create', { name: roomName, admin_name: adminName, budget }, token)
      for (let i = 0; i < items.length; i++) {
        const it = items[i]; if (!it.name.trim()) continue
        const { _file, photo_url, ...itemData } = it
        const itemR = await fetch(`${API}/api/rooms/${room.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...itemData, base_price: Number(it.base_price), order_index: i }),
        })
        if (_file && itemR.ok) {
          const { id: itemId } = await itemR.json()
          const fd = new FormData(); fd.append('file', _file)
          await fetch(`${API}/api/rooms/${room.id}/items/${itemId}/photo`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
          })
        }
      }
      nav(`/room/${room.id}`)
    } catch(ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  async function join(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const token = await getToken()
      const room  = await post('/api/rooms/join', { code: code.toUpperCase(), display_name: dname, budget: jBudget }, token)
      nav(`/room/${room.id}`)
    } catch(ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  const upd = (i, k, v) => setItems(p => p.map((it, idx) => idx===i ? {...it,[k]:v} : it))
  const addItem = () => setItems(p => [...p, { ...EMPTY_ITEM }])
  const delItem = (i) => setItems(p => p.filter((_,idx) => idx !== i))

  const initials = (email) => email ? email[0].toUpperCase() : '?'

  return (
    <>
      <header className="app-header">
        <div className="logo">AI <span>Auction</span> Room</div>
        <div className="header-right">
          <div style={{width:30,height:30,borderRadius:'50%',background:'var(--bg-raise)',border:'1px solid var(--gold-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'var(--gold)'}}>
            {initials(user?.email)}
          </div>
          <button className="btn btn-ghost" style={{width:'auto',padding:'6px 14px',fontSize:12}} onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="dashboard-page">
        <div className="dashboard-hero">
          <h1>Auction Rooms</h1>
          <p>Create a live auction or join one with a room code</p>
        </div>

        {err && <div className="error-msg" style={{maxWidth:700,marginBottom:24}}>{err}</div>}

        {!mode && (
          <div className="action-cards">
            <div className="action-card" onClick={()=>setMode('create')}>
              <div className="action-card-icon">🔨</div>
              <h3>Create Auction Room</h3>
              <p>Set up a live auction, add items with photos, and invite bidders with a 6-character room code.</p>
              <button className="btn btn-primary" style={{width:'auto',padding:'10px 24px'}} onClick={e=>{e.stopPropagation();setMode('create')}}>
                Create room →
              </button>
            </div>
            <div className="action-card" onClick={()=>setMode('join')}>
              <div className="action-card-icon">🎯</div>
              <h3>Join a Room</h3>
              <p>Enter a room code shared by the host and start bidding immediately in a live auction.</p>
              <button className="btn btn-ghost" style={{width:'auto',padding:'10px 24px'}} onClick={e=>{e.stopPropagation();setMode('join')}}>
                Join room
              </button>
            </div>
            <div className="action-card" onClick={()=>setMode('bids')}>
              <div className="action-card-icon">📋</div>
              <h3>My Bid History</h3>
              <p>View all your current and past bids across every auction room. Remove bids from completed auctions.</p>
              <button className="btn btn-ghost" style={{width:'auto',padding:'10px 24px'}} onClick={e=>{e.stopPropagation();setMode('bids')}}>
                View bids
              </button>
            </div>
          </div>
        )}

        {mode==='create' && (
          <div className="form-panel">
            <div className="form-panel-header">
              <h3>Create Auction Room</h3>
              <button className="btn btn-ghost" style={{width:'auto',padding:'6px 14px',fontSize:12}} onClick={()=>setMode(null)}>← Back</button>
            </div>

            <form onSubmit={create}>
              <div className="form-grid-2" style={{marginBottom:20}}>
                <div className="form-group" style={{marginBottom:0}}>
                  <label className="form-label">Room Name</label>
                  <input className="form-input" required placeholder="IPL Mega Auction 2025" value={roomName} onChange={e=>setRoomName(e.target.value)} />
                </div>
                <div className="form-group" style={{marginBottom:0}}>
                  <label className="form-label">Your Display Name</label>
                  <input className="form-input" required placeholder="Auctioneer" value={adminName} onChange={e=>setAdmin(e.target.value)} />
                </div>
                <div className="form-group" style={{marginBottom:0}}>
                  <label className="form-label">Your Budget (₹)</label>
                  <input className="form-input mono" type="number" min="1000" value={budget} onChange={e=>setBudget(Number(e.target.value))} />
                </div>
              </div>

              <div style={{marginBottom:10,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <label className="form-label" style={{marginBottom:0}}>Auction Items</label>
              </div>

              <div style={{background:'var(--bg-raise)',borderRadius:'var(--r)',padding:'6px',marginBottom:12}}>
                <div style={{display:'grid',gridTemplateColumns:'2fr 2fr 90px 90px 36px',gap:6,padding:'6px 8px',marginBottom:4}}>
                  {['Name','Description','Base ₹','Photo URL',''].map(h => (
                    <div key={h} style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>{h}</div>
                  ))}
                </div>
                <div className="items-list">
                  {items.map((it,i) => (
                    <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 2fr 90px 90px 36px',gap:6,alignItems:'start'}}>
                      <input className="form-input" required placeholder={`Item ${i+1}`} value={it.name} onChange={e=>upd(i,'name',e.target.value)} />
                      <input className="form-input" placeholder="Description" value={it.description} onChange={e=>upd(i,'description',e.target.value)} />
                      <input className="form-input mono" type="number" min="1" value={it.base_price} onChange={e=>upd(i,'base_price',e.target.value)} />
                      <label style={{cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
        background:'var(--bg-raise)',border:'1px dashed rgba(255,255,255,0.12)',borderRadius:'var(--r-sm)',
        height:36,overflow:'hidden',position:'relative'}}>
        {it.photo_url
          ? <img src={it.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
          : <span style={{fontSize:11,color:'var(--text-3)'}}>📷 Photo</span>}
        <input type="file" accept="image/*" style={{position:'absolute',inset:0,opacity:0,cursor:'pointer'}}
          onChange={e=>{const f=e.target.files?.[0];if(f){const u=URL.createObjectURL(f);upd(i,'photo_url',u);upd(i,'_file',f)}}} />
      </label>
                      <button type="button" onClick={()=>delItem(i)}
                        style={{background:'none',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'var(--r-sm)',color:'var(--red)',cursor:'pointer',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="add-item-btn" onClick={addItem}>+ Add item</button>
              </div>

              <button className="btn btn-primary" type="submit" disabled={busy} style={{width:'auto',padding:'12px 32px',marginTop:8}}>
                {busy ? 'Creating…' : 'Create & enter room →'}
              </button>
            </form>
          </div>
        )}

        {mode==='bids' && (
          <div className="form-panel" style={{maxWidth:820}}>
            <div className="form-panel-header">
              <h3>My Bid History</h3>
              <button className="btn btn-ghost" style={{width:'auto',padding:'6px 14px',fontSize:12}} onClick={()=>{setMode(null);setErr('')}}>← Back</button>
            </div>

            {bidsLoad && <div style={{textAlign:'center',padding:'40px 0',color:'var(--text-3)'}}>Loading bids…</div>}

            {!bidsLoad && bids.length === 0 && (
              <div style={{textAlign:'center',padding:'48px 0',color:'var(--text-3)'}}>
                <div style={{fontSize:36,marginBottom:12}}>📭</div>
                <div>No bids yet. Join an auction room to start bidding.</div>
              </div>
            )}

            {!bidsLoad && bids.length > 0 && (
              <>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 100px 90px 90px 36px',gap:8,padding:'6px 12px',marginBottom:4}}>
                  {['Room','Item','Amount','Date','Status',''].map(h=>(
                    <div key={h} style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>{h}</div>
                  ))}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {bids.map(b => {
                    const status = b.rooms?.status ?? 'unknown'
                    const isCompleted = status === 'completed'
                    const statusColor = status==='auction' ? 'var(--gold)' : status==='completed' ? 'var(--text-3)' : '#60a5fa'
                    return (
                      <div key={b.id} style={{
                        display:'grid',gridTemplateColumns:'1fr 1fr 100px 90px 90px 36px',gap:8,alignItems:'center',
                        padding:'10px 12px',background:'var(--bg-raise)',borderRadius:'var(--r-sm)',
                        border:'1px solid rgba(255,255,255,0.06)',
                        opacity: isCompleted ? 0.75 : 1,
                      }}>
                        <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {b.rooms?.name ?? '—'}
                          <div style={{fontSize:10,color:'var(--text-3)',fontFamily:'var(--mono)',marginTop:2}}>{b.rooms?.code}</div>
                        </div>
                        <div style={{fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--text-2)'}}>
                          {b.items?.name ?? '—'}
                        </div>
                        <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:'var(--gold)'}}>
                          ₹{b.amount.toLocaleString()}
                        </div>
                        <div style={{fontSize:11,color:'var(--text-3)'}}>
                          {new Date(b.placed_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                          <div>{new Date(b.placed_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
                        </div>
                        <div style={{fontSize:11,fontWeight:600,color:statusColor,textTransform:'capitalize'}}>
                          {status}
                        </div>
                        <button
                          disabled={!isCompleted || deleting===b.id}
                          onClick={()=>deleteBid(b)}
                          title={isCompleted ? 'Remove this bid' : 'Can only remove bids from completed auctions'}
                          style={{
                            background:'none',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'var(--r-sm)',
                            color: isCompleted ? 'var(--red)' : 'var(--text-3)',
                            cursor: isCompleted ? 'pointer' : 'not-allowed',
                            width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0,
                            opacity: isCompleted ? 1 : 0.35,
                          }}>
                          {deleting===b.id ? '…' : '×'}
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div style={{marginTop:16,fontSize:12,color:'var(--text-3)'}}>
                  {bids.length} bid{bids.length!==1?'s':''} total · Bids from completed auctions can be removed
                </div>
              </>
            )}
          </div>
        )}

        {mode==='join' && (
          <div className="form-panel" style={{maxWidth:440}}>
            <div className="form-panel-header">
              <h3>Join Auction Room</h3>
              <button className="btn btn-ghost" style={{width:'auto',padding:'6px 14px',fontSize:12}} onClick={()=>setMode(null)}>← Back</button>
            </div>
            <form onSubmit={join}>
              <div className="form-group">
                <label className="form-label">Room Code</label>
                <input className="form-input room-code-input" required placeholder="ABC123" maxLength={6}
                  value={code} onChange={e=>setCode(e.target.value.toUpperCase())} />
              </div>
              <div className="form-group">
                <label className="form-label">Your Display Name</label>
                <input className="form-input" required placeholder="Team Rajasthan" value={dname} onChange={e=>setDname(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Your Budget (₹)</label>
                <input className="form-input mono" type="number" min="500" value={jBudget} onChange={e=>setJBudget(Number(e.target.value))} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Joining…' : 'Enter room →'}
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  )
}

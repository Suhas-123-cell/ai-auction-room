import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { getToken } from '../lib/supabase.js'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function api(path, body, token) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!r.ok) { const d = await r.json(); throw new Error(d.detail ?? 'Request failed') }
  return r.json()
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const nav = useNavigate()
  const [mode, setMode]   = useState(null)
  const [busy, setBusy]   = useState(false)
  const [err,  setErr]    = useState('')

  const [roomName, setRoomName]   = useState('')
  const [adminName, setAdmin]     = useState('')
  const [budget, setBudget]       = useState(50000)
  const [items, setItems]         = useState([{ name:'', description:'', base_price:500 }])
  const [code, setCode]           = useState('')
  const [dname, setDname]         = useState('')
  const [jBudget, setJBudget]     = useState(10000)

  async function create(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const token = await getToken()
      const room  = await api('/api/rooms/create', { name: roomName, admin_name: adminName, budget }, token)
      for (let i=0; i<items.length; i++) {
        const it = items[i]; if (!it.name.trim()) continue
        await fetch(`${API}/api/rooms/${room.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...it, base_price: Number(it.base_price), order_index: i }),
        })
      }
      nav(`/room/${room.id}`)
    } catch(ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  async function join(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const token = await getToken()
      const room  = await api('/api/rooms/join', { code: code.toUpperCase(), display_name: dname, budget: jBudget }, token)
      nav(`/room/${room.id}`)
    } catch(ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  const upd = (i, k, v) => setItems(p => p.map((it, idx) => idx===i ? {...it,[k]:v} : it))

  return (
    <>
      <header className="app-header">
        <span className="logo">AI Auction Room</span>
        <div className="header-right">
          <span style={{fontSize:12,color:'var(--text-3)'}}>{user?.email}</span>
          <button className="btn btn-ghost" style={{width:'auto',padding:'6px 14px',fontSize:12}} onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="dashboard-page">
        <h1 className="dashboard-title">Auction Rooms</h1>
        <p className="dashboard-sub">Create a new auction or join one with a room code</p>

        {!mode && (
          <div className="dashboard-cards">
            <div className="dashboard-card">
              <h3>Create Room</h3>
              <p>Set up an auction, add items, and invite bidders with a room code.</p>
              <button className="btn btn-primary" onClick={()=>setMode('create')}>Create room</button>
            </div>
            <div className="dashboard-card">
              <h3>Join Room</h3>
              <p>Enter a code shared by the host and start bidding immediately.</p>
              <button className="btn btn-ghost" onClick={()=>setMode('join')}>Join room</button>
            </div>
          </div>
        )}

        {err && <div className="error-msg">{err}</div>}

        {mode==='create' && (
          <div className="dashboard-card" style={{maxWidth:'100%'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
              <h3>Create Auction Room</h3>
              <button className="btn btn-ghost" style={{width:'auto',padding:'5px 12px',fontSize:12}} onClick={()=>setMode(null)}>Back</button>
            </div>
            <form onSubmit={create}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Room Name</label>
                  <input className="form-input" required placeholder="IPL Auction 2025" value={roomName} onChange={e=>setRoomName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Your Display Name</label>
                  <input className="form-input" required placeholder="Auctioneer" value={adminName} onChange={e=>setAdmin(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Budget (₹)</label>
                  <input className="form-input mono" type="number" min="1000" value={budget} onChange={e=>setBudget(Number(e.target.value))} />
                </div>
              </div>

              <div style={{marginTop:20,marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span className="form-label" style={{marginBottom:0}}>Auction Items</span>
                <button type="button" className="btn btn-ghost" style={{width:'auto',padding:'4px 12px',fontSize:12}}
                  onClick={()=>setItems(p=>[...p,{name:'',description:'',base_price:500}])}>+ Add item</button>
              </div>

              {items.map((it,i) => (
                <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 3fr 1fr',gap:8,marginBottom:8}}>
                  <input className="form-input" required placeholder={`Item ${i+1} name`} value={it.name} onChange={e=>upd(i,'name',e.target.value)} />
                  <input className="form-input" placeholder="Description (optional)" value={it.description} onChange={e=>upd(i,'description',e.target.value)} />
                  <input className="form-input mono" type="number" min="1" placeholder="Base ₹" value={it.base_price} onChange={e=>upd(i,'base_price',e.target.value)} />
                </div>
              ))}

              <button className="btn btn-primary" type="submit" disabled={busy} style={{marginTop:20}}>
                {busy ? 'Creating…' : 'Create & enter room'}
              </button>
            </form>
          </div>
        )}

        {mode==='join' && (
          <div className="dashboard-card" style={{maxWidth:400}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
              <h3>Join Room</h3>
              <button className="btn btn-ghost" style={{width:'auto',padding:'5px 12px',fontSize:12}} onClick={()=>setMode(null)}>Back</button>
            </div>
            <form onSubmit={join}>
              <div className="form-group">
                <label className="form-label">Room Code</label>
                <input className="form-input mono" required placeholder="ABC123" maxLength={6}
                  style={{fontSize:22,letterSpacing:'0.2em',textTransform:'uppercase'}}
                  value={code} onChange={e=>setCode(e.target.value.toUpperCase())} />
              </div>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input className="form-input" required placeholder="Team Rajasthan" value={dname} onChange={e=>setDname(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Budget (₹)</label>
                <input className="form-input mono" type="number" min="500" value={jBudget} onChange={e=>setJBudget(Number(e.target.value))} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Joining…' : 'Join room'}
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  )
}

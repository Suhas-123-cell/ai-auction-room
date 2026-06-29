import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getToken } from '../lib/supabase.js'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export default function Results() {
  const { roomId }   = useParams()
  const { state }    = useLocation()
  const nav          = useNavigate()
  const [data, setData]       = useState(state?.results ?? null)
  const [roomName]            = useState(state?.roomName ?? 'Auction')
  const [loading, setLoading] = useState(!data)

  useEffect(() => {
    if (data) return
    getToken().then(token =>
      fetch(`${API}/api/rooms/${roomId}/results`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(setData).finally(() => setLoading(false))
    )
  }, [roomId])

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}>
      <span className="spinner" style={{width:24,height:24,borderWidth:3}} />
      <span style={{color:'var(--text-2)',fontSize:14}}>Loading results…</span>
    </div>
  )

  const items        = data?.items ?? []
  const participants = data?.participants ?? []
  const sold         = items.filter(i => i.status==='sold')
  const totalRaised  = sold.reduce((s,i) => s+(i.sold_price??i.current_bid??0), 0)

  return (
    <>
      <header className="app-header">
        <div className="logo">AI <span>Auction</span> Room</div>
        <button className="btn btn-ghost" style={{width:'auto',padding:'6px 14px',fontSize:12}} onClick={()=>nav('/')}>
          ← Back to dashboard
        </button>
      </header>
      <div className="results-page">
        <h1 className="results-title">🏆 {roomName}</h1>
        <p className="results-sub">
          {sold.length} of {items.length} items sold &nbsp;·&nbsp;
          Total raised: <span style={{color:'var(--gold)',fontFamily:'var(--mono)',fontWeight:700}}>₹{totalRaised.toLocaleString('en-IN')}</span>
        </p>

        <table className="results-table" style={{marginBottom:40}}>
          <thead>
            <tr>
              <th>Lot</th><th>Item</th><th>Base</th><th>Final Price</th><th>Winner</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item,i) => (
              <tr key={item.id}>
                <td style={{color:'var(--text-3)',fontFamily:'var(--mono)',fontWeight:700}}>#{String(i+1).padStart(2,'0')}</td>
                <td style={{fontWeight:600}}>{item.name}</td>
                <td style={{fontFamily:'var(--mono)',color:'var(--text-3)'}}>₹{item.base_price?.toLocaleString('en-IN')}</td>
                <td className="price-cell">{item.sold_price ? `₹${item.sold_price.toLocaleString('en-IN')}` : '—'}</td>
                <td style={{color:'var(--text-2)'}}>{item.winner ?? '—'}</td>
                <td><span className={`badge ${item.status}`}>{item.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={{fontSize:18,fontWeight:700,fontFamily:'var(--serif)',marginBottom:16}}>Team Summary</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14}}>
          {participants.map(p => {
            const won   = items.filter(i => i.winner===p.display_name && i.status==='sold')
            const spent = won.reduce((s,i)=>s+(i.sold_price??0),0)
            return (
              <div key={p.user_id} style={{background:'var(--bg-card)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'var(--r-lg)',padding:20}}>
                <div style={{fontWeight:700,marginBottom:6,fontSize:15}}>{p.display_name}</div>
                {p.role==='admin' && <span className="p-role" style={{display:'inline-block',marginBottom:8}}>admin</span>}
                <div style={{fontSize:12,color:'var(--text-3)',marginBottom:4}}>{won.length} item{won.length!==1?'s':''} won</div>
                <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:700,color:'var(--gold)'}}>₹{spent.toLocaleString('en-IN')}</div>
                <div style={{fontSize:11,color:'var(--text-3)'}}>of ₹{p.budget?.toLocaleString('en-IN')} budget</div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

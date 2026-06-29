import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

const FEATURES = [
  { icon: '🔨', title: 'Live Real-Time Bidding', desc: 'Server-authoritative countdown with anti-sniping protection' },
  { icon: '🧠', title: 'LLM Council Valuation', desc: 'Llama · Gemma · Mixtral deliberate on fair value — Chairman synthesizes' },
  { icon: '🎙️', title: 'AI Auctioneer', desc: 'Streaming commentary that reacts to every bid in real time' },
  { icon: '🛡️', title: 'Shill Bid Detection', desc: 'AI flags suspicious bidding patterns instantly' },
]

export default function Login() {
  const [tab,    setTab]    = useState('signin')
  const [email,  setEmail]  = useState('')
  const [pass,   setPass]   = useState('')
  const [error,  setError]  = useState('')
  const [busy,   setBusy]   = useState(false)

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true)
    const { error: err } = tab === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password: pass })
      : await supabase.auth.signUp({ email, password: pass })
    if (err) setError(err.message)
    setBusy(false)
  }

  return (
    <div className="login-page">
      {/* LEFT HERO */}
      <div className="login-hero anim-fadeUp">
        <div className="login-hero-eyebrow">
          <div className="live-dot" />
          <span>Auction rooms live now</span>
        </div>

        <h1 className="login-hero-title">
          The intelligent<br />
          way to <span className="gold">bid & win</span>
        </h1>

        <p className="login-hero-sub">
          Real-time auction rooms powered by multi-LLM deliberation,
          streaming AI commentary, and intelligent shill detection.
        </p>

        <div className="login-features">
          {FEATURES.map(f => (
            <div key={f.title} className="login-feature">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-text">
                <strong>{f.title}</strong>
                <span>{f.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT FORM */}
      <div className="login-right">
        <div className="login-brand">
          <div className="login-brand-icon">🔨</div>
          <span className="login-brand-name">AI Auction Room</span>
        </div>

        <h2 className="login-form-title">
          {tab === 'signin' ? 'Welcome back' : 'Create account'}
        </h2>
        <p className="login-form-sub">
          {tab === 'signin' ? 'Enter the live bidding floor' : 'Join an auction room today'}
        </p>

        <div className="tab-row">
          <button className={`tab-btn${tab==='signin'?' active':''}`} onClick={()=>setTab('signin')}>Sign in</button>
          <button className={`tab-btn${tab==='signup'?' active':''}`} onClick={()=>setTab('signup')}>Sign up</button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" required placeholder="you@example.com"
              value={email} onChange={e=>setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" required placeholder="••••••••"
              value={pass} onChange={e=>setPass(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><span className="spinner" style={{width:14,height:14,borderWidth:2}} /><span>Please wait…</span></span>
                  : tab==='signin' ? 'Sign in →' : 'Create account →'}
          </button>
        </form>

        <div className="demo-hint">
          Demo credentials: <code>demo@auction.ai</code> / <code>demo1234</code>
        </div>
      </div>
    </div>
  )
}

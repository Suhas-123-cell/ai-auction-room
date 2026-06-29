import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [tab, setTab]     = useState('signin')
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy]   = useState(false)

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
      <div className="login-card">
        <div className="login-logo">AI Auction Room</div>
        <h1 className="login-title">{tab === 'signin' ? 'Sign in' : 'Create account'}</h1>
        <p className="login-sub">Enter the live bidding floor</p>

        <div className="login-tabs">
          <button className={`login-tab${tab==='signin'?' active':''}`} onClick={()=>setTab('signin')}>Sign in</button>
          <button className={`login-tab${tab==='signup'?' active':''}`} onClick={()=>setTab('signup')}>Sign up</button>
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
            {busy ? 'Please wait…' : tab==='signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p style={{marginTop:20,fontSize:12,color:'var(--text-3)',textAlign:'center'}}>
          Demo: <span className="mono" style={{color:'var(--text-2)'}}>demo@auction.ai / demo1234</span>
        </p>
      </div>
    </div>
  )
}

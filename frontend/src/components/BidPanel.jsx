import { useState, useEffect, useRef } from 'react'

const QUICK = [100, 250, 500, 1000]
const fmt = (n) => '₹' + (n ?? 0).toLocaleString('en-IN')

export default function BidPanel({ currentBid = 0, highestBidder, onBid, disabled, remainingBudget }) {
  const [amount, setAmount] = useState('')
  const [flash,  setFlash]  = useState(false)
  const prevBid = useRef(currentBid)

  useEffect(() => {
    if (currentBid !== prevBid.current) {
      setFlash(true)
      setTimeout(() => setFlash(false), 400)
      prevBid.current = currentBid
    }
  }, [currentBid])

  function submit(e) {
    e.preventDefault()
    const v = Number(amount)
    if (v > currentBid) { onBid(v); setAmount('') }
  }

  const hasBudget = remainingBudget != null
  const budgetPct = hasBudget ? Math.min(100, (remainingBudget / (remainingBudget + currentBid || 1)) * 100) : null

  return (
    <>
      <div className="current-bid-section">
        <div className="current-bid-label">Current Bid</div>
        <div className={`current-bid-amount${flash?' flash':''}`}>{fmt(currentBid)}</div>
        {highestBidder
          ? <div className="current-bid-bidder">by <strong>{highestBidder}</strong></div>
          : <div className="current-bid-bidder" style={{color:'var(--text-3)'}}>No bids yet — be first</div>
        }
      </div>

      {hasBudget && (
        <div style={{
          margin:'0 0 12px',padding:'10px 14px',
          background:'var(--bg-raise)',borderRadius:'var(--r-sm)',
          border:'1px solid rgba(255,255,255,0.06)'
        }}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:5,fontSize:11,color:'var(--text-3)'}}>
            <span>Your remaining budget</span>
            <span style={{fontFamily:'var(--mono)',fontWeight:700,color: remainingBudget < currentBid ? 'var(--red)' : 'var(--green)'}}>
              {fmt(remainingBudget)}
            </span>
          </div>
          <div style={{height:3,background:'var(--bg-high)',borderRadius:2,overflow:'hidden'}}>
            <div style={{
              height:'100%',borderRadius:2,transition:'width 0.4s ease',
              width:`${Math.max(2,(remainingBudget/(remainingBudget+currentBid||1))*100)}%`,
              background: remainingBudget < currentBid*0.5 ? 'var(--red)' : 'var(--green)',
            }} />
          </div>
        </div>
      )}

      <div className="bid-panel">
        <form onSubmit={submit} className="bid-row">
          <input
            className="bid-input"
            type="number"
            min={currentBid + 1}
            max={hasBudget ? remainingBudget : undefined}
            placeholder={`Min ${fmt(currentBid + 1)}`}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            disabled={disabled}
          />
          <button className="bid-submit" type="submit"
            disabled={disabled || !amount || Number(amount) <= currentBid || (hasBudget && Number(amount) > remainingBudget)}>
            BID NOW
          </button>
        </form>

        <div className="quick-bids">
          {QUICK.map(inc => {
            const bidAmt = currentBid + inc
            const overBudget = hasBudget && bidAmt > remainingBudget
            return (
              <button key={inc} className="quick-bid"
                onClick={() => onBid(bidAmt)}
                disabled={disabled || overBudget}
                title={overBudget ? 'Exceeds your budget' : undefined}>
                +{inc >= 1000 ? `${inc/1000}k` : inc}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

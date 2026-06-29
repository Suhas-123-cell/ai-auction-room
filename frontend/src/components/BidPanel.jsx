import { useState } from 'react'

const QUICK = [50, 100, 250, 500]

export default function BidPanel({ currentBid = 0, highestBidder, onBid, disabled }) {
  const [amount, setAmount] = useState('')

  function submit(e) {
    e.preventDefault()
    const v = Number(amount)
    if (v > currentBid) { onBid(v); setAmount('') }
  }

  return (
    <div className="bid-panel">
      <div className="current-bid-display">
        <div className="current-bid-label">Current Bid</div>
        <div className="current-bid-amount">&#8377;{currentBid?.toLocaleString('en-IN') ?? '—'}</div>
        {highestBidder && <div className="current-bid-bidder">by {highestBidder}</div>}
      </div>

      <form onSubmit={submit} className="bid-input-row">
        <input className="bid-input" type="number" min={currentBid+1}
          placeholder={`₹${currentBid + 1}`} value={amount}
          onChange={e=>setAmount(e.target.value)} disabled={disabled} />
        <button className="bid-btn" type="submit" disabled={disabled || !amount || Number(amount) <= currentBid}>
          BID
        </button>
      </form>

      <div className="quick-bids">
        {QUICK.map(inc => (
          <button key={inc} className="quick-bid-btn"
            onClick={()=>onBid(currentBid+inc)} disabled={disabled}>
            +{inc}
          </button>
        ))}
      </div>
    </div>
  )
}

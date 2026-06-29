import { useState, useEffect, useRef } from 'react'

const QUICK = [100, 250, 500, 1000]
const fmt = (n) => '₹' + (n ?? 0).toLocaleString('en-IN')

export default function BidPanel({ currentBid = 0, highestBidder, onBid, disabled }) {
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

  return (
    <>
      <div className="current-bid-section">
        <div className="current-bid-label">Current Bid</div>
        <div className={`current-bid-amount${flash?' flash':''}`}>
          {fmt(currentBid)}
        </div>
        {highestBidder
          ? <div className="current-bid-bidder">by <strong>{highestBidder}</strong></div>
          : <div className="current-bid-bidder" style={{color:'var(--text-3)'}}>No bids yet — be first</div>
        }
      </div>

      <div className="bid-panel">
        <form onSubmit={submit} className="bid-row">
          <input
            className="bid-input"
            type="number"
            min={currentBid + 1}
            placeholder={`Min ₹${(currentBid + 1).toLocaleString('en-IN')}`}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            disabled={disabled}
          />
          <button className="bid-submit" type="submit"
            disabled={disabled || !amount || Number(amount) <= currentBid}>
            BID NOW
          </button>
        </form>

        <div className="quick-bids">
          {QUICK.map(inc => (
            <button key={inc} className="quick-bid"
              onClick={() => onBid(currentBid + inc)}
              disabled={disabled}>
              +{inc >= 1000 ? `${inc/1000}k` : inc}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

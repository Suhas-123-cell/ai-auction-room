import { useEffect, useRef } from 'react'

const fmtTime = (iso) => {
  try { const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso+'Z'); return d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) }
  catch { return '' }
}

const initials = (name='?') => name.slice(0,2).toUpperCase()

export default function BidFeed({ bids = [], currentBid }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0 }, [bids.length])

  return (
    <>
      <div className="bid-feed-header">
        <span className="bid-feed-title">Live Bids</span>
        <span style={{fontSize:11,color:'var(--text-3)',fontFamily:'var(--mono)'}}>{bids.length} total</span>
      </div>
      <div className="bid-feed" ref={ref}>
        {!bids.length
          ? <div className="feed-empty"><span>No bids yet — be the first</span></div>
          : [...bids].reverse().map((b, i) => {
              const winning = b.amount === currentBid
              return (
                <div key={`${b.placed_at}-${i}`} className={`bid-entry${winning?' winner':''}${b.shill_score>=0.6?' shill':''}`}>
                  <div className={`bid-avatar${winning?' winner':''}`}>{initials(b.bidder)}</div>
                  <div className="bid-info">
                    <div className="bid-name">
                      {b.bidder}
                      {b.shill_score>=0.6 && <span className="shill-tag">⚠ flagged</span>}
                    </div>
                    <div className="bid-time">{fmtTime(b.placed_at)}</div>
                  </div>
                  <div className={`bid-amount${winning?' winner':''}`}>
                    ₹{b.amount?.toLocaleString('en-IN')}
                  </div>
                </div>
              )
            })
        }
      </div>
    </>
  )
}

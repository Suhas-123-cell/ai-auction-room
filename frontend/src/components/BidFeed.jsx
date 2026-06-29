import { useEffect, useRef } from 'react'

const fmt = (iso) => {
  if (!iso) return ''
  try { return new Date(iso+'Z').toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) }
  catch { return '' }
}

export default function BidFeed({ bids = [], currentBid }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0 }, [bids.length])

  if (!bids.length) return (
    <div className="bid-feed" ref={ref} style={{alignItems:'center',justifyContent:'center'}}>
      <span style={{color:'var(--text-3)',fontSize:12}}>No bids yet — be the first</span>
    </div>
  )

  return (
    <div className="bid-feed" ref={ref}>
      {[...bids].reverse().map((b, i) => (
        <div key={`${b.placed_at}-${i}`}
          className={`bid-entry${b.amount===currentBid?' winning':''}${b.shill_score>=0.6?' shill':''}`}>
          <div>
            <div className="bidder-name">{b.bidder}</div>
            {b.shill_score >= 0.6 && <span className="shill-badge">flagged</span>}
          </div>
          <div style={{textAlign:'right'}}>
            <div className="bid-amount">&#8377;{b.amount?.toLocaleString('en-IN')}</div>
            <div className="bid-time">{fmt(b.placed_at)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

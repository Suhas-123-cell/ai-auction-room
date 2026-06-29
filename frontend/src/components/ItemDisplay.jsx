import Timer from './Timer.jsx'

export default function ItemDisplay({ item, timerTotal = 30 }) {
  if (!item) return (
    <div className="item-display" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:160}}>
      <span style={{color:'var(--text-3)'}}>Waiting for auction to start…</span>
    </div>
  )
  return (
    <div className="item-display">
      <h2 className="item-name">{item.name}</h2>
      {item.description && <p className="item-desc">{item.description}</p>}
      <div className="item-meta">
        <div className="meta-cell base">
          <div className="meta-label">Base Price</div>
          <div className="meta-value">&#8377;{item.base_price?.toLocaleString('en-IN')}</div>
        </div>
        <div className="meta-cell winning">
          <div className="meta-label">Current Bid</div>
          <div className="meta-value">&#8377;{item.current_bid?.toLocaleString('en-IN')}</div>
        </div>
        <div className="meta-cell">
          <div className="meta-label">Status</div>
          <span className={`badge ${item.status}`}>{item.status}</span>
        </div>
      </div>
      {item.status === 'active' && <div style={{marginTop:16}}><Timer seconds={item.timer_seconds ?? 0} total={timerTotal} /></div>}
      {item.status === 'sold' && (
        <div className="resolved-banner sold" style={{marginTop:16,borderRadius:'var(--r)'}}>
          <span className="resolved-price">&#8377;{item.current_bid?.toLocaleString('en-IN')}</span>
          <span style={{fontSize:13}}>Sold to {item.highest_bidder}</span>
        </div>
      )}
      {item.status === 'unsold' && (
        <div className="resolved-banner unsold" style={{marginTop:16,borderRadius:'var(--r)'}}>
          <span style={{fontSize:14,fontWeight:700}}>Unsold — item passed</span>
        </div>
      )}
    </div>
  )
}

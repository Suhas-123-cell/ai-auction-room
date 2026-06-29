import Timer from './Timer.jsx'

export default function ItemDisplay({ item, lotNumber = 1, timerTotal = 30 }) {
  if (!item) return (
    <div className="item-card" style={{minHeight:300,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
      <div style={{fontSize:48}}>🔨</div>
      <span style={{color:'var(--text-3)',fontSize:14}}>Waiting for auction to begin…</span>
    </div>
  )

  return (
    <div className="item-card">
      {/* Image */}
      <div className="item-image-wrap">
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.name} loading="lazy" />
        ) : (
          <div className="item-image-placeholder">
            <span>🖼️</span>
            <span>No image provided</span>
          </div>
        )}
        <div className="item-lot">
          <span className="item-lot-badge">Lot {String(lotNumber).padStart(2,'0')}</span>
        </div>
        <div className="item-status-badge">
          <span className={`badge ${item.status}`}>{item.status}</span>
        </div>
      </div>

      {/* Body */}
      <div className="item-body">
        <h2 className="item-name">{item.name}</h2>
        {item.description && <p className="item-desc">{item.description}</p>}

        <div className="item-stats">
          <div className="item-stat">
            <div className="item-stat-label">Base Price</div>
            <div className="item-stat-value">₹{item.base_price?.toLocaleString('en-IN')}</div>
          </div>
          <div className="item-stat">
            <div className="item-stat-label">Current Bid</div>
            <div className={`item-stat-value ${item.current_bid > item.base_price ? 'gold' : ''}`}>
              ₹{item.current_bid?.toLocaleString('en-IN') ?? item.base_price?.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="item-stat">
            <div className="item-stat-label">Total Bids</div>
            <div className="item-stat-value">{item.bid_history?.length ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Resolved banners */}
      {item.status === 'sold' && (
        <div className="resolved-sold">
          <div>
            <div className="resolved-label green">🏆 SOLD</div>
            <div style={{fontSize:13,color:'var(--text-2)',marginTop:2}}>Won by <strong style={{color:'var(--text-1)'}}>{item.highest_bidder}</strong></div>
          </div>
          <div className="resolved-price">₹{item.current_bid?.toLocaleString('en-IN')}</div>
        </div>
      )}
      {item.status === 'unsold' && (
        <div className="resolved-unsold">
          <div className="resolved-label red">❌ Unsold — item passed</div>
        </div>
      )}
    </div>
  )
}

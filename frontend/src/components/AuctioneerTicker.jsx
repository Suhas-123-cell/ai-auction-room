export default function AuctioneerTicker({ commentary }) {
  return (
    <div className="ticker-bar">
      <span className="ticker-label">🎙 AI Auctioneer</span>
      <span className="ticker-text">{commentary || 'Auction room initializing…'}</span>
    </div>
  )
}

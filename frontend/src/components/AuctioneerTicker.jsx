export default function AuctioneerTicker({ commentary }) {
  return (
    <div className="ticker-bar auction-ticker">
      <span className="ticker-label">AI Auctioneer</span>
      <span className="ticker-text">{commentary || 'Waiting for auction to begin…'}</span>
    </div>
  )
}

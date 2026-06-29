export default function Timer({ seconds, total = 30 }) {
  const pct      = total > 0 ? seconds / total : 0
  const radius   = 44
  const circ     = 2 * Math.PI * radius   // ≈ 276.5
  const offset   = circ * (1 - pct)
  const isUrgent = seconds <= 5
  const isWarn   = seconds <= 10

  const color = isUrgent ? 'var(--red)' : isWarn ? 'var(--gold)' : 'var(--green)'
  const cls   = isUrgent ? 'red' : isWarn ? 'gold' : 'green'

  return (
    <div className="timer-section">
      <div className="timer-ring-wrap">
        <svg width="110" height="110" viewBox="0 0 110 110">
          <circle className="timer-track" cx="55" cy="55" r={radius} />
          <circle
            className="timer-fill"
            cx="55" cy="55" r={radius}
            stroke={color}
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="timer-center">
          <span className={`timer-seconds ${cls}`}>{seconds}</span>
          <span className="timer-label">seconds</span>
        </div>
      </div>
    </div>
  )
}

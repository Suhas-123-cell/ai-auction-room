export default function Timer({ seconds, total = 30 }) {
  const pct = total > 0 ? (seconds / total) * 100 : 0
  const cls  = seconds <= 5 ? 'urgent' : seconds <= 10 ? 'warning' : ''
  return (
    <div className="timer-wrap">
      <span className={`timer-number ${cls}`}>{seconds}s</span>
      <div className="timer-bar-track">
        <div className={`timer-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

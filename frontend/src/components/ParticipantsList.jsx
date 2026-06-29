export default function ParticipantsList({ participants = [] }) {
  return (
    <div>
      <div className="panel-header">
        <span className="panel-label">Participants ({participants.length})</span>
      </div>
      <div className="participants-list">
        {!participants.length && <span style={{color:'var(--text-3)',fontSize:12}}>No participants yet</span>}
        {participants.map(p => (
          <div key={p.user_id} className={`participant-row ${p.role} ${p.connected===false?'offline':''}`}>
            <div className="participant-info">
              <span className={`participant-dot ${p.connected===false?'offline':''}`} />
              <span className="participant-name">{p.display_name}</span>
              {p.role==='admin' && <span className="participant-role">admin</span>}
            </div>
            <span className="participant-budget">
              &#8377;{(p.budget-(p.spent??0)).toLocaleString('en-IN')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

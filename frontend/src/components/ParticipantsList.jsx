export default function ParticipantsList({ participants = [] }) {
  return (
    <div className="participants-section">
      <div className="section-header">
        <span className="section-title">Participants</span>
        <span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--text-3)'}}>{participants.length}</span>
      </div>
      <div className="participant-list">
        {participants.map(p => (
          <div key={p.user_id} className="p-row">
            <span className={`p-dot${p.connected===false?' offline':''}`} />
            <span className="p-name">{p.display_name}</span>
            {p.role==='admin' && <span className="p-role">admin</span>}
            <span className="p-budget">₹{((p.budget??0)-(p.spent??0)).toLocaleString('en-IN')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

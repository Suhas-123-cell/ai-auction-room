const MODELS = ['Llama-3.1-8b', 'Gemma-2-9b', 'Mixtral-8x7b']

export default function CouncilValuation({ valuation, loading }) {
  return (
    <div className="council-panel">
      <div className="council-header">
        <span className="council-dot" />
        <span className="council-title">LLM Council Valuation</span>
        <span style={{fontSize:10,color:'var(--text-3)',marginLeft:'auto'}}>
          3-stage · {MODELS.join(' · ')} · Chairman
        </span>
      </div>
      <div className="council-body">
        {loading && !valuation && (
          <div className="council-loading">
            <span className="spinner" />
            Council deliberating…
          </div>
        )}
        {!loading && !valuation && (
          <span style={{color:'var(--text-3)',fontSize:12}}>Valuation will appear when item goes live</span>
        )}
        {valuation && (
          <>
            <div className="council-verdict">
              <div className="verdict-cell">
                <div className="v-label">Fair Value Range</div>
                <div className="v-value">
                  &#8377;{valuation.fair_value_low?.toLocaleString('en-IN')} – &#8377;{valuation.fair_value_high?.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="verdict-cell">
                <div className="v-label">Max Bid Suggestion</div>
                <div className="v-value">&#8377;{valuation.suggested_max_bid?.toLocaleString('en-IN')}</div>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <span className={`council-badge ${valuation.opening_assessment}`}>
                {valuation.opening_assessment}
              </span>
              <span style={{fontSize:11,color:'var(--text-3)'}}>
                Council confidence: {valuation.consensus_confidence}
              </span>
            </div>
            {valuation.chairman_summary && (
              <div className="chairman-summary">"{valuation.chairman_summary}"</div>
            )}
            {valuation.council_opinions?.length > 0 && (
              <div className="model-opinions">
                {valuation.council_opinions.map((op, i) => (
                  <div key={i} className="model-opinion">
                    <span className="model-tag">{MODELS[i] ?? `Model ${i+1}`}</span>
                    {op.slice(0, 180)}{op.length > 180 ? '…' : ''}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

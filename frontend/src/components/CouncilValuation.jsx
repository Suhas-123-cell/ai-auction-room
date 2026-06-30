const MODELS = ['Llama-3.1-8b', 'Gemma-2-9b', 'Mixtral-8x7b']
const CONF_COLOR = { low: 'var(--text-3)', medium: 'var(--gold)', high: 'var(--green)' }

export default function CouncilValuation({ valuation, loading }) {
  const isFallback = valuation?.is_fallback

  return (
    <div className="council-card">
      <div className="council-header">
        <span className="council-dot" />
        <span className="council-title">AI Valuation Estimate</span>
        <span className="council-models">3-model deliberation · Groq</span>
      </div>
      <div className="council-body">
        {loading && !valuation && (
          <div className="council-loading">
            <span className="spinner" />
            Council deliberating — {MODELS.join(' · ')} · Chairman
          </div>
        )}
        {!loading && !valuation && (
          <span style={{color:'var(--text-3)',fontSize:13}}>Valuation appears when item goes live</span>
        )}
        {valuation && (
          <>
            {isFallback ? (
              <div style={{fontSize:12,color:'var(--text-3)',padding:'8px 0',fontStyle:'italic'}}>
                AI council unavailable — showing base-price estimate
              </div>
            ) : (
              <div style={{fontSize:11,color:'var(--text-3)',marginBottom:10,lineHeight:1.5}}>
                ℹ️ This is an AI estimate to guide bidding, not a price guarantee.
              </div>
            )}

            <div className="council-verdict">
              <div className="v-cell">
                <div className="v-label">AI Fair Value Range</div>
                <div className="v-value">
                  ₹{valuation.fair_value_low?.toLocaleString('en-IN')} – ₹{valuation.fair_value_high?.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="v-cell">
                <div className="v-label">Suggested Max Bid</div>
                <div className="v-value" style={{color:'var(--gold)'}}>
                  ₹{valuation.suggested_max_bid?.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="council-assessment">
              <span className={`ca-badge ${valuation.opening_assessment}`}>
                {valuation.opening_assessment?.replace('_',' ')}
              </span>
              <span className="ca-confidence" style={{color: CONF_COLOR[valuation.consensus_confidence] ?? 'var(--text-3)'}}>
                Confidence: {valuation.consensus_confidence}
              </span>
            </div>

            {valuation.chairman_summary && (
              <div className="chairman-quote">"{valuation.chairman_summary}"</div>
            )}

            {!isFallback && valuation.council_opinions?.length > 0 && (
              <div className="model-opinions">
                {valuation.council_opinions.map((op, i) => (
                  <div key={i} className="model-op">
                    <span className="model-tag">{MODELS[i] ?? `Model ${i+1}`}</span>
                    {op.slice(0,200)}{op.length>200?'…':''}
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

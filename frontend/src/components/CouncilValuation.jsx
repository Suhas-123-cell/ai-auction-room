const MODELS = ['Llama-3.1-8b', 'Gemma-2-9b', 'Mixtral-8x7b']

export default function CouncilValuation({ valuation, loading }) {
  return (
    <div className="council-card">
      <div className="council-header">
        <span className="council-dot" />
        <span className="council-title">LLM Council Valuation</span>
        <span className="council-models">3-stage deliberation · Groq</span>
      </div>
      <div className="council-body">
        {loading && !valuation && (
          <div className="council-loading">
            <span className="spinner" />
            Council deliberating — {MODELS.join(' · ')} · Chairman
          </div>
        )}
        {!loading && !valuation && (
          <span style={{color:'var(--text-3)',fontSize:13}}>Valuation appears when the item goes live</span>
        )}
        {valuation && (
          <>
            <div className="council-verdict">
              <div className="v-cell">
                <div className="v-label">Fair Value Range</div>
                <div className="v-value">
                  ₹{valuation.fair_value_low?.toLocaleString('en-IN')} – ₹{valuation.fair_value_high?.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="v-cell">
                <div className="v-label">Suggested Max Bid</div>
                <div className="v-value" style={{color:'var(--gold)'}}>₹{valuation.suggested_max_bid?.toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div className="council-assessment">
              <span className={`ca-badge ${valuation.opening_assessment}`}>
                {valuation.opening_assessment?.replace('_',' ')}
              </span>
              <span className="ca-confidence">Confidence: {valuation.consensus_confidence}</span>
            </div>

            {valuation.chairman_summary && (
              <div className="chairman-quote">"{valuation.chairman_summary}"</div>
            )}

            {valuation.council_opinions?.length > 0 && (
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

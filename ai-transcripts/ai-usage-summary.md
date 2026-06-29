# AI Usage Summary — AI Auction Room

## How AI Was Used to Build This Project

### 1. LLM Council for Item Valuation (Karpathy 3-Stage Pattern)
Adapted from Andrej Karpathy's `llm-council` architecture. Three Groq-hosted models run
in parallel (Stage 1), then cross-review each other's anonymized opinions (Stage 2),
and a Chairman model synthesizes the final verdict (Stage 3).

**Models used:**
| Role       | Model                    | Purpose                          |
|------------|--------------------------|----------------------------------|
| Panelist A | `llama-3.1-8b-instant`   | Independent valuation opinion    |
| Panelist B | `gemma2-9b-it`           | Independent valuation opinion    |
| Panelist C | `mixtral-8x7b-32768`     | Independent valuation opinion    |
| Chairman   | `llama-3.3-70b-versatile`| Synthesis & final recommendation |

**Output:** `{fair_value_low, fair_value_high, suggested_max_bid, opening_assessment,
consensus_confidence, chairman_summary, council_opinions[]}`

**Design choice:** Council runs as a non-blocking `asyncio.create_task` so the 30-second
item timer starts immediately while the 3-5s deliberation completes in the background.
Result is pushed to all clients via the `council_valuation` WebSocket event.

---

### 2. AI Auctioneer — Streaming Commentary
`llama-3.1-8b-instant` generates real-time commentary at auction moments:
- Item opening (with starting price + opening assessment from Council)
- Each new bid (acknowledges bidder by name, builds excitement)
- Final 10s and 5s warnings
- Sold / unsold resolution

**Streaming:** FastAPI `StreamingResponse` with `text/event-stream` allows character-by-character
streaming from Groq. Used for the `/commentary/stream` SSE endpoint. Non-streaming variant
is used for WebSocket broadcasts so all room participants receive the same text simultaneously.

---

### 3. Shill Bid Detection
Rule-based scoring system (no model needed for detection; LLM used only for deep analysis):

| Rule                            | Score |
|---------------------------------|-------|
| >3 bids in 30 seconds           | +0.4  |
| Counter-bidding same opponent ≥3×| +0.3  |
| All increments ≤₹10 (≥2 bids)  | +0.2  |

Score ≥ 0.6 triggers an `shill_alert` WebSocket event (admin-only).
The `llm_shill_check()` function uses `llama-3.3-70b-versatile` for deeper pattern analysis.

---

### 4. AI-Assisted Development
This project was built with Claude Sonnet 4.6 (Claude Code CLI) which:
- Adapted the Karpathy llm-council pattern from OpenRouter to Groq SDK
- Designed the server-authoritative WebSocket state machine
- Implemented atomic bid validation with asyncio locks
- Built the anti-sniping timer extension (bids in final 10s extend by 5s, capped at 15s)
- Designed the dark trading-terminal UI (taste-skill design principles)

**Design review:** Multiple parallel critic agents (Skeptic / Pragmatist / Aesthetics)
were used to evaluate the frontend design before finalizing the CSS.

---

## Key Technical Decisions

### Why Groq over OpenRouter?
Groq's inference hardware delivers <1s token generation for 8B models, making real-time
auction commentary viable. Stage 1 of the council (3 parallel Groq calls) completes in ~1.5s.

### Why native WebSockets over Socket.io?
Ponytail principle: the native WebSocket API is sufficient for a room-based broadcast pattern.
No fallback transports needed in a controlled auction environment.

### Why no Redis / Celery?
`asyncio` handles all timers, locks, and background tasks natively. The auction timer is an
`asyncio.create_task` that ticks every second. Atomic bid validation uses an `asyncio.Lock`
per room. Adding Redis would be premature optimization for a demo-scale system.

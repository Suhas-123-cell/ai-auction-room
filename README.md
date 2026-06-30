# AI Auction Room

A real-time fantasy auction platform built as an internship assignment for **11auction**.  
Inspired by fantasy/sports auction formats — virtual budgets, no real-money settlement.

---

## What is complete

| Area | Status |
|------|--------|
| Room creation with items + photos | ✅ |
| Bidder join with virtual budget | ✅ |
| Live WebSocket auction with server-authoritative timer | ✅ |
| Atomic bid handling (asyncio lock per room) | ✅ |
| Every accepted bid persisted to `bids` table | ✅ |
| Item resolved status/winner/price persisted to `items` | ✅ |
| Participant spent persisted to `room_participants` | ✅ |
| Results page works after refresh or server restart | ✅ |
| Reconnect recovery — reconstructs state from DB | ✅ |
| Scheduled auction start (background scheduler) | ✅ |
| Admin live item addition mid-auction | ✅ |
| LLM Council valuation (3-stage Karpathy pattern) | ✅ |
| AI Auctioneer streaming commentary | ✅ |
| Shill bid detection (rule-based + async LLM at threshold) | ✅ |
| Remaining budget display + enforcement | ✅ |
| Auction history / bid history pages | ✅ |

---

## How to run

### Prerequisites
- Python 3.11+, Node 18+
- Supabase project with `item-photos` storage bucket (set to public)
- Groq API key

### 1. Database
Run `supabase/schema.sql` in the Supabase SQL editor.

### 2. Environment
```bash
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET,
#          GROQ_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
# Leave VITE_API_URL empty — Vite proxies /api to the backend
```

### 3. Backend
```bash
# From repo root
source /path/to/.venv/bin/activate
pip install -e .
uvicorn backend.main:app --reload --port 8000
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## AI features

### LLM Council Valuation
Adapted from Andrej Karpathy's llm-council pattern:

```
Stage 1 (parallel) → Stage 2 (cross-review) → Stage 3 (Chairman)
  Llama 3.1-8b  ─┐                                 llama-3.3-70b
  Gemma2-9b     ─┤  anonymize → peer review  ───►  synthesizes JSON verdict
  Mixtral-8x7b  ─┘
```

- Uses item name, **description**, and opening price in all prompts
- Chairman prompt explicitly frames output as "AI estimate to guide bidding, not a price guarantee"
- Displayed with confidence color (grey/gold/green) and an "ℹ️ AI estimate" disclaimer
- Falls back gracefully if Groq is unavailable — auction never blocks on AI

### AI Auctioneer
- `llama-3.1-8b-instant` generates live commentary at key moments (item start, bid placed, 10s/5s warning, sold/unsold)
- Streamed via SSE endpoint; errors silently ignored so bidding continues

### Shill Bid Detection
Rule-based scoring first (no API cost on every bid):
- High velocity (≥3 bids in 30s) → +0.4
- Always counter-bidding same opponent (≥3 times) → +0.3  
- Suspiciously small increments → +0.2

If score ≥ 0.5 → admin gets a **"suspicious pattern"** alert (not "cheating")  
If score ≥ 0.7 → async LLM deep-check fires in background; second alert if confirmed  
Shill score stored with each bid in DB.

---

## Known limitations

- No mobile responsive layout
- Reconnect during active timer gives a fresh `bid_duration` window (conservative, not the remaining time)
- Council valuation uses only text; photo URL is available but not passed to vision models
- Single Supabase instance; no multi-region or failover
- No rate limiting on bids beyond asyncio lock and budget check
- Shill detection has no cross-room graph analysis

---

## Manual verification steps

1. Sign up → create room with 2+ items and photos
2. Open second browser tab → join room with code
3. Admin starts auction → item appears with AI valuation loading
4. Bidder places bid → bid appears in both tabs, timer resets
5. Bidder tries to bid lower → rejected with error message
6. Bidder tries to bid more than budget → rejected with "insufficient budget"
7. Admin skips item → item marked unsold, next item starts
8. Let timer expire → item sold to highest bidder
9. After auction completes → results page shows all items/winners/prices
10. **Refresh results page** → data loads from DB, no data lost
11. Stop backend, restart → rejoin room → state reconstructed from DB

---

## Future scope (not implemented)

- Player/asset database for real sports/fantasy items
- Match scoring and leaderboard post-auction
- Team composition and squad validation rules
- Autobid / preference system
- Cross-room fraud graph analysis
- AI-generated item summaries from public stats
- Mobile responsive polish
- Spectator mode (read-only WebSocket)
- Tournament / season mode
- Admin analytics dashboard
- Deployment hardening (rate limiting, auth hardening, CDN)

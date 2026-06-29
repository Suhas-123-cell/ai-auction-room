# AI Auction Room

A real-time auction platform powered by multi-LLM deliberation, streaming AI commentary, and intelligent shill bid detection.

Built for the **11auction internship assignment** — Tier 1 AI features.

---

## Features

### Tier 1 AI
| Feature | Implementation |
|---------|----------------|
| **LLM Council Valuation** | Karpathy 3-stage pattern: 3 Groq models deliberate in parallel, Chairman synthesizes |
| **AI Auctioneer** | `llama-3.1-8b-instant` streams live commentary via SSE at every bid moment |
| **Shill Bid Detection** | Rule-based scoring + LLM deep analysis; alerts admin in real time |

### Core Mechanics
- **Server-authoritative clock** — asyncio timer broadcasts `timer_tick` every second; clients display only
- **Atomic bids** — asyncio lock per room; server rejects stale bids silently
- **Anti-sniping** — bids in final 10s extend timer by 5s (max 15s extension)
- **State machine** — LOBBY → AUCTION → COMPLETED; items go pending → active → sold/unsold

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI + Uvicorn |
| WebSockets | FastAPI native (no Socket.io) |
| AI / LLMs | Groq API — Llama, Gemma, Mixtral |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth + PyJWT |
| Frontend | React 18 + Vite (no TypeScript, no Tailwind) |
| Routing | React Router v6 |
| HTTP | native fetch (no axios) |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node 18+
- Supabase project
- Groq API key

### Backend
```bash
cd /path/to/ai-auction-room
python -m venv .venv && source .venv/bin/activate
pip install -e .
cp .env.example .env   # fill in values
uvicorn backend.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # fill in values
npm run dev
```

### Database
Run `supabase/schema.sql` in your Supabase SQL editor.

---

## Project Structure

```
ai-auction-room/
├── backend/
│   ├── main.py              # FastAPI app, WebSocket handler, SSE endpoint
│   ├── config.py            # Settings, Groq model list
│   ├── database.py          # Supabase singleton + JWT verification
│   ├── ws_manager.py        # Room WebSocket manager
│   ├── models.py            # Pydantic models
│   ├── routers/
│   │   └── rooms.py         # Room CRUD REST API
│   └── services/
│       ├── auction.py       # Core state machine + timer
│       ├── council.py       # Karpathy 3-stage LLM Council
│       ├── auctioneer.py    # AI commentary (streaming + non-streaming)
│       └── shill.py         # Shill bid detection
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── lib/             # supabase.js, socket.js
│       ├── hooks/           # useAuth.js, useAuction.js
│       ├── pages/           # Login, Dashboard, AuctionRoom, Results
│       └── components/      # Timer, BidPanel, BidFeed, ItemDisplay,
│                            # CouncilValuation, AuctioneerTicker, ParticipantsList
├── supabase/schema.sql
├── ai-transcripts/ai-usage-summary.md
└── pyproject.toml
```

---

## LLM Council — How It Works

Adapted from Andrej Karpathy's [llm-council](https://github.com/karpathy/llm-council).

```
Stage 1 (parallel)  →  Stage 2 (cross-review)  →  Stage 3 (Chairman)
   Llama  ─┐              Llama reviews B,C           llama-3.3-70b
   Gemma  ─┤   anonymize  Gemma reviews A,C    ───►  synthesizes final
   Mixtral─┘              Mixtral reviews A,B         JSON verdict
```

Output: `{fair_value_low, fair_value_high, suggested_max_bid, opening_assessment, consensus_confidence, chairman_summary}`

---

## WebSocket Protocol

**Client → Server**
```json
{ "type": "place_bid",     "data": { "amount": 5500 } }
{ "type": "start_auction", "data": {} }
{ "type": "next_item",     "data": {} }
```

**Server → Client**
```json
{ "type": "room_state",        "data": { ... } }
{ "type": "bid_update",        "data": { "current_bid": 5500, "bid_history": [...] } }
{ "type": "timer_tick",        "data": { "seconds_left": 23 } }
{ "type": "council_valuation", "data": { "item_id": "...", "valuation": { ... } } }
{ "type": "shill_alert",       "data": { "bidder": "...", "score": 0.7 } }
```

---

## Environment Variables

See `.env.example` (backend) and `frontend/.env.example` for required variables.

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

### Core Auction Mechanics
- **Server-authoritative clock** — asyncio timer broadcasts `timer_tick` every second; clients display only
- **Atomic bids** — asyncio lock per room; server rejects stale/invalid bids
- **Going-once timer** — each bid fully resets the countdown (configurable, default 30s per bid)
- **Opening window** — first bid on each item gets a longer window (configurable, default 2 min)
- **State machine** — `lobby → auction → completed`; items go `pending → active → sold/unsold`

### Room & Scheduling
- **Scheduled start** — set a future date/time; background scheduler auto-starts the room at that time
- **Manual override** — admin can start immediately regardless of schedule
- **Live item addition** — admin can add new items to the queue mid-auction via modal
- **Back to dashboard** — participants can leave and rejoin; auction runs server-side uninterrupted

### User Features
- **Photo upload** — item photos stored in Supabase Storage, shown in item display and queue
- **My Bid History** — view all bids across all rooms; remove bids from completed auctions
- **Auction History** — see all rooms you created as admin with items sold, bids placed, and earnings

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI + Uvicorn |
| WebSockets | FastAPI native (no Socket.io) |
| AI / LLMs | Groq API — Llama, Gemma, Mixtral |
| Database | Supabase (PostgreSQL + Storage) |
| Auth | Supabase Auth (`auth.get_user()` server-side verification) |
| Frontend | React 18 + Vite (no TypeScript, no Tailwind) |
| Routing | React Router v6 |
| HTTP | native fetch (no axios) |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node 18+
- Supabase project (with `item-photos` storage bucket set to public)
- Groq API key

### 1. Database
Run `supabase/schema.sql` in your Supabase SQL editor.

Create a public storage bucket named `item-photos` in Supabase Storage.

### 2. Environment
```bash
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET,
#          GROQ_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

Leave `VITE_API_URL` empty — Vite proxies `/api` and `/ws` to the backend automatically.

### 3. Backend
```bash
# From repo root (where pyproject.toml lives)
source /path/to/.venv/bin/activate
pip install -e .
uvicorn backend.main:app --reload --port 8000
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev   # runs on :5173 or :5174
```

---

## Project Structure

```
ai-auction-room/
├── backend/
│   ├── main.py              # FastAPI app, WebSocket handler, SSE, scheduler
│   ├── config.py            # Pydantic settings, Groq model constants
│   ├── database.py          # Supabase singleton + token verification
│   ├── ws_manager.py        # Per-room WebSocket connection manager
│   ├── models.py            # Pydantic request/response models
│   ├── routers/
│   │   ├── auth.py          # Sign-in / sign-up proxy
│   │   └── rooms.py         # Room CRUD, item upload, bid history, auction history
│   └── services/
│       ├── registry.py      # Shared singletons (manager, auction_service)
│       ├── auction.py       # Core state machine + asyncio timer
│       ├── council.py       # Karpathy 3-stage LLM Council
│       ├── auctioneer.py    # AI commentary (streaming SSE + non-streaming)
│       └── shill.py         # Shill bid detection (rule-based + LLM)
├── frontend/
│   └── src/
│       ├── App.jsx          # Routes + auth guard
│       ├── lib/             # supabase.js (client + getToken)
│       ├── hooks/           # useAuth.js, useAuction.js (WebSocket state)
│       ├── pages/
│       │   ├── Login.jsx    # Sign in / sign up
│       │   ├── Dashboard.jsx # Create, Join, Bid History, Auction History
│       │   ├── AuctionRoom.jsx # Live auction UI (lobby + auction views)
│       │   └── Results.jsx  # Post-auction summary
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

Output: `{ fair_value_low, fair_value_high, suggested_max_bid, opening_assessment, consensus_confidence, chairman_summary }`

---

## WebSocket Protocol

**Client → Server**
```json
{ "type": "place_bid",     "data": { "amount": 5500 } }
{ "type": "start_auction", "data": {} }
{ "type": "next_item",     "data": {} }
{ "type": "ping",          "data": {} }
```

**Server → Client**
```json
{ "type": "room_state",        "data": { "status": "...", "current_item": {...}, "items_queue": [...] } }
{ "type": "bid_update",        "data": { "current_bid": 5500, "bid_history": [...] } }
{ "type": "timer_tick",        "data": { "seconds_left": 23 } }
{ "type": "council_valuation", "data": { "item_id": "...", "valuation": {...} } }
{ "type": "shill_alert",       "data": { "bidder": "...", "score": 0.7, "reason": "..." } }
{ "type": "item_started",      "data": { "item": {...}, "lot_number": 2 } }
{ "type": "item_added",        "data": { "id": "...", "name": "...", "items_total": 4 } }
{ "type": "auction_completed", "data": { "results": {...} } }
```

---

## Environment Variables

See `.env.example` at the repo root for all required variables (shared by backend and frontend).

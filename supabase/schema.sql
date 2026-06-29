-- AI Auction Room schema
-- Run in Supabase SQL editor

create extension if not exists "pgcrypto";

create table public.rooms (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  code          text not null unique,
  status        text not null default 'lobby' check (status in ('lobby','auction','completed')),
  admin_id      uuid references auth.users(id),
  photo_url     text,
  created_at    timestamptz not null default now()
);

create table public.room_participants (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references rooms(id) on delete cascade,
  user_id       uuid not null references auth.users(id),
  display_name  text not null,
  role          text not null default 'bidder' check (role in ('admin','bidder')),
  budget        int  not null default 10000,
  spent         int  not null default 0,
  joined_at     timestamptz not null default now(),
  unique(room_id, user_id)
);

create table public.items (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references rooms(id) on delete cascade,
  name          text not null,
  description   text,
  base_price    int  not null default 100,
  order_index   int  not null default 0,
  status        text not null default 'pending' check (status in ('pending','active','sold','unsold')),
  current_bid   int,
  winner_id     uuid references auth.users(id),
  winner_name   text,
  sold_price    int,
  photo_url     text,
  created_at    timestamptz not null default now()
);

create table public.bids (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references items(id) on delete cascade,
  room_id       uuid not null references rooms(id) on delete cascade,
  bidder_id     uuid not null references auth.users(id),
  bidder_name   text not null,
  amount        int  not null,
  shill_score   float not null default 0,
  placed_at     timestamptz not null default now()
);

-- Row-level security
alter table rooms             enable row level security;
alter table room_participants enable row level security;
alter table items             enable row level security;
alter table bids              enable row level security;

-- Rooms: readable by participants, writable by admin
create policy "rooms_select" on rooms for select using (
  id in (select room_id from room_participants where user_id = auth.uid())
);
create policy "rooms_insert" on rooms for insert with check (auth.uid() = admin_id);
create policy "rooms_update" on rooms for update using (auth.uid() = admin_id);

-- Participants: everyone in the room can read, insert own row
create policy "participants_select" on room_participants for select using (
  room_id in (select room_id from room_participants where user_id = auth.uid())
);
create policy "participants_insert" on room_participants for insert with check (auth.uid() = user_id);

-- Items: readable by room participants
create policy "items_select" on items for select using (
  room_id in (select room_id from room_participants where user_id = auth.uid())
);
create policy "items_insert" on items for insert with check (
  room_id in (select room_id from room_participants where user_id = auth.uid())
);

-- Bids: readable by room participants
create policy "bids_select" on bids for select using (
  room_id in (select room_id from room_participants where user_id = auth.uid())
);
create policy "bids_insert" on bids for insert with check (auth.uid() = bidder_id);

-- Indexes for performance
create index on room_participants (room_id);
create index on room_participants (user_id);
create index on items (room_id, order_index);
create index on bids (item_id, placed_at);

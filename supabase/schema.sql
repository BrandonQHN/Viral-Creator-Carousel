-- ============================================================
-- Carousel Studio — Supabase Schema
-- Run this in Supabase SQL editor
-- ============================================================

-- ── USERS (extends auth.users) ────────────────────────────
create table public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  plan         text not null default 'free' check (plan in ('free','starter','pro','agency')),
  runs_used    int  not null default 0,
  runs_cap     int  not null default 1,
  period_start timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ── SESSIONS ─────────────────────────────────────────────
create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  topic         text not null,
  goal          text,
  status        text not null default 'drafting'
                check (status in ('drafting','generating','complete','failed')),
  niche_brief   jsonb,
  content_plan  jsonb,
  visual_dna    jsonb,
  all_copy      jsonb,
  run_deducted  boolean not null default false,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

-- ── CAROUSELS ─────────────────────────────────────────────
create table public.carousels (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions(id) on delete cascade,
  carousel_num  int  not null,
  hook          text,
  format        text,
  caption       text,
  hashtags      text,
  status        text not null default 'pending'
                check (status in ('pending','generating','complete','failed')),
  slides        jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

-- ── RLS POLICIES ─────────────────────────────────────────
alter table public.users    enable row level security;
alter table public.sessions enable row level security;
alter table public.carousels enable row level security;

-- Users: only see/edit your own row
create policy "users_self" on public.users
  for all using (auth.uid() = id);

-- Sessions: only see/edit your own
create policy "sessions_own" on public.sessions
  for all using (auth.uid() = user_id);

-- Carousels: only see carousels from your own sessions
create policy "carousels_own" on public.carousels
  for all using (
    exists (
      select 1 from public.sessions s
      where s.id = carousels.session_id
      and s.user_id = auth.uid()
    )
  );

-- ── AUTO-CREATE USER ROW ON SIGNUP ───────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, plan, runs_cap)
  values (new.id, new.email, 'free', 1);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── USAGE RESET FUNCTION (call from cron or billing webhook) ─
create or replace function public.reset_usage(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.users
  set runs_used = 0, period_start = now()
  where id = p_user_id;
end;
$$;

-- ── PLAN CAPS LOOKUP ──────────────────────────────────────
-- Reference: free=1, starter=10, pro=30, agency=100
-- Update runs_cap when plan changes (handle in billing webhook)

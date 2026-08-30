create extension if not exists pgcrypto;

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  role text,
  external_id text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table metric_references (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  season text not null,
  metric_key text not null,
  direction text not null check (direction in ('min', 'max', 'range')),
  target_min numeric,
  target_max numeric,
  unit text not null default '%',
  unique nulls not distinct (team_id, player_id, season, metric_key)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  opponent_name text not null,
  played_at timestamptz not null,
  competition text,
  venue text,
  status text not null default 'draft' check (status in ('draft', 'validated', 'published')),
  source_filename text,
  source_path text,
  created_at timestamptz not null default now()
);

create table team_boxscores (
  match_id uuid primary key references matches(id) on delete cascade,
  team_stats jsonb not null,
  opponent_stats jsonb not null,
  computed_metrics jsonb not null default '{}'::jsonb,
  formula_version text not null default 'v0.1'
);

create table player_boxscores (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  player_name text not null,
  raw_stats jsonb not null,
  computed_metrics jsonb not null default '{}'::jsonb,
  unique (match_id, player_name)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'ready', 'archived')),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (match_id, version)
);

alter table teams enable row level security;
alter table players enable row level security;
alter table metric_references enable row level security;
alter table matches enable row level security;
alter table team_boxscores enable row level security;
alter table player_boxscores enable row level security;
alter table reports enable row level security;

create index players_team_id_idx on players(team_id);
create index matches_team_id_played_at_idx on matches(team_id, played_at desc);
create index player_boxscores_match_id_idx on player_boxscores(match_id);


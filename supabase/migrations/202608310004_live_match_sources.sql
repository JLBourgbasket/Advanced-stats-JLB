alter table public.matches
add column if not exists source_type text not null default 'import'
check (source_type in ('import', 'live'));

alter table public.matches
add column if not exists live_status text not null default 'final'
check (live_status in ('scheduled', 'live', 'final'));

alter table public.matches
add column if not exists provider text not null default 'manual'
check (provider in ('manual', 'synergy', 'sportradar'));

alter table public.matches
add column if not exists external_match_id text;

alter table public.matches
add column if not exists last_synced_at timestamptz;

create unique index if not exists matches_provider_external_id_idx
on public.matches (provider, external_match_id)
where external_match_id is not null;

create index if not exists matches_live_status_idx
on public.matches (analysis_type, source_type, live_status, played_at desc);

comment on column public.matches.source_type is
'import = boxscore importé manuellement ; live = match alimenté par un fournisseur';

comment on column public.matches.live_status is
'scheduled = à venir ; live = en cours ; final = terminé';

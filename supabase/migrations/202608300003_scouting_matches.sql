alter table public.matches
add column if not exists analysis_type text not null default 'jl'
check (analysis_type in ('jl', 'scouting'));

create index if not exists matches_analysis_type_played_at_idx
on public.matches (analysis_type, played_at desc);

comment on column public.matches.analysis_type is
'jl = rapport de performance JL Bourg ; scouting = rapport d’une équipe adverse';

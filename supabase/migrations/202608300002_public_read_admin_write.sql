create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

grant select on public.teams, public.players, public.metric_references to anon, authenticated;
grant select on public.matches, public.team_boxscores, public.player_boxscores, public.reports to anon, authenticated;
grant insert, update, delete on public.teams, public.players, public.metric_references to authenticated;
grant insert, update, delete on public.matches, public.team_boxscores, public.player_boxscores, public.reports to authenticated;

drop policy if exists "Public teams" on public.teams;
create policy "Public teams" on public.teams for select to anon, authenticated using (true);
drop policy if exists "Admin teams" on public.teams;
create policy "Admin teams" on public.teams for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public players" on public.players;
create policy "Public players" on public.players for select to anon, authenticated using (true);
drop policy if exists "Admin players" on public.players;
create policy "Admin players" on public.players for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public references" on public.metric_references;
create policy "Public references" on public.metric_references for select to anon, authenticated using (true);
drop policy if exists "Admin references" on public.metric_references;
create policy "Admin references" on public.metric_references for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public published matches" on public.matches;
create policy "Public published matches" on public.matches for select to anon, authenticated using (status = 'published');
drop policy if exists "Admin matches" on public.matches;
create policy "Admin matches" on public.matches for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public published team boxscores" on public.team_boxscores;
create policy "Public published team boxscores" on public.team_boxscores for select to anon, authenticated
using (exists (select 1 from public.matches where matches.id = team_boxscores.match_id and matches.status = 'published'));
drop policy if exists "Admin team boxscores" on public.team_boxscores;
create policy "Admin team boxscores" on public.team_boxscores for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public published player boxscores" on public.player_boxscores;
create policy "Public published player boxscores" on public.player_boxscores for select to anon, authenticated
using (exists (select 1 from public.matches where matches.id = player_boxscores.match_id and matches.status = 'published'));
drop policy if exists "Admin player boxscores" on public.player_boxscores;
create policy "Admin player boxscores" on public.player_boxscores for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public ready reports" on public.reports;
create policy "Public ready reports" on public.reports for select to anon, authenticated
using (
  status = 'ready'
  and exists (select 1 from public.matches where matches.id = reports.match_id and matches.status = 'published')
);
drop policy if exists "Admin reports" on public.reports;
create policy "Admin reports" on public.reports for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('boxscores', 'boxscores', false)
on conflict (id) do update set public = false;

drop policy if exists "Admin reads boxscore files" on storage.objects;
create policy "Admin reads boxscore files" on storage.objects for select to authenticated
using (bucket_id = 'boxscores' and public.is_admin());
drop policy if exists "Admin uploads boxscore files" on storage.objects;
create policy "Admin uploads boxscore files" on storage.objects for insert to authenticated
with check (
  bucket_id = 'boxscores'
  and public.is_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "Admin deletes boxscore files" on storage.objects;
create policy "Admin deletes boxscore files" on storage.objects for delete to authenticated
using (bucket_id = 'boxscores' and public.is_admin());


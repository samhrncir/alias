-- Alias: one row per bash alias, private to its owner. The browser is the
-- primary store; this table is the optional cross-PC copy for signed-in users.
create table if not exists public.aliases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 64),
  command     text not null check (char_length(command) between 1 and 4000),
  description text not null default '' check (char_length(description) <= 200),
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint aliases_user_name_key unique (user_id, name)
);

alter table public.aliases enable row level security;

-- Signed-in users only; anonymous visitors get nothing, even before RLS.
revoke all on public.aliases from anon;
grant select, insert, update, delete on public.aliases to authenticated;

create policy "Users read own aliases"
  on public.aliases for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own aliases"
  on public.aliases for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own aliases"
  on public.aliases for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete own aliases"
  on public.aliases for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Its own trigger function: this project is shared with other apps, so don't
-- redefine a generic set_updated_at() they may rely on.
create or replace function public.aliases_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists aliases_set_updated_at on public.aliases;
create trigger aliases_set_updated_at
  before update on public.aliases
  for each row execute function public.aliases_set_updated_at();

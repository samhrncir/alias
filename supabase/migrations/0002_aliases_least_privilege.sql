-- New tables pick up Supabase's default privileges (including TRUNCATE, which
-- ignores RLS). Signed-in users only need the four row operations.
revoke all on public.aliases from anon, authenticated;
grant select, insert, update, delete on public.aliases to authenticated;

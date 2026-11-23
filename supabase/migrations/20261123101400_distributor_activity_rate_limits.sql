create table if not exists public.distributor_activity_rate_limits (
  rate_key text primary key check (length(rate_key) = 64),
  window_start timestamptz not null,
  hit_count integer not null default 1 check (hit_count >= 1)
);

alter table public.distributor_activity_rate_limits enable row level security;
revoke all on table public.distributor_activity_rate_limits from public, anon, authenticated;
grant all on table public.distributor_activity_rate_limits to service_role;

create or replace function public.consume_distributor_activity_rate_limit(
  p_rate_key text,
  p_window_start timestamptz,
  p_max_hits integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hits integer;
begin
  if p_rate_key is null or length(p_rate_key) <> 64 or p_max_hits < 1 then
    return false;
  end if;

  insert into public.distributor_activity_rate_limits (rate_key, window_start, hit_count)
  values (p_rate_key, p_window_start, 1)
  on conflict (rate_key) do update
    set hit_count = case
      when public.distributor_activity_rate_limits.window_start = excluded.window_start
        then public.distributor_activity_rate_limits.hit_count + 1
      else 1
    end,
    window_start = excluded.window_start
  returning hit_count into v_hits;

  return v_hits <= p_max_hits;
end;
$$;

revoke all on function public.consume_distributor_activity_rate_limit(text,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.consume_distributor_activity_rate_limit(text,timestamptz,integer) to service_role;

comment on table public.distributor_activity_rate_limits is
  'Short-lived hashed-IP request counters for the public distributor activity endpoint; raw IP addresses are never stored.';

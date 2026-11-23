drop policy if exists "Service role manages distributor activity rate limits" on public.distributor_activity_rate_limits;
create policy "Service role manages distributor activity rate limits"
  on public.distributor_activity_rate_limits
  for all to service_role
  using (true)
  with check (true);
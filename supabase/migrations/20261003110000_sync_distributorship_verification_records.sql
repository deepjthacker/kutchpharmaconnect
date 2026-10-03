-- Keep verification_records synchronized with distributorship verification state.
-- One verification record is maintained per distributorship entity.
alter table public.verification_records
  add constraint verification_records_entity_unique unique (entity_type, entity_id);

create or replace function public.sync_distributorship_verification_record()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.verification_records(
    entity_type, entity_id, status, verified_date, verified_by, source, notes
  )
  values(
    'distributorship',
    new.id,
    new.verification_status,
    new.verified_date,
    case when new.verification_status='verified' then auth.uid() else null end,
    new.source,
    coalesce(new.verification_note,new.verification_notes)
  )
  on conflict (entity_type,entity_id) do update
  set status=excluded.status,
      verified_date=excluded.verified_date,
      verified_by=case
        when excluded.status='verified' then coalesce(excluded.verified_by,verification_records.verified_by)
        else null
      end,
      source=excluded.source,
      notes=excluded.notes;

  return new;
end;
$$;

drop trigger if exists trg_sync_distributorship_verification on public.distributorships;
create trigger trg_sync_distributorship_verification
after insert or update of verification_status,verified_date,source,verification_note,verification_notes
on public.distributorships
for each row
execute function public.sync_distributorship_verification_record();

alter function public.sync_distributorship_verification_record() set search_path=public;
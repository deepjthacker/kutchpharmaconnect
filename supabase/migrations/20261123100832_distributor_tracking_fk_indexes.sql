create index if not exists distributor_contact_events_division_time_idx
  on public.distributor_contact_events (division_id, occurred_at desc);
create index if not exists distributor_contact_events_brand_time_idx
  on public.distributor_contact_events (brand_id, occurred_at desc);
create index if not exists distributor_contact_events_distributorship_idx
  on public.distributor_contact_events (distributorship_id);
create index if not exists distributor_contact_events_product_distributor_idx
  on public.distributor_contact_events (product_distributor_id);

create index if not exists distributor_enquiries_company_created_idx
  on public.distributor_enquiries (company_id, created_at desc);
create index if not exists distributor_enquiries_division_created_idx
  on public.distributor_enquiries (division_id, created_at desc);
create index if not exists distributor_enquiries_brand_created_idx
  on public.distributor_enquiries (brand_id, created_at desc);
create index if not exists distributor_enquiries_product_created_idx
  on public.distributor_enquiries (product_id, created_at desc);
create index if not exists distributor_enquiries_distributorship_idx
  on public.distributor_enquiries (distributorship_id);
create index if not exists distributor_enquiries_product_distributor_idx
  on public.distributor_enquiries (product_distributor_id);
create index if not exists distributor_enquiries_reviewed_by_idx
  on public.distributor_enquiries (reviewed_by);

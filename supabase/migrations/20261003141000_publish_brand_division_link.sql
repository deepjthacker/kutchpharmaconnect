do $outer$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='publish_distributor_submission';

  def := replace(def,
    'insert into public.brands(company_id,brand_name,status)',
    'insert into public.brands(company_id,division_id,brand_name,status)');
  def := replace(def,
    "values(c_id,brand_name_value,'active')",
    "values(c_id,div_id,brand_name_value,'active')");
  def := replace(def,
    '      select id into brand_id\n      from public.brands',
    '      select id into brand_id\n      from public.brands');
  def := replace(def,
    '      limit 1;\n\n      if brand_id is null then',
    '      limit 1;\n\n      if brand_id is not null and div_id is null then\n        select division_id into div_id from public.brands where id=brand_id;\n      end if;\n\n      if brand_id is null then');

  execute def;
end $outer$;
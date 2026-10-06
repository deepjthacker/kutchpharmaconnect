do $outer$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='publish_distributor_submission';

  def := replace(
    def,
    $old$insert into public.brands(company_id,brand_name,status)$old$,
    $new$insert into public.brands(company_id,division_id,brand_name,status)$new$
  );

  def := replace(
    def,
    $old$values(c_id,brand_name_value,'active')$old$,
    $new$values(c_id,div_id,brand_name_value,'active')$new$
  );

  execute def;
end $outer$;
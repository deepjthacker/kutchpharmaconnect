do $outer$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='publish_distributor_submission';

  def := replace(def,
$old$      select id into brand_id
      from public.brands
      where company_id=c_id and normalized_brand_name =
        lower(regexp_replace(trim(brand_name_value),'\\s+',' ','g'))
      limit 1;

      if brand_id is null then
        insert into public.brands(company_id,brand_name,status)
        values(c_id,brand_name_value,'active')
        returning id into brand_id;
        created_brands := created_brands + 1;
      end if;$old$,
$new$      select b.id, b.division_id into brand_id, div_id
      from public.brands b
      where b.company_id=c_id and b.normalized_brand_name =
        lower(regexp_replace(trim(brand_name_value),'\\s+',' ','g'))
      limit 1;

      if brand_id is null then
        insert into public.brands(company_id,division_id,brand_name,status)
        values(c_id,div_id,brand_name_value,'active')
        returning id into brand_id;
        created_brands := created_brands + 1;
      else
        if div_id is not null and (select b2.division_id from public.brands b2 where b2.id=brand_id) is not null
           and (select b3.division_id from public.brands b3 where b3.id=brand_id) <> div_id then
          raise exception 'Selected brand belongs to a different division';
        end if;
        if div_id is null then
          select b4.division_id into div_id from public.brands b4 where b4.id=brand_id;
        end if;
      end if;$new$);

  if position('insert into public.brands(company_id,division_id,brand_name,status)' in def)=0 then
    raise exception 'Expected brand publish block was not found';
  end if;

  execute def;
end $outer$;
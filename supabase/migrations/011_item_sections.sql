-- Items belong to one section: Commissary (raw and for processing), Frozen & packed (bought ready:
-- processed meat and processed products), or Main store (everything else).
alter table public.items add column if not exists section text not null default 'Main store';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'items_section_check') then
    alter table public.items add constraint items_section_check check (section in ('Main store','Commissary','Frozen & packed'));
  end if;
end $$;

create or replace function public.section_for(p_category text) returns text
language sql immutable set search_path = public as $$
  select case
    when upper(coalesce(p_category,'')) in ('RAW MEAT','VEGETABLES','RAW FRUITS','FOR PROCESSING') then 'Commissary'
    when upper(coalesce(p_category,'')) in ('PROCESSED MEAT','PROCESSED PRODUCTS') then 'Frozen & packed'
    else 'Main store' end
$$;

update public.items set section = public.section_for(category);

-- New items pick their section from the category unless one was given.
create or replace function public.items_default_section() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.section is null or new.section = 'Main store' then new.section := public.section_for(new.category); end if;
  return new;
end $$;
drop trigger if exists items_default_section on public.items;
create trigger items_default_section before insert on public.items for each row execute function public.items_default_section();

create or replace view public.item_stock with (security_invoker = true) as
 select i.id, i.name, i.category, i.unit, i.stocked_at, i.used_by, i.purchase_unit, i.pack_conversion,
    i.supplier_id, i.alt_supplier_1_id, i.alt_supplier_2_id, i.lead_time_days, i.order_multiple,
    i.reorder_point, i.critical_level, i.par_target, i.active, i.notes,
    coalesce(s.qty, 0::numeric) as current_stock,
    case
      when i.critical_level is not null and coalesce(s.qty, 0::numeric) <= i.critical_level then 'CRITICAL'::text
      when i.reorder_point is not null and coalesce(s.qty, 0::numeric) <= i.reorder_point then 'LOW'::text
      else 'OK'::text
    end as status,
    coalesce(s.ever, false) as ever_stocked,
    i.section
   from public.items i
   left join (select item_id, sum(signed_qty) as qty, bool_or(signed_qty > 0) as ever
                from public.stock_movements group by item_id) s on s.item_id = i.id;

-- Raw meat, vegetables and raw fruits are kept in the commissary: set their stock location to COMMISSARY.
-- The old locations are written to the audit trail first so the change can be undone.
insert into public.audit_trail(user_name, action, record, detail)
select 'System', 'MOVE TO COMMISSARY', name, 'was: ' || coalesce(array_to_string(stocked_at, ', '), '')
  from public.items
 where upper(category) in ('RAW MEAT','VEGETABLES','RAW FRUITS') and stocked_at is distinct from array['COMMISSARY'];
update public.items set stocked_at = array['COMMISSARY']
 where upper(category) in ('RAW MEAT','VEGETABLES','RAW FRUITS') and stocked_at is distinct from array['COMMISSARY'];

-- Add an item with its full details and an optional opening balance in one step.
create or replace function public.add_item(p jsonb, p_opening numeric default null) returns uuid
language plpgsql set search_path = public as $$
declare v_id uuid; nm text; v_name text := upper(trim(p->>'name'));
begin
  perform public.require_role('Admin','Stock Keeper','Procurement Officer');
  if v_name is null or v_name = '' then raise exception 'Enter an item name'; end if;
  nm := public.my_name();
  insert into public.items(name, category, unit, stocked_at, used_by, purchase_unit, pack_conversion, supplier_id, alt_supplier_1_id, alt_supplier_2_id, lead_time_days, order_multiple, reorder_point, critical_level, par_target, notes)
  values (v_name, nullif(p->>'category',''), nullif(p->>'unit',''),
    coalesce(array(select jsonb_array_elements_text(p->'stocked_at')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p->'used_by')), '{}'),
    nullif(p->>'purchase_unit',''), nullif(p->>'pack_conversion',''),
    nullif(p->>'supplier_id','')::uuid, nullif(p->>'alt_supplier_1_id','')::uuid, nullif(p->>'alt_supplier_2_id','')::uuid,
    nullif(p->>'lead_time_days','')::int, nullif(p->>'order_multiple','')::numeric,
    nullif(p->>'reorder_point','')::numeric, nullif(p->>'critical_level','')::numeric, nullif(p->>'par_target','')::numeric,
    nullif(p->>'notes',''))
  returning id into v_id;
  if p_opening is not null and p_opening <> 0 then
    insert into public.stock_movements(movement_id, type, item_id, signed_qty, reference, user_name, note)
    values (public.next_id('MOV'), 'OPENING', v_id, p_opening, public.next_id('OPN'), nm, 'Opening balance');
  end if;
  insert into public.audit_trail(user_name, action, record, detail)
  values (nm, 'ADD ITEM', v_name, coalesce(p->>'category','') || ' · ' || coalesce(p->>'unit',''));
  return v_id;
end $$;
revoke execute on function public.add_item(jsonb, numeric) from public, anon;
grant execute on function public.add_item(jsonb, numeric) to authenticated;

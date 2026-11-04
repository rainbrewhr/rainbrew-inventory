-- Anyone who can search items may add a product that is not listed yet. Runs as definer because only ops roles
-- may insert into items directly; non-ops roles cannot set suppliers, stock levels or an opening balance.
-- The note records who added it so an admin can review it.
create or replace function public.add_item(p jsonb, p_opening numeric default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; nm text; v_role text; v_name text := upper(trim(p->>'name')); v_note text; v_ops boolean;
begin
  v_role := public.require_role('Admin','Stock Keeper','Procurement Officer','Station Staff','Requester');
  v_ops := v_role in ('Admin','Stock Keeper','Procurement Officer');
  if v_name is null or v_name = '' then raise exception 'Enter an item name'; end if;
  if exists (select 1 from public.items where name = v_name) then raise exception '% is already in the list', v_name; end if;
  nm := public.my_name();
  v_note := coalesce(nullif(p->>'notes',''), 'Added by ' || nm || ' (' || v_role || ') on ' || to_char(now() at time zone 'Asia/Manila', 'Mon FMDD, YYYY "at" FMHH12:MI AM'));
  insert into public.items(name, category, unit, stocked_at, used_by, purchase_unit, pack_conversion, supplier_id, alt_supplier_1_id, alt_supplier_2_id, lead_time_days, order_multiple, reorder_point, critical_level, par_target, notes)
  values (v_name, nullif(p->>'category',''), nullif(p->>'unit',''),
    coalesce(array(select jsonb_array_elements_text(p->'stocked_at')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p->'used_by')), '{}'),
    nullif(p->>'purchase_unit',''), nullif(p->>'pack_conversion',''),
    case when v_ops then nullif(p->>'supplier_id','')::uuid end,
    case when v_ops then nullif(p->>'alt_supplier_1_id','')::uuid end,
    case when v_ops then nullif(p->>'alt_supplier_2_id','')::uuid end,
    case when v_ops then nullif(p->>'lead_time_days','')::int end,
    case when v_ops then nullif(p->>'order_multiple','')::numeric end,
    case when v_ops then nullif(p->>'reorder_point','')::numeric end,
    case when v_ops then nullif(p->>'critical_level','')::numeric end,
    case when v_ops then nullif(p->>'par_target','')::numeric end,
    v_note)
  returning id into v_id;
  if v_ops and p_opening is not null and p_opening <> 0 then
    insert into public.stock_movements(movement_id, type, item_id, signed_qty, reference, user_name, note)
    values (public.next_id('MOV'), 'OPENING', v_id, p_opening, public.next_id('OPN'), nm, 'Opening balance');
  end if;
  insert into public.audit_trail(user_name, action, record, detail)
  values (nm, 'ADD ITEM', v_name, coalesce(p->>'category','') || ' · ' || coalesce(p->>'unit','') || ' · by ' || v_role);
  return v_id;
end $$;
revoke execute on function public.add_item(jsonb, numeric) from public, anon;
grant execute on function public.add_item(jsonb, numeric) to authenticated;

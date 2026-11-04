-- Add or remove the same quantity on one or many items, with a reason. Posted as ADJUST movements under one ADJ-MMDD-n reference.
create or replace function public.adjust_stock(p_item_ids uuid[], p_delta numeric, p_reason text, p_note text default null) returns text
language plpgsql set search_path = public as $$
declare iid uuid; v_stock numeric; nm text; v_ref text; v_note text;
begin
  perform public.require_role('Admin','Stock Keeper');
  if p_delta is null or p_delta = 0 then raise exception 'Enter a quantity to add or remove'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Choose a reason'; end if;
  if p_item_ids is null or cardinality(p_item_ids) = 0 then raise exception 'Select at least one item'; end if;
  nm := public.my_name();
  v_ref := public.next_id('ADJ');
  v_note := trim(p_reason) || coalesce(' — ' || nullif(trim(p_note), ''), '');
  foreach iid in array p_item_ids loop
    perform pg_advisory_xact_lock(hashtext(iid::text));
    select coalesce(sum(signed_qty), 0) into v_stock from public.stock_movements where item_id = iid;
    if v_stock + p_delta < 0 then
      raise exception 'Not enough stock for % (have %)', (select name from public.items where id = iid), v_stock;
    end if;
    insert into public.stock_movements(movement_id, type, item_id, signed_qty, reference, user_name, note)
    values (public.next_id('MOV'), 'ADJUST', iid, p_delta, v_ref, nm, v_note);
  end loop;
  insert into public.audit_trail(user_name, action, record, detail)
  values (nm, 'ADJUST STOCK', v_ref, cardinality(p_item_ids) || ' item(s), ' || p_delta || ' — ' || trim(p_reason));
  return v_ref;
end $$;
revoke execute on function public.adjust_stock(uuid[], numeric, text, text) from public, anon;
grant execute on function public.adjust_stock(uuid[], numeric, text, text) to authenticated;

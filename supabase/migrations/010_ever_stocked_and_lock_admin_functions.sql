-- 1) item_stock gains ever_stocked, so the app can tell "ran out" (alert) from "never stocked" (quiet).
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
    coalesce(s.ever, false) as ever_stocked
   from public.items i
   left join (select item_id, sum(signed_qty) as qty, bool_or(signed_qty > 0) as ever
                from public.stock_movements group by item_id) s on s.item_id = i.id;

-- 2) Admin request functions: only signed-in users may call them (the role check inside still applies).
revoke execute on function public.cancel_request(text, text) from public, anon;
revoke execute on function public.delete_request(text) from public, anon;
revoke execute on function public.edit_request_item(bigint, numeric) from public, anon;
revoke execute on function public.remove_request_item(bigint) from public, anon;
grant execute on function public.cancel_request(text, text), public.delete_request(text), public.edit_request_item(bigint, numeric), public.remove_request_item(bigint) to authenticated;

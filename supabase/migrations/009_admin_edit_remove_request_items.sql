-- Admin-only: change the quantity of an open request line, or remove a line that has nothing done yet.
-- Keeps the request's own status in step; stock ledger entries are never touched.
create or replace function public._refresh_request(rid text) returns void
language plpgsql security definer set search_path = public as $$
declare open_n int; ful_n int;
begin
  select count(*) filter (where status in ('Pending','Partial')), count(*) filter (where fulfilled_qty > 0)
    into open_n, ful_n from public.request_items where request_id = rid;
  update public.requests
     set status = case when open_n > 0 then (case when ful_n > 0 then 'Partial' else 'Pending' end)
                        when ful_n > 0 then (case type when 'Purchase' then 'Received' else 'Released' end)
                        else 'Cancelled' end,
         updated_at = now()
   where id = rid and status in ('Pending','Partial');
end $$;
revoke all on function public._refresh_request(text) from public, anon, authenticated;

create or replace function public.edit_request_item(p_line bigint, p_qty numeric) returns void
language plpgsql security definer set search_path = public as $$
declare li public.request_items%rowtype; rq public.requests%rowtype;
begin
  perform public.require_role('Admin');
  if p_qty is null or p_qty <= 0 then raise exception 'Enter a quantity above zero'; end if;
  select * into li from public.request_items where id = p_line for update;
  if not found then raise exception 'Line not found'; end if;
  select * into rq from public.requests where id = li.request_id for update;
  if rq.status not in ('Pending','Partial') or li.status not in ('Pending','Partial') then raise exception 'Only open lines can be edited'; end if;
  if p_qty < li.fulfilled_qty then raise exception '% already done on this line, so the quantity cannot go below that', li.fulfilled_qty; end if;
  update public.request_items
     set requested_qty = p_qty,
         status = case when fulfilled_qty >= p_qty then (case rq.type when 'Purchase' then 'Received' else 'Released' end)
                       when fulfilled_qty > 0 then 'Partial' else 'Pending' end
   where id = p_line;
  perform public._refresh_request(rq.id);
  insert into public.audit_trail(user_name, action, record, detail) values (public.my_name(), 'EDIT REQUEST ITEM', rq.id, 'line ' || p_line || ': ' || li.requested_qty || ' -> ' || p_qty);
end $$;

create or replace function public.remove_request_item(p_line bigint) returns void
language plpgsql security definer set search_path = public as $$
declare li public.request_items%rowtype; rq public.requests%rowtype; left_n int;
begin
  perform public.require_role('Admin');
  select * into li from public.request_items where id = p_line for update;
  if not found then raise exception 'Line not found'; end if;
  select * into rq from public.requests where id = li.request_id for update;
  if rq.status not in ('Pending','Partial') or li.status not in ('Pending','Partial') then raise exception 'Only open lines can be removed'; end if;
  if li.fulfilled_qty > 0 then raise exception 'Part of this line is already done, so lower the quantity instead of removing it'; end if;
  delete from public.request_items where id = p_line;
  select count(*) into left_n from public.request_items where request_id = rq.id;
  if left_n = 0 then
    update public.requests set status = 'Cancelled', notes = coalesce(notes || ' · ', '') || 'All items removed', updated_at = now() where id = rq.id;
  else
    perform public._refresh_request(rq.id);
  end if;
  insert into public.audit_trail(user_name, action, record, detail) values (public.my_name(), 'REMOVE REQUEST ITEM', rq.id, 'line ' || p_line || ' (' || li.requested_qty || ')');
end $$;

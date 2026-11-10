-- Receiving stock now settles open staff "request to buy" lines automatically (oldest first),
-- so the Buy list and the staff's own request status always agree, with or without picking a request.
create or replace function public.receive_stock(p_supplier text, p_ref text, p_note text, p_lines jsonb) returns text
language plpgsql set search_path = public as $$
declare l jsonb; q numeric; left_q numeric; take numeric; iid uuid; v_ref text; nm text; cnt int := 0;
        r public.requests%rowtype; ri record; touched text[] := '{}'; rid text;
begin
  perform public.require_role('Admin','Stock Keeper','Procurement Officer');
  nm := public.my_name();
  if nullif(p_ref,'') is not null then
    select * into r from public.requests where id = p_ref for update;
    if not found or r.type <> 'Purchase' or r.status not in ('Pending','Partial') then raise exception 'Purchase request % is not open', p_ref; end if;
    v_ref := p_ref;
  else
    v_ref := public.next_id('RCV');
  end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    q := (l->>'qty')::numeric; iid := (l->>'item_id')::uuid;
    continue when q is null or q <= 0;
    insert into public.stock_movements(movement_id, type, item_id, signed_qty, supplier, reference, user_name, note)
    values (public.next_id('MOV'), 'RECEIVE', iid, q, nullif(p_supplier,''), v_ref, nm, nullif(p_note,''));
    cnt := cnt + 1;
    left_q := q;
    for ri in
      select i.id as line_id, i.request_id, i.requested_qty, i.fulfilled_qty
        from public.request_items i join public.requests rq on rq.id = i.request_id
       where rq.type = 'Purchase' and rq.status in ('Pending','Partial') and i.item_id = iid and i.status in ('Pending','Partial')
       order by (rq.id = coalesce(nullif(p_ref,''), '')) desc, rq.created_at, rq.id
       for update of i
    loop
      exit when left_q <= 0;
      take := least(left_q, ri.requested_qty - ri.fulfilled_qty);
      continue when take <= 0;
      update public.request_items
         set fulfilled_qty = fulfilled_qty + take,
             status = case when fulfilled_qty + take >= requested_qty then 'Received' else 'Partial' end
       where id = ri.line_id;
      left_q := left_q - take;
      if not (ri.request_id = any(touched)) then touched := touched || ri.request_id; end if;
    end loop;
  end loop;
  if cnt = 0 then raise exception 'Enter a quantity to receive'; end if;
  foreach rid in array touched loop
    update public.requests
       set status = case when exists (select 1 from public.request_items where request_id = rid and status in ('Pending','Partial')) then 'Partial' else 'Received' end,
           updated_at = now()
     where id = rid;
  end loop;
  insert into public.audit_trail(user_name, action, record, detail) values (nm, 'RECEIVE', v_ref, cnt || ' line(s)');
  return v_ref;
end $$;

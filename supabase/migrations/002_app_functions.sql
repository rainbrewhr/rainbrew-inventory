-- Rainbrew Inventory: sign-up approval flow + atomic actions (release, receive, count, waste, request)

-- ---------- accounts ----------
alter table public.profiles
  add column if not exists approved boolean not null default false,
  add column if not exists requested_role text,
  add column if not exists requested_app text;

-- A pending (unapproved) account gets no role at all, so RLS gives it no data.
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() and active and approved $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  a text := new.raw_user_meta_data->>'app';
  r text;
  st text := nullif(new.raw_user_meta_data->>'station','');
begin
  r := case a when 'admin' then 'Admin' when 'stockkeeper' then 'Stock Keeper'
              when 'procurement' then 'Procurement Officer' when 'request' then 'Requester' else null end;
  if st is not null and not exists (select 1 from public.locations where name = st and type = 'Station') then st := null; end if;
  insert into public.profiles(id, name, email, role, station, approved, requested_role, requested_app)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''), split_part(new.email,'@',1)),
          new.email,
          case when a = 'request' then 'Requester' else 'Viewer' end,
          st,
          coalesce(a = 'request', false),
          r, a);
  return new;
end $$;

-- ---------- id generator (REQ-MMDD-n etc.) ----------
create table if not exists public.id_counters (key text primary key, n int not null);
alter table public.id_counters enable row level security;

insert into public.id_counters(key, n)
select regexp_replace(id, '-\d+$', ''), max(substring(id from '\d+$')::int)
from (
  select movement_id id from public.stock_movements
  union all select id from public.requests
  union all select count_id from public.stock_counts
  union all select reference from public.stock_movements
) x
where id ~ '^[A-Z]+-\d{4}-\d+$'
group by 1
on conflict (key) do update set n = greatest(public.id_counters.n, excluded.n);

create or replace function public.next_id(p_prefix text) returns text
language plpgsql security definer set search_path = public as $$
declare v_k text; v_n int;
begin
  if public.app_role() is null then raise exception 'not allowed'; end if;
  v_k := p_prefix || '-' || to_char(now() at time zone 'Asia/Manila', 'MMDD');
  insert into public.id_counters(key, n) values (v_k, 1)
  on conflict (key) do update set n = public.id_counters.n + 1
  returning n into v_n;
  return v_k || '-' || v_n;
end $$;

create or replace function public.require_role(variadic p_roles text[]) returns text
language plpgsql stable set search_path = public as $$
declare r text := public.app_role();
begin
  if r is null or not (r = any(p_roles)) then raise exception 'Your role is not allowed to do this'; end if;
  return r;
end $$;

create or replace function public.my_name() returns text
language sql stable set search_path = public as
$$ select name from public.profiles where id = auth.uid() $$;

-- ---------- reads ----------
-- Every approved role may see items with live stock (requesters need it), without reading raw movements.
create or replace function public.catalog() returns setof public.item_stock
language plpgsql stable security definer set search_path = public as $$
begin
  if public.app_role() is null then raise exception 'not allowed'; end if;
  return query select * from public.item_stock order by name;
end $$;

-- ---------- account helpers ----------
create or replace function public.set_my_station(p_station text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.locations where name = p_station and type = 'Station') then raise exception 'Unknown station'; end if;
  update public.profiles set station = p_station where id = auth.uid();
end $$;

-- The first admin claims the account once; afterwards only an admin can approve people.
create or replace function public.claim_first_admin() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.profiles where role = 'Admin' and active and approved) then
    raise exception 'An admin already exists. Ask them to approve your account.';
  end if;
  if not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) then
    raise exception 'Confirm your email first';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and requested_app = 'admin') then
    raise exception 'Create the account from the Admin app';
  end if;
  update public.profiles set role = 'Admin', approved = true where id = auth.uid();
end $$;

-- ---------- requests ----------
create or replace function public.create_request(p_type text, p_station text, p_notes text, p_lines jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare v_role text; v_id text; p public.profiles%rowtype; v_station text;
begin
  v_role := public.require_role('Admin','Stock Keeper','Station Staff','Requester');
  if p_type not in ('Transfer','Purchase') then raise exception 'Bad request type'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one item'; end if;
  select * into p from public.profiles where id = auth.uid();
  v_station := case when v_role in ('Station Staff','Requester') and p.station is not null then p.station else nullif(p_station,'') end;
  if p_type = 'Transfer' and v_station is null then raise exception 'Pick a station'; end if;
  v_id := public.next_id(case p_type when 'Transfer' then 'REQ' else 'PUR' end);
  insert into public.requests(id, type, station, requester_id, requester_name, requester_email, status, notes)
  values (v_id, p_type, v_station, auth.uid(), p.name, p.email, 'Pending', nullif(p_notes,''));
  insert into public.request_items(request_id, item_id, unit, requested_qty)
  select v_id, i.id, i.unit, (l->>'qty')::numeric
  from jsonb_array_elements(p_lines) l
  join public.items i on i.id = (l->>'item_id')::uuid
  where (l->>'qty')::numeric > 0;
  if not exists (select 1 from public.request_items where request_id = v_id) then raise exception 'Add at least one item with a quantity'; end if;
  insert into public.audit_trail(user_name, action, record, detail)
  values (p.name, case p_type when 'Transfer' then 'CREATE REQUEST' else 'REQUEST TO BUY' end, v_id, coalesce(v_station,''));
  return v_id;
end $$;

create or replace function public.reject_request(p_req text, p_reason text default null) returns void
language plpgsql set search_path = public as $$
begin
  perform public.require_role('Admin','Stock Keeper','Procurement Officer');
  update public.requests
     set status = 'Rejected', notes = coalesce(nullif(p_reason,''), notes), updated_at = now()
   where id = p_req and status in ('Pending','Partial');
  if not found then raise exception 'Request % is not open', p_req; end if;
  insert into public.audit_trail(user_name, action, record, detail) values (public.my_name(), 'REJECT REQUEST', p_req, coalesce(p_reason,''));
end $$;

-- ---------- stock actions ----------
create or replace function public.release_request(p_req text, p_lines jsonb) returns void
language plpgsql set search_path = public as $$
declare r public.requests%rowtype; l jsonb; ri public.request_items%rowtype; q numeric; v_stock numeric; nm text; done int := 0;
begin
  perform public.require_role('Admin','Stock Keeper','Procurement Officer');
  nm := public.my_name();
  select * into r from public.requests where id = p_req for update;
  if not found then raise exception 'Request % not found', p_req; end if;
  if r.type <> 'Transfer' or r.status not in ('Pending','Partial') then raise exception 'Request % is not open', p_req; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    q := (l->>'qty')::numeric;
    continue when q is null or q <= 0;
    select * into ri from public.request_items where id = (l->>'line_id')::bigint and request_id = p_req for update;
    if not found then raise exception 'Line not found on %', p_req; end if;
    if q > ri.remaining_qty then raise exception 'Cannot release more than is still requested'; end if;
    perform pg_advisory_xact_lock(hashtext(ri.item_id::text));
    select coalesce(sum(signed_qty), 0) into v_stock from public.stock_movements where item_id = ri.item_id;
    if v_stock < q then raise exception 'Not enough stock for % (have %, need %)', (select name from public.items where id = ri.item_id), v_stock, q; end if;
    insert into public.stock_movements(movement_id, type, item_id, signed_qty, station, reference, user_name, note)
    values (public.next_id('MOV'), 'RELEASE', ri.item_id, -q, r.station, p_req, nm, 'Released to ' || coalesce(r.station,''));
    update public.request_items
       set fulfilled_qty = fulfilled_qty + q,
           status = case when fulfilled_qty + q >= requested_qty then 'Released' else 'Partial' end
     where id = ri.id;
    done := done + 1;
  end loop;
  if done = 0 then raise exception 'Enter a quantity to release'; end if;
  update public.requests
     set status = case when exists (select 1 from public.request_items where request_id = p_req and status in ('Pending','Partial')) then 'Partial' else 'Released' end,
         updated_at = now()
   where id = p_req;
  insert into public.audit_trail(user_name, action, record, detail) values (nm, 'RELEASE', p_req, done || ' line(s)');
end $$;

create or replace function public.receive_stock(p_supplier text, p_ref text, p_note text, p_lines jsonb) returns text
language plpgsql set search_path = public as $$
declare l jsonb; q numeric; iid uuid; v_ref text; nm text; cnt int := 0; r public.requests%rowtype;
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
    if r.id is not null then
      update public.request_items
         set fulfilled_qty = fulfilled_qty + q,
             status = case when fulfilled_qty + q >= requested_qty then 'Received' else 'Partial' end
       where request_id = r.id and item_id = iid and status in ('Pending','Partial');
    end if;
  end loop;
  if cnt = 0 then raise exception 'Enter a quantity to receive'; end if;
  if r.id is not null then
    update public.requests
       set status = case when exists (select 1 from public.request_items where request_id = r.id and status in ('Pending','Partial')) then 'Partial' else 'Received' end,
           updated_at = now()
     where id = r.id;
  end if;
  insert into public.audit_trail(user_name, action, record, detail) values (nm, 'RECEIVE', v_ref, cnt || ' line(s)');
  return v_ref;
end $$;

create or replace function public.record_count(p_lines jsonb) returns text
language plpgsql set search_path = public as $$
declare l jsonb; iid uuid; c numeric; v_sys numeric; v_id text; nm text; n int := 0;
begin
  perform public.require_role('Admin','Stock Keeper');
  nm := public.my_name();
  v_id := public.next_id('CNT');
  for l in select * from jsonb_array_elements(p_lines) loop
    iid := (l->>'item_id')::uuid; c := (l->>'counted')::numeric;
    continue when c is null or c < 0;
    perform pg_advisory_xact_lock(hashtext(iid::text));
    select coalesce(sum(signed_qty), 0) into v_sys from public.stock_movements where item_id = iid;
    insert into public.stock_counts(count_id, item_id, system_qty, counted_qty, counted_by) values (v_id, iid, v_sys, c, nm);
    if c <> v_sys then
      insert into public.stock_movements(movement_id, type, item_id, signed_qty, reference, user_name, note)
      values (public.next_id('MOV'), 'ADJUST', iid, c - v_sys, v_id, nm, 'Count variance');
    end if;
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'Enter at least one counted quantity'; end if;
  insert into public.audit_trail(user_name, action, record, detail) values (nm, 'COUNT', v_id, n || ' item(s)');
  return v_id;
end $$;

-- p_kind 'stockroom' deducts stock; 'station' is a log only.
create or replace function public.log_waste(p_kind text, p_station text, p_note text, p_lines jsonb) returns text
language plpgsql set search_path = public as $$
declare l jsonb; iid uuid; q numeric; v_role text; v_id text; nm text; v_stock numeric; v_station text; n int := 0; v_unit text;
begin
  if p_kind = 'stockroom' then
    v_role := public.require_role('Admin','Stock Keeper');
    v_id := public.next_id('WST');
  elsif p_kind = 'station' then
    v_role := public.require_role('Admin','Stock Keeper','Station Staff');
    v_id := public.next_id('SWL');
    v_station := nullif(p_station,'');
    if v_role = 'Station Staff' then
      select station into v_station from public.profiles where id = auth.uid();
    end if;
    if v_station is null then raise exception 'Pick a station'; end if;
  else
    raise exception 'Bad waste type';
  end if;
  nm := public.my_name();
  for l in select * from jsonb_array_elements(p_lines) loop
    iid := (l->>'item_id')::uuid; q := (l->>'qty')::numeric;
    continue when q is null or q <= 0;
    if p_kind = 'stockroom' then
      perform pg_advisory_xact_lock(hashtext(iid::text));
      select coalesce(sum(signed_qty), 0) into v_stock from public.stock_movements where item_id = iid;
      if v_stock < q then raise exception 'Not enough stock for %', (select name from public.items where id = iid); end if;
      insert into public.stock_movements(movement_id, type, item_id, signed_qty, reference, user_name, note)
      values (public.next_id('MOV'), 'WASTE', iid, -q, v_id, nm, coalesce(nullif(l->>'reason',''), nullif(p_note,''), 'Waste'));
    else
      select unit into v_unit from public.items where id = iid;
      insert into public.station_waste_log(log_id, station, item_id, qty, unit, reason, note, user_name)
      values (v_id, v_station, iid, q, v_unit, nullif(l->>'reason',''), nullif(p_note,''), nm);
    end if;
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'Enter a quantity'; end if;
  insert into public.audit_trail(user_name, action, record, detail) values (nm, 'WASTE (' || p_kind || ')', v_id, n || ' line(s)');
  return v_id;
end $$;

-- ---------- grants: signed-in only ----------
do $$
declare f text;
begin
  foreach f in array array[
    'next_id(text)','require_role(text[])','my_name()','catalog()','set_my_station(text)','claim_first_admin()',
    'create_request(text,text,text,jsonb)','reject_request(text,text)','release_request(text,jsonb)',
    'receive_stock(text,text,text,jsonb)','record_count(jsonb)','log_waste(text,text,text,jsonb)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.app_role() from public, anon;
grant execute on function public.app_role() to authenticated;

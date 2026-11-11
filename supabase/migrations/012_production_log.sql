-- Production log: record a batch (ingredients used -> product made) in one atomic step.
-- Ingredients are deducted and the product is added in the stock ledger; recipes are optional templates.
alter table public.stock_movements drop constraint if exists stock_movements_type_check;
alter table public.stock_movements add constraint stock_movements_type_check
  check (type = any (array['OPENING','RECEIVE','RELEASE','ADJUST','WASTE','PRODUCE','PRODUCE_USE']));

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  output_item_id uuid not null references public.items(id),
  output_qty numeric not null check (output_qty > 0),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.recipe_inputs (
  id bigint generated always as identity primary key,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  item_id uuid not null references public.items(id),
  qty numeric not null check (qty > 0)
);
create table if not exists public.productions (
  id text primary key,
  ts timestamptz not null default now(),
  user_name text,
  recipe_id uuid references public.recipes(id) on delete set null,
  recipe_name text,
  output_item_id uuid not null references public.items(id),
  output_qty numeric not null check (output_qty > 0),
  expected_qty numeric,
  note text
);
create table if not exists public.production_inputs (
  id bigint generated always as identity primary key,
  production_id text not null references public.productions(id) on delete cascade,
  item_id uuid not null references public.items(id),
  qty numeric not null check (qty > 0)
);
create index if not exists productions_ts_idx on public.productions(ts desc);
create index if not exists recipe_inputs_recipe_idx on public.recipe_inputs(recipe_id);
create index if not exists production_inputs_prod_idx on public.production_inputs(production_id);

alter table public.recipes enable row level security;
alter table public.recipe_inputs enable row level security;
alter table public.productions enable row level security;
alter table public.production_inputs enable row level security;

create policy rc_read on public.recipes for select to authenticated using (public.app_role() in ('Admin','Stock Keeper','Procurement Officer','Viewer'));
create policy rc_write on public.recipes for all to authenticated using (public.app_role() in ('Admin','Stock Keeper')) with check (public.app_role() in ('Admin','Stock Keeper'));
create policy ri2_read on public.recipe_inputs for select to authenticated using (public.app_role() in ('Admin','Stock Keeper','Procurement Officer','Viewer'));
create policy ri2_write on public.recipe_inputs for all to authenticated using (public.app_role() in ('Admin','Stock Keeper')) with check (public.app_role() in ('Admin','Stock Keeper'));
create policy pr_read on public.productions for select to authenticated using (public.app_role() in ('Admin','Stock Keeper','Procurement Officer','Viewer'));
create policy pr_ins on public.productions for insert to authenticated with check (public.app_role() in ('Admin','Stock Keeper'));
create policy pi_read on public.production_inputs for select to authenticated using (public.app_role() in ('Admin','Stock Keeper','Procurement Officer','Viewer'));
create policy pi_ins on public.production_inputs for insert to authenticated with check (public.app_role() in ('Admin','Stock Keeper'));

create or replace function public.log_production(p_output_item uuid, p_output_qty numeric, p_inputs jsonb, p_recipe uuid default null, p_expected numeric default null, p_note text default null)
returns text language plpgsql set search_path = public as $$
declare l jsonb; iid uuid; q numeric; v_stock numeric; nm text; v_id text; v_rname text; v_out text; n int := 0;
begin
  perform public.require_role('Admin','Stock Keeper');
  if p_output_item is null or p_output_qty is null or p_output_qty <= 0 then raise exception 'Enter how much was made'; end if;
  if p_inputs is null or jsonb_typeof(p_inputs) <> 'array' or jsonb_array_length(p_inputs) = 0 then raise exception 'Add at least one ingredient used'; end if;
  nm := public.my_name();
  select name into v_out from public.items where id = p_output_item;
  if v_out is null then raise exception 'Product not found'; end if;
  if p_recipe is not null then select name into v_rname from public.recipes where id = p_recipe; end if;
  for l in select * from jsonb_array_elements(p_inputs) loop
    iid := (l->>'item_id')::uuid; q := (l->>'qty')::numeric;
    if q is null or q <= 0 then continue; end if;
    if iid = p_output_item then raise exception 'The product cannot be its own ingredient'; end if;
    perform pg_advisory_xact_lock(hashtext(iid::text));
    select coalesce(sum(signed_qty), 0) into v_stock from public.stock_movements where item_id = iid;
    if v_stock < q then raise exception 'Not enough % (have %, need %)', (select name from public.items where id = iid), v_stock, q; end if;
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'Add at least one ingredient with a quantity'; end if;
  v_id := public.next_id('PRD');
  insert into public.productions(id, user_name, recipe_id, recipe_name, output_item_id, output_qty, expected_qty, note)
  values (v_id, nm, p_recipe, v_rname, p_output_item, p_output_qty, p_expected, nullif(trim(p_note), ''));
  for l in select * from jsonb_array_elements(p_inputs) loop
    iid := (l->>'item_id')::uuid; q := (l->>'qty')::numeric;
    if q is null or q <= 0 then continue; end if;
    insert into public.production_inputs(production_id, item_id, qty) values (v_id, iid, q);
    insert into public.stock_movements(movement_id, type, item_id, signed_qty, reference, user_name, note)
    values (public.next_id('MOV'), 'PRODUCE_USE', iid, -q, v_id, nm, 'Used to make ' || v_out);
  end loop;
  insert into public.stock_movements(movement_id, type, item_id, signed_qty, reference, user_name, note)
  values (public.next_id('MOV'), 'PRODUCE', p_output_item, p_output_qty, v_id, nm, 'Made from ' || n || ' ingredient(s)' || coalesce(' — ' || nullif(trim(p_note), ''), ''));
  insert into public.audit_trail(user_name, action, record, detail) values (nm, 'PRODUCTION', v_id, v_out || ' x ' || p_output_qty || ' from ' || n || ' ingredient(s)');
  return v_id;
end $$;

create or replace function public.save_recipe(p_id uuid, p_name text, p_output_item uuid, p_output_qty numeric, p_inputs jsonb, p_notes text default null)
returns uuid language plpgsql set search_path = public as $$
declare rid uuid := p_id; l jsonb; n int := 0;
begin
  perform public.require_role('Admin','Stock Keeper');
  if coalesce(trim(p_name), '') = '' then raise exception 'Give the recipe a name'; end if;
  if p_output_item is null or p_output_qty is null or p_output_qty <= 0 then raise exception 'Enter what one batch makes'; end if;
  if p_inputs is null or jsonb_typeof(p_inputs) <> 'array' or jsonb_array_length(p_inputs) = 0 then raise exception 'Add at least one ingredient'; end if;
  if rid is null then
    insert into public.recipes(name, output_item_id, output_qty, notes) values (trim(p_name), p_output_item, p_output_qty, nullif(trim(p_notes), '')) returning id into rid;
  else
    update public.recipes set name = trim(p_name), output_item_id = p_output_item, output_qty = p_output_qty, notes = nullif(trim(p_notes), ''), updated_at = now() where id = rid;
    if not found then raise exception 'Recipe not found'; end if;
    delete from public.recipe_inputs where recipe_id = rid;
  end if;
  for l in select * from jsonb_array_elements(p_inputs) loop
    if (l->>'qty')::numeric > 0 and (l->>'item_id')::uuid <> p_output_item then
      insert into public.recipe_inputs(recipe_id, item_id, qty) values (rid, (l->>'item_id')::uuid, (l->>'qty')::numeric); n := n + 1;
    end if;
  end loop;
  if n = 0 then raise exception 'Add at least one ingredient with a quantity'; end if;
  return rid;
end $$;

revoke execute on function public.log_production(uuid, numeric, jsonb, uuid, numeric, text) from public, anon;
revoke execute on function public.save_recipe(uuid, text, uuid, numeric, jsonb, text) from public, anon;
grant execute on function public.log_production(uuid, numeric, jsonb, uuid, numeric, text), public.save_recipe(uuid, text, uuid, numeric, jsonb, text) to authenticated;

-- Push notifications: new requests right away, one stock summary every day at 7 PM Manila time (11:00 UTC).
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- VAPID keys and the shared secret live here; no policies and no grants, so only the service role can read them.
create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  public_key text,
  private_key text,
  trigger_secret text not null default encode(extensions.gen_random_bytes(24), 'hex')
);
insert into public.push_config(id) values (1) on conflict do nothing;
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  ua text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
create policy ps_own on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.push_public_key() returns text
language sql stable security definer set search_path = public as $$
  select case when public.app_role() is null then null else (select public_key from public.push_config where id = 1) end
$$;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() is null then raise exception 'not allowed'; end if;
  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth, ua) values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_ua)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua;
end $$;

create or replace function public.delete_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;

create or replace function public.call_send_push(p_body jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://mdzwvfebndnvotugtewb.supabase.co/functions/v1/send-push',
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', (select trigger_secret from public.push_config where id = 1))
  );
exception when others then null; -- a push problem must never block saving a request
end $$;

create or replace function public.notify_new_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.call_send_push(jsonb_build_object('type', 'request', 'id', new.id, 'kind', new.type, 'station', new.station, 'requester_id', new.requester_id, 'requester_name', new.requester_name));
  return new;
end $$;
drop trigger if exists requests_push on public.requests;
create trigger requests_push after insert on public.requests for each row execute function public.notify_new_request();

revoke execute on function public.call_send_push(jsonb), public.notify_new_request() from public, anon, authenticated;
revoke execute on function public.push_public_key(), public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text) from public, anon;
grant execute on function public.push_public_key(), public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text) to authenticated;

select cron.unschedule('stock-digest-7pm') where exists (select 1 from cron.job where jobname = 'stock-digest-7pm');
select cron.schedule('stock-digest-7pm', '0 11 * * *', $$select public.call_send_push('{"type":"digest"}'::jsonb)$$);

-- Admin-only: cancel an open request (kept in history as Cancelled) or delete any request.
-- Stock ledger entries are never touched.
create or replace function public.cancel_request(p_req text, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_role('Admin');
  update public.requests
     set status = 'Cancelled', notes = coalesce(nullif(p_reason,''), notes), updated_at = now()
   where id = p_req and status in ('Pending','Partial');
  if not found then raise exception 'Request % is not open', p_req; end if;
  update public.request_items set status = 'Cancelled' where request_id = p_req and status in ('Pending','Partial');
  insert into public.audit_trail(user_name, action, record, detail) values (public.my_name(), 'CANCEL REQUEST', p_req, coalesce(p_reason,''));
end $$;

create or replace function public.delete_request(p_req text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_role('Admin');
  delete from public.requests where id = p_req;
  if not found then raise exception 'Request % not found', p_req; end if;
  insert into public.audit_trail(user_name, action, record, detail) values (public.my_name(), 'DELETE REQUEST', p_req, 'Deleted by admin; stock ledger entries are kept');
end $$;

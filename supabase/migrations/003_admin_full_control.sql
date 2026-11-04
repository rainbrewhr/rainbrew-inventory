-- Admin can fix or remove requests and waste logs. Stock movements stay append-only
-- (corrections are posted as adjustments) so the ledger can always be audited.
create policy rq_admin_del on public.requests for delete to authenticated using (public.app_role() = 'Admin');
create policy ri_admin_del on public.request_items for delete to authenticated using (public.app_role() = 'Admin');
create policy sw_admin_upd on public.station_waste_log for update to authenticated using (public.app_role() = 'Admin') with check (public.app_role() = 'Admin');
create policy sw_admin_del on public.station_waste_log for delete to authenticated using (public.app_role() = 'Admin');

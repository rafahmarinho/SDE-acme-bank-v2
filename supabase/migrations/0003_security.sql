-- ACME Bank: least-privilege grants and Row Level Security.
--
-- Access matrix (rows = objects, R/C/U/D = select/insert/update/delete; "own" = customer_id = auth.uid())
--   object              customer               support              admin                service_role
--   profiles            R/U own (limited cols)  via staff fn (masked) via staff fn         all
--   accounts            R own                   R                    R                    all
--   ledger_entries      R own                   R                    R                    insert (via RPC)
--   transfers           R own (writes via RPC)  R                    R                    all
--   beneficiaries       R/C/D own               -                    -                    all
--   scheduled_payments  R/C own, U own->cancel  R                    R                    all
--   cards               R own, U own(status/limit) R                 R/U                  all
--   statements          R own                   -                    -                    all
--   support_tickets     R/C own                 R/U(status)          R/U(status)          all
--   support_replies     R own ticket, C own     R/C                  R/C                  all
--   consents/events     R/U own / R/C own       -                    -                    all
--   processing_restr.   R own                   R/C                  R/C/D                all
--   sim_events          -                       -                    R                    all
--   audit.*, private.*  -                       -                    via admin fn         all

-- ---------------------------------------------------------------- default deny
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

revoke all on schema private, audit from public, anon, authenticated;
revoke all on all tables in schema private, audit from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private, audit to service_role;
grant all on all tables in schema private to service_role;
grant select, insert on audit.log to service_role;          -- no update/delete for anyone
grant execute on all functions in schema private to service_role;

-- ---------------------------------------------------------------- table privileges (authenticated)
grant select on public.profiles to authenticated;
grant update (full_name, phone, address_line1, city, postal_code, updated_at) on public.profiles to authenticated;
grant select on public.accounts, public.ledger_entries, public.transfers, public.statements to authenticated;
grant select, insert, delete on public.beneficiaries to authenticated;
grant select, insert on public.scheduled_payments to authenticated;
grant update (status) on public.scheduled_payments to authenticated;
grant select on public.cards to authenticated;
grant update (status, daily_limit_cents, updated_at) on public.cards to authenticated;
grant select, insert on public.support_tickets, public.support_replies to authenticated;
grant update (status) on public.support_tickets to authenticated;
grant select, insert, update on public.consents to authenticated;
grant select, insert on public.consent_events to authenticated;
grant select, insert, delete on public.processing_restrictions to authenticated;
grant select on public.sim_events to authenticated;

-- ---------------------------------------------------------------- function privileges
grant execute on function public.auth_role(), public.is_staff() to authenticated;
grant execute on function public.quote_transfer(uuid, bigint, uuid, uuid) to authenticated;
grant execute on function public.confirm_transfer(uuid, text) to authenticated;
grant execute on function public.staff_search_customers(text) to authenticated;
grant execute on function public.staff_activity_daily(integer) to authenticated;
grant execute on function public.admin_audit_log(integer) to authenticated;
-- Service-role only (never callable by end users):
grant execute on function
  public.audit_event(text, jsonb), public.rate_limit_hit(text, integer, integer),
  public.login_failure_status(text), public.login_failure_record(text), public.login_failure_reset(text),
  public.revoke_user_sessions(uuid), public.customer_pseudonym(uuid), public.open_customer_account(uuid, text, text, text, text, text, text, text, boolean, boolean),
  public.seed_customer(uuid, text, text, text), public.seed_ledger_entry(uuid, timestamptz, text, bigint, text),
  public.settle_pending_transfers(), public.execute_due_scheduled_payments(),
  public.sim_apply(text, integer, uuid), public.sim_reset_demo_data(uuid)
to service_role;

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.transfers enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.scheduled_payments enable row level security;
alter table public.cards enable row level security;
alter table public.statements enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_replies enable row level security;
alter table public.consents enable row level security;
alter table public.consent_events enable row level security;
alter table public.processing_restrictions enable row level security;
alter table public.sim_events enable row level security;

-- profiles: owner only (staff use the masked staff_search_customers function)
create policy profiles_owner_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_owner_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- accounts / ledger / transfers: owner or staff, read-only (writes only via SECURITY DEFINER RPCs)
create policy accounts_select on public.accounts for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_staff()));
create policy ledger_select on public.ledger_entries for select to authenticated
  using ((select public.is_staff()) or exists (
    select 1 from public.accounts a where a.id = ledger_entries.account_id and a.customer_id = (select auth.uid())));
create policy transfers_select on public.transfers for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_staff()));

-- beneficiaries: owner only
create policy beneficiaries_owner_select on public.beneficiaries for select to authenticated using (customer_id = (select auth.uid()));
create policy beneficiaries_owner_insert on public.beneficiaries for insert to authenticated with check (customer_id = (select auth.uid()));
create policy beneficiaries_owner_delete on public.beneficiaries for delete to authenticated using (customer_id = (select auth.uid()));

-- scheduled payments: owner creates from own account to own beneficiary; may only cancel
create policy scheduled_select on public.scheduled_payments for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_staff()));
create policy scheduled_insert on public.scheduled_payments for insert to authenticated with check (
  customer_id = (select auth.uid()) and status = 'scheduled' and execute_on > current_date
  and exists (select 1 from public.accounts a where a.id = from_account_id and a.customer_id = (select auth.uid()))
  and exists (select 1 from public.beneficiaries b where b.id = beneficiary_id and b.customer_id = (select auth.uid())));
create policy scheduled_cancel on public.scheduled_payments for update to authenticated
  using (customer_id = (select auth.uid()) and status = 'scheduled')
  with check (customer_id = (select auth.uid()) and status = 'cancelled');

-- cards: owner reads/updates status+limit (column grants); support reads; admin updates
create policy cards_select on public.cards for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_staff()));
create policy cards_owner_update on public.cards for update to authenticated
  using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));
create policy cards_admin_update on public.cards for update to authenticated
  using ((select public.auth_role()) = 'admin') with check ((select public.auth_role()) = 'admin');

-- statements: owner only (written by the server with the service role)
create policy statements_owner_select on public.statements for select to authenticated using (customer_id = (select auth.uid()));

-- support
create policy tickets_select on public.support_tickets for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_staff()));
create policy tickets_insert on public.support_tickets for insert to authenticated
  with check (customer_id = (select auth.uid()) and status = 'open');
create policy tickets_staff_update on public.support_tickets for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy replies_select on public.support_replies for select to authenticated
  using ((select public.is_staff()) or exists (
    select 1 from public.support_tickets t where t.id = support_replies.ticket_id and t.customer_id = (select auth.uid())));
create policy replies_insert on public.support_replies for insert to authenticated
  with check (author_id = (select auth.uid()) and ((select public.is_staff()) or exists (
    select 1 from public.support_tickets t where t.id = ticket_id and t.customer_id = (select auth.uid()))));

-- consents: owner manages optional consents; required consents cannot be withdrawn here
create policy consents_owner_select on public.consents for select to authenticated using (user_id = (select auth.uid()));
create policy consents_owner_upsert on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()) and purpose in ('marketing_email', 'product_analytics'));
create policy consents_owner_update on public.consents for update to authenticated
  using (user_id = (select auth.uid()) and purpose in ('marketing_email', 'product_analytics'))
  with check (user_id = (select auth.uid()) and purpose in ('marketing_email', 'product_analytics'));
create policy consent_events_owner_select on public.consent_events for select to authenticated using (user_id = (select auth.uid()));
create policy consent_events_owner_insert on public.consent_events for insert to authenticated with check (user_id = (select auth.uid()));

-- processing restrictions: customer reads own; support/admin record restrictions on request; admin lifts
create policy restrictions_select on public.processing_restrictions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy restrictions_staff_insert on public.processing_restrictions for insert to authenticated
  with check ((select public.is_staff()) and created_by = (select auth.uid()));
create policy restrictions_admin_delete on public.processing_restrictions for delete to authenticated
  using ((select public.auth_role()) = 'admin');

-- simulation events: admin only
create policy sim_events_admin_select on public.sim_events for select to authenticated
  using ((select public.auth_role()) = 'admin');

-- Balances view runs with the caller's privileges, so RLS on ledger_entries applies.
create view public.account_balances with (security_invoker = true) as
  select a.id as account_id, a.customer_id,
         coalesce(sum(case when le.direction = 'credit' then le.amount_cents else -le.amount_cents end), 0)::bigint as balance_cents
  from public.accounts a left join public.ledger_entries le on le.account_id = a.id
  group by a.id, a.customer_id;
grant select on public.account_balances to authenticated;

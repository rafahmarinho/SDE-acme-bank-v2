-- ACME Bank: product features on top of the hardened core schema (0001-0005).
--   * Simulation clock (app_now / app_today) so "advance the simulation" moves time consistently.
--   * Card authorizations: simulated purchases honour card status, daily limit and balance.
--   * Tiered transfer fees from one SQL function (shown to the user before confirmation).
--   * Monthly scheduled payments, settlement that credits internal ACME accounts.
--   * Deterministic synthetic demo baseline (six fictional customers, two months of activity) and a
--     reset that restores it. The audit trail is never touched (T349); ledger deletion is only possible
--     inside the admin-only reset function while a transaction-local flag is set.
--   * Staff functions return masked / aggregated data only (T2139, T2598, T544).
-- Same rules as 0002: no dynamic SQL, SECURITY DEFINER functions pin search_path = '' and derive the
-- customer from auth.uid(); execute privileges are granted explicitly at the end of this file.

-- ---------------------------------------------------------------- simulation clock
create table private.sim_state (
  id                boolean primary key default true check (id),
  clock_offset_days integer not null default 0 check (clock_offset_days between 0 and 3650),
  updated_at        timestamptz not null default now()
);
insert into private.sim_state default values;

create or replace function public.app_now() returns timestamptz
language sql stable security definer set search_path = '' as $$
  select now() + make_interval(days => coalesce((select s.clock_offset_days from private.sim_state s where s.id), 0))
$$;

create or replace function public.app_today() returns date
language sql stable set search_path = '' as $$
  select (public.app_now() at time zone 'UTC')::date
$$;

-- ---------------------------------------------------------------- schema additions
alter table public.profiles add column is_demo boolean not null default false;

alter table public.accounts add column name text not null default 'Everyday Checking'
  check (char_length(name) between 1 and 40);

alter table public.ledger_entries
  add column category text not null default 'other' check (category in (
    'groceries', 'dining', 'transport', 'shopping', 'utilities', 'entertainment', 'health',
    'salary', 'deposit', 'transfer', 'fee', 'rent', 'other')),
  add column card_id uuid references public.cards (id);
alter table public.ledger_entries alter column booked_at set default public.app_now();
alter table public.transfers alter column created_at set default public.app_now();

alter table public.scheduled_payments add column frequency text not null default 'once'
  check (frequency in ('once', 'monthly'));
alter table public.scheduled_payments alter column created_at set default public.app_now();

alter table public.support_tickets
  add column category text not null default 'general' check (category in ('general', 'card', 'transfer', 'account', 'privacy')),
  add column updated_at timestamptz not null default now();
alter table public.support_replies add column author_role text not null default 'customer'
  check (author_role in ('customer', 'support', 'admin'));

alter table public.sim_events drop constraint sim_events_kind_check;
alter table public.sim_events add constraint sim_events_kind_check check (kind in ('apply', 'advance', 'reset', 'seed'));

create table public.card_authorizations (
  id              uuid primary key default gen_random_uuid(),
  card_id         uuid not null references public.cards (id),
  customer_id     uuid not null references public.profiles (id),
  merchant        text not null check (char_length(merchant) between 1 and 80),
  category        text not null,
  amount_cents    bigint not null check (amount_cents > 0),
  status          text not null check (status in ('approved', 'declined')),
  decline_reason  text check (decline_reason in ('card_blocked', 'daily_limit', 'insufficient_funds')),
  ledger_entry_id uuid references public.ledger_entries (id),
  scenario_id     text,
  at              timestamptz not null default public.app_now()
);
create index card_auth_card_idx on public.card_authorizations (card_id, at desc);

alter table public.card_authorizations enable row level security;
create policy card_auth_select on public.card_authorizations for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_staff()));
grant select on public.card_authorizations to authenticated;
create trigger audit_card_auth after insert or update or delete on public.card_authorizations
  for each row execute function audit.capture();

-- Customers may close their own ticket; staff updates stay as in 0003.
create policy tickets_owner_close on public.support_tickets for update to authenticated
  using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()) and status = 'closed');
-- Reply author role is set by the server (trigger), never by the client.
revoke insert on public.support_replies from authenticated;
grant insert (ticket_id, author_id, body) on public.support_replies to authenticated;
revoke insert on public.support_tickets from authenticated;
grant insert (customer_id, subject, body, category) on public.support_tickets to authenticated;
grant update (status, updated_at) on public.support_tickets to authenticated;

-- ---------------------------------------------------------------- ledger guard (reset only)
create or replace function private.ledger_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('app.sim_reset', true) = 'on' then
    return old;  -- only reachable inside public.sim_reset_demo_data() (service role, admin-gated, audited)
  end if;
  raise exception 'ledger_entries is append-only; post a reversing entry instead' using errcode = '42501';
end $$;

-- ---------------------------------------------------------------- support helpers
create or replace function private.support_reply_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then  -- end-user request: identity and role come from the JWT, never the payload
    new.author_role := case when public.auth_role() in ('support', 'admin') then public.auth_role() else 'customer' end;
    new.author_id := auth.uid();
  end if;
  return new;
end $$;
create trigger support_reply_defaults before insert on public.support_replies
  for each row execute function private.support_reply_defaults();

create or replace function private.support_reply_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.support_tickets
     set status = case when new.author_role = 'customer' then 'open' else 'answered' end,
         updated_at = now()
   where id = new.ticket_id and status <> 'closed';
  return new;
end $$;
create trigger support_reply_status after insert on public.support_replies
  for each row execute function private.support_reply_status();

-- ---------------------------------------------------------------- fees (single source of truth)
-- Own-account transfers are free. Transfers to beneficiaries: 0.2% with a 1.50 minimum and 25.00 cap.
create or replace function public.fee_for(p_amount_cents bigint, p_external boolean) returns bigint
language sql immutable set search_path = '' as $$
  select case when not coalesce(p_external, true) then 0::bigint
              else greatest(150, least(2500, coalesce(p_amount_cents, 0) / 500))::bigint end
$$;

-- ---------------------------------------------------------------- simulated card network
create or replace function private.sim_merchants()
returns table (merchant text, category text, lo bigint, hi bigint)
language sql immutable set search_path = '' as $$
  values ('FreshMart Groceries', 'groceries', 1500::bigint, 9500::bigint),
         ('Green Basket Market', 'groceries', 800, 4500),
         ('Metro Transit', 'transport', 250, 600),
         ('QuickFuel Station', 'transport', 3000, 7000),
         ('Corner Coffee', 'dining', 350, 900),
         ('Bella Trattoria', 'dining', 2500, 8000),
         ('Pages Bookshop', 'shopping', 1200, 4500),
         ('HomeGoods Depot', 'shopping', 2000, 15000),
         ('StreamPlus', 'entertainment', 999, 1599),
         ('Cineplex Downtown', 'entertainment', 1400, 3200),
         ('PharmaCare', 'health', 800, 3500)
$$;

create or replace function private.card_spent_today(p_card uuid) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(amount_cents), 0)::bigint from public.card_authorizations
  where card_id = p_card and status = 'approved' and (at at time zone 'UTC')::date = public.app_today()
$$;

-- Authorizes one simulated purchase: blocked card -> insufficient funds -> daily limit.
create or replace function private.authorize_card_purchase(
  p_card uuid, p_merchant text, p_category text, p_amount_cents bigint, p_scenario text, p_at timestamptz default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c public.cards;
  v_reason text;
  v_entry uuid;
  v_at timestamptz := coalesce(p_at, public.app_now());
begin
  select * into c from public.cards where id = p_card for update;
  if not found then return 'not_found'; end if;
  perform 1 from public.accounts where id = c.account_id for update;

  if c.status <> 'active' then
    v_reason := 'card_blocked';
  elsif private.balance_cents(c.account_id) < p_amount_cents then
    v_reason := 'insufficient_funds';
  elsif private.card_spent_today(c.id) + p_amount_cents > c.daily_limit_cents then
    v_reason := 'daily_limit';
  end if;

  if v_reason is null then
    insert into public.ledger_entries (account_id, booked_at, description, amount_cents, direction, category, card_id, scenario_id)
    values (c.account_id, v_at, p_merchant, p_amount_cents, 'debit', p_category, c.id, p_scenario)
    returning id into v_entry;
  end if;

  insert into public.card_authorizations (card_id, customer_id, merchant, category, amount_cents, status, decline_reason, ledger_entry_id, scenario_id, at)
  values (c.id, c.customer_id, p_merchant, p_category, p_amount_cents,
          case when v_reason is null then 'approved' else 'declined' end, v_reason, v_entry, p_scenario, v_at);
  return coalesce(v_reason, 'approved');
end $$;

create or replace function private.random_purchase(p_card uuid, p_scenario text, p_at timestamptz default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  m record;
begin
  select * into m from private.sim_merchants() order by random() limit 1;
  return private.authorize_card_purchase(p_card, m.merchant, m.category, m.lo + floor(random() * (m.hi - m.lo))::bigint, p_scenario, p_at);
end $$;

-- ---------------------------------------------------------------- account opening / extra accounts
create or replace function public.open_customer_account(
  p_user_id uuid, p_full_name text, p_email text, p_phone text, p_address_line1 text, p_city text,
  p_postal_code text, p_notice_version text, p_marketing_email boolean, p_product_analytics boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_account uuid;
begin
  -- Required consents are recorded BEFORE any personal data is stored (T178).
  insert into public.consents (user_id, purpose, granted, notice_version) values
    (p_user_id, 'terms', true, p_notice_version),
    (p_user_id, 'privacy_notice', true, p_notice_version),
    (p_user_id, 'marketing_email', coalesce(p_marketing_email, false), p_notice_version),
    (p_user_id, 'product_analytics', coalesce(p_product_analytics, false), p_notice_version);
  insert into public.consent_events (user_id, purpose, granted, notice_version)
  select user_id, purpose, granted, notice_version from public.consents where user_id = p_user_id;

  insert into public.profiles (id, full_name, email, phone, address_line1, city, postal_code)
  values (p_user_id, p_full_name, lower(p_email), p_phone, p_address_line1, p_city, p_postal_code);

  insert into public.accounts (customer_id, account_number, name)
  values (p_user_id, private.random_digits(11), 'Everyday Checking') returning id into v_account;
  insert into public.cards (customer_id, account_id, last4) values (p_user_id, v_account, private.random_digits(4));
  insert into private.customer_pseudonyms (customer_id) values (p_user_id);

  -- Simulated opening deposit so a new customer can try the product.
  insert into public.ledger_entries (account_id, description, amount_cents, direction, category)
  values (v_account, 'Welcome deposit (simulated)', 25000, 'credit', 'deposit');
  return p_user_id;
end $$;

create or replace function public.open_additional_account(p_kind text, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_kind not in ('checking', 'savings') then raise exception 'invalid_kind' using errcode = '22023'; end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 40 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then raise exception 'account_not_found' using errcode = 'P0002'; end if;
  if (select count(*) from public.accounts where customer_id = v_uid and status <> 'closed') >= 4 then
    raise exception 'account_limit' using errcode = 'P0001';
  end if;
  insert into public.accounts (customer_id, account_number, kind, name)
  values (v_uid, private.random_digits(11), p_kind, trim(p_name)) returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------- money movement (customer)
create or replace function public.quote_transfer(
  p_from_account uuid, p_amount_cents bigint, p_to_account uuid default null, p_beneficiary uuid default null
) returns table (quote_id uuid, fee_cents bigint, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 100000000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if (p_to_account is null) = (p_beneficiary is null) then raise exception 'invalid_destination' using errcode = '22023'; end if;
  if not exists (select 1 from public.accounts where id = p_from_account and customer_id = v_uid and status = 'active') then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
  if p_to_account is not null and not exists (
    select 1 from public.accounts where id = p_to_account and customer_id = v_uid and status = 'active' and id <> p_from_account) then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
  if p_beneficiary is not null and not exists (select 1 from public.beneficiaries where id = p_beneficiary and customer_id = v_uid) then
    raise exception 'beneficiary_not_found' using errcode = 'P0002';
  end if;

  return query
  insert into private.transfer_quotes as q (customer_id, from_account_id, to_account_id, beneficiary_id, amount_cents, fee_cents, expires_at)
  values (v_uid, p_from_account, p_to_account, p_beneficiary, p_amount_cents,
          public.fee_for(p_amount_cents, p_beneficiary is not null), now() + interval '5 minutes')
  returning q.id, q.fee_cents, q.expires_at;
end $$;

create or replace function public.confirm_transfer(p_quote_id uuid, p_reference text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  q private.transfer_quotes;
  v_transfer uuid;
  v_label text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_reference is not null and char_length(p_reference) > 140 then raise exception 'invalid_reference' using errcode = '22023'; end if;

  select * into q from private.transfer_quotes where id = p_quote_id and customer_id = v_uid for update;
  if not found then raise exception 'quote_not_found' using errcode = 'P0002'; end if;
  if q.used_at is not null or q.expires_at < now() then raise exception 'quote_expired' using errcode = 'P0001'; end if;

  perform 1 from public.accounts where id = q.from_account_id for update;  -- serialise concurrent debits
  if private.balance_cents(q.from_account_id) < q.amount_cents + q.fee_cents then
    raise exception 'insufficient_funds' using errcode = 'P0001';
  end if;

  update private.transfer_quotes set used_at = now() where id = q.id;

  insert into public.transfers (customer_id, from_account_id, to_account_id, beneficiary_id, amount_cents, fee_cents, reference, status)
  values (v_uid, q.from_account_id, q.to_account_id, q.beneficiary_id, q.amount_cents, q.fee_cents, nullif(trim(p_reference), ''), 'pending')
  returning id into v_transfer;

  if q.beneficiary_id is not null then
    select 'Transfer to ' || b.nickname into v_label from public.beneficiaries b where b.id = q.beneficiary_id;
  else
    select 'Transfer to ' || a.name into v_label from public.accounts a where a.id = q.to_account_id;
  end if;

  insert into public.ledger_entries (account_id, description, amount_cents, direction, transfer_id, category)
  values (q.from_account_id, left(coalesce(nullif(trim(p_reference), ''), v_label, 'Transfer'), 140), q.amount_cents, 'debit', v_transfer, 'transfer');
  if q.fee_cents > 0 then
    insert into public.ledger_entries (account_id, description, amount_cents, direction, transfer_id, category)
    values (q.from_account_id, 'Transfer fee', q.fee_cents, 'debit', v_transfer, 'fee');
  end if;
  return v_transfer;
end $$;

-- ---------------------------------------------------------------- settlement (service role: cron + simulation)
create or replace function public.settle_pending_transfers() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  t record;
  v_target uuid;
  v_count integer := 0;
begin
  for t in
    select tr.id, tr.to_account_id, tr.amount_cents, tr.reference, tr.scenario_id, b.account_number as ben_account
    from public.transfers tr left join public.beneficiaries b on b.id = tr.beneficiary_id
    where tr.status = 'pending' and tr.created_at < public.app_now() - interval '2 minutes'
    order by tr.created_at
    for update of tr skip locked
  loop
    update public.transfers set status = 'completed', settled_at = public.app_now() where id = t.id;
    if t.to_account_id is not null then
      insert into public.ledger_entries (account_id, description, amount_cents, direction, transfer_id, category, scenario_id)
      values (t.to_account_id, left(coalesce(nullif(t.reference, ''), 'Transfer from your account'), 140), t.amount_cents, 'credit', t.id, 'transfer', t.scenario_id);
    elsif t.ben_account is not null then
      -- Beneficiary banks at ACME: credit the matching account. No link to the sender's transfer row
      -- or name is stored on the recipient side.
      select id into v_target from public.accounts where account_number = t.ben_account and status = 'active';
      if v_target is not null then
        insert into public.ledger_entries (account_id, description, amount_cents, direction, category, scenario_id)
        values (v_target, 'Incoming transfer', t.amount_cents, 'credit', 'transfer', t.scenario_id);
      end if;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create or replace function public.execute_due_scheduled_payments() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  p record;
  v_transfer uuid;
  v_fee bigint;
  v_count integer := 0;
begin
  for p in
    select sp.*, b.nickname from public.scheduled_payments sp
    join public.beneficiaries b on b.id = sp.beneficiary_id
    where sp.status = 'scheduled' and sp.execute_on <= public.app_today()
    order by sp.execute_on
    for update of sp skip locked
  loop
    v_fee := public.fee_for(p.amount_cents, true);
    perform 1 from public.accounts where id = p.from_account_id for update;
    if private.balance_cents(p.from_account_id) < p.amount_cents + v_fee then
      update public.scheduled_payments set status = 'failed' where id = p.id;
    else
      insert into public.transfers (customer_id, from_account_id, beneficiary_id, amount_cents, fee_cents, reference, status)
      values (p.customer_id, p.from_account_id, p.beneficiary_id, p.amount_cents, v_fee, p.reference, 'pending')
      returning id into v_transfer;
      insert into public.ledger_entries (account_id, description, amount_cents, direction, transfer_id, category) values
        (p.from_account_id, left(coalesce(nullif(p.reference, ''), 'Scheduled payment to ' || p.nickname), 140), p.amount_cents, 'debit', v_transfer, 'transfer'),
        (p.from_account_id, 'Transfer fee', v_fee, 'debit', v_transfer, 'fee');
      update public.scheduled_payments set status = 'executed', transfer_id = v_transfer where id = p.id;
      v_count := v_count + 1;
    end if;
    if p.frequency = 'monthly' then
      insert into public.scheduled_payments (customer_id, from_account_id, beneficiary_id, amount_cents, reference, execute_on, frequency)
      values (p.customer_id, p.from_account_id, p.beneficiary_id, p.amount_cents, p.reference, (p.execute_on + interval '1 month')::date, 'monthly');
    end if;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------- staff (masked / aggregated)
create or replace function public.staff_customer_detail(p_customer uuid)
returns table (id uuid, full_name text, email text, phone_masked text, city text, created_at timestamptz,
               is_demo boolean, role text, restrictions text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select pr.id, pr.full_name, pr.email,
         case when pr.phone is null then null else left(pr.phone, 3) || '****' || right(pr.phone, 2) end,
         pr.city, pr.created_at, pr.is_demo,
         coalesce(u.raw_app_meta_data ->> 'role', 'customer'),
         coalesce((select array_agg(r.activity order by r.activity) from public.processing_restrictions r where r.user_id = pr.id), '{}')
  from public.profiles pr join auth.users u on u.id = pr.id
  where pr.id = p_customer;
end $$;

create or replace function public.staff_list_tickets(p_status text default null, p_limit integer default 50)
returns table (id uuid, subject text, category text, status text, created_at timestamptz, updated_at timestamptz,
               customer_id uuid, customer_name text, reply_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('open', 'answered', 'closed') then raise exception 'invalid_status' using errcode = '22023'; end if;
  return query
  select t.id, t.subject, t.category, t.status, t.created_at, t.updated_at, t.customer_id, pr.full_name,
         (select count(*) from public.support_replies r where r.ticket_id = t.id)
  from public.support_tickets t join public.profiles pr on pr.id = t.customer_id
  where p_status is null or t.status = p_status
  order by (t.status = 'open') desc, t.updated_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 50);
end $$;

create or replace function public.staff_ticket_customer(p_ticket uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v text;
begin
  if not public.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  select pr.full_name into v from public.support_tickets t join public.profiles pr on pr.id = t.customer_id where t.id = p_ticket;
  return v;
end $$;

create or replace function public.staff_dashboard_stats()
returns table (customers bigint, accounts bigint, deposits_cents bigint, pending_transfers bigint,
               open_tickets bigint, blocked_cards bigint, declined_today bigint, sim_date date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select
    (select count(*) from public.profiles),
    (select count(*) from public.accounts where status <> 'closed'),
    (select coalesce(sum(case when direction = 'credit' then amount_cents else -amount_cents end), 0)::bigint from public.ledger_entries),
    (select count(*) from public.transfers where status = 'pending'),
    (select count(*) from public.support_tickets where status = 'open'),
    (select count(*) from public.cards where status = 'blocked'),
    (select count(*) from public.card_authorizations where status = 'declined' and (at at time zone 'UTC')::date = public.app_today()),
    public.app_today();
end $$;

drop function if exists public.admin_audit_log(integer);
create function public.admin_audit_log(p_limit integer default 50, p_table text default null)
returns table (id bigint, at timestamptz, actor uuid, actor_role text, table_name text, op text, row_id text, changed text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.auth_role() <> 'admin' then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select l.id, l.at, l.actor, l.actor_role, l.table_name, l.op, l.row_id,
         case
           when l.op = 'UPDATE' then (select array_agg(k order by k) from jsonb_object_keys(l.new_data) k
                                      where l.new_data -> k is distinct from l.old_data -> k)
           when l.table_name = 'event' then array[coalesce(l.op, '')]
           else null
         end
  from audit.log l
  where p_table is null or l.table_name = p_table
  order by l.at desc, l.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;

-- ---------------------------------------------------------------- demo data (synthetic only, T544)
create or replace function public.seed_demo_profile(
  p_user_id uuid, p_full_name text, p_email text, p_phone text, p_address_line1 text, p_city text, p_postal_code text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.consents (user_id, purpose, granted, notice_version) values
    (p_user_id, 'terms', true, 'demo-1'), (p_user_id, 'privacy_notice', true, 'demo-1'),
    (p_user_id, 'marketing_email', false, 'demo-1'), (p_user_id, 'product_analytics', false, 'demo-1')
  on conflict do nothing;
  insert into public.profiles (id, full_name, email, phone, address_line1, city, postal_code, is_demo)
  values (p_user_id, p_full_name, lower(p_email), p_phone, p_address_line1, p_city, p_postal_code, true)
  on conflict (id) do nothing;
  insert into private.customer_pseudonyms (customer_id) values (p_user_id) on conflict do nothing;
end $$;

-- Builds the deterministic baseline for every demo customer: accounts, a card, beneficiaries,
-- 60 days of salary / card purchases / rent / savings transfers, scheduled payments and tickets.
create or replace function public.sim_seed_baseline() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  i integer := 0;
  n_customers integer;
  v_chk uuid; v_sav uuid; v_card uuid; v_rent uuid; v_ins uuid; v_t uuid; v_e uuid; v_ticket uuid;
  v_support uuid;
  d integer; k integer;
  v_day timestamptz;
  v_dom integer;
  v_rent_amt bigint;
  v_salary bigint;
  m record;
  v_amt bigint;
  v_employers text[] := array['Northwind Traders', 'Contoso Ltd', 'Fabrikam Inc', 'Tailspin Toys', 'Litware Labs', 'Proseware Co'];
begin
  perform setseed(0.42);  -- simulation amounts only; identifiers use the CSPRNG (T151)
  select count(*) into n_customers from public.profiles where is_demo;
  select u.id into v_support from auth.users u where u.raw_app_meta_data ->> 'role' = 'support' order by u.created_at limit 1;

  for c in select id, full_name from public.profiles where is_demo order by email loop
    i := i + 1;
    v_rent_amt := 110000 + i * 7500;
    v_salary := 210000 + i * 18000;

    insert into public.accounts (customer_id, account_number, kind, name, created_at)
    values (c.id, private.random_digits(11), 'checking', 'Everyday Checking', public.app_now() - interval '75 days') returning id into v_chk;
    v_sav := null;
    if i % 2 = 1 then
      insert into public.accounts (customer_id, account_number, kind, name, created_at)
      values (c.id, private.random_digits(11), 'savings', 'Rainy Day Savings', public.app_now() - interval '75 days') returning id into v_sav;
    end if;
    insert into public.cards (customer_id, account_id, last4, daily_limit_cents, created_at)
    values (c.id, v_chk, private.random_digits(4), case when i = 4 then 50000 else 100000 end, public.app_now() - interval '75 days')
    returning id into v_card;

    insert into public.beneficiaries (customer_id, nickname, account_number, bank_name, created_at)
    values (c.id, 'Oakwood Properties', private.random_digits(11), 'First Federal Bank', public.app_now() - interval '70 days') returning id into v_rent;
    insert into public.beneficiaries (customer_id, nickname, account_number, bank_name, created_at)
    values (c.id, 'Shield Insurance Co.', private.random_digits(11), 'Harbor Trust Bank', public.app_now() - interval '70 days') returning id into v_ins;

    -- opening balances
    insert into public.ledger_entries (account_id, booked_at, description, amount_cents, direction, category)
    values (v_chk, public.app_now() - interval '62 days', 'Opening balance', 180000 + i * 20000, 'credit', 'deposit');
    if v_sav is not null then
      insert into public.ledger_entries (account_id, booked_at, description, amount_cents, direction, category)
      values (v_sav, public.app_now() - interval '62 days', 'Opening balance', 600000 + i * 90000, 'credit', 'deposit');
    end if;

    for d in reverse 60..0 loop
      v_day := date_trunc('day', public.app_now() - make_interval(days => d)) + make_interval(hours => 8 + floor(random() * 11)::int, mins => floor(random() * 60)::int);
      if v_day > public.app_now() then v_day := public.app_now() - interval '5 minutes'; end if;
      v_dom := extract(day from v_day)::int;

      if v_dom in (1, 15) then
        insert into public.ledger_entries (account_id, booked_at, description, amount_cents, direction, category)
        values (v_chk, v_day - interval '2 hours', 'Payroll - ' || v_employers[1 + (i - 1) % array_length(v_employers, 1)], v_salary, 'credit', 'salary');
      end if;

      if v_dom = 3 then  -- monthly rent to an external beneficiary (completed)
        insert into public.transfers (customer_id, from_account_id, beneficiary_id, amount_cents, fee_cents, reference, status, created_at, settled_at)
        values (c.id, v_chk, v_rent, v_rent_amt, public.fee_for(v_rent_amt, true), 'Monthly rent', 'completed', v_day, v_day + interval '1 hour')
        returning id into v_t;
        insert into public.ledger_entries (account_id, booked_at, description, amount_cents, direction, transfer_id, category) values
          (v_chk, v_day, 'Monthly rent', v_rent_amt, 'debit', v_t, 'rent'),
          (v_chk, v_day, 'Transfer fee', public.fee_for(v_rent_amt, true), 'debit', v_t, 'fee');
      end if;

      if v_dom = 16 and v_sav is not null then  -- move money to savings (internal, free)
        insert into public.transfers (customer_id, from_account_id, to_account_id, amount_cents, fee_cents, reference, status, created_at, settled_at)
        values (c.id, v_chk, v_sav, 30000, 0, 'Savings top-up', 'completed', v_day, v_day + interval '5 minutes')
        returning id into v_t;
        insert into public.ledger_entries (account_id, booked_at, description, amount_cents, direction, transfer_id, category) values
          (v_chk, v_day, 'Savings top-up', 30000, 'debit', v_t, 'transfer'),
          (v_sav, v_day + interval '5 minutes', 'Savings top-up', 30000, 'credit', v_t, 'transfer');
      end if;

      if v_dom = 8 then  -- monthly utility bill
        insert into public.ledger_entries (account_id, booked_at, description, amount_cents, direction, category, card_id)
        values (v_chk, v_day, 'City Power & Light', 6500 + floor(random() * 5000)::bigint, 'debit', 'utilities', v_card)
        returning id into v_e;
        insert into public.card_authorizations (card_id, customer_id, merchant, category, amount_cents, status, ledger_entry_id, at)
        select v_card, c.id, 'City Power & Light', 'utilities', le.amount_cents, 'approved', v_e, v_day from public.ledger_entries le where le.id = v_e;
      end if;

      for k in 1..floor(random() * 3)::int loop  -- 0-2 card purchases per day
        select * into m from private.sim_merchants() order by random() limit 1;
        v_amt := m.lo + floor(random() * (m.hi - m.lo))::bigint;
        insert into public.ledger_entries (account_id, booked_at, description, amount_cents, direction, category, card_id)
        values (v_chk, v_day + make_interval(mins => k * 37), m.merchant, v_amt, 'debit', m.category, v_card)
        returning id into v_e;
        insert into public.card_authorizations (card_id, customer_id, merchant, category, amount_cents, status, ledger_entry_id, at)
        values (v_card, c.id, m.merchant, m.category, v_amt, 'approved', v_e, v_day + make_interval(mins => k * 37));
      end loop;
    end loop;

    -- upcoming scheduled payments: next rent (monthly) and a one-off insurance premium
    insert into public.scheduled_payments (customer_id, from_account_id, beneficiary_id, amount_cents, reference, execute_on, frequency)
    values (c.id, v_chk, v_rent, v_rent_amt, 'Monthly rent',
            (date_trunc('month', public.app_today()::timestamp) + interval '1 month' + interval '2 days')::date, 'monthly');
    insert into public.scheduled_payments (customer_id, from_account_id, beneficiary_id, amount_cents, reference, execute_on, frequency)
    values (c.id, v_chk, v_ins, 18900 + i * 1100, 'Car insurance premium', public.app_today() + (5 + i), 'once');

    -- support history
    if i = 1 then
      insert into public.support_tickets (customer_id, subject, body, category, status, created_at, updated_at)
      values (c.id, 'Card declined at the grocery store', 'My card was declined yesterday even though I have enough money. Can you check?', 'card', 'open',
              public.app_now() - interval '1 day', public.app_now() - interval '1 day');
    elsif i = 3 then
      insert into public.support_tickets (customer_id, subject, body, category, status, created_at, updated_at)
      values (c.id, 'How do I raise my daily card limit?', 'I am traveling next week and may need a higher daily limit on my debit card.', 'card', 'answered',
              public.app_now() - interval '6 days', public.app_now() - interval '5 days')
      returning id into v_ticket;
      if v_support is not null then
        insert into public.support_replies (ticket_id, author_id, author_role, body, created_at)
        values (v_ticket, v_support, 'support', 'You can change the daily limit yourself under Cards > Daily limit. Increases ask you to confirm your password. Safe travels!',
                public.app_now() - interval '5 days');
      end if;
    end if;
  end loop;

  -- Internal beneficiaries: each demo customer can pay the next one (ACME-to-ACME transfers).
  i := 0;
  for c in select p.id, p.full_name, row_number() over (order by p.email) as rn from public.profiles p where p.is_demo order by p.email loop
    insert into public.beneficiaries (customer_id, nickname, account_number, bank_name, created_at)
    select c.id, split_part(nxt.full_name, ' ', 1) || ' ' || left(split_part(nxt.full_name, ' ', 2), 1) || '.', a.account_number, 'ACME Bank', public.app_now() - interval '40 days'
    from (select p2.id, p2.full_name from public.profiles p2 where p2.is_demo order by p2.email offset (c.rn % n_customers) limit 1) nxt
    join public.accounts a on a.customer_id = nxt.id and a.kind = 'checking';
  end loop;

  -- Two transfers still pending settlement (shows the pending -> completed lifecycle).
  for c in select p.id from public.profiles p where p.is_demo order by p.email limit 2 loop
    select a.id into v_chk from public.accounts a where a.customer_id = c.id and a.kind = 'checking';
    select b.id into v_t from public.beneficiaries b where b.customer_id = c.id and b.bank_name = 'ACME Bank' limit 1;
    if v_t is not null then
      insert into public.transfers (customer_id, from_account_id, beneficiary_id, amount_cents, fee_cents, reference, status, created_at)
      values (c.id, v_chk, v_t, 4500, public.fee_for(4500, true), 'Dinner split', 'pending', public.app_now() - interval '1 minute')
      returning id into v_e;
      insert into public.ledger_entries (account_id, booked_at, description, amount_cents, direction, transfer_id, category) values
        (v_chk, public.app_now() - interval '1 minute', 'Dinner split', 4500, 'debit', v_e, 'transfer'),
        (v_chk, public.app_now() - interval '1 minute', 'Transfer fee', public.fee_for(4500, true), 'debit', v_e, 'fee');
    end if;
  end loop;

  insert into public.sim_events (scenario, kind, details) values ('baseline', 'seed', jsonb_build_object('customers', n_customers));
  return n_customers;
end $$;

-- ---------------------------------------------------------------- simulation (service role; API is admin-gated)
drop function if exists public.sim_apply(text, integer, uuid);
drop function if exists public.seed_customer(uuid, text, text, text);
drop function if exists public.seed_ledger_entry(uuid, timestamptz, text, bigint, text);

create function public.sim_apply(p_scenario text, p_customer uuid, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  v_card record;
  v_res text;
  v_approved integer := 0;
  v_declined integer := 0;
  v_rows integer := 0;
  v_customers integer := 0;
  v_acct uuid;
  v_ben uuid;
  v_amt bigint;
  v_fee bigint;
  v_t uuid;
begin
  if p_scenario not in ('purchases', 'deposits', 'insufficient-funds', 'pending-transfers', 'payday') then
    raise exception 'unknown_scenario' using errcode = '22023';
  end if;

  for c in
    select p.id from public.profiles p
    where (p_customer is null and p.is_demo) or p.id = p_customer
    order by p.email
  loop
    v_customers := v_customers + 1;
    select a.id into v_acct from public.accounts a where a.customer_id = c.id and a.status = 'active' order by (a.kind = 'checking') desc, a.created_at limit 1;
    if v_acct is null then continue; end if;

    if p_scenario = 'purchases' then
      for v_card in select id from public.cards where customer_id = c.id loop
        for i in 1..3 loop
          v_res := private.random_purchase(v_card.id, p_scenario);
          if v_res = 'approved' then v_approved := v_approved + 1; else v_declined := v_declined + 1; end if;
          v_rows := v_rows + 1;
        end loop;
      end loop;

    elsif p_scenario = 'deposits' then
      insert into public.ledger_entries (account_id, description, amount_cents, direction, category, scenario_id)
      values (v_acct, (array['Mobile check deposit', 'Cash deposit at branch', 'Tax refund'])[1 + floor(random() * 3)::int],
              20000 + floor(random() * 130000)::bigint, 'credit', 'deposit', p_scenario);
      v_rows := v_rows + 1;

    elsif p_scenario = 'payday' then
      insert into public.ledger_entries (account_id, description, amount_cents, direction, category, scenario_id)
      values (v_acct, 'Payroll deposit', 250000 + floor(random() * 100000)::bigint, 'credit', 'salary', p_scenario);
      v_rows := v_rows + 1;

    elsif p_scenario = 'insufficient-funds' then
      -- A card purchase larger than the balance is declined; a transfer attempt is recorded as failed.
      for v_card in select id from public.cards where customer_id = c.id and status = 'active' limit 1 loop
        v_amt := private.balance_cents(v_acct) + 5000 + floor(random() * 45000)::bigint;
        perform private.authorize_card_purchase(v_card.id, 'Electro World', 'shopping', v_amt, p_scenario);
        v_declined := v_declined + 1;
        v_rows := v_rows + 1;
      end loop;
      select b.id into v_ben from public.beneficiaries b where b.customer_id = c.id order by b.created_at limit 1;
      if v_ben is not null then
        insert into public.transfers (customer_id, from_account_id, beneficiary_id, amount_cents, fee_cents, reference, status, scenario_id, settled_at)
        values (c.id, v_acct, v_ben, private.balance_cents(v_acct) + 100000, 0, 'Declined: insufficient funds', 'failed', p_scenario, public.app_now());
        v_rows := v_rows + 1;
      end if;

    else -- pending-transfers: stay pending until the clock advances (or the settlement job runs)
      select b.id into v_ben from public.beneficiaries b where b.customer_id = c.id order by (b.bank_name = 'ACME Bank') desc, b.created_at limit 1;
      v_amt := 2500 + floor(random() * 17500)::bigint;
      v_fee := public.fee_for(v_amt, true);
      if v_ben is not null and private.balance_cents(v_acct) >= v_amt + v_fee then
        insert into public.transfers (customer_id, from_account_id, beneficiary_id, amount_cents, fee_cents, reference, status, scenario_id)
        values (c.id, v_acct, v_ben, v_amt, v_fee, 'Simulated transfer', 'pending', p_scenario)
        returning id into v_t;
        insert into public.ledger_entries (account_id, description, amount_cents, direction, transfer_id, category, scenario_id) values
          (v_acct, 'Simulated transfer', v_amt, 'debit', v_t, 'transfer', p_scenario),
          (v_acct, 'Transfer fee', v_fee, 'debit', v_t, 'fee', p_scenario);
        v_rows := v_rows + 1;
      end if;
    end if;
  end loop;

  insert into public.sim_events (actor_id, scenario, kind, details)
  values (p_actor, p_scenario, 'apply', jsonb_build_object(
    'customers', v_customers, 'rows', v_rows, 'approved', v_approved, 'declined', v_declined,
    'target', case when p_customer is null then 'all demo customers' else (select pseudonym::text from private.customer_pseudonyms where customer_id = p_customer) end));
  return jsonb_build_object('customers', v_customers, 'rows', v_rows, 'approved', v_approved, 'declined', v_declined);
end $$;

-- Advances the simulated clock day by day: routine card activity, payroll on the 1st/15th,
-- due scheduled payments, then settlement of transfers that were pending.
create or replace function public.sim_advance(p_days integer, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d integer;
  c record;
  v_card record;
  v_res text;
  v_purchases integer := 0;
  v_declined integer := 0;
  v_settled integer := 0;
  v_scheduled integer := 0;
  v_payroll integer := 0;
  v_dom integer;
begin
  if p_days is null or p_days < 1 or p_days > 31 then raise exception 'invalid_days' using errcode = '22023'; end if;

  for d in 1..p_days loop  -- bounded loop counter (T42)
    update private.sim_state set clock_offset_days = clock_offset_days + 1, updated_at = now() where id;
    v_dom := extract(day from public.app_today())::int;

    for c in select p.id from public.profiles p where p.is_demo loop
      if v_dom in (1, 15) then
        insert into public.ledger_entries (account_id, description, amount_cents, direction, category, scenario_id)
        select a.id, 'Payroll deposit', 230000 + floor(random() * 90000)::bigint, 'credit', 'salary', 'clock'
        from public.accounts a where a.customer_id = c.id and a.kind = 'checking' and a.status = 'active' order by a.created_at limit 1;
        v_payroll := v_payroll + 1;
      end if;
      for v_card in select id from public.cards where customer_id = c.id loop
        for i in 1..floor(random() * 3)::int loop
          v_res := private.random_purchase(v_card.id, 'clock');
          v_purchases := v_purchases + 1;
          if v_res <> 'approved' then v_declined := v_declined + 1; end if;
        end loop;
      end loop;
    end loop;

    v_scheduled := v_scheduled + public.execute_due_scheduled_payments();
    v_settled := v_settled + public.settle_pending_transfers();
  end loop;

  insert into public.sim_events (actor_id, scenario, kind, details)
  values (p_actor, 'clock', 'advance', jsonb_build_object(
    'days', p_days, 'sim_date', public.app_today(), 'purchases', v_purchases, 'declined', v_declined,
    'payroll', v_payroll, 'scheduled_executed', v_scheduled, 'settled', v_settled));
  return jsonb_build_object('days', p_days, 'simDate', public.app_today(), 'purchases', v_purchases, 'declined', v_declined,
                            'payroll', v_payroll, 'scheduledExecuted', v_scheduled, 'settled', v_settled);
end $$;

-- Restores the demo baseline for demo customers only. Non-demo customers, sim_events and the
-- audit trail are kept (every deletion is itself captured in audit.log by the row triggers).
create or replace function public.sim_reset_demo_data(p_actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.sim_reset', 'on', true);  -- transaction-local; honoured by the ledger guard

  delete from public.card_authorizations where customer_id in (select p.id from public.profiles p where p.is_demo);
  delete from public.ledger_entries where account_id in (select a.id from public.accounts a where a.customer_id in (select p.id from public.profiles p where p.is_demo));
  delete from public.scheduled_payments where customer_id in (select p.id from public.profiles p where p.is_demo);
  delete from private.transfer_quotes where customer_id in (select p.id from public.profiles p where p.is_demo);
  delete from public.transfers where customer_id in (select p.id from public.profiles p where p.is_demo);
  delete from public.statements where customer_id in (select p.id from public.profiles p where p.is_demo);
  delete from public.support_replies where ticket_id in (select t.id from public.support_tickets t where t.customer_id in (select p.id from public.profiles p where p.is_demo));
  delete from public.support_tickets where customer_id in (select p.id from public.profiles p where p.is_demo);
  delete from public.beneficiaries where customer_id in (select p.id from public.profiles p where p.is_demo);
  delete from public.cards where customer_id in (select p.id from public.profiles p where p.is_demo);
  delete from public.accounts where customer_id in (select p.id from public.profiles p where p.is_demo);

  update private.sim_state set clock_offset_days = 0, updated_at = now() where id;
  perform set_config('app.sim_reset', 'off', true);

  perform public.sim_seed_baseline();
  insert into public.sim_events (actor_id, scenario, kind) values (p_actor, 'all', 'reset');
end $$;

-- ---------------------------------------------------------------- privileges (deny by default)
revoke all on function
  public.app_now(), public.app_today(), public.fee_for(bigint, boolean), public.open_additional_account(text, text),
  public.staff_customer_detail(uuid), public.staff_list_tickets(text, integer), public.staff_ticket_customer(uuid),
  public.staff_dashboard_stats(), public.admin_audit_log(integer, text), public.seed_demo_profile(uuid, text, text, text, text, text, text),
  public.sim_seed_baseline(), public.sim_apply(text, uuid, uuid), public.sim_advance(integer, uuid)
from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant execute on function
  public.app_now(), public.app_today(), public.fee_for(bigint, boolean), public.open_additional_account(text, text),
  public.staff_customer_detail(uuid), public.staff_list_tickets(text, integer), public.staff_ticket_customer(uuid),
  public.staff_dashboard_stats(), public.admin_audit_log(integer, text)
to authenticated;

grant execute on function
  public.app_now(), public.app_today(), public.fee_for(bigint, boolean),
  public.seed_demo_profile(uuid, text, text, text, text, text, text), public.sim_seed_baseline(),
  public.sim_apply(text, uuid, uuid), public.sim_advance(integer, uuid)
to service_role;
grant execute on all functions in schema private to service_role;
grant all on private.sim_state to service_role;

-- Scheduled payments must be in the (simulated) future.
drop policy scheduled_insert on public.scheduled_payments;
create policy scheduled_insert on public.scheduled_payments for insert to authenticated with check (
  customer_id = (select auth.uid()) and status = 'scheduled' and execute_on > (select public.app_today())
  and exists (select 1 from public.accounts a where a.id = from_account_id and a.customer_id = (select auth.uid()) and a.status = 'active')
  and exists (select 1 from public.beneficiaries b where b.id = beneficiary_id and b.customer_id = (select auth.uid())));

-- ---------------------------------------------------------------- realtime (RLS applies to postgres_changes)
alter publication supabase_realtime add table
  public.ledger_entries, public.transfers, public.cards, public.card_authorizations,
  public.scheduled_payments, public.support_tickets, public.support_replies, public.sim_events;

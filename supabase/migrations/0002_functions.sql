-- ACME Bank: database functions.
-- Rules followed in every function:
--   * Parameters are bound; no dynamic SQL (no EXECUTE) anywhere.
--   * SECURITY DEFINER functions pin `search_path = ''` and fully qualify every object.
--   * Customer-facing functions derive identity from auth.uid(), never from a parameter.
--   * Execute privileges are granted explicitly in 0003_security.sql (default: nobody).

-- ---------------------------------------------------------------- helpers
create or replace function public.auth_role() returns text
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'customer')
$$;

create or replace function public.is_staff() returns boolean
language sql stable set search_path = '' as $$
  select public.auth_role() in ('support', 'admin')
$$;

-- CSPRNG digits (rejection sampling on gen_random_bytes to avoid modulo bias).
create or replace function private.random_digits(n integer) returns text
language plpgsql volatile set search_path = '' as $$
declare
  result text := '';
  b integer;
begin
  while char_length(result) < n loop
    b := get_byte(extensions.gen_random_bytes(1), 0);
    if b < 250 then
      result := result || (b % 10)::text;
    end if;
  end loop;
  return result;
end $$;

create or replace function private.balance_cents(p_account uuid) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(case when direction = 'credit' then amount_cents else -amount_cents end), 0)::bigint
  from public.ledger_entries where account_id = p_account
$$;

-- ---------------------------------------------------------------- audit
create or replace function public.audit_event(p_event text, p_details jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into audit.log (actor, actor_role, table_name, op, new_data)
  values (auth.uid(), public.auth_role(), 'event', left(p_event, 60), coalesce(p_details, '{}'::jsonb))
$$;

-- ---------------------------------------------------------------- rate limiting / login throttling
create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := now();
  v_row private.rate_limits;
begin
  insert into private.rate_limits as r (key, window_start, hits)
  values (p_key, v_now, 1)
  on conflict (key) do update set
    window_start = case when r.window_start + make_interval(secs => p_window_seconds) <= v_now then v_now else r.window_start end,
    hits         = case when r.window_start + make_interval(secs => p_window_seconds) <= v_now then 1 else r.hits + 1 end
  returning * into v_row;

  if v_row.hits > p_max then
    return jsonb_build_object(
      'allowed', false,
      'retry_after', ceil(extract(epoch from (v_row.window_start + make_interval(secs => p_window_seconds) - v_now)))::integer);
  end if;
  return jsonb_build_object('allowed', true, 'retry_after', 0);
end $$;

create or replace function public.login_failure_status(p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v private.login_failures;
  v_role text;
begin
  select * into v from private.login_failures where key = p_key;
  select u.raw_app_meta_data ->> 'role' into v_role
  from auth.users u where lower(u.email) = substr(p_key, char_length('login:') + 1);
  return jsonb_build_object(
    'failures', coalesce(v.failures, 0),
    'seconds_since_last', case when v.last_failure_at is null then null else extract(epoch from now() - v.last_failure_at)::integer end,
    'role_hint', v_role);
end $$;

create or replace function public.login_failure_record(p_key text) returns void
language sql security definer set search_path = '' as $$
  insert into private.login_failures as f (key, failures, last_failure_at) values (p_key, 1, now())
  on conflict (key) do update set failures = f.failures + 1, last_failure_at = now()
$$;

create or replace function public.login_failure_reset(p_key text) returns void
language sql security definer set search_path = '' as $$
  delete from private.login_failures where key = p_key
$$;

-- Revokes every session (and refresh token) of a user, e.g. after a role change.
create or replace function public.revoke_user_sessions(p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from auth.sessions where user_id = p_user_id
$$;

-- ---------------------------------------------------------------- account opening (consent first)
create or replace function public.open_customer_account(
  p_user_id uuid, p_full_name text, p_email text, p_phone text, p_address_line1 text, p_city text,
  p_postal_code text, p_notice_version text, p_marketing_email boolean, p_product_analytics boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_account uuid;
begin
  -- Required consents are recorded BEFORE any personal data is stored.
  insert into public.consents (user_id, purpose, granted, notice_version) values
    (p_user_id, 'terms', true, p_notice_version),
    (p_user_id, 'privacy_notice', true, p_notice_version),
    (p_user_id, 'marketing_email', coalesce(p_marketing_email, false), p_notice_version),
    (p_user_id, 'product_analytics', coalesce(p_product_analytics, false), p_notice_version);
  insert into public.consent_events (user_id, purpose, granted, notice_version)
  select user_id, purpose, granted, notice_version from public.consents where user_id = p_user_id;

  insert into public.profiles (id, full_name, email, phone, address_line1, city, postal_code)
  values (p_user_id, p_full_name, lower(p_email), p_phone, p_address_line1, p_city, p_postal_code);

  insert into public.accounts (customer_id, account_number)
  values (p_user_id, private.random_digits(11)) returning id into v_account;

  insert into public.cards (customer_id, account_id, last4) values (p_user_id, v_account, private.random_digits(4));
  insert into private.customer_pseudonyms (customer_id) values (p_user_id);
  return p_user_id;
end $$;

-- Pseudonym lookup for simulated integrations / event payloads (service role only).
-- Re-identification (pseudonym -> customer) is deliberately not exposed by any function.
create or replace function public.customer_pseudonym(p_customer_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select pseudonym from private.customer_pseudonyms where customer_id = p_customer_id
$$;

-- ---------------------------------------------------------------- demo seeding (service role only)
create or replace function public.seed_customer(p_user_id uuid, p_full_name text, p_email text, p_city text) returns uuid
language sql security definer set search_path = '' as $$
  select public.open_customer_account(p_user_id, p_full_name, p_email, null, null, p_city, null, 'demo-1', false, false)
$$;

create or replace function public.seed_ledger_entry(
  p_customer_id uuid, p_booked_at timestamptz, p_description text, p_amount_cents bigint, p_direction text
) returns void
language sql security definer set search_path = '' as $$
  insert into public.ledger_entries (account_id, booked_at, description, amount_cents, direction)
  select a.id, p_booked_at, p_description, p_amount_cents, p_direction
  from public.accounts a where a.customer_id = p_customer_id order by a.created_at limit 1
$$;

-- ---------------------------------------------------------------- money movement (customer)
-- Step 1: quote (fee shown to the user before confirmation). Returns a short-lived, single-use quote.
create or replace function public.quote_transfer(
  p_from_account uuid, p_amount_cents bigint, p_to_account uuid default null, p_beneficiary uuid default null
) returns table (quote_id uuid, fee_cents bigint, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_fee bigint;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 100000000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if (p_to_account is null) = (p_beneficiary is null) then raise exception 'invalid_destination' using errcode = '22023'; end if;
  if not exists (select 1 from public.accounts where id = p_from_account and customer_id = v_uid and status = 'active') then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
  if p_to_account is not null and not exists (select 1 from public.accounts where id = p_to_account and customer_id = v_uid and status = 'active' and id <> p_from_account) then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
  if p_beneficiary is not null and not exists (select 1 from public.beneficiaries where id = p_beneficiary and customer_id = v_uid) then
    raise exception 'beneficiary_not_found' using errcode = 'P0002';
  end if;

  v_fee := case when p_beneficiary is not null then 150 else 0 end;  -- external transfers: 1.50 fee

  return query
  insert into private.transfer_quotes as q (customer_id, from_account_id, to_account_id, beneficiary_id, amount_cents, fee_cents, expires_at)
  values (v_uid, p_from_account, p_to_account, p_beneficiary, p_amount_cents, v_fee, now() + interval '5 minutes')
  returning q.id, q.fee_cents, q.expires_at;
end $$;

-- Step 2: confirm. Single-use quote, balance check under a row lock, pending transfer + debit entries.
create or replace function public.confirm_transfer(p_quote_id uuid, p_reference text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  q private.transfer_quotes;
  v_transfer uuid;
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
  values (v_uid, q.from_account_id, q.to_account_id, q.beneficiary_id, q.amount_cents, q.fee_cents, p_reference, 'pending')
  returning id into v_transfer;

  insert into public.ledger_entries (account_id, description, amount_cents, direction, transfer_id)
  values (q.from_account_id, coalesce(nullif(p_reference, ''), 'Transfer'), q.amount_cents, 'debit', v_transfer);
  if q.fee_cents > 0 then
    insert into public.ledger_entries (account_id, description, amount_cents, direction, transfer_id)
    values (q.from_account_id, 'Transfer fee', q.fee_cents, 'debit', v_transfer);
  end if;
  return v_transfer;
end $$;

-- ---------------------------------------------------------------- settlement (service role, cron)
create or replace function public.settle_pending_transfers() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  with due as (
    update public.transfers set status = 'completed', settled_at = now()
    where status = 'pending' and created_at < now() - interval '2 minutes'
    returning id, to_account_id, amount_cents, reference, scenario_id
  ), credited as (
    insert into public.ledger_entries (account_id, description, amount_cents, direction, transfer_id, scenario_id)
    select to_account_id, coalesce(nullif(reference, ''), 'Incoming transfer'), amount_cents, 'credit', id, scenario_id
    from due where to_account_id is not null
    returning 1
  )
  select count(*) into v_count from due;
  return v_count;
end $$;

create or replace function public.execute_due_scheduled_payments() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  p record;
  v_transfer uuid;
  v_count integer := 0;
begin
  for p in
    select * from public.scheduled_payments
    where status = 'scheduled' and execute_on <= current_date
    order by execute_on
    for update skip locked
  loop
    perform 1 from public.accounts where id = p.from_account_id for update;
    if private.balance_cents(p.from_account_id) < p.amount_cents + 150 then
      update public.scheduled_payments set status = 'failed' where id = p.id;
      continue;
    end if;
    insert into public.transfers (customer_id, from_account_id, beneficiary_id, amount_cents, fee_cents, reference, status)
    values (p.customer_id, p.from_account_id, p.beneficiary_id, p.amount_cents, 150, p.reference, 'pending')
    returning id into v_transfer;
    insert into public.ledger_entries (account_id, description, amount_cents, direction, transfer_id) values
      (p.from_account_id, coalesce(nullif(p.reference, ''), 'Scheduled payment'), p.amount_cents, 'debit', v_transfer),
      (p.from_account_id, 'Transfer fee', 150, 'debit', v_transfer);
    update public.scheduled_payments set status = 'executed', transfer_id = v_transfer where id = p.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------- staff (support/admin)
-- Masked, capped customer lookup: never returns more than 20 rows, needs >= 3 characters.
create or replace function public.staff_search_customers(p_query text)
returns table (id uuid, full_name text, email text, phone_masked text, account_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_query is null or char_length(trim(p_query)) < 3 or char_length(p_query) > 100 then return; end if;
  return query
  select pr.id, pr.full_name, pr.email,
         case when pr.phone is null then null else left(pr.phone, 3) || '****' || right(pr.phone, 2) end,
         (select count(*) from public.accounts a where a.customer_id = pr.id)
  from public.profiles pr
  where pr.full_name ilike replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
     or lower(pr.email) = lower(trim(p_query))
  order by pr.full_name
  limit 20;
end $$;

-- Aggregated, non-identifying activity for staff dashboards (secondary use).
create or replace function public.staff_activity_daily(p_days integer default 30)
returns table (day date, direction text, entries bigint, total_cents bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select (le.booked_at at time zone 'UTC')::date, le.direction, count(*), sum(le.amount_cents)::bigint
  from public.ledger_entries le
  where le.booked_at >= now() - make_interval(days => least(greatest(p_days, 1), 90))
  group by 1, 2 order by 1 desc, 2;
end $$;

create or replace function public.admin_audit_log(p_limit integer default 50)
returns setof audit.log
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.auth_role() <> 'admin' then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select * from audit.log order by at desc limit least(greatest(p_limit, 1), 200);
end $$;

-- ---------------------------------------------------------------- simulation (service role; API is admin-gated)
create or replace function public.sim_apply(p_scenario text, p_days integer, p_actor uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  a record;
  d integer;
  v_rows integer := 0;
  v_transfer uuid;
begin
  if p_scenario not in ('purchases', 'deposits', 'insufficient-funds', 'pending-transfers') then
    raise exception 'unknown_scenario' using errcode = '22023';
  end if;
  if p_days is null or p_days < 1 or p_days > 31 then raise exception 'invalid_days' using errcode = '22023'; end if;

  for a in select id, customer_id from public.accounts where status = 'active' loop
    for d in 1..p_days loop
      if p_scenario = 'purchases' then
        insert into public.ledger_entries (account_id, booked_at, description, amount_cents, direction, scenario_id)
        values (a.id, now() + make_interval(days => d - 1), 'Simulated card purchase', 300 + floor(random() * 9700)::bigint, 'debit', p_scenario);
      elsif p_scenario = 'deposits' then
        insert into public.ledger_entries (account_id, booked_at, description, amount_cents, direction, scenario_id)
        values (a.id, now() + make_interval(days => d - 1), 'Simulated deposit', 10000 + floor(random() * 90000)::bigint, 'credit', p_scenario);
      elsif p_scenario = 'insufficient-funds' then
        insert into public.transfers (customer_id, from_account_id, to_account_id, amount_cents, reference, status, scenario_id)
        select a.customer_id, a.id, o.id, private.balance_cents(a.id) + 100000, 'Simulated insufficient funds', 'failed', p_scenario
        from public.accounts o where o.id <> a.id limit 1;
      else -- pending-transfers: stay pending until the settlement job completes them
        v_transfer := null;
        insert into public.transfers (customer_id, from_account_id, to_account_id, amount_cents, reference, status, scenario_id)
        select a.customer_id, a.id, o.id, 1000, 'Simulated pending transfer', 'pending', p_scenario
        from public.accounts o where o.id <> a.id limit 1
        returning id into v_transfer;
        if v_transfer is not null then
          insert into public.ledger_entries (account_id, description, amount_cents, direction, transfer_id, scenario_id)
          values (a.id, 'Simulated pending transfer', 1000, 'debit', v_transfer, p_scenario);
        end if;
      end if;
      v_rows := v_rows + 1;
    end loop;
  end loop;

  insert into public.sim_events (actor_id, scenario, kind, details)
  values (p_actor, p_scenario, 'apply', jsonb_build_object('days', p_days, 'rows', v_rows));
  return v_rows;
end $$;

-- Resets simulation-generated rows only; baseline demo data and the audit trail are kept.
create or replace function public.sim_reset_demo_data(p_actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.sim_reset', 'on', true);  -- transaction-local; honoured by the ledger guard
  delete from public.ledger_entries where scenario_id is not null;
  delete from public.transfers where scenario_id is not null;
  perform set_config('app.sim_reset', 'off', true);
  insert into public.sim_events (actor_id, scenario, kind) values (p_actor, 'all', 'reset');
end $$;

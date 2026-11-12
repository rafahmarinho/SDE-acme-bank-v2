-- ACME Bank: core schema. Amounts are BIGINT cents. Public identifiers are random UUIDs.
-- Security-relevant design:
--   * `audit` and `private` schemas are NOT exposed through the Data API (see config.toml [api].schemas).
--   * Personal data lives only in public.profiles; other tables reference it by id (single source of truth).
--   * No date of birth / national ID is collected (data minimisation).

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
create schema if not exists audit;

-- ---------------------------------------------------------------- customers
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null check (char_length(full_name) between 2 and 120),
  email         text not null check (char_length(email) <= 254),
  phone         text check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  address_line1 text check (char_length(address_line1) <= 200),
  city          text check (char_length(city) <= 100),
  postal_code   text check (char_length(postal_code) <= 20),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index profiles_email_uniq on public.profiles (lower(email));

create table public.accounts (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.profiles (id) on delete restrict,
  account_number text not null unique check (account_number ~ '^[0-9]{11}$'),
  kind           text not null default 'checking' check (kind in ('checking', 'savings')),
  status         text not null default 'active' check (status in ('active', 'frozen', 'closed')),
  created_at     timestamptz not null default now()
);
create index accounts_customer_idx on public.accounts (customer_id);

create table public.beneficiaries (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.profiles (id) on delete cascade,
  nickname       text not null check (char_length(nickname) between 1 and 60),
  account_number text not null check (account_number ~ '^[0-9]{11}$'),
  bank_name      text not null check (char_length(bank_name) between 1 and 80),
  created_at     timestamptz not null default now()
);
create index beneficiaries_customer_idx on public.beneficiaries (customer_id);

create table public.transfers (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles (id),
  from_account_id uuid not null references public.accounts (id),
  to_account_id   uuid references public.accounts (id),
  beneficiary_id  uuid references public.beneficiaries (id),
  amount_cents    bigint not null check (amount_cents > 0 and amount_cents <= 100000000),
  fee_cents       bigint not null default 0 check (fee_cents >= 0),
  reference       text check (char_length(reference) <= 140),
  status          text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'cancelled')),
  scenario_id     text,
  created_at      timestamptz not null default now(),
  settled_at      timestamptz,
  check ((to_account_id is null) <> (beneficiary_id is null))
);
create index transfers_customer_idx on public.transfers (customer_id, created_at desc);
create index transfers_pending_idx on public.transfers (status) where status = 'pending';

create table public.ledger_entries (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.accounts (id),
  booked_at    timestamptz not null default now(),
  description  text not null check (char_length(description) between 1 and 140),
  amount_cents bigint not null check (amount_cents > 0),
  direction    text not null check (direction in ('debit', 'credit')),
  transfer_id  uuid references public.transfers (id),
  scenario_id  text,
  created_at   timestamptz not null default now()
);
create index ledger_account_booked_idx on public.ledger_entries (account_id, booked_at desc);

create table public.scheduled_payments (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles (id),
  from_account_id uuid not null references public.accounts (id),
  beneficiary_id  uuid not null references public.beneficiaries (id),
  amount_cents    bigint not null check (amount_cents > 0 and amount_cents <= 100000000),
  reference       text check (char_length(reference) <= 140),
  execute_on      date not null,
  status          text not null default 'scheduled' check (status in ('scheduled', 'executed', 'cancelled', 'failed')),
  transfer_id     uuid references public.transfers (id),
  created_at      timestamptz not null default now()
);
create index scheduled_due_idx on public.scheduled_payments (execute_on) where status = 'scheduled';

create table public.cards (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.profiles (id),
  account_id        uuid not null references public.accounts (id),
  last4             text not null check (last4 ~ '^[0-9]{4}$'),   -- simulated card: no PAN / CVV stored
  status            text not null default 'active' check (status in ('active', 'blocked')),
  daily_limit_cents bigint not null default 100000 check (daily_limit_cents between 0 and 1000000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index cards_customer_idx on public.cards (customer_id);

create table public.statements (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.profiles (id),
  account_id   uuid not null references public.accounts (id),
  period_start date not null,
  period_end   date not null check (period_end >= period_start and period_end - period_start <= 366),
  format       text not null check (format in ('csv', 'pdf')),
  storage_path text not null unique,   -- server-generated: {customer_uuid}/{statement_uuid}.{format}
  created_at   timestamptz not null default now()
);

create table public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id),
  subject     text not null check (char_length(subject) between 1 and 120),
  body        text not null check (char_length(body) between 1 and 2000),
  status      text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at  timestamptz not null default now()
);

create table public.support_replies (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets (id) on delete cascade,
  author_id  uuid not null references auth.users (id),
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- privacy
create table public.consents (
  user_id        uuid not null references auth.users (id) on delete cascade,
  purpose        text not null check (purpose in ('terms', 'privacy_notice', 'marketing_email', 'product_analytics')),
  granted        boolean not null,
  notice_version text not null check (char_length(notice_version) <= 20),
  updated_at     timestamptz not null default now(),
  primary key (user_id, purpose)
);

create table public.consent_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  purpose        text not null,
  granted        boolean not null,
  notice_version text not null,
  at             timestamptz not null default now()
);

create table public.processing_restrictions (
  user_id    uuid not null references auth.users (id) on delete cascade,
  activity   text not null check (activity in ('marketing_email', 'product_analytics', 'staff_bulk_export', 'all_non_essential')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (user_id, activity)
);

-- Pseudonyms used by simulated external integrations and event logs; mapping is service-role only.
create table private.customer_pseudonyms (
  customer_id uuid primary key references public.profiles (id) on delete cascade,
  pseudonym   uuid not null unique default gen_random_uuid()
);

-- ---------------------------------------------------------------- simulation
create table public.sim_events (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid,                         -- opaque id only, no names/emails
  scenario   text not null,
  kind       text not null check (kind in ('apply', 'reset')),
  details    jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------- internal state
create table private.rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  hits         integer not null
);

create table private.login_failures (
  key             text primary key,
  failures        integer not null default 0,
  last_failure_at timestamptz
);

create table private.transfer_quotes (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles (id),
  from_account_id uuid not null references public.accounts (id),
  to_account_id   uuid references public.accounts (id),
  beneficiary_id  uuid references public.beneficiaries (id),
  amount_cents    bigint not null check (amount_cents > 0),
  fee_cents       bigint not null check (fee_cents >= 0),
  expires_at      timestamptz not null,
  used_at         timestamptz
);

create table audit.log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      uuid,
  actor_role text,
  table_name text not null,
  op         text not null,
  row_id     text,
  old_data   jsonb,
  new_data   jsonb
);
create index audit_log_at_idx on audit.log (at desc);

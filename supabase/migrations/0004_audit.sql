-- ACME Bank: audit trail and tamper protection.
--   * Every change to money, card, authorization and personal-data tables is captured with the actor,
--     the actor's role, timestamp, row id and before/after values. Sensitive columns are excluded via
--     trigger arguments.
--   * audit.log is append-only for everyone, including the service role (no UPDATE/DELETE grants, plus a guard trigger).
--   * ledger_entries is append-only: corrections are reversing entries. The only exception is the
--     simulation reset, which may delete simulation-generated rows (scenario_id is not null) while the
--     transaction-local flag app.sim_reset is on. Those deletions are still audited.

create or replace function audit.capture() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  k text;
begin
  if tg_nargs > 0 then
    foreach k in array tg_argv loop
      v_old := v_old - k;
      v_new := v_new - k;
    end loop;
  end if;
  insert into audit.log (actor, actor_role, table_name, op, row_id, old_data, new_data)
  values (auth.uid(), coalesce(auth.jwt() -> 'app_metadata' ->> 'role', case when auth.uid() is null then 'system' else 'customer' end),
          tg_table_name, tg_op, coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'user_id', v_old ->> 'user_id'), v_old, v_new);
  return coalesce(new, old);
end $$;

create trigger audit_accounts after insert or update or delete on public.accounts for each row execute function audit.capture();
create trigger audit_ledger after insert or update or delete on public.ledger_entries for each row execute function audit.capture();
create trigger audit_transfers after insert or update or delete on public.transfers for each row execute function audit.capture();
create trigger audit_scheduled after insert or update or delete on public.scheduled_payments for each row execute function audit.capture();
create trigger audit_cards after insert or update or delete on public.cards for each row execute function audit.capture();
create trigger audit_beneficiaries after insert or update or delete on public.beneficiaries for each row execute function audit.capture('account_number');
create trigger audit_profiles after insert or update or delete on public.profiles for each row
  execute function audit.capture('phone', 'address_line1', 'postal_code');
create trigger audit_consents after insert or update or delete on public.consents for each row execute function audit.capture();
create trigger audit_restrictions after insert or update or delete on public.processing_restrictions for each row execute function audit.capture();
create trigger audit_statements after insert or update or delete on public.statements for each row execute function audit.capture('storage_path');

-- audit.log: no modification by anyone
create or replace function audit.forbid_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit.log is append-only' using errcode = '42501';
end $$;
create trigger audit_log_immutable before update or delete on audit.log for each row execute function audit.forbid_change();
revoke update, delete, truncate on audit.log from service_role;

-- ledger_entries: append-only
create or replace function private.ledger_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('app.sim_reset', true) = 'on' and old.scenario_id is not null then
    return old;
  end if;
  raise exception 'ledger_entries is append-only; post a reversing entry instead' using errcode = '42501';
end $$;
create trigger ledger_append_only before update or delete on public.ledger_entries for each row execute function private.ledger_guard();
revoke update, truncate on public.ledger_entries from service_role;

-- keep updated_at honest
create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger cards_touch before update on public.cards for each row execute function private.touch_updated_at();

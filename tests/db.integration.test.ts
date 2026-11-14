/**
 * Database access-control tests against a running Supabase stack (local: `supabase start` +
 * `pnpm seed:demo`). They sign in as each demo role and assert what PostgreSQL itself allows
 * (RLS, column grants, function privileges) - independent of the Next.js layer (T2598, T378, T19, T349).
 *
 * Run: pnpm test:db  (or INTEGRATION=1 pnpm test; needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * DEMO_USER_PASSWORD in the environment, e.g. from .env.local)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.INTEGRATION === "1" || process.env.npm_lifecycle_event === "test:db";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const password = process.env.DEMO_USER_PASSWORD!;

async function signIn(email: string): Promise<{ client: SupabaseClient; id: string }> {
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return { client, id: data.user.id };
}

describe.skipIf(!enabled)("PostgreSQL access control (live database)", () => {
  let c1: Awaited<ReturnType<typeof signIn>>;
  let c2: Awaited<ReturnType<typeof signIn>>;
  let support: Awaited<ReturnType<typeof signIn>>;
  let admin: Awaited<ReturnType<typeof signIn>>;
  let c2Account: string;
  let c2Card: string;

  beforeAll(async () => {
    [c1, c2, support, admin] = await Promise.all([
      signIn("customer1@demo.acme-bank.example"), signIn("customer2@demo.acme-bank.example"),
      signIn("support@demo.acme-bank.example"), signIn("admin@demo.acme-bank.example"),
    ]);
    c2Account = (await c2.client.from("accounts").select("id").limit(1).single()).data!.id;
    c2Card = (await c2.client.from("cards").select("id").limit(1).single()).data!.id;
  });

  it("a customer cannot read another customer's accounts, ledger, cards or profile (IDOR -> empty)", async () => {
    expect((await c1.client.from("accounts").select("id").eq("id", c2Account)).data).toEqual([]);
    expect((await c1.client.from("ledger_entries").select("id").eq("account_id", c2Account)).data).toEqual([]);
    expect((await c1.client.from("cards").select("id").eq("id", c2Card)).data).toEqual([]);
    expect((await c1.client.from("profiles").select("id").eq("id", c2.id)).data).toEqual([]);
  });

  it("a customer cannot block another customer's card", async () => {
    const { data } = await c1.client.from("cards").update({ status: "blocked" }).eq("id", c2Card).select("id");
    expect(data ?? []).toEqual([]);
    expect((await c2.client.from("cards").select("status").eq("id", c2Card).single()).data!.status).toBe("active");
  });

  it("nobody can write the ledger directly; money moves only through checked RPCs", async () => {
    const own = (await c1.client.from("accounts").select("id").limit(1).single()).data!.id;
    const ins = await c1.client.from("ledger_entries").insert({ account_id: own, description: "free money", amount_cents: 100000, direction: "credit" });
    expect(ins.error).not.toBeNull();
    const quote = await c1.client.rpc("quote_transfer", { p_from_account: c2Account, p_amount_cents: 100, p_to_account: null, p_beneficiary: null });
    expect(quote.error).not.toBeNull(); // cannot debit someone else's account
  });

  it("customers cannot change their own role or other protected columns", async () => {
    const res = await c1.client.from("profiles").update({ is_demo: false, email: "x@evil.example" }).eq("id", c1.id);
    expect(res.error).not.toBeNull();
  });

  it("simulation, seeding and rate-limit functions are not executable by end users (even admins via the API)", async () => {
    for (const client of [c1.client, support.client, admin.client]) {
      expect((await client.rpc("sim_reset_demo_data", { p_actor: null })).error).not.toBeNull();
      expect((await client.rpc("sim_advance", { p_days: 1, p_actor: null })).error).not.toBeNull();
      expect((await client.rpc("rate_limit_hit", { p_key: "x", p_max: 1, p_window_seconds: 1 })).error).not.toBeNull();
    }
  });

  it("support can read but not modify cards or balances", async () => {
    expect((await support.client.from("cards").select("id").eq("id", c2Card)).data).toHaveLength(1);
    const { data } = await support.client.from("cards").update({ daily_limit_cents: 1000000 }).eq("id", c2Card).select("id");
    expect(data ?? []).toEqual([]);
  });

  it("staff customer search is masked, capped and needs >= 3 characters", async () => {
    expect((await support.client.rpc("staff_search_customers", { p_query: "" })).data).toEqual([]);
    expect((await support.client.rpc("staff_search_customers", { p_query: "%" })).data).toEqual([]);
    const { data } = await support.client.rpc("staff_search_customers", { p_query: "Jordan" });
    expect(data).toHaveLength(1);
    expect(data[0].phone_masked).toMatch(/\*\*\*\*/);
    expect(data[0]).not.toHaveProperty("address_line1");
    expect((await c1.client.rpc("staff_search_customers", { p_query: "Jordan" })).error).not.toBeNull();
  });

  it("the audit log is admin-only and not reachable through the API schema", async () => {
    expect((await c1.client.rpc("admin_audit_log", { p_limit: 5, p_table: null })).error).not.toBeNull();
    expect((await support.client.rpc("admin_audit_log", { p_limit: 5, p_table: null })).error).not.toBeNull();
    expect((await admin.client.rpc("admin_audit_log", { p_limit: 5, p_table: null })).data?.length).toBeGreaterThan(0);
    expect((await admin.client.schema("audit").from("log").select("id").limit(1)).error).not.toBeNull();
  });

  it("statement files are private: no listing of another customer's folder", async () => {
    const { data } = await c1.client.storage.from("statements").list(c2.id);
    expect(data ?? []).toEqual([]);
  });
});

/**
 * Demo data seeder: six fictional customers, one support agent, one administrator, and two months
 * of synthetic transactions.
 *
 * - No real personal data: names and addresses come from a fixed fictional list.
 * - No hardcoded passwords: DEMO_USER_PASSWORD must be provided per environment.
 * - Uses the service-role key from the environment; run locally or in CI only, never from the app.
 *
 * Usage: DEMO_USER_PASSWORD=... SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... pnpm seed:demo
 */
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoPassword = process.env.DEMO_USER_PASSWORD;

if (!url || !serviceKey || !demoPassword || demoPassword.length < 12) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_USER_PASSWORD (12+ chars).");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const PEOPLE = [
  { name: "Avery Lindqvist", city: "Springfield" },
  { name: "Jordan Okafor", city: "Riverton" },
  { name: "Casey Moreau", city: "Lakeside" },
  { name: "Riley Tanaka", city: "Hillview" },
  { name: "Morgan Castillo", city: "Brookfield" },
  { name: "Quinn Halvorsen", city: "Fairhaven" },
] as const;

const STAFF = [
  { name: "Sam Support", email: "support@demo.acme-bank.example", role: "support" },
  { name: "Alex Admin", email: "admin@demo.acme-bank.example", role: "admin" },
] as const;

const MERCHANTS = ["Grocer Co", "Metro Transit", "Coffee Corner", "Bookshop", "Utility Power", "Streaming Plus"];

async function createUser(email: string, fullName: string, role: "customer" | "support" | "admin") {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: demoPassword,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  for (const s of STAFF) await createUser(s.email, s.name, s.role);

  for (const [i, p] of PEOPLE.entries()) {
    const email = `customer${i + 1}@demo.acme-bank.example`;
    const userId = await createUser(email, p.name, "customer");
    const { data: profileId, error } = await admin.rpc("seed_customer", {
      p_user_id: userId,
      p_full_name: p.name,
      p_email: email,
      p_city: p.city,
    });
    if (error) throw error;

    const today = new Date();
    for (let d = 60; d >= 0; d -= randomInt(1, 4)) {
      const day = new Date(today.getTime() - d * 86_400_000);
      const isDeposit = randomInt(0, 6) === 0;
      const { error: entryError } = await admin.rpc("seed_ledger_entry", {
        p_customer_id: profileId,
        p_booked_at: day.toISOString(),
        p_description: isDeposit ? "Salary deposit" : MERCHANTS[randomInt(0, MERCHANTS.length)],
        p_amount_cents: isDeposit ? randomInt(150_000, 400_000) : randomInt(300, 15_000),
        p_direction: isDeposit ? "credit" : "debit",
      });
      if (entryError) throw entryError;
    }
  }
  console.log("Demo data seeded.");
}

main().catch((err) => {
  console.error("Seeding failed:", err.message);
  process.exit(1);
});

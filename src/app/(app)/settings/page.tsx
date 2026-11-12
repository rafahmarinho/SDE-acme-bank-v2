/**
 * Settings: privacy & consent management. Each optional consent shows its current state and a toggle;
 * withdrawing takes effect immediately (email/analytics services check consents before acting).
 */
import { authorize } from "@/lib/authz";
import { listConsents, OPTIONAL_PURPOSES } from "@/services/privacy.service";
import { setConsentAction } from "./actions";

const LABELS: Record<string, string> = {
  marketing_email: "Product news and offers by email",
  product_analytics: "Help improve ACME Bank with usage analytics",
};

export default async function Page() {
  const { user, supabase } = await authorize("consents", "GET");
  const consents = await listConsents(supabase, user.id);
  const state = new Map(consents.map((c) => [c.purpose, c.granted]));
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section aria-labelledby="privacy" className="mt-6">
        <h2 id="privacy" className="text-lg font-semibold">Privacy and consent</h2>
        <ul>
          {OPTIONAL_PURPOSES.map((purpose) => {
            const granted = state.get(purpose) === true;
            return (
              <li key={purpose} className="flex items-center justify-between py-2">
                <span>{LABELS[purpose]}: {granted ? "On" : "Off"}</span>
                <form action={setConsentAction}>
                  <input type="hidden" name="purpose" value={purpose} />
                  <input type="hidden" name="granted" value={granted ? "false" : "true"} />
                  <button type="submit">{granted ? "Withdraw consent" : "Give consent"}</button>
                </form>
              </li>
            );
          })}
        </ul>
        <p className="text-sm">To object to other processing of your data, contact Support.</p>
      </section>
      <section className="mt-6">
        <a href="/forgot-password">Change password</a>
      </section>
    </main>
  );
}

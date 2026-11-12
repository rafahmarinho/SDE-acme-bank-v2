/**
 * Simulation control (admin only): choose scenarios, advance the simulation, view events, reset demo data.
 * Server-side role check and feature flag; the actual actions go through /api/simulation, which re-checks both.
 */
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { SCENARIO_KEYS } from "@/services/scenarios";

export default async function Page() {
  if (process.env.SIMULATION_ADMIN_ENABLED !== "true") notFound();
  const { user, role, supabase } = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (role !== "admin") redirect("/staff");

  const { data: events } = await supabase
    .from("sim_events")
    .select("id, at, scenario, kind, details")
    .order("at", { ascending: false })
    .limit(50);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Simulation</h1>
      <p>Available scenarios: {SCENARIO_KEYS.join(", ")}</p>
      <h2 className="mt-6 text-lg font-semibold">Recent events</h2>
      <ul>
        {(events ?? []).map((e) => (
          <li key={e.id}>
            {new Date(e.at).toLocaleString("en-US")} - {e.kind} {e.scenario}
          </li>
        ))}
      </ul>
    </main>
  );
}

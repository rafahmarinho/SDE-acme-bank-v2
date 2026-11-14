/**
 * Simulation control (admin only): choose scenarios, advance the simulated clock, view events and
 * reset demo data. 404 when SIMULATION_ADMIN_ENABLED is not "true" (T49); actions re-check both.
 * Results are persisted in PostgreSQL and show up on every screen (and survive reloads).
 */
import { Activity, CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader } from "@/components/app/common";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatLongDate, titleCase } from "@/lib/format";
import { requirePageRole } from "@/lib/page-auth";
import { SCENARIOS } from "@/services/scenarios";
import { simulationEnabled, simulationOverview } from "@/services/simulation.service";
import { AdvanceForm, ResetForm, ScenarioForm } from "./simulation-forms";

export const metadata: Metadata = { title: "Simulation" };

const KIND_VARIANT = { apply: "brand", advance: "default", reset: "destructive", seed: "secondary" } as const;

function describe(kind: string, scenario: string, d: Record<string, unknown>) {
  if (kind === "advance") return `Advanced ${d.days} day(s) to ${d.sim_date} · ${d.purchases} purchases (${d.declined} declined) · ${d.scheduled_executed} scheduled · ${d.settled} settled`;
  if (kind === "apply") return `${SCENARIOS[scenario as keyof typeof SCENARIOS]?.label ?? titleCase(scenario)} · ${d.rows} events · ${d.target === "all demo customers" ? "all demo customers" : `customer ${String(d.target).slice(0, 8)}`}`;
  if (kind === "seed") return `Baseline generated for ${d.customers} demo customers`;
  return "Demo data reset to baseline";
}

export default async function SimulationPage() {
  if (!simulationEnabled()) notFound();
  const { supabase } = await requirePageRole(["admin"]);
  const { events, simDate, demoCustomers } = await simulationOverview(supabase);
  const scenarios = Object.entries(SCENARIOS).map(([key, v]) => ({ key, ...v }));

  return (
    <>
      <PageHeader title="Simulation" description="Drive the demo: run scenarios, move time forward and reset." actions={<RealtimeRefresher channel="sim" tables={["sim_events"]} />} />
      <div className="mb-6 flex items-center gap-3 rounded-xl bg-navy-900 p-4 text-white">
        <CalendarDays aria-hidden className="size-5 text-brand" />
        <span className="text-sm text-white/70">Simulated date</span>
        <span className="font-semibold">{simDate ? formatLongDate(simDate) : "-"}</span>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><div><CardTitle>Run a scenario</CardTitle><CardDescription>Simulated card network and payment rails.</CardDescription></div></CardHeader>
          <CardContent><ScenarioForm scenarios={scenarios} customers={demoCustomers} /></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Advance the clock</CardTitle><CardDescription>Pending transfers complete as time passes.</CardDescription></div></CardHeader>
          <CardContent><AdvanceForm /></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Reset</CardTitle><CardDescription>Back to the two-month baseline.</CardDescription></div></CardHeader>
          <CardContent><ResetForm /></CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><div><CardTitle>Events</CardTitle><CardDescription>Latest 50. Customers appear as pseudonymous ids only.</CardDescription></div></CardHeader>
        <CardContent>
          {events.length === 0 ? <EmptyState icon={Activity} title="No events yet" /> : (
            <ol className="relative grid gap-4 border-l pl-5">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span aria-hidden className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-brand ring-4 ring-card" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={KIND_VARIANT[e.kind as keyof typeof KIND_VARIANT] ?? "secondary"}>{titleCase(e.kind)}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(e.at)}</span>
                  </div>
                  <p className="mt-1 text-sm">{describe(e.kind, e.scenario, e.details ?? {})}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </>
  );
}

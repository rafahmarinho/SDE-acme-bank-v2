/**
 * Allow-list of simulation scenarios (T42). Request data selects a scenario only through this enum;
 * it never chooses files, modules or SQL. The keys match the check in public.sim_apply().
 */
export const SCENARIOS = {
  purchases: { label: "Card purchases", description: "Three card purchases per card. Blocked cards, daily limits and low balances cause declines." },
  deposits: { label: "Deposits", description: "A check or cash deposit into each checking account." },
  payday: { label: "Payday", description: "A payroll credit into each checking account." },
  "insufficient-funds": { label: "Insufficient funds", description: "A purchase above the balance (declined) and a failed transfer attempt." },
  "pending-transfers": { label: "Pending transfers", description: "Transfers that stay pending until the clock advances or settlement runs." },
} as const;

export type ScenarioKey = keyof typeof SCENARIOS;
export const SCENARIO_KEYS = Object.keys(SCENARIOS) as [ScenarioKey, ...ScenarioKey[]];

/**
 * Allow-list of simulation scenarios. Request data selects a scenario only through this enum;
 * it never chooses files, modules or SQL. The keys match the CHECK in public.sim_apply().
 */
export const SCENARIOS = {
  purchases: "Card purchases",
  deposits: "Deposits",
  "insufficient-funds": "Insufficient funds",
  "pending-transfers": "Transfers that stay pending before completing",
} as const;

export type ScenarioKey = keyof typeof SCENARIOS;
export const SCENARIO_KEYS = Object.keys(SCENARIOS) as [ScenarioKey, ...ScenarioKey[]];

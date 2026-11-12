/**
 * Fixed-window rate limiting backed by PostgreSQL (public.rate_limit_hit, service-role only).
 * Works across Vercel serverless instances. Exceeding a budget throws HttpError(429) with Retry-After.
 */
import "server-only";
import { HttpError } from "@/lib/errors";
import { adminClient } from "@/lib/supabase/admin";

export type RateLimitBudget = { max: number; windowSec: number };

export const BUDGETS = {
  login: { max: 10, windowSec: 900 },
  loginIp: { max: 50, windowSec: 900 },
  passwordReset: { max: 3, windowSec: 3600 },
  moneyMovement: { max: 10, windowSec: 60 },
  mutation: { max: 30, windowSec: 60 },
  read: { max: 120, windowSec: 60 },
  statementGeneration: { max: 5, windowSec: 300 },
  ip: { max: 300, windowSec: 60 },
} satisfies Record<string, RateLimitBudget>;

export async function rateLimit(key: string, budget: RateLimitBudget): Promise<void> {
  const { data, error } = await adminClient().rpc("rate_limit_hit", {
    p_key: key.slice(0, 200),
    p_max: budget.max,
    p_window_seconds: budget.windowSec,
  });
  if (error) {
    console.error("rate limiter unavailable", error.message);
    throw new HttpError(503, "Service temporarily unavailable."); // fail closed
  }
  const result = data as { allowed: boolean; retry_after: number };
  if (!result.allowed) {
    throw new HttpError(429, undefined, { "Retry-After": String(Math.max(1, result.retry_after)) });
  }
}

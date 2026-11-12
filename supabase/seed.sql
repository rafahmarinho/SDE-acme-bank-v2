-- ACME Bank seed (runs on `supabase db reset`).
-- Demo customers, staff and two months of transactions are created by scripts/seed-demo.ts, which:
--   * uses only fictional, synthetic people (no real personal data),
--   * reads the demo password from DEMO_USER_PASSWORD (never hardcoded here),
--   * creates users through the Auth Admin API, so passwords are hashed by Supabase Auth.
-- This file contains no credentials or personal data.
select 1;

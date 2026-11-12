---
name: t69-strong-passwords-for-server-to-server-accounts
description: Ensure ACME Bank's Supabase database password, service-role key and CRON_SECRET are strong, platform-generated, stored in Vercel/Supabase secret stores and rotated.
---

# Task T69: Strong password requirements for server-to-server system accounts (NON-CODE)

**Category:** INFRA
**SD Elements:** [T69](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T69/)
**Priority:** 8

**Guidance:** System accounts used for server-to-server authentication must meet at least the same password requirements as end-user accounts.

**Why Not Code-Fixable:**
- Searched specs: specs/PRD.md, stack and deployment paragraphs
- Found: "Supabase para PostgreSQL" and "exemplos de variáveis de ambiente" ... "a API na Vercel". The API authenticates to Supabase with a service-role key, and migrations use the DB password.
- Missing: these credentials are generated and stored by Supabase and Vercel, not by application code. The code only reads them (see T76 for not hardcoding them).
- Conclusion: credential strength and rotation are platform and secrets-management tasks.

**Recommended Action:** The platform owner sets a 32+ character random DB password in Supabase, keeps the service-role key and `CRON_SECRET` (32+ random bytes) in Vercel encrypted environment variables (Production only), rotates them on staff changes and at least every 90 days, and limits who can see the Supabase and Vercel project settings.

**Status:** Documented

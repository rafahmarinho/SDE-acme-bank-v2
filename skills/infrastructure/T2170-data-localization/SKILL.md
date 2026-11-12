---
name: t2170-personal-info-meets-data-localization-reqs
description: Choose Supabase project region and Vercel function region for ACME Bank so personal data storage and processing satisfy applicable data localization requirements.
---

# Task T2170: Ensure that personal information processed by the application meets data localization requirements (NON-CODE)

**Category:** INFRA
**SD Elements:** [T2170](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T2170/)
**Priority:** 9

**Guidance:** Identify where personal information is stored and processed, research the localization rules for each jurisdiction, and use locally based providers or regions where required.

**Why Not Code-Fixable:**
- Searched specs: specs/PRD.md, all paragraphs (stack, deployment and data sections)
- Found: "Supabase para PostgreSQL [...] arquivos" and "publicar a versão web e a API na Vercel". Personal data is stored in hosted Supabase and processed on Vercel.
- Missing: the PRD names no jurisdiction or region, and storage location isn't set in application code.
- Conclusion: data residency is decided by the Supabase project region and the Vercel function region (`regions` in vercel.json), so this is a platform configuration decision.

**Recommended Action:** The privacy officer and platform owner pick the jurisdiction(s). Create the Supabase project in the matching region (for example `sa-east-1` if Brazilian LGPD residency is wanted), set the Vercel function region to match, and record the decision in the Data Processing Register.

**Status:** Documented

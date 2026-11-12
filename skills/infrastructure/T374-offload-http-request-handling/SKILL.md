---
name: t374-offload-http-request-handling-to-modules
description: Rely on and configure Vercel's edge network, firewall and DDoS mitigation in front of ACME Bank to offload HTTP request handling and resource-exhaustion protection.
---

# Task T374: Offload HTTP request handling to dedicated modules (NON-CODE)

**Category:** INFRA
**SD Elements:** [T374](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T374/)
**Priority:** 7

**Guidance:** Offload request handling to the OS or to dedicated server modules (firewall, QoS, security modules) so the HTTP server is protected against resource-exhaustion attacks.

**Why Not Code-Fixable:**
- Searched specs: specs/PRD.md, deployment paragraph
- Found: "publicar a versão web e a API na Vercel". The app runs on Vercel's managed edge and serverless runtime.
- Missing: there's no self-managed HTTP server, so the app code has no access to OS sockets or server modules.
- Conclusion: request buffering, connection handling and DDoS mitigation come from Vercel's edge, configured in the Vercel dashboard (Firewall / WAF rules, Attack Challenge Mode). App-level limits are covered by T35, T536 and T1362.

**Recommended Action:** The platform owner enables Vercel Firewall managed rules and rate-limit rules for `/api/*` and the auth routes, sets up Attack Challenge Mode for incidents, and reviews the edge analytics regularly.

**Status:** Documented

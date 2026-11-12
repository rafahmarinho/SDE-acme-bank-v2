---
name: t754-restrict-processing-of-personal-information
description: Let ACME Bank customers object to specific processing activities (marketing, analytics, partner sharing) and enforce a per-account allow-list of permitted processing in services.
---

# T754: Enable the restriction of processing personal information of an individual for a specific purpose

**Category:** CODE_FIX
**SD Elements:** [T754](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T754/)
**Priority:** 8

**Spec Context:**
> "perfil, configurações" ... "Tenha perfis de cliente, suporte e administrador."
> Source: specs/PRD.md, paragraphs 2 and 4

**What the spec implies (naive approach):**
Every service (email, simulation analytics, staff exports) processes every customer's data regardless of customer objections.

**Secure Implementation Pattern:**
```ts
// src/services/processing-guard.ts
import "server-only";
export type Activity = "marketing_email" | "product_analytics" | "staff_bulk_export";
export async function assertProcessingAllowed(userId: string, activity: Activity) {
  const { data } = await adminClient().from("processing_restrictions")
    .select("activity").eq("user_id", userId).eq("activity", activity).maybeSingle();
  if (data) throw new ProcessingRestrictedError(activity);
}
// email.service.ts: await assertProcessingAllowed(user.id, "marketing_email") before sending
// Support can set a full restriction flag on request (account frozen for processing except legal obligations).
```

**Implementation Guidance:**
- List the activities a customer can object to, from the PIA / data processing register.
- Store restrictions per account. Check them in every service that does that activity.
- Let support record a restriction requested through the support page, and log it.

**Success Criteria:**
- [ ] Restriction preferences exist per account
- [ ] Services check restrictions before processing
- [ ] Restriction changes are audited

**Status:** Applied

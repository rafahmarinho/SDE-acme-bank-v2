---
name: t1539-clear-browser-data-on-user-logout
description: On logout, revoke the Supabase session and send Clear-Site-Data so cached balances, statements and realtime state are removed from the browser.
---

# T1539: Clear browser data on user logout

**Category:** CODE_FIX
**SD Elements:** [T1539](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T1539/)
**Priority:** 8

**Spec Context:**
> "consultar saldo" ... "Inclua extratos em CSV e PDF" ... "atualizações em tempo real"
> Source: specs/PRD.md, paragraphs 2 and 3

**What the spec implies (naive approach):**
A logout button that only calls `supabase.auth.signOut()` in the browser. Cached account pages, query caches and realtime channels stay behind on shared devices.

**Secure Implementation Pattern:**
```ts
// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServerClient();
  await supabase.auth.signOut({ scope: "local" });
  const res = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL), 303);
  res.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
  res.headers.set("Cache-Control", "no-store");
  return res;
}
// Client, before submitting the logout form: supabase.removeAllChannels(); clear in-memory caches.
```

**Implementation Guidance:**
- Make logout a POST (CSRF-safe) that returns `Clear-Site-Data`.
- Unsubscribe every Supabase Realtime channel and clear client caches before redirecting.
- Set `Cache-Control: no-store` on authenticated pages and statement downloads.

**Success Criteria:**
- [ ] The logout response includes `Clear-Site-Data`
- [ ] Pressing Back after logout doesn't show account data
- [ ] Realtime subscriptions are closed on logout

**Status:** Pending

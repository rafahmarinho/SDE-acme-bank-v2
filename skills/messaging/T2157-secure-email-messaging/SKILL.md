---
name: t2157-secure-email-and-messaging-in-web-apps
description: Secure ACME Bank's transactional emails (password recovery, security notifications) - TLS SMTP, SPF/DKIM/DMARC on the sending domain, no sensitive data in email bodies, header-injection-safe templates.
---

# T2157: Secure email and messaging in web applications

**Category:** CODE_FIX
**SD Elements:** [T2157](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T2157/)
**Priority:** 7

**Spec Context:**
> "login por e-mail e senha" ... "Inclua login, recuperação de senha"
> Source: specs/PRD.md, paragraph 2

**What the spec implies (naive approach):**
Using Supabase's default shared SMTP sender, emails that include balances or full account numbers, and user-controlled names placed straight into subject lines.

**Secure Implementation Pattern:**
```ts
// src/services/email.service.ts (simulated sends in dev; Supabase Auth custom SMTP in prod)
const SubjectSafe = z.string().max(120).refine(s => !/[\r\n]/.test(s));   // header injection guard
export async function sendSecurityNotice(to: string, kind: "password_changed" | "new_login") {
  const subject = SubjectSafe.parse(kind === "password_changed" ? "Your ACME Bank password was changed" : "New sign-in to ACME Bank");
  const body = renderTemplate(kind, { appUrl: env.NEXT_PUBLIC_SITE_URL });  // no balances, no account numbers
  await smtp.send({ to, from: "security@mail.acme-bank.example", subject, html: body });
}
```

**Implementation Guidance:**
- Configure Supabase Auth custom SMTP over TLS from a dedicated domain with SPF, DKIM and DMARC (`p=quarantine` or stricter). The DNS part is infrastructure.
- Never put balances, full account or card numbers, or reset tokens in plain text beyond the one-time link.
- Strip CR/LF from anything that goes into headers, and use React-based templates (see T1144).
- Honor marketing consent (T604) for any non-transactional email.

**Success Criteria:**
- [ ] SPF, DKIM and DMARC all pass for the sending domain
- [ ] Email bodies contain no sensitive financial data
- [ ] Header-injection inputs are rejected

**Status:** Applied

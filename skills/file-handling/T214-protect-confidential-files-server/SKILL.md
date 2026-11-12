---
name: t214-protect-confidential-files-on-server
description: Enforce minimum access rights on ACME Bank statement files and any uploads, keep untrusted files outside the web root, and neutralize CSV formula injection in exports.
---

# T214: Protect confidential files on operating system or server

**Category:** CODE_FIX
**SD Elements:** [T214](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T214/)
**Priority:** 9

**Spec Context:**
> "Inclua extratos em CSV e PDF" ... "Supabase para [...] arquivos"
> Source: specs/PRD.md, paragraphs 2 and 3

**What the spec implies (naive approach):**
Putting generated statements in `public/` (served from the web root), or accepting support attachments into a world-readable location. CSV exports write transaction descriptions verbatim, so a value like `=HYPERLINK(...)` executes in Excel.

**Secure Implementation Pattern:**
```ts
// src/services/statements.service.ts - CSV with formula-injection protection
const esc = (v: string) => {
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;           // neutralize formulas
  return `"${s.replace(/"/g, '""')}"`;
};
const csv = ["Date,Description,Amount"].concat(
  rows.map(r => [r.booked_at, r.description, (r.amount_cents / 100).toFixed(2)].map(String).map(esc).join(","))
).join("\r\n");
// Response headers for downloads
headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="statement-${period}.csv"`,
           "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" }
```

**Implementation Guidance:**
- Never write confidential files under `public/` or the build output.
- Put uploads (if support attachments are added) in a private bucket, with type and size validation.
- Escape CSV cells, and send `attachment` disposition plus `nosniff`.

**Success Criteria:**
- [ ] No confidential files are reachable without authentication
- [ ] A description like `=1+1` exports as a literal string
- [ ] Downloads send `Cache-Control: no-store`

**Status:** Applied

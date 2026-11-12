---
name: t295-avoid-unencrypted-confidential-data-without-acl
description: Store ACME Bank statements (CSV/PDF) and any confidential files only in private Supabase Storage buckets with owner-scoped policies; never in public buckets or shared temp locations.
---

# T295: Avoid storing unencrypted confidential data without access control mechanisms

**Category:** CODE_FIX
**SD Elements:** [T295](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T295/)
**Priority:** 7

**Spec Context:**
> "Supabase para PostgreSQL, login por e-mail e senha, arquivos" ... "Inclua extratos em CSV e PDF"
> Source: specs/PRD.md, paragraphs 2 and 3

**What the spec implies (naive approach):**
A public `statements` bucket so download links "just work", or generated statements written to `/tmp` and served from there.

**Secure Implementation Pattern:**
```sql
insert into storage.buckets (id, name, public) values ('statements', 'statements', false);
create policy "owner reads own statements" on storage.objects for select
  using (bucket_id = 'statements' and (storage.foldername(name))[1] = auth.uid()::text);
-- Writes only by server (service role) during generation; no insert policy for authenticated.
```
```ts
// Generate in memory and upload; do not persist to shared disk
const buf = await renderStatementPdf(rows);
await adminClient().storage.from("statements").upload(`${userId}/${statementId}.pdf`, buf,
  { contentType: "application/pdf", upsert: false });
```

**Implementation Guidance:**
- Keep buckets private. Serve files only through short-lived signed URLs (T50).
- Generate files in memory. If temp files can't be avoided, delete them in `finally`.
- Supabase Storage encrypts at rest. Access control is what the app must get right.
- App secrets stay in environment variables, never in files in the repo or bucket.

**Success Criteria:**
- [ ] The `statements` bucket is private, with an owner-only read policy
- [ ] No temp files are left after generation
- [ ] Another customer's statement path returns 403/404

**Status:** Applied

---
name: t50-use-indirect-object-references-for-files
description: Serve ACME Bank CSV/PDF statements via opaque statement IDs mapped server-side to Supabase Storage paths, never via user-supplied file names or paths.
---

# T50: Use indirect object reference maps if accessing files

**Category:** CODE_FIX
**SD Elements:** [T50](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T50/)
**Priority:** 8

**Spec Context:**
> "Inclua extratos em CSV e PDF" ... "Supabase para PostgreSQL, login por e-mail e senha, arquivos e atualizações em tempo real"
> Source: specs/PRD.md, paragraphs 2 and 3

**What the spec implies (naive approach):**
A download link such as `/api/statements?file=customer-12/2026-10.pdf` that passes the path straight to Supabase Storage. That allows path tampering and downloading other customers' statements.

**Secure Implementation Pattern:**
```ts
// src/app/api/statements/[statementId]/route.ts
export async function GET(_: Request, { params }: { params: Promise<{ statementId: string }> }) {
  const { statementId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(statementId)) return new Response("Not found", { status: 404 });
  const { user, supabase } = await authorize("statements/:id", "GET");
  const { data: stmt } = await supabase.from("statements")
    .select("storage_path, format").eq("id", statementId).eq("customer_id", user.id).single();
  if (!stmt) return new Response("Not found", { status: 404 });
  const { data } = await supabase.storage.from("statements").createSignedUrl(stmt.storage_path, 60);
  return Response.redirect(data!.signedUrl, 303);
}
```

**Implementation Guidance:**
- Store statements under server-generated paths (`{customer_uuid}/{statement_uuid}.pdf`). The client only ever sees `statement_uuid`.
- Look up the storage path in the DB with an ownership filter. Never build paths from user input.
- Keep the `statements` bucket private, with Storage RLS limited to the owner. Hand out short-lived signed URLs (60 seconds or less).

**Success Criteria:**
- [ ] No API accepts a file name or path from the client
- [ ] The statements bucket is private, with owner-only Storage policies
- [ ] Signed URLs expire within 60 seconds

**Status:** Applied

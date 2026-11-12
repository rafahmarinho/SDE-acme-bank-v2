---
name: t742-ensure-accuracy-of-personal-information
description: Give ACME Bank customers a self-service profile to correct their personal data, validate all fields, keep a single source of truth, and prevent duplicate customer records.
---

# T742: Implement technical measures to ensure the accuracy of personal information

**Category:** CODE_FIX
**SD Elements:** [T742](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T742/)
**Priority:** 7

**Spec Context:**
> "Inclua login, recuperação de senha, perfil, configurações" ... "Crie páginas de abertura de conta"
> Source: specs/PRD.md, paragraphs 2 and 3

**What the spec implies (naive approach):**
A read-only profile page, with personal data copied into several tables (accounts, beneficiaries, support tickets) that drift out of sync. Account opening allows duplicate customers with the same email or national ID.

**Secure Implementation Pattern:**
```ts
// src/app/(app)/profile/actions.ts
const ProfileUpdate = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().regex(/^\+?[0-9 ()-]{7,20}$/),
  address_line1: z.string().max(200), city: z.string().max(100), postal_code: z.string().max(20),
});
export async function updateProfile(form: FormData) {
  "use server";
  const { user, supabase } = await authorize("profile", "PATCH");
  const data = ProfileUpdate.parse(Object.fromEntries(form));
  await supabase.from("profiles").update(data).eq("id", user.id);   // single source of truth
}
```
```sql
create unique index profiles_email_uniq on public.profiles (lower(email));
-- Other tables reference profiles.id; never duplicate name/address columns.
```

**Implementation Guidance:**
- Keep `profiles` as the only place personal data lives. Other tables reference it by foreign key.
- Validate every field, client-side for UX and server-side as the authority.
- Add unique constraints so account opening can't create duplicate customers.
- Log profile changes to the audit trail (see skills/logging-audit).

**Success Criteria:**
- [ ] Customers can view and correct their own profile data
- [ ] Personal data isn't duplicated across tables
- [ ] Duplicate account opening is rejected

**Status:** Pending

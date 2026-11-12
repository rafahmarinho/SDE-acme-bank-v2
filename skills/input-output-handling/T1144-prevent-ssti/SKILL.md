---
name: t1144-prevent-server-side-template-injection
description: Keep user data out of template source when ACME Bank renders PDF statements and transactional emails; pass it only as escaped template variables.
---

# T1144: Prevent Server-Side Template Injection (SSTI)

**Category:** CODE_FIX
**SD Elements:** [T1144](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T1144/)
**Priority:** 8

**Spec Context:**
> "Inclua extratos em CSV e PDF" ... "recuperação de senha"
> Source: specs/PRD.md, paragraphs 2 and 3

**What the spec implies (naive approach):**
Building the PDF statement or email HTML by concatenating user-controlled values (account nickname, transaction description) into a template string that is then compiled by a template engine such as Handlebars or EJS.

**Secure Implementation Pattern:**
```tsx
// src/services/statements.service.ts - render the PDF with React components (no template compilation)
import { renderToBuffer, Document, Page, Text } from "@react-pdf/renderer";
const StatementPdf = ({ rows }: { rows: Row[] }) => (
  <Document><Page>{rows.map(r => <Text key={r.id}>{r.description} {formatCents(r.amount_cents)}</Text>)}</Page></Document>
);
const pdf = await renderToBuffer(<StatementPdf rows={rows} />);   // data passed as props, never as template source

// If a template engine is used for emails: precompile static templates at build time,
// pass data as context only, and keep auto-escaping on.
```

**Implementation Guidance:**
- Never compile templates from strings that contain user or DB data.
- Prefer React components (`@react-pdf/renderer`, `react-email`) where data is passed as props.
- Validate and length-limit descriptions and nicknames before storing them.

**Success Criteria:**
- [ ] No runtime template compilation of dynamic strings
- [ ] A description like `{{7*7}}` / `<%= 7*7 %>` appears literally in PDFs and emails

**Status:** Pending

---
name: t42-avoid-untrusted-data-for-server-side-selection
description: Map ACME Bank simulation scenarios, statement formats and view selections from user input through strict allow-lists instead of using input to pick files, modules or templates.
---

# T42: Avoid relying on untrusted data for server-side selection

**Category:** CODE_FIX
**SD Elements:** [T42](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T42/)
**Priority:** 10

**Spec Context:**
> "Inclua uma área para escolher cenários, avançar a simulação, consultar eventos e reiniciar os dados." ... "extratos em CSV e PDF"
> Source: specs/PRD.md, paragraphs 3 and 5

**What the spec implies (naive approach):**
`import(\`@/scenarios/${req.scenario}\`)` or reading `scenarios/${name}.json` from disk based on the request. Choosing an exporter by `format` without validation. Using an unbounded "advance N days" value as a loop counter.

**Secure Implementation Pattern:**
```ts
// src/services/simulation.service.ts
import { purchases, deposits, insufficientFunds, pendingTransfers } from "./scenarios";
const SCENARIOS = { purchases, deposits, "insufficient-funds": insufficientFunds, "pending-transfers": pendingTransfers } as const;
const Input = z.object({
  scenario: z.enum(Object.keys(SCENARIOS) as [keyof typeof SCENARIOS]),
  advanceDays: z.number().int().min(1).max(31),           // bounded loop counter
});
export async function runScenario(raw: unknown) {
  const { scenario, advanceDays } = Input.parse(raw);
  return SCENARIOS[scenario].run({ days: advanceDays });
}
const EXPORTERS = { csv: toCsv, pdf: toPdf } as const;   // format allow-list
```

**Implementation Guidance:**
- Use enum allow-lists for scenarios, formats, sort columns and tabs.
- Bound numeric inputs that drive loops or resource allocation (advance days, export ranges).
- Never build file paths or dynamic imports from input.

**Success Criteria:**
- [ ] No dynamic `import()` or file read uses request data
- [ ] Unknown scenarios and formats are rejected with 400
- [ ] `advanceDays` is bounded

**Status:** Pending

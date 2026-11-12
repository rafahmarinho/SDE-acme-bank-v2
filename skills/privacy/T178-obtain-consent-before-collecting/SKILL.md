---
name: t178-obtain-consent-prior-to-collecting-personal-info
description: Collect explicit, separate, granular consent during ACME Bank's simulated account opening, with clear purpose statements and required/optional field markers.
---

# T178: Obtain consent from users prior to collecting personal information

**Category:** CODE_FIX
**SD Elements:** [T178](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T178/)
**Priority:** 10

**Spec Context:**
> "Crie páginas de abertura de conta [...] O cliente deve conseguir abrir uma conta simulada"
> Source: specs/PRD.md, paragraph 3

**What the spec implies (naive approach):**
A multi-step account-opening form that collects name, date of birth, address and phone, with one "I accept the terms" checkbox bundling all purposes, pre-checked.

**Secure Implementation Pattern:**
```tsx
// src/app/(auth)/open-account/consent-step.tsx
<form action={submitConsent}>
  <p>We use your name, date of birth and address to open and operate your account (required).</p>
  <Checkbox name="terms" required /> <Label>I agree to the Terms of Service (summary + full text link)</Label>
  <Checkbox name="privacy_notice" required /> <Label>I have read the Privacy Notice</Label>
  <Checkbox name="marketing_email" /> <Label>Send me product news by email (optional)</Label>
</form>
// Server action stores consents (see T604 tables) with timestamp and notice version BEFORE saving profile data.
```

**Implementation Guidance:**
- Keep the consent step separate from the Terms of Service, and leave every optional checkbox unchecked by default.
- Mark required and optional fields, and explain each field's purpose in a tooltip.
- Record consent along with the privacy-notice version and a timestamp.
- Don't store any personal data before the required consents are recorded.

**Success Criteria:**
- [ ] Account opening shows separate, unbundled consents
- [ ] Optional consents default to off
- [ ] Each consent record includes the notice version and a timestamp

**Status:** Pending

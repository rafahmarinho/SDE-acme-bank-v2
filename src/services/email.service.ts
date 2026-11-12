/**
 * Transactional email.
 *
 * - Auth emails (confirmation, password recovery) are sent by Supabase Auth through custom SMTP over
 *   TLS (supabase/config.toml [auth.email.smtp]) from a domain with SPF, DKIM and DMARC p=quarantine+.
 * - Security notices are SIMULATED in this app (integrations are simulated per the PRD): they are
 *   recorded as audit events instead of being sent. Swap `deliver()` for a real provider later; the
 *   guards below stay the same.
 * - Bodies never contain balances, full account/card numbers or tokens - only a link to sign in.
 * - Subjects/recipients are validated (no CR/LF header injection). Templates are static strings with
 *   no user-controlled content.
 * - Optional (non-transactional) emails require consent and no processing restriction.
 */
import "server-only";
import { z } from "zod";
import { publicEnv } from "@/lib/env.public";
import { adminClient } from "@/lib/supabase/admin";
import { assertProcessingAllowed, ProcessingRestrictedError } from "@/services/privacy.service";

const HeaderSafe = z.string().max(254).refine((s) => !/[\r\n]/.test(s), "header injection");
const Recipient = z.string().email().max(254).pipe(HeaderSafe);

const TEMPLATES = {
  password_changed: {
    subject: "Your ACME Bank password was changed",
    text: (siteUrl: string) =>
      `Your ACME Bank password was just changed. If this was not you, reset your password at ${siteUrl}/forgot-password and contact Support.`,
  },
  new_login: {
    subject: "New sign-in to ACME Bank",
    text: (siteUrl: string) => `We noticed a new sign-in to your ACME Bank account. Review your security settings at ${siteUrl}/settings.`,
  },
} as const;

export type SecurityNotice = keyof typeof TEMPLATES;

async function deliver(to: string, subject: string, text: string) {
  // Simulated delivery: record metadata only (no body, no address) for the audit trail.
  await adminClient().rpc("audit_event", {
    p_event: "email_simulated",
    p_details: { subject: HeaderSafe.parse(subject), length: text.length, domain: to.split("@")[1] },
  });
}

/** Transactional security notice - always sent (not subject to marketing consent). */
export async function sendSecurityNotice(to: string, kind: SecurityNotice) {
  const recipient = Recipient.parse(to);
  const tpl = TEMPLATES[kind];
  await deliver(recipient, tpl.subject, tpl.text(publicEnv.siteUrl));
}

/** Optional marketing email - only with consent and without a processing restriction. */
export async function sendMarketingEmail(userId: string, to: string, subject: string, text: string) {
  try {
    await assertProcessingAllowed(userId, "marketing_email");
  } catch (err) {
    if (err instanceof ProcessingRestrictedError) return { sent: false as const };
    throw err;
  }
  await deliver(Recipient.parse(to), HeaderSafe.parse(subject), text.slice(0, 5000));
  return { sent: true as const };
}

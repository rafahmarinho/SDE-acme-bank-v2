<!-- SDE-SECURITY-HARDENING-START -->
## Security Hardening Execution Contract

## Project Overview
| Property | Value |
|----------|-------|
| Application | acme-bank-v2 |
| SD Elements Project | [ACME Bank v2](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/) |
| Project ID | 31 |
| Risk Policy | On-Boarding Policy (ID 1) |
| Total Countermeasures | 57 (51 file-tracked + 6 PROCESS) |
| Source | Spec files (specs/PRD.md) |

This repository is a **placeholder scaffold**. Implement each feature described in `specs/PRD.md` by following the task recipe linked below. Each recipe quotes the spec text it applies to, describes the naive approach to avoid, and gives the secure pattern.

## Countermeasure Summary by Category

| Category | Count | Description |
|----------|-------|-------------|
| CODE_FIX | 48 | Secure implementation needed in application code |
| INFRA | 3 | External infrastructure (Supabase / Vercel platform configuration) |
| **FILE-TRACKED TOTAL** | **51** | Countermeasures with local skill files |

> **The 6 PROCESS countermeasures (T1386, T2348, T2128, CT1, CT2, T755) are noted in SD Elements only and aren't tracked locally.**

## Skill Files

| Domain | Countermeasures |
|--------|----------------|
| authentication | 3 |
| session-management | 2 |
| authorization | 4 |
| data-access | 4 |
| api-security | 5 |
| input-output-handling | 4 |
| web-client-security | 4 |
| crypto-randomness | 3 |
| secrets-config | 2 |
| transport-security | 3 |
| privacy | 6 |
| file-handling | 2 |
| logging-audit | 2 |
| messaging | 1 |
| supply-chain | 2 |
| release-hardening | 1 |
| infrastructure | 3 |

### authentication
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T2 | Secure the password reset mechanism | [skills/authentication/T2-secure-password-reset/SKILL.md](./skills/authentication/T2-secure-password-reset/SKILL.md) | 9 | CODE_FIX | Pending |
| T70 | Implement account lockout or authentication throttling for system accounts | [skills/authentication/T70-account-lockout-auth-throttling/SKILL.md](./skills/authentication/T70-account-lockout-auth-throttling/SKILL.md) | 8 | CODE_FIX | Pending |
| T338 | Control access to resources through user authentication and authorization | [skills/authentication/T338-control-access-authn-authz/SKILL.md](./skills/authentication/T338-control-access-authn-authz/SKILL.md) | 7 | CODE_FIX | Pending |

### session-management
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T20 | Generate unique session IDs and reset old IDs after authentication | [skills/session-management/T20-unique-session-ids/SKILL.md](./skills/session-management/T20-unique-session-ids/SKILL.md) | 9 | CODE_FIX | Pending |
| T1539 | Clear browser data on user logout | [skills/session-management/T1539-clear-browser-data-on-logout/SKILL.md](./skills/session-management/T1539-clear-browser-data-on-logout/SKILL.md) | 8 | CODE_FIX | Pending |

### authorization
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T184 | Perform authorization checks on RESTful web services | [skills/authorization/T184-authz-checks-restful-services/SKILL.md](./skills/authorization/T184-authz-checks-restful-services/SKILL.md) | 9 | CODE_FIX | Pending |
| T17 | Do not only rely on client-side authorization | [skills/authorization/T17-no-client-side-only-authz/SKILL.md](./skills/authorization/T17-no-client-side-only-authz/SKILL.md) | 8 | CODE_FIX | Pending |
| T378 | Authorize every request for data objects | [skills/authorization/T378-authorize-every-data-object-request/SKILL.md](./skills/authorization/T378-authorize-every-data-object-request/SKILL.md) | 8 | CODE_FIX | Pending |
| T50 | Use indirect object reference maps if accessing files | [skills/authorization/T50-indirect-object-references-files/SKILL.md](./skills/authorization/T50-indirect-object-references-files/SKILL.md) | 8 | CODE_FIX | Pending |

### data-access
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T38 | Bind variables in SQL statements | [skills/data-access/T38-bind-variables-sql/SKILL.md](./skills/data-access/T38-bind-variables-sql/SKILL.md) | 10 | CODE_FIX | Pending |
| T19 | Restrict Application's Access to Database | [skills/data-access/T19-restrict-app-db-access/SKILL.md](./skills/data-access/T19-restrict-app-db-access/SKILL.md) | 8 | CODE_FIX | Pending |
| T2598 | Implement query-level access control | [skills/data-access/T2598-query-level-access-control/SKILL.md](./skills/data-access/T2598-query-level-access-control/SKILL.md) | 8 | CODE_FIX | Pending |
| T2600 | Control the result set size returned by a query | [skills/data-access/T2600-control-result-set-size/SKILL.md](./skills/data-access/T2600-control-result-set-size/SKILL.md) | 7 | CODE_FIX | Pending |

### api-security
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T1362 | Perform message throttling in Web APIs | [skills/api-security/T1362-message-throttling-web-apis/SKILL.md](./skills/api-security/T1362-message-throttling-web-apis/SKILL.md) | 8 | CODE_FIX | Pending |
| T1365 | Mitigate Server Side Request Forgery | [skills/api-security/T1365-mitigate-ssrf/SKILL.md](./skills/api-security/T1365-mitigate-ssrf/SKILL.md) | 8 | CODE_FIX | Pending |
| T2139 | Prevent information exposure through APIs | [skills/api-security/T2139-prevent-info-exposure-apis/SKILL.md](./skills/api-security/T2139-prevent-info-exposure-apis/SKILL.md) | 7 | CODE_FIX | Pending |
| T536 | Restrict the size of incoming messages in services | [skills/api-security/T536-restrict-incoming-message-size/SKILL.md](./skills/api-security/T536-restrict-incoming-message-size/SKILL.md) | 8 | CODE_FIX | Pending |
| T35 | Fine-tune HTTP server settings | [skills/api-security/T35-fine-tune-http-server-settings/SKILL.md](./skills/api-security/T35-fine-tune-http-server-settings/SKILL.md) | 9 | CODE_FIX | Pending |

### input-output-handling
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T36 | Escape untrusted data in HTML, HTML attributes, CSS, and JavaScript | [skills/input-output-handling/T36-escape-untrusted-data/SKILL.md](./skills/input-output-handling/T36-escape-untrusted-data/SKILL.md) | 8 | CODE_FIX | Pending |
| T37 | Avoid DOM-based Cross-Site Scripting (XSS) | [skills/input-output-handling/T37-avoid-dom-based-xss/SKILL.md](./skills/input-output-handling/T37-avoid-dom-based-xss/SKILL.md) | 8 | CODE_FIX | Pending |
| T1144 | Prevent Server-Side Template Injection (SSTI) | [skills/input-output-handling/T1144-prevent-ssti/SKILL.md](./skills/input-output-handling/T1144-prevent-ssti/SKILL.md) | 8 | CODE_FIX | Pending |
| T42 | Avoid relying on untrusted data for server-side selection | [skills/input-output-handling/T42-no-untrusted-server-side-selection/SKILL.md](./skills/input-output-handling/T42-no-untrusted-server-side-selection/SKILL.md) | 10 | CODE_FIX | Pending |

### web-client-security
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T29 | Use anti-Cross-Site Request Forgery (CSRF) tokens | [skills/web-client-security/T29-anti-csrf-tokens/SKILL.md](./skills/web-client-security/T29-anti-csrf-tokens/SKILL.md) | 7 | CODE_FIX | Pending |
| T257 | Secure cross origin resource sharing (CORS) | [skills/web-client-security/T257-secure-cors/SKILL.md](./skills/web-client-security/T257-secure-cors/SKILL.md) | 8 | CODE_FIX | Pending |
| T66 | Prevent web pages from being loaded inside iFrame | [skills/web-client-security/T66-prevent-iframe-loading/SKILL.md](./skills/web-client-security/T66-prevent-iframe-loading/SKILL.md) | 7 | CODE_FIX | Pending |
| T1468 | Encrypt sensitive data at rest in the browser | [skills/web-client-security/T1468-encrypt-browser-data-at-rest/SKILL.md](./skills/web-client-security/T1468-encrypt-browser-data-at-rest/SKILL.md) | 9 | CODE_FIX | Pending |

### crypto-randomness
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T151 | Use cryptographically secure random numbers | [skills/crypto-randomness/T151-cryptographically-secure-random/SKILL.md](./skills/crypto-randomness/T151-cryptographically-secure-random/SKILL.md) | 7 | CODE_FIX | Pending |
| T60 | Use correct and approved cryptographic algorithms, parameters, and key lengths | [skills/crypto-randomness/T60-approved-crypto-algorithms/SKILL.md](./skills/crypto-randomness/T60-approved-crypto-algorithms/SKILL.md) | 8 | CODE_FIX | Pending |
| T59 | Use standard libraries for cryptography | [skills/crypto-randomness/T59-standard-crypto-libraries/SKILL.md](./skills/crypto-randomness/T59-standard-crypto-libraries/SKILL.md) | 8 | CODE_FIX | Pending |

### secrets-config
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T76 | Do not hardcode passwords | [skills/secrets-config/T76-do-not-hardcode-passwords/SKILL.md](./skills/secrets-config/T76-do-not-hardcode-passwords/SKILL.md) | 10 | CODE_FIX | Pending |
| T2599 | Protect against connection string parameter pollution | [skills/secrets-config/T2599-connection-string-pollution/SKILL.md](./skills/secrets-config/T2599-connection-string-pollution/SKILL.md) | 9 | CODE_FIX | Pending |

### transport-security
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T21 | Ensure all data in transit is encrypted using a secure TLS channel | [skills/transport-security/T21-tls-for-data-in-transit/SKILL.md](./skills/transport-security/T21-tls-for-data-in-transit/SKILL.md) | 8 | CODE_FIX | Pending |
| T156 | Validate certificate and its chain of trust properly | [skills/transport-security/T156-validate-certificate-chain/SKILL.md](./skills/transport-security/T156-validate-certificate-chain/SKILL.md) | 7 | CODE_FIX | Pending |
| T558 | Authenticate all other components before any network communication with them | [skills/transport-security/T558-authenticate-components-network/SKILL.md](./skills/transport-security/T558-authenticate-components-network/SKILL.md) | 9 | CODE_FIX | Pending |

### privacy
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T742 | Implement technical measures to ensure the accuracy of personal information | [skills/privacy/T742-accuracy-of-personal-information/SKILL.md](./skills/privacy/T742-accuracy-of-personal-information/SKILL.md) | 7 | CODE_FIX | Pending |
| T604 | Implement a consent withdrawal mechanism | [skills/privacy/T604-consent-withdrawal-mechanism/SKILL.md](./skills/privacy/T604-consent-withdrawal-mechanism/SKILL.md) | 10 | CODE_FIX | Pending |
| T178 | Obtain consent from users prior to collecting personal information | [skills/privacy/T178-obtain-consent-before-collecting/SKILL.md](./skills/privacy/T178-obtain-consent-before-collecting/SKILL.md) | 10 | CODE_FIX | Pending |
| T754 | Enable the restriction of processing personal information of an individual for a specific purpose | [skills/privacy/T754-restrict-processing-personal-info/SKILL.md](./skills/privacy/T754-restrict-processing-personal-info/SKILL.md) | 8 | CODE_FIX | Pending |
| T544 | Anonymize (de-identify) identifying information before using it for a secondary purpose | [skills/privacy/T544-anonymize-for-secondary-purpose/SKILL.md](./skills/privacy/T544-anonymize-for-secondary-purpose/SKILL.md) | 8 | CODE_FIX | Pending |
| T744 | Protect pseudonymized personal information | [skills/privacy/T744-protect-pseudonymized-info/SKILL.md](./skills/privacy/T744-protect-pseudonymized-info/SKILL.md) | 8 | CODE_FIX | Pending |

### file-handling
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T295 | Avoid storing unencrypted confidential data without access control mechanisms | [skills/file-handling/T295-no-unencrypted-confidential-storage/SKILL.md](./skills/file-handling/T295-no-unencrypted-confidential-storage/SKILL.md) | 7 | CODE_FIX | Pending |
| T214 | Protect confidential files on operating system or server | [skills/file-handling/T214-protect-confidential-files-server/SKILL.md](./skills/file-handling/T214-protect-confidential-files-server/SKILL.md) | 9 | CODE_FIX | Pending |

### logging-audit
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T2602 | Log typical database and server activities and related metadata | [skills/logging-audit/T2602-log-db-and-server-activity/SKILL.md](./skills/logging-audit/T2602-log-db-and-server-activity/SKILL.md) | 8 | CODE_FIX | Pending |
| T349 | Protect audit information and logs against unauthorized access | [skills/logging-audit/T349-protect-audit-logs/SKILL.md](./skills/logging-audit/T349-protect-audit-logs/SKILL.md) | 7 | CODE_FIX | Pending |

### messaging
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T2157 | Secure email and messaging in web applications | [skills/messaging/T2157-secure-email-messaging/SKILL.md](./skills/messaging/T2157-secure-email-messaging/SKILL.md) | 7 | CODE_FIX | Pending |

### supply-chain
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T327 | Review security of Node.js modules before installation | [skills/supply-chain/T327-review-nodejs-modules/SKILL.md](./skills/supply-chain/T327-review-nodejs-modules/SKILL.md) | 10 | CODE_FIX | Pending |
| T186 | Use recommended settings and the latest patches for third party libraries and software | [skills/supply-chain/T186-latest-patches-third-party/SKILL.md](./skills/supply-chain/T186-latest-patches-third-party/SKILL.md) | 10 | CODE_FIX | Pending |

### release-hardening
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T49 | Disable and remove debug capabilities and code/data, and prepare application for release | [skills/release-hardening/T49-disable-debug-prepare-release/SKILL.md](./skills/release-hardening/T49-disable-debug-prepare-release/SKILL.md) | 7 | CODE_FIX | Pending |

### infrastructure
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T2170 | Ensure that personal information processed by the application meets data localization requirements | [skills/infrastructure/T2170-data-localization/SKILL.md](./skills/infrastructure/T2170-data-localization/SKILL.md) | 9 | INFRA | Documented |
| T374 | Offload HTTP request handling to dedicated modules | [skills/infrastructure/T374-offload-http-request-handling/SKILL.md](./skills/infrastructure/T374-offload-http-request-handling/SKILL.md) | 7 | INFRA | Documented |
| T69 | Strong password requirements for server-to-server system accounts | [skills/infrastructure/T69-strong-server-to-server-credentials/SKILL.md](./skills/infrastructure/T69-strong-server-to-server-credentials/SKILL.md) | 8 | INFRA | Documented |

## Completion Requirements

**All 51 file-tracked countermeasures must be addressed. No exceptions.**

## Progress Tracking

| Domain | Total | Implemented | Documented | Remaining |
|--------|-------|-------------|------------|-----------|
| authentication | 3 | 0 | 0 | 3 |
| session-management | 2 | 0 | 0 | 2 |
| authorization | 4 | 0 | 0 | 4 |
| data-access | 4 | 0 | 0 | 4 |
| api-security | 5 | 0 | 0 | 5 |
| input-output-handling | 4 | 0 | 0 | 4 |
| web-client-security | 4 | 0 | 0 | 4 |
| crypto-randomness | 3 | 0 | 0 | 3 |
| secrets-config | 2 | 0 | 0 | 2 |
| transport-security | 3 | 0 | 0 | 3 |
| privacy | 6 | 0 | 0 | 6 |
| file-handling | 2 | 0 | 0 | 2 |
| logging-audit | 2 | 0 | 0 | 2 |
| messaging | 1 | 0 | 0 | 1 |
| supply-chain | 2 | 0 | 0 | 2 |
| release-hardening | 1 | 0 | 0 | 1 |
| infrastructure | 3 | 0 | 3 | 0 |
| **TOTAL** | **51** | **0** | **3** | **48** |

**Remaining must reach 0 before the work is complete.**

## Verification Checklist

- [ ] All CODE_FIX countermeasures have secure implementations
- [ ] All non-code items documented with justification
- [ ] Total addressed = 51
<!-- SDE-SECURITY-HARDENING-END -->

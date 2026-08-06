# Phila - Data Protection Impact Assessment (DPIA)

*POPIA-oriented high-risk-processing assessment for Phila (the operator/processor).
Living document - review at every material processing change and before first real-client onboarding.
Confirm with a POPIA-literate advisor before launch (Phase 31 honest constraint).*

## 1. Processing overview
| | |
|---|---|
| **Controller (responsible party)** | Each counselling organisation on the platform |
| **Operator (processor)** | Phila (philasa.com) |
| **Data subjects** | Clients of counselling orgs, org staff, funder contacts |
| **Special personal information** | Health/clinical records (session notes, outcomes), demographics (gender, population group), consent records |
| **Lawful basis** | Client consent (purpose-bound, versioned, revocable in-app) + HPCSA record-keeping obligations |

## 2. High-risk processing identified & mitigations (all implemented)
| Risk | Mitigation (in code) |
|---|---|
| Cross-tenant leakage | Postgres RLS (`phila_app` non-owner role, deny-by-default) + isolation tests (`rls.test.ts`, `rls-scoped.test.ts`) |
| Clinical-note exposure | Author+supervisor-only access; hub override is fail-strict audited; notes never in cross-role payloads (31.6 sweep) |
| Funder re-identification | k-anonymity floor (5) + small-cell suppression on every aggregate; payload-level PII sweep in CI |
| Unlogged access/export | Fail-strict audit class: `note.read`, `demographics.read`, `pii.export`, `dsar.export`, `dsar.erase` - access refused if the audit write fails |
| Cross-border transfer | Sub-processor register (`lib/compliance/subprocessors.ts`) with per-provider s72 basis; AI is de-identified + consent-gated + ZDR; WhatsApp is client-chosen channel |
| Over-retention / premature destruction | Computed HPCSA clocks (`lib/compliance/retention.ts`); report-only pruner requiring explicit platform enable; legal holds |
| Breach response | s22 breach register (`/admin/compliance`) + affected-subject derivation + drafted notice |
| Special-category at rest | AES-256-GCM field encryption (`PHILA_FIELD_KEY`); encrypted integration credentials |

## 3. Residual risks (tracked)
- **Data residency**: Postgres currently EU-region; SA-region migration is gated to first-real-client onboarding (Phase 19). Storage/AI residency documented in the sub-processor register.
- **HPCSA retention numbers**: encoded in one file (`lib/compliance/retention.ts`) pending advisor confirmation.
- **Shared-store rate limiting** on public endpoints (Upstash) remains a Phase 19 item; per-IP in-memory damping is in place.

## 4. Sign-off
| Role | Name | Date |
|---|---|---|
| Information Officer (Phila) | *(to appoint & register)* | |
| POPIA advisor review | *(pending)* | |

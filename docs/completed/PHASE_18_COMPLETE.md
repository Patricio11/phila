# Phase 18  Document System (Hub-first, Supabase-backed) ✅

*Shipped: 2026-06-30 · Part B · real file storage + the org's document workspace, made real and beautiful*

> A counselling practice lives on paper  ID copies, referrals, assessments, consent forms, reports. Phase 18
> gives the Hub a calm place to **organise** it in folders, **assign** to a client, **share** with a counsellor,
> and **request** exactly what a client should upload  every file resting in Phila's own private, in-region,
> signed-URL-only, audited Supabase store. Documents are *shared* artifacts, deliberately distinct from the
> private `session_notes` (Rule #1); a per-document **visibility** flag keeps finance/front-desk out of clinical files.

---

## Real, not mock
Five tables (`document_folders`, generalized `documents`, `document_requests`, `document_shares`,
`org_storage_usage`)  all **RLS-scoped** off `app_current_org()`, seeded for Masizakhe, migration `0021`; the
legacy `client_documents` rows were **backfilled** into `documents` so the existing `/me/documents` read kept
working through the change. Reads/writes live in `db/queries/documents.ts`; the provider seam exposes them (mock
+ db), and the client dossier's documents read moved to the DB in the same pass.

## Three honest access lanes
- **The org (Hub) owns + organises**  full reach: create folders, upload, move, assign, share, request, delete.
- **A counsellor sees own-clients ∪ shared-with-them**  `listCounsellorDocuments` (own clients' files +
  `document_shares`, folder shares cascading), never the whole org tree.
- **A client sees only what's assigned + uploads only against a request**  no unsolicited uploads, no open browser.

RLS enforces `org_id` at the DB; the DAL + select-lists enforce **visibility** (`client_visible|internal|clinical`)
and the lane rules; the route guard renders honest blocked states. Three layers, per `SECURITY.md`. Every action
(upload · sign-download · move · assign · share · request · delete) is `logAccess()`-audited.

## Phila Storage (Supabase), real and dormant-by-default
`lib/storage/*`  a `StorageProvider` seam over Supabase REST: **presigned direct upload** (never proxy bytes
through a Server Action), short-TTL **signed download** (clean files only), delete, test-connection. Private bucket
+ service-role key **server-only**, resolved from **encrypted** `platform_integrations` config, **off until
switched on** via the admin **Phila Storage** card (`/admin/integrations`: configure → Test → switch). **S3 is a
later drop-in behind the same interface**  no bypass. Upload flow: `requestUpload` (validate role/lane/quota/
content-type/size) → **presigned PUT straight to Supabase** → `confirmUpload` (finalize, update usage).

## The Hub document manager (`/hub/documents`)  the beautiful part
- **Two-pane** workspace: folder **tree** + file **grid/list** + breadcrumbs; **drag-to-move** (drop-target glow,
  optimistic + reconciled); multi-select **floating action bar**; inline rename. GPU-cheap motion, reduced-motion
  aware, 360px-first, light/dark.
- **Smart views** beside real folders: All documents · **Needs review** (client uploads, badged) · By client 
  computed from row fields (no duplication).
- **Assign to client**, **Share file/folder with a counsellor** (`document_shares`), **Request a document** 
  all Zod + audited + org-scoped.

## Requests + notifications + client side
- **Document requests** gate every client upload: the Hub creates a request; the client portal's "Requested from
  you" uploads **against** it; fulfilment flips `pending → fulfilled` and links the document.
- **Two Phase-12 triggers** through the `deliver` chokepoint (consent / opt-out / quiet-hours / credits honoured;
  dormant never fakes a send; hub-editable): `document_shared` (org → client) and `client_uploaded_document`
  (→ practice email).
- **`/me/documents` made real:** "Requested from you" (request-bound presigned upload) + "Your documents"
  (client-visible files, real **signed-URL download**); the old optimistic-only upload button is gone; every
  access audited.

## Proof
- Slices 18.1–18.4 shipped green (tsc · lint · build · unit/integration); foundations at commit `0b9395e`.
- Integration coverage: assign-to-client makes a doc client-visible; request → fulfil; counsellor lane
  (own ∪ shared, deduped); the **scan gate** (a pending file is never client-visible); metadata-only move.

## Honest follow-ups (deferred, documented  not forgotten)
- **Upload safety hardening** *(the one `[~]`)*: the `scan_status: pending → clean | quarantined` **gate** ships
  with a **swappable scanner hook** (`lib/documents/scan.ts`), but the **real AV scanner** (ClamAV/hosted),
  **magic-byte sniff**, and **per-user upload rate limit** are Phase-19 hardening items. Files are gated, not yet
  virus-scanned.
- **Buy-more-storage top-up** (recurring add-on, 15A pattern)  the per-plan cap + `storageGb` entitlement ship now.
- **Dossier Documents-card going live** (request/assign/share without leaving the client) and a **richer in-app
  notification feed** (the "Needs review" view already surfaces client uploads).
- Thumbnails / in-browser preview / versioning / e-sign  future enhancements.

*Phila · philasa.com · Phase 18 · Document System · Supabase-backed, POPIA-safe*

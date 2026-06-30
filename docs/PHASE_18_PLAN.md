# PHASE 18 PLAN  Document System (Hub-first, Supabase-backed)

*The org's document workspace, made real and made beautiful. A counselling practice lives on paper  ID copies,
referral letters, assessments, consent forms, reports, programme paperwork. Phase 18 gives the Hub a calm, smooth
place to **organise** all of it in folders, **assign** documents to a client, **share** files or folders with a
counsellor, and **request** exactly the documents a client should upload  with every file resting in Phila's own
private, in-region, scanned, audited Supabase store.*

> Read with `ROADMAP.md` §18, `TO_START_EVERY_SESSION.md` (rules + stack), `DESIGN.md` (the approved system +
> motion), `SECURITY.md` (the three-layer model + RLS), and `docs/completed/PHASE_12_COMPLETE.md` (the notify
> chokepoint we reuse). Stack: Next 16 · Supabase Storage · Drizzle · Neon Postgres · Better Auth.
>
> **This is a big one.** It is built to the same bar as the public micro-site (Phase 17): production-grade,
> 360px-first, light/dark, considered motion, zero dead ends. The UX is the point  see §9.

---

## 1. Goal & the three access lanes

One document model, three honest lanes of access. Everything in the build serves these:

- **The org (Hub) owns + organises.** Full reach over every folder and document in the org. Creates folders,
  uploads, moves, assigns to a client, shares with a counsellor, requests documents from a client, deletes.
- **A counsellor sees own-clients + what's shared to them.** Their visible set is *(documents on their own
  clients)* ∪ *(files/folders explicitly shared with them)*  and nothing else. No browsing the whole org tree.
- **A client sees only what's assigned to them, and uploads only against a request.** No unsolicited uploads;
  no open file browser. They see documents the org marked `client_visible` and assigned to them, plus any open
  upload **requests**.

Documents are **shared artifacts**  deliberately distinct from the private `session_notes` (Care-Confidentiality
Rule #1). A per-document **visibility** flag (`client_visible` / `internal` / `clinical`) keeps finance and
front-desk out of clinical files even within the org.

---

## 2. Recheck before starting (what we build on  don't re-plumb)

- **`StorageAdapter` already exists** as a dormant, typed interface (`lib/adapters/types.ts`  `put` /
  `signedUrl`). This phase makes it real for Supabase and adds `signedUploadUrl` / `remove`.
- **`client_documents` exists** (metadata-only, no bytes) and is already read by `/me/documents`
  (`listClientDocuments`, real DB) and the dossier (`getClientDossier`, currently mock-delegated). We **generalize**
  it into `documents`; the dossier read migrates to the DB in the same pass (closes a known mock-delegation gap).
- **Notifications (Phase 12)** give us the deliver chokepoint, `message_log`, the template manager, and the
  trigger pattern. We add two triggers and an in-app notification surface (the shell already has a notifications menu).
- **Plans + entitlements** (`plans` table) hold per-feature limits already  storage GB slots straight in.
- **The integrations console pattern** (`/admin/integrations`: configure → Test → switch on, encrypted creds) is
  exactly how the **platform Supabase Storage** is configured. No env-var keys.
- **Guards / `logAccess` / RLS / soft-delete / Zod Server Actions** are all in place  reuse, don't reinvent.

---

## 3. Guardrails (non-negotiable  the compliance posture)

1. **Phila Storage only.** Every document attached to a client or org rests in Phila's **private Supabase bucket**.
   **No Google Drive, no external store** in this phase  clinical special-category PII never leaves Phila's
   controlled, in-region environment (Rules #1, #6, #7). S3 may be added later **behind the same `StorageProvider`
   seam**, never as a bypass.
2. **Private + signed-only.** Buckets are private; the service-role key is **server-only**; objects are reached
   **only** through short-TTL signed URLs. No public URL, ever.
3. **Scanned before served.** A file is `scan_status: pending` on upload and **not downloadable** until `clean`;
   `quarantined` files are blocked + surfaced to the Hub. Clients uploading arbitrary files is a real malware vector.
4. **Classified + redacted.** `visibility` drives who sees a file. `clinical` → counsellor (own client) +
   supervisor + audited Hub; **never** finance/front-desk. `client_visible` → the assigned client. `internal` →
   org staff per role.
5. **Every action audited.** upload · download (sign) · move · assign · share · request · delete  all
   `logAccess()`. Cross-role/clinical access is a recorded event (Rule #3).
6. **Honest limits.** Over quota → an honest "you've reached your plan's storage" block with the upgrade path,
   never a silent failure (Cost Rule #11). Dormant storage (not configured) → an honest off state, never a fake upload.
7. **Erasable.** Soft-delete + a real object delete on erasure; a client's right-to-erasure removes bytes **and**
   metadata.

---

## 4. The access & redaction model

| Document `visibility` | Client (assigned) | Counsellor (own client / shared) | Supervisor | Hub (org_admin) | Finance / Front-desk |
|---|---|---|---|---|---|
| `client_visible` | ✅ (own) | ✅ | ✅ | ✅ | ✅ (non-clinical) |
| `internal` | ❌ | ✅ (own client / shared) | ✅ | ✅ | ✅ |
| `clinical` | ❌ | ✅ (own client / shared) | ✅ | **audited access** | ❌ |

- A **counsellor's** visible set = documents on their own clients **plus** anything in `document_shares` granted to
  them (a folder share cascades to its contents). Never the whole org tree.
- A **client's** visible set = documents with `visibility = client_visible` **and** `client_id = self`, plus their
  open upload **requests**.
- RLS enforces `org_id` isolation at the DB; the DAL + select-lists enforce `visibility` + the lane rules; the route
  guard renders honest blocked states. Three layers, per `SECURITY.md`.

---

## 5. Data model (Drizzle + migration + RLS + seed)

All tables carry `org_id`, RLS-policied off `app_current_org()` / `app_is_super()` (mirroring `db/rls.sql`), seeded
for Masizakhe, and reflected in `db/seed-all.ts`.

- **`document_folders`**  `id`, `org_id`, `parent_id` (nullable → tree), `name`, `scope`
  (`org` | `client` | `counsellor`), `client_id?` (for a client's folder), `created_by`, `created_at`, `deleted_at`.
- **`documents`** (generalizes `client_documents`)  `id`, `org_id`, `folder_id?`, `client_id?`, `counsellor_id?`,
  `session_id?` (link to an appointment/session), `name`, `kind` (`report|resource|upload|form|id|referral|consent|other`),
  `visibility` (`client_visible|internal|clinical`), `storage_provider` (`supabase`  `s3` later), `storage_key`,
  `content_type`, `bytes`, `checksum`, `scan_status` (`pending|clean|quarantined`), `uploaded_by`, `shared_by`
  (`counsellor|org|client`), `request_id?`, `created_at`, `deleted_at`.
  > Migration keeps the existing `client_documents` rows  rename/extend in place (or view-compat) so seeded data
  > and the current `/me/documents` read keep working through the change.
- **`document_requests`**  `id`, `org_id`, `client_id`, `requested_by`, `title`, `note?`, `status`
  (`pending|fulfilled|cancelled`), `due_at?`, `fulfilled_document_id?`, `created_at`.
- **`document_shares`**  `id`, `org_id`, `target_type` (`file|folder`), `target_id`, `shared_with` (counsellor
  user id), `granted_by`, `created_at`. Folder share cascades at read time.
- **`org_storage_usage`**  `org_id`, `bytes_used` (maintained on upload/delete; cheap to recompute as a backstop).
- **Enums** added to `lib/domain/enums.ts`: `documentKind`, `documentVisibility`, `scanStatus`, `folderScope`,
  `documentRequestStatus`, `shareTargetType`. Plan entitlement gains `storageGb`.

---

## 6. Storage layer (the seam + Supabase + the upload flow)

- **`StorageProvider` strategy** behind the existing `StorageAdapter` (Dormant-by-Default). Interface:
  `signedUploadUrl(key, contentType) → { url, key }` · `signedUrl(key, ttl) → url` · `remove(key)` · `status`.
  **Supabase** is the only live backend this phase; **S3 is a future drop-in** with no interface change.
- **Platform-configured (admin, not env):** `/admin/integrations` gains a **Phila Storage** card  Supabase project
  URL + service-role key + bucket (encrypted at rest via `PHILA_FIELD_KEY`), **Test connection**, switch on. Same
  pattern as the PSP / LiveKit rails. Off until configured (honest dormant state).
- **Presigned direct-to-storage upload** (never proxy bytes through a Server Action  serverless body limits):
  1. client/Hub calls `requestUpload(meta)` → server validates (role, lane, **quota**, content-type allowlist,
     size) → returns a **signed upload URL** + a `pending` `documents` row.
  2. the browser PUTs the file **straight to Supabase**.
  3. `confirmUpload(id, checksum, bytes)` finalizes the row, enqueues the **scan**, updates `org_storage_usage`,
     fires notifications.
- **Scan pipeline:** on confirm, scan the object (ClamAV self-host, or a hosted AV API) → set `scan_status`. Until
  `clean`, no signed download URL is issued; `quarantined` surfaces to the Hub. Provider-agnostic; one chokepoint.
- **Validation:** **magic-byte sniff** (don't trust extension), content-type allowlist, per-plan size cap,
  per-user upload rate limit (Upstash, the Phase-19 limiter pattern  a light local guard until then).

---

## 7. Quota & plans

- `plans.storageGb` is the per-plan entitlement (e.g. Community 5 GB · Practice 25 GB · Programme 100 GB  numbers TBD).
- `requestUpload` rejects over-quota with an honest block (`BlockedState`: "You've used 24.8 of 25 GB  remove files
  or upgrade") + the upgrade path. Usage shown in **Settings → Storage** and on the document manager header.
- **Buy-more-storage top-up is deferred** to a fast-follow (recurring add-on via the platform PSP, the 15A pattern).
  The entitlement field + the cap ship now so the limit is real and honest from day one.

---

## 8. Notifications (reuse Phase 12 + in-app)

- **Two new triggers** through the existing `deliver` chokepoint (consent / opt-out / quiet hours / credits all
  honoured; templates editable in the Hub template manager):
  - `document_shared`  org assigns/shares a document **to a client** → notify the client on their preferred channel.
  - `client_uploaded_document`  a client fulfils a request → notify the **requesting counsellor + Hub**.
- **In-app notifications**  a lightweight notification store surfaced in the shell's existing notifications menu
  (the request fulfilled, a file shared with a counsellor, a quarantined file for the Hub). No fake "sent".

---

## 9. UX / UI  the smooth, effortless part (built to the DESIGN.md bar)

> The whole reason for this phase is that organising documents today is miserable. Phila's job is to make it feel
> like a well-run front desk: calm, fast, obvious, never a dead end. Considered motion (GPU-only, capped,
> reduced-motion aware), 360px-first, light/dark, WCAG 2.2 AA.

**Hub document manager (`/hub/documents`)  the centrepiece.**
- **Two-pane layout:** a collapsible **folder tree** (left) + a **file grid/list** (right) with a **breadcrumb**
  trail. Desktop = side-by-side; mobile (360px) = the tree becomes a drawer, breadcrumb stays.
- **Drag-and-drop, done calmly:** drag a file onto a folder to move it; drag files from the desktop onto the pane
  to upload; a soft drop-target highlight, an optimistic move with a quiet settle, and **undo** in the toast. No
  janky reflow  GPU transforms only.
- **Multi-select + bulk:** shift/ctrl select, a slim contextual action bar (Move · Assign to client · Share ·
  Download · Delete). Bulk move/assign is one optimistic write.
- **Inline rename**, right-click / kebab context menu, keyboard-operable throughout (arrow-navigate the grid,
  Enter to open, F2 rename, Del to delete-with-confirm).
- **Smart views** as first-class tabs beside the tree: **By client · By counsellor · By session · Shared with
  client · Uploaded by clients (needs review)**  computed from the row fields, so the same file appears wherever
  it belongs without duplication. "Needs review" badges the count of client uploads awaiting a Hub glance.
- **Upload affordance:** a primary **Upload** button + drag-drop; a calm progress row per file (presigned PUT
  progress), then a "scanning…" chip that resolves to a green tick or a quarantine warning.
- **States, all of them:** empty (instructional  "No documents yet. Drag files here or create a folder."),
  loading (skeleton grid), error (calm/actionable), **blocked** (over-quota / storage-not-configured), and the
  honest "scanning" / "quarantined" per-file states. Zero dead ends (Phase 8 discipline).
- **Assign / Share dialogs:** a quick client picker (assign) and a counsellor multi-select (share a file or a whole
  folder, with a "cascades to everything inside" note).

**Client side (`/me/documents`)  request-driven, warm, mobile-first.**
- A **"Requested from you"** section at the top: each open request as a calm card ("Nomsa asked for: Copy of your
  ID") with an **Upload** button bound to it; fulfilled requests move to a quiet "done" state. **No open-ended
  upload button** anymore.
- A **"Shared with you"** list: documents the org assigned, each with a real **signed-URL download** (TTL'd).
- Single-column, large tap targets, no horizontal scroll at 360px (99% of clients are on mobile).

**Dossier integration (counsellor + Hub).**
- The client dossier's **Documents card** becomes live: the client's folder, a **Request a document** action, and
  **Assign / Share**  the counsellor works documents without leaving the client.

**Counsellor documents (`/app/documents`).**
- A focused view: their clients' documents + the **Shared with me** lane. Same components as the Hub manager,
  scoped to the counsellor's visible set.

---

## 10. The seam (provider + actions + queries)

- **`DataProvider` additions** (mock + db, frozen signatures): `listFolders` · `listDocuments(scope)` ·
  `getDocument` · `listDocumentRequests` · `listSharesForCounsellor` · `getStorageUsage`. Migrate
  `getClientDossier.documents` to the DB here (close the mock-delegation gap).
- **Server Actions** (Zod + `logAccess`, in `db/queries/documents.ts`): `createFolder` · `renameFolder` ·
  `moveItems` · `requestUpload` · `confirmUpload` · `assignToClient` · `shareWithCounsellor` · `createRequest` ·
  `fulfilRequest` · `signDownload` · `deleteItems`. Each enforces lane + visibility + quota server-side (defence in
  depth  the UI guard is UX only).
- **`db/queries/documents.ts`**  typed reads/writes; no raw queries in components.

---

## 11. Build order (ship in four self-contained slices)

Each slice ends green (tsc · lint · unit/integration · build) with E2E + screenshots, per the standing Part-B method.

1. **18.1 Foundations** (§5–§7)  schema + migration + RLS + seed; `StorageProvider` + Supabase backend +
   presigned flow + scan + validation + quota; admin **Phila Storage** card. Wire the existing reads to it.
2. **18.2 Hub manager** (§9)  the two-pane workspace, folders, drag move/upload, bulk, smart views, assign, share.
3. **18.3 Requests + notifications** (§8)  the request flow + the two triggers + in-app notifications.
4. **18.4 Client side real** (§9)  request-bound upload, signed download, "shared with you", dossier integration.

---

## 12. Tests

- **Unit:** quota math + over-cap block; lane/visibility resolver (who-sees-what); magic-byte sniff; folder-share
  cascade; the smart-view grouping from fields.
- **Integration (real Postgres as `phila_app`):** RLS on `documents`/`folders`/`requests`/`shares`; a counsellor
  cannot read a non-shared other-client document; a client sees only assigned `client_visible` docs; quota enforced
  on `requestUpload`; a quarantined file yields no signed URL; assign/share/move persist + audit.
- **E2E (Playwright, 1280 + 360):** Hub creates a folder → uploads → moves (drag) → assigns to a client → shares a
  folder with a counsellor; counsellor sees only their lane; Hub requests a document → client uploads against it →
  Hub is notified → file scanned → client downloads a shared file. Screenshots to `/screenshots`.

---

## 13. Honest constraints & deferred

- **No Google Drive / external store** (dropped this phase  compliance). S3 is a later drop-in behind
  `StorageProvider`, not a bypass.
- **Buy-more-storage top-up** deferred (recurring add-on, 15A pattern); the per-plan cap + entitlement ship now.
- **Virus scanner** is a real dependency  ClamAV (self-host, in-region) or a hosted AV API; pick at build. The
  `scan_status` gate is the contract; the scanner behind it is swappable.
- **Thumbnails / in-browser preview / versioning / e-sign** are future enhancements  not this phase.
- **Rate limiting** uses a light local guard until the Phase-19 Upstash limiter lands.

---

## Done when

The Hub organises documents in folders and **moves/assigns/shares** them smoothly and optimistically; a counsellor
sees their **own-clients + shared** lane and nothing more; a client uploads **only what was requested** and opens
**only what was shared**; every file rests in Phila's **private Supabase bucket**  presigned-uploaded, **scanned**,
**quota-capped**, **signed-URL-only**, classified by **visibility**, and **fully audited**; the two notifications
fire honestly; and the whole surface is 360px-first, light/dark, considered-motion, WCAG 2.2 AA, with zero dead
ends. The Part-A/earlier suites stay green; the new Phase-18 unit/integration/E2E pass.

*Phila · philasa.com · Phase 18 · Document System · Supabase-backed, POPIA-safe · Plan opened 2026-06-30*

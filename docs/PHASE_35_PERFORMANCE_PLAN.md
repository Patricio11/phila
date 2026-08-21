# Phase 35 - Fast Everywhere: the national-scale performance plan

> **Status:** PROPOSED 2026-08-21 - awaiting go-ahead. Written after a measured review of the
> production build (real TTFBs per role, raw DB latency, query-pattern reading of every hot path).
> Nothing in this plan changes behaviour a user can see except speed; every step ships with
> before/after timings, tests, and screenshots like every other batch.

---

## 1. The measured baseline (2026-08-21, production build, same network as SA users)

| Fact | Number | Why it matters |
| --- | --- | --- |
| DB region | Neon `eu-west-2` (London) | Every query crosses SA -> Europe |
| One DB query round trip | **~155 ms** (measured 151-597) | The unit cost everything multiplies |
| `/hub` TTFB | **1.6 - 1.9 s** | ~15 sequential queries x 155 ms |
| `/hub/clients` TTFB | 1.9 s | same shape |
| `/app` TTFB | 0.7 - 1.0 s | fewer queries, same unit cost |
| `/me` TTFB | 0.35 s | the lightest shell |
| `/hub` DOM-ready | ~7.5 s | hydration + client polling pile-up |
| `/app/documents` DOM-ready | 25 s (one-off outlier) | 4r rehome loop runs per visit (see E2) |

Where the time actually goes:

1. **Sequential query chains.** The hub layout alone awaits ~7 DB operations one after another
   (session -> org -> 2FA prompt -> feature resolution, itself 4-5 queries -> member photo ->
   unread count -> WhatsApp health) before the page's own ~8 queries even start. 15 x 155 ms is
   the 1.8 s we measured. Layout and page render in parallel, but each is internally serial.
2. **`runForOrg` per operation.** Each scoped read opens its own transaction (BEGIN + SET GUC +
   query + COMMIT) over the websocket pool: 2-3 extra round trips per operation.
3. **The auth chain is resolved twice per request** (layout and page both call the guard; the
   Better Auth session lookup hits the DB every time).
4. **`logAccess` is awaited inside page renders** - the audit write sits on the critical path.
5. **Messages polling has no diet.** `refreshThreads` runs every 5 s per open Messages tab and
   `listTeamThreadsDb` has **no message limit - it re-downloads the entire history of every
   thread on every poll**. Separately: typing polls at 2.5 s, unread at 30 s, notifications at
   60 s, presence at 60 s. Five timers per signed-in user.
6. **Hot-path indexes are incomplete** for pairs like `appointments(org_id, starts_at)` and
   `team_messages(thread_id, created_at)` - fine at demo size, not at national size.

---

## 2. The plan - five phases, ordered by impact

### Phase A - put the compute next to the database *(the 10x win, near-zero code)*

The user should pay the SA <-> Europe hop **once per page**, not once per query.

- [ ] **A1. Pin Vercel functions to London** (`lhr1`; `fra1` fallback): one `vercel.json` /
  route-segment config change. Server -> DB round trips drop from ~155 ms to ~1-3 ms.
  Projected `/hub` TTFB: **1.8 s -> ~400 ms** with no other change. (If functions currently run
  in the US default `iad1`, production today is *worse* than the baseline table - every query
  crosses US <-> Europe.)
- [ ] **A2. Prove it honestly**: measure the same page set before/after from this SA machine
  against philasa.com; record both tables in this file.
- [ ] **A3. The end-state note (no action now):** for true SA data residency AND speed, the DB
  moves to `af-south-1` (AWS RDS/Aurora Postgres - Neon has no SA region) with functions in
  Vercel `cpt1` (Cape Town). `db/client.ts` is the single seam (the Data-Residency Rule already
  reserves this). This is a migration project on its own; Phase A makes today fast without it.

### Phase B - stop re-asking the database the same questions *(per-request hygiene)*

- [ ] **B1. Memoise the auth chain per request** with React `cache()` around
  `getCurrentPrincipal` - layout + page currently resolve the session twice; after this, once.
- [ ] **B2. Better Auth cookie cache** (signed short-TTL session data in the cookie, ~5 min):
  most requests skip the session DB lookup entirely; revocation still honoured at the TTL and on
  sign-out. This removes 1-2 queries from EVERY authenticated request.
- [ ] **B3. Parallelise the serial chains**: hub/app/me layouts and the heaviest pages
  (`/hub`, `/hub/clients`, `/app`) fetch with `Promise.all` instead of one-after-another.
  The transformation is mechanical; behaviour identical.
- [ ] **B4. `logAccess` off the critical path**: audited exactly as today, but written via
  `after()` so the response never waits on the audit insert. (Fail-strict audits - DSAR export,
  note reads - stay awaited; the list is small and named in the PR.)
- [ ] **B5. `runForOrg` batching**: where a page makes several scoped reads, run them inside ONE
  scoped transaction instead of one per operation (the helper already exists; callers change).
  Saves 2-3 round trips per operation.

### Phase C - cache what rarely changes, invalidate when it does *(the "only pull from DB when it changed" idea - done the reliable way)*

Your instinct is exactly how Next.js is designed to work. The pattern is **tag-based
invalidation**: reads are served from the framework's data cache under a tag; every mutation
calls `revalidateTag`, so the next read hits the DB once and re-caches. There is no staleness
window to reason about - data changes the moment a write happens, and not before. Safe across
serverless instances (it is the platform's shared data cache, not per-process memory).

- [ ] **C1. Cache the org-shaped slow-movers** (read every request, written rarely), each with a
  per-org tag and `revalidateTag` in its save action:
  - resolved features (`org:{id}:features`) - today 4-5 queries per layout render
  - org row + branding + doc-brand (`org:{id}:org`)
  - messaging settings + templates (`org:{id}:messaging`)
  - plans catalogue, platform settings, platform integrations status (global tags)
  - booking/public-page content (already ISR on the public side; the hub reads join in)
- [ ] **C2. What is NEVER cached** (stays live by design): unread counts, presence, typing,
  notifications, messages, appointment boards, invoices, anything a user just wrote. Volatile
  data stays truthful; only configuration-shaped data is cached.
- [ ] **C3. Guard-rail test**: an integration test proving a settings save is visible on the very
  next read (tag invalidation round trip), so caching can never ship a stale-settings bug.

### Phase D - put messaging on a diet *(the national-scale fix)*

- [ ] **D1. Cap the payload**: `listTeamThreadsDb` returns the last **30 messages per thread**;
  the thread view gains "Load earlier" (fetches older pages on demand). Full history stays in
  the DB - only the wire payload shrinks.
- [ ] **D2. Delta polling**: the 5 s refresh becomes `?since=<cursor>` returning ONLY new/changed
  messages, reactions, edits and thread membership changes (the client already merges by id -
  the merge logic keeps working unchanged). Typical poll drops from the full history to <2 KB.
- [ ] **D3. One heartbeat instead of five**: a single light endpoint returns
  `{unread, notifications, typing, presence}` on one timer (5 s on the Messages page, 30 s
  elsewhere, paused when the tab is hidden - hidden-tab pausing exists, it becomes universal).
  Push (4m) already covers the away case.
- [ ] **D4. Honest load numbers** in the proof: bytes per poll before/after, queries per poll
  before/after.

### Phase E - hotspots and indexes

- [ ] **E1. Composite indexes** (one migration, `CREATE INDEX CONCURRENTLY` semantics on Neon):
  `appointments(org_id, starts_at)`, `appointments(client_id, state)`,
  `team_messages(thread_id, created_at)`, `notifications(user_id, read_at)`,
  `documents(org_id, folder_id)`, `form_assignments(org_id, client_id)`,
  `audit_log(org_id, at)`. Verified with `EXPLAIN` before/after on the real data.
- [ ] **E2. Fix the 4r per-visit rehome loop** (my own hotspot): `/app/documents` currently
  re-checks every caseload client's folder home on every visit (N clients x ~3 queries).
  Becomes: event-driven only (reassign/transfer/unassign hooks already exist) + a single cheap
  "any folder out of place?" check; the 25 s outlier dies with it.
- [ ] **E3. Consolidate `listCounsellorDocumentsDb`** (~6 queries -> 2-3) and reuse its result
  where the page currently also calls `counsellorSubtreeDb` separately.
- [ ] **E4. Streaming shells**: `loading.tsx` + Suspense around the heavy dashboard cards so the
  nav and header paint immediately while cards stream in - perceived speed on every page,
  whatever the network.
- [ ] **E5. Bundle pass**: measure per-route First Load JS, lazy-load the emoji picker, charts,
  and the form builder (heavy, rarely-first-paint components).

---

## 3. What this does NOT change

- No feature behaviour, no UI redesign, no data model changes (except new indexes).
- RLS stays exactly as it is (B5 batches transactions; it never bypasses the scoped role).
- Dormant-by-default, honest states, audit coverage - all untouched (B4 moves *when* the audit
  row is written by milliseconds, never whether).

## 4. Expected outcome (to be re-measured and recorded here)

| Page | Today | After A+B | After C |
| --- | --- | --- | --- |
| `/hub` TTFB | 1.6 - 1.9 s | ~400 ms | ~250 - 350 ms |
| `/app` TTFB | 0.7 - 1.0 s | ~250 ms | ~200 ms |
| `/me` TTFB | 350 ms | ~150 ms | ~120 ms |
| Messages poll payload | full history / 5 s | unchanged | <2 KB / 5 s (Phase D) |

## 5. Order of work and proof discipline

A -> B -> C -> D -> E, one batch each, every batch: `npm run build` + live timings from this
machine + vitest green + docs updated + committed. Phase A needs a Vercel redeploy to measure
honestly; I will hand you the exact before/after table.

## 6. Risks, named

- **Cookie cache (B2)**: a revoked session can survive up to the cookie TTL (5 min). Mitigation:
  short TTL + sign-out clears it. Standard trade, called out so it is chosen, not discovered.
- **Tag caching (C)**: a mutation path that forgets `revalidateTag` would serve stale config.
  Mitigation: C3's guard-rail test + a single helper (`orgTag(orgId, kind)`) so save actions
  cannot improvise tag names.
- **Delta polling (D2)**: a missed cursor edge would drop a message from view until the next full
  refresh. Mitigation: a full refresh every Nth poll as a self-healing backstop.
- **Region pinning (A1)**: users far from Europe pay one extra hop... which is already the case
  for SA users today; the page-level win strictly dominates.

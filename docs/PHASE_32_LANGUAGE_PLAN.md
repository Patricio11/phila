# PHASE 32: LANGUAGE - PLAN

> Read with `TO_START_EVERY_SESSION.md` (rules + stack), `DESIGN.md` (tokens, shell, components),
> `ROADMAP.md` (the phased build). This plan follows the house conventions: **Mock-First**,
> **Dormant-by-Default**, migration guards, `PHASE_N_COMPLETE.md` on ship, **no em-dash anywhere**.
>
> **What this phase is:** the ability for a counselling session to be held between two people who do
> not share a language, held inside Phila, without breaking a single one of the eleven domain rules.
>
> **What this phase is not:** an i18n project. The Phila product interface stays English. What gets
> translated is **human content**, not product chrome. That distinction is the spine of this plan and
> it is what keeps Rule "English only" intact.

---

## 0. THE DECISION RECORD

Four decisions everything else follows from. Each is a deliberate narrowing, and each one is the
reason the feature is shippable rather than dangerous.

### 0.1 Assist, do not substitute

The counsellor keeps hearing the client's **real voice**. Translation appears as **text alongside**,
never as a synthetic voice replacing the client. Affect, hesitation, the crack in a voice and the
length of a pause are clinical data. Speech-to-speech dubbing deletes all of it and adds latency to
a modality where silence carries meaning.

This is not a v1 shortcut to be upgraded later. It is the correct clinical design, and 32.4 revisits
audio only for the **client-facing direction** (see 0.2), never for the counsellor's ear.

### 0.2 The two directions are not symmetric

| | Counsellor side | Client side |
|---|---|---|
| Device | Laptop, stable connection | Mid-range Android, metered data |
| State | Trained, calm, file open | Often distressed, sometimes crying |
| Literacy in own language | High | Variable, cannot be assumed |
| Can read while listening | Yes | **A person in distress cannot read** |
| Therefore v1 gives them | **Text** (Language Rail) | **Text captions, audio in 32.4** |

Building both sides identically would be the single most likely design mistake in this phase.

### 0.3 Product chrome is English. Human content is in the client's language.

This is how the feature coexists with the standing rule. No i18n framework, no locale routing, no
translation catalogs, no `next-intl`, no `t()` calls, no `[locale]` segments.

| Layer | Language | Mechanism |
|---|---|---|
| Nav, buttons, labels, toasts, admin, Hub, funder portal | English, always | Unchanged. Copy stays next to its component. |
| Consent copy for interpretation | Client's language | **Human-translated**, versioned DB rows |
| Intake and forms sent to a client | Client's language | Existing `forms` snapshot, one row per language |
| WhatsApp / SMS / email to a client | Client's language | Existing `message_templates` org-override pattern |
| Care-plan steps and resources | Client's language | Existing `care_plans` JSONB tasks |
| Live speech in session | Both | The Language Rail (32.2 / 32.3) |
| Clinical note | Counsellor's working language | Unchanged. MT assists the draft (32.1). |

Every one of those content surfaces is **already a database row that an org can already edit**. Forms
are already snapshot-frozen at send time. Message templates already have a system default plus an
org override. Care-plan tasks are already JSONB. Adding a `language` column to rows that already
exist is not an i18n framework. It is a column.

### 0.4 The source language is the record

The translation is an **aid**, never the record. If a note is ever subpoenaed in a GBV matter, "the
client said X" must trace to her actual words in her actual language.

Concretely, and consistent with Phase 14 ("no raw transcript stored"):

- **Default: nothing is persisted.** Captions live in the session and are gone when it ends.
- What **is** persisted is a metadata row: this session was conducted in isiXhosa with
  machine-assisted interpretation, provider and model version recorded, consent version recorded.
  That is the auditable fact, and it is enough.
- Transcript retention is a **separate, explicit, per-org and per-client consent**, default off. When
  on, the **source-language** segments persist and the translation is stored beside them clearly
  marked machine-generated. Never the translation alone.

---

## 1. HOW IT LANDS ON WHAT ALREADY EXISTS

The good news, on reading the roadmap: almost every seam this feature needs is already built and
proven. This phase is mostly **composition**, not new infrastructure.

| Need | Already shipped | Delta |
|---|---|---|
| In-region video, token minting, waiting room, doors-open | Phase 13, W2, Batch 1 #10 | Add a server-side agent participant |
| Provider rail with encrypted keys, Demo/Live, Test connection | Phase 13.1, 18.1, Admin Integrations rework | One new integration card |
| Dormant-by-Default + entitlement resolver + kill-switch | W3 `/admin/features` | One new feature key |
| Versioned, purpose-bound, revocable consent | Phase 9 | Two new purposes |
| Metered variable cost with caps and honest blocks | Phase 12 credits, Phase 14 AI caps, 15.1 packs | One new credit channel |
| `logAccess()` with a fail-strict clinical class | Phase 9, W2 | New audit actions |
| RLS on every org-scoped table | Phase 10, W2 runtime cutover | RLS on new tables, same pattern |
| Forms with frozen snapshots | Phase 18.6 | A language column on the snapshot |
| Message templates, system default plus org override | Phase 12 | A language column, same resolver |
| Consent-gated, k-anon demographic reporting | Phase 16 | One new demographic field |
| Mock-first seam with a conformance suite | Part A, `lib/adapters/` | One new provider interface |
| Storage with presigned upload and scan gate | Phase 18 | Reused for lexicon imports only |

**What genuinely does not exist yet and must be built:** the streaming ASR/MT provider seam, the
LiveKit agent, the Language Rail component, the confidence and risk-banding logic, the clinical
lexicon, and the compliance deltas for processing voice.

---

## 2. RULE COLLISIONS AND HOW EACH RESOLVES

Every one of the eleven non-negotiable rules is touched. None is broken. This table is the
compliance argument for the whole phase and should be lifted into the DPIA amendment.

**Rule 1 (Care-Confidentiality).** Speech in a session is the most sensitive data Phila will ever
touch, and voice is **biometric data** under POPIA in its own right, on top of the content.
*Resolution:* transient processing only by default, in-region, never stored, never in a cross-org or
cross-role payload. The rail renders only to the two participants in the room. Segments are never
written to `session_notes`. Retention is opt-in, separately consented, and stores source first.

**Rule 2 (No-Diagnosis / AI-Honesty).** A machine translation is a machine assertion about what a
person said. *Resolution:* every segment is visibly machine-generated. The rail header carries a
persistent "machine translation" marker, not a dismissible toast. The counsellor is still author of
record for the note. Translation never advances clinical state, never fills a form, never writes a
risk flag on its own, never produces a care-plan step without the counsellor editing it.

**Rule 3 (Consent-Before-Capture).** *Resolution:* a new `interpretation` consent purpose, affirmed
before any audio is processed, and a separate `transcript_retention` purpose. **The consent copy
must itself be human-translated into the supported languages.** Asking someone to consent in a
language they do not read, to a feature that exists because they do not read it, is not consent.
This is a hard requirement, not a nicety.

**Rule 4 (Mock-First).** *Resolution:* 32.2 is a complete, demoable Language Rail on a scripted mock
transcript, before any vendor contract exists. See section 8.

**Rule 5 (Dormant-by-Default).** *Resolution:* `language_rail` is a W3 feature key, off platform-wide
until the super admin switches the integration on, off per org until the Hub enables it, off per
session until the client record carries a language and consent is granted. Three gates, all honest.

**Rule 6 (Tenant-Isolation).** *Resolution:* every new table carries `org_id` with the standard RLS
policy. The clinical lexicon has two tiers: a platform tier (`org_id` null, readable by all) and an
org tier (org-scoped, private). An org's lexicon never leaks to another org.

**Rule 7 (Data-Residency).** **This is the hard one and the one that can block the phase.**

The existing posture is "AI inference is de-identified before any cross-border call." You can
de-identify text. **You cannot meaningfully de-identify a live audio stream of a person's voice.**
The voice *is* the identifier. Stripping names from a transcript does nothing about the waveform.

*Resolution, and it is not negotiable:* **speech processing happens in an SA region or the feature
does not ship.** Concretely:

- LiveKit is already self-hostable and must be in `af-south-1` with TLS before this goes live
  (already an open item in Phase 13).
- ASR and MT run either against an SA-resident provider endpoint or a self-hosted model in the same
  region. This is precisely why the SA vendor path matters beyond model quality.
- Phase 19's open item, migrating Postgres to an SA region, becomes a **hard dependency** of 32.3
  rather than a parallel track.
- The cross-border AI toggle (`org_ai_settings`) governs the scribe. Interpretation is a **distinct,
  in-region** processing basis and gets its **own** toggle and its own consent purpose, so an org
  that has declined cross-border AI can still enable interpretation. Do not fold them together.

The reward for holding this line is a claim no global competitor can make: **the client's voice never
leaves South Africa.**

**Rule 8 (Safeguarding).** A translation layer sits directly across the path of risk disclosure.
Fluent, confident, wrong is the worst possible failure mode here. *Resolution:* see section 9 in
full. Headlines: risk-adjacent segments are never paraphrased away, the source phrase is always
shown verbatim beside them, the system **never generates method language** in output, detection
never auto-actions and never triages, and negation inversion is a zero-tolerance hard fail in
acceptance testing.

**Rule 9 (Responsive & Considered-Motion).** *Resolution:* the counsellor rail is the one surface in
Phila that is desktop-primary, and this is deliberate: the counsellor is on a laptop. The client
side stays 360px-first. Exactly one ambient motion is added, the live-partial caret, and it is
opacity-only and reduced-motion aware.

**Rule 10 (Outcome-Honesty).** *Resolution:* home language becomes a consent-gated demographic field
with the k-anon floor applied like every other. Language of service becomes a fundable indicator.
Coverage captions everywhere: "312 of 530 clients have a recorded language."

**Rule 11 (Cost).** Streaming ASR is the most expensive per-minute variable cost in the platform.
*Resolution:* `interpretation_minutes` becomes a fourth credit channel on the existing ledger, with
per-org monthly caps, low-balance nudges, and an honest block at zero that **never** silently
degrades a live session. Mid-session exhaustion is handled explicitly, see 7.6.

---

## 3. THE LANGUAGE SET

Do not attempt eleven official languages plus migrant languages at once. Tier by real capability and
be honest in the UI about which tier a language is in.

**Tier 1 - full rail (target for 32.3 pilot).** English, isiXhosa, isiZulu, Afrikaans, Sesotho.
Rationale: strongest available SA model coverage, and Western Cape plus Gauteng caseloads are
overwhelmingly covered by English, isiXhosa and Afrikaans.

**Tier 2 - content only (32.0 / 32.1), rail when models mature.** Sepedi, Setswana, Xitsonga,
siSwati, Tshivenda, isiNdebele. These get language of record, translated consent, forms, reminders
and care-plan steps. No live rail until quality clears the bar in section 12.

**Tier 3 - recorded, not served.** French, Portuguese, Lingala, Somali, Amharic, Shona, chiChewa.
Large migrant communities in Cape Town and Johannesburg who currently cannot access counselling at
all. Record the language from day one so the **unmet need is measurable**. That number is a funding
argument on its own, and it costs one column to capture.

Also record **South African Sign Language**, the twelfth official language. Phila will not interpret
it, but the record should not pretend the need does not exist, and an org that has a SASL
interpreter should be able to note it on the session.

The UI never claims a capability a tier does not have. A Tier 2 language shows "Translation is not
available for this language yet" as a calm blocked state naming the reason, per the existing
`BlockedState` pattern.

---

## 4. DATA MODEL

Migrations `0061` through `0063`, following the house convention: `IF NOT EXISTS` / `ON CONFLICT DO
NOTHING` / `DO $$ ... duplicate_object` guards, `meta/_journal.json` in the same commit, RLS policies
and seed reflected in `db/seed.ts`.

### 4.1 Migration 0061 - language of record (ships with 32.0)

```
languages                     -- reference, org_id NULL, seeded, not tenant-scoped
  code            text pk     -- BCP-47: en-ZA, xh-ZA, zu-ZA, af-ZA, st-ZA, fr, pt, ln, so, am, sgn-ZA
  name_en         text        -- "isiXhosa"
  name_native     text        -- "isiXhosa"
  tier            int         -- 1 | 2 | 3
  rail_capable    boolean
  rtl             boolean     -- false for all current entries, present so it is never a migration later

clients
  + home_language        text references languages(code)
  + interpretation_needed boolean default false   -- set by intake or the Hub, not inferred
  + language_recorded_at  timestamptz

counsellors
  -- languages already exist as free text on the profile. Normalise:
  + spoken_languages     text[]                   -- language codes, org-managed

org_language_settings
  org_id pk, enabled boolean default false,
  default_language text default 'en-ZA',
  rail_enabled boolean default false,
  retention_enabled boolean default false,        -- org-level gate on transcript retention
  monthly_minute_cap int
```

`home_language` is **special personal information**. In South Africa home language correlates
strongly with ethnic origin, so it is treated exactly like `race`: consent-gated under the existing
`demographics` purpose, k-anon floor on export, never on a public or cross-org payload. Add it to
the demographic fields list in the Appendix and to the redaction matrix.

### 4.2 Migration 0062 - content in language (ships with 32.1)

```
content_translations          -- one generic table, not per-entity
  id, org_id (nullable for platform tier),
  entity_type    text         -- 'consent_purpose' | 'form_field' | 'message_template' | 'care_step' | 'ui_notice'
  entity_id      text
  language       text references languages(code)
  field          text         -- 'label' | 'body' | 'help'
  value          text,
  source         text         -- 'human' | 'machine_reviewed'   (never bare 'machine')
  reviewed_by    uuid null, reviewed_at timestamptz null,
  version        int, created_at, updated_at
  unique (org_id, entity_type, entity_id, language, field, version)
```

One table rather than a column on each entity, because the resolver is then a single tested function
and adding a translatable surface later is a row, not a migration.

**`source` may never be bare machine for consent copy.** Enforce it in the resolver and in a CI
compliance test: consent and safeguarding strings resolve only from `human` or `machine_reviewed`.

Resolution order, mirroring the existing template resolver: org row for the language, then platform
row for the language, then the English original. Never a blank.

### 4.3 Migration 0063 - the rail (ships with 32.2 mock, wired in 32.3)

```
session_interpretation        -- one row per session that used the rail
  id, org_id, appointment_id unique,
  client_language, counsellor_language,
  provider text, model_version text,             -- provenance, permanently
  consent_version int,
  started_at, ended_at, minutes_billed numeric,
  segment_count int, low_confidence_count int, flagged_count int,
  retention_granted boolean default false,
  ended_reason text                              -- 'session_ended' | 'counsellor_off' | 'provider_failed' | 'credits_exhausted'

interpretation_segments       -- ONLY written when retention_granted
  id, org_id, session_interpretation_id,
  speaker text,                                  -- 'client' | 'counsellor'
  source_language text, source_text text,        -- the record
  translated_text text,                          -- always marked machine
  confidence numeric, band text,                 -- 'high' | 'medium' | 'low'
  flagged boolean default false,
  started_ms int, ended_ms int, created_at

lexicon_terms                 -- the moat
  id, org_id (NULL = platform tier),
  language, term text, gloss_en text,
  category text,                                 -- 'idiom_of_distress' | 'instrument_item' | 'consent' | 'clinical' | 'cultural'
  guidance text,                                 -- what a counsellor should understand, not a literal gloss
  status text,                                   -- 'proposed' | 'reviewed' | 'active' | 'retired'
  reviewed_by uuid, reviewed_at timestamptz

lexicon_flags                 -- the improvement loop
  id, org_id, session_interpretation_id null,
  source_text, translated_text, language,
  reason text, note text, raised_by uuid, created_at, resolved_at
  -- carries NO client identifier. Session id only, and only when retention is on.

interpretation_usage          -- mirrors ai_usage exactly
  id, org_id, appointment_id, minutes numeric, cost_cents int,
  provider, created_at
```

**Risk terms are deliberately not a table in this schema.** See 9.2 for why and where they live.

RLS on `session_interpretation`, `interpretation_segments`, `lexicon_flags`,
`interpretation_usage` by direct `org_id`. `lexicon_terms` by `org_id IS NULL OR org_id =
app_current_org()`. Same `phila_app` role, same policies, proven by the existing leak-proof pattern
in `tests/integration/rls.test.ts`.

### 4.4 Enum additions

```
consentPurpose  += 'interpretation' | 'transcript_retention'
aiFeature       += 'interpretation' | 'note_translation'
indicatorType   -- unchanged, 'demographic_proportion' already covers language of service
appointment     -- unchanged. Interpretation is not a session type. It is a property of the session.
```

---

## 5. THE PROVIDER SEAM

Follows `StorageProvider` and `lib/adapters/` exactly. Interface first, mock first, vendor last.

```ts
// lib/language/provider.ts

export interface TranslationProvider {
  readonly id: string
  readonly region: string                    // must resolve to an SA region in live mode

  capabilities(): Promise<LanguageMatrix>    // which pairs, streaming or batch, per direction

  // Streaming ASR + MT. One duplex session per human speaker track.
  openStream(opts: {
    sourceLanguage: string
    targetLanguage: string
    sampleRate: number
    onPartial: (s: PartialSegment) => void
    onFinal:   (s: FinalSegment) => void
    onError:   (e: ProviderError) => void
  }): Promise<TranslationStream>

  // Batch MT, no audio. Used by note translation (32.1) and content translation review.
  translate(text: string, from: string, to: string): Promise<TranslationResult>

  test(): Promise<{ ok: boolean; latencyMs: number; sample: string }>
}

export interface FinalSegment {
  speaker: 'client' | 'counsellor'
  sourceText: string
  translatedText: string
  asrConfidence: number        // 0..1
  mtConfidence: number         // 0..1
  languageDetected: string     // may be 'mixed'
  startedMs: number
  endedMs: number
}
```

Implementations, in build order:

1. **`lib/language/mock.ts`** - replays a scripted bilingual transcript with realistic timing.
   The whole of 32.2 is built and demoed on this.
2. **`lib/language/vulavula.ts`** - the SA vendor path. Strongest available isiZulu, Sesotho and
   Afrikaans coverage with explicit code-switching support, which is the technically hard part and
   the part global providers do not solve. Available via cloud API and via a deployable model, which
   is what makes the in-region residency promise holdable.
3. **`lib/language/selfhosted.ts`** - Whisper-class ASR plus an open MT model, both in
   `af-south-1`. This is the fallback and the negotiating position. Worse on Nguni languages,
   fully under your control.
4. **`lib/language/composite.ts`** - route per language pair. Vendor for Tier 1 Nguni and Sotho,
   self-hosted for European-language pairs where open models are strong. One interface, best model
   per pair, no call-site knows.

**Admin integration card** at `/admin/integrations/language-rail`, matching the LiveKit and Phila
Storage cards exactly: provider select, region field (validated against an SA allowlist when mode is
Live), endpoint, key (encrypted at rest), Demo / Live toggle, per-minute cost for metering, and a
**Test connection** that runs a fixed three-second sample through the stream and returns the
transcript plus measured latency. Live mode is refused if region validation fails. Not an env var,
ever, consistent with the LiveKit 17.1 decision.

---

## 6. ARCHITECTURE OF A LIVE SESSION

```
  Client (Android, metered)          Counsellor (laptop)
        |  audio track                     |  audio track
        +--------------+   +---------------+
                       v   v
              LiveKit room (self-hosted, af-south-1, wss)
                       |
                       |  server-side agent joins as a hidden participant,
                       |  subscribes to both audio tracks separately
                       v
              Interpretation Agent  (lib/language/agent)
                       |
        +--------------+---------------+
        |                              |
   TranslationProvider           risk + confidence
   (ASR stream -> MT)            banding, server-only
        |                              |
        +--------------+---------------+
                       |
                       v
        LiveKit data channel (reliable), published
        to the two participants only
                       |
        +--------------+---------------+
        v                              v
   Language Rail                 Client captions
   (counsellor UI)               (client UI, own language)
```

Design notes that matter:

**Track-level separation gives speaker attribution for free.** Each participant publishes their own
audio track, so there is no diarisation problem. Do not mix the streams.

**Use the LiveKit data channel, not a new socket.** It is already in-region, already authenticated
by the existing room token, already bound to the appointment by the W2 hardening. Adding a second
transport would add a second security surface for no gain. Supabase Realtime stays for staff chat
where it already lives.

**Endpointing must be tuned for counselling, not for meetings.** Default VAD endpointing at roughly
500ms of silence will chop a client mid-thought, because long pauses are normal and meaningful in a
therapy hour. Start at 1200 to 1500ms and make it a per-org tunable. A pause is not the end of a
turn. Getting this wrong is the difference between a rail that feels calm and one that feels like it
is interrupting.

**Do not translate backchannels.** "Mm", "eish", "ncese", a sharp intake of breath, a laugh. These
pass through as audio, instantly, untranslated, and render in the rail as a faint muted marker so
the counsellor knows sound occurred. Routing them through a model adds latency and noise to the most
important signal in the room, which is that someone is listening.

**Do not force a single language ID.** South Africans code-switch mid-sentence. Language ID per
utterance fails on mixed utterances. Accept `mixed` as a first-class detected value and surface it
as a quiet indicator rather than mislabelling the segment.

**Latency budget.** Partial caption visible under 800ms. Final segment under 1.5s. Anything past
2.5s end-to-end breaks conversational rhythm and the pilot should be stopped rather than shipped.
Measure and record p50 and p95 per session on `session_interpretation`.

**Low-data mode.** The client's audio is what matters. When the rail is on, offer video-off by
default on the client side with an honest line explaining that audio-only makes translation more
reliable on a weak connection. This turns their existing low-data constraint into a feature.

---

## 7. UX / UI SPECIFICATION

All tokens from `DESIGN.md` section 2. Inter throughout, tabular numerals on any count. No new
colours. The rail must look like it was always part of Phila.

### 7.1 Booking - the language step

One new step in the existing stepped wizard, between service and time. Not a dropdown buried in
intake.

> **What language would you like your session in?**
> A calm single-select of Tier 1 and 2 languages by **native name** (isiXhosa, not "Xhosa"), with
> English first, plus "Another language" opening the Tier 3 list.
>
> Below, quiet in `--text-3`: "We will match you with a counsellor who speaks your language where we
> can. Where we cannot, we can translate."

Selecting a non-English language and a counsellor who does not speak it sets
`interpretation_needed`. This is the moment the need becomes data.

### 7.2 Client record and Hub

- `home_language` on the client dossier beside province, with the consent-gated treatment that
  demographics already have.
- `/hub/clients` gains a **language filter** and a language column in the existing `ExportMenu`
  output, audited `pii.export` like every other client export.
- `/hub/team` member profile: `spoken_languages` becomes a real multi-select, org-managed, feeding
  the counsellor matching in 7.3.
- **`/hub/settings/language`**, a new settings surface: enable the feature, set the practice's
  default working language, the rail toggle, the retention toggle with its plain-language warning,
  the monthly minute cap, and the org lexicon.

### 7.3 Counsellor matching

The Batch 1 #5 availability work already filters counsellors by working window. Extend the same
filter with language: "3 of 6 counsellors available at 10:00 · 1 speaks isiXhosa". Prefer a
**language match over translation** every single time, and make that preference visible in the UI.
The best interpretation is the one you did not need.

### 7.4 The pre-session banner

On `/app/sessions/[id]`, above the note editor, before the session starts. Set from the client
record. **Never configured in the room.** A counsellor fiddling with a language dropdown while a
distressed person waits is a rupture that cannot be undone.

> ` [globe] ` **Lerato's language is isiXhosa. You work in English.**
> Translation is ready. She will hear your voice and read your words in isiXhosa. You will see her
> words translated here.
> ` [ Turn off for this session ] `

`--surface-2` inset, `--border` hairline, 12px radius, `--info` tinted icon. Calm, informational,
one escape hatch.

### 7.5 The Language Rail - the signature surface

**Placement.** Desktop (>= 1024px): a 320px right column in the session editor, beside the video,
collapsible to a 44px strip. The note editor keeps its width; the video shrinks. Tablet: rail
collapses to the strip by default. Phone (360px): rail is a bottom sheet at 40% height, draggable to
full, video to picture-in-picture. This is the one desktop-primary surface in Phila and section 2,
Rule 9 records why.

**Header** (56px, sticky, `--surface`, `--border` bottom):
- Left: `isiXhosa -> English` at 13px/600, with a `StatusDot`: `--info` listening, `--accent`
  translating, `--text-3` paused, `--warn` degraded, `--danger` unavailable.
- Right: an overflow menu: Pause, Turn off, Report a translation.
- Below, 11px `--text-3`, always present and never dismissible: **Machine translation. Her words are
  the record.**

**Segment** (the body, chronological, auto-scrolled to bottom):

```
[LM]  I have not been sleeping. My heart is sore.              <- 14px/1.5, --text
      show original                                             <- 11px, --text-3, click to expand
```

- Speaker: the existing deterministic initials `Avatar` at 24px. Client and counsellor both shown,
  so the counsellor can see what the client received.
- Translation: 14px, line-height 1.5, `--text`.
- Source: collapsed by default at high confidence, **always expanded** at medium, low, or flagged.
- Timestamp on hover only. No clutter.
- Entry motion: 4px rise plus fade over .18s. Reduced motion: instant.

**Confidence banding.** Pure function in `lib/language/confidence.ts`, unit-tested, combining ASR and
MT scores. Never hide a low-confidence segment. Never silently drop one.

| Band | Treatment |
|---|---|
| High | `--text`, source collapsed |
| Medium | `--text`, 1px dotted `--border-strong` underline, source **expanded** |
| Low | `--text-2`, dotted underline, source expanded, a small `--surface-2` chip reading "unclear" |

Deliberately **not** amber. Amber means needs-attention in the Phila system and low confidence is
routine, not alarming. Amber is reserved for the degraded-connection status only.

**Risk-adjacent segment.** 3px `--danger` left rule, `--danger` at low alpha as the row tint, source
**always** verbatim above the translation rather than below, and a small label: **Check this with
her.** No modal, no sound, no red banner, no auto-action. The counsellor is a professional and the
system is handing them something to look at, not raising an alarm. Consistent with the existing
`SafeguardingPanel` language: point to a person, never name a method.

**Live partial.** At the bottom, `--text-2`, with a caret at 1.4s opacity pulse. This is the single
ambient motion added by this phase, opacity-only, and reduced-motion renders a static caret. Stays
within the two-concurrent-animation cap.

**Backchannel.** A single faint `·` in `--text-3` on its own row. Sound happened. Nothing was said.

**Footer.** A quiet "Report a translation" affordance on each segment on hover, one tap, writing to
`lexicon_flags` with the source, the translation and the reason. **This is how the lexicon gets
built from real clinical use**, and it is the compounding asset in this whole phase.

### 7.6 Failure and blocked states

Every one uses the existing `BlockedState` pattern: name the reason, name the next step, never a
dead end, never a silent degradation.

| Condition | Rail state | Counsellor sees |
|---|---|---|
| Feature off platform-wide | Hidden | Nothing |
| Org has not enabled it | Hidden | Nothing |
| Client has no language recorded | Hidden | A quiet prompt on the dossier to record it |
| Language is Tier 2 or 3 | Blocked | "Translation is not available for isiNdebele yet." |
| Consent not granted | Blocked | "Lerato has not agreed to translation. You can ask her in session." |
| Credits exhausted **before** session | Blocked | "You have run out of translation minutes. Top up in Billing." |
| Credits exhausted **mid-session** | Degrades | **Never cuts.** Finishes the session, blocks the next. Honest banner after. |
| Provider unreachable | `--danger` dot | "Translation is unavailable. The session continues." Rail greys, never disappears. |
| Confidence collapses across many segments | `--warn` dot | "Translation quality is poor right now." One tap to turn off. |

**Mid-session exhaustion never cuts the session.** Running out of credit in the middle of a
counselling hour and dropping the interpreter is the single most harmful thing this feature could
do. Overrun and bill it. Rule 11 says never subsidise a tenant's variable cost, and a small
documented overrun allowance is the honest exception to write down rather than the rule to break.

### 7.7 The client side

**Waiting room** (already built, Batch 1 #10). Add one line, **in the client's language**, from
human-translated content rows:

> Your counsellor speaks English. What you say will be translated so she can understand you, and her
> words will be translated for you. A computer does the translating.

Plus the `interpretation` consent affirm, in their language, if not already granted at booking.

**In call.** Captions in their language at the bottom of the video, 16px minimum, high contrast,
generous line height. Larger than the counsellor's rail because the reading conditions are worse. A
one-tap size control. **No confidence banding on the client side**: showing a distressed person that
the machine is unsure about her counsellor's words helps nobody. Low-confidence segments on the
client side simply do not render, and the counsellor's rail shows that a segment was withheld.

**32.4, conditional.** Client-side audio, with two constraints written now: a consistent
clearly-not-the-counsellor voice, and **no voice cloning, ever**. Putting words a therapist did not
say into her own voice, in a setting with legal weight, is not a feature worth having. Introduce the
interpreter at the top of the session the way a good human interpreter is introduced.

---

## 8. BUILD SEQUENCE

Five sub-phases. **32.0 and 32.1 deliver real value with zero clinical risk and no vendor**, which
means the funding story exists before a cent is spent on ASR.

### 32.0 - Language of record (target: 1 week)

Migration 0061. Language step in booking. `home_language` on the client record and dossier, consent
gated. Hub filter, column, export. `spoken_languages` on counsellors. Language-aware counsellor
matching. Language of service in `/hub/insights` and, consent-gated and k-anon, in funder reporting.

**Done when:** an org can see how many of its clients it is serving in their own language, and how
many it is not. **That number is the business case, and it exists before any AI.**

### 32.1 - Content in language (target: 2 weeks)

Migration 0062. `content_translations` plus the resolver. Human-translated consent copy for all
purposes in Tier 1 and 2 languages. Per-language form snapshots. Per-language message templates so
WhatsApp reminders arrive in isiXhosa. Per-language care-plan step library. **Note translation**: MT
only, no ASR, so a counsellor can type cues in isiXhosa and get an English draft through the
existing scribe pipeline.

**Done when:** a client books, consents, intakes, is reminded, and reads her steps entirely in
isiXhosa, while the counsellor and the funder report stay in English. Still zero clinical risk.

### 32.2 - The Language Rail on mock (target: 2 weeks) - THE DEMO GATE

Migration 0063. `TranslationProvider` interface plus `mock.ts`. The full rail, every state, the
client caption surface, the pre-session banner, the settings surfaces, the blocked states. The
scripted fixture (section 10) deliberately includes low-confidence, mixed-language, backchannel and
one flagged segment so the **difficult** states are what gets demoed, not the happy path.

**Done when:** your NGO partner sits in front of a laptop and walks a full bilingual session,
including the moments where it goes wrong, without a vendor contract existing. This is the Part-A
gate applied to this phase.

### 32.3 - Real, in region (target: 4 to 6 weeks, gated)

**Hard dependencies, all of which must be green first:** LiveKit self-hosted in `af-south-1` with
TLS (open item on Phase 13). Postgres migrated to an SA region (open item on Phase 19). DPIA
amendment signed. Human-translated consent copy reviewed and live.

Then: the vendor integration, the LiveKit agent, the admin card, metering and credits, the risk and
confidence pipeline, the lexicon, and the supervised pilot in section 12.

### 32.4 - Client audio (conditional, do not schedule)

Only if and when 32.3's evidence supports it. May well belong at intake and reception rather than in
the therapy hour. Decide with data, not with roadmap momentum.

---

## 9. SAFETY SPECIFICATION

The most important section in this document.

### 9.1 What the system must never do

- Never render a translation of a risk disclosure **without** the source phrase verbatim beside it.
- Never generate, translate into, or surface **method language**. This is the existing Rule 8 applied
  to a new output path: if a source utterance contains method detail, the segment is marked for the
  counsellor's attention and the **source is shown**, but the system does not produce a fluent
  translated rendering of it.
- Never auto-action. No auto risk flag on the client record, no auto notification, no auto escalation,
  no auto-populated safeguarding panel. Detection **surfaces to a human**, full stop.
- Never triage. A flag means "look at this", never "this is a level 3 risk".
- Never silently drop or smooth a segment it is unsure about.
- Never let translation quality be the reason a session cannot continue.

### 9.2 Where risk-term matching lives

Deliberately **not** an admin-browsable table and **not** in the client bundle.

- The matcher is server-only, inside the agent, never exported to any client surface.
- The term list is maintained **offline** by the clinical partner and a bilingual clinician, imported
  as an encrypted artifact, and never rendered as a browsable list anywhere in the product. Making
  the list visible in an admin UI turns a safety mechanism into a reference document.
- The matcher is a **safety net, never the primary detection**. The counsellor is the detector.
  Design and copy must never imply the machine is watching for risk on the counsellor's behalf,
  because a counsellor who believes that will look less hard.
- Matching is on the **source** language, never on the translation. Matching a translation means the
  model has already had a chance to get it wrong.

### 9.3 The zero-tolerance category

**Negation inversion.** A model that renders "I do not want to hurt myself" as "I want to hurt
myself", or the reverse, is not a quality problem. It is a category of failure that ships people to
harm in both directions: a false positive destroys trust and can trigger an unnecessary involuntary
process, a false negative misses the disclosure entirely.

Acceptance testing (section 12) includes a dedicated negation suite per language pair. **Any
negation inversion in a risk-adjacent segment is a hard fail and blocks the pilot**, regardless of
aggregate scores.

### 9.4 The clinical lexicon

The compounding asset. Built with the partner, not licensed.

- **Idioms of distress.** Somatic and spiritual expressions of psychological pain that carry no
  direct English equivalent and that general MT will flatten into something clinically misleading.
- **Instrument items.** A machine-translated PHQ-9 is **not** a validated PHQ-9. Where a validated
  translation exists, use it and cite it. Where one does not, the instrument is offered in the
  original language or not at all, and the reporting shows honest coverage.
- **Consent and safeguarding strings.** Human-translated, reviewed, versioned.
- **Cultural and spiritual framings** of illness and healing that do not map to a DSM concept and
  should not be forced to.

Fed by `lexicon_flags` from real sessions, reviewed by a clinician, promoted to `active`. That loop
is what nobody else will build for these languages, and it is worth more over three years than the
model choice.

---

## 10. THE MOCK

Per Rule 4. `lib/mock/fixtures/interpretation.ts`, a scripted transcript replayed with realistic
timing, so the entire rail is demoable with no vendor, no key and no network.

Deliberately includes, in this order:

1. Two clean high-confidence exchanges, so the happy path reads well.
2. A backchannel from the counsellor, rendering as the faint marker.
3. A **code-switched** client utterance, detected as `mixed`, so the indicator is exercised.
4. A **medium-confidence** segment with the source auto-expanded.
5. A **low-confidence** segment showing the "unclear" chip, and, on the client-side preview, showing
   that it was withheld from her entirely.
6. A **flagged** segment showing the `--danger` rule, verbatim source above translation, and the
   calm "Check this with her" label.
7. A **provider drop**, so the `--danger` status dot and the "translation is unavailable, the
   session continues" state are on screen in the demo.
8. Recovery.

Two commitments about this fixture. First, timing is real: partials arrive before finals, with a
realistic delay, driven by the injectable `lib/clock.ts` so runs are deterministic in CI. Second,
**the demo shows the failures**. Demoing only the happy path to a clinical partner is how you get
enthusiastic agreement to something nobody has stress-tested.

Seeded onto the existing Masizakhe tenant: Lerato Mahlangu's `home_language` set to isiXhosa,
Nomsa's `spoken_languages` to English and Afrikaans, one seeded `session_interpretation` on a past
completed session, and an org lexicon with a handful of reviewed idiom entries.

---

## 11. METERING, ENTITLEMENT, COST

- New W3 feature key `language_rail`, resolved through the existing chain: platform kill-switch, then
  per-org override, then plan entitlement, then org self-toggle.
- New credit channel `interpretation_minutes` on the existing `credit_balances` and `credit_ledger`.
  Same append-only idempotent ledger, same packs in `/hub/billing`, same low-balance nudge on the
  Hub overview.
- Per-org monthly minute cap in `org_language_settings`, surfaced as a progress bar beside the
  existing AI spend bar.
- `interpretation_usage` mirrors `ai_usage` row for row so the two report identically.
- Plan entitlements: Tier 1 languages on the paid tiers, a small monthly allowance on the entry tier
  so a single community practice can actually try it.

**Pricing note for the funding conversation.** Do not price this per minute to the org. Price it as
part of a **language access** capability the org can put on a grant application, because that is
what it is worth to them. A per-minute meter is how you account for it internally, not how you sell
it.

---

## 12. ACCEPTANCE, TESTING AND THE PILOT

### 12.1 Why WER and BLEU are the wrong bar

Word error rate and BLEU are not clinically meaningful. A translation can score well and still lose
the thing that mattered, and it can score badly on wording while conveying exactly the right meaning
and affect. Use a **clinical adequacy rubric** scored by bilingual counsellors on blind segments.

| Dimension | Question | Bar |
|---|---|---|
| Meaning | Is the clinical meaning preserved? | >= 90% of segments rated adequate |
| Affect | Is emotional register preserved, not flattened? | >= 80% |
| Idiom | Are idioms of distress conveyed, not literalised? | >= 75%, rising as the lexicon grows |
| **Negation** | **Any inversion in a risk-adjacent segment?** | **Zero. Hard fail.** |
| Latency | p95 final segment | < 1.5s |

### 12.2 Tests to add

- **Unit:** confidence banding, segment assembly, backchannel suppression, the content-translation
  resolver fallback chain, language-code validation, minute rounding and metering.
- **Unit, dedicated:** the negation suite per language pair. Grows with every flagged segment.
- **Integration:** consent gate refuses to open a stream without `interpretation` granted; retention
  writes nothing without `transcript_retention`; RLS leak proof on all four new tables as the
  `phila_app` role; credit exhaustion blocks the next session and never the current one; region
  validation refuses Live mode outside the SA allowlist.
- **E2E:** two browsers, counsellor and client, the full mock rail at 1280px and 360px, including the
  provider-drop and recovery path.
- **Compliance sweep (extends the Phase 31 CI sweep):** no segment text in any funder payload; no
  segment text in any cross-role payload; consent and safeguarding strings never resolve from a bare
  machine source; every rail session writes a `session_interpretation` provenance row; the risk
  matcher is never present in a client bundle.

### 12.3 The pilot

Ten to fifteen language-discordant sessions, all consented, all supervised, with a debrief after
each one. Both counsellor and client asked afterwards. The counsellor scores the rubric.

**Stop conditions, agreed in writing before the first session:** any negation inversion, any client
distress attributable to the tool, p95 latency above 2.5s, or a counsellor reporting that the rail
pulled attention away from the person in front of them. Any one of those stops the pilot and the
feature goes back to 32.2.

---

## 13. COMPLIANCE DELTAS

- **DPIA amendment.** Voice is biometric special personal information. New processing purpose, new
  lawful basis, new sub-processor, new residency argument. Section 2 of this document is the
  substance of it.
- **s72 sub-processor register** (already built in Phase 31): add the ASR and MT provider, with the
  region recorded. If processing is fully in-region there is no s72 cross-border transfer for this
  feature, which is the point.
- **Consent copy**, human-translated, reviewed by a bilingual clinician, versioned, for both new
  purposes, in every Tier 1 and Tier 2 language.
- **Retention policy:** default zero retention for segments. When retention is on, segments inherit
  the existing HPCSA-derived retention clock from Phase 31, and DSAR export must include them.
- **POPIA pack** (`/reports/popia`): include interpretation consent records, the provenance rows and
  the retention posture.
- **Professional standards:** confirm the HPCSA telehealth position on interpreted sessions before
  the pilot, and record the counsellor as author of record for any note informed by an interpreted
  session, exactly as the scribe already does.

---

## 14. EXPLICITLY OUT OF SCOPE FOR V1

Written down so they do not creep in.

- Voice cloning of the counsellor. Never.
- Synthetic voice replacing the client's voice for the counsellor. Never.
- Automatic risk triage or severity scoring.
- Machine-translated clinical instruments presented as validated.
- Translation of the Phila product interface.
- Group, couple or family sessions with more than two languages. The backlog item for multi-client
  sessions lands first.
- Sign language interpretation. Recorded as a need, not served.
- Any language pair not on Tier 1 for the live rail.
- Retention of segments by default.

---

## 15. OPEN QUESTIONS FOR THE PARTNER

These change the plan materially, so ask before 32.2 rather than after.

1. **How many sessions per month are language-discordant?** An actual tally over four weeks, not an
   estimate. If it is small in her org, the pilot needs a second site.
2. **What happens in those sessions right now?** If the answer includes family members interpreting,
   that is a safeguarding finding worth documenting, and in GBV work it is a serious one. It is also
   the strongest funding argument in this entire document.
3. **Which pairs, in order of volume?** This decides Tier 1 and the vendor conversation.
4. **Would her counsellors accept text-only in v1**, or is client-side audio a blocker to adoption?
5. **Who is the bilingual clinician** who reviews the lexicon and the consent copy? This role is
   required, it is not optional, and it should be paid.
6. **Which of her funders would recognise language access as an indicator?** If one would, 32.0
   alone justifies the phase.

---

## 16. THE SHORT VERSION

Phila already has the video, the consent architecture, the audit trail, the metered-cost model, the
provider-integration pattern, the mock seam and the distribution. This phase is composition, not
invention.

The sequence that makes it safe is: **record the language first, translate the content second, build
the rail on mock third, and only then process a single second of anyone's voice** - in South Africa,
transiently, with the source as the record and a human as the author.

Do that, and Phila can make a claim no global platform can: a counselling session held across a
language barrier, where the client's voice never leaves the country and her own words remain the
record of what she said.

---

*Phila · philasa.com · Phase 32 plan · Prepared 2026-08-06 · Stack: Next.js · Neon · Better Auth ·
Supabase Storage · LiveKit · TranslationProvider*

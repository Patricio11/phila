# Phase 33.9 COMPLETE - VoicePhila provider switchboard + Africa's Talking adapter (2026-08-21)

**33.9a - the switchboard.** Super-admin -> Integrations -> VoicePhila is now a switchboard: three
provider cards (Mock (dry run) / Twilio / Africa's Talking), each with credentials + Test
connection; exactly ONE active at a time (or none = the rail off). A provider cannot go active
until its Test passed (Mock always may - it dials nothing); changing credentials clears the tested
flag, and if that provider was active the rail honestly falls back to off. Every switch is audited
`voice_switch_<from>_to_<to>`. Orgs and counsellors see nothing of this - the call button just
works. Legacy 33.2 single-Twilio configs decode transparently (`decodeSwitchboard`, unit-tested):
a live Twilio setup survives the upgrade untouched.

**33.9b - the Africa's Talking adapter** (code-complete; INACTIVE until 33.9c is confirmed).
`lib/voice/africastalking.ts`: initiate via AT's `/call` (username + apiKey), bridge on answer with
the Dial XML (client number, shared callerId, `maxDuration=3600` runaway cap, `record="false"`),
final notification mapped to the internal leg shape (durationInSeconds -> system metering; amount /
currencyCode acknowledged but NEVER billing - org minutes are always system-measured). AT does not
sign callbacks: authenticity is an unguessable token in the callback URL
(`/api/webhooks/voice-at/<token>`, generated on save, shown with a Copy button) plus the rule that
only legs Phila placed are ever bridged (unknown session -> `<Reject/>`). `username: "sandbox"`
routes to AT's sandbox hosts, so the 33.9c SA validation checklist runs through Phila itself; Test
connection reads the wallet and names the currency (the "billed in ZAR?" signal).

**Cross-provider correctness.** Every `voice_call_legs` row records its `provider` (migration
0090) and Africa's Talking legs carry `bridge_to` (the client's E.164) until the call ends, then
it clears. Each provider's webhook door verifies with its OWN stored credentials whatever is
active - so a provider switch applies to NEW calls only and in-flight calls settle correctly. The
settle path was extracted to `lib/voice/settle.ts` so every provider runs the identical money
path: idempotent per-leg billing, low-credit warning, the system-measured "held by phone" stamp.

**Proven live** (production build): legacy config decoded with Mock active; AT configured with a
sandbox-shaped fake key -> Test failed honestly -> Make active DISABLED (the gate); Mock activated
(audited). A real mock call placed from the session page (leg `provider: mock`), settled by
webhook: 185 s -> 4 billed minutes, balance 50 -> 46. An AT leg: the token door answered the bridge
XML (`phoneNumbers="+27821234567" callerId="+27100000001" maxDuration="3600"`), the final
notification settled it (125 s -> 3 min, `bridge_to` cleared); a wrong token got 403. 12 unit tests
on the switchboard rules, legacy decode, AT status mapping and Dial XML. Test data reverted.

**Still open - 33.9c** (the super-admin's real-world checklist, deliberately not code): SA mobile
rate vs Twilio, SA virtual number + RICA lead time, real-call quality, ZAR billing, one end-to-end
sandbox call - all runnable through the switchboard. Until it passes, Africa's Talking stays
configured-but-inactive.

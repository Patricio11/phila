# Information Officer — registration checklist

*For Phila itself AND as the reference behind the in-app nudge each org sees
(Settings → Security & data). Registration is a once-off online form with the
Information Regulator; the head of the organisation is the default IO under POPIA.*

## For each organisation (responsible party)
- [ ] Decide who the IO is (default: the head of the practice; a deputy may be delegated).
- [ ] Register on the Information Regulator's eServices portal: https://justice.gov.za/inforeg/portal.html
- [ ] Keep the registration reference with the practice's records.
- [ ] Tick "Done" on the in-app nudge (Settings → Security & data) so it stops reminding.

## For Phila (the operator) — platform duties, done once
- [ ] Appoint + register Phila's own Information Officer.
- [ ] Complete the DPIA (docs/compliance/DPIA.md) and keep it current.
- [ ] Maintain the sub-processor/DPA register (`lib/compliance/subprocessors.ts` — one edit + deploy).
- [ ] Breach process: log → contain → identify → notify via `/admin/compliance` (POPIA s22).

*The in-app nudge is deliberately optional and dismissible — it never blocks product use (Phase 31 governing principle).*

# Demo logins

Real accounts seeded into the database (`npm run db:seed`) for **Masizakhe Counselling**.
All sign in at **`/login`** — or use the one-click role buttons on that page.

> **Password for every account: `phila1234`**

| Role | Email | Lands on | Notes |
|------|-------|----------|-------|
| Counsellor (supervisor) | `nomsa@masizakhe.org.za` | `/app` | Nomsa Dlamini · HPCSA · supervises the team |
| Counsellor | `thabo@masizakhe.org.za` | `/app` | Thabo Mokoena · ASCHP (pending) |
| Counsellor | `aisha@masizakhe.org.za` | `/app` | Aisha Patel · HPCSA |
| Counsellor | `pieter@masizakhe.org.za` | `/app` | Pieter van der Merwe · SACSSP |
| Practice admin (Hub) | `thandeka@masizakhe.org.za` | `/hub` | Thandeka Mbeki · runs the practice |
| Client | `lerato.m@example.co.za` | `/me` | Lerato Mahlangu · client portal |
| Funder | `palesa.mokoena@dsd.example.gov.za` | `/funder` | Palesa Mokoena · DSD · read-only, scoped |
| Super admin | `ops@philasa.com` | `/admin` | Sizwe Ndlovu · platform console |

## Notes
- These are **development credentials** for the seeded demo org. They are not for production; real users set
  their own passwords via sign-up / invite activation.
- Re-seed any time with `npm run db:seed` (idempotent — safe to re-run; it won't duplicate or overwrite users).
- Routing is by role: the sign-in Server Action resolves each account's platform role / team role from the DB
  and redirects to the right home.

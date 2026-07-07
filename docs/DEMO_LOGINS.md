# Demo logins

Real accounts seeded into the database (`npm run db:seed`) for **Masizakhe Counselling**.
All sign in at **`/login`** with the password below.

> **Password for every account: `phila1234`**

| Role | Email | Lands on | Notes |
|------|-------|----------|-------|
| Counsellor (supervisor) | `nomsa@masizakhe.org.za` | `/app` | Nomsa Dlamini · HPCSA · supervises the team |
| Counsellor | `thabo@masizakhe.org.za` | `/app` | Thabo Mokoena · ASCHP (pending) |
| Counsellor | `aisha@masizakhe.org.za` | `/app` | Aisha Patel · HPCSA |
| Counsellor | `pieter@masizakhe.org.za` | `/app` | Pieter van der Merwe · SACSSP |
| Practice admin (Hub) | `thandeka@masizakhe.org.za` | `/hub` | Thandeka Mbeki · runs the practice |
| Front desk | `frontdesk@masizakhe.org.za` | `/hub` | Lindiwe Khoza · reception / scheduling |
| Finance | `finance@masizakhe.org.za` | `/hub` | Riaan Steyn · invoicing & billing |
| Programme manager | `programmes@masizakhe.org.za` | `/hub` | Bongani Nkosi · M&E / funders *(archived member — reactivate to sign in)* |
| Client | `lerato.m@example.co.za` | `/me` | Lerato Mahlangu · client portal |
| Funder | `palesa.mokoena@dsd.example.gov.za` | `/funder` | Palesa Mokoena · DSD · read-only, scoped |
| Super admin | `ops@philasa.com` | `/admin` | Sizwe Ndlovu · platform console |

## Second org — Thrive EAP (`org_thrive`)

A separate, fully-seeded tenant (own counsellor, clients, sessions, a paid invoice) so
**tenant isolation / RLS** is demonstrable: sign in as Thrive and you see only Thrive's
data, never Masizakhe's.

| Role | Email | Lands on | Notes |
|------|-------|----------|-------|
| Practice admin (Hub) | `admin@thrive-eap.co.za` | `/hub` | Adri Louw · runs Thrive EAP |
| Counsellor | `counsellor@thrive-eap.co.za` | `/app` | Dr Yolanda Meyer · HPCSA · 4 clients |

## Forms (Phase 18.6)
- The Hub's **Forms** library (`/hub/forms`) is seeded with an **Intake** form and a themed **"After your session"**
  feedback form. Open the feedback form → **Responses** to see the open **share link**, or visit it directly (no login):
  **`/f/s_feedback_masizakhe`** (a two-pane themed page). Per-client fill links look like `/f/<token>`; a signed-in
  client sees their assigned forms at **`/me/forms`**.

## Notes
- These are **development credentials** for the seeded demo org. They are not for production; real users set
  their own passwords via sign-up / invite activation.
- Re-seed any time with `npm run db:seed` (idempotent  safe to re-run; it won't duplicate or overwrite users).
- Routing is by role: the sign-in Server Action resolves each account's platform role / team role from the DB
  and redirects to the right home.

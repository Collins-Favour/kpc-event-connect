# KPC Registration & Attendance Management System

Built on React + TanStack Start with Lovable Cloud (managed PostgreSQL, secure auth, server-side API). Laravel/PHP cannot run on this platform, but the architecture, data model, role rules, and workflows below match the specification exactly. Server-side logic replaces Laravel controllers/policies; PostgreSQL row-level security plus role checks replace Laravel policies. No client ever talks to PostgreSQL directly with elevated rights.

## Architecture

```text
React UI (registrar + admin)
        |  HTTPS
Server functions (validation, authorization, business rules)
        |
Managed PostgreSQL  ---  Audit logs  ---  SMS logs (provider wired later)
```

- One centralized users/profile model, three roles: REGISTRAR, ADMIN, SUPER_ADMIN.
- Roles stored in a dedicated `user_roles` table (never on the profile) and checked by a security-definer function, so privileges cannot be escalated from the client.
- Every write goes through a server function that re-checks role and status; hiding UI is never the security boundary.

## Database (Phase 1)

Tables, with foreign keys and timestamps in Africa/Nairobi presentation, UTC storage:

- `profiles` — name, email, phone, status (PENDING/ACTIVE/SUSPENDED/DISABLED), last_login_at
- `user_roles` — user_id + role enum (unique per pair)
- `events` — name, description, start_date, end_date, venue, status
- `ministries` — name, status (KPC seeded as the home ministry)
- `registration_desks` — name, code, location, description, status (deactivate, never delete)
- `registrar_assignments` — user_id, event_id, registration_desk_id, started_at, ended_at, status
- `attendees` — registration_number, full_name, phone, email, location, attendance_type (HOME/GUEST), ministry_id, gender (male/female), is_youth, event_id, registration_desk_id, registered_by, registrar_assignment_id, registered_at
- `audit_logs` and `sms_logs` created now (structure only; SMS provider wired in a later phase)

Data integrity: attendees store the desk, assignment, and registrar captured at registration time. Reassigning a registrar later never changes historical rows. Registration numbers come from a database sequence in `KPC-000001` format, unique-constrained.

Access rules: registrars can insert attendees only for their own active assignment and cannot read the attendee list; admins read everything except super-admin management; super admins manage administrators, and super-admin accounts are protected from deletion or demotion by ordinary admin flows. Every table gets explicit grants plus RLS policies.

## Phase 1 — Foundation

- Cloud enabled, full schema migration with grants, RLS, indexes.
- Two super-admin accounts provisioned through a protected setup flow (no credentials in source).
- Auth: email + password login, session-aware routing, role-based route gates.
- Seed data: KPC ministry, one sample event, four desks (DESK-01..04).

## Phase 2 — Registration flow

- `/registration/login` — registrar sign-in.
- `/registration` — registrar home showing name, active event, and assigned desk with a single large REGISTER ATTENDEE action.
- Progressive, chat-like registration: HOME or GUEST choice first, then one question at a time.
  - HOME: attendance_type and ministry auto-set to KPC; collects full name (required), location (required), gender (required, single choice), phone/email/youth optional.
  - GUEST: same plus ministry/church selected from the ministries list (required).
- Server-side validation mirrors the rules; timestamp and registration number are assigned by the server only.
- Success screen shows the registration number with an immediate REGISTER NEXT PERSON action.
- Duplicate warning (same phone within the same event) shown as a confirmable warning, never a hard block.
- Registrars are blocked server-side from admin endpoints.

## Later phases (not in this build)

Phase 3 admin dashboard and management, Phase 4 super-admin/approval/audit UI, Phase 5 reporting and CSV/Excel/PDF export, Phase 6 Africa's Talking SMS (credentials added as server-side secrets when you have them), Phase 7 check-out, offline queue, QR.

## Technical notes

- Routes: registrar surfaces under a protected layout; admin surfaces added in Phase 3 under a separate gated layout.
- Registration writes run in one server function that resolves the active assignment from the session, so the desk is never chosen manually per attendee.
- Mobile-first layout, large touch targets, distinctive KPC visual identity rather than default template styling.
- Secrets stay in server-side environment variables only.

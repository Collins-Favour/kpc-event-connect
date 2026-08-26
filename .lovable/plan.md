# Multi-Tenant Event Registration Platform

Refactor the existing KPC system into a generic, multi-tenant event registration platform. Internal working name: **Registry** (placeholder, no product name committed).

## Stack reality check

The spec asks for Java + Spring Boot + Flyway. This platform cannot run a JVM backend — it runs React + TanStack Start with server functions on managed PostgreSQL. Every backend requirement still holds and maps directly:

| Spec | Implementation here |
| --- | --- |
| Spring controllers/services | Server functions (`createServerFn`), business logic in `.server.ts` services |
| Spring Security + policies | Auth middleware + server-side space membership checks + row-level security |
| JPA/Hibernate | Typed Postgres queries |
| Flyway | Versioned migrations |
| Actuator | Platform health/metrics view |
| HikariCP | Managed connection pooling |

Frontend stays React + TypeScript. No direct database access from the browser for tenant data — all writes go through server functions.

## What is kept, what changes

Kept: the whole React/TanStack app shell, UI component library, session handling, error handling, server-function + auth-middleware patterns, the progressive registration UX (generalized), audit log concept, SMS log concept.

Replaced: everything KPC-specific — ministries, home/guest, youth/gender as hard-coded columns, single-tenant desks, the setup page, the KPC visual identity. Existing KPC tables are dropped (clean rebuild, as agreed) and their pages retired in favour of the Space model.

## Data model (new schema)

```text
users(profiles) → space_members → spaces → events → registration_templates → template_fields
                                            ↓
                              registration_desks → desk_tokens → registration_sessions
                                            ↓
                              registrations → registration_field_values
```

- `profiles` — platform identity (name, email, avatar, last_login_at)
- `platform_admins` — platform super admin, separate from any space role
- `spaces` — name, slug, type (INDIVIDUAL/ORGANIZATION/TEAM), contact info, timezone, status, branding columns reserved (logo_url, primary_color, accent_color)
- `space_members` — user + space + role (SPACE_SUPER_ADMIN / SPACE_ADMIN) + status; roles live here, never on the user
- `space_invitations` — email, role, token hash, status (PENDING/ACCEPTED/EXPIRED/REVOKED), expires_at
- `events` — space-scoped, name, dates, venue, status, created_by
- `registration_templates` + `registration_template_fields` — label, field_key, field_type (text/number/email/phone/date/select/multiselect/checkbox/radio), required, options (jsonb), display_order, active, is_system
- `registration_desks` — space + event, name, code, location, status
- `desk_tokens` — 8-char cryptographically random code stored as a hash, plus expires_at, status, desk/event/space
- `registration_sessions` — token, space, event, desk, started_at, ended_at, status
- `registrations` — registration_number (`EVT-0000001`, per-event sequence), space/event/desk/session ids, primary fields (full_name, phone, email, location), registered_at
- `registration_field_values` — registration + field + value (relational, not one big JSON blob)
- `audit_logs`, `sms_logs` — space-scoped

Isolation: every tenant table carries `space_id`; row-level security plus a `is_space_member(space_id, role)` security-definer function gates all reads. Writes go through server functions that resolve `space_id` from the authenticated membership, never from the request body. Registration writes are authorized by the server-validated session token, not by the client-supplied space id.

Integrity/concurrency: per-event registration-number sequence, unique constraints on codes/tokens/slugs/member pairs, single transactional insert per registration, indexes driven by actual query paths (space_id+event_id, event_id+registered_at, desk_id, session_id, token hash lookup).

## Authentication

Google sign-in is primary ("Continue with Google"), email/password kept as a secondary option. The Google provider is configured in the same change. One auth system; authorization is resolved per Space at request time.

## Screens

**Public**
- `/` — calm landing page: product line, JOIN and CREATE, minimal text
- `/join` — desk token entry → verified panel showing Space / Event / Desk → START REGISTRATION
- `/create` — after sign-in: Individual / Organization / Team, then Space details; creator becomes SPACE_SUPER_ADMIN
- `/login` — Continue with Google, email/password below
- `/invite/:token` — accept an admin invitation

**Registrar (token session, no admin account)**
- `/desk/:sessionId` — dynamic form built from the event's template, large touch targets, one clear step per group, submit disabled while in flight, success screen with registration number and REGISTER NEXT PERSON

**Space app (`/s/:spaceId/...`)**
- Overview, Events, Attendees, Desks, Templates, Members, Reports, Settings
- Compact space switcher; navigation items filtered by role

**Platform**
- `/platform` — platform super admin: spaces list, suspend, platform stats

## Design system

Deep navy `#0B1F3A` / secondary `#122B49` surfaces, warm off-white `#F7F5F0` canvas, soft gray `#EEF1F4`, tiger orange `#F28C28` used strictly as an accent. Single typeface: Plus Jakarta Sans. All values as semantic tokens; no per-page styling. Motion 150–300ms on transform/opacity only, honoring `prefers-reduced-motion`: page and tab transitions, modal/dropdown entry, token verification, success states, list item entry. No decorative blobs, no emojis, restrained icons, restrained shadows and radii.

## Build order

1. **Foundation** — schema migration (drop KPC tables, create the new model with grants, RLS, indexes), Google auth, profiles, spaces, memberships, space creation flow, space switcher, design system.
2. **Registration architecture** — templates + field builder, desks, secure token generation/revocation, sessions, dynamic registration write path.
3. **Space admin** — overview dashboard, events, template builder UI, desks and tokens, members and invitations.
4. **Registrar** — join, token verification, dynamic form, success/next-person loop.
5. **Reports** — paginated attendee tables, desk/event/time/demographic reports, CSV + Excel + PDF export designed so large exports can move to background jobs.
6. **Hardening** — tenant isolation tests (Space A cannot reach Space B), audit logs across all listed actions, rate limiting on token validation and registration, error taxonomy (400/401/403/404/409/422/429/500) with clean user-facing messages, index and query review, platform health view.

Not in scope: payments, ticketing marketplace, AI, CRM, custom domains, white-labeling, offline sync, native apps — the model leaves room for them.

## Notes

- SMS stays behind a provider-agnostic service interface; Africa's Talking credentials are server-side secrets added when you have them.
- Timestamps are server-generated in UTC, displayed in the Space timezone.
- Managed Postgres already provides SSL, automated backups and monitoring; the backup/recovery approach will be documented with Phase 6.

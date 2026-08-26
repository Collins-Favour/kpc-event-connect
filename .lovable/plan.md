# Navigation, Yes/No fields, and platform super admin

## 1. Navigation everywhere
- Add a small reusable page header component with a Back control (browser history back) plus a "Home" link, used on all space pages, create-space, platform, and attendee/desk sub-pages.
- Space layout: on desktop keep the sidebar, add breadcrumbs (Space > Section) at the top of the content area; on phone/tablet add a sticky top bar with back arrow, section title, and a menu for the space sections.
- Keep the existing sign-out and space-switcher controls in place.

## 2. Yes/No field type in registration templates
- Add a `BOOLEAN` (labelled "Yes / No") option to the template field types.
- Template builder: choosing Yes/No hides the options editor and stores fixed Yes/No choices.
- Registration form: renders as a two-button Yes/No toggle (large, thumb-friendly), stored as `Yes`/`No` text so existing reports/exports keep working.
- Also make form building faster: quick-add presets (Gender: Male/Female, Yes/No question) so an admin can add a common field in one click.

## 3. Platform super admin
- Seed `otictechnologieshq@gmail.com` as the platform super admin: it is granted automatically the moment that verified account signs in (safe trigger on account creation/verification), so no manual step is needed.
- Platform admins can add and remove other platform admins by email from the Platform page.
- Space membership loses the "Super admin" option: inviting or promoting inside a space can only produce a regular Space Admin. The space creator stays the space owner; existing space super admins keep their role.
- Platform page becomes a real dashboard with overall power:
  - Platform-wide metrics (spaces, users, events, registrations, activity over time).
  - Full space list with search, status filter, suspend/reactivate/archive.
  - Drill into any space: its events, desks, attendee counts, members.
  - Platform admin management list.
  - Recent audit activity across all spaces.

## Technical notes
- Database migration: add `BOOLEAN` to the `field_type` enum; add a security-definer trigger granting platform admin to the seeded verified email; keep `platform_admins` reads restricted.
- New server functions: `listPlatformAdmins`, `addPlatformAdmin`, `removePlatformAdmin`, `getPlatformOverview`, `getSpaceDetailForPlatform` — all guarded by `is_platform_admin` before any admin-client work.
- `updateMemberRole`/`inviteMember` validators narrow to `SPACE_ADMIN` only.
- Navigation is presentation-only; no changes to registration or tenant-isolation logic.

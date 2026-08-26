# Dynamic attendee segmentation, saved filters and export

Admins should be able to slice attendee records any way they need — "all youths", "all women", "everyone from Nakuru", "this ministry", "registered in the last hour / last 7 days" — and export the result. Filters should be saveable and reusable across events so a space never rebuilds the same segment twice.

## What gets built

### 1. Dynamic filter builder (Attendees page)
A filter bar plus an "Add filter" builder that reads the space's registration form fields, so the available filters adapt to whatever each organisation collects.

- Built-in filters: event, desk, free-text search, registered-between date range.
- Quick time chips: Last hour, Today, Last 7 days, Last 30 days, This month, All time.
- Custom-field filters: pick any field on the space's forms (Ministry, Gender, Age group, Location, Yes/No questions...) and choose values.
  - Select / Radio / Yes-No / Checkbox fields → value checkboxes (is any of).
  - Text / Email / Phone → contains.
  - Number / Date → between (min/max).
- Multiple filters combine with AND; multiple values inside one filter combine with OR.
- Live result count and matching rows in the table, with the same pagination as today.

### 2. Saved segments (reusable)
- Save the current filter set with a name ("Youth — Nairobi", "Women's ministry").
- Saved segments belong to the space, so any admin in that space can re-apply them later, on any event.
- Segments can be applied, renamed, and deleted. Optionally pinned to the top as one-click chips.

### 3. Export
- Export the currently filtered set to CSV (and a printable view for reports).
- Columns include the standard fields plus one column per custom field found in the results.
- Export respects every active filter and exports the full match, not just the current page.
- Row cap of 20,000 per export with a clear message when a segment exceeds it.

### 4. Reuse of form structure across events
So "if I'm from org X I can always reuse it": on the Templates page, add
- **Copy fields from another event** — pick an existing event in the space and clone its form fields into the current one.
- **Save as space preset / apply preset** — a named field set stored at space level that can be applied to any new event, so field keys stay consistent and segments keep working across events.

### 5. Reports on every field, easy to share, universal formats
- Report builder on the Reports page: pick any field (built-in or custom) and get counts, percentages, and a chart — plus cross-tabs (e.g. Gender by Location, Ministry by Event).
- Every report and attendee list respects the active filter/segment.
- Export formats everywhere: CSV, Excel (.xlsx), PDF, and a clean print view. Charts included in the PDF.
- Sharing: copy a link that reproduces the exact filter/segment for other admins in the space, plus one-click copy-to-clipboard of the summary table and email/WhatsApp share of the exported file.

### 6. Help & support channels
- **Desk help button**: a persistent "Need help?" button on the registration desk screen. Opens a short form (topic + message, desk/event auto-attached) that raises a request to the space's admins. Works for signed-in registrars and desk-token sessions.
- **Space admin → platform**: a "Contact platform support" panel in Space Settings where space admins raise issues to platform admins.
- **Inboxes**: space admins see desk requests in a Support tab inside the space; platform admins see space complaints in a Support section of the platform dashboard. Each request has status (Open / In progress / Resolved), a reply thread, and timestamps.
- Unread counts badge the relevant nav item so requests are not missed.



## Technical notes

- New tables (migration, with grants + RLS scoped to space membership, following existing `private.is_space_member` policy pattern):
  - `saved_segments` — space_id, name, definition (jsonb filter set), created_by, timestamps.
  - `template_presets` — space_id, name, fields (jsonb), timestamps.
- New server functions in `src/lib/reports.functions.ts` / a new `segments.functions.ts`:
  - `listRegistrations` extended with a validated `filters` array (field_key, operator, values).
  - Custom-field filtering resolved server-side by intersecting `registration_field_values` matches per filter, then applying the resulting registration ids to the main query — keeps tenant isolation and RLS intact.
  - `exportRegistrations` returns rows for CSV generation on the client.
  - `listSegments` / `saveSegment` / `deleteSegment`, all behind `requireSupabaseAuth` + `requireMembership`.
- Template preset/copy functions added to `src/lib/events.functions.ts`, reusing existing field validation.
- UI work in `s.$spaceId.attendees.tsx` (filter builder, segment chips, export button), `s.$spaceId.templates.tsx` (copy/preset), `s.$spaceId.reports.tsx` (filter-aware breakdowns), plus a shared `AttendeeFilters` component so attendees and reports share one filter model.

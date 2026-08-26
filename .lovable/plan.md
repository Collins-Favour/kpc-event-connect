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

### 5. Reports page
Breakdown charts respect the active filter/segment, so a saved segment can be viewed as counts by field value and exported.

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

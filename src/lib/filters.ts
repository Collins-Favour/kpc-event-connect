import { z } from "zod";

/**
 * A single attendee filter. `source` decides where the value lives:
 * built-in columns on `registrations`, or a configurable template field
 * stored in `registration_field_values`.
 */
export const filterSchema = z.object({
  key: z.string().trim().min(1).max(60),
  source: z.enum(["builtin", "custom"]).default("custom"),
  op: z.enum(["in", "contains", "between"]).default("in"),
  values: z.array(z.string().trim().max(120)).max(50).default([]),
});

export type AttendeeFilter = z.infer<typeof filterSchema>;

export const filterSetSchema = z.object({
  eventId: z.string().uuid().optional(),
  deskId: z.string().uuid().optional(),
  search: z.string().trim().max(80).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  range: z.string().max(20).optional(),
  filters: z.array(filterSchema).max(12).default([]),
});

export type FilterSet = z.infer<typeof filterSetSchema>;

export const QUICK_RANGES = [
  { id: "all", label: "All time" },
  { id: "hour", label: "Last hour" },
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
] as const;

export type QuickRange = (typeof QUICK_RANGES)[number]["id"];

/** Turns a quick range chip into an absolute ISO window. */
export function rangeToWindow(range: string | undefined): { from?: string; to?: string } {
  const now = new Date();
  switch (range) {
    case "hour":
      return { from: new Date(now.getTime() - 3600 * 1000).toISOString() };
    case "today": {
      const d = new Date(now);
      d.setUTCHours(0, 0, 0, 0);
      return { from: d.toISOString() };
    }
    case "7d":
      return { from: new Date(now.getTime() - 7 * 86400 * 1000).toISOString() };
    case "30d":
      return { from: new Date(now.getTime() - 30 * 86400 * 1000).toISOString() };
    case "month": {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { from: d.toISOString() };
    }
    default:
      return {};
  }
}

export const BUILTIN_FILTER_FIELDS = [
  { key: "location", label: "Location", type: "TEXT" },
  { key: "phone", label: "Phone", type: "PHONE" },
  { key: "email", label: "Email", type: "EMAIL" },
] as const;

/** Choose the right operator for a template field type. */
export function opForType(type: string): AttendeeFilter["op"] {
  if (["SELECT", "MULTISELECT", "RADIO", "CHECKBOX", "BOOLEAN"].includes(type)) return "in";
  if (["NUMBER", "DATE"].includes(type)) return "between";
  return "contains";
}

export function emptyFilterSet(): FilterSet {
  return { filters: [], range: "all" };
}

/** Filter sets travel in the URL so a view can be shared with a teammate. */
export function encodeFilterSet(set: FilterSet): string {
  return btoa(encodeURIComponent(JSON.stringify(set)));
}

export function decodeFilterSet(raw: string | undefined | null): FilterSet | null {
  if (!raw) return null;
  try {
    const parsed = filterSetSchema.safeParse(JSON.parse(decodeURIComponent(atob(raw))));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

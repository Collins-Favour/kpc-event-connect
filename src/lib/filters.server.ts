import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AttendeeFilter } from "./filters";

type Client = SupabaseClient<Database>;

/** Registration ids matching a single custom-field filter. */
async function idsForCustomFilter(
  supabase: Client,
  spaceId: string,
  filter: AttendeeFilter,
): Promise<Set<string>> {
  let query = supabase
    .from("registration_field_values")
    .select("registration_id, value")
    .eq("space_id", spaceId)
    .eq("field_key", filter.key)
    .limit(50000);

  if (filter.op === "in" && filter.values.length > 0) {
    query = query.in("value", filter.values);
  } else if (filter.op === "contains" && filter.values[0]) {
    query = query.ilike("value", `%${filter.values[0].replace(/[%,()]/g, " ")}%`);
  } else if (filter.op === "between") {
    const [min, max] = filter.values;
    if (min) query = query.gte("value", min);
    if (max) query = query.lte("value", max);
  }

  const { data } = await query;
  return new Set((data ?? []).map((row) => row.registration_id));
}

/**
 * Resolves every custom-field filter to a set of registration ids and
 * intersects them (filters combine with AND, values inside one with OR).
 * Returns null when there is nothing to resolve.
 */
export async function resolveCustomFilterIds(
  supabase: Client,
  spaceId: string,
  filters: AttendeeFilter[],
): Promise<string[] | null> {
  const custom = filters.filter((f) => f.source === "custom" && f.values.some(Boolean));
  if (custom.length === 0) return null;

  let intersection: Set<string> | null = null;
  for (const filter of custom) {
    const ids: Set<string> = await idsForCustomFilter(supabase, spaceId, filter);
    if (intersection === null) {
      intersection = ids;
    } else {
      const next = new Set<string>();
      intersection.forEach((id) => {
        if (ids.has(id)) next.add(id);
      });
      intersection = next;
    }
    if (intersection.size === 0) return [];
  }


  return [...(intersection ?? [])];
}

type Query = {
  eq: (column: string, value: string) => Query;
  in: (column: string, values: string[]) => Query;
  gte: (column: string, value: string) => Query;
  lte: (column: string, value: string) => Query;
  ilike: (column: string, value: string) => Query;
  or: (filter: string) => Query;
};

/** Applies built-in column filters, the date window and free-text search. */
export function applyBuiltinFilters<T>(
  query: T,
  options: {
    eventId?: string | undefined;
    deskId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    search?: string | undefined;
    filters: AttendeeFilter[];
    ids: string[] | null;
  },
): T {
  let q = query as unknown as Query;

  if (options.ids) q = q.in("id", options.ids.length > 0 ? options.ids : [crypto.randomUUID()]);
  if (options.eventId) q = q.eq("event_id", options.eventId);
  if (options.deskId) q = q.eq("desk_id", options.deskId);
  if (options.from) q = q.gte("registered_at", new Date(options.from).toISOString());
  if (options.to) {
    const to = new Date(options.to);
    if (options.to.length <= 10) to.setUTCHours(23, 59, 59, 999);
    q = q.lte("registered_at", to.toISOString());
  }
  if (options.search) {
    const term = options.search.replace(/[%,()]/g, " ");
    q = q.or(
      `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%,registration_number.ilike.%${term}%,location.ilike.%${term}%`,
    );
  }
  for (const filter of options.filters) {
    if (filter.source !== "builtin") continue;
    const value = filter.values[0];
    if (!value) continue;
    if (filter.op === "in") q = q.in(filter.key, filter.values);
    else q = q.ilike(filter.key, `%${value.replace(/[%,()]/g, " ")}%`);
  }
  return q as unknown as T;
}

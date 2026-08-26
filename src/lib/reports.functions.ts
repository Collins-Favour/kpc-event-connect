import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireMembership } from "./tenant.server";
import { filterSetSchema, rangeToWindow } from "./filters";
import { applyBuiltinFilters, resolveCustomFilterIds } from "./filters.server";


const spaceIdSchema = z.object({ spaceId: z.string().uuid() });

export const getSpaceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema.extend({ eventId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { supabase } = context;

    const scoped = <T>(q: T) =>
      data.eventId ? (q as { eq: (a: string, b: string) => T }).eq("event_id", data.eventId) : q;

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [total, today, events, desks, sessions, recent] = await Promise.all([
      scoped(
        supabase
          .from("registrations")
          .select("id", { count: "exact", head: true })
          .eq("space_id", data.spaceId),
      ),
      scoped(
        supabase
          .from("registrations")
          .select("id", { count: "exact", head: true })
          .eq("space_id", data.spaceId)
          .gte("registered_at", startOfDay.toISOString()),
      ),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("space_id", data.spaceId)
        .eq("status", "ACTIVE"),
      scoped(
        supabase
          .from("registration_desks")
          .select("id", { count: "exact", head: true })
          .eq("space_id", data.spaceId)
          .eq("status", "ACTIVE"),
      ),
      scoped(
        supabase
          .from("registration_sessions")
          .select("id", { count: "exact", head: true })
          .eq("space_id", data.spaceId)
          .eq("status", "ACTIVE"),
      ),
      scoped(
        supabase
          .from("registrations")
          .select(
            "id, registration_number, full_name, registered_at, desk:registration_desks(name)",
          )
          .eq("space_id", data.spaceId)
          .order("registered_at", { ascending: false })
          .limit(8),
      ),
    ]);

    // Registrations per day for the last 14 days.
    const since = new Date(Date.now() - 13 * 24 * 3600 * 1000);
    since.setUTCHours(0, 0, 0, 0);
    const trendQuery = scoped(
      supabase
        .from("registrations")
        .select("registered_at, desk_id")
        .eq("space_id", data.spaceId)
        .gte("registered_at", since.toISOString())
        .limit(5000),
    );
    const { data: trendRows } = await trendQuery;

    const byDay = new Map<string, number>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(since.getTime() + i * 24 * 3600 * 1000);
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    const byHour = new Array(24).fill(0) as number[];
    const byDesk = new Map<string, number>();
    for (const row of trendRows ?? []) {
      const key = row.registered_at.slice(0, 10);
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
      byHour[new Date(row.registered_at).getUTCHours()]! += 1;
      if (row.desk_id) byDesk.set(row.desk_id, (byDesk.get(row.desk_id) ?? 0) + 1);
    }

    const { data: deskRows } = await supabase
      .from("registration_desks")
      .select("id, name")
      .eq("space_id", data.spaceId);

    return {
      totals: {
        registrations: total.count ?? 0,
        today: today.count ?? 0,
        activeEvents: events.count ?? 0,
        activeDesks: desks.count ?? 0,
        liveSessions: sessions.count ?? 0,
      },
      trend: [...byDay.entries()].map(([date, count]) => ({ date, count })),
      hourly: byHour.map((count, hour) => ({ hour, count })),
      deskBreakdown: (deskRows ?? []).map((d) => ({ name: d.name, count: byDesk.get(d.id) ?? 0 })),
      recent: recent.data ?? [],
    };
  });

const listSchema = spaceIdSchema.extend(filterSetSchema.shape).extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(25),
});

const SELECT_COLUMNS =
  "id, registration_number, full_name, phone, email, location, registered_at, event:events(name), desk:registration_desks(name, code), values:registration_field_values(field_key, value)";

export const listRegistrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);

    const window = rangeToWindow(data.range);
    const ids = await resolveCustomFilterIds(context.supabase, data.spaceId, data.filters);

    let query = context.supabase
      .from("registrations")
      .select(SELECT_COLUMNS, { count: "exact" })
      .eq("space_id", data.spaceId);

    query = applyBuiltinFilters(query, {
      eventId: data.eventId,
      deskId: data.deskId,
      from: data.from || window.from,
      to: data.to || window.to,
      search: data.search,
      filters: data.filters,
      ids,
    });

    const from = (data.page - 1) * data.pageSize;
    const {
      data: rows,
      count,
      error,
    } = await query
      .order("registered_at", { ascending: false })
      .range(from, from + data.pageSize - 1);
    if (error) throw new Error("Could not load registrations.");

    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

/** Full filtered result set for CSV / Excel / PDF export. */
export const exportRegistrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => spaceIdSchema.extend(filterSetSchema.shape).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);

    const window = rangeToWindow(data.range);
    const ids = await resolveCustomFilterIds(context.supabase, data.spaceId, data.filters);

    let query = context.supabase
      .from("registrations")
      .select(SELECT_COLUMNS, { count: "exact" })
      .eq("space_id", data.spaceId);

    query = applyBuiltinFilters(query, {
      eventId: data.eventId,
      deskId: data.deskId,
      from: data.from || window.from,
      to: data.to || window.to,
      search: data.search,
      filters: data.filters,
      ids,
    });

    const {
      data: rows,
      count,
      error,
    } = await query.order("registered_at", { ascending: false }).range(0, 19999);
    if (error) throw new Error("Could not export these registrations.");

    return { rows: rows ?? [], total: count ?? 0, truncated: (count ?? 0) > 20000 };
  });

export const getReportData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => spaceIdSchema.extend(filterSetSchema.shape).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);

    const window = rangeToWindow(data.range);
    const ids = await resolveCustomFilterIds(context.supabase, data.spaceId, data.filters);

    let query = context.supabase
      .from("registrations")
      .select(SELECT_COLUMNS)
      .eq("space_id", data.spaceId);

    query = applyBuiltinFilters(query, {
      eventId: data.eventId,
      deskId: data.deskId,
      from: data.from || window.from,
      to: data.to || window.to,
      search: data.search,
      filters: data.filters,
      ids,
    });

    const { data: rows } = await query.order("registered_at", { ascending: false }).limit(20000);

    // Breakdowns for every field we know about: built-ins plus configurable fields.
    const breakdowns = new Map<string, Map<string, number>>();
    const bump = (field: string, value: string) => {
      const bucket = breakdowns.get(field) ?? new Map<string, number>();
      bucket.set(value, (bucket.get(value) ?? 0) + 1);
      breakdowns.set(field, bucket);
    };

    for (const row of rows ?? []) {
      if (row.location) bump("location", row.location);
      if (row.event?.name) bump("event", row.event.name);
      if (row.desk?.name) bump("desk", row.desk.name);
      for (const value of row.values ?? []) {
        if (value.value) bump(value.field_key, value.value);
      }
    }

    return {
      rows: rows ?? [],
      total: rows?.length ?? 0,
      breakdowns: [...breakdowns.entries()].map(([field, counts]) => ({
        field,
        counts: [...counts.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count),
      })),
    };
  });


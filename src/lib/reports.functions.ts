import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireMembership } from "./tenant.server";

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

const listSchema = spaceIdSchema.extend({
  eventId: z.string().uuid().optional(),
  deskId: z.string().uuid().optional(),
  search: z.string().trim().max(80).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(25),
});

export const listRegistrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);

    let query = context.supabase
      .from("registrations")
      .select(
        "id, registration_number, full_name, phone, email, location, registered_at, event:events(name), desk:registration_desks(name, code), values:registration_field_values(field_key, value)",
        { count: "exact" },
      )
      .eq("space_id", data.spaceId);

    if (data.eventId) query = query.eq("event_id", data.eventId);
    if (data.deskId) query = query.eq("desk_id", data.deskId);
    if (data.from) query = query.gte("registered_at", new Date(data.from).toISOString());
    if (data.to) {
      const to = new Date(data.to);
      to.setUTCHours(23, 59, 59, 999);
      query = query.lte("registered_at", to.toISOString());
    }
    if (data.search) {
      const term = data.search.replace(/[%,()]/g, " ");
      query = query.or(
        `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%,registration_number.ilike.%${term}%,location.ilike.%${term}%`,
      );
    }

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

export const getReportData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema.extend({ eventId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);

    let query = context.supabase
      .from("registrations")
      .select(
        "registration_number, full_name, phone, email, location, registered_at, event:events(name), desk:registration_desks(name, code), values:registration_field_values(field_key, value)",
      )
      .eq("space_id", data.spaceId)
      .order("registered_at", { ascending: false })
      .limit(5000);
    if (data.eventId) query = query.eq("event_id", data.eventId);
    const { data: rows } = await query;

    // Demographic breakdowns come from whatever configurable fields exist.
    const breakdowns = new Map<string, Map<string, number>>();
    for (const row of rows ?? []) {
      for (const value of row.values ?? []) {
        if (!value.value) continue;
        const bucket = breakdowns.get(value.field_key) ?? new Map<string, number>();
        bucket.set(value.value, (bucket.get(value.value) ?? 0) + 1);
        breakdowns.set(value.field_key, bucket);
      }
    }

    return {
      rows: rows ?? [],
      breakdowns: [...breakdowns.entries()].map(([field, counts]) => ({
        field,
        counts: [...counts.entries()].map(([label, count]) => ({ label, count })),
      })),
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

async function requireStaff(context: Ctx) {
  const { data, error } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (error || !data) throw new Error("Forbidden: administrator access required.");
  const { data: profile } = await context.supabase
    .from("profiles")
    .select("status")
    .eq("id", context.userId)
    .maybeSingle();
  if (profile?.status !== "ACTIVE") throw new Error("Forbidden: your account is not active.");
}

async function logAudit(userId: string, action: string, description: string, entityType?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_logs").insert({
    user_id: userId,
    action,
    entity_type: entityType ?? null,
    description,
  });
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context);
    const { supabase } = context;

    const [desks, events, assignments, registrars] = await Promise.all([
      supabase.from("registration_desks").select("*").order("code"),
      supabase.from("events").select("*").order("start_date", { ascending: false }),
      supabase
        .from("registrar_assignments")
        .select("id, user_id, status, started_at, event:events(name), desk:registration_desks(name, code)")
        .eq("status", "ACTIVE"),
      supabase.from("user_roles").select("user_id").eq("role", "REGISTRAR"),
    ]);

    const registrarIds = (registrars.data ?? []).map((r) => r.user_id);
    const { data: profiles } = registrarIds.length
      ? await supabase.from("profiles").select("*").in("id", registrarIds)
      : { data: [] };

    return {
      desks: desks.data ?? [],
      events: events.data ?? [],
      assignments: assignments.data ?? [],
      registrars: profiles ?? [],
    };
  });

export const createRegistrar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2),
        email: z.string().trim().email(),
        phone: z.string().trim().optional().or(z.literal("")),
        password: z.string().min(8),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name, phone: data.phone || null },
    });
    if (error || !user.user) throw new Error(error?.message ?? "Could not create the registrar.");

    await supabaseAdmin
      .from("profiles")
      .update({ name: data.name, phone: data.phone || null, status: "ACTIVE" })
      .eq("id", user.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: user.user.id, role: "REGISTRAR" });
    await logAudit(context.userId, "REGISTRAR_CREATED", `Created registrar ${data.email}`, "user");

    return { id: user.user.id };
  });

export const assignRegistrarDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        registration_desk_id: z.string().uuid(),
        event_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("registrar_assignments")
      .update({ status: "ENDED", ended_at: new Date().toISOString() })
      .eq("user_id", data.user_id)
      .eq("status", "ACTIVE");

    const { error } = await supabaseAdmin.from("registrar_assignments").insert({
      user_id: data.user_id,
      registration_desk_id: data.registration_desk_id,
      event_id: data.event_id,
      status: "ACTIVE",
    });
    if (error) throw new Error(error.message);

    await logAudit(context.userId, "REGISTRAR_ASSIGNED", `Assigned registrar to a desk`, "registrar_assignment");
    return { ok: true };
  });

export const upsertDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2),
        code: z.string().trim().min(2),
        location: z.string().trim().optional().or(z.literal("")),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      name: data.name,
      code: data.code.toUpperCase(),
      location: data.location || null,
      ...(data.status ? { status: data.status } : {}),
    };
    const { error } = data.id
      ? await supabaseAdmin.from("registration_desks").update(payload).eq("id", data.id)
      : await supabaseAdmin.from("registration_desks").insert(payload);
    if (error) throw new Error(error.message);
    await logAudit(context.userId, data.id ? "DESK_UPDATED" : "DESK_CREATED", `Desk ${payload.code}`, "registration_desk");
    return { ok: true };
  });

export const createEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2),
        venue: z.string().trim().optional().or(z.literal("")),
        start_date: z.string().optional().or(z.literal("")),
        end_date: z.string().optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("events").insert({
      name: data.name,
      venue: data.venue || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
    });
    if (error) throw new Error(error.message);
    await logAudit(context.userId, "EVENT_CREATED", `Created event ${data.name}`, "event");
    return { ok: true };
  });

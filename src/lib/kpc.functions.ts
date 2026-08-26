import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const setupSchema = z.object({
  accounts: z
    .array(
      z.object({
        name: z.string().trim().min(2),
        email: z.string().trim().email(),
        phone: z.string().trim().optional().or(z.literal("")),
        password: z.string().min(10),
      }),
    )
    .min(1)
    .max(2),
});

export const getSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "SUPER_ADMIN");
  return { completed: (count ?? 0) > 0 };
});

export const runSetup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => setupSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "SUPER_ADMIN");
    if ((count ?? 0) > 0) {
      throw new Error("Setup has already been completed.");
    }

    const created: string[] = [];
    for (const account of data.accounts) {
      const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { name: account.name, phone: account.phone || null },
      });
      if (error || !user.user) throw new Error(error?.message ?? "Could not create the account.");

      await supabaseAdmin
        .from("profiles")
        .update({ name: account.name, phone: account.phone || null, status: "ACTIVE" })
        .eq("id", user.user.id);
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: user.user.id, role: "SUPER_ADMIN" });
      await supabaseAdmin.from("audit_logs").insert({
        user_id: user.user.id,
        action: "SUPER_ADMIN_PROVISIONED",
        entity_type: "user",
        entity_id: user.user.id,
        description: `Super admin account provisioned during system setup`,
      });
      created.push(account.email);
    }

    return { created };
  });

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const roleList = (roles ?? []).map((r) => r.role);
    const role = roleList.includes("SUPER_ADMIN")
      ? "SUPER_ADMIN"
      : roleList.includes("ADMIN")
        ? "ADMIN"
        : roleList.includes("REGISTRAR")
          ? "REGISTRAR"
          : null;

    const { data: assignment } = await supabase
      .from("registrar_assignments")
      .select(
        "id, started_at, event:events(id, name, venue), desk:registration_desks(id, name, code, location, status)",
      )
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .maybeSingle();

    return {
      userId,
      profile: profile ?? null,
      role,
      status: profile?.status ?? "PENDING",
      assignment: assignment ?? null,
    };
  });

export const listMinistries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ministries")
      .select("id, name, is_home")
      .eq("status", "ACTIVE")
      .order("is_home", { ascending: false })
      .order("name");
    return data ?? [];
  });

const attendeeSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  location: z.string().trim().min(2, "Location is required"),
  attendance_type: z.enum(["HOME", "GUEST"]),
  ministry_id: z.string().uuid().optional().nullable(),
  gender: z.enum(["male", "female"]),
  is_youth: z.boolean(),
  confirm_duplicate: z.boolean().optional(),
});

export const registerAttendee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => attendeeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", userId)
      .maybeSingle();
    if (!profile || profile.status !== "ACTIVE") {
      throw new Error("Your account is not active. Contact an administrator.");
    }

    const { data: assignment } = await supabase
      .from("registrar_assignments")
      .select("id, event_id, registration_desk_id, desk:registration_desks(status)")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (!assignment) {
      throw new Error("You have no active desk assignment. Contact an administrator.");
    }
    if (assignment.desk?.status !== "ACTIVE") {
      throw new Error("Your registration desk is inactive and cannot accept registrations.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let ministryId = data.ministry_id ?? null;
    if (data.attendance_type === "HOME") {
      const { data: home } = await supabaseAdmin
        .from("ministries")
        .select("id")
        .eq("is_home", true)
        .maybeSingle();
      ministryId = home?.id ?? null;
    } else if (!ministryId) {
      throw new Error("Ministry / church is required for guests.");
    }

    const phone = data.phone?.trim() || null;
    if (phone && !data.confirm_duplicate) {
      const { data: existing } = await supabaseAdmin
        .from("attendees")
        .select("full_name, registration_number")
        .eq("event_id", assignment.event_id)
        .eq("phone", phone)
        .limit(1);
      if (existing && existing.length > 0) {
        return {
          duplicate: true as const,
          match: existing[0]!,
        };
      }
    }

    const { data: attendee, error } = await supabaseAdmin
      .from("attendees")
      .insert({
        full_name: data.full_name.trim(),
        phone,
        email: data.email?.trim() || null,
        location: data.location.trim(),
        attendance_type: data.attendance_type,
        ministry_id: ministryId,
        gender: data.gender,
        is_youth: data.is_youth,
        event_id: assignment.event_id,
        registration_desk_id: assignment.registration_desk_id,
        registered_by: userId,
        registrar_assignment_id: assignment.id,
        registered_at: new Date().toISOString(),
      })
      .select("registration_number, full_name, registered_at")
      .single();

    if (error || !attendee) throw new Error(error?.message ?? "Registration failed.");

    return { duplicate: false as const, attendee };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  HttpError,
  generateSecret,
  hashSecret,
  requireMembership,
  slugify,
  writeAudit,
} from "./tenant.server";

const spaceIdSchema = z.object({ spaceId: z.string().uuid() });

export const listMySpaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("space_members")
      .select("role, space:spaces(id, name, slug, space_type, status, logo_url)")
      .eq("user_id", context.userId)
      .eq("status", "ACTIVE");
    if (error) throw new HttpError("Could not load your spaces.", 500);
    return (data ?? [])
      .filter((row) => row.space && row.space.status !== "ARCHIVED")
      .map((row) => ({ role: row.role, ...row.space! }));
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("id, name, email, avatar_url")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: platform } = await context.supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { profile: data ?? null, isPlatformAdmin: Boolean(platform) };
  });

const createSpaceSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  space_type: z.enum(["INDIVIDUAL", "ORGANIZATION", "TEAM"]),
  category: z.string().trim().max(60).optional().or(z.literal("")),
  contact_email: z.string().trim().email().optional().or(z.literal("")),
  contact_phone: z.string().trim().max(30).optional().or(z.literal("")),
  timezone: z.string().trim().min(1).max(60).default("UTC"),
});

export const createSpace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSpaceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let slug = slugify(data.name);
    const { data: taken } = await supabaseAdmin
      .from("spaces")
      .select("slug")
      .like("slug", `${slug}%`);
    if ((taken ?? []).some((row) => row.slug === slug)) {
      slug = `${slug}-${generateSecret(3)}`;
    }

    const { data: space, error } = await supabaseAdmin
      .from("spaces")
      .insert({
        name: data.name.trim(),
        slug,
        space_type: data.space_type,
        category: data.category || null,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        timezone: data.timezone || "UTC",
        created_by: context.userId,
      })
      .select("id, name, slug")
      .single();
    if (error || !space) throw new HttpError("Could not create the space.", 500);

    const { error: memberError } = await supabaseAdmin.from("space_members").insert({
      space_id: space.id,
      user_id: context.userId,
      role: "SPACE_SUPER_ADMIN",
    });
    if (memberError) throw new HttpError("Could not set you up as the space owner.", 500);

    await writeAudit(supabaseAdmin, {
      space_id: space.id,
      actor_id: context.userId,
      action: "SPACE_CREATED",
      entity_type: "space",
      entity_id: space.id,
      description: `Space "${space.name}" created`,
    });

    return space;
  });

export const getSpace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => spaceIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { role } = await requireMembership(context.supabase, context.userId, data.spaceId);
    const { data: space } = await context.supabase
      .from("spaces")
      .select("*")
      .eq("id", data.spaceId)
      .maybeSingle();
    if (!space) throw new HttpError("Space not found.", 404);
    return { space, role };
  });

const updateSpaceSchema = spaceIdSchema.extend({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  contact_email: z.string().trim().email().optional().or(z.literal("")),
  contact_phone: z.string().trim().max(30).optional().or(z.literal("")),
  timezone: z.string().trim().min(1).max(60),
});

export const updateSpace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSpaceSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId, { superAdmin: true });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("spaces")
      .update({
        name: data.name.trim(),
        description: data.description || null,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        timezone: data.timezone,
      })
      .eq("id", data.spaceId);
    if (error) throw new HttpError("Could not save the space settings.", 500);
    await writeAudit(supabaseAdmin, {
      space_id: data.spaceId,
      actor_id: context.userId,
      action: "SPACE_UPDATED",
      entity_type: "space",
      entity_id: data.spaceId,
      description: "Space settings updated",
    });
    return { ok: true };
  });

/* ------------------------------- members -------------------------------- */

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => spaceIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rawMembers }, { data: invitations }] = await Promise.all([
      context.supabase
        .from("space_members")
        .select("id, user_id, role, status, joined_at")
        .eq("space_id", data.spaceId)
        .order("joined_at"),
      context.supabase
        .from("space_invitations")
        .select("id, email, role, status, expires_at, created_at")
        .eq("space_id", data.spaceId)
        .order("created_at", { ascending: false }),
    ]);
    // space_members references auth.users, so profiles are attached separately.
    const ids = (rawMembers ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, name, email, avatar_url").in("id", ids)
      : { data: [] as { id: string; name: string; email: string | null; avatar_url: string | null }[] };

    const members = (rawMembers ?? []).map((member) => ({
      ...member,
      profile: (profiles ?? []).find((p) => p.id === member.user_id) ?? null,
    }));

    return { members, invitations: invitations ?? [] };
  });

const inviteSchema = spaceIdSchema.extend({
  email: z.string().trim().email("Enter a valid email"),
  role: z.enum(["SPACE_ADMIN", "SPACE_SUPER_ADMIN"]),
});

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId, { superAdmin: true });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const token = generateSecret(24);
    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: invite, error } = await supabaseAdmin
      .from("space_invitations")
      .insert({
        space_id: data.spaceId,
        email: data.email.toLowerCase(),
        role: data.role,
        token_hash: hashSecret(token),
        invited_by: context.userId,
        expires_at: expires,
      })
      .select("id")
      .single();
    if (error || !invite) throw new HttpError("Could not create the invitation.", 500);

    await writeAudit(supabaseAdmin, {
      space_id: data.spaceId,
      actor_id: context.userId,
      action: "MEMBER_INVITED",
      entity_type: "invitation",
      entity_id: invite.id,
      description: `Invited ${data.email} as ${data.role}`,
    });

    // The one-time token is returned once so the inviter can share the link.
    return { id: invite.id, token, expires_at: expires };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema.extend({ invitationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId, { superAdmin: true });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("space_invitations")
      .update({ status: "REVOKED" })
      .eq("id", data.invitationId)
      .eq("space_id", data.spaceId);
    await writeAudit(supabaseAdmin, {
      space_id: data.spaceId,
      actor_id: context.userId,
      action: "INVITATION_REVOKED",
      entity_type: "invitation",
      entity_id: data.invitationId,
    });
    return { ok: true };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema
      .extend({ memberId: z.string().uuid(), role: z.enum(["SPACE_ADMIN", "SPACE_SUPER_ADMIN"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId, { superAdmin: true });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin
      .from("space_members")
      .select("id, user_id, role")
      .eq("id", data.memberId)
      .eq("space_id", data.spaceId)
      .maybeSingle();
    if (!target) throw new HttpError("Member not found in this space.", 404);
    if (target.user_id === context.userId) {
      throw new HttpError("You cannot change your own role.", 403);
    }
    await supabaseAdmin.from("space_members").update({ role: data.role }).eq("id", target.id);
    await writeAudit(supabaseAdmin, {
      space_id: data.spaceId,
      actor_id: context.userId,
      action: "MEMBER_ROLE_CHANGED",
      entity_type: "space_member",
      entity_id: target.id,
      description: `Role changed to ${data.role}`,
    });
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema.extend({ memberId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId, { superAdmin: true });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin
      .from("space_members")
      .select("id, user_id")
      .eq("id", data.memberId)
      .eq("space_id", data.spaceId)
      .maybeSingle();
    if (!target) throw new HttpError("Member not found in this space.", 404);
    if (target.user_id === context.userId) {
      throw new HttpError("You cannot remove yourself from the space.", 403);
    }
    const { count } = await supabaseAdmin
      .from("space_members")
      .select("id", { count: "exact", head: true })
      .eq("space_id", data.spaceId)
      .eq("role", "SPACE_SUPER_ADMIN");
    if ((count ?? 0) <= 1) {
      const { data: isSuper } = await supabaseAdmin
        .from("space_members")
        .select("role")
        .eq("id", target.id)
        .maybeSingle();
      if (isSuper?.role === "SPACE_SUPER_ADMIN") {
        throw new HttpError("A space must keep at least one super admin.", 409);
      }
    }
    await supabaseAdmin.from("space_members").delete().eq("id", target.id);
    await writeAudit(supabaseAdmin, {
      space_id: data.spaceId,
      actor_id: context.userId,
      action: "MEMBER_REMOVED",
      entity_type: "space_member",
      entity_id: target.id,
    });
    return { ok: true };
  });

/* ----------------------------- invitations ------------------------------ */

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("space_invitations")
      .select("id, space_id, role, status, expires_at, space:spaces(name)")
      .eq("token_hash", hashSecret(data.token))
      .maybeSingle();

    if (!invite) throw new HttpError("This invitation link is not valid.", 404);
    if (invite.status !== "PENDING") throw new HttpError("This invitation is no longer active.", 409);
    if (new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin.from("space_invitations").update({ status: "EXPIRED" }).eq("id", invite.id);
      throw new HttpError("This invitation has expired.", 409);
    }

    await supabaseAdmin
      .from("space_members")
      .upsert(
        { space_id: invite.space_id, user_id: context.userId, role: invite.role, status: "ACTIVE" },
        { onConflict: "space_id,user_id" },
      );
    await supabaseAdmin
      .from("space_invitations")
      .update({ status: "ACCEPTED", accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    await writeAudit(supabaseAdmin, {
      space_id: invite.space_id,
      actor_id: context.userId,
      action: "INVITATION_ACCEPTED",
      entity_type: "invitation",
      entity_id: invite.id,
    });

    return { spaceId: invite.space_id, spaceName: invite.space?.name ?? "Space" };
  });

/* ------------------------------- platform -------------------------------- */

/** Reads the caller's platform status from their own token, never from input. */
async function requirePlatformAdmin(
  supabase: { from: (table: "platform_admins") => never } | never,
  userId: string,
) {
  const { data } = await (supabase as never as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: unknown }> };
      };
    };
  })
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new HttpError("Platform administrators only.", 403);
}

export const listAllSpaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePlatformAdmin(context.supabase as never, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: spaces }, { count: registrations }, { count: users }] = await Promise.all([
      supabaseAdmin
        .from("spaces")
        .select("id, name, slug, space_type, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("registrations").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    return {
      spaces: spaces ?? [],
      totals: { registrations: registrations ?? 0, users: users ?? 0, spaces: (spaces ?? []).length },
    };
  });

export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePlatformAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString();
    const [
      { data: spaces },
      { count: users },
      { count: events },
      { count: desks },
      { count: registrations },
      { data: recentRegistrations },
      { data: audit },
    ] = await Promise.all([
      supabaseAdmin
        .from("spaces")
        .select("id, name, slug, space_type, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("events").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("registration_desks").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("registrations").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("registrations")
        .select("space_id, registered_at")
        .gte("registered_at", since)
        .limit(5000),
      supabaseAdmin
        .from("audit_logs")
        .select("id, action, description, created_at, space_id")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    const perDay = new Map<string, number>();
    const perSpace = new Map<string, number>();
    for (const row of recentRegistrations ?? []) {
      const day = row.registered_at.slice(0, 10);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
      perSpace.set(row.space_id, (perSpace.get(row.space_id) ?? 0) + 1);
    }

    return {
      totals: {
        spaces: (spaces ?? []).length,
        users: users ?? 0,
        events: events ?? 0,
        desks: desks ?? 0,
        registrations: registrations ?? 0,
        last30: (recentRegistrations ?? []).length,
      },
      trend: [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count })),
      spaces: (spaces ?? []).map((space) => ({
        ...space,
        registrations_last30: perSpace.get(space.id) ?? 0,
      })),
      audit: audit ?? [],
    };
  });

export const getSpaceDetailForPlatform = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => spaceIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: space }, { data: events }, { count: desks }, { count: registrations }, { data: members }] =
      await Promise.all([
        supabaseAdmin.from("spaces").select("*").eq("id", data.spaceId).maybeSingle(),
        supabaseAdmin
          .from("events")
          .select("id, name, status, start_date, registration_counter")
          .eq("space_id", data.spaceId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin
          .from("registration_desks")
          .select("id", { count: "exact", head: true })
          .eq("space_id", data.spaceId),
        supabaseAdmin
          .from("registrations")
          .select("id", { count: "exact", head: true })
          .eq("space_id", data.spaceId),
        supabaseAdmin
          .from("space_members")
          .select("id, user_id, role, status")
          .eq("space_id", data.spaceId),
      ]);
    if (!space) throw new HttpError("Space not found.", 404);

    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, name, email").in("id", ids)
      : { data: [] as { id: string; name: string; email: string | null }[] };

    return {
      space,
      events: events ?? [],
      counts: { desks: desks ?? 0, registrations: registrations ?? 0, members: (members ?? []).length },
      members: (members ?? []).map((member) => ({
        ...member,
        profile: (profiles ?? []).find((p) => p.id === member.user_id) ?? null,
      })),
    };
  });

export const listPlatformAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePlatformAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: admins } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id, created_at")
      .order("created_at");
    const ids = (admins ?? []).map((a) => a.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, name, email").in("id", ids)
      : { data: [] as { id: string; name: string; email: string | null }[] };
    return (admins ?? []).map((admin) => ({
      ...admin,
      profile: (profiles ?? []).find((p) => p.id === admin.user_id) ?? null,
      isSelf: admin.user_id === context.userId,
    }));
  });

export const addPlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().trim().email("Enter a valid email").max(255) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.toLowerCase();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();
    if (!profile) {
      throw new HttpError("No account uses that email yet. Ask them to sign in once first.", 404);
    }
    const { error } = await supabaseAdmin
      .from("platform_admins")
      .upsert({ user_id: profile.id }, { onConflict: "user_id" });
    if (error) throw new HttpError("Could not add that platform administrator.", 500);

    await writeAudit(supabaseAdmin, {
      space_id: null,
      actor_id: context.userId,
      action: "PLATFORM_ADMIN_ADDED",
      entity_type: "platform_admin",
      entity_id: profile.id,
      description: `Granted platform administration to ${email}`,
    });
    return { ok: true };
  });

export const removePlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.supabase as never, context.userId);
    if (data.userId === context.userId) {
      throw new HttpError("You cannot remove your own platform access.", 403);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id", { count: "exact", head: true });
    if ((count ?? 0) <= 1) throw new HttpError("The platform must keep one administrator.", 409);

    await supabaseAdmin.from("platform_admins").delete().eq("user_id", data.userId);
    await writeAudit(supabaseAdmin, {
      space_id: null,
      actor_id: context.userId,
      action: "PLATFORM_ADMIN_REMOVED",
      entity_type: "platform_admin",
      entity_id: data.userId,
    });
    return { ok: true };
  });

export const setSpaceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema.extend({ status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.supabase as never, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("spaces").update({ status: data.status }).eq("id", data.spaceId);
    await writeAudit(supabaseAdmin, {
      space_id: data.spaceId,
      actor_id: context.userId,
      action: "SPACE_STATUS_CHANGED",
      entity_type: "space",
      entity_id: data.spaceId,
      description: `Status set to ${data.status}`,
    });
    return { ok: true };
  });


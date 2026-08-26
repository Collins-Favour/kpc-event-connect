import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { HttpError, hashSecret, requireMembership, requirePlatformAdmin } from "./tenant.server";

const spaceIdSchema = z.object({ spaceId: z.string().uuid() });

const ticketSelect =
  "id, space_id, event_id, desk_id, scope, subject, body, status, created_by_label, created_at, updated_at, event:events(name), desk:registration_desks(name, code), space:spaces(name)";

/** Raise a request: space members to their admins, or admins to the platform. */
export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema
      .extend({
        scope: z.enum(["SPACE", "PLATFORM"]).default("SPACE"),
        subject: z.string().trim().min(3, "Add a short subject").max(120),
        body: z.string().trim().min(5, "Describe what you need help with").max(4000),
        eventId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("name, email")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: row, error } = await context.supabase
      .from("support_tickets")
      .insert({
        space_id: data.spaceId,
        event_id: data.eventId ?? null,
        scope: data.scope,
        subject: data.subject,
        body: data.body,
        created_by: context.userId,
        created_by_label: profile?.name || profile?.email || "Space member",
      })
      .select("id")
      .single();
    if (error || !row) throw new HttpError("Could not send your request.", 500);
    return { id: row.id };
  });

/** Registration desks are unauthenticated: the session pair proves the desk. */
export const createDeskTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        secret: z.string().min(16),
        subject: z.string().trim().min(3).max(120),
        body: z.string().trim().min(5).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("registration_sessions")
      .select("id, space_id, event_id, desk_id, status, secret_hash, desk:registration_desks(name)")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session || session.secret_hash !== hashSecret(data.secret) || session.status !== "ACTIVE") {
      throw new HttpError("This registration session is not valid.", 401);
    }

    const { error } = await supabaseAdmin.from("support_tickets").insert({
      space_id: session.space_id,
      event_id: session.event_id,
      desk_id: session.desk_id,
      scope: "SPACE",
      subject: data.subject,
      body: data.body,
      created_by_label: `Desk: ${session.desk?.name ?? "registration desk"}`,
    });
    if (error) throw new HttpError("Could not send your request.", 500);
    return { ok: true };
  });

export const listTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        spaceId: z.string().uuid().optional(),
        scope: z.enum(["SPACE", "PLATFORM"]).default("SPACE"),
        status: z.enum(["ALL", "OPEN", "IN_PROGRESS", "RESOLVED"]).default("ALL"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.scope === "PLATFORM" && !data.spaceId) {
      await requirePlatformAdmin(context.supabase, context.userId);
    } else if (data.spaceId) {
      await requireMembership(context.supabase, context.userId, data.spaceId);
    } else {
      throw new HttpError("A space is required.", 400);
    }

    let query = context.supabase
      .from("support_tickets")
      .select(ticketSelect)
      .eq("scope", data.scope)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.spaceId) query = query.eq("space_id", data.spaceId);
    if (data.status !== "ALL") query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new HttpError("Could not load support requests.", 500);
    return rows ?? [];
  });

export const getTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: ticket } = await context.supabase
      .from("support_tickets")
      .select(ticketSelect)
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticket) throw new HttpError("Request not found.", 404);

    const { data: messages } = await context.supabase
      .from("support_messages")
      .select("id, body, author_label, created_at")
      .eq("ticket_id", data.ticketId)
      .order("created_at", { ascending: true });

    return { ticket, messages: messages ?? [] };
  });

export const replyToTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: ticket } = await context.supabase
      .from("support_tickets")
      .select("id, space_id")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticket) throw new HttpError("Request not found.", 404);

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("name, email")
      .eq("id", context.userId)
      .maybeSingle();

    const { error } = await context.supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      space_id: ticket.space_id,
      author_id: context.userId,
      author_label: profile?.name || profile?.email || "Admin",
      body: data.body,
    });
    if (error) throw new HttpError("Could not post your reply.", 500);
    return { ok: true };
  });

export const setTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("support_tickets")
      .update({ status: data.status })
      .eq("id", data.ticketId);
    if (error) throw new HttpError("Could not update this request.", 500);
    return { ok: true };
  });

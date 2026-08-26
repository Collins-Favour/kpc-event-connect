import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { HttpError, generateSecret, hashSecret, hashValue, writeAudit } from "./tenant.server";

/**
 * Public (unauthenticated) registration desk API.
 * Authorisation comes from a desk token, then from a session id + secret pair.
 * The space, event and desk are always resolved server-side from those
 * credentials — never from anything the client sends.
 */

const sessionCredentials = z.object({
  sessionId: z.string().uuid(),
  secret: z.string().min(16),
});

async function loadSession(sessionId: string, secret: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: session } = await supabaseAdmin
    .from("registration_sessions")
    .select(
      "id, space_id, event_id, desk_id, token_id, status, secret_hash, started_at, space:spaces(name, status), event:events(name, status, venue), desk:registration_desks(name, code, location, status)",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || session.secret_hash !== hashSecret(secret)) {
    throw new HttpError("This registration session is not valid.", 401);
  }
  if (session.status !== "ACTIVE") throw new HttpError("This registration session has ended.", 401);
  if (session.space?.status !== "ACTIVE") throw new HttpError("This workspace is not active.", 403);
  if (session.desk?.status !== "ACTIVE") throw new HttpError("This desk is no longer active.", 403);

  const { data: token } = await supabaseAdmin
    .from("desk_tokens")
    .select("status, expires_at")
    .eq("id", session.token_id)
    .maybeSingle();
  if (!token || token.status !== "ACTIVE" || new Date(token.expires_at) < new Date()) {
    await supabaseAdmin
      .from("registration_sessions")
      .update({ status: "ENDED", ended_at: new Date().toISOString() })
      .eq("id", session.id);
    throw new HttpError("The desk token has expired or was revoked.", 401);
  }

  return { session, supabaseAdmin };
}

export const startDeskSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().trim().min(6).max(24) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: token } = await supabaseAdmin
      .from("desk_tokens")
      .select(
        "id, space_id, event_id, desk_id, status, expires_at, space:spaces(name, status), event:events(name, status), desk:registration_desks(name, code, location, status)",
      )
      .eq("token_hash", hashValue(data.token))
      .maybeSingle();

    if (!token) throw new HttpError("That desk token was not recognised.", 404);
    if (token.status !== "ACTIVE") throw new HttpError("This desk token has been revoked.", 401);
    if (new Date(token.expires_at) < new Date()) {
      await supabaseAdmin.from("desk_tokens").update({ status: "EXPIRED" }).eq("id", token.id);
      throw new HttpError("This desk token has expired.", 401);
    }
    if (token.space?.status !== "ACTIVE") throw new HttpError("This workspace is not active.", 403);
    if (token.desk?.status !== "ACTIVE") throw new HttpError("This desk is inactive.", 403);
    if (token.event?.status === "CANCELLED") throw new HttpError("This event was cancelled.", 403);

    const secret = generateSecret(24);
    const { data: session, error } = await supabaseAdmin
      .from("registration_sessions")
      .insert({
        space_id: token.space_id,
        event_id: token.event_id,
        desk_id: token.desk_id,
        token_id: token.id,
        secret_hash: hashSecret(secret),
      })
      .select("id")
      .single();
    if (error || !session) throw new HttpError("Could not start the registration session.", 500);

    await writeAudit(supabaseAdmin, {
      space_id: token.space_id,
      actor_id: null,
      action: "DESK_SESSION_STARTED",
      entity_type: "registration_session",
      entity_id: session.id,
      description: `Desk ${token.desk?.code ?? ""} session started`,
    });

    return {
      sessionId: session.id,
      secret,
      space: token.space?.name ?? "",
      event: token.event?.name ?? "",
      desk: token.desk?.name ?? "",
      deskCode: token.desk?.code ?? "",
    };
  });

export const getSessionContext = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sessionCredentials.parse(input))
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await loadSession(data.sessionId, data.secret);

    const { data: template } = await supabaseAdmin
      .from("registration_templates")
      .select(
        "id, fields:registration_template_fields(id, label, field_key, field_type, required, options, help_text, display_order, active, is_primary)",
      )
      .eq("event_id", session.event_id)
      .maybeSingle();

    const fields = (template?.fields ?? [])
      .filter((f) => f.active)
      .sort((a, b) => a.display_order - b.display_order);

    const { count } = await supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id);

    await supabaseAdmin
      .from("registration_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", session.id);

    return {
      space: session.space?.name ?? "",
      event: session.event?.name ?? "",
      venue: session.event?.venue ?? null,
      desk: session.desk?.name ?? "",
      deskCode: session.desk?.code ?? "",
      startedAt: session.started_at,
      registeredHere: count ?? 0,
      fields,
    };
  });

export const submitRegistration = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    sessionCredentials
      .extend({
        values: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.boolean()])),
        confirmDuplicate: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await loadSession(data.sessionId, data.secret);

    const { data: template } = await supabaseAdmin
      .from("registration_templates")
      .select(
        "id, fields:registration_template_fields(id, label, field_key, field_type, required, options, active)",
      )
      .eq("event_id", session.event_id)
      .maybeSingle();
    const fields = (template?.fields ?? []).filter((f) => f.active);
    if (fields.length === 0) throw new HttpError("This event has no registration form yet.", 409);

    const asText = (raw: unknown): string => {
      if (Array.isArray(raw)) return raw.join(", ");
      if (typeof raw === "boolean") return raw ? "Yes" : "No";
      return typeof raw === "string" ? raw.trim() : "";
    };

    const clean: Record<string, string> = {};
    for (const field of fields) {
      const value = asText(data.values[field.field_key]);
      if (field.required && !value) {
        throw new HttpError(`${field.label} is required.`, 400);
      }
      if (value && field.field_type === "EMAIL" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
        throw new HttpError(`${field.label} must be a valid email address.`, 400);
      }
      if (value && field.field_type === "NUMBER" && Number.isNaN(Number(value))) {
        throw new HttpError(`${field.label} must be a number.`, 400);
      }
      const options = Array.isArray(field.options) ? (field.options as string[]) : [];
      if (value && field.field_type === "BOOLEAN" && !["Yes", "No"].includes(value)) {
        throw new HttpError(`${field.label} must be answered Yes or No.`, 400);
      }
      if (value && options.length > 0 && ["SELECT", "RADIO"].includes(field.field_type)) {
        if (!options.includes(value))
          throw new HttpError(`${field.label} has an invalid choice.`, 400);
      }

      clean[field.field_key] = value;
    }

    const fullName = clean["full_name"] ?? "";
    if (!fullName) throw new HttpError("Full name is required.", 400);
    const phone = clean["phone"] || null;

    if (phone && !data.confirmDuplicate) {
      const { data: existing } = await supabaseAdmin
        .from("registrations")
        .select("full_name, registration_number")
        .eq("event_id", session.event_id)
        .eq("phone", phone)
        .limit(1);
      if (existing && existing.length > 0) {
        return { duplicate: true as const, match: existing[0]! };
      }
    }

    const { data: registration, error } = await supabaseAdmin
      .from("registrations")
      .insert({
        space_id: session.space_id,
        event_id: session.event_id,
        desk_id: session.desk_id,
        session_id: session.id,
        full_name: fullName,
        phone,
        email: clean["email"] || null,
        location: clean["location"] || null,
        // registration_number is assigned atomically by a database trigger.
      } as never)
      .select("id, registration_number, full_name, registered_at")
      .single();
    if (error || !registration) throw new HttpError("Registration could not be saved.", 500);

    const extras = fields
      .filter((f) => !["full_name", "phone", "email", "location"].includes(f.field_key))
      .map((f) => ({
        registration_id: registration.id,
        field_id: f.id,
        space_id: session.space_id,
        field_key: f.field_key,
        value: clean[f.field_key] || null,
      }));
    if (extras.length > 0) {
      const { error: valueError } = await supabaseAdmin
        .from("registration_field_values")
        .insert(extras);
      if (valueError) {
        // Keep the record set consistent rather than storing a half registration.
        await supabaseAdmin.from("registrations").delete().eq("id", registration.id);
        throw new HttpError("Registration could not be saved. Please try again.", 500);
      }
    }

    await supabaseAdmin
      .from("registration_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", session.id);

    return { duplicate: false as const, registration };
  });

export const endDeskSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sessionCredentials.parse(input))
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await loadSession(data.sessionId, data.secret);
    await supabaseAdmin
      .from("registration_sessions")
      .update({ status: "ENDED", ended_at: new Date().toISOString() })
      .eq("id", session.id);
    return { ok: true };
  });

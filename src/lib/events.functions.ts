import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  DEFAULT_TEMPLATE_FIELDS,
  HttpError,
  generateDeskToken,
  hashValue,
  requireMembership,
  writeAudit,
} from "./tenant.server";

const spaceIdSchema = z.object({ spaceId: z.string().uuid() });

/* -------------------------------- events -------------------------------- */

export const listEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => spaceIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { data: events } = await context.supabase
      .from("events")
      .select(
        "id, name, description, start_date, end_date, venue, status, registration_prefix, created_at",
      )
      .eq("space_id", data.spaceId)
      .order("created_at", { ascending: false });
    return events ?? [];
  });

const eventSchema = spaceIdSchema.extend({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Event name is required").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  venue: z.string().trim().max(160).optional().or(z.literal("")),
  start_date: z.string().optional().or(z.literal("")),
  end_date: z.string().optional().or(z.literal("")),
  registration_prefix: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{2,8}$/, "Prefix must be 2-8 uppercase letters or digits")
    .default("REG"),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]).default("ACTIVE"),
});

export const upsertEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => eventSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      space_id: data.spaceId,
      name: data.name.trim(),
      description: data.description || null,
      venue: data.venue || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      registration_prefix: data.registration_prefix,
      status: data.status,
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("events")
        .update(payload)
        .eq("id", data.id)
        .eq("space_id", data.spaceId);
      if (error) throw new HttpError("Could not update the event.", 500);
      await writeAudit(supabaseAdmin, {
        space_id: data.spaceId,
        actor_id: context.userId,
        action: "EVENT_UPDATED",
        entity_type: "event",
        entity_id: data.id,
        description: payload.name,
      });
      return { id: data.id };
    }

    const { data: event, error } = await supabaseAdmin
      .from("events")
      .insert({ ...payload, created_by: context.userId })
      .select("id")
      .single();
    if (error || !event) throw new HttpError("Could not create the event.", 500);

    // Every event gets a template with the default primary fields.
    const { data: template } = await supabaseAdmin
      .from("registration_templates")
      .insert({ space_id: data.spaceId, event_id: event.id, name: "Default template" })
      .select("id")
      .single();
    if (template) {
      await supabaseAdmin.from("registration_template_fields").insert(
        DEFAULT_TEMPLATE_FIELDS.map((field, index) => ({
          space_id: data.spaceId,
          template_id: template.id,
          label: field.label,
          field_key: field.field_key,
          field_type: field.field_type,
          required: field.required,
          is_primary: field.is_primary,
          display_order: index,
        })),
      );
    }

    await writeAudit(supabaseAdmin, {
      space_id: data.spaceId,
      actor_id: context.userId,
      action: "EVENT_CREATED",
      entity_type: "event",
      entity_id: event.id,
      description: payload.name,
    });
    return { id: event.id };
  });

/* ------------------------------- template -------------------------------- */

export const getTemplate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema.extend({ eventId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { data: template } = await context.supabase
      .from("registration_templates")
      .select("id, name, fields:registration_template_fields(*)")
      .eq("space_id", data.spaceId)
      .eq("event_id", data.eventId)
      .maybeSingle();
    if (!template) return null;
    const fields = [...(template.fields ?? [])].sort((a, b) => a.display_order - b.display_order);
    return { id: template.id, name: template.name, fields };
  });

const fieldSchema = spaceIdSchema.extend({
  templateId: z.string().uuid(),
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1, "Label is required").max(80),
  field_key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{1,40}$/, "Key must be lowercase letters, digits or underscore"),
  field_type: z.enum([
    "TEXT",
    "NUMBER",
    "EMAIL",
    "PHONE",
    "DATE",
    "SELECT",
    "MULTISELECT",
    "CHECKBOX",
    "RADIO",
    "BOOLEAN",
  ]),
  required: z.boolean().default(false),
  help_text: z.string().trim().max(160).optional().or(z.literal("")),
  options: z.array(z.string().trim().min(1)).default([]),
  active: z.boolean().default(true),
});

export const upsertTemplateField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => fieldSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const needsOptions = ["SELECT", "MULTISELECT", "RADIO"].includes(data.field_type);
    if (needsOptions && data.options.length === 0) {
      throw new HttpError("This field type needs at least one option.", 400);
    }

    // Yes/No fields always store the same two answers, whatever was sent.
    const options = data.field_type === "BOOLEAN" ? ["Yes", "No"] : data.options;

    const payload = {
      space_id: data.spaceId,
      template_id: data.templateId,
      label: data.label.trim(),
      field_key: data.field_key,
      field_type: data.field_type,
      required: data.required,
      help_text: data.help_text || null,
      options: options as unknown as never,
      active: data.active,
    };

    if (data.id) {
      const { data: existing } = await supabaseAdmin
        .from("registration_template_fields")
        .select("is_primary")
        .eq("id", data.id)
        .eq("space_id", data.spaceId)
        .maybeSingle();
      if (!existing) throw new HttpError("Field not found.", 404);
      const { error } = await supabaseAdmin
        .from("registration_template_fields")
        .update(
          existing.is_primary ? { label: payload.label, required: payload.required } : payload,
        )
        .eq("id", data.id)
        .eq("space_id", data.spaceId);
      if (error) throw new HttpError("Could not save the field.", 500);
      return { id: data.id };
    }

    const { count } = await supabaseAdmin
      .from("registration_template_fields")
      .select("id", { count: "exact", head: true })
      .eq("template_id", data.templateId);

    const { data: field, error } = await supabaseAdmin
      .from("registration_template_fields")
      .insert({ ...payload, display_order: count ?? 0 })
      .select("id")
      .single();
    if (error || !field) {
      throw new HttpError("Could not add the field. The key may already be used.", 400);
    }
    await writeAudit(supabaseAdmin, {
      space_id: data.spaceId,
      actor_id: context.userId,
      action: "TEMPLATE_FIELD_ADDED",
      entity_type: "template_field",
      entity_id: field.id,
      description: payload.label,
    });
    return { id: field.id };
  });

export const deleteTemplateField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema.extend({ fieldId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: field } = await supabaseAdmin
      .from("registration_template_fields")
      .select("id, is_primary")
      .eq("id", data.fieldId)
      .eq("space_id", data.spaceId)
      .maybeSingle();
    if (!field) throw new HttpError("Field not found.", 404);
    if (field.is_primary) throw new HttpError("System fields cannot be deleted.", 400);
    await supabaseAdmin.from("registration_template_fields").delete().eq("id", field.id);
    await writeAudit(supabaseAdmin, {
      space_id: data.spaceId,
      actor_id: context.userId,
      action: "TEMPLATE_FIELD_DELETED",
      entity_type: "template_field",
      entity_id: field.id,
    });
    return { ok: true };
  });

export const reorderTemplateFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema.extend({ order: z.array(z.string().uuid()).min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await Promise.all(
      data.order.map((id, index) =>
        supabaseAdmin
          .from("registration_template_fields")
          .update({ display_order: index })
          .eq("id", id)
          .eq("space_id", data.spaceId),
      ),
    );
    return { ok: true };
  });

/* --------------------------------- desks --------------------------------- */

export const listDesks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema.extend({ eventId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const [{ data: desks }, { data: tokens }, { data: sessions }] = await Promise.all([
      context.supabase
        .from("registration_desks")
        .select("id, name, code, location, status, created_at")
        .eq("space_id", data.spaceId)
        .eq("event_id", data.eventId)
        .order("created_at"),
      context.supabase
        .from("desk_tokens")
        .select("id, desk_id, token_hint, status, expires_at, created_at")
        .eq("space_id", data.spaceId)
        .eq("event_id", data.eventId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("registration_sessions")
        .select("id, desk_id, status, started_at, last_seen_at")
        .eq("space_id", data.spaceId)
        .eq("event_id", data.eventId)
        .eq("status", "ACTIVE"),
    ]);
    return { desks: desks ?? [], tokens: tokens ?? [], sessions: sessions ?? [] };
  });

const deskSchema = spaceIdSchema.extend({
  eventId: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Desk name is required").max(80),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{2,20}$/, "Code must be 2-20 letters, digits or dashes"),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const upsertDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deskSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      space_id: data.spaceId,
      event_id: data.eventId,
      name: data.name.trim(),
      code: data.code.toUpperCase(),
      location: data.location || null,
      status: data.status,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("registration_desks")
        .update(payload)
        .eq("id", data.id)
        .eq("space_id", data.spaceId);
      if (error) throw new HttpError("Could not update the desk.", 500);
      return { id: data.id };
    }
    const { data: desk, error } = await supabaseAdmin
      .from("registration_desks")
      .insert(payload)
      .select("id")
      .single();
    if (error || !desk) throw new HttpError("Could not create the desk. Is the code unique?", 400);
    await writeAudit(supabaseAdmin, {
      space_id: data.spaceId,
      actor_id: context.userId,
      action: "DESK_CREATED",
      entity_type: "desk",
      entity_id: desk.id,
      description: payload.name,
    });
    return { id: desk.id };
  });

/* -------------------------------- tokens --------------------------------- */

export const issueDeskToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema
      .extend({ deskId: z.string().uuid(), hours: z.number().int().min(1).max(720).default(24) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: desk } = await supabaseAdmin
      .from("registration_desks")
      .select("id, event_id, status")
      .eq("id", data.deskId)
      .eq("space_id", data.spaceId)
      .maybeSingle();
    if (!desk) throw new HttpError("Desk not found.", 404);
    if (desk.status !== "ACTIVE") throw new HttpError("This desk is inactive.", 400);

    // Issuing a new token supersedes previous ones for the desk.
    await supabaseAdmin
      .from("desk_tokens")
      .update({ status: "REVOKED", revoked_at: new Date().toISOString() })
      .eq("desk_id", desk.id)
      .eq("status", "ACTIVE");

    const token = generateDeskToken();
    const expires = new Date(Date.now() + data.hours * 3600 * 1000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("desk_tokens")
      .insert({
        space_id: data.spaceId,
        event_id: desk.event_id,
        desk_id: desk.id,
        token_hash: hashValue(token),
        token_hint: token.slice(-4),
        expires_at: expires,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !row) throw new HttpError("Could not issue the token.", 500);

    await writeAudit(supabaseAdmin, {
      space_id: data.spaceId,
      actor_id: context.userId,
      action: "DESK_TOKEN_ISSUED",
      entity_type: "desk_token",
      entity_id: row.id,
    });

    // Shown once; only the hash is stored.
    return { id: row.id, token, expires_at: expires };
  });

export const revokeDeskToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema.extend({ tokenId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("desk_tokens")
      .update({ status: "REVOKED", revoked_at: new Date().toISOString() })
      .eq("id", data.tokenId)
      .eq("space_id", data.spaceId);
    await supabaseAdmin
      .from("registration_sessions")
      .update({ status: "ENDED", ended_at: new Date().toISOString() })
      .eq("token_id", data.tokenId)
      .eq("status", "ACTIVE");
    await writeAudit(supabaseAdmin, {
      space_id: data.spaceId,
      actor_id: context.userId,
      action: "DESK_TOKEN_REVOKED",
      entity_type: "desk_token",
      entity_id: data.tokenId,
    });
    return { ok: true };
  });

/* ---------------------------- template presets --------------------------- */

/** A reusable set of form fields saved at space level. */
const presetFieldSchema = z.object({
  label: z.string().trim().min(1).max(80),
  field_key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/),
  field_type: z.enum([
    "TEXT",
    "NUMBER",
    "EMAIL",
    "PHONE",
    "DATE",
    "SELECT",
    "MULTISELECT",
    "CHECKBOX",
    "RADIO",
    "BOOLEAN",
  ]),
  required: z.boolean().default(false),
  options: z.array(z.string()).default([]),
  help_text: z.string().nullable().optional(),
});

export const listTemplatePresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => spaceIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { data: rows } = await context.supabase
      .from("template_presets")
      .select("id, name, fields, created_at")
      .eq("space_id", data.spaceId)
      .order("created_at", { ascending: true });
    return rows ?? [];
  });

export const saveTemplatePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema
      .extend({
        name: z.string().trim().min(1, "Name this preset").max(60),
        templateId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { data: fields } = await context.supabase
      .from("registration_template_fields")
      .select("label, field_key, field_type, required, options, help_text, is_primary")
      .eq("template_id", data.templateId)
      .eq("space_id", data.spaceId)
      .order("display_order");

    const custom = (fields ?? []).filter((field) => !field.is_primary);
    if (custom.length === 0) throw new HttpError("Add a custom field before saving a preset.", 400);

    const { error } = await context.supabase.from("template_presets").insert({
      space_id: data.spaceId,
      name: data.name,
      fields: custom as unknown as never,
      created_by: context.userId,
    });
    if (error) throw new HttpError("Could not save this preset.", 500);
    return { ok: true };
  });

export const deleteTemplatePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => spaceIdSchema.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    await context.supabase
      .from("template_presets")
      .delete()
      .eq("id", data.id)
      .eq("space_id", data.spaceId);
    return { ok: true };
  });

/** Copy custom fields into a template, from a preset or from another event. */
export const applyTemplateFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema
      .extend({
        templateId: z.string().uuid(),
        presetId: z.string().uuid().optional(),
        fromEventId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let source: z.infer<typeof presetFieldSchema>[] = [];
    if (data.presetId) {
      const { data: preset } = await context.supabase
        .from("template_presets")
        .select("fields")
        .eq("id", data.presetId)
        .eq("space_id", data.spaceId)
        .maybeSingle();
      if (!preset) throw new HttpError("Preset not found.", 404);
      source = z.array(presetFieldSchema).parse(preset.fields);
    } else if (data.fromEventId) {
      const { data: template } = await context.supabase
        .from("registration_templates")
        .select("id")
        .eq("event_id", data.fromEventId)
        .eq("space_id", data.spaceId)
        .maybeSingle();
      if (!template) throw new HttpError("That event has no form yet.", 404);
      const { data: fields } = await context.supabase
        .from("registration_template_fields")
        .select("label, field_key, field_type, required, options, help_text, is_primary")
        .eq("template_id", template.id)
        .order("display_order");
      source = z
        .array(presetFieldSchema)
        .parse((fields ?? []).filter((field) => !field.is_primary));
    } else {
      throw new HttpError("Choose a preset or an event to copy from.", 400);
    }

    const { data: existing } = await supabaseAdmin
      .from("registration_template_fields")
      .select("field_key, display_order")
      .eq("template_id", data.templateId);
    const taken = new Set((existing ?? []).map((field) => field.field_key));
    let order = (existing ?? []).length;

    const rows = source
      .filter((field) => !taken.has(field.field_key))
      .map((field) => ({
        space_id: data.spaceId,
        template_id: data.templateId,
        label: field.label,
        field_key: field.field_key,
        field_type: field.field_type,
        required: field.required,
        options: field.options as unknown as never,
        help_text: field.help_text ?? null,
        display_order: order++,
      }));

    if (rows.length === 0) return { added: 0 };
    const { error } = await supabaseAdmin.from("registration_template_fields").insert(rows);
    if (error) throw new HttpError("Could not copy those fields.", 500);
    await writeAudit(supabaseAdmin, {
      space_id: data.spaceId,
      actor_id: context.userId,
      action: "TEMPLATE_FIELDS_COPIED",
      entity_type: "template",
      entity_id: data.templateId,
      description: `${rows.length} field(s)`,
    });
    return { added: rows.length };
  });

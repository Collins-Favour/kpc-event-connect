import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { HttpError, requireMembership } from "./tenant.server";
import { filterSetSchema } from "./filters";

const spaceIdSchema = z.object({ spaceId: z.string().uuid() });

export const listSegments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => spaceIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { data: rows } = await context.supabase
      .from("saved_segments")
      .select("id, name, definition, created_at")
      .eq("space_id", data.spaceId)
      .order("created_at", { ascending: true });
    return rows ?? [];
  });

export const saveSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema
      .extend({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1, "Give this segment a name").max(60),
        definition: filterSetSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const payload = {
      space_id: data.spaceId,
      name: data.name,
      definition: data.definition as unknown as never,
      created_by: context.userId,
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("saved_segments")
        .update({ name: data.name, definition: payload.definition })
        .eq("id", data.id)
        .eq("space_id", data.spaceId);
      if (error) throw new HttpError("Could not update this segment.", 500);
      return { id: data.id };
    }

    const { data: row, error } = await context.supabase
      .from("saved_segments")
      .insert(payload)
      .select("id")
      .single();
    if (error || !row) throw new HttpError("Could not save this segment.", 500);
    return { id: row.id };
  });

export const deleteSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    spaceIdSchema.extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { error } = await context.supabase
      .from("saved_segments")
      .delete()
      .eq("id", data.id)
      .eq("space_id", data.spaceId);
    if (error) throw new HttpError("Could not delete this segment.", 500);
    return { ok: true };
  });

/** Every filterable configurable field in the space, de-duplicated by key. */
export const listSpaceFields = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => spaceIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.spaceId);
    const { data: rows } = await context.supabase
      .from("registration_template_fields")
      .select("label, field_key, field_type, options, is_primary")
      .eq("space_id", data.spaceId)
      .order("display_order");

    const seen = new Map<
      string,
      { key: string; label: string; type: string; options: string[]; builtin: boolean }
    >();
    for (const row of rows ?? []) {
      if (seen.has(row.field_key)) continue;
      seen.set(row.field_key, {
        key: row.field_key,
        label: row.label,
        type: row.field_type,
        options: Array.isArray(row.options) ? (row.options as string[]) : [],
        builtin: row.is_primary,
      });
    }
    return [...seen.values()];
  });

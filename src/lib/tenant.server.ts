import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type SpaceRole = Database["public"]["Enums"]["space_role"];

/** Unambiguous alphabet: no 0/O/1/I to keep tokens easy to read aloud. */
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateDeskToken(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += TOKEN_ALPHABET[bytes[i]! % TOKEN_ALPHABET.length];
    if (i === 3) out += "-";
  }
  return out;
}

export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** Desk tokens are typed by humans: ignore case, spaces and dashes. */
export function normalizeToken(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function hashValue(value: string): string {
  return createHash("sha256").update(normalizeToken(value)).digest("hex");
}

/** Session/invitation secrets are case-sensitive, so hash them verbatim. */
export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "space"
  );
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Client = SupabaseClient<Database>;

/**
 * The single tenant-isolation gate. Every space-scoped operation must call
 * this: the caller's membership is read server-side from their own token,
 * never taken from the request body.
 */
export async function requireMembership(
  supabase: Client,
  userId: string,
  spaceId: string,
  options: { superAdmin?: boolean } = {},
): Promise<{ role: SpaceRole; spaceId: string }> {
  const { data, error } = await supabase
    .from("space_members")
    .select("role, status")
    .eq("space_id", spaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new HttpError("Could not verify your access to this space.", 500);
  if (!data || data.status !== "ACTIVE") {
    throw new HttpError("You do not have access to this space.", 403);
  }
  if (options.superAdmin && data.role !== "SPACE_SUPER_ADMIN") {
    throw new HttpError("Only a space super admin can do this.", 403);
  }
  return { role: data.role, spaceId };
}

/** Platform-level gate: read from the caller's own token, never from input. */
export async function requirePlatformAdmin(supabase: Client, userId: string): Promise<void> {
  const { data } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new HttpError("Platform administrators only.", 403);
}

export async function writeAudit(

  admin: Client,
  entry: {
    space_id: string | null;
    actor_id: string | null;
    action: string;
    entity_type?: string;
    entity_id?: string | null;
    description?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await admin.from("audit_logs").insert({
    space_id: entry.space_id,
    actor_id: entry.actor_id,
    action: entry.action,
    entity_type: entry.entity_type ?? null,
    entity_id: entry.entity_id ?? null,
    description: entry.description ?? null,
    metadata: (entry.metadata ?? null) as never,
  });
}

export const DEFAULT_TEMPLATE_FIELDS = [
  { label: "Full name", field_key: "full_name", field_type: "TEXT", required: true, is_primary: true },
  { label: "Phone number", field_key: "phone", field_type: "PHONE", required: false, is_primary: true },
  { label: "Email", field_key: "email", field_type: "EMAIL", required: false, is_primary: true },
  { label: "Location", field_key: "location", field_type: "TEXT", required: false, is_primary: true },
] as const;

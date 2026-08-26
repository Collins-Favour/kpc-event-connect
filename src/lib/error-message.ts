/**
 * Turns server-function errors (including raw Zod issue arrays) into a
 * short, human-readable sentence for toasts.
 */
export function friendlyError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!raw) return fallback;

  const trimmed = raw.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const issues = Array.isArray(parsed) ? parsed : [parsed];
      const messages = issues
        .map((issue) =>
          issue && typeof issue === "object" && "message" in issue
            ? String((issue as { message: unknown }).message)
            : null,
        )
        .filter((m): m is string => Boolean(m));
      if (messages.length) return messages.join(". ");
    } catch {
      /* fall through */
    }
    return fallback;
  }

  return trimmed;
}

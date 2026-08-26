/**
 * The desk session secret lives only in the browser tab that started it.
 * It is paired with the session id on every call to the public desk API.
 */
const key = (sessionId: string) => `desk-session:${sessionId}`;

export function saveDeskSession(sessionId: string, secret: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key(sessionId), secret);
}

export function readDeskSession(sessionId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(key(sessionId));
}

export function clearDeskSession(sessionId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(key(sessionId));
}

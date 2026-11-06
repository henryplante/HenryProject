const NEXT_PARAM = "next";
const MAX_NEXT_LENGTH = 2048;

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > MAX_NEXT_LENGTH) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (/[\u0000-\u001f]/.test(raw)) return null;
  if (raw === "/login" || raw.startsWith("/login?") || raw.startsWith("/login/")) return null;
  return raw;
}

export function loginHref(next?: string | null): string {
  const safe = safeNextPath(next);
  if (!safe || safe === "/") return "/login";
  return `/login?${NEXT_PARAM}=${encodeURIComponent(safe)}`;
}

export function currentPath(location: Pick<Location, "pathname" | "search">): string {
  return `${location.pathname}${location.search}`;
}

export function nextFromSearch(search: string): string | null {
  return safeNextPath(new URLSearchParams(search).get(NEXT_PARAM));
}

let explicitLogout = false;

export function markExplicitLogout() {
  explicitLogout = true;
}

export function consumeExplicitLogout(): boolean {
  const value = explicitLogout;
  explicitLogout = false;
  return value;
}

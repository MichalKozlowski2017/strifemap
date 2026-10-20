/** Edge-safe panel session helpers (middleware + shared). */

export const PANEL_COOKIE = "wn_panel";
const SESSION_DAYS = 7;

function panelPassword(): string | undefined {
  const pw = process.env.PANEL_PASSWORD?.trim();
  return pw || undefined;
}

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return b64url(mac);
}

function safeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export function isPanelPasswordConfigured(): boolean {
  return Boolean(panelPassword());
}

export async function verifyPanelPassword(candidate: string): Promise<boolean> {
  const expected = panelPassword();
  if (!expected) return false;
  const a = new TextEncoder().encode(candidate);
  const b = new TextEncoder().encode(expected);
  return safeEqualBytes(a, b);
}

export async function createPanelSessionToken(): Promise<string | null> {
  const secret = panelPassword();
  if (!secret) return null;
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = String(exp);
  const sig = await sign(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyPanelSessionToken(
  token: string | undefined | null,
): Promise<boolean> {
  const secret = panelPassword();
  if (!secret || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!sig) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  try {
    const expected = await sign(payload, secret);
    return safeEqualBytes(fromB64url(sig), fromB64url(expected));
  } catch {
    return false;
  }
}

export function panelCookieMaxAge(): number {
  return SESSION_DAYS * 24 * 60 * 60;
}

export function panelCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

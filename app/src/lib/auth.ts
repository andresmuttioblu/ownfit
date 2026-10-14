// Single-user passcode. The session cookie is HMAC(AUTH_SECRET, password-fingerprint): it can't be forged
// without the random secret, reveals nothing about the passcode, and changing either logs everyone out.
import { cookies } from "next/headers";

export const AUTH_COOKIE = "ownfit_auth";
export const AUTH_MAX_AGE_S = 60 * 60 * 24 * 90;

const encoder = new TextEncoder();

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Buffer.from(sig).toString("base64url");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** null when APP_PASSWORD or AUTH_SECRET isn't configured: the app then stays locked (fail closed). */
export async function sessionToken(): Promise<string | null> {
  const { APP_PASSWORD, AUTH_SECRET } = process.env;
  if (!APP_PASSWORD || !AUTH_SECRET) return null;
  return hmac(AUTH_SECRET, `ownfit-session-v2:${await hmac(AUTH_SECRET, APP_PASSWORD)}`);
}

export async function isValidToken(token: string | undefined): Promise<boolean> {
  const expected = await sessionToken();
  return Boolean(expected && token && constantTimeEqual(token, expected));
}

export async function isPasswordCorrect(input: string): Promise<boolean> {
  const { APP_PASSWORD, AUTH_SECRET } = process.env;
  if (!APP_PASSWORD || !AUTH_SECRET) return false;
  return constantTimeEqual(await hmac(AUTH_SECRET, input), await hmac(AUTH_SECRET, APP_PASSWORD));
}

/** Call at the top of every server action and data loader; the proxy is only the first check. */
export async function requireAuth(): Promise<void> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!(await isValidToken(token))) throw new Error("Not signed in");
}

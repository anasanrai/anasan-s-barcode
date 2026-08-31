import crypto from "crypto";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type TokenPayload = {
  role: "owner" | "manager";
  storeId?: string;
  exp: number;
};

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expected] = parts;
  const actual = crypto.scryptSync(pin, salt, 32).toString("hex");
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return secret;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function hmac(data: string): string {
  return b64url(crypto.createHmac("sha256", getSecret()).update(data).digest());
}

export function signToken(payload: Omit<TokenPayload, "exp">): string {
  const full: TokenPayload = { ...payload, exp: Date.now() + TOKEN_TTL_MS };
  const body = b64url(Buffer.from(JSON.stringify(full)));
  return `${body}.${hmac(body)}`;
}

export function verifyToken(token: string | undefined | null): TokenPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expectedSig = hmac(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (payload.role !== "owner" && payload.role !== "manager") return null;
    return payload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: { headers: { authorization?: string } }): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export function rateLimit(key: string): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfterSec: 0 };
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

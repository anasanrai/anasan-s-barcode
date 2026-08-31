import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureSchema } from "./db.js";
import { getTokenFromRequest, verifyToken, type TokenPayload } from "./auth.js";

export function setCors(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function sendError(res: VercelResponse, status: number, message: string): void {
  res.status(status).json({ error: message });
}

export async function readJson<T>(req: VercelRequest): Promise<T | null> {
  const body = req.body;
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) return body as T;
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    if (chunks.length === 0) return null;
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function withApi(
  req: VercelRequest,
  res: VercelResponse,
  handler: () => Promise<void>,
): Promise<void> {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  try {
    await ensureSchema();
    await handler();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not configured")) {
      sendError(res, 503, "Server not configured — missing environment variables");
      return;
    }
    sendError(res, 500, "Internal server error");
  }
}

export function requireRole(
  req: VercelRequest,
  role: TokenPayload["role"],
): TokenPayload | null {
  const token = getTokenFromRequest(req);
  const payload = verifyToken(token);
  if (!payload || payload.role !== role) return null;
  return payload;
}

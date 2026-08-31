import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { getDb } from "../_lib/db.js";
import { rateLimit, signToken, verifyPin } from "../_lib/auth.js";
import { readJson, requireRole, sendError, withApi } from "../_lib/http.js";
import { stores } from "../../drizzle/schema.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withApi(req, res, async () => {
    if (req.method !== "POST") {
      sendError(res, 405, "POST only");
      return;
    }

    const body = await readJson<{ role?: string; storeId?: string; pin?: string }>(req);
    const pin = typeof body?.pin === "string" ? body.pin : "";
    const role = body?.role === "owner" ? "owner" : "manager";

    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "unknown";
    const limit = rateLimit(`login:${ip}:${role}`);
    if (!limit.ok) {
      res.setHeader("Retry-After", String(limit.retryAfterSec));
      sendError(res, 429, "Too many attempts. Try again later.");
      return;
    }

    if (!/^\d{4,8}$/.test(pin)) {
      sendError(res, 400, "Invalid PIN format");
      return;
    }

    if (role === "owner") {
      const masterPin = process.env.OWNER_MASTER_PIN;
      if (!masterPin) {
        sendError(res, 503, "Owner access not configured");
        return;
      }
      if (pin !== masterPin) {
        sendError(res, 401, "Invalid PIN");
        return;
      }
      res.status(200).json({ token: signToken({ role: "owner" }) });
      return;
    }

    const storeId = typeof body?.storeId === "string" ? body.storeId : "";
    if (!storeId) {
      sendError(res, 400, "storeId is required");
      return;
    }

    const db = getDb();
    const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
    if (!store || !store.active) {
      sendError(res, 401, "Invalid store or PIN");
      return;
    }
    if (!verifyPin(pin, store.pinHash)) {
      sendError(res, 401, "Invalid store or PIN");
      return;
    }

    res.status(200).json({
      token: signToken({ role: "manager", storeId: store.id }),
      store: { id: store.id, name: store.name, branch: store.branch },
    });
  });
}

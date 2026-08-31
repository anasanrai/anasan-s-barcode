import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "../_lib/db";
import { hashPin } from "../_lib/auth";
import { readJson, requireRole, sendError, withApi } from "../_lib/http";
import { stores } from "../../drizzle/schema";

type CreateBody = { name?: string; branch?: string; pin?: string };
type PatchBody = { id?: string; name?: string; branch?: string; pin?: string; active?: boolean };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withApi(req, res, async () => {
    const auth = requireRole(req, "owner");
    if (!auth) {
      sendError(res, 401, "Owner authentication required");
      return;
    }

    const db = getDb();

    if (req.method === "GET") {
      const rows = await db
        .select({
          id: stores.id,
          name: stores.name,
          branch: stores.branch,
          active: stores.active,
          createdAt: stores.createdAt,
        })
        .from(stores)
        .orderBy(asc(stores.name));
      res.status(200).json({ stores: rows });
      return;
    }

    if (req.method === "POST") {
      const body = await readJson<CreateBody>(req);
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      const pin = typeof body?.pin === "string" ? body.pin : "";
      if (!name || !/^\d{4,8}$/.test(pin)) {
        sendError(res, 400, "name and 4-8 digit PIN are required");
        return;
      }
      const [store] = await db
        .insert(stores)
        .values({
          id: nanoid(12),
          name: name.slice(0, 120),
          branch: typeof body?.branch === "string" ? body.branch.trim().slice(0, 120) : "",
          pinHash: hashPin(pin),
        })
        .returning({ id: stores.id, name: stores.name, branch: stores.branch });
      res.status(201).json({ store });
      return;
    }

    if (req.method === "PATCH") {
      const body = await readJson<PatchBody>(req);
      const id = typeof body?.id === "string" ? body.id : "";
      if (!id) {
        sendError(res, 400, "id is required");
        return;
      }

      const updates: Partial<typeof stores.$inferInsert> = {};
      if (typeof body?.name === "string" && body.name.trim()) updates.name = body.name.trim().slice(0, 120);
      if (typeof body?.branch === "string") updates.branch = body.branch.trim().slice(0, 120);
      if (typeof body?.active === "boolean") updates.active = body.active;
      if (typeof body?.pin === "string" && /^\d{4,8}$/.test(body.pin)) {
        updates.pinHash = hashPin(body.pin);
      }

      if (Object.keys(updates).length === 0) {
        sendError(res, 400, "No valid fields to update");
        return;
      }

      const [store] = await db
        .update(stores)
        .set(updates)
        .where(eq(stores.id, id))
        .returning({ id: stores.id, name: stores.name, branch: stores.branch, active: stores.active });

      if (!store) {
        sendError(res, 404, "Store not found");
        return;
      }
      res.status(200).json({ store });
      return;
    }

    sendError(res, 405, "GET, POST or PATCH only");
  });
}

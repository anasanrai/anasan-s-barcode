import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq } from "drizzle-orm";
import { getDb } from "./_lib/db.js";
import { sendError, withApi } from "./_lib/http.js";
import { stores } from "../drizzle/schema.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withApi(req, res, async () => {
    if (req.method !== "GET") {
      sendError(res, 405, "GET only");
      return;
    }

    const rows = await getDb()
      .select({ id: stores.id, name: stores.name, branch: stores.branch })
      .from(stores)
      .where(eq(stores.active, true))
      .orderBy(asc(stores.name));

    res.status(200).json({ stores: rows });
  });
}

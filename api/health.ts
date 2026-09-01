import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "./_lib/db.js";
import { sendError, withApi } from "./_lib/http.js";
import { getISOWeek } from "../shared/scoring.js";
import { stores } from "../drizzle/schema.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withApi(req, res, async () => {
    if (req.method !== "GET") {
      sendError(res, 405, "GET only");
      return;
    }

    const db = getDb();
    const activeStores = await db.select({ id: stores.id }).from(stores);

    res.status(200).json({
      ok: true,
      week: getISOWeek(),
      activeStores: activeStores.length,
      time: new Date().toISOString(),
    });
  });
}

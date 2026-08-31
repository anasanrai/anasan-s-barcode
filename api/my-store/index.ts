import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { getDb } from "../_lib/db.js";
import { requireRole, sendError, withApi } from "../_lib/http.js";
import { getISOWeek } from "../../shared/scoring.js";
import { performers, submissions } from "../../drizzle/schema.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withApi(req, res, async () => {
    if (req.method !== "GET") {
      sendError(res, 405, "GET only");
      return;
    }

    const auth = requireRole(req, "manager");
    if (!auth?.storeId) {
      sendError(res, 401, "Manager authentication required");
      return;
    }

    const week = getISOWeek();
    const db = getDb();

    const [submission] = await db
      .select()
      .from(submissions)
      .where(and(eq(submissions.storeId, auth.storeId), eq(submissions.isoWeek, week)))
      .limit(1);

    const [performer] = await db
      .select()
      .from(performers)
      .where(and(eq(performers.storeId, auth.storeId), eq(performers.isoWeek, week)))
      .limit(1);

    res.status(200).json({
      week,
      submission: submission ?? null,
      performer: performer ? { ...performer, photo: performer.photo ?? null } : null,
    });
  });
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "../_lib/db.js";
import { readJson, requireRole, sendError, withApi } from "../_lib/http.js";
import { getISOWeek } from "../../shared/scoring.js";
import { submissions } from "../../drizzle/schema.js";

type MetricsBody = {
  totalOrders?: number;
  pickingMin?: number;
  assignmentMin?: number;
  fulfillmentRate?: number;
  compensationRate?: number;
};

function toNonNegativeFloat(value: unknown, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.min(Math.max(n, 0), max);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withApi(req, res, async () => {
    if (req.method !== "PUT") {
      sendError(res, 405, "PUT only");
      return;
    }

    const auth = requireRole(req, "manager");
    if (!auth?.storeId) {
      sendError(res, 401, "Manager authentication required");
      return;
    }

    const body = await readJson<MetricsBody>(req);
    if (!body) {
      sendError(res, 400, "Invalid JSON body");
      return;
    }

    const week = getISOWeek();
    const db = getDb();

    const values = {
      totalOrders: Math.round(toNonNegativeFloat(body.totalOrders, 1_000_000)),
      pickingMin: toNonNegativeFloat(body.pickingMin, 1440),
      assignmentMin: toNonNegativeFloat(body.assignmentMin, 1440),
      fulfillmentRate: toNonNegativeFloat(body.fulfillmentRate, 100),
      compensationRate: toNonNegativeFloat(body.compensationRate, 100),
      updatedAt: new Date(),
    };

    await db
      .insert(submissions)
      .values({ storeId: auth.storeId, isoWeek: week, ...values })
      .onConflictDoUpdate({
        target: [submissions.storeId, submissions.isoWeek],
        set: values,
      });

    res.status(200).json({ ok: true, week });
  });
}

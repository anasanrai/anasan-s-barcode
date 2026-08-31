import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../_lib/db.js";
import { readJson, requireRole, sendError, withApi } from "../_lib/http.js";
import { performers, stores, submissions } from "../../drizzle/schema.js";

type CorrectBody = {
  storeId?: string;
  isoWeek?: string;
  totalOrders?: number;
  pickingMin?: number;
  assignmentMin?: number;
  fulfillmentRate?: number;
  compensationRate?: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withApi(req, res, async () => {
    const auth = requireRole(req, "owner");
    if (!auth) {
      sendError(res, 401, "Owner authentication required");
      return;
    }

    const db = getDb();

    if (req.method === "GET") {
      const week = typeof req.query.week === "string" ? req.query.week : null;
      const base = db
        .select({
          storeId: submissions.storeId,
          storeName: stores.name,
          storeBranch: stores.branch,
          isoWeek: submissions.isoWeek,
          totalOrders: submissions.totalOrders,
          pickingMin: submissions.pickingMin,
          assignmentMin: submissions.assignmentMin,
          fulfillmentRate: submissions.fulfillmentRate,
          compensationRate: submissions.compensationRate,
          updatedAt: submissions.updatedAt,
        })
        .from(submissions)
        .innerJoin(stores, eq(stores.id, submissions.storeId));

      const rows = week
        ? await base.where(eq(submissions.isoWeek, week)).orderBy(desc(submissions.updatedAt)).limit(500)
        : await base.orderBy(desc(submissions.updatedAt)).limit(500);

      const performerRows = await db
        .select({
          storeId: performers.storeId,
          storeName: stores.name,
          isoWeek: performers.isoWeek,
          name: performers.name,
          role: performers.role,
          quote: performers.quote,
          badgeTitle: performers.badgeTitle,
          hasPhoto: performers.photo,
        })
        .from(performers)
        .innerJoin(stores, eq(stores.id, performers.storeId))
        .orderBy(desc(performers.updatedAt))
        .limit(500);

      res.status(200).json({
        submissions: rows,
        performers: performerRows.map((p) => ({ ...p, hasPhoto: Boolean(p.hasPhoto) })),
      });
      return;
    }

    if (req.method === "PUT") {
      const body = await readJson<CorrectBody>(req);
      const storeId = typeof body?.storeId === "string" ? body.storeId : "";
      const isoWeek = typeof body?.isoWeek === "string" ? body.isoWeek : "";
      if (!storeId || !/^\d{4}-W\d{2}$/.test(isoWeek)) {
        sendError(res, 400, "storeId and isoWeek (YYYY-Wnn) are required");
        return;
      }

      const clamp = (v: unknown, max: number) =>
        Math.min(Math.max(typeof v === "number" && Number.isFinite(v) ? v : 0, 0), max);

      const values = {
        totalOrders: Math.round(clamp(body?.totalOrders, 1_000_000)),
        pickingMin: clamp(body?.pickingMin, 1440),
        assignmentMin: clamp(body?.assignmentMin, 1440),
        fulfillmentRate: clamp(body?.fulfillmentRate, 100),
        compensationRate: clamp(body?.compensationRate, 100),
        updatedAt: new Date(),
      };

      await db
        .insert(submissions)
        .values({ storeId, isoWeek, ...values })
        .onConflictDoUpdate({ target: [submissions.storeId, submissions.isoWeek], set: values });

      res.status(200).json({ ok: true });
      return;
    }

    sendError(res, 405, "GET or PUT only");
  });
}

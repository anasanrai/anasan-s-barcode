import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { getDb } from "./_lib/db";
import { sendError, withApi } from "./_lib/http";
import { getISOWeek, rankStores } from "../shared/scoring";
import { performers, stores, submissions } from "../drizzle/schema";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withApi(req, res, async () => {
    if (req.method !== "GET") {
      sendError(res, 405, "GET only");
      return;
    }

    const week = getISOWeek();
    const db = getDb();

    const rows = await db
      .select({
        id: stores.id,
        name: stores.name,
        branch: stores.branch,
        totalOrders: submissions.totalOrders,
        pickingMin: submissions.pickingMin,
        assignmentMin: submissions.assignmentMin,
        fulfillmentRate: submissions.fulfillmentRate,
        compensationRate: submissions.compensationRate,
      })
      .from(submissions)
      .innerJoin(stores, eq(stores.id, submissions.storeId))
      .where(and(eq(submissions.isoWeek, week), eq(stores.active, true)));

    const ranked = rankStores(rows);

    const performerRows = await db
      .select({
        storeId: performers.storeId,
        name: performers.name,
        role: performers.role,
        quote: performers.quote,
        badgeTitle: performers.badgeTitle,
        photo: performers.photo,
        storeName: stores.name,
        storeBranch: stores.branch,
      })
      .from(performers)
      .innerJoin(stores, eq(stores.id, performers.storeId))
      .where(and(eq(performers.isoWeek, week), eq(stores.active, true)));

    const rankByStore = new Map(ranked.map((s) => [s.id, s.rank]));
    const performerList = performerRows
      .map((p) => ({
        storeId: p.storeId,
        storeName: p.storeName,
        storeBranch: p.storeBranch,
        storeRank: rankByStore.get(p.storeId) ?? null,
        name: p.name,
        role: p.role,
        quote: p.quote,
        badgeTitle: p.badgeTitle,
        photo: p.photo ?? null,
      }))
      .sort((a, b) => (a.storeRank ?? 999) - (b.storeRank ?? 999));

    res.status(200).json({ week, stores: ranked, performers: performerList });
  });
}

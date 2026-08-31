import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../_lib/db";
import { readJson, requireRole, sendError, withApi } from "../_lib/http";
import { getISOWeek } from "../../shared/scoring";
import { performers } from "../../drizzle/schema";

type PerformerBody = {
  name?: string;
  role?: string;
  quote?: string;
  badgeTitle?: string;
  photo?: string | null;
};

const MAX_PHOTO_CHARS = 300_000;

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

    const body = await readJson<PerformerBody>(req);
    if (!body) {
      sendError(res, 400, "Invalid JSON body");
      return;
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      sendError(res, 400, "Performer name is required");
      return;
    }

    const photo =
      typeof body.photo === "string" &&
      body.photo.startsWith("data:image/") &&
      body.photo.length <= MAX_PHOTO_CHARS
        ? body.photo
        : body.photo === null
          ? null
          : undefined;

    const week = getISOWeek();
    const db = getDb();

    const values = {
      name: name.slice(0, 120),
      role: typeof body.role === "string" ? body.role.slice(0, 120) : "",
      quote: typeof body.quote === "string" ? body.quote.slice(0, 400) : "",
      badgeTitle:
        typeof body.badgeTitle === "string" && body.badgeTitle.trim()
          ? body.badgeTitle.trim().slice(0, 80)
          : "HungerStation Market",
      updatedAt: new Date(),
      ...(photo !== undefined ? { photo } : {}),
    };

    await db
      .insert(performers)
      .values({ storeId: auth.storeId, isoWeek: week, ...values })
      .onConflictDoUpdate({
        target: [performers.storeId, performers.isoWeek],
        set: values,
      });

    const oldWeeks = await db
      .select({ isoWeek: performers.isoWeek })
      .from(performers)
      .where(and(eq(performers.storeId, auth.storeId), ne(performers.isoWeek, week)));

    const stale = oldWeeks.map((w) => w.isoWeek).sort().slice(0, -1);
    for (const w of stale) {
      await db
        .update(performers)
        .set({ photo: null })
        .where(and(eq(performers.storeId, auth.storeId), eq(performers.isoWeek, w)));
    }

    res.status(200).json({ ok: true, week });
  });
}

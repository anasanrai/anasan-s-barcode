import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendError, withApi } from "./_lib/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withApi(req, res, async () => {
    if (req.method !== "GET") {
      sendError(res, 405, "GET only");
      return;
    }

    res.status(200).json({
      ok: true,
      time: new Date().toISOString(),
    });
  });
}

import type { VercelRequest, VercelResponse } from "@vercel/node";

export function setCors(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function sendError(res: VercelResponse, status: number, message: string): void {
  res.status(status).json({ error: message });
}

export async function withApi(
  req: VercelRequest,
  res: VercelResponse,
  handler: () => Promise<void>,
): Promise<void> {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  try {
    await handler();
  } catch (err) {
    sendError(res, 500, "Internal server error");
  }
}

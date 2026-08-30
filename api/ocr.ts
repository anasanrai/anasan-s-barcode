import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  const { image } = (req.body ?? {}) as { image?: string };
  if (!image || typeof image !== "string") {
    res.status(400).json({ error: "missing image" });
    return;
  }
  // Strip data URL prefix if present
  const b64 = image.includes(",") ? image.split(",")[1] : image;
  const buf = Buffer.from(b64, "base64");
  // Optional: if NIM / OCR provider env is set, proxy there (future)
  const nimUrl = process.env.NIM_OCR_URL;
  const nimKey = process.env.NIM_API_KEY;
  if (nimUrl && nimKey) {
    try {
      const r = await fetch(nimUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${nimKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64 }),
      });
      const j = (await r.json()) as { text?: string };
      if (j.text) {
        res.status(200).json({ text: j.text });
        return;
      }
    } catch {}
  }

  // Fallback: use tesseract.js on the edge (local fast data)
  try {
    const { createWorker } = await import("tesseract.js");
    // Use local tessdata if available (Vercel includes client/public/tessdata via build)
    // For server, langPath can be absolute; if not found, fallback to CDN
    const worker: any = await (createWorker as any)("eng", 1, {
      langPath: "https://tessdata.projectnaptha.com/4.0.0_fast",
      gzip: true,
      cacheMethod: "write",
    });
    // Speed tune
    try {
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789Barcodes: ",
        tessedit_pageseg_mode: "6",
        classify_bln_numeric_mode: "1",
      });
    } catch {}
    const { data } = await worker.recognize(buf);
    await worker.terminate();
    res.status(200).json({ text: data.text ?? "" });
  } catch (e) {
    res.status(500).json({ error: "ocr failed", detail: String(e) });
  }
}

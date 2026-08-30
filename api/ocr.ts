import type { VercelRequest, VercelResponse } from "@vercel/node";

function extractTextFromNimResponse(j: unknown): string {
  // paddleocr / nemoretriever-ocr format: { data: [{ text_detections: [{text_prediction:{text,confidence}, bounding_box}...] }] }
  if (j && typeof j === "object" && "data" in j) {
    const data = (j as { data?: Array<{ text_detections?: Array<{ text_prediction?: { text?: string }; text?: string }> }> }).data;
    if (Array.isArray(data) && data[0]?.text_detections) {
      return data[0].text_detections
        .map((d) => d.text_prediction?.text ?? d.text ?? "")
        .join("\n");
    }
  }
  // integrate nemotron-parse tool_calls format
  if (j && typeof j === "object" && "choices" in j) {
    const choices = (j as { choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ function?: { arguments?: string } }> } }> }).choices;
    const tc = choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (tc) {
      try {
        const parsed = JSON.parse(tc);
        if (Array.isArray(parsed)) return parsed.flat().join("\n");
      } catch {}
      return String(tc);
    }
    const content = choices?.[0]?.message?.content;
    if (content) return String(content);
  }
  if (j && typeof j === "object" && "text" in j) return String((j as { text?: string }).text ?? "");
  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS for PWA
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
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
  const b64 = image.replace(/^data:image\/\w+;base64,/, "");
  const dataUrl = `data:image/jpeg;base64,${b64}`;

  // NIM OCR — paddleocr is the proven endpoint (99% confidence, ~600ms)
  // nemoretriever-ocr returns EMPTY (it's document retrieval, not OCR)
  const nimKey = process.env.NIM_API_KEY;
  const nimUrl =
    process.env.NIM_OCR_URL || (nimKey ? "https://ai.api.nvidia.com/v1/cv/baidu/paddleocr" : null);

  if (nimKey && nimUrl) {
    const start = Date.now();
    try {
      const r = await fetch(nimUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${nimKey}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ input: [{ type: "image_url", url: dataUrl }] }),
      });
      const elapsed = Date.now() - start;
      if (r.status === 401 || r.status === 403) {
        console.error(`[ocr] NIM auth failed: ${r.status} (${elapsed}ms)`);
        res.status(500).json({ error: "nvidia auth failed — check NIM_API_KEY", status: r.status });
        return;
      }
      if (!r.ok) {
        console.error(`[ocr] NIM ${r.status} (${elapsed}ms)`);
      } else {
        const j = await r.json();
        const text = extractTextFromNimResponse(j);
        console.log(`[ocr] NIM OK ${elapsed}ms text="${text?.slice(0, 60)}"`);
        if (text && text.trim()) {
          res.status(200).json({ text });
          return;
        }
      }
    } catch (e) {
      console.error(`[ocr] NIM error:`, e);
    }
  }

  // Fallback: local tesseract.js
  try {
    const { createWorker } = await import("tesseract.js");
    const worker: unknown = await (createWorker as unknown as (lang: string, oem: number, opts: unknown) => Promise<unknown>)("eng", 1, {
      langPath: "https://tessdata.projectnaptha.com/4.0.0_fast",
      gzip: true,
      cacheMethod: "write",
    });
    const w = worker as {
      setParameters: (p: Record<string, string>) => Promise<void>;
      recognize: (b: Buffer) => Promise<{ data: { text: string } }>;
      terminate: () => Promise<void>;
    };
    try {
      await w.setParameters({
        tessedit_char_whitelist: "0123456789Barcodes: ",
        tessedit_pageseg_mode: "6",
        classify_bln_numeric_mode: "1",
      });
    } catch {}
    const buf = Buffer.from(b64, "base64");
    const { data } = await w.recognize(buf);
    await w.terminate();
    res.status(200).json({ text: data.text ?? "" });
  } catch (e) {
    res.status(500).json({ error: "ocr failed", detail: String(e) });
  }
}

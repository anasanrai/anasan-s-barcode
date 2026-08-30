/**
 * Resize and compress an image client-side so it stays under a byte budget.
 * Returns a JPEG data URL.
 */
export interface ResizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxBytes?: number;
  quality?: number;
  minQuality?: number;
  type?: string;
}

export function resizeImageToDataUrl(
  file: File,
  {
    maxWidth = 1024,
    maxHeight = 1024,
    maxBytes = 500 * 1024,
    quality = 0.85,
    minQuality = 0.5,
    type = "image/jpeg",
  }: ResizeOptions = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image for resizing"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not available"));
          return;
        }

        // Fill white background for JPEG output
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const tryCompress = (q: number): string => {
          return canvas.toDataURL(type, q);
        };

        let q = quality;
        let dataUrl = tryCompress(q);

        // Estimate byte size from base64 length
        const byteLength = (str: string) => Math.round((str.split(",")[1]?.length ?? 0) * 0.75);

        while (byteLength(dataUrl) > maxBytes && q > minQuality + 0.05) {
          q -= 0.05;
          dataUrl = tryCompress(q);
        }

        resolve(dataUrl);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

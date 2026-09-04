/**
 * Screen-optimized image preprocessing pipeline.
 * Designed for electronic screens (LCD/OLED), glare mitigation, reflection gradients,
 * low-contrast text, dark mode screens, and camera motion blur.
 */

export type PreprocessPass = "standard" | "glare_mitigation" | "adaptive_binarize" | "inverted" | "sharpen";

export function preprocessFrame(
  srcCanvas: HTMLCanvasElement,
  pass: PreprocessPass = "standard",
  targetCanvas?: HTMLCanvasElement,
): HTMLCanvasElement {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const out = targetCanvas || document.createElement("canvas");
  if (out.width !== w || out.height !== h) {
    out.width = w;
    out.height = h;
  }

  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) return srcCanvas;

  ctx.drawImage(srcCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  preprocessPixelBuffer(imgData.data, w, h, pass);
  ctx.putImageData(imgData, 0, 0);
  return out;
}

/**
 * Process a raw RGBA Uint8ClampedArray pixel buffer in-place
 */
export function preprocessPixelBuffer(
  d: Uint8ClampedArray,
  width: number,
  height: number,
  pass: PreprocessPass = "standard",
): void {
  const totalPixels = width * height;
  switch (pass) {
    case "standard": {
      applyStandardContrastStretch(d, totalPixels);
      break;
    }
    case "glare_mitigation": {
      applyGlareMitigation(d, width, height);
      break;
    }
    case "adaptive_binarize": {
      applyAdaptiveThreshold(d, width, height);
      break;
    }
    case "inverted": {
      applyInvertedContrast(d, totalPixels);
      break;
    }
    case "sharpen": {
      applySharpenConvolution(d, width, height);
      break;
    }
  }
}

/**
 * Pass 1: Fast integer luma grayscale + 5th-95th percentile contrast stretch + S-curve LUT
 */
export function applyStandardContrastStretch(d: Uint8ClampedArray, totalPixels: number): void {
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const gray = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    d[i] = d[i + 1] = d[i + 2] = gray;
    hist[gray]++;
  }

  let count = 0;
  let lo = 0;
  let hi = 255;
  const loThresh = totalPixels * 0.05;
  const hiThresh = totalPixels * 0.95;

  for (let i = 0; i < 256; i++) {
    count += hist[i];
    if (count >= loThresh && lo === 0) lo = i;
    if (count >= hiThresh) {
      hi = i;
      break;
    }
  }

  const range = Math.max(1, hi - lo);
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    if (i <= lo) lut[i] = 0;
    else if (i >= hi) lut[i] = 255;
    else {
      const norm = (i - lo) / range;
      lut[i] = norm < 0.5
        ? Math.max(0, Math.round(norm * 1.8 * 128))
        : Math.min(255, Math.round(128 + (norm - 0.5) * 2 * 127));
    }
  }

  for (let i = 0; i < d.length; i += 4) {
    const v = lut[d[i]];
    d[i] = d[i + 1] = d[i + 2] = v;
  }
}
// Module-level reusable typed array buffers to eliminate GC allocations during frame loops
let cachedGray: Uint8Array | null = null;
let cachedIntegral: Uint32Array | null = null;

function getGrayBuffer(size: number): Uint8Array {
  if (!cachedGray || cachedGray.length < size) {
    cachedGray = new Uint8Array(size);
  }
  return cachedGray;
}

function getIntegralBuffer(size: number): Uint32Array {
  if (!cachedIntegral || cachedIntegral.length < size) {
    cachedIntegral = new Uint32Array(size);
  }
  return cachedIntegral;
}

/**
 * Pass 2: Glare Mitigation via local background gradient division.
 */
export function applyGlareMitigation(d: Uint8ClampedArray, width: number, height: number): void {
  const totalPixels = width * height;
  const gray = getGrayBuffer(totalPixels);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    gray[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  }

  const intW = width + 1;
  const intTotal = intW * (height + 1);
  const integral = getIntegralBuffer(intTotal);
  integral.fill(0, 0, intTotal);

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    const grayRow = y * width;
    const intRowPrev = y * intW;
    const intRowCurr = (y + 1) * intW;

    for (let x = 0; x < width; x++) {
      rowSum += gray[grayRow + x];
      integral[intRowCurr + x + 1] = integral[intRowPrev + x + 1] + rowSum;
    }
  }

  const radius = Math.max(4, Math.round(width * 0.06));

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    const rowOffset = y * width;

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const area = (x1 - x0) * (y1 - y0);

      const sum =
        integral[y1 * intW + x1] -
        integral[y0 * intW + x1] -
        integral[y1 * intW + x0] +
        integral[y0 * intW + x0];
      const localMean = sum / area;

      const px = gray[rowOffset + x];
      const diff = px - localMean;
      let val = Math.round(128 + diff * 2.2);
      if (val < 0) val = 0;
      if (val > 255) val = 255;

      const idx = (rowOffset + x) * 4;
      d[idx] = d[idx + 1] = d[idx + 2] = val;
    }
  }
}

/**
 * Pass 3: Adaptive Thresholding
 */
export function applyAdaptiveThreshold(
  d: Uint8ClampedArray,
  width: number,
  height: number,
  sensitivity = 0.15,
): void {
  const totalPixels = width * height;
  const gray = getGrayBuffer(totalPixels);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    gray[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  }

  const intW = width + 1;
  const intTotal = intW * (height + 1);
  const integral = getIntegralBuffer(intTotal);
  integral.fill(0, 0, intTotal);

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    const grayRow = y * width;
    const intRowPrev = y * intW;
    const intRowCurr = (y + 1) * intW;

    for (let x = 0; x < width; x++) {
      rowSum += gray[grayRow + x];
      integral[intRowCurr + x + 1] = integral[intRowPrev + x + 1] + rowSum;
    }
  }

  const radius = Math.max(3, Math.round(width * 0.04));

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    const rowOffset = y * width;

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const area = (x1 - x0) * (y1 - y0);

      const sum =
        integral[y1 * intW + x1] -
        integral[y0 * intW + x1] -
        integral[y1 * intW + x0] +
        integral[y0 * intW + x0];
      const threshold = (sum / area) * (1 - sensitivity);

      const val = gray[rowOffset + x] < threshold ? 0 : 255;
      const idx = (rowOffset + x) * 4;
      d[idx] = d[idx + 1] = d[idx + 2] = val;
    }
  }
}

/**
 * Pass 4: Inverted Polarity Contrast Stretch
 */
export function applyInvertedContrast(d: Uint8ClampedArray, totalPixels: number): void {
  applyStandardContrastStretch(d, totalPixels);
  for (let i = 0; i < d.length; i += 4) {
    const inv = 255 - d[i];
    d[i] = d[i + 1] = d[i + 2] = inv;
  }
}

/**
 * Pass 5: 3x3 Sharpening Convolution
 */
export function applySharpenConvolution(d: Uint8ClampedArray, width: number, height: number): void {
  const gray = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    gray[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  }

  for (let y = 1; y < height - 1; y++) {
    const prevRow = (y - 1) * width;
    const currRow = y * width;
    const nextRow = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const c = gray[currRow + x];
      const t = gray[prevRow + x];
      const b = gray[nextRow + x];
      const l = gray[currRow + x - 1];
      const r = gray[currRow + x + 1];

      let sharp = c * 5 - (t + b + l + r);
      if (sharp < 0) sharp = 0;
      if (sharp > 255) sharp = 255;

      const idx = (currRow + x) * 4;
      d[idx] = d[idx + 1] = d[idx + 2] = sharp;
    }
  }
}

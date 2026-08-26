/** Signal Field design system: camera acquisition stabilizes focus once and avoids repeated focus commands that blur photographed displays. */

export type CameraAccessIssue =
  | "denied"
  | "overlay"
  | "unavailable"
  | "busy"
  | "insecure"
  | "constraints"
  | "host"
  | "unknown";
export type CameraRuntimeDiagnostics = {
  secureContext: boolean;
  mediaDevicesAvailable: boolean;
  embedded: boolean;
  cameraPolicy: "allowed" | "blocked" | "unknown";
};
export type CameraRegion = { x0: number; y0: number; x1: number; y1: number };

export class CameraAccessError extends Error {
  constructor(
    public readonly issue: CameraAccessIssue,
    message: string,
    public readonly diagnostics: CameraRuntimeDiagnostics
  ) {
    super(message);
  }
}

export class CameraService {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private facingMode: "environment" | "user" = "environment";
  private focusFrozen = false;

  getRuntimeDiagnostics(): CameraRuntimeDiagnostics {
    const embedded = (() => {
      try {
        return window.top !== window.self;
      } catch {
        return true;
      }
    })();
    const documentWithPolicy = document as Document & {
      permissionsPolicy?: { allowsFeature: (feature: string) => boolean };
      featurePolicy?: { allowsFeature: (feature: string) => boolean };
    };
    const policy =
      documentWithPolicy.permissionsPolicy ?? documentWithPolicy.featurePolicy;
    let cameraPolicy: CameraRuntimeDiagnostics["cameraPolicy"] = "unknown";
    try {
      if (policy)
        cameraPolicy = policy.allowsFeature("camera") ? "allowed" : "blocked";
    } catch {
      /* Policy API differs across browsers. */
    }
    return {
      secureContext: window.isSecureContext,
      mediaDevicesAvailable: Boolean(navigator.mediaDevices?.getUserMedia),
      embedded,
      cameraPolicy,
    };
  }

  isAndroid(): boolean {
    return /Android/i.test(navigator.userAgent);
  }

  async getPermissionState(): Promise<PermissionState | "unsupported"> {
    if (!navigator.permissions?.query) return "unsupported";
    try {
      return (
        await navigator.permissions.query({ name: "camera" as PermissionName })
      ).state;
    } catch {
      return "unsupported";
    }
  }

  async start(video: HTMLVideoElement): Promise<void> {
    const diagnostics = this.getRuntimeDiagnostics();
    if (!diagnostics.secureContext)
      throw new CameraAccessError(
        "insecure",
        "Camera access requires a secure HTTPS connection.",
        diagnostics
      );
    if (!diagnostics.mediaDevicesAvailable)
      throw new CameraAccessError(
        "unavailable",
        "This browser does not expose a camera API.",
        diagnostics
      );

    this.stop();
    this.video = video;
    const attempts: MediaStreamConstraints[] = [
      {
        audio: false,
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
      },
      { audio: false, video: { facingMode: this.facingMode } },
      { audio: false, video: true },
    ];

    let lastError: unknown;
    for (const constraints of attempts) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (error) {
        lastError = error;
        const normalized = normalizeCameraError(error, diagnostics);
        if (
          normalized.issue === "denied" ||
          normalized.issue === "host" ||
          normalized.issue === "busy"
        )
          throw normalized;
      }
    }
    if (!this.stream) throw normalizeCameraError(lastError, diagnostics);

    video.srcObject = this.stream;
    video.playsInline = true;
    await video.play();
  }

  stop(): void {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.video = null;
    this.focusFrozen = false;
  }

  async switchCamera(video: HTMLVideoElement): Promise<void> {
    this.facingMode =
      this.facingMode === "environment" ? "user" : "environment";
    await this.start(video);
  }

  async setTorch(enabled: boolean): Promise<boolean> {
    const track = this.stream?.getVideoTracks()[0] as MediaStreamTrack & {
      getCapabilities?: () => MediaTrackCapabilities;
    };
    const capabilities =
      track?.getCapabilities?.() as MediaTrackCapabilities & {
        torch?: boolean;
      };
    if (!track || !capabilities?.torch) return false;
    await track.applyConstraints({
      advanced: [{ torch: enabled } as MediaTrackConstraintSet],
    });
    return true;
  }

  async setZoom(zoom: number): Promise<boolean> {
    const track = this.stream?.getVideoTracks()[0] as MediaStreamTrack & {
      getCapabilities?: () => MediaTrackCapabilities;
    };
    const capabilities =
      track?.getCapabilities?.() as MediaTrackCapabilities & {
        zoom?: { min: number; max: number };
      };
    if (!track || !capabilities?.zoom) return false;
    await track.applyConstraints({
      advanced: [{ zoom } as MediaTrackConstraintSet],
    });
    return true;
  }

  async freezeFocusWhenSharp(): Promise<void> {
    if (this.focusFrozen) return;
    const track = this.stream?.getVideoTracks()[0] as MediaStreamTrack & {
      getCapabilities?: () => MediaTrackCapabilities;
    };
    const capabilities =
      track?.getCapabilities?.() as MediaTrackCapabilities & {
        focusMode?: string[];
        focusDistance?: { min: number; max: number };
      };
    const settings = track?.getSettings?.() as MediaTrackSettings & {
      focusDistance?: number;
    };
    if (!track || !capabilities?.focusMode?.includes("manual")) {
      this.focusFrozen = true;
      return;
    }
    try {
      const focusDistance = settings?.focusDistance;
      const lock =
        Number.isFinite(focusDistance) && capabilities.focusDistance
          ? { focusMode: "manual", focusDistance }
          : { focusMode: "manual" };
      await track.applyConstraints({
        advanced: [lock as MediaTrackConstraintSet],
      });
    } catch {
      /* Retain the browser-selected focus mode if manual locking is unavailable. */
    }
    this.focusFrozen = true;
  }

  measureSharpness(frame: HTMLCanvasElement, region?: CameraRegion): number {
    const context = frame.getContext("2d", { willReadFrequently: true });
    if (!context || frame.width < 3 || frame.height < 3) return 0;
    const data = context.getImageData(0, 0, frame.width, frame.height).data;
    const stride = Math.max(
      2,
      Math.floor(Math.min(frame.width, frame.height) / 180)
    );
    let contrast = 0;
    let samples = 0;
    const luminance = (offset: number) =>
      data[offset] * 0.2126 +
      data[offset + 1] * 0.7152 +
      data[offset + 2] * 0.0722;
    const left = Math.max(stride, Math.floor(region?.x0 ?? 0));
    const top = Math.max(stride, Math.floor(region?.y0 ?? 0));
    const right = Math.min(
      frame.width - stride,
      Math.ceil(region?.x1 ?? frame.width)
    );
    const bottom = Math.min(
      frame.height - stride,
      Math.ceil(region?.y1 ?? frame.height)
    );
    for (let y = top; y < bottom; y += stride) {
      for (let x = left; x < right; x += stride) {
        const index = (y * frame.width + x) * 4;
        contrast += Math.abs(
          luminance(index) - luminance((y * frame.width + x + stride) * 4)
        );
        contrast += Math.abs(
          luminance(index) - luminance(((y + stride) * frame.width + x) * 4)
        );
        samples += 2;
      }
    }
    return samples ? contrast / samples : 0;
  }

  assessFrameQuality(
    frame: HTMLCanvasElement,
    region?: CameraRegion
  ): {
    state: "ready" | "soft" | "dim" | "glare";
    label: string;
    sharpness: number;
  } {
    const context = frame.getContext("2d", { willReadFrequently: true });
    const sharpness = this.measureSharpness(frame, region);
    if (!context) return { state: "soft", label: "ANALYZING LENS", sharpness };
    const data = context.getImageData(0, 0, frame.width, frame.height).data;
    const stride = Math.max(
      3,
      Math.floor(Math.min(frame.width, frame.height) / 100)
    );
    let samples = 0;
    let luminanceTotal = 0;
    let highlights = 0;
    let shadows = 0;
    const left = Math.max(0, Math.floor(region?.x0 ?? 0));
    const top = Math.max(0, Math.floor(region?.y0 ?? 0));
    const right = Math.min(frame.width, Math.ceil(region?.x1 ?? frame.width));
    const bottom = Math.min(
      frame.height,
      Math.ceil(region?.y1 ?? frame.height)
    );
    for (let y = top; y < bottom; y += stride) {
      for (let x = left; x < right; x += stride) {
        const index = (y * frame.width + x) * 4;
        const luminance =
          data[index] * 0.2126 +
          data[index + 1] * 0.7152 +
          data[index + 2] * 0.0722;
        luminanceTotal += luminance;
        if (luminance > 242) highlights += 1;
        if (luminance < 38) shadows += 1;
        samples += 1;
      }
    }
    const mean = samples ? luminanceTotal / samples : 0;
    if (sharpness < 7)
      return { state: "soft", label: "HOLD STEADY", sharpness };
    if (samples && highlights / samples > 0.18)
      return { state: "glare", label: "TILT FROM GLARE", sharpness };
    if (mean < 62 || (samples && shadows / samples > 0.62))
      return { state: "dim", label: "ADD MORE LIGHT", sharpness };
    return { state: "ready", label: "LENS READY", sharpness };
  }

  captureCenteredFrame(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    screenMode = false
  ): HTMLCanvasElement | null {
    if (!video.videoWidth || !video.videoHeight) return null;
    const cropWidth = Math.round(video.videoWidth * (screenMode ? 0.92 : 0.84));
    const cropHeight = Math.round(
      video.videoHeight * (screenMode ? 0.72 : 0.37)
    );
    const startX = Math.round((video.videoWidth - cropWidth) / 2);
    const startY = Math.round((video.videoHeight - cropHeight) / 2);
    const scale = Math.min(1, 1120 / Math.max(cropWidth, cropHeight));
    canvas.width = Math.max(1, Math.round(cropWidth * scale));
    canvas.height = Math.max(1, Math.round(cropHeight * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(
      video,
      startX,
      startY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
    return canvas;
  }

  normalizeScreenFrame(frame: HTMLCanvasElement): void {
    const context = frame.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    const image = context.getImageData(0, 0, frame.width, frame.height);
    const values: number[] = [];
    const stride = Math.max(
      3,
      Math.floor(Math.min(frame.width, frame.height) / 120)
    );
    for (let y = 0; y < frame.height; y += stride) {
      for (let x = 0; x < frame.width; x += stride) {
        const index = (y * frame.width + x) * 4;
        values.push(
          image.data[index] * 0.2126 +
            image.data[index + 1] * 0.7152 +
            image.data[index + 2] * 0.0722
        );
      }
    }
    if (values.length < 8) return;
    values.sort((a, b) => a - b);
    const low = values[Math.floor(values.length * 0.06)];
    const high = values[Math.ceil(values.length * 0.94) - 1];
    if (!Number.isFinite(low) || !Number.isFinite(high) || high - low < 18)
      return;
    const scale = 255 / (high - low);
    for (let index = 0; index < image.data.length; index += 4) {
      const luminance =
        image.data[index] * 0.2126 +
        image.data[index + 1] * 0.7152 +
        image.data[index + 2] * 0.0722;
      const normalized = Math.max(0, Math.min(255, (luminance - low) * scale));
      image.data[index] = normalized;
      image.data[index + 1] = normalized;
      image.data[index + 2] = normalized;
    }
    context.putImageData(image, 0, 0);
  }

  createFastScreenFrame(frame: HTMLCanvasElement): HTMLCanvasElement | null {
    if (!frame.width || !frame.height) return null;
    const output = document.createElement("canvas");
    const cropHeight = Math.max(1, Math.round(frame.height * 0.56));
    const cropTop = Math.max(0, Math.round((frame.height - cropHeight) / 2));
    const scale = Math.min(1, 960 / frame.width);
    output.width = Math.max(1, Math.round(frame.width * scale));
    output.height = Math.max(1, Math.round(cropHeight * scale));
    const context = output.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(
      frame,
      0,
      cropTop,
      frame.width,
      cropHeight,
      0,
      0,
      output.width,
      output.height
    );
    return output;
  }

  createHandwritingFrame(frame: HTMLCanvasElement): HTMLCanvasElement | null {
    const source = frame.getContext("2d", { willReadFrequently: true });
    if (!source) return null;
    const image = source.getImageData(0, 0, frame.width, frame.height);
    const output = document.createElement("canvas");
    output.width = frame.width;
    output.height = frame.height;
    const target = output.getContext("2d", { willReadFrequently: true });
    if (!target) return null;
    const sampleStep = Math.max(
      4,
      Math.floor(Math.min(frame.width, frame.height) / 160)
    );
    const samples: number[] = [];
    for (let y = 0; y < frame.height; y += sampleStep) {
      for (let x = 0; x < frame.width; x += sampleStep) {
        const index = (y * frame.width + x) * 4;
        samples.push(
          image.data[index] * 0.2126 +
            image.data[index + 1] * 0.7152 +
            image.data[index + 2] * 0.0722
        );
      }
    }
    if (samples.length < 8) return null;
    samples.sort((left, right) => left - right);
    const paper = samples[Math.floor(samples.length * 0.72)] ?? 200;
    const inkThreshold = Math.max(70, Math.min(190, paper - 42));
    for (let index = 0; index < image.data.length; index += 4) {
      const luminance =
        image.data[index] * 0.2126 +
        image.data[index + 1] * 0.7152 +
        image.data[index + 2] * 0.0722;
      const value = luminance < inkThreshold ? 0 : 255;
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
    }
    target.putImageData(image, 0, 0);
    return output;
  }

  createAdaptiveBarcodeFrame(
    frame: HTMLCanvasElement
  ): HTMLCanvasElement | null {
    const source = frame.getContext("2d", { willReadFrequently: true });
    if (!source) return null;
    const image = source.getImageData(0, 0, frame.width, frame.height);
    const values: number[] = [];
    const stride = Math.max(
      3,
      Math.floor(Math.min(frame.width, frame.height) / 120)
    );
    for (let y = 0; y < frame.height; y += stride) {
      for (let x = 0; x < frame.width; x += stride) {
        const index = (y * frame.width + x) * 4;
        values.push(
          image.data[index] * 0.2126 +
            image.data[index + 1] * 0.7152 +
            image.data[index + 2] * 0.0722
        );
      }
    }
    if (values.length < 8) return null;
    values.sort((leftValue, rightValue) => leftValue - rightValue);
    const low = values[Math.floor(values.length * 0.04)];
    const high = values[Math.ceil(values.length * 0.96) - 1];
    if (!Number.isFinite(low) || !Number.isFinite(high) || high - low < 12)
      return null;
    const output = document.createElement("canvas");
    output.width = frame.width;
    output.height = frame.height;
    const target = output.getContext("2d", { willReadFrequently: true });
    if (!target) return null;
    const scale = 255 / (high - low);
    for (let index = 0; index < image.data.length; index += 4) {
      const luminance =
        image.data[index] * 0.2126 +
        image.data[index + 1] * 0.7152 +
        image.data[index + 2] * 0.0722;
      const normalized = Math.max(0, Math.min(250, (luminance - low) * scale));
      image.data[index] = normalized;
      image.data[index + 1] = normalized;
      image.data[index + 2] = normalized;
    }
    target.putImageData(image, 0, 0);
    return output;
  }

  rotateFrame(
    frame: HTMLCanvasElement,
    degrees: number
  ): HTMLCanvasElement | null {
    if (!frame.width || !frame.height) return null;
    const radians = (degrees * Math.PI) / 180;
    const cosine = Math.abs(Math.cos(radians));
    const sine = Math.abs(Math.sin(radians));
    const rotated = document.createElement("canvas");
    rotated.width = Math.ceil(frame.width * cosine + frame.height * sine);
    rotated.height = Math.ceil(frame.width * sine + frame.height * cosine);
    const context = rotated.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.fillStyle = "#101312";
    context.fillRect(0, 0, rotated.width, rotated.height);
    context.translate(rotated.width / 2, rotated.height / 2);
    context.rotate(radians);
    context.drawImage(frame, -frame.width / 2, -frame.height / 2);
    return rotated;
  }
}

export type FrameMotionState = {
  stable: boolean;
  motion: number;
  stableFrames: number;
};

export function shouldWaitForScreenSharpness(
  runManualCapture: boolean,
  sharpness: number
): boolean {
  return !runManualCapture && sharpness < 7;
}

export function shouldWaitForFrameMotion(
  runManualCapture: boolean,
  screenMode: boolean,
  immediateCapture: boolean,
  stable: boolean
): boolean {
  return !runManualCapture && !stable && !(screenMode && immediateCapture);
}

export class FrameMotionTracker {
  private previous: Float32Array | null = null;
  private stableFrames = 0;

  constructor(
    private readonly requiredStableFrames = 2,
    private readonly motionThreshold = 12
  ) {}

  reset(): void {
    this.previous = null;
    this.stableFrames = 0;
  }

  observe(frame: HTMLCanvasElement): FrameMotionState {
    const signature = this.signature(frame);
    if (!signature) return { stable: false, motion: Infinity, stableFrames: 0 };
    if (!this.previous) {
      this.previous = signature;
      this.stableFrames = 0;
      return { stable: false, motion: Infinity, stableFrames: 0 };
    }
    let difference = 0;
    for (let index = 0; index < signature.length; index += 1)
      difference += Math.abs(signature[index] - this.previous[index]);
    const motion = difference / signature.length;
    this.stableFrames =
      motion <= this.motionThreshold ? this.stableFrames + 1 : 0;
    this.previous = signature;
    return {
      stable: this.stableFrames >= this.requiredStableFrames,
      motion,
      stableFrames: this.stableFrames,
    };
  }

  private signature(frame: HTMLCanvasElement): Float32Array | null {
    const context = frame.getContext("2d", { willReadFrequently: true });
    if (!context || !frame.width || !frame.height) return null;
    const pixels = context.getImageData(0, 0, frame.width, frame.height).data;
    const columns = 12;
    const rows = 8;
    const values = new Float32Array(columns * rows);
    let sample = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = Math.min(
          frame.width - 1,
          Math.floor(((column + 0.5) * frame.width) / columns)
        );
        const y = Math.min(
          frame.height - 1,
          Math.floor(((row + 0.5) * frame.height) / rows)
        );
        const index = (y * frame.width + x) * 4;
        values[sample] =
          pixels[index] * 0.2126 +
          pixels[index + 1] * 0.7152 +
          pixels[index + 2] * 0.0722;
        sample += 1;
      }
    }
    return values;
  }
}

function normalizeCameraError(
  error: unknown,
  diagnostics: CameraRuntimeDiagnostics
): CameraAccessError {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      if (diagnostics.embedded || diagnostics.cameraPolicy === "blocked")
        return new CameraAccessError(
          "host",
          "The embedded preview browser is blocking camera access.",
          diagnostics
        );
      return new CameraAccessError(
        "denied",
        "Camera permission was not granted.",
        diagnostics
      );
    }
    if (error.name === "NotFoundError")
      return new CameraAccessError(
        "unavailable",
        "No camera was found on this device.",
        diagnostics
      );
    if (error.name === "NotReadableError" || error.name === "AbortError")
      return new CameraAccessError(
        "busy",
        "Another app or browser tab may already be using the camera.",
        diagnostics
      );
    if (error.name === "OverconstrainedError")
      return new CameraAccessError(
        "constraints",
        "This camera does not support the requested settings.",
        diagnostics
      );
  }
  return new CameraAccessError(
    "unknown",
    "The camera could not be started.",
    diagnostics
  );
}

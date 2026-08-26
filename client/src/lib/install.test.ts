import { describe, expect, it } from "vitest";
import { getInstallMode, isIosUserAgent } from "./install";

describe("progressive-web-app installation state", () => {
  it("recognizes iPhone and iPad user agents", () => {
    expect(isIosUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIosUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIosUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(false);
  });

  it("selects native, iOS, and browser-menu installation paths safely", () => {
    expect(getInstallMode({ isIos: false, isStandalone: false, hasDeferredPrompt: true })).toBe("native-prompt");
    expect(getInstallMode({ isIos: true, isStandalone: false, hasDeferredPrompt: false })).toBe("ios-guide");
    expect(getInstallMode({ isIos: false, isStandalone: false, hasDeferredPrompt: false })).toBe("browser-menu");
    expect(getInstallMode({ isIos: true, isStandalone: true, hasDeferredPrompt: true })).toBe("installed");
  });
});

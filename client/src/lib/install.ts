export type InstallMode = "installed" | "ios-guide" | "native-prompt" | "browser-menu";

export type InstallContext = {
  isIos: boolean;
  isStandalone: boolean;
  hasDeferredPrompt: boolean;
};

export function isIosUserAgent(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const safariStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  const isCapacitor = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    safariStandalone === true ||
    isCapacitor
  );
}

export function getInstallMode({ isIos, isStandalone, hasDeferredPrompt }: InstallContext): InstallMode {
  if (isStandalone) return "installed";
  if (isIos) return "ios-guide";
  return hasDeferredPrompt ? "native-prompt" : "browser-menu";
}

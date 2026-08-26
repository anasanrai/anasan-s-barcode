export type InstallMode = "installed" | "ios-guide" | "native-prompt" | "browser-menu";

export type InstallContext = {
  isIos: boolean;
  isStandalone: boolean;
  hasDeferredPrompt: boolean;
};

export function isIosUserAgent(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}

export function getInstallMode({ isIos, isStandalone, hasDeferredPrompt }: InstallContext): InstallMode {
  if (isStandalone) return "installed";
  if (isIos) return "ios-guide";
  return hasDeferredPrompt ? "native-prompt" : "browser-menu";
}

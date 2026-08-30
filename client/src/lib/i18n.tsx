import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "en" | "ar";

const strings = {
  en: {
    title: "HungerStation Barcode",
    subtitle: "Scan. Generate. Done.",
    barcode: "Barcode",
    qrCode: "QR Code",
    enterText: "Enter text or digits…",
    enterDigits: "Enter digits…",
    enterTextOrUrl: "Enter text or URL…",
    switchToScanner: "Switch to Scanner",
    switchToGenerate: "Switch to Generator",
    scan: "Scan",
    generate: "Generate",
    scanNext: "Scan Next",
    scanResult: "Scanned Barcode",
    install: "Install",
    installTitle: "Install HungerStation Barcode",
    addHomeScreen: "Add to Home Screen",
    iosGuide: "In Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>, then <b>Add</b>.",
    browserGuide: "Open your browser menu and choose <b>Install app</b> or <b>Add to Home Screen</b>.",
    installFromBrowser: "Install from your browser menu",
    capture: "Capture",
    capturing: "Scanning…",
    captureRetry: "No number found — adjust and tap Capture again",
    flashOn: "Flash on",
    flashOff: "Flash",
    flashUnavailable: "Flash unavailable",
    tapToStart: "Tap to start camera",
    startingCamera: "Starting camera…",
    uploadImage: "Upload image",
    cameraUnavailable: "Camera unavailable — upload a photo.",
    pointAtBarcode: "Point at barcode number.",
    anyAscii: "Any ASCII text",
    chars: (n: number) => `${n} chars`,
    digits: (n: number) => `${n} digits`,
    tabOrTap: " — Tab or tap suggestion",
    invalid: "Invalid",
    notReady: "Barcode not ready.",
    couldNotSave: "Could not save barcode.",
    couldNotGenerate: "Could not generate QR code.",
    couldNotSaveQr: "Could not save QR code.",
    typeForQr: "Type something to generate QR",
    voiceTyping: "Voice typing (tap to speak)",
    listening: "Listening… speak number",
    voiceUnsupported: "Voice recognition not supported in this browser",
    clear: "Clear input",
    leaderboard: "Leaderboard",
    admin: "Admin",
    en: "EN",
    ar: "AR",
  },
  ar: {
    title: "باركود هنغرستيشن",
    subtitle: "امسح. أنشئ. تم.",
    barcode: "الباركود",
    qrCode: "كود QR",
    enterText: "أدخل النص أو الأرقام…",
    enterDigits: "أدخل الأرقام…",
    enterTextOrUrl: "أدخل النص أو الرابط…",
    switchToScanner: "التبديل إلى الماسح",
    switchToGenerate: "التبديل إلى الإنشاء",
    scan: "مسح",
    generate: "إنشاء",
    scanNext: "مسح التالي",
    scanResult: "الباركود الممسوح",
    install: "تثبيت",
    installTitle: "تثبيت باركود هنغرستيشن",
    addHomeScreen: "إضافة إلى الشاشة الرئيسية",
    iosGuide: "في Safari، اضغط <b>مشاركة</b>، ثم <b>إضافة إلى الشاشة الرئيسية</b>، ثم <b>إضافة</b>.",
    browserGuide: "افتح قائمة المتصفح واختر <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>.",
    installFromBrowser: "التثبيت من قائمة المتصفح",
    capture: "التقاط",
    capturing: "جاري المسح…",
    captureRetry: "لم يتم العثور على رقم — اضبط واضغط التقاط مجدداً",
    flashOn: "الفلاش يعمل",
    flashOff: "فلاش",
    flashUnavailable: "الفلاش غير متاح",
    tapToStart: "اضغط لتشغيل الكاميرا",
    startingCamera: "جاري تشغيل الكاميرا…",
    uploadImage: "رفع صورة",
    cameraUnavailable: "الكاميرا غير متاحة — ارفع صورة.",
    pointAtBarcode: "وجّه نحو رقم الباركود.",
    anyAscii: "أي نص ASCII",
    chars: (n: number) => `${n} حرف`,
    digits: (n: number) => `${n} أرقام`,
    tabOrTap: " — Tab أو اضغط على الاقتراح",
    invalid: "غير صالح",
    notReady: "الباركود غير جاهز.",
    couldNotSave: "تعذري حفظ الباركود.",
    couldNotGenerate: "تعذري إنشاء كود QR.",
    couldNotSaveQr: "تعذري حفظ كود QR.",
    typeForQr: "اكتب شيئاً لإنشاء كود QR",
    voiceTyping: "الكتابة بالصوت (اضغط للتحدث)",
    listening: "جاري الاستماع… انطق الرقم",
    voiceUnsupported: "التعرف على الصوت غير مدعوم في هذا المتصفح",
    clear: "مسح الحقل",
    leaderboard: "المتصدرين",
    admin: "المشرف",
    en: "EN",
    ar: "AR",
  },
} as const;

export type Strings = typeof strings.en;

const LangContext = createContext<{ lang: Lang; t: Strings; dir: "ltr" | "rtl" }>({
  lang: "en",
  t: strings.en,
  dir: "ltr",
});

const STORAGE_KEY = "hungertag-lang";

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ar") return saved;
  } catch {}
  const browserLang = navigator.language?.toLowerCase() ?? "";
  return browserLang.startsWith("ar") ? "ar" : "en";
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  }, [lang]);

  const toggle = useCallback(() => setLang((l) => (l === "en" ? "ar" : "en")), []);

  const value = {
    lang,
    t: strings[lang],
    dir: lang === "ar" ? ("rtl" as const) : ("ltr" as const),
    toggle,
  };

  return (
    <LangContext.Provider value={value as { lang: Lang; t: Strings; dir: "ltr" | "rtl" }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext) as { lang: Lang; t: Strings; dir: "ltr" | "rtl"; toggle: () => void };
}

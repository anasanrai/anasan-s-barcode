const DIGIT_WORDS_EN: Record<string, string> = {
  zero: "0",
  oh: "0",
  one: "1",
  two: "2",
  to: "2",
  too: "2",
  three: "3",
  four: "4",
  for: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  ate: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  sixty: "60",
  seventy: "70",
  eighty: "80",
  ninety: "90",
};

const DIGIT_WORDS_AR: Record<string, string> = {
  صفر: "0",
  واحد: "1",
  اثنين: "2",
  إثنين: "2",
  اثنان: "2",
  ثلاثة: "3",
  تلاتة: "3",
  أربعة: "4",
  اربعة: "4",
  خمسة: "5",
  ستة: "6",
  سبعة: "7",
  ثمانية: "8",
  تمانية: "8",
  تسعة: "9",
  عشرة: "10",
};

export function normalizeSpokenInput(raw: string, isNumericOnly: boolean): string {
  if (!raw) return "";

  // Convert Eastern Arabic numerals (٠-٩) to Western (0-9)
  let text = raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));

  // Handle double / triple spoken expressions (e.g., "double five" -> "55", "triple zero" -> "000")
  text = text.replace(/\bdouble\s+([a-z0-9]+)/gi, (_m, word: string) => {
    const digit = DIGIT_WORDS_EN[word.toLowerCase()] || word;
    return digit + digit;
  });
  text = text.replace(/\btriple\s+([a-z0-9]+)/gi, (_m, word: string) => {
    const digit = DIGIT_WORDS_EN[word.toLowerCase()] || word;
    return digit + digit + digit;
  });

  // Tokenize words
  const words = text.split(/\s+/);
  const convertedWords = words.map((w) => {
    const clean = w.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, "");
    if (DIGIT_WORDS_EN[clean]) return DIGIT_WORDS_EN[clean];
    if (DIGIT_WORDS_AR[clean]) return DIGIT_WORDS_AR[clean];
    return w;
  });

  const joined = convertedWords.join("");

  if (isNumericOnly) {
    return joined.replace(/[^0-9]/g, "");
  }

  return joined.replace(/[^A-Za-z0-9\-.\ \$\/\+\%]/g, "").toUpperCase();
}

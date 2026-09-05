/**
 * Code128 barcode encoder
 * Produces an array of bar widths (1–4) for a given string.
 *
 * Uses Code128-B for all printable ASCII,
 * falling back to Code128-C for pure-digit even-length strings (denser).
 */

const CODE128_B_CHARS =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';

// Each value is 11 bits (bar widths concatenated), index 0 = char value 0 in the set
// Patterns from the Code 128 spec
const PATTERNS: number[] = [
  0b11011001100, // 0
  0b11001101100, // 1
  0b11001100110, // 2
  0b10010011000, // 3
  0b10010001100, // 4
  0b10001001100, // 5
  0b10011001000, // 6
  0b10011000100, // 7
  0b10001100100, // 8
  0b11001001000, // 9
  0b11001000100, // 10
  0b11000100100, // 11
  0b10110011100, // 12
  0b10011011100, // 13
  0b10011001110, // 14
  0b10111001100, // 15
  0b10011101100, // 16
  0b10011100110, // 17
  0b11001110010, // 18
  0b11001011100, // 19
  0b11001001110, // 20
  0b11011100100, // 21
  0b11001110100, // 22
  0b11101101110, // 23
  0b11101001100, // 24
  0b11100101100, // 25
  0b11100100110, // 26
  0b11101100100, // 27
  0b11100110100, // 28
  0b11100110010, // 29
  0b11011011000, // 30
  0b11011000110, // 31
  0b11000110110, // 32
  0b10100011000, // 33
  0b10001011000, // 34
  0b10001000110, // 35
  0b10110001000, // 36
  0b10001101000, // 37
  0b10001100010, // 38
  0b11010001000, // 39
  0b11000101000, // 40
  0b11000100010, // 41
  0b10110111000, // 42
  0b10110001110, // 43
  0b10001101110, // 44
  0b10111011000, // 45
  0b10111000110, // 46
  0b10001110110, // 47
  0b11101110110, // 48
  0b11010001110, // 49
  0b11000101110, // 50
  0b11011101000, // 51
  0b11011100010, // 52
  0b11011101110, // 53
  0b11101011000, // 54
  0b11101000110, // 55
  0b11100010110, // 56
  0b11101101000, // 57
  0b11101100010, // 58
  0b11100011010, // 59
  0b11101111010, // 60
  0b11001000010, // 61
  0b11110001010, // 62
  0b10100110000, // 63
  0b10100001100, // 64
  0b10010110000, // 65
  0b10010000110, // 66
  0b10000101100, // 67
  0b10000100110, // 68
  0b10110000100, // 69
  0b10011000010, // 70
  0b10000110100, // 71
  0b10000110010, // 72
  0b11000010010, // 73
  0b11001010000, // 74
  0b11110111010, // 75
  0b11000010100, // 76
  0b10001111010, // 77
  0b10100111100, // 78
  0b10010111100, // 79
  0b10010011110, // 80
  0b10111100100, // 81
  0b10011110100, // 82
  0b10011110010, // 83
  0b11110100100, // 84
  0b11110010100, // 85
  0b11110010010, // 86
  0b11011011110, // 87
  0b11011110110, // 88
  0b11110110110, // 89
  0b10101111000, // 90
  0b10100011110, // 91
  0b10001011110, // 92
  0b10111101000, // 93
  0b10111100010, // 94
  0b11110101000, // 95
  0b11110100010, // 96
  0b10111011110, // 97
  0b10111101110, // 98
  0b11101011110, // 99
  0b11110101110, // 100 (Code C only)
  0b11010000100, // 101 = Code B
  0b11010010000, // 102 = Code C
  0b11010011110, // 103 = START A
  0b11010111100, // 104 = START B
  0b11010100000, // 105 = START C
  0b11000111010, // STOP
];

const START_B = 104;
const START_C = 105;
const STOP = 106;

function patternToBars(pattern: number): number[] {
  const bars: number[] = [];
  for (let i = 10; i >= 0; i--) {
    bars.push((pattern >> i) & 1 ? 1 : 0);
  }
  // Convert runs of bits to widths
  const widths: number[] = [];
  let currentBit = bars[0];
  let count = 0;
  for (const bit of bars) {
    if (bit === currentBit) {
      count++;
    } else {
      widths.push(count);
      currentBit = bit;
      count = 1;
    }
  }
  widths.push(count);
  return widths;
}

export interface BarcodeBar {
  width: number; // relative width units
  dark: boolean;
}

export function encodeCode128(data: string): BarcodeBar[] {
  const allDigits = /^\d+$/.test(data);
  const useCodeC = allDigits && data.length % 2 === 0 && data.length > 0;

  const values: number[] = [];

  if (useCodeC) {
    values.push(START_C);
    for (let i = 0; i < data.length; i += 2) {
      values.push(parseInt(data.substring(i, i + 2), 10));
    }
  } else {
    values.push(START_B);
    for (const ch of data) {
      const idx = CODE128_B_CHARS.indexOf(ch);
      if (idx === -1) throw new Error(`Char not in Code128-B: ${ch}`);
      values.push(idx);
    }
  }

  // Checksum
  let checksum = values[0];
  for (let i = 1; i < values.length; i++) {
    checksum = (checksum + values[i] * i) % 103;
  }
  values.push(checksum);
  values.push(STOP);

  // Build bar sequence
  const bars: BarcodeBar[] = [];
  let isDark = true;

  for (const val of values) {
    const pattern = PATTERNS[val];
    if (pattern === undefined) throw new Error(`No pattern for value ${val}`);
    const widths = patternToBars(pattern);
    for (const w of widths) {
      bars.push({ width: w, dark: isDark });
      isDark = !isDark;
    }
    // STOP has a termination bar (2 units dark)
  }

  // Add 2-unit termination bar
  bars.push({ width: 2, dark: true });

  return bars;
}

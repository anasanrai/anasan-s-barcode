/**
 * Instant local audio feedback for successful barcode recognition.
 * Uses Web Audio API oscillator synthesis (zero asset loading, 100% offline).
 */
export function playSuccessTone(): void {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Clean two-tone chime (880Hz -> 1760Hz)
    const now = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08); // A6

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 200);
  } catch {}
}

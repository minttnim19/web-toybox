// Number and time formats shared by the HUD and the result screen.

/** Seconds as m:ss, rounded up so the timer never shows 0:00 before time is really up. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Whole numbers with thousands separators: 12,480. */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

// Best scores (per round length) and the mute setting in localStorage.
// Storage can be missing or throw (private mode, blocked cookies), so every access is guarded.

const PREFIX = 'web-toybox:destroyer:';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // ignore: the game still works without persistence
  }
}

function loadBestScore(duration: number): number | null {
  const value = Number(read(`best:${duration}`));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Save the score if it beats the best for this round length. */
export function recordScore(duration: number, score: number): { best: number; isNew: boolean } {
  const previous = loadBestScore(duration);
  if (previous !== null && score <= previous) return { best: previous, isNew: false };
  write(`best:${duration}`, String(score));
  return { best: score, isNew: score > 0 };
}

export function loadMuted(): boolean {
  return read('muted') === '1';
}

export function saveMuted(muted: boolean): void {
  write('muted', muted ? '1' : '0');
}

const rngState = { seed: Date.now() % 2147483647 || 1 };

function seededRandom(): number {
  rngState.seed = (rngState.seed * 48271) % 2147483647;
  return (rngState.seed & 2147483647) / 2147483647;
}

export function setSeed(seed: number): void {
  rngState.seed = (seed % 2147483647) || 1;
}

export function random(): number {
  return seededRandom();
}

export function range(min: number, max: number): number {
  return min + seededRandom() * (max - min);
}

export function pick<T>(array: T[]): T | undefined {
  if (!array.length) return undefined;
  return array[Math.floor(seededRandom() * array.length)];
}

export function shuffle<T>(array: T[]): T[] {
  const clone = array.slice();
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

export function sample<T>(array: T[], count: number): T[] {
  const pool = array.slice();
  const result: T[] = [];
  while (pool.length && result.length < count) {
    const idx = Math.floor(seededRandom() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function now(): number {
  return performance.now() / 1000;
}

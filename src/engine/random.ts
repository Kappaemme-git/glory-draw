export type Rng = () => number;

export function randomRng(): Rng {
  return () => {
    if (globalThis.crypto?.getRandomValues) {
      const bytes = new Uint32Array(1);
      globalThis.crypto.getRandomValues(bytes);
      return bytes[0] / 4294967296;
    }
    return Math.random();
  };
}

export function pick<T>(rng: Rng, values: T[]): T {
  if (values.length === 0) throw new Error('Cannot pick from an empty array.');
  return values[Math.floor(rng() * values.length)];
}

export function weightedPick<T>(rng: Rng, values: T[], weights: number[]): T {
  if (values.length === 0) throw new Error('Cannot pick from an empty array.');
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (total <= 0) return pick(rng, values);

  let cursor = rng() * total;
  for (let index = 0; index < values.length; index++) {
    cursor -= Math.max(0, weights[index]);
    if (cursor <= 0) return values[index];
  }
  return values[values.length - 1];
}

export function poisson(rng: Rng, lambda: number): number {
  const limit = Math.exp(-lambda);
  let product = 1;
  let k = 0;
  do {
    k++;
    product *= rng();
  } while (product > limit);
  return k - 1;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface Pkt { seq: number; payload: string }
export const MESSAGE = 'HELLO WORLD!';

export function split(msg: string, size = 3): Pkt[] {
  const out: Pkt[] = [];
  for (let i = 0; i * size < msg.length; i++) out.push({ seq: i + 1, payload: msg.slice(i * size, (i + 1) * size) });
  return out;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic shuffle that is guaranteed to differ from the input order. */
export function seededShuffle<T>(arr: T[], seed = 7): T[] {
  for (let s = seed; s < seed + 50; s++) {
    const rnd = mulberry32(s);
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.some((x, i) => x !== arr[i])) return a;
  }
  return [...arr].reverse();
}

export function checkOrder(answer: Pkt[], original: Pkt[]) {
  const wrong: number[] = [];
  original.forEach((p, i) => { if (answer[i]?.seq !== p.seq) wrong.push(i + 1); });
  return { correct: answer.length === original.length && wrong.length === 0, wrongPositions: wrong };
}

export const scoreFor = (attempts: number) => Math.max(25, 100 - 25 * (attempts - 1));
export const starsFor = (score: number) => (score >= 100 ? 3 : score >= 75 ? 2 : 1);

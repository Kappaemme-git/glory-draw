// Generates an ORIGINAL, copyright-free anthemic "stadium" instrumental bed
// for the trailer (synthesized from scratch). Output: ./public/music/anthem.wav
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/music');
mkdirSync(OUT, { recursive: true });

const RATE = 44100;
const BPM = 120;
const BEAT = 60 / BPM; // 0.5s
const BAR = BEAT * 4; // 2s
const BARS = 11; // 22s
const DUR = BAR * BARS;
const N = Math.floor(DUR * RATE);

const buf = new Float32Array(N);
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const add = (i, v) => {
  if (i >= 0 && i < N) buf[i] += v;
};

// soft attack/decay envelope
const env = (t, dur, a = 0.02, r = 0.3) => {
  if (t < 0 || t > dur) return 0;
  const atk = Math.min(1, t / a);
  const rel = t > dur - r ? Math.max(0, (dur - t) / r) : 1;
  return atk * rel;
};

// Anthemic progression: C - G - Am - F (one chord per bar, looping)
const CHORDS = [
  [60, 64, 67, 72], // C
  [55, 59, 62, 67], // G
  [57, 60, 64, 69], // Am
  [53, 57, 60, 65], // F
];

// energy ramp per bar (intro soft -> full -> swell)
const barEnergy = [0.35, 0.5, 0.8, 0.85, 0.9, 0.95, 1, 1, 1, 1, 0.7];

for (let bar = 0; bar < BARS; bar++) {
  const chord = CHORDS[bar % 4];
  const root = chord[0] - 12;
  const e = barEnergy[bar];
  const barStart = bar * BAR;

  // ---- pad / chord (sustained whole bar) ----
  for (let s = 0; s < BAR * RATE; s++) {
    const t = s / RATE;
    const g = env(t, BAR, 0.08, 0.5) * 0.16 * e;
    let v = 0;
    for (const note of chord) {
      const f = midi(note);
      v += Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t);
    }
    add(Math.floor((barStart + t) * RATE), (v / chord.length) * g);
  }

  // ---- bass (per beat, root) ----
  for (let b = 0; b < 4; b++) {
    const f = midi(root);
    for (let s = 0; s < BEAT * RATE; s++) {
      const t = s / RATE;
      const g = env(t, BEAT, 0.01, 0.18) * 0.5 * e;
      const v = Math.sin(2 * Math.PI * f * t) * 0.8 + 0.2 * Math.sin(2 * Math.PI * f * 2 * t);
      add(Math.floor((barStart + b * BEAT + t) * RATE), v * g);
    }
  }

  // ---- drums (skip the very first intro bar) ----
  if (bar >= 1) {
    for (let b = 0; b < 4; b++) {
      // kick on every beat
      for (let s = 0; s < 0.18 * RATE; s++) {
        const t = s / RATE;
        const f = 120 * Math.exp(-t * 30) + 48;
        const g = Math.exp(-t * 24) * 0.9 * e;
        add(Math.floor((barStart + b * BEAT + t) * RATE), Math.sin(2 * Math.PI * f * t) * g);
      }
      // clap/snare on beats 2 and 4
      if (b === 1 || b === 3) {
        for (let s = 0; s < 0.12 * RATE; s++) {
          const t = s / RATE;
          const g = Math.exp(-t * 26) * 0.4 * e;
          add(Math.floor((barStart + b * BEAT + t) * RATE), (Math.random() * 2 - 1) * g);
        }
      }
      // hi-hat ticks on 8ths
      for (const off of [0, 0.5]) {
        for (let s = 0; s < 0.04 * RATE; s++) {
          const t = s / RATE;
          const g = Math.exp(-t * 90) * 0.12 * e;
          add(
            Math.floor((barStart + (b + off) * BEAT + t) * RATE),
            (Math.random() * 2 - 1) * g
          );
        }
      }
    }
  }
}

// final cymbal-ish swell on the last bar downbeat
for (let s = 0; s < 1.2 * RATE; s++) {
  const t = s / RATE;
  const g = Math.exp(-t * 3) * 0.18;
  add(Math.floor(((BARS - 1) * BAR + t) * RATE), (Math.random() * 2 - 1) * g);
}

// normalize to -1.5 dBFS
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(buf[i]));
const norm = peak > 0 ? 0.84 / peak : 1;

// write 16-bit PCM mono WAV
const wav = Buffer.alloc(44 + N * 2);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + N * 2, 4);
wav.write('WAVE', 8);
wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(RATE, 24);
wav.writeUInt32LE(RATE * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) {
  const v = Math.max(-1, Math.min(1, buf[i] * norm));
  wav.writeInt16LE((v * 32767) | 0, 44 + i * 2);
}
writeFileSync(resolve(OUT, 'anthem.wav'), wav);
console.log(`anthem.wav written (${DUR.toFixed(1)}s)`);

// Generates small copyright-free WAV sound effects into ./public/sfx
// - whistle.wav: referee whistle (two trill chirps)
// - bounce.wav:  soft ball bounce "pop"
// - swoosh.wav:  short transition swoosh
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/sfx');
mkdirSync(OUT, { recursive: true });

const RATE = 44100;

function toWav(samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(RATE, 24);
  buffer.writeUInt32LE(RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE((v * 32767) | 0, 44 + i * 2);
  }
  return buffer;
}

function whistle() {
  const out = [];
  const chirp = (dur, freq, trill) => {
    const n = Math.floor(dur * RATE);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const env = Math.min(1, t * 40) * Math.min(1, (dur - t) * 40);
      const mod = 1 + 0.012 * Math.sin(2 * Math.PI * trill * t);
      const s = Math.sin(2 * Math.PI * freq * mod * t);
      const s2 = 0.3 * Math.sin(2 * Math.PI * freq * 2 * mod * t);
      out.push((s + s2) * env * 0.5);
    }
  };
  chirp(0.16, 2300, 90);
  for (let i = 0; i < Math.floor(0.05 * RATE); i++) out.push(0);
  chirp(0.34, 2300, 95);
  return out;
}

function bounce() {
  const out = [];
  const n = Math.floor(0.16 * RATE);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const env = Math.exp(-t * 28);
    const freq = 220 + 120 * Math.exp(-t * 30);
    out.push(Math.sin(2 * Math.PI * freq * t) * env * 0.7);
  }
  return out;
}

function swoosh() {
  const out = [];
  const n = Math.floor(0.35 * RATE);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const env = Math.min(1, t * 8) * Math.exp(-t * 6);
    const noise = (Math.random() * 2 - 1);
    last = last * 0.6 + noise * 0.4; // low-pass
    out.push(last * env * 0.4);
  }
  return out;
}

writeFileSync(resolve(OUT, 'whistle.wav'), toWav(whistle()));
writeFileSync(resolve(OUT, 'bounce.wav'), toWav(bounce()));
writeFileSync(resolve(OUT, 'swoosh.wav'), toWav(swoosh()));
console.log('SFX written to', OUT);

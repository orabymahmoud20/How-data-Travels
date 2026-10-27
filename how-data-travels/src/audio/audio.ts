import { Howl, Howler } from 'howler';

export type SfxName = 'click' | 'send' | 'ok' | 'bad' | 'done';
type Note = { f: number; d: number };
const SR = 22050;

/** Builds a small sine-tone WAV as a data URI, so no asset files are required. */
function tone(notes: Note[], vol = 0.35): string {
  const total = notes.reduce((a, n) => a + Math.floor(n.d * SR), 0);
  const buf = new ArrayBuffer(44 + total * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + total * 2, true); str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, total * 2, true);
  let o = 44;
  for (const n of notes) {
    const len = Math.floor(n.d * SR);
    for (let i = 0; i < len; i++) {
      const env = Math.min(1, i / 300) * Math.min(1, (len - i) / 600);
      v.setInt16(o, Math.sin((2 * Math.PI * n.f * i) / SR) * env * vol * 32767, true);
      o += 2;
    }
  }
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}

const DEFS: Record<SfxName, Note[]> = {
  click: [{ f: 660, d: 0.06 }],
  send: [{ f: 520, d: 0.05 }, { f: 780, d: 0.07 }],
  ok: [{ f: 523, d: 0.1 }, { f: 659, d: 0.1 }, { f: 784, d: 0.18 }],
  bad: [{ f: 220, d: 0.18 }, { f: 180, d: 0.22 }],
  done: [{ f: 523, d: 0.12 }, { f: 659, d: 0.12 }, { f: 784, d: 0.12 }, { f: 1047, d: 0.3 }]
};

const sounds: Partial<Record<SfxName, Howl>> = {};
let music: Howl | null = null;
let muted = false;
let volume = 0.7;

function get(name: SfxName): Howl {
  return (sounds[name] ??= new Howl({ src: [tone(DEFS[name])], format: ['wav'], volume: 0.8 }));
}

export const audio = {
  play(name: SfxName) { try { get(name).play(); } catch (e) { console.warn('Audio unavailable', e); } },
  setVolume(v: number) { volume = v; Howler.volume(v); },
  setMuted(m: boolean) { muted = m; Howler.mute(m); },
  isMuted: () => muted,
  getVolume: () => volume,
  /** Call only from a user gesture. Swap the generated tone for /audio/music.mp3 if you add a real track. */
  toggleMusic(on: boolean) {
    try {
      if (!music) {
        const seq = [262, 330, 392, 330, 294, 349, 440, 349].map((f) => ({ f, d: 0.45 }));
        music = new Howl({ src: [tone(seq, 0.12)], format: ['wav'], loop: true, volume: 0.35 });
      }
      if (on) music.play(); else music.pause();
    } catch (e) { console.warn('Music unavailable', e); }
  },
  narrate(text: string) {
    if (!('speechSynthesis' in window)) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.volume = muted ? 0 : volume; u.rate = 0.95;
    window.speechSynthesis.speak(u);
    return true;
  },
  stopNarration() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); },
  dispose() {
    music?.unload(); music = null;
    Object.values(sounds).forEach((s) => s?.unload());
    for (const k of Object.keys(sounds)) delete sounds[k as SfxName];
    this.stopNarration();
  }
};

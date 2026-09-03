// Tiny procedural WebAudio SFX — no asset files.
let ctx = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export function resumeAudio() {
  const c = ac();
  if (c.state === "suspended") c.resume();
}

function tone({ freq = 440, to, type = "square", dur = 0.08, vol = 0.15, delay = 0 }) {
  const c = ac();
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.2, lp = 1200 }) {
  const c = ac();
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = lp;
  const gain = c.createGain();
  gain.gain.value = vol;
  src.connect(filt).connect(gain).connect(c.destination);
  src.start();
}

let lastShot = 0;
export const sfx = {
  shoot() {
    // throttle so miniguns don't detonate the mixer
    const now = performance.now();
    if (now - lastShot < 28) return;
    lastShot = now;
    tone({ freq: 900, to: 240, type: "square", dur: 0.05, vol: 0.05 });
    noise({ dur: 0.05, vol: 0.04, lp: 3500 });
  },
  hit() {
    tone({ freq: 320, to: 120, type: "sawtooth", dur: 0.05, vol: 0.05 });
  },
  kill() {
    tone({ freq: 180, to: 60, type: "square", dur: 0.16, vol: 0.09 });
    noise({ dur: 0.14, vol: 0.08, lp: 900 });
  },
  pickup() {
    tone({ freq: 520, to: 990, type: "triangle", dur: 0.09, vol: 0.12 });
    tone({ freq: 780, to: 1500, type: "triangle", dur: 0.1, vol: 0.1, delay: 0.08 });
  },
  hurt() {
    tone({ freq: 160, to: 50, type: "sawtooth", dur: 0.22, vol: 0.16 });
    noise({ dur: 0.2, vol: 0.12, lp: 600 });
  },
  boss() {
    tone({ freq: 90, to: 32, type: "sawtooth", dur: 0.9, vol: 0.22 });
    tone({ freq: 140, to: 45, type: "square", dur: 0.9, vol: 0.12 });
  },
  wave() {
    tone({ freq: 440, to: 660, type: "triangle", dur: 0.12, vol: 0.1 });
  },
};

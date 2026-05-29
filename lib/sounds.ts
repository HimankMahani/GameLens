"use client";

/**
 * Lightweight Web Audio synthesizer for UI sounds. Avoids shipping audio
 * assets and works offline. Each effect is a short envelope on a tone.
 */

let audioCtx: AudioContext | null = null;
let muted = true;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    audioCtx = new C();
  }
  // Most browsers suspend the context until a user gesture.
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(opts: { freq: number; duration: number; type?: OscillatorType; gain?: number; sweepTo?: number }) {
  if (muted) return;
  const c = ctx();
  if (!c) return;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, c.currentTime);
  if (opts.sweepTo) {
    osc.frequency.exponentialRampToValueAtTime(opts.sweepTo, c.currentTime + opts.duration);
  }
  const peak = opts.gain ?? 0.18;
  env.gain.setValueAtTime(0, c.currentTime);
  env.gain.linearRampToValueAtTime(peak, c.currentTime + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + opts.duration);
  osc.connect(env).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + opts.duration + 0.02);
}

export const sfx = {
  setMuted(m: boolean) { muted = m; },
  isMuted() { return muted; },
  move() { tone({ freq: 520, duration: 0.06, type: "triangle", gain: 0.15 }); },
  capture() { tone({ freq: 220, duration: 0.13, type: "sawtooth", gain: 0.2, sweepTo: 110 }); },
  check() {
    tone({ freq: 880, duration: 0.1, type: "square", gain: 0.12 });
    setTimeout(() => tone({ freq: 1175, duration: 0.13, type: "square", gain: 0.12 }), 90);
  },
  mate() {
    tone({ freq: 660, duration: 0.18, type: "sine", gain: 0.2 });
    setTimeout(() => tone({ freq: 880, duration: 0.18, type: "sine", gain: 0.2 }), 140);
    setTimeout(() => tone({ freq: 1320, duration: 0.4, type: "sine", gain: 0.22, sweepTo: 880 }), 280);
  },
  start() { tone({ freq: 440, duration: 0.18, type: "sine", gain: 0.18, sweepTo: 660 }); },
};

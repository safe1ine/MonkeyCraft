export class Sfx {
  constructor() {
    this.ctx = null;
  }

  ensureContext() {
    if (this.ctx) return this.ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    this.ctx = new AudioCtx();
    return this.ctx;
  }

  prime() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  playTone({ frequency = 220, type = "square", duration = 0.06, gain = 0.05, glideTo = null }) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (glideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, glideTo), now + duration);
    }

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  playMineTick() {
    this.playTone({
      frequency: 170 + Math.random() * 60,
      type: "square",
      duration: 0.05,
      gain: 0.035,
      glideTo: 120 + Math.random() * 40,
    });
  }

  playBreak() {
    this.playTone({ frequency: 210, type: "square", duration: 0.06, gain: 0.05, glideTo: 120 });
    this.playTone({ frequency: 140, type: "triangle", duration: 0.08, gain: 0.035, glideTo: 95 });
  }

  playPlace() {
    this.playTone({ frequency: 110, type: "triangle", duration: 0.05, gain: 0.04, glideTo: 140 });
  }
}


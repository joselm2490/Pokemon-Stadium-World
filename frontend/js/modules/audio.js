// ====================================================================
// MÓDULO: MOTOR DE AUDIO Y SFX STADIUM - POKÉMON STADIUM WORLD
// ====================================================================
class StadiumAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playTone(freq, type = 'sine', duration = 0.08, gainVal = 0.05) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  playNav() {
    this.playTone(520, 'square', 0.06, 0.03);
    setTimeout(() => this.playTone(680, 'square', 0.08, 0.03), 40);
  }

  playCardClick() {
    this.playTone(440, 'triangle', 0.05, 0.04);
    setTimeout(() => this.playTone(880, 'sine', 0.1, 0.05), 40);
  }

  playFilter() {
    this.playTone(330, 'sine', 0.04, 0.02);
  }

  playModalOpen() {
    this.playTone(392, 'sine', 0.08, 0.04);
    setTimeout(() => this.playTone(523.25, 'sine', 0.08, 0.04), 60);
    setTimeout(() => this.playTone(659.25, 'sine', 0.12, 0.04), 120);
  }

  playSuccess() {
    this.playTone(523.25, 'triangle', 0.08, 0.04);
    setTimeout(() => this.playTone(659.25, 'triangle', 0.08, 0.04), 80);
    setTimeout(() => this.playTone(783.99, 'triangle', 0.14, 0.05), 160);
  }

  playError() {
    this.playTone(220, 'sawtooth', 0.12, 0.04);
    setTimeout(() => this.playTone(180, 'sawtooth', 0.15, 0.04), 100);
  }

  // --- EFECTOS DE SONIDO AUTÉNTICOS GBA DE BATALLA ---
  playAttackTackle() {
    this.playTone(180, 'square', 0.08, 0.06);
    setTimeout(() => this.playTone(260, 'square', 0.1, 0.07), 50);
  }

  playDamageHit(isSuperEffective = false) {
    if (isSuperEffective) {
      this.playTone(120, 'sawtooth', 0.22, 0.12);
      setTimeout(() => this.playTone(90, 'square', 0.18, 0.1), 60);
      setTimeout(() => this.playTone(60, 'sawtooth', 0.25, 0.1), 120);
    } else {
      this.playTone(160, 'sawtooth', 0.14, 0.08);
      setTimeout(() => this.playTone(110, 'square', 0.15, 0.07), 40);
    }
  }

  playHpDrain() {
    this.playTone(480, 'sine', 0.04, 0.03);
  }

  playFaint() {
    this.playTone(320, 'sawtooth', 0.15, 0.08);
    setTimeout(() => this.playTone(240, 'sawtooth', 0.18, 0.08), 80);
    setTimeout(() => this.playTone(160, 'sawtooth', 0.22, 0.08), 160);
    setTimeout(() => this.playTone(100, 'sawtooth', 0.35, 0.1), 260);
  }

  playPokeballOpen() {
    this.playTone(700, 'triangle', 0.06, 0.04);
    setTimeout(() => this.playTone(950, 'triangle', 0.1, 0.05), 60);
  }
}

const SFX = new StadiumAudio();

if (typeof window !== 'undefined') {
  window.StadiumAudio = StadiumAudio;
  window.SFX = SFX;
}

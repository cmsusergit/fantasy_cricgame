class GameAudio {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Generates crowd cheer sound using white noise and a lowpass filter
  cheer(intensity: number) {
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;
      
      const bufferSize = ctx.sampleRate * 2.5; // 2.5 seconds
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, ctx.currentTime);
      // Sweeping filter frequency upwards to simulate rising cheer
      filter.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.4);
      filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 1.6);
      filter.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 2.5);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(intensity * 0.12, ctx.currentTime + 0.3); // Limit max volume to protect hearing
      gain.gain.exponentialRampToValueAtTime(intensity * 0.06, ctx.currentTime + 1.4);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 2.5);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch (e) {
      console.warn("Web Audio cheer failed:", e);
    }
  }

  // Generates crowd groan/ooh sound using white noise and lowpass filter
  groan(intensity: number) {
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;

      const bufferSize = ctx.sampleRate * 1.8; // 1.8 seconds
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(550, ctx.currentTime);
      // Sweeping filter frequency downwards to simulate descending groan
      filter.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.4);
      filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 1.8);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(intensity * 0.10, ctx.currentTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(intensity * 0.04, ctx.currentTime + 0.9);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 1.8);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch (e) {
      console.warn("Web Audio groan failed:", e);
    }
  }

  // Synthesize a woodblock-like 'click' or bat crack sound
  batCrack() {
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.warn("Web Audio batCrack failed:", e);
    }
  }

  playFreeHitSiren() {
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(330, ctx.currentTime);
      osc1.frequency.linearRampToValueAtTime(660, ctx.currentTime + 0.15);
      osc1.frequency.linearRampToValueAtTime(330, ctx.currentTime + 0.3);
      osc1.frequency.linearRampToValueAtTime(660, ctx.currentTime + 0.45);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(335, ctx.currentTime);
      osc2.frequency.linearRampToValueAtTime(665, ctx.currentTime + 0.15);
      osc2.frequency.linearRampToValueAtTime(335, ctx.currentTime + 0.3);
      osc2.frequency.linearRampToValueAtTime(665, ctx.currentTime + 0.45);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.5);
      osc2.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn("Web Audio free hit alert failed:", e);
    }
  }

  playImpactFanfare() {
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;
      
      const time = ctx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time + index * 0.12);
        
        gain.gain.setValueAtTime(0.001, time + index * 0.12);
        gain.gain.linearRampToValueAtTime(0.06, time + index * 0.12 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + index * 0.12 + 0.3);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(time + index * 0.12);
        osc.stop(time + index * 0.12 + 0.35);
      });
    } catch (e) {
      console.warn("Web Audio impact fanfare failed:", e);
    }
  }
}

export const gameAudio = new GameAudio();

class GameAudio {
  private ctx: AudioContext | null = null;
  private isAudioEnabled: boolean = true;
  private crowdVolume: number = 0.5;
  private dialogueVolume: number = 0.5;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const storedEnabled = localStorage.getItem('game_audio_enabled');
        if (storedEnabled !== null) {
          this.isAudioEnabled = storedEnabled === 'true';
        }
        const storedCrowd = localStorage.getItem('game_audio_crowd_volume');
        if (storedCrowd !== null) {
          this.crowdVolume = parseFloat(storedCrowd);
        }
        const storedDialogue = localStorage.getItem('game_audio_dialogue_volume');
        if (storedDialogue !== null) {
          this.dialogueVolume = parseFloat(storedDialogue);
        }
      } catch (e) {
        console.warn("Failed to load audio settings:", e);
      }
    }
  }

  setAudioEnabled(enabled: boolean) {
    this.isAudioEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('game_audio_enabled', String(enabled));
    }
  }

  getAudioEnabled(): boolean {
    return this.isAudioEnabled;
  }

  setCrowdVolume(vol: number) {
    this.crowdVolume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      localStorage.setItem('game_audio_crowd_volume', String(this.crowdVolume));
    }
  }

  getCrowdVolume(): number {
    return this.crowdVolume;
  }

  setDialogueVolume(vol: number) {
    this.dialogueVolume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      localStorage.setItem('game_audio_dialogue_volume', String(this.dialogueVolume));
    }
  }

  getDialogueVolume(): number {
    return this.dialogueVolume;
  }

  private init() {
    if (!this.isAudioEnabled) return;
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Generates crowd cheer sound using white noise and a lowpass filter
  cheer(intensity: number) {
    if (!this.isAudioEnabled) return;
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
      gain.gain.linearRampToValueAtTime(intensity * 0.12 * this.crowdVolume, ctx.currentTime + 0.3); // Limit max volume to protect hearing
      gain.gain.exponentialRampToValueAtTime(intensity * 0.06 * this.crowdVolume, ctx.currentTime + 1.4);
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
    if (!this.isAudioEnabled) return;
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
      gain.gain.linearRampToValueAtTime(intensity * 0.10 * this.crowdVolume, ctx.currentTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(intensity * 0.04 * this.crowdVolume, ctx.currentTime + 0.9);
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
    if (!this.isAudioEnabled) return;
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
    if (!this.isAudioEnabled) return;
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
    if (!this.isAudioEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;
      
      const time = ctx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time + index * 0.12);
        
        oscGain.gain.setValueAtTime(0.001, time + index * 0.12);
        oscGain.gain.linearRampToValueAtTime(0.06, time + index * 0.12 + 0.05);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + index * 0.12 + 0.3);
        
        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        
        osc.start(time + index * 0.12);
        osc.stop(time + index * 0.12 + 0.35);
      });
    } catch (e) {
      console.warn("Web Audio impact fanfare failed:", e);
    }
  }

  speakCommentary(text: string) {
    if (!this.isAudioEnabled) return;
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel(); // Cancel any ongoing speech to avoid overlapping
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.15; // Fast, energetic pace
        utterance.pitch = 1.0;
        utterance.volume = this.dialogueVolume;
        
        // Find English voice
        const voices = window.speechSynthesis.getVoices();
        const enVoice = voices.find(v => v.lang.startsWith('en-') || v.lang === 'en');
        if (enVoice) {
          utterance.voice = enVoice;
        }
        
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn("TTS commentary failed:", e);
    }
  }
}

export const gameAudio = new GameAudio();

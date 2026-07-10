import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

// Helper to convert Uint8Array to base64 string
function toBase64(uint8Array: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const len = uint8Array.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = uint8Array[i];
    const b2 = i + 1 < len ? uint8Array[i + 1] : 0;
    const b3 = i + 2 < len ? uint8Array[i + 2] : 0;
    
    const enc1 = b1 >> 2;
    const enc2 = ((b1 & 3) << 4) | (b2 >> 4);
    const enc3 = i + 1 < len ? (((b2 & 15) << 2) | (b3 >> 6)) : 64;
    const enc4 = i + 2 < len ? (b3 & 63) : 64;
    
    result += chars[enc1] + chars[enc2] + 
              (enc3 === 64 ? '=' : chars[enc3]) + 
              (enc4 === 64 ? '=' : chars[enc4]);
  }
  return result;
}

// Generate base64 data URI of a mono 8-bit WAV file
function generateWavDataUri(sampleRate: number, duration: number, generator: (t: number) => number): string {
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new Uint8Array(44 + numSamples);
  
  // RIFF header
  buffer[0] = 0x52; // R
  buffer[1] = 0x49; // I
  buffer[2] = 0x46; // F
  buffer[3] = 0x46; // F
  
  const fileSize = 36 + numSamples;
  buffer[4] = fileSize & 0xff;
  buffer[5] = (fileSize >> 8) & 0xff;
  buffer[6] = (fileSize >> 16) & 0xff;
  buffer[7] = (fileSize >> 24) & 0xff;
  
  buffer[8] = 0x57; // W
  buffer[9] = 0x41; // A
  buffer[10] = 0x56; // V
  buffer[11] = 0x45; // E
  
  // fmt chunk
  buffer[12] = 0x66; // f
  buffer[13] = 0x6d; // m
  buffer[14] = 0x74; // t
  buffer[15] = 0x20; // ' '
  
  buffer[16] = 16; // Chunk size = 16
  buffer[17] = 0;
  buffer[18] = 0;
  buffer[19] = 0;
  
  buffer[20] = 1; // Audio format = 1 (PCM)
  buffer[21] = 0;
  
  buffer[22] = 1; // Mono
  buffer[23] = 0;
  
  buffer[24] = sampleRate & 0xff;
  buffer[25] = (sampleRate >> 8) & 0xff;
  buffer[26] = (sampleRate >> 16) & 0xff;
  buffer[27] = (sampleRate >> 24) & 0xff;
  
  const byteRate = sampleRate;
  buffer[28] = byteRate & 0xff;
  buffer[29] = (byteRate >> 8) & 0xff;
  buffer[30] = (byteRate >> 16) & 0xff;
  buffer[31] = (byteRate >> 24) & 0xff;
  
  buffer[32] = 1; // Block align
  buffer[33] = 0;
  
  buffer[34] = 8; // Bits per sample = 8
  buffer[35] = 0;
  
  // data chunk
  buffer[36] = 0x64; // d
  buffer[37] = 0x61; // a
  buffer[38] = 0x74; // t
  buffer[39] = 0x61; // a
  
  buffer[40] = numSamples & 0xff;
  buffer[41] = (numSamples >> 8) & 0xff;
  buffer[42] = (numSamples >> 16) & 0xff;
  buffer[43] = (numSamples >> 24) & 0xff;
  
  // Write samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const val = generator(t);
    const byteVal = Math.floor((val + 1.0) * 127.5);
    buffer[44 + i] = Math.max(0, Math.min(255, byteVal));
  }
  
  return 'data:audio/wav;base64,' + toBase64(buffer);
}

class GameAudio {
  private isAudioEnabled: boolean = true;
  private crowdVolume: number = 0.15;
  private dialogueVolume: number = 0.5; // Defaults to audible out-of-the-box
  
  // Audio waveforms cache to avoid re-synthesis overhead on mobile devices
  private soundCache: { [key: string]: string } = {};

  // Web Audio Context (Browser only)
  private audioCtx: any = null;
  private activeSource: any = null;
  private activeOscillators: any[] = [];

  private initCtx() {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !this.audioCtx) {
      const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
  }

  private stopActiveWebSounds() {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
      } catch (e) {}
      this.activeSource = null;
    }
    this.activeOscillators.forEach(osc => {
      try {
        osc.stop();
      } catch (e) {}
    });
    this.activeOscillators = [];
  }

  private getCachedSound(key: string, generator: () => string): string {
    if (!this.soundCache[key]) {
      this.soundCache[key] = generator();
    }
    return this.soundCache[key];
  }

  private async playNativeSound(uri: string, volume: number) {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (e) {
      console.warn('Native audio playback failed:', e);
    }
  }

  setAudioEnabled(enabled: boolean) {
    this.isAudioEnabled = enabled;
    if (!enabled) {
      if (Platform.OS === 'web') {
        this.stopActiveWebSounds();
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      } else {
        Speech.stop();
      }
    }
  }

  getAudioEnabled(): boolean {
    return this.isAudioEnabled;
  }

  setCrowdVolume(vol: number) {
    this.crowdVolume = vol;
  }

  getCrowdVolume(): number {
    return this.crowdVolume;
  }

  setDialogueVolume(vol: number) {
    this.dialogueVolume = vol;
  }

  getDialogueVolume(): number {
    return this.dialogueVolume;
  }

  cheer(intensity: number) {
    if (!this.isAudioEnabled) return;

    if (Platform.OS === 'web') {
      this.initCtx();
      if (!this.audioCtx) return;
      try {
        const ctx = this.audioCtx;
        if (ctx.state === 'suspended') ctx.resume();
        this.stopActiveWebSounds();

        const bufferSize = ctx.sampleRate * 2.0;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noiseNode = ctx.createBufferSource();
        noiseNode.buffer = buffer;
        this.activeSource = noiseNode;

        const lpFilter = ctx.createBiquadFilter();
        lpFilter.type = 'lowpass';
        lpFilter.frequency.value = 600;

        const bpFilter = ctx.createBiquadFilter();
        bpFilter.type = 'bandpass';
        bpFilter.frequency.value = 350;
        bpFilter.Q.value = 1.2;

        const gain = ctx.createGain();
        const vol = 0.22 * intensity * this.crowdVolume;
        gain.gain.setValueAtTime(0.01, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(vol, ctx.currentTime + 0.85);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.0);

        noiseNode.connect(lpFilter);
        lpFilter.connect(bpFilter);
        bpFilter.connect(gain);
        gain.connect(ctx.destination);

        noiseNode.start();
      } catch (e) {
        console.warn('Web cheer synthesis failed:', e);
      }
    } else {
      // Native: Play cached or freshly generated cheer WAV
      const uri = this.getCachedSound('cheer', () => {
        let lastVal = 0;
        return generateWavDataUri(8000, 2.0, () => {
          const noise = Math.random() * 2 - 1;
          lastVal = 0.88 * lastVal + 0.12 * noise;
          return lastVal * 1.5;
        });
      });
      this.playNativeSound(uri, intensity * this.crowdVolume);
    }
  }

  groan(intensity: number) {
    if (!this.isAudioEnabled) return;

    if (Platform.OS === 'web') {
      this.initCtx();
      if (!this.audioCtx) return;
      try {
        const ctx = this.audioCtx;
        if (ctx.state === 'suspended') ctx.resume();
        this.stopActiveWebSounds();

        const bufferSize = ctx.sampleRate * 1.8;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noiseNode = ctx.createBufferSource();
        noiseNode.buffer = buffer;
        this.activeSource = noiseNode;

        const lpFilter = ctx.createBiquadFilter();
        lpFilter.type = 'lowpass';
        lpFilter.frequency.value = 400;

        const bpFilter = ctx.createBiquadFilter();
        bpFilter.type = 'bandpass';
        bpFilter.frequency.setValueAtTime(280, ctx.currentTime);
        bpFilter.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.4);
        bpFilter.Q.value = 1.5;

        const gain = ctx.createGain();
        const vol = 0.18 * intensity * this.crowdVolume;
        gain.gain.setValueAtTime(0.01, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(vol, ctx.currentTime + 0.65);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.8);

        noiseNode.connect(lpFilter);
        lpFilter.connect(bpFilter);
        bpFilter.connect(gain);
        gain.connect(ctx.destination);

        noiseNode.start();
      } catch (e) {
        console.warn('Web groan synthesis failed:', e);
      }
    } else {
      // Native: Play cached or freshly generated groan WAV
      const uri = this.getCachedSound('groan', () => {
        let lastVal = 0;
        return generateWavDataUri(8000, 1.8, (t) => {
          const noise = Math.random() * 2 - 1;
          const coef = 0.95 - (t * 0.08);
          lastVal = coef * lastVal + (1 - coef) * noise;
          return lastVal * 1.3;
        });
      });
      this.playNativeSound(uri, intensity * this.crowdVolume);
    }
  }

  batCrack() {
    if (!this.isAudioEnabled) return;

    if (Platform.OS === 'web') {
      this.initCtx();
      if (!this.audioCtx) return;
      try {
        const ctx = this.audioCtx;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.3 * this.crowdVolume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      } catch (e) {
        console.warn('Web batCrack synthesis failed:', e);
      }
    } else {
      // Native: Play cached or freshly generated bat crack WAV
      const uri = this.getCachedSound('batCrack', () => {
        return generateWavDataUri(8000, 0.06, (t) => {
          const freq = 1200 * Math.exp(-t * 90);
          const amp = Math.exp(-t * 80);
          return Math.sin(2 * Math.PI * freq * t) * amp;
        });
      });
      this.playNativeSound(uri, this.crowdVolume * 1.5);
    }
  }

  playFreeHitSiren() {
    if (!this.isAudioEnabled) return;

    if (Platform.OS === 'web') {
      this.initCtx();
      if (!this.audioCtx) return;
      try {
        const ctx = this.audioCtx;
        if (ctx.state === 'suspended') ctx.resume();
        this.stopActiveWebSounds();

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.frequency.setValueAtTime(400, ctx.currentTime);
        osc1.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.7);
        osc2.frequency.setValueAtTime(404, ctx.currentTime);
        osc2.frequency.linearRampToValueAtTime(808, ctx.currentTime + 0.7);

        osc1.type = 'sawtooth';
        osc2.type = 'sine';

        this.activeOscillators.push(osc1, osc2);

        gain.gain.setValueAtTime(0.12 * this.crowdVolume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.75);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.75);
        osc2.stop(ctx.currentTime + 0.75);
      } catch (e) {
        console.warn('Web siren synthesis failed:', e);
      }
    } else {
      // Native: Play cached or freshly generated siren WAV
      const uri = this.getCachedSound('siren', () => {
        return generateWavDataUri(8000, 0.75, (t) => {
          const freq = 400 + (400 * t / 0.7);
          const amp = Math.max(0, 1.0 - (t / 0.75));
          return Math.sin(2 * Math.PI * freq * t) * amp;
        });
      });
      this.playNativeSound(uri, this.crowdVolume * 0.8);
    }
  }

  playImpactFanfare() {
    if (!this.isAudioEnabled) return;

    if (Platform.OS === 'web') {
      this.initCtx();
      if (!this.audioCtx) return;
      try {
        const ctx = this.audioCtx;
        if (ctx.state === 'suspended') ctx.resume();
        this.stopActiveWebSounds();

        const playTone = (freq: number, start: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          this.activeOscillators.push(osc);

          gain.gain.setValueAtTime(0.12 * this.crowdVolume, start);
          gain.gain.exponentialRampToValueAtTime(0.01, start + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(start);
          osc.stop(start + duration);
        };

        const now = ctx.currentTime;
        playTone(523.25, now, 0.15); // C5
        playTone(659.25, now + 0.15, 0.15); // E5
        playTone(783.99, now + 0.3, 0.15); // G5
        playTone(1046.5, now + 0.45, 0.4); // C6
      } catch (e) {
        console.warn('Web fanfare synthesis failed:', e);
      }
    } else {
      // Native: Play cached or freshly generated fanfare WAV
      const uri = this.getCachedSound('fanfare', () => {
        return generateWavDataUri(8000, 0.85, (t) => {
          let freq = 0;
          let amp = 0;
          if (t < 0.15) {
            freq = 523.25;
            amp = Math.exp(-(t) * 10);
          } else if (t < 0.30) {
            freq = 659.25;
            amp = Math.exp(-(t - 0.15) * 10);
          } else if (t < 0.45) {
            freq = 783.99;
            amp = Math.exp(-(t - 0.30) * 10);
          } else if (t < 0.85) {
            freq = 1046.50;
            amp = Math.exp(-(t - 0.45) * 5);
          }
          if (freq === 0) return 0;
          return Math.sin(2 * Math.PI * freq * t) * amp;
        });
      });
      this.playNativeSound(uri, this.crowdVolume * 0.8);
    }
  }

  speakCommentary(text: string) {
    if (!this.isAudioEnabled || this.dialogueVolume <= 0) return;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = this.dialogueVolume;
        window.speechSynthesis.speak(utterance);
      }
    } else {
      // Native: Use expo-speech
      Speech.stop();
      Speech.speak(text, { volume: this.dialogueVolume });
    }
  }
}

export const gameAudio = new GameAudio();

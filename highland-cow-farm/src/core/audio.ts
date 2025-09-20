import { clamp } from './util';

type AmbienceMood = 'farm' | 'task' | 'summary';

let enabled = true;
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let ambienceGain: GainNode | null = null;
let ambienceNodes: {
  oscillators: OscillatorNode[];
  gain: GainNode;
  noiseSource?: AudioBufferSourceNode;
  noiseGain?: GainNode;
  lfo?: OscillatorNode;
} | null = null;
let ambienceMood: AmbienceMood = 'farm';

const volumes = { effects: 0.9, ambience: 0.5, master: 1 };

const AMBIENCE_MOODS: Record<AmbienceMood, { base: number; harmony: number; noise: number; lfo: number }>
  = {
    farm: { base: 196, harmony: 294, noise: 0.05, lfo: 0.08 },
    task: { base: 220, harmony: 330, noise: 0.07, lfo: 0.14 },
    summary: { base: 180, harmony: 270, noise: 0.04, lfo: 0.06 }
  };

function ensureContext(): AudioContext | null {
  if (!ctx) {
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    sfxGain = ctx.createGain();
    ambienceGain = ctx.createGain();
    sfxGain.gain.value = volumes.effects;
    ambienceGain.gain.value = volumes.ambience * 0.12;
    masterGain.gain.value = enabled ? volumes.master : 0;
    sfxGain.connect(masterGain);
    ambienceGain.connect(masterGain);
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

function createNoiseSource(): AudioBufferSourceNode | null {
  if (!ctx) return null;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.32;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function cleanupAmbience() {
  if (ambienceNodes) {
    ambienceNodes.oscillators.forEach(osc => {
      try { osc.stop(); } catch (err) {
        /* ignore */
      }
      try { osc.disconnect(); } catch (err) {
        /* ignore */
      }
    });
    if (ambienceNodes.noiseSource) {
      try { ambienceNodes.noiseSource.stop(); } catch (err) {
        /* ignore */
      }
      try { ambienceNodes.noiseSource.disconnect(); } catch (err) {
        /* ignore */
      }
    }
    if (ambienceNodes.lfo) {
      try { ambienceNodes.lfo.stop(); } catch (err) {
        /* ignore */
      }
      try { ambienceNodes.lfo.disconnect(); } catch (err) {
        /* ignore */
      }
    }
    if (ambienceNodes.noiseGain) {
      try { ambienceNodes.noiseGain.disconnect(); } catch (err) {
        /* ignore */
      }
    }
    try { ambienceNodes.gain.disconnect(); } catch (err) {
      /* ignore */
    }
    ambienceNodes = null;
  }
}

function applyAmbienceMood() {
  if (!ambienceNodes || !ctx) return;
  const profile = AMBIENCE_MOODS[ambienceMood] || AMBIENCE_MOODS.farm;
  const now = ctx.currentTime;
  const [base, harmony] = ambienceNodes.oscillators || [];
  if (base) {
    base.frequency.setTargetAtTime(profile.base, now, 0.6);
  }
  if (harmony) {
    harmony.frequency.setTargetAtTime(profile.harmony, now, 0.6);
  }
  if (ambienceNodes.noiseGain) {
    ambienceNodes.noiseGain.gain.setTargetAtTime(profile.noise * volumes.ambience, now, 0.7);
  }
  if (ambienceNodes.lfo) {
    ambienceNodes.lfo.frequency.setTargetAtTime(profile.lfo, now, 0.8);
  }
  ambienceNodes.gain.gain.setTargetAtTime(volumes.ambience * 0.12, now, 0.4);
}

interface ToneConfig {
  freq: number;
  duration: number;
  type?: OscillatorType;
  offset?: number;
  gain?: number;
}

function scheduleTone({ freq, duration, type = 'sine', offset = 0, gain = 0.2 }: ToneConfig) {
  if (!ctx || !sfxGain) return;
  const start = ctx.currentTime + offset;
  const end = start + duration;
  const osc = ctx.createOscillator();
  const toneGain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  const peak = Math.max(0.001, gain * volumes.effects);
  toneGain.gain.setValueAtTime(0.0001, start);
  toneGain.gain.exponentialRampToValueAtTime(peak, start + 0.03);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(toneGain).connect(sfxGain);
  osc.start(start);
  osc.stop(end + 0.05);
}

function ensureAmbienceNodes() {
  if (!enabled || volumes.ambience <= 0) {
    cleanupAmbience();
    return;
  }
  if (!ensureContext()) return;
  if (ambienceNodes) {
    if (ctx) {
      ambienceNodes.gain.gain.setTargetAtTime(volumes.ambience * 0.12, ctx.currentTime, 0.5);
      if (ambienceNodes.noiseGain) {
        const profile = AMBIENCE_MOODS[ambienceMood] || AMBIENCE_MOODS.farm;
        ambienceNodes.noiseGain.gain.setTargetAtTime(profile.noise * volumes.ambience, ctx.currentTime, 0.6);
      }
    }
    return;
  }
  if (!ctx || !ambienceGain) return;
  const base = ctx.createOscillator();
  base.type = 'sine';
  base.frequency.value = 196;
  const harmony = ctx.createOscillator();
  harmony.type = 'triangle';
  harmony.frequency.value = 294;
  const gainNode = ctx.createGain();
  gainNode.gain.value = volumes.ambience * 0.12;
  base.connect(gainNode);
  harmony.connect(gainNode);
  gainNode.connect(ambienceGain);
  const noiseSource = createNoiseSource();
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = (AMBIENCE_MOODS[ambienceMood]?.noise || 0.05) * volumes.ambience;
  noiseGain.connect(ambienceGain);
  if (noiseSource) {
    noiseSource.connect(noiseGain);
  }
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.02;
  lfo.frequency.value = AMBIENCE_MOODS[ambienceMood]?.lfo || 0.08;
  lfo.connect(lfoGain);
  lfoGain.connect(noiseGain.gain);
  base.start();
  harmony.start();
  if (noiseSource) noiseSource.start();
  lfo.start();
  ambienceNodes = { oscillators: [base, harmony], gain: gainNode, noiseSource, noiseGain, lfo };
  applyAmbienceMood();
}

const toneSequences: Record<string, ToneConfig[]> = {
  win: [
    { freq: 660, duration: 0.18, type: 'triangle', gain: 0.24 },
    { freq: 880, duration: 0.22, type: 'sine', offset: 0.16, gain: 0.18 }
  ],
  lose: [
    { freq: 280, duration: 0.28, type: 'sawtooth', gain: 0.18 },
    { freq: 180, duration: 0.32, type: 'sine', offset: 0.22, gain: 0.14 }
  ],
  tap: [
    { freq: 520, duration: 0.12, type: 'sine', gain: 0.16 }
  ],
  reward: [
    { freq: 540, duration: 0.16, type: 'sine', gain: 0.2 },
    { freq: 720, duration: 0.24, type: 'triangle', offset: 0.12, gain: 0.2 },
    { freq: 960, duration: 0.2, type: 'sine', offset: 0.28, gain: 0.18 }
  ],
  equip: [
    { freq: 680, duration: 0.14, type: 'triangle', gain: 0.2 },
    { freq: 540, duration: 0.12, type: 'sine', offset: 0.1, gain: 0.16 }
  ],
  perfect: [
    { freq: 660, duration: 0.24, type: 'triangle', gain: 0.24 },
    { freq: 880, duration: 0.28, type: 'sine', offset: 0.18, gain: 0.22 },
    { freq: 1180, duration: 0.3, type: 'sine', offset: 0.36, gain: 0.18 }
  ]
};

export function initAudio(): void {
  if (!ensureContext()) return;
  if (enabled) {
    ensureAmbienceNodes();
  }
}

export function setEnabled(flag: boolean): void {
  enabled = !!flag;
  const audioCtx = ensureContext();
  if (!audioCtx || !masterGain) return;
  if (enabled) {
    masterGain.gain.setTargetAtTime(volumes.master || 0, audioCtx.currentTime, 0.1);
    audioCtx.resume?.();
    ensureAmbienceNodes();
  } else {
    masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    cleanupAmbience();
  }
}

export function setVolumes(partial: Partial<{ effects: number; ambience: number; master: number }>): void {
  if (typeof partial.effects === 'number') {
    volumes.effects = clamp(partial.effects, 0, 1);
    if (sfxGain && ctx) {
      sfxGain.gain.setTargetAtTime(volumes.effects || 0.0001, ctx.currentTime, 0.05);
    }
  }
  if (typeof partial.ambience === 'number') {
    volumes.ambience = clamp(partial.ambience, 0, 1);
    if (ambienceGain && ctx) {
      ambienceGain.gain.setTargetAtTime(volumes.ambience * 0.12, ctx.currentTime, 0.2);
    }
    ensureAmbienceNodes();
    applyAmbienceMood();
  }
  if (typeof partial.master === 'number') {
    volumes.master = clamp(partial.master, 0, 1);
    if (masterGain && ctx) {
      masterGain.gain.setTargetAtTime(enabled ? volumes.master : 0, ctx.currentTime, 0.1);
    }
  }
}

export function getVolumes(): { effects: number; ambience: number; master: number } {
  return { ...volumes };
}

export function isEnabled(): boolean {
  return enabled;
}

export function play(name: string): void {
  if (!enabled) return;
  const audioCtx = ensureContext();
  if (!audioCtx) return;
  const sequence = toneSequences[name] || toneSequences.tap;
  sequence.forEach(config => scheduleTone(config));
}

export function setAmbience(mood: AmbienceMood | string): void {
  ambienceMood = (['farm', 'task', 'summary'] as const).includes(mood as AmbienceMood)
    ? (mood as AmbienceMood)
    : 'farm';
  applyAmbienceMood();
}

export function ensureAmbience(): void {
  ensureAmbienceNodes();
}

export function stopAmbience(): void {
  cleanupAmbience();
}

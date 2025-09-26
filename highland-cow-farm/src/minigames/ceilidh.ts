import type { Cow } from '../types';
import { play } from '../core/audio';
import { startLoop, stopLoop } from '../core/loop';
import type { MiniGameContext, MiniGameResult } from './types';

interface CeilidhState {
  context: MiniGameContext;
  participants: Cow[];
  timeLeft: number;
  beatInterval: number;
  beatTimer: number;
  windowDuration: number;
  windowRemaining: number;
  hits: number;
  misses: number;
  targetBeats: number;
  beatsTriggered: number;
  running: boolean;
  finished: boolean;
  modifiers: Record<string, any> | null;
}

let root: HTMLElement | null = null;
let stage: HTMLElement | null = null;
let promptEl: HTMLElement | null = null;
let scoreEl: HTMLElement | null = null;
let tapButton: HTMLButtonElement | null = null;
let state: CeilidhState | null = null;
let lastResult: MiniGameResult | null = null;

function mountDom(container: HTMLElement) {
  root = document.createElement('div');
  root.className = 'minigame-surface ceilidh-game';

  stage = document.createElement('div');
  stage.className = 'ceilidh-stage';

  promptEl = document.createElement('div');
  promptEl.className = 'ceilidh-prompt';
  promptEl.textContent = 'Tap "Step" when the glow appears!';

  scoreEl = document.createElement('div');
  scoreEl.className = 'ceilidh-score';
  scoreEl.textContent = 'Ready to dance.';

  tapButton = document.createElement('button');
  tapButton.type = 'button';
  tapButton.className = 'ceilidh-tap';
  tapButton.textContent = 'Step!';
  tapButton.addEventListener('click', handleTap);

  stage.appendChild(promptEl);
  stage.appendChild(scoreEl);
  stage.appendChild(tapButton);
  root.appendChild(stage);
  container.appendChild(root);
}

function handleTap() {
  if (!state || !state.running) return;
  if (state.windowRemaining > 0) {
    state.hits += 1;
    state.windowRemaining = 0;
    promptEl?.classList.remove('active');
    if (promptEl) {
      promptEl.textContent = 'Nice step!';
    }
    play('tap');
  } else {
    state.misses += 1;
    if (promptEl) {
      promptEl.classList.add('miss');
      promptEl.textContent = 'Too soon! Wait for the glow.';
      window.setTimeout(() => {
        promptEl?.classList.remove('miss');
      }, 320);
    }
  }
  refreshScore();
  state.context.updateInstruction?.(
    `Hits: ${state.hits} • Misses: ${state.misses}. Keep to the rhythm!`
  );
  checkCompletion();
}

function refreshScore() {
  if (!state || !scoreEl) return;
  scoreEl.textContent = `In step: ${state.hits} • Stumbles: ${state.misses}`;
}

function triggerBeat() {
  if (!state || !state.running) return;
  state.beatsTriggered += 1;
  state.windowRemaining = state.windowDuration;
  if (promptEl) {
    const stepNumber = ((state.beatsTriggered - 1) % 4) + 1;
    promptEl.textContent = `Step ${stepNumber}!`;
    promptEl.classList.add('active');
  }
}

function checkCompletion() {
  if (!state || state.finished) return;
  if (state.hits >= state.targetBeats) {
    finish(true, 'The ceilidh kept its rhythm with joyful steps!');
  } else {
    const missLimit = Math.ceil(state.targetBeats / 2);
    if (state.misses >= missLimit) {
      finish(false, 'Too many missed steps slowed the ceilidh.');
    }
  }
}

function finish(success: boolean, message: string) {
  if (!state || state.finished) return;
  state.finished = true;
  state.running = false;
  stopLoop();
  const adjustments: MiniGameResult['adjustments'] = {};
  const bonusHappiness = Number(state.modifiers?.happinessBonus) || 0;
  const baseHappiness = success ? 8 + bonusHappiness : -4;
  const missPenalty = state.misses;
  state.participants.forEach(cow => {
    adjustments[cow.id] = {
      happiness: baseHappiness - (success ? missPenalty : 0),
      hunger: success
        ? state.misses > 0
          ? state.misses * 3
          : -4
        : 6 + state.misses * 2
    };
  });
  lastResult = {
    success,
    adjustments,
    summary: message,
    stats: {
      totalPerfects: success && state.misses === 0 ? 1 : 0
    }
  };
  play(success ? 'win' : 'lose');
  state.context.onComplete(lastResult);
  if (root) {
    root.classList.remove('active');
  }
}

function update(dt: number) {
  if (!state || !state.running) return;
  state.timeLeft -= dt;
  if (state.timeLeft < 0) {
    state.timeLeft = 0;
  }
  state.context.updateTimer(state.timeLeft);

  if (state.windowRemaining > 0) {
    state.windowRemaining = Math.max(0, state.windowRemaining - dt);
    if (state.windowRemaining === 0) {
      promptEl?.classList.remove('active');
    }
  }

  state.beatTimer += dt;
  if (state.beatTimer >= state.beatInterval) {
    state.beatTimer -= state.beatInterval;
    triggerBeat();
  }

  if (state.timeLeft <= 0) {
    const success = state.hits >= Math.max(3, state.targetBeats - 1);
    const wrap = success
      ? 'The ceilidh ended with tired but happy hooves.'
      : 'The ceilidh faded before the rhythm caught on.';
    finish(success, wrap);
  }
}

export function mount(container: HTMLElement): HTMLElement {
  if (!root) {
    mountDom(container);
  }
  return root!;
}

export function start(context: MiniGameContext): void {
  if (!root || !tapButton) {
    throw new Error('Ceilidh game not mounted');
  }
  root.classList.add('active');
  tapButton.disabled = false;
  const modifiers = context.modifiers || {};
  const participants = context.participants || [];
  const difficulty = Math.max(1, Number(context.difficulty) || 1);
  const baseTime = Math.max(22, 34 - difficulty * 1.2 + (modifiers.timeModifier || 0));
  const beatInterval = Math.max(0.85, 1.45 - difficulty * 0.05 - (modifiers.tempoBoost || 0) * 0.05);
  const windowDuration = Math.max(0.3, 0.55 + (modifiers.beatWindow || 0));
  const availableBeats = Math.floor(baseTime / beatInterval);
  const targetBeats = Math.min(availableBeats - 1, Math.max(6, Math.round(availableBeats * 0.7)));
  state = {
    context,
    participants,
    timeLeft: baseTime,
    beatInterval,
    beatTimer: 0,
    windowDuration,
    windowRemaining: 0,
    hits: 0,
    misses: 0,
    targetBeats: Math.max(4, targetBeats),
    beatsTriggered: 0,
    running: true,
    finished: false,
    modifiers
  };
  lastResult = null;
  context.updateTimer(state.timeLeft);
  context.updateInstruction?.('Tap "Step" when the glow pulses to keep everyone dancing.');
  if (promptEl) {
    promptEl.textContent = 'Watch for the glow...';
    promptEl.classList.remove('active');
    promptEl.classList.remove('miss');
  }
  refreshScore();
  triggerBeat();
  startLoop(update);
}

export function stop(): void {
  if (state) {
    state.running = false;
  }
  stopLoop();
  if (tapButton) {
    tapButton.disabled = true;
  }
  if (root) {
    root.classList.remove('active');
  }
}

export function result(): MiniGameResult {
  return (
    lastResult || {
      success: false,
      adjustments: {},
      summary: 'No ceilidh result recorded.'
    }
  );
}

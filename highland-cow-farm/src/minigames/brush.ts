import type { Cow } from '../types';
import { svg, colourHex } from '../game/cowVisuals';
import { play } from '../core/audio';
import { startLoop, stopLoop } from '../core/loop';
import { range } from '../core/util';
import type { MiniGameContext, MiniGameResult } from './types';

interface PatchState {
  x: number;
  y: number;
  radius: number;
  el: HTMLElement;
  clean: boolean;
}

interface BrushState {
  context: MiniGameContext;
  participants: Cow[];
  focusCow: Cow;
  timeLeft: number;
  patches: PatchState[];
  running: boolean;
  finished: boolean;
  brushing: boolean;
  modifiers: Record<string, any> | null;
}

let root: HTMLElement | null = null;
let board: HTMLElement | null = null;
let cowSurface: HTMLElement | null = null;
let artWrapper: HTMLElement | null = null;
let state: BrushState | null = null;
let lastResult: MiniGameResult | null = null;

function mountDom(container: HTMLElement) {
  root = document.createElement('div');
  root.className = 'minigame-surface brush-game';
  board = document.createElement('div');
  board.className = 'brush-board';
  cowSurface = document.createElement('div');
  cowSurface.className = 'brush-cow';
  artWrapper = document.createElement('div');
  artWrapper.className = 'brush-art';
  cowSurface.appendChild(artWrapper);
  board.appendChild(cowSurface);
  root.appendChild(board);
  container.appendChild(root);
  cowSurface.addEventListener('pointerdown', handlePointerDown);
  cowSurface.addEventListener('pointermove', handlePointerMove);
  cowSurface.addEventListener('pointerup', handlePointerUp);
  cowSurface.addEventListener('pointercancel', handlePointerUp);
  cowSurface.addEventListener('pointerleave', handlePointerUp);
}

function patchColour(alpha = 0.28) {
  const base = colourHex(state?.focusCow?.colour || 'brown').replace('#', '');
  if (base.length !== 6) {
    return `rgba(53, 38, 77, ${alpha})`;
  }
  const value = parseInt(base, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function spawnPatches(count: number) {
  if (!cowSurface) return [] as PatchState[];
  cowSurface.querySelectorAll('.brush-patch').forEach(el => el.remove());
  const rect = cowSurface.getBoundingClientRect();
  const patches: PatchState[] = [];
  for (let i = 0; i < count; i++) {
    const radius = range(20, 28);
    const x = range(radius + 10, rect.width - radius - 10);
    const y = range(radius + 20, rect.height - radius - 20);
    const patchEl = document.createElement('div');
    patchEl.className = 'brush-patch';
    patchEl.style.width = `${radius * 2}px`;
    patchEl.style.height = `${radius * 2}px`;
    patchEl.style.left = `${x - radius}px`;
    patchEl.style.top = `${y - radius}px`;
    patchEl.style.background = patchColour(0.26);
    cowSurface.appendChild(patchEl);
    patches.push({ x, y, radius, el: patchEl, clean: false });
  }
  return patches;
}

function handlePointerDown(event: PointerEvent) {
  if (!state || !state.running || !cowSurface) return;
  state.brushing = true;
  cowSurface.setPointerCapture(event.pointerId);
  brushAt(event);
}

function handlePointerMove(event: PointerEvent) {
  if (!state || !state.running || !state.brushing) return;
  brushAt(event);
}

function handlePointerUp(event: PointerEvent) {
  if (!state || !cowSurface) return;
  state.brushing = false;
  try {
    cowSurface.releasePointerCapture(event.pointerId);
  } catch (err) {
    // ignore
  }
}

function brushAt(event: PointerEvent) {
  if (!state || !cowSurface) return;
  const rect = cowSurface.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  state.patches.forEach(patch => {
    if (!patch.clean) {
      const distance = Math.hypot(x - patch.x, y - patch.y);
      if (distance <= patch.radius) {
        patch.clean = true;
        patch.el.classList.add('clean');
        if (!state.context.options.reducedFlash && board) {
          const sparkle = document.createElement('div');
          sparkle.className = 'sparkle';
          sparkle.style.left = `${patch.x - 7}px`;
          sparkle.style.top = `${patch.y - 7}px`;
          board.appendChild(sparkle);
          window.setTimeout(() => sparkle.remove(), 600);
        }
      }
    }
  });
  if (state.patches.every(p => p.clean)) {
    finish(true, 'Spotless coats! Smooth brushing.');
  }
}

function finish(success: boolean, message: string) {
  if (!state || state.finished) return;
  state.finished = true;
  state.running = false;
  stopLoop();
  const adjustments: MiniGameResult['adjustments'] = {};
  state.participants.forEach(cow => {
    adjustments[cow.id] = {
      cleanliness: success ? 30 : -12,
      happiness: success ? 6 : -4
    };
  });
  lastResult = {
    success,
    adjustments,
    summary: message,
    stats: { totalPerfects: success && state.timeLeft > 5 ? 1 : 0 }
  };
  play(success ? 'win' : 'lose');
  if (state) {
    state.context.onComplete(lastResult || { success: false, adjustments: {} });
  }
  if (root) {
    root.classList.remove('active');
  }
}

function update(dt: number) {
  if (!state || !state.running) return;
  state.timeLeft -= dt;
  state.context.updateTimer(state.timeLeft);
  if (state.timeLeft <= 0) {
    finish(false, "Time's up – a few tangles remain.");
  }
}

export function mount(container: HTMLElement): HTMLElement {
  if (!root) {
    mountDom(container);
  }
  return root!;
}

export function start(context: MiniGameContext): void {
  if (!root || !artWrapper) throw new Error('Brush game not mounted');
  root.classList.add('active');
  const modifiers = context.modifiers || {};
  const participants = context.participants || [];
  const focusCow = participants[0] || ({ id: 'brush-guest', name: 'Guest Cow', colour: 'cream', chonk: 42, accessories: [] } as Cow);
  state = {
    context,
    participants,
    focusCow,
    timeLeft: Math.max(12, Math.max(18, 32 - (context.difficulty || 1)) + (modifiers.timeModifier || 0)),
    patches: [],
    running: true,
    finished: false,
    brushing: false,
    modifiers
  };
  lastResult = null;
  context.updateTimer(state.timeLeft);
  artWrapper.innerHTML = svg(focusCow, { className: 'cow-art-large', viewBox: '0 0 160 130', scale: 1.3 });
  const basePatches = Math.min(8, Math.max(4, Math.round(4 + (context.difficulty || 1) * 0.5)));
  const chonkBonus = focusCow.chonk > 70 ? 1 : 0;
  const patchCount = Math.min(12, basePatches + (modifiers.patchBonus || 0) + chonkBonus);
  state.patches = spawnPatches(patchCount);
  startLoop(update);
}

export function stop(): void {
  if (state) {
    state.running = false;
  }
  stopLoop();
  if (root) {
    root.classList.remove('active');
  }
}

export function result(): MiniGameResult {
  return (
    lastResult || {
      success: false,
      adjustments: {},
      summary: 'No result recorded.'
    }
  );
}

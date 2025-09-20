import type { Cow } from '../types';
import { drawCanvas } from '../game/cowVisuals';
import { play } from '../core/audio';
import { range } from '../core/util';
import { startLoop, stopLoop } from '../core/loop';
import type { MiniGameContext, MiniGameResult } from './types';

let root: HTMLElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

interface CatchState {
  context: MiniGameContext;
  participants: Cow[];
  width: number;
  height: number;
  baseSpeed: number;
  timeLeft: number;
  cows: ReturnType<typeof spawnCows>;
  running: boolean;
  finished: boolean;
  modifiers: Record<string, any> | null;
}

let state: CatchState | null = null;
let lastResult: MiniGameResult | null = null;

function resizeCanvas() {
  if (!canvas || !root) return;
  const rect = root.getBoundingClientRect();
  const displayWidth = rect.width || 320;
  const displayHeight = Math.max(260, rect.width * 0.6);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;
  ctx = canvas.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state) {
    state.width = displayWidth;
    state.height = displayHeight;
  }
}

function spawnCows(count: number, width: number, height: number, baseSpeed: number, participants: Cow[]) {
  const cows: Array<{
    x: number;
    y: number;
    radius: number;
    vx: number;
    vy: number;
    taggedAt: number;
    profile: Cow;
  }> = [];
  const pool = participants.length ? participants.slice() : [{ id: 'wild', name: 'Runaway', chonk: 40, accessories: [], colour: 'brown' } as unknown as Cow];
  for (let i = 0; i < count; i++) {
    const x = width / 2 + range(-40, 40);
    const y = height / 2 + range(-40, 40);
    const radius = 18 + range(-2, 4);
    const direction = Math.atan2(y - height / 2, x - width / 2);
    const speed = baseSpeed + range(-20, 20);
    const profile = pool[i % pool.length];
    const chonkScale = profile && typeof profile.chonk === 'number' ? Math.max(0, profile.chonk - 60) * 0.06 : 0;
    cows.push({
      x,
      y,
      radius: radius + chonkScale,
      vx: Math.cos(direction) * speed,
      vy: Math.sin(direction) * speed,
      taggedAt: 0,
      profile
    });
  }
  return cows;
}

function drawBackground(width: number, height: number) {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#fef4f2');
  gradient.addColorStop(1, '#f6e5d0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(53, 38, 77, 0.2)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, width - 20, height - 20);
}

function drawCows(cows: ReturnType<typeof spawnCows>) {
  if (!ctx) return;
  const time = performance.now();
  const fallback = { id: 'wild', name: 'Runaway', colour: 'brown', chonk: 40, accessories: [] } as Cow;
  cows.forEach(cow => {
    const profile = cow.profile || fallback;
    const wobble = Math.sin(time / 260 + cow.x * 0.02) * 1.2;
    drawCanvas(ctx!, profile, {
      x: cow.x,
      y: cow.y,
      scale: Math.max(0.55, cow.radius / 28),
      wobble
    });
    if (cow.taggedAt) {
      const age = time - cow.taggedAt;
      if (age < 220) {
        const pulse = 1 - age / 220;
        ctx!.save();
        ctx!.globalAlpha = pulse * 0.4;
        ctx!.strokeStyle = '#f2a9b7';
        ctx!.lineWidth = 6;
        ctx!.beginPath();
        ctx!.arc(cow.x, cow.y + 12, (cow.radius + 12) * (1 + pulse * 0.2), 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.restore();
      }
    }
  });
}

function finish(success: boolean, message: string) {
  if (!state || state.finished) return;
  state.finished = true;
  state.running = false;
  stopLoop();
  const adjustments: MiniGameResult['adjustments'] = {};
  state.participants.forEach(cow => {
    adjustments[cow.id] = {
      happiness: success ? 10 : -8,
      hunger: success ? -4 : 6
    };
  });
  lastResult = {
    success,
    adjustments,
    summary: message,
    stats: { totalPerfects: success ? 1 : 0 }
  };
  play(success ? 'win' : 'lose');
  if (state) {
    state.context.onComplete(lastResult || { success: false, adjustments: {} });
  }
  if (root) {
    root.classList.remove('active');
  }
}

function onPointerDown(event: PointerEvent) {
  if (!state || !state.running || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  const px = event.clientX - rect.left;
  const py = event.clientY - rect.top;
  let hit = false;
  state.cows.forEach(cow => {
    const distance = Math.hypot(px - cow.x, py - cow.y);
    if (!hit && distance <= cow.radius + 12) {
      hit = true;
      const targetX = state!.width / 2;
      const targetY = state!.height / 2;
      const dx = targetX - cow.x;
      const dy = targetY - cow.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = state!.baseSpeed * 1.3;
      cow.vx = (dx / len) * speed;
      cow.vy = (dy / len) * speed;
      cow.taggedAt = performance.now();
    }
  });
  if (hit) {
    play('tap');
  }
}

function update(dt: number) {
  if (!state || !state.running) return;
  state.timeLeft -= dt;
  state.context.updateTimer(state.timeLeft);
  if (state.timeLeft <= 0) {
    finish(true, 'All cows stayed in the paddock!');
    return;
  }
  let escaped = false;
  state.cows.forEach(cow => {
    cow.x += cow.vx * dt;
    cow.y += cow.vy * dt;
    if (
      cow.x - cow.radius <= 12 ||
      cow.x + cow.radius >= state!.width - 12 ||
      cow.y - cow.radius <= 12 ||
      cow.y + cow.radius >= state!.height - 12
    ) {
      escaped = true;
    }
    const speed = Math.hypot(cow.vx, cow.vy);
    const maxSpeed = state!.baseSpeed * 1.35;
    if (speed > maxSpeed) {
      cow.vx = (cow.vx / speed) * maxSpeed;
      cow.vy = (cow.vy / speed) * maxSpeed;
    }
  });
  drawBackground(state.width, state.height);
  drawCows(state.cows);
  if (escaped) {
    finish(false, 'A cow reached the fence!');
  }
}

export function mount(container: HTMLElement): HTMLElement {
  if (root) return root;
  root = document.createElement('div');
  root.className = 'minigame-surface catch-game';
  canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  root.appendChild(canvas);
  container.appendChild(root);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  return root;
}

export function start(context: MiniGameContext): void {
  if (!root || !canvas) throw new Error('Catch game not mounted');
  root.classList.add('active');
  resizeCanvas();
  const width = state?.width || canvas.clientWidth;
  const height = state?.height || canvas.clientHeight;
  const difficulty = context.difficulty || 1;
  const modifiers = context.modifiers || {};
  const count = Math.min(8, Math.max(3, Math.round(3 + difficulty * 0.6)));
  const baseSpeed = (45 + difficulty * 12) * (modifiers.speedScale || 1);
  state = {
    context,
    participants: context.participants || [],
    width,
    height,
    baseSpeed,
    timeLeft: Math.max(12, Math.max(18, 28 - difficulty * 1.2) + (modifiers.timeModifier || 0)),
    cows: spawnCows(count, width, height, baseSpeed, context.participants || []),
    running: true,
    finished: false,
    modifiers
  };
  lastResult = null;
  context.updateTimer(state.timeLeft);
  drawBackground(width, height);
  drawCows(state.cows);
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

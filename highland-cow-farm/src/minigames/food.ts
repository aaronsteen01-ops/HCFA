import type { Cow } from '../types';
import { DEFAULT_FOODS, FoodLibrary } from '../data/foods';
import { svg } from '../game/cowVisuals';
import { play } from '../core/audio';
import { startLoop, stopLoop } from '../core/loop';
import { pick, shuffle } from '../core/util';
import type { MiniGameContext, MiniGameResult } from './types';

interface TargetState {
  cow: Cow;
  expected: string;
  food: ReturnType<typeof resolveFood> | null;
  el: HTMLElement;
  satisfied: boolean;
  feeds: number;
  overfed: boolean;
  limit: number;
}

interface FoodState {
  context: MiniGameContext;
  participants: Cow[];
  targets: TargetState[];
  overfed: Set<string>;
  mistakes: number;
  timeLeft: number;
  running: boolean;
  finished: boolean;
  modifiers: Record<string, any> | null;
  pool: Array<ReturnType<typeof resolveFood>>;
}

let root: HTMLElement | null = null;
let board: HTMLElement | null = null;
let targetsContainer: HTMLElement | null = null;
let tray: HTMLElement | null = null;
let state: FoodState | null = null;
let lastResult: MiniGameResult | null = null;

function resolveFood(name: string | undefined | null) {
  if (!name) return null;
  const entry = FoodLibrary[name];
  if (!entry) return null;
  return { name, ...entry };
}

function buildFoodPool(names: string[] | undefined | null) {
  const seen = new Set<string>();
  const pool: Array<ReturnType<typeof resolveFood>> = [];
  const source = Array.isArray(names) ? names : [];
  [...source, ...DEFAULT_FOODS].forEach(name => {
    const resolved = resolveFood(name);
    if (resolved && !seen.has(resolved.name)) {
      seen.add(resolved.name);
      pool.push(resolved);
    }
  });
  if (pool.length) return pool;
  const fallback = DEFAULT_FOODS.map(resolveFood).filter(Boolean) as Array<ReturnType<typeof resolveFood>>;
  if (fallback.length) return fallback;
  return [
    {
      name: 'Starter Hay',
      icon: '🌾',
      description: 'Reliable hay baled fresh from the paddock.',
      hunger: -24,
      happiness: 6,
      chonk: 0,
      overfeedChonk: 6,
      overfeedMood: 4,
      maxServings: 1
    }
  ];
}

function createTarget(cow: Cow, food: ReturnType<typeof resolveFood>): HTMLElement {
  const target = document.createElement('div');
  target.className = 'food-target';
  target.dataset.food = food.name;
  target.setAttribute('role', 'group');
  target.setAttribute('aria-label', `${cow.name} snack target`);
  if (food.description) {
    target.title = food.description;
  }
  const cowArt = svg(cow, { className: 'cow-art-mini', scale: 0.85, offsetY: -6 });
  target.innerHTML = `
          <div class="food-avatar" aria-hidden="true">${cowArt}</div>
          <strong>${cow.name}</strong>
          <span class="food-label">${food.name}</span>
          <div class="food-icon" aria-hidden="true">${food.icon || '🌾'}</div>
          <span class="food-status">Needs snack</span>`;
  return target;
}

function createChip(food: ReturnType<typeof resolveFood>): HTMLElement {
  const chip = document.createElement('div');
  chip.className = 'food-chip';
  chip.textContent = food.icon || '🌾';
  chip.dataset.food = food.name;
  chip.setAttribute('role', 'button');
  chip.setAttribute('aria-label', `${food.name} chip`);
  if (food.description) {
    chip.title = food.description;
  }
  chip.addEventListener('pointerdown', handlePointerDown);
  return chip;
}

function handlePointerDown(event: PointerEvent) {
  if (!state || !state.running) return;
  const chip = event.currentTarget as HTMLElement;
  event.preventDefault();
  chip.setPointerCapture(event.pointerId);
  chip.classList.add('dragging');
  const rect = chip.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  const move = (ev: PointerEvent) => {
    chip.style.left = `${ev.clientX - offsetX}px`;
    chip.style.top = `${ev.clientY - offsetY}px`;
  };
  const end = (ev: PointerEvent) => {
    chip.classList.remove('dragging');
    chip.style.left = '';
    chip.style.top = '';
    chip.releasePointerCapture(ev.pointerId);
    chip.removeEventListener('pointermove', move);
    chip.removeEventListener('pointerup', end);
    chip.removeEventListener('pointercancel', end);
    const drop = document.elementFromPoint(ev.clientX, ev.clientY);
    const targetEl = drop ? (drop.closest('.food-target') as HTMLElement | null) : null;
    if (targetEl) {
      processDrop(chip, targetEl);
    }
  };
  chip.addEventListener('pointermove', move);
  chip.addEventListener('pointerup', end);
  chip.addEventListener('pointercancel', end);
}

function processDrop(chip: HTMLElement, targetEl: HTMLElement) {
  if (!state) return;
  const targetState = state.targets.find(t => t.el === targetEl);
  if (!targetState) return;
  targetState.feeds += 1;
  const limit = targetState.limit || 1;
  const statusEl = targetEl.querySelector('.food-status') as HTMLElement | null;
  const isCorrect = chip.dataset.food === targetState.expected;
  if (isCorrect && targetState.feeds <= limit) {
    targetEl.classList.remove('mistake');
    targetEl.classList.remove('overfed');
    targetState.satisfied = true;
    if (statusEl) {
      statusEl.textContent = 'Yum!';
    }
    chip.remove();
    play('tap');
    if (state.targets.every(t => t.satisfied)) {
      finish(true, 'Every cow is well fed!');
    }
  } else {
    if (isCorrect && targetState.feeds > limit) {
      targetState.overfed = true;
      state.overfed.add(targetState.cow.id);
      targetEl.classList.add('overfed');
      if (statusEl) {
        statusEl.textContent = 'Too many treats!';
      }
      chip.remove();
    } else {
      targetEl.classList.add('mistake');
      if (statusEl) {
        statusEl.textContent = 'Wrong snack!';
      }
      window.setTimeout(() => {
        targetEl.classList.remove('mistake');
        if (!targetState.satisfied && !targetState.overfed && statusEl) {
          statusEl.textContent = 'Needs snack';
        }
      }, 400);
      state.mistakes += 1;
    }
  }
}

function finish(success: boolean, message: string) {
  if (!state || state.finished) return;
  state.finished = true;
  state.running = false;
  stopLoop();
  const adjustments: MiniGameResult['adjustments'] = {};
  state.targets.forEach(target => {
    if (!adjustments[target.cow.id]) adjustments[target.cow.id] = {};
    const adj = adjustments[target.cow.id];
    const foodMeta = target.food || {};
    if (success && target.satisfied) {
      const hungerChange = typeof foodMeta.hunger === 'number' ? foodMeta.hunger : -24;
      const happinessChange = typeof foodMeta.happiness === 'number' ? foodMeta.happiness : 6;
      const chonkChange = typeof foodMeta.chonk === 'number' ? foodMeta.chonk : 0;
      adj.hunger = (adj.hunger || 0) + hungerChange;
      adj.happiness = (adj.happiness || 0) + happinessChange;
      if (chonkChange) {
        adj.chonk = (adj.chonk || 0) + chonkChange;
      }
    } else if (!success) {
      adj.hunger = (adj.hunger || 0) + 12;
      adj.happiness = (adj.happiness || 0) - 6;
    }
    if (target.overfed) {
      const overfeedChonk = typeof foodMeta.overfeedChonk === 'number' ? foodMeta.overfeedChonk : 12;
      const overfeedMood = typeof foodMeta.overfeedMood === 'number' ? foodMeta.overfeedMood : 4;
      adj.chonk = (adj.chonk || 0) + overfeedChonk;
      adj.happiness = (adj.happiness || 0) - overfeedMood;
    }
  });
  const treatNames = Array.from(new Set(state.targets.filter(t => t.satisfied && t.food).map(t => t.food!.name)));
  let summary = message || '';
  if (success && treatNames.length) {
    summary += ` Treats served: ${treatNames.join(', ')}.`;
  }
  if (state.overfed.size) {
    const label = state.overfed.size === 1 ? 'One cow' : `${state.overfed.size} cows`;
    summary += ` ${label} snuck extra serves.`;
  }
  const stats = {
    totalPerfects: success && state.mistakes === 0 && state.overfed.size === 0 ? 1 : 0,
    totalChonks: state.overfed.size
  };
  lastResult = {
    success,
    adjustments,
    summary: summary.trim(),
    stats
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
    finish(false, 'The cows wandered off hungry...');
  }
}

export function mount(container: HTMLElement): HTMLElement {
  if (root) return root;
  root = document.createElement('div');
  root.className = 'minigame-surface food-game';
  board = document.createElement('div');
  board.className = 'food-board';
  targetsContainer = document.createElement('div');
  targetsContainer.className = 'food-targets';
  tray = document.createElement('div');
  tray.className = 'food-chip-tray';
  board.appendChild(targetsContainer);
  board.appendChild(tray);
  root.appendChild(board);
  container.appendChild(root);
  return root;
}

export function start(context: MiniGameContext): void {
  if (!targetsContainer || !tray) throw new Error('Food game not mounted');
  root?.classList.add('active');
  const modifiers = context.modifiers || {};
  const pool = buildFoodPool(context.foods);
  state = {
    context,
    participants: context.participants || [],
    targets: [],
    overfed: new Set(),
    mistakes: 0,
    timeLeft: Math.max(15, Math.max(20, 40 - (context.difficulty || 1) * 1.4) + (modifiers.timeModifier || 0)),
    running: true,
    finished: false,
    modifiers,
    pool
  };
  lastResult = null;
  context.updateTimer(state.timeLeft);
  targetsContainer.innerHTML = '';
  tray.innerHTML = '';
  const chipFoods: Array<ReturnType<typeof resolveFood>> = [];
  state.participants.forEach(cow => {
    const expected = pick(pool) || resolveFood(DEFAULT_FOODS[0])!;
    const targetEl = createTarget(cow, expected);
    targetsContainer.appendChild(targetEl);
    const limit = Math.max(1, (expected?.maxServings || 1) + (modifiers.overfeedGrace || 0));
    state!.targets.push({ cow, expected: expected.name, food: expected, el: targetEl, satisfied: false, feeds: 0, overfed: false, limit });
    chipFoods.push(expected);
  });
  while (chipFoods.length < state.targets.length + 2) {
    chipFoods.push(pick(pool) || resolveFood(DEFAULT_FOODS[0])!);
  }
  shuffle(chipFoods).forEach(food => {
    tray!.appendChild(createChip(food));
  });
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

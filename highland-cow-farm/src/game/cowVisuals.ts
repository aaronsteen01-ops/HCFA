import type { Cow } from '../types';
import { resolvedAccessoryKey } from '../data/accessories';
import {
  ACCESSORY_ANCHORS,
  ACCESSORY_SPRITES,
  COW_ANCHOR,
  COW_SPRITES,
  COW_TEXTURE_SIZE,
  type AccessorySpriteDefinition,
  type CowPoseAssets,
  type CowSpriteDefinition,
  type SpriteLayer
} from './cowSprites';

export const COAT_COLOURS: Record<Cow['colour'], { base: string; shade: string; light: string }> = {
  brown: { base: '#C98655', shade: '#B37447', light: '#E2AA7C' },
  cream: { base: '#E9D6B8', shade: '#D2BE9F', light: '#F5E8D3' },
  rose: { base: '#F2B7C6', shade: '#DD9DAF', light: '#FFD7E3' },
  chocolate: { base: '#8A5A3B', shade: '#72482F', light: '#A87553' },
  white: { base: '#F3F1EA', shade: '#D4D1C7', light: '#FFFFFF' }
};

export type CowPose = 'idle' | 'walk' | 'blink';

export interface CowSvgOptions {
  size?: number;
  pose?: CowPose;
  highContrast?: boolean;
  className?: string;
  scale?: number;
  viewBox?: string;
  offsetX?: number;
  offsetY?: number;
}

export interface CowCanvasOptions {
  w?: number;
  h?: number;
  pose?: CowPose;
  x?: number;
  y?: number;
  scale?: number;
  wobble?: number;
  clear?: boolean;
}

const DEFAULT_SIZE = 240;
const BLINK_DURATION = 180;
const BLINK_GAP_MIN = 2800;
const BLINK_GAP_MAX = 6200;

const blinkControllers = new WeakMap<HTMLElement, { open?: number; close?: number }>();

const fmt = (value: number): string => Number.isFinite(value) ? Number(value.toFixed(2)).toString() : '0';
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function colourHex(colour: Cow['colour']): string {
  return (COAT_COLOURS[colour] || COAT_COLOURS.brown).base;
}

function chonkBucket(chonk: number): number {
  const normalised = clamp(chonk ?? 0, 0, 100);
  return Math.min(4, Math.floor(normalised / 25));
}

type EyeState = 'open' | 'half' | 'closed';

type MoodState = 'happy' | 'calm' | 'sleepy' | 'worried';

export function moodFromStats(happiness: number, hunger: number, cleanliness: number): MoodState {
  if (happiness >= 72 && hunger <= 45 && cleanliness >= 60) return 'happy';
  if (hunger >= 75 || cleanliness <= 34) return 'worried';
  if (happiness <= 45 || hunger >= 60) return 'sleepy';
  return 'calm';
}

function buildEyeState(pose: CowPose, mood: MoodState): EyeState {
  if (pose === 'blink') return 'closed';
  if (mood === 'sleepy') return 'half';
  return 'open';
}

function spriteForCow(cow: Cow): CowSpriteDefinition {
  return COW_SPRITES[cow.colour] || COW_SPRITES.brown;
}

function poseAssets(sprite: CowSpriteDefinition, pose: CowPose): CowPoseAssets {
  if (pose === 'walk') return sprite.poses.walk;
  return sprite.poses.idle;
}

function defaultViewBox(sprite: CowSpriteDefinition): string {
  return `${fmt(-sprite.anchor.x)} ${fmt(-sprite.anchor.y)} ${fmt(sprite.size.width)} ${fmt(sprite.size.height)}`;
}

function sortLayers<T extends { zIndex?: number }>(layers: T[]): T[] {
  return [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

function layerToSvg(layer: SpriteLayer): string {
  const width = fmt(layer.width * (layer.scale ?? 1));
  const height = fmt(layer.height * (layer.scale ?? 1));
  const anchor = layer.anchor ?? COW_ANCHOR;
  const offset = layer.offset ?? { x: 0, y: 0 };
  const x = fmt(-anchor.x * (layer.scale ?? 1) + offset.x);
  const y = fmt(-anchor.y * (layer.scale ?? 1) + offset.y);
  const opacityAttr = typeof layer.opacity === 'number' ? ` opacity="${fmt(layer.opacity)}"` : '';
  const classes = ['cow-layer'];
  if (layer.className) classes.push(layer.className);
  return `<image class="${classes.join(' ')}" href="${layer.src}" x="${x}" y="${y}" width="${width}" height="${height}"${opacityAttr} />`;
}

function eyeLayersToSvg(eyeState: EyeState, eyes: CowPoseAssets['eyes']): string {
  const layers: SpriteLayer[] = [eyes.open];
  if (eyes.half) layers.push(eyes.half);
  layers.push(eyes.closed);
  return layers
    .map(layer => {
      const classes = ['cow-layer', 'cow-eyes'];
      if (layer.className) classes.push(layer.className);
      const width = fmt(layer.width * (layer.scale ?? 1));
      const height = fmt(layer.height * (layer.scale ?? 1));
      const anchor = layer.anchor ?? COW_ANCHOR;
      const offset = layer.offset ?? { x: 0, y: 0 };
      const x = fmt(-anchor.x * (layer.scale ?? 1) + offset.x);
      const y = fmt(-anchor.y * (layer.scale ?? 1) + offset.y);
      return `<image class="${classes.join(' ')}" href="${layer.src}" x="${x}" y="${y}" width="${width}" height="${height}" />`;
    })
    .join('');
}

interface ResolvedAccessory {
  key: string;
  def: AccessorySpriteDefinition;
}

function resolveAccessories(cow: Cow): ResolvedAccessory[] {
  if (!cow.accessories?.length) return [];
  return cow.accessories
    .map(name => {
      const key = resolvedAccessoryKey(name);
      const def = ACCESSORY_SPRITES[key];
      if (!def) return null;
      return { key, def };
    })
    .filter((value): value is ResolvedAccessory => Boolean(value));
}

function accessoryToSvg(entry: ResolvedAccessory): string {
  const target = ACCESSORY_ANCHORS[entry.def.placement];
  if (!target) return '';
  const scale = entry.def.scale ?? 1;
  const anchor = entry.def.anchor;
  const offset = entry.def.offset ?? { x: 0, y: 0 };
  const width = fmt(entry.def.width * scale);
  const height = fmt(entry.def.height * scale);
  const x = fmt(target.x + offset.x - anchor.x * scale);
  const y = fmt(target.y + offset.y - anchor.y * scale);
  const classes = ['cow-layer', 'cow-accessory'];
  if (entry.def.className) classes.push(entry.def.className);
  classes.push(`accessory-${entry.key}`);
  return `<image class="${classes.join(' ')}" href="${entry.def.src}" x="${x}" y="${y}" width="${width}" height="${height}" />`;
}

function accessoriesToSvg(cow: Cow): string {
  const entries = resolveAccessories(cow);
  if (!entries.length) return '';
  return sortLayers(entries.map(entry => ({ ...entry, zIndex: entry.def.zIndex ?? 0 })))
    .map(({ key, def }) => accessoryToSvg({ key, def }))
    .join('');
}

export function svg(cow: Cow, opts: CowSvgOptions = {}): string {
  const sprite = spriteForCow(cow);
  const pose: CowPose = opts.pose || 'idle';
  const assets = poseAssets(sprite, pose);
  const mood = moodFromStats(cow.happiness ?? 50, cow.hunger ?? 50, cow.cleanliness ?? 50);
  const eyeState = buildEyeState(pose, mood);
  const classes = ['cow-svg', 'cow-figure', `pose-${pose}`, `coat-${cow.colour}`, `chonk-${chonkBucket(cow.chonk)}`];
  if (opts.className) classes.push(opts.className);
  if (opts.highContrast) classes.push('high-contrast');
  const widthAttr = opts.size ? ` width="${fmt(opts.size)}" height="${fmt(opts.size)}"` : ` width="${fmt(DEFAULT_SIZE)}" height="${fmt(DEFAULT_SIZE)}"`;
  const viewBoxAttr = opts.viewBox || defaultViewBox(sprite);
  const offsetX = opts.offsetX ?? 0;
  const offsetY = opts.offsetY ?? 0;
  const scale = opts.scale ?? 1;
  const transforms: string[] = [];
  if (offsetX || offsetY) transforms.push(`translate(${fmt(offsetX)} ${fmt(offsetY)})`);
  if (scale !== 1) transforms.push(`scale(${fmt(scale)})`);
  const transformAttr = transforms.length ? ` transform="${transforms.join(' ')}"` : '';
  const baseLayers = sortLayers(assets.layers).map(layerToSvg).join('');
  const eyesSvg = eyeLayersToSvg(eyeState, assets.eyes);
  const accessories = accessoriesToSvg(cow);
  const label = `${cow.name} the cow`;
  const chonk = clamp((cow.chonk ?? 0) / 100, 0, 1);
  return `<svg class="${classes.join(' ')}" role="img" aria-label="${label}" data-eye-state="${eyeState}" viewBox="${viewBoxAttr}" preserveAspectRatio="xMidYMid meet"${widthAttr} style="--cow-chonk:${chonk.toFixed(3)};">
    <title>${label}</title>
    <g class="cow-root-group"${transformAttr}>
      ${baseLayers}
      ${eyesSvg}
      ${accessories}
    </g>
  </svg>`;
}

const imageCache = new Map<string, HTMLImageElement>();
const loadingImages = new Map<string, HTMLImageElement>();

function ensureImage(src: string): HTMLImageElement | null {
  const cached = imageCache.get(src);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return cached;
  }
  if (!loadingImages.has(src) && typeof Image !== 'undefined') {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      imageCache.set(src, img);
      loadingImages.delete(src);
    };
    img.onerror = () => {
      loadingImages.delete(src);
    };
    img.src = src;
    loadingImages.set(src, img);
  }
  return null;
}

function warmCowAssets(sprite: CowSpriteDefinition): void {
  const layers = sprite.poses.idle.layers;
  layers.forEach(layer => ensureImage(layer.src));
  const eyes = sprite.poses.idle.eyes;
  ensureImage(eyes.open.src);
  eyes.half && ensureImage(eyes.half.src);
  ensureImage(eyes.closed.src);
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: SpriteLayer): void {
  const img = ensureImage(layer.src);
  if (!img) return;
  const scale = layer.scale ?? 1;
  const anchor = layer.anchor ?? COW_ANCHOR;
  const offset = layer.offset ?? { x: 0, y: 0 };
  const x = offset.x - anchor.x * scale;
  const y = offset.y - anchor.y * scale;
  const width = layer.width * scale;
  const height = layer.height * scale;
  const opacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.drawImage(img, x, y, width, height);
  ctx.restore();
}

function drawAccessories(ctx: CanvasRenderingContext2D, cow: Cow): void {
  const entries = resolveAccessories(cow);
  if (!entries.length) return;
  entries.forEach(entry => ensureImage(entry.def.src));
  sortLayers(entries.map(entry => ({ ...entry, zIndex: entry.def.zIndex ?? 0 }))).forEach(({ def }) => {
    const img = ensureImage(def.src);
    if (!img) return;
    const target = ACCESSORY_ANCHORS[def.placement];
    if (!target) return;
    const scale = def.scale ?? 1;
    const anchor = def.anchor;
    const offset = def.offset ?? { x: 0, y: 0 };
    const x = target.x + offset.x - anchor.x * scale;
    const y = target.y + offset.y - anchor.y * scale;
    ctx.drawImage(img, x, y, def.width * scale, def.height * scale);
  });
}

export function drawCanvas(ctx: CanvasRenderingContext2D, cow: Cow, opts: CowCanvasOptions = {}): void {
  const sprite = spriteForCow(cow);
  warmCowAssets(sprite);
  const width = opts.w ?? ctx.canvas.width;
  const height = opts.h ?? ctx.canvas.height;
  const pose: CowPose = opts.pose || 'idle';
  const assets = poseAssets(sprite, pose);
  const scale = opts.scale ?? Math.min(width / COW_TEXTURE_SIZE, height / COW_TEXTURE_SIZE);
  const x = opts.x ?? width / 2;
  const y = opts.y ?? height / 2;
  const wobble = (opts.wobble ?? 0) * (Math.PI / 180);
  const clear = opts.clear ?? (opts.x === undefined && opts.y === undefined);
  if (clear) {
    ctx.clearRect(0, 0, width, height);
  }
  ctx.save();
  ctx.translate(x, y);
  if (wobble) ctx.rotate(wobble);
  ctx.scale(scale, scale);
  const baseLayers = sortLayers(assets.layers);
  baseLayers.forEach(layer => drawLayer(ctx, layer));
  const mood = moodFromStats(cow.happiness ?? 50, cow.hunger ?? 50, cow.cleanliness ?? 50);
  const eyeState = buildEyeState(pose, mood);
  if (eyeState === 'open') {
    drawLayer(ctx, assets.eyes.open);
  } else if (eyeState === 'half' && assets.eyes.half) {
    drawLayer(ctx, assets.eyes.half);
  } else {
    drawLayer(ctx, assets.eyes.closed);
  }
  drawAccessories(ctx, cow);
  ctx.restore();
}

function clearBlink(container: HTMLElement): void {
  const timers = blinkControllers.get(container);
  if (!timers) return;
  if (typeof window !== 'undefined') {
    if (timers.open) window.clearTimeout(timers.open);
    if (timers.close) window.clearTimeout(timers.close);
  }
  blinkControllers.delete(container);
}

function scheduleBlink(container: HTMLElement, svgEl: SVGElement): void {
  if (typeof window === 'undefined') return;
  const state = { open: 0, close: 0 };
  const queue = () => {
    state.open = window.setTimeout(() => {
      if (!svgEl.isConnected) return;
      svgEl.classList.add('auto-blink');
      state.close = window.setTimeout(() => {
        svgEl.classList.remove('auto-blink');
        queue();
      }, BLINK_DURATION);
      blinkControllers.set(container, { open: state.open, close: state.close });
    }, BLINK_GAP_MIN + Math.random() * (BLINK_GAP_MAX - BLINK_GAP_MIN));
    blinkControllers.set(container, { open: state.open, close: state.close });
  };
  queue();
}

export function renderCowInto(container: HTMLElement, cow: Cow, opts: CowSvgOptions = {}): SVGElement | null {
  const pose: CowPose = opts.pose || 'idle';
  const markup = svg(cow, opts);
  container.innerHTML = markup;
  container.classList.add('cow-svg');
  container.classList.remove('pose-idle', 'pose-walk', 'pose-blink');
  container.classList.remove('chonk-0', 'chonk-1', 'chonk-2', 'chonk-3', 'chonk-4');
  container.classList.add(`pose-${pose}`, `chonk-${chonkBucket(cow.chonk)}`);
  const svgEl = container.querySelector('svg');
  if (!svgEl) return null;
  clearBlink(container);
  svgEl.classList.remove('auto-blink');
  if (pose !== 'blink') {
    scheduleBlink(container, svgEl);
  }
  return svgEl;
}

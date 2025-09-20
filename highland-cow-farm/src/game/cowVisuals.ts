import type { Cow } from '../types';

export const COAT_COLOURS: Record<Cow['colour'], { base: string; shade: string; light: string }> = {
  brown: { base: '#C98655', shade: '#B37447', light: '#E2AA7C' },
  cream: { base: '#E9D6B8', shade: '#D2BE9F', light: '#F5E8D3' },
  rose: { base: '#F2B7C6', shade: '#DD9DAF', light: '#FFD7E3' },
  chocolate: { base: '#8A5A3B', shade: '#72482F', light: '#A87553' },
  white: { base: '#F3F1EA', shade: '#D4D1C7', light: '#FFFFFF' }
};

const EYE_COLOUR = '#4A2C3A';
const BLUSH_COLOUR = '#F3B1B4';
const HORN_BASE = '#D7CFC4';

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
}

interface LegGeometry {
  side: 'left' | 'right';
  position: 'front' | 'back';
  x: number;
  top: number;
  bottom: number;
  width: number;
  hoofWidth: number;
  hoofHeight: number;
  lift: number;
}

interface CowGeometry {
  pose: CowPose;
  chonk: number;
  bobStrength: number;
  body: {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    bellyRx: number;
    bellyRy: number;
    bellyCy: number;
  };
  head: {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    top: number;
    bottom: number;
  };
  snout: {
    cx: number;
    cy: number;
    width: number;
    height: number;
    nostrilGap: number;
    nostrilRadius: number;
  };
  horns: {
    baseLeft: { x: number; y: number };
    baseRight: { x: number; y: number };
    tipLeft: { x: number; y: number };
    tipRight: { x: number; y: number };
    innerLeft: { x: number; y: number };
    innerRight: { x: number; y: number };
  };
  ears: {
    left: { x: number; y: number; width: number; height: number; tilt: number };
    right: { x: number; y: number; width: number; height: number; tilt: number };
  };
  eyes: {
    left: { cx: number; cy: number; rx: number; ry: number };
    right: { cx: number; cy: number; rx: number; ry: number };
  };
  blush: {
    left: { cx: number; cy: number; rx: number; ry: number };
    right: { cx: number; cy: number; rx: number; ry: number };
  };
  fringe: {
    top: number;
    bottom: number;
    width: number;
  };
  legs: LegGeometry[];
  crown: {
    y: number;
    radius: number;
  };
}

interface AccessoryGeometry {
  cow: Cow;
  geo: CowGeometry;
  scale: number;
}

type AccessoryRenderer = {
  svg: (input: AccessoryGeometry) => string;
  canvas?: (ctx: CanvasRenderingContext2D, input: AccessoryGeometry) => void;
};

const DEFAULT_SIZE = 240;
const DEFAULT_VIEWBOX = { x: -120, y: -120, width: 240, height: 240 } as const;

interface ViewBoxDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
}

const BLUSH_MIN_OPACITY = 0.35;
const BLUSH_MAX_OPACITY = 0.5;

const BLINK_DURATION = 180;
const BLINK_GAP_MIN = 2800;
const BLINK_GAP_MAX = 6200;

const blinkControllers = new WeakMap<HTMLElement, { open?: number; close?: number }>();

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const fmt = (value: number): string => Number.isFinite(value) ? Number(value.toFixed(2)).toString() : '0';
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

let gradientCounter = 0;
const uid = (prefix: string): string => `${prefix}-${(++gradientCounter).toString(36)}`;

function parseViewBox(value?: string): ViewBoxDefinition | null {
  if (!value) return null;
  const parts = value.trim().split(/[\s,]+/).map(part => Number(part));
  if (parts.length !== 4 || parts.some(part => Number.isNaN(part))) {
    return null;
  }
  const [x, y, width, height] = parts;
  return { x, y, width, height };
}

export function colourHex(colour: Cow['colour']): string {
  return (COAT_COLOURS[colour] || COAT_COLOURS.brown).base;
}

const normaliseAccessoryName = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, '_');

function chonkBucket(chonk: number): number {
  const normalised = clamp(chonk, 0, 100);
  return Math.min(4, Math.floor(normalised / 25));
}

function computeGeometry(cow: Cow, pose: CowPose, timestamp: number = now()): CowGeometry {
  const chonk = clamp(cow.chonk ?? 0, 0, 100) / 100;
  const effectivePose = pose === 'blink' ? 'idle' : pose;
  const bobStrength = 1 - chonk * 0.45;
  const baseBob = effectivePose === 'walk' ? 4.2 : 1.6;
  const bob = Math.sin(timestamp / (effectivePose === 'walk' ? 380 : 920)) * baseBob * bobStrength;
  const sway = Math.cos(timestamp / 1450) * 1.1;

  const baseBodyCy = 44;
  const baseBodyRx = 80;
  const baseBodyRy = 54;
  const bodyRx = baseBodyRx * (1 + 0.15 * chonk);
  const bodyRy = baseBodyRy * (1 + 0.12 * chonk);
  const bodyCy = baseBodyCy + bob * 0.6;

  const bellyRx = 50 + 22 * chonk;
  const bellyRy = 32 + 16 * chonk;
  const bellyCy = bodyCy + bodyRy * 0.2;

  const baseHeadCy = -32;
  const headRx = 58;
  const headRy = 52;
  const headCy = baseHeadCy + bob;
  const headTop = headCy - headRy;
  const headBottom = headCy + headRy;

  const snoutCy = headCy + headRy * 0.26;
  const snoutWidth = 62;
  const snoutHeight = 42;

  const hornsBaseY = headTop + 18;
  const hornOffsetX = headRx * 0.64;
  const hornTipOffsetX = hornOffsetX + 46;
  const hornTipOffsetY = 36;

  const eyesSpacing = 42;
  const eyeRx = 12.5;
  const eyeRy = 14;
  const eyeCy = headCy - headRy * 0.18;

  const blushCy = snoutCy + 12;
  const blushRx = 20;
  const blushRy = 13;

  const legBaseY = bodyCy + bodyRy - 6;
  const legHeight = 46 + chonk * 8;
  const legWidth = 24 + chonk * 5;
  const hoofHeight = 12 + chonk * 4;
  const hoofWidth = legWidth * 0.78;

  const stepPhase = Math.sin(timestamp / 420);
  const stepAmplitude = 6.2 * bobStrength;
  const frontLift = effectivePose === 'walk' ? stepPhase * stepAmplitude : 0;
  const backLift = effectivePose === 'walk' ? -stepPhase * stepAmplitude : 0;
  const frontSpacing = bodyRx * 0.5 + 6;
  const backSpacing = bodyRx * 0.26 + 4;

  const legs: LegGeometry[] = [
    {
      side: 'left',
      position: 'front',
      x: -frontSpacing,
      top: legBaseY - legHeight - Math.max(0, frontLift),
      bottom: legBaseY + Math.max(0, -frontLift * 0.4),
      width: legWidth,
      hoofHeight,
      hoofWidth,
      lift: Math.max(0, frontLift)
    },
    {
      side: 'right',
      position: 'front',
      x: frontSpacing,
      top: legBaseY - legHeight - Math.max(0, -frontLift),
      bottom: legBaseY + Math.max(0, frontLift * 0.4),
      width: legWidth,
      hoofHeight,
      hoofWidth,
      lift: Math.max(0, -frontLift)
    },
    {
      side: 'left',
      position: 'back',
      x: -backSpacing,
      top: legBaseY - legHeight - Math.max(0, backLift),
      bottom: legBaseY + Math.max(0, -backLift * 0.4),
      width: legWidth * 0.92,
      hoofHeight,
      hoofWidth: hoofWidth * 0.92,
      lift: Math.max(0, backLift)
    },
    {
      side: 'right',
      position: 'back',
      x: backSpacing,
      top: legBaseY - legHeight - Math.max(0, -backLift),
      bottom: legBaseY + Math.max(0, backLift * 0.4),
      width: legWidth * 0.92,
      hoofHeight,
      hoofWidth: hoofWidth * 0.92,
      lift: Math.max(0, -backLift)
    }
  ];

  return {
    pose,
    chonk,
    bobStrength,
    body: {
      cx: 0,
      cy: bodyCy,
      rx: bodyRx,
      ry: bodyRy,
      bellyRx,
      bellyRy,
      bellyCy
    },
    head: {
      cx: 0,
      cy: headCy,
      rx: headRx,
      ry: headRy,
      top: headTop,
      bottom: headBottom
    },
    snout: {
      cx: 0,
      cy: snoutCy,
      width: snoutWidth,
      height: snoutHeight,
      nostrilGap: 18,
      nostrilRadius: 6
    },
    horns: {
      baseLeft: { x: -hornOffsetX, y: hornsBaseY },
      baseRight: { x: hornOffsetX, y: hornsBaseY },
      tipLeft: { x: -hornTipOffsetX, y: hornsBaseY - hornTipOffsetY },
      tipRight: { x: hornTipOffsetX, y: hornsBaseY - hornTipOffsetY },
      innerLeft: { x: -hornOffsetX + 6, y: hornsBaseY - 18 },
      innerRight: { x: hornOffsetX - 6, y: hornsBaseY - 18 }
    },
    ears: {
      left: { x: -headRx * 0.78, y: headCy - headRy * 0.32, width: 34, height: 38, tilt: -12 + sway },
      right: { x: headRx * 0.78, y: headCy - headRy * 0.32, width: 34, height: 38, tilt: 12 + sway }
    },
    eyes: {
      left: { cx: -eyesSpacing / 2, cy: eyeCy, rx: eyeRx, ry: eyeRy },
      right: { cx: eyesSpacing / 2, cy: eyeCy, rx: eyeRx, ry: eyeRy }
    },
    blush: {
      left: { cx: -snoutWidth * 0.38, cy: blushCy, rx: blushRx, ry: blushRy },
      right: { cx: snoutWidth * 0.38, cy: blushCy, rx: blushRx, ry: blushRy }
    },
    fringe: {
      top: headTop + 6,
      bottom: eyeCy + 16,
      width: headRx * 1.46
    },
    legs,
    crown: {
      y: headTop + 14,
      radius: headRx * 0.98
    }
  };
}

function buildLegPath(leg: LegGeometry): string {
  const half = leg.width / 2;
  const top = leg.top;
  const knee = lerp(leg.top, leg.bottom - leg.hoofHeight, 0.55);
  const bottom = leg.bottom;
  const inset = leg.side === 'left' ? -2.2 : 2.2;
  return `M ${fmt(leg.x - half)} ${fmt(top)} C ${fmt(leg.x - half - 6)} ${fmt(top + 14)}, ${fmt(leg.x - half + inset)} ${fmt(knee - 6)}, ${fmt(leg.x - half + 3)} ${fmt(knee)} ` +
    `L ${fmt(leg.x - half + 4)} ${fmt(bottom - leg.hoofHeight)} C ${fmt(leg.x - half + 6)} ${fmt(bottom - 2)}, ${fmt(leg.x - half + 10)} ${fmt(bottom)}, ${fmt(leg.x - half + 16)} ${fmt(bottom)} ` +
    `L ${fmt(leg.x + half - 16)} ${fmt(bottom)} C ${fmt(leg.x + half - 10)} ${fmt(bottom)}, ${fmt(leg.x + half - 6)} ${fmt(bottom - 2)}, ${fmt(leg.x + half - 4)} ${fmt(bottom - leg.hoofHeight)} ` +
    `L ${fmt(leg.x + half - 3)} ${fmt(knee)} C ${fmt(leg.x + half - inset)} ${fmt(knee - 6)}, ${fmt(leg.x + half + 6)} ${fmt(top + 14)}, ${fmt(leg.x + half)} ${fmt(top)} Z`;
}

function buildHoofPath(leg: LegGeometry): string {
  const half = leg.hoofWidth / 2;
  const bottom = leg.bottom;
  return `M ${fmt(leg.x - half)} ${fmt(bottom - leg.hoofHeight + 2)} Q ${fmt(leg.x)} ${fmt(bottom + 4)}, ${fmt(leg.x + half)} ${fmt(bottom - leg.hoofHeight + 2)} ` +
    `Q ${fmt(leg.x)} ${fmt(bottom - leg.hoofHeight - 2)}, ${fmt(leg.x - half)} ${fmt(bottom - leg.hoofHeight + 2)} Z`;
}

function buildHornPath(geo: CowGeometry, side: 'left' | 'right'): string {
  const start = side === 'left' ? geo.horns.baseLeft : geo.horns.baseRight;
  const tip = side === 'left' ? geo.horns.tipLeft : geo.horns.tipRight;
  const inner = side === 'left' ? geo.horns.innerLeft : geo.horns.innerRight;
  const sweep = side === 'left' ? -1 : 1;
  const curveOutX = start.x + sweep * 18;
  const curveOutY = start.y - 18;
  const midX = tip.x + sweep * 8;
  const midY = tip.y + 8;
  const returnX = start.x + sweep * 10;
  const returnY = start.y + 14;
  return `M ${fmt(start.x)} ${fmt(start.y)} C ${fmt(curveOutX)} ${fmt(curveOutY)}, ${fmt(midX)} ${fmt(midY)}, ${fmt(tip.x)} ${fmt(tip.y)} ` +
    `Q ${fmt(tip.x + sweep * 14)} ${fmt(tip.y + 18)}, ${fmt(tip.x + sweep * 18)} ${fmt(tip.y + 32)} ` +
    `C ${fmt(tip.x + sweep * 20)} ${fmt(tip.y + 44)}, ${fmt(returnX)} ${fmt(returnY)}, ${fmt(inner.x)} ${fmt(inner.y)} ` +
    `Q ${fmt(start.x + sweep * 2)} ${fmt(start.y - 6)}, ${fmt(start.x)} ${fmt(start.y)} Z`;
}

function buildEarPath(ear: CowGeometry['ears']['left'], side: 'left' | 'right'): string {
  const sweep = side === 'left' ? -1 : 1;
  const tipX = ear.x + sweep * ear.width * 0.6;
  const tipY = ear.y + ear.height * 0.1;
  const bottomX = ear.x + sweep * ear.width * 0.2;
  const bottomY = ear.y + ear.height;
  return `M ${fmt(ear.x)} ${fmt(ear.y)} Q ${fmt(ear.x + sweep * ear.width * 0.4)} ${fmt(ear.y - ear.height * 0.2)}, ${fmt(tipX)} ${fmt(tipY)} ` +
    `Q ${fmt(ear.x + sweep * ear.width * 0.9)} ${fmt(bottomY - ear.height * 0.15)}, ${fmt(bottomX)} ${fmt(bottomY)} ` +
    `Q ${fmt(ear.x - sweep * ear.width * 0.2)} ${fmt(bottomY - ear.height * 0.1)}, ${fmt(ear.x)} ${fmt(ear.y)} Z`;
}

function buildEarInnerPath(ear: CowGeometry['ears']['left'], side: 'left' | 'right'): string {
  const sweep = side === 'left' ? -1 : 1;
  const tipX = ear.x + sweep * ear.width * 0.4;
  const tipY = ear.y + ear.height * 0.12;
  const bottomX = ear.x + sweep * ear.width * 0.12;
  const bottomY = ear.y + ear.height * 0.76;
  return `M ${fmt(ear.x + sweep * ear.width * 0.12)} ${fmt(ear.y + ear.height * 0.12)} Q ${fmt(ear.x + sweep * ear.width * 0.24)} ${fmt(ear.y - ear.height * 0.08)}, ${fmt(tipX)} ${fmt(tipY)} ` +
    `Q ${fmt(ear.x + sweep * ear.width * 0.6)} ${fmt(bottomY - ear.height * 0.12)}, ${fmt(bottomX)} ${fmt(bottomY)} ` +
    `Q ${fmt(ear.x)} ${fmt(bottomY - ear.height * 0.18)}, ${fmt(ear.x + sweep * ear.width * 0.12)} ${fmt(ear.y + ear.height * 0.12)} Z`;
}

function buildSnoutPath(geo: CowGeometry): string {
  const left = geo.snout.cx - geo.snout.width / 2;
  const right = geo.snout.cx + geo.snout.width / 2;
  const top = geo.snout.cy - geo.snout.height * 0.52;
  const bottom = geo.snout.cy + geo.snout.height * 0.68;
  return `M ${fmt(left)} ${fmt(geo.snout.cy)} Q ${fmt(geo.snout.cx)} ${fmt(top)}, ${fmt(right)} ${fmt(geo.snout.cy)} ` +
    `Q ${fmt(geo.snout.cx)} ${fmt(bottom)}, ${fmt(left)} ${fmt(geo.snout.cy)} Z`;
}

function buildSnoutHighlightPath(geo: CowGeometry): string {
  const left = geo.snout.cx - geo.snout.width * 0.24;
  const right = geo.snout.cx + geo.snout.width * 0.18;
  const top = geo.snout.cy - geo.snout.height * 0.25;
  const bottom = geo.snout.cy + geo.snout.height * 0.12;
  return `M ${fmt(left)} ${fmt(geo.snout.cy)} Q ${fmt(geo.snout.cx - 4)} ${fmt(top)}, ${fmt(right)} ${fmt(geo.snout.cy - 4)} ` +
    `Q ${fmt(geo.snout.cx - 2)} ${fmt(bottom)}, ${fmt(left)} ${fmt(geo.snout.cy)} Z`;
}

interface FringePaths {
  back: string;
  front: string;
}

function buildFringePaths(geo: CowGeometry): FringePaths {
  const width = geo.fringe.width;
  const left = -width / 2;
  const top = geo.fringe.top;
  const bottom = geo.fringe.bottom;
  const tuftDepths = [0, 12, 5, 14, 6, 13, 4, 10];
  const step = width / (tuftDepths.length - 1);
  const right = left + width;

  let back = `M ${fmt(left)} ${fmt(top)}`;
  for (let i = 0; i < tuftDepths.length - 1; i++) {
    const start = left + step * i;
    const end = left + step * (i + 1);
    const ctrlX = start + step / 2;
    const ctrlY = top - (i % 2 === 0 ? 10 : 7);
    back += ` Q ${fmt(ctrlX)} ${fmt(ctrlY)}, ${fmt(end)} ${fmt(top)}`;
  }
  back += ` L ${fmt(right)} ${fmt(bottom + tuftDepths[tuftDepths.length - 1])}`;
  for (let i = tuftDepths.length - 2; i >= 0; i--) {
    const drop = bottom + tuftDepths[i];
    const endX = left + step * i;
    const ctrlX = endX + step / 2;
    const ctrlY = drop + (i % 2 === 0 ? 12 : 8);
    back += ` Q ${fmt(ctrlX)} ${fmt(ctrlY)}, ${fmt(endX)} ${fmt(drop)}`;
  }
  back += ' Z';

  const overlayWidth = width * 0.92;
  const overlayLeft = -overlayWidth / 2;
  const overlayTop = top + 3;
  const overlayBottom = geo.eyes.left.cy - geo.eyes.left.ry * 0.25;
  const overlayDepths = [0, 6, 2, 8, 3, 7, 1, 5];
  const overlayStep = overlayWidth / (overlayDepths.length - 1);
  const overlayRight = overlayLeft + overlayWidth;
  let front = `M ${fmt(overlayLeft)} ${fmt(overlayTop)}`;
  for (let i = 0; i < overlayDepths.length - 1; i++) {
    const start = overlayLeft + overlayStep * i;
    const end = overlayLeft + overlayStep * (i + 1);
    const ctrlX = start + overlayStep / 2;
    const ctrlY = overlayTop - (i % 2 === 0 ? 8 : 5);
    front += ` Q ${fmt(ctrlX)} ${fmt(ctrlY)}, ${fmt(end)} ${fmt(overlayTop)}`;
  }
  front += ` L ${fmt(overlayRight)} ${fmt(overlayBottom + overlayDepths[overlayDepths.length - 1])}`;
  for (let i = overlayDepths.length - 2; i >= 0; i--) {
    const drop = overlayBottom + overlayDepths[i];
    const endX = overlayLeft + overlayStep * i;
    const ctrlX = endX + overlayStep / 2;
    const ctrlY = drop + (i % 2 === 0 ? 7 : 9);
    front += ` Q ${fmt(ctrlX)} ${fmt(ctrlY)}, ${fmt(endX)} ${fmt(drop)}`;
  }
  front += ' Z';

  return { back, front };
}

function buildEyeHighlight(cx: number, cy: number): string {
  return `M ${fmt(cx - 3)} ${fmt(cy - 4)} a 4 4 0 0 1 4 4  a 4 4 0 0 1 -4 -4`;
}

function buildEyeHalfPath(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${fmt(cx - rx)} ${fmt(cy)} Q ${fmt(cx)} ${fmt(cy - ry * 0.9)}, ${fmt(cx + rx)} ${fmt(cy)} L ${fmt(cx + rx)} ${fmt(cy + ry * 0.3)} ` +
    `Q ${fmt(cx)} ${fmt(cy + ry * 0.1)}, ${fmt(cx - rx)} ${fmt(cy + ry * 0.3)} Z`;
}

function buildEyeClosedPath(cx: number, cy: number, rx: number): string {
  return `M ${fmt(cx - rx)} ${fmt(cy)} Q ${fmt(cx)} ${fmt(cy + 1)}, ${fmt(cx + rx)} ${fmt(cy)}`;
}

function buildBrowPath(cx: number, cy: number, rx: number, tilt: number): string {
  const leftX = cx - rx;
  const rightX = cx + rx;
  const arcY = cy - tilt;
  return `M ${fmt(leftX)} ${fmt(cy)} Q ${fmt(cx)} ${fmt(arcY)}, ${fmt(rightX)} ${fmt(cy)}`;
}

function buildPastureGlow(geo: CowGeometry, gradientId: string): string {
  const width = geo.body.rx * 1.6;
  const height = geo.body.ry * 1.15;
  return `<ellipse class='cow-backdrop' cx='0' cy='${fmt(geo.body.cy + geo.body.ry * 0.55)}' rx='${fmt(width)}' ry='${fmt(height)}' fill='url(#${gradientId})' />`;
}

function createDefs(geo: CowGeometry, coat: { base: string; shade: string; light: string }, highContrast: boolean) {
  const bodyGradient = uid('coat');
  const headGradient = uid('head');
  const hornGradient = uid('horn');
  const snoutGradient = uid('snout');
  const glowGradient = uid('glow');
  const defs = `<linearGradient id='${bodyGradient}' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='${coat.light}' />
      <stop offset='65%' stop-color='${coat.base}' />
      <stop offset='100%' stop-color='${coat.shade}' />
    </linearGradient>
    <linearGradient id='${headGradient}' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='${coat.light}' />
      <stop offset='80%' stop-color='${coat.base}' />
    </linearGradient>
    <linearGradient id='${hornGradient}' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#F1EBE3' />
      <stop offset='55%' stop-color='${HORN_BASE}' />
      <stop offset='100%' stop-color='#BDAF9D' />
    </linearGradient>
    <linearGradient id='${snoutGradient}' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='${coat.light}' />
      <stop offset='100%' stop-color='${coat.base}' />
    </linearGradient>
    <radialGradient id='${glowGradient}' cx='50%' cy='60%' r='62%'>
      <stop offset='0%' stop-color='rgba(255, 246, 252, ${highContrast ? 0.9 : 0.75})' />
      <stop offset='100%' stop-color='rgba(255, 246, 252, 0)' />
    </radialGradient>`;
  return { defs, bodyGradient, headGradient, hornGradient, snoutGradient, glowGradient };
}

const ACCESSORY_RENDERERS: Record<string, AccessoryRenderer> = {};

function registerAccessories() {
  if (Object.keys(ACCESSORY_RENDERERS).length) return;
  ACCESSORY_RENDERERS.bow_pink = {
    svg: ({ geo, scale }) => {
      const x = geo.head.cx - geo.head.rx * 0.62;
      const y = geo.head.cy - geo.head.ry * 0.08;
      return `<g class="acc acc-bow" transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale)})">
          <ellipse cx="-10" cy="0" rx="10" ry="14" fill="#FBD5EA" />
          <ellipse cx="10" cy="0" rx="10" ry="14" fill="#FBD5EA" />
          <ellipse cx="0" cy="2" rx="6" ry="8" fill="#F49BC4" />
          <path d="M-6 -12 Q0 -8 6 -12" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round" />
        </g>`;
    },
    canvas: (ctx, { geo, scale }) => {
      const x = geo.head.cx - geo.head.rx * 0.62;
      const y = geo.head.cy - geo.head.ry * 0.08;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#FBD5EA';
      ctx.beginPath();
      ctx.ellipse(-10, 0, 10, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(10, 0, 10, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F49BC4';
      ctx.beginPath();
      ctx.ellipse(0, 2, 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, -12);
      ctx.quadraticCurveTo(0, -8, 6, -12);
      ctx.stroke();
      ctx.restore();
    }
  };

  ACCESSORY_RENDERERS.sun_hat = {
    svg: ({ geo, scale }) => {
      const y = geo.head.top - 4;
      const brim = geo.head.rx * 1.25;
      const crown = geo.head.rx * 0.76;
      return `<g class="acc acc-sun-hat" transform="translate(0 ${fmt(y)}) scale(${fmt(scale)})">
          <ellipse cx="0" cy="0" rx="${fmt(brim)}" ry="18" fill="#FBEAC3" stroke="#E6C592" stroke-width="3" />
          <ellipse cx="0" cy="-10" rx="${fmt(crown)}" ry="22" fill="#FFF4D7" stroke="#E6C592" stroke-width="2.4" />
          <path d="M-${fmt(crown * 0.7)} -6 Q0 -16 ${fmt(crown * 0.7)} -6" fill="none" stroke="#F7AEC7" stroke-width="5" stroke-linecap="round" />
        </g>`;
    },
    canvas: (ctx, { geo, scale }) => {
      const y = geo.head.top - 4;
      const brim = geo.head.rx * 1.25;
      const crown = geo.head.rx * 0.76;
      ctx.save();
      ctx.translate(0, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#FBEAC3';
      ctx.strokeStyle = '#E6C592';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, brim, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFF4D7';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(0, -10, crown, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#F7AEC7';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-crown * 0.7, -6);
      ctx.quadraticCurveTo(0, -16, crown * 0.7, -6);
      ctx.stroke();
      ctx.restore();
    }
  };

  ACCESSORY_RENDERERS.flower_crown = {
    svg: ({ geo, scale }) => {
      const y = geo.crown.y;
      const floralScale = geo.head.rx / 60;
      return `<g class="acc acc-flower-crown" transform="translate(0 ${fmt(y)}) scale(${fmt(scale)})">${flowerCrownSVG(floralScale, 0)}</g>`;
    },
    canvas: (ctx, { geo, scale }) => {
      const y = geo.crown.y;
      const floralScale = geo.head.rx / 60;
      const petals = [
        { x: -52, y: -6, r: 12, colour: '#FCDDEB', centre: '#F4A7C4' },
        { x: -32, y: -12, r: 8, colour: '#CBE7FF', centre: '#7AB2E3' },
        { x: -8, y: -4, r: 14, colour: '#FFE8D6', centre: '#F4B876' },
        { x: 14, y: -10, r: 12, colour: '#FFD6E5', centre: '#F58FB8' },
        { x: 36, y: -8, r: 9, colour: '#C7ECD3', centre: '#76B88B' },
        { x: 52, y: -6, r: 11, colour: '#F7C6DD', centre: '#E08CB9' }
      ];
      const leaves = [
        { x: -42, y: 2, w: 20, h: 8, colour: '#9FD4A8', rotate: -16 },
        { x: -4, y: 6, w: 26, h: 9, colour: '#B5E0B7', rotate: 12 },
        { x: 30, y: 4, w: 22, h: 8, colour: '#8BC598', rotate: 18 }
      ];
      ctx.save();
      ctx.translate(0, y);
      ctx.scale(scale * floralScale, scale * floralScale);
      leaves.forEach(leaf => {
        ctx.save();
        ctx.translate(leaf.x, leaf.y);
        ctx.rotate((leaf.rotate * Math.PI) / 180);
        ctx.fillStyle = leaf.colour;
        ctx.beginPath();
        ctx.moveTo(-leaf.w / 2, 0);
        ctx.quadraticCurveTo(0, -leaf.h, leaf.w / 2, 0);
        ctx.quadraticCurveTo(0, leaf.h, -leaf.w / 2, 0);
        ctx.fill();
        ctx.restore();
      });
      petals.forEach(flower => {
        ctx.save();
        ctx.translate(flower.x, flower.y);
        ctx.fillStyle = flower.colour;
        for (let i = 0; i < 6; i++) {
          ctx.rotate((Math.PI * 2) / 6);
          ctx.beginPath();
          ctx.ellipse(0, flower.r, flower.r * 0.45, flower.r, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = flower.centre;
        ctx.beginPath();
        ctx.arc(0, 0, flower.r * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      ctx.restore();
    }
  };

  ACCESSORY_RENDERERS.bell_charm = {
    svg: ({ geo, scale }) => {
      const y = geo.snout.cy + geo.snout.height * 0.92;
      return `<g class="acc acc-bell" transform="translate(0 ${fmt(y)}) scale(${fmt(scale)})">
          <path d="M-10 0 Q0 -16 10 0 V8 H-10 Z" fill="#F7E3B2" stroke="#C69C4F" stroke-width="2" />
          <circle cx="0" cy="5" r="3.6" fill="#C69C4F" />
          <path d="M-8 -2 Q0 -10 8 -2" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" />
        </g>`;
    },
    canvas: (ctx, { geo, scale }) => {
      const y = geo.snout.cy + geo.snout.height * 0.92;
      ctx.save();
      ctx.translate(0, y);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.quadraticCurveTo(0, -16, 10, 0);
      ctx.lineTo(10, 8);
      ctx.lineTo(-10, 8);
      ctx.closePath();
      ctx.fillStyle = '#F7E3B2';
      ctx.strokeStyle = '#C69C4F';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#C69C4F';
      ctx.beginPath();
      ctx.arc(0, 5, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-8, -2);
      ctx.quadraticCurveTo(0, -10, 8, -2);
      ctx.stroke();
      ctx.restore();
    }
  };

  ACCESSORY_RENDERERS.fern_garland = {
    svg: ({ geo, scale }) => {
      const y = geo.horns.baseLeft.y - 8;
      const spread = geo.head.rx * 1.3;
      const leaves = [-spread * 0.6, -spread * 0.2, spread * 0.2, spread * 0.6]
        .map((x, index) => `<path d="M${fmt(x)} ${fmt(y)} q${fmt(index % 2 === 0 ? -8 : 8)} -6 ${fmt(index % 2 === 0 ? -2 : 2)} -16" stroke="#7DBA8E" stroke-width="3" stroke-linecap="round" />`)
        .join('');
      return `<g class="acc acc-fern" transform="scale(${fmt(scale)})">
          <path d="M-${fmt(spread)} ${fmt(y)} Q0 ${fmt(y - 14)} ${fmt(spread)} ${fmt(y)}" fill="none" stroke="#7DBA8E" stroke-width="5" stroke-linecap="round" />
          ${leaves}
        </g>`;
    },
    canvas: (ctx, { geo, scale }) => {
      const y = geo.horns.baseLeft.y - 8;
      const spread = geo.head.rx * 1.3;
      ctx.save();
      ctx.scale(scale, scale);
      ctx.strokeStyle = '#7DBA8E';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-spread, y);
      ctx.quadraticCurveTo(0, y - 14, spread, y);
      ctx.stroke();
      ctx.lineWidth = 3;
      const offsets = [-spread * 0.6, -spread * 0.2, spread * 0.2, spread * 0.6];
      offsets.forEach((x, index) => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        const ctrl = index % 2 === 0 ? x - 8 : x + 8;
        ctx.quadraticCurveTo(ctrl, y - 6, x + (index % 2 === 0 ? -2 : 2), y - 16);
        ctx.stroke();
      });
      ctx.restore();
    }
  };

  ACCESSORY_RENDERERS.starry_bandana = {
    svg: ({ geo, scale }) => {
      const y = geo.snout.cy + geo.snout.height * 0.4;
      const width = geo.head.rx * 1.2;
      return `<g class="acc acc-bandana" transform="translate(0 ${fmt(y)}) scale(${fmt(scale)})">
          <path d="M-${fmt(width)} -6 L0 18 L${fmt(width)} -6 Z" fill="#364C85" stroke="#223463" stroke-width="3" stroke-linejoin="round" />
          <circle cx="-${fmt(width * 0.46)}" cy="4" r="3" fill="#F9F1FF" opacity="0.85" />
          <circle cx="0" cy="10" r="3.8" fill="#F9F1FF" opacity="0.85" />
          <circle cx="${fmt(width * 0.46)}" cy="4" r="3" fill="#F9F1FF" opacity="0.85" />
        </g>`;
    },
    canvas: (ctx, { geo, scale }) => {
      const y = geo.snout.cy + geo.snout.height * 0.4;
      const width = geo.head.rx * 1.2;
      ctx.save();
      ctx.translate(0, y);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.moveTo(-width, -6);
      ctx.lineTo(0, 18);
      ctx.lineTo(width, -6);
      ctx.closePath();
      ctx.fillStyle = '#364C85';
      ctx.strokeStyle = '#223463';
      ctx.lineWidth = 3;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(249,241,255,0.85)';
      ctx.beginPath();
      ctx.arc(-width * 0.46, 4, 3, 0, Math.PI * 2);
      ctx.arc(0, 10, 3.8, 0, Math.PI * 2);
      ctx.arc(width * 0.46, 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  ACCESSORY_RENDERERS.woolly_scarf = {
    svg: ({ geo, scale }) => {
      const y = geo.snout.cy + geo.snout.height * 0.58;
      const width = geo.head.rx * 1.18;
      return `<g class="acc acc-scarf" transform="translate(0 ${fmt(y)}) scale(${fmt(scale)})">
          <path d="M-${fmt(width)} -10 Q0 12 ${fmt(width)} -10 L${fmt(width * 0.74)} 12 Q0 26 -${fmt(width * 0.74)} 12 Z" fill="#F2A9B7" stroke="#C97A8A" stroke-width="3" stroke-linejoin="round" />
          <path d="M-${fmt(width * 0.24)} -4 V18" stroke="#C97A8A" stroke-width="5" stroke-linecap="round" />
          <path d="M${fmt(width * 0.24)} -4 V18" stroke="#C97A8A" stroke-width="5" stroke-linecap="round" />
        </g>`;
    },
    canvas: (ctx, { geo, scale }) => {
      const y = geo.snout.cy + geo.snout.height * 0.58;
      const width = geo.head.rx * 1.18;
      ctx.save();
      ctx.translate(0, y);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.moveTo(-width, -10);
      ctx.quadraticCurveTo(0, 12, width, -10);
      ctx.lineTo(width * 0.74, 12);
      ctx.quadraticCurveTo(0, 26, -width * 0.74, 12);
      ctx.closePath();
      ctx.fillStyle = '#F2A9B7';
      ctx.strokeStyle = '#C97A8A';
      ctx.lineWidth = 3;
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-width * 0.24, -4);
      ctx.lineTo(-width * 0.24, 18);
      ctx.moveTo(width * 0.24, -4);
      ctx.lineTo(width * 0.24, 18);
      ctx.stroke();
      ctx.restore();
    }
  };
}

registerAccessories();

const ACCESSORY_ALIASES: Record<string, string> = {
  'pastel bow': 'bow_pink',
  'bow_pink': 'bow_pink',
  'sun hat': 'sun_hat',
  'sun_hat': 'sun_hat',
  'flower crown': 'flower_crown',
  'thistle crown': 'flower_crown',
  'bell charm': 'bell_charm',
  'fern garland': 'fern_garland',
  'starry bandana': 'starry_bandana',
  'woolly scarf': 'woolly_scarf'
};

function resolveAccessoryKey(name: string): string | undefined {
  return ACCESSORY_ALIASES[normaliseAccessoryName(name)];
}

function renderAccessorySvg(name: string, cow: Cow, geo: CowGeometry, scale = 1): string {
  const key = resolveAccessoryKey(name);
  if (!key) return '';
  const renderer = ACCESSORY_RENDERERS[key];
  if (!renderer) return '';
  return renderer.svg({ cow, geo, scale });
}

function drawAccessoryCanvas(ctx: CanvasRenderingContext2D, name: string, cow: Cow, geo: CowGeometry, scale = 1): void {
  const key = resolveAccessoryKey(name);
  if (!key) return;
  const renderer = ACCESSORY_RENDERERS[key];
  renderer?.canvas?.(ctx, { cow, geo, scale });
}

export function flowerCrownSVG(scale = 1, hueShift = 0): string {
  const flowers: Array<{ type: 'cosmos' | 'forget' | 'daisy'; x: number; y: number; scale: number; petal: string; centre: string }> = [
    { type: 'cosmos', x: -52, y: -6, scale: 0.92, petal: '#FCDDEB', centre: '#F4A7C4' },
    { type: 'forget', x: -30, y: -12, scale: 0.68, petal: '#CBE7FF', centre: '#7AB2E3' },
    { type: 'daisy', x: -6, y: -4, scale: 1.08, petal: '#FFF4D6', centre: '#F2B976' },
    { type: 'cosmos', x: 18, y: -10, scale: 0.96, petal: '#FFD6E5', centre: '#F58FB8' },
    { type: 'forget', x: 38, y: -8, scale: 0.64, petal: '#C6E7F8', centre: '#73B7D9' },
    { type: 'daisy', x: 56, y: -4, scale: 0.9, petal: '#FFF6E6', centre: '#F3C27D' }
  ];
  const leaves: Array<{ x: number; y: number; rotate: number; width: number; height: number; colour: string }> = [
    { x: -40, y: 4, rotate: -20, width: 22, height: 8, colour: '#9FD4A8' },
    { x: -8, y: 8, rotate: 12, width: 26, height: 9, colour: '#B5E0B7' },
    { x: 24, y: 6, rotate: 18, width: 24, height: 8, colour: '#8BC598' },
    { x: 48, y: 4, rotate: 26, width: 20, height: 7, colour: '#A3D6AF' }
  ];

  const petals = flowers
    .map(({ type, x, y, scale: flowerScale, petal, centre }) => {
      const petalsCount = type === 'daisy' ? 12 : 6;
      const petalWidth = type === 'forget' ? 10 : 14;
      const petalHeight = type === 'forget' ? 20 : 26;
      const petalsMarkup = Array.from({ length: petalsCount })
        .map((_, index) => {
          const rotation = (360 / petalsCount) * index;
          const offset = type === 'daisy' ? 0.9 : 1;
          return `<ellipse cx="0" cy="${fmt(petalHeight * offset)}" rx="${fmt(petalWidth * 0.35)}" ry="${fmt(petalHeight)}" transform="rotate(${fmt(rotation)})" fill="${shiftHue(petal, hueShift)}" opacity="0.96" />`;
        })
        .join('');
      return `<g class="crown-flower" transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(flowerScale * scale)})">${petalsMarkup}<circle cx="0" cy="0" r="${fmt(type === 'daisy' ? 9 : 7)}" fill="${shiftHue(centre, hueShift)}" /></g>`;
    })
    .join('');

  const leafMarkup = leaves
    .map(leaf => `<path d="M-${fmt(leaf.width / 2)} 0 Q0 -${fmt(leaf.height)} ${fmt(leaf.width / 2)} 0 Q0 ${fmt(leaf.height)} -${fmt(leaf.width / 2)} 0 Z" transform="translate(${fmt(leaf.x)} ${fmt(leaf.y)}) rotate(${fmt(leaf.rotate)}) scale(${fmt(scale)})" fill="${shiftHue(leaf.colour, hueShift)}" />`)
    .join('');

  return `<g class="flower-crown" opacity="0.98">${leafMarkup}${petals}</g>`;
}

function shiftHue(hex: string, degrees: number): string {
  if (!degrees) return hex;
  const { h, s, l } = hexToHsl(hex);
  return hslToHex({ h: (h + degrees + 360) % 360, s, l });
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const value = hex.replace('#', '');
  const bigint = parseInt(value, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: { h: number; s: number; l: number }): string {
  const hue = h / 360;
  const sat = s / 100;
  const light = l / 100;
  const hueToRgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number;
  let g: number;
  let b: number;
  if (sat === 0) {
    r = g = b = light;
  } else {
    const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
    const p = 2 * light - q;
    r = hueToRgb(p, q, hue + 1 / 3);
    g = hueToRgb(p, q, hue);
    b = hueToRgb(p, q, hue - 1 / 3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function buildEyeState(pose: CowPose, mood: MoodState): 'open' | 'half' | 'closed' {
  if (pose === 'blink') return 'closed';
  if (mood === 'sleepy') return 'half';
  return 'open';
}

type MoodState = 'happy' | 'calm' | 'sleepy' | 'worried';

export function moodFromStats(happiness: number, hunger: number, cleanliness: number): MoodState {
  if (happiness >= 72 && hunger <= 45 && cleanliness >= 60) return 'happy';
  if (hunger >= 75 || cleanliness <= 34) return 'worried';
  if (happiness <= 45 || hunger >= 60) return 'sleepy';
  return 'calm';
}

export function renderAccessory(name: string, cow: Cow, scale = 1): string {
  const geo = computeGeometry(cow, 'idle');
  return renderAccessorySvg(name, cow, geo, scale);
}

function renderAccessoriesLayer(cow: Cow, geo: CowGeometry): string {
  if (!cow.accessories?.length) return '';
  return cow.accessories
    .map(name => renderAccessorySvg(name, cow, geo))
    .filter(Boolean)
    .join('');
}

function drawAccessoriesLayer(ctx: CanvasRenderingContext2D, cow: Cow, geo: CowGeometry): void {
  cow.accessories?.forEach(name => {
    drawAccessoryCanvas(ctx, name, cow, geo);
  });
}

export function svg(cow: Cow, opts: CowSvgOptions = {}): string {
  const pose: CowPose = opts.pose || 'idle';
  const size = opts.size ?? DEFAULT_SIZE;
  const highContrast = !!opts.highContrast;
  const geometry = computeGeometry(cow, pose);
  const coat = COAT_COLOURS[cow.colour] || COAT_COLOURS.brown;
  const defs = createDefs(geometry, coat, highContrast);
  const mood = moodFromStats(cow.happiness ?? 50, cow.hunger ?? 50, cow.cleanliness ?? 50);
  const chonkClass = `chonk-${chonkBucket(cow.chonk)}`;
  const classes = ['cow-svg', 'cow-figure', `pose-${pose}`, `mood-${mood}`, `coat-${cow.colour}`, chonkClass];
  if (opts.className) classes.push(opts.className);
  if (highContrast) classes.push('high-contrast');
  const viewBoxDef = parseViewBox(opts.viewBox) ?? DEFAULT_VIEWBOX;
  const scale = opts.scale ?? 1;
  const offsetX = opts.offsetX ?? 0;
  const offsetY = opts.offsetY ?? 0;
  const rootOffsetX = viewBoxDef.x + viewBoxDef.width / 2 + offsetX;
  const rootOffsetY = viewBoxDef.y + viewBoxDef.height / 2 + offsetY;
  const transformParts: string[] = [];
  if (rootOffsetX || rootOffsetY) {
    transformParts.push(`translate(${fmt(rootOffsetX)} ${fmt(rootOffsetY)})`);
  }
  if (scale !== 1) {
    transformParts.push(`scale(${fmt(scale)})`);
  }
  const rootTransformAttr = transformParts.length ? ` transform="${transformParts.join(' ')}"` : '';
  const viewBoxAttr = `${fmt(viewBoxDef.x)} ${fmt(viewBoxDef.y)} ${fmt(viewBoxDef.width)} ${fmt(viewBoxDef.height)}`;
  const fringe = buildFringePaths(geometry);
  const styleVars = `--coat-base:${coat.base};--coat-shade:${coat.shade};--coat-light:${coat.light};--chonk:${geometry.chonk.toFixed(3)};--bob-strength:${geometry.bobStrength.toFixed(3)};`;
  const eyeState = buildEyeState(pose, mood);
  const eyelidColour = shiftHue(coat.base, -4);
  const blushOpacity = lerp(BLUSH_MIN_OPACITY, BLUSH_MAX_OPACITY, 0.6 + geometry.chonk * 0.4);
  const glow = buildPastureGlow(geometry, defs.glowGradient);
  const accessories = renderAccessoriesLayer(cow, geometry);

  const svgStyle = `<style>
      .cow-figure { overflow: visible; }
      .cow-figure .cow-root-group { transform-box: fill-box; transform-origin: 50% 70%; }
      .cow-figure .cow-body-group { transform-origin: 0 ${fmt(geometry.body.cy)}; }
      .cow-figure.pose-walk .cow-body-group { animation: cow-bob 2.8s ease-in-out infinite; }
      .cow-figure.pose-idle .cow-body-group { animation: cow-sway 5.4s ease-in-out infinite; }
      .cow-figure .cow-leg.front { transform-origin: center ${fmt(geometry.body.cy + geometry.body.ry)}; }
      .cow-figure.pose-walk .cow-leg.front-left { animation: leg-swing 1.4s ease-in-out infinite; }
      .cow-figure.pose-walk .cow-leg.front-right { animation: leg-swing 1.4s ease-in-out infinite reverse; }
      .cow-figure.pose-walk .cow-leg.back-left { animation: leg-swing 1.4s ease-in-out infinite reverse; }
      .cow-figure.pose-walk .cow-leg.back-right { animation: leg-swing 1.4s ease-in-out infinite; }
      .cow-figure .cow-fringe, .cow-figure .cow-fringe-back { transform-origin: 0 ${fmt(geometry.fringe.top + 4)}; }
      .cow-figure.pose-walk .cow-fringe, .cow-figure.pose-walk .cow-fringe-back { animation: fringe-bob 2.8s ease-in-out infinite; }
      .cow-figure .eye-half, .cow-figure .eye-closed, .cow-figure .eye-lid { opacity: 0; }
      .cow-figure.mood-sleepy .eye-half { opacity: 1; }
      .cow-figure.pose-blink .eye-open, .cow-figure.auto-blink .eye-open { opacity: 0; }
      .cow-figure.pose-blink .eye-closed, .cow-figure.auto-blink .eye-closed { opacity: 1; }
      .cow-figure.pose-blink .eye-lid, .cow-figure.auto-blink .eye-lid { opacity: 1; }
      .cow-figure .eyebrow { transition: transform 0.4s ease; transform-origin: center; }
      .cow-figure.mood-worried .eyebrow-left { transform: rotate(-10deg) translateY(-1px); }
      .cow-figure.mood-worried .eyebrow-right { transform: rotate(10deg) translateY(-1px); }
      @keyframes cow-bob { 0% { transform: translateY(0); } 50% { transform: translateY(${fmt(-4.8 * geometry.bobStrength)}); } 100% { transform: translateY(0); } }
      @keyframes cow-sway { 0% { transform: translateY(0); } 50% { transform: translateY(${fmt(-1.8 * geometry.bobStrength)}); } 100% { transform: translateY(0); } }
      @keyframes fringe-bob { 0% { transform: rotate(0); } 50% { transform: rotate(${fmt(2.6 * geometry.bobStrength)}deg); } 100% { transform: rotate(0); } }
      @keyframes leg-swing { 0% { transform: rotate(${fmt(3 * geometry.bobStrength)}deg); } 50% { transform: rotate(${fmt(-3 * geometry.bobStrength)}deg); } 100% { transform: rotate(${fmt(3 * geometry.bobStrength)}deg); } }
    </style>`;

  return `<svg class="${classes.join(' ')}" data-name="${cow.name}" role="img" aria-label="${cow.name} Highland calf" viewBox="${viewBoxAttr}" width="${fmt(size)}" height="${fmt(size)}" style="${styleVars}">
      ${svgStyle}
      <defs>${defs.defs}</defs>
      <g class="cow-root-group"${rootTransformAttr}>
        ${glow}
        <g class="cow-body-group">
        <ellipse class="cow-body" cx="${fmt(geometry.body.cx)}" cy="${fmt(geometry.body.cy)}" rx="${fmt(geometry.body.rx)}" ry="${fmt(geometry.body.ry)}" fill="url(#${defs.bodyGradient})" stroke="${highContrast ? '#4A2C3A' : 'none'}" stroke-width="${highContrast ? '2.4' : '0'}" />
        <ellipse class="cow-belly" cx="${fmt(geometry.body.cx)}" cy="${fmt(geometry.body.bellyCy)}" rx="${fmt(geometry.body.bellyRx)}" ry="${fmt(geometry.body.bellyRy)}" fill="rgba(255,255,255,0.24)" />
        <ellipse class="cow-shadow" cx="${fmt(geometry.body.cx)}" cy="${fmt(geometry.body.cy + geometry.body.ry * 0.55)}" rx="${fmt(geometry.body.rx * 0.64)}" ry="${fmt(geometry.body.ry * 0.45)}" fill="rgba(74,44,58,0.08)" />
        </g>
        <g class="cow-legs">
        ${geometry.legs.map(leg => `<path class="cow-leg ${leg.position}-${leg.side}" d="${buildLegPath(leg)}" fill="${coat.shade}" />`).join('')}
        ${geometry.legs.map(leg => `<path class="cow-hoof" d="${buildHoofPath(leg)}" fill="#534448" />`).join('')}
        </g>
        <g class="cow-head">
        <path class="cow-horn left" d="${buildHornPath(geometry, 'left')}" fill="url(#${defs.hornGradient})" stroke="${highContrast ? '#806F57' : 'none'}" stroke-width="${highContrast ? '1.6' : '0'}" />
        <path class="cow-horn right" d="${buildHornPath(geometry, 'right')}" fill="url(#${defs.hornGradient})" stroke="${highContrast ? '#806F57' : 'none'}" stroke-width="${highContrast ? '1.6' : '0'}" />
        <path class="cow-ear left" d="${buildEarPath(geometry.ears.left, 'left')}" fill="${shiftHue(coat.base, -6)}" />
        <path class="cow-ear right" d="${buildEarPath(geometry.ears.right, 'right')}" fill="${shiftHue(coat.base, -6)}" />
        <path class="cow-ear-inner left" d="${buildEarInnerPath(geometry.ears.left, 'left')}" fill="rgba(255,221,235,0.85)" />
        <path class="cow-ear-inner right" d="${buildEarInnerPath(geometry.ears.right, 'right')}" fill="rgba(255,221,235,0.85)" />
        <ellipse class="cow-head" cx="${fmt(geometry.head.cx)}" cy="${fmt(geometry.head.cy)}" rx="${fmt(geometry.head.rx)}" ry="${fmt(geometry.head.ry)}" fill="url(#${defs.headGradient})" stroke="${highContrast ? '#4A2C3A' : 'none'}" stroke-width="${highContrast ? '2.2' : '0'}" />
        <path class="cow-fringe-back" d="${fringe.back}" fill="${shiftHue(coat.base, -10)}" />
        <g class="cow-eyes" fill="${EYE_COLOUR}">
          <ellipse class="eye-open" cx="${fmt(geometry.eyes.left.cx)}" cy="${fmt(geometry.eyes.left.cy)}" rx="${fmt(geometry.eyes.left.rx)}" ry="${fmt(geometry.eyes.left.ry)}" opacity="${eyeState === 'open' ? '1' : '0'}" />
          <ellipse class="eye-open" cx="${fmt(geometry.eyes.right.cx)}" cy="${fmt(geometry.eyes.right.cy)}" rx="${fmt(geometry.eyes.right.rx)}" ry="${fmt(geometry.eyes.right.ry)}" opacity="${eyeState === 'open' ? '1' : '0'}" />
          <path class="eye-half" d="${buildEyeHalfPath(geometry.eyes.left.cx, geometry.eyes.left.cy, geometry.eyes.left.rx, geometry.eyes.left.ry)}" fill="${eyelidColour}" opacity="${eyeState === 'half' ? '1' : '0'}" />
          <path class="eye-half" d="${buildEyeHalfPath(geometry.eyes.right.cx, geometry.eyes.right.cy, geometry.eyes.right.rx, geometry.eyes.right.ry)}" fill="${eyelidColour}" opacity="${eyeState === 'half' ? '1' : '0'}" />
          <path class="eye-closed" d="${buildEyeClosedPath(geometry.eyes.left.cx, geometry.eyes.left.cy, geometry.eyes.left.rx)}" stroke="${eyelidColour}" stroke-width="3" stroke-linecap="round" />
          <path class="eye-closed" d="${buildEyeClosedPath(geometry.eyes.right.cx, geometry.eyes.right.cy, geometry.eyes.right.rx)}" stroke="${eyelidColour}" stroke-width="3" stroke-linecap="round" />
          <path class="eye-lid" d="${buildEyeHalfPath(geometry.eyes.left.cx, geometry.eyes.left.cy, geometry.eyes.left.rx, geometry.eyes.left.ry)}" fill="${eyelidColour}" opacity="0" />
          <path class="eye-lid" d="${buildEyeHalfPath(geometry.eyes.right.cx, geometry.eyes.right.cy, geometry.eyes.right.rx, geometry.eyes.right.ry)}" fill="${eyelidColour}" opacity="0" />
          <path class="eye-highlight" d="${buildEyeHighlight(geometry.eyes.left.cx, geometry.eyes.left.cy)}" fill="rgba(255,255,255,0.7)" />
          <path class="eye-highlight" d="${buildEyeHighlight(geometry.eyes.right.cx, geometry.eyes.right.cy)}" fill="rgba(255,255,255,0.7)" />
          <path class="eyebrow eyebrow-left" d="${buildBrowPath(geometry.eyes.left.cx, geometry.eyes.left.cy - geometry.eyes.left.ry - 6, geometry.eyes.left.rx * 0.95, 3)}" stroke="${shiftHue(coat.shade, -10)}" stroke-width="3" stroke-linecap="round" fill="none" />
          <path class="eyebrow eyebrow-right" d="${buildBrowPath(geometry.eyes.right.cx, geometry.eyes.right.cy - geometry.eyes.right.ry - 6, geometry.eyes.right.rx * 0.95, -3)}" stroke="${shiftHue(coat.shade, -10)}" stroke-width="3" stroke-linecap="round" fill="none" />
        </g>
        <path class="cow-fringe" d="${fringe.front}" fill="${shiftHue(coat.light, -8)}" />
        <path class="cow-snout" d="${buildSnoutPath(geometry)}" fill="url(#${defs.snoutGradient})" />
        <path class="cow-snout-highlight" d="${buildSnoutHighlightPath(geometry)}" fill="rgba(255,255,255,0.35)" />
        <ellipse class="nostril" cx="${fmt(-geometry.snout.nostrilGap / 2)}" cy="${fmt(geometry.snout.cy + 6)}" rx="${fmt(geometry.snout.nostrilRadius)}" ry="${fmt(geometry.snout.nostrilRadius * 0.65)}" fill="${shiftHue(coat.shade, -16)}" />
        <ellipse class="nostril" cx="${fmt(geometry.snout.nostrilGap / 2)}" cy="${fmt(geometry.snout.cy + 6)}" rx="${fmt(geometry.snout.nostrilRadius)}" ry="${fmt(geometry.snout.nostrilRadius * 0.65)}" fill="${shiftHue(coat.shade, -16)}" />
        <ellipse class="cow-blush" cx="${fmt(geometry.blush.left.cx)}" cy="${fmt(geometry.blush.left.cy)}" rx="${fmt(geometry.blush.left.rx)}" ry="${fmt(geometry.blush.left.ry)}" fill="${BLUSH_COLOUR}" opacity="${fmt(blushOpacity)}" />
        <ellipse class="cow-blush" cx="${fmt(geometry.blush.right.cx)}" cy="${fmt(geometry.blush.right.cy)}" rx="${fmt(geometry.blush.right.rx)}" ry="${fmt(geometry.blush.right.ry)}" fill="${BLUSH_COLOUR}" opacity="${fmt(blushOpacity)}" />
        </g>
        ${accessories}
      </g>
    </svg>`;
}

export function drawCanvas(ctx: CanvasRenderingContext2D, cow: Cow, opts: CowCanvasOptions = {}): void {
  const width = opts.w ?? ctx.canvas.width;
  const height = opts.h ?? ctx.canvas.height;
  const pose: CowPose = opts.pose || 'idle';
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  const scale = Math.min(width / 240, height / 240);
  ctx.translate(width / 2, height / 2 + 10);
  ctx.scale(scale, scale);

  const geometry = computeGeometry(cow, pose, now());
  const coat = COAT_COLOURS[cow.colour] || COAT_COLOURS.brown;
  const fringe = buildFringePaths(geometry);
  const eyeState = buildEyeState(pose, moodFromStats(cow.happiness ?? 50, cow.hunger ?? 50, cow.cleanliness ?? 50));

  const glow = ctx.createRadialGradient(0, geometry.body.cy + geometry.body.ry * 0.55, 20, 0, geometry.body.cy + geometry.body.ry * 0.55, geometry.body.rx * 1.6);
  glow.addColorStop(0, 'rgba(255,246,252,0.78)');
  glow.addColorStop(1, 'rgba(255,246,252,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(0, geometry.body.cy + geometry.body.ry * 0.55, geometry.body.rx * 1.6, geometry.body.ry * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyGrad = ctx.createLinearGradient(0, geometry.body.cy - geometry.body.ry, 0, geometry.body.cy + geometry.body.ry);
  bodyGrad.addColorStop(0, coat.light);
  bodyGrad.addColorStop(0.65, coat.base);
  bodyGrad.addColorStop(1, coat.shade);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(geometry.body.cx, geometry.body.cy, geometry.body.rx, geometry.body.ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.24)';
  ctx.beginPath();
  ctx.ellipse(geometry.body.cx, geometry.body.bellyCy, geometry.body.bellyRx, geometry.body.bellyRy, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(74,44,58,0.08)';
  ctx.beginPath();
  ctx.ellipse(geometry.body.cx, geometry.body.cy + geometry.body.ry * 0.55, geometry.body.rx * 0.64, geometry.body.ry * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  geometry.legs.forEach(leg => {
    const legPath = new Path2D(buildLegPath(leg));
    ctx.fillStyle = coat.shade;
    ctx.fill(legPath);
    const hoofPath = new Path2D(buildHoofPath(leg));
    ctx.fillStyle = '#534448';
    ctx.fill(hoofPath);
  });

  const hornGrad = ctx.createLinearGradient(-geometry.head.rx, geometry.horns.baseLeft.y, geometry.head.rx, geometry.horns.baseLeft.y - 20);
  hornGrad.addColorStop(0, '#F1EBE3');
  hornGrad.addColorStop(0.55, HORN_BASE);
  hornGrad.addColorStop(1, '#BDAF9D');
  ctx.fillStyle = hornGrad;
  ctx.strokeStyle = 'rgba(128,111,87,0.8)';
  ctx.lineWidth = 1.6;
  ['left', 'right'].forEach(side => {
    const hornPath = new Path2D(buildHornPath(geometry, side as 'left' | 'right'));
    ctx.fill(hornPath);
  });

  ctx.lineWidth = 0;
  const earOuter = shiftHue(coat.base, -6);
  const earInner = 'rgba(255,221,235,0.85)';
  ctx.fillStyle = earOuter;
  ctx.fill(new Path2D(buildEarPath(geometry.ears.left, 'left')));
  ctx.fill(new Path2D(buildEarPath(geometry.ears.right, 'right')));
  ctx.fillStyle = earInner;
  ctx.fill(new Path2D(buildEarInnerPath(geometry.ears.left, 'left')));
  ctx.fill(new Path2D(buildEarInnerPath(geometry.ears.right, 'right')));

  const headGrad = ctx.createLinearGradient(0, geometry.head.top, 0, geometry.head.bottom);
  headGrad.addColorStop(0, coat.light);
  headGrad.addColorStop(1, coat.base);
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.ellipse(geometry.head.cx, geometry.head.cy, geometry.head.rx, geometry.head.ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = shiftHue(coat.base, -10);
  ctx.fill(new Path2D(fringe.back));

  ctx.fillStyle = eyeState === 'closed' ? shiftHue(coat.base, -4) : EYE_COLOUR;
  if (eyeState === 'closed') {
    ctx.strokeStyle = shiftHue(coat.base, -4);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(geometry.eyes.left.cx - geometry.eyes.left.rx, geometry.eyes.left.cy);
    ctx.quadraticCurveTo(geometry.eyes.left.cx, geometry.eyes.left.cy + 1, geometry.eyes.left.cx + geometry.eyes.left.rx, geometry.eyes.left.cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(geometry.eyes.right.cx - geometry.eyes.right.rx, geometry.eyes.right.cy);
    ctx.quadraticCurveTo(geometry.eyes.right.cx, geometry.eyes.right.cy + 1, geometry.eyes.right.cx + geometry.eyes.right.rx, geometry.eyes.right.cy);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(geometry.eyes.left.cx, geometry.eyes.left.cy, geometry.eyes.left.rx, geometry.eyes.left.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(geometry.eyes.right.cx, geometry.eyes.right.cy, geometry.eyes.right.rx, geometry.eyes.right.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    if (eyeState === 'half') {
      ctx.fillStyle = shiftHue(coat.base, -4);
      ctx.fill(new Path2D(buildEyeHalfPath(geometry.eyes.left.cx, geometry.eyes.left.cy, geometry.eyes.left.rx, geometry.eyes.left.ry)));
      ctx.fill(new Path2D(buildEyeHalfPath(geometry.eyes.right.cx, geometry.eyes.right.cy, geometry.eyes.right.rx, geometry.eyes.right.ry)));
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(geometry.eyes.left.cx - 3, geometry.eyes.left.cy - 4, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(geometry.eyes.right.cx - 3, geometry.eyes.right.cy - 4, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = shiftHue(coat.shade, -10);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const leftBrow = new Path2D(buildBrowPath(geometry.eyes.left.cx, geometry.eyes.left.cy - geometry.eyes.left.ry - 6, geometry.eyes.left.rx * 0.95, 3));
  const rightBrow = new Path2D(buildBrowPath(geometry.eyes.right.cx, geometry.eyes.right.cy - geometry.eyes.right.ry - 6, geometry.eyes.right.rx * 0.95, -3));
  ctx.stroke(leftBrow);
  ctx.stroke(rightBrow);

  ctx.fillStyle = shiftHue(coat.light, -8);
  ctx.fill(new Path2D(fringe.front));

  const snoutGrad = ctx.createLinearGradient(0, geometry.snout.cy - geometry.snout.height * 0.5, 0, geometry.snout.cy + geometry.snout.height * 0.7);
  snoutGrad.addColorStop(0, coat.light);
  snoutGrad.addColorStop(1, coat.base);
  ctx.fillStyle = snoutGrad;
  ctx.fill(new Path2D(buildSnoutPath(geometry)));
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill(new Path2D(buildSnoutHighlightPath(geometry)));

  const nostrilColour = shiftHue(coat.shade, -16);
  ctx.fillStyle = nostrilColour;
  ctx.beginPath();
  ctx.ellipse(-geometry.snout.nostrilGap / 2, geometry.snout.cy + 6, geometry.snout.nostrilRadius, geometry.snout.nostrilRadius * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(geometry.snout.nostrilGap / 2, geometry.snout.cy + 6, geometry.snout.nostrilRadius, geometry.snout.nostrilRadius * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();

  const blushOpacity = lerp(BLUSH_MIN_OPACITY, BLUSH_MAX_OPACITY, 0.6 + geometry.chonk * 0.4);
  ctx.fillStyle = `rgba(243,177,180,${blushOpacity})`;
  ctx.beginPath();
  ctx.ellipse(geometry.blush.left.cx, geometry.blush.left.cy, geometry.blush.left.rx, geometry.blush.left.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(geometry.blush.right.cx, geometry.blush.right.cy, geometry.blush.right.rx, geometry.blush.right.ry, 0, 0, Math.PI * 2);
  ctx.fill();

  drawAccessoriesLayer(ctx, cow, geometry);
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

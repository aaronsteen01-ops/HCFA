import type { Cow } from '../types';
import { AccessoryLibrary } from '../data/accessories';

export interface CowVisualOptions {
  scale?: number;
  offsetY?: number;
  wobble?: number;
  x?: number;
  y?: number;
  rotation?: number;
  className?: string;
  viewBox?: string;
  traits?: Partial<CowTraits>;
  animations?: {
    idleWobble?: boolean;
  };
}

export interface CowTraits {
  sleepyEyes: boolean;
  rosyCheeks: boolean;
  fancyLashes: boolean;
  raisedBrow: boolean;
}

export interface CowAnatomy {
  body: {
    centerY: number;
    rx: number;
    ry: number;
    highlightRx: number;
    highlightRy: number;
  };
  head: {
    width: number;
    height: number;
    centerY: number;
  };
  horns: {
    baseY: number;
    tipY: number;
    innerSpread: number;
    outerSpread: number;
    thickness: number;
  };
  ears: {
    baseY: number;
    width: number;
    height: number;
    tilt: number;
  };
  muzzle: {
    y: number;
    width: number;
    height: number;
    nostrilOffset: number;
  };
  hooves: {
    y: number;
    width: number;
    height: number;
    spacing: number;
  };
  eyes: {
    y: number;
    spacing: number;
    radius: number;
  };
  cheeks: {
    y: number;
    spacing: number;
    radius: number;
  };
  fringe: {
    layers: Array<{ width: number; height: number; offsetY: number }>;
    swoopDepth: number;
    bangDepth: number;
  };
}

interface CowScaleMeta {
  scale: number;
  bellyOffset: number;
  bellyStretch: number;
  chonkBoost: number;
  anatomy: CowAnatomy;
}

export interface AccessoryRenderMeta {
  anatomy: CowAnatomy;
  clipAboveHead: { y: number; height: number };
  clipPathId?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

function mixColour(base: string, withColour: string, amount: number): string {
  const a = hexToRgb(base);
  const b = hexToRgb(withColour);
  const r = Math.round(a.r + (b.r - a.r) * amount);
  const g = Math.round(a.g + (b.g - a.g) * amount);
  const bl = Math.round(a.b + (b.b - a.b) * amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function lighten(colour: string, amount: number): string {
  return mixColour(colour, '#ffffff', clamp(amount, 0, 1));
}

function darken(colour: string, amount: number): string {
  return mixColour(colour, '#000000', clamp(amount, 0, 1));
}

function toKebabCase(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function fmt(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(3)).toString() : '0';
}

const colourMap: Record<string, string> = {
  brown: '#c99364',
  cream: '#f7e5c6',
  rose: '#f5c0c8',
  chocolate: '#a4744b',
  white: '#fefefe'
};

export function colourHex(colour: string): string {
  return colourMap[colour] || colourMap.brown;
}

function accessoriesSVG(cow: Cow, meta: AccessoryRenderMeta): string {
  return (cow.accessories || [])
    .map(name => {
      const entry = AccessoryLibrary[name];
      return entry && typeof entry.svg === 'function' ? entry.svg(cow, meta) : '';
    })
    .join('');
}

function drawAccessories(
  ctx: CanvasRenderingContext2D,
  cow: Cow,
  meta: CowVisualOptions & AccessoryRenderMeta,
): void {
  (cow.accessories || []).forEach(name => {
    const entry = AccessoryLibrary[name];
    if (entry && typeof entry.draw === 'function') {
      entry.draw(ctx, cow, meta);
    } else if (entry && entry.icon) {
      ctx.save();
      const fallbackY = meta.anatomy.head.centerY - meta.anatomy.head.height * 0.4;
      ctx.translate(0, fallbackY);
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(entry.icon, 0, 0);
      ctx.restore();
    }
  });
}

function computeScale(cow: Cow, options: CowVisualOptions = {}): CowScaleMeta {
  const chonkBoost = Math.max(0, (cow.chonk || 0) - 60);
  const baseScale = options.scale || 1;
  const scale = baseScale * (1 + Math.min(0.22, chonkBoost / 160));
  const bellyOffset = Math.min(10, chonkBoost * 0.2);
  const bellyStretch = Math.min(9, chonkBoost * 0.18);

  const bodyCenterY = 28 + bellyOffset;
  const bodyRx = 40 + bellyStretch;
  const bodyRy = 28 + bellyStretch * 0.9;
  const bodyHighlightRx = 24 + bellyStretch * 0.5;
  const bodyHighlightRy = 12 + bellyStretch * 0.4;

  const headWidth = 58 + Math.min(6, chonkBoost * 0.08);
  const headHeight = 44 + Math.min(5, chonkBoost * 0.05);
  const headCenterY = -4 + Math.min(2.4, chonkBoost * 0.04);
  const headTop = headCenterY - headHeight / 2;

  const hornsThickness = 8 + Math.min(2.5, chonkBoost * 0.04);
  const hornsBaseY = headTop - 4;
  const hornsTipY = hornsBaseY - (16 + Math.min(5, chonkBoost * 0.05));
  const hornsInnerSpread = headWidth * 0.34;
  const hornsOuterSpread = headWidth * 0.74;

  const earsHeight = headHeight * 0.58;

  const anatomy: CowAnatomy = {
    body: {
      centerY: bodyCenterY,
      rx: bodyRx,
      ry: bodyRy,
      highlightRx: bodyHighlightRx,
      highlightRy: bodyHighlightRy,
    },
    head: {
      width: headWidth,
      height: headHeight,
      centerY: headCenterY,
    },
    horns: {
      baseY: hornsBaseY,
      tipY: hornsTipY,
      innerSpread: hornsInnerSpread,
      outerSpread: hornsOuterSpread,
      thickness: hornsThickness,
    },
    ears: {
      baseY: headCenterY - headHeight * 0.08,
      width: headWidth * 0.32,
      height: earsHeight,
      tilt: 0.28 + Math.min(0.12, chonkBoost / 520),
    },
    muzzle: {
      y: headCenterY + headHeight * 0.42,
      width: headWidth * 0.52,
      height: headHeight * 0.42 + Math.min(2.4, chonkBoost * 0.03),
      nostrilOffset: headWidth * 0.18,
    },
    hooves: {
      y: bodyCenterY + bodyRy - 4,
      width: 12 + Math.min(3, chonkBoost * 0.04),
      height: 8 + Math.min(3, chonkBoost * 0.03),
      spacing: 26 + Math.min(6, chonkBoost * 0.07),
    },
    eyes: {
      y: headCenterY + headHeight * 0.04,
      spacing: headWidth * 0.32,
      radius: 4.4 + Math.min(0.8, chonkBoost * 0.01),
    },
    cheeks: {
      y: headCenterY + headHeight * 0.32,
      spacing: headWidth * 0.36,
      radius: headHeight * 0.22,
    },
    fringe: {
      layers: [
        { width: headWidth * 0.98, height: headHeight * 0.7, offsetY: -headHeight * 0.1 },
        { width: headWidth * 0.86, height: headHeight * 0.54, offsetY: headHeight * 0.02 },
        { width: headWidth * 0.7, height: headHeight * 0.36, offsetY: headHeight * 0.18 },
      ],
      swoopDepth: headHeight * 0.62,
      bangDepth: headHeight * 0.32,
    },
  };

  return { scale, bellyOffset, bellyStretch, chonkBoost, anatomy };
}

function baseTraits(cow: Cow): CowTraits {
  return {
    sleepyEyes: cow.personality === 'Sleepy',
    rosyCheeks: cow.personality === 'Social' || cow.personality === 'Vain',
    fancyLashes: cow.personality === 'Vain',
    raisedBrow: cow.personality === 'Greedy',
  };
}

function resolveTraits(cow: Cow, options: CowVisualOptions): CowTraits {
  const traits = baseTraits(cow);
  if (options.traits) {
    (Object.entries(options.traits) as Array<[keyof CowTraits, boolean | undefined]>).forEach(([key, value]) => {
      if (typeof value === 'boolean') {
        traits[key] = value;
      }
    });
  }
  return traits;
}

function hornPath(anatomy: CowAnatomy, side: 'left' | 'right'): string {
  const { horns } = anatomy;
  const dir = side === 'left' ? -1 : 1;
  const baseX = dir * horns.innerSpread;
  const baseY = horns.baseY;
  const tipX = dir * horns.outerSpread;
  const tipY = horns.tipY;
  const thickness = horns.thickness;
  const upperCtrlX = dir * (horns.innerSpread + 6);
  const upperCtrlY = baseY - thickness * 1.1;
  const upperCtrl2X = dir * (horns.outerSpread - 8);
  const upperCtrl2Y = tipY - thickness * 0.6;
  const lowerCtrl1X = dir * (horns.outerSpread + 6);
  const lowerCtrl1Y = tipY + thickness * 1.2;
  const lowerCtrl2X = dir * (horns.innerSpread + 10);
  const lowerCtrl2Y = baseY + thickness * 0.8;
  const bottomY = baseY + thickness + 2;
  return `M${fmt(baseX)},${fmt(baseY)} C${fmt(upperCtrlX)},${fmt(upperCtrlY)} ${fmt(upperCtrl2X)},${fmt(upperCtrl2Y)} ${fmt(tipX)},${fmt(tipY)} C${fmt(lowerCtrl1X)},${fmt(lowerCtrl1Y)} ${fmt(lowerCtrl2X)},${fmt(lowerCtrl2Y)} ${fmt(baseX)},${fmt(bottomY)} Z`;
}

function hornHighlightPath(anatomy: CowAnatomy, side: 'left' | 'right'): string {
  const { horns } = anatomy;
  const dir = side === 'left' ? -1 : 1;
  const startX = dir * (horns.innerSpread + 3);
  const startY = horns.baseY + horns.thickness * 0.2;
  const controlX = dir * (horns.innerSpread + horns.outerSpread) * 0.5;
  const controlY = horns.tipY + horns.thickness * 0.3;
  const endX = dir * (horns.outerSpread - 2);
  const endY = horns.tipY + horns.thickness * 0.6;
  return `M${fmt(startX)},${fmt(startY)} Q${fmt(controlX)},${fmt(controlY)} ${fmt(endX)},${fmt(endY)}`;
}

function earPath(anatomy: CowAnatomy, side: 'left' | 'right'): string {
  const { ears, head } = anatomy;
  const dir = side === 'left' ? -1 : 1;
  const baseX = dir * (head.width * 0.46);
  const baseY = ears.baseY;
  const tipX = dir * (head.width * (0.76 + ears.tilt * 0.2));
  const tipY = baseY - ears.height;
  const frontCtrlX = dir * (head.width * (0.64 + ears.tilt * 0.4));
  const frontCtrlY = baseY - ears.height * 0.6;
  const rearCtrlX = dir * (head.width * 0.68);
  const rearCtrlY = baseY + ears.height * 0.18;
  const lowerX = dir * (head.width * 0.44);
  const lowerY = baseY + ears.height * 0.52;
  const innerX = dir * (head.width * 0.38);
  const innerY = baseY + ears.height * 0.22;
  return `M${fmt(baseX)},${fmt(baseY)} Q${fmt(frontCtrlX)},${fmt(frontCtrlY)} ${fmt(tipX)},${fmt(tipY)} Q${fmt(rearCtrlX)},${fmt(rearCtrlY)} ${fmt(lowerX)},${fmt(lowerY)} Q${fmt(innerX)},${fmt(innerY)} ${fmt(baseX)},${fmt(baseY)} Z`;
}

function earInnerPath(anatomy: CowAnatomy, side: 'left' | 'right'): string {
  const { ears, head } = anatomy;
  const dir = side === 'left' ? -1 : 1;
  const baseX = dir * (head.width * 0.44);
  const baseY = ears.baseY + ears.height * 0.12;
  const tipX = dir * (head.width * (0.64 + ears.tilt * 0.12));
  const tipY = baseY - ears.height * 0.72;
  const innerCtrlX = dir * (head.width * 0.52);
  const innerCtrlY = baseY + ears.height * 0.24;
  return `M${fmt(baseX)},${fmt(baseY)} Q${fmt(innerCtrlX)},${fmt(innerCtrlY)} ${fmt(tipX)},${fmt(tipY)} Q${fmt(dir * (head.width * 0.54))},${fmt(baseY + ears.height * 0.18)} ${fmt(baseX)},${fmt(baseY)} Z`;
}

function fringeLayerPath(anatomy: CowAnatomy, index: number): string {
  const layer = anatomy.fringe.layers[index];
  const centerY = anatomy.head.centerY + layer.offsetY;
  const width = layer.width;
  const height = layer.height;
  const left = -width / 2;
  const right = width / 2;
  const bottomY = centerY + height / 2;
  const topY = centerY - anatomy.fringe.swoopDepth * (0.58 - index * 0.08);
  return `M${fmt(left)},${fmt(bottomY)} C${fmt(left + width * 0.18)},${fmt(topY)} ${fmt(right - width * 0.18)},${fmt(topY)} ${fmt(right)},${fmt(bottomY)} Q0,${fmt(bottomY + height * 0.22)} ${fmt(left)},${fmt(bottomY)} Z`;
}

function fringeBangPath(anatomy: CowAnatomy): string {
  const width = anatomy.head.width * 0.94;
  const left = -width / 2;
  const right = width / 2;
  const bottomY = anatomy.head.centerY + anatomy.head.height * 0.18;
  const topY = anatomy.head.centerY - anatomy.fringe.bangDepth;
  return `M${fmt(left)},${fmt(bottomY)} Q${fmt(left * 0.4)},${fmt(topY)} 0,${fmt(topY + 6)} Q${fmt(right * 0.4)},${fmt(topY)} ${fmt(right)},${fmt(bottomY)} Z`;
}

function mouthPath(anatomy: CowAnatomy): string {
  const width = anatomy.muzzle.width * 0.5;
  const left = -width / 2;
  const right = width / 2;
  const mouthY = anatomy.muzzle.y + anatomy.muzzle.height * 0.18;
  return `M${fmt(left)},${fmt(mouthY)} Q0,${fmt(mouthY + anatomy.muzzle.height * 0.16)} ${fmt(right)},${fmt(mouthY)}`;
}

function browPath(anatomy: CowAnatomy, side: 'left' | 'right'): string {
  const dir = side === 'left' ? -1 : 1;
  const outerX = dir * (anatomy.eyes.spacing * 0.7);
  const innerX = dir * (anatomy.eyes.spacing * 0.24);
  const browY = anatomy.eyes.y - anatomy.eyes.radius * 1.8;
  return `M${fmt(outerX)},${fmt(browY)} Q${fmt(dir * (anatomy.eyes.spacing * 0.35))},${fmt(browY - 2)} ${fmt(innerX)},${fmt(browY - 0.4)}`;
}

function eyePositions(anatomy: CowAnatomy): { left: number; right: number } {
  const half = anatomy.eyes.spacing / 2;
  return { left: -half, right: half };
}

export function drawCanvas(
  ctx: CanvasRenderingContext2D,
  cow: Cow,
  options: CowVisualOptions = {}
): void {
  const { scale, anatomy } = computeScale(cow, options);
  const body = colourHex(cow.colour);
  const fringeColour = colourHex(cow.colour === 'white' ? 'cream' : cow.colour);
  const muzzleColour = lighten(body, 0.28);
  const hornColour = lighten(body, 0.4);
  const hoofColour = darken(body, 0.35);
  const earOuter = darken(fringeColour, 0.08);
  const earInner = lighten(fringeColour, 0.2);
  const fringeShadow = darken(fringeColour, 0.18);
  const fringeHighlight = lighten(fringeColour, 0.16);
  const outlineColour = darken(body, 0.2);
  const cheekColour = mixColour(fringeColour, '#f597b3', 0.55);
  const traits = resolveTraits(cow, options);
  const idleWobble = options.animations?.idleWobble !== false;
  const wobble = idleWobble ? options.wobble || 0 : 0;
  const bodyRy = anatomy.body.ry + wobble * 0.15;
  const clipTop = Math.min(anatomy.horns.tipY - 12, anatomy.head.centerY - anatomy.head.height * 0.5);
  const clipBottom = anatomy.head.centerY - anatomy.head.height * 0.05;
  const clipHeight = Math.max(0, clipBottom - clipTop);
  ctx.save();
  if (options.x || options.y) {
    ctx.translate(options.x || 0, options.y || 0);
  }
  if (options.rotation) {
    ctx.rotate(options.rotation);
  }
  ctx.scale(scale, scale);
  ctx.translate(0, options.offsetY || 0);
  // Body
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, anatomy.body.centerY, anatomy.body.rx, bodyRy, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  ctx.ellipse(
    0,
    anatomy.body.centerY + anatomy.body.ry * 0.4,
    anatomy.body.rx * 0.7,
    bodyRy * 0.5,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.ellipse(
    0,
    anatomy.body.centerY - anatomy.body.ry * 0.2,
    anatomy.body.highlightRx,
    anatomy.body.highlightRy,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // Hooves
  ctx.fillStyle = hoofColour;
  [-1, 1].forEach(direction => {
    const x = direction * anatomy.hooves.spacing * 0.5;
    ctx.beginPath();
    ctx.ellipse(x, anatomy.hooves.y, anatomy.hooves.width, anatomy.hooves.height, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(
      x,
      anatomy.hooves.y - anatomy.hooves.height * 0.25,
      anatomy.hooves.width * 0.7,
      anatomy.hooves.height * 0.45,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  });

  // Horns
  ['left', 'right'].forEach(side => {
    const path = new Path2D(hornPath(anatomy, side as 'left' | 'right'));
    ctx.fillStyle = hornColour;
    ctx.fill(path);
    ctx.strokeStyle = darken(hornColour, 0.2);
    ctx.lineWidth = 1.6;
    ctx.stroke(path);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.stroke(new Path2D(hornHighlightPath(anatomy, side as 'left' | 'right')));
  });

  // Ears
  ['left', 'right'].forEach(side => {
    const outer = new Path2D(earPath(anatomy, side as 'left' | 'right'));
    ctx.fillStyle = earOuter;
    ctx.fill(outer);
    ctx.strokeStyle = darken(earOuter, 0.12);
    ctx.lineWidth = 1.2;
    ctx.stroke(outer);
    const inner = new Path2D(earInnerPath(anatomy, side as 'left' | 'right'));
    ctx.fillStyle = earInner;
    ctx.fill(inner);
  });

  // Head base
  ctx.fillStyle = fringeColour;
  ctx.beginPath();
  ctx.ellipse(0, anatomy.head.centerY, anatomy.head.width / 2, anatomy.head.height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = fringeShadow;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Fringe layers
  anatomy.fringe.layers.forEach((_, index) => {
    const layerPath = new Path2D(fringeLayerPath(anatomy, index));
    const fill = index === 0 ? fringeColour : index === 1 ? fringeHighlight : lighten(fringeColour, 0.28);
    ctx.fillStyle = fill;
    ctx.fill(layerPath);
    ctx.strokeStyle = index === 0 ? darken(fringeShadow, 0.1) : 'rgba(53,38,77,0.08)';
    ctx.lineWidth = 1.2;
    ctx.stroke(layerPath);
  });

  const bang = new Path2D(fringeBangPath(anatomy));
  ctx.fillStyle = fringeShadow;
  ctx.fill(bang);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill(new Path2D(fringeLayerPath(anatomy, Math.min(1, anatomy.fringe.layers.length - 1))));

  // Muzzle
  ctx.fillStyle = muzzleColour;
  ctx.beginPath();
  ctx.ellipse(0, anatomy.muzzle.y, anatomy.muzzle.width / 2, anatomy.muzzle.height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = darken(muzzleColour, 0.28);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.ellipse(
    0,
    anatomy.muzzle.y - anatomy.muzzle.height * 0.2,
    anatomy.muzzle.width * 0.32,
    anatomy.muzzle.height * 0.26,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  const nostrilColour = darken(muzzleColour, 0.4);
  [-1, 1].forEach(direction => {
    const x = direction * anatomy.muzzle.nostrilOffset;
    ctx.beginPath();
    ctx.ellipse(x, anatomy.muzzle.y + anatomy.muzzle.height * 0.04, 3.2, 4.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = nostrilColour;
    ctx.fill();
  });

  ctx.strokeStyle = darken(nostrilColour, 0.1);
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.stroke(new Path2D(mouthPath(anatomy)));

  // Eyes
  const eyes = eyePositions(anatomy);
  const eyeColour = '#35264d';
  Object.values(eyes).forEach(x => {
    ctx.fillStyle = eyeColour;
    ctx.beginPath();
    ctx.arc(x, anatomy.eyes.y, anatomy.eyes.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(x - 1.2, anatomy.eyes.y - 1.4, anatomy.eyes.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  });

  if (traits.sleepyEyes) {
    ctx.strokeStyle = lighten(fringeColour, 0.25);
    ctx.lineWidth = 2.3;
    Object.values(eyes).forEach(x => {
      ctx.beginPath();
      ctx.arc(x, anatomy.eyes.y - anatomy.eyes.radius * 0.1, anatomy.eyes.radius, Math.PI * 0.1, Math.PI - Math.PI * 0.1);
      ctx.stroke();
    });
  }

  if (traits.fancyLashes) {
    ctx.strokeStyle = eyeColour;
    ctx.lineWidth = 1.3;
    Object.values(eyes).forEach(x => {
      const top = anatomy.eyes.y - anatomy.eyes.radius - 0.6;
      [[-2.2, -5], [0, -5.6], [2.2, -5]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(x + dx, top);
        ctx.lineTo(x + dx * 0.7, top + dy);
        ctx.stroke();
      });
    });
  }

  if (traits.raisedBrow) {
    ctx.strokeStyle = fringeShadow;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ['left', 'right'].forEach(side => {
      ctx.stroke(new Path2D(browPath(anatomy, side as 'left' | 'right')));
    });
  }

  if (traits.rosyCheeks) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = cheekColour;
    [-1, 1].forEach(direction => {
      const x = direction * anatomy.cheeks.spacing * 0.5;
      ctx.beginPath();
      ctx.arc(x, anatomy.cheeks.y, anatomy.cheeks.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // Outline
  ctx.strokeStyle = outlineColour;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, anatomy.body.centerY, anatomy.body.rx, bodyRy, 0, 0, Math.PI * 2);
  ctx.stroke();

  const accessoryMeta = {
    ...options,
    anatomy,
    clipAboveHead: { y: clipTop, height: clipHeight },
  } as CowVisualOptions & AccessoryRenderMeta;
  drawAccessories(ctx, cow, accessoryMeta);
  ctx.restore();
}

export function svg(cow: Cow, options: CowVisualOptions = {}): string {
  const { scale, anatomy } = computeScale(cow, options);
  const viewBox = options.viewBox || '0 0 140 120';
  const className = options.className ? ` ${options.className}` : '';
  const offsetY = options.offsetY || 0;
  const body = colourHex(cow.colour);
  const fringeColour = colourHex(cow.colour === 'white' ? 'cream' : cow.colour);
  const muzzleColour = lighten(body, 0.28);
  const hornColour = lighten(body, 0.4);
  const hoofColour = darken(body, 0.35);
  const earOuter = darken(fringeColour, 0.08);
  const earInner = lighten(fringeColour, 0.2);
  const fringeShadow = darken(fringeColour, 0.18);
  const fringeHighlight = lighten(fringeColour, 0.16);
  const outlineColour = darken(body, 0.2);
  const cheekColour = mixColour(fringeColour, '#f597b3', 0.55);
  const nostrilColour = darken(muzzleColour, 0.4);
  const traits = resolveTraits(cow, options);
  const traitClasses = Object.entries(traits)
    .filter(([, enabled]) => enabled)
    .map(([key]) => ` cow-trait-${toKebabCase(key)}`)
    .join('');
  const personalityClass = ` cow-personality-${cow.personality.toLowerCase()}`;
  const idleEnabled = options.animations?.idleWobble !== false;
  const wobble = idleEnabled ? options.wobble || 0 : 0;
  const bodyRy = anatomy.body.ry + wobble * 0.15;
  const rootGroupClass = idleEnabled ? 'cow-root-group is-idle-wobble' : 'cow-root-group';
  const idleClass = idleEnabled ? ' cow-art--idle-wobble' : '';
  const hornsLeft = hornPath(anatomy, 'left');
  const hornsRight = hornPath(anatomy, 'right');
  const hornHighlightLeft = hornHighlightPath(anatomy, 'left');
  const hornHighlightRight = hornHighlightPath(anatomy, 'right');
  const earLeft = earPath(anatomy, 'left');
  const earRight = earPath(anatomy, 'right');
  const earInnerLeft = earInnerPath(anatomy, 'left');
  const earInnerRight = earInnerPath(anatomy, 'right');
  const fringeLayers = anatomy.fringe.layers.map((_, index) => fringeLayerPath(anatomy, index));
  const fringeBang = fringeBangPath(anatomy);
  const mouth = mouthPath(anatomy);
  const eyes = eyePositions(anatomy);
  const lidBase = anatomy.eyes.y - anatomy.eyes.radius * 0.1;
  const lidPeak = lidBase - anatomy.eyes.radius * 0.8;
  const sleepyLids = traits.sleepyEyes
    ? `<path class="cow-eye-lid" d="M${fmt(eyes.left - anatomy.eyes.radius)} ${fmt(lidBase)} Q${fmt(eyes.left)} ${fmt(lidPeak)} ${fmt(eyes.left + anatomy.eyes.radius)} ${fmt(lidBase)}" stroke="${lighten(fringeColour, 0.25)}" stroke-width="2.3" fill="none" />
       <path class="cow-eye-lid" d="M${fmt(eyes.right - anatomy.eyes.radius)} ${fmt(lidBase)} Q${fmt(eyes.right)} ${fmt(lidPeak)} ${fmt(eyes.right + anatomy.eyes.radius)} ${fmt(lidBase)}" stroke="${lighten(fringeColour, 0.25)}" stroke-width="2.3" fill="none" />`
    : '';
  const lashPaths = traits.fancyLashes
    ? [-1, 1]
        .map(direction => {
          const cx = direction === -1 ? eyes.left : eyes.right;
          const base = anatomy.eyes.y - anatomy.eyes.radius - 0.6;
          return [
            `<path d="M${fmt(cx - 2.2)},${fmt(base)} L${fmt(cx - 1.54)},${fmt(base - 5)}" stroke="#35264d" stroke-width="1.3" stroke-linecap="round" fill="none" />`,
            `<path d="M${fmt(cx)},${fmt(base)} L${fmt(cx)},${fmt(base - 5.6)}" stroke="#35264d" stroke-width="1.3" stroke-linecap="round" fill="none" />`,
            `<path d="M${fmt(cx + 2.2)},${fmt(base)} L${fmt(cx + 1.54)},${fmt(base - 5)}" stroke="#35264d" stroke-width="1.3" stroke-linecap="round" fill="none" />`,
          ].join('');
        })
        .join('')
    : '';
  const browGroup = traits.raisedBrow
    ? `<g class="cow-brows" stroke="${fringeShadow}" stroke-width="1.6" stroke-linecap="round" fill="none">
         <path d="${browPath(anatomy, 'left')}" />
         <path d="${browPath(anatomy, 'right')}" />
       </g>`
    : '';
  const cheeksGroup = traits.rosyCheeks
    ? `<g class="cow-cheeks" fill="${cheekColour}" opacity="0.55">
         <circle cx="${fmt(-anatomy.cheeks.spacing * 0.5)}" cy="${fmt(anatomy.cheeks.y)}" r="${fmt(anatomy.cheeks.radius)}" />
         <circle cx="${fmt(anatomy.cheeks.spacing * 0.5)}" cy="${fmt(anatomy.cheeks.y)}" r="${fmt(anatomy.cheeks.radius)}" />
       </g>`
    : '';
  const hooves = [-1, 1]
    .map(direction => {
      const cx = fmt(direction * anatomy.hooves.spacing * 0.5);
      return `
        <g class="cow-hoof">
          <ellipse cx="${cx}" cy="${fmt(anatomy.hooves.y)}" rx="${fmt(anatomy.hooves.width)}" ry="${fmt(anatomy.hooves.height)}" fill="${hoofColour}" />
          <ellipse cx="${cx}" cy="${fmt(anatomy.hooves.y - anatomy.hooves.height * 0.25)}" rx="${fmt(anatomy.hooves.width * 0.7)}" ry="${fmt(anatomy.hooves.height * 0.45)}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.1" />
        </g>`;
    })
    .join('');
  const sanitizedId = (cow.id || 'cow')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');
  const clipId = `cow-accessory-clip-${sanitizedId}`;
  const clipTop = Math.min(anatomy.horns.tipY - 12, anatomy.head.centerY - anatomy.head.height * 0.5);
  const clipBottom = anatomy.head.centerY - anatomy.head.height * 0.05;
  const clipHeight = Math.max(0.1, clipBottom - clipTop);
  const accessoryMeta = {
    anatomy,
    clipAboveHead: { y: clipTop, height: clipHeight },
    clipPathId: clipId,
  } as AccessoryRenderMeta;
  const accessories = accessoriesSVG(cow, accessoryMeta);

  return `
          <svg class="cow-art${className}${personalityClass}${traitClasses}${idleClass}" viewBox="${viewBox}" role="img" aria-label="${cow.name} the cow">
            <defs>
              <clipPath id="${clipId}">
                <rect x="-160" y="${fmt(clipTop)}" width="320" height="${fmt(clipHeight)}" />
              </clipPath>
            </defs>
            <g transform="translate(70 ${60 + offsetY}) scale(${scale.toFixed(3)})">
              <g class="${rootGroupClass}">
                <g class="cow-body">
                  <ellipse class="cow-body-fill" cx="0" cy="${fmt(anatomy.body.centerY)}" rx="${fmt(anatomy.body.rx)}" ry="${fmt(bodyRy)}" fill="${body}" />
                  <ellipse class="cow-body-highlight" cx="0" cy="${fmt(anatomy.body.centerY - anatomy.body.ry * 0.2)}" rx="${fmt(anatomy.body.highlightRx)}" ry="${fmt(anatomy.body.highlightRy)}" fill="rgba(255,255,255,0.16)" />
                  <ellipse class="cow-body-shade" cx="0" cy="${fmt(anatomy.body.centerY + anatomy.body.ry * 0.4)}" rx="${fmt(anatomy.body.rx * 0.7)}" ry="${fmt(bodyRy * 0.5)}" fill="rgba(0,0,0,0.08)" />
                  <ellipse class="cow-body-outline" cx="0" cy="${fmt(anatomy.body.centerY)}" rx="${fmt(anatomy.body.rx)}" ry="${fmt(bodyRy)}" fill="none" stroke="${outlineColour}" stroke-width="2.2" />
                </g>
                <g class="cow-hooves">
                  ${hooves}
                </g>
                <g class="cow-horns">
                  <path d="${hornsLeft}" fill="${hornColour}" stroke="${darken(hornColour, 0.2)}" stroke-width="1.6" />
                  <path d="${hornsRight}" fill="${hornColour}" stroke="${darken(hornColour, 0.2)}" stroke-width="1.6" />
                  <path d="${hornHighlightLeft}" stroke="rgba(255,255,255,0.45)" stroke-width="1.4" stroke-linecap="round" fill="none" />
                  <path d="${hornHighlightRight}" stroke="rgba(255,255,255,0.45)" stroke-width="1.4" stroke-linecap="round" fill="none" />
                </g>
                <g class="cow-ears">
                  <path d="${earLeft}" fill="${earOuter}" stroke="${darken(earOuter, 0.12)}" stroke-width="1.2" />
                  <path d="${earRight}" fill="${earOuter}" stroke="${darken(earOuter, 0.12)}" stroke-width="1.2" />
                  <path d="${earInnerLeft}" fill="${earInner}" />
                  <path d="${earInnerRight}" fill="${earInner}" />
                </g>
                <g class="cow-head">
                  <ellipse cx="0" cy="${fmt(anatomy.head.centerY)}" rx="${fmt(anatomy.head.width / 2)}" ry="${fmt(anatomy.head.height / 2)}" fill="${fringeColour}" stroke="${fringeShadow}" stroke-width="1.4" />
                  <path class="cow-fringe-layer" d="${fringeLayers[0]}" fill="${fringeColour}" stroke="${darken(fringeShadow, 0.1)}" stroke-width="1.2" />
                  <path class="cow-fringe-layer" d="${fringeLayers[1]}" fill="${fringeHighlight}" stroke="rgba(53,38,77,0.08)" stroke-width="1.2" />
                  <path class="cow-fringe-layer" d="${fringeLayers[2]}" fill="${lighten(fringeColour, 0.28)}" stroke="rgba(53,38,77,0.08)" stroke-width="1" />
                  <path class="cow-fringe-bang" d="${fringeBang}" fill="${fringeShadow}" />
                </g>
                <g class="cow-muzzle">
                  <ellipse cx="0" cy="${fmt(anatomy.muzzle.y)}" rx="${fmt(anatomy.muzzle.width / 2)}" ry="${fmt(anatomy.muzzle.height / 2)}" fill="${muzzleColour}" stroke="${darken(muzzleColour, 0.28)}" stroke-width="1.2" />
                  <ellipse cx="0" cy="${fmt(anatomy.muzzle.y - anatomy.muzzle.height * 0.2)}" rx="${fmt(anatomy.muzzle.width * 0.32)}" ry="${fmt(anatomy.muzzle.height * 0.26)}" fill="rgba(255,255,255,0.22)" />
                  <ellipse cx="${fmt(-anatomy.muzzle.nostrilOffset)}" cy="${fmt(anatomy.muzzle.y + anatomy.muzzle.height * 0.04)}" rx="3.2" ry="4.6" fill="${nostrilColour}" />
                  <ellipse cx="${fmt(anatomy.muzzle.nostrilOffset)}" cy="${fmt(anatomy.muzzle.y + anatomy.muzzle.height * 0.04)}" rx="3.2" ry="4.6" fill="${nostrilColour}" />
                  <path d="${mouth}" stroke="${darken(nostrilColour, 0.1)}" stroke-width="1.6" stroke-linecap="round" fill="none" />
                </g>
                <g class="cow-eyes">
                  <circle cx="${fmt(eyes.left)}" cy="${fmt(anatomy.eyes.y)}" r="${fmt(anatomy.eyes.radius)}" fill="#35264d" />
                  <circle cx="${fmt(eyes.right)}" cy="${fmt(anatomy.eyes.y)}" r="${fmt(anatomy.eyes.radius)}" fill="#35264d" />
                  <circle cx="${fmt(eyes.left - 1.2)}" cy="${fmt(anatomy.eyes.y - 1.4)}" r="${fmt(anatomy.eyes.radius * 0.35)}" fill="rgba(255,255,255,0.4)" />
                  <circle cx="${fmt(eyes.right - 1.2)}" cy="${fmt(anatomy.eyes.y - 1.4)}" r="${fmt(anatomy.eyes.radius * 0.35)}" fill="rgba(255,255,255,0.4)" />
                  ${sleepyLids}
                  ${lashPaths}
                </g>
                ${cheeksGroup}
                ${browGroup}
                ${accessories}
              </g>
            </g>
          </svg>`;
}

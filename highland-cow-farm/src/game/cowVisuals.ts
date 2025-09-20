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

function accessoriesSVG(cow: Cow): string {
  return (cow.accessories || [])
    .map(name => {
      const entry = AccessoryLibrary[name];
      return entry && typeof entry.svg === 'function' ? entry.svg(cow) : '';
    })
    .join('');
}

function drawAccessories(ctx: CanvasRenderingContext2D, cow: Cow, meta: CowVisualOptions): void {
  (cow.accessories || []).forEach(name => {
    const entry = AccessoryLibrary[name];
    if (entry && typeof entry.draw === 'function') {
      entry.draw(ctx, cow, meta);
    } else if (entry && entry.icon) {
      ctx.save();
      ctx.translate(0, -26);
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(entry.icon, 0, 0);
      ctx.restore();
    }
  });
}

function computeScale(cow: Cow, options: CowVisualOptions = {}) {
  const chonkBoost = Math.max(0, (cow.chonk || 0) - 60);
  const baseScale = options.scale || 1;
  const scale = baseScale * (1 + Math.min(0.22, chonkBoost / 160));
  const bellyOffset = Math.min(10, chonkBoost * 0.2);
  const bellyStretch = Math.min(9, chonkBoost * 0.18);
  return { scale, bellyOffset, bellyStretch, chonkBoost };
}

export function drawCanvas(
  ctx: CanvasRenderingContext2D,
  cow: Cow,
  options: CowVisualOptions = {}
): void {
  const { scale, bellyOffset, bellyStretch } = computeScale(cow, options);
  const body = colourHex(cow.colour);
  const fringeColour = colourHex(cow.colour === 'white' ? 'cream' : cow.colour);
  const wobble = options.wobble || 0;
  ctx.save();
  if (options.x || options.y) {
    ctx.translate(options.x || 0, options.y || 0);
  }
  if (options.rotation) {
    ctx.rotate(options.rotation);
  }
  ctx.scale(scale, scale);
  ctx.translate(0, options.offsetY || 0);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 28 + bellyOffset, 40 + bellyStretch, 28 + bellyStretch * 0.9 + wobble * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 28 + bellyOffset, 24 + bellyStretch * 0.5, 12 + bellyStretch * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = body;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-28, -6);
  ctx.quadraticCurveTo(-58, -26, -34, -38);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(28, -6);
  ctx.quadraticCurveTo(58, -26, 34, -38);
  ctx.stroke();
  ctx.fillStyle = fringeColour;
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-20, -10);
  ctx.quadraticCurveTo(0, -26, 20, -10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#35264d';
  ctx.beginPath();
  ctx.arc(-12, -2, 4, 0, Math.PI * 2);
  ctx.arc(12, -2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 12, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  drawAccessories(ctx, cow, options);
  ctx.restore();
}

export function svg(cow: Cow, options: CowVisualOptions = {}): string {
  const { scale, bellyOffset, bellyStretch } = computeScale(cow, options);
  const viewBox = options.viewBox || '0 0 140 120';
  const className = options.className ? ` ${options.className}` : '';
  const offsetY = options.offsetY || 0;
  const body = colourHex(cow.colour);
  const fringeColour = colourHex(cow.colour === 'white' ? 'cream' : cow.colour);
  return `
          <svg class="cow-art${className}" viewBox="${viewBox}" role="img" aria-label="${cow.name} the cow">
            <g transform="translate(70 ${60 + offsetY}) scale(${scale.toFixed(3)})">
              <ellipse cx="0" cy="${28 + bellyOffset}" rx="${40 + bellyStretch}" ry="${28 + bellyStretch * 0.9}" fill="${body}" />
              <ellipse cx="0" cy="${28 + bellyOffset}" rx="${24 + bellyStretch * 0.5}" ry="${12 + bellyStretch * 0.4}" fill="rgba(255,255,255,0.16)" />
              <path d="M-28,-6 Q-58,-26 -34,-38" stroke="${body}" stroke-width="8" stroke-linecap="round" fill="none" />
              <path d="M28,-6 Q58,-26 34,-38" stroke="${body}" stroke-width="8" stroke-linecap="round" fill="none" />
              <ellipse cx="0" cy="0" rx="30" ry="26" fill="${fringeColour}" />
              <path d="M-20,-10 Q0,-26 20,-10" fill="${fringeColour}" />
              <circle cx="-12" cy="-2" r="4" fill="#35264d" />
              <circle cx="12" cy="-2" r="4" fill="#35264d" />
              <ellipse cx="0" cy="12" rx="8" ry="10" fill="#35264d" />
              ${accessoriesSVG(cow)}
            </g>
          </svg>`;
}

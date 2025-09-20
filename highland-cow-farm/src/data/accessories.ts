import type { Cow } from '../types';
import type { AccessoryRenderMeta, CowVisualOptions } from '../game/cowVisuals';

const fmt = (value: number): string => (Number.isFinite(value) ? Number(value.toFixed(3)).toString() : '0');

function withClip(ctx: CanvasRenderingContext2D, meta: AccessoryRenderMeta | undefined, draw: () => void) {
  ctx.save();
  if (meta?.clipAboveHead && meta.clipAboveHead.height > 0) {
    ctx.beginPath();
    ctx.rect(-220, meta.clipAboveHead.y, 440, meta.clipAboveHead.height);
    ctx.clip();
  }
  draw();
  ctx.restore();
}

function clipAttribute(meta: AccessoryRenderMeta | undefined): string {
  return meta?.clipPathId ? ` clip-path="url(#${meta.clipPathId})"` : '';
}

export interface AccessoryEntry {
  icon: string;
  description: string;
  svg?: (cow?: Cow, meta?: AccessoryRenderMeta) => string;
  draw?: (ctx: CanvasRenderingContext2D, cow?: Cow, meta?: AccessoryRenderMeta & CowVisualOptions) => void;
}

export const AccessoryLibrary: Record<string, AccessoryEntry> = {
  'Pastel Bow': {
    icon: '🎀',
    description: 'A soft ribbon tied neatly near the fringe.',
    svg: (_cow, meta) => {
      const anatomy = meta?.anatomy;
      const x = anatomy ? -anatomy.head.width * 0.36 : -20;
      const y = anatomy ? anatomy.horns.baseY + anatomy.horns.thickness * 1.1 : -18;
      return `
          <g class="acc acc-bow"${clipAttribute(meta)} transform="translate(${fmt(x)} ${fmt(y)})">
            <ellipse cx="-6" cy="-2" rx="6" ry="8" fill="#f7c1d8" />
            <ellipse cx="6" cy="-2" rx="6" ry="8" fill="#f7c1d8" />
            <circle cx="0" cy="-2" r="3.4" fill="#f38aad" />
          </g>`;
    },
    draw: (ctx, _cow, meta) => {
      const anatomy = meta?.anatomy;
      const x = anatomy ? -anatomy.head.width * 0.36 : -20;
      const y = anatomy ? anatomy.horns.baseY + anatomy.horns.thickness * 1.1 : -18;
      withClip(ctx, meta, () => {
        ctx.translate(x, y);
        ctx.fillStyle = '#f7c1d8';
        ctx.beginPath();
        ctx.ellipse(-6, -2, 6, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(6, -2, 6, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f38aad';
        ctx.beginPath();
        ctx.arc(0, -2, 3.4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  },
  'Bell Charm': {
    icon: '🔔',
    description: 'A gentle bell that jingles as the cow trots.',
    svg: (_cow, meta) => {
      const anatomy = meta?.anatomy;
      const y = anatomy ? anatomy.muzzle.y + anatomy.muzzle.height * 0.95 : 14;
      return `
          <g class="acc acc-bell" transform="translate(0,${fmt(y)})">
            <path d="M-6 0 Q0 -8 6 0 V4 H-6 Z" fill="#f4d38b" stroke="#d6a442" stroke-width="1" />
            <circle cx="0" cy="3" r="1.8" fill="#d6a442" />
          </g>`;
    },
    draw: (ctx, _cow, meta) => {
      const anatomy = meta?.anatomy;
      const y = anatomy ? anatomy.muzzle.y + anatomy.muzzle.height * 0.95 : 14;
      ctx.save();
      ctx.translate(0, y);
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.quadraticCurveTo(0, -8, 6, 0);
      ctx.lineTo(6, 4);
      ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fillStyle = '#f4d38b';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#d6a442';
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = '#d6a442';
      ctx.arc(0, 3, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },
  'Sun Hat': {
    icon: '👒',
    description: 'A straw hat to keep the Highland sun at bay.',
    svg: (_cow, meta) => {
      const anatomy = meta?.anatomy;
      const y = anatomy ? anatomy.horns.tipY + anatomy.horns.thickness * 0.6 : -34;
      const scaleX = anatomy ? anatomy.head.width / 56 : 1;
      const transform = `translate(0,${fmt(y)})${scaleX !== 1 ? ` scale(${fmt(scaleX)} 1)` : ''}`;
      return `
          <g class="acc acc-hat"${clipAttribute(meta)} transform="${transform}">
            <ellipse cx="0" cy="0" rx="28" ry="10" fill="#f3d9a4" stroke="#d6a067" stroke-width="1.4" />
            <ellipse cx="0" cy="-6" rx="18" ry="10" fill="#f8e7bf" stroke="#d6a067" stroke-width="1.2" />
            <path d="M-12 -4 Q0 -10 12 -4" stroke="#f2a9b7" stroke-width="3" fill="none" />
          </g>`;
    },
    draw: (ctx, _cow, meta) => {
      const anatomy = meta?.anatomy;
      const y = anatomy ? anatomy.horns.tipY + anatomy.horns.thickness * 0.6 : -34;
      const scaleX = anatomy ? anatomy.head.width / 56 : 1;
      withClip(ctx, meta, () => {
        ctx.translate(0, y);
        if (scaleX !== 1) {
          ctx.scale(scaleX, 1);
        }
        ctx.fillStyle = '#f3d9a4';
        ctx.strokeStyle = '#d6a067';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(0, 0, 28, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8e7bf';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, -6, 18, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = '#f2a9b7';
        ctx.lineWidth = 3;
        ctx.moveTo(-12, -4);
        ctx.quadraticCurveTo(0, -10, 12, -4);
        ctx.stroke();
      });
    }
  },
  'Fern Garland': {
    icon: '🌿',
    description: 'Braided fern fronds draped across the horns.',
    svg: (_cow, meta) => {
      const anatomy = meta?.anatomy;
      const y = anatomy ? anatomy.horns.baseY + anatomy.horns.thickness * 0.4 : -18;
      const scaleX = anatomy ? anatomy.horns.outerSpread / 34 : 1;
      const transform = `translate(0,${fmt(y)})${scaleX !== 1 ? ` scale(${fmt(scaleX)} 1)` : ''}`;
      return `
          <g class="acc acc-fern"${clipAttribute(meta)} transform="${transform}">
            <path d="M-34 -4 Q-12 -12 0 -6 T34 -4" fill="none" stroke="#7fb991" stroke-width="4" stroke-linecap="round" />
            <path d="M-24 -6 l-3 -6 l5 2 z" fill="#6aa67d" />
            <path d="M-12 -10 l-3 -6 l5 2 z" fill="#6aa67d" />
            <path d="M12 -10 l3 -6 l-5 2 z" fill="#6aa67d" />
            <path d="M24 -6 l3 -6 l-5 2 z" fill="#6aa67d" />
          </g>`;
    },
    draw: (ctx, _cow, meta) => {
      const anatomy = meta?.anatomy;
      const y = anatomy ? anatomy.horns.baseY + anatomy.horns.thickness * 0.4 : -18;
      const scaleX = anatomy ? anatomy.horns.outerSpread / 34 : 1;
      withClip(ctx, meta, () => {
        ctx.translate(0, y);
        if (scaleX !== 1) {
          ctx.scale(scaleX, 1);
        }
        ctx.strokeStyle = '#7fb991';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-34, -4);
        ctx.quadraticCurveTo(-12, -12, 0, -6);
        ctx.quadraticCurveTo(12, -0, 34, -4);
        ctx.stroke();
        ctx.fillStyle = '#6aa67d';
        const leaves = [
          { x: -24, y: -6 },
          { x: -12, y: -10 },
          { x: 12, y: -10 },
          { x: 24, y: -6 }
        ];
        leaves.forEach(({ x, y }) => {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 3, y - 6);
          ctx.lineTo(x + 2, y - 4);
          ctx.closePath();
          ctx.fill();
        });
      });
    }
  },
  'Starry Bandana': {
    icon: '🧣',
    description: 'A midnight blue bandana dotted with stars.',
    svg: (_cow, meta) => {
      const anatomy = meta?.anatomy;
      const y = anatomy ? anatomy.muzzle.y + anatomy.muzzle.height * 0.55 : 12;
      const scaleX = anatomy ? anatomy.head.width / 44 : 1;
      const transform = `translate(0,${fmt(y)})${scaleX !== 1 ? ` scale(${fmt(scaleX)} 1)` : ''}`;
      return `
          <g class="acc acc-bandana" transform="${transform}">
            <path d="M-22 -2 L0 10 L22 -2 Z" fill="#3b3b7d" stroke="#272757" stroke-width="1.2" />
            <circle cx="-10" cy="2" r="1.5" fill="#f7e27d" />
            <circle cx="0" cy="4" r="1.2" fill="#f7e27d" />
            <circle cx="10" cy="2" r="1.5" fill="#f7e27d" />
          </g>`;
    },
    draw: (ctx, _cow, meta) => {
      const anatomy = meta?.anatomy;
      const y = anatomy ? anatomy.muzzle.y + anatomy.muzzle.height * 0.55 : 12;
      const scaleX = anatomy ? anatomy.head.width / 44 : 1;
      ctx.save();
      ctx.translate(0, y);
      if (scaleX !== 1) {
        ctx.scale(scaleX, 1);
      }
      ctx.beginPath();
      ctx.moveTo(-22, -2);
      ctx.lineTo(0, 10);
      ctx.lineTo(22, -2);
      ctx.closePath();
      ctx.fillStyle = '#3b3b7d';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#272757';
      ctx.stroke();
      ctx.fillStyle = '#f7e27d';
      [[-10, 2, 1.5], [0, 4, 1.2], [10, 2, 1.5]].forEach(([x, y, r]) => {
        ctx.beginPath();
        ctx.arc(x as number, y as number, r as number, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }
  },
  'Woolly Scarf': {
    icon: '🧶',
    description: 'A cosy knitted scarf for brisk mornings.',
    svg: (_cow, meta) => {
      const anatomy = meta?.anatomy;
      const y = anatomy ? anatomy.muzzle.y + anatomy.muzzle.height * 0.82 : 18;
      const scaleX = anatomy ? anatomy.head.width / 52 : 1;
      const transform = `translate(0,${fmt(y)})${scaleX !== 1 ? ` scale(${fmt(scaleX)} 1)` : ''}`;
      return `
          <g class="acc acc-scarf" transform="${transform}">
            <path d="M-26 -6 Q0 6 26 -6 L22 6 Q0 16 -22 6 Z" fill="#f2a9b7" stroke="#c97a8a" stroke-width="1.2" />
            <path d="M-6 -4 V12" stroke="#c97a8a" stroke-width="3" stroke-linecap="round" />
            <path d="M6 -4 V12" stroke="#c97a8a" stroke-width="3" stroke-linecap="round" />
          </g>`;
    },
    draw: (ctx, _cow, meta) => {
      const anatomy = meta?.anatomy;
      const y = anatomy ? anatomy.muzzle.y + anatomy.muzzle.height * 0.82 : 18;
      const scaleX = anatomy ? anatomy.head.width / 52 : 1;
      ctx.save();
      ctx.translate(0, y);
      if (scaleX !== 1) {
        ctx.scale(scaleX, 1);
      }
      ctx.beginPath();
      ctx.moveTo(-26, -6);
      ctx.quadraticCurveTo(0, 6, 26, -6);
      ctx.lineTo(22, 6);
      ctx.quadraticCurveTo(0, 16, -22, 6);
      ctx.closePath();
      ctx.fillStyle = '#f2a9b7';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#c97a8a';
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.lineTo(-6, 12);
      ctx.moveTo(6, -4);
      ctx.lineTo(6, 12);
      ctx.stroke();
      ctx.restore();
    }
  },
  'Thistle Crown': {
    icon: '🌸',
    description: 'Highland thistles woven into a proud little crown.',
    svg: (_cow, meta) => {
      const anatomy = meta?.anatomy;
      const y = anatomy ? anatomy.horns.baseY - anatomy.horns.thickness * 0.2 : -26;
      const scaleX = anatomy ? anatomy.horns.outerSpread / 26 : 1;
      const transform = `translate(0,${fmt(y)})${scaleX !== 1 ? ` scale(${fmt(scaleX)} 1)` : ''}`;
      return `
          <g class="acc acc-thistle"${clipAttribute(meta)} transform="${transform}">
            <path d="M-26 -4 Q0 -10 26 -4" fill="none" stroke="#7fb991" stroke-width="3" stroke-linecap="round" />
            <circle cx="-16" cy="-8" r="4" fill="#c181d8" />
            <circle cx="0" cy="-12" r="4.5" fill="#b56ccc" />
            <circle cx="16" cy="-8" r="4" fill="#c181d8" />
            <path d="M-16 -8 l-2 -6" stroke="#7fb991" stroke-width="2" />
            <path d="M0 -12 l-2 -6" stroke="#7fb991" stroke-width="2" />
            <path d="M16 -8 l2 -6" stroke="#7fb991" stroke-width="2" />
          </g>`;
    },
    draw: (ctx, _cow, meta) => {
      const anatomy = meta?.anatomy;
      const y = anatomy ? anatomy.horns.baseY - anatomy.horns.thickness * 0.2 : -26;
      const scaleX = anatomy ? anatomy.horns.outerSpread / 26 : 1;
      withClip(ctx, meta, () => {
        ctx.translate(0, y);
        if (scaleX !== 1) {
          ctx.scale(scaleX, 1);
        }
        ctx.strokeStyle = '#7fb991';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-26, -4);
        ctx.quadraticCurveTo(0, -10, 26, -4);
        ctx.stroke();
        const blooms = [
          { x: -16, y: -8, r: 4, colour: '#c181d8' },
          { x: 0, y: -12, r: 4.5, colour: '#b56ccc' },
          { x: 16, y: -8, r: 4, colour: '#c181d8' }
        ];
        blooms.forEach(({ x, y, r, colour }) => {
          ctx.beginPath();
          ctx.fillStyle = colour;
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.lineWidth = 2;
          ctx.moveTo(x, y);
          ctx.lineTo(x + (x === 0 ? -2 : Math.sign(x) * -2), y - 6);
          ctx.strokeStyle = '#7fb991';
          ctx.stroke();
        });
      });
    }
  }
};

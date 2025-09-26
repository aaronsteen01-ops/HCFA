import type { CowColour } from '../types';

export interface Point {
  x: number;
  y: number;
}

export interface SpriteLayer {
  id: string;
  src: string;
  width: number;
  height: number;
  anchor?: Point;
  offset?: Point;
  opacity?: number;
  scale?: number;
  zIndex?: number;
  className?: string;
}

export interface EyeLayers {
  open: SpriteLayer;
  half?: SpriteLayer;
  closed: SpriteLayer;
}

export interface CowPoseAssets {
  layers: SpriteLayer[];
  eyes: EyeLayers;
}

export interface CowSpriteDefinition {
  colour: CowColour;
  size: { width: number; height: number };
  anchor: Point;
  poses: Record<'idle' | 'walk', CowPoseAssets>;
}

export interface AccessorySpriteDefinition {
  name: string;
  src: string;
  width: number;
  height: number;
  anchor: Point;
  placement: keyof typeof ACCESSORY_ANCHORS;
  offset?: Point;
  scale?: number;
  zIndex?: number;
  className?: string;
}

export const COW_TEXTURE_SIZE = 768;
export const COW_ANCHOR: Point = { x: 512, y: 512 };

export const ACCESSORY_ANCHORS = {
  head: { x: 384, y: 285 },
  neck: { x: 384, y: 495 },
  back: { x: 384, y: 450 },
  leftEar: { x: 255, y: 330 },
  rightEar: { x: 510, y: 330 }
} as const;

type CowAssetSet = {
  base: string;
  shadow: string;
  eyesOpen: string;
  eyesHalf: string;
  eyesClosed: string;
};

function createCowDefinition(colour: CowColour, assets: CowAssetSet): CowSpriteDefinition {
  const anchor = COW_ANCHOR;
  const size = { width: COW_TEXTURE_SIZE, height: COW_TEXTURE_SIZE };
  const baseLayers: SpriteLayer[] = [
    {
      id: `${colour}-shadow`,
      src: assets.shadow,
      width: size.width,
      height: size.height,
      anchor,
      className: 'cow-shadow',
      zIndex: -20,
      opacity: 0.85
    },
    {
      id: `${colour}-base`,
      src: assets.base,
      width: size.width,
      height: size.height,
      anchor,
      className: 'cow-base',
      zIndex: 0
    }
  ];
  const eyes: EyeLayers = {
    open: {
      id: `${colour}-eyes-open`,
      src: assets.eyesOpen,
      width: size.width,
      height: size.height,
      anchor,
      className: 'eyes-open',
      zIndex: 10
    },
    half: {
      id: `${colour}-eyes-half`,
      src: assets.eyesHalf,
      width: size.width,
      height: size.height,
      anchor,
      className: 'eyes-half',
      zIndex: 10
    },
    closed: {
      id: `${colour}-eyes-closed`,
      src: assets.eyesClosed,
      width: size.width,
      height: size.height,
      anchor,
      className: 'eyes-closed',
      zIndex: 10
    }
  };

  const pose: CowPoseAssets = {
    layers: baseLayers,
    eyes
  };

  return {
    colour,
    size,
    anchor,
    poses: {
      idle: pose,
      walk: pose
    }
  };
}

import brownBase from '../assets/cows/brown_idle_base.png';
import brownShadow from '../assets/cows/brown_shadow.png';
import brownEyesOpen from '../assets/cows/brown_eyes_open.png';
import brownEyesHalf from '../assets/cows/brown_eyes_half.png';
import brownEyesClosed from '../assets/cows/brown_eyes_closed.png';

import creamBase from '../assets/cows/cream_idle_base.png';
import creamShadow from '../assets/cows/cream_shadow.png';
import creamEyesOpen from '../assets/cows/cream_eyes_open.png';
import creamEyesHalf from '../assets/cows/cream_eyes_half.png';
import creamEyesClosed from '../assets/cows/cream_eyes_closed.png';

import roseBase from '../assets/cows/rose_idle_base.png';
import roseShadow from '../assets/cows/rose_shadow.png';
import roseEyesOpen from '../assets/cows/rose_eyes_open.png';
import roseEyesHalf from '../assets/cows/rose_eyes_half.png';
import roseEyesClosed from '../assets/cows/rose_eyes_closed.png';

import chocolateBase from '../assets/cows/chocolate_idle_base.png';
import chocolateShadow from '../assets/cows/chocolate_shadow.png';
import chocolateEyesOpen from '../assets/cows/chocolate_eyes_open.png';
import chocolateEyesHalf from '../assets/cows/chocolate_eyes_half.png';
import chocolateEyesClosed from '../assets/cows/chocolate_eyes_closed.png';

import whiteBase from '../assets/cows/white_idle_base.png';
import whiteShadow from '../assets/cows/white_shadow.png';
import whiteEyesOpen from '../assets/cows/white_eyes_open.png';
import whiteEyesHalf from '../assets/cows/white_eyes_half.png';
import whiteEyesClosed from '../assets/cows/white_eyes_closed.png';

const cowAssets: Record<CowColour, CowAssetSet> = {
  brown: {
    base: brownBase,
    shadow: brownShadow,
    eyesOpen: brownEyesOpen,
    eyesHalf: brownEyesHalf,
    eyesClosed: brownEyesClosed
  },
  cream: {
    base: creamBase,
    shadow: creamShadow,
    eyesOpen: creamEyesOpen,
    eyesHalf: creamEyesHalf,
    eyesClosed: creamEyesClosed
  },
  rose: {
    base: roseBase,
    shadow: roseShadow,
    eyesOpen: roseEyesOpen,
    eyesHalf: roseEyesHalf,
    eyesClosed: roseEyesClosed
  },
  chocolate: {
    base: chocolateBase,
    shadow: chocolateShadow,
    eyesOpen: chocolateEyesOpen,
    eyesHalf: chocolateEyesHalf,
    eyesClosed: chocolateEyesClosed
  },
  white: {
    base: whiteBase,
    shadow: whiteShadow,
    eyesOpen: whiteEyesOpen,
    eyesHalf: whiteEyesHalf,
    eyesClosed: whiteEyesClosed
  }
};

export const COW_SPRITES: Record<CowColour, CowSpriteDefinition> = {
  brown: createCowDefinition('brown', cowAssets.brown),
  cream: createCowDefinition('cream', cowAssets.cream),
  rose: createCowDefinition('rose', cowAssets.rose),
  chocolate: createCowDefinition('chocolate', cowAssets.chocolate),
  white: createCowDefinition('white', cowAssets.white)
};

import bowPink from '../assets/accessories/bow_pink.png';
import sunHat from '../assets/accessories/sun_hat.png';
import flowerCrown from '../assets/accessories/flower_crown.png';
import bellCharm from '../assets/accessories/bell_charm.png';
import fernGarland from '../assets/accessories/fern_garland.png';
import starryBandana from '../assets/accessories/starry_bandana.png';
import woollyScarf from '../assets/accessories/woolly_scarf.png';

const DEFAULT_ACCESSORY_ANCHOR: Point = { x: 128, y: 256 };

export const ACCESSORY_SPRITES: Record<string, AccessorySpriteDefinition> = {
  bow_pink: {
    name: 'bow_pink',
    src: bowPink,
    width: 256,
    height: 256,
    anchor: DEFAULT_ACCESSORY_ANCHOR,
    placement: 'leftEar',
    offset: { x: -48, y: -110 },
    scale: 0.72,
    zIndex: 30,
    className: 'bow'
  },
  sun_hat: {
    name: 'sun_hat',
    src: sunHat,
    width: 256,
    height: 256,
    anchor: DEFAULT_ACCESSORY_ANCHOR,
    placement: 'head',
    offset: { x: 0, y: -140 },
    scale: 1.22,
    zIndex: 28,
    className: 'sun-hat'
  },
  flower_crown: {
    name: 'flower_crown',
    src: flowerCrown,
    width: 256,
    height: 256,
    anchor: DEFAULT_ACCESSORY_ANCHOR,
    placement: 'head',
    offset: { x: 0, y: -160 },
    scale: 1.08,
    zIndex: 26,
    className: 'flower-crown'
  },
  bell_charm: {
    name: 'bell_charm',
    src: bellCharm,
    width: 256,
    height: 256,
    anchor: DEFAULT_ACCESSORY_ANCHOR,
    placement: 'neck',
    offset: { x: 0, y: -20 },
    scale: 0.62,
    zIndex: 24,
    className: 'bell'
  },
  fern_garland: {
    name: 'fern_garland',
    src: fernGarland,
    width: 256,
    height: 256,
    anchor: DEFAULT_ACCESSORY_ANCHOR,
    placement: 'head',
    offset: { x: 0, y: -130 },
    scale: 1.05,
    zIndex: 25,
    className: 'fern-garland'
  },
  starry_bandana: {
    name: 'starry_bandana',
    src: starryBandana,
    width: 256,
    height: 256,
    anchor: DEFAULT_ACCESSORY_ANCHOR,
    placement: 'neck',
    offset: { x: 0, y: -12 },
    scale: 0.92,
    zIndex: 23,
    className: 'bandana'
  },
  woolly_scarf: {
    name: 'woolly_scarf',
    src: woollyScarf,
    width: 256,
    height: 256,
    anchor: DEFAULT_ACCESSORY_ANCHOR,
    placement: 'neck',
    offset: { x: 0, y: -8 },
    scale: 1.02,
    zIndex: 23,
    className: 'scarf'
  }
};

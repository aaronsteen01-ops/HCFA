export interface AccessoryEntry {
  icon: string;
  description: string;
  aliasFor?: string;
}

const baseAccessories: Record<string, AccessoryEntry> = {
  bow_pink: {
    icon: '🎀',
    description: 'Bubblegum ribbon pinned beside the fringe.'
  },
  sun_hat: {
    icon: '👒',
    description: 'Straw sun hat with a pink band for bright paddock days.'
  },
  flower_crown: {
    icon: '🌸',
    description: 'Pastel daisies, cosmos and forget-me-nots woven together.'
  },
  bell_charm: {
    icon: '🔔',
    description: 'Polished bell with a silky ribbon that chimes softly.'
  },
  fern_garland: {
    icon: '🌿',
    description: 'Fern sprigs tucked gracefully along the horns.'
  },
  starry_bandana: {
    icon: '🧣',
    description: 'Midnight bandana speckled with friendly constellations.'
  },
  woolly_scarf: {
    icon: '🧶',
    description: 'Chunky-knit scarf for crisp Highland mornings.'
  }
};

const aliasEntries: Record<string, AccessoryEntry> = {
  'Pastel Bow': { ...baseAccessories.bow_pink, aliasFor: 'bow_pink' },
  'Sun Hat': { ...baseAccessories.sun_hat, aliasFor: 'sun_hat' },
  'Flower Crown': { ...baseAccessories.flower_crown, aliasFor: 'flower_crown' },
  'Thistle Crown': { ...baseAccessories.flower_crown, aliasFor: 'flower_crown' },
  'Bell Charm': { ...baseAccessories.bell_charm, aliasFor: 'bell_charm' },
  'Fern Garland': { ...baseAccessories.fern_garland, aliasFor: 'fern_garland' },
  'Starry Bandana': { ...baseAccessories.starry_bandana, aliasFor: 'starry_bandana' },
  'Woolly Scarf': { ...baseAccessories.woolly_scarf, aliasFor: 'woolly_scarf' }
};

export const AccessoryLibrary: Record<string, AccessoryEntry> = {
  ...baseAccessories,
  ...aliasEntries
};

export type AccessoryName = keyof typeof AccessoryLibrary;

export function resolvedAccessoryKey(name: string): string {
  const entry = AccessoryLibrary[name];
  if (!entry) return name;
  return entry.aliasFor ?? name;
}

export function listAccessories(): string[] {
  return Object.keys(AccessoryLibrary);
}

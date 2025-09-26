export interface DecorEntry {
  icon: string;
  description: string;
}

export const DecorLibrary: Record<string, DecorEntry> = {
  'Wildflower Patch': {
    icon: '🌼',
    description: 'A ring of wildflowers buzzing with bees.'
  },
  'Tartan Picnic Rug': {
    icon: '🧺',
    description: 'A tartan rug ready for oat biscuits and tea.'
  },
  'Fairy Lights Garland': {
    icon: '✨',
    description: 'Soft lights twinkling along the fence.'
  },
  'Stone Cairn Lantern': {
    icon: '🪨',
    description: 'Stacked stones with a lantern glow.'
  },
  'Milk Churn Planter': {
    icon: '🥛',
    description: 'An old churn overflowing with blooms.'
  },
  'Festival Bunting': {
    icon: '🎀',
    description: 'Colourful ribbons stretch across the paddock for festival week.'
  },
  'Heather Hedge': {
    icon: '🌸',
    description: 'Neat hedges of blooming heather create a fragrant border.'
  },
  'Pebble Pond': {
    icon: '💧',
    description: 'A shallow pond rimmed with river stones for hoof-dipping.'
  }
};

export interface FoodEntry {
  icon: string;
  description: string;
  hunger: number;
  happiness: number;
  chonk: number;
  overfeedChonk: number;
  overfeedMood: number;
  maxServings: number;
}

export const FoodLibrary: Record<string, FoodEntry> = {
  'Starter Hay': {
    icon: '🌾',
    description: 'Reliable hay baled fresh from the paddock.',
    hunger: -24,
    happiness: 6,
    chonk: 0,
    overfeedChonk: 6,
    overfeedMood: 4,
    maxServings: 1
  },
  'Carrot Crunch': {
    icon: '🥕',
    description: 'Sweet carrots that brighten every muzzle.',
    hunger: -20,
    happiness: 7,
    chonk: 0,
    overfeedChonk: 5,
    overfeedMood: 4,
    maxServings: 1
  },
  'Warm Oat Mash': {
    icon: '🪣',
    description: 'Comforting oat mash served warm in a pail.',
    hunger: -28,
    happiness: 7,
    chonk: 2,
    overfeedChonk: 9,
    overfeedMood: 5,
    maxServings: 1
  },
  'Sweet Clover Bale': {
    icon: '☘️',
    description: 'Fragrant clover tied into a tidy bale.',
    hunger: -26,
    happiness: 8,
    chonk: 1,
    overfeedChonk: 8,
    overfeedMood: 5,
    maxServings: 1
  },
  'Heather Honey Jar': {
    icon: '🍯',
    description: 'Sticky heather honey drizzled over oats.',
    hunger: -18,
    happiness: 10,
    chonk: 2,
    overfeedChonk: 10,
    overfeedMood: 6,
    maxServings: 1
  },
  'Crisp Apple Crate': {
    icon: '🍎',
    description: 'A crate of rosy apples from the highland orchard.',
    hunger: -22,
    happiness: 8,
    chonk: 1,
    overfeedChonk: 7,
    overfeedMood: 5,
    maxServings: 1
  },
  'Barley Biscuit Stack': {
    icon: '🍪',
    description: 'Baked barley biscuits with a hint of molasses.',
    hunger: -24,
    happiness: 7,
    chonk: 3,
    overfeedChonk: 12,
    overfeedMood: 6,
    maxServings: 1
  }
};

export const DEFAULT_FOODS = ['Starter Hay', 'Carrot Crunch', 'Warm Oat Mash'];

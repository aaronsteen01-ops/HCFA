import type { Cow } from '../types';
import { pick } from '../core/util';

export const DEFAULT_COW_NAMES = ['Bonnie', 'Fergus', 'Isla', 'Hamish', 'Skye', 'Rory'];
export const PERSONALITIES = ['Greedy', 'Vain', 'Sleepy', 'Social'] as const;
export const COAT_COLOURS = ['brown', 'cream', 'rose', 'chocolate', 'white'] as const;

export function randomPersonality(): typeof PERSONALITIES[number] {
  return (pick([...PERSONALITIES]) as typeof PERSONALITIES[number]) || 'Greedy';
}

export function randomCoat(): typeof COAT_COLOURS[number] {
  return (pick([...COAT_COLOURS]) as typeof COAT_COLOURS[number]) || 'brown';
}

export function newCow(id: string, name: string): Cow {
  return {
    id,
    name,
    personality: randomPersonality(),
    happiness: 70,
    chonk: 20,
    cleanliness: 60,
    hunger: 40,
    accessories: [],
    colour: randomCoat()
  };
}

export function ensureCowDefaults(
  cow: Partial<Cow> | undefined,
  fallbackId: string,
  fallbackName: string
): Cow {
  const base = newCow(fallbackId, fallbackName);
  return {
    ...base,
    ...cow,
    id: cow?.id || fallbackId,
    name: cow?.name || fallbackName,
    accessories: Array.isArray(cow?.accessories) ? cow!.accessories.slice() : [],
    colour: (cow?.colour as Cow['colour']) || base.colour,
    personality: (cow?.personality as Cow['personality']) || base.personality
  };
}

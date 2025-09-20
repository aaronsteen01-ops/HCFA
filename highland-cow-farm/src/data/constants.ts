export const ACCESSORY_LIMIT = 3;
export const DECOR_LIMIT = 3;
export const DECOR_SLOTS = ['left', 'centre', 'right'] as const;
export type DecorSlot = (typeof DECOR_SLOTS)[number];
export const DECOR_SLOT_LABELS: Record<DecorSlot, string> = {
  left: 'Left paddock',
  centre: 'Barn front',
  right: 'Fence line'
};

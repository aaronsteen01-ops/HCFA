export interface AchievementEntry {
  title: string;
  description: string;
}

export const ACHIEVEMENTS: Record<string, AchievementEntry> = {
  perfectDay: {
    title: 'Perfect Pastures',
    description: 'Complete all four mini-games in a single day without a miss.'
  },
  fashionista: {
    title: 'Highland Fashionista',
    description: 'Equip accessories on at least three different cows.'
  },
  cozyDecorator: {
    title: 'Cozy Decorator',
    description: 'Display three décor pieces around the paddock at once.'
  },
  socialButterfly: {
    title: 'Social Butterfly',
    description: 'Win a Social personality event for the herd.'
  },
  chonkSentinel: {
    title: 'Chonk Sentinel',
    description: 'End a day with every cow below 70 chonk.'
  }
};

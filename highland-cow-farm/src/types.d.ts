export type Personality = 'Greedy' | 'Vain' | 'Sleepy' | 'Social';
export type CowColour = 'brown' | 'cream' | 'rose' | 'chocolate' | 'white';

export interface Cow {
  id: string;
  name: string;
  personality: Personality;
  happiness: number;
  chonk: number;
  cleanliness: number;
  hunger: number;
  accessories: string[];
  colour: CowColour;
}

export interface Unlocks {
  foods: string[];
  accessories: string[];
  decor: string[];
}

export interface DecorLayout {
  left: string | null;
  centre: string | null;
  right: string | null;
}

export interface Options {
  audioOn: boolean;
  effectsVolume: number;
  ambienceVolume: number;
  masterVolume: number;
  highContrastUI: boolean;
  reducedFlash: boolean;
}

export interface FarmStats {
  totalPerfects: number;
  totalChonks: number;
  perfectDayStreak: number;
  bestPerfectDayStreak: number;
  lastRewardType: string | null;
}

export type AchievementMap = Record<string, boolean>;

export interface SeasonFestivalReward {
  type: 'foods' | 'accessories' | 'decor';
  item: string;
  reason?: string;
}

export interface SeasonFestival {
  id: string;
  name: string;
  startOffset: number;
  festivalOffset: number;
  tasks: string[];
  note?: string;
  modifiers?: Record<string, Record<string, any>>;
  reward?: SeasonFestivalReward;
}

export interface SeasonState {
  id: string;
  name: string;
  startDay: number;
  festivalTasks: string[];
  calendar: SeasonFestival[];
  completedFestivals: string[];
}

export interface SeasonFestivalProgress extends SeasonFestival {
  weekStartDay: number;
  festivalDay: number;
  daysUntilFestival: number;
  isFestivalWeek: boolean;
  completed: boolean;
}

export interface SeasonProgressSnapshot {
  season: SeasonState;
  day: number;
  dayOfSeason: number;
  weekNumber: number;
  activeFestival?: SeasonFestivalProgress;
  nextFestival?: SeasonFestivalProgress;
}

export interface SaveData {
  version: number;
  day: number;
  cows: Cow[];
  unlocks: Unlocks;
  activeDecor: string[];
  decorLayout: DecorLayout;
  options: Options;
  stats: FarmStats;
  achievements: AchievementMap;
  lastPlayedISO: string;
  season: SeasonState;
}

export interface MiniGameOutcome {
  success: boolean;
  adjustments: Record<string, Partial<Record<'happiness' | 'hunger' | 'cleanliness' | 'chonk', number>>>;
  summary?: string;
  stats?: { totalPerfects?: number; totalChonks?: number };
}

declare module '*.b64?raw' {
  const content: string;
  export default content;
}

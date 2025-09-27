import type { Cow, CowAdjustments, Options } from '../types';

export type MiniGameKey = 'catch' | 'food' | 'brush' | 'ceilidh';

export interface MiniGameContext {
  participants: Cow[];
  difficulty: number;
  updateTimer: (seconds: number) => void;
  options: Options;
  modifiers?: Record<string, any> | null;
  foods?: string[];
  updateInstruction?: (text: string) => void;
  onComplete: (result: MiniGameResult) => void;
}

export interface MiniGameResult {
  success: boolean;
  adjustments: CowAdjustments;
  summary?: string;
  stats?: { totalPerfects?: number; totalChonks?: number };
}

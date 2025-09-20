import type { Cow, Options } from '../types';

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
  adjustments: Record<string, Partial<Record<'happiness' | 'hunger' | 'cleanliness' | 'chonk', number>>>;
  summary?: string;
  stats?: { totalPerfects?: number; totalChonks?: number };
}

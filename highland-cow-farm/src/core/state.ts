import type {
  AchievementMap,
  Cow,
  CowAdjustments,
  CowJournalEntry,
  CowNoteEntry,
  CowSnapshotEntry,
  DecorLayout,
  JournalData,
  Options,
  SaveData,
  SeasonState,
  SeasonFestival,
  SeasonProgressSnapshot,
  SeasonFestivalReward
} from '../types';
import { DEFAULT_FOODS, FoodLibrary } from '../data/foods';
import { AccessoryLibrary } from '../data/accessories';
import { DecorLibrary } from '../data/decor';
import { ACHIEVEMENTS } from '../data/achievements';
import { ACCESSORY_LIMIT, DECOR_LIMIT, DECOR_SLOTS } from '../data/constants';
import { clamp, range, sample } from './util';
import { DEFAULT_COW_NAMES, ensureCowDefaults, newCow } from '../game/cows';

export const SAVE_KEY = 'hcfarm_save_v1';
const VERSION = 5;

const MAX_NAME_HISTORY = 12;
const MAX_OUTFIT_HISTORY = 18;
const MAX_NOTES = 60;
const MAX_SNAPSHOTS = 24;

let data: SaveData;

function nowISO(): string {
  return new Date().toISOString();
}

function clipList<T>(list: T[], limit: number): T[] {
  if (!Array.isArray(list)) return [];
  if (list.length <= limit) return list.slice();
  return list.slice(list.length - limit);
}

function sanitizeNameHistory(entry: Partial<CowJournalEntry> | undefined, cow: Cow, day: number, timestamp: string) {
  const source = Array.isArray(entry?.names) ? entry!.names : [];
  const cleaned = source
    .filter(record => record && typeof record.name === 'string')
    .map(record => ({
      day: typeof record.day === 'number' && Number.isFinite(record.day) ? Math.max(1, Math.floor(record.day)) : day,
      name: record.name.trim(),
      recordedISO: typeof record.recordedISO === 'string' && record.recordedISO ? record.recordedISO : timestamp
    }))
    .filter(record => record.name);
  if (!cleaned.length) {
    cleaned.push({ day, name: cow.name, recordedISO: timestamp });
  }
  return clipList(cleaned, MAX_NAME_HISTORY);
}

function sanitizeNotes(entry: Partial<CowJournalEntry> | undefined, day: number, timestamp: string): CowNoteEntry[] {
  const source = Array.isArray(entry?.notes) ? entry!.notes : [];
  const cleaned = source
    .filter(note => note && typeof note.text === 'string' && typeof note.id === 'string')
    .map(note => ({
      id: note.id,
      day: typeof note.day === 'number' && Number.isFinite(note.day) ? Math.max(1, Math.floor(note.day)) : day,
      text: note.text.trim(),
      recordedISO: typeof note.recordedISO === 'string' && note.recordedISO ? note.recordedISO : timestamp
    }))
    .filter(note => note.text.length > 0);
  return clipList(cleaned, MAX_NOTES);
}

function sanitizeOutfits(entry: Partial<CowJournalEntry> | undefined, cow: Cow, day: number, timestamp: string) {
  const source = Array.isArray(entry?.outfits) ? entry!.outfits : [];
  const cleaned = source
    .filter(outfit => outfit && Array.isArray(outfit.accessories))
    .map(outfit => ({
      day: typeof outfit.day === 'number' && Number.isFinite(outfit.day) ? Math.max(1, Math.floor(outfit.day)) : day,
      accessories: outfit.accessories.filter((item: unknown): item is string => typeof item === 'string'),
      recordedISO: typeof outfit.recordedISO === 'string' && outfit.recordedISO ? outfit.recordedISO : timestamp
    }));
  if (!cleaned.length && cow.accessories?.length) {
    cleaned.push({ day, accessories: cow.accessories.slice(), recordedISO: timestamp });
  }
  return clipList(cleaned, MAX_OUTFIT_HISTORY);
}

function sanitizeTreats(entry: Partial<CowJournalEntry> | undefined): Record<string, number> {
  const source = entry?.favouriteTreats;
  if (!source || typeof source !== 'object') return {};
  const result: Record<string, number> = {};
  Object.keys(source).forEach(key => {
    const count = (source as Record<string, unknown>)[key];
    if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
      result[key] = Math.floor(count);
    }
  });
  return result;
}

function sanitizeSnapshots(entry: Partial<CowJournalEntry> | undefined, day: number, timestamp: string): CowSnapshotEntry[] {
  const source = Array.isArray(entry?.snapshots) ? entry!.snapshots : [];
  const cleaned = source
    .filter(snapshot => snapshot && typeof snapshot.dataUri === 'string' && snapshot.dataUri.trim())
    .map(snapshot => ({
      day: typeof snapshot.day === 'number' && Number.isFinite(snapshot.day) ? Math.max(1, Math.floor(snapshot.day)) : day,
      dataUri: snapshot.dataUri,
      recordedISO: typeof snapshot.recordedISO === 'string' && snapshot.recordedISO ? snapshot.recordedISO : timestamp
    }));
  return clipList(cleaned, MAX_SNAPSHOTS);
}

function sanitizeJournalEntry(entry: Partial<CowJournalEntry> | undefined, cow: Cow, day: number): CowJournalEntry {
  const timestamp = nowISO();
  return {
    cowId: cow.id,
    names: sanitizeNameHistory(entry, cow, day, timestamp),
    notes: sanitizeNotes(entry, day, timestamp),
    outfits: sanitizeOutfits(entry, cow, day, timestamp),
    favouriteTreats: sanitizeTreats(entry),
    snapshots: sanitizeSnapshots(entry, day, timestamp)
  };
}

function defaultJournalEntry(cow: Cow, day: number): CowJournalEntry {
  const timestamp = nowISO();
  const outfits = cow.accessories?.length
    ? [{ day, accessories: cow.accessories.slice(), recordedISO: timestamp }]
    : [];
  return {
    cowId: cow.id,
    names: [{ day, name: cow.name, recordedISO: timestamp }],
    notes: [],
    outfits,
    favouriteTreats: {},
    snapshots: []
  };
}

function ensureJournalBase(): JournalData {
  if (!data.journal || typeof data.journal !== 'object') {
    data.journal = { cows: {} } as JournalData;
  } else if (!data.journal.cows || typeof data.journal.cows !== 'object') {
    data.journal.cows = {};
  }
  return data.journal;
}

function ensureJournalForCow(cow: Cow): CowJournalEntry {
  const journal = ensureJournalBase();
  const existing = journal.cows[cow.id];
  const sanitized = sanitizeJournalEntry(existing, cow, data?.day || 1);
  journal.cows[cow.id] = sanitized;
  return sanitized;
}

function pruneJournal(): void {
  if (!data?.journal?.cows) return;
  const valid = new Set(data.cows.map(cow => cow.id));
  Object.keys(data.journal.cows).forEach(id => {
    if (!valid.has(id)) {
      delete data.journal.cows[id];
    }
  });
}

function recordOutfitHistory(cow: Cow): void {
  if (!cow) return;
  const entry = ensureJournalForCow(cow);
  const current = Array.isArray(cow.accessories) ? cow.accessories.slice() : [];
  const last = entry.outfits[entry.outfits.length - 1];
  if (last && JSON.stringify(last.accessories) === JSON.stringify(current)) {
    return;
  }
  const record: CowJournalEntry['outfits'][number] = {
    day: data?.day || 1,
    accessories: current,
    recordedISO: nowISO()
  };
  entry.outfits = clipList(entry.outfits.concat(record), MAX_OUTFIT_HISTORY);
}

function recordTreatHistory(cow: Cow, treats: string[] | undefined | null): void {
  if (!cow || !Array.isArray(treats) || !treats.length) return;
  const entry = ensureJournalForCow(cow);
  treats.forEach(name => {
    if (typeof name !== 'string') return;
    const trimmed = name.trim();
    if (!trimmed) return;
    entry.favouriteTreats[trimmed] = (entry.favouriteTreats[trimmed] || 0) + 1;
  });
}

function recordNameHistory(cow: Cow, nextName: string): void {
  if (!cow) return;
  const entry = ensureJournalForCow(cow);
  const trimmed = nextName.trim();
  if (!trimmed) return;
  const last = entry.names[entry.names.length - 1];
  if (last && last.name === trimmed) return;
  const record = {
    day: data?.day || 1,
    name: trimmed,
    recordedISO: nowISO()
  };
  entry.names = clipList(entry.names.concat(record), MAX_NAME_HISTORY);
}

function recordSnapshot(cow: Cow, dataUri: string): CowSnapshotEntry {
  const entry = ensureJournalForCow(cow);
  const snapshot: CowSnapshotEntry = {
    day: data?.day || 1,
    dataUri,
    recordedISO: nowISO()
  };
  entry.snapshots = clipList(entry.snapshots.concat(snapshot), MAX_SNAPSHOTS);
  return snapshot;
}

function cloneJournalEntry(entry: CowJournalEntry): CowJournalEntry {
  return {
    cowId: entry.cowId,
    names: entry.names.map(item => ({ ...item })),
    notes: entry.notes.map(item => ({ ...item })),
    outfits: entry.outfits.map(item => ({ ...item, accessories: item.accessories.slice() })),
    favouriteTreats: Object.assign({}, entry.favouriteTreats),
    snapshots: entry.snapshots.map(item => ({ ...item }))
  };
}

const DEFAULT_SEASON_TEMPLATE: SeasonState = {
  id: 'spring-bloom',
  name: 'Spring Bloom',
  startDay: 1,
  festivalTasks: [
    'Keep two decor spots filled to impress visiting neighbours.',
    'Serve every cow a seasonal treat at least once this week.',
    'Earn a perfect day to kick off the closing ceilidh.'
  ],
  calendar: [
    {
      id: 'spring-bunting-week',
      name: 'Ribbon Rehearsal',
      startOffset: 0,
      festivalOffset: 6,
      tasks: [
        'Earn a perfect day to delight the décor committee.',
        'Display at least two decor pieces before the weekend.'
      ],
      note: 'Ribbon practise adds extra grooming patches and a brisker herding pace.',
      modifiers: {
        brush: { patchBonus: 1 },
        catch: { timeModifier: 1 }
      },
      reward: {
        type: 'decor',
        item: 'Festival Bunting',
        reason: 'Ribbon Rehearsal décor milestone'
      }
    },
    {
      id: 'spring-pantry-week',
      name: 'Pasture Pantry Prep',
      startOffset: 7,
      festivalOffset: 13,
      tasks: [
        'Win the food frenzy with no chonky mishaps.',
        'Keep herd happiness above 60 heading into the feast.'
      ],
      note: 'Seasonal snacks grant extra feeding time but cows grow hungrier if you slip.',
      modifiers: {
        food: { timeModifier: 2 },
        ceilidh: { beatWindow: 0.12 }
      }
    },
    {
      id: 'spring-ceilidh-week',
      name: 'Bloomlight Ceilidh',
      startOffset: 14,
      festivalOffset: 20,
      tasks: [
        'Finish the ceilidh with a perfect chain of steps.',
        'Brush at least two cows to parade sheen.'
      ],
      note: 'Lantern rehearsals slow the ceilidh beat but expect gleaming coats.',
      modifiers: {
        ceilidh: { beatWindow: 0.18, tempoModifier: -0.05 },
        brush: { patchBonus: 1 }
      }
    }
  ],
  completedFestivals: []
};

function cloneFestival(entry: SeasonFestival): SeasonFestival {
  const modifiers = entry.modifiers
    ? Object.keys(entry.modifiers).reduce((acc, key) => {
        const value = entry.modifiers![key];
        if (value && typeof value === 'object') {
          acc[key] = Object.assign({}, value);
        }
        return acc;
      }, {} as Record<string, Record<string, any>>)
    : undefined;
  return {
    id: entry.id,
    name: entry.name,
    startOffset: entry.startOffset,
    festivalOffset: entry.festivalOffset,
    tasks: entry.tasks ? entry.tasks.slice() : [],
    note: entry.note,
    modifiers,
    reward: entry.reward
      ? { type: entry.reward.type, item: entry.reward.item, reason: entry.reward.reason }
      : undefined
  };
}

function cloneSeason(template: SeasonState): SeasonState {
  return {
    id: template.id,
    name: template.name,
    startDay: template.startDay,
    festivalTasks: template.festivalTasks.slice(),
    calendar: template.calendar.map(cloneFestival),
    completedFestivals: template.completedFestivals.slice()
  };
}

function defaultSeason(): SeasonState {
  return cloneSeason(DEFAULT_SEASON_TEMPLATE);
}

function sanitizeFestivalReward(reward: any, fallback?: SeasonFestivalReward): SeasonFestivalReward | undefined {
  if (!reward || typeof reward !== 'object') {
    return fallback ? { ...fallback } : undefined;
  }
  const type = reward.type;
  if (type !== 'foods' && type !== 'accessories' && type !== 'decor') {
    return fallback ? { ...fallback } : undefined;
  }
  const item = typeof reward.item === 'string' && reward.item.trim() ? reward.item.trim() : null;
  if (!item) {
    return fallback ? { ...fallback } : undefined;
  }
  return {
    type,
    item,
    reason: typeof reward.reason === 'string' ? reward.reason : fallback?.reason
  };
}

function sanitizeFestival(entry: any, fallback: SeasonFestival): SeasonFestival {
  const base = cloneFestival(fallback);
  if (!entry || typeof entry !== 'object') {
    return base;
  }
  const sanitized: SeasonFestival = {
    id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : base.id,
    name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : base.name,
    startOffset:
      typeof entry.startOffset === 'number' && Number.isFinite(entry.startOffset)
        ? Math.max(0, Math.floor(entry.startOffset))
        : base.startOffset,
    festivalOffset:
      typeof entry.festivalOffset === 'number' && Number.isFinite(entry.festivalOffset)
        ? Math.max(0, Math.floor(entry.festivalOffset))
        : base.festivalOffset,
    tasks: Array.isArray(entry.tasks) && entry.tasks.length
      ? entry.tasks
          .filter((task: unknown) => typeof task === 'string' && task.trim())
          .map((task: string) => task.trim())
      : base.tasks.slice(),
    note: typeof entry.note === 'string' && entry.note.trim() ? entry.note : base.note,
    modifiers:
      entry.modifiers && typeof entry.modifiers === 'object'
        ? Object.keys(entry.modifiers).reduce((acc, key) => {
            const value = entry.modifiers[key];
            if (value && typeof value === 'object') {
              acc[key] = Object.assign({}, value);
            }
            return acc;
          }, {} as Record<string, Record<string, any>>)
        : base.modifiers
        ? Object.keys(base.modifiers).reduce((acc, key) => {
            acc[key] = Object.assign({}, base.modifiers![key]);
            return acc;
          }, {} as Record<string, Record<string, any>>)
        : undefined,
    reward: sanitizeFestivalReward(entry.reward, base.reward)
  };
  if (sanitized.festivalOffset < sanitized.startOffset) {
    sanitized.festivalOffset = sanitized.startOffset;
  }
  return sanitized;
}

function sanitizeSeason(season: Partial<SeasonState> | undefined): SeasonState {
  const base = defaultSeason();
  if (!season || typeof season !== 'object') {
    return base;
  }
  const sanitized: SeasonState = {
    id: typeof season.id === 'string' && season.id.trim() ? season.id.trim() : base.id,
    name: typeof season.name === 'string' && season.name.trim() ? season.name.trim() : base.name,
    startDay:
      typeof season.startDay === 'number' && Number.isFinite(season.startDay)
        ? Math.max(1, Math.floor(season.startDay))
        : base.startDay,
    festivalTasks: Array.isArray(season.festivalTasks) && season.festivalTasks.length
      ? season.festivalTasks
          .filter((task: unknown) => typeof task === 'string' && task.trim())
          .map((task: string) => task.trim())
      : base.festivalTasks.slice(),
    calendar:
      Array.isArray(season.calendar) && season.calendar.length
        ? season.calendar.map(entry => {
            const fallback = base.calendar.find(template => template.id === entry.id) || base.calendar[0];
            return sanitizeFestival(entry, fallback);
          })
        : base.calendar.map(cloneFestival),
    completedFestivals: Array.isArray(season.completedFestivals)
      ? season.completedFestivals
          .filter((id: unknown) => typeof id === 'string' && id.trim())
          .map((id: string) => id.trim())
      : []
  };

  const seenIds = new Set<string>();
  sanitized.calendar = sanitized.calendar.map((entry, index) => {
    let identifier = entry.id;
    if (seenIds.has(identifier)) {
      identifier = `${identifier}-${index + 1}`;
    }
    seenIds.add(identifier);
    return Object.assign({}, entry, { id: identifier });
  });

  const validIds = new Set(sanitized.calendar.map(entry => entry.id));
  sanitized.completedFestivals = sanitized.completedFestivals.filter(id => validIds.has(id));
  return sanitized;
}

function findFestivalById(season: SeasonState, id: string): SeasonFestival | undefined {
  return season.calendar.find(entry => entry.id === id);
}

function toProgressEntry(
  season: SeasonState,
  entry: SeasonFestival,
  day: number,
  completed: Set<string>
) {
  const cloned = cloneFestival(entry);
  const weekStartDay = season.startDay + cloned.startOffset;
  const festivalDay = season.startDay + cloned.festivalOffset;
  return {
    ...cloned,
    weekStartDay,
    festivalDay,
    daysUntilFestival: festivalDay - day,
    isFestivalWeek: day >= weekStartDay && day <= festivalDay,
    completed: completed.has(cloned.id)
  };
}

function blankAchievements(): AchievementMap {
  const result: AchievementMap = {};
  Object.keys(ACHIEVEMENTS).forEach(key => {
    result[key] = false;
  });
  return result;
}

function sanitizeUnlockList(list: string[] | undefined, library: Record<string, unknown>): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  return list.filter(item => {
    if (!library[item]) return false;
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function sanitizeAccessories(list: string[] | undefined, source?: SaveData): string[] {
  if (!Array.isArray(list)) return [];
  const unlocked = new Set(source ? source.unlocks?.accessories || [] : data?.unlocks?.accessories || []);
  const seen = new Set<string>();
  const result: string[] = [];
  list.forEach(item => {
    if (!AccessoryLibrary[item]) return;
    if (!unlocked.has(item)) return;
    if (seen.has(item)) return;
    if (result.length >= ACCESSORY_LIMIT) return;
    seen.add(item);
    result.push(item);
  });
  return result;
}

function sanitizeDecor(list: string[] | undefined, source?: SaveData): string[] {
  if (!Array.isArray(list)) return [];
  const unlocked = new Set(source ? source.unlocks?.decor || [] : data?.unlocks?.decor || []);
  const seen = new Set<string>();
  const result: string[] = [];
  list.forEach(item => {
    if (!DecorLibrary[item]) return;
    if (!unlocked.has(item)) return;
    if (seen.has(item)) return;
    if (result.length >= DECOR_LIMIT) return;
    seen.add(item);
    result.push(item);
  });
  return result;
}

function sanitizeDecorLayout(layout: DecorLayout | undefined | Record<string, string | null>, source?: SaveData | string[]): DecorLayout {
  const unlocked = Array.isArray(source)
    ? new Set(source)
    : new Set(source ? source.unlocks?.decor || [] : data?.unlocks?.decor || []);
  const sanitized: DecorLayout = { left: null, centre: null, right: null };
  const seen = new Set<string>();
  DECOR_SLOTS.forEach(slot => {
    const value = layout && (layout as any)[slot];
    if (value && DecorLibrary[value] && unlocked.has(value) && !seen.has(value)) {
      sanitized[slot] = value;
      seen.add(value);
    }
  });
  return sanitized;
}

function sanitizeOptions(options: Partial<Options> | undefined): Options {
  const base: Options = {
    audioOn: true,
    effectsVolume: 0.9,
    ambienceVolume: 0.5,
    masterVolume: 1,
    highContrastUI: false,
    reducedFlash: false
  };
  if (!options) return base;
  return {
    audioOn: options.audioOn !== false,
    effectsVolume: typeof options.effectsVolume === 'number' ? clamp(options.effectsVolume, 0, 1) : base.effectsVolume,
    ambienceVolume: typeof options.ambienceVolume === 'number' ? clamp(options.ambienceVolume, 0, 1) : base.ambienceVolume,
    masterVolume: typeof options.masterVolume === 'number' ? clamp(options.masterVolume, 0, 1) : base.masterVolume,
    highContrastUI: !!options.highContrastUI,
    reducedFlash: !!options.reducedFlash
  };
}

export function migrateSave(oldData: any): SaveData {
  const migrated = newSave();
  if (!oldData || typeof oldData !== 'object') {
    return migrated;
  }
  migrated.day = typeof oldData.day === 'number' ? oldData.day : migrated.day;
  const carriedAccessories = new Set<string>();
  const carriedDecor = new Set<string>();
  if (Array.isArray(oldData.cows)) {
    migrated.cows = oldData.cows.map((cow: Partial<Cow>, index: number) => {
      const fallbackId = cow?.id || `cow-${index + 1}`;
      const fallbackName = cow?.name || DEFAULT_COW_NAMES[index % DEFAULT_COW_NAMES.length];
      const merged = ensureCowDefaults(cow as Cow, fallbackId, fallbackName);
      (Array.isArray(cow?.accessories) ? cow!.accessories : []).forEach((item: string) => {
        if (AccessoryLibrary[item]) carriedAccessories.add(item);
      });
      return merged;
    });
  }
  if (oldData.unlocks) {
    const foodList = sanitizeUnlockList(oldData.unlocks.foods, FoodLibrary);
    if (foodList.length) {
      const combinedFoods = new Set([...migrated.unlocks.foods, ...foodList]);
      migrated.unlocks.foods = Array.from(combinedFoods);
    }
    migrated.unlocks.accessories = sanitizeUnlockList(oldData.unlocks.accessories, AccessoryLibrary);
    migrated.unlocks.decor = sanitizeUnlockList(oldData.unlocks.decor, DecorLibrary);
  }
  carriedAccessories.forEach(item => {
    if (!migrated.unlocks.accessories.includes(item)) {
      migrated.unlocks.accessories.push(item);
    }
  });
  migrated.unlocks.accessories = sanitizeUnlockList(migrated.unlocks.accessories, AccessoryLibrary);
  const opts = oldData.options || {};
  migrated.options = sanitizeOptions(opts);
  if (oldData.stats) {
    migrated.stats.totalPerfects = Number(oldData.stats.totalPerfects) || 0;
    migrated.stats.totalChonks = Number(oldData.stats.totalChonks) || 0;
    migrated.stats.perfectDayStreak = Number(oldData.stats.perfectDayStreak) || 0;
    migrated.stats.bestPerfectDayStreak = Number(oldData.stats.bestPerfectDayStreak) || migrated.stats.perfectDayStreak;
    if (typeof oldData.stats.lastRewardType === 'string') {
      migrated.stats.lastRewardType = oldData.stats.lastRewardType;
    }
  }
  let legacyLayout: DecorLayout | null = null;
  if (Array.isArray(oldData.activeDecor)) {
    migrated.activeDecor = oldData.activeDecor.slice();
    oldData.activeDecor.forEach((item: string) => {
      if (DecorLibrary[item]) carriedDecor.add(item);
    });
    legacyLayout = { left: null, centre: null, right: null };
    sanitizeDecor(oldData.activeDecor, migrated).forEach((name, index) => {
      const slot = DECOR_SLOTS[index];
      if (slot) legacyLayout![slot] = name;
    });
  }
  if (oldData.decorLayout && typeof oldData.decorLayout === 'object') {
    legacyLayout = oldData.decorLayout;
  }
  carriedDecor.forEach(item => {
    if (!migrated.unlocks.decor.includes(item)) {
      migrated.unlocks.decor.push(item);
    }
  });
  migrated.unlocks.decor = sanitizeUnlockList(migrated.unlocks.decor, DecorLibrary);
  migrated.cows.forEach(cow => {
    cow.accessories = sanitizeAccessories(cow.accessories, migrated);
  });
  const previousJournal =
    oldData.journal && typeof oldData.journal === 'object' && oldData.journal.cows && typeof oldData.journal.cows === 'object'
      ? oldData.journal.cows
      : {};
  const journal: JournalData = { cows: {} };
  migrated.cows.forEach(cow => {
    const entry = previousJournal ? previousJournal[cow.id] : undefined;
    journal.cows[cow.id] = sanitizeJournalEntry(entry, cow, migrated.day);
  });
  migrated.journal = journal;
  migrated.activeDecor = sanitizeDecor(migrated.activeDecor, migrated);
  if (legacyLayout) {
    migrated.decorLayout = sanitizeDecorLayout(legacyLayout, migrated);
  }
  migrated.activeDecor = sanitizeDecor(Object.values(migrated.decorLayout || {}), migrated);
  if (oldData.achievements) {
    Object.keys(migrated.achievements).forEach(key => {
      if (key in oldData.achievements) {
        migrated.achievements[key] = !!oldData.achievements[key];
      }
    });
  }
  migrated.season = sanitizeSeason(oldData.season);
  return migrated;
}

export function newSave(): SaveData {
  const cows: Cow[] = [];
  for (let i = 0; i < 4; i++) {
    const name = DEFAULT_COW_NAMES[i % DEFAULT_COW_NAMES.length];
    cows.push(newCow(`cow-${i + 1}`, name));
  }
  const journal: JournalData = { cows: {} };
  cows.forEach(cow => {
    journal.cows[cow.id] = defaultJournalEntry(cow, 1);
  });
  return {
    version: VERSION,
    day: 1,
    cows,
    journal,
    unlocks: { foods: DEFAULT_FOODS.slice(), accessories: [], decor: [] },
    activeDecor: [],
    decorLayout: { left: null, centre: null, right: null },
    options: {
      audioOn: true,
      effectsVolume: 0.9,
      ambienceVolume: 0.5,
      masterVolume: 1,
      highContrastUI: false,
      reducedFlash: false
    },
    stats: { totalPerfects: 0, totalChonks: 0, perfectDayStreak: 0, bestPerfectDayStreak: 0, lastRewardType: null },
    achievements: blankAchievements(),
    lastPlayedISO: new Date().toISOString(),
    season: defaultSeason()
  };
}

export function loadSave(): SaveData {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    data = newSave();
  } else {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.version || parsed.version < VERSION) {
        data = migrateSave(parsed);
        data.version = VERSION;
        saveNow();
      } else {
        data = parsed;
      }
    } catch (err) {
      console.warn('Failed to parse save, resetting', err);
      data = newSave();
      saveNow();
    }
  }
  data.unlocks = Object.assign({ foods: [], accessories: [], decor: [] }, data.unlocks || {});
  const ensuredFoods = sanitizeUnlockList([...(data.unlocks.foods || []), ...DEFAULT_FOODS], FoodLibrary);
  data.unlocks.foods = ensuredFoods.length ? ensuredFoods : DEFAULT_FOODS.slice();
  data.unlocks.accessories = sanitizeUnlockList(data.unlocks.accessories, AccessoryLibrary);
  data.unlocks.decor = sanitizeUnlockList(data.unlocks.decor, DecorLibrary);
  data.decorLayout = sanitizeDecorLayout(data.decorLayout, data);
  data.activeDecor = sanitizeDecor(Object.values(data.decorLayout), data);
  data.cows = Array.isArray(data.cows)
    ? data.cows.map((cow: Cow, index: number) => ensureCowDefaults(cow, cow.id || `cow-${index + 1}`, cow.name || DEFAULT_COW_NAMES[index % DEFAULT_COW_NAMES.length]))
    : [];
  data.cows.forEach(cow => {
    cow.accessories = sanitizeAccessories(cow.accessories);
  });
  ensureJournalBase();
  data.cows.forEach(cow => {
    ensureJournalForCow(cow);
  });
  pruneJournal();
  if (!data.achievements) data.achievements = blankAchievements();
  data.season = sanitizeSeason(data.season);
  return data;
}

export function saveNow(): void {
  if (!data) return;
  data.lastPlayedISO = new Date().toISOString();
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function getData(): SaveData {
  return data;
}

export function reset(): SaveData {
  data = newSave();
  saveNow();
  return data;
}

export function setOption(partial: Partial<Options>): void {
  if (!data) return;
  if (typeof partial.audioOn === 'boolean') data.options.audioOn = partial.audioOn;
  if (typeof partial.highContrastUI === 'boolean') data.options.highContrastUI = partial.highContrastUI;
  if (typeof partial.reducedFlash === 'boolean') data.options.reducedFlash = partial.reducedFlash;
  if (typeof partial.effectsVolume === 'number') data.options.effectsVolume = clamp(partial.effectsVolume, 0, 1);
  if (typeof partial.ambienceVolume === 'number') data.options.ambienceVolume = clamp(partial.ambienceVolume, 0, 1);
  if (typeof partial.masterVolume === 'number') data.options.masterVolume = clamp(partial.masterVolume, 0, 1);
  saveNow();
}

export function getOption<K extends keyof Options>(key: K): Options[K] {
  return data.options[key];
}

export function applyCowAdjustments(adjustments: CowAdjustments): void {
  data.cows.forEach(cow => {
    const diff = adjustments[cow.id];
    if (!diff) return;
    if (typeof diff.happiness === 'number') {
      cow.happiness = clamp(cow.happiness + diff.happiness, 0, 100);
    }
    if (typeof diff.chonk === 'number') {
      cow.chonk = clamp(cow.chonk + diff.chonk, 0, 100);
    }
    if (typeof diff.cleanliness === 'number') {
      cow.cleanliness = clamp(cow.cleanliness + diff.cleanliness, 0, 100);
    }
    if (typeof diff.hunger === 'number') {
      cow.hunger = clamp(cow.hunger + diff.hunger, 0, 100);
    }
    if (typeof diff.addAccessory === 'string' && diff.addAccessory) {
      const next = cow.accessories.slice();
      const accessory = diff.addAccessory;
      if (!next.includes(accessory)) {
        next.push(accessory);
        cow.accessories = sanitizeAccessories(next);
      }
      recordOutfitHistory(cow);
    }
    if (Array.isArray(diff.servedTreats) && diff.servedTreats.length) {
      recordTreatHistory(cow, diff.servedTreats);
    }
    ensureJournalForCow(cow);
  });
}

export function incrementDay(): void {
  data.day += 1;
}

export function addUnlock(type: 'foods' | 'accessories' | 'decor', item: string): boolean {
  if (!data.unlocks[type]) {
    data.unlocks[type] = [];
  }
  const list = data.unlocks[type];
  if (list.includes(item)) return false;
  if (type === 'accessories' && !AccessoryLibrary[item]) return false;
  if (type === 'foods' && !FoodLibrary[item]) return false;
  if (type === 'decor' && !DecorLibrary[item]) return false;
  list.push(item);
  saveNow();
  return true;
}

export function recordStats(partial: { totalPerfects?: number; totalChonks?: number }): void {
  if (!partial) return;
  if (partial.totalPerfects) {
    data.stats.totalPerfects += partial.totalPerfects;
  }
  if (partial.totalChonks) {
    data.stats.totalChonks += partial.totalChonks;
  }
}

export function registerDayOutcome(summary?: { perfectDay?: boolean; rewardType?: string | null; perfectStreak?: number }): { perfectDayStreak: number; bestPerfectDayStreak: number } {
  if (!summary) {
    saveNow();
    return {
      perfectDayStreak: data.stats.perfectDayStreak || 0,
      bestPerfectDayStreak: data.stats.bestPerfectDayStreak || 0
    };
  }
  let nextStreak;
  if (typeof summary.perfectStreak === 'number' && !Number.isNaN(summary.perfectStreak)) {
    nextStreak = Math.max(0, Math.round(summary.perfectStreak));
  } else if (summary.perfectDay) {
    nextStreak = (data.stats.perfectDayStreak || 0) + 1;
  } else {
    nextStreak = 0;
  }
  data.stats.perfectDayStreak = nextStreak;
  if ((data.stats.bestPerfectDayStreak || 0) < nextStreak) {
    data.stats.bestPerfectDayStreak = nextStreak;
  }
  if (summary.rewardType) {
    data.stats.lastRewardType = summary.rewardType;
  }
  saveNow();
  return {
    perfectDayStreak: data.stats.perfectDayStreak,
    bestPerfectDayStreak: data.stats.bestPerfectDayStreak
  };
}

export function setCowAccessories(cowId: string, accessories: string[]): boolean {
  const cow = data.cows.find(entry => entry.id === cowId);
  if (!cow) return false;
  const sanitized = sanitizeAccessories(accessories);
  const changed = JSON.stringify(cow.accessories) !== JSON.stringify(sanitized);
  cow.accessories = sanitized;
  if (changed) {
    recordOutfitHistory(cow);
    ensureJournalForCow(cow);
    saveNow();
  }
  return changed;
}

export function toggleCowAccessory(cowId: string, accessory: string): boolean {
  const cow = data.cows.find(entry => entry.id === cowId);
  if (!cow) return false;
  if (!AccessoryLibrary[accessory]) return false;
  if (!(data.unlocks.accessories || []).includes(accessory)) return false;
  const current = cow.accessories.slice();
  if (current.includes(accessory)) {
    const filtered = current.filter(item => item !== accessory);
    return setCowAccessories(cowId, filtered);
  }
  if (current.length >= ACCESSORY_LIMIT) {
    current.shift();
  }
  current.push(accessory);
  return setCowAccessories(cowId, current);
}

export function randomiseAccessories(cowId: string): Cow | null {
  const cow = data.cows.find(entry => entry.id === cowId);
  if (!cow) return null;
  const unlocked = sanitizeUnlockList(data.unlocks.accessories, AccessoryLibrary);
  if (!unlocked.length) return cow;
  const max = Math.min(ACCESSORY_LIMIT, unlocked.length);
  const count = Math.max(1, Math.floor(range(1, max + 1)));
  const selection = sample(unlocked, count);
  setCowAccessories(cowId, selection);
  return data.cows.find(entry => entry.id === cowId) || cow;
}

export function getCow(cowId: string): Cow | undefined {
  return data.cows.find(cow => cow.id === cowId);
}

export function getCowJournal(cowId: string): CowJournalEntry | null {
  const cow = data.cows.find(entry => entry.id === cowId);
  if (!cow) return null;
  const entry = ensureJournalForCow(cow);
  return cloneJournalEntry(entry);
}

export function getJournal(): JournalData {
  ensureJournalBase();
  pruneJournal();
  const result: JournalData = { cows: {} };
  data.cows.forEach(cow => {
    const entry = ensureJournalForCow(cow);
    result.cows[cow.id] = cloneJournalEntry(entry);
  });
  return result;
}

export function renameCow(
  cowId: string,
  nextName: string
): { success: boolean; message?: string; cow?: CowJournalEntry['names'][number]; cowData?: Cow } {
  const cow = data.cows.find(entry => entry.id === cowId);
  if (!cow) {
    return { success: false, message: 'Cow not found.' };
  }
  const trimmed = typeof nextName === 'string' ? nextName.trim() : '';
  if (!trimmed) {
    return { success: false, message: 'Name cannot be empty.' };
  }
  if (trimmed.length > 24) {
    return { success: false, message: 'Name must be 24 characters or fewer.' };
  }
  if (cow.name === trimmed) {
    return { success: false, message: 'That is already this cow\'s name.' };
  }
  cow.name = trimmed;
  recordNameHistory(cow, trimmed);
  ensureJournalForCow(cow);
  saveNow();
  const entry = data.journal.cows[cow.id];
  return {
    success: true,
    cow: entry?.names[entry.names.length - 1],
    cowData: cow
  };
}

export function addCowNote(cowId: string, text: string): { success: boolean; message?: string; note?: CowNoteEntry } {
  const cow = data.cows.find(entry => entry.id === cowId);
  if (!cow) {
    return { success: false, message: 'Cow not found.' };
  }
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    return { success: false, message: 'Note cannot be empty.' };
  }
  if (trimmed.length > 280) {
    return { success: false, message: 'Keep notes under 280 characters.' };
  }
  const entry = ensureJournalForCow(cow);
  const note: CowNoteEntry = {
    id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    day: data?.day || 1,
    text: trimmed,
    recordedISO: nowISO()
  };
  entry.notes = clipList(entry.notes.concat(note), MAX_NOTES);
  saveNow();
  return { success: true, note: { ...note } };
}

export function removeCowNote(cowId: string, noteId: string): { success: boolean; message?: string } {
  const cow = data.cows.find(entry => entry.id === cowId);
  if (!cow) {
    return { success: false, message: 'Cow not found.' };
  }
  const entry = ensureJournalForCow(cow);
  const index = entry.notes.findIndex(note => note.id === noteId);
  if (index === -1) {
    return { success: false, message: 'Note not found.' };
  }
  entry.notes.splice(index, 1);
  saveNow();
  return { success: true };
}

export function recordCowSnapshotEntry(cowId: string, dataUri: string): { success: boolean; message?: string; snapshot?: CowSnapshotEntry } {
  const cow = data.cows.find(entry => entry.id === cowId);
  if (!cow) {
    return { success: false, message: 'Cow not found.' };
  }
  if (typeof dataUri !== 'string' || !dataUri.startsWith('data:image')) {
    return { success: false, message: 'Snapshot must be an image data URI.' };
  }
  const snapshot = recordSnapshot(cow, dataUri);
  saveNow();
  return { success: true, snapshot: { ...snapshot } };
}

export function getUnlocks(type: 'foods' | 'accessories' | 'decor'): string[] {
  if (type === 'foods') {
    const current = Array.isArray(data.unlocks.foods) ? data.unlocks.foods.slice() : [];
    const combined = [...DEFAULT_FOODS, ...current];
    return sanitizeUnlockList(combined, FoodLibrary);
  }
  if (type === 'accessories') {
    return sanitizeUnlockList(data.unlocks.accessories, AccessoryLibrary);
  }
  if (type === 'decor') {
    return sanitizeUnlockList(data.unlocks.decor, DecorLibrary);
  }
  return (data.unlocks[type] || []).slice();
}

export function setDecorLayout(layout: DecorLayout): DecorLayout {
  const sanitized = sanitizeDecorLayout(layout, data);
  data.decorLayout = sanitized;
  data.activeDecor = sanitizeDecor(Object.values(sanitized), data);
  saveNow();
  return sanitized;
}

export function getDecorLayout(): DecorLayout {
  return { left: data.decorLayout.left, centre: data.decorLayout.centre, right: data.decorLayout.right };
}

export function getActiveDecor(): string[] {
  return DECOR_SLOTS.map(slot => (data.decorLayout || {})[slot]).filter(Boolean) as string[];
}

export function getAchievements(): AchievementMap {
  return data.achievements;
}

export function unlockAchievement(key: string, options: { silent?: boolean } = {}): boolean {
  if (!ACHIEVEMENTS[key]) return false;
  if (!data.achievements.hasOwnProperty(key)) {
    data.achievements[key] = false;
  }
  if (data.achievements[key]) return false;
  data.achievements[key] = true;
  if (!options.silent) {
    saveNow();
  }
  return true;
}

export function evaluateChonkSentinel(): boolean {
  if (data.cows.every(cow => cow.chonk < 70)) {
    return unlockAchievement('chonkSentinel');
  }
  return false;
}

export function refreshAutomaticAchievements(): void {
  if (data.cows.filter(cow => cow.accessories && cow.accessories.length).length >= 3) {
    unlockAchievement('fashionista', { silent: true });
  }
  if (getActiveDecor().length >= 3) {
    unlockAchievement('cozyDecorator', { silent: true });
  }
}

export function getSeason(): SeasonState {
  data.season = sanitizeSeason(data.season);
  return cloneSeason(data.season);
}

export function setSeason(partial: Partial<SeasonState>): SeasonState {
  if (!partial) return getSeason();
  const merged = Object.assign({}, data.season, partial);
  data.season = sanitizeSeason(merged);
  saveNow();
  return data.season;
}

export function isFestivalComplete(id: string): boolean {
  if (!id) return false;
  return !!data.season.completedFestivals.find(entry => entry === id);
}

export function markFestivalComplete(id: string): void {
  if (!id) return;
  if (!isFestivalComplete(id)) {
    data.season.completedFestivals.push(id);
  }
}

export function getFestivalName(id: string): string | null {
  if (!id) return null;
  const season = sanitizeSeason(data.season);
  const found = findFestivalById(season, id);
  return found ? found.name : null;
}

export function getSeasonContext(day: number = data.day): SeasonProgressSnapshot {
  data.season = sanitizeSeason(data.season);
  const season = data.season;
  const seasonClone = cloneSeason(season);
  const currentDay = typeof day === 'number' && Number.isFinite(day) ? Math.max(1, Math.floor(day)) : season.startDay;
  const dayOfSeason = Math.max(0, currentDay - seasonClone.startDay);
  const completed = new Set(season.completedFestivals);
  const calendar = seasonClone.calendar
    .slice()
    .sort((a, b) => (a.startOffset === b.startOffset ? a.festivalOffset - b.festivalOffset : a.startOffset - b.startOffset));
  let activeFestival: SeasonProgressSnapshot['activeFestival'];
  let nextFestival: SeasonProgressSnapshot['nextFestival'];
  calendar.forEach(entry => {
    const progress = toProgressEntry(seasonClone, entry, currentDay, completed);
    if (!nextFestival && progress.daysUntilFestival >= 0) {
      nextFestival = progress;
    }
    if (!activeFestival && progress.isFestivalWeek) {
      activeFestival = progress;
    }
  });
  if (!activeFestival && nextFestival && nextFestival.weekStartDay <= currentDay) {
    activeFestival = nextFestival;
  }
  return {
    season: seasonClone,
    day: currentDay,
    dayOfSeason,
    weekNumber: Math.max(1, Math.floor(dayOfSeason / 7) + 1),
    activeFestival,
    nextFestival
  };
}

// initialise on module load
loadSave();
refreshAutomaticAchievements();

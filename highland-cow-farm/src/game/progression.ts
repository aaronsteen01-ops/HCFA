import type { Cow, CowAdjustments, FamilyChallengeAssignment, SaveData, SeasonProgressSnapshot } from '../types';
import { shuffle, sample, pick } from '../core/util';
import * as State from '../core/state';
import * as TaskRush from '../ui/taskRush';
import * as SummaryUI from '../ui/summary';
import * as CatchGame from '../minigames/catch';
import * as FoodGame from '../minigames/food';
import * as BrushGame from '../minigames/brush';
import * as CeilidhGame from '../minigames/ceilidh';
import type { MiniGameContext, MiniGameResult, MiniGameKey } from '../minigames/types';
import ceilidhIconRaw from '../assets/minigames/ceilidh-icon.b64?raw';

const CEILIDH_ICON = `data:image/png;base64,${ceilidhIconRaw}`;

interface MiniGameDefinition {
  key: MiniGameKey;
  label: string;
  description: string;
  icon?: string;
  start: typeof CatchGame.start;
  stop: typeof CatchGame.stop;
  mount: typeof CatchGame.mount;
}

type MiniGameMap = Record<MiniGameKey, MiniGameDefinition>;

type MiniGameStartContext = Omit<MiniGameContext, 'onComplete'>;

const miniGames: MiniGameMap = {
  catch: {
    key: 'catch',
    label: 'Catch the Cow',
    description: 'Tap or click runaway cows to nudge them back toward the centre paddock.',
    icon: '🐄',
    start: CatchGame.start,
    stop: CatchGame.stop,
    mount: CatchGame.mount
  },
  food: {
    key: 'food',
    label: 'Food Frenzy',
    description: 'Drag the matching feed to each cow. One serving each keeps them spry!',
    icon: '🥕',
    start: FoodGame.start,
    stop: FoodGame.stop,
    mount: FoodGame.mount
  },
  brush: {
    key: 'brush',
    label: 'Brush Rush',
    description: 'Brush the messy patches away by dragging across them quickly.',
    icon: '🧼',
    start: BrushGame.start,
    stop: BrushGame.stop,
    mount: BrushGame.mount
  },
  ceilidh: {
    key: 'ceilidh',
    label: 'Highland Ceilidh',
    description: 'Tap the step button as the glow appears to keep the dance in perfect time.',
    icon: CEILIDH_ICON,
    start: CeilidhGame.start,
    stop: CeilidhGame.stop,
    mount: CeilidhGame.mount
  }
};

interface PlannedEvent {
  personality: string;
  label: string;
  instruction: string;
  dailyNote: string;
  modifiers?: Record<string, any>;
  applyOutcome?: (outcome: MiniGameResult, participants: Cow[]) => void;
  achievementOnSuccess?: string | null;
}

interface EventPlan {
  events: Partial<Record<MiniGameKey, PlannedEvent>>;
  notes: string[];
  seasonNotes?: { title: string; detail: string; tasks?: string[]; daysUntil?: number };
}

interface PreparedPlan {
  queue: MiniGameKey[];
  eventPlan: EventPlan;
  previewNotes: Array<{ title?: string; detail?: string; key?: MiniGameKey }>;
  season: SeasonProgressSnapshot;
  signature: string;
}

const PersonalityEngine = (function() {
  function ensureAdjustment(outcome: MiniGameResult, cowId: string) {
    if (!outcome.adjustments[cowId]) {
      outcome.adjustments[cowId] = {};
    }
    return outcome.adjustments[cowId]!;
  }

  const configs: Record<MiniGameKey, Record<string, PlannedEvent>> = {
    catch: {
      Sleepy: {
        personality: 'Sleepy',
        label: 'Sleepy Shuffle',
        instruction: 'Sleepy cows drift today – their hooves slow but the timer hurries.',
        dailyNote: 'Sleepy cows might nod off near the fence. Nudge them gently back to the centre.',
        modifiers: { timeModifier: -4, speedScale: 0.85 },
        applyOutcome(outcome, participants) {
          const sleepy = participants.filter(cow => cow.personality === 'Sleepy');
          sleepy.forEach(cow => {
            const adj = ensureAdjustment(outcome, cow.id);
            if (outcome.success) {
              adj.happiness = (adj.happiness || 0) + 3;
            } else {
              adj.happiness = (adj.happiness || 0) - 4;
            }
          });
          if (sleepy.length) {
            outcome.summary = outcome.success
              ? `${outcome.summary} The sleepy herd perked up after a safe stroll.`
              : `${outcome.summary} Sleepy hooves will need pep tomorrow.`;
          }
        }
      },
      Social: {
        personality: 'Social',
        label: 'Buddy System',
        instruction: 'Social butterflies rally the herd. Keep everyone close for a group bonus.',
        dailyNote: 'Social cows are leading the way – togetherness keeps them calm.',
        modifiers: { timeModifier: 3, speedScale: 0.95 },
        achievementOnSuccess: 'socialButterfly',
        applyOutcome(outcome, participants) {
          participants.forEach(cow => {
            const adj = ensureAdjustment(outcome, cow.id);
            if (outcome.success) {
              adj.happiness = (adj.happiness || 0) + 2;
            } else {
              adj.happiness = (adj.happiness || 0) - 2;
            }
          });
          outcome.summary = outcome.success
            ? `${outcome.summary} The herd moved in perfect harmony.`
            : `${outcome.summary} The herd scattered without their social lead.`;
        }
      }
    },
    food: {
      Greedy: {
        personality: 'Greedy',
        label: 'Greedy Graze',
        instruction: 'Greedy cows eye a second helping. Match perfectly to keep fluff in check.',
        dailyNote: 'Greedy grazers crave seconds. Keep servings strict to avoid extra chonk.',
        modifiers: { timeModifier: -2 },
        applyOutcome(outcome, participants) {
          const greedy = participants.filter(cow => cow.personality === 'Greedy');
          if (!greedy.length) return;
          greedy.forEach(cow => {
            const adj = ensureAdjustment(outcome, cow.id);
            if (outcome.success) {
              adj.hunger = (adj.hunger || 0) - 6;
              adj.happiness = (adj.happiness || 0) + 3;
            } else if (outcome.stats && outcome.stats.totalChonks) {
              adj.chonk = (adj.chonk || 0) + 4;
              adj.happiness = (adj.happiness || 0) - 3;
            }
          });
          if (outcome.stats && outcome.stats.totalChonks) {
            outcome.summary = `${outcome.summary} Greedy bellies grew a little rounder.`;
          } else if (outcome.success) {
            outcome.summary = `${outcome.summary} Sensible servings satisfied the greedy grazers.`;
          }
        }
      },
      Social: {
        personality: 'Social',
        label: 'Shared Snacks',
        instruction: 'Share snacks evenly – a perfect round delights every cow.',
        dailyNote: 'Social cows want every muzzle to get a taste at once. Even distribution lifts morale.',
        modifiers: { timeModifier: 2 },
        applyOutcome(outcome, participants) {
          if (outcome.success && outcome.stats && outcome.stats.totalChonks === 0) {
            participants.forEach(cow => {
              const adj = ensureAdjustment(outcome, cow.id);
              adj.happiness = (adj.happiness || 0) + 3;
            });
            outcome.summary = `${outcome.summary} Sharing snacks lifted every mood.`;
          } else if (!outcome.success) {
            participants.forEach(cow => {
              const adj = ensureAdjustment(outcome, cow.id);
              adj.happiness = (adj.happiness || 0) - 2;
            });
          }
        }
      }
    },
    brush: {
      Vain: {
        personality: 'Vain',
        label: 'Fringe Focus',
        instruction: 'Extra tangles appear as the vain herd demands spotless fringes.',
        dailyNote: 'Vain cows expect flawless coats. A few extra patches need smoothing.',
        modifiers: { timeModifier: 1, patchBonus: 2 },
        applyOutcome(outcome, participants) {
          const vain = participants.filter(cow => cow.personality === 'Vain');
          vain.forEach(cow => {
            const adj = ensureAdjustment(outcome, cow.id);
            if (outcome.success) {
              adj.cleanliness = (adj.cleanliness || 0) + 6;
              adj.happiness = (adj.happiness || 0) + 3;
            } else {
              adj.happiness = (adj.happiness || 0) - 5;
            }
          });
          if (vain.length) {
            outcome.summary = outcome.success
              ? `${outcome.summary} Every fringe sparkled to vain approval.`
              : `${outcome.summary} Vain cows pouted about stray curls.`;
          }
        }
      },
      Social: {
        personality: 'Social',
        label: 'Salon Day',
        instruction: 'Friends brush friends – a little extra time keeps the grooming circle happy.',
        dailyNote: 'Social cows hold a group grooming session. Keep brushes moving to match the chatter.',
        modifiers: { timeModifier: 2 },
        applyOutcome(outcome, participants) {
          participants.forEach(cow => {
            const adj = ensureAdjustment(outcome, cow.id);
            if (outcome.success) {
              adj.cleanliness = (adj.cleanliness || 0) + 3;
              adj.happiness = (adj.happiness || 0) + 2;
            } else {
              adj.happiness = (adj.happiness || 0) - 2;
            }
          });
          outcome.summary = outcome.success
            ? `${outcome.summary} The grooming circle finished with smiles.`
            : `${outcome.summary} The grooming circle fizzled out early.`;
        }
      }
    },
    ceilidh: {
      Social: {
        personality: 'Social',
        label: 'Community Ceilidh',
        instruction: 'Social cows invite the whole herd. The rhythm window widens – keep chaining steps!',
        dailyNote: 'Social cows plan an evening ceilidh. Stay on tempo to send spirits soaring.',
        modifiers: { beatWindow: 0.15, happinessBonus: 3 },
        applyOutcome(outcome, participants) {
          const socials = participants.filter(cow => cow.personality === 'Social');
          socials.forEach(cow => {
            const adj = ensureAdjustment(outcome, cow.id);
            if (outcome.success) {
              adj.happiness = (adj.happiness || 0) + 4;
            } else {
              adj.happiness = (adj.happiness || 0) - 3;
              adj.hunger = (adj.hunger || 0) + 4;
            }
          });
          if (socials.length) {
            outcome.summary = outcome.success
              ? `${outcome.summary} The social herd cheered the ceilidh on!`
              : `${outcome.summary} Without the rhythm, the social herd lost steam.`;
          }
        }
      }
    }
  };

  function cloneEvent(key: MiniGameKey, config: PlannedEvent): PlannedEvent {
    return {
      personality: config.personality,
      label: config.label,
      instruction: config.instruction,
      dailyNote: config.dailyNote,
      modifiers: Object.assign({}, config.modifiers),
      applyOutcome: config.applyOutcome,
      achievementOnSuccess: config.achievementOnSuccess || null
    };
  }

  function countPersonalities(cows: Cow[]) {
    const counts: Record<string, number> = { Greedy: 0, Vain: 0, Sleepy: 0, Social: 0 };
    cows.forEach(cow => {
      if (counts.hasOwnProperty(cow.personality)) {
        counts[cow.personality] += 1;
      }
    });
    return counts;
  }

  function planDay(save: SaveData, seasonContext?: SeasonProgressSnapshot): EventPlan {
    const cows = save.cows || [];
    const counts = countPersonalities(cows);
    const plan: EventPlan = { events: {}, notes: [] };
    const catchEvent = counts.Sleepy ? configs.catch.Sleepy : (counts.Social ? configs.catch.Social : null);
    if (catchEvent) {
      const event = cloneEvent('catch', catchEvent);
      plan.events.catch = event;
      plan.notes.push(event.dailyNote);
    }
    const foodEvent = counts.Greedy ? configs.food.Greedy : (counts.Social ? configs.food.Social : null);
    if (foodEvent) {
      const event = cloneEvent('food', foodEvent);
      plan.events.food = event;
      plan.notes.push(event.dailyNote);
    }
    const brushEvent = counts.Vain ? configs.brush.Vain : (counts.Social ? configs.brush.Social : null);
    if (brushEvent) {
      const event = cloneEvent('brush', brushEvent);
      plan.events.brush = event;
      plan.notes.push(event.dailyNote);
    }
    const ceilidhEvent = counts.Social ? configs.ceilidh.Social : null;
    if (ceilidhEvent) {
      const event = cloneEvent('ceilidh', ceilidhEvent);
      plan.events.ceilidh = event;
      plan.notes.push(event.dailyNote);
    }

    const seasonal = seasonContext || State.getSeasonContext(save.day);
    const highlight = seasonal?.activeFestival || seasonal?.nextFestival;
    if (highlight) {
      if (highlight.note) {
        plan.notes.push(highlight.note);
      }
      if (highlight.modifiers) {
        Object.keys(highlight.modifiers).forEach(key => {
          const miniKey = key as MiniGameKey;
          const event = plan.events[miniKey];
          if (event) {
            event.modifiers = Object.assign({}, event.modifiers || {}, highlight.modifiers![key]);
          }
        });
      }
      const daysUntil = highlight.daysUntilFestival;
      const detailParts: string[] = [];
      if (typeof daysUntil === 'number') {
        if (daysUntil === 0) {
          detailParts.push('Festival day is here!');
        } else if (daysUntil > 0) {
          const label = daysUntil === 1 ? 'day' : 'days';
          detailParts.push(`Festival in ${daysUntil} ${label}.`);
        }
      }
      if (highlight.note) {
        detailParts.push(highlight.note);
      }
      plan.seasonNotes = {
        title: `${seasonal?.season?.name || 'Season'} • ${highlight.name}`,
        detail: detailParts.join(' '),
        tasks: highlight.tasks?.slice() || seasonal?.season?.festivalTasks?.slice() || [],
        daysUntil
      };
    }
    return plan;
  }

  function eventForMini(key: MiniGameKey, participants: Cow[], plan: EventPlan): PlannedEvent | null {
    if (!plan || !plan.events[key]) return null;
    const base = plan.events[key]!;
    if (base.personality && !participants.some(cow => cow.personality === base.personality)) {
      return null;
    }
    return cloneEvent(key, base);
  }

  function applyOutcome(event: PlannedEvent | null, outcome: MiniGameResult, participants: Cow[]): void {
    if (!event || typeof event.applyOutcome !== 'function') return;
    event.applyOutcome(outcome, participants || []);
  }

  return { planDay, eventForMini, applyOutcome };
})();

let preparedPlan: PreparedPlan | null = null;
let running = false;
let lastResults: SummaryUI.SummaryData | null = null;
let miniGameArea: HTMLElement | null = null;
let miniGamesMounted = false;

function mountMiniGames(): void {
  if (miniGamesMounted) return;
  const area = miniGameArea || TaskRush.getArea();
  if (!area) return;
  miniGameArea = area;
  Object.values(miniGames).forEach(game => {
    game.mount(area);
  });
  miniGamesMounted = true;
}

export function prepareMiniGames(area: HTMLElement): void {
  if (!area) return;
  miniGameArea = area;
  mountMiniGames();
}

function planSignature(save: SaveData): string {
  const herdSignature = (save.cows || [])
    .map(cow => `${cow.id}:${cow.personality}`)
    .sort()
    .join('|');
  return `${save.day}|${herdSignature}`;
}

function buildPreviewNotes(queue: MiniGameKey[], eventPlan: EventPlan, season?: SeasonProgressSnapshot) {
  const base = queue.map((key, index) => {
    const info = miniGames[key];
    const event = eventPlan.events?.[key];
    if (event) {
      const detail = event.dailyNote || event.instruction || 'Special modifiers are active.';
      return {
        key,
        title: `${index + 1}. ${info.label}`,
        detail: `${event.label}: ${detail}`
      };
    }
    return {
      key,
      title: `${index + 1}. ${info.label}`,
      detail: 'Standard conditions today.'
    };
  });
  if (eventPlan.seasonNotes) {
    const tasks = eventPlan.seasonNotes.tasks && eventPlan.seasonNotes.tasks.length
      ? ` Tasks: ${eventPlan.seasonNotes.tasks.join(' • ')}`
      : '';
    base.push({
      title: eventPlan.seasonNotes.title,
      detail: `${eventPlan.seasonNotes.detail}${tasks}`.trim()
    });
  } else if (season) {
    const highlight = season.activeFestival || season.nextFestival;
    if (highlight) {
      const days = highlight.daysUntilFestival;
      let detail = '';
      if (typeof days === 'number') {
        if (days === 0) {
          detail = 'Festival day is here!';
        } else if (days > 0) {
          const label = days === 1 ? 'day' : 'days';
          detail = `Festival in ${days} ${label}.`;
        }
      }
      if (highlight.note) {
        detail = detail ? `${detail} ${highlight.note}` : highlight.note;
      }
      const tasks = highlight.tasks && highlight.tasks.length ? ` Tasks: ${highlight.tasks.join(' • ')}` : '';
      base.push({
        title: `${season.season.name} • ${highlight.name}`,
        detail: `${detail}${tasks}`.trim()
      });
    }
  }
  return base;
}

function buildPlan(save: SaveData) {
  const queue = shuffle(Object.keys(miniGames)) as MiniGameKey[];
  const season = State.getSeasonContext(save.day);
  const eventPlan = PersonalityEngine.planDay(save, season);
  return {
    queue,
    eventPlan,
    season,
    previewNotes: buildPreviewNotes(queue, eventPlan, season),
    signature: planSignature(save)
  };
}

function ensurePlan(save: SaveData) {
  const signature = planSignature(save);
  if (!preparedPlan || preparedPlan.signature !== signature) {
    preparedPlan = buildPlan(save);
  }
  return preparedPlan;
}

function pickParticipants(cows: Cow[], count: number, plannedEvent: PlannedEvent | null): Cow[] {
  if (!Array.isArray(cows) || !cows.length) return [];
  const desired = Math.min(count, cows.length);
  const selection: Cow[] = [];
  if (plannedEvent?.personality) {
    const matches = cows.filter(cow => cow.personality === plannedEvent.personality);
    if (matches.length) {
      const chosen = pick(matches);
      if (chosen) {
        selection.push(chosen);
      }
    }
  }
  const remainingPool = cows.filter(cow => !selection.includes(cow));
  const extras = sample(remainingPool, Math.max(0, desired - selection.length));
  return selection.concat(extras);
}

function mergeAdjustments(target: CowAdjustments, addition: CowAdjustments) {
  if (!addition) return;
  Object.keys(addition).forEach(id => {
    const source = addition[id];
    if (!target[id]) target[id] = {};
    const dest = target[id]!;
    ['happiness', 'hunger', 'cleanliness', 'chonk'].forEach(key => {
      if (typeof source[key] === 'number') {
        dest[key] = (dest[key] || 0) + source[key];
      }
    });
    if (Array.isArray(source.servedTreats) && source.servedTreats.length) {
      const merged = dest.servedTreats ? dest.servedTreats.slice() : [];
      dest.servedTreats = merged.concat(source.servedTreats);
    }
    if (typeof source.addAccessory === 'string' && source.addAccessory.trim()) {
      dest.addAccessory = source.addAccessory;
    }
  });
}

function chooseReward(
  save: SaveData,
  context: { perfectDay: boolean; streakBefore: number; nextPerfectStreak: number; lastRewardType?: string | null },
  seasonContext?: SeasonProgressSnapshot
) {
  const unlocks = save.unlocks || {};
  const seasonal = seasonContext || State.getSeasonContext(save.day);
  const activeFestival = seasonal?.activeFestival;
  if (
    activeFestival &&
    activeFestival.reward &&
    context.perfectDay &&
    !State.isFestivalComplete(activeFestival.id)
  ) {
    const rewardData = activeFestival.reward;
    const typeLabel = rewardData.type.charAt(0).toUpperCase() + rewardData.type.slice(1);
    const guaranteedBy = rewardData.reason || `${activeFestival.name} milestone`;
    return {
      type: rewardData.type,
      item: rewardData.item,
      typeLabel,
      theme: activeFestival.name,
      festivalId: activeFestival.id,
      guaranteedBy
    };
  }
  const rewardThemes = [
    {
      name: 'Highland Picnic',
      items: [
        { type: 'accessories', item: 'Pastel Bow' },
        { type: 'decor', item: 'Tartan Picnic Rug' },
        { type: 'foods', item: 'Sweet Clover Bale' }
      ]
    },
    {
      name: 'Forest Trimmings',
      items: [
        { type: 'accessories', item: 'Fern Garland' },
        { type: 'decor', item: 'Wildflower Patch' },
        { type: 'foods', item: 'Heather Honey Jar' }
      ]
    },
    {
      name: 'Sunlit Outing',
      items: [
        { type: 'accessories', item: 'Sun Hat' },
        { type: 'accessories', item: 'Starry Bandana' },
        { type: 'foods', item: 'Crisp Apple Crate' }
      ]
    },
    {
      name: 'Cozy Evenings',
      items: [
        { type: 'accessories', item: 'Woolly Scarf' },
        { type: 'decor', item: 'Fairy Lights Garland' },
        { type: 'decor', item: 'Stone Cairn Lantern' }
      ]
    },
    {
      name: 'Barnyard Keepsakes',
      items: [
        { type: 'accessories', item: 'Bell Charm' },
        { type: 'decor', item: 'Milk Churn Planter' },
        { type: 'foods', item: 'Barley Biscuit Stack' }
      ]
    }
  ];

  const themed = rewardThemes
    .map(theme => {
      const missing = theme.items
        .filter(entry => {
          const list = unlocks[entry.type as keyof typeof unlocks] || [];
          return !(list as string[]).includes(entry.item);
        })
        .map(entry => ({
          type: entry.type as 'foods' | 'accessories' | 'decor',
          item: entry.item,
          typeLabel: entry.type.charAt(0).toUpperCase() + entry.type.slice(1),
          theme: theme.name,
          themeMissing: theme.items.length
        }));
      return { theme: theme.name, missing };
    })
    .filter(entry => entry.missing.length);

  if (!themed.length) return null;

  const byType: Record<'foods' | 'accessories' | 'decor', any[]> = { foods: [], accessories: [], decor: [] };
  themed.forEach(entry => {
    entry.missing.forEach(item => {
      byType[item.type].push(item);
    });
  });

  function pickFromType(type: 'foods' | 'accessories' | 'decor') {
    const pool = byType[type] || [];
    if (!pool.length) return null;
    const maxMissing = Math.max(...pool.map(item => item.themeMissing || 1));
    const candidates = pool.filter(item => item.themeMissing === maxMissing);
    return pick(candidates);
  }

  const perfectDay = !!context.perfectDay;
  const stats = save.stats || {};
  const baseStreak = typeof context.streakBefore === 'number' ? context.streakBefore : (stats.perfectDayStreak || 0);
  const nextStreak = typeof context.nextPerfectStreak === 'number' ? context.nextPerfectStreak : (perfectDay ? baseStreak + 1 : 0);
  const lastRewardType = context.lastRewardType || stats.lastRewardType || null;

  let guaranteedBy: string | null = null;
  let reward = null;

  if (!reward && nextStreak && nextStreak % 3 === 0) {
    const candidate = pickFromType('decor');
    if (candidate) {
      reward = candidate;
      const suffix = nextStreak === 1 ? 'day' : 'days';
      guaranteedBy = `Perfect-day streak (${nextStreak} ${suffix})`;
    }
  }

  if (!reward && perfectDay) {
    const candidate = pickFromType('accessories');
    if (candidate) {
      reward = candidate;
      guaranteedBy = 'Perfect day bonus';
    }
  }

  if (!reward) {
    const typePreference: Array<'accessories' | 'decor' | 'foods'> = ['accessories', 'decor', 'foods'];
    if (lastRewardType) {
      const index = typePreference.indexOf(lastRewardType as any);
      if (index >= 0) {
        typePreference.splice(index, 1);
        typePreference.push(lastRewardType as any);
      }
    }
    for (let i = 0; i < typePreference.length && !reward; i++) {
      reward = pickFromType(typePreference[i]);
    }
  }

  if (!reward) return null;

  return Object.assign({ guaranteedBy }, reward);
}

async function playMiniGame(key: MiniGameKey, context: MiniGameStartContext): Promise<MiniGameResult> {
  const game = miniGames[key];
  return new Promise(resolve => {
    const startContext: MiniGameContext = {
      ...context,
      onComplete: result => {
        game.stop();
        resolve(result);
      }
    };
    game.start(startContext);
  });
}

export async function startDay(): Promise<void> {
  if (running) return;
  running = true;
  const save = State.getData();
  const familyChallenge = State.getFamilyChallenge();
  const familyParticipants = familyChallenge.participants || [];
  const familyActive = familyChallenge.enabled && familyParticipants.length > 0;
  let familyRotationIndex = familyActive && familyParticipants.length
    ? familyChallenge.rotationIndex % familyParticipants.length
    : 0;
  const familyAssignments: FamilyChallengeAssignment[] = [];
  const plan = ensurePlan(save);
  const queue = plan ? plan.queue.slice() : (shuffle(Object.keys(miniGames)) as MiniGameKey[]);
  const seasonContext = plan ? plan.season : State.getSeasonContext(save.day);
  const eventPlan = plan ? plan.eventPlan : PersonalityEngine.planDay(save, seasonContext);
  const results: SummaryUI.SummaryData = {
    results: [],
    adjustments: {},
    herd: save.cows,
    stats: { totalPerfects: 0, totalChonks: 0 },
    day: save.day,
    reward: null,
    achievementsUnlocked: [],
    perfectDay: false,
    perfectStreak: 0,
    previousPerfectStreak: save.stats?.perfectDayStreak || 0,
    season: seasonContext,
    festivalResult: undefined
  };
  const options = Object.assign({}, save.options);
  const availableFoods = State.getUnlocks('foods');

  mountMiniGames();

  TaskRush.setContinueVisible(false);
  TaskRush.enableContinue(false);
  TaskRush.show();

  for (let i = 0; i < queue.length; i++) {
    const key = queue[i];
    const info = miniGames[key];
    const plannedEvent = eventPlan.events?.[key] || null;
    const participants = pickParticipants(save.cows, Math.min(3, save.cows.length), plannedEvent);
    const event = PersonalityEngine.eventForMini(key, participants, eventPlan);
    const instructionParts = [info.description];
    if (event) {
      instructionParts.push(`${event.label}: ${event.instruction}`);
    }
    const familyCaretaker = familyActive && familyParticipants.length
      ? familyParticipants[familyRotationIndex % familyParticipants.length]
      : null;
    const displayName = familyCaretaker ? `${info.label} • ${familyCaretaker.name}` : info.label;
    if (familyCaretaker && familyParticipants.length) {
      familyRotationIndex = (familyRotationIndex + 1) % familyParticipants.length;
      instructionParts.push(`Caretaker: ${familyCaretaker.name}`);
    }
    TaskRush.setMiniTitle(displayName, i + 1, queue.length, info.icon);
    TaskRush.setInstruction(instructionParts.join(' '));

    const outcome = await playMiniGame(key, {
      participants,
      difficulty: Math.min(10, save.day + i),
      updateTimer: TaskRush.updateTimer,
      updateInstruction: TaskRush.setInstruction,
      options,
      modifiers: event ? event.modifiers : null,
      foods: availableFoods
    });

    PersonalityEngine.applyOutcome(event, outcome, participants);
    results.results.push({
      name: displayName,
      success: !!outcome.success,
      summary: outcome.summary || (outcome.success ? 'Great job!' : 'We will get it tomorrow.'),
      icon: info.icon,
      key
    });
    if (familyCaretaker) {
      const perfect = !!(
        outcome.success &&
        (typeof outcome.stats?.totalPerfects !== 'number' || outcome.stats.totalPerfects > 0)
      );
      familyAssignments.push({
        participantId: familyCaretaker.id,
        miniGame: key,
        success: !!outcome.success,
        perfect
      });
    }
    mergeAdjustments(results.adjustments, outcome.adjustments);
    if (outcome.stats) {
      results.stats!.totalPerfects = (results.stats!.totalPerfects || 0) + (outcome.stats.totalPerfects || 0);
      results.stats!.totalChonks = (results.stats!.totalChonks || 0) + (outcome.stats.totalChonks || 0);
    }
    if (event && event.achievementOnSuccess && outcome.success) {
      if (State.unlockAchievement(event.achievementOnSuccess)) {
        results.achievementsUnlocked!.push(event.achievementOnSuccess);
      }
    }
  }

  State.applyCowAdjustments(results.adjustments);
  const perfectDay = results.results.length > 0 && results.results.every(entry => entry.success);
  results.perfectDay = perfectDay;
  if (familyActive) {
    const familySummary = State.completeFamilyChallengeDay({
      assignments: familyAssignments,
      perfectDay,
      day: save.day,
      nextRotationIndex: familyParticipants.length ? familyRotationIndex % familyParticipants.length : 0
    });
    if (familySummary) {
      results.familyChallenge = familySummary;
      familySummary.unlockedAchievements?.forEach(key => {
        if (!results.achievementsUnlocked!.includes(key)) {
          results.achievementsUnlocked!.push(key);
        }
      });
    }
  }
  if (perfectDay) {
    if (State.unlockAchievement('perfectDay')) {
      results.achievementsUnlocked!.push('perfectDay');
    }
  }

  const previousStreak = save.stats?.perfectDayStreak || 0;
  const nextStreak = perfectDay ? previousStreak + 1 : 0;
  let reward = chooseReward(save, {
    perfectDay,
    streakBefore: previousStreak,
    nextPerfectStreak: nextStreak,
    lastRewardType: save.stats?.lastRewardType
  }, seasonContext);
  if (reward) {
    const added = State.addUnlock(reward.type, reward.item);
    if (reward.festivalId) {
      State.markFestivalComplete(reward.festivalId);
      if (seasonContext?.activeFestival && seasonContext.activeFestival.id === reward.festivalId) {
        seasonContext.activeFestival.completed = true;
      }
      if (seasonContext?.nextFestival && seasonContext.nextFestival.id === reward.festivalId) {
        seasonContext.nextFestival.completed = true;
      }
      const festivalName =
        seasonContext?.activeFestival?.id === reward.festivalId
          ? seasonContext.activeFestival.name
          : seasonContext?.nextFestival?.id === reward.festivalId
            ? seasonContext.nextFestival.name
            : reward.theme || State.getFestivalName(reward.festivalId) || reward.item;
      results.festivalResult = {
        id: reward.festivalId,
        name: festivalName,
        rewardUnlocked: added,
        rewardItem: reward.item,
        rewardType: reward.type,
        guaranteedBy: reward.guaranteedBy || null
      };
    }
    if (added) {
      results.reward = reward;
    } else {
      reward = null;
    }
  }

  State.recordStats(results.stats || {});
  const dayOutcomeStats = State.registerDayOutcome({
    perfectDay,
    rewardType: reward ? reward.type : null,
    perfectStreak: nextStreak
  });
  results.perfectStreak = dayOutcomeStats?.perfectDayStreak ?? nextStreak;
  results.bestPerfectStreak = dayOutcomeStats?.bestPerfectDayStreak ?? save.stats?.bestPerfectDayStreak;

  State.incrementDay();
  if (State.evaluateChonkSentinel()) {
    results.achievementsUnlocked!.push('chonkSentinel');
  }

  lastResults = results;
  SummaryUI.renderSummary(results);
  SummaryUI.show();
  State.saveNow();
  preparedPlan = null;
  running = false;
}

export function getLastResults(): SummaryUI.SummaryData | null {
  return lastResults;
}

export function getPreviewPlan(save: SaveData) {
  return ensurePlan(save || State.getData());
}

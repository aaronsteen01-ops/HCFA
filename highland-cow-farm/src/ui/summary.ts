import type { Cow, CowAdjustments, FamilyChallengeDaySummary, SeasonProgressSnapshot } from '../types';
import { showScreen } from '../core/screens';
import { FoodLibrary } from '../data/foods';
import { AccessoryLibrary } from '../data/accessories';
import { DecorLibrary } from '../data/decor';
import { ACHIEVEMENTS } from '../data/achievements';
import type { MiniGameKey } from '../minigames/types';

const MINI_LABELS: Record<MiniGameKey, string> = {
  catch: 'Catch the Cow',
  food: 'Food Frenzy',
  brush: 'Brush Rush',
  ceilidh: 'Highland Ceilidh'
};

interface SummaryHandlers {
  onContinue?: () => void;
}

export interface SummaryData {
  results: Array<{ name: string; success: boolean; summary: string; icon?: string; key?: MiniGameKey }>;
  adjustments: CowAdjustments;
  herd: Cow[];
  reward?: {
    type: 'foods' | 'accessories' | 'decor';
    item: string;
    typeLabel?: string;
    theme?: string;
    guaranteedBy?: string | null;
    festivalId?: string;
  } | null;
  stats?: { totalPerfects?: number; totalChonks?: number };
  day?: number;
  achievementsUnlocked?: string[];
  perfectDay?: boolean;
  perfectStreak?: number;
  previousPerfectStreak?: number;
  bestPerfectStreak?: number;
  season?: SeasonProgressSnapshot;
  festivalResult?: {
    id: string;
    name: string;
    rewardUnlocked: boolean;
    rewardItem?: string;
    rewardType?: 'foods' | 'accessories' | 'decor';
    guaranteedBy?: string | null;
  };
  familyChallenge?: FamilyChallengeDaySummary;
}

let handlers: SummaryHandlers = {};
let initialised = false;
let resultsEl: HTMLElement | null = null;
let cowDeltasEl: HTMLElement | null = null;
let unlockEl: HTMLElement | null = null;
let continueButton: HTMLButtonElement | null = null;

function buildMiniIcon(icon?: string): HTMLElement | null {
  if (!icon) return null;
  const holder = document.createElement('span');
  holder.className = 'mini-title-icon summary-icon';
  holder.setAttribute('aria-hidden', 'true');
  if (icon.startsWith('data:image')) {
    const img = document.createElement('img');
    img.src = icon;
    img.alt = '';
    img.className = 'mini-title-icon-img';
    holder.appendChild(img);
  } else {
    holder.textContent = icon;
  }
  return holder;
}

export function configureSummaryHandlers(partial: SummaryHandlers): void {
  handlers = Object.assign({}, handlers, partial);
}

export function init(section: HTMLElement): void {
  if (initialised) return;
  initialised = true;
  resultsEl = section.querySelector<HTMLElement>('#summary-results');
  cowDeltasEl = section.querySelector<HTMLElement>('#summary-cow-deltas');
  unlockEl = section.querySelector<HTMLElement>('#summary-unlock');
  continueButton = section.querySelector<HTMLButtonElement>('#btn-summary-continue');
  continueButton?.addEventListener('click', () => {
    handlers.onContinue?.();
  });
}

export function show(): void {
  showScreen('summary');
}

export function renderSummary(data: SummaryData): void {
  if (!resultsEl || !cowDeltasEl || !unlockEl) return;
  const {
    results = [],
    adjustments = {},
    herd = [],
    reward,
    stats,
    day,
    perfectDay,
    perfectStreak,
    previousPerfectStreak,
    achievementsUnlocked = [],
    season,
    festivalResult,
    familyChallenge
  } = data;

  resultsEl.innerHTML = '';
  const fragment = document.createDocumentFragment();
  const totalGames = results.length;

  if (typeof perfectDay === 'boolean') {
    const perfectItem = document.createElement('div');
    perfectItem.className = 'summary-item';
    if (perfectDay) {
      const streakCount = Math.max(0, Number(perfectStreak) || 0);
      const label = streakCount === 1 ? 'day' : 'days';
      const miniLabel = totalGames
        ? `All ${totalGames} mini-${totalGames === 1 ? 'game' : 'games'} cleared with smiles.`
        : 'All mini-games cleared with smiles.';
      perfectItem.innerHTML = `<strong>Perfect Pastures!</strong><br>${miniLabel}<br>Perfect-day streak: ${streakCount} ${label}.`;
    } else {
      const streakLost = Math.max(0, Number(previousPerfectStreak) || 0);
      const label = streakLost === 1 ? 'day' : 'days';
      const streakMessage = streakLost ? `The streak pauses after ${streakLost} ${label}.` : 'Your next perfect-day streak begins tomorrow.';
      perfectItem.innerHTML = `<strong>Almost There</strong><br>Not every task was flawless today.<br>${streakMessage}`;
    }
    fragment.appendChild(perfectItem);
  }

  if (familyChallenge?.enabled && familyChallenge.leaderboard?.length) {
    const familyItem = document.createElement('div');
    familyItem.className = 'summary-item summary-family';
    const title = document.createElement('strong');
    title.textContent = 'Family Challenge';
    familyItem.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'summary-item-text';
    const streakLabel = familyChallenge.streak === 1 ? 'day' : 'days';
    const bestLabel = familyChallenge.bestStreak === 1 ? 'day' : 'days';
    const metaParts = [`Shared streak: ${familyChallenge.streak} ${streakLabel}`];
    metaParts.push(`Best: ${familyChallenge.bestStreak} ${bestLabel}`);
    if (familyChallenge.mvpName) {
      metaParts.push(`MVP: ${familyChallenge.mvpName}`);
    }
    if (familyChallenge.nextPlayer) {
      metaParts.push(`Next up: ${familyChallenge.nextPlayer.name}`);
    }
    meta.textContent = metaParts.join(' • ');
    familyItem.appendChild(meta);

    const leaderboard = document.createElement('div');
    leaderboard.className = 'family-leaderboard';
    familyChallenge.leaderboard.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'family-leaderboard-row';
      if (entry.isMvp) {
        row.classList.add('is-mvp');
      }
      const name = document.createElement('span');
      name.className = 'family-leaderboard-name';
      name.textContent = entry.name;
      row.appendChild(name);
      const statsLine = document.createElement('span');
      statsLine.className = 'family-leaderboard-stats';
      statsLine.textContent = `Perfects ${entry.perfects} • Wins ${entry.wins} • Score ${entry.score}`;
      row.appendChild(statsLine);
      if (entry.isMvp) {
        const badge = document.createElement('span');
        badge.className = 'family-leaderboard-badge';
        badge.textContent = 'MVP ⭐';
        row.appendChild(badge);
      } else if (entry.mvpCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'family-leaderboard-badge history';
        badge.textContent = `MVP ×${entry.mvpCount}`;
        row.appendChild(badge);
      }
      leaderboard.appendChild(row);
    });
    familyItem.appendChild(leaderboard);

    if (familyChallenge.assignments?.length) {
      const assignmentList = document.createElement('ul');
      assignmentList.className = 'family-assignments';
      familyChallenge.assignments.forEach(entry => {
        const li = document.createElement('li');
        const status = entry.perfect ? '🌟' : entry.success ? '✅' : '⚠️';
        const label = MINI_LABELS[entry.miniGame] || entry.miniGame;
        li.textContent = `${status} ${entry.name} — ${label}`;
        assignmentList.appendChild(li);
      });
      familyItem.appendChild(assignmentList);
    }

    fragment.appendChild(familyItem);
  }

  if (season) {
    const highlight = season.activeFestival || season.nextFestival;
    const seasonItem = document.createElement('div');
    seasonItem.className = 'summary-item summary-season';
    const title = document.createElement('strong');
    title.textContent = highlight ? `${season.season.name} • ${highlight.name}` : season.season.name;
    seasonItem.appendChild(title);
    const detailLines: string[] = [];
    if (highlight) {
      if (festivalResult && festivalResult.id === highlight.id) {
        if (festivalResult.rewardUnlocked) {
          const rewardText = festivalResult.rewardItem
            ? `${festivalResult.rewardItem} unlocked!`
            : 'Seasonal reward unlocked!';
          detailLines.push(`Festival milestone complete. ${rewardText}`);
        } else {
          detailLines.push('Festival goals met – reward already owned.');
        }
        if (festivalResult.guaranteedBy) {
          detailLines.push(`Guaranteed by ${festivalResult.guaranteedBy}.`);
        }
      } else if (typeof highlight.daysUntilFestival === 'number') {
        if (highlight.daysUntilFestival === 0) {
          detailLines.push('Festival day is underway!');
        } else if (highlight.daysUntilFestival > 0) {
          const label = highlight.daysUntilFestival === 1 ? 'day' : 'days';
          detailLines.push(`Festival in ${highlight.daysUntilFestival} ${label}.`);
        }
      }
      if (highlight.note) {
        detailLines.push(highlight.note);
      }
    }
    const summary = document.createElement('div');
    summary.className = 'summary-item-text';
    summary.textContent = detailLines.join(' ');
    seasonItem.appendChild(summary);
    const tasks = highlight?.tasks?.length ? highlight.tasks : season.season.festivalTasks;
    if (tasks && tasks.length) {
      const list = document.createElement('ul');
      list.className = 'season-task-list';
      tasks.forEach(task => {
        const li = document.createElement('li');
        li.textContent = task;
        list.appendChild(li);
      });
      seasonItem.appendChild(list);
    }
    fragment.appendChild(seasonItem);
  }

  results.forEach(result => {
    const item = document.createElement('div');
    item.className = 'summary-item';
    const statusEmoji = result.success ? '🌟' : '⚠️';
    const title = document.createElement('strong');
    title.appendChild(document.createTextNode(`${statusEmoji} `));
    const iconEl = buildMiniIcon(result.icon);
    if (iconEl) {
      title.appendChild(iconEl);
      title.appendChild(document.createTextNode(' '));
    }
    title.appendChild(document.createTextNode(result.name));
    const summaryLine = document.createElement('div');
    summaryLine.className = 'summary-item-text';
    const summaryText = result.summary || (result.success ? 'Great job!' : 'We will get it tomorrow.');
    summaryLine.textContent = summaryText;
    item.appendChild(title);
    item.appendChild(summaryLine);
    fragment.appendChild(item);
  });

  if (stats && (stats.totalPerfects || stats.totalChonks)) {
    const statsItem = document.createElement('div');
    statsItem.className = 'summary-item';
    statsItem.innerHTML = `<strong>Farm Stats</strong><br>Perfect clears today: ${stats.totalPerfects || 0}<br>Chonky moments: ${stats.totalChonks || 0}`;
    fragment.appendChild(statsItem);
  }

  if (achievementsUnlocked.length) {
    const achItem = document.createElement('div');
    achItem.className = 'summary-item';
    const names = achievementsUnlocked.map(key => ACHIEVEMENTS[key]?.title || key);
    achItem.innerHTML = `<strong>New Achievements</strong><br>${names.join('<br>')}`;
    fragment.appendChild(achItem);
  }

  if (typeof day === 'number') {
    const dayItem = document.createElement('div');
    dayItem.className = 'summary-item';
    dayItem.innerHTML = `<strong>Day ${day - 1} complete!</strong><br>Next up: Day ${day}.`;
    fragment.appendChild(dayItem);
  }

  resultsEl.appendChild(fragment);

  cowDeltasEl.innerHTML = '';
  herd.forEach(cow => {
    const delta = adjustments[cow.id];
    if (!delta) return;
    const deltaStrings: string[] = [];
    if (delta.happiness) deltaStrings.push(`Happiness ${delta.happiness > 0 ? '+' : ''}${Math.round(delta.happiness)}`);
    if (delta.hunger) deltaStrings.push(`Hunger ${delta.hunger > 0 ? '+' : ''}${Math.round(delta.hunger)}`);
    if (delta.cleanliness) deltaStrings.push(`Cleanliness ${delta.cleanliness > 0 ? '+' : ''}${Math.round(delta.cleanliness)}`);
    if (delta.chonk) deltaStrings.push(`Chonk ${delta.chonk > 0 ? '+' : ''}${Math.round(delta.chonk)}`);
    const row = document.createElement('div');
    row.className = 'summary-cow';
    row.innerHTML = `<span>${cow.name}</span><span>${deltaStrings.join(' • ') || 'No changes'}</span>`;
    cowDeltasEl.appendChild(row);
  });

  if (reward) {
    unlockEl.hidden = false;
    unlockEl.innerHTML = '';
    const themeText = reward.theme ? ` • ${reward.theme}` : '';
    let rewardIcon = '';
    if (reward.type === 'foods') {
      rewardIcon = FoodLibrary[reward.item]?.icon || '🍀';
    } else if (reward.type === 'accessories') {
      rewardIcon = AccessoryLibrary[reward.item]?.icon || '⭐';
    } else if (reward.type === 'decor') {
      rewardIcon = DecorLibrary[reward.item]?.icon || '✨';
    }
    const iconPrefix = rewardIcon ? `${rewardIcon} ` : '';
    const title = document.createElement('div');
    title.className = 'unlock-title';
    title.textContent = `Unlocked: ${iconPrefix}${reward.item} (${reward.typeLabel || reward.type})${themeText}!`;
    unlockEl.appendChild(title);
    if (reward.guaranteedBy) {
      const reason = document.createElement('div');
      reason.className = 'unlock-reason';
      reason.textContent = `Guaranteed by: ${reward.guaranteedBy}.`;
      unlockEl.appendChild(reason);
    }
  } else {
    unlockEl.hidden = true;
    unlockEl.innerHTML = '';
  }
}

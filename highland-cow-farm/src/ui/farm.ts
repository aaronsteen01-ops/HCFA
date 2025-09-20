import type { AchievementMap, Cow, DecorLayout } from '../types';
import { showScreen } from '../core/screens';
import { AccessoryLibrary } from '../data/accessories';
import { ACHIEVEMENTS } from '../data/achievements';
import { DecorLibrary } from '../data/decor';
import { DECOR_SLOTS, DECOR_SLOT_LABELS } from '../data/constants';
import { svg } from '../game/cowVisuals';
import { renderPantry as renderPantryList } from '../game/pantry';

interface FarmHandlers {
  onStartDay?: () => void;
  onOptions?: () => void;
  onEditCow?: (cowId: string) => void;
  onManageDecor?: () => void;
}

let handlers: FarmHandlers = {};
let initialised = false;
let herdGrid: HTMLElement | null = null;
let eventsList: HTMLElement | null = null;
let pantryList: HTMLElement | null = null;
let decorDisplay: HTMLElement | null = null;
let achievementList: HTMLElement | null = null;

export function configureFarmHandlers(partial: FarmHandlers): void {
  handlers = Object.assign({}, handlers, partial);
}

type CowMoodState = 'thriving' | 'content' | 'hungry' | 'muddy' | 'unhappy';

interface CowMoodDetails {
  icon: string;
  state: CowMoodState;
}

function moodDetails(cow: Cow): CowMoodDetails {
  const happiness = cow.happiness;
  const hunger = cow.hunger;
  const cleanliness = cow.cleanliness;
  if (happiness > 75 && hunger < 50 && cleanliness > 60) {
    return { icon: '😊', state: 'thriving' };
  }
  if (hunger > 70) {
    return { icon: '🥕', state: 'hungry' };
  }
  if (cleanliness < 40) {
    return { icon: '🪣', state: 'muddy' };
  }
  if (happiness < 40) {
    return { icon: '😟', state: 'unhappy' };
  }
  return { icon: '🙂', state: 'content' };
}

function moodIcon(cow: Cow): string {
  return moodDetails(cow).icon;
}

function heartsForChonk(chonk: number): string {
  const filled = Math.min(3, Math.round(chonk / 33));
  let hearts = '';
  for (let i = 0; i < 3; i++) {
    hearts += i < filled ? '❤' : '♡';
  }
  return hearts;
}

function renderAccessoryChips(cow: Cow): string {
  if (!cow.accessories || !cow.accessories.length) {
    return '<span class="accessory-chip">No accessories yet</span>';
  }
  return cow.accessories
    .map(name => {
      const entry = AccessoryLibrary[name];
      const icon = entry?.icon || '⭐';
      return `<span class="accessory-chip" title="${name}">${icon} ${name}</span>`;
    })
    .join('');
}

function slotLabel(slot: string): string {
  return DECOR_SLOT_LABELS[slot as keyof typeof DECOR_SLOT_LABELS] || slot;
}

function renderDecorScene(container: HTMLElement, layout: DecorLayout): void {
  container.innerHTML = '';
  DECOR_SLOTS.forEach(slot => {
    const slotEl = document.createElement('div');
    slotEl.className = `decor-slot decor-slot-${slot}`;
    const selection = layout[slot];
    if (selection && DecorLibrary[selection]) {
      slotEl.classList.add('active');
      const icon = document.createElement('div');
      icon.className = 'decor-icon';
      icon.textContent = DecorLibrary[selection].icon || '✨';
      const label = document.createElement('span');
      label.className = 'decor-label';
      label.textContent = selection;
      slotEl.appendChild(icon);
      slotEl.appendChild(label);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'decor-placeholder';
      placeholder.textContent = slotLabel(slot);
      slotEl.appendChild(placeholder);
    }
    container.appendChild(slotEl);
  });
}

export function init(section: HTMLElement): void {
  if (initialised) return;
  initialised = true;
  herdGrid = section.querySelector<HTMLElement>('#herd-grid');
  eventsList = section.querySelector<HTMLElement>('#farm-events');
  pantryList = section.querySelector<HTMLElement>('#pantry-list');
  decorDisplay = section.querySelector<HTMLElement>('#decor-display');
  achievementList = section.querySelector<HTMLElement>('#achievement-list');
  const startDayButton = section.querySelector<HTMLButtonElement>('#btn-start-day');
  const optionsButton = section.querySelector<HTMLButtonElement>('#btn-farm-options');
  const decorButton = section.querySelector<HTMLButtonElement>('#btn-manage-decor');

  startDayButton?.addEventListener('click', () => {
    handlers.onStartDay?.();
  });

  optionsButton?.addEventListener('click', () => {
    handlers.onOptions?.();
  });

  decorButton?.addEventListener('click', () => {
    handlers.onManageDecor?.();
  });

  herdGrid?.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.style-btn');
    if (button && button.dataset.cow) {
      handlers.onEditCow?.(button.dataset.cow);
    }
  });
}

export function show(): void {
  showScreen('farm');
}

export function renderHerd(cows: Cow[]): void {
  if (!herdGrid) return;
  const fragment = document.createDocumentFragment();
  cows.forEach(cow => {
    const card = document.createElement('article');
    card.className = 'cow-card';
    const { icon: moodEmoji, state: moodState } = moodDetails(cow);
    card.dataset.colour = cow.colour;
    card.dataset.mood = moodState;
    if (cow.chonk >= 65) {
      card.classList.add('is-chonk');
    }
    card.innerHTML = `
      <h3>${cow.name} <span class="personality">${cow.personality}</span></h3>
      ${svg(cow)}
      <div class="status-row"><span>Mood ${moodEmoji}</span><span>Chonk <span class="chonk-hearts">${heartsForChonk(cow.chonk)}</span></span></div>
      <div class="status-row"><span>Happy ${Math.round(cow.happiness)}</span><span>Hunger ${Math.round(cow.hunger)}</span></div>
      <div class="status-row"><span>Clean ${Math.round(cow.cleanliness)}</span><span>Accessories ${cow.accessories.length}</span></div>
      <div class="accessory-chips">${renderAccessoryChips(cow)}</div>
      <button type="button" class="style-btn" data-cow="${cow.id}">Style ${cow.name}</button>`;
    fragment.appendChild(card);
  });
  herdGrid.innerHTML = '';
  herdGrid.appendChild(fragment);
}

export function renderEvents(events: Array<{ title?: string; detail?: string } | string>): void {
  if (!eventsList) return;
  eventsList.innerHTML = '';
  const fallback = { title: 'No special events', detail: 'A peaceful breeze across the paddock.' };
  const list = Array.isArray(events) && events.length ? events : [fallback];
  list.forEach(entry => {
    const li = document.createElement('li');
    if (typeof entry === 'string') {
      li.textContent = entry;
    } else {
      const title = entry?.title || '';
      const detail = entry?.detail || '';
      if (title) {
        const strong = document.createElement('strong');
        strong.textContent = title;
        li.appendChild(strong);
      }
      if (detail) {
        const span = document.createElement('span');
        span.textContent = detail;
        li.appendChild(span);
      }
      if (!title && !detail) {
        li.textContent = fallback.detail;
      }
    }
    eventsList.appendChild(li);
  });
}

export function renderPantry(foods: string[]): void {
  if (!pantryList) return;
  renderPantryList(pantryList, foods);
}

export function renderDecor(layout: DecorLayout): void {
  if (!decorDisplay) return;
  renderDecorScene(decorDisplay, layout || { left: null, centre: null, right: null });
}

export function renderAchievements(achievements: AchievementMap): void {
  if (!achievementList) return;
  achievementList.innerHTML = '';
  Object.entries(ACHIEVEMENTS).forEach(([key, meta]) => {
    const li = document.createElement('li');
    if (achievements && achievements[key]) {
      li.classList.add('completed');
      li.textContent = `${meta.title} – complete!`;
    } else {
      li.textContent = `${meta.title} – ${meta.description}`;
    }
    achievementList.appendChild(li);
  });
}

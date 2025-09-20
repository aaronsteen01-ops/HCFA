import type { Cow } from '../types';
import { showScreen } from '../core/screens';
import { play } from '../core/audio';
import { AccessoryLibrary } from '../data/accessories';
import { ACCESSORY_LIMIT } from '../data/constants';
import { svg } from '../game/cowVisuals';

interface StyleHandlers {
  onBack?: () => void;
  onClear?: (cowId: string) => Cow | null;
  onRandomise?: (cowId: string) => Cow | null;
  onToggle?: (cowId: string, accessory: string) => Cow | null;
}

let handlers: StyleHandlers = {};
let initialised = false;
let previewEl: HTMLElement | null = null;
let listEl: HTMLElement | null = null;
let nameEl: HTMLElement | null = null;
let helperEl: HTMLElement | null = null;
let currentCow: Cow | null = null;
let currentUnlocks: string[] = [];

export function configureStyleHandlers(partial: StyleHandlers): void {
  handlers = Object.assign({}, handlers, partial);
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

function refreshStylePreview(): void {
  if (!currentCow || !previewEl) return;
  previewEl.innerHTML = `
          <div class="style-preview-art">${svg(currentCow, { className: 'cow-art-large', scale: 1.25, viewBox: '0 0 160 130' })}</div>
          <div class="accessory-chips">${renderAccessoryChips(currentCow)}</div>`;
}

function renderStyleList(): void {
  if (!listEl || !currentCow) return;
  listEl.innerHTML = '';
  if (!currentUnlocks.length) {
    const empty = document.createElement('p');
    empty.className = 'helper-text';
    empty.textContent = 'Unlock accessories from day rewards to start styling.';
    listEl.appendChild(empty);
    return;
  }
  currentUnlocks.forEach(name => {
    const entry = AccessoryLibrary[name];
    const row = document.createElement('div');
    row.className = 'style-item';
    const label = document.createElement('span');
    label.textContent = `${entry?.icon || '⭐'} ${name}`;
    if (entry?.description) {
      label.title = entry.description;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.accessory = name;
    const equipped = currentCow!.accessories.includes(name);
    button.classList.toggle('active', equipped);
    button.setAttribute('aria-pressed', equipped ? 'true' : 'false');
    button.textContent = equipped ? 'Equipped' : 'Add';
    row.appendChild(label);
    row.appendChild(button);
    listEl.appendChild(row);
  });
}

export function init(section: HTMLElement): void {
  if (initialised) return;
  initialised = true;
  previewEl = section.querySelector<HTMLElement>('#style-preview');
  listEl = section.querySelector<HTMLElement>('#style-accessory-list');
  nameEl = section.querySelector<HTMLElement>('#style-cow-name');
  helperEl = section.querySelector<HTMLElement>('#style-helper');
  const backButton = section.querySelector<HTMLButtonElement>('#btn-style-back');
  const clearButton = section.querySelector<HTMLButtonElement>('#btn-style-clear');
  const randomButton = section.querySelector<HTMLButtonElement>('#btn-style-random');

  backButton?.addEventListener('click', () => {
    showScreen('farm');
    handlers.onBack?.();
  });

  clearButton?.addEventListener('click', () => {
    if (!currentCow) return;
    const updated = handlers.onClear?.(currentCow.id);
    if (updated) {
      currentCow = updated;
      refreshStylePreview();
      renderStyleList();
      play('equip');
    }
  });

  randomButton?.addEventListener('click', () => {
    if (!currentCow) return;
    const updated = handlers.onRandomise?.(currentCow.id);
    if (updated) {
      currentCow = updated;
      refreshStylePreview();
      renderStyleList();
      play('equip');
    }
  });

  listEl?.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || !button.dataset.accessory || !currentCow) return;
    const updated = handlers.onToggle?.(currentCow.id, button.dataset.accessory);
    if (updated) {
      currentCow = updated;
      refreshStylePreview();
      renderStyleList();
      play('equip');
    }
  });
}

export function show(cow: Cow, unlocked: string[]): void {
  currentCow = { ...cow };
  currentUnlocks = unlocked.slice();
  if (nameEl) {
    nameEl.textContent = `${cow.name} • ${cow.personality}`;
  }
  if (helperEl) {
    helperEl.textContent = `Tap an accessory to toggle it. Up to ${ACCESSORY_LIMIT} can be worn at once.`;
  }
  renderStyleList();
  refreshStylePreview();
  showScreen('style');
}

import type { DecorLayout } from '../types';
import { showScreen } from '../core/screens';
import { DecorLibrary } from '../data/decor';
import { DECOR_SLOTS, DECOR_SLOT_LABELS } from '../data/constants';

interface DecorHandlers {
  onSave?: (layout: DecorLayout) => void;
  onBack?: () => void;
}

let handlers: DecorHandlers = {};
let initialised = false;
let manageList: HTMLElement | null = null;
let previewEl: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let currentOptions: string[] = [];
let draftLayout: DecorLayout = { left: null, centre: null, right: null };

export function configureDecorHandlers(partial: DecorHandlers): void {
  handlers = Object.assign({}, handlers, partial);
}

function slotLabel(slot: string): string {
  return DECOR_SLOT_LABELS[slot as keyof typeof DECOR_SLOT_LABELS] || slot;
}

function renderPreview(): void {
  if (!previewEl) return;
  previewEl.innerHTML = '';
  const layout = draftLayout;
  DECOR_SLOTS.forEach(slot => {
    const block = document.createElement('div');
    block.className = `decor-slot decor-slot-${slot}`;
    const value = layout[slot];
    if (value && DecorLibrary[value]) {
      block.classList.add('active');
      const icon = document.createElement('div');
      icon.className = 'decor-icon';
      icon.textContent = DecorLibrary[value].icon || '✨';
      const label = document.createElement('span');
      label.className = 'decor-label';
      label.textContent = value;
      block.appendChild(icon);
      block.appendChild(label);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'decor-placeholder';
      placeholder.textContent = slotLabel(slot);
      block.appendChild(placeholder);
    }
    previewEl.appendChild(block);
  });
}

function updateStatus(limitNotice = false): void {
  if (!statusEl) return;
  const assignedSlots = DECOR_SLOTS.filter(slot => draftLayout[slot]);
  if (!currentOptions.length) {
    statusEl.textContent = 'Unlock décor in the day summary to decorate the paddock.';
    statusEl.classList.remove('is-warning');
    return;
  }
  if (!assignedSlots.length) {
    statusEl.textContent = 'No décor assigned yet. Choose a cosy piece for each slot.';
  } else {
    const pieces = assignedSlots.map(slot => draftLayout[slot]).filter(Boolean) as string[];
    const uniqueCount = new Set(pieces).size;
    const slotNames = assignedSlots.map(slotLabel).join(', ');
    statusEl.textContent = `Displaying ${uniqueCount} décor piece${uniqueCount === 1 ? '' : 's'} across ${assignedSlots.length} slot${assignedSlots.length === 1 ? '' : 's'} (${slotNames}).`;
  }
  statusEl.classList.toggle('is-warning', limitNotice);
}

function enforceUniqueSelections(changedSlot: string): void {
  const value = draftLayout[changedSlot as keyof DecorLayout];
  if (!value) return;
  DECOR_SLOTS.forEach(slot => {
    if (slot !== changedSlot && draftLayout[slot] === value) {
      draftLayout[slot] = null;
      const otherSelect = manageList?.querySelector<HTMLSelectElement>(`select[data-slot="${slot}"]`);
      if (otherSelect) {
        otherSelect.value = '';
      }
    }
  });
}

export function init(section: HTMLElement): void {
  if (initialised) return;
  initialised = true;
  manageList = section.querySelector<HTMLElement>('#decor-manage-list');
  previewEl = section.querySelector<HTMLElement>('#decor-preview');
  statusEl = section.querySelector<HTMLElement>('#decor-limit-status');
  const saveButton = section.querySelector<HTMLButtonElement>('#btn-decor-save');
  const backButton = section.querySelector<HTMLButtonElement>('#btn-decor-back');

  saveButton?.addEventListener('click', () => {
    handlers.onSave?.({ ...draftLayout });
  });

  backButton?.addEventListener('click', () => {
    handlers.onBack?.();
  });

  manageList?.addEventListener('change', event => {
    const select = event.target as HTMLSelectElement;
    if (!select || !select.dataset.slot) return;
    const slot = select.dataset.slot as keyof DecorLayout;
    const value = select.value || null;
    if (value && !currentOptions.includes(value)) {
      select.value = draftLayout[slot] || '';
      return;
    }
    draftLayout[slot] = value;
    enforceUniqueSelections(slot);
    renderPreview();
    updateStatus();
  });
}

export function show(unlocked: string[], layout: DecorLayout): void {
  currentOptions = unlocked.slice();
  draftLayout = { left: null, centre: null, right: null, ...layout };
  if (!manageList) return;
  manageList.innerHTML = '';
  if (!currentOptions.length) {
    const empty = document.createElement('p');
    empty.className = 'helper-text';
    empty.textContent = 'Unlock décor in the day summary to decorate the paddock.';
    manageList.appendChild(empty);
  } else {
    DECOR_SLOTS.forEach(slot => {
      const wrapper = document.createElement('label');
      wrapper.className = 'decor-slot-control';
      const title = document.createElement('span');
      title.textContent = slotLabel(slot);
      const select = document.createElement('select');
      select.dataset.slot = slot;
      const noneOption = document.createElement('option');
      noneOption.value = '';
      noneOption.textContent = 'None';
      select.appendChild(noneOption);
      currentOptions.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = `${DecorLibrary[name]?.icon || '✨'} ${name}`;
        select.appendChild(option);
      });
      select.value = draftLayout[slot] || '';
      wrapper.appendChild(title);
      wrapper.appendChild(select);
      manageList!.appendChild(wrapper);
    });
  }
  renderPreview();
  updateStatus();
  showScreen('decor');
}

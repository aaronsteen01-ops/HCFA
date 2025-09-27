import type { Cow, CowJournalEntry } from '../types';
import { showScreen } from '../core/screens';
import * as State from '../core/state';
import { FoodLibrary } from '../data/foods';
import { svg } from '../game/cowVisuals';

interface JournalHandlers {
  onBack?: () => void;
  onDataChanged?: () => void;
}

let handlers: JournalHandlers = {};
let initialised = false;
let listEl: HTMLElement | null = null;
let backButton: HTMLButtonElement | null = null;
let refreshButton: HTMLButtonElement | null = null;

export function configureJournalHandlers(partial: JournalHandlers): void {
  handlers = Object.assign({}, handlers, partial);
}

function favouriteTreats(entry: CowJournalEntry): Array<{ name: string; count: number; icon: string }> {
  const pairs = Object.entries(entry.favouriteTreats || {});
  const sorted = pairs
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  return sorted.map(([name, count]) => {
    const icon = FoodLibrary[name]?.icon || '🍀';
    return { name, count, icon };
  });
}

function formatDay(day: number | undefined): string {
  if (!day || !Number.isFinite(day)) return 'Day ?';
  return `Day ${Math.max(1, Math.floor(day))}`;
}

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (err) {
    return '';
  }
}

function noteMarkup(entry: CowJournalEntry): string {
  if (!entry.notes.length) {
    return '<p class="journal-empty">No notes yet. Leave a quick memory below.</p>';
  }
  return entry.notes
    .slice()
    .reverse()
    .map(note => {
      const dateLabel = `${formatDay(note.day)} ${formatTimestamp(note.recordedISO)}`.trim();
      const meta = dateLabel ? `<span class="journal-note-meta">${dateLabel}</span>` : '';
      return `<li data-note="${note.id}"><div>${meta}<p>${note.text.replace(/</g, '&lt;')}</p></div><button type="button" class="ghost journal-note-delete" data-note="${note.id}" aria-label="Delete note">✖</button></li>`;
    })
    .join('');
}

function outfitSummary(entry: CowJournalEntry): string {
  if (!entry.outfits.length) {
    return '<p class="journal-empty">No outfits recorded yet.</p>';
  }
  return entry.outfits
    .slice()
    .reverse()
    .slice(0, 5)
    .map(outfit => {
      const accessories = outfit.accessories.length ? outfit.accessories.join(', ') : 'No accessories';
      const dateLabel = `${formatDay(outfit.day)} ${formatTimestamp(outfit.recordedISO)}`.trim();
      return `<li><strong>${dateLabel || 'Recent'}</strong><span>${accessories}</span></li>`;
    })
    .join('');
}

function renameHistory(entry: CowJournalEntry): string {
  if (!entry.names.length) {
    return '<p class="journal-empty">No custom names yet.</p>';
  }
  return entry.names
    .slice()
    .reverse()
    .slice(0, 5)
    .map(record => {
      const label = `${formatDay(record.day)} ${formatTimestamp(record.recordedISO)}`.trim();
      return `<li><strong>${record.name}</strong><span>${label || ''}</span></li>`;
    })
    .join('');
}

function snapshotPreview(entry: CowJournalEntry): string {
  if (!entry.snapshots.length) {
    return '<p class="journal-empty">No snapshots yet. Capture today\'s look!</p>';
  }
  const latest = entry.snapshots[entry.snapshots.length - 1];
  const label = `${formatDay(latest.day)} ${formatTimestamp(latest.recordedISO)}`.trim();
  return `<figure class="journal-snapshot"><img src="${latest.dataUri}" alt="Recent look" /><figcaption>${label || 'Latest look'}</figcaption></figure>`;
}

function buildCard(cow: Cow, entry: CowJournalEntry, day: number): HTMLElement {
  const card = document.createElement('article');
  card.className = 'journal-card';
  card.dataset.cow = cow.id;
  const treats = favouriteTreats(entry);
  const treatMarkup = treats.length
    ? treats
        .map(item => `<span class="journal-treat">${item.icon} ${item.name}<small>x${item.count}</small></span>`)
        .join('')
    : '<span class="journal-empty">No favourite treats logged yet.</span>';
  card.innerHTML = `
    <header class="journal-card-header">
      <div>
        <h3>${cow.name}</h3>
        <p class="journal-subtitle">${cow.personality} • ${formatDay(day)}</p>
      </div>
      <div class="journal-art" aria-hidden="true">${svg(cow, { className: 'journal-cow-art', scale: 1.05, viewBox: '0 0 160 130' })}</div>
    </header>
    <div class="journal-message" role="status" aria-live="polite"></div>
    <section class="journal-stats">
      <div><strong>Happiness</strong><span>${Math.round(cow.happiness)}</span></div>
      <div><strong>Hunger</strong><span>${Math.round(cow.hunger)}</span></div>
      <div><strong>Cleanliness</strong><span>${Math.round(cow.cleanliness)}</span></div>
      <div><strong>Chonk</strong><span>${Math.round(cow.chonk)}</span></div>
    </section>
    <section class="journal-section">
      <h4>Rename History</h4>
      <ul class="journal-list">${renameHistory(entry)}</ul>
      <form class="journal-rename-form" data-cow="${cow.id}">
        <label>Rename ${cow.name}
          <input type="text" name="name" maxlength="24" value="${cow.name}" />
        </label>
        <button type="submit">Save Name</button>
      </form>
    </section>
    <section class="journal-section">
      <h4>Accessory Moments</h4>
      <ul class="journal-list journal-outfits">${outfitSummary(entry)}</ul>
      <button type="button" class="ghost journal-snapshot-btn" data-cow="${cow.id}">Take Snapshot</button>
      <div class="journal-snapshot-area">${snapshotPreview(entry)}</div>
    </section>
    <section class="journal-section">
      <h4>Favourite Treats</h4>
      <div class="journal-treats">${treatMarkup}</div>
    </section>
    <section class="journal-section journal-notes">
      <h4>Notes</h4>
      <ul class="journal-notes-list">${noteMarkup(entry)}</ul>
      <form class="journal-note-form" data-cow="${cow.id}">
        <label>Add a note
          <textarea name="note" maxlength="280" rows="2" placeholder="Sweet moment, cosy detail, future plan..."></textarea>
        </label>
        <button type="submit">Add Note</button>
      </form>
    </section>
  `;
  return card;
}

function setMessage(card: HTMLElement, message: string, variant: 'success' | 'error' = 'success'): void {
  const messageEl = card.querySelector<HTMLElement>('.journal-message');
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.dataset.state = variant;
}

function render(): void {
  if (!listEl) return;
  const data = State.getData();
  const journal = State.getJournal();
  const fragment = document.createDocumentFragment();
  data.cows.forEach(cow => {
    const entry = journal.cows[cow.id] || (State.getCowJournal(cow.id) as CowJournalEntry);
    fragment.appendChild(buildCard(cow, entry, data.day));
  });
  listEl.innerHTML = '';
  listEl.appendChild(fragment);
}

function handleRename(form: HTMLFormElement): void {
  const cowId = form.dataset.cow;
  if (!cowId) return;
  const input = form.querySelector<HTMLInputElement>('input[name="name"]');
  if (!input) return;
  const card = form.closest<HTMLElement>('.journal-card');
  const result = State.renameCow(cowId, input.value);
  if (!card) return;
  if (!result.success) {
    setMessage(card, result.message || 'Could not rename cow.', 'error');
    return;
  }
  setMessage(card, 'Name updated!', 'success');
  handlers.onDataChanged?.();
  render();
}

function handleNote(form: HTMLFormElement): void {
  const cowId = form.dataset.cow;
  if (!cowId) return;
  const textarea = form.querySelector<HTMLTextAreaElement>('textarea[name="note"]');
  if (!textarea) return;
  const card = form.closest<HTMLElement>('.journal-card');
  const result = State.addCowNote(cowId, textarea.value);
  if (!card) return;
  if (!result.success) {
    setMessage(card, result.message || 'Could not save note.', 'error');
    return;
  }
  textarea.value = '';
  setMessage(card, 'Note saved.', 'success');
  handlers.onDataChanged?.();
  render();
}

function handleNoteDelete(button: HTMLButtonElement): void {
  const cowId = button.closest<HTMLElement>('.journal-card')?.dataset.cow;
  const noteId = button.dataset.note;
  if (!cowId || !noteId) return;
  const result = State.removeCowNote(cowId, noteId);
  const card = button.closest<HTMLElement>('.journal-card');
  if (!card) return;
  if (!result.success) {
    setMessage(card, result.message || 'Could not remove note.', 'error');
    return;
  }
  setMessage(card, 'Note removed.', 'success');
  handlers.onDataChanged?.();
  render();
}

function handleSnapshot(button: HTMLButtonElement): void {
  const cowId = button.dataset.cow;
  if (!cowId) return;
  const cow = State.getCow(cowId);
  const card = button.closest<HTMLElement>('.journal-card');
  if (!cow || !card) return;
  try {
    const markup = svg(cow, { className: 'journal-cow-art', scale: 1.05, viewBox: '0 0 160 130' });
    const encoded = window.btoa(unescape(encodeURIComponent(markup)));
    const dataUri = `data:image/svg+xml;base64,${encoded}`;
    const result = State.recordCowSnapshotEntry(cowId, dataUri);
    if (!result.success) {
      setMessage(card, result.message || 'Snapshot failed.', 'error');
      return;
    }
    setMessage(card, 'Snapshot saved!', 'success');
    handlers.onDataChanged?.();
    render();
  } catch (err) {
    console.warn('Snapshot failed', err);
    setMessage(card, 'Snapshot failed to generate.', 'error');
  }
}

export function init(section: HTMLElement): void {
  if (initialised) return;
  initialised = true;
  listEl = section.querySelector<HTMLElement>('#journal-cow-list');
  backButton = section.querySelector<HTMLButtonElement>('#btn-journal-back');
  refreshButton = section.querySelector<HTMLButtonElement>('#btn-journal-refresh');

  backButton?.addEventListener('click', () => {
    handlers.onBack?.();
  });

  refreshButton?.addEventListener('click', () => {
    render();
  });

  listEl?.addEventListener('submit', event => {
    const form = (event.target as HTMLElement).closest<HTMLFormElement>('form');
    if (!form) return;
    if (form.classList.contains('journal-rename-form')) {
      event.preventDefault();
      handleRename(form);
    } else if (form.classList.contains('journal-note-form')) {
      event.preventDefault();
      handleNote(form);
    }
  });

  listEl?.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    const deleteButton = target.closest<HTMLButtonElement>('.journal-note-delete');
    if (deleteButton) {
      event.preventDefault();
      handleNoteDelete(deleteButton);
      return;
    }
    const snapshotButton = target.closest<HTMLButtonElement>('.journal-snapshot-btn');
    if (snapshotButton) {
      event.preventDefault();
      handleSnapshot(snapshotButton);
    }
  });
}

export function show(): void {
  if (!initialised) return;
  render();
  showScreen('journal');
}

export function refresh(): void {
  if (!initialised) return;
  render();
}

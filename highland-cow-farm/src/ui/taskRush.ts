import { showScreen } from '../core/screens';
import { formatTime } from '../core/util';

interface TaskHandlers {
  onContinue?: () => void;
}

let handlers: TaskHandlers = {};
let initialised = false;
let subtitleEl: HTMLElement | null = null;
let subtitleIconEl: HTMLElement | null = null;
let subtitleLabelEl: HTMLElement | null = null;
let badgeEl: HTMLElement | null = null;
let instructionEl: HTMLElement | null = null;
let timerEl: HTMLElement | null = null;
let areaEl: HTMLElement | null = null;
let controlsEl: HTMLElement | null = null;
let continueButton: HTMLButtonElement | null = null;

export function configureTaskHandlers(partial: TaskHandlers): void {
  handlers = Object.assign({}, handlers, partial);
}

export function init(section: HTMLElement): void {
  if (initialised) return;
  initialised = true;
  subtitleEl = section.querySelector<HTMLElement>('#mini-subtitle');
  badgeEl = section.querySelector<HTMLElement>('#mini-badge');
  if (subtitleEl && !subtitleLabelEl) {
    subtitleEl.innerHTML = '';
    subtitleIconEl = document.createElement('span');
    subtitleIconEl.className = 'mini-title-icon';
    subtitleIconEl.setAttribute('aria-hidden', 'true');
    subtitleIconEl.hidden = true;
    subtitleEl.appendChild(subtitleIconEl);

    subtitleLabelEl = document.createElement('span');
    subtitleLabelEl.className = 'mini-title-label';
    subtitleEl.appendChild(subtitleLabelEl);
  }

  instructionEl = section.querySelector<HTMLElement>('#mini-instruction');
  timerEl = section.querySelector<HTMLElement>('#task-timer');
  areaEl = section.querySelector<HTMLElement>('#minigame-area');
  controlsEl = section.querySelector<HTMLElement>('#task-controls');
  continueButton = section.querySelector<HTMLButtonElement>('#btn-task-continue');

  continueButton?.addEventListener('click', () => {
    handlers.onContinue?.();
  });
}

export function show(): void {
  showScreen('task');
}

function applyIcon(target: HTMLElement | null, icon?: string): void {
  if (!target) return;
  target.innerHTML = '';
  if (!icon) {
    target.hidden = true;
    return;
  }
  target.hidden = false;
  if (icon.startsWith('data:image')) {
    const img = document.createElement('img');
    img.src = icon;
    img.alt = '';
    img.className = 'mini-title-icon-img';
    target.appendChild(img);
  } else {
    target.textContent = icon;
  }
}

export function setMiniTitle(label: string, index: number, total: number, icon?: string): void {
  if (subtitleLabelEl) {
    subtitleLabelEl.textContent = label;
  } else if (subtitleEl) {
    subtitleEl.textContent = label;
  }
  applyIcon(subtitleIconEl, icon);
  if (badgeEl) badgeEl.textContent = `Mini ${index} of ${total}`;
}

export function setInstruction(text: string): void {
  if (instructionEl) instructionEl.textContent = text;
}

export function updateTimer(seconds: number): void {
  if (timerEl) timerEl.textContent = formatTime(seconds);
}

export function getArea(): HTMLElement | null {
  return areaEl;
}

export function setContinueVisible(flag: boolean): void {
  if (!controlsEl) return;
  controlsEl.hidden = !flag;
}

export function enableContinue(flag: boolean): void {
  if (!continueButton) return;
  continueButton.disabled = !flag;
}

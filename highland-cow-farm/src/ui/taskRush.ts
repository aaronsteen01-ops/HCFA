import { showScreen } from '../core/screens';
import { formatTime } from '../core/util';

interface TaskHandlers {
  onContinue?: () => void;
}

let handlers: TaskHandlers = {};
let initialised = false;
let subtitleEl: HTMLElement | null = null;
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

export function setMiniTitle(label: string, index: number, total: number): void {
  if (subtitleEl) subtitleEl.textContent = label;
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

import { showScreen } from '../core/screens';

interface TitleHandlers {
  onStart?: () => void;
  onOptions?: () => void;
  onReset?: () => void;
}

let handlers: TitleHandlers = {};
let initialised = false;
let howtoDetails: HTMLDetailsElement | null = null;

export function configureTitleHandlers(partial: TitleHandlers): void {
  handlers = Object.assign({}, handlers, partial);
}

export function init(section: HTMLElement): void {
  if (initialised) return;
  initialised = true;
  const startButton = section.querySelector<HTMLButtonElement>('#btn-start');
  const optionsButton = section.querySelector<HTMLButtonElement>('#btn-options');
  const resetButton = section.querySelector<HTMLButtonElement>('#btn-reset');
  const howtoButton = section.querySelector<HTMLButtonElement>('#btn-howto');
  howtoDetails = section.querySelector<HTMLDetailsElement>('#title-howto');

  startButton?.addEventListener('click', () => {
    handlers.onStart?.();
  });

  optionsButton?.addEventListener('click', () => {
    handlers.onOptions?.();
  });

  resetButton?.addEventListener('click', () => {
    if (confirm('Reset save data? This cannot be undone.')) {
      handlers.onReset?.();
    }
  });

  howtoButton?.addEventListener('click', () => {
    if (!howtoDetails) return;
    howtoDetails.open = !howtoDetails.open;
    if (howtoDetails.open) {
      howtoDetails.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

export function show(): void {
  showScreen('title');
}

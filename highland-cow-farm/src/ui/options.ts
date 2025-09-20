import type { Options } from '../types';
import { showScreen } from '../core/screens';

interface OptionsHandlers {
  onBack?: () => void;
  onChange?: (partial: Partial<Options>) => void;
}

let handlers: OptionsHandlers = {};
let initialised = false;
let audioToggle: HTMLInputElement | null = null;
let contrastToggle: HTMLInputElement | null = null;
let reducedToggle: HTMLInputElement | null = null;
let masterRange: HTMLInputElement | null = null;
let effectsRange: HTMLInputElement | null = null;
let ambienceRange: HTMLInputElement | null = null;
let masterValue: HTMLElement | null = null;
let effectsValue: HTMLElement | null = null;
let ambienceValue: HTMLElement | null = null;

export function configureOptionsHandlers(partial: OptionsHandlers): void {
  handlers = Object.assign({}, handlers, partial);
}

export function init(section: HTMLElement): void {
  if (initialised) return;
  initialised = true;
  audioToggle = section.querySelector<HTMLInputElement>('#toggle-audio');
  contrastToggle = section.querySelector<HTMLInputElement>('#toggle-contrast');
  reducedToggle = section.querySelector<HTMLInputElement>('#toggle-reduced');
  masterRange = section.querySelector<HTMLInputElement>('#range-master');
  effectsRange = section.querySelector<HTMLInputElement>('#range-effects');
  ambienceRange = section.querySelector<HTMLInputElement>('#range-ambience');
  masterValue = section.querySelector<HTMLElement>('#range-master-value');
  effectsValue = section.querySelector<HTMLElement>('#range-effects-value');
  ambienceValue = section.querySelector<HTMLElement>('#range-ambience-value');
  const backButton = section.querySelector<HTMLButtonElement>('#btn-options-back');

  audioToggle?.addEventListener('change', () => {
    handlers.onChange?.({ audioOn: !!audioToggle?.checked });
  });

  contrastToggle?.addEventListener('change', () => {
    handlers.onChange?.({ highContrastUI: !!contrastToggle?.checked });
  });

  reducedToggle?.addEventListener('change', () => {
    handlers.onChange?.({ reducedFlash: !!reducedToggle?.checked });
  });

  effectsRange?.addEventListener('input', () => {
    const value = parseFloat(effectsRange!.value);
    if (effectsValue) effectsValue.textContent = `${Math.round(value * 100)}%`;
    handlers.onChange?.({ effectsVolume: value });
  });

  ambienceRange?.addEventListener('input', () => {
    const value = parseFloat(ambienceRange!.value);
    if (ambienceValue) ambienceValue.textContent = `${Math.round(value * 100)}%`;
    handlers.onChange?.({ ambienceVolume: value });
  });

  masterRange?.addEventListener('input', () => {
    const value = parseFloat(masterRange!.value);
    if (masterValue) masterValue.textContent = `${Math.round(value * 100)}%`;
    handlers.onChange?.({ masterVolume: value });
  });

  backButton?.addEventListener('click', () => {
    handlers.onBack?.();
  });
}

export function show(): void {
  showScreen('options');
}

export function applyOptions(options: Options): void {
  document.body.classList.toggle('high-contrast', !!options.highContrastUI);
}

export function update(options: Options): void {
  audioToggle && (audioToggle.checked = !!options.audioOn);
  contrastToggle && (contrastToggle.checked = !!options.highContrastUI);
  reducedToggle && (reducedToggle.checked = !!options.reducedFlash);
  if (masterRange) {
    masterRange.value = String(options.masterVolume ?? 1);
    if (masterValue) masterValue.textContent = `${Math.round((options.masterVolume ?? 1) * 100)}%`;
  }
  if (effectsRange) {
    effectsRange.value = String(options.effectsVolume ?? 0.9);
    if (effectsValue) effectsValue.textContent = `${Math.round((options.effectsVolume ?? 0.9) * 100)}%`;
  }
  if (ambienceRange) {
    ambienceRange.value = String(options.ambienceVolume ?? 0.5);
    if (ambienceValue) ambienceValue.textContent = `${Math.round((options.ambienceVolume ?? 0.5) * 100)}%`;
  }
}

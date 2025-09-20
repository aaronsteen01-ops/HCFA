import { setAmbience } from './audio';

const screenMap = new Map<string, HTMLElement>();
let currentScreen = '';
const boundElements = new WeakSet<EventTarget>();

export function registerScreen(name: string, element: HTMLElement): void {
  screenMap.set(name, element);
}

export function getScreen(name: string): HTMLElement | null {
  return screenMap.get(name) ?? null;
}

export function showScreen(name: string): void {
  currentScreen = name;
  screenMap.forEach((element, key) => {
    element.classList.toggle('active', key === name);
  });
  if (name === 'task') {
    setAmbience('task');
  } else if (name === 'summary') {
    setAmbience('summary');
  } else {
    setAmbience('farm');
  }
}

export function getCurrentScreen(): string {
  return currentScreen;
}

export function bindEvent<K extends keyof HTMLElementEventMap>(
  element: HTMLElement | null,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void
): void {
  if (!element) return;
  const key = `${type}`;
  const storeKey = `${key}`;
  const marker = element as unknown as { __bound?: Set<string> };
  if (!marker.__bound) {
    marker.__bound = new Set();
  }
  if (marker.__bound.has(storeKey)) return;
  element.addEventListener(type, handler as EventListener);
  marker.__bound.add(storeKey);
  boundElements.add(element);
}

export function querySelector<T extends Element>(root: ParentNode, selector: string): T | null {
  return root.querySelector(selector);
}

export function queryRequired<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector(selector);
  if (!found) {
    throw new Error(`Missing required element ${selector}`);
  }
  return found as T;
}

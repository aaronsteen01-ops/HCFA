import { FoodLibrary } from '../data/foods';

export function renderPantry(container: HTMLElement, foods: string[]): void {
  container.innerHTML = '';
  const items = Array.isArray(foods)
    ? foods.map(name => ({ name, entry: FoodLibrary[name] })).filter(item => item.entry)
    : [];
  if (!items.length) {
    const message = document.createElement('div');
    message.className = 'helper-text';
    message.textContent = 'Unlock new treats in the day summary to expand the pantry.';
    container.appendChild(message);
    return;
  }
  items.forEach(({ name, entry }) => {
    const block = document.createElement('div');
    block.className = 'pantry-item';
    block.textContent = entry?.icon || '🥛';
    block.setAttribute('aria-label', `${name} treat`);
    if (entry?.description) {
      block.title = entry.description;
    }
    const label = document.createElement('span');
    label.textContent = name;
    block.appendChild(label);
    container.appendChild(block);
  });
}

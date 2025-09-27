import { CowFactory } from '../game/cowFactory';

async function main(): Promise<void> {
  const grid = document.querySelector<HTMLDivElement>('[data-factory-grid]');
  const status = document.querySelector<HTMLElement>('[data-factory-status]');

  if (!grid) {
    throw new Error('Factory test grid container not found');
  }

  try {
    if (status) {
      status.textContent = 'Loading cow factory…';
    }

    const factory = new CowFactory();
    await factory.load();

    const seeds = Array.from({ length: 12 }, (_, index) => `cow-${index}`);

    for (const seed of seeds) {
      const recipe = await factory.buildRecipe({ seed });

      const figure = document.createElement('figure');
      figure.className = 'factory-test__item';

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      canvas.className = 'factory-test__canvas';

      await factory.renderToCanvas(recipe, canvas);

      canvas.style.width = '256px';
      canvas.style.height = '256px';

      const caption = document.createElement('figcaption');
      caption.className = 'factory-test__caption';
      const partsSummary = recipe.items.map(item => `${item.categoryId}: ${item.partId}`).join('\n');
      caption.textContent = partsSummary;

      figure.append(canvas, caption);
      grid.append(figure);
    }

    if (status) {
      status.textContent = 'Generated sample cows using deterministic seeds.';
    }
  } catch (error) {
    console.error(error);
    if (status) {
      status.textContent = `Failed to load factory test: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

void main();

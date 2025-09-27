export interface ManifestPoint {
  x: number;
  y: number;
}

export interface ManifestSize {
  width: number;
  height: number;
}

export interface ManifestRuleSet {
  exclude?: string[];
}

export interface ManifestPart {
  id: string;
  label?: string;
  file: string;
  weight?: number;
  poses?: string[];
  coats?: string[];
  tags?: string[];
  z?: number;
  anchor?: ManifestPoint;
  size?: ManifestSize;
  offset?: ManifestPoint;
  scale?: number;
  rules?: ManifestRuleSet;
}

export interface ManifestCategory {
  id: string;
  label?: string;
  required?: boolean;
  max?: number;
  z: number;
  tags?: string[];
  rules?: ManifestRuleSet;
  parts: ManifestPart[];
}

export interface ManifestCanvas extends ManifestSize {}

export interface Manifest {
  version?: string;
  canvas: ManifestCanvas;
  poses?: string[];
  coats?: string[];
  categories: ManifestCategory[];
}

export interface RecipeItem {
  categoryId: string;
  categoryLabel?: string;
  partId: string;
  partLabel?: string;
  src: string;
  z: number;
  anchor: ManifestPoint;
  size: ManifestSize;
  offset: ManifestPoint;
  scale: number;
  tags: string[];
}

export interface Recipe {
  seed?: string;
  pose: string;
  coat: string;
  canvas: ManifestCanvas;
  items: RecipeItem[];
}

export interface BuildRecipeOptions {
  seed?: string;
  pose?: string;
  coat?: string;
  requested?: Partial<Record<string, string | string[]>>;
  tags?: string[];
}

const DEFAULT_POSE = 'idle';
const DEFAULT_COAT = 'default';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function normaliseTags(tags?: string[]): string[] {
  return Array.from(new Set((tags ?? []).map(tag => tag.trim()).filter(Boolean)));
}

function stringToSeed(value: string): number {
  let hash = 1779033703 ^ value.length;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeightedPart<T extends { weight?: number }>(items: T[], rng: () => number): T {
  const total = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  if (total <= 0) {
    return items[0];
  }
  const target = rng() * total;
  let acc = 0;
  for (const item of items) {
    acc += item.weight ?? 1;
    if (target <= acc) {
      return item;
    }
  }
  return items[items.length - 1];
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

function assertManifest(manifest: Manifest): void {
  assert(Boolean(manifest.canvas), 'Cow manifest missing canvas definition');
  assert(typeof manifest.canvas.width === 'number' && manifest.canvas.width > 0, 'Cow manifest canvas width must be positive');
  assert(typeof manifest.canvas.height === 'number' && manifest.canvas.height > 0, 'Cow manifest canvas height must be positive');
  assert(Array.isArray(manifest.categories) && manifest.categories.length > 0, 'Cow manifest must include at least one category');
  for (const category of manifest.categories) {
    assert(Boolean(category.id), 'Cow manifest category missing id');
    assert(typeof category.z === 'number', `Cow manifest category ${category.id} missing z index`);
    assert(Array.isArray(category.parts) && category.parts.length > 0, `Cow manifest category ${category.id} requires at least one part`);
  }
}

function partAnchor(part: ManifestPart, canvas: ManifestCanvas): ManifestPoint {
  if (part.anchor) return part.anchor;
  return { x: canvas.width / 2, y: canvas.height / 2 };
}

function partSize(part: ManifestPart, canvas: ManifestCanvas): ManifestSize {
  if (part.size) return part.size;
  return { width: canvas.width, height: canvas.height };
}

function partOffset(part: ManifestPart): ManifestPoint {
  return part.offset ?? { x: 0, y: 0 };
}

function partScale(part: ManifestPart): number {
  return typeof part.scale === 'number' ? part.scale : 1;
}

export class CowFactory {
  private manifest?: Manifest;

  private manifestUrl?: URL;

  private readonly partSrcCache = new Map<string, Promise<string>>();

  private readonly imageCache = new Map<string, Promise<HTMLImageElement>>();

  async load(): Promise<Manifest> {
    if (this.manifest) return this.manifest;
    const manifestUrl = new URL('../assets/cowparts/sprites.json', import.meta.url);
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      throw new Error(`Failed to load cow manifest (${response.status} ${response.statusText})`);
    }
    const data = (await response.json()) as Manifest;
    assertManifest(data);
    this.manifest = data;
    this.manifestUrl = manifestUrl;
    return data;
  }

  private async ensureManifest(): Promise<Manifest> {
    if (this.manifest) return this.manifest;
    return this.load();
  }

  private getManifestBase(): URL {
    if (!this.manifestUrl) {
      throw new Error('Cow manifest has not been loaded yet');
    }
    return this.manifestUrl;
  }

  private normaliseRequested(entry?: string | string[]): string[] {
    if (!entry) return [];
    if (Array.isArray(entry)) return entry.filter(Boolean);
    return [entry];
  }

  private rulesExclude(ruleSet: ManifestRuleSet | undefined, active: Set<string>): boolean {
    if (!ruleSet?.exclude?.length) return false;
    return ruleSet.exclude.some(tag => active.has(tag));
  }

  private async resolvePartSrc(file: string): Promise<string> {
    const cacheKey = file;
    let cached = this.partSrcCache.get(cacheKey);
    if (!cached) {
      const base = this.getManifestBase();
      cached = (async () => {
        const lower = file.toLowerCase();
        if (lower.startsWith('data:') || lower.startsWith('http:') || lower.startsWith('https:')) {
          return file;
        }
        const resolved = new URL(file, base).toString();
        if (file.toLowerCase().endsWith('.b64')) {
          const res = await fetch(resolved);
          if (!res.ok) throw new Error(`Failed to load base64 asset ${file} (${res.status})`);
          const text = await res.text();
          return text.trim();
        }
        return resolved;
      })();
      this.partSrcCache.set(cacheKey, cached);
    }
    return cached;
  }

  private async resolveImage(src: string): Promise<HTMLImageElement> {
    let cached = this.imageCache.get(src);
    if (!cached) {
      cached = loadImage(src);
      this.imageCache.set(src, cached);
    }
    return cached;
  }

  async buildRecipe(options: BuildRecipeOptions = {}): Promise<Recipe> {
    const manifest = await this.ensureManifest();
    const pose = options.pose ?? manifest.poses?.[0] ?? DEFAULT_POSE;
    const coat = options.coat ?? manifest.coats?.[0] ?? DEFAULT_COAT;
    const seedValue = options.seed ?? `${pose}:${coat}:${Date.now()}`;
    const rng = mulberry32(stringToSeed(seedValue));
    const requested = options.requested ?? {};
    const activeTags = new Set(normaliseTags(options.tags));
    const items: RecipeItem[] = [];
    const missingRequired: string[] = [];

    const sortedCategories = [...manifest.categories].sort((a, b) => a.z - b.z);

    for (const category of sortedCategories) {
      if (this.rulesExclude(category.rules, activeTags)) {
        if (category.required) {
          missingRequired.push(category.id);
        }
        continue;
      }

      const pool = category.parts.filter(part => {
        if (this.rulesExclude(part.rules, activeTags)) return false;
        if (part.poses && part.poses.length && !part.poses.includes(pose)) return false;
        if (part.coats && part.coats.length && !part.coats.includes(coat)) return false;
        return true;
      });

      if (!pool.length) {
        if (category.required) missingRequired.push(category.id);
        continue;
      }

      const forcedIds = this.normaliseRequested(requested[category.id]);
      const forcedParts = forcedIds.map(id => {
        const match = pool.find(part => part.id === id);
        if (!match) {
          throw new Error(`Requested part "${id}" not found in category "${category.id}"`);
        }
        return match;
      });

      const maxParts = category.max ?? 1;
      if (forcedParts.length > maxParts) {
        throw new Error(`Requested parts exceed max for category ${category.id}`);
      }

      let targetCount = forcedParts.length;
      if (category.required) {
        targetCount = Math.max(1, targetCount);
      } else if (!forcedParts.length) {
        const available = Math.min(maxParts, pool.length);
        if (available <= 0) {
          continue;
        }
        const includeCount = Math.floor(rng() * (available + 1));
        if (includeCount === 0) {
          continue;
        }
        targetCount = includeCount;
      }

      const remainingSlots = Math.min(maxParts, pool.length);
      if (targetCount > remainingSlots) {
        targetCount = remainingSlots;
      }

      const selectedParts = [...forcedParts];
      const remainingPool = pool.filter(part => !forcedParts.includes(part));

      while (selectedParts.length < targetCount && remainingPool.length) {
        const picked = pickWeightedPart(remainingPool, rng);
        selectedParts.push(picked);
        const index = remainingPool.indexOf(picked);
        if (index >= 0) remainingPool.splice(index, 1);
      }

      if (category.required && !selectedParts.length) {
        missingRequired.push(category.id);
        continue;
      }

      for (const part of selectedParts) {
        const src = await this.resolvePartSrc(part.file);
        const anchor = partAnchor(part, manifest.canvas);
        const size = partSize(part, manifest.canvas);
        const offset = partOffset(part);
        const scale = partScale(part);
        const z = category.z + (part.z ?? 0);
        const tags = part.tags ?? [];
        tags.forEach(tag => activeTags.add(tag));
        items.push({
          categoryId: category.id,
          categoryLabel: category.label,
          partId: part.id,
          partLabel: part.label ?? part.id,
          src,
          z,
          anchor,
          size,
          offset,
          scale,
          tags
        });
      }
    }

    if (missingRequired.length) {
      throw new Error(`Missing required categories: ${missingRequired.join(', ')}`);
    }

    items.sort((a, b) => a.z - b.z);

    return {
      seed: seedValue,
      pose,
      coat,
      canvas: manifest.canvas,
      items
    };
  }

  async renderToCanvas(recipe: Recipe, canvas: HTMLCanvasElement): Promise<Recipe> {
    const manifest = await this.ensureManifest();
    canvas.width = manifest.canvas.width;
    canvas.height = manifest.canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to acquire 2D context for cow canvas');
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const item of [...recipe.items].sort((a, b) => a.z - b.z)) {
      const image = await this.resolveImage(item.src);
      const drawWidth = item.size.width * item.scale;
      const drawHeight = item.size.height * item.scale;
      const x = canvas.width / 2 - item.anchor.x * item.scale + item.offset.x;
      const y = canvas.height / 2 - item.anchor.y * item.scale + item.offset.y;
      ctx.drawImage(image, x, y, drawWidth, drawHeight);
    }
    return recipe;
  }
}


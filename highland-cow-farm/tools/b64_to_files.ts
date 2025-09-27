import { promises as fs } from 'fs';
import path from 'path';

const MIME_EXTENSION_OVERRIDES: Record<string, string> = {
  'image/svg+xml': '.svg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/apng': '.apng',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
  'application/json': '.json',
  'text/plain': '.txt',
};

async function resolveSourceDir(): Promise<string> {
  const candidates = [
    path.resolve('src/assets/cowparts'),
    path.resolve('../src/assets/cowparts'),
  ];

  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate);
      if (stats.isDirectory()) {
        return candidate;
      }
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined;
      if (code !== 'ENOENT') {
        throw error;
      }
    }
  }

  throw new Error(
    `Unable to find a cowparts directory. Looked in:\n${candidates.map((dir) => ` - ${dir}`).join('\n')}`,
  );
}

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.b64')) {
      files.push(fullPath);
    }
  }

  return files;
}

function extensionForMime(mime: string): string {
  const normalised = mime.trim().toLowerCase();
  if (MIME_EXTENSION_OVERRIDES[normalised]) {
    return MIME_EXTENSION_OVERRIDES[normalised];
  }

  const slashIndex = normalised.indexOf('/');
  if (slashIndex === -1) {
    return '.bin';
  }

  let subtype = normalised.slice(slashIndex + 1);
  const plusIndex = subtype.indexOf('+');
  if (plusIndex !== -1) {
    subtype = subtype.slice(0, plusIndex);
  }

  return `.${subtype || 'bin'}`;
}

function parseDataUrl(contents: string): { mime: string; encoding: 'base64' | 'utf8'; payload: string } {
  const trimmed = contents.trim();
  const match = trimmed.match(/^data:([^;]+);(base64|utf8),/i);
  if (!match) {
    throw new Error('Unsupported data URL format');
  }

  const [, mime, encoding] = match;
  const payload = trimmed.slice(match[0].length);

  return { mime, encoding: encoding.toLowerCase() as 'base64' | 'utf8', payload };
}

async function convertFile(filePath: string): Promise<string> {
  const contents = await fs.readFile(filePath, 'utf8');
  const { mime, encoding, payload } = parseDataUrl(contents);
  const extension = extensionForMime(mime);
  const targetPath = filePath.replace(/\.b64$/i, extension);

  const buffer =
    encoding === 'base64'
      ? Buffer.from(payload, 'base64')
      : Buffer.from(payload, 'utf8');

  await fs.writeFile(targetPath, buffer);

  return targetPath;
}

async function main(): Promise<void> {
  const sourceDir = await resolveSourceDir();
  const b64Files = await walk(sourceDir);

  if (b64Files.length === 0) {
    console.log('No .b64 files found.');
    return;
  }

  for (const file of b64Files) {
    try {
      const outputPath = await convertFile(file);
      const relativePath = path.relative(process.cwd(), outputPath);
      console.log(`Wrote ${relativePath}`);
    } catch (error) {
      console.error(`Failed to convert ${file}:`, error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

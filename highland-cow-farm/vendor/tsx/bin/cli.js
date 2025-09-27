#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: tsx <script.ts> [args...]');
    process.exit(1);
  }

  const entry = path.resolve(args[0]);
  const forwardArgs = args.slice(1);

  let esbuild;
  try {
    esbuild = require('esbuild');
  } catch (error) {
    console.error('The local tsx shim requires esbuild to be installed.');
    console.error('Install esbuild or ensure it is available in node_modules.');
    process.exit(1);
  }

  process.argv = [process.argv[0], entry, ...forwardArgs];

  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: false,
    platform: 'node',
    format: 'esm',
    sourcemap: 'inline',
    write: false,
    target: 'esnext',
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
      '.js': 'js',
      '.jsx': 'jsx'
    }
  });

  if (!result.outputFiles || result.outputFiles.length === 0) {
    console.error('Failed to compile TypeScript entry.');
    process.exit(1);
  }

  const tempFile = path.join(os.tmpdir(), `tsx-run-${Date.now()}-${Math.random()}.mjs`);
  fs.writeFileSync(tempFile, result.outputFiles[0].text, 'utf8');

  try {
    await import(pathToFileURL(tempFile).href);
  } finally {
    try {
      fs.unlinkSync(tempFile);
    } catch (error) {
      // ignore cleanup errors
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

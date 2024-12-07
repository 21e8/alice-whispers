/* eslint-env node */
import { build } from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';
import { execSync } from 'child_process';

const watch = process.argv.includes('--watch');

// Common options
const commonOptions = {
  bundle: true,
  platform: 'node',
  target: 'node16',
  sourcemap: true,
  minify: true,
  treeShaking: true,
  external: ['node-fetch'],
  plugins: [nodeExternalsPlugin()]
};

// Generate types
await build({
  entryPoints: ['src/index.ts'],
  plugins: [
    {
      name: 'tsc',
      setup(build) {
        build.onEnd(() => {
          execSync('tsc --emitDeclarationOnly --declaration');
        });
      },
    },
  ],
});

// ESM build
await build({
  ...commonOptions,
  entryPoints: ['src/index.ts'],
  format: 'esm',
  outfile: 'dist/index.js',
});

// CJS build
await build({
  ...commonOptions,
  entryPoints: ['src/index.ts'],
  format: 'cjs',
  outfile: 'dist/index.cjs',
});

if (watch) {
  console.log('Watching for changes...');
  // Watch ESM build
  build({
    ...commonOptions,
    entryPoints: ['src/index.ts'],
    format: 'esm',
    outfile: 'dist/index.js',
    watch: true,
  });
  
  // Watch CJS build
  build({
    ...commonOptions,
    entryPoints: ['src/index.ts'],
    format: 'cjs',
    outfile: 'dist/index.cjs',
    watch: true,
  });
}

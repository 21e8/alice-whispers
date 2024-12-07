/* eslint-env node */
import * as esbuild from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';
import { execSync } from 'child_process';

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/index.ts'],
  outdir: 'dist',
  bundle: true,
  minify: true,
  platform: 'node',
  target: 'node16',
  format: 'cjs',
  sourcemap: true,
  plugins: [nodeExternalsPlugin()],
  treeShaking: true,
};

// Generate types
await esbuild.build({
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

if (watch) {
  esbuild.context(buildOptions).then((context) => {
    context.watch();
    console.log('Watching for changes...');
  });
} else {
  esbuild
    .build({
      ...buildOptions,
      external: ['typescript'],
    })
    .catch(() => process.exit(1));
}

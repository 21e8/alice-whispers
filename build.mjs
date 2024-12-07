/* eslint-env node */
import { build } from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';
import { execSync } from 'child_process';

// Clean dist directory and build info
console.log('Cleaning build artifacts...');
execSync('rm -rf dist tsconfig.tsbuildinfo', { stdio: 'inherit' });

// Create dist directory
execSync('mkdir -p dist', { stdio: 'inherit' });

// Generate types with proper configuration
console.log('Generating TypeScript declarations...');
try {
  execSync('./node_modules/.bin/tsc --build tsconfig.json --force --verbose', {
    stdio: 'inherit',
  });
} catch (error) {
  console.error('TypeScript compilation failed:', error);
  process.exit(1);
}

// Common options
const commonOptions = {
  bundle: true,
  platform: 'node',
  target: 'node16',
  sourcemap: true,
  minify: true,
  treeShaking: true,
  external: ['node-fetch', 'nodemailer'],
  plugins: [nodeExternalsPlugin()],
};

// ESM build
console.log('Building ESM module...');
await build({
  ...commonOptions,
  entryPoints: ['src/index.ts'],
  format: 'esm',
  outfile: 'dist/index.bundle.js',
  banner: {
    js: 'import { createRequire } from "module";const require = createRequire(import.meta.url);',
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});

// CJS build
console.log('Building CommonJS module...');
await build({
  ...commonOptions,
  entryPoints: ['src/index.ts'],
  format: 'cjs',
  outfile: 'dist/index.bundle.cjs',
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});

// Verify type declarations were generated
console.log('Verifying type declarations...');
try {
  execSync('ls dist/*.d.ts', { stdio: 'inherit' });
  console.log('Type declarations generated successfully');
} catch (error) {
  console.error('Warning: No type declaration files found in dist directory');
  process.exit(1);
}

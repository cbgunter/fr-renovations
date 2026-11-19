// Bundles the Lambda into dist/index.mjs. The AWS SDK is bundled too (not taken
// from the runtime) so the deployed code runs exactly the versions we tested.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  // Some SDK deps still use require(); give ESM output a working require.
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});
console.log('bundled dist/index.mjs');

import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

console.log('[build-packages] Compiling workspace packages...');

await esbuild.build({
  entryPoints: ['packages/config/src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'packages/config/dist/index.js',
});

await esbuild.build({
  entryPoints: ['packages/database/src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  outfile: 'packages/database/dist/index.js',
});

await esbuild.build({
  entryPoints: ['packages/shared/src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  outfile: 'packages/shared/dist/index.js',
});

// Ensure node_modules/@resumeai has physical package.json and dist/index.js
const packages = ['config', 'database', 'shared'];
for (const pkg of packages) {
  const targetDir = path.resolve('node_modules/@resumeai', pkg);
  fs.mkdirSync(path.join(targetDir, 'dist'), { recursive: true });
  fs.copyFileSync(`packages/${pkg}/package.json`, path.join(targetDir, 'package.json'));
  fs.copyFileSync(`packages/${pkg}/dist/index.js`, path.join(targetDir, 'dist/index.js'));
  console.log(`[build-packages] Synced @resumeai/${pkg} -> ${targetDir}`);
}
console.log('[build-packages] Done!');

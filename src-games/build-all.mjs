// Builds every game folder that has main.ts (except stack-tower, which has its own project)
import { build } from 'vite';
import fs from 'fs'; import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname);
const only = process.argv.slice(2);
const games = fs.readdirSync(here).filter(d => fs.existsSync(path.join(here, d, 'main.ts')) && (!only.length || only.includes(d)));
for (const g of games) {
  await build({ root: path.join(here, g), base: './', logLevel: 'warn',
    build: { outDir: path.join(here, '..', g), emptyOutDir: true } });
  console.log('built', g);
}

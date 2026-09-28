// Regenerates model.json from src/manifest.ts (the single source of truth).
// Usage: npm run manifest:sync
import { writeFileSync } from 'node:fs';
import { META_INTELLIGENCE_MANIFEST } from '../src/manifest.ts';

const target = new URL('../model.json', import.meta.url);
writeFileSync(target, JSON.stringify(META_INTELLIGENCE_MANIFEST, null, 2) + '\n');
console.log('model.json written');

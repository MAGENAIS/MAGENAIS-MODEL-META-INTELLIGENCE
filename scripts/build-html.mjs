// Regenerates the embedded document viewer data in index.html from the real files,
// so the page can never show stale documentation. Usage: npm run html:sync
import { readFileSync, writeFileSync } from 'node:fs';

import { EMBEDDED } from './embeddedDocs.ts';

const root = new URL('../', import.meta.url);
const data = {};
for (const file of EMBEDDED) data[`./${file}`] = readFileSync(new URL(file, root), 'utf8');
// '<' is escaped so that embedded text can never close the script element.
const json = JSON.stringify(data).replace(/</g, '\\u003c');

const htmlUrl = new URL('index.html', root);
const html = readFileSync(htmlUrl, 'utf8');
const pattern = /(<script id="__doc_data__" type="application\/json">)[\s\S]*?(<\/script>)/;
if (!pattern.test(html)) throw new Error('__doc_data__ block not found in index.html');
writeFileSync(htmlUrl, html.replace(pattern, (_m, open, close) => `${open}${json}${close}`));
console.log(`index.html: embedded ${EMBEDDED.length} documents`);

/** index.html must describe V2 accurately, link only to things that exist, and embed the real documents. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { META_INTELLIGENCE_VERSION } from '../src/index.ts';
import { EMBEDDED } from '../scripts/embeddedDocs.ts';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
/** The page itself, without the embedded document data (which legitimately quotes history, e.g. the changelog). */
const page = html.replace(/<script id="__doc_data__"[\s\S]*?<\/script>/, '');

test('page carries the current version and no stale V1 claims', () => {
  assert.ok(html.includes(`v${META_INTELLIGENCE_VERSION}`));
  assert.ok(html.includes(`content="Meta-Intelligence ${META_INTELLIGENCE_VERSION}`));
  for (const stale of [/work-in-progress/i, /eleven stages/i, /No capability decomposition/i, /basic-usage/, /metaIntelligenceOrchestrator\.test/, /19 tests/]) {
    assert.equal(stale.test(page), false, String(stale));
  }
});

test('every relative link and data-doc target exists in the repository', () => {
  const hrefs = [...page.matchAll(/(?:href|src)="(\.\/[^"#]+)"/g)].map((m) => m[1]!);
  assert.ok(hrefs.length > 5);
  for (const href of hrefs) assert.ok(existsSync(new URL(href, root)), `missing ${href}`);
});

test('embedded viewer data is in sync with the real files and covers every data-doc link', () => {
  const block = html.match(/<script id="__doc_data__" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(block, 'doc data block missing');
  const data = JSON.parse(block![1]!) as Record<string, string>;
  for (const file of EMBEDDED) assert.equal(data[`./${file}`], readFileSync(new URL(file, root), 'utf8'), `${file} is stale: run npm run html:sync`);
  for (const m of html.matchAll(/data-doc data-doc-title|href="(\.\/[^"]+)" data-doc/g)) {
    if (m[1]) assert.ok(m[1] in data, `${m[1]} is linked with data-doc but not embedded`);
  }
});

test('the page states the non-execution limitation and makes no autonomy claim', () => {
  assert.match(page, /never executes/i);
  assert.match(page, /does not act/i);
  assert.equal(/autonomous(ly)? (execut|act)/i.test(page.replace(/[^.]*(no|not|never)[^.]*\./gi, '')), false);
});

test('page is self-contained: no third-party scripts, stylesheets, fonts or remote images', () => {
  assert.equal(/<link[^>]+href="https?:/i.test(page), false);
  assert.equal(/<script[^>]+src=/i.test(html), false);
  assert.equal(/<img[^>]+src="https?:/i.test(html), false);
});

test('the inline script is syntactically valid JavaScript', () => {
  const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
  assert.ok(scripts.length >= 1);
  for (const code of scripts) assert.doesNotThrow(() => new Function(code));
});

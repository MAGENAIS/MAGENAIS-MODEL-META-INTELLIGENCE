/** One version, everywhere: code, package.json, model.json, benchmark provenance, docs and HTML. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { META_INTELLIGENCE_VERSION, META_INTELLIGENCE_URI, META_INTELLIGENCE_MANIFEST } from '../src/index.ts';
import { META_INTELLIGENCE_SUBJECT_DESCRIPTOR } from '../src/benchmark/index.ts';

const text = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const pkg = JSON.parse(text('package.json'));
const model = JSON.parse(text('model.json'));

test('package.json, model.json, manifest, URI and benchmark subject all carry the same version', () => {
  assert.equal(pkg.version, META_INTELLIGENCE_VERSION);
  assert.equal(model.version, META_INTELLIGENCE_VERSION);
  assert.equal(META_INTELLIGENCE_MANIFEST.version, META_INTELLIGENCE_VERSION);
  assert.equal(META_INTELLIGENCE_URI, `magenais://meta-intelligence@${META_INTELLIGENCE_VERSION}`);
  assert.equal(META_INTELLIGENCE_SUBJECT_DESCRIPTOR.version, META_INTELLIGENCE_VERSION);
});

test('package.json and model.json agree on identity and licence', () => {
  assert.equal(pkg.license, model.license.type);
  assert.equal(pkg.repository.url.replace(/\.git$/, ''), model.repository);
  assert.equal(pkg.dependencies && Object.keys(pkg.dependencies).length, 0, 'runtime dependencies must stay empty');
});

test('CHANGELOG, README, MODEL_SPECIFICATION and RELEASE_NOTES name the current version, and index.html shows it', () => {
  const v = META_INTELLIGENCE_VERSION;
  assert.match(text('CHANGELOG.md'), new RegExp(`## \\[${v.replace(/\./g, '\\.')}\\]`));
  for (const file of ['README.md', 'MODEL_SPECIFICATION.md', 'RELEASE_NOTES.md', 'index.html']) assert.ok(text(file).includes(v), `${file} does not mention ${v}`);
});

test('no document or page still presents the pre-V2 state as current', () => {
  const stale = [/0\.1\.0/, /AWU-10 and stops/i, /no real execution, composition/i];
  for (const file of ['README.md', 'MODEL_SPECIFICATION.md', 'index.html', 'docs/architecture.md', 'docs/api.md', 'docs/integration.md', 'model.json', 'package.json']) {
    // index.html: judge the page itself, not the embedded documents (the changelog legitimately mentions history).
    const body = text(file).replace(/<script id="__doc_data__"[\s\S]*?<\/script>/, '');
    for (const re of stale) {
      // docs/integration.md must quote the MAGENAIS-integrated manifest's own (pre-V2) version to explain the divergence.
      if (file === 'docs/integration.md' && re.source === '0\\.1\\.0') continue;
      assert.equal(re.test(body), false, `${file} matches ${re}`);
    }
  }
});

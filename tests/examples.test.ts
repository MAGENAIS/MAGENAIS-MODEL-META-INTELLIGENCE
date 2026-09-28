/** Every shipped example must run to completion against the standalone package. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const dir = new URL('../examples/', import.meta.url);
const examples = readdirSync(dir).filter((f) => /^\d\d-.*\.mjs$/.test(f)).sort();

test('all nine documented examples are present', () => {
  assert.equal(examples.length, 9);
  assert.deepEqual(examples.map((f) => f.slice(0, 2)), ['01', '02', '03', '04', '05', '06', '07', '08', '09']);
});

for (const file of examples) {
  test(`example ${file} runs cleanly`, () => {
    const result = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', new URL(file, dir).pathname], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr.trim(), '');
    assert.ok(result.stdout.length > 0);
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('private control plane exists and rejects a request without credentials', async () => {
  const {default: worker} = await import('../worker/index.mjs');
  const response = await worker.fetch(new Request('https://skills.test/api/skills'), {});
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('migration is additive in a dedicated skills namespace', async () => {
  const sql = await readFile(new URL('../migrations/0001_skills.sql', import.meta.url),'utf8');
  assert.match(sql,/CREATE TABLE ss_releases/);
  assert.doesNotMatch(sql,/DROP (TABLE|INDEX)|DELETE FROM/i);
});

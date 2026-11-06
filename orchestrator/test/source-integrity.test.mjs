import test from 'node:test';
import assert from 'node:assert/strict';
import reviewed from '../../skills-server/reviewed.json' with {type:'json'};
import {verifyPinnedSource,verifyReviewedAdapter} from '../source-integrity.mjs';

const checklist=reviewed['local-checklist'].adapters['checklist-v1'];

test('execution recomputes the exact pinned digest for the reviewed checklist',()=>{
  assert.equal(verifyReviewedAdapter('local-checklist','checklist-v1'),checklist.digest);
});
test('a forged or stale adapter hash is blocked before execution',()=>{
  assert.throws(()=>verifyPinnedSource({...checklist,digest:'0'.repeat(64)}),/reviewed_source_changed/);
});
test('an omitted source, duplicate source and path traversal are rejected',()=>{
  assert.throws(()=>verifyPinnedSource({...checklist,sources:checklist.sources.filter(name=>name!==checklist.entry)}),/invalid_reviewed_adapter/);
  assert.throws(()=>verifyPinnedSource({...checklist,sources:[...checklist.sources,checklist.entry]}),/invalid_reviewed_adapter/);
  assert.throws(()=>verifyPinnedSource({...checklist,sources:[...checklist.sources,'skills-server/../../secret']}),/invalid_reviewed_source_path/);
});
test('unknown skill or adapter fails closed',()=>{
  assert.throws(()=>verifyReviewedAdapter('outside','checklist-v1'),/unknown_reviewed_skill/);
  assert.throws(()=>verifyReviewedAdapter('local-checklist','unreviewed'),/unknown_reviewed_adapter/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../site/assets/images/',import.meta.url);
function png(name) {
  const b=readFileSync(new URL(name,root));
  assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a',name+' must be a PNG');
  return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),bytes:b.length};
}
test('approved SVG monogram is the orange, silver and violet code symbol',()=>{
  const s=readFileSync(new URL('mz-mark.svg',root),'utf8');
  assert.match(s,/viewBox="0 0 256 256"/);
  assert.match(s,/#F9A825/);
  assert.match(s,/#8A2BE2/);
  assert.match(s,/#F5F7FA/);
});
test('PNG app icons and social card use the generated brand sizes',()=>{
  assert.deepEqual([png('icon-192.png').width,png('icon-192.png').height],[192,192]);
  assert.deepEqual([png('icon-512.png').width,png('icon-512.png').height],[512,512]);
  assert.deepEqual([png('mz-share.png').width,png('mz-share.png').height],[1200,630]);
});

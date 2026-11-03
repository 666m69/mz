import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
test('social previews point to the approved MZcode image with cache-busting version',()=>{
  for(const name of ['site/index.html','site/tools/index.html','site/about/index.html','pilot/community/index.html']){
    const html=readFileSync(new URL(name,root),'utf8');
    assert.match(html,/mz-share\.png\?v=approved-mz-20261103/,name);
  }
});

import test from 'node:test';import assert from 'node:assert/strict';import {imageLayout,outputName} from '../site/assets/js/image-core.js';
test('contain keeps whole landscape photo centered',()=>assert.deepEqual(imageLayout(1600,800,800,800,'contain'),{x:0,y:200,width:800,height:400}));
test('cover fills square with centered crop',()=>assert.deepEqual(imageLayout(1600,800,800,800,'cover'),{x:-400,y:0,width:1600,height:800}));
test('output names cannot create traversal in ZIP',()=>{const n=outputName('../../test<script>.png',0,'jpg');assert.ok(!n.includes('/')&&!n.includes('<'));assert.ok(n.endsWith('.jpg'));assert.notEqual(outputName('a.png',0,'jpg'),outputName('a.png',1,'jpg'))});

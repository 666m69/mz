import test from 'node:test';import assert from 'node:assert/strict';import {quoteTotal,number} from '../site/assets/js/tool-core.js';
test('quote discount then percentage and line rounding',()=>{assert.deepEqual(quoteTotal([{qty:2,price:100},{qty:1,price:50}],25,15),{amounts:[200,50],subtotal:250,discount:25,net:225,tax:33.75,total:258.75})});
test('decimal rounding without floating point residue',()=>assert.equal(quoteTotal([{qty:3,price:0.1}],0,15).total,.35));
test('Arabic and Persian numeric input supported',()=>{assert.equal(number('١٢٫٥'),12.5);assert.equal(number('۱۲.۵'),12.5)});
test('invalid and extreme input refused',()=>{for(const n of ['','NaN','Infinity','-1','1e8','0x10','abc'])assert.throws(()=>number(n));assert.throws(()=>quoteTotal([{qty:1,price:10}],11,0));assert.throws(()=>quoteTotal([{qty:0,price:10}],0,0));assert.throws(()=>quoteTotal([{qty:1,price:10}],0,101));assert.throws(()=>quoteTotal(Array(101).fill({qty:1,price:1})));});
test('zero priced item and full discount supported',()=>{assert.equal(quoteTotal([{qty:1,price:0}]).total,0);assert.equal(quoteTotal([{qty:1,price:5}],5,15).total,0)});

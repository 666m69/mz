import test from 'node:test';import assert from 'node:assert/strict';import {recipeCost} from '../site/assets/js/recipe-core.js';
const base={ingredients:[{cost:20,pack:1,packUnit:'kg',used:100,useUnit:'g'}],waste:0,portions:2,packaging:2,overhead:0,sale:10,target:60};
test('unit conversion, portions and target margin',()=>{const r=recipeCost(base);assert.equal(r.materials,2);assert.equal(r.batch,4);assert.equal(r.portion,2);assert.equal(r.margin,80);assert.equal(r.suggested,5)});
test('waste accounts for usable yield',()=>assert.equal(recipeCost({...base,waste:50}).batch,6));
test('volume conversion and zero sale',()=>{const r=recipeCost({...base,ingredients:[{cost:10,pack:1,packUnit:'l',used:500,useUnit:'ml'}],sale:0});assert.equal(r.materials,5);assert.equal(r.margin,null)});
test('incompatible units and invalid divisors refused',()=>{for(const patch of [{portions:0},{target:100},{waste:100}])assert.throws(()=>recipeCost({...base,...patch}));assert.throws(()=>recipeCost({...base,ingredients:[{...base.ingredients[0],useUnit:'ml'}]}))});

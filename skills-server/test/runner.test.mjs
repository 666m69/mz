import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const runner=fileURLToPath(new URL('../runner/agent.py',import.meta.url));
test('runner boundary actively denies external file access, network and child processes with limits in force',()=>{
  const p=spawnSync('python3',[runner,'--probe'],{encoding:'utf8',timeout:15000});
  assert.equal(p.status,0,p.stderr);
  assert.deepEqual(JSON.parse(p.stdout),{network:'denied',read:'denied',write:'denied',spawn:'denied',secret:'absent',limits:'verified'});
});

import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';
function denied(fn){assert.throws(fn,e=>e.code==='ERR_ACCESS_DENIED');return 'denied';}
const limits=readFileSync(process.argv[2],'utf8');assert.equal(limits.trim(),'verified');
const network=await new Promise((resolve,reject)=>{
  const s=createServer();s.on('error',e=>e.code==='EPERM'?resolve('denied'):reject(e));
  s.listen(0,'127.0.0.1',()=>{s.close();reject(new Error('network permitted'));});
});
const read=denied(()=>readFileSync('/etc/passwd'));
const write=denied(()=>writeFileSync('/tmp/mz-probe-must-never-exist','x'));
const spawn=denied(()=>spawnSync(process.execPath,['--version']));
assert(!process.env.SKILLS_RUNNER_TOKEN && !process.env.MZ_CANARY_SECRET);
console.log(JSON.stringify({network,read,write,spawn,secret:'absent',limits:'verified'}));

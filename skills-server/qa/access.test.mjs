import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicKey,publicEncrypt,randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRecipient,grantLabel,openGrant} from './access.mjs';
test('only the intended runner and exact run/attempt/commit open an Access credential',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'mz-grant-'));
  try{
    const n=await createRecipient(dir),pem=await readFile(join(dir,'access.pem'));
    assert.equal((await stat(join(dir,'access.pem'))).mode&0o777,0o600);
    const key=createPublicKey({format:'jwk',key:{kty:'RSA',e:'AQAB',n}});
    const pair=['example-client-id-for-test',randomBytes(32).toString('hex')],label=grantLabel('123','1','a'.repeat(40));
    const box=publicEncrypt({key,oaepHash:'sha256',oaepLabel:Buffer.from(label)},Buffer.from(JSON.stringify(pair))).toString('base64url');
    assert.deepEqual(openGrant(pem,box,label),{id:pair[0],secret:pair[1]});
    assert.throws(()=>openGrant(pem,box,grantLabel('123','2','a'.repeat(40))));
    assert.throws(()=>openGrant(pem,box.slice(2),label));
    await assert.rejects(createRecipient(dir));
  }finally{await rm(dir,{recursive:true,force:true});}
});

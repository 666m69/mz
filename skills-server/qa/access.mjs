import assert from 'node:assert/strict';
import {createPrivateKey,generateKeyPairSync,privateDecrypt} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';

const repo='666m69/mz',branch='test/skills-hosted-acceptance-20261104';
export const grantLabel=(run,attempt,sha)=>'mz-qa-access/v1/'+run+'/'+attempt+'/'+sha;

export async function createRecipient(directory){
  const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  await writeFile(join(directory,'access.pem'),privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600,flag:'wx'});
  return publicKey.export({format:'jwk'}).n;
}

export function openGrant(pem,ciphertext,label){
  const bytes=privateDecrypt({key:createPrivateKey(pem),oaepHash:'sha256',oaepLabel:Buffer.from(label)},Buffer.from(ciphertext,'base64url'));
  const [id,secret]=JSON.parse(bytes.toString('utf8'));
  assert.match(id,/^[a-zA-Z0-9._-]{18,100}$/);assert.match(secret,/^[a-zA-Z0-9._-]{32,100}$/);
  return {id,secret};
}

export async function claimGrant(directory,job){
  const pem=await readFile(join(directory,'access.pem'));
  const label=grantLabel(job.GITHUB_RUN_ID,job.GITHUB_RUN_ATTEMPT,job.GITHUB_SHA);
  const until=Date.now()+8*60000;
  while(Date.now()<until){
    const path='https://api.github.com/repos/'+repo+'/commits/'+encodeURIComponent(branch)+'?qa='+Math.floor(Date.now()/8000);
    const r=await fetch(path,{redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{Authorization:'Bearer '+job.QA_GITHUB_READ,'User-Agent':'mz-skills-hosted-qa',Accept:'application/vnd.github+json'}});
    if(r.ok){
      const tip=await r.json();
      const grant=tip.commit?.message?.split('\n').find(line=>line.startsWith(label+' '));
      if(grant&&tip.parents?.length===1&&tip.parents[0].sha===job.GITHUB_SHA)
        return openGrant(pem,grant.slice(label.length+1),label);
    }else if(![403,429,500,502,503,504].includes(r.status)){throw Error('Could not inspect QA grant: '+r.status);}
    await wait(8000);
  }
  throw Error('No operator grant matched this run, attempt and commit before the deadline');
}

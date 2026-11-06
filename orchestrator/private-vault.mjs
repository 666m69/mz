/* MZcode PRIVATE delivery primitive — staging only.
 * Never expose directly to visitors. The caller must provide an identity
 * verified by the trusted API; an untrusted clientId parameter is NOT auth.
 * Artifacts must already have passed the reviewed builder acceptance gate.
 */
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdir,writeFile,readFile,readdir,rm,rename,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const DAY=24*60*60*1000;
const MAX_ZIP_BYTES=48*1024;
const ID=/^[a-zA-Z0-9_-]{6,80}$/;
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=(code)=>{const e=new Error(code);e.code=code;throw e};

export class PrivateDeliveryVault {
  constructor({root,secretKey,now=()=>Date.now()}={}){
    if(typeof root!=='string'||!root.trim())fail('VAULT_ROOT_REQUIRED');
    const key=typeof secretKey==='string'?Buffer.from(secretKey,'utf8'):secretKey;
    if(!Buffer.isBuffer(key)||key.length<32)fail('VAULT_SECRET_REQUIRED');
    if(typeof now!=='function')fail('INVALID_CLOCK');
    this.root=resolve(root);
    this.key=Buffer.from(key);
    this.now=now;
  }
  identity(clientId,orderId){
    if(typeof clientId!=='string'||!ID.test(clientId)
      ||typeof orderId!=='string'||!ID.test(orderId))fail('INVALID_ID');
    return {clientHash:sha(clientId),orderId};
  }
  directory(clientHash,orderId){
    return join(this.root,clientHash,orderId);
  }
  sign(body){
    return createHmac('sha256',this.key).update(body).digest('base64url');
  }
  tokenFor({clientHash,orderId,expiresAt}){
    const body=Buffer.from(JSON.stringify({v:1,clientHash,orderId,expiresAt,nonce:randomBytes(16).toString('hex')})).toString('base64url');
    return body+'.'+this.sign(body);
  }
  validateToken(token,clientHash,orderId){
    if(typeof token!=='string'||token.length>1024)fail('INVALID_TOKEN');
    const parts=token.split('.');
    if(parts.length!==2||!parts[0]||!parts[1])fail('INVALID_TOKEN');
    const expected=this.sign(parts[0]);
    const actual=Buffer.from(parts[1],'utf8');
    const wanted=Buffer.from(expected,'utf8');
    if(actual.length!==wanted.length||!timingSafeEqual(actual,wanted))fail('INVALID_TOKEN');
    let payload;
    try{payload=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'))}
    catch{fail('INVALID_TOKEN')}
    if(payload?.v!==1||payload.clientHash!==clientHash||payload.orderId!==orderId
       ||!Number.isSafeInteger(payload.expiresAt))fail('ACCESS_DENIED');
    if(this.now()>=payload.expiresAt)fail('TOKEN_EXPIRED');
    return payload;
  }
  // Store only reviewed and pre-tested ZIP bytes; no visitor-controlled paths.
  async store({orderId,clientId,zip,downloadDays=14,retentionDays=30}={}){
    const {clientHash}=this.identity(clientId,orderId);
    if(!Buffer.isBuffer(zip)||zip.length<4||zip.length>MAX_ZIP_BYTES
       ||zip.readUInt32LE(0)!==0x04034b50)fail('INVALID_ARTIFACT');
    if(!Number.isSafeInteger(downloadDays)||downloadDays<1||downloadDays>14
       ||!Number.isSafeInteger(retentionDays)||retentionDays<downloadDays
       ||retentionDays>30)fail('INVALID_RETENTION');
    const dir=this.directory(clientHash,orderId);
    await mkdir(dir,{recursive:true,mode:0o700});
    const artifact=join(dir,'artifact.zip');
    const createdAt=this.now(),expiresAt=createdAt+downloadDays*DAY,purgeAt=createdAt+retentionDays*DAY;
    const receipt={v:1,orderId,clientHash,createdAt,expiresAt,purgeAt,sha256:sha(zip),bytes:zip.length,revoked:false};
    await writeFile(artifact,zip,{flag:'wx',mode:0o600});
    try{await writeFile(join(dir,'receipt.json'),JSON.stringify(receipt),{flag:'wx',mode:0o600})}
    catch(e){await rm(artifact,{force:true});throw e}
    return {orderId,sha256:receipt.sha256,bytes:zip.length,
      expiresAt:new Date(expiresAt).toISOString(),
      token:this.tokenFor({clientHash,orderId,expiresAt})};
  }
  async readReceipt(clientHash,orderId){
    let receipt;
    try{receipt=JSON.parse(await readFile(join(this.directory(clientHash,orderId),'receipt.json'),'utf8'))}
    catch{fail('NOT_FOUND')}
    if(receipt?.v!==1||receipt.clientHash!==clientHash||receipt.orderId!==orderId
       ||!Number.isSafeInteger(receipt.purgeAt))fail('CORRUPT_RECEIPT');
    return receipt;
  }
  // clientId MUST come from authenticated server context (not the request JSON).
  async download({orderId,clientId,token}={}){
    const {clientHash}=this.identity(clientId,orderId);
    const payload=this.validateToken(token,clientHash,orderId);
    const receipt=await this.readReceipt(clientHash,orderId);
    if(receipt.revoked||this.now()>=receipt.expiresAt||this.now()>=receipt.purgeAt
       ||receipt.expiresAt!==payload.expiresAt)fail('ACCESS_DENIED');
    let zip;
    try{zip=await readFile(join(this.directory(clientHash,orderId),'artifact.zip'))}
    catch{fail('NOT_FOUND')}
    if(zip.length!==receipt.bytes||sha(zip)!==receipt.sha256)fail('CORRUPT_ARTIFACT');
    return {zip,sha256:receipt.sha256};
  }
  async revoke({orderId,clientId}={}){
    const {clientHash}=this.identity(clientId,orderId);
    const receipt=await this.readReceipt(clientHash,orderId);
    const dir=this.directory(clientHash,orderId);
    const temp=join(dir,'.receipt-'+randomBytes(8).toString('hex'));
    await writeFile(temp,JSON.stringify({...receipt,revoked:true}),{flag:'wx',mode:0o600});
    await rename(temp,join(dir,'receipt.json'));
    return {revoked:true};
  }
  // Must be invoked by a trusted scheduled task. Nothing runs automatically.
  async purgeExpired(){
    let purged=0;
    let clients=[];
    try{clients=await readdir(this.root,{withFileTypes:true})}catch(e){if(e.code==='ENOENT')return 0;throw e}
    for(const client of clients){
      if(!client.isDirectory()||!/^[a-f0-9]{64}$/.test(client.name))continue;
      const cdir=join(this.root,client.name);
      for(const order of await readdir(cdir,{withFileTypes:true})){
        if(!order.isDirectory()||!ID.test(order.name))continue;
        const dir=join(cdir,order.name);
        let receipt;
        try{receipt=JSON.parse(await readFile(join(dir,'receipt.json'),'utf8'))}catch{continue}
        if(receipt?.clientHash!==client.name||receipt?.orderId!==order.name
           ||!Number.isSafeInteger(receipt?.purgeAt)||this.now()<receipt.purgeAt)continue;
        await rm(dir,{recursive:true,force:true});purged++;
      }
    }
    return purged;
  }
}

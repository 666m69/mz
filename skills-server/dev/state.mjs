import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,open,link,unlink,lstat,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const token=()=>randomBytes(32).toString('base64url');
export function newSecrets(){return {owner:token(),runner:token(),data:token(),capability:token()};}
async function info(path){try{return await lstat(path);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
function privateFile(st){if(!st?.isFile() || (st.mode&0o077))throw Error('Private state files require mode 0600');}
export async function localSettings(directory){
  const dir=resolve(directory);await mkdir(dir,{mode:0o700,recursive:true});
  const st=await lstat(dir);if(!st.isDirectory() || (st.mode&0o077))throw Error('State directory requires mode 0700');
  const credentials=join(dir,'credentials.json'),db=join(dir,'skills.sqlite');
  if(!await info(credentials)){
    if(await info(db))throw Error('Existing database needs its original credentials');
    // Publish fully written keys exactly once, including when two local starts race.
    const temp=join(dir,'.init-'+randomUUID()),fd=await open(temp,'wx',0o600);
    try{await fd.writeFile(JSON.stringify(newSecrets()));await fd.sync();}finally{await fd.close();}
    try{await link(temp,credentials);}catch(e){if(e.code!=='EEXIST')throw e;}finally{await unlink(temp);}
  }
  privateFile(await info(credentials));const keys=JSON.parse(await readFile(credentials,'utf8'));
  const vals=['owner','runner','data','capability'].map(k=>keys[k]);
  if(!vals.every(v=>typeof v==='string' && /^[A-Za-z0-9_-]{43}$/.test(v))||new Set(vals).size!==4)throw Error('Invalid local credentials');
  try{const fd=await open(db,'wx',0o600);await fd.close();}catch(e){if(e.code!=='EEXIST')throw e;}
  privateFile(await info(db));return {db,keys};
}

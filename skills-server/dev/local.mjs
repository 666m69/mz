// Local-only reference host. The production Worker never imports Node modules.
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import worker from '../worker/index.mjs';
import {newSecrets,localSettings} from './state.mjs';
export function localBinding(sqlite) {
  class Statement {
    constructor(sql,args=[]){this.sql=sql;this.args=args;}
    bind(...args){return new Statement(this.sql,args);}
    rows(){return sqlite.prepare(this.sql).all(...this.args);}
    async first(){return this.rows()[0]??null;}
    async all(){return {results:this.rows()};}
  }
  return {prepare:sql=>new Statement(sql),async batch(list){
    sqlite.exec('BEGIN IMMEDIATE');
    try{const results=list.map(s=>({results:s.rows()}));sqlite.exec('COMMIT');return results;}
    catch(e){sqlite.exec('ROLLBACK');throw e;}
  }};
}
export async function localEnvironment(file=':memory:',secrets){
  if(file!==':memory:'&&!secrets)throw Error('Stable local credentials required');
  const sqlite=new DatabaseSync(file);sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=2500');
  const migration=await readFile(new URL('../migrations/0001_skills.sql',import.meta.url),'utf8');
  sqlite.exec('BEGIN IMMEDIATE');
  try{
    if(!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE name='ss_skills'").get()){
      if(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get())throw Error('Expected a dedicated empty database');
      sqlite.exec(migration);
    }
    sqlite.exec('COMMIT');
  }catch(e){sqlite.exec('ROLLBACK');sqlite.close();throw e;}
  const {owner,runner,data,capability}=secrets??newSecrets(),digest=s=>createHash('sha256').update(s).digest('hex');
  const env={SKILLS_DB:localBinding(sqlite),OWNER_TOKEN_SHA256:digest(owner),RUNNER_TOKEN_SHA256:digest(runner),
    DATA_KEY:data,CAPABILITY_KEY:capability,ASSETS:{async fetch(req){
      const name={'/':'index.html','/admin.js':'admin.js','/admin.css':'admin.css'}[new URL(req.url).pathname];
      const data=await readFile(new URL('../admin/'+name,import.meta.url));
      return new Response(data,{headers:{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css':'text/javascript; charset=utf-8'}});
    }}};
  return {sqlite,owner,runner,env};
}
export async function localState(directory){
  const {db,keys}=await localSettings(directory);return localEnvironment(db,keys);
}
export async function serve(env,port=0) {
  const server=createServer(async(incoming,out)=>{
    try{
      // Use backpressure and the Worker's byte cap for untrusted bodies.
      const origin='http://127.0.0.1:'+server.address().port;
      const init={method:incoming.method,headers:incoming.headers};
      if(!['GET','HEAD'].includes(incoming.method)){init.body=incoming;init.duplex='half';}
      const r=await worker.fetch(new Request(new URL(incoming.url,origin),init),env);
      out.writeHead(r.status,Object.fromEntries(r.headers));out.end(new Uint8Array(await r.arrayBuffer()));
    }catch{out.writeHead(500);out.end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {server,url:'http://127.0.0.1:'+server.address().port};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(!process.stdout.isTTY){console.error('Use an interactive terminal for private local credentials.');process.exit(1);}
  const {env,owner,runner}=await localState(process.env.MZ_SKILLS_STATE_DIR || fileURLToPath(new URL('../.local-state',import.meta.url)));
  const port=Number(process.env.MZ_SKILLS_PORT||8791);
  const {url}=await serve(env,port);
  console.log('جلسة محلية خاصة',url,'\nرمز المالك',owner,'\nرمز المشغّل',runner);
}

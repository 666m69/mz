// Local-only reference host. The production Worker never imports Node modules.
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import worker from '../worker/index.mjs';
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
export async function localEnvironment(file=':memory:'){
  const sqlite=new DatabaseSync(file);sqlite.exec('PRAGMA foreign_keys=ON');
  if(!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE name='ss_skills'").get())
    sqlite.exec(await readFile(new URL('../migrations/0001_skills.sql',import.meta.url),'utf8'));
  const token=()=>randomBytes(32).toString('base64url');
  const owner=token(), runner=token(), digest=s=>createHash('sha256').update(s).digest('hex');
  const env={SKILLS_DB:localBinding(sqlite),OWNER_TOKEN_SHA256:digest(owner),RUNNER_TOKEN_SHA256:digest(runner),
    DATA_KEY:token(),CAPABILITY_KEY:token(),ASSETS:{async fetch(req){
      const name={'/':'index.html','/admin.js':'admin.js','/admin.css':'admin.css'}[new URL(req.url).pathname];
      const data=await readFile(new URL('../admin/'+name,import.meta.url));
      return new Response(data,{headers:{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css':'text/javascript; charset=utf-8'}});
    }}};
  return {sqlite,owner,runner,env};
}
export async function serve(env) {
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
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server,url:'http://127.0.0.1:'+server.address().port};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {env,owner,runner}=await localEnvironment();
  const {url}=await serve(env);
  // Only an interactive operator receives these short-lived local credentials.
  if(!process.stdout.isTTY){console.error('Use an interactive terminal for private local credentials.');process.exit(1);}
  console.log('جلسة اختبار على هذا الجهاز فقط',url,'\nرمز المالك',owner,'\nرمز المشغّل',runner);
}

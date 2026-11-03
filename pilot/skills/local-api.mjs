import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createSkillsService,createSkillsHttpHandler} from './server.mjs';
const token=process.env.MZ_SKILLS_OWNER_TOKEN;
if(!token||token.length<32)throw new Error('MZ_SKILLS_OWNER_TOKEN must be at least 32 chars');
const service=createSkillsService({ownerToken:token,outputRoot:resolve('.mz-generated')});
const handler=createSkillsHttpHandler(service);
const server=createServer(async(req,res)=>{
 try{
   if(req.method==='GET'&&req.url==='/admin'){
     const html=await readFile(new URL('./admin-local.html',import.meta.url));
     res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'"});res.end(html);return;
   }
   if(!req.url?.startsWith('/internal/skills')){res.writeHead(404);res.end();return;}
   let size=0;const chunks=[];
   for await(const chunk of req){size+=chunk.length;if(size>8192){res.writeHead(413);res.end();return;}chunks.push(chunk);}
   const body=Buffer.concat(chunks);
   const request=new Request('http://127.0.0.1:8789'+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:body});
   const response=await handler(request);
   res.writeHead(response.status,Object.fromEntries(response.headers));
   res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:'internal_error'}));}
});
server.listen(8789,'127.0.0.1',()=>console.log('MZcode skills local API: http://127.0.0.1:8789/internal/skills'));

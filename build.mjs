import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=new URL('./site/',import.meta.url),assets={};const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.xml':'application/xml','.txt':'text/plain; charset=utf-8'};
// Ship the shared studio styles in one request. Individual styles remain available for existing pages.
const studioStyles = ['catalog','studio','vision','showcase','refined','offers','saudi-entry','mz-experience'];
const originalStyles = studioStyles.filter(name => !['saudi-entry','mz-experience'].includes(name));
const styleLinks = originalStyles.map(name => `<link rel="stylesheet" href="/assets/css/${name}.css">`).join('');
const bundlePath = '/assets/css/studio-site.css';
function addAsset(pathname, bytes, type) {
 assets[pathname] = [bytes.toString('base64'),type,crypto.createHash('sha256').update(bytes).digest('hex')];
}
addAsset(bundlePath, Buffer.from(studioStyles.map(name => fs.readFileSync(new URL('assets/css/'+name+'.css',root),'utf8')).join('\n')), types['.css']);
function walk(dir) {
 for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){walk(file);continue}
  const relative=path.relative(root.pathname,file);
  if(relative.startsWith('_')||relative==='menu-server.js')continue;
  let content=fs.readFileSync(file);
  if(relative.endsWith('.html')){
   content=Buffer.from(content.toString('utf8').replace(styleLinks,`<link rel="stylesheet" href="${bundlePath}">`));
  }
  addAsset('/'+relative,content,types[path.extname(file)]||'application/octet-stream');
 }
}
walk(root.pathname);
// Preview-only receipt testing uses the same audited ideas handler, isolated in a closure.
// Its asset route is intentionally empty: Pages already serves the visual shell.
const ideasSource=fs.readFileSync(new URL('pilot/mz-ideas-worker.js',import.meta.url),'utf8')
 .replace('const assets=/* LAB_ASSETS */ {};','const assets={};')
 .replace('export default {async fetch(request,env){','return {async fetch(request,env){');
let worker=fs.readFileSync(new URL('menu-server.js',root),'utf8').replaceAll('export ','')
 +'\nconst previewIdeasModule=(()=>{\n'+ideasSource+'\n})();\n'
 +fs.readFileSync(new URL('_worker.js',root),'utf8').replace("import {menuHandle} from './menu-server.js';",'').replace('export default {','const application = {');
worker+='\nconst bundledAssets='+JSON.stringify(assets)+';\n';
worker+=`async function staticFetch(req){const u=new URL(req.url);let p;try{p=decodeURIComponent(u.pathname)}catch{return new Response('Bad path',{status:400})}if(p.includes('..')||p.includes('\\\\'))return new Response('Not found',{status:404});let key=p;if(p.endsWith('/'))key+='index.html';else if(!bundledAssets[key]&&bundledAssets[key+'/index.html'])return Response.redirect(u.origin+p+'/',308);else if(!bundledAssets[key]&&bundledAssets[key+'.html'])key+='.html';let a=bundledAssets[key],status=200;if(!a){a=bundledAssets['/404.html'];status=404}const h={'Content-Type':a[1],'ETag':'"'+a[2]+'"','Content-Security-Policy':"default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://cloudflareinsights.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"};if(p.startsWith('/games/')||p.startsWith('/tools/')||p.startsWith('/assets/js/')||p==='/assets/css/tools.css')h['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";if(p==='/assets/css/studio-site.css')h['Cache-Control']='no-cache';if(['/tools/','/tools/quote/','/tools/menu/','/tools/property/','/tools/clients/','/tools/recipe/','/tools/images/'].includes(p))h['Content-Security-Policy']=h['Content-Security-Policy'].replace("script-src 'self';","script-src 'self' https://static.cloudflareinsights.com;").replace("connect-src 'self';","connect-src 'self' https://cloudflareinsights.com;");return new Response(req.method==='HEAD'?null:Uint8Array.from(atob(a[0]),c=>c.charCodeAt(0)),{status,headers:h})}
export default {fetch(req,env,ctx){return application.fetch(req,{...env,ASSETS:{fetch:staticFetch}},ctx)}};
`;
fs.mkdirSync(new URL('./build/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('./build/worker.mjs',import.meta.url),worker);fs.writeFileSync(new URL('./build/asset-manifest.json',import.meta.url),JSON.stringify(Object.fromEntries(Object.entries(assets).map(([k,v])=>[k,v[2]])),null,2));console.log('Built '+Object.keys(assets).length+' assets; worker '+Buffer.byteLength(worker)+' bytes');

fs.mkdirSync(new URL("./deploy/",import.meta.url),{recursive:true});fs.writeFileSync(new URL("./deploy/_worker.js",import.meta.url),worker);fs.writeFileSync(new URL("./deploy/_routes.json",import.meta.url),JSON.stringify({version:1,include:["/*"],exclude:[]}));

import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=new URL('./site/',import.meta.url),assets={};const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.xml':'application/xml','.txt':'text/plain; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8'};
// Ship the shared studio styles in one request. Individual styles remain available for existing pages.
const studioStyles = ['catalog','studio','vision','showcase','refined','offers','saudi-entry','mz-experience'];
const originalStyles = studioStyles.filter(name => !['saudi-entry','mz-experience'].includes(name));
const styleLinks = originalStyles.map(name => `<link rel="stylesheet" href="/assets/css/${name}.css">`).join('');
const bundlePath = '/assets/css/studio-site.css';
// Public MZcode pages share one accessible, reviewed, brand-consistent assistant.
const floatingAssistantMarkup = "<div id=\"mz-assistant-root\" dir=\"rtl\" aria-label=\"مساعد MZcode العائم\">\n  <section id=\"mz-chat-window\" role=\"region\" aria-labelledby=\"mz-floating-title\" hidden>\n    <div class=\"mz-chat-header\">\n      <div class=\"mz-brand-badge\"><img src=\"/assets/images/mz-mark.svg\" alt=\"\" width=\"29\" height=\"29\"></div>\n      <div class=\"mz-chat-heading\">\n        <h2 id=\"mz-floating-title\">مساعد MZcode الذكي</h2>\n        <span>مهارات MZcode المتاحة • تشغيل محلي</span>\n      </div>\n      <button id=\"mz-chat-close\" type=\"button\" aria-label=\"إغلاق المساعد\">×</button>\n    </div>\n    <div id=\"mz-chat-messages\" role=\"log\" aria-live=\"polite\" aria-relevant=\"additions\">\n      <div class=\"mz-floating-msg mz-floating-bot\"><strong>ارررحب 🫡</strong><span>قول وش تحتاج، وأشوف لك أداة شغّالة أو أجهّز لك مسودة. وإذا ما توفرت المهارة، نسجل طلب مراجعة.</span></div>\n    </div>\n    <div class=\"mz-chat-quick\" role=\"group\" aria-label=\"اقتراحات جاهزة\">\n      <button type=\"button\" data-mz-quick=\"أنا معلم وأحتاج رسالة لأولياء الأمور\">رسالة معلم</button>\n      <button type=\"button\" data-mz-quick=\"أبغى عرض سعر لعميل\">عرض سعر</button>\n      <button type=\"button\" data-mz-quick=\"أبغى منيو لمطعم\">منيو</button>\n    </div>\n    <form id=\"mz-chat-form\" autocomplete=\"off\">\n      <label for=\"mz-chat-input\" class=\"mz-floating-only-screen-reader\">اكتب استفسارك أو طلبك</label>\n      <textarea id=\"mz-chat-input\" maxlength=\"1200\" rows=\"2\" required placeholder=\"اكتب اللي مجهدك هنا...\"></textarea>\n      <button id=\"mz-chat-send\" type=\"submit\">إرسال</button>\n    </form>\n    <p class=\"mz-chat-note\">هذا مساعد مهارات وليس محادثة ذكاء اصطناعي عامة. لا يرسل رسائلك إلى الخادم إلا إذا اخترت تقديم طلب منفصل.</p>\n  </section>\n  <button id=\"mz-bot-trigger\" type=\"button\" title=\"مساعد MZcode\" aria-label=\"افتح مساعد MZcode\" aria-controls=\"mz-chat-window\" aria-expanded=\"false\">\n    <canvas id=\"mz-portal-canvas\" width=\"160\" height=\"160\" aria-hidden=\"true\"></canvas>\n    <img class=\"mz-floating-logo\" src=\"/assets/images/mz-mark.svg\" alt=\"\" width=\"35\" height=\"35\">\n  </button>\n</div>";

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
   let html=content.toString('utf8').replace(styleLinks,`<link rel="stylesheet" href="${bundlePath}">`);
   // Every standalone MZcode-owned web tool/game receives the original approved visible mark.
   // Existing visible marks are left alone; favicon-only references do not count.
   const isStandalone=/^(?:tools\/[^/]+\/|games\/[^/]+\/|coreresto\/).*\.html$/.test(relative);
   const hasVisibleMark=/<img\b[^>]*\bsrc=["']\/assets\/images\/mz-mark\.svg["']/i.test(html);
   if(isStandalone&&!hasVisibleMark){
    if(!/<\/head>/i.test(html)||!/<\/body>/i.test(html))throw Error('Missing HTML document boundaries: '+relative);
    const css='<link rel="stylesheet" href="/assets/css/mz-project-signature.css">';
    const stamp='<div class="mz-made-by"><a href="/" aria-label="صُنع بواسطة MZcode — الصفحة الرئيسية"><img src="/assets/images/mz-mark.svg" width="27" height="27" alt=""><span>صُنع بواسطة MZcode</span></a></div>';
    html=html.replace(/<\/head>/i,css+'</head>').replace(/<\/body>/i,stamp+'</body>');
   }
   // Build fails instead of shipping an unbranded standalone MZcode-owned tool.
   if(isStandalone&&!/<img\b[^>]*\bsrc=["']\/assets\/images\/mz-mark\.svg["']/i.test(html))
    throw Error('Visible MZcode emblem required: '+relative);
   // Exclude privileged administration and visitors' independently published menus.
   const publicPage=relative!=='404.html'&&!relative.startsWith('admin/')&&!relative.startsWith('tools/menu/view/');
   if(publicPage&&/<\/head>/i.test(html)&&/<\/body>/i.test(html)){
     if(html.includes('id="mz-assistant-root"'))throw Error('Duplicate floating assistant root: '+relative);
     html=html.replace(/<\/head>/i,'<link rel="stylesheet" href="/assets/css/mz-floating-assistant.css"></head>');
     html=html.replace(/<\/body>/i,floatingAssistantMarkup+'<script type="module" src="/assets/js/mz-floating-assistant.mjs"></script></body>');
   }
   content=Buffer.from(html);
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
worker+=`async function staticFetch(req){const u=new URL(req.url);let p;try{p=decodeURIComponent(u.pathname)}catch{return new Response('Bad path',{status:400})}if(p.includes('..')||p.includes('\\\\'))return new Response('Not found',{status:404});let key=p;if(p.endsWith('/'))key+='index.html';else if(!bundledAssets[key]&&bundledAssets[key+'/index.html'])return Response.redirect(u.origin+p+'/',308);else if(!bundledAssets[key]&&bundledAssets[key+'.html'])key+='.html';let a=bundledAssets[key],status=200;if(!a){a=bundledAssets['/404.html'];status=404}const h={'Content-Type':a[1],'ETag':'"'+a[2]+'"','Content-Security-Policy':"default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://cloudflareinsights.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"};if(p.startsWith('/games/')||p.startsWith('/tools/')||p.startsWith('/assets/js/')||p==='/assets/css/tools.css')h['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";if(p==='/assets/css/studio-site.css')h['Cache-Control']='no-cache';if(['/manifest.webmanifest','/assets/images/mz-mark.svg','/assets/images/icon-192.png','/assets/images/icon-512.png'].includes(p))h['Cache-Control']='no-cache, max-age=0, must-revalidate';if(['/tools/','/tools/quote/','/tools/menu/','/tools/property/','/tools/clients/','/tools/recipe/','/tools/images/'].includes(p))h['Content-Security-Policy']=h['Content-Security-Policy'].replace("script-src 'self';","script-src 'self' https://static.cloudflareinsights.com;").replace("connect-src 'self';","connect-src 'self' https://cloudflareinsights.com;");return new Response(req.method==='HEAD'?null:Uint8Array.from(atob(a[0]),c=>c.charCodeAt(0)),{status,headers:h})}
export default {fetch(req,env,ctx){return application.fetch(req,{...env,ASSETS:{fetch:staticFetch}},ctx)}};
`;
fs.mkdirSync(new URL('./build/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('./build/worker.mjs',import.meta.url),worker);fs.writeFileSync(new URL('./build/asset-manifest.json',import.meta.url),JSON.stringify(Object.fromEntries(Object.entries(assets).map(([k,v])=>[k,v[2]])),null,2));console.log('Built '+Object.keys(assets).length+' assets; worker '+Buffer.byteLength(worker)+' bytes');

fs.mkdirSync(new URL("./deploy/",import.meta.url),{recursive:true});fs.writeFileSync(new URL("./deploy/_worker.js",import.meta.url),worker);fs.writeFileSync(new URL("./deploy/_routes.json",import.meta.url),JSON.stringify({version:1,include:["/*"],exclude:[]}));

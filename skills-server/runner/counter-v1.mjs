import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {assessCapability} from '../../pilot/capability-gate.mjs';
export const fixture={idea:'أريد عداد محاولات محلي مع زيادة ونقصان وحفظ العدد'};
const fail=code=>{throw Object.assign(new Error(code),{code});};
export async function build({idea,title='عدادي المحلي',initial_count=0},root) {
  if(typeof idea!=='string'||idea.trim().length<20||idea.length>2000)fail('INVALID_IDEA');
  if(assessCapability(idea).decision!=='prototype_only')fail('REVIEW_REQUIRED');
  if(!/عد[ّ]?اد|counter|tally/i.test(idea))fail('UNSUPPORTED_IDEA');
  if(typeof title!=='string'||!/^[\p{L}\p{N}][\p{L}\p{N} \u060C.,()،\-]{1,58}$/u.test(title))fail('INVALID_TITLE');
  if(!Number.isSafeInteger(initial_count)||initial_count<0||initial_count>9999)fail('INVALID_INPUT');
  const path=await mkdtemp(join(root,'counter-')), appId=randomUUID();
  const blueprint={kind:'local-counter',schemaVersion:1,title,features:['increment','decrement','reset','local-persistence'],
    storage:'browser-local',minimum:0,maximum:9999,initial_count,automatedRelease:false,externalCostsSar:0};
  const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'">
<meta name="referrer" content="no-referrer"><title>${title}</title><link rel="stylesheet" href="./styles.css"></head>
<body><main><p>استوديو MZcode</p><h1>${title}</h1><p>لكل ضغطة عدد. يُحفظ على هذا الجهاز فقط.</p>
<output id="count" aria-live="polite" data-key="${appId}" data-initial="${initial_count}">${initial_count}</output>
<div><button type="button" id="plus">زيادة +</button><button type="button" id="minus">إنقاص −</button>
<button type="button" id="reset">تصفير</button></div><p id="notice" role="status"></p></main>
<script src="./app.js" defer></script></body></html>`;
  const style=':root{color-scheme:dark;font-family:system-ui;background:#102028;color:#eff7f7}main{max-width:32rem;margin:10vh auto;padding:1.5rem}output{display:block;font-size:5rem;color:#79e0bb;font-variant-numeric:tabular-nums}div{display:flex;gap:.5rem;flex-wrap:wrap}button{font:inherit;padding:.75rem 1rem;border-radius:.7rem;border:1px solid #79e0bb;background:#17383b;color:white}button:focus-visible{outline:3px solid white}';
  await Promise.all([writeFile(join(path,'index.html'),html),writeFile(join(path,'styles.css'),style),
    writeFile(join(path,'app.js'),await readFile(new URL('./counter-app.js',import.meta.url))),
    writeFile(join(path,'blueprint.json'),JSON.stringify(blueprint,null,2))]);
  return path;
}

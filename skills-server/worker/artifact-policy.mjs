// Restricted, reviewed-template contract. This is NOT a sandbox for arbitrary JS.
// Git blob pins bind shipped runtime code to the reviewed repository sources.
// Any reviewed template update needs a new pin and negative acceptance tests.
import {requireThat} from './security.mjs';

const pins={
  'local-checklist':{script:'3639982c24b288c51c243c9fc6ed04e32d3ada37',
    css:'c25c6575c57f3f0ec932d4fc0a9d4ba20e598054'},
  'local-counter':{script:'eb3e0570b9b7d920c201511194eddcbc3d533887'}
};

const COUNTER_CSS=":root{color-scheme:dark;font-family:system-ui;background:#102028;color:#eff7f7}main{max-width:32rem;margin:10vh auto;padding:1.5rem}output{display:block;font-size:5rem;color:#79e0bb;font-variant-numeric:tabular-nums}div{display:flex;gap:.5rem;flex-wrap:wrap}button{font:inherit;padding:.75rem 1rem;border-radius:.7rem;border:1px solid #79e0bb;background:#17383b;color:white}button:focus-visible{outline:3px solid white}";

const exactly=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=condition=>requireThat(condition,422,'invalid_artifact');
function keysAre(object,names){
  fail(object && typeof object==='object' && !Array.isArray(object) &&
    exactly(Object.keys(object).sort(),[...names].sort()));
}
function parse(text){
  try{return JSON.parse(text);}catch{fail(false);}
}
async function gitBlobSha(value){
  const encoder=new TextEncoder(),bytes=encoder.encode(value),header=encoder.encode('blob '+bytes.length+'\0');
  const joined=new Uint8Array(header.length+bytes.length);
  joined.set(header);joined.set(bytes,header.length);
  const digest=await crypto.subtle.digest('SHA-1',joined);
  return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
function expectedCategory(idea){
  if(/مشتريات|تسوق|shopping(?: list)?|قائمة البقالة/i.test(idea))return 'shopping';
  if(/مهام|مهامي|مهمات|to[ -]?do|tasks?|قائمة إنجاز|checklist|قائمة متابعة/i.test(idea))return 'tasks';
  return null;
}
function safeHtml(html,kind,title){
  fail(typeof html==='string' && html.length>600 && html.length<49152);
  const csp=kind==='local-checklist'
    ?"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'"
    :"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'";
  fail(html.includes('<html lang="ar" dir="rtl">') &&
    html.includes('<meta http-equiv="Content-Security-Policy" content="'+csp+'">') &&
    (html.match(/\bhttp-equiv\s*=/gi)||[]).length===1 &&
    (html.match(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi)||[]).length===1 &&
    (html.match(/<link\b[^>]*>/gi)||[]).length===1 &&
    html.includes('<link rel="stylesheet" href="./styles.css">') &&
    (html.match(/<\/script\s*>/gi)||[]).length===(kind==='local-checklist'?2:1) &&
    !/<(?:iframe|object|embed|base|style|svg|math)\b/i.test(html) &&
    !/\bon[a-z]+\s*=/i.test(html) && !/\bsrcdoc\s*=/i.test(html) &&
    !/(?:https?:|javascript:|file:|vbscript:|\/\/)/i.test(html));
  const scriptTags=html.match(/<script\b[^>]*>/gi)||[];
  const expected=kind==='local-checklist'
    ?['<script type="application/json" id="app-config">','<script src="./app.js" defer>']
    :['<script src="./app.js" defer>'];
  fail(exactly(scriptTags,expected));
  fail(html.includes('<title>'+title+'</title>'));
}
export async function validateArtifact(kind,input,files) {
  fail(Object.hasOwn(pins,kind) && input && typeof input==='object');
  keysAre(files,['index.html','app.js','styles.css','blueprint.json']);
  const blueprint=parse(files['blueprint.json']);
  const title=kind==='local-checklist'?(input.title??(expectedCategory(input.idea)==='shopping'?'قائمة مشترياتي':'منظم مهامي')).trim()
    :(input.title??'عدادي المحلي');
  fail(typeof title==='string' && title.length>=2 && title.length<=59);
  fail(blueprint.kind===kind && blueprint.title===title &&
    blueprint.schemaVersion===1 && blueprint.automatedRelease===false &&
    blueprint.externalCostsSar===0);
  if(kind==='local-checklist'){
    keysAre(blueprint,['kind','schemaVersion','category','title','features','storage',
      'authorization','deliverable','limitations','automatedRelease','externalCostsSar']);
    fail(expectedCategory(input.idea)!==null &&
      blueprint.category===expectedCategory(input.idea) &&
      exactly(blueprint.features,['add','edit','toggle','delete','filter','local-persistence']) &&
      blueprint.storage==='localStorage on the visitor device only' &&
      blueprint.authorization==='No accounts or shared/team access' &&
      blueprint.deliverable==='Standalone static web app' &&
      exactly(blueprint.limitations,['لا يوجد تسجيل دخول أو مزامنة أو مشاركة','البيانات محفوظة في المتصفح فقط']));
    const found=files['index.html'].match(/<script type="application\/json" id="app-config">([^<]*)<\/script>/);
    fail(Boolean(found));
    const config=parse(found[1]);
    keysAre(config,['id','title','category','schemaVersion']);
    fail(/^[0-9a-f-]{36}$/.test(config.id) && config.title===title &&
      config.category===blueprint.category && config.schemaVersion===1 &&
      files['index.html'].includes('<h1 id="app-title">'+title+'</h1>'));
  } else {
    keysAre(blueprint,['kind','schemaVersion','title','features','storage','minimum',
      'maximum','initial_count','automatedRelease','externalCostsSar']);
    fail(/عد[ّ]?اد|counter|tally/i.test(input.idea) &&
      exactly(blueprint.features,['increment','decrement','reset','local-persistence']) &&
      blueprint.storage==='browser-local' && blueprint.minimum===0 && blueprint.maximum===9999 &&
      blueprint.initial_count===(input.initial_count??0) &&
      files['index.html'].includes('<h1>'+title+'</h1>') &&
      new RegExp('data-key="[0-9a-f-]{36}" data-initial="'+blueprint.initial_count+'"').test(files['index.html']));
  }
  safeHtml(files['index.html'],kind,title);
  fail(await gitBlobSha(files['app.js'])===pins[kind].script);
  if(kind==='local-checklist'){
    fail(await gitBlobSha(files['styles.css'])===pins[kind].css);
  } else {
    fail(files['styles.css']===COUNTER_CSS);
  }
  return true;
}

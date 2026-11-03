import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,existsSync,readFileSync,readdirSync,mkdirSync,writeFileSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const dir=mkdtempSync(join(tmpdir(),'mzcode-acceptance-'));
const evidence='qa-evidence';mkdirSync(evidence,{recursive:true});
let chrome, ws;const pending=new Map();let seq=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function cdp(method,params={}){
 const id=++seq;
 return new Promise((resolve,reject)=>{
  const t=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},15000);
  pending.set(id,{resolve:v=>{clearTimeout(t);resolve(v)},reject:e=>{clearTimeout(t);reject(e)}});
  ws.send(JSON.stringify({id,method,params}));
 });
}
async function evalJS(expression){
 const a=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(a.exceptionDetails)throw Error(JSON.stringify(a.exceptionDetails).slice(0,600));
 return a.result?.value;
}
async function waitFor(js,timeout=25000){
 const until=Date.now()+timeout;
 do {try{const v=await evalJS(js);if(v)return v}catch{}await sleep(400)}while(Date.now()<until);
 throw Error('browser condition timed out: '+js.slice(0,100));
}
async function capture(file){
 const x=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 writeFileSync(join(evidence,file),Buffer.from(x.data,'base64'));
}
async function navigate(url){await cdp('Page.navigate',{url});await waitFor('document.readyState === "complete"');}
try{
 chrome=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
 const portfile=join(dir,'DevToolsActivePort');for(let i=0;i<100&&!existsSync(portfile);i++)await sleep(200);
 assert.ok(existsSync(portfile),'Chrome did not open DevTools');
 const port=Number(readFileSync(portfile,'utf8').split('\n')[0]);assert.ok(port>0);
 const target=await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'}).then(r=>r.json());
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true})});
 ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.id&&pending.has(v.id)){const p=pending.get(v.id);pending.delete(v.id);v.error?p.reject(Error(v.error.message)):p.resolve(v.result)}});
 await cdp('Page.enable');await cdp('Runtime.enable');
 try{await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:join(process.cwd(),evidence),eventsEnabled:true})}
 catch{await cdp('Page.setDownloadBehavior',{behavior:'allow',downloadPath:join(process.cwd(),evidence)})}
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await navigate('https://mzcodehub.com/tools/quote/');
 await waitFor('!!document.querySelector("#lines .line input[name=description]")');
 const before=await evalJS('({dir:document.documentElement.dir,width:innerWidth,scroll:document.documentElement.scrollWidth,title:document.title})');
 assert.equal(before.dir,'rtl');assert.ok(before.scroll<=before.width+3,'Quote page horizontal overflow: '+JSON.stringify(before));
 const filled=await evalJS(`(()=>{
 const values={company:'شركة اختبار MZcode',client:'العميل التجريبي',reference:'QA-20261103',date:'2026-11-03',validUntil:'2026-11-17',discount:'10',rate:'15',notes:'عرض سعر تجريبي باللغة العربية دون بيانات عملاء'};
 for(const [id,value] of Object.entries(values)){const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}
 const line=document.querySelector('#lines .line');
 for(const [k,v] of Object.entries({description:'تصميم وتطوير واجهة عربية للعميل',qty:'2',price:'150'})){const input=line.querySelector('[name="'+k+'"]');input.value=v;input.dispatchEvent(new Event('input',{bubbles:true}));}
 return {text:document.getElementById('paper').innerText,dir:document.documentElement.dir,width:innerWidth,scroll:document.documentElement.scrollWidth};})()`);
 assert.ok(filled.text.includes('العميل التجريبي'));assert.ok(filled.text.includes('تصميم وتطوير'));assert.ok(filled.scroll<=filled.width+3,'Quote horizontal overflow after inputs');
 await capture('quote-mobile.png');
 await evalJS("document.querySelector('#quote-form').requestSubmit(); 'submitted'");
 const pdfPath=join(evidence,'MZ-Quote.pdf');
 for(let i=0;i<100&&(!existsSync(pdfPath)||statSync(pdfPath).size<1500);i++)await sleep(250);
 assert.ok(existsSync(pdfPath),'PDF did not download in browser');
 const pdf=readFileSync(pdfPath);
 assert.ok(pdf.length>5000,'Generated PDF unexpectedly small');
 assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
 assert.ok(pdf.subarray(-200).toString().includes('%%EOF'),'Incomplete PDF trailer');
 const status=await waitFor("document.getElementById('status')?.textContent.includes('تم تجهيز PDF')");
 const pageCount=(pdf.toString('latin1').match(/\/Type \/Page \/Parent/g)||[]).length;
 assert.ok(pageCount>=1,'No PDF pages');
 console.log('PASS Arabic quote PDF actual browser download',JSON.stringify({bytes:pdf.length,pages:pageCount,mobile:before,status:!!status}));
 await navigate('https://mzcodehub.com/idea');
 await waitFor('!!document.querySelector("#live-preview")');
 const idea=await evalJS('({dir:document.documentElement.dir,width:innerWidth,scroll:document.documentElement.scrollWidth,cta:!!document.querySelector("#preview-request"),title:document.title})');
 assert.equal(idea.dir,'rtl');assert.ok(idea.scroll<=idea.width+3,'Idea horizontal overflow: '+JSON.stringify(idea));assert.equal(idea.cta,true);
 await capture('idea-mobile.png');
 console.log('PASS mobile RTL quote and idea layout',JSON.stringify({idea}));
 console.log('PDF_QA_RESULT',JSON.stringify({passed:true,download:'qa-evidence/MZ-Quote.pdf',evidence:['quote-mobile.png','idea-mobile.png']}));
}catch(e){console.error('PDF_QA_RESULT',JSON.stringify({passed:false,error:e.message}));process.exitCode=1}
finally{try{ws?.close()}catch{}try{chrome?.kill()}catch{}try{rmSync(dir,{recursive:true,force:true})}catch{}}

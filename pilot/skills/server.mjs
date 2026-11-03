import {randomUUID, timingSafeEqual} from 'node:crypto';
import {buildWebApp} from '../builder/engine.mjs';

const INITIAL = [
 {id:'checklist',name_ar:'إنشاء قائمة مهام',version:1,handler:'checklist',input_schema:{idea:'string',title:'string?'},output_schema:{directory:'string',appId:'string'},permissions:['owner'],limits:{maxIdeaChars:2000,maxRunsPerMinute:10},test_status:'verified_unit',enabled:true,rollback_version:null},
 {id:'shopping',name_ar:'إنشاء قائمة مشتريات',version:1,handler:'shopping',input_schema:{idea:'string',title:'string?'},output_schema:{directory:'string',appId:'string'},permissions:['owner'],limits:{maxIdeaChars:2000,maxRunsPerMinute:10},test_status:'verified_unit',enabled:true,rollback_version:null}
];
const allowedHandlers=new Set(['checklist','shopping']);
const clone=x=>structuredClone(x);
function error(code,status=400){const e=new Error(code);e.code=code;e.status=status;return e;}
function validateDefinition(d){
 if(!d||typeof d!=='object'||!(/^[a-z][a-z0-9-]{2,40}$/).test(d.id||''))throw error('invalid_id');
 if(typeof d.name_ar!=='string'||d.name_ar.length<3||d.name_ar.length>80)throw error('invalid_name');
 if(!allowedHandlers.has(d.handler))throw error('handler_not_approved');
 if(!Number.isSafeInteger(d.version)||d.version<1)throw error('invalid_version');
 if(!d.input_schema||!d.output_schema||!d.limits||!Array.isArray(d.permissions)||d.permissions.some(p=>p!=='owner'))throw error('invalid_contract');
 if(d.test_status!=='verified_unit')throw error('tests_required');
 if(typeof d.enabled!=='boolean')throw error('invalid_enabled');
 return clone(d);
}
export function createSkillsService({ownerToken,outputRoot,now=()=>Date.now()}={}){
 if(typeof ownerToken!=='string'||ownerToken.length<32)throw error('owner_token_required',500);
 const records=new Map(INITIAL.map(d=>[d.id,[clone(d)]]));
 const audit=[];const runs=new Map();const buckets=new Map();
 const auth=token=>{
   if(typeof token!=='string')throw error('unauthorized',401);
   const a=Buffer.from(token),b=Buffer.from(ownerToken);
   if(a.length!==b.length||!timingSafeEqual(a,b))throw error('unauthorized',401);
 };
 const log=(event,detail={})=>audit.push({id:randomUUID(),at:new Date(now()).toISOString(),event,...detail});
 const current=id=>{const versions=records.get(id);if(!versions)throw error('not_found',404);return versions.at(-1);};
 const throttle=()=>{
   const minute=Math.floor(now()/60000);const n=(buckets.get(minute)||0)+1;buckets.set(minute,n);
   for(const key of buckets.keys())if(key<minute-1)buckets.delete(key);
   if(n>10)throw error('rate_limited',429);
 };
 return {
   list(token){auth(token);return [...records.keys()].map(id=>clone(current(id)));},
   versions(token,id){auth(token);return clone(records.get(id)||[]);},
   audit(token){auth(token);return clone(audit);},
   getRun(token,id){auth(token);const r=runs.get(id);if(!r)throw error('not_found',404);return clone(r);},
   register(token,definition){
     auth(token);const d=validateDefinition(definition);const old=records.get(d.id)||[];
     if(d.version!==(old.length?old.at(-1).version+1:1))throw error('version_conflict',409);
     if(d.enabled)throw error('review_before_enable',409);
     records.set(d.id,[...old,d]);log('skill_registered',{skillId:d.id,version:d.version});return clone(d);
   },
   setEnabled(token,id,enabled){
     auth(token);if(typeof enabled!=='boolean')throw error('invalid_enabled');
     const d=current(id);if(enabled&&d.test_status!=='verified_unit')throw error('tests_required',409);
     const next={...d,version:d.version+1,enabled,rollback_version:d.version};
     records.get(id).push(next);log('skill_status_changed',{skillId:id,version:next.version,enabled});return clone(next);
   },
   rollback(token,id,version){
     auth(token);const old=records.get(id)||[];const target=old.find(x=>x.version===version);
     if(!target)throw error('version_not_found',404);
     const next={...clone(target),version:current(id).version+1,rollback_version:version,enabled:false};
     old.push(next);log('skill_rolled_back',{skillId:id,toVersion:version,newVersion:next.version});return clone(next);
   },
   async run(token,id,input,{idempotencyKey}={}){
     auth(token);throttle();
     const d=current(id);if(!d.enabled)throw error('skill_disabled',409);
     if(!input||typeof input.idea!=='string'||input.idea.length>2000||input.idea.length<20)throw error('invalid_input');
     if(input.title!==undefined&&typeof input.title!=='string')throw error('invalid_title');
     if(typeof idempotencyKey!=='string'||!(/^[a-zA-Z0-9_-]{8,80}$/).test(idempotencyKey))throw error('idempotency_required');
     const key=id+':'+idempotencyKey;
     if(runs.has(key))return clone(runs.get(key));
     // Only vetted template generators. No visitor code, no shell execution.
     const hint=d.handler==='shopping'?'قائمة مشتريات':'قائمة مهام';
     if(!new RegExp(d.handler==='shopping'?'مشتريات|shopping':'مهام|tasks?|to.do','i').test(input.idea))throw error('skill_input_mismatch');
     const result=await buildWebApp(input,{outputRoot});
     const response={id:key,skillId:id,skillVersion:d.version,status:'built_unpublished',directory:result.directory,appId:result.appId,files:result.files};
     runs.set(key,response);log('skill_run',{skillId:id,version:d.version,runId:key,status:'built_unpublished'});
     return clone(response);
   }
 };
}
export function createSkillsHttpHandler(service){
 return async request=>{
   const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
   try{
     const token=(request.headers.get('authorization')||'').replace(/^Bearer /i,'');
     const url=new URL(request.url);const parts=url.pathname.split('/').filter(Boolean);
     if(parts[0]!=='internal'||parts[1]!=='skills')throw error('not_found',404);
     const body=['POST','PATCH'].includes(request.method)?await request.json():undefined;
     let result;
     if(request.method==='GET'&&parts.length===2)result=service.list(token);
     else if(request.method==='GET'&&parts[3]==='versions')result=service.versions(token,parts[2]);
     else if(request.method==='GET'&&parts[2]==='audit')result=service.audit(token);
     else if(request.method==='GET'&&parts[2]==='runs'&&parts[3])result=service.getRun(token,decodeURIComponent(parts.slice(3).join('/')));
     else if(request.method==='POST'&&parts.length===2)result=service.register(token,body);
     else if(request.method==='PATCH'&&parts[3]==='enabled')result=service.setEnabled(token,parts[2],body?.enabled);
     else if(request.method==='POST'&&parts[3]==='rollback')result=service.rollback(token,parts[2],body?.version);
     else if(request.method==='POST'&&parts[3]==='run')result=await service.run(token,parts[2],body,{idempotencyKey:request.headers.get('idempotency-key')});
     else throw error('not_found',404);
     return new Response(JSON.stringify({ok:true,result}),{status:200,headers});
   }catch(e){return new Response(JSON.stringify({ok:false,error:e.code||'internal_error'}),{status:e.status||500,headers});}
 };
}

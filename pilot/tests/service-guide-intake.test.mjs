import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const guide=readFileSync(new URL("../../site/services/index.html",import.meta.url),"utf8");
const script=readFileSync(new URL("../lab/lab.js",import.meta.url),"utf8");

test("service guide carries four allowlisted category links",()=>{
  for(const id of ["social","admin","teachers","stores"]){
    assert.ok(guide.includes('id="'+id+'"'));
    assert.ok(guide.includes('/idea?service='+id+'#request'),id);
  }
  assert.ok(guide.includes('/idea?service=custom#request'));
  assert.ok(guide.includes('«وردية» منتج مستقل'));
});
function launch(service,search){
 const fields=new Map(),requests=[];
 function field(id){
  if(!fields.has(id))fields.set(id,{
   value:"",placeholder:"",textContent:"",checked:false,disabled:false,hidden:false,
   focus(){},scrollIntoView(){},replaceChildren(){},reset(){},
   addEventListener(evt,handler){this["on"+evt]=handler;}
  });
  return fields.get(id);
 }
 const ctx={
  document:{getElementById:field},
  window:{MZBuilderEngine:{},location:{search:search??("?service="+encodeURIComponent(service))}},
  URLSearchParams,AbortSignal,
  crypto:{randomUUID:()=>"12345678-1234-4234-8234-123456789abc"},
  fetch:async (url,options)=>{
   requests.push({url,options,body:JSON.parse(options.body)});
   return {ok:true,status:201,json:async()=>({ok:true,id:"12345678-1234-4234-8234-123456789abc",reference:"MZ-12345678789A",created_ms:1795770000000,receipt_email_status:"not_requested"})};
  },
  navigator:{clipboard:{writeText:async()=>{}}},
  setTimeout:()=>{}
 };
 vm.runInNewContext(script,ctx,{timeout:3000});
 return {field,requests};
}
for(const [id,label] of Object.entries({social:"التواصل الاجتماعي",admin:"الإدارة",teachers:"المعلمون",stores:"المتاجر",custom:"خدمة أخرى"})){
 test("request "+id+" includes category and preserves tracking ID",async()=>{
  const {field,requests}=launch(id);
  field("brief").value="أحتاج خدمة تجريبية قابلة للتسليم بعد مراجعة نطاقها";
  field("email").value="qa@example.test";
  field("consent").checked=true;
  await field("intake").onsubmit({preventDefault(){},target:field("intake")});
  assert.equal(requests.length,1);
  assert.equal(requests[0].url,"/api/ideas");
  assert.ok(requests[0].body.idea.startsWith("[نوع الخدمة: "+label+"]\n"),requests[0].body.idea);
  assert.equal(field("receipt-code").textContent,"MZ-12345678789A");
  assert.equal(field("tracking-id").value,"MZ-12345678789A");
  assert.equal(requests[0].options.headers["Idempotency-Key"],"12345678-1234-4234-8234-123456789abc");
 });
}
test("unknown query category is ignored",async()=>{
 const {field,requests}=launch("<unknown>&evil");
 field("brief").value="أريد طلب عمل تجريبي مع تفاصيل كافية";
 field("consent").checked=true;
 await field("intake").onsubmit({preventDefault(){},target:field("intake")});
 assert.equal(requests.length,1);
 assert.equal(requests[0].body.idea.includes("<unknown>"),false);
});
test("short human-written description is rejected",async()=>{
 const {field,requests}=launch("social");
 field("brief").value="قصير";
 await field("intake").onsubmit({preventDefault(){},target:field("intake")});
 assert.equal(requests.length,0);
});

test("pilot offer query prefills the editable brief and saves offer type",async()=>{
 const {field,requests}=launch("", "?offer=menu-social-199");
 assert.ok(field("brief").value.includes("١٩٩ ريالًا"));
 field("brief").value+="كافتيريا اختبارية، أربعة أصناف، عرض الخميس";
 field("email").value="qa@example.test";
 field("consent").checked=true;
 await field("intake").onsubmit({preventDefault(){},target:field("intake")});
 assert.equal(requests.length,1);
 assert.ok(requests[0].body.idea.startsWith("[نوع الخدمة: باقة منيو و٣ منشورات — ١٩٩ ريالًا]\n"));
 assert.ok(requests[0].body.idea.includes("كافتيريا اختبارية"));
});
test("pilot template cannot be sent without customer details",async()=>{
 const {field,requests}=launch("", "?offer=menu-social-199");
 field("consent").checked=true;
 await field("intake").onsubmit({preventDefault(){},target:field("intake")});
 assert.equal(requests.length,0);
 assert.match(field("receipt").textContent,/أضف اسم المنشأة/);
});

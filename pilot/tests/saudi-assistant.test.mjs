import test from 'node:test';
import assert from 'node:assert/strict';
import { interpret, teacherDraft, propertyDraft } from '../saudi-assistant/core.mjs';

test('Saudi greeting identifies limited assistant', ()=> {
  assert.equal(interpret('السلام عليكم').intent, 'greeting');
  assert.equal(interpret('هلا').assistant_mode, 'guided_v1');
});
test('teacher message maps to actual draft workflow', ()=> {
  const output=interpret('أنا معلم وأحتاج رسالة لقروب أولياء الأمور عن الواجب');
  assert.equal(output.action, 'teacher_draft');
  assert.equal(output.sends_to_server,false);
});
test('school context without message still provides teacher draft', ()=> {
  assert.equal(interpret('أريد مساعدة لتجهيز دروس المدرسة').intent,'education');
});
test('real estate produces draft tool, not license verification', ()=> {
  assert.equal(interpret('أحتاج إعلان عقاري لشقة في المدينة').action,'property_draft');
  const x=propertyDraft({type:'شقة',city:'المدينة المنورة',district:'العريض',area:'120',price:'500000',license:''});
  assert.equal(x.verified,false); assert.equal(x.publish_ready,false);
  assert.deepEqual(x.missing,['رقم ترخيص الإعلان']);
});
test('with license still remains unverified',()=> {
  const x=propertyDraft({type:'فيلا',city:'المدينة',district:'العزيزية',area:'240',price:'1000000',license:'123456'});
  assert.equal(x.verified,false);assert.equal(x.missing.length,0);
});
test('checklist is an actionable local skill',()=> {
  assert.equal(interpret('أبغى قائمة مشتريات للبيت').skill,'local-checklist');
  assert.equal(interpret('أبغى أنظم مهامي اليوم').action,'checklist');
});
test('file conversion is not falsely claimed',()=> {
  const result=interpret('حول ملف وورد إلى اكسل');
  assert.equal(result.intent,'file_conversion');assert.equal(result.action,null);
});
test('medical and security requests are not executed',()=> {
  assert.equal(interpret('أبغى علاج لمريض عنده أعراض خطيرة').intent,'health_review');
  assert.equal(interpret('صمم تطبيق لاختراق حسابات الآخرين').intent,'safety_review');
});
test('arbitrary app creation is not falsely claimed',()=>{
  const r=interpret('أبي منك تبني تطبيق أندرويد للعميل');
  assert.equal(r.intent,'app_request');assert.equal(r.action,null);
});
test('message length and draft fields validated',()=>{
  assert.throws(()=>interpret(''),/invalid_message/);
  assert.throws(()=>interpret('x'.repeat(1201)),/invalid_message/);
  assert.throws(()=>teacherDraft({topic:'',level:'رابع'}),/invalid_field/);
  assert.throws(()=>propertyDraft({type:'شقة',city:'جدة',district:'الصفا',area:'100',price:'500',license:'a'.repeat(81)}),/invalid_field/);
});
test('template includes supplied content but no fabricated personal names',()=>{
  const s=teacherDraft({topic:'تسليم الواجب يوم الخميس',level:'الرابع الابتدائي'});
  assert.match(s,/تسليم الواجب يوم الخميس/);assert.match(s,/الرابع الابتدائي/);
  assert.doesNotMatch(s,/اسم المعلم/);
});

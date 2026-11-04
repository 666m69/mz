import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareTeacherMessage, teacherFilename } from '../../site/assets/js/teacher-core.mjs';
import { calculateReservoir, safeObservation, observationsCsv } from '../../site/assets/js/hydro-core.mjs';
import { SOURCES, filterSources, toggleSaved } from '../../site/assets/js/opportunities-core.mjs';
import worker from '../../build/worker.mjs';

test('teacher produces real parent communication with no automatic sending',()=>{
  const result=prepareTeacherMessage({kind:'notice',audience:'parents',grade:'الرابع الابتدائي',subject:'واجب القراءة',details:'الرجاء متابعة القراءة اليومية',date:'الخميس'});
  assert.match(result,/أولياء الأمور/);
  assert.match(result,/الخميس/);
  assert.match(result,/مسودة للمراجعة/);
  assert.equal(teacherFilename('notice'),'mzcode-teacher-message.txt');
});
test('teacher weekly plan contains distinct actionable days',()=>{
  const result=prepareTeacherMessage({kind:'plan',audience:'school',grade:'خامس',subject:'تدريب على الجمع',details:'مراجعة الجمع والطرح'});
  for(const day of ['الأول','الثاني','الثالث','الرابع','الخامس'])assert.ok(result.includes('اليوم '+day));
  assert.match(result,/لا تتضمن بيانات طلاب/);
  assert.throws(()=>prepareTeacherMessage({kind:'notice',audience:'other',grade:'خامس',subject:'اختبار',details:'أهلًا'}),/invalid_option/);
  assert.throws(()=>prepareTeacherMessage({kind:'notice',audience:'parents',grade:'',subject:'اختبار',details:'شرح'}),/invalid_field/);
});
test('hydroponics calculation is deterministic and explicitly an estimate',()=>{
  const x=calculateReservoir({plants:'6',liters:'18',mlPerPlant:'200'});
  assert.equal(x.dailyLiters,1.2);
  assert.equal(x.estimatedDays,15);
  assert.match(x.caution,/افتراضي/);
  for(const p of [0,-1,1.5,501,'not a number'])assert.throws(()=>calculateReservoir({plants:p,liters:18,mlPerPlant:200}),/invalid_input/);
});
test('hydroponics observations reject dates and extreme readings',()=>{
  const note=safeObservation({date:'2026-11-04',waterLiters:'1',ph:'6.3',ec:'1.2',note:'لون الأوراق جيد'},{id:'safe'});
  assert.equal(note.ph,6.3);assert.equal(note.waterLiters,1);
  assert.throws(()=>safeObservation({...note,date:'2026-02-30'}),/invalid_date/);
  assert.throws(()=>safeObservation({...note,ph:'15'}),/invalid_value/);
});
test('hydroponics CSV defuses formula injection',()=>{
  const record=safeObservation({date:'2026-11-04',waterLiters:'1',ph:'',ec:'',note:'=WEBSERVICE(1)'},{id:'safe'});
  const csv=observationsCsv([record]);
  assert.ok(csv.startsWith('\ufeff'));
  assert.match(csv,/'=WEBSERVICE/);
  assert.match(csv,/التاريخ/);
});
test('opportunities source registry uses verified destinations without pretending live data',()=>{
  assert.ok(SOURCES.length>=6);
  for(const item of SOURCES){
    const parsed=new URL(item.url);
    assert.equal(parsed.protocol,'https:');
    assert.equal(parsed.username,'');
    assert.equal(parsed.password,'');
    assert.ok(item.hint.length>20);
  }
  assert.equal(filterSources('games').length,1);
  assert.ok(filterSources('all','أغنام').some(x=>x.id==='sheep'));
  assert.ok(filterSources('news').some(x=>x.id==='yemen'));
  assert.throws(()=>filterSources('unknown'),/invalid_category/);
  assert.deepEqual(toggleSaved([], 'ipo'),['ipo']);
  assert.deepEqual(toggleSaved(['ipo'],'ipo'),[]);
  assert.throws(()=>toggleSaved([], 'fake'),/unknown_source/);
});
test('all three tools are built as fully routed standalone browser pages',async()=>{
  for(const [slug,jsFile] of [['teacher','teacher-app.mjs'],['hydroponics','hydro-app.mjs'],['opportunities','opportunities-app.mjs']]){
    const page=await worker.fetch(new Request('https://mz702.pages.dev/tools/'+slug+'/'),{});
    assert.equal(page.status,200,slug);
    const html=await page.text();
    assert.match(html,/dir="rtl"/);
    assert.match(html,/\/assets\/images\/mz-mark\.svg/);
    assert.ok(html.includes('/assets/js/'+jsFile),slug);
    const js=await worker.fetch(new Request('https://mz702.pages.dev/assets/js/'+jsFile),{});
    assert.equal(js.status,200);
    assert.match(js.headers.get('Content-Type'),/javascript/);
  }
  for(const route of ['/','/tools/']){
    const response=await worker.fetch(new Request('https://mz702.pages.dev'+route),{});
    const html=await response.text();
    for(const slug of ['teacher','hydroponics','opportunities'])assert.ok(html.includes('/tools/'+slug+'/'),slug+' on '+route);
  }
});
test('core source is separate from HTML and user input is rendered as text',()=>{
  for(const file of ['teacher-app.mjs','hydro-app.mjs','opportunities-app.mjs']){
    const js=fs.readFileSync(new URL('../../site/assets/js/'+file,import.meta.url),'utf8');
    assert.doesNotMatch(js,/innerHTML\s*=|eval\s*\(|new Function\s*\(/);
    assert.match(js,/textContent/);
  }
});

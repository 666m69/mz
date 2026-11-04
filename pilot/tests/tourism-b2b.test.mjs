import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MARKETS,STAGES,validDay,daysUntil,publicHolidaysFromApi,makeAgency,makeEvent,
  upcoming,draftMessage,agenciesCsv } from '../tourism-b2b/core.mjs';

const qaAgency={name:'وكالة تجريبية للسياحة',country:'TR',stage:'new',followup:'2026-11-25',notes:'تواصل تمهيدي'};
const qaEvent={country:'TR',date:'2026-12-10',title:'مناسبة تجريبية غير حقيقية'};
test('markets are documented and no audience identity is assumed',()=>{
  assert.ok(MARKETS.some(x=>x.code==='TR'));
  assert.ok(MARKETS.some(x=>x.code==='SA'));
  assert.ok(MARKETS.some(x=>x.code==='DE'));
  assert.ok(Object.keys(STAGES).includes('proposal'));
});
test('ISO dates are checked without locale offset bugs',()=>{
  assert.equal(validDay('2026-11-04'),true);
  assert.equal(validDay('2026-02-29'),false);
  assert.equal(validDay('2028-02-29'),true);
  assert.equal(daysUntil('2026-12-10','2026-11-04'),36);
});
test('holiday ingestion validates source fields/country/year',()=>{
  const fromProvider=[
    {date:'2026-12-10',countryCode:'TR',name:'Example API holiday',holidayTypes:['Public']},
    {date:'2026-12-11',countryCode:'DE',name:'Wrong market'},
    {date:'2026-99-99',countryCode:'TR',name:'Invalid date'},
    {date:'2025-01-01',countryCode:'TR',name:'Wrong year'}
  ];
  const received=publicHolidaysFromApi(fromProvider,'TR',2026);
  assert.equal(received.length,1);
  assert.equal(received[0].verified,false);
  assert.equal(received[0].kind,'public_holiday');
  assert.equal(received[0].country,'TR');
  assert.throws(()=>publicHolidaysFromApi([], 'XY', 2026),/invalid_holidays/);
});
test('agency input validates market, stage and date',()=>{
  const row=makeAgency(qaAgency,{id:'test-agency',now:'2026-11-04'});
  assert.equal(row.name,'وكالة تجريبية للسياحة');
  assert.equal(row.evidence,'يدوي — ليس إثبات حجز أو عمولة');
  assert.throws(()=>makeAgency({...qaAgency,country:'ZZ'}),/invalid_country/);
  assert.throws(()=>makeAgency({...qaAgency,stage:'confirmed_booking'}),/invalid_stage/);
  assert.throws(()=>makeAgency({...qaAgency,followup:'not a date'}),/invalid_followup/);
});
test('manual event never pretends to be verified',()=>{
  const item=makeEvent({...qaEvent,sourceUrl:'https://example.org/verified-event'},{id:'test-event'});
  assert.equal(item.verified,false);
  assert.equal(item.kind,'manual');
  assert.equal(item.source,'أدخله المستخدم (غير متحقق)');
  assert.throws(()=>makeEvent({...qaEvent,sourceUrl:'javascript:alert(1)'}),/invalid_source_url/);
  assert.throws(()=>makeEvent({...qaEvent,date:'2026-13-10'}),/invalid_event/);
});
test('future opportunities are sorted and exclude expired or distant events',()=>{
  const events=[
    makeEvent({...qaEvent,date:'2027-07-01'},{id:'distant'}),
    makeEvent({...qaEvent,date:'2026-12-10'},{id:'dec'}),
    makeEvent({...qaEvent,date:'2026-11-01'},{id:'expired'}),
    makeEvent({...qaEvent,date:'2026-11-18'},{id:'nov'}),
    makeEvent({...qaEvent,country:'SA',date:'2026-11-19'},{id:'other'})
  ];
  assert.deepEqual(upcoming(events,{today:'2026-11-04',days:120,country:'TR'}).map(x=>x.id),['nov','dec']);
});
test('drafts include only planning, never fake price or confirmed availability',()=>{
  const agency=makeAgency(qaAgency,{id:'agency'});
  const event=makeEvent(qaEvent,{id:'event'});
  for(const lang of ['ar','en']){
    const draft=draftMessage({agency,event,language:lang});
    assert.match(draft,/2026-12-10/);
    assert.match(draft,/وكالة تجريبية للسياحة/);
    assert.match(draft,lang==='ar'?/لم يتم تأكيدهما/:/not confirmed/);
  }
  assert.throws(()=>draftMessage({agency,event:{...event,country:'AE'}}),/country_mismatch/);
});
test('CSV export neutralizes spreadsheet formulas and remains UTF-8',()=>{
  const agency=makeAgency({...qaAgency,name:'=CMD(1)',notes:' +INJECT'},{id:'bad'});
  const csv=agenciesCsv([agency]);
  assert.ok(csv.startsWith('\ufeff'));
  assert.match(csv,/'=CMD\(1\)/);
  assert.match(csv,/' \+INJECT/);
  assert.match(csv,/وكالة|تركيا/);
});
test('standalone interface has safe no-auto-outreach and clear data boundaries',async()=>{
  const html=await readFile(new URL('../tourism-b2b/index.html',import.meta.url),'utf8');
  const source=await readFile(new URL('../tourism-b2b/app.mjs',import.meta.url),'utf8');
  assert.match(html,/dir="rtl"/);
  assert.match(html,/connect-src https:\/\/nagerholidays.com/);
  assert.match(html,/لا رسائل تُرسل تلقائيًا/);
  assert.match(source,/localStorage/);
  assert.match(source,/textContent/);
  assert.match(source,/nagerholidays.com\/api\/v4\/Holidays/);
  assert.doesNotMatch(source,/innerHTML\s*=|new Function\(|eval\(/);
});

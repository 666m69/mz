import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../../build/worker.mjs';
import {ARABIC_FONT} from '../../site/assets/js/arabic-canvas.js';
test('Arabic canvas exports use a local compatible font and no remote font service',async()=>{
 assert.match(ARABIC_FONT,/system-ui/);
 assert.match(ARABIC_FONT,/Noto Sans Arabic/);
 const source=await readFile(new URL('../../site/assets/css/tools.css',import.meta.url),'utf8');
 assert.match(source,/font-family:"Tahoma"/);
 assert.match(source,/local\("Noto Naskh Arabic"\)/);
 assert.doesNotMatch(source,/fonts\.googleapis|fonts\.gstatic/);
 const ready=await readFile(new URL('../../site/assets/js/arabic-canvas.js',import.meta.url),'utf8');
 assert.match(ready,/document\.fonts\.load/);
 assert.match(ready,/document\.fonts\.ready/);
});
test('quote and property export handlers await font readiness',async()=>{
 const quote=await readFile(new URL('../../site/assets/js/quote.js',import.meta.url),'utf8');
 const property=await readFile(new URL('../../site/assets/js/property.js',import.meta.url),'utf8');
 assert.match(quote,/await readyForArabicExport\(\);download\(await quotePDF/);
 assert.match(property,/await readyForArabicExport\(\);render\(\)/);
 for(const route of ['/tools/quote/','/tools/property/','/tools/menu/']){
  const res=await worker.fetch(new Request('https://mz702.pages.dev'+route),{});
  assert.equal(res.status,200,route);
  const html=await res.text();
  assert.match(html,/<html lang="ar" dir="rtl">/);
 }
 const css=await worker.fetch(new Request('https://mz702.pages.dev/assets/css/tools.css'),{});
 assert.equal(css.status,200);
 const body=await css.text();
 assert.match(body,/font-family:"Tahoma"/);
 const file=await worker.fetch(new Request('https://mz702.pages.dev/assets/js/arabic-canvas.js'),{});
 assert.equal(file.status,200);
 assert.match(file.headers.get('Content-Type'),/javascript/);
});

test('quote PDF and property Canvas use the same Arabic-aware stack, not a Latin-only font',async()=>{
 const pdf=await readFile(new URL('../../site/assets/js/pdf-export.js',import.meta.url),'utf8');
 const art=await readFile(new URL('../../site/assets/js/art-core.js',import.meta.url),'utf8');
 const ready=await readFile(new URL('../../site/assets/js/arabic-canvas.js',import.meta.url),'utf8');
 assert.match(pdf,/import \{ARABIC_FONT,setArabicCanvasText\} from '\.\/arabic-canvas\.js'/);
 assert.match(pdf,/setArabicCanvasText\(ctx,size\)/);
 assert.match(art,/import \{setArabicCanvasText\} from '\.\/arabic-canvas\.js'/);
 assert.match(art,/setArabicCanvasText\(ctx,size\)/);
 assert.match(ready,/document\.fonts\.load\('24px '\+ARABIC_FONT/);
 assert.doesNotMatch(pdf,/ctx\.font=\x60\$\{size\}px Tahoma/);
 assert.doesNotMatch(art,/ctx\.font=\x60\$\{size\}px Tahoma/);
});

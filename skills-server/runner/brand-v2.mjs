/**
 * Trusted brand decorator used ONLY by new versioned adapters.
 * Pins the approved SVG as a reviewed source; never edits v1 templates or their digests.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const mark=new URL('../../site/assets/images/mz-mark.svg',import.meta.url);
export async function brandStandaloneApp(directory){
  const svg=await readFile(mark,'utf8');
  if(!svg.includes('<svg')||!svg.includes('viewBox="0 0 256 256"')||!svg.includes('aria-label="MZcode"'))
    throw new Error('approved_mark_unavailable');
  const index=join(directory,'index.html'),stylesheet=join(directory,'styles.css');
  const [html,css]=await Promise.all([readFile(index,'utf8'),readFile(stylesheet,'utf8')]);
  if(!html.includes('</body>')||html.includes('data-mz-builder-brand='))throw new Error('invalid_brand_target');
  const banner='<aside class="mz-builder-brand" data-mz-builder-brand="2" aria-label="صنع بواسطة MZcode">'
    +'<span class="mz-builder-emblem">'+svg+'</span><span>صُنع بواسطة MZcode</span></aside>';
  const addition='\n.mz-builder-brand{max-width:820px;margin:10px auto 20px;padding:10px 16px;display:flex;align-items:center;justify-content:center;gap:12px;box-sizing:border-box;color:#d6f1e4;font:700 13px/1.5 system-ui,Tahoma,sans-serif}'
    +'.mz-builder-emblem{display:inline-flex;width:34px;height:34px;flex-shrink:0}.mz-builder-emblem svg{width:100%;height:100%;display:block}'
    +'@media(max-width:420px){.mz-builder-brand{padding:8px 12px}}\n';
  await Promise.all([
    writeFile(index,html.replace('</body>',banner+'</body>'),'utf8'),
    writeFile(stylesheet,css+addition,'utf8')
  ]);
  return directory;
}

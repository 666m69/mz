/* Offline prototype export. The generated document contains no external URLs.
   User strings are data only. The executable script is fixed and hash-pinned. */
(function(root){
  "use strict";
  function start(){
    const model=JSON.parse(document.getElementById("spec").textContent);
    const get=id=>document.getElementById(id);
    const node=(tag,txt)=>{const el=document.createElement(tag);el.textContent=txt;return el;};
    document.title=model.title+" | نموذج MZcode";
    get("title").textContent=model.title;get("idea").textContent=model.idea;
    let seq=0;
    const remaining=model.features.map(()=>1);
    const cards=model.features.map((feature,i)=>{
      const card=node("section",""),label="case-"+i,field=node("input","");
      const legend=node("label","اسم الحالة التجريبية");legend.htmlFor=label;
      field.id=label;field.maxLength=70;field.placeholder="مثلًا: تجربة ١";field.value="تجربة "+(i+1);
      const stock=node("p",""),status=node("p","");status.setAttribute("role","status");
      const draw=()=>{stock.textContent=feature.resource+" · "+remaining[i];};
      const submit=node("button",get("cards").dataset?.runLabel || "نفّذ الخطوة");
      const restore=node("button",get("cards").dataset?.restoreLabel || "أعد توفير الشرط");restore.className="secondary";
      submit.onclick=()=>{
        const name=field.value.trim();if(!name){status.textContent="أدخل اسمًا للحالة.";field.focus();return;}
        const accepted=remaining[i]>0;if(accepted)remaining[i]--;
        const detail=accepted?feature.action:feature.failure;
        status.textContent=(accepted?"تم التنفيذ · ":"توقف التنفيذ · ")+detail;
        const result=node("li",(++seq)+" · "+name+" · "+feature.label+" · "+status.textContent);
        get("events").prepend(result);draw();
      };
      restore.onclick=()=>{remaining[i]=1;status.textContent="الشرط متاح لحالة جديدة.";draw();};
      draw();card.append(node("h2",feature.label),stock,legend,field,submit,restore,status);return card;
    });
    get("cards").replaceChildren(...cards);
  }
  const css=":root{color-scheme:dark}*{box-sizing:border-box}body{max-width:790px;margin:0 auto;padding:22px;background:#0a1722;color:#edf4f6;font:16px/1.7 system-ui}h1,h2{line-height:1.4;overflow-wrap:anywhere}section{background:#142533;border:1px solid #385562;border-radius:14px;margin:16px 0;padding:18px}p,li{overflow-wrap:anywhere}label{display:block}button,input{border-radius:8px;padding:10px;font:inherit}input{width:100%;color:inherit;background:#0a1722;border:1px solid #547180;margin:6px 0}button{background:#8be9cf;color:#071f1b;border:1px solid #8be9cf;margin:4px;cursor:pointer}.secondary{background:transparent;color:#8be9cf}button:focus-visible,input:focus-visible{outline:3px solid #9bcaff}small{color:#b6cbd2}";
  async function documentFor(spec,scenario){
    const data={title:spec.title,idea:spec.idea,features:spec.features.map(label=>{const [resource,action,failure]=scenario(label);return {label,resource,action,failure};})};
    const json=JSON.stringify(data).replace(/[<>&\u2028\u2029]/g,ch=>"\\u"+ch.charCodeAt(0).toString(16).padStart(4,"0"));
    const script="("+start.toString()+")();";
    const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(script));
    const digest=btoa(String.fromCharCode(...new Uint8Array(hash)));
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${digest}'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><title>نموذج MZcode</title><style>${css}</style></head><body><small>MZcode / نموذج تفاعلي محلي</small><h1 id="title"></h1><p id="idea"></p><p>جرّب الوظائف بحالات افتراضية. تستهلك كل عملية ناجحة فرصة واحدة. أعد المحاولة لتختبر التعطّل ثم أعد توفير الشرط. ينتهي سجل التجربة عند إغلاق الملف.</p><main id="cards"></main><section><h2>سجل التجربة</h2><ol id="events"></ol></section><noscript>يتطلب النموذج تفعيل JavaScript في المتصفح.</noscript><script type="application/json" id="spec">${json}</script><script>${script}</script></body></html>`;
  }
  root.MZPrototype=Object.freeze({documentFor});
  if(typeof document!=="undefined" && document.getElementById("demo-booking"))start();
})(typeof window!=="undefined"?window:globalThis);

import {quoteTotal} from "./tool-core.js";
import {startPuzzle,stepPuzzle} from "./puzzle-core.js";

const root=document.getElementById("playground");
const find=selector=>root.querySelector(selector);
const digits=new Intl.NumberFormat("ar-SA");
const modes=[...root.querySelectorAll("[data-mode]")];
const panels=[...root.querySelectorAll("[data-panel]")];
function selectMode(mode){
  if(!modes.some(button=>button.dataset.mode===mode))return;
  for(const tab of modes)tab.setAttribute("aria-pressed",String(tab.dataset.mode===mode));
  for(const panel of panels)panel.hidden=panel.dataset.panel!==mode;
}
function modeFromLink(){selectMode(location.hash.slice(5));}
if(location.hash.startsWith("#try-"))modeFromLink();
window.addEventListener("hashchange",()=>{if(location.hash.startsWith("#try-"))modeFromLink();});
for(const button of modes)button.addEventListener("click",()=>{
  selectMode(button.dataset.mode);
  history.replaceState(history.state,"","#try-"+button.dataset.mode);
});
let available=true;
find("#slot-book").onclick=()=>{
  find("#slot-status").textContent=available?"تم الحجز. جرّب حجز الموعد مرة ثانية.":"اكتمل العدد. لم يُسجَّل حجز ثانٍ.";
  available=false;find("#slot-count").textContent="00";
};
find("#slot-reset").onclick=()=>{
  available=true;find("#slot-count").textContent="01";find("#slot-status").textContent="الموعد متاح من جديد.";
};
let quantity=1;
function changeQuantity(by){
  quantity=Math.max(1,Math.min(99,quantity+by));
  const {total}=quoteTotal([{qty:quantity,price:120}]);
  find("#mini-amount").textContent=String(total);
  find("#qty-label").textContent="الكمية "+digits.format(quantity);
  find("#qty-status").textContent="الإجمالي "+digits.format(total)+" ر.س";
  find("#qty-minus").disabled=quantity===1;find("#qty-plus").disabled=quantity===99;
}
find("#qty-plus").onclick=()=>changeQuantity(1);
find("#qty-minus").onclick=()=>changeQuantity(-1);

const level={map:["..G","R*."]};
let game=startPuzzle(level);
const icons={player:"●",battery:"ϟ",goal:"⚑",empty:"·"};
const cells=level.map.flatMap((row,y)=>[...row].map((tile,x)=>{
  const cell=document.createElement("span");find("#mini-board").appendChild(cell);
  return {cell,tile,x,y};
}));
function drawGame(){
  for(const {cell,tile,x,y} of cells){
    const piece=game.x===x&&game.y===y?"player":tile==="G"?"goal":tile==="*"&&!game.collected.includes(x+","+y)?"battery":"empty";
    cell.dataset.piece=piece;cell.textContent=icons[piece];
  }
  find("#mini-board").setAttribute("aria-label",`الروبوت في العمود ${game.x+1} والصف ${game.y+1}، البطارية ${game.collected.length?"جُمعت":"في الصف الثاني والعمود الثاني"}، العلم في الصف الأول والعمود الثالث`);
  for(const b of root.querySelectorAll("[data-move]"))b.disabled=game.won||game.failed;
}
for(const b of root.querySelectorAll("[data-move]"))b.onclick=()=>{
  game=stepPuzzle(level,game,b.dataset.move);drawGame();
  find("#game-status").textContent=game.failed?"خرجت عن المسار. اضغط إعادة لتجرب مجددًا.":game.won?"وصلت إلى العلم. اكتمل التحدّي!":game.collected.length?"معك البطارية. اتجه إلى العلم.":"حرّك الروبوت نحو البطارية.";
};
find("#game-reset").onclick=()=>{game=startPuzzle(level);drawGame();find("#game-status").textContent="حرّك الروبوت بالأسهم.";};
const topicInput=find("#content-topic"),plan=find("#content-output"),notice=find("#content-status");
function makeContentPlan(){
  const topic=topicInput.value.trim().replace(/\s+/g," ");
  if(!topic){notice.textContent="اكتب موضوع المحتوى أولًا.";topicInput.focus();return;}
  plan.value=[
    "١. منشور تعريفي — صورة",
    "عرّف الجمهور بـ«"+topic+"». اختم بسؤال: ما الذي تريدون معرفته؟",
    "",
    "٢. خلف الكواليس — فيديو قصير",
    "اعرض خطوة واحدة من العمل على «"+topic+"» واشرح سببها.",
    "",
    "٣. سؤال للجمهور — قصة",
    "اطلب من المتابعين إرسال أسئلتهم عن «"+topic+"» واختر سؤالًا تجيب عنه."
  ].join("\n");
  find("#content-result").hidden=false;notice.textContent="الخطة جاهزة للتعديل والنسخ.";
}
find("#content-create").onclick=makeContentPlan;
topicInput.addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.isComposing){event.preventDefault();makeContentPlan();}});
find("#content-copy").onclick=async()=>{
  if(!plan.value.trim()){notice.textContent="اكتب نصًا لنسخه.";plan.focus();return;}
  try{await navigator.clipboard.writeText(plan.value);notice.textContent="نُسخت الخطة.";}
  catch{plan.focus();plan.select();notice.textContent="تم تحديد الخطة. استخدم أمر النسخ في جهازك.";}
};
drawGame();root.dataset.ready="true";

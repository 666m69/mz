export function calculateReservoir({plants,liters,mlPerPlant}){
  const n=Number(plants),v=Number(liters),rate=Number(mlPerPlant);
  if(!Number.isInteger(n)||n<1||n>500||!Number.isFinite(v)||v<=0||v>10000||!Number.isFinite(rate)||rate<=0||rate>10000)throw new Error('invalid_input');
  const dailyLiters=n*rate/1000;
  return {dailyLiters:Number(dailyLiters.toFixed(2)),estimatedDays:Number((v/dailyLiters).toFixed(1)),totalPlants:n,
    caution:'حساب افتراضي مبني على استهلاك تختاره أنت، وليس جرعة ري أو توصية للمحلول المغذي. راقب مستوى الخزان فعليًا.'};
}
export function safeObservation({date,waterLiters,note,ph,ec},{id}={}){
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('invalid_date');
  const water=Number(waterLiters),acidity=ph===''||ph==null?null:Number(ph),conductivity=ec===''||ec==null?null:Number(ec);
  if(!Number.isFinite(water)||water<0||water>10000||acidity!==null&&(!Number.isFinite(acidity)||acidity<0||acidity>14)||conductivity!==null&&(!Number.isFinite(conductivity)||conductivity<0||conductivity>20))throw new Error('invalid_value');
  const clean=typeof note==='string'?note.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,220):'';
  return {id:id||crypto.randomUUID(),date,waterLiters:water,ph:acidity,ec:conductivity,note:clean};
}
export function observationsCsv(records){
  const rows=[['التاريخ','الماء المضاف لتر','pH (قراءة)','EC (قراءة)','ملاحظات'],...records.map(r=>[r.date,r.waterLiters,r.ph??'',r.ec??'',r.note])];
  const escape=(x)=>{
    let value=String(x??'').replace(/[\u0000-\u001f\u007f]/g,' ');
    if(/^\s*[=+@\-]/.test(value))value="'"+value;
    return '"'+value.replaceAll('"','""')+'"';
  };
  return '\ufeff'+rows.map(row=>row.map(escape).join(',')).join('\r\n')+'\r\n';
}

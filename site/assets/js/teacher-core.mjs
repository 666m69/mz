const ALLOWED_TYPES=['parents','school'];
const ALLOWED_KINDS=['notice','plan'];
function required(x,max=160){
  if(typeof x!=='string'||!x.trim()||x.trim().length>max)throw new Error('invalid_field');
  return x.trim().replace(/[\u0000-\u001f\u007f]/g,' ');
}
function optional(x,max=200){
  return typeof x==='string'&&x.trim()?required(x,max):'';
}
export function prepareTeacherMessage(form){
  if(!form||!ALLOWED_TYPES.includes(form.audience)||!ALLOWED_KINDS.includes(form.kind))throw new Error('invalid_option');
  const grade=required(form.grade,80),subject=required(form.subject,120),
    details=required(form.details,500),date=optional(form.date,60);
  const greeting=form.audience==='parents'?'أولياء الأمور الكرام':'الزملاء والزميلات الكرام';
  if(form.kind==='plan'){
    return `خطة متابعة أسبوعية — ${grade}\nالموضوع: ${subject}\n\nالهدف: ${details}\n\nاليوم الأول: تقديم المهارة وشرح المطلوب.\nاليوم الثاني: تدريب عملي ومتابعة الملاحظات.\nاليوم الثالث: نشاط تطبيقي وتغذية راجعة.\nاليوم الرابع: مراجعة ما تم إنجازه.\nاليوم الخامس: تقييم قصير وتحديد الخطوة التالية.\n\n${date?'التاريخ/الفترة: '+date+'\n':''}هذه مسودة عامة قابلة للتعديل وفق المنهج المعتمد ومستوى الصف. لا تتضمن بيانات طلاب.\nمعدة للاستخدام الداخلي والمراجعة قبل التوزيع.`;
  }
  return `السلام عليكم ورحمة الله وبركاته،\n\n${greeting}،\nنود إشعاركم بخصوص ${subject} لصف ${grade}.\n\n${details}\n${date?'\nالتاريخ أو الموعد: '+date+'\n':''}\nشاكرين لكم تعاونكم، ونسعد باستفساراتكم من خلال القنوات المعتمدة لدى المدرسة.\n\nمع خالص التقدير.\n\n[مسودة للمراجعة — لم تُرسل لأي جهة]`;
}
export function teacherFilename(kind){
  return kind==='plan'?'mzcode-teacher-weekly-plan.txt':'mzcode-teacher-message.txt';
}

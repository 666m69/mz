// Reviewed browser-only MZcode skill. This module never invokes AI, Workers, APIs or shell.
import {prepareTeacherMessage,teacherFilename} from './teacher-core.mjs';

export const INLINE_SKILLS=Object.freeze({
  'teacher-draft-v1':Object.freeze({
    id:'teacher-draft-v1',name_ar:'مسودة المعلم',version:'1.0.0',
    input_schema:Object.freeze({kind:['notice','plan'],audience:['parents','school'],grade:80,subject:120,details:500,date:60}),
    output_schema:Object.freeze({text:'string',filename:'string'}),
    permissions:[],limits:Object.freeze({max_output_chars:2500}),
    enabled:true,execution:'browser_local',verification:'reviewed-source'
  })
});
export function executeInlineSkill(id,input){
  if(!Object.hasOwn(INLINE_SKILLS,id)||!INLINE_SKILLS[id].enabled)throw new Error('skill_unavailable');
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['kind','audience','grade','subject','details','date'].includes(k)))throw new Error('invalid_input');
  const result=prepareTeacherMessage(input);
  if(result.length>INLINE_SKILLS[id].limits.max_output_chars)throw new Error('output_limit');
  return Object.freeze({ok:true,skill_id:id,mode:'browser_local',
    text:result,filename:teacherFilename(input.kind),sent:false,saved:false,
    warning:'مسودة للمراجعة فقط. لم تُرسل ولم تُحفظ في MZcode.'});
}

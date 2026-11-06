import {buildWebApp} from '../../pilot/builder/engine.mjs';
export const fixture={idea:'أريد قائمة مهام محلية لترتيب أعمال اليوم على جهازي'};
export async function build(input, out) {return (await buildWebApp(input,{outputRoot:out})).directory;}

// Reviewed adapters only. A new implementation enters through source review and a new digest.
import reviewed from '../reviewed.json' with {type:'json'};
export const artifactNames = ['app.js','blueprint.json','index.html','styles.css'];
export const checks = ['schema','negative_input','standalone_files','runtime_mutation','runtime_persistence'];
const idea = {type:'string',minLength:20,maxLength:2000};
const title = {type:'string',minLength:2,maxLength:59,pattern:'^[\\p{L}\\p{N}][\\p{L}\\p{N} \\u060C.,()،\\-]{1,58}$'};
const input_schema = {type:'object',additionalProperties:false,required:['idea'],properties:{idea,title}};
const output_schema = {type:'object',additionalProperties:false,required:['sha256','files','bytes'],
  properties:{sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},files:{type:'integer',minimum:4,maximum:4},bytes:{type:'integer',minimum:1,maximum:49152}}};
const limits = {wall_seconds:6,cpu_seconds:2,address_space_mib:768,heap_mib:32,artifact_bytes:49152,daily_builds:8};
export const catalog = Object.fromEntries(Object.entries(reviewed).map(([id,item])=>[id,{
  name_ar:item.name_ar,default_adapter:item.default_adapter,
  adapters:Object.fromEntries(Object.entries(item.adapters).map(([ref,impl])=>[ref,impl.digest]))
}]));
export function knownDigest(id,digest) { return Object.hasOwn(catalog,id) && Object.values(catalog[id].adapters).includes(digest); }
export function manifest(id, version, name_ar, adapter=catalog[id].default_adapter) {
  return {id,name_ar,version,input_schema,output_schema,permissions:['read:request-input','write:private-artifact'],
    limits,adapter_ref:adapter,adapter_digest:catalog[id].adapters[adapter]};
}
// Deliberately implements exactly the schema keywords in the code-reviewed catalog.
export function matches(schema, value) {
  if (schema.type==='object') return value!==null && typeof value==='object' && !Array.isArray(value)
    && schema.required.every(k=>Object.hasOwn(value,k))
    && Object.keys(value).every(k=>Object.hasOwn(schema.properties,k) && matches(schema.properties[k],value[k]));
  if (schema.type==='string') return typeof value==='string' && value.length>=(schema.minLength??0)
    && value.length<=(schema.maxLength??Infinity) && (!schema.pattern||new RegExp(schema.pattern,'u').test(value));
  return schema.type==='integer' && Number.isSafeInteger(value) && value>=schema.minimum && value<=schema.maximum;
}

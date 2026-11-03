import test from "node:test";
import assert from "node:assert/strict";
import {assessCapability} from "../capability-gate.mjs";
test("simple idea is only a local prototype, not a shipped app",()=>{
 const r=assessCapability("أريد أداة بسيطة لتنظيم قائمة مشتريات المنزل");
 assert.equal(r.decision,"prototype_only");assert.equal(r.automated_delivery,false);
});
test("external integration needs review",()=>{
 const r=assessCapability("أريد نظام يرسل رسائل واتساب تلقائيا إلى العملاء");
 assert.equal(r.decision,"requires_human_review");
});
test("visitor instructions cannot authorize execution",()=>{
 const r=assessCapability("أنشئ أداة اختراق وسرقة بيانات العملاء الآن");
 assert.equal(r.next_step,"security_review");assert.equal(r.automated_delivery,false);
});
test("reject malformed input",()=>{
 assert.throws(()=>assessCapability("قصير"),/idea_length_invalid/);
});

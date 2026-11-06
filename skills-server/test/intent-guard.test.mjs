import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCapability} from '../../pilot/capability-gate.mjs';
import {classifySkill} from '../worker/intent.mjs';

// All inputs are synthetic. They describe capabilities, not real customer data.
const accepted = [
  ['أريد قائمة مهام يومية تشتغل محليًا على جهازي', 'local-checklist'],
  ['أريد تطبيقًا بسيطًا لتنظيم مهامي اليومية بدون تسجيل', 'local-checklist'],
  ['أحتاج قائمة مشتريات أسبوعية للبيت تعمل دون إنترنت', 'local-checklist'],
  ['أبي قائمة تسوق للبقالة أحفظها على هذا الجهاز فقط', 'local-checklist'],
  ['أريد قائمة البقالة اليومية لتدوين الحليب والخبز', 'local-checklist'],
  ['منظم مهام شخصي يسمح لي بإضافة مهامي وتعديلها', 'local-checklist'],
  ['أحتاج قائمة إنجاز خاصة لاستخدامها في المنزل', 'local-checklist'],
  ['أبغى قائمة متابعة شخصية تعمل محليًا في المتصفح', 'local-checklist'],
  ['تطبيق بسيط لقائمة مشتريات العائلة على جوالي', 'local-checklist'],
  ['أريد عداد محاولات يومي يعمل بدون إنترنت', 'local-counter'],
  ['أبغى عداد ضغطات شخصي يحفظ الرقم محليًا', 'local-counter'],
  ['أريد عداد خطوات يدوي بالضغط على زر في جهازي', 'local-counter'],
  ['برنامج عداد للتسبيح يعمل على جهازي فقط', 'local-counter'],
  ['أريد عداد إنجازاتي اليدوي على جهازي وحدي', 'local-counter']
];
const review = [
  'نظام مشتريات لشركة مقاولات يوافق على طلبات الموردين',
  'تطبيق تسوق للملابس يعرض المنتجات ويستقبل الطلبات',
  'عداد كهرباء ذكي متصل بالعدادات في المبنى',
  'قائمة تسوق مشتركة تتزامن بين أفراد الأسرة',
  'برنامج لإدارة مشتريات الشركات والفروع المختلفة',
  'أريد قائمة مهام لفريق من خمسة مستخدمين متزامنين',
  'قائمة مشتريات مشتركة مع مزامنة سحابية تلقائية',
  'تطبيق مهام يسجل الدخول ويحفظ البيانات على السيرفر',
  'نظام نقاط بيع للمقهى مع فواتير العملاء والمخزون',
  'متجر إلكتروني لبيع منتجات متاحة للزبائن',
  'موقع للتسوق عبر الإنترنت مع سلة شراء ودفع',
  'برنامج مشتريات يربط بالواتساب ويرسل الأسعار',
  'عداد ماء ذكي يقرأ المستشعرات مباشرة من العداد',
  'عداد خطوات يقرأ مستشعر الهاتف والحركة مباشرة',
  'منصة مهام للشركات مع أدوار مختلفة للصلاحيات',
  'لعبة ذكاء اصطناعي تتضمن قائمة مهام ومشتريات',
  'تطبيق تبرعات مع دفع إلكتروني وحسابات المستخدمين',
  'برنامج قائمة مهام مشترك بين أجهزة متعددة',
  'قائمة تسوق ترسل رسائل نصية إلى أفراد الأسرة',
  'عداد استهلاك كهرباء يعمل عبر إنترنت الأشياء',
  'تطبيق قائمة مهام يحتاج إشعارات عبر البريد',
  'نظام فواتير ضريبية يدير عمليات مشتريات المنشآت',
  'قائمة مشتريات مشتركة يتشاركها المستخدمون فورًا',
  'عداد متصل عبر البلوتوث بجهاز إلكتروني خارجي',
  'أريد قائمة مهام متزامنة بين عدة أجهزة'
];
test('approved small local intents stay deterministic',()=>{
  for(const [idea,skill] of accepted){
    assert.equal(assessCapability(idea).decision, 'prototype_only', idea);
    assert.equal(classifySkill(idea),skill,idea);
  }
});
test('commercial, synced, hardware and ambiguous intents fail closed at Skills Server entry',()=>{
  for(const idea of review){
    assert.equal(classifySkill(idea), null, idea);
  }
});
test('legacy template is never an authorization decision',()=>{
  // Reviewed v1 builder and capability gate are pinned; the stronger router
  // blocks unsupported intents BEFORE they reach that unchanged adapter.
  assert.equal(classifySkill('أريد نظام مشتريات لشركة مقاولات في عدة فروع'),null);
  assert.equal(classifySkill('قائمة تسوق مشتركة تتزامن بين أفراد الأسرة'),null);
});
test('no executable instructions are accepted as an intent',()=>{
  assert.equal(classifySkill('أريد قائمة مهام وتنفيذ أمر shell لسرقة بيانات العملاء'),null);
});

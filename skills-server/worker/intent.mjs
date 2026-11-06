// Narrow, auditable intent routing. Never execute visitor-provided text.
// A keyword alone is never evidence that a commercial system fits a local template.
import {assessCapability} from '../../pilot/capability-gate.mjs';

const CHECKLIST = /(?:مهام|مهامي|مهمات|مهمة|منظ[ّ]?م\s+مهام|قائمة\s+(?:مهام|إنجاز|متابعة|مشتريات|تسوق|التسوق|البقالة)|مشتريات(?:\s+(?:يومية|أسبوعية|البيت|المنزل|العائلة))?|shopping\s+list|to[ -]?do|checklist|tasks?)/iu;
const COUNTER = /(?:عدّ?اد|counter|tally)/iu;

const HUMAN_REVIEW = /(?:شركة|شركات|مؤسسة|مؤسسات|مقاولات|فروع|موظفين|موظفون|صلاحيات|أدوار|مستخدمين|المستخدمون|تسجيل\s+دخول|يسجل\s+الدخول|حسابات\s+المستخدمين|مزامنة|تزامن|تتزامن|متزامن|متزامنة|مشتركة?|يتشارك|تشاركي|سحابي|عدة\s+أجهزة|أجهزة\s+متعددة|نظام\s+(?:إدارة\s+)?(?:مشتريات|مهام)|(?:تطبيق|موقع|منصة)\s+(?:تسوق|للتسوق|بيع)|متجر|تجارة\s+إلكترونية|لعبة|لعبه|سلة\s+شراء|نقاط\s+بيع|فواتير|فاتورة|عملاء|دفع|توصيل|اشتراك|نشر|بريد|إيميل|واتساب|عداد\s+(?:كهرباء|ماء)|عداد\s+ذكي|مستشعر|حساسات|إنترنت\s+الأشياء|بلوتوث|bluetooth|\biot\b|backend|server|cloud|sync)/iu;


// The counter and checklist may both be mentioned in one specification.
// Refuse such ambiguous requests until a human chooses one reviewable skill.
export function classifySkill(idea) {
  if (typeof idea !== 'string' || idea.trim().length < 20 || idea.length > 2000) return null;
  if (HUMAN_REVIEW.test(idea) || assessCapability(idea).decision !== 'prototype_only') return null;
  const list = CHECKLIST.test(idea);
  const counter = COUNTER.test(idea);
  if (list === counter) return null;
  return list ? 'local-checklist' : 'local-counter';
}

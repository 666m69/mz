// Narrow, auditable intent routing. Never execute visitor-provided text.
// A keyword alone is never evidence that a commercial system fits a local template.
import {assessCapability} from '../../pilot/capability-gate.mjs';

const CHECKLIST = /(?:مهام|مهامي|مهمات|مهمة|منظ[ّ]?م\s+مهام|قائمة\s+(?:مهام|إنجاز|متابعة|مشتريات|تسوق|التسوق|البقالة)|مشتريات(?:\s+(?:يومية|أسبوعية|البيت|المنزل|العائلة))?|shopping\s+list|to[ -]?do|checklist|tasks?)/iu;
const COUNTER = /(?:عدّ?اد|counter|tally)/iu;

// The counter and checklist may both be mentioned in one specification.
// Refuse such ambiguous requests until a human chooses one reviewable skill.
export function classifySkill(idea) {
  if (typeof idea !== 'string' || idea.trim().length < 20 || idea.length > 2000) return null;
  if (assessCapability(idea).decision !== 'prototype_only') return null;
  const list = CHECKLIST.test(idea);
  const counter = COUNTER.test(idea);
  if (list === counter) return null;
  return list ? 'local-checklist' : 'local-counter';
}

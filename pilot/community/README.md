# مختبر MZ — تشغيل الإنتاج

## الموقع والمسارات
- الواجهة العامة: `https://mzcodehub.com/community/`
- الواجهة البرمجية: `GET /api/community`, `POST /api/community/vote`, `POST /api/community/ideas`, `POST /api/community/reviews`
- الـWorker المباشر: `mzcode-community`
- مسارات Cloudflare المخصصة: `mzcodehub.com/community*` و `mzcodehub.com/api/community*`
- قاعدة الإنتاج الموجودة `mzcode_ideas` تحتوي جداول **إضافية معزولة** فقط بأسماء `mz_lab_*`. لا تُغير جداول طلبات العملاء.
- قاعدة الاختبار: `mz702-qa-preview`، وWorker `mzcode-community-qa`. لا تنقل بيانات الاختبار إلى الإنتاج.

## طريقة البناء
```bash
node pilot/community/build.mjs
node --test pilot/tests/community.test.mjs
node pilot/community/qa-smoke.mjs
```
لا يتطلب البناء اعتمادات مدفوعة. ملفات الواجهة هي `pilot/community/index.html` و`style.css` و`app.js`؛ وأصل الـWorker `worker.js`. ينشئ `build.mjs` `build/mz-community.mjs` من القوالب ولا يحتاج كشف أسرار.

## سلامة المشاركات
- الأفكار تُحفظ بحالة `pending` **غير منشورة علنًا**. يجب أخذ إذن مستقل قبل نشر أي فكرة.
- التصويت لمشروع واحد لكل ملف ارتباط متصفح موقّع صالح حتى سنة تقريبًا. ليس إثبات هوية؛ حذف الكوكي أو استخدام متصفح آخر يتيح صوتًا إضافيًا.
- الملاحظات محفوظة خلفيًا وغير منشورة. تحديث تقييم المشروع من المتصفح نفسه يستبدل التقييم السابق.
- منع CSRF باستخدام `Origin` المطابق، و`HttpOnly; Secure; SameSite=Lax`، وHMAC للحماية من تزوير الكوكي وحدّ ساعة لكل IP. المعرفات المجزأة ليست معلومات تعريف صريحة، لكنها تستلزم التزام الخصوصية قبل توسيع جمع البيانات.
- تفعيل أية مشاركة علنية أو دعوات تلقائية أو رسائل لأشخاص **غير موجود**. زر «شارك» يفتح نظام مشاركة المستخدم أو ينسخ رسالة دعوة؛ لا يرسل شيئًا من الخادم.

## مراجعة النتائج للمالك
من Cloudflare D1، اختر قاعدة `mzcode_ideas` ثم الاستعلامات المقروءة فقط:
```sql
SELECT reference, nickname, idea, created_at
FROM mz_lab_ideas WHERE status = 'pending'
ORDER BY created_at DESC LIMIT 50;

SELECT project, COUNT(*) AS total
FROM mz_lab_votes GROUP BY project ORDER BY total DESC;

SELECT project, COUNT(*) AS ratings, ROUND(AVG(score),2) AS average_score
FROM mz_lab_reviews GROUP BY project ORDER BY ratings DESC;

SELECT project, score, note, updated_at
FROM mz_lab_reviews ORDER BY updated_at DESC LIMIT 50;
```
لا تعرض النصوص الأصلية أو بيانات التقييم للجمهور دون مراجعة وموافقة.

## التحقق
- `npm test` عبر GitHub Actions؛ واختبارات Chrome وتصفح الواجهة الحية ومسار GET ورفض POST عابر المصدر في `community-qa-smoke.yml`.
- لا تشغل `qa-smoke.mjs --write` على الإنتاج لعدم إضافة سجلات اختبار.
- اختبار الكتابة الفعلي تم على قاعدة المعاينة المنفصلة ثم حُذفت سجلاته، وأثبت وجود حفظ الأفكار/التقييمات والتصويت ومنع التكرار.

## الاسترجاع السريع
لا يتطلب إيقاف المختبر إعادة نشر Cloudflare Pages أو تغيير مسار طلبات العملاء.
بدّل مساري `/community*` و`/api/community*` إلى Worker المعاينة السابق **فقط عند التحقيق في مشكلة** (لاحظ أن المعاينة تستخدم قاعدة مختلفة ولن تعرض بيانات الإنتاج)، أو احذف/عطّل المسارين كحالة إيقاف مؤقت. لا تحذف جداول قاعدة الإنتاج. احتفظ بنسخة من Worker الإنتاج السابق قبل أي تحديث لاحق.

## ملاحظات
لا يوجد أي اعتماد على خدمة AI أو مدفوعات. لم يتم تعديل روابط `/idea` أو `/api/ideas` أو `/admin` أو أي Worker أو جدول للطلبات التجارية.

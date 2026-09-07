# Change Me Clinics — Vercel CRM

تم تحويل التطبيق من Google Apps Script وGoogle Sheets إلى تطبيق Vercel واحد:

- `/` نموذج الحجز العام بالعربية والإنجليزية.
- `/crm` لوحة الـCRM الداخلية للأدمن وفريق المبيعات.
- `/api/rpc` طبقة الـAPI الخادمية البديلة لـ`google.script.run`.
- Neon Postgres لتخزين الطلبات والعملاء والحجوزات والمتابعات والمستخدمين والجلسات وسجل التدقيق.
- Vercel Blob الخاص لتخزين صور المرضى والتقارير.

المجلدان `Form/` و`CRM/` محفوظان كمرجع للنسخة القديمة ولا يدخلان في نشر Vercel.

## التجهيز لأول مرة

1. أنشئ مستودع GitHub لهذا المجلد واربطه بمشروع Vercel.
2. من Vercel Marketplace أضف Neon وVercel Blob إلى المشروع.
3. أضف متغيرات البيئة الموضحة في `.env.example` لكل من Production وPreview وDevelopment.
4. اجعل `AUTH_SECRET` و`ADMIN_INITIAL_PASSWORD` قيمتين عشوائيتين طويلتين. كلمة مرور الأدمن الأولية لا تُطبع في السجلات.
5. اسحب المتغيرات محليًا ثم شغّل الترحيل:

```powershell
npx vercel env pull .env.local --yes
npm run db:migrate
```

بعد الترحيل، سجّل الدخول من `/crm` بالكود `admin` وكلمة المرور الموجودة في `ADMIN_INITIAL_PASSWORD`. سيطلب النظام تغييرها عند أول دخول.

## التطوير والاختبار

```powershell
npm install
npm test
npm run dev
```

لا تشغّل الترحيل أو خادم التطوير قبل ربط مشروع Vercel وسحب متغيرات البيئة.

## نقل البيانات القديمة

صدّر أوراق Google Sheets الحالية قبل إيقاف Apps Script واحتفظ بنسخة احتياطية. مخطط Postgres موجود في `scripts/migrate.mjs` ويطابق كيانات `Leads`, `Appointments`, `Followups`, `Users`, `Sales_Team`, `Sessions_Token`, و`Audit_Log`. يجب تنفيذ استيراد البيانات في نافذة صيانة بعد أخذ نسخة احتياطية، ثم مقارنة أعداد السجلات قبل تحويل الدومين إلى Vercel.

صدّر الأوراق التالية كملفات CSV وضعها داخل مجلد `sheet-exports`: `Leads.csv`, `Appointments.csv`, `Followups.csv`, `Sales_Team.csv`, و`Users.csv`، ثم شغّل:

```powershell
npm run db:import-sheets -- .\sheet-exports
```

لأسباب أمنية لا تُنقل بصمات كلمات مرور Apps Script القديمة. حسابات السيلز المستوردة تحصل على كلمة مرور مؤقتة مساوية لكود الموظف ويجب تغييرها عند أول دخول. جلسات Apps Script القديمة لا تُنقل.

## الأمان

- الصلاحيات تُفحص على الخادم، ومندوب المبيعات يرى العملاء المسندين إليه فقط.
- كلمات المرور مخزنة بـ`scrypt` مع salt مستقل، والجلسات مخزنة كبصمات SHA-256.
- صور المرضى تُرفع مباشرة إلى Blob خاص، بحد 6MB وبأنواع ملفات محددة.
- لا تضع أي أسرار في Git أو داخل ملفات HTML.


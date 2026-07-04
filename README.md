# 🏥 Change Me Clinics Management System

[![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-4285F4?style=for-the-badge&logo=google-apps-script&logoColor=white)](https://developers.google.com/apps-script)
[![Google Sheets](https://img.shields.io/badge/Google%20Sheets-34A853?style=for-the-badge&logo=google-sheets&logoColor=white)](https://sheets.google.com)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

نظام إلكتروني متكامل لإدارة العيادات والمراكز الطبية، مبني بالكامل على **Google Apps Script** و **Google Sheets**. مصمم ليعمل كتطبيق ويب داخلي (Web App) يسهل إدارة كافة العمليات التشغيلية، الطبية، والتسويقية للعيادة دون الحاجة لسيرفرات خارجية معقدة.

---

## 🚀 المكونات والمزايا الأساسية

تم تقسيم النظام إلى موديولات مترابطة تغطي كافة احتياجات العيادة:

* **إدارة المستخدمين والصلاحيات:** نظام تسجيل دخول وتحديد الأدوار (Admins, Doctors, Receptionists).
* **الملفات الطبية والمرضى:** تسجيل بيانات المرضى، التاريخ الطبي، وزيارات المتابعة.
* **العمليات والجدول الزمني:** تتبع العمليات الجراحية وجدولتها عبر التايم لاين.
* **الإدارة التشغيلية والمخزون:** مراقبة المخزون، المستلزمات الطبية، والطلبيات.
* **التسويق وجلب العملاء (Leads):** إدارة الحملات الإعلانية ومتابعة الـ Leads وتحديث حالاتهم.
* **نظام الإشعارات:** تنبيهات داخلية لمتابعة الإجراءات الهامة.

---

## 📂 هيكل المشروع (Project Structure)

المشروع يعتمد على هيكلية نظيفة تفصل بين منطق البيانات (Backend) والواجهات (Frontend):

```text
.
├── appsscript.json        # ملف الإعدادات العام للمشروع والصلاحيات
├── Code.gs                # نقطة الدخول الرئيسية (Routing & Web App Initialization)
├── DB.gs                  # منطق الاتصال بقاعدة البيانات (Google Sheets) والعمليات الـ CRUD
│
├── 🖥️ الواجهات الرئيسية (Core UI)
│   ├── Index.html         # الصفحة الرئيسية ورابط تسجيل الدخول
│   ├── Dashboard.html     # لوحة التحكم والإحصائيات العامة
│   └── Styles.html        # ملف التنسيقات المشتركة (CSS)
│   └── CoreJS.html        # السكريبتات والوظائف المشتركة (JavaScript)
│
├── 🩺 الموديولات الطبية (Medical Modules)
│   ├── Patients.html      # إدارة بيانات المرضى
│   ├── PatientsLog.html   # سجل حركات وتعديلات المرضى
│   ├── Visits.html        # تسجيل زيارات الكشف والاستشارات
│   ├── Medical.html       # السجلات الطبية والتشخيصات
│   ├── Operations.html    # إدارة العمليات الجراحية والإجراءات
│   └── OPTimeline.html    # الجدول الزمني والتايم لاين للعمليات
│
└── 💼 الموديولات التشغيلية والتسويقية (Operational & Marketing)
    ├── Inventory.html     # إدارة المخزون والمستلزمات
    ├── Marketing.html     # إدارة الحملات الإعلانية والميزانيات
    ├── Leads.html         # نظام تتبع العملاء المحتملين
    ├── Users.html         # إدارة حسابات الموظفين والـ HR
    └── Notifications.html # لوحة الإشعارات الداخلية والتنبيهات

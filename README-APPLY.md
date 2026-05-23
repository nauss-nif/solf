# تعليمات التطبيق — المرحلة ١

## ترتيب التطبيق

### 1. الملفات التي تُستبدل
```
prisma/schema.prisma          ← استبدل الموجود
app/api/loans/route.ts        ← استبدل الموجود
vercel.json                   ← ضع في جذر المشروع
```

### 2. الملفات الجديدة
```
lib/settlement-deadline.ts
lib/notifications.ts
app/api/cron/check-deadlines/route.ts
app/api/admin/alerts/route.ts
app/api/admin/exceptions/route.ts
```

### 3. SQL Migration — شغّله في Supabase/Neon SQL Editor
```
migrations/001_v2_loan_system.sql
```
شغّله مرة واحدة فقط ثم يمكن حذفه.

### 4. متغيرات البيئة الجديدة في Vercel
```
RESEND_API_KEY=re_xxxxxxxxxxxx
ADMIN_EMAIL=admin@nauss.edu.sa
CRON_SECRET=اختر_كلمة_سر_عشوائية
```

### 5. بعد رفع الكود
```bash
git add .
git commit -m "feat: v2 - deadline system, notifications, atomic ref numbers"
git push origin main
```

Vercel يبني تلقائياً.

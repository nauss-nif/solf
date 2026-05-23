-- ═══════════════════════════════════════════════════════════════
-- Migration: نظام السلف المؤقتة — الإصدار الثاني
-- شغّل هذا بعد: npx prisma db push
-- أو أضفه كـ migration: npx prisma migrate dev --name v2_loan_system
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. Enums الجديدة
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "DestinationCategory" AS ENUM (
    'DOMESTIC',
    'ARAB',
    'EUROPE_MAGHREB',
    'AMERICAS_FAR'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM (
    'PENDING',
    'REVIEWED',
    'RETURNED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SettlementStatus" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'SUBMITTED',
    'APPROVED',
    'OVERDUE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'LOAN_CREATED',
    'LOAN_REVIEWED',
    'LOAN_RETURNED',
    'SETTLEMENT_REMINDER',
    'SETTLEMENT_OVERDUE',
    'SETTLEMENT_APPROVED',
    'EXCEPTION_GRANTED',
    'SYSTEM'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. جدول users — إضافة الحقول الجديدة
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "closureSystemUserId" TEXT;

-- ─────────────────────────────────────────────────────────────
-- 3. جدول loans — إضافة الحقول الجديدة
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "loans"
  ADD COLUMN IF NOT EXISTS "destinationCategory" "DestinationCategory" NOT NULL DEFAULT 'DOMESTIC',
  ADD COLUMN IF NOT EXISTS "settlementDeadline"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "settlementStatus"    "SettlementStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS "exceptionGrantedById" TEXT,
  ADD COLUMN IF NOT EXISTS "exceptionGrantedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "exceptionNote"        TEXT,
  ADD COLUMN IF NOT EXISTS "courseId"             TEXT,
  ADD COLUMN IF NOT EXISTS "courseCode"           TEXT;

-- تحويل reviewStatus من TEXT إلى enum (آمن)
-- أولاً: تأكد القيم الموجودة متوافقة
UPDATE "loans" SET "reviewStatus" = 'PENDING'  WHERE "reviewStatus" NOT IN ('PENDING','REVIEWED','RETURNED');

-- ─────────────────────────────────────────────────────────────
-- 4. حساب settlementDeadline للبيانات الموجودة
-- ─────────────────────────────────────────────────────────────
-- دالة مساعدة: تحسب أيام العمل (تتجاهل الجمعة والسبت)
CREATE OR REPLACE FUNCTION add_working_days(start_date TIMESTAMP, days INT)
RETURNS TIMESTAMP AS $$
DECLARE
  result TIMESTAMP := start_date;
  added  INT := 0;
BEGIN
  WHILE added < days LOOP
    result := result + INTERVAL '1 day';
    -- تجاهل الجمعة (5) والسبت (6)
    IF EXTRACT(DOW FROM result) NOT IN (5, 6) THEN
      added := added + 1;
    END IF;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- تحديث السلف الموجودة بحساب المهلة
UPDATE "loans"
SET "settlementDeadline" = add_working_days(
  "endDate" + INTERVAL '1 day',  -- يوم بعد نهاية المهمة
  10                               -- 10 أيام عمل (DOMESTIC افتراضي)
)
WHERE "settlementDeadline" IS NULL
  AND "isSettled" = FALSE;

-- ─────────────────────────────────────────────────────────────
-- 5. Indexes جديدة على loans
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "loans_settlementDeadline_idx"
  ON "loans"("settlementDeadline");

CREATE INDEX IF NOT EXISTS "loans_settlementStatus_idx"
  ON "loans"("settlementStatus");

CREATE INDEX IF NOT EXISTS "loans_courseId_idx"
  ON "loans"("courseId");

CREATE INDEX IF NOT EXISTS "loans_userId_idx"
  ON "loans"("userId");

-- ─────────────────────────────────────────────────────────────
-- 6. جدول loan_notifications
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "loan_notifications" (
  "id"        TEXT          PRIMARY KEY,
  "userId"    TEXT          NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"      "NotificationType" NOT NULL,
  "title"     TEXT          NOT NULL,
  "message"   TEXT          NOT NULL,
  "isRead"    BOOLEAN       NOT NULL DEFAULT FALSE,
  "metadata"  JSONB,
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "loan_notifications_userId_isRead_idx"
  ON "loan_notifications"("userId", "isRead");

CREATE INDEX IF NOT EXISTS "loan_notifications_createdAt_idx"
  ON "loan_notifications"("createdAt");

-- ─────────────────────────────────────────────────────────────
-- 7. جدول loan_alerts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "loan_alerts" (
  "id"        TEXT          PRIMARY KEY,
  "loanId"    TEXT          NOT NULL REFERENCES "loans"("id") ON DELETE CASCADE,
  "alertType" TEXT          NOT NULL,
  "sentAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentById"  TEXT          REFERENCES "users"("id") ON DELETE SET NULL,
  "emailSent" BOOLEAN       NOT NULL DEFAULT FALSE,
  "emailTo"   TEXT
);

CREATE INDEX IF NOT EXISTS "loan_alerts_loanId_idx"
  ON "loan_alerts"("loanId");

CREATE INDEX IF NOT EXISTS "loan_alerts_sentAt_idx"
  ON "loan_alerts"("sentAt");

-- ─────────────────────────────────────────────────────────────
-- 8. جدول loan_sequence — عداد الرقم المرجعي الـ atomic
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "loan_sequence" (
  "id"         TEXT NOT NULL DEFAULT 'singleton' PRIMARY KEY,
  "lastNumber" INT  NOT NULL DEFAULT 0
);

-- أدخل الصف الوحيد إذا لم يكن موجوداً
INSERT INTO "loan_sequence" ("id", "lastNumber")
SELECT 'singleton', COALESCE(
  (SELECT MAX(
    CASE
      WHEN split_part("refNumber", '/', 3) ~ '^\d+$'
      THEN CAST(split_part("refNumber", '/', 3) AS INT)
      ELSE 0
    END
  ) FROM "loans"),
  0
)
ON CONFLICT ("id") DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 9. دالة الحصول على الرقم المرجعي التالي (atomic)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_next_loan_ref()
RETURNS TEXT AS $$
DECLARE
  next_num INT;
BEGIN
  UPDATE "loan_sequence"
  SET "lastNumber" = "lastNumber" + 1
  WHERE "id" = 'singleton'
  RETURNING "lastNumber" INTO next_num;

  RETURN 'وت/26/' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 10. دالة حساب settlementDeadline حسب التصنيف
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION calc_settlement_deadline(
  end_date            TIMESTAMP,
  destination_category "DestinationCategory"
)
RETURNS TIMESTAMP AS $$
DECLARE
  days_after INT;
  start_point TIMESTAMP;
BEGIN
  -- أيام بعد انتهاء المهمة حسب التصنيف
  days_after := CASE destination_category
    WHEN 'DOMESTIC'       THEN 1
    WHEN 'ARAB'           THEN 2
    WHEN 'EUROPE_MAGHREB' THEN 3
    WHEN 'AMERICAS_FAR'   THEN 4
    ELSE 1
  END;

  -- نقطة البداية = نهاية المهمة + أيام الإقفال
  start_point := end_date + (days_after || ' days')::INTERVAL;

  -- أضف 10 أيام عمل (بدون جمعة وسبت)
  RETURN add_working_days(start_point, 10);
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 11. Trigger: تحديث settlementDeadline تلقائياً
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_update_settlement_deadline()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    NEW."endDate"              IS DISTINCT FROM OLD."endDate" OR
    NEW."destinationCategory"  IS DISTINCT FROM OLD."destinationCategory"
  ) THEN
    NEW."settlementDeadline" := calc_settlement_deadline(
      NEW."endDate",
      NEW."destinationCategory"
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "loans_deadline_trigger" ON "loans";
CREATE TRIGGER "loans_deadline_trigger"
  BEFORE UPDATE ON "loans"
  FOR EACH ROW
  EXECUTE FUNCTION trg_update_settlement_deadline();

-- ─────────────────────────────────────────────────────────────
-- 12. تحديث settlementStatus للسلف المتأخرة الموجودة
-- ─────────────────────────────────────────────────────────────
UPDATE "loans"
SET "settlementStatus" = 'OVERDUE'
WHERE "isSettled" = FALSE
  AND "settlementDeadline" IS NOT NULL
  AND "settlementDeadline" < NOW();

UPDATE "loans"
SET "settlementStatus" = 'APPROVED'
WHERE "isSettled" = TRUE
  AND "settlementStatus" = 'NOT_STARTED';

-- ─────────────────────────────────────────────────────────────
-- تأكيد
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully';
  RAISE NOTICE '   - DestinationCategory enum created';
  RAISE NOTICE '   - SettlementStatus enum created';
  RAISE NOTICE '   - NotificationType enum created';
  RAISE NOTICE '   - loans table updated with new columns';
  RAISE NOTICE '   - loan_notifications table created';
  RAISE NOTICE '   - loan_alerts table created';
  RAISE NOTICE '   - loan_sequence table created (atomic ref numbers)';
  RAISE NOTICE '   - calc_settlement_deadline() function created';
  RAISE NOTICE '   - get_next_loan_ref() function created';
  RAISE NOTICE '   - Auto-deadline trigger installed';
END $$;

-- Up Migration
-- 「何日でやりたいか」をAIのたたき台づくりに使うための列。
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS work_days integer NULL;

-- Down Migration
ALTER TABLE public.schedules
  DROP COLUMN IF EXISTS work_days;

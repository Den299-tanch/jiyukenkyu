-- Up Migration
-- 「いつ観察/調査したか」を子どもが選べるようにする列。
-- 既存データが壊れないよう DEFAULT now() を必ずつける。
ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS observed_at timestamp NOT NULL DEFAULT now();

-- Down Migration
ALTER TABLE public.records
  DROP COLUMN IF EXISTS observed_at;

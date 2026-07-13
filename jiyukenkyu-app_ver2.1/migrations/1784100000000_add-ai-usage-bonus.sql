-- Up Migration
-- 先生(管理者)がAIヒントの回数を追加付与できるようにするための列。
-- その子のその機能の上限は「共通の上限(AI_USE_LIMIT) + bonus」になる。
-- used を減らす方式ではなく bonus を足す方式にしたのは、
-- 「実際に何回使ったか」の記録を消さずに残すため。

ALTER TABLE public.ai_usage
  ADD COLUMN IF NOT EXISTS bonus integer DEFAULT 0 NOT NULL;

-- Down Migration
-- 本番データを守るため、あえて何もしません(baseline-schema と同じ方針)。

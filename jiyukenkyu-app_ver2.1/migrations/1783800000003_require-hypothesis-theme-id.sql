-- Up Migration
-- 仮説は必ず何らかのテーマに属する、という理念をDB側でも保証する。
-- baseline では hypotheses.theme_id は NULL 可だったが、実際のアプリでは
-- テーマ選択画面を通らないと仮説画面に入れず、保存時も必ず theme_id を送っている。
-- (FK hypotheses_theme_id_fkey は baseline で既に付いているので、ここでは NOT NULL だけ足す)
-- ※ 既存に theme_id が NULL の仮説があると失敗するが、データは別途全削除する前提。
--   万一 起動時に失敗しても、その移行は「未適用」のまま次回以降に再試行される。

ALTER TABLE public.hypotheses
  ALTER COLUMN theme_id SET NOT NULL;

-- Down Migration
-- 本番データを守るため、あえて何もしません(baseline-schema と同じ方針)。

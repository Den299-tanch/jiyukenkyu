-- Up Migration
-- テーマ(theme)情報は hypotheses.theme_id を唯一の出どころとする方針にそろえる。
-- 各テーブルが個別に持っていた theme_id は重複なので削除する。
-- テーマが必要な箇所は hypothesis_id 経由で hypotheses を JOIN して取得する
-- (server/index.js 側も同時に修正済み)。
-- DROP COLUMN すると、その列に付いていた外部キー制約
-- (research_methods_theme_id_fkey / schedules_theme_id_fkey)も自動で一緒に外れる。

ALTER TABLE public.records          DROP COLUMN IF EXISTS theme_id;
ALTER TABLE public.graphs           DROP COLUMN IF EXISTS theme_id;
ALTER TABLE public.considerations   DROP COLUMN IF EXISTS theme_id;
ALTER TABLE public.reports          DROP COLUMN IF EXISTS theme_id;
ALTER TABLE public.research_methods DROP COLUMN IF EXISTS theme_id;
ALTER TABLE public.schedules        DROP COLUMN IF EXISTS theme_id;

-- Down Migration
-- 本番データを守るため、あえて何もしません(baseline-schema と同じ方針)。

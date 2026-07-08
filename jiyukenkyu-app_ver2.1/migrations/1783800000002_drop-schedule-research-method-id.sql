-- Up Migration
-- schedules.research_method_id は設計当初の名残で、現在どこからも使われていない
-- (スケジュールは hypothesis_id 単位で1件だけ管理している)。
-- UNIQUE 制約と外部キーごと列を削除する。DROP COLUMN すると
-- schedules_research_method_id_key(UNIQUE)と
-- schedules_research_method_id_fkey(FK)も自動で一緒に外れる。

ALTER TABLE public.schedules DROP COLUMN IF EXISTS research_method_id;

-- Down Migration
-- 本番データを守るため、あえて何もしません(baseline-schema と同じ方針)。

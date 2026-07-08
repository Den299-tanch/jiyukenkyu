-- Up Migration
-- records / graphs / considerations / reports の hypothesis_id に
-- hypotheses(id) への外部キーを追加する。
-- baseline では research_methods・schedules にだけ FK があり、この4テーブルには
-- 付いていなかった。これまではアプリ側の運用だけで整合をとっていたが、DB側でも保証する。
-- ※ 既存に孤児レコード(参照先のない hypothesis_id)があると失敗するが、
--   データは別途全削除する前提なので問題にならない。

ALTER TABLE public.records
  ADD CONSTRAINT records_hypothesis_id_fkey
  FOREIGN KEY (hypothesis_id) REFERENCES public.hypotheses(id);

ALTER TABLE public.graphs
  ADD CONSTRAINT graphs_hypothesis_id_fkey
  FOREIGN KEY (hypothesis_id) REFERENCES public.hypotheses(id);

ALTER TABLE public.considerations
  ADD CONSTRAINT considerations_hypothesis_id_fkey
  FOREIGN KEY (hypothesis_id) REFERENCES public.hypotheses(id);

ALTER TABLE public.reports
  ADD CONSTRAINT reports_hypothesis_id_fkey
  FOREIGN KEY (hypothesis_id) REFERENCES public.hypotheses(id);

-- Down Migration
-- 本番データを守るため、あえて何もしません(baseline-schema と同じ方針)。

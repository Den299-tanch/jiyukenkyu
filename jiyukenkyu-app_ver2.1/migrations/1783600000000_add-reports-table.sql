-- Up Migration
-- まとめ(レポート)パート用のテーブル。
-- 方針: 個々のカラムに分解せず、まとめ1件をまるごと JSON(report_data)で持つ。
--   ・DBの容量をおさえる(参照ではなくスナップショットを1レコードに集約)
--   ・子どもが作ったまとめの「形」をそのまま保存し、あとで同じ見た目で再現できる
-- 1つの仮説につきまとめは1件。承認するたびに上書き(考察・スケジュールと同じ方針)。

CREATE TABLE IF NOT EXISTS public.reports (
    id serial4 NOT NULL,
    user_id int4 NULL,
    theme_id int4 NULL,
    hypothesis_id int4 NULL,
    report_data jsonb NOT NULL,
    created_at timestamp DEFAULT now() NULL,
    updated_at timestamp DEFAULT now() NULL,
    CONSTRAINT reports_pkey PRIMARY KEY (id),
    CONSTRAINT reports_hypothesis_id_key UNIQUE (hypothesis_id)
);

-- Down Migration
-- 本番データを守るため、あえて何もしません(baseline-schema と同じ方針)。

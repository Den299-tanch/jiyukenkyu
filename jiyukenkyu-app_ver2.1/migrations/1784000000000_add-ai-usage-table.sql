-- Up Migration
-- AIヒント/たたき台の使用回数をサーバー側で記録するためのテーブル。
-- これまでフロントのuseStateだけで数えていたため、画面を戻る・リロードするだけで
-- 回数が復活してしまっていた。ここに記録して上限判定をサーバーで行う。
--
-- kind: どのAI機能か
--   'hypothesis_hint'    … 仮説パートのヒント(context_id = theme_id)
--   'rm_what_to_study'   … 研究方法「何を調べる」のヒント(context_id = hypothesis_id)
--   'rm_tools_materials' … 研究方法「道具・材料」のヒント(context_id = hypothesis_id)
--   'schedule_draft'     … スケジュールのたたき台(context_id = hypothesis_id)

CREATE TABLE IF NOT EXISTS public.ai_usage (
    user_id integer NOT NULL,
    kind text NOT NULL,
    context_id integer NOT NULL,
    used integer DEFAULT 0 NOT NULL,
    updated_at timestamp DEFAULT now() NULL,
    CONSTRAINT ai_usage_pkey PRIMARY KEY (user_id, kind, context_id)
);

-- Down Migration
-- 本番データを守るため、あえて何もしません(baseline-schema と同じ方針)。

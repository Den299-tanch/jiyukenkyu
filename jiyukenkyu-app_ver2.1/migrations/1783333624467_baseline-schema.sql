-- Up Migration
-- 既存の本番DBには既にこれらのテーブルがあるので IF NOT EXISTS にしてあり、
-- 実行しても中身は変化しません(記録として残すためのものです)

CREATE TABLE IF NOT EXISTS public.themes (
    id serial4 NOT NULL,
    user_id varchar(50) NULL,
    category varchar(50) NOT NULL,
    theme text NOT NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
    CONSTRAINT themes_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.hypotheses (
    id serial4 NOT NULL,
    user_id int4 NOT NULL,
    theme_id int4 NULL,
    research_note text NULL,
    hypothesis text NOT NULL,
    hint_count int4 DEFAULT 0 NULL,
    created_at timestamp DEFAULT now() NULL,
    CONSTRAINT hypotheses_pkey PRIMARY KEY (id),
    CONSTRAINT hypotheses_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.themes(id)
);

CREATE TABLE IF NOT EXISTS public.research_methods (
    id serial4 NOT NULL,
    user_id int4 NULL,
    theme_id int4 NULL,
    hypothesis_id int4 NULL,
    method_type text NOT NULL,
    what_to_study text NOT NULL,
    tools_materials text NULL,
    "location" text NULL,
    duration text NULL,
    summary text NULL,
    created_at timestamp DEFAULT now() NULL,
    CONSTRAINT research_methods_pkey PRIMARY KEY (id),
    CONSTRAINT research_methods_hypothesis_id_fkey FOREIGN KEY (hypothesis_id) REFERENCES public.hypotheses(id),
    CONSTRAINT research_methods_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.themes(id)
);

CREATE TABLE IF NOT EXISTS public.schedules (
    id serial4 NOT NULL,
    user_id int4 NULL,
    theme_id int4 NULL,
    hypothesis_id int4 NULL,
    research_method_id int4 NULL,
    end_date text NULL,
    tasks jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp DEFAULT now() NULL,
    updated_at timestamp DEFAULT now() NULL,
    CONSTRAINT schedules_pkey PRIMARY KEY (id),
    CONSTRAINT schedules_hypothesis_id_key UNIQUE (hypothesis_id),
    CONSTRAINT schedules_research_method_id_key UNIQUE (research_method_id),
    CONSTRAINT schedules_hypothesis_id_fkey FOREIGN KEY (hypothesis_id) REFERENCES public.hypotheses(id),
    CONSTRAINT schedules_research_method_id_fkey FOREIGN KEY (research_method_id) REFERENCES public.research_methods(id),
    CONSTRAINT schedules_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.themes(id)
);

CREATE TABLE IF NOT EXISTS public.records (
    id serial4 NOT NULL,
    user_id int4 NULL,
    theme_id int4 NULL,
    hypothesis_id int4 NULL,
    record_type text NOT NULL,
    viewpoints jsonb DEFAULT '[]'::jsonb NULL,
    body text NULL,
    why_note text NULL,
    num1_label text NULL,
    num1_value numeric NULL,
    num1_unit text NULL,
    num2_label text NULL,
    num2_value numeric NULL,
    num2_unit text NULL,
    created_at timestamp DEFAULT now() NULL,
    CONSTRAINT records_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.graphs (
    id serial4 NOT NULL,
    user_id int4 NULL,
    theme_id int4 NULL,
    hypothesis_id int4 NULL,
    graph_data jsonb NOT NULL,
    created_at timestamp DEFAULT now() NULL,
    CONSTRAINT graphs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.considerations (
    id serial4 NOT NULL,
    user_id text NULL,
    theme_id int4 NULL,
    hypothesis_id int4 NULL,
    q1 text NULL,
    q2 text NULL,
    created_at timestamp DEFAULT now() NULL,
    updated_at timestamp DEFAULT now() NULL,
    CONSTRAINT considerations_pkey PRIMARY KEY (id),
    CONSTRAINT considerations_hypothesis_id_key UNIQUE (hypothesis_id)
);

-- Down Migration
-- あえて何もしません。
-- ここでDROP TABLEを書いてしまうと、間違って down を実行したときに
-- 本番の全データ(records・schedulesなど)が消えてしまうためです。

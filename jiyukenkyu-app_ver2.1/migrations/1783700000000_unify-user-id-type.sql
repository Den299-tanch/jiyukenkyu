-- Up Migration
-- user_id の型がテーブルごとにバラバラだった(themes=varchar, considerations=text,
-- それ以外=int4)のを integer に統一する。
-- 画面側では常に 1〜30 の整数として入力されている値なので、そのままキャストできる想定。
-- (万一 数字でない値が紛れていた場合はここで失敗するので、その場合はデータを確認してから
--  再実行すること。)
ALTER TABLE public.themes
  ALTER COLUMN user_id TYPE integer USING NULLIF(user_id, '')::integer;

ALTER TABLE public.considerations
  ALTER COLUMN user_id TYPE integer USING NULLIF(user_id, '')::integer;

-- Down Migration
ALTER TABLE public.themes
  ALTER COLUMN user_id TYPE varchar(50) USING user_id::varchar(50);

ALTER TABLE public.considerations
  ALTER COLUMN user_id TYPE text USING user_id::text;

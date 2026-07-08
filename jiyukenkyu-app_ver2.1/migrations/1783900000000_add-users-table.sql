-- Up Migration
-- 軽量な本人確認(番号+PINでのログイン)のための users テーブル。
-- id は既存の user_id(1〜30、子どもが自分で選ぶ番号)をそのまま主キーとして使う。
-- PINは4桁想定で組み合わせが少ないため、ハッシュ強度よりも実装の単純さを優先し
-- sha256(pin_salt + pin) の1本で統一する(salt は登録のたびランダム生成)。
-- token_hash は「今有効な1本」だけを持つ(セッションテーブルは作らない)。
-- ログインのたびに上書きされ、古いトークンは自動的に無効になる。
-- 有効期限は持たない(シンプルさ優先。必要になれば後で足す)。

CREATE TABLE IF NOT EXISTS public.users (
    id integer NOT NULL,
    pin_hash text NOT NULL,
    pin_salt text NOT NULL,
    token_hash text NULL,
    created_at timestamp DEFAULT now() NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Down Migration
-- 本番データを守るため、あえて何もしません(baseline-schema と同じ方針)。

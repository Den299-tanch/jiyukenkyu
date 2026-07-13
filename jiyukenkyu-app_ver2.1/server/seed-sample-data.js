// 管理者モード(進捗ダッシュボード / AIヒント使用状況 / PINリセット)を
// 実データで試すためのサンプルデータ投入スクリプト。
// 本番DBの196〜200番はテスト専用として空けてもらっている前提(199は既存のため199は使わない)。
//
// 実行: node --env-file=server/.env server/seed-sample-data.js
// 削除: node --env-file=server/.env server/seed-sample-data.js --cleanup
import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const TEST_IDS = [195, 196, 197, 198, 200];
const TEST_PIN = '0000'; // どのテストIDもこのPINでログインできる

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}
function hashPin(pin, salt) {
  return sha256Hex(salt + pin);
}

async function cleanup() {
  console.log('サンプルデータを削除します:', TEST_IDS);
  // 外部キーの都合上、末端テーブルから消す
  await pool.query('DELETE FROM ai_usage WHERE user_id = ANY($1)', [TEST_IDS]);
  await pool.query('DELETE FROM reports WHERE user_id = ANY($1)', [TEST_IDS]);
  await pool.query('DELETE FROM considerations WHERE user_id = ANY($1)', [TEST_IDS]);
  await pool.query('DELETE FROM graphs WHERE user_id = ANY($1)', [TEST_IDS]);
  await pool.query('DELETE FROM records WHERE user_id = ANY($1)', [TEST_IDS]);
  await pool.query('DELETE FROM schedules WHERE user_id = ANY($1)', [TEST_IDS]);
  await pool.query('DELETE FROM research_methods WHERE user_id = ANY($1)', [TEST_IDS]);
  await pool.query('DELETE FROM hypotheses WHERE user_id = ANY($1)', [TEST_IDS]);
  await pool.query('DELETE FROM themes WHERE user_id = ANY($1)', [TEST_IDS]);
  await pool.query('DELETE FROM users WHERE id = ANY($1)', [TEST_IDS]);
  console.log('削除完了');
}

async function ensureUser(id) {
  const salt = crypto.randomBytes(16).toString('hex');
  await pool.query(
    `INSERT INTO users (id, pin_hash, pin_salt) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [id, hashPin(TEST_PIN, salt), salt],
  );
}

// created_at/updated_at をさかのぼらせたいときのための日時ヘルパー
function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function seed() {
  console.log('サンプルデータを投入します:', TEST_IDS, ' PIN =', TEST_PIN);

  for (const id of TEST_IDS) await ensureUser(id);

  // ---- 195番: 登録しただけ(テーマ未着手)----
  // users行があるだけで進捗ダッシュボードには「0番の子」として出る想定

  // ---- 196番: テーマ→仮説まで(そのあと止まっている、10日前で止まった想定)----
  {
    const uid = 196;
    const old = daysAgo(10);
    const theme = await pool.query(
      `INSERT INTO themes (user_id, category, theme, created_at) VALUES ($1,$2,$3,$4) RETURNING id`,
      [uid, 'biology', 'ダンゴムシの好きな場所しらべ', old],
    );
    await pool.query(
      `INSERT INTO hypotheses (user_id, theme_id, research_note, hypothesis, hint_count, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [uid, theme.rows[0].id, 'ダンゴムシは暗いところが好きと本に書いてあった', '暗くてしめった場所に集まるのでは', 2, old],
    );
    await pool.query(
      `INSERT INTO ai_usage (user_id, kind, context_id, used, updated_at) VALUES ($1,'hypothesis_hint',$2,2,$3)`,
      [uid, theme.rows[0].id, old],
    );
  }

  // ---- 197番: 研究方法・スケジュールまで進んだ ----
  {
    const uid = 197;
    const theme = await pool.query(
      `INSERT INTO themes (user_id, category, theme) VALUES ($1,'physics','アイスのとけかたくらべ') RETURNING id`,
      [uid],
    );
    const hyp = await pool.query(
      `INSERT INTO hypotheses (user_id, theme_id, research_note, hypothesis, hint_count)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [uid, theme.rows[0].id, '保冷剤の数でとける速さが変わるかも', '保冷剤が多いほうがとけにくいのでは', 4],
    );
    const hid = hyp.rows[0].id;
    await pool.query(
      `INSERT INTO research_methods (user_id, hypothesis_id, method_type, what_to_study, tools_materials, location, duration, summary)
       VALUES ($1,$2,'compare','保冷剤を2こと5こでアイスのとけかたをくらべる','保冷剤、アイス、タイマー、コップ','台所','30分','保冷剤の数でとけかたを比べる'),
              ($1,$2,'compare','日なたと日かげでもくらべる','温度計','ベランダ','30分','置く場所でもくらべる')`,
      [uid, hid],
    );
    await pool.query(
      `INSERT INTO schedules (user_id, hypothesis_id, end_date, tasks)
       VALUES ($1,$2,'2026-08-20',$3)`,
      [uid, hid, JSON.stringify([
        { id: 't1', date: '8/1(土)', task: '道具をそろえる', type: 'junbi', done: true },
        { id: 't2', date: '8/3(月)', task: '実験する', type: 'jikken', done: false },
      ])],
    );
    await pool.query(
      `INSERT INTO ai_usage (user_id, kind, context_id, used) VALUES
        ($1,'hypothesis_hint',$2,4),
        ($1,'rm_what_to_study',$3,4),
        ($1,'rm_tools_materials',$3,3),
        ($1,'schedule_draft',$3,4)`,
      [uid, theme.rows[0].id, hid],
    );
  }

  // ---- 198番: 記録・グラフ・考察まで進んだ(先生の追加付与ありのサンプル)----
  {
    const uid = 198;
    const theme = await pool.query(
      `INSERT INTO themes (user_id, category, theme) VALUES ($1,'nature','あさがおの成長にっき') RETURNING id`,
      [uid],
    );
    const hyp = await pool.query(
      `INSERT INTO hypotheses (user_id, theme_id, research_note, hypothesis, hint_count)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [uid, theme.rows[0].id, '毎日水をあげると早く育つと聞いた', '水の量が多いほど早く育つのでは', 4],
    );
    const hid = hyp.rows[0].id;
    await pool.query(
      `INSERT INTO research_methods (user_id, hypothesis_id, method_type, what_to_study, tools_materials, location, duration, summary)
       VALUES ($1,$2,'observe','あさがおの背の高さを毎日はかる','ものさし、水やり用のカップ','庭','1日5分','毎日の成長を記録する')`,
      [uid, hid],
    );
    await pool.query(
      `INSERT INTO schedules (user_id, hypothesis_id, end_date, tasks)
       VALUES ($1,$2,'2026-08-25',$3)`,
      [uid, hid, JSON.stringify([
        { id: 't1', date: '7/20(月)', task: 'たねをまく', type: 'junbi', done: true },
        { id: 't2', date: '7/25(土)', task: '背の高さをはかる', type: 'kansatsu', done: true },
      ])],
    );
    await pool.query(
      `INSERT INTO records (user_id, hypothesis_id, record_type, viewpoints, body, why_note, num1_label, num1_value, num1_unit, observed_at)
       VALUES
       ($1,$2,'kiroku','["ookisa"]','葉っぱが2まい出た','日光がよく当たる場所だから','背の高さ',5,'cm','2026-07-20'),
       ($1,$2,'kiroku','["ookisa"]','つるが伸びてきた',null,'背の高さ',12,'cm','2026-07-25'),
       ($1,$2,'kiroku','["ookisa"]','花が咲きそう',null,'背の高さ',28,'cm','2026-07-30')`,
      [uid, hid],
    );
    await pool.query(
      `INSERT INTO graphs (user_id, hypothesis_id, graph_data) VALUES ($1,$2,$3)`,
      [uid, hid, JSON.stringify({
        title: '背の高さの変化', graphType: 'line',
        numbers: [
          { label: '背の高さ', value: 5, unit: 'cm', date: '7/20' },
          { label: '背の高さ', value: 12, unit: 'cm', date: '7/25' },
          { label: '背の高さ', value: 28, unit: 'cm', date: '7/30' },
        ],
      })],
    );
    await pool.query(
      `INSERT INTO considerations (user_id, hypothesis_id, q1, q2)
       VALUES ($1,$2,'思っていたよりも早く大きくなったこと','予想どおり、水をあげた日はよく育っていた')`,
      [uid, hid],
    );
    // 上限を使い切ったうえで、先生が+1回付与した状態を再現
    await pool.query(
      `INSERT INTO ai_usage (user_id, kind, context_id, used, bonus) VALUES
        ($1,'hypothesis_hint',$2,4,0),
        ($1,'rm_what_to_study',$3,4,1)`,
      [uid, theme.rows[0].id, hid],
    );
  }

  // ---- 200番: まとめ(レポート)まで完了 ----
  {
    const uid = 200;
    const theme = await pool.query(
      `INSERT INTO themes (user_id, category, theme) VALUES ($1,'chemistry','10円玉をピカピカにする実験') RETURNING id`,
      [uid],
    );
    const hyp = await pool.query(
      `INSERT INTO hypotheses (user_id, theme_id, research_note, hypothesis, hint_count)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [uid, theme.rows[0].id, '酢や塩で10円玉がきれいになると聞いた', '酸性の液体につけると汚れが落ちるのでは', 3],
    );
    const hid = hyp.rows[0].id;
    await pool.query(
      `INSERT INTO research_methods (user_id, hypothesis_id, method_type, what_to_study, tools_materials, location, duration, summary)
       VALUES ($1,$2,'compare','酢・しょうゆ・水につけてくらべる','10円玉6まい、酢、しょうゆ、コップ','台所','1時間','液体ごとのきれいさをくらべる')`,
      [uid, hid],
    );
    await pool.query(
      `INSERT INTO schedules (user_id, hypothesis_id, end_date, tasks)
       VALUES ($1,$2,'2026-08-10',$3)`,
      [uid, hid, JSON.stringify([
        { id: 't1', date: '7/15(水)', task: '実験する', type: 'jikken', done: true },
        { id: 't2', date: '7/16(木)', task: 'まとめを書く', type: 'matome', done: true },
      ])],
    );
    await pool.query(
      `INSERT INTO records (user_id, hypothesis_id, record_type, viewpoints, body, why_note, num1_label, num1_value, num1_unit, num2_label, num2_value, num2_unit, observed_at)
       VALUES
       ($1,$2,'kiroku','["kirei"]','酢につけたのが一番ピカピカになった',null,'つけた時間',10,'分','きれいさ',8,'てん','2026-07-15'),
       ($1,$2,'kiroku','["kirei"]','しょうゆはあまり変わらなかった',null,'つけた時間',10,'分','きれいさ',2,'てん','2026-07-15')`,
      [uid, hid],
    );
    await pool.query(
      `INSERT INTO graphs (user_id, hypothesis_id, graph_data) VALUES ($1,$2,$3)`,
      [uid, hid, JSON.stringify({
        title: '液体ごとのきれいさ', graphType: 'bar',
        numbers: [
          { label: 'きれいさ(酢)', value: 8, unit: 'てん' },
          { label: 'きれいさ(しょうゆ)', value: 2, unit: 'てん' },
        ],
      })],
    );
    await pool.query(
      `INSERT INTO considerations (user_id, hypothesis_id, q1, q2)
       VALUES ($1,$2,'酸性の液体だと汚れが落ちやすいとわかったこと','予想どおり、酢が一番きれいになった')`,
      [uid, hid],
    );
    await pool.query(
      `INSERT INTO reports (user_id, hypothesis_id, report_data)
       VALUES ($1,$2,$3)`,
      [uid, hid, JSON.stringify({
        userNumber: uid,
        theme: '10円玉をピカピカにする実験',
        hypothesis: '酸性の液体につけると汚れが落ちるのでは',
      })],
    );
    await pool.query(
      `INSERT INTO ai_usage (user_id, kind, context_id, used) VALUES
        ($1,'hypothesis_hint',$2,3),
        ($1,'rm_what_to_study',$3,2),
        ($1,'schedule_draft',$3,1)`,
      [uid, theme.rows[0].id, hid],
    );
  }

  console.log('投入完了。ログインは番号 195/196/197/198/200 + あんしょう番号', TEST_PIN);
}

const isCleanup = process.argv.includes('--cleanup');
(isCleanup ? cleanup() : seed())
  .then(() => pool.end())
  .catch((err) => {
    console.error('エラー:', err);
    pool.end();
    process.exit(1);
  });

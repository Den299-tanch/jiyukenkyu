// 管理者モード(進捗ダッシュボード / AIヒント使用状況 / PINリセット)と、
// 子ども側の記録・グラフ・まとめの「見本」を、実データで用意するためのシード。
//
// 重要: グラフの graph_data とまとめの report_data は、フロントが実際に保存するのと
// 同じ形で作る必要がある(GraphView/ReportView は entries / xAxisLabel を読む)。
// そのため collectNumberEntries と buildReportData のロジックを、src/data の実装と
// そろえてこのファイル内に再掲している(Nodeは src の拡張子なしimportを解決できないため)。
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

const TEST_IDS = [195, 196, 197, 198, 200]; // 199は既存の本物ユーザーなので触らない
const TEST_PIN = '0000';

// ===== src/data と揃えた純粋ヘルパー(記録→数字→グラフ用エントリ→まとめJSON) =====
function getRecordNumbers(record) {
  const out = [];
  for (const n of [1, 2]) {
    const label = record[`num${n}_label`];
    const rawValue = record[`num${n}_value`];
    const unit = record[`num${n}_unit`];
    const hasValue = rawValue !== null && rawValue !== undefined && rawValue !== '';
    const hasLabel = !!(label && String(label).trim());
    if (hasLabel || hasValue) {
      out.push({ label: label ?? '', value: hasValue ? Number(rawValue) : null, unit: unit ?? '' });
    }
  }
  return out;
}

function collectNumberEntries(records) {
  const entries = [];
  records.forEach((r) => {
    getRecordNumbers(r).forEach((n, slot) => {
      if (n.value === null) return;
      entries.push({
        key: `${r.id}-${slot}`,
        recordId: r.id,
        label: n.label || '数字',
        value: n.value,
        unit: n.unit || '',
        date: r.observed_at,
      });
    });
  });
  return entries;
}

// src/data/buildReport.js と同じ組み立て(まとめ1件ぶんのJSON)
function buildReportData({
  userNumber, theme, category, hypothesis, schedule,
  records = [], graphs = [], reflection = {}, summaryDid = '', summaryTell = '', otherResearch = [],
}) {
  const sortedRecords = records.slice().sort((a, b) => new Date(a.observed_at) - new Date(b.observed_at));
  return {
    version: 2,
    userNumber: userNumber ?? null,
    theme: theme ?? '',
    category: category ?? null,
    hypothesis: hypothesis ?? '',
    otherResearch: otherResearch.map((o) => ({ theme: o.theme ?? '', hypothesis: o.hypothesis ?? '' })),
    period: { start: sortedRecords[0]?.observed_at ?? null, end: schedule?.endDate ?? null },
    schedule: Array.isArray(schedule?.tasks) ? schedule.tasks : [],
    summaryDid,
    summaryTell,
    records: sortedRecords.map((r) => ({
      id: r.id,
      record_type: r.record_type,
      observed_at: r.observed_at,
      body: r.body ?? '',
      why_note: r.why_note ?? '',
      viewpoints: r.viewpoints ?? [],
      numbers: getRecordNumbers(r).map((n) => ({ label: n.label, value: n.value, unit: n.unit })),
    })),
    graphs: graphs.map((g) => {
      const gd = g.graph_data ?? g;
      return { graphType: gd.graphType, title: gd.title ?? '', entries: gd.entries ?? [], xAxisLabel: gd.xAxisLabel ?? null };
    }),
    reflection: { q1: reflection.q1 ?? '', q2: reflection.q2 ?? '' },
    createdAt: new Date().toISOString(),
  };
}

// ===== DB操作ヘルパー =====
function sha256Hex(input) { return crypto.createHash('sha256').update(input).digest('hex'); }
function hashPin(pin, salt) { return sha256Hex(salt + pin); }
function daysAgo(n) { return new Date(Date.now() - n * 24 * 60 * 60 * 1000); }

async function ensureUser(id, createdAt = null) {
  const salt = crypto.randomBytes(16).toString('hex');
  await pool.query(
    `INSERT INTO users (id, pin_hash, pin_salt, created_at)
     VALUES ($1, $2, $3, COALESCE($4, now())) ON CONFLICT (id) DO NOTHING`,
    [id, hashPin(TEST_PIN, salt), salt, createdAt],
  );
}

async function insertTheme(uid, category, theme, createdAt = null) {
  const r = await pool.query(
    `INSERT INTO themes (user_id, category, theme, created_at) VALUES ($1,$2,$3,COALESCE($4,now())) RETURNING id`,
    [uid, category, theme, createdAt],
  );
  return r.rows[0].id;
}

async function insertHypothesis(uid, themeId, note, hyp, hintCount = 0, createdAt = null) {
  const r = await pool.query(
    `INSERT INTO hypotheses (user_id, theme_id, research_note, hypothesis, hint_count, created_at)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,now())) RETURNING id`,
    [uid, themeId, note, hyp, hintCount, createdAt],
  );
  return r.rows[0].id;
}

async function insertRecord(uid, hid, rec) {
  const r = await pool.query(
    `INSERT INTO records
      (user_id, hypothesis_id, record_type, viewpoints, body, why_note,
       num1_label, num1_value, num1_unit, num2_label, num2_value, num2_unit, observed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [uid, hid, rec.record_type, JSON.stringify(rec.viewpoints ?? []), rec.body ?? null, rec.why_note ?? null,
     rec.num1_label ?? null, rec.num1_value ?? null, rec.num1_unit ?? null,
     rec.num2_label ?? null, rec.num2_value ?? null, rec.num2_unit ?? null, rec.observed_at],
  );
  return r.rows[0];
}

async function insertGraph(uid, hid, graphData) {
  await pool.query(`INSERT INTO graphs (user_id, hypothesis_id, graph_data) VALUES ($1,$2,$3)`,
    [uid, hid, JSON.stringify(graphData)]);
}

async function insertSchedule(uid, hid, endDate, tasks) {
  await pool.query(
    `INSERT INTO schedules (user_id, hypothesis_id, end_date, tasks) VALUES ($1,$2,$3,$4)
     ON CONFLICT (hypothesis_id) DO UPDATE SET end_date=EXCLUDED.end_date, tasks=EXCLUDED.tasks`,
    [uid, hid, endDate, JSON.stringify(tasks)]);
}

async function insertResearchMethod(uid, hid, m) {
  await pool.query(
    `INSERT INTO research_methods (user_id, hypothesis_id, method_type, what_to_study, tools_materials, location, duration, summary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [uid, hid, m.method_type, m.what_to_study, m.tools_materials ?? null, m.location ?? null, m.duration ?? null, m.summary ?? null]);
}

async function insertConsideration(uid, hid, q1, q2) {
  await pool.query(
    `INSERT INTO considerations (user_id, hypothesis_id, q1, q2) VALUES ($1,$2,$3,$4)
     ON CONFLICT (hypothesis_id) DO UPDATE SET q1=EXCLUDED.q1, q2=EXCLUDED.q2`,
    [uid, hid, q1, q2]);
}

async function insertReport(uid, hid, reportData) {
  await pool.query(
    `INSERT INTO reports (user_id, hypothesis_id, report_data) VALUES ($1,$2,$3)
     ON CONFLICT (hypothesis_id) DO UPDATE SET report_data=EXCLUDED.report_data`,
    [uid, hid, JSON.stringify(reportData)]);
}

async function insertAiUsage(uid, kind, ctxId, used, bonus = 0) {
  await pool.query(
    `INSERT INTO ai_usage (user_id, kind, context_id, used, bonus) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, kind, context_id) DO UPDATE SET used=EXCLUDED.used, bonus=EXCLUDED.bonus`,
    [uid, kind, ctxId, used, bonus]);
}

// ===== 削除 =====
async function cleanup() {
  console.log('サンプルデータを削除します:', TEST_IDS);
  for (const table of ['ai_usage', 'reports', 'considerations', 'graphs', 'records', 'schedules', 'research_methods', 'hypotheses', 'themes', 'users']) {
    const col = table === 'users' ? 'id' : 'user_id';
    await pool.query(`DELETE FROM ${table} WHERE ${col} = ANY($1)`, [TEST_IDS]);
  }
  console.log('削除完了');
}

// ===== 投入 =====
async function seed() {
  console.log('サンプルデータを投入します:', TEST_IDS, ' PIN =', TEST_PIN);
  await cleanup(); // 何度でも流し直せるよう、先に消してから入れる

  // 195番: 登録しただけ(全ステップ0の子。ダッシュボードで「登録のみ」を表す)
  await ensureUser(195);

  // 196番: テーマ→仮説で止まっている(10日前に止まった → 😴 マーク)
  {
    const uid = 196; const old = daysAgo(10);
    await ensureUser(uid, old);
    const themeId = await insertTheme(uid, 'biology', 'ダンゴムシの好きな場所しらべ', old);
    await insertHypothesis(uid, themeId, 'ダンゴムシは暗いところが好きと本に書いてあった', '暗くてしめった場所に集まるのでは', 2, old);
    await insertAiUsage(uid, 'hypothesis_hint', themeId, 2);
  }

  // 197番: 研究方法・スケジュールまで進んだ(記録はこれから)
  {
    const uid = 197;
    await ensureUser(uid);
    const themeId = await insertTheme(uid, 'physics', 'アイスのとけかたくらべ');
    const hid = await insertHypothesis(uid, themeId, '保冷剤の数でとける速さが変わるかも', '保冷剤が多いほうがとけにくいのでは', 4);
    await insertResearchMethod(uid, hid, { method_type: 'compare', what_to_study: '保冷剤を2こと5こでアイスのとけかたをくらべる', tools_materials: '保冷剤、アイス、タイマー、コップ', location: '台所', duration: '30分', summary: '保冷剤の数でとけかたを比べる' });
    await insertResearchMethod(uid, hid, { method_type: 'compare', what_to_study: '日なたと日かげでもくらべる', tools_materials: '温度計', location: 'ベランダ', duration: '30分', summary: '置く場所でもくらべる' });
    await insertSchedule(uid, hid, '2026-08-20', [
      { id: 't1', date: '8/1(土)', task: '道具をそろえる', type: 'junbi', done: true },
      { id: 't2', date: '8/3(月)', task: '実験する', type: 'jikken', done: false },
    ]);
    await insertAiUsage(uid, 'hypothesis_hint', themeId, 4);
    await insertAiUsage(uid, 'rm_what_to_study', hid, 4);
    await insertAiUsage(uid, 'rm_tools_materials', hid, 3);
    await insertAiUsage(uid, 'schedule_draft', hid, 4);
  }

  // 198番: 記録・グラフ・考察まで(まとめは未着手)。先生の+1回付与あり。
  {
    const uid = 198;
    await ensureUser(uid);
    const themeId = await insertTheme(uid, 'nature', 'あさがおの成長にっき');
    const hid = await insertHypothesis(uid, themeId, '毎日水をあげると早く育つと聞いた', '日がたつほど背が高くなっていくのでは', 4);
    await insertResearchMethod(uid, hid, { method_type: 'observe', what_to_study: 'あさがおの背の高さを毎日はかる', tools_materials: 'ものさし、水やり用のカップ', location: '庭', duration: '1日5分', summary: '毎日の成長を記録する' });
    await insertSchedule(uid, hid, '2026-08-25', [
      { id: 't1', date: '7/20(月)', task: 'たねをまく', type: 'junbi', done: true },
      { id: 't2', date: '7/25(土)', task: '背の高さをはかる', type: 'kansatsu', done: true },
    ]);
    const recs = [];
    recs.push(await insertRecord(uid, hid, { record_type: 'kiroku', viewpoints: ['ookisa'], body: '葉っぱが2まい出た。まだ小さい。', why_note: '日光がよく当たる場所だから', num1_label: '背の高さ', num1_value: 5, num1_unit: 'cm', observed_at: '2026-07-20' }));
    recs.push(await insertRecord(uid, hid, { record_type: 'kiroku', viewpoints: ['ookisa'], body: 'つるが伸びてきた。まきついている。', why_note: '水をあげ続けているからかな', num1_label: '背の高さ', num1_value: 12, num1_unit: 'cm', observed_at: '2026-07-25' }));
    recs.push(await insertRecord(uid, hid, { record_type: 'kiroku', viewpoints: ['ookisa'], body: 'つぼみができた。花が咲きそう。', why_note: null, num1_label: '背の高さ', num1_value: 28, num1_unit: 'cm', observed_at: '2026-07-30' }));
    // 折れ線グラフ(1ラベル「背の高さ」を日づけ順に)
    await insertGraph(uid, hid, { title: '背の高さのへんか', graphType: 'line', entries: collectNumberEntries(recs), xAxis: { kind: 'date' }, yLabel: '背の高さ', xAxisLabel: null });
    await insertConsideration(uid, hid, '日がたつほど、あさがおの背が高くなっていったこと。とくに5日で2倍以上のびてびっくりした。', '予想どおり、毎日せわをしたらぐんぐん育った。花のいろも記録すればよかった。');
    await insertAiUsage(uid, 'hypothesis_hint', themeId, 4, 0);
    await insertAiUsage(uid, 'rm_what_to_study', hid, 4, 1); // 使い切ったあと先生が+1回
  }

  // 200番: 完走見本。テーマ→仮説→方法→スケジュール→記録→関係グラフ→考察→まとめ。
  {
    const uid = 200;
    await ensureUser(uid);
    // 本命テーマ
    const themeId = await insertTheme(uid, 'chemistry', '10円玉をピカピカにする実験');
    const hid = await insertHypothesis(uid, themeId, '酢や塩で10円玉がきれいになると聞いた。酢は酸っぱい=酸性らしい。', '酢につける時間が長いほど、10円玉はピカピカになるのでは', 3);
    // もう1つ考えたテーマ(深くは進めなかった → まとめの「ほかに考えたテーマ」に出る)
    const otherThemeId = await insertTheme(uid, 'physics', '氷を早くとかす方法しらべ');
    await insertHypothesis(uid, otherThemeId, 'しおをまくと道路の氷がとけるとニュースで見た', 'しおを入れると氷が早くとけるのでは');

    await insertResearchMethod(uid, hid, { method_type: 'compare', what_to_study: '10円玉を酢につける時間をかえて、きれいさを点数でくらべる', tools_materials: '10円玉4まい、酢、コップ、タイマー、キッチンペーパー', location: '台所', duration: '30分', summary: 'つける時間ごとのきれいさを点数でくらべる' });
    await insertSchedule(uid, hid, '2026-08-10', [
      { id: 't1', date: '7/14(月)', task: '道具をそろえる', type: 'junbi', done: true },
      { id: 't2', date: '7/15(火)', task: '5分・10分・20分・30分で実験する', type: 'jikken', done: true },
      { id: 't3', date: '7/16(水)', task: 'グラフとまとめを作る', type: 'matome', done: true },
    ]);
    // 記録: つける時間(分)×きれいさ(てん)を同じ記録に2つずつ入れる → 関係グラフになる
    const recs = [];
    recs.push(await insertRecord(uid, hid, { record_type: 'kiroku', viewpoints: ['iro'], body: '5分では、少しだけ色が明るくなった。まだくすんでいる。', why_note: '酸がまだ少ししか汚れをとかしていないのかも', num1_label: 'つけた時間', num1_value: 5, num1_unit: '分', num2_label: 'きれいさ', num2_value: 3, num2_unit: 'てん', observed_at: '2026-07-15' }));
    recs.push(await insertRecord(uid, hid, { record_type: 'kiroku', viewpoints: ['iro'], body: '10分で半分くらいピカピカになってきた。', why_note: 'だんだん汚れがとけてきた感じ', num1_label: 'つけた時間', num1_value: 10, num1_unit: '分', num2_label: 'きれいさ', num2_value: 5, num2_unit: 'てん', observed_at: '2026-07-15' }));
    recs.push(await insertRecord(uid, hid, { record_type: 'kiroku', viewpoints: ['iro'], body: '20分でかなりきれいになった。ふちの汚れもとれた。', why_note: '酸が汚れをしっかり落としている', num1_label: 'つけた時間', num1_value: 20, num1_unit: '分', num2_label: 'きれいさ', num2_value: 8, num2_unit: 'てん', observed_at: '2026-07-15' }));
    recs.push(await insertRecord(uid, hid, { record_type: 'kiroku', viewpoints: ['iro'], body: '30分でピカピカ！新品みたいになった。でも20分とあまり変わらないかも。', why_note: 'これ以上つけても、あまり変わらなさそう', num1_label: 'つけた時間', num1_value: 30, num1_unit: '分', num2_label: 'きれいさ', num2_value: 9, num2_unit: 'てん', observed_at: '2026-07-15' }));
    // しらべたこと(本で酸性を確認)も1件入れて記録の種類の見本にする
    recs.push(await insertRecord(uid, hid, { record_type: 'shirabe', viewpoints: ['hon'], body: '図書館の本で、酢には「酢酸」という酸が入っていて、金属の汚れ(酸化した部分)を溶かすと書いてあった。', why_note: '予想どおり、酸性が関係していそう', observed_at: '2026-07-16' }));

    // 関係グラフ(折れ線): ヨコ軸=つけた時間 / タテ軸=きれいさ。xAxisLabelを入れることでレポートでも正しく描かれる。
    const graphData = { title: 'つけた時間 と きれいさ のグラフ', graphType: 'line', entries: collectNumberEntries(recs), xAxis: { kind: 'label', label: 'つけた時間' }, yLabel: 'きれいさ', xAxisLabel: 'つけた時間' };
    await insertGraph(uid, hid, graphData);

    await insertConsideration(uid, hid, '酢につける時間が長いほど、10円玉がピカピカになることがわかった。ただし、20分をすぎると点数のふえ方が小さくなった。', 'さいしょは「時間が2倍なら汚れも2倍おちる」と思っていたけど、20分をこえると変化が小さくなってびっくりした。酸のはたらきには限界があるのかもしれない。');

    // まとめ(実アプリの buildReportData と同じ形で作る)
    const reportData = buildReportData({
      userNumber: uid,
      theme: '10円玉をピカピカにする実験',
      category: 'chemistry',
      hypothesis: '酢につける時間が長いほど、10円玉はピカピカになるのでは',
      schedule: { endDate: '2026-08-10', tasks: [
        { id: 't1', date: '7/14(月)', task: '道具をそろえる', type: 'junbi', done: true },
        { id: 't2', date: '7/15(火)', task: '5分・10分・20分・30分で実験する', type: 'jikken', done: true },
        { id: 't3', date: '7/16(水)', task: 'グラフとまとめを作る', type: 'matome', done: true },
      ] },
      records: recs,
      graphs: [{ graph_data: graphData }],
      reflection: { q1: '酢につける時間が長いほど、10円玉がピカピカになることがわかった。ただし、20分をすぎると点数のふえ方が小さくなった。', q2: 'さいしょは「時間が2倍なら汚れも2倍おちる」と思っていたけど、20分をこえると変化が小さくなってびっくりした。酸のはたらきには限界があるのかもしれない。' },
      summaryDid: '10円玉を酢に5分・10分・20分・30分つけて、きれいさを10点まんてんで点数をつけてくらべた。図書館の本でも、酢の酸が金属の汚れをとかすことをしらべた。',
      summaryTell: '酢につける時間が長いほどピカピカになるけれど、20分をすぎるとあまり変わらないのが一番の発見。「長くつければつけるほどいい」わけではなく、酸のはたらきには限界があるみたいだと気づいた。',
      otherResearch: [{ theme: '氷を早くとかす方法しらべ', hypothesis: 'しおを入れると氷が早くとけるのでは' }],
    });
    await insertReport(uid, hid, reportData);

    await insertAiUsage(uid, 'hypothesis_hint', themeId, 3);
    await insertAiUsage(uid, 'rm_what_to_study', hid, 2);
    await insertAiUsage(uid, 'schedule_draft', hid, 1);
  }

  console.log('投入完了。ログインは番号 195/196/197/198/200 + あんしょう番号', TEST_PIN);
  console.log('完走見本は 200番(記録5件・関係グラフ・考察・まとめPDFまで)');
}

const isCleanup = process.argv.includes('--cleanup');
(isCleanup ? cleanup() : seed())
  .then(() => pool.end())
  .catch((err) => { console.error('エラー:', err); pool.end(); process.exit(1); });

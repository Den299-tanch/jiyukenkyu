// 層1(機械・常時・無料): 単位不一致・件数不足・不正値をチェックする。
// AIは使わない軽い処理。完璧でなくてよい(見のがしは層1.5と本人の気づきでカバー)。
// 「くらべる系」の1変数グラフでは単位がそろっているのが望ましい。
const SINGLE_VAR_TYPES = ["bar", "line", "histogram", "pie", "band"];

// isRelationship: 棒・折れ線で2つの数字の「関係」を見ているとき(ヨコ軸に数字を選んだとき)。
// このときは単位がちがって当然なので、単位不一致チェックの対象からはずす。
export function layer1Checks(entries, type, { isRelationship = false } = {}) {
  const warnings = [];
  if (!entries || entries.length === 0) return warnings;

  const values = entries.map((e) => e.value);

  // 件数不足
  if (entries.length < 2) {
    warnings.push(
      "数字が1つしかないよ。もう1回はかって2つ以上にすると、くらべるグラフになるよ。",
    );
  }

  // 不正値(数字でないものが混ざっている)
  if (values.some((v) => !Number.isFinite(v))) {
    warnings.push(
      "数字じゃないデータが混じっているみたい。数字を見なおしてみてね。",
    );
  }

  // ラベル混在・単位不一致(1変数のくらべる系グラフのときだけ。関係グラフでは対象外)
  if (SINGLE_VAR_TYPES.includes(type) && !isRelationship) {
    // ちがう種類の数字(ラベル)が混ざっていないか。単位の有無に関わらずチェックする
    // (単位を書いていない数字どうしだと、単位チェックだけではすり抜けてしまうため)。
    const labels = [
      ...new Set(entries.map((e) => (e.label || "").trim()).filter((l) => l !== "")),
    ];
    if (labels.length >= 2) {
      warnings.push(
        `ちがう種類の数字(${labels.join(" と ")})が混ざっているよ。同じ種類の数字だけをくらべると分かりやすいよ。`,
      );
    } else {
      // ラベルが同じでも、単位の書き方だけがバラバラなケースを拾う
      const units = [
        ...new Set(
          entries.map((e) => (e.unit || "").trim()).filter((u) => u !== ""),
        ),
      ];
      if (units.length >= 2) {
        warnings.push(
          `たんいがちがうもの(${units.join(" と ")})が混ざっているよ。同じたんいのものをくらべると分かりやすいよ。`,
        );
      }
    }
  }

  return warnings;
}

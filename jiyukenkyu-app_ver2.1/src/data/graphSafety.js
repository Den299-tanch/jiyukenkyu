// 層1(機械・常時・無料): 単位不一致・件数不足・不正値をチェックする。
// AIは使わない軽い処理。完璧でなくてよい(見のがしは層1.5と本人の気づきでカバー)。
// 「くらべる系」の1変数グラフでは単位がそろっているのが望ましい。
const SINGLE_VAR_TYPES = ["bar", "line", "histogram", "pie", "band"];

export function layer1Checks(entries, type) {
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

  // 単位不一致(1変数のくらべる系グラフのときだけ)
  if (SINGLE_VAR_TYPES.includes(type)) {
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

  return warnings;
}

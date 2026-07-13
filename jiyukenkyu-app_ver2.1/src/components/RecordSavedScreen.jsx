import Ruby from "./Ruby";

// 記録を保存した直後に出る画面。
// 数字を入れた記録なら「○○は今N件め」「グラフにできるよ」と後押しし、
// そうでなければ種類ごとの一般的な後押しを出す。
export default function RecordSavedScreen({
  record,
  measuredLabel,
  sameLabelCount,
  graphReady,
  onBackToList,
}) {
  const isKiroku = record?.record_type === "kiroku";
  const hasNumber = !!measuredLabel;

  return (
    <div className="record-screen">
      <div className="record-content rec-saved-wrap">
        <div className="rec-saved-emoji">🎉</div>
        <p className="rec-saved-title">
          {isKiroku ? "きろくを ほぞんしたよ!" : "しらべたことを ほぞんしたよ!"}
        </p>

        {hasNumber ? (
          <>
            <div className="rec-toast rec-toast-teal">
              <b>🔁 <Ruby>{"もう1回[かい]はかると、もっとよくなるよ"}</Ruby></b>
              <span>
                同じことを3回くらいはかって平均を出すと、もっとたしかな結果になるよ。
                「{measuredLabel}」は今 {sameLabelCount}けんめ!
              </span>
            </div>
            {graphReady && (
              <div className="rec-toast rec-toast-yellow">
                <b>📊 グラフにできるようになったよ</b>
                <span>
                  「{measuredLabel}」が{sameLabelCount}けん そろったから、
                  くらべるグラフが作れるよ。
                </span>
              </div>
            )}
          </>
        ) : isKiroku ? (
          <div className="rec-toast rec-toast-teal">
            <b>🔁 <Ruby>{"もう1回[かい]やると、もっとよくなるよ"}</Ruby></b>
            <span>
              同じことを3回くらいはかって平均を出すと、もっとたしかな結果になるよ。
            </span>
          </div>
        ) : (
          <div className="rec-toast rec-toast-purple">
            <b>🔍 <Ruby>{"いろんな出[で]どころで調[しら]べてみよう"}</Ruby></b>
            <span>
              本・インターネット・人に聞く…ちがう方法でも調べると、考えがはっきりするよ。
            </span>
          </div>
        )}

        <button className="next-btn rec-save-btn" onClick={onBackToList}>
          いちらんに もどる
        </button>
      </div>
    </div>
  );
}

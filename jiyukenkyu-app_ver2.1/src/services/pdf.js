// レポートDOMをその場でPDFにして端末にダウンロードする共通処理。
// html2pdf.js(html2canvas + jsPDF)を動的 import して、初回に必要なときだけ読み込む。
export async function downloadElementAsPdf(el, filename = "まとめ.pdf") {
  if (!el) throw new Error("PDFにする対象が見つかりません");

  const { default: html2pdf } = await import("html2pdf.js");

  const opt = {
    margin: [8, 8, 8, 8],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      // recharts の SVG も含めて素直に描けるよう、スクロール補正を無効化
      scrollX: 0,
      scrollY: 0,
      windowWidth: el.scrollWidth,
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    // CSSのpage-break指定だけに従う。avoid-allを足すと「大きな塊(セクション全体)を
    // 割らない」ように働いてしまい、セクションがページに収まらないたびに丸ごと
    // 次ページへ送られて手前のページが大きく空白になる(枚数もかさむ)。
    // 割ってはいけない単位はCSS側で個々のカード単位に指定する(summary.css参照)。
    pagebreak: { mode: ["css"] },
  };

  await html2pdf().set(opt).from(el).save();
}

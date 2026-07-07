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
    // セクションの途中でページが割れないように
    pagebreak: { mode: ["css", "avoid-all"] },
  };

  await html2pdf().set(opt).from(el).save();
}

import { createContext, useContext } from 'react';

// 「今の研究」(テーマ・仮説・研究方法)を1箇所にまとめて持つためのContext。
// 以前は selectedTheme / scheduleContext.hypothesis という2つの別々のstateに
// 分かれていて、片方だけ更新し忘れると状態がズレる恐れがあった。
// 「仮説1件＝1つの研究の軸」の理念どおり、1つの軸の情報はここに集約する。
// state自体はApp.jsx(sessionStorage同期・DB復元の起点)が持ち、ここはただの窓口。
const ResearchContext = createContext(null);

export function ResearchProvider({ value, children }) {
  return (
    <ResearchContext.Provider value={value}>{children}</ResearchContext.Provider>
  );
}

// research: { theme, hypothesis, researchMethods } | null
// eslint-disable-next-line react-refresh/only-export-components
export function useResearch() {
  const ctx = useContext(ResearchContext);
  if (!ctx) throw new Error('useResearch must be used within ResearchProvider');
  return ctx;
}

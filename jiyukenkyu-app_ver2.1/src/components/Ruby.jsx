// 文字列中の「漢字[かんじ]」という書き方をルビ付き表示に変換する。
// 例: <Ruby>{"自由研究[じゆうけんきゅう]をはじめよう"}</Ruby>
//   → 自由研究 の上に「じゆうけんきゅう」とルビが付き、それ以外はそのまま表示される。
const RUBY_PATTERN = /([一-龥々〆〤ヶ]+)\[([^[\]]+)\]/g;

// alt属性など、ルビ表示できない場所向けに「漢字[かんじ]」の見出し記法を素のテキストへ戻す
export function stripRuby(text) {
  if (typeof text !== "string") return text;
  return text.replace(RUBY_PATTERN, "$1");
}

export default function Ruby({ children }) {
  if (typeof children !== "string") return children;

  const nodes = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  RUBY_PATTERN.lastIndex = 0;
  while ((match = RUBY_PATTERN.exec(children)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(children.slice(lastIndex, match.index));
    }
    nodes.push(
      <ruby key={key++}>
        {match[1]}
        <rt>{match[2]}</rt>
      </ruby>
    );
    lastIndex = RUBY_PATTERN.lastIndex;
  }
  if (lastIndex < children.length) {
    nodes.push(children.slice(lastIndex));
  }
  return nodes;
}

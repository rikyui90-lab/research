// 時事問題の自動更新で使う共通の関数(標準ライブラリだけ)
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_HTML = path.resolve(HERE, '..', '..', 'stock-quiz', 'index.html');

function extractBlock(html, name) {
  const m = html.match(new RegExp(`// ==${name}-START==([\\s\\S]*?)// ==${name}-END==`));
  if (!m) throw new Error(`${name} ブロックが見つからない`);
  return m[1];
}

// index.html(または同じ形のコピー)の DATA と LOGIC を評価して、名前で値を引ける Proxy を返す
// (stock-quiz/tests/load-logic.js と同じ方法。ファイルを指定できるようにしたもの)
export function loadLogicFrom(htmlPath = DEFAULT_HTML) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const code = extractBlock(html, 'DATA') + '\n' + extractBlock(html, 'LOGIC');
  const lookup = new Function(code + '\nreturn (name) => eval(name);')();
  return new Proxy({}, { get: (_, name) => lookup(String(name)) });
}

// index.html の中の `const NAME = [` 〜 `];` の配列の位置を返す。なければ null
//   open: `[` の直後 / end: 最後の要素の直後(`];` の行の改行の前。1行の空の配列 `[];` なら open と同じ)
export function findArray(html, name) {
  const mark = `const ${name} = [`;
  const start = html.indexOf(mark);
  if (start < 0) return null;
  const open = start + mark.length;
  if (html.startsWith('];', open)) return { start, open, end: open, oneLineEmpty: true };
  const endRe = /\r?\n\];/g;
  endRe.lastIndex = open;
  const em = endRe.exec(html);
  if (!em) throw new Error(`${name} の終わり(];)が見つからない`);
  if (/\n\s*const /.test(html.slice(open, em.index))) throw new Error(`${name} の終わりを取り違えた`);
  return { start, open, end: em.index, oneLineEmpty: false };
}

export function eolOf(html) {
  return html.includes('\r\n') ? '\r\n' : '\n';
}

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = true;
      else { flags[key] = next; i++; }
    } else positional.push(a);
  }
  return { positional, flags };
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function jstToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// 候補の内容(question + answer + wrongs)の SHA-256。verifier が、確かめた内容を結果に写す
export function contentHash(item) {
  return createHash('sha256').update(JSON.stringify([item.question, item.answer, ...item.wrongs])).digest('hex');
}

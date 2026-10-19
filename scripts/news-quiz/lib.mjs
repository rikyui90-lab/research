// 時事問題の自動更新で使う共通の関数(標準ライブラリだけ)
import fs from 'node:fs';
import path from 'node:path';
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

// 通った問題を、stock-quiz/index.html の NEWS_QUESTIONS の末尾に足す
// 使い方: node scripts/news-quiz/apply-news.mjs [accepted.json] [--file stock-quiz/index.html]
// 同じ id は二重に足さない。足したあとに DATA / LOGIC が読めて、全問が validateNewsItem を通ることを確かめてから書き込む。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLogicFrom, parseArgs, readJson, DEFAULT_HTML } from './lib.mjs';

// 文字列を JS の文字列リテラルにする。< > & と行区切り(U+2028/2029)は \u 形式にして、HTML の script を閉じたり壊したりできないようにする
export const J = (s) => JSON.stringify(s)
  .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export function formatItem(n, eol) {
  const lines = [
    '  {',
    `    id: ${J(n.id)},`,
    `    question: ${J(n.question)},`,
    `    answer: ${J(n.answer)},`,
    `    wrongs: [${n.wrongs.map(J).join(', ')}],`,
    `    explanation: ${J(n.explanation)},`,
    `    detail: ${J(n.detail)},`,
    `    difficulty: ${J(n.difficulty)},`,
    `    date: ${J(n.date)},`,
    `    validFrom: ${J(n.validFrom)},`,
    `    validUntil: ${J(n.validUntil)},`,
    `    sources: [${n.sources.map((s) => `{"label": ${J(s.label)}, "url": ${J(s.url)}}`).join(', ')}],`,
    '  },',
  ];
  return lines.join(eol);
}

// html の文字列と足す問題から、新しい html の文字列と足した id を返す(書き込みはしない)
export function applyToHtml(html, items) {
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const startMark = 'const NEWS_QUESTIONS = [';
  const start = html.indexOf(startMark);
  if (start < 0) throw new Error('NEWS_QUESTIONS が見つからない');
  const oneLineEmpty = html.startsWith('];', start + startMark.length); // const NEWS_QUESTIONS = [];
  let bodyEnd;
  if (oneLineEmpty) {
    bodyEnd = start + startMark.length;
  } else {
    const endRe = /\r?\n\];/g;
    endRe.lastIndex = start;
    const em = endRe.exec(html);
    if (!em) throw new Error('NEWS_QUESTIONS の終わり(];)が見つからない');
    bodyEnd = em.index; // 最後の要素の直後(改行の前)
    if (html.slice(start, bodyEnd).includes('const NEWS_PUBLIC')) throw new Error('NEWS_QUESTIONS の終わりを取り違えた');
  }
  const body = html.slice(start, bodyEnd);
  const fresh = [];
  for (const n of items) {
    if (body.includes(`id: ${J(n.id)},`) || body.includes(`id: '${n.id}',`) || fresh.some((f) => f.id === n.id)) continue;
    fresh.push(n);
  }
  if (!fresh.length) return { html, added: [] };
  let head = html.slice(0, bodyEnd);
  if (/\}\s*$/.test(head.slice(startMark.length + start))) head += ','; // 最後の要素の末尾にカンマがない場合
  const insert = fresh.map((n) => eol + formatItem(n, eol)).join('') + (oneLineEmpty ? eol : '');
  const out = head + insert + html.slice(bodyEnd);
  // script を閉じる記号・HTML のコメントが増えていないこと
  const count = (t, re) => (t.match(re) || []).length;
  for (const re of [/<\/script/gi, /<!--/g]) {
    if (count(out, re) !== count(html, re)) throw new Error('挿入で script の終了タグや HTML コメントが増えた');
  }
  return { html: out, added: fresh.map((n) => n.id) };
}

export function applyFile(file, items) {
  const html = fs.readFileSync(file, 'utf8');
  const res = applyToHtml(html, items);
  if (!res.added.length) return res.added;
  // 書く前に、一時ファイルで読み込めるか・全問が検査を通るかを確かめる
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'news-apply-')), 'index.html');
  fs.writeFileSync(tmp, res.html, 'utf8');
  const L = loadLogicFrom(tmp);
  const all = L.NEWS_QUESTIONS;
  for (const n of all) {
    const err = L.validateNewsItem(n);
    if (err) throw new Error(`挿入後の検査に失敗: ${err}`);
  }
  if (new Set(all.map((n) => n.id)).size !== all.length) throw new Error('挿入後に id が重複');
  fs.writeFileSync(file, res.html, 'utf8');
  return res.added;
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const acceptedFile = positional[0] || '.superpowers/news/accepted.json';
  const file = typeof flags.file === 'string' ? flags.file : DEFAULT_HTML;
  const items = readJson(acceptedFile);
  if (!Array.isArray(items)) throw new Error('accepted.json が配列ではない');
  const added = applyFile(file, items);
  console.log(JSON.stringify({ file, added: added.length, ids: added }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error(`失敗: ${e.message}`); process.exit(1); }
}

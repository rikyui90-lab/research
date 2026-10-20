// 4週より古い時事問題を、stock-quiz/index.html の NEWS_QUESTIONS から NEWS_ARCHIVE の末尾へ移す(月に1回、自動更新の中で動く)
// 使い方: node scripts/news-quiz/archive-news.mjs --today YYYY-MM-DD [--file stock-quiz/index.html] [--weeks 4]
// 「古い」は週単位: 出来事の日(date)が属する週が、today の属する週の月曜から weeks 週(7日 x weeks)より前なら移す。
// 元の書き方(インデント・クォート・改行コード CRLF/LF)のまま移す。同じ id は二重に移さない(すでに過去にあれば、元から消すだけ)。
// 書く前に、一時ファイルで DATA / LOGIC が読めること・全問が validateNewsItem を通ること・id が重複しないこと・問題の総数が変わらないことを確かめる。
// 失敗したら何も書かない。結果(移した件数と id)は標準出力に JSON で出す。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLogicFrom, parseArgs, findArray, eolOf, DEFAULT_HTML } from './lib.mjs';

// 配列の本体(`[` の直後〜最後の要素の直後)を、`  {` 〜 `  },` の要素ごとの塊に分ける。想定外の行があれば例外
function splitItems(body) {
  const lines = body.split(/\r?\n/);
  const items = [];
  let cur = null;
  lines.forEach((line, i) => {
    if (cur) {
      cur.lines.push(line);
      if (/^ {2}\},?\s*$/.test(line)) { items.push(cur); cur = null; }
      return;
    }
    if (/^ {2}\{\s*$/.test(line)) { cur = { lines: [line] }; return; }
    // 配列の外側の行は、空行・コメントだけを許す(最初の行は `[` の直後の空)
    if (line.trim() === '' || /^\s*\/\//.test(line)) return;
    throw new Error(`NEWS の配列に想定外の行がある(${i + 1}行目): ${line.slice(0, 40)}`);
  });
  if (cur) throw new Error('NEWS の配列の要素が閉じていない');
  for (const it of items) {
    const m = it.lines.join('\n').match(/^ {4}id:\s*(["'])([a-z0-9-]+)\1,/m);
    if (!m) throw new Error('要素の id が読めない');
    it.id = m[2];
  }
  return items;
}

// html の文字列から、移した後の html の文字列と、移した id を返す(書き込みはしない)
export function archiveHtml(html, ids) {
  const eol = eolOf(html);
  if (!ids.length) return { html, moved: [], duplicates: 0 };
  const q = findArray(html, 'NEWS_QUESTIONS');
  if (!q) throw new Error('NEWS_QUESTIONS が見つからない');
  const items = splitItems(html.slice(q.open, q.end));
  const want = new Set(ids);
  const take = items.filter((it) => want.has(it.id));
  if (take.length !== want.size) throw new Error('移す id が NEWS_QUESTIONS の中に見つからない');
  // 元から取り除く: 移す要素の行を消す(前後の空行・コメントは残す)
  const takeSet = new Set(take);
  const lines = html.slice(q.open, q.end).split(/\r?\n/);
  const out = [];
  let cur = null;
  let drop = false;
  let idx = -1;
  for (const line of lines) {
    if (cur) {
      if (!drop) out.push(line);
      if (/^ {2}\},?\s*$/.test(line)) cur = null;
      continue;
    }
    if (/^ {2}\{\s*$/.test(line)) {
      cur = true;
      idx++;
      drop = takeSet.has(items[idx]);
      if (!drop) out.push(line);
      continue;
    }
    out.push(line);
  }
  let rest = html.slice(0, q.open) + out.join(eol) + html.slice(q.end);

  // 過去の問題の配列に足す
  const a = findArray(rest, 'NEWS_ARCHIVE');
  if (!a) throw new Error('NEWS_ARCHIVE が見つからない(DATA ブロックに `const NEWS_ARCHIVE = [];` が要る)');
  const archBody = rest.slice(a.open, a.end);
  const already = new Set(splitItems(archBody).map((it) => it.id));
  const fresh = take.filter((it) => !already.has(it.id));
  if (fresh.length) {
    const texts = fresh.map((it) => {
      const ls = it.lines.slice();
      ls[ls.length - 1] = ls[ls.length - 1].replace(/^( {2}\}),?\s*$/, '$1,'); // 最後の行を `  },` にそろえる
      return ls.join(eol);
    });
    let head = rest.slice(0, a.end);
    if (!a.oneLineEmpty && /\}\s*$/.test(head.slice(a.open))) head += ','; // 最後の要素の末尾にカンマがない場合
    const insert = texts.map((t) => eol + t).join('') + (a.oneLineEmpty ? eol : '');
    rest = head + insert + rest.slice(a.end);
  }
  const count = (t, re) => (t.match(re) || []).length;
  for (const re of [/<\/script/gi, /<!--/g]) {
    if (count(rest, re) !== count(html, re)) throw new Error('移動で script の終了タグや HTML コメントが増減した');
  }
  return { html: rest, moved: take.map((it) => it.id), duplicates: take.length - fresh.length };
}

// ファイルを読んで、4週より古い問題を移す。書く前に検査する。移した id を返す
export function archiveFile(file, today, weeks = 4) {
  const html = fs.readFileSync(file, 'utf8');
  const before = loadLogicFrom(file);
  const old = before.NEWS_QUESTIONS.filter((n) => before.isOlderThanWeeks(n, today, weeks)).map((n) => n.id);
  const res = archiveHtml(html, old);
  if (!res.moved.length) return { moved: [] };
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'news-archive-')), 'index.html');
  fs.writeFileSync(tmp, res.html, 'utf8');
  const L = loadLogicFrom(tmp);
  const all = [...L.NEWS_QUESTIONS, ...L.NEWS_ARCHIVE];
  for (const n of all) {
    const err = L.validateNewsItem(n);
    if (err) throw new Error(`移動後の検査に失敗: ${err}`);
  }
  if (new Set(all.map((n) => n.id)).size !== all.length) throw new Error('移動後に id が重複');
  // すでに過去にあった id は、元から消すだけなので、その分だけ減る
  const total = before.NEWS_QUESTIONS.length + before.NEWS_ARCHIVE.length - res.duplicates;
  if (all.length !== total) throw new Error(`移動の前後で問題の数が合わない(期待 ${total} → 実際 ${all.length})`);
  if (L.NEWS_QUESTIONS.some((n) => res.moved.includes(n.id))) throw new Error('移したはずの問題が NEWS_QUESTIONS に残っている');
  if (!res.moved.every((id) => L.NEWS_ARCHIVE.some((n) => n.id === id))) throw new Error('移した問題が NEWS_ARCHIVE にない');
  // 移さなかった問題の中身は、そのまま(JSON としての同一性)
  const keep = JSON.stringify(before.NEWS_QUESTIONS.filter((n) => !res.moved.includes(n.id)));
  if (keep !== JSON.stringify(L.NEWS_QUESTIONS)) throw new Error('残した問題の中身が変わった');
  fs.writeFileSync(file, res.html, 'utf8');
  return { moved: res.moved };
}

function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  const today = typeof flags.today === 'string' ? flags.today : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('--today YYYY-MM-DD が必要');
  const file = typeof flags.file === 'string' ? flags.file : DEFAULT_HTML;
  const weeks = flags.weeks === undefined ? 4 : Number(flags.weeks);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) throw new Error('--weeks は 1〜52 の整数');
  const { moved } = archiveFile(file, today, weeks);
  console.log(JSON.stringify({ file, today, weeks, moved: moved.length, ids: moved }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error(`失敗: ${e.message}`); process.exit(1); }
}

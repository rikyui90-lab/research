// 機械チェック: node scripts/news-quiz/check-news.mjs <candidates.json> <verdicts.json> [--today YYYY-MM-DD] [--html index.html] [--min 5]
// 通った問題を accepted.json、落ちた問題と理由を rejected.json に書く(candidates.json と同じフォルダ)。
// 終了コード: 0 = 通った数が min 以上 / 2 = 通った数が min 未満 / 1 = 入力が読めないなどの失敗
import path from 'node:path';
import { loadLogicFrom, parseArgs, readJson, writeJson, jstToday, addDays, DEFAULT_HTML } from './lib.mjs';

const ASSERT_WORDS = /必ず|絶対|確実|間違いなく|買うべき|売るべき|買い時|売り時|おすすめ|オススメ|お勧め|儲かる|もうかる|上がるはず|下がるはず|急騰する|暴落する/;
const sentences = (s) => (String(s).match(/。/g) || []).length;

function isLongestUnique(item) {
  const a = item.answer.length;
  return item.wrongs.every((w) => w.length < a);
}

export function checkAll({ candidates, verdicts, today, html = DEFAULT_HTML, min = 5 }) {
  const L = loadLogicFrom(html);
  const existing = new Set(L.NEWS_QUESTIONS.map((n) => n.id));
  const verdictById = new Map((Array.isArray(verdicts) ? verdicts : []).map((v) => [v && v.id, v]));
  const from = addDays(today, -7);
  const to = addDays(today, -1);
  const seen = new Set();
  const accepted = [];
  const rejected = [];

  for (const item of candidates) {
    const reasons = [];
    const id = item && item.id;
    const err = L.validateNewsItem(item);
    if (err) reasons.push(`形式: ${err}`);
    if (!err) {
      if (item.sources.length < 2) reasons.push('出典が2件未満');
      if (new Set(item.sources.map((s) => s.url)).size < item.sources.length) reasons.push('出典の URL が重複');
      if (item.date < from || item.date > to) reasons.push(`出来事の日(${item.date})が ${from}〜${to} の外`);
      if (item.validFrom !== today) reasons.push(`validFrom が実行日(${today})ではない`);
      const text = [item.question, item.answer, ...item.wrongs, item.explanation, item.detail].join('\n');
      const hit = text.match(ASSERT_WORDS);
      if (hit) reasons.push(`断定語・助言語: ${hit[0]}`);
      if (item.detail.length < 120 || item.detail.length > 250) reasons.push(`detail の長さが 120〜250字ではない(${item.detail.length}字)`);
      if (sentences(item.detail) < 2 || sentences(item.detail) > 4) reasons.push('detail が2〜4文ではない');
      if (sentences(item.explanation) < 1 || sentences(item.explanation) > 2) reasons.push('explanation が1〜2文ではない');
      if (existing.has(id)) reasons.push('id が既存の問題と重複');
      if (seen.has(id)) reasons.push('id が候補の中で重複');
      if (!/[?？]/.test(item.question)) reasons.push('question に「?」がない');
    }
    if (typeof id === 'string') seen.add(id);
    const v = verdictById.get(id);
    if (!v) reasons.push('事実確認の結果がない');
    else if (v.pass !== true) reasons.push(`事実確認で不合格: ${(Array.isArray(v.reasons) ? v.reasons : []).join(' / ').slice(0, 300) || '理由なし'}`);
    if (reasons.length) rejected.push({ id: id ?? null, reasons });
    else accepted.push(item);
  }

  // 正解が選択肢の中でいちばん長い問題が、半分より多いと偏る。差が大きいものから外す
  const limit = Math.floor(accepted.length / 2);
  let longest = accepted.filter(isLongestUnique);
  if (longest.length > limit) {
    const margin = (n) => n.answer.length - Math.max(...n.wrongs.map((w) => w.length));
    const drop = new Set(longest.sort((a, b) => margin(b) - margin(a)).slice(0, longest.length - limit).map((n) => n.id));
    for (let i = accepted.length - 1; i >= 0; i--) {
      if (drop.has(accepted[i].id)) {
        rejected.push({ id: accepted[i].id, reasons: ['正解が最長の問題が多すぎる偏りを避けるため除外'] });
        accepted.splice(i, 1);
      }
    }
  }
  return { accepted, rejected, ok: accepted.length >= min, min };
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [candFile, verdFile] = positional;
  if (!candFile || !verdFile) {
    console.error('使い方: check-news.mjs <candidates.json> <verdicts.json> [--today YYYY-MM-DD]');
    process.exit(1);
  }
  const today = typeof flags.today === 'string' && flags.today ? flags.today : jstToday();
  const min = flags.min ? Number(flags.min) : 5;
  let candidates, verdicts;
  try {
    candidates = readJson(candFile);
    verdicts = readJson(verdFile);
    if (!Array.isArray(candidates)) throw new Error('candidates.json が配列ではない');
  } catch (e) {
    console.error(`入力を読めない: ${e.message}`);
    process.exit(1);
  }
  const res = checkAll({ candidates, verdicts, today, html: typeof flags.html === 'string' ? flags.html : DEFAULT_HTML, min });
  const dir = path.dirname(candFile);
  writeJson(path.join(dir, 'accepted.json'), res.accepted);
  writeJson(path.join(dir, 'rejected.json'), res.rejected);
  console.log(JSON.stringify({ today, candidates: candidates.length, accepted: res.accepted.length, rejected: res.rejected.length, min, ok: res.ok }));
  process.exit(res.ok ? 0 : 2);
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

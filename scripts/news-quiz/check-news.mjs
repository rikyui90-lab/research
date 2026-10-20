// 機械チェック: node scripts/news-quiz/check-news.mjs <candidates.json> <verdicts.json> [--today YYYY-MM-DD] [--html index.html] [--min 5]
// 通った問題を accepted.json、落ちた問題と理由を rejected.json に書く(candidates.json と同じフォルダ)。
// rejected.json の reasons は機械チェックの理由だけ(Issue に載せてよい)。AI の文章は aiReasons に分けて置く。
// 終了コード: 0 = 通った数が min 以上 / 2 = 通った数が min 未満、または多すぎて全部止めた / 1 = 入力が読めないなどの失敗
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLogicFrom, parseArgs, readJson, writeJson, jstToday, addDays, contentHash, DEFAULT_HTML } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MAX_ADD = 12; // 1回に足せる最大数。超えたら、上位ではなく全部止める
const LIMITS = { id: 80, question: 200, answer: 80, wrong: 80, explanation: 200, detail: 250, label: 60, url: 300 };

const ASSERT_WORDS = /必ず|絶対|確実|間違いなく|買うべき|売るべき|買い時|売り時|おすすめ|オススメ|お勧め|儲かる|もうかる|上がるはず|下がるはず|急騰する|暴落する/;
// 不祥事・係争・人事は扱わない(会社自身の発表で確認できる出来事に限る)
const OUT_OF_SCOPE = /不祥事|不正会計|粉飾|データ改ざん|情報漏えい|情報漏洩|不正アクセス|談合|逮捕|起訴|訴訟|提訴|賠償|辞任|解任|退任|死去|懲戒|行政処分|課徴金|リコール/;
// HTML や制御に使える文字は、文字列に入れない(< > 制御文字 双方向制御文字 ゼロ幅文字 行区切り)
const BAD_CHARS = new RegExp("[<>\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]");
const sentences = (s) => (String(s).match(/。/g) || []).length;

function loadDomains() {
  const d = readJson(path.join(HERE, 'allowed-domains.json'));
  return { primary: d.primary || [], wire: d.wire || [], news: d.news || [] };
}

function hostMatches(host, list) {
  return list.some((d) => host === d || host.endsWith('.' + d));
}

// 同じ会社・媒体のドメインを1つと数えるための名前(サブドメイン違いは同じ。co.jp などの2階層も考える)
export function registrable(host) {
  const parts = host.split('.');
  const second = ['co', 'or', 'ne', 'go', 'ac', 'ad', 'ed', 'gr', 'lg'];
  const n = parts.length >= 3 && parts[parts.length - 1] === 'jp' && second.includes(parts[parts.length - 2]) ? 3 : 2;
  return parts.slice(-n).join('.');
}

// 出典の URL の検査。{ ok, kind: 'primary'|'wire'|'news', domain, reason }
export function classifyUrl(url, domains) {
  let u;
  try { u = new URL(url); } catch { return { ok: false, reason: 'URL が読めない' }; }
  if (u.protocol !== 'https:') return { ok: false, reason: 'https ではない' };
  const host = u.hostname.toLowerCase();
  if (!host.includes('.') || /^\d+(\.\d+){3}$/.test(host) || host.includes(':')) return { ok: false, reason: 'ホスト名が不正' };
  if (u.username || u.password) return { ok: false, reason: 'URL に認証情報が含まれる' };
  const isIr = host.startsWith('ir.') || /\/ir(\/|\.|-|_|$)/i.test(u.pathname);
  const domain = registrable(host);
  if (hostMatches(host, domains.primary)) return { ok: true, kind: 'primary', domain };
  if (isIr) return { ok: true, kind: 'primary', domain };
  if (hostMatches(host, domains.wire)) return { ok: true, kind: 'wire', domain };
  if (hostMatches(host, domains.news)) return { ok: true, kind: 'news', domain };
  return { ok: false, reason: `許可リストにないドメイン: ${host}` };
}

// 出典の組み合わせの条件(異なるドメインで数える。同じドメインの複数ページは1件)。満たしていれば null、満たさなければ理由
// (a) 報道機関の別々のドメイン2件以上 / (b) リリース配信サービス1件 + 報道機関1件以上 / (c) 一次情報(取引所・官公庁・会社IR)1件 + ほかのドメイン1件以上
export function sourceCombinationError(cls) {
  const byDomain = new Map();
  const rank = { primary: 3, wire: 2, news: 1 };
  for (const c of cls) {
    const old = byDomain.get(c.domain);
    if (!old || rank[c.kind] > rank[old]) byDomain.set(c.domain, c.kind);
  }
  const kinds = [...byDomain.values()];
  const count = (k) => kinds.filter((x) => x === k).length;
  if (kinds.length < 2) return '出典が異なるドメインで2件未満(同じドメインの複数ページは1件と数える)';
  if (count('primary') >= 1) return null;
  if (count('news') >= 2) return null;
  if (count('wire') >= 1 && count('news') >= 1) return null;
  return '出典の組み合わせが条件に合わない(報道機関2社以上、配信サービス+報道機関、または一次情報+ほかのドメイン)';
}

function isLongestUnique(item) {
  const a = item.answer.length;
  return item.wrongs.every((w) => w.length < a);
}

function stringsOf(item) {
  const out = [item.id, item.question, item.answer, ...item.wrongs, item.explanation, item.detail, item.date];
  for (const s of item.sources) out.push(s.label, s.url);
  return out;
}

export function checkAll({ candidates, verdicts, today, html = DEFAULT_HTML, min = 5, domains = loadDomains() }) {
  const L = loadLogicFrom(html);
  const existing = new Set([...L.NEWS_QUESTIONS, ...L.NEWS_ARCHIVE].map((n) => n.id)); // 過去の問題にある id も重複
  const from = addDays(today, -7);
  const to = addDays(today, -1);

  // verdict は、id ごとに1つだけ有効。同じ id が複数あれば、その id は落とす
  const verdictCount = new Map();
  for (const v of Array.isArray(verdicts) ? verdicts : []) verdictCount.set(v && v.id, (verdictCount.get(v && v.id) || 0) + 1);
  const verdictById = new Map((Array.isArray(verdicts) ? verdicts : []).map((v) => [v && v.id, v]));
  // 候補の id が重複したら、その id はすべて落とす
  const idCount = new Map();
  for (const c of candidates) idCount.set(c && c.id, (idCount.get(c && c.id) || 0) + 1);

  const accepted = [];
  const rejected = [];

  if (candidates.length > MAX_ADD) {
    // 多すぎるときは、上位ではなく全部止める
    return { accepted: [], rejected: [{ id: null, reasons: [`候補が ${candidates.length} 問で、1回の最大(${MAX_ADD}問)を超えた`] }], ok: false, min, stop: 'too-many' };
  }

  for (const item of candidates) {
    const reasons = [];
    const aiReasons = [];
    const id = item && item.id;
    const err = L.validateNewsItem(item);
    if (err) reasons.push(`形式: ${err}`);
    if (!err) {
      // 文字・長さ
      const strs = stringsOf(item);
      if (strs.some((s) => typeof s !== 'string')) reasons.push('文字列でない項目がある');
      else {
        if (strs.some((s) => BAD_CHARS.test(s))) reasons.push('使えない文字(< > 制御文字 双方向制御文字など)が含まれる');
        const over = [];
        if (item.id.length > LIMITS.id) over.push('id');
        if (item.question.length > LIMITS.question) over.push('question');
        if (item.answer.length > LIMITS.answer || item.wrongs.some((w) => w.length > LIMITS.wrong)) over.push('選択肢');
        if (item.explanation.length > LIMITS.explanation) over.push('explanation');
        if (item.sources.some((s) => s.label.length > LIMITS.label)) over.push('label');
        if (item.sources.some((s) => s.url.length > LIMITS.url)) over.push('url');
        if (over.length) reasons.push(`長すぎる項目: ${over.join(',')}`);
      }
      // 出典
      if (item.sources.length < 2) reasons.push('出典が2件未満');
      if (new Set(item.sources.map((s) => s.url)).size < item.sources.length) reasons.push('出典の URL が重複');
      const cls = item.sources.map((s) => classifyUrl(s.url, domains));
      for (const c of cls) if (!c.ok) reasons.push(`出典: ${c.reason}`);
      if (cls.every((c) => c.ok)) {
        const comb = sourceCombinationError(cls);
        if (comb) reasons.push(`出典: ${comb}`);
      }
      // 日付
      if (item.date < from || item.date > to) reasons.push(`出来事の日(${item.date})が ${from}〜${to} の外`);
      // 言葉
      const text = [item.question, item.answer, ...item.wrongs, item.explanation, item.detail].join('\n');
      const hit = text.match(ASSERT_WORDS);
      if (hit) reasons.push(`断定語・助言語: ${hit[0]}`);
      const oos = text.match(OUT_OF_SCOPE);
      if (oos) reasons.push(`扱わない話題(不祥事・係争・人事など): ${oos[0]}`);
      if (item.detail.length < 120 || item.detail.length > 250) reasons.push(`detail の長さが 120〜250字ではない(${item.detail.length}字)`);
      if (sentences(item.detail) < 2 || sentences(item.detail) > 4) reasons.push('detail が2〜4文ではない');
      if (sentences(item.explanation) < 1 || sentences(item.explanation) > 2) reasons.push('explanation が1〜2文ではない');
      if (!/[?？]/.test(item.question)) reasons.push('question に「?」がない');
      if (existing.has(id)) reasons.push('id が既存の問題と重複');
    }
    if (idCount.get(id) > 1) reasons.push('id が候補の中で重複');

    // 事実確認(verifier)の結果
    const v = verdictById.get(id);
    if (!v) reasons.push('事実確認の結果がない');
    else if (verdictCount.get(id) > 1) reasons.push('事実確認の結果が同じ id で複数ある');
    else {
      if (v.pass !== true) {
        reasons.push('事実確認で不合格');
        aiReasons.push(...(Array.isArray(v.reasons) ? v.reasons : []).map((r) => String(r).slice(0, 300)));
      }
      if (item && Array.isArray(item.wrongs) && typeof item.question === 'string') {
        if (v.hash !== contentHash(item)) reasons.push('事実確認の hash が候補の内容と合わない');
      }
      if (item && Array.isArray(item.sources)) {
        const checked = new Set(Array.isArray(v.checkedSources) ? v.checkedSources : []);
        if (!item.sources.every((s) => checked.has(s.url))) reasons.push('事実確認で、すべての出典を確かめていない');
      }
    }

    if (reasons.length) rejected.push({ id: typeof id === 'string' ? id : null, reasons, ...(aiReasons.length ? { aiReasons } : {}) });
    else accepted.push(item);
  }

  // 正解が選択肢の中でいちばん長い問題が、半分より多いと偏る。差が大きいものから外す
  const limit = Math.floor(accepted.length / 2);
  const longest = accepted.filter(isLongestUnique);
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
  return { accepted, rejected, ok: accepted.length >= min, min, stop: accepted.length >= min ? '' : 'too-few' };
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [candFile, verdFile] = positional;
  if (!candFile || !verdFile) {
    console.error('使い方: check-news.mjs <candidates.json> <verdicts.json> [--today YYYY-MM-DD]');
    process.exit(1);
  }
  const today = typeof flags.today === 'string' && flags.today ? flags.today : jstToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) { console.error('today が YYYY-MM-DD ではない'); process.exit(1); }
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
  console.log(JSON.stringify({ today, candidates: candidates.length, accepted: res.accepted.length, rejected: res.rejected.length, min, ok: res.ok, stop: res.stop }));
  process.exit(res.ok ? 0 : 2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

// 週次の時事問題パイプライン(check-news / apply-news)のテスト。Claude や Web には接続しない
// 実行: node --test scripts/news-quiz/test/pipeline.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const REAL_HTML = path.join(ROOT, 'stock-quiz', 'index.html');
const { loadLogic } = require(path.join(ROOT, 'stock-quiz', 'tests', 'load-logic.js'));
const CHECK = path.join(ROOT, 'scripts', 'news-quiz', 'check-news.mjs');
const APPLY = path.join(ROOT, 'scripts', 'news-quiz', 'apply-news.mjs');

const TODAY = '2026-10-19';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'news-test-'));
}

// 合格する候補を作る(n で id と内容を変える)。n が4の倍数のときだけ、正解を最長にする
function cand(n, patch = {}) {
  const day = (n % 5) + 12;
  const longAnswer = n % 4 === 0;
  return {
    id: `2026-10-${day}-test-co${n}`,
    question: `テスト${n}社が2026年10月${day}日に公表した内容は?`,
    answer: longAnswer ? `第2四半期の営業利益を前年同期比で増やしたと公表した${n}` : `増益${n}`,
    wrongs: [`減益だった${n}と公表した内容`, `赤字に転落したと公表した内容${n}`, `業績の発表を延期した内容${n}`],
    explanation: `テスト${n}社は増益と公表したよ。数字は出典のとおりだよ。`,
    detail: `これはテスト用の「くわしく」だよ。テスト${n}社は、決算の発表で営業利益が前の年より増えたと公表したよ。` +
      '増えた理由として、主力の商品の販売が伸びたことなどを挙げたとされるよ。一方で、原材料の価格の上昇が重しになる点にも触れていて、来期の見通しについては慎重な見方を示したとされるよ。',
    difficulty: 'normal',
    date: `2026-10-${day}`,
    validFrom: TODAY,
    validUntil: '2026-11-15',
    sources: [
      { label: '会社IR(2026/10/14)', url: `https://example.com/ir/${n}` },
      { label: 'テスト新聞(2026/10/14)', url: `https://example.com/news/${n}` },
    ],
    ...patch,
  };
}

function verdicts(cands, overrides = {}) {
  return cands.map((c) => ({ id: c.id, pass: true, reasons: [], ...(overrides[c.id] || {}) }));
}

function runCheck(cands, verds, extra = []) {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'candidates.json'), JSON.stringify(cands));
  fs.writeFileSync(path.join(dir, 'verdicts.json'), JSON.stringify(verds));
  const r = spawnSync(process.execPath, [CHECK, path.join(dir, 'candidates.json'), path.join(dir, 'verdicts.json'), '--today', TODAY, ...extra], { encoding: 'utf8' });
  const read = (f) => (fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) : null);
  const last = r.stdout.trim().split('\n').pop();
  return { r, dir, accepted: read('accepted.json'), rejected: read('rejected.json'), summary: last ? JSON.parse(last) : null };
}

function tenGood() {
  return Array.from({ length: 10 }, (_, i) => cand(i + 1));
}

test('フィクスチャ: 10問すべて合格する', () => {
  const cands = tenGood();
  const res = runCheck(cands, verdicts(cands));
  assert.deepEqual(res.rejected, []);
  assert.equal(res.accepted.length, 10);
  assert.equal(res.r.status, 0);
  assert.deepEqual(res.summary, { today: TODAY, candidates: 10, accepted: 10, rejected: 0, min: 5, ok: true });
});

test('check: 各不合格の理由が rejected.json に出る', () => {
  const cands = tenGood();
  const bad = {
    [cands[0].id]: { sources: [cands[0].sources[0]] }, // 出典1件
    [cands[1].id]: { date: '2026-09-01' }, // 7日より前
    [cands[2].id]: { explanation: '確実に増益になる内容だよ。' }, // 断定語
    [cands[3].id]: { id: 'BAD ID' }, // 形式
    [cands[4].id]: { sources: [{ label: 'a', url: 'http://example.com/a' }, { label: 'b', url: 'https://example.com/b' }] }, // http
    [cands[5].id]: { detail: '短いよ。' }, // detail の長さ
    [cands[6].id]: { wrongs: ['a', 'b'] }, // wrongs
    [cands[7].id]: { validFrom: '2026-10-01' }, // validFrom が実行日でない
  };
  const patched = cands.map((c) => ({ ...c, ...(bad[c.id] || {}) }));
  const res = runCheck(patched, verdicts(patched));
  const reasonOf = (id) => ((res.rejected.find((x) => x.id === id) || {}).reasons || []).join();
  assert.match(reasonOf(cands[0].id), /出典が2件未満/);
  assert.match(reasonOf(cands[1].id), /の外/);
  assert.match(reasonOf(cands[2].id), /断定語/);
  assert.match(reasonOf('BAD ID'), /形式/);
  assert.match(reasonOf(cands[4].id), /形式/);
  assert.match(reasonOf(cands[5].id), /detail の長さ/);
  assert.match(reasonOf(cands[6].id), /形式/);
  assert.match(reasonOf(cands[7].id), /validFrom/);
  assert.equal(res.accepted.length, 2);
  assert.equal(res.r.status, 2); // 5未満
  assert.equal(res.summary.ok, false);
});

test('check: 事実確認が不合格・結果なしの問題は落ちる', () => {
  const cands = tenGood();
  const verds = verdicts(cands, { [cands[0].id]: { pass: false, reasons: ['金額が出典と違う'] } }).filter((v) => v.id !== cands[1].id);
  const res = runCheck(cands, verds);
  assert.match(res.rejected.find((x) => x.id === cands[0].id).reasons.join(), /事実確認で不合格: 金額が出典と違う/);
  assert.match(res.rejected.find((x) => x.id === cands[1].id).reasons.join(), /結果がない/);
  assert.equal(res.accepted.length, 8);
});

test('check: 既存の id・候補内の重複 id は落ちる', () => {
  const L = loadLogic();
  const existingId = L.NEWS_QUESTIONS[0].id;
  const cands = tenGood();
  cands[0] = { ...cands[0], id: existingId };
  cands[2] = { ...cands[2], id: cands[1].id };
  const res = runCheck(cands, cands.map((c) => ({ id: c.id, pass: true, reasons: [] })));
  const reasons = res.rejected.map((x) => x.reasons.join());
  assert.ok(reasons.some((r) => /既存の問題と重複/.test(r)));
  assert.ok(reasons.some((r) => /候補の中で重複/.test(r)));
});

test('check: 正解が最長の問題が半分より多いと、差が大きいものから外す', () => {
  const cands = tenGood().map((c, i) => ({
    ...c,
    answer: '第2四半期の営業利益を前年同期比で大きく増やしたと公表した内容' + i, // 全問、正解が最長
  }));
  const res = runCheck(cands, verdicts(cands));
  assert.equal(res.accepted.length, 5);
  assert.equal(res.rejected.length, 5);
  assert.ok(res.rejected.every((x) => /最長/.test(x.reasons.join())));
  assert.equal(res.r.status, 0);
});

test('check: 入力が読めないときは終了コード 1', () => {
  const dir = tmpDir();
  const r = spawnSync(process.execPath, [CHECK, path.join(dir, 'none.json'), path.join(dir, 'none2.json')], { encoding: 'utf8' });
  assert.equal(r.status, 1);
});

// ---- apply ----
function htmlCopy(eol) {
  let html = fs.readFileSync(REAL_HTML, 'utf8').replace(/\r\n/g, '\n');
  if (eol === 'crlf') html = html.replace(/\n/g, '\r\n');
  const file = path.join(tmpDir(), 'index.html');
  fs.writeFileSync(file, html, 'utf8');
  return file;
}

function runApply(file, items) {
  const acc = path.join(path.dirname(file), 'accepted.json');
  fs.writeFileSync(acc, JSON.stringify(items));
  const r = spawnSync(process.execPath, [APPLY, acc, '--file', file], { encoding: 'utf8' });
  const last = r.stdout.trim().split('\n').pop();
  return { r, out: last ? JSON.parse(last) : null };
}

// load-logic.js と同じ方法で、コピーの DATA / LOGIC を評価する
function loadCopy(file) {
  const html = fs.readFileSync(file, 'utf8');
  const ex = (name) => html.match(new RegExp(`// ==${name}-START==([\\s\\S]*?)// ==${name}-END==`))[1];
  const lookup = new Function(ex('DATA') + '\n' + ex('LOGIC') + '\nreturn (name) => eval(name);')();
  return new Proxy({}, { get: (_, name) => lookup(String(name)) });
}

for (const eol of ['lf', 'crlf']) {
  test(`apply(${eol}): 末尾に足され、DATA/LOGIC が読め、改行コードと目印コメントが保たれる`, () => {
    const file = htmlCopy(eol);
    const before = loadCopy(file).NEWS_QUESTIONS.length;
    const items = [cand(1), cand(2, { wrongs: ['"引用符"を含む', "'一重'を含む", '円記号\\を含む'] })];
    const { r, out } = runApply(file, items);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(out.added, 2);
    const text = fs.readFileSync(file, 'utf8');
    if (eol === 'crlf') assert.ok(!/(?<!\r)\n/.test(text), 'CRLF のファイルに LF だけの行ができた');
    else assert.ok(!text.includes('\r'), 'LF のファイルに CR が入った');
    for (const m of ['DATA-START', 'DATA-END', 'LOGIC-START', 'LOGIC-END', 'UI-START', 'UI-END']) assert.ok(text.includes(`// ==${m}==`), m);
    const L = loadCopy(file);
    assert.equal(L.NEWS_QUESTIONS.length, before + 2);
    assert.deepEqual(L.NEWS_QUESTIONS.slice(-2).map((n) => n.id), items.map((i) => i.id));
    assert.deepEqual(L.NEWS_QUESTIONS[before + 1].wrongs, items[1].wrongs);
    for (const n of L.NEWS_QUESTIONS) assert.equal(L.validateNewsItem(n), null);
    assert.equal(L.NEWS_PUBLIC, true);
  });
}

test('apply: 冪等(同じ id は二重に足さない)', () => {
  const file = htmlCopy('crlf');
  const items = [cand(1), cand(2)];
  runApply(file, items);
  const once = fs.readFileSync(file, 'utf8');
  const { out } = runApply(file, items);
  assert.equal(out.added, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), once);
  const { out: out2 } = runApply(file, [cand(2), cand(3)]);
  assert.deepEqual(out2.ids, [cand(3).id]);
});

test('apply: 検査に通らない問題が混ざると、書き込まずに失敗する', () => {
  const file = htmlCopy('lf');
  const before = fs.readFileSync(file, 'utf8');
  const { r } = runApply(file, [cand(1), cand(2, { difficulty: 'impossible' })]);
  assert.equal(r.status, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('apply: 最後の要素の末尾にカンマがなくても足せる', () => {
  const file = htmlCopy('lf');
  const text = fs.readFileSync(file, 'utf8');
  const stripped = text.replace(/\},\n\];\n\/\/ 時事モードを画面に出すか/, '}\n];\n// 時事モードを画面に出すか');
  assert.notEqual(stripped, text, '前提: カンマを外せた');
  fs.writeFileSync(file, stripped, 'utf8');
  const { r } = runApply(file, [cand(1)]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(loadCopy(file).NEWS_QUESTIONS.some((n) => n.id === cand(1).id));
});

test('本物の index.html は、このテストで書き換わらない', () => {
  const before = fs.readFileSync(REAL_HTML, 'utf8');
  const file = htmlCopy('crlf');
  runApply(file, [cand(1)]);
  assert.equal(fs.readFileSync(REAL_HTML, 'utf8'), before);
  assert.ok(Array.isArray(loadLogic().NEWS_QUESTIONS));
});

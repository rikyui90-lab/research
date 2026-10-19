// 週次の時事問題パイプライン(check-news / apply-news)のテスト。Claude や Web には接続しない
// 実行: node --test scripts/news-quiz/test/pipeline.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const REAL_HTML = path.join(ROOT, 'stock-quiz', 'index.html');
const { loadLogic } = require(path.join(ROOT, 'stock-quiz', 'tests', 'load-logic.js'));
const CHECK = path.join(ROOT, 'scripts', 'news-quiz', 'check-news.mjs');
const APPLY = path.join(ROOT, 'scripts', 'news-quiz', 'apply-news.mjs');

const TODAY = '2026-10-19';

const hashOf = (c) => createHash('sha256').update(JSON.stringify([c.question, c.answer, ...c.wrongs])).digest('hex');

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
      { label: '取引所(2026/10/14)', url: `https://www.jpx.co.jp/news/${n}` },
      { label: 'テスト新聞(2026/10/14)', url: `https://www.nikkei.com/article/${n}` },
    ],
    ...patch,
  };
}

function verdicts(cands, overrides = {}) {
  return cands.map((c) => ({ id: c.id, hash: Array.isArray(c.wrongs) && typeof c.question === 'string' ? hashOf(c) : null, pass: true, checkedSources: (c.sources || []).map((x) => x.url), reasons: [], ...(overrides[c.id] || {}) }));
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
  assert.deepEqual(res.summary, { today: TODAY, candidates: 10, accepted: 10, rejected: 0, min: 5, ok: true, stop: '' });
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
  const r0 = res.rejected.find((x) => x.id === cands[0].id);
  assert.match(r0.reasons.join(), /事実確認で不合格/);
  assert.deepEqual(r0.aiReasons, ['金額が出典と違う']); // AI の文章は reasons ではなく aiReasons に分ける
  assert.match(res.rejected.find((x) => x.id === cands[1].id).reasons.join(), /結果がない/);
  assert.equal(res.accepted.length, 8);
});

test('check: 既存の id・候補内の重複 id は落ちる', () => {
  const L = loadLogic();
  const existingId = L.NEWS_QUESTIONS[0].id;
  const cands = tenGood();
  cands[0] = { ...cands[0], id: existingId };
  cands[2] = { ...cands[2], id: cands[1].id };
  const res = runCheck(cands, verdicts(cands));
  const reasons = res.rejected.map((x) => x.reasons.join());
  assert.ok(reasons.some((r) => /既存の問題と重複/.test(r)));
  // 候補の中で id が重複したら、重複した id はすべて落ちる(2つとも)
  assert.equal(reasons.filter((r) => /候補の中で重複/.test(r)).length, 2);
  assert.equal(res.accepted.length, 7);
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

// ---- 追加: セキュリティと verdict の検査 ----
const XSS_POCS = {
  'script を閉じる': '</script><script>alert(1)</script>',
  'HTML コメント': '<!-- x -->',
  '制御文字': 'abc\u0000def',
  '改行': '行1\n行2',
  '双方向制御文字': '‮evil',
  '行区切り': 'a b',
  'ゼロ幅文字': 'a​b',
};

for (const [name, bad] of Object.entries(XSS_POCS)) {
  test(`check: ${name} を含む問題は、どの項目でも落ちる`, () => {
    const cands = tenGood();
    // 問い・誤答・label・解説のどれかに入れる
    const patches = [
      { question: `テスト社が2026年10月13日に公表した内容${bad}は?` },
      { wrongs: ['減益', bad + '赤字', '延期'] },
      { sources: [{ label: bad, url: 'https://www.jpx.co.jp/a' }, { label: 'b', url: 'https://www.nikkei.com/b' }] },
      { explanation: `増益と公表したよ${bad}。` },
    ];
    patches.forEach((p, i) => { cands[i] = { ...cands[i], ...p }; });
    const res = runCheck(cands, verdicts(cands));
    for (let i = 0; i < patches.length; i++) {
      assert.ok(res.rejected.find((x) => x.id === cands[i].id), `${name}: ${i} が落ちていない`);
    }
    assert.equal(res.accepted.length, 6, name);
  });

  test(`apply: ${name} が直接来ても、HTML の script を閉じず、値はそのまま読める`, () => {
    const file = htmlCopy('crlf');
    const item = cand(1, { wrongs: [bad + '赤字', '減益', '延期'] });
    const before = fs.readFileSync(file, 'utf8');
    const { r } = runApply(file, [item]);
    const text = fs.readFileSync(file, 'utf8');
    const count = (t, re) => (t.match(re) || []).length;
    if (r.status === 0) {
      assert.equal(count(text, /<\/script/gi), count(before, /<\/script/gi));
      assert.equal(count(text, /<!--/g), count(before, /<!--/g));
      const inserted = text.slice(before.length > text.length ? 0 : text.indexOf(item.id));
      assert.ok(!/<|>/.test(inserted.slice(0, inserted.indexOf('sources:'))), '生の < > が入った');
      const got = loadCopy(file).NEWS_QUESTIONS.find((n) => n.id === item.id);
      assert.deepEqual(got.wrongs, item.wrongs); // 値はそのまま読み戻せる
    } else {
      assert.equal(text, before); // 失敗したら書き換えない
    }
    // 少なくとも、script を閉じる記号は通らない
    assert.equal(count(text, /<\/script/gi), count(before, /<\/script/gi));
  });
}

test('check: 長さの上限を超えた項目は落ちる', () => {
  const cands = tenGood();
  cands[0] = { ...cands[0], question: 'あ'.repeat(201) + '?' };
  cands[1] = { ...cands[1], sources: [{ label: 'あ'.repeat(61), url: 'https://www.jpx.co.jp/a' }, cands[1].sources[1]] };
  const res = runCheck(cands, verdicts(cands));
  assert.match(res.rejected.find((x) => x.id === cands[0].id).reasons.join(), /長すぎる/);
  assert.match(res.rejected.find((x) => x.id === cands[1].id).reasons.join(), /長すぎる/);
});

test('check: 出典のドメインの許可リストと、一次情報の条件', () => {
  const cands = tenGood();
  const src = (u1, u2) => [{ label: 'a', url: u1 }, { label: 'b', url: u2 }];
  cands[0] = { ...cands[0], sources: src('https://evil.example.net/a', 'https://www.jpx.co.jp/b') }; // 許可リスト外
  cands[1] = { ...cands[1], sources: src('https://www.nikkei.com/a', 'https://www.asahi.com/b') }; // 一次情報なし
  cands[2] = { ...cands[2], sources: src('https://www.nikkei.com/a', 'https://example.co.jp/ir/news/1') }; // 会社の IR(/ir)
  cands[3] = { ...cands[3], sources: src('https://www.nikkei.com/a', 'https://ir.example.co.jp/news') }; // ir. サブドメイン
  cands[4] = { ...cands[4], sources: src('https://www.nikkei.com/a', 'https://example.co.jp/company/news') }; // 会社のサイトだが /ir でない
  cands[5] = { ...cands[5], sources: src('https://www.nikkei.com/a', 'https://www.fsa.go.jp/news/x') }; // 官公庁
  cands[6] = { ...cands[6], sources: src('https://notnikkei.com/a', 'https://www.jpx.co.jp/b') }; // 似たドメイン
  cands[7] = { ...cands[7], sources: src('https://www.nikkei.com/a', 'https://192.168.0.1/ir/x') }; // IP
  const res = runCheck(cands, verdicts(cands));
  const bad = (i) => res.rejected.some((x) => x.id === cands[i].id);
  assert.ok(bad(0) && bad(1) && bad(4) && bad(6) && bad(7));
  assert.ok(!bad(2) && !bad(3) && !bad(5));
  assert.match(res.rejected.find((x) => x.id === cands[1].id).reasons.join(), /一次情報/);
});

test('check: 不祥事・係争・人事の話題は落ちる', () => {
  const cands = tenGood();
  cands[0] = { ...cands[0], explanation: '社長が辞任したと公表したよ。' };
  cands[1] = { ...cands[1], question: 'テスト社が2026年10月13日に発表した、情報漏えいの件数は?' };
  const res = runCheck(cands, verdicts(cands));
  assert.match(res.rejected.find((x) => x.id === cands[0].id).reasons.join(), /扱わない話題/);
  assert.match(res.rejected.find((x) => x.id === cands[1].id).reasons.join(), /扱わない話題/);
});

test('check: verdict の hash・checkedSources・重複の検査', () => {
  const cands = tenGood();
  const v = verdicts(cands, {
    [cands[0].id]: { hash: 'deadbeef' }, // 内容と合わない
    [cands[1].id]: { checkedSources: [cands[1].sources[0].url] }, // 出典を1件しか確かめていない
    [cands[2].id]: { checkedSources: undefined },
  });
  v.push({ ...v[3] }); // cands[3] の verdict が2つ
  const res = runCheck(cands, v);
  const reason = (i) => ((res.rejected.find((x) => x.id === cands[i].id) || {}).reasons || []).join();
  assert.match(reason(0), /hash/);
  assert.match(reason(1), /すべての出典を確かめていない/);
  assert.match(reason(2), /すべての出典を確かめていない/);
  assert.match(reason(3), /複数/);
  assert.equal(res.accepted.length, 6);
});

test('check: 内容が変わった問題は、hash が合わず落ちる(verifier のあとの書き換え)', () => {
  const cands = tenGood();
  const v = verdicts(cands);
  cands[0] = { ...cands[0], answer: '書き換えられた答え' };
  const res = runCheck(cands, v);
  assert.match(res.rejected.find((x) => x.id === cands[0].id).reasons.join(), /hash/);
});

test('check: 候補が12問を超えたら、全部止める(終了コード 2)', () => {
  const cands = Array.from({ length: 13 }, (_, i) => cand(i + 1, { id: `2026-10-13-many-${i}` }));
  const res = runCheck(cands, verdicts(cands));
  assert.equal(res.r.status, 2);
  assert.equal(res.accepted.length, 0);
  assert.equal(res.summary.stop, 'too-many');
});

test('check: rejected.json の reasons に AI の文章は入らない', () => {
  const cands = tenGood();
  const v = verdicts(cands, { [cands[0].id]: { pass: false, reasons: ['@someone https://evil.example/x を見て'] } });
  const res = runCheck(cands, v);
  const rj = res.rejected.find((x) => x.id === cands[0].id);
  assert.ok(!/evil|@/.test(rj.reasons.join()));
});

test('prepare-verify: 各候補に、内容のハッシュを付ける', () => {
  const dir = tmpDir();
  const cands = tenGood().slice(0, 3);
  fs.writeFileSync(path.join(dir, 'c.json'), JSON.stringify(cands));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'news-quiz', 'prepare-verify.mjs'), path.join(dir, 'c.json'), path.join(dir, 'v.json')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(fs.readFileSync(path.join(dir, 'v.json'), 'utf8'));
  assert.deepEqual(out.map((x) => x.hash), cands.map(hashOf));
});

test('apply: NEWS_QUESTIONS = []; (1行で空)でも足せる', () => {
  const file = htmlCopy('lf');
  let text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('const NEWS_QUESTIONS = [');
  const end = text.indexOf('\n];', start) + 3;
  text = text.slice(0, start) + 'const NEWS_QUESTIONS = [];' + text.slice(end);
  fs.writeFileSync(file, text, 'utf8');
  assert.equal(loadCopy(file).NEWS_QUESTIONS.length, 0);
  const { r } = runApply(file, [cand(1), cand(2)]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(loadCopy(file).NEWS_QUESTIONS.map((n) => n.id), [cand(1).id, cand(2).id]);
});

test('make-issue-body: id と機械チェックの理由だけで、@ やリンクは載せない', () => {
  const dir = tmpDir();
  const rej = path.join(dir, 'rejected.json');
  fs.writeFileSync(rej, JSON.stringify([
    { id: 'ok-id-1', reasons: ['事実確認で不合格'], aiReasons: ['@foo https://evil.example/ 悪い文'] },
    { id: '@evil <b>', reasons: ['形式: 見て https://evil.example/x @bar'] },
  ]));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'news-quiz', 'make-issue-body.mjs'), '理由', rej], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.ok(!/evil|@|aiReasons|悪い文/.test(r.stdout), r.stdout);
  assert.match(r.stdout, /ok-id-1: 事実確認で不合格/);
});

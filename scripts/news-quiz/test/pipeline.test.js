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
    date: `2026-10-${day}`,
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
    [cands[7].id]: { difficulty: 'impossible', validFrom: '2026-10-01', validUntil: 'x' }, // 以前の書き方の項目は、あっても無視される(落ちない)
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
  assert.equal(reasonOf(cands[7].id), '');
  assert.equal(res.accepted.length, 3);
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
  const file = htmlCopy('lf');
  const existingId = loadCopy(file).NEWS_QUESTIONS[0].id;
  const cands = tenGood();
  cands[0] = { ...cands[0], id: existingId };
  cands[2] = { ...cands[2], id: cands[1].id };
  const res = runCheck(cands, verdicts(cands), ['--html', file]);
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
// 合成の時事問題(本物のデータは毎週増え、毎月移るので、テストは本物の中身に頼らない)。日付は決め打ち:
//   9/14 の週(synth-0914-1・2)、10/5 の週(synth-1005-1〜3)、10/12 の週(synth-1012-1〜3)
function synthItem(id, date, lead = '') {
  const q = (t) => JSON.stringify(t);
  return [
    ...(lead ? [lead] : []),
    '  {',
    `    id: ${q(id)},`,
    `    question: ${q(`${id} の問いは?`)},`,
    `    answer: ${q('正解だよ')},`,
    `    wrongs: [${q('誤り1')}, ${q('誤り2')}, ${q('誤り3')}],`,
    `    explanation: ${q('短い解説だよ')},`,
    `    detail: ${q('くわしくだよ')},`,
    `    difficulty: "normal",`,
    `    date: ${q(date)},`,
    `    validFrom: "2026-10-16",`,
    `    validUntil: "2026-11-29",`,
    `    sources: [{"label": "テスト(10/1)", "url": "https://example.com/a"}],`,
    '  },',
  ].join('\n');
}
const SYNTH_QUESTIONS = [
  ['synth-0914-1', '2026-09-17', '  // 前置きのコメント(この問題と一緒に移る)'], ['synth-0914-2', '2026-09-18'],
  ['synth-1005-1', '2026-10-06'], ['synth-1005-2', '2026-10-08'], ['synth-1005-3', '2026-10-09'],
  ['synth-1012-1', '2026-10-13'], ['synth-1012-2', '2026-10-14'], ['synth-1012-3', '2026-10-16'],
];
const SYNTH_ARCHIVE = [['synth-old-1', '2026-08-10'], ['synth-old-2', '2026-08-20']];

// 配列(`const NAME = [` から `];` まで)の中身を、body に置き換える。body が空なら、空の配列(multi: 複数行 / それ以外: 1行)
function replaceArray(html, name, body, emptyStyle) {
  const mark = `const ${name} = [`;
  const start = html.indexOf(mark);
  assert.ok(start >= 0, name);
  const open = start + mark.length;
  const end = html.startsWith('];', open) ? open + 2 : html.indexOf('\n];', open) + 3;
  const text = body ? `${mark}\n${body}\n];` : emptyStyle === 'multi' ? `${mark}\n];` : `${mark}];`;
  return html.slice(0, start) + text + html.slice(end);
}

// テスト用の index.html のコピーを作る。既定は、本物の骨組みに、合成の問題を差し替えたもの(NEWS_ARCHIVE は1行で空)。
//   archive: 'empty'(1行で空) / 'multi'(複数行で空) / 'items'(合成の過去の問題が2問) / opts.real: 本物のデータのまま
function htmlCopy(eol, opts = {}) {
  let html = fs.readFileSync(REAL_HTML, 'utf8').replace(/\r\n/g, '\n');
  if (!opts.real) {
    html = replaceArray(html, 'NEWS_QUESTIONS', SYNTH_QUESTIONS.map(([id, d, lead]) => synthItem(id, d, lead)).join('\n'));
    const a = opts.archive || 'empty';
    html = replaceArray(html, 'NEWS_ARCHIVE', a === 'items' ? SYNTH_ARCHIVE.map(([id, d]) => synthItem(id, d)).join('\n') : '', a === 'multi' ? 'multi' : 'one');
  }
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
  const { r } = runApply(file, [cand(1), cand(2, { wrongs: ['a', 'b'] })]);
  assert.equal(r.status, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('apply: 最後の要素の末尾にカンマがなくても足せる', () => {
  const file = htmlCopy('lf');
  const text = fs.readFileSync(file, 'utf8');
  const stripped = text.replace(/\},\n\];\n\/\/ 過去の時事問題/, '}\n];\n// 過去の時事問題');
  assert.notEqual(stripped, text, '前提: カンマを外せた');
  fs.writeFileSync(file, stripped, 'utf8');
  const { r } = runApply(file, [cand(1)]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(loadCopy(file).NEWS_QUESTIONS.some((n) => n.id === cand(1).id));
});

test('本物の index.html は、このテストで書き換わらない', () => {
  const before = fs.readFileSync(REAL_HTML, 'utf8');
  const file = htmlCopy('crlf', { real: true });
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

test('check: 出典のドメインの許可リストと、新しい出典の条件', () => {
  const cands = tenGood();
  const src = (u1, u2) => [{ label: 'a', url: u1 }, { label: 'b', url: u2 }];
  // [出典1, 出典2, 合格するか, 理由に含まれる語]
  const cases = [
    ['https://evil.example.net/a', 'https://www.jpx.co.jp/b', false, /許可リストにないドメイン/], // 許可リスト外を含む
    ['https://www.nikkei.com/a', 'https://www.asahi.com/b', true], // (a) 報道2社
    ['https://www.nikkei.com/a', 'https://www.nikkei.com/b', false, /2件未満/], // 同じドメインの2ページ
    ['https://www.nikkei.com/a', 'https://s.nikkei.com/b', false, /2件未満/], // サブドメイン違いも同じドメイン
    ['https://prtimes.jp/main/html/rd/p/1.html', 'https://www.nikkei.com/b', true], // (b) 配信サービス+報道
    ['https://prtimes.jp/a', 'https://www.atpress.ne.jp/b', false, /組み合わせ/], // 配信サービスだけ2件
    ['https://www.jpx.co.jp/a', 'https://www.nikkei.com/b', true], // (c) 取引所+報道
    ['https://www.nikkei.com/a', 'https://example.co.jp/ir/news/1', true], // 会社 IR(/ir)+報道
    ['https://ir.example.co.jp/news', 'https://prtimes.jp/a', true], // ir. サブドメイン+配信サービス
    ['https://www.jpx.co.jp/a', 'https://www.jpx.co.jp/b', false, /2件未満/], // 一次情報でも同じドメインは1件
    ['https://www.nikkei.com/a', 'https://example.co.jp/company/news', false, /許可リストにないドメイン/], // 会社のサイトだが /ir でない
    ['https://www.nikkei.com/a', 'https://www.fsa.go.jp/news/x', true], // 官公庁+報道
    ['https://notnikkei.com/a', 'https://www.jpx.co.jp/b', false, /許可リストにないドメイン/], // 似たドメイン
    ['https://www.nikkei.com/a', 'https://192.168.0.1/ir/x', false, /ホスト名/], // IP
    ['http://www.nikkei.com/a', 'https://www.asahi.com/b', false, /形式/], // http
  ];
  const list = cases.map((c, i) => ({ ...cand(i + 1, { id: `2026-10-13-src-${i}` }), sources: src(c[0], c[1]) }));
  // 偏り(正解が最長)で落ちないよう、全問を同じ形にして、出典だけを変える
  // 1回の最大(12問)を超えないよう、2回に分けて検査する
  const part = (xs) => runCheck(xs, verdicts(xs), ['--min', '1']).rejected;
  const res = { rejected: [...part(list.slice(0, 8)), ...part(list.slice(8))] };
  cases.forEach((c, i) => {
    const rj = res.rejected.find((x) => x.id === list[i].id);
    if (c[2]) assert.ok(!rj || !rj.reasons.some((r) => /出典/.test(r)), `${i} は出典で落ちない: ${rj && rj.reasons}`);
    else {
      assert.ok(rj, `${i} は落ちる`);
      assert.match(rj.reasons.join(), c[3], `${i}`);
    }
  });
});

test('check: 配信サービスのドメインは別の区分(wire)で許可される', () => {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'news-quiz', 'allowed-domains.json'), 'utf8'));
  for (const host of ['prtimes.jp', 'kyodonewsprwire.jp', 'businesswire.com', 'atpress.ne.jp']) assert.ok(d.wire.includes(host), host);
  assert.ok(!d.news.includes('prtimes.jp'));
  assert.ok(d.primary.includes('jpx.co.jp') && d.news.includes('nikkei.com')); // 既存の区分はそのまま
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

// ---- 過去の問題への移動(archive-news) と、難易度・期間なしの新しい書き方 ----
const ARCHIVE = path.join(ROOT, 'scripts', 'news-quiz', 'archive-news.mjs');

test('apply: 難易度・validFrom・validUntil を書かずに足す(あっても書かない)', () => {
  const file = htmlCopy('lf');
  const { r } = runApply(file, [cand(1, { difficulty: 'hard', validFrom: '2026-10-19', validUntil: '2026-11-15' })]);
  assert.equal(r.status, 0, r.stderr);
  const text = fs.readFileSync(file, 'utf8');
  const from = text.indexOf(`id: "${cand(1).id}"`);
  const block = text.slice(from, text.indexOf('  },', from));
  assert.ok(!/difficulty|validFrom|validUntil/.test(block), block);
  assert.ok(/date: "2026-10-/.test(block));
  assert.ok(loadCopy(file).NEWS_QUESTIONS.some((n) => n.id === cand(1).id));
});

test('apply: 過去の問題(NEWS_ARCHIVE)にある id は足さない', () => {
  const file = htmlCopy('lf');
  runApply(file, [cand(1)]);
  assert.equal(runArchive(file, '2026-12-28').out.moved >= 1, true);
  const { out } = runApply(file, [cand(1), cand(2)]);
  assert.deepEqual(out.ids, [cand(2).id]);
});

test('check: 過去の問題(NEWS_ARCHIVE)にある id も重複で落ちる', () => {
  const file = htmlCopy('lf');
  runArchive(file, '2026-12-28'); // 全部過去へ
  const L = loadCopy(file);
  assert.ok(L.NEWS_ARCHIVE.length > 0);
  const cands = tenGood();
  cands[0] = { ...cands[0], id: L.NEWS_ARCHIVE[0].id };
  const res = runCheck(cands, verdicts(cands), ['--html', file]);
  assert.ok(res.rejected.some((x) => /既存の問題と重複/.test(x.reasons.join())));
  assert.equal(res.accepted.length, 9);
});

function runArchive(file, today, extra = []) {
  const r = spawnSync(process.execPath, [ARCHIVE, '--today', today, '--file', file, ...extra], { encoding: 'utf8' });
  const last = r.stdout.trim().split('\n').pop();
  return { r, out: last ? JSON.parse(last) : null };
}

for (const eol of ['lf', 'crlf']) {
  test(`archive(${eol}): 4週より古い週の問題だけを、元の書き方のまま NEWS_ARCHIVE の末尾へ移す`, () => {
    const file = htmlCopy(eol, { archive: 'items' });
    const orig = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const L0 = loadCopy(file);
    const byWeek = (w) => L0.NEWS_QUESTIONS.filter((n) => L0.weekStartOf(n.date) === w).map((n) => n.id);
    assert.ok(byWeek('2026-09-14').length >= 1 && byWeek('2026-10-05').length >= 1, '前提: 週ごとの問題がある');
    // 2026-11-02(月)は、その週の月曜から28日前が 10/5。9/14 の週は移り、10/5 の週は残る
    const { r, out } = runArchive(file, '2026-11-02');
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(out.ids.slice().sort(), byWeek('2026-09-14').slice().sort());
    assert.equal(out.moved, out.ids.length);
    const L = loadCopy(file);
    assert.deepEqual(L.NEWS_ARCHIVE.map((n) => n.id), ['synth-old-1', 'synth-old-2', ...out.ids]); // 先にあった過去の問題の後ろに足す
    assert.equal(L.NEWS_QUESTIONS.length + L.NEWS_ARCHIVE.length, L0.NEWS_QUESTIONS.length + L0.NEWS_ARCHIVE.length);
    const a = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'); // 問題のすぐ前のコメント行も、一緒に移る(残らない)
    const qStart = a.indexOf('const NEWS_QUESTIONS = ['), aStart = a.indexOf('const NEWS_ARCHIVE = [');
    const comment = '// 前置きのコメント(この問題と一緒に移る)';
    assert.ok(!a.slice(qStart, aStart).includes(comment) && a.slice(aStart).includes(comment));
    assert.ok(L.NEWS_QUESTIONS.every((n) => !out.ids.includes(n.id)));
    const text = fs.readFileSync(file, 'utf8');
    for (const n of [...L.NEWS_QUESTIONS, ...L.NEWS_ARCHIVE]) assert.equal(L.validateNewsItem(n), null);
    // 元の書き方(difficulty などの行もそのまま)で移る
    const blockOf = (src, id) => { const i = src.indexOf(`    id: "${id}",`); return src.slice(src.lastIndexOf('  {\n', i), src.indexOf('  },\n', i) + 5); };
    for (const id of out.ids) {
      const archiveStart = a.indexOf('const NEWS_ARCHIVE = [');
      assert.equal(blockOf(a.slice(archiveStart), id), blockOf(orig, id), id);
    }
    // 改行コードと目印コメントが保たれる
    if (eol === 'crlf') assert.ok(!/(?<!\r)\n/.test(text), 'CRLF のファイルに LF だけの行ができた');
    else assert.ok(!text.includes('\r'), 'LF のファイルに CR が入った');
    for (const m of ['DATA-START', 'DATA-END', 'LOGIC-START', 'LOGIC-END', 'UI-START', 'UI-END']) assert.ok(text.includes(`// ==${m}==`), m);
    // 冪等: もう一度動かしても、何も変わらない
    const once = fs.readFileSync(file, 'utf8');
    const again = runArchive(file, '2026-11-02');
    assert.equal(again.out.moved, 0);
    assert.equal(fs.readFileSync(file, 'utf8'), once);
  });
}

test('archive: 週の境界(同じ週の中では分けない・前の週の日曜までは移る)', () => {
  const file = htmlCopy('lf');
  // 10/5 の週は、2026-11-08(日)の実行ではまだ残り、11-09(月)の実行で移る
  const L0 = loadCopy(file);
  const wk = (w) => L0.NEWS_QUESTIONS.filter((n) => L0.weekStartOf(n.date) === w).length;
  const a = runArchive(file, '2026-11-08');
  assert.equal(a.out.moved, wk('2026-09-14'));
  const b = runArchive(file, '2026-11-09');
  assert.equal(b.out.moved, wk('2026-10-05'));
  assert.equal(loadCopy(file).NEWS_QUESTIONS.every((n) => L0.weekStartOf(n.date) === '2026-10-12'), true);
  // 実行日が古ければ何も移さない
  const file2 = htmlCopy('lf');
  const before = fs.readFileSync(file2, 'utf8');
  assert.equal(runArchive(file2, '2026-10-12').out.moved, 0);
  assert.equal(fs.readFileSync(file2, 'utf8'), before);
  // --weeks で週の数を変えられる
  assert.equal(runArchive(file2, '2026-10-20', ['--weeks', '1']).out.moved, wk('2026-09-14') + wk('2026-10-05'));
});

test('archive: NEWS_ARCHIVE が複数行で空([ と ];)・1行で空([];)・すでに問題があるときも動き、末尾に足す', () => {
  // 複数行で空
  const f1 = htmlCopy('lf', { archive: 'multi' });
  assert.ok(fs.readFileSync(f1, 'utf8').includes('const NEWS_ARCHIVE = [\n];'));
  const r1 = runArchive(f1, '2026-11-09');
  assert.equal(r1.r.status, 0, r1.r.stderr);
  assert.ok(r1.out.moved > 0);
  assert.equal(loadCopy(f1).NEWS_ARCHIVE.length, r1.out.moved);
  // すでに問題があるときは、その後ろに足す(先の問題の順は変わらない)
  const f2 = htmlCopy('crlf');
  assert.ok(fs.readFileSync(f2, 'utf8').includes('const NEWS_ARCHIVE = [];'));
  const s1 = runArchive(f2, '2026-11-02');
  const first = loadCopy(f2).NEWS_ARCHIVE.map((n) => n.id);
  const s2 = runArchive(f2, '2026-11-09');
  assert.ok(s1.out.moved > 0 && s2.out.moved > 0);
  assert.deepEqual(loadCopy(f2).NEWS_ARCHIVE.map((n) => n.id).slice(0, first.length), first);
  assert.equal(loadCopy(f2).NEWS_ARCHIVE.length, s1.out.moved + s2.out.moved);
  // 全部移して、NEWS_QUESTIONS が空になっても読める。その後、追加(apply)もできる
  const f3 = htmlCopy('lf');
  runArchive(f3, '2027-03-01');
  const L3 = loadCopy(f3);
  assert.equal(L3.NEWS_QUESTIONS.length, 0);
  assert.equal(L3.NEWS_PUBLIC, false);
  const ap = runApply(f3, [cand(1)]);
  assert.equal(ap.r.status, 0, ap.r.stderr);
  assert.deepEqual(loadCopy(f3).NEWS_QUESTIONS.map((n) => n.id), [cand(1).id]);
  // NEWS_QUESTIONS が1行で空([];)でも、何も移さず成功する
  const f4 = htmlCopy('lf');
  let t = fs.readFileSync(f4, 'utf8');
  const st = t.indexOf('const NEWS_QUESTIONS = [');
  t = t.slice(0, st) + 'const NEWS_QUESTIONS = [];' + t.slice(t.indexOf('\n];', st) + 3);
  fs.writeFileSync(f4, t, 'utf8');
  const r4 = runArchive(f4, '2026-11-09');
  assert.equal(r4.r.status, 0, r4.r.stderr);
  assert.equal(r4.out.moved, 0);
});

test('archive: すでに過去にある id は二重に移さず、元から消すだけ(問題は消えない)', () => {
  const file = htmlCopy('lf');
  const L0 = loadCopy(file);
  const old = L0.NEWS_QUESTIONS.filter((n) => L0.weekStartOf(n.date) === '2026-09-14');
  // 先に1問だけ、過去へ手で複製しておく
  let t = fs.readFileSync(file, 'utf8');
  const i = t.indexOf(`    id: "${old[0].id}",`);
  const block = t.slice(t.lastIndexOf('  {\n', i), t.indexOf('  },\n', i) + 5);
  t = t.replace('const NEWS_ARCHIVE = [];', `const NEWS_ARCHIVE = [\n${block.replace(/\n$/, '')}\n];`);
  fs.writeFileSync(file, t, 'utf8');
  const { r, out } = runArchive(file, '2026-11-02');
  assert.equal(r.status, 0, r.stderr);
  const L = loadCopy(file);
  assert.equal(L.NEWS_ARCHIVE.filter((n) => n.id === old[0].id).length, 1);
  assert.equal(L.NEWS_ARCHIVE.length, old.length);
  assert.ok(L.NEWS_QUESTIONS.every((n) => !old.some((o) => o.id === n.id)));
  assert.equal(out.moved, old.length);
});

test('archive: 失敗したら何も書かない(想定外の行・今日が不正・NEWS_ARCHIVE がない)', () => {
  const file = htmlCopy('lf');
  const before = fs.readFileSync(file, 'utf8');
  assert.equal(runArchive(file, 'あした').r.status, 1);
  assert.equal(spawnSync(process.execPath, [ARCHIVE, '--file', file], { encoding: 'utf8' }).status, 1); // --today がない
  // 要素の外に、想定外の行がある
  const broken = before.replace('const NEWS_QUESTIONS = [\n', 'const NEWS_QUESTIONS = [\n  foo(),\n');
  assert.notEqual(broken, before);
  fs.writeFileSync(file, broken, 'utf8');
  const r = runArchive(file, '2026-11-09');
  assert.notEqual(r.r.status, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), broken);
  // 検査に通らない問題が混ざっていると、書かずに失敗する(移す問題の日付が壊れている)
  const file2 = htmlCopy('lf');
  const t = fs.readFileSync(file2, 'utf8');
  const bad = t.replace('wrongs: [', 'wrongs: [""," ", ', 1);
  fs.writeFileSync(file2, bad, 'utf8');
  const r2 = runArchive(file2, '2027-03-01');
  assert.notEqual(r2.r.status, 0);
  assert.equal(fs.readFileSync(file2, 'utf8'), bad);
});

test('本物の index.html: 移動の前提(NEWS_ARCHIVE があり、要素は archive-news が読める形。データの中身には頼らない)', () => {
  const file = htmlCopy('crlf', { real: true });
  const r = runArchive(file, '2027-03-01'); // 全部移せる(読めない形の要素がない)
  assert.equal(r.r.status, 0, r.r.stderr);
  assert.equal(loadCopy(file).NEWS_QUESTIONS.length, 0);
  assert.ok(Array.isArray(loadLogic().NEWS_ARCHIVE));
  const L = loadCopy(file);
  assert.equal(L.NEWS_QUESTIONS.length, 0);
  assert.ok(L.NEWS_ARCHIVE.length >= 0);
});

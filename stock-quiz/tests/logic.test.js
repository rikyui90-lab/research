const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLogic } = require('./load-logic');

test('index.html のデータとロジックを読み込める', () => {
  assert.doesNotThrow(() => loadLogic());
});

const L = loadLogic();

test('createRng: 同じシードなら同じ列になる', () => {
  const a = L.createRng(42);
  const b = L.createRng(42);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

test('createRng: 違うシードなら違う列になる', () => {
  assert.notEqual(L.createRng(1)(), L.createRng(2)());
});

test('createRng: シードが 0・負数・巨大な値でも 0 以上 1 未満で再現できる', () => {
  for (const seed of [0, -1, -123456, 2 ** 31, 2 ** 40, 1e15]) {
    const a = L.createRng(seed);
    const b = L.createRng(seed);
    for (let i = 0; i < 50; i++) {
      const v = a();
      assert.ok(v >= 0 && v < 1, `seed=${seed} v=${v}`);
      assert.equal(v, b());
    }
  }
});

test('shuffle: 要素が変わらず、元の配列を変更せず、同じシードで同じ順になる', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const copy = src.slice();
  const out = L.shuffle(src, L.createRng(7));
  assert.deepEqual(src, copy);
  assert.deepEqual(out.slice().sort((x, y) => x - y), copy);
  assert.deepEqual(out, L.shuffle(src, L.createRng(7)));
});

test('normalizeRange: 通常の値では min < max で、全部の値を含む', () => {
  const r = L.normalizeRange([10, 20, 30]);
  assert.ok(r.min < 10 && r.max > 30);
});

test('normalizeRange: 全部同じ値でも min < max になる(0割りしない)', () => {
  const r = L.normalizeRange([50, 50, 50]);
  assert.ok(r.min < r.max);
  assert.ok(Number.isFinite(r.min) && Number.isFinite(r.max));
});

test('normalizeRange: 値が1つでも min < max になる', () => {
  const r = L.normalizeRange([5]);
  assert.ok(r.min < r.max);
});

test('PATTERNS: 11個あり、id と name が重複せず、定義が正しい', () => {
  assert.equal(L.PATTERNS.length, 11);
  assert.equal(new Set(L.PATTERNS.map((p) => p.id)).size, 11);
  assert.equal(new Set(L.PATTERNS.map((p) => p.name)).size, 11);
  for (const p of L.PATTERNS) {
    assert.ok(['up', 'down', 'flat'].includes(p.outlook), p.id);
    assert.ok(p.explanation.length > 0, p.id);
    assert.equal(p.points[0][0], 0, p.id);
    assert.equal(p.points[p.points.length - 1][0], 1, p.id);
    for (let i = 1; i < p.points.length; i++) {
      assert.ok(p.points[i][0] > p.points[i - 1][0], `${p.id}: t が増えていない`);
    }
  }
});

test('generateSeries: 長さ 60 で、同じシードなら同じ、違うシードなら違う', () => {
  for (const p of L.PATTERNS) {
    const a = L.generateSeries(p, 123);
    assert.equal(a.length, L.SERIES_LENGTH);
    assert.deepEqual(a, L.generateSeries(p, 123));
    assert.notDeepEqual(a, L.generateSeries(p, 124));
  }
});

test('generateSeries: 骨格の形に沿っている(ダブルトップは山が2つで高さがほぼ同じ)', () => {
  const p = L.findPattern('double-top');
  const v = L.generateSeries(p, 5);
  const peak1 = Math.max(...v.slice(10, 30));
  const peak2 = Math.max(...v.slice(31, 50));
  assert.ok(Math.abs(peak1 - peak2) < 6, `peak1=${peak1} peak2=${peak2}`);
  assert.ok(Math.min(...v.slice(28, 36)) < peak1 - 15);
});

test('generateContinuation: 長さ 15 で、方向が outlook と一致する', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const up = L.generateContinuation(50, 'up', seed);
    const down = L.generateContinuation(50, 'down', seed);
    const flat = L.generateContinuation(50, 'flat', seed);
    assert.equal(up.length, L.CONTINUATION_LENGTH);
    assert.ok(up[up.length - 1] > 50 + 5, `up seed=${seed}`);
    assert.ok(down[down.length - 1] < 50 - 5, `down seed=${seed}`);
    assert.ok(Math.abs(flat[flat.length - 1] - 50) < 6, `flat seed=${seed}`);
  }
});

test('generateContinuation: 同じシードなら同じ', () => {
  assert.deepEqual(
    L.generateContinuation(50, 'up', 9),
    L.generateContinuation(50, 'up', 9)
  );
});

test('movingAverage: 先頭は null で、平均が正しい', () => {
  const ma = L.movingAverage([1, 2, 3, 4, 5], 3);
  assert.deepEqual(ma, [null, null, 2, 3, 4]);
});

test('ゴールデンクロス: 途中で短期が長期の下にあり、最後は上にある', () => {
  const p = L.findPattern('golden-cross');
  for (let seed = 1; seed <= 20; seed++) {
    const v = L.generateSeries(p, seed);
    const s = L.movingAverage(v, L.MA_SHORT);
    const l = L.movingAverage(v, L.MA_LONG);
    const last = v.length - 1;
    assert.ok(s[last] > l[last], `seed=${seed} 最後は短期が上`);
    assert.ok(s.some((x, i) => x !== null && l[i] !== null && x < l[i]), `seed=${seed} 途中は短期が下`);
  }
});

test('デッドクロス: 途中で短期が長期の上にあり、最後は下にある', () => {
  const p = L.findPattern('dead-cross');
  for (let seed = 1; seed <= 20; seed++) {
    const v = L.generateSeries(p, seed);
    const s = L.movingAverage(v, L.MA_SHORT);
    const l = L.movingAverage(v, L.MA_LONG);
    const last = v.length - 1;
    assert.ok(s[last] < l[last], `seed=${seed} 最後は短期が下`);
    assert.ok(s.some((x, i) => x !== null && l[i] !== null && x > l[i]), `seed=${seed} 途中は短期が上`);
  }
});

test('findPattern: 存在しない id は例外', () => {
  assert.throws(() => L.findPattern('nothing'));
});

test('MODES と MODE_LABELS が揃っている', () => {
  assert.deepEqual(L.MODES, ['all', 'pattern', 'outlook', 'candle', 'term']);
  for (const m of L.MODES) assert.ok(L.MODE_LABELS[m], m);
});

test('CANDLE_PATTERNS: 10個で、ローソク足の値が矛盾していない', () => {
  assert.equal(L.CANDLE_PATTERNS.length, 10);
  assert.equal(new Set(L.CANDLE_PATTERNS.map((c) => c.id)).size, 10);
  assert.equal(new Set(L.CANDLE_PATTERNS.map((c) => c.name)).size, 10);
  for (const c of L.CANDLE_PATTERNS) {
    assert.ok(c.candles.length >= 1 && c.candles.length <= 3, c.id);
    for (const k of c.candles) {
      assert.ok(k.h >= Math.max(k.o, k.c), `${c.id}: 高値が低い`);
      assert.ok(k.l <= Math.min(k.o, k.c), `${c.id}: 安値が高い`);
    }
  }
});

test('TERMS: 20個で、id が重複せず、間違いの選択肢が3つある', () => {
  assert.equal(L.TERMS.length, 20);
  assert.equal(new Set(L.TERMS.map((t) => t.id)).size, 20);
  for (const t of L.TERMS) {
    assert.equal(t.wrongs.length, 3, t.id);
    assert.ok(t.explanation.length > 0, t.id);
  }
});

test('makePatternQuestion: 4択で、正解が1つだけ含まれ、チャートが作れる', () => {
  for (const p of L.PATTERNS) {
    const q = L.makePatternQuestion(p, 11);
    assert.equal(L.validateQuestion(q), null);
    assert.equal(q.answer, p.name);
    assert.equal(q.patternName, p.name);
    assert.equal(L.chartForQuestion(q).values.length, L.SERIES_LENGTH);
  }
});

test('makePatternQuestion: 同じシードなら同じ問題', () => {
  const p = L.PATTERNS[0];
  assert.deepEqual(L.makePatternQuestion(p, 3), L.makePatternQuestion(p, 3));
});

test('makeOutlookQuestion: 3択固定順で、正解が outlook に対応し、続きの方向が一致する', () => {
  for (const p of L.PATTERNS) {
    const q = L.makeOutlookQuestion(p, 21);
    assert.equal(L.validateQuestion(q), null);
    assert.deepEqual(q.choices, ['上がりやすい', '下がりやすい', '横ばい']);
    assert.equal(q.answer, L.OUTLOOK_LABELS[p.outlook]);
    assert.equal(q.patternName, p.name);
    const chart = L.chartForQuestion(q);
    const last = chart.values[chart.values.length - 1];
    const end = chart.continuation[chart.continuation.length - 1];
    if (p.outlook === 'up') assert.ok(end > last + 5, p.id);
    if (p.outlook === 'down') assert.ok(end < last - 5, p.id);
    if (p.outlook === 'flat') assert.ok(Math.abs(end - last) < 6, p.id);
  }
});

test('chartForQuestion: 移動平均線つきのパターンだけ ma を持つ', () => {
  const gc = L.chartForQuestion(L.makePatternQuestion(L.findPattern('golden-cross'), 1));
  assert.equal(gc.ma.short.length, L.SERIES_LENGTH);
  assert.equal(gc.ma.long.length, L.SERIES_LENGTH);
  const dt = L.chartForQuestion(L.makePatternQuestion(L.findPattern('double-top'), 1));
  assert.equal(dt.ma, undefined);
});

test('makeCandleQuestion: 4択で、チャートはローソク足', () => {
  for (const c of L.CANDLE_PATTERNS) {
    const q = L.makeCandleQuestion(c, L.createRng(5));
    assert.equal(L.validateQuestion(q), null);
    assert.equal(q.answer, c.name);
    const chart = L.chartForQuestion(q);
    assert.equal(chart.kind, 'candles');
    assert.deepEqual(chart.candles, c.candles);
  }
});

test('makeTermQuestion: 4択で、チャートなし', () => {
  for (const t of L.TERMS) {
    const q = L.makeTermQuestion(t, L.createRng(5));
    assert.equal(L.validateQuestion(q), null);
    assert.equal(L.chartForQuestion(q), null);
  }
});

test('validateQuestion: 不正な問題を見つける', () => {
  const ok = L.makeTermQuestion(L.TERMS[0], L.createRng(1));
  assert.equal(L.validateQuestion(ok), null);
  assert.ok(L.validateQuestion({ ...ok, choices: ok.choices.slice(0, 3) }));
  assert.ok(L.validateQuestion({ ...ok, choices: [ok.choices[0], ok.choices[0], ok.choices[1], ok.choices[2]] }));
  assert.ok(L.validateQuestion({ ...ok, answer: '存在しない答え' }));
  assert.ok(L.validateQuestion({ ...ok, type: 'unknown' }));
  assert.ok(L.validateQuestion({ ...ok, explanation: '' }));
});

test('buildDeck: どのモードでも10問で、問題が重複せず、全部有効', () => {
  for (const mode of L.MODES) {
    for (let seed = 1; seed <= 30; seed++) {
      const deck = L.buildDeck(mode, seed);
      assert.equal(deck.length, L.ROUND_SIZE, `${mode} seed=${seed}`);
      assert.equal(new Set(deck.map((q) => q.id)).size, deck.length, `${mode} seed=${seed} 重複`);
      for (const q of deck) assert.equal(L.validateQuestion(q), null);
    }
  }
});

test('buildDeck: モードごとの問題の種類が合っている', () => {
  for (const mode of ['pattern', 'outlook', 'candle', 'term']) {
    for (const q of L.buildDeck(mode, 3)) assert.equal(q.type, mode);
  }
  const types = new Set();
  for (let seed = 1; seed <= 10; seed++) L.buildDeck('all', seed).forEach((q) => types.add(q.type));
  assert.equal(types.size, 4);
});

test('buildDeck: 同じシードなら同じ、違うシードなら違う順番', () => {
  assert.deepEqual(L.buildDeck('all', 8), L.buildDeck('all', 8));
  assert.notDeepEqual(L.buildDeck('all', 8).map((q) => q.id), L.buildDeck('all', 9).map((q) => q.id));
});

test('judge: 正解の選択肢だけ true', () => {
  const q = L.buildDeck('term', 1)[0];
  assert.equal(L.judge(q, q.answer), true);
  for (const c of q.choices.filter((x) => x !== q.answer)) assert.equal(L.judge(q, c), false);
});

test('summarizeRound: 正解数と間違えた問題を数える', () => {
  const results = [
    { id: 'a', question: 'Qa', answer: 'A', picked: 'A', correct: true },
    { id: 'b', question: 'Qb', answer: 'B', picked: 'X', correct: false },
    { id: 'c', question: 'Qc', answer: 'C', picked: 'C', correct: true },
  ];
  const s = L.summarizeRound(results);
  assert.equal(s.total, 3);
  assert.equal(s.correct, 2);
  assert.deepEqual(s.wrong.map((r) => r.id), ['b']);
});

test('defaultStats: 全モードが0で始まる', () => {
  const s = L.defaultStats();
  for (const m of L.MODES) {
    assert.equal(s.best[m], 0);
    assert.deepEqual(s.played[m], { correct: 0, total: 0 });
  }
});

test('updateStats: 最高スコアは大きいほうが残り、正解率は積み上がり、元は変わらない', () => {
  const s0 = L.defaultStats();
  const s1 = L.updateStats(s0, 'term', 7, 10);
  const s2 = L.updateStats(s1, 'term', 4, 10);
  assert.equal(s0.best.term, 0);
  assert.equal(s1.best.term, 7);
  assert.equal(s2.best.term, 7);
  assert.deepEqual(s2.played.term, { correct: 11, total: 20 });
  assert.deepEqual(s2.played.pattern, { correct: 0, total: 0 });
});

test('parseStats: 保存した値をそのまま読める', () => {
  const s = L.updateStats(L.defaultStats(), 'all', 8, 10);
  assert.deepEqual(L.parseStats(JSON.stringify(s)), s);
});

test('parseStats: 壊れた入力は初期値に戻る', () => {
  const bad = [null, undefined, '', 'not json', '{', '[]', '123', '"x"', 'null',
    '{"best":1,"played":2}', '{"best":{"all":"x"},"played":{"all":{"correct":5,"total":2}}}',
    '{"best":{"all":-3},"played":{"all":{"correct":-1,"total":2}}}'];
  for (const text of bad) {
    assert.deepEqual(L.parseStats(text), L.defaultStats(), String(text));
  }
});

test('parseStats: 一部だけ正しい入力は、正しい部分だけ使う', () => {
  const s = L.parseStats('{"best":{"all":6,"term":"x"},"played":{"all":{"correct":3,"total":5}}}');
  assert.equal(s.best.all, 6);
  assert.equal(s.best.term, 0);
  assert.deepEqual(s.played.all, { correct: 3, total: 5 });
});

test('formatShareText: モード名と正解数が入る', () => {
  const t = L.formatShareText('pattern', 7, 10);
  assert.ok(t.includes('形の名前') && t.includes('7') && t.includes('10'));
});

test("buildDeck('all'): 同じ形の「形の名前」と「値動き」が同じ回に出ない", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const ids = L.buildDeck('all', seed).map((q) => q.id);
    for (const id of ids.filter((i) => i.startsWith('pattern:'))) {
      assert.ok(!ids.includes('outlook:' + id.slice('pattern:'.length)), `seed=${seed} ${id}`);
    }
  }
});

test("buildDeck('all'): 10問・重複なし・有効で、同じシードなら同じ", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const deck = L.buildDeck('all', seed);
    assert.equal(deck.length, 10);
    assert.equal(new Set(deck.map((q) => q.id)).size, 10);
    deck.forEach((q) => assert.equal(L.validateQuestion(q), null));
    assert.deepEqual(deck, L.buildDeck('all', seed));
  }
});

test("buildDeck('all'): 形の名前も値動きも、たくさんの回のどこかには出る", () => {
  const types = new Set();
  for (let seed = 1; seed <= 40; seed++) L.buildDeck('all', seed).forEach((q) => types.add(q.type));
  assert.ok(types.has('pattern') && types.has('outlook'));
});

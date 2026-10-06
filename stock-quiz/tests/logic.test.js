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

test('PATTERNS: 20個あり、id と name が重複せず、定義が正しい', () => {
  assert.equal(L.PATTERNS.length, 20);
  assert.equal(new Set(L.PATTERNS.map((p) => p.id)).size, 20);
  assert.equal(new Set(L.PATTERNS.map((p) => p.name)).size, 20);
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

test('generateSeries: 120点で、同じシードなら同じ、違うシードなら違う', () => {
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
  const peak1 = Math.max(...v.slice(20, 60));
  const peak2 = Math.max(...v.slice(62, 100));
  assert.ok(Math.abs(peak1 - peak2) < 6, `peak1=${peak1} peak2=${peak2}`);
  assert.ok(Math.min(...v.slice(56, 72)) < peak1 - 15);
});

test('generateContinuation: 30点で、方向が outlook と一致する', () => {
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

test('ゴールデンクロス: 途中で短期が中期の下にあり、最後は上にある', () => {
  const p = L.findPattern('golden-cross');
  for (let seed = 1; seed <= 20; seed++) {
    const v = L.generateSeries(p, seed);
    const s = L.movingAverage(v, L.MA_SHORT);
    const m = L.movingAverage(v, L.MA_MID);
    const last = v.length - 1;
    assert.ok(s[last] > m[last], `seed=${seed} 最後は短期が上`);
    assert.ok(s.some((x, i) => x !== null && m[i] !== null && x < m[i]), `seed=${seed} 途中は短期が下`);
  }
});

test('デッドクロス: 途中で短期が中期の上にあり、最後は下にある', () => {
  const p = L.findPattern('dead-cross');
  for (let seed = 1; seed <= 20; seed++) {
    const v = L.generateSeries(p, seed);
    const s = L.movingAverage(v, L.MA_SHORT);
    const m = L.movingAverage(v, L.MA_MID);
    const last = v.length - 1;
    assert.ok(s[last] < m[last], `seed=${seed} 最後は短期が下`);
    assert.ok(s.some((x, i) => x !== null && m[i] !== null && x > m[i]), `seed=${seed} 途中は短期が上`);
  }
});

test('移動平均の窓: 短期10・中期30・長期60', () => {
  assert.equal(L.MA_SHORT, 10);
  assert.equal(L.MA_MID, 30);
  assert.equal(L.MA_LONG, 60);
});

test('移動平均線を持つパターンの chart.ma は3本で、先頭の null の数が窓に合う', () => {
  for (const id of ['golden-cross', 'dead-cross']) {
    const c = L.chartForQuestion(L.makePatternQuestion(L.findPattern(id), 3));
    for (const [key, win] of [['short', L.MA_SHORT], ['mid', L.MA_MID], ['long', L.MA_LONG]]) {
      assert.equal(c.ma[key].length, L.SERIES_LENGTH, `${id} ${key}`);
      assert.equal(c.ma[key].filter((x) => x === null).length, win - 1, `${id} ${key}`);
    }
  }
  const dt = L.chartForQuestion(L.makePatternQuestion(L.findPattern('double-top'), 3));
  assert.equal(dt.ma, undefined);
});

// 符号が変わった回数。差がちょうど0(丸めで一致)の点は飛ばして、前の符号と比べる
function countCrosses(a, b) {
  let crosses = 0;
  let prev = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === null || b[i] === null) continue;
    const sign = Math.sign(a[i] - b[i]);
    if (sign === 0) continue;
    if (prev !== 0 && sign !== prev) crosses++;
    prev = sign;
  }
  return crosses;
}

test('ゴールデンクロス: 短期と中期の交差がちょうど1回で、最後は 短期 > 中期 > 長期', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const v = L.generateSeries(L.findPattern('golden-cross'), seed);
    const s = L.movingAverage(v, L.MA_SHORT);
    const m = L.movingAverage(v, L.MA_MID);
    const l = L.movingAverage(v, L.MA_LONG);
    const crosses = countCrosses(s, m);
    assert.equal(crosses, 1, `seed=${seed}`);
    const last = v.length - 1;
    assert.ok(s[last] > m[last] && m[last] > l[last], `seed=${seed} 最後の並び`);
  }
});

test('デッドクロス: 短期と中期の交差がちょうど1回で、最後は 短期 < 中期 < 長期', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const v = L.generateSeries(L.findPattern('dead-cross'), seed);
    const s = L.movingAverage(v, L.MA_SHORT);
    const m = L.movingAverage(v, L.MA_MID);
    const l = L.movingAverage(v, L.MA_LONG);
    const crosses = countCrosses(s, m);
    assert.equal(crosses, 1, `seed=${seed}`);
    const last = v.length - 1;
    assert.ok(s[last] < m[last] && m[last] < l[last], `seed=${seed} 最後の並び`);
  }
});

test('クロスの説明文: 中期と書いてあり、余分な空白がない', () => {
  for (const id of ['golden-cross', 'dead-cross']) {
    const e = L.findPattern(id).explanation;
    assert.ok(e.includes('中期'), id);
    assert.ok(!e.includes('。 '), `${id} に句点のあとの空白`);
    assert.ok(e.includes('ただしダマシも多いよ。'), id);
  }
});

test('findPattern: 存在しない id は例外', () => {
  assert.throws(() => L.findPattern('nothing'));
});

test('MODES と MODE_LABELS が揃っている', () => {
  assert.deepEqual(L.MODES, ['all', 'pattern', 'outlook', 'candle', 'term']);
  for (const m of L.MODES) assert.ok(L.MODE_LABELS[m], m);
});

test('CANDLE_PATTERNS: 20個で、ローソク足の値が矛盾していない', () => {
  assert.equal(L.CANDLE_PATTERNS.length, 20);
  assert.equal(new Set(L.CANDLE_PATTERNS.map((c) => c.id)).size, 20);
  assert.equal(new Set(L.CANDLE_PATTERNS.map((c) => c.name)).size, 20);
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
  assert.equal(gc.ma.mid.length, L.SERIES_LENGTH);
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
  assert.ok(t.includes('チャートの形状') && t.includes('7') && t.includes('10'));
});

test("buildDeck('all'): 同じ形の「チャートの形状」と「値動き」が同じ回に出ない", () => {
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

test("buildDeck('all'): チャートの形状も値動きも、たくさんの回のどこかには出る", () => {
  const types = new Set();
  for (let seed = 1; seed <= 40; seed++) L.buildDeck('all', seed).forEach((q) => types.add(q.type));
  assert.ok(types.has('pattern') && types.has('outlook'));
});

test('isConfusable: 順不同で、定義した組だけ true', () => {
  assert.equal(L.isConfusable('symmetrical-triangle', 'pennant'), true);
  assert.equal(L.isConfusable('pennant', 'symmetrical-triangle'), true);
  assert.equal(L.isConfusable('doji', 'hammer'), true);
  assert.equal(L.isConfusable('doji', 'big-bullish'), false);
  assert.equal(L.isConfusable('pennant', 'pennant'), false);
});

test('紛らわしい組は、同じ問題の選択肢に同時に出ない', () => {
  const nameOf = (id) => L.findPattern(id).name;
  const candleName = (id) => L.CANDLE_PATTERNS.find((c) => c.id === id).name;
  for (let seed = 1; seed <= 60; seed++) {
    const t = L.makePatternQuestion(L.findPattern('symmetrical-triangle'), seed);
    assert.ok(!t.choices.includes(nameOf('pennant')), `triangle seed=${seed}`);
    const p = L.makePatternQuestion(L.findPattern('pennant'), seed);
    assert.ok(!p.choices.includes(nameOf('symmetrical-triangle')), `pennant seed=${seed}`);
    for (const [a, b] of [['doji', 'hammer'], ['doji', 'shooting-star']]) {
      for (const [x, y] of [[a, b], [b, a]]) {
        const q = L.makeCandleQuestion(L.CANDLE_PATTERNS.find((c) => c.id === x), L.createRng(seed));
        assert.ok(!q.choices.includes(candleName(y)), `${x} vs ${y} seed=${seed}`);
        assert.equal(L.validateQuestion(q), null);
      }
    }
  }
});

test('三角持ち合いは値動き予想に出ない(チャートの形状には出る)', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const outlookDeck = L.buildDeck('outlook', seed);
    assert.ok(!outlookDeck.some((q) => q.patternId === 'symmetrical-triangle'), `outlook seed=${seed}`);
    const allDeck = L.buildDeck('all', seed);
    assert.ok(!allDeck.some((q) => q.type === 'outlook' && q.patternId === 'symmetrical-triangle'), `all seed=${seed}`);
  }
  let seen = false;
  for (let seed = 1; seed <= 60 && !seen; seed++) {
    seen = L.buildDeck('pattern', seed).some((q) => q.patternId === 'symmetrical-triangle');
  }
  assert.ok(seen, 'チャートの形状では出題される');
});

test('修正した形: ペナントは三角持ち合いより旗竿のあとの収束が短く、フラッグは下向きの平行', () => {
  const pennant = L.findPattern('pennant').points;
  assert.deepEqual(pennant[2], [0.6, 85]);
  const flag = L.findPattern('bull-flag').points;
  assert.deepEqual(flag[flag.length - 1], [1, 68]);
});

test('ローソク足の修正: ハンマーと流れ星は実体が小さすぎない', () => {
  const body = (id) => {
    const k = L.CANDLE_PATTERNS.find((c) => c.id === id).candles[0];
    return Math.abs(k.c - k.o) / (k.h - k.l);
  };
  assert.ok(body('hammer') >= 0.1, `hammer ${body('hammer')}`);
  assert.ok(body('shooting-star') >= 0.1, `shooting-star ${body('shooting-star')}`);
});

test('三兵: 各足は前の足の実体の内側から寄る', () => {
  for (const id of ['three-white-soldiers', 'three-black-crows']) {
    const ks = L.CANDLE_PATTERNS.find((c) => c.id === id).candles;
    for (let i = 1; i < ks.length; i++) {
      const lo = Math.min(ks[i - 1].o, ks[i - 1].c);
      const hi = Math.max(ks[i - 1].o, ks[i - 1].c);
      assert.ok(ks[i].o >= lo && ks[i].o <= hi, `${id} ${i}`);
    }
  }
});

test('用語の修正: 決算の答えと権利確定日の説明', () => {
  const earnings = L.TERMS.find((t) => t.id === 'earnings');
  assert.ok(earnings.answer.includes('確定'));
  const record = L.TERMS.find((t) => t.id === 'record-date');
  assert.ok(record.explanation.includes('権利付最終日'));
});

test('makeSpline: 骨格の点をそのまま通る', () => {
  for (const p of L.PATTERNS) {
    const f = L.makeSpline(p.points);
    for (const [t, v] of p.points) assert.ok(Math.abs(f(t) - v) < 1e-9, `${p.id} t=${t}`);
  }
});

test('makeSpline: 隣り合う点のあいだで、2点の値の範囲をはみ出さない', () => {
  for (const p of L.PATTERNS) {
    const f = L.makeSpline(p.points);
    for (let i = 1; i < p.points.length; i++) {
      const [t0, v0] = p.points[i - 1];
      const [t1, v1] = p.points[i];
      const lo = Math.min(v0, v1) - 1e-9;
      const hi = Math.max(v0, v1) + 1e-9;
      for (let k = 0; k <= 20; k++) {
        const v = f(t0 + ((t1 - t0) * k) / 20);
        assert.ok(v >= lo && v <= hi, `${p.id} 区間${i} k=${k} v=${v}`);
      }
    }
  }
});

test('生成定数: 120点・続き30点・移動平均 10・30・60', () => {
  assert.equal(L.SERIES_LENGTH, 120);
  assert.equal(L.CONTINUATION_LENGTH, 30);
  assert.equal(L.MA_SHORT, 10);
  assert.equal(L.MA_MID, 30);
  assert.equal(L.MA_LONG, 60);
});

test('滑らかさ: 隣り合う3点の折れ曲がり(2階差)が、すべてのパターンで小さい', () => {
  const THRESHOLD = 2.65; // 実測の最大値 2.04 の約1.3倍(変更前の生成は 15.21)
  let worst = 0;
  for (const p of L.PATTERNS) {
    for (let seed = 1; seed <= 30; seed++) {
      const v = L.generateSeries(p, seed);
      for (let i = 1; i < v.length - 1; i++) {
        worst = Math.max(worst, Math.abs(v[i + 1] - 2 * v[i] + v[i - 1]));
      }
    }
  }
  assert.ok(worst < THRESHOLD, `worst=${worst}`);
});

test('続きの値動きも滑らか: 隣り合う点の差が大きくない', () => {
  for (const outlook of ['up', 'down', 'flat']) {
    for (let seed = 1; seed <= 30; seed++) {
      const c = L.generateContinuation(50, outlook, seed);
      for (let i = 1; i < c.length; i++) assert.ok(Math.abs(c[i] - c[i - 1]) < 3, `${outlook} seed=${seed}`);
    }
  }
});

test('PATTERNS: 20個で、追加した9個が揃っている', () => {
  assert.equal(L.PATTERNS.length, 20);
  for (const id of ['triple-top', 'triple-bottom', 'ascending-triangle', 'descending-triangle',
    'bear-flag', 'bear-pennant', 'cup-with-handle', 'saucer-bottom', 'box-range']) {
    assert.ok(L.findPattern(id), id);
  }
});

test('追加したパターンの outlook', () => {
  const want = { 'triple-top': 'down', 'triple-bottom': 'up', 'ascending-triangle': 'up',
    'descending-triangle': 'down', 'bear-flag': 'down', 'bear-pennant': 'down',
    'cup-with-handle': 'up', 'saucer-bottom': 'up', 'box-range': 'flat' };
  for (const [id, o] of Object.entries(want)) assert.equal(L.findPattern(id).outlook, o, id);
});

// 山の数: 前後より高い極大(ゆらぎに負けないよう、前後 W 点の最大を基準にする)
function peaks(values, W = 6, minProminence = 8) {
  const out = [];
  for (let i = W; i < values.length - W; i++) {
    const win = values.slice(i - W, i + W + 1);
    if (values[i] === Math.max(...win) && values[i] - Math.min(...win) >= minProminence) out.push(i);
  }
  return out;
}
function troughs(values, W = 6, minProminence = 8) {
  return peaks(values.map((v) => -v), W, minProminence);
}

test('トリプルトップ: 高さがそろった山が3つ', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const v = L.generateSeries(L.findPattern('triple-top'), seed);
    const ps = peaks(v);
    assert.equal(ps.length, 3, `seed=${seed} peaks=${ps}`);
    const hs = ps.map((i) => v[i]);
    assert.ok(Math.max(...hs) - Math.min(...hs) < 6, `seed=${seed}`);
  }
});

test('トリプルボトム: 深さがそろった谷が3つ', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const v = L.generateSeries(L.findPattern('triple-bottom'), seed);
    const ts = troughs(v);
    assert.equal(ts.length, 3, `seed=${seed} troughs=${ts}`);
    const hs = ts.map((i) => v[i]);
    assert.ok(Math.max(...hs) - Math.min(...hs) < 6, `seed=${seed}`);
  }
});

test('上昇三角形: 高値はほぼ水平で、安値は切り上がる', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const v = L.generateSeries(L.findPattern('ascending-triangle'), seed);
    const ps = peaks(v, 6, 6);
    const ts = troughs(v, 6, 6);
    assert.ok(ps.length >= 3, `seed=${seed} peaks=${ps}`);
    const hs = ps.map((i) => v[i]);
    assert.ok(Math.max(...hs) - Math.min(...hs) < 6, `seed=${seed} 高値が水平`);
    assert.ok(ts.length >= 2, `seed=${seed} troughs=${ts}`);
    assert.ok(v[ts[ts.length - 1]] > v[ts[0]] + 8, `seed=${seed} 安値が切り上がる`);
  }
});

test('下降三角形: 安値はほぼ水平で、高値は切り下がる', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const v = L.generateSeries(L.findPattern('descending-triangle'), seed);
    const ts = troughs(v, 6, 6);
    const ps = peaks(v, 6, 6);
    assert.ok(ts.length >= 3, `seed=${seed} troughs=${ts}`);
    const ls = ts.map((i) => v[i]);
    assert.ok(Math.max(...ls) - Math.min(...ls) < 6, `seed=${seed} 安値が水平`);
    assert.ok(ps.length >= 2, `seed=${seed} peaks=${ps}`);
    assert.ok(v[ps[ps.length - 1]] < v[ps[0]] - 8, `seed=${seed} 高値が切り下がる`);
  }
});

test('下降フラッグ: 急落のあと、上向きにゆるく戻る', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const v = L.generateSeries(L.findPattern('bear-flag'), seed);
    const n = v.length;
    const poleStart = v[Math.floor(n * 0.2)];
    const poleEnd = v[Math.floor(n * 0.6)];
    assert.ok(poleStart - poleEnd > 40, `seed=${seed} 急落`);
    assert.ok(v[n - 1] > poleEnd + 8, `seed=${seed} 戻り`);
    assert.ok(v[n - 1] < poleStart - 20, `seed=${seed} 戻りが浅い`);
  }
});

test('下降ペナント: 急落のあと、値幅が狭まる', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const v = L.generateSeries(L.findPattern('bear-pennant'), seed);
    const n = v.length;
    const early = v.slice(Math.floor(n * 0.62), Math.floor(n * 0.78));
    const late = v.slice(Math.floor(n * 0.86));
    const range = (a) => Math.max(...a) - Math.min(...a);
    assert.ok(range(late) < range(early), `seed=${seed}`);
  }
});

test('カップウィズハンドル: 左右のふちがそろい、底は深く、最後に小さな押し目', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const v = L.generateSeries(L.findPattern('cup-with-handle'), seed);
    const n = v.length;
    const left = Math.max(...v.slice(Math.floor(n * 0.04), Math.floor(n * 0.14)));
    const right = Math.max(...v.slice(Math.floor(n * 0.82), Math.floor(n * 0.9)));
    const bottom = Math.min(...v.slice(Math.floor(n * 0.4), Math.floor(n * 0.6)));
    assert.ok(Math.abs(left - right) < 6, `seed=${seed} ふち`);
    assert.ok(left - bottom > 30, `seed=${seed} 底`);
    const handle = Math.min(...v.slice(Math.floor(n * 0.88), Math.floor(n * 0.96)));
    assert.ok(right - handle > 4 && right - handle < 20, `seed=${seed} 取っ手`);
  }
});

test('ソーサーボトム: なめらかな丸い底(底の位置が中ほどで、左右が高い)', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const v = L.generateSeries(L.findPattern('saucer-bottom'), seed);
    const n = v.length;
    const minI = v.indexOf(Math.min(...v));
    assert.ok(minI > n * 0.35 && minI < n * 0.65, `seed=${seed} 底の位置 ${minI}`);
    assert.ok(v[0] - v[minI] > 25 && v[n - 1] - v[minI] > 20, `seed=${seed} 左右が高い`);
  }
});

test('ボックス圏: 上限と下限のあいだを往復する(幅が小さく、山と谷が複数)', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const v = L.generateSeries(L.findPattern('box-range'), seed);
    assert.ok(Math.max(...v) - Math.min(...v) < 30, `seed=${seed} 幅`);
    assert.ok(peaks(v, 6, 6).length >= 3, `seed=${seed} 山`);
    assert.ok(troughs(v, 6, 6).length >= 3, `seed=${seed} 谷`);
  }
});

test('追加後の出題: どのモードも10問が成立し、値動き予想の続きが outlook と一致する', () => {
  for (const mode of L.MODES) {
    for (let seed = 1; seed <= 20; seed++) {
      const deck = L.buildDeck(mode, seed);
      assert.equal(deck.length, L.ROUND_SIZE);
      for (const q of deck) assert.equal(L.validateQuestion(q), null);
    }
  }
  for (const p of L.PATTERNS.filter((x) => x.outlookQuiz !== false)) {
    const q = L.makeOutlookQuestion(p, 33);
    const c = L.chartForQuestion(q);
    const last = c.values[c.values.length - 1];
    const end = c.continuation[c.continuation.length - 1];
    if (p.outlook === 'up') assert.ok(end > last + 5, p.id);
    if (p.outlook === 'down') assert.ok(end < last - 5, p.id);
    if (p.outlook === 'flat') assert.ok(Math.abs(end - last) < 6, p.id);
  }
});

const candleOf = (id) => L.CANDLE_PATTERNS.find((c) => c.id === id).candles;
const bodyOf = (k) => Math.abs(k.c - k.o);
const rangeOf = (k) => k.h - k.l;

test('追加した10個のローソク足が揃っている', () => {
  for (const id of ['evening-star', 'bullish-harami', 'bearish-harami', 'tweezer-top', 'tweezer-bottom',
    'piercing-line', 'dark-cloud-cover', 'dragonfly-doji', 'gravestone-doji', 'spinning-top']) {
    assert.ok(L.CANDLE_PATTERNS.some((c) => c.id === id), id);
  }
});

test('宵の明星: 上に窓を空けた小さな実体のあと、1本目の実体の半分より下まで下げる', () => {
  const [a, b, c] = candleOf('evening-star');
  assert.ok(a.c > a.o && bodyOf(a) > 10, '1本目は大きな陽線');
  assert.ok(b.l > a.h, '2本目は窓を空けて上');
  assert.ok(bodyOf(b) < bodyOf(a) / 2, '2本目は小さな実体');
  assert.ok(c.c < c.o && c.c < (a.o + a.c) / 2, '3本目は1本目の半分より下まで下げる陰線');
});

test('強気のはらみ足 / 弱気のはらみ足: 2本目が1本目の実体の中に収まる', () => {
  const [a, b] = candleOf('bullish-harami');
  assert.ok(a.c < a.o && b.c > b.o);
  assert.ok(Math.max(b.o, b.c) < Math.max(a.o, a.c) && Math.min(b.o, b.c) > Math.min(a.o, a.c));
  const [c, d] = candleOf('bearish-harami');
  assert.ok(c.c > c.o && d.c < d.o);
  assert.ok(Math.max(d.o, d.c) < Math.max(c.o, c.c) && Math.min(d.o, d.c) > Math.min(c.o, c.c));
});

test('毛抜き天井 / 毛抜き底: 2本の高値(安値)が同じ', () => {
  const [a, b] = candleOf('tweezer-top');
  assert.equal(a.h, b.h);
  assert.ok(a.c > a.o && b.c < b.o);
  const [c, d] = candleOf('tweezer-bottom');
  assert.equal(c.l, d.l);
  assert.ok(c.c < c.o && d.c > d.o);
});

test('切り込み線: 前の安値より安く始まり、前の実体の半分より上まで戻すが、前の始値は超えない', () => {
  const [a, b] = candleOf('piercing-line');
  assert.ok(a.c < a.o && b.c > b.o);
  assert.ok(b.o < a.l);
  assert.ok(b.c > (a.o + a.c) / 2 && b.c < a.o);
});

test('かぶせ線: 前の高値より高く始まり、前の実体の半分より下まで押し戻すが、前の始値は割らない', () => {
  const [a, b] = candleOf('dark-cloud-cover');
  assert.ok(a.c > a.o && b.c < b.o);
  assert.ok(b.o > a.h);
  assert.ok(b.c < (a.o + a.c) / 2 && b.c > a.o);
});

test('トンボ / 塔婆: 始値と終値が同じで、長い下ヒゲ(上ヒゲ)だけ', () => {
  const [d] = candleOf('dragonfly-doji');
  assert.equal(d.o, d.c);
  assert.ok(d.h - d.o <= rangeOf(d) * 0.1 && d.o - d.l >= rangeOf(d) * 0.7);
  const [g] = candleOf('gravestone-doji');
  assert.equal(g.o, g.c);
  assert.ok(g.o - g.l <= rangeOf(g) * 0.1 && g.h - g.o >= rangeOf(g) * 0.7);
});

test('コマ: 実体が小さく、上下にヒゲがほぼ同じくらいある', () => {
  const [k] = candleOf('spinning-top');
  assert.ok(bodyOf(k) <= rangeOf(k) * 0.25);
  const upper = k.h - Math.max(k.o, k.c);
  const lower = Math.min(k.o, k.c) - k.l;
  assert.ok(upper >= rangeOf(k) * 0.25 && lower >= rangeOf(k) * 0.25);
});

test('紛らわしいローソク足の組は、同じ問題の選択肢に同時に出ない', () => {
  const nameOf = (id) => L.CANDLE_PATTERNS.find((c) => c.id === id).name;
  const candleIds = new Set(L.CANDLE_PATTERNS.map((c) => c.id));
  const pairs = L.CONFUSABLE_PAIRS.filter(([a, b]) => candleIds.has(a) && candleIds.has(b));
  assert.ok(pairs.length >= 9);
  for (let seed = 1; seed <= 40; seed++) {
    for (const [a, b] of pairs) {
      for (const [x, y] of [[a, b], [b, a]]) {
        const q = L.makeCandleQuestion(L.CANDLE_PATTERNS.find((c) => c.id === x), L.createRng(seed));
        assert.ok(!q.choices.includes(nameOf(y)), `${x} vs ${y} seed=${seed}`);
        assert.equal(L.validateQuestion(q), null);
      }
    }
  }
});

test('追加後の出題: ローソク足モードが10問成立し、全部まぜでも有効', () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const mode of ['candle', 'all']) {
      const deck = L.buildDeck(mode, seed);
      assert.equal(deck.length, L.ROUND_SIZE);
      assert.equal(new Set(deck.map((q) => q.id)).size, deck.length);
      for (const q of deck) assert.equal(L.validateQuestion(q), null);
    }
  }
});

const NEW_CANDLE_PAIRS = [['tweezer-top', 'dark-cloud-cover'], ['tweezer-bottom', 'piercing-line'], ['bullish-harami', 'bearish-harami']];
const NEW_PATTERN_PAIRS = [['bull-flag', 'pennant'], ['bear-flag', 'bear-pennant'], ['bull-flag', 'falling-wedge'], ['bear-flag', 'rising-wedge']];

test('追加した紛らわしい組は isConfusable が true', () => {
  for (const [a, b] of [...NEW_CANDLE_PAIRS, ...NEW_PATTERN_PAIRS]) {
    assert.equal(L.isConfusable(a, b), true, `${a}/${b}`);
    assert.equal(L.isConfusable(b, a), true, `${b}/${a}`);
  }
});

test('追加した紛らわしい組は、同じ問題の選択肢に同時に出ない(両方向・シード1〜40)', () => {
  const candleName = (id) => L.CANDLE_PATTERNS.find((c) => c.id === id).name;
  for (let seed = 1; seed <= 40; seed++) {
    for (const [a, b] of NEW_CANDLE_PAIRS) {
      for (const [x, y] of [[a, b], [b, a]]) {
        const q = L.makeCandleQuestion(L.CANDLE_PATTERNS.find((c) => c.id === x), L.createRng(seed));
        assert.ok(!q.choices.includes(candleName(y)), `${x} vs ${y} seed=${seed}`);
        assert.equal(L.validateQuestion(q), null);
      }
    }
    for (const [a, b] of NEW_PATTERN_PAIRS) {
      for (const [x, y] of [[a, b], [b, a]]) {
        const q = L.makePatternQuestion(L.findPattern(x), seed);
        assert.ok(!q.choices.includes(L.findPattern(y).name), `${x} vs ${y} seed=${seed}`);
        assert.equal(L.validateQuestion(q), null);
      }
    }
  }
});

test('どのモードでも出題プールが ROUND_SIZE 以上で、値動き予想に三角持ち合いが入らない', () => {
  for (const mode of L.MODES) {
    assert.ok(L.buildPool(mode, L.createRng(1)).length >= L.ROUND_SIZE, mode);
  }
  const pool = L.buildPool('outlook', L.createRng(1));
  assert.ok(!pool.some((q) => q.patternId === 'symmetrical-triangle'));
});

test('はらみ足の名前は「強気」「弱気」で、旧名は残っていない', () => {
  const nameOfCandle = (id) => L.CANDLE_PATTERNS.find((c) => c.id === id).name;
  assert.equal(nameOfCandle('bullish-harami'), '強気のはらみ足');
  assert.equal(nameOfCandle('bearish-harami'), '弱気のはらみ足');
  const names = L.CANDLE_PATTERNS.map((c) => c.name);
  assert.ok(!names.includes('陽のはらみ足') && !names.includes('陰のはらみ足'));
});

test('トンボは始値=終値=高値、塔婆は始値=終値=安値(厳密な定義)', () => {
  const [d] = candleOf('dragonfly-doji');
  assert.ok(d.h === d.o && d.o === d.c);
  const [g] = candleOf('gravestone-doji');
  assert.ok(g.l === g.o && g.o === g.c);
});

test('毛抜き天井・底の説明に「そろう」が入っている', () => {
  for (const id of ['tweezer-top', 'tweezer-bottom']) {
    assert.ok(L.CANDLE_PATTERNS.find((c) => c.id === id).explanation.includes('そろう'), id);
  }
});

const LEVEL_TABLE = {
  patterns: {
    easy: ['double-top', 'double-bottom', 'head-shoulders', 'inverse-head-shoulders', 'golden-cross', 'dead-cross', 'box-range'],
    normal: ['triple-top', 'triple-bottom', 'symmetrical-triangle', 'ascending-triangle', 'descending-triangle', 'rising-wedge', 'falling-wedge'],
    hard: ['bull-flag', 'bear-flag', 'pennant', 'bear-pennant', 'cup-with-handle', 'saucer-bottom'],
    expert: [], // Task 2〜4 で追加する
    master: [], // Task 2〜4 で追加する
  },
  candles: {
    easy: ['big-bullish', 'big-bearish', 'doji', 'hammer', 'bullish-engulfing', 'bearish-engulfing', 'spinning-top'],
    normal: ['shooting-star', 'three-white-soldiers', 'three-black-crows', 'morning-star', 'evening-star', 'dragonfly-doji', 'gravestone-doji'],
    hard: ['bullish-harami', 'bearish-harami', 'tweezer-top', 'tweezer-bottom', 'piercing-line', 'dark-cloud-cover'],
    expert: [], // Task 2〜4 で追加する
    master: [], // Task 2〜4 で追加する
  },
  terms: {
    easy: ['market-cap', 'volume', 'market-order', 'limit-order', 'dividend-yield', 'diversification', 'nisa'],
    normal: ['per', 'pbr', 'earnings', 'nikkei-225', 'moving-average', 'golden-cross-term', 'limit-up'],
    hard: ['roe', 'stop-order', 'short-selling', 'margin-trading', 'record-date', 'ex-rights'],
    expert: [], // Task 2〜4 で追加する
    master: [], // Task 2〜4 で追加する
  },
};

test('難易度の定数と星の表示', () => {
  assert.deepEqual(L.DIFFICULTY_LEVELS, ['easy', 'normal', 'hard', 'expert', 'master']);
  assert.deepEqual(L.DIFFICULTY_FILTERS, ['all', 'easy', 'normal', 'hard', 'expert', 'master']);
  assert.deepEqual(L.DIFFICULTY_LABELS, { all: 'すべて', easy: '★', normal: '★★', hard: '★★★', expert: '★★★★', master: '★★★★★' });
  assert.equal(L.starsOf('easy'), '★');
  assert.equal(L.starsOf('normal'), '★★');
  assert.equal(L.starsOf('hard'), '★★★');
  assert.equal(L.starsOf('expert'), '★★★★');
  assert.equal(L.starsOf('master'), '★★★★★');
  L.DIFFICULTY_LEVELS.forEach((level, i) => assert.equal(L.starsAria(level), `難易度 星${i + 1}つ(5段階)`));
  assert.equal(L.MODE_LABELS.pattern, 'チャートの形状');
});

test('難易度の割り当て: 決めた表どおりで、全項目に付いている', () => {
  const pick = (items, level) => items.filter((x) => x.difficulty === level).map((x) => x.id).sort();
  for (const level of L.DIFFICULTY_LEVELS) {
    assert.deepEqual(pick(L.PATTERNS, level), LEVEL_TABLE.patterns[level].slice().sort(), `patterns ${level}`);
    assert.deepEqual(pick(L.CANDLE_PATTERNS, level), LEVEL_TABLE.candles[level].slice().sort(), `candles ${level}`);
    assert.deepEqual(pick(L.TERMS, level), LEVEL_TABLE.terms[level].slice().sort(), `terms ${level}`);
  }
  for (const x of [...L.PATTERNS, ...L.CANDLE_PATTERNS, ...L.TERMS]) {
    assert.ok(L.DIFFICULTY_LEVELS.includes(x.difficulty), x.id);
  }
});

test('問題オブジェクトに難易度が入り、validateQuestion が見る', () => {
  const p = L.findPattern('cup-with-handle');
  assert.equal(L.makePatternQuestion(p, 1).difficulty, 'hard');
  assert.equal(L.makeOutlookQuestion(p, 1).difficulty, 'hard');
  assert.equal(L.makeCandleQuestion(L.CANDLE_PATTERNS.find((c) => c.id === 'doji'), L.createRng(1)).difficulty, 'easy');
  assert.equal(L.makeTermQuestion(L.TERMS.find((t) => t.id === 'per'), L.createRng(1)).difficulty, 'normal');
  const q = L.makeTermQuestion(L.TERMS[0], L.createRng(1));
  assert.equal(L.validateQuestion(q), null);
  assert.ok(L.validateQuestion({ ...q, difficulty: 'x' }));
  assert.ok(L.validateQuestion({ ...q, difficulty: undefined }));
});

test('モード×難易度の問題数: easy/normal/hard は6問以上で表の数と合う(expert/master は0問以上)', () => {
  const expected = {
    pattern: { easy: 7, normal: 7, hard: 6 },
    outlook: { easy: 7, normal: 6, hard: 6 },
    candle: { easy: 7, normal: 7, hard: 6 },
    term: { easy: 7, normal: 7, hard: 6 },
  };
  for (const mode of L.MODES) {
    for (const level of L.DIFFICULTY_FILTERS) {
      const n = L.buildPool(mode, L.createRng(1), level).length;
      // expert / master は Task 2〜4 で問題を足すまで0問。Task 4/5 で「1問以上」と正確な数に直す
      if (level === 'expert' || level === 'master') {
        assert.ok(n >= 0, `${mode}/${level} n=${n}`);
        continue;
      }
      assert.ok(n >= 6, `${mode}/${level} n=${n}`);
      if (expected[mode] && level !== 'all') assert.equal(n, expected[mode][level], `${mode}/${level}`);
    }
  }
});

test('buildDeck: 難易度の絞り込みで、問題数・重複・難易度・有効性・決定性が合う', () => {
  for (const mode of L.MODES) {
    for (const level of L.DIFFICULTY_FILTERS) {
      const size = L.roundSize(mode, level);
      assert.equal(size, Math.min(L.ROUND_SIZE, L.buildPool(mode, L.createRng(1), level).length), `${mode}/${level}`);
      // size が 0 のとき(expert / master で問題がまだない間)は、空の配列を返し、例外を投げない
      if (size === 0) assert.deepEqual(L.buildDeck(mode, 1, level), [], `${mode}/${level}`);
      else assert.ok(size >= 1);
      for (let seed = 1; seed <= 20; seed++) {
        const deck = L.buildDeck(mode, seed, level);
        assert.equal(deck.length, size, `${mode}/${level} seed=${seed}`);
        assert.equal(new Set(deck.map((q) => q.id)).size, deck.length);
        for (const q of deck) {
          assert.equal(L.validateQuestion(q), null);
          if (level !== 'all') assert.equal(q.difficulty, level, `${mode}/${level} ${q.id}`);
        }
        assert.deepEqual(L.buildDeck(mode, seed, level), deck);
      }
    }
  }
});

test('全部まぜ+難易度: 同じ形の「名前」と「値動き」が両方出ない / 三角持ち合いは値動きに出ない', () => {
  for (const level of L.DIFFICULTY_FILTERS) {
    for (let seed = 1; seed <= 60; seed++) {
      const deck = L.buildDeck('all', seed, level);
      const byPattern = {};
      for (const q of deck) {
        if (q.type === 'pattern' || q.type === 'outlook') {
          assert.ok(!byPattern[q.patternId], `${level} seed=${seed} ${q.patternId}`);
          byPattern[q.patternId] = q.type;
        }
        assert.ok(!(q.type === 'outlook' && q.patternId === 'symmetrical-triangle'));
      }
    }
  }
});

test('buildDeck: 難易度を省略すると、これまでと同じ(all)', () => {
  for (const mode of L.MODES) {
    assert.deepEqual(L.buildDeck(mode, 5), L.buildDeck(mode, 5, 'all'));
  }
});

test('statsKey と STATS_KEYS', () => {
  assert.equal(L.statsKey('term'), 'term');
  assert.equal(L.statsKey('term', 'all'), 'term');
  assert.equal(L.statsKey('pattern', 'hard'), 'pattern:hard');
  assert.equal(L.STATS_KEYS.length, L.MODES.length * L.DIFFICULTY_FILTERS.length);
  assert.deepEqual(L.STATS_KEYS.slice(0, L.MODES.length), L.MODES);
  assert.equal(new Set(L.STATS_KEYS).size, L.STATS_KEYS.length);
});

test('保存データ: 難易度ごとのキーが使え、古い形(難易度なし)も読める', () => {
  const s0 = L.defaultStats();
  for (const k of L.STATS_KEYS) {
    assert.equal(s0.best[k], 0, k);
    assert.deepEqual(s0.played[k], { correct: 0, total: 0 }, k);
  }
  const s1 = L.updateStats(s0, L.statsKey('candle', 'hard'), 5, 6);
  assert.equal(s1.best['candle:hard'], 5);
  assert.deepEqual(s1.played['candle:hard'], { correct: 5, total: 6 });
  assert.equal(s1.best.candle, 0);
  assert.deepEqual(L.parseStats(JSON.stringify(s1)), s1);
  const old = JSON.stringify({ best: { all: 8, term: 6 }, played: { all: { correct: 20, total: 30 } } });
  const parsed = L.parseStats(old);
  assert.equal(parsed.best.all, 8);
  assert.equal(parsed.best.term, 6);
  assert.deepEqual(parsed.played.all, { correct: 20, total: 30 });
  assert.equal(parsed.best['all:hard'], 0);
});

test('formatShareText: 難易度つき', () => {
  assert.equal(L.formatShareText('pattern', 7, 10), '株クイズ(チャートの形状)で 10問中7問正解!');
  const t = L.formatShareText('pattern', 7, 10, 'normal');
  assert.ok(t.includes('チャートの形状') && t.includes('★★') && t.includes('7') && t.includes('10'));
  assert.ok(!L.formatShareText('pattern', 3, 6, 'hard').includes('すべて'));
});

test('reshuffleChoices: 選択肢の集合と正解が変わらず、元の問題を変更しない。outlook は固定順', () => {
  const deck = L.buildDeck('all', 4);
  for (const q of deck) {
    const before = JSON.stringify(q);
    const r = L.reshuffleChoices(q, L.createRng(9));
    assert.equal(JSON.stringify(q), before, '元の問題を変更しない');
    assert.deepEqual(r.choices.slice().sort(), q.choices.slice().sort());
    assert.equal(r.answer, q.answer);
    assert.equal(r.id, q.id);
    assert.equal(L.validateQuestion(r), null);
    if (q.type === 'outlook') assert.deepEqual(r.choices, q.choices);
  }
});

test('reshuffleChoices: 同じシードなら同じ並び、シードを変えると並びが変わりうる', () => {
  const q = L.buildDeck('term', 2)[0];
  assert.deepEqual(L.reshuffleChoices(q, L.createRng(3)), L.reshuffleChoices(q, L.createRng(3)));
  const orders = new Set();
  for (let s = 1; s <= 30; s++) orders.add(L.reshuffleChoices(q, L.createRng(s)).choices.join('|'));
  assert.ok(orders.size > 1);
});

test('buildRetryDeck: 間違えた問題だけを、元の並びで出す', () => {
  const deck = L.buildDeck('all', 6);
  const results = deck.map((q, i) => ({ id: q.id, correct: i % 3 !== 0 }));
  const retry = L.buildRetryDeck(deck, results, 11);
  const wrongIds = results.filter((r) => !r.correct).map((r) => r.id);
  assert.deepEqual(retry.map((q) => q.id), wrongIds);
  for (const q of retry) {
    assert.equal(L.validateQuestion(q), null);
    const orig = deck.find((d) => d.id === q.id);
    assert.equal(q.answer, orig.answer);
    assert.equal(q.difficulty, orig.difficulty);
  }
});

test('buildRetryDeck: 全問正解なら空、全問不正解なら全部、決定的', () => {
  const deck = L.buildDeck('candle', 3);
  assert.deepEqual(L.buildRetryDeck(deck, deck.map((q) => ({ id: q.id, correct: true })), 1), []);
  const allWrong = deck.map((q) => ({ id: q.id, correct: false }));
  assert.equal(L.buildRetryDeck(deck, allWrong, 1).length, deck.length);
  assert.deepEqual(L.buildRetryDeck(deck, allWrong, 1), L.buildRetryDeck(deck, allWrong, 1));
});

test('buildRetryDeck: やり直しの結果からさらに絞れる(続けてやり直せる)', () => {
  const deck = L.buildDeck('term', 5);
  const first = deck.map((q, i) => ({ id: q.id, correct: i >= 4 }));
  const retry1 = L.buildRetryDeck(deck, first, 1);
  assert.equal(retry1.length, 4);
  const second = retry1.map((q, i) => ({ id: q.id, correct: i !== 1 }));
  const retry2 = L.buildRetryDeck(retry1, second, 2);
  assert.deepEqual(retry2.map((q) => q.id), [retry1[1].id]);
});

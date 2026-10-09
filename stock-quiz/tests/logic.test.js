const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadLogic } = require('./load-logic');

test('index.html のデータとロジックを読み込める', () => {
  assert.doesNotThrow(() => loadLogic());
});

const L = loadLogic();
// 全モード(全部まぜ・チャートの形状・ローソク足・用語・株価予想)。「どのモードも10問が成立する」「1問以上ある」を見るテストで使う。
// 株価予想の仕組みのテストは、本物のデータではなく見本(fixture)を入れた別の評価結果で見る
const EVERY_MODE = L.MODES;

// v6 で追加したチャートの形20種類: id -> [名前, outlook, 難易度](表の順。PATTERNS の末尾にこの順で並ぶ)
const NEW_CHART20 = {
  'box-breakout-up': ['ボックス上抜け(上放れ)', 'up', 'easy'],
  'box-breakout-down': ['ボックス下抜け(下放れ)', 'down', 'normal'],
  'n-wave-up': ['N字上昇(上昇N波動)', 'up', 'hard'],
  'broadening-top': ['拡大三角形(ブロードニングトップ)', 'either', 'hard'],
  'n-wave-down': ['N字下降(逆N波動)', 'down', 'expert'],
  'false-breakout-up': ['上抜けダマシ(フォールスブレイクアウト・上)', 'down', 'expert'],
  'false-breakout-down': ['下抜けダマシ(フォールスブレイクアウト・下)', 'up', 'expert'],
  'triangle-breakout-up': ['三角保ち合い上放れ', 'up', 'expert'],
  'triangle-breakout-down': ['三角保ち合い下放れ', 'down', 'expert'],
  'return-move-up': ['リターンムーブ(上抜け後の押し戻し)', 'up', 'expert'],
  'return-move-down': ['リターンムーブ(下抜け後の戻り)', 'down', 'expert'],
  'elliott-impulse-up': ['エリオット波動 上昇5波(推進波)', 'either', 'master'],
  'elliott-impulse-down': ['エリオット波動 下降5波(推進波)', 'either', 'master'],
  'elliott-cycle-up': ['エリオット波動 上昇5波+調整3波(1サイクル)', 'up', 'master'],
  'elliott-cycle-down': ['エリオット波動 下降5波+調整3波(1サイクル)', 'down', 'master'],
  'falling-wedge-breakout-up': ['下降ウェッジ上抜け(上放れ)', 'up', 'expert'],
  'rising-wedge-breakout-down': ['上昇ウェッジ下抜け(下放れ)', 'down', 'master'],
  'ascending-channel-breakdown': ['上昇チャネル下抜け', 'down', 'master'],
  'descending-channel-breakout-up': ['下降チャネル上抜け', 'up', 'master'],
  'selling-climax': ['セリングクライマックス(急落の最終局面)', 'up', 'master'],
};
// 各形の「紛らわしい組」(topics の confusable_with)。両方向で isConfusable になる
const NEW_CHART20_CONFUSABLE = {
  'box-breakout-up': ['box-range', 'ascending-triangle', 'box-breakout-down'],
  'box-breakout-down': ['box-range', 'descending-triangle', 'box-breakout-up'],
  'n-wave-up': ['ascending-channel', 'bull-flag', 'bullish-perfect-order', 'n-wave-down'],
  'broadening-top': ['symmetrical-triangle', 'diamond-top', 'head-shoulders', 'falling-wedge'],
  'n-wave-down': ['descending-channel', 'bear-flag', 'bearish-perfect-order', 'n-wave-up'],
  'false-breakout-up': ['box-breakout-up', 'box-breakout-down', 'double-top', 'false-breakout-down'],
  'false-breakout-down': ['box-breakout-up', 'box-breakout-down', 'double-bottom', 'false-breakout-up'],
  'triangle-breakout-up': ['symmetrical-triangle', 'ascending-triangle', 'pennant', 'triangle-breakout-down'],
  'triangle-breakout-down': ['symmetrical-triangle', 'descending-triangle', 'bear-pennant', 'triangle-breakout-up'],
  'return-move-up': ['n-wave-up', 'false-breakout-up', 'box-breakout-up', 'return-move-down'],
  'return-move-down': ['n-wave-down', 'false-breakout-down', 'box-breakout-down', 'return-move-up'],
  'elliott-impulse-up': ['bullish-perfect-order', 'ascending-channel', 'elliott-cycle-up', 'elliott-impulse-down'],
  'elliott-impulse-down': ['bearish-perfect-order', 'descending-channel', 'elliott-cycle-down', 'elliott-impulse-up'],
  'elliott-cycle-up': ['elliott-impulse-up', 'double-top', 'head-shoulders', 'elliott-cycle-down'],
  'elliott-cycle-down': ['elliott-impulse-down', 'double-bottom', 'inverse-head-shoulders', 'elliott-cycle-up'],
  'falling-wedge-breakout-up': ['falling-wedge', 'bull-flag', 'triangle-breakout-up', 'rising-wedge-breakout-down'],
  'rising-wedge-breakout-down': ['rising-wedge', 'bear-flag', 'triangle-breakout-down', 'falling-wedge-breakout-up'],
  'ascending-channel-breakdown': ['ascending-channel', 'double-top', 'rising-wedge-breakout-down', 'descending-channel-breakout-up'],
  'descending-channel-breakout-up': ['descending-channel', 'double-bottom', 'falling-wedge-breakout-up', 'ascending-channel-breakdown'],
  'selling-climax': ['v-bottom', 'falling-wedge', 'saucer-bottom', 'elliott-impulse-down'],
};

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

test('PATTERNS: 50個あり、id と name が重複せず、定義が正しい', () => {
  assert.equal(L.PATTERNS.length, 50);
  assert.equal(new Set(L.PATTERNS.map((p) => p.id)).size, 50);
  assert.equal(new Set(L.PATTERNS.map((p) => p.name)).size, 50);
  for (const p of L.PATTERNS) {
    assert.ok(['up', 'down', 'flat', 'either'].includes(p.outlook), p.id);
    assert.equal(p.outlookQuiz, undefined, p.id);
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
    assert.deepEqual(L.generateContinuation(50, 'either', seed), []);
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
  assert.deepEqual(L.MODES, ['all', 'pattern', 'candle', 'term', 'forecast']);
  for (const m of L.MODES) assert.ok(L.MODE_LABELS[m], m);
  assert.equal(L.MODE_LABELS.outlook, undefined);
  assert.throws(() => L.makeOutlookQuestion, ReferenceError);
  assert.throws(() => L.OUTLOOK_CHOICES, ReferenceError);
  // 答え合わせ画面は「この後の値動き: 」にこの文言をそのままつなげて出す(either の特別扱いはしない)
  assert.equal(L.OUTLOOK_LABELS.either, '上下どちらに動くかは、この形だけでは決められないよ');
});

test('CANDLE_PATTERNS: 50個(既存30+追加20)で、ローソク足の値が矛盾していない', () => {
  assert.equal(L.CANDLE_PATTERNS.length, 50);
  assert.equal(new Set(L.CANDLE_PATTERNS.map((c) => c.id)).size, 50);
  assert.equal(new Set(L.CANDLE_PATTERNS.map((c) => c.name)).size, 50);
  for (const c of L.CANDLE_PATTERNS) {
    assert.ok(c.candles.length >= 1 && c.candles.length <= 5, c.id);
    for (const k of c.candles) {
      assert.ok(k.h >= Math.max(k.o, k.c), `${c.id}: 高値が低い`);
      assert.ok(k.l <= Math.min(k.o, k.c), `${c.id}: 安値が高い`);
    }
  }
});

test('TERMS: 120個(既存40+追加80)で、id が重複せず、間違いの選択肢が3つある', () => {
  assert.equal(L.TERMS.length, 120);
  assert.equal(new Set(L.TERMS.map((t) => t.id)).size, 120);
  for (const t of L.TERMS) {
    assert.equal(t.wrongs.length, 3, t.id);
    assert.ok(!t.wrongs.includes(t.answer), t.id);
    assert.equal(new Set(t.wrongs).size, 3, t.id);
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

test('形状の問題: outlook を持ち、チャートの続きの方向がそれと一致する(either は空)', () => {
  for (const p of L.PATTERNS) {
    const q = L.makePatternQuestion(p, 21);
    assert.equal(q.type, 'pattern');
    assert.equal(q.outlook, p.outlook, p.id);
    assert.ok(L.OUTLOOK_LABELS[q.outlook], p.id);
    const chart = L.chartForQuestion(q);
    assert.ok(Array.isArray(chart.continuation), p.id);
    const last = chart.values[chart.values.length - 1];
    const end = chart.continuation[chart.continuation.length - 1];
    if (p.outlook === 'up') assert.ok(end > last + 5, p.id);
    if (p.outlook === 'down') assert.ok(end < last - 5, p.id);
    if (p.outlook === 'flat') assert.ok(Math.abs(end - last) < 6, p.id);
    if (p.outlook === 'either') assert.deepEqual(chart.continuation, [], p.id);
    else assert.equal(chart.continuation.length, L.CONTINUATION_LENGTH, p.id);
  }
});

test('三角持ち合い・拡大三角形・エリオット推進波(上・下)の outlook は either(方向は抜けるまで分からない)', () => {
  const eitherIds = ['symmetrical-triangle', 'broadening-top', 'elliott-impulse-up', 'elliott-impulse-down'];
  for (const id of eitherIds) assert.equal(L.findPattern(id).outlook, 'either', id);
  assert.deepEqual(L.PATTERNS.filter((p) => p.outlook === 'either').map((p) => p.id).sort(), eitherIds.slice().sort());
});

test('either の形は続きの点線が空(拡大三角形・エリオット推進波の上・下)', () => {
  for (const id of ['broadening-top', 'elliott-impulse-up', 'elliott-impulse-down']) {
    assert.deepEqual(L.generateContinuation(50, L.findPattern(id).outlook, 7), [], id);
    for (let seed = 1; seed <= 20; seed++) {
      const q = L.makePatternQuestion(L.findPattern(id), seed);
      assert.equal(q.outlook, 'either', id);
      assert.deepEqual(L.chartForQuestion(q).continuation, [], `${id} seed=${seed}`);
    }
  }
});

test('outlook の問題・モードはどこにもない', () => {
  for (const mode of L.MODES) {
    for (let seed = 1; seed <= 10; seed++) {
      for (const q of L.buildDeck(mode, seed)) {
        assert.notEqual(q.type, 'outlook');
        assert.ok(!q.id.startsWith('outlook:'), q.id);
      }
    }
  }
  assert.ok(L.validateQuestion({ id: 'x', type: 'outlook', question: 'q', explanation: 'e', detail: 'd',
    choices: ['a', 'b', 'c', 'd'], answer: 'a', difficulty: 'easy' }).includes('type'));
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
  for (const mode of EVERY_MODE) {
    for (let seed = 1; seed <= 30; seed++) {
      const deck = L.buildDeck(mode, seed);
      assert.equal(deck.length, L.ROUND_SIZE, `${mode} seed=${seed}`);
      assert.equal(new Set(deck.map((q) => q.id)).size, deck.length, `${mode} seed=${seed} 重複`);
      for (const q of deck) assert.equal(L.validateQuestion(q), null);
    }
  }
});

test('buildDeck: モードごとの問題の種類が合っている', () => {
  for (const mode of ['pattern', 'candle', 'term', 'forecast']) {
    for (const q of L.buildDeck(mode, 3)) assert.equal(q.type, mode);
  }
  const types = new Set();
  for (let seed = 1; seed <= 10; seed++) L.buildDeck('all', seed).forEach((q) => types.add(q.type));
  assert.deepEqual([...types].sort(), ['candle', 'forecast', 'pattern', 'term']);
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

test("buildDeck('all'): 10問・重複なし・有効で、同じシードなら同じ", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const deck = L.buildDeck('all', seed);
    assert.equal(deck.length, 10);
    assert.equal(new Set(deck.map((q) => q.id)).size, 10);
    deck.forEach((q) => assert.equal(L.validateQuestion(q), null));
    assert.deepEqual(deck, L.buildDeck('all', seed));
  }
});

test("buildDeck('all'): チャートの形状・ローソク足・用語が、たくさんの回のどこかには出る", () => {
  const types = new Set();
  for (let seed = 1; seed <= 40; seed++) L.buildDeck('all', seed).forEach((q) => types.add(q.type));
  assert.ok(types.has('pattern') && types.has('candle') && types.has('term'));
});

test("buildPool('all'): 各パターンが形状の問題を1問ずつ出し(全50問)、同じ形が重ならない", () => {
  const pool = L.buildPool('all', L.createRng(5));
  const ids = pool.filter((q) => q.type === 'pattern').map((q) => q.id);
  assert.equal(ids.length, L.PATTERNS.length);
  assert.equal(new Set(ids).size, ids.length);
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

test('三角持ち合いは、チャートの形状で出題される', () => {
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

// 用語の事実確認の指摘(v4)
test('新規の用語20問: 正解が選択肢の中で一番長い問題は4割未満で、誤りの選択肢が重複しない', () => {
  // 全40問で数えると、元の20問だけで長い答えが13問あり、基準を超えてしまうため、v4 で足した20問(TERMS の21〜40番目)に絞って確かめる
  const newTerms = L.TERMS.slice(20, 40);
  assert.equal(newTerms.length, 20);
  const longest = newTerms.filter((t) => t.answer.length > Math.max(...t.wrongs.map((w) => w.length)));
  assert.ok((newTerms.length - longest.length) / newTerms.length > 0.6, '一番長い答え: ' + longest.map((t) => t.id).join(','));
  for (const t of newTerms) {
    assert.ok(!t.wrongs.includes(t.answer), t.id);
    assert.equal(new Set(t.wrongs).size, 3, t.id);
  }
});

test('用語の修正: 単元株は内国株式に限り、サーキットブレーカーは時間の数字を書かず、一時的な停止と個別株との違いを書く', () => {
  const unit = L.TERMS.find((t) => t.id === 'trading-unit');
  assert.ok(unit.answer.includes('国内の上場会社') || unit.answer.includes('内国株式'));
  assert.ok(unit.explanation.includes('内国株式'));
  const cb = L.TERMS.find((t) => t.id === 'circuit-breaker');
  assert.ok(cb.explanation.includes('一時的'));
  assert.ok(cb.explanation.includes('個別株'));
  assert.ok(!/10分/.test(cb.explanation), '出典で10分間と10分間以上が割れるため、数字は書かない');
});

test('単元株の選択肢: 重複がなく、答えが一番長くても2番目より8文字以内の差', () => {
  const unit = L.TERMS.find((t) => t.id === 'trading-unit');
  const all = [unit.answer, ...unit.wrongs];
  assert.equal(new Set(all).size, 4);
  const lens = all.map((s) => s.length).sort((a, b) => b - a);
  if (unit.answer.length === lens[0]) assert.ok(lens[0] - lens[1] <= 8, `差=${lens[0] - lens[1]}`);
  const split = L.TERMS.find((t) => t.id === 'stock-split');
  assert.ok(split.explanation.includes('理論上は下がる'));
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
      assert.equal(c.length, L.CONTINUATION_LENGTH);
      for (let i = 1; i < c.length; i++) assert.ok(Math.abs(c[i] - c[i - 1]) < 3, `${outlook} seed=${seed}`);
    }
  }
});

test('PATTERNS: 50個で、追加した9個が揃っている', () => {
  assert.equal(L.PATTERNS.length, 50);
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

test('追加後の出題: どのモードも10問が成立し、形状の問題の続きが outlook と一致する', () => {
  for (const mode of EVERY_MODE) {
    for (let seed = 1; seed <= 20; seed++) {
      const deck = L.buildDeck(mode, seed);
      assert.equal(deck.length, L.ROUND_SIZE);
      for (const q of deck) assert.equal(L.validateQuestion(q), null);
    }
  }
  for (const p of L.PATTERNS.filter((x) => x.outlook !== 'either')) {
    const q = L.makePatternQuestion(p, 33);
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
  // ローソク足どうしの紛らわしい組の数(v5 までの 33 組に、ローソク足20種類の追加で 61 組、その確認で 3 組を足して 97)。数が変わったら、意図した変更か確かめること
  assert.equal(pairs.length, 97);
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

test('確認で足したローソク足3組(行き違い線/陽のたすき線、差し込み線・入り首線/毛抜き底): 両方向で isConfusable で、選択肢に同時に出ない', () => {
  const nameOf = (id) => L.CANDLE_PATTERNS.find((c) => c.id === id).name;
  const checkPairs = [['yukichigai-line', 'bullish-tasuki-line'], ['thrusting-line', 'tweezer-bottom'], ['irikubi-line', 'tweezer-bottom']];
  for (const [a, b] of checkPairs) {
    assert.equal(L.isConfusable(a, b), true, `${a}/${b}`);
    assert.equal(L.isConfusable(b, a), true, `${b}/${a}`);
    for (let seed = 1; seed <= 60; seed++) {
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

test('どのモードでも出題プールが ROUND_SIZE 以上', () => {
  for (const mode of EVERY_MODE) {
    assert.ok(L.buildPool(mode, L.createRng(1)).length >= L.ROUND_SIZE, mode);
  }
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

// 追加の用語80問(用語50・テクニカル30)。各難易度に用語10問+テクニカル6問
const NEW80 = {
  easy: {
    term: ['stock-share', 'investment-trust', 'etf', 'stock-exchange', 'ipo', 'prime-market', 'capital-gain', 'bull-market', 'securities-code', 'dollar-cost-averaging'],
    technical: ['technical-vs-fundamental', 'trend', 'support-resistance-line', 'trendline', 'candle-timeframes', 'oscillator'],
  },
  normal: {
    term: ['topix', 'specific-account', 'year-high', 'capital-increase', 'shareholders-meeting', 'voting-rights', 'trading-value', 'equity-ratio', 'preferred-stock', 'reit'],
    technical: ['rsi', 'macd', 'bollinger-bands', 'ma-deviation', 'psychological-line', 'breakout'],
  },
  hard: {
    term: ['bps', 'tob', 'pts', 'securities-report', 'convertible-bond', 'stock-option', 'third-party-allotment', 'book-building', 'margin-call', 'stock-lending'],
    technical: ['stochastics', 'ichimoku-kinko-hyo', 'dow-theory', 'parabolic-sar', 'vwap', 'momentum'],
  },
  expert: {
    term: ['ebitda', 'peg-ratio', 'doe', 'free-cash-flow', 'roic', 'beta', 'index-futures', 'options-trading', 'current-ratio', 'interest-coverage-ratio'],
    technical: ['dmi-adx', 'fibonacci-retracement', 'advance-decline-ratio', 'volume-ratio', 'atr', 'cci'],
  },
  master: {
    term: ['sharpe-ratio', 'dcf', 'wacc', 'goodwill', 'cross-shareholding', 'poison-pill', 'squeeze-out', 'nikkei-vi', 'short-squeeze', 'corporate-governance-code'],
    technical: ['elliott-wave', 'divergence', 'heikin-ashi', 'point-and-figure', 'rci', 'volume-by-price'],
  },
};

const LEVEL_TABLE = {
  patterns: {
    easy: ['double-top', 'double-bottom', 'head-shoulders', 'inverse-head-shoulders', 'golden-cross', 'dead-cross', 'box-range',
      'ascending-channel', 'descending-channel', 'box-breakout-up'],
    normal: ['triple-top', 'triple-bottom', 'symmetrical-triangle', 'ascending-triangle', 'descending-triangle', 'rising-wedge', 'falling-wedge',
      'v-bottom', 'v-top', 'box-breakout-down'],
    hard: ['bull-flag', 'bear-flag', 'pennant', 'bear-pennant', 'cup-with-handle', 'saucer-bottom',
      'bullish-perfect-order', 'bearish-perfect-order', 'n-wave-up', 'broadening-top'],
    expert: ['rounding-top', 'inverted-cup-with-handle', 'n-wave-down', 'false-breakout-up', 'false-breakout-down',
      'triangle-breakout-up', 'triangle-breakout-down', 'return-move-up', 'return-move-down', 'falling-wedge-breakout-up'],
    master: ['diamond-top', 'diamond-bottom', 'elliott-impulse-up', 'elliott-impulse-down', 'elliott-cycle-up', 'elliott-cycle-down',
      'rising-wedge-breakout-down', 'ascending-channel-breakdown', 'descending-channel-breakout-up', 'selling-climax'],
  },
  candles: {
    easy: ['big-bullish', 'big-bearish', 'doji', 'hammer', 'bullish-engulfing', 'bearish-engulfing', 'spinning-top',
      'lower-shadow-bullish', 'upper-shadow-bearish',
      'bullish-marubozu'],
    normal: ['shooting-star', 'three-white-soldiers', 'three-black-crows', 'morning-star', 'evening-star', 'dragonfly-doji', 'gravestone-doji',
      'gap-up', 'gap-down',
      'bearish-marubozu'],
    hard: ['bullish-harami', 'bearish-harami', 'tweezer-top', 'tweezer-bottom', 'piercing-line', 'dark-cloud-cover',
      'bullish-harami-cross', 'bearish-harami-cross',
      'four-price-doji', 'bullish-opening-marubozu'],
    expert: ['rising-three-methods', 'falling-three-methods',
      'bearish-opening-marubozu', 'three-gaps-up', 'three-gaps-down', 'upward-gap-side-by-side-white', 'downward-gap-side-by-side-black', 'thrusting-line', 'irikubi-line', 'yukichigai-line'],
    master: ['abandoned-baby-bottom', 'abandoned-baby-top',
      'bullish-deai-line', 'bearish-deai-line', 'bullish-tasuki-line', 'bearish-tasuki-line', 'upward-gap-star', 'downward-gap-star', 'three-soldiers-stalled', 'three-soldiers-deliberation'],
  },
  terms: {
    easy: ['market-cap', 'volume', 'market-order', 'limit-order', 'dividend-yield', 'diversification', 'nisa',
      'dividend', 'shareholder-benefit', 'listing', 'trading-unit'],
    normal: ['per', 'pbr', 'earnings', 'nikkei-225', 'moving-average', 'golden-cross-term', 'limit-up',
      'stop-loss', 'take-profit', 'averaging-down', 'shiozuke'],
    hard: ['roe', 'stop-order', 'short-selling', 'margin-trading', 'record-date', 'ex-rights',
      'order-book', 'execution', 'open-and-close', 'trading-sessions'],
    expert: ['margin-ratio', 'reverse-fee', 'roa', 'eps'],
    master: ['payout-ratio', 'buyback', 'stock-split', 'circuit-breaker'],
  },
};
// 用語の表には、追加の80問も足す
for (const level of Object.keys(NEW80)) LEVEL_TABLE.terms[level].push(...NEW80[level].term, ...NEW80[level].technical);

test('下影陽線 / 上影陰線: 実体が値幅の30〜50%で、ヒゲが実体より長い', () => {
  const [a] = candleOf('lower-shadow-bullish');
  assert.ok(a.c > a.o);
  assert.ok(bodyOf(a) >= rangeOf(a) * 0.3 && bodyOf(a) <= rangeOf(a) * 0.5);
  assert.ok(a.o - a.l > bodyOf(a), '下ヒゲは実体より長い');
  assert.ok(a.h - a.c <= rangeOf(a) * 0.1, '上ヒゲはほとんどない');
  const [b] = candleOf('upper-shadow-bearish');
  assert.ok(b.c < b.o);
  assert.ok(bodyOf(b) >= rangeOf(b) * 0.3 && bodyOf(b) <= rangeOf(b) * 0.5);
  assert.ok(b.h - b.o > bodyOf(b), '上ヒゲは実体より長い');
  assert.ok(b.c - b.l <= rangeOf(b) * 0.1, '下ヒゲはほとんどない');
});

test('上窓 / 下窓: 2本で、窓は8以上空いている', () => {
  assert.equal(candleOf('gap-up').length, 2);
  const [a, b] = candleOf('gap-up');
  assert.ok(b.l - a.h >= 8, '2本目の安値が1本目の高値より上');
  assert.equal(candleOf('gap-down').length, 2);
  const [c, d] = candleOf('gap-down');
  assert.ok(c.l - d.h >= 8, '2本目の高値が1本目の安値より下');
});

test('強気のはらみ十字 / 弱気のはらみ十字: 1本目の大きな実体の中に十字線が収まる', () => {
  assert.equal(candleOf('bullish-harami-cross').length, 2);
  const [a, b] = candleOf('bullish-harami-cross');
  assert.ok(a.c < a.o && bodyOf(a) >= 30, '1本目は大きな陰線');
  assert.equal(b.o, b.c);
  assert.ok(b.o < a.o - 8 && b.o > a.c + 8, '十字線の始値=終値は1本目の実体の中');
  assert.ok(b.h < a.o - 8 && b.l > a.c + 8, '十字線の高値・安値(ヒゲ)も1本目の実体の中');
  assert.equal(candleOf('bearish-harami-cross').length, 2);
  const [c, d] = candleOf('bearish-harami-cross');
  assert.ok(c.c > c.o && bodyOf(c) >= 30, '1本目は大きな陽線');
  assert.equal(d.o, d.c);
  assert.ok(d.o < c.c - 8 && d.o > c.o + 8);
  assert.ok(d.h < c.c - 8 && d.l > c.o + 8, '十字線の高値・安値(ヒゲ)も1本目の実体の中');
});

test('上げ三法 / 下げ三法: 小さな3本が1本目の値幅の内側で少しずつ動き、5本目が1本目の終値を超えて引ける', () => {
  const r = candleOf('rising-three-methods');
  assert.equal(r.length, 5);
  assert.ok(r[0].c > r[0].o && bodyOf(r[0]) >= 30, '1本目は大きな陽線');
  for (const k of r.slice(1, 4)) {
    assert.ok(bodyOf(k) <= bodyOf(r[0]) / 3, '小さな実体');
    assert.ok(k.h < r[0].h && k.l > r[0].l, '1本目の値幅の内側');
  }
  assert.ok(r.slice(1, 4).some((k) => k.c < k.o), '陰線を含む');
  for (const k of r.slice(1, 4)) {
    assert.ok(k.c < k.o, '小さな足は3本とも陰線(解説で「小さな陰線」と書くため)');
    assert.ok(Math.max(k.o, k.c) < r[0].c && Math.min(k.o, k.c) > r[0].o, '小さな足の実体は1本目の実体の内側');
  }
  for (let i = 2; i <= 3; i++) assert.ok(r[i].c < r[i - 1].c && r[i].l < r[i - 1].l, '少しずつ下がる');
  assert.ok(r[4].c > r[4].o && bodyOf(r[4]) >= 30, '5本目は大きな陽線');
  assert.ok(r[4].c > r[0].c + 8, '1本目の終値より上で引ける');
  const f = candleOf('falling-three-methods');
  assert.equal(f.length, 5);
  assert.ok(f[0].c < f[0].o && bodyOf(f[0]) >= 30);
  for (const k of f.slice(1, 4)) {
    assert.ok(bodyOf(k) <= bodyOf(f[0]) / 3);
    assert.ok(k.h < f[0].h && k.l > f[0].l);
  }
  assert.ok(f.slice(1, 4).some((k) => k.c > k.o), '陽線を含む');
  for (const k of f.slice(1, 4)) {
    assert.ok(k.c > k.o, '小さな足は3本とも陽線(解説で「小さな陽線」と書くため)');
    assert.ok(Math.max(k.o, k.c) < f[0].o && Math.min(k.o, k.c) > f[0].c, '小さな足の実体は1本目の実体の内側');
  }
  for (let i = 2; i <= 3; i++) assert.ok(f[i].c > f[i - 1].c && f[i].h > f[i - 1].h, '少しずつ上がる');
  assert.ok(f[4].c < f[4].o && bodyOf(f[4]) >= 30);
  assert.ok(f[4].c < f[0].c - 8, '1本目の終値より下で引ける');
});

test('捨て子線(底) / 捨て子線(天井): 十字線が前後と窓を空けて孤立している', () => {
  const [a, b, c] = candleOf('abandoned-baby-bottom');
  assert.ok(a.c < a.o && bodyOf(a) >= 20, '1本目は大きな陰線');
  assert.equal(b.o, b.c, '2本目は十字線');
  assert.ok(a.l - b.h >= 8, '下に窓');
  assert.ok(c.c > c.o && bodyOf(c) >= 20, '3本目は大きな陽線');
  assert.ok(c.l - b.h >= 8, '上に窓');
  const [d, e, f] = candleOf('abandoned-baby-top');
  assert.ok(d.c > d.o && bodyOf(d) >= 20);
  assert.equal(e.o, e.c);
  assert.ok(e.l - d.h >= 8, '上に窓');
  assert.ok(f.c < f.o && bodyOf(f) >= 20);
  assert.ok(e.l - f.h >= 8, '下に窓');
});

test('新規10個のローソク足の紛らわしい組が両方向で isConfusable で、選択肢に同時に出ない', () => {
  const pairs = [['hammer', 'lower-shadow-bullish'], ['shooting-star', 'upper-shadow-bearish'],
    ['bullish-harami', 'bullish-harami-cross'], ['bearish-harami', 'bearish-harami-cross'],
    ['doji', 'bullish-harami-cross'], ['doji', 'bearish-harami-cross'], ['rising-three-methods', 'falling-three-methods'],
    ['abandoned-baby-bottom', 'morning-star'], ['abandoned-baby-top', 'evening-star'], ['gap-up', 'gap-down'],
    // 窓を含む足(明けの明星・宵の明星・捨て子線)は、上窓 / 下窓と同じ絵に見えるので、同時に出さない
    ['gap-down', 'morning-star'], ['gap-up', 'evening-star'], ['gap-up', 'abandoned-baby-bottom'],
    ['gap-down', 'abandoned-baby-bottom'], ['gap-up', 'abandoned-baby-top'], ['gap-down', 'abandoned-baby-top']];
  for (const [a, b] of pairs) {
    assert.equal(L.isConfusable(a, b), true, `${a}/${b}`);
    assert.equal(L.isConfusable(b, a), true, `${b}/${a}`);
    for (let seed = 1; seed <= 40; seed++) {
      for (const [x, y] of [[a, b], [b, a]]) {
        const q = L.makeCandleQuestion(L.CANDLE_PATTERNS.find((k) => k.id === x), L.createRng(seed));
        assert.ok(!q.choices.includes(L.CANDLE_PATTERNS.find((k) => k.id === y).name), `${x} vs ${y} seed=${seed}`);
        assert.equal(L.validateQuestion(q), null, `${x} vs ${y} seed=${seed}`);
      }
    }
  }
});

test('新規10個のローソク足: 問題が有効で難易度が表どおり、どの難易度でも candle / all の出題が有効', () => {
  const NEW = ['lower-shadow-bullish', 'upper-shadow-bearish', 'gap-up', 'gap-down', 'bullish-harami-cross', 'bearish-harami-cross',
    'rising-three-methods', 'falling-three-methods', 'abandoned-baby-bottom', 'abandoned-baby-top'];
  for (const id of NEW) {
    const level = L.DIFFICULTY_LEVELS.find((lv) => LEVEL_TABLE.candles[lv].includes(id));
    const item = L.CANDLE_PATTERNS.find((k) => k.id === id);
    // はらみ十字は、別名を添える括弧書き「(…とも呼ばれるよ)」で終わる
    assert.ok(item.explanation.endsWith('よ。') || item.explanation.endsWith('よ)'), id);
    for (let seed = 1; seed <= 10; seed++) {
      const q = L.makeCandleQuestion(item, L.createRng(seed));
      assert.equal(L.validateQuestion(q), null, id);
      assert.equal(q.difficulty, level, id);
    }
  }
  for (const mode of ['candle', 'all']) {
    for (const level of L.DIFFICULTY_FILTERS) {
      for (let seed = 1; seed <= 10; seed++) {
        for (const q of L.buildDeck(mode, seed, level)) assert.equal(L.validateQuestion(q), null, `${mode}/${level}`);
      }
    }
  }
});

test('新規の用語20問: 難易度どおりで、問題が validateQuestion を通る', () => {
  const newIds = [];
  for (const level of L.DIFFICULTY_LEVELS) {
    const newIds80 = Object.values(NEW80).flatMap((lv) => [...lv.term, ...lv.technical]);
    const added = LEVEL_TABLE.terms[level].filter((id) => !newIds80.includes(id)).filter((id) => ![ 'market-cap', 'volume', 'market-order', 'limit-order', 'dividend-yield', 'diversification', 'nisa', 'per', 'pbr', 'earnings', 'nikkei-225', 'moving-average', 'golden-cross-term', 'limit-up', 'roe', 'stop-order', 'short-selling', 'margin-trading', 'record-date', 'ex-rights'].includes(id));
    assert.equal(added.length, 4, level);
    for (const id of added) {
      newIds.push(id);
      const t = L.TERMS.find((x) => x.id === id);
      assert.ok(t, id);
      const q = L.makeTermQuestion(t, L.createRng(3));
      assert.equal(L.validateQuestion(q), null, id);
      assert.equal(q.difficulty, level, id);
    }
  }
  assert.equal(newIds.length, 20);
});

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
  assert.equal(L.makeCandleQuestion(L.CANDLE_PATTERNS.find((c) => c.id === 'doji'), L.createRng(1)).difficulty, 'easy');
  assert.equal(L.makeTermQuestion(L.TERMS.find((t) => t.id === 'per'), L.createRng(1)).difficulty, 'normal');
  const q = L.makeTermQuestion(L.TERMS[0], L.createRng(1));
  assert.equal(L.validateQuestion(q), null);
  assert.ok(L.validateQuestion({ ...q, difficulty: 'x' }));
  assert.ok(L.validateQuestion({ ...q, difficulty: undefined }));
});

test('モード×難易度の問題数: どの組み合わせも1問以上で、表の数と合う', () => {
  const expected = {
    // チャートの形は、どの難易度も10種類(v6 で 30 → 50 種類にした)
    pattern: { easy: 10, normal: 10, hard: 10, expert: 10, master: 10 },
    // ローソク足も、どの難易度も10種類(v6 で 30 → 50 種類にした)
    candle: { easy: 10, normal: 10, hard: 10, expert: 10, master: 10 },
    // 用語は、v4 までの40問(11/11/10/4/4)に追加の80問(各16)を足した数。内容を足したらここも直す
    term: { easy: 27, normal: 27, hard: 26, expert: 20, master: 20 },
    // 株価予想は、どの難易度も4問(20問)。内容を足したらここも直す
    forecast: { easy: 4, normal: 4, hard: 4, expert: 4, master: 4 },
  };
  for (const mode of EVERY_MODE) {
    for (const level of L.DIFFICULTY_LEVELS) {
      const n = L.buildPool(mode, L.createRng(1), level).length;
      assert.ok(n >= 1, `${mode}/${level} n=${n}`);
      if (expected[mode]) assert.equal(n, expected[mode][level], `${mode}/${level}`);
    }
  }
  // all モード: 用語 + ローソク足10 + チャートの形状10 + 株価予想4(内容に依存する数)。expert / master は 20+10+10+4 = 44
  const allExpected = { easy: 51, normal: 51, hard: 50, expert: 44, master: 44 };
  for (const level of L.DIFFICULTY_LEVELS) assert.equal(L.buildPool('all', L.createRng(1), level).length, allExpected[level], `all/${level}`);
});

const NEW_IDS = {
  easy: { term: ['dividend', 'shareholder-benefit', 'listing', 'trading-unit'], candle: ['lower-shadow-bullish', 'upper-shadow-bearish'], pattern: ['ascending-channel', 'descending-channel'] },
  normal: { term: ['stop-loss', 'take-profit', 'averaging-down', 'shiozuke'], candle: ['gap-up', 'gap-down'], pattern: ['v-bottom', 'v-top'] },
  hard: { term: ['order-book', 'execution', 'open-and-close', 'trading-sessions'], candle: ['bullish-harami-cross', 'bearish-harami-cross'], pattern: ['bullish-perfect-order', 'bearish-perfect-order'] },
  expert: { term: ['margin-ratio', 'reverse-fee', 'roa', 'eps'], candle: ['rising-three-methods', 'falling-three-methods'], pattern: ['rounding-top', 'inverted-cup-with-handle'] },
  master: { term: ['payout-ratio', 'buyback', 'stock-split', 'circuit-breaker'], candle: ['abandoned-baby-bottom', 'abandoned-baby-top'], pattern: ['diamond-top', 'diamond-bottom'] },
};

test('各難易度に、新しく追加した問題がちょうど8問ある(用語4・ローソク足2・形状2)', () => {
  for (const level of L.DIFFICULTY_LEVELS) {
    const ids = NEW_IDS[level];
    let total = 0;
    const count = (type, list) => {
      const n = L.buildPool(type, L.createRng(1), level).filter((q) => {
        const [t, ...rest] = q.id.split(':');
        return t === type && list.includes(rest.join(':'));
      }).length;
      total += n;
      return n;
    };
    assert.equal(count('term', ids.term), 4, `term ${level}`);
    assert.equal(count('candle', ids.candle), 2, `candle ${level}`);
    assert.equal(count('pattern', ids.pattern), 2, `pattern ${level}`);
    assert.equal(total, 8, `合計 ${level}`);
  }
});

test('roundSize: all は、どの難易度でも10(expert/master の候補は 20+10+10+4=44 問)。チャートの形状も、どの難易度でも10。どの組み合わせも1〜10', () => {
  for (const level of ['easy', 'normal', 'hard', 'expert', 'master']) assert.equal(L.roundSize('all', level), 10, `all/${level}`);
  for (const level of L.DIFFICULTY_LEVELS) assert.equal(L.roundSize('pattern', level), 10, `pattern/${level}`);
  for (const level of L.DIFFICULTY_LEVELS) assert.equal(L.roundSize('candle', level), 10, `candle/${level}`);
  for (const mode of EVERY_MODE) {
    for (const level of L.DIFFICULTY_FILTERS) {
      const size = L.roundSize(mode, level);
      assert.ok(size >= 1 && size <= 10, `${mode}/${level} size=${size}`);
    }
  }
  // 株価予想は、難易度ごとに4問、すべてでは20問から10問
  for (const level of L.DIFFICULTY_LEVELS) assert.equal(L.roundSize('forecast', level), 4, `forecast/${level}`);
  assert.equal(L.roundSize('forecast', 'all'), 10);
});

test('buildDeck: 難易度の絞り込みで、問題数・重複・難易度・有効性・決定性が合う', () => {
  for (const mode of L.MODES) {
    for (const level of L.DIFFICULTY_FILTERS) {
      const size = L.roundSize(mode, level);
      assert.equal(size, Math.min(L.ROUND_SIZE, L.buildPool(mode, L.createRng(1), level).length), `${mode}/${level}`);
      assert.ok(size >= 1, `${mode}/${level}`);
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

test('全部まぜ+難易度: 同じ形の問題が重ならず、outlook の問題は出ない', () => {
  for (const level of L.DIFFICULTY_FILTERS) {
    for (let seed = 1; seed <= 60; seed++) {
      const deck = L.buildDeck('all', seed, level);
      const byPattern = {};
      for (const q of deck) {
        assert.notEqual(q.type, 'outlook');
        if (q.type === 'pattern') {
          assert.ok(!byPattern[q.patternId], `${level} seed=${seed} ${q.patternId}`);
          byPattern[q.patternId] = q.type;
        }
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

test('保存データ: 値動き予想(outlook)の古いキーが残っていても、無視して読める', () => {
  const old = JSON.stringify({
    best: { all: 7, outlook: 9, 'outlook:hard': 4, pattern: 5 },
    played: { outlook: { correct: 9, total: 10 }, 'outlook:hard': { correct: 4, total: 8 }, pattern: { correct: 5, total: 10 } },
  });
  const parsed = L.parseStats(old);
  assert.equal(parsed.best.all, 7);
  assert.equal(parsed.best.pattern, 5);
  assert.deepEqual(parsed.played.pattern, { correct: 5, total: 10 });
  assert.equal(parsed.best.outlook, undefined);
  assert.equal(parsed.played['outlook:hard'], undefined);
  assert.equal(Object.keys(parsed.best).length, 30);
  assert.equal(L.STATS_KEYS.length, 30);
  assert.ok(L.STATS_KEYS.every((k) => !k.startsWith('outlook')));
});

test('formatShareText: 難易度つき', () => {
  assert.equal(L.formatShareText('pattern', 7, 10), '株クイズ(チャートの形状)で 10問中7問正解!');
  const t = L.formatShareText('pattern', 7, 10, 'normal');
  assert.ok(t.includes('チャートの形状') && t.includes('★★') && t.includes('7') && t.includes('10'));
  assert.ok(!L.formatShareText('pattern', 3, 6, 'hard').includes('すべて'));
});

test('reshuffleChoices: 選択肢の集合と正解が変わらず、元の問題を変更しない', () => {
  const deck = L.buildDeck('all', 4);
  for (const q of deck) {
    const before = JSON.stringify(q);
    const r = L.reshuffleChoices(q, L.createRng(9));
    assert.equal(JSON.stringify(q), before, '元の問題を変更しない');
    assert.deepEqual(r.choices.slice().sort(), q.choices.slice().sort());
    assert.equal(r.answer, q.answer);
    assert.equal(r.id, q.id);
    assert.equal(L.validateQuestion(r), null);
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

// ---- 新規チャート10種類(Task 4) ----
const NEW_CHART_IDS = ['ascending-channel', 'descending-channel', 'v-bottom', 'v-top', 'bullish-perfect-order',
  'bearish-perfect-order', 'rounding-top', 'inverted-cup-with-handle', 'diamond-top', 'diamond-bottom'];

const rangeOf2 = (a) => Math.max(...a) - Math.min(...a);
// 山(谷)の数え方で、頂が平らで同じ値が2点ならぶ(同値のタイ)ときは、1つの山として数える。
// peaks() は窓の中で最大の点を返すので、窓の幅 W 以内に2つ出るのは必ず同値のとき(別々の山ではない)
const mergeTies = (idxs, W) => idxs.filter((x, k) => k === 0 || x - idxs[k - 1] > W);
const onePeak = (v, W, prom) => mergeTies(peaks(v, W, prom), W);
const oneTrough = (v, W, prom) => mergeTies(troughs(v, W, prom), W);
const sliceAt = (v, r) => v.slice(Math.floor(v.length * r[0]), Math.ceil(v.length * r[1]) + 1);
// 最小二乗の傾き(1点あたり)
function slopeOf(idxs, values) {
  const n = idxs.length;
  const mx = idxs.reduce((a, b) => a + b, 0) / n;
  const my = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  idxs.forEach((x, i) => { num += (x - mx) * (values[i] - my); den += (x - mx) ** 2; });
  return num / den;
}

test('新規チャート10種類: id・outlook・難易度が表どおり', () => {
  const want = {
    'ascending-channel': ['up', 'easy'], 'descending-channel': ['down', 'easy'],
    'v-bottom': ['up', 'normal'], 'v-top': ['down', 'normal'],
    'bullish-perfect-order': ['up', 'hard'], 'bearish-perfect-order': ['down', 'hard'],
    'rounding-top': ['down', 'expert'], 'inverted-cup-with-handle': ['down', 'expert'],
    'diamond-top': ['down', 'master'], 'diamond-bottom': ['up', 'master'],
  };
  assert.deepEqual(Object.keys(want).sort(), NEW_CHART_IDS.slice().sort());
  for (const [id, [outlook, level]] of Object.entries(want)) {
    const p = L.findPattern(id);
    assert.equal(p.outlook, outlook, id);
    assert.equal(p.difficulty, level, id);
    assert.ok(p.explanation.endsWith('よ。'), id);
    assert.equal(L.validateQuestion(L.makePatternQuestion(p, 5)), null, id);
  }
});

test('上昇チャネル / 下降チャネル: 高値の列と安値の列が、どちらも同じ向きに傾き、傾きがほぼ同じ', () => {
  for (const [id, sign] of [['ascending-channel', 1], ['descending-channel', -1]]) {
    for (let seed = 1; seed <= 30; seed++) {
      const v = L.generateSeries(L.findPattern(id), seed);
      // 頂が平らで同じ値が並んだとき、隣り合う2点は1つの山として数える
      const dedupe = (a) => a.filter((x, k) => k === 0 || x - a[k - 1] > 2);
      const ps = dedupe(peaks(v, 6, 5));
      const ts = dedupe(troughs(v, 6, 5));
      assert.ok(ps.length >= 3 && ts.length >= 3, `${id} seed=${seed} 山${ps.length} 谷${ts.length}`);
      const sp = slopeOf(ps, ps.map((i) => v[i])) * sign;
      const st = slopeOf(ts, ts.map((i) => v[i])) * sign;
      assert.ok(sp > 0.2 && st > 0.2, `${id} seed=${seed} 傾き sp=${sp} st=${st}`);
      assert.ok(Math.abs(sp - st) < 0.25 * Math.max(sp, st), `${id} seed=${seed} 平行 sp=${sp} st=${st}`);
      // 切り上げ(切り下げ): 山も谷も、1つ前より必ず進む
      for (let k = 1; k < ps.length; k++) assert.ok((v[ps[k]] - v[ps[k - 1]]) * sign > 0, `${id} seed=${seed} 高値`);
      for (let k = 1; k < ts.length; k++) assert.ok((v[ts[k]] - v[ts[k - 1]]) * sign > 0, `${id} seed=${seed} 安値`);
      // 山と、いちばん近い谷との差(チャネルの幅)がはっきりある
      for (const i of ps) {
        const j = ts.reduce((a, b) => (Math.abs(b - i) < Math.abs(a - i) ? b : a));
        assert.ok(Math.abs(v[i] - v[j]) > 10, `${id} seed=${seed} 幅`);
      }
    }
  }
});

test('Vボトム / Vトップ: 底(天井)が中ほどで尖っていて、前後の傾きが急で、左右の差が小さい(300シード)', () => {
  for (const [id, sign] of [['v-bottom', 1], ['v-top', -1]]) {
    for (let seed = 1; seed <= 300; seed++) {
      const v = L.generateSeries(L.findPattern(id), seed).map((x) => x * sign); // 以後は「底」を探す形にそろえる
      const n = v.length;
      const m = v.indexOf(Math.min(...v));
      assert.ok(m > n * 0.4 && m < n * 0.6, `${id} seed=${seed} 位置 ${m}`);
      assert.equal(oneTrough(v, 6, 8).length, 1, `${id} seed=${seed} 谷は1つ(同値のタイは1つと数える)`);
      assert.ok(v[0] - v[m] > 50 && v[n - 1] - v[m] > 50, `${id} seed=${seed} 深さ`);
      // 尖っている: 底から8点離れただけで、もう20以上動いている(丸底なら数しか動かない)
      assert.ok(v[m - 8] - v[m] > 20 && v[m + 8] - v[m] > 20, `${id} seed=${seed} 尖り`);
      // 前後の傾きが急: 底の前後15点で、1点あたり1.5以上動く
      assert.ok((v[m - 15] - v[m]) / 15 > 1.5 && (v[m + 15] - v[m]) / 15 > 1.5, `${id} seed=${seed} 傾き`);
      // 左右の差が小さい
      for (const k of [8, 15, 25]) assert.ok(Math.abs(v[m - k] - v[m + k]) < 12, `${id} seed=${seed} 左右 k=${k}`);
    }
  }
});

test('パーフェクトオーダー: 最後の点で 短期>中期>長期(下降は逆)で、3本とも最後の10点で傾きが正(負)。300シード', () => {
  for (const [id, sign] of [['bullish-perfect-order', 1], ['bearish-perfect-order', -1]]) {
    for (let seed = 1; seed <= 300; seed++) {
      const v = L.generateSeries(L.findPattern(id), seed);
      const s = L.movingAverage(v, L.MA_SHORT);
      const m = L.movingAverage(v, L.MA_MID);
      const l = L.movingAverage(v, L.MA_LONG);
      const last = v.length - 1;
      assert.ok((s[last] - m[last]) * sign > 0 && (m[last] - l[last]) * sign > 0, `${id} seed=${seed} 並び`);
      for (const [name, ma] of [['短期', s], ['中期', m], ['長期', l]]) {
        assert.ok((ma[last] - ma[last - 9]) * sign > 0, `${id} seed=${seed} ${name}の傾き`);
      }
      // トレンドが系列の全体に渡る: 長期線が始まる点から最後まで、長期線は同じ向きに進む
      assert.ok((l[last] - l[59]) * sign > 10, `${id} seed=${seed} 長期線の進み`);
      assert.ok((v[last] - v[0]) * sign > 50, `${id} seed=${seed} 全体のトレンド`);
      // 長期線が始まる点(59)から最後まで、並びが崩れない
      for (let i = 59; i <= last; i++) {
        assert.ok((s[i] - m[i]) * sign > 0 && (m[i] - l[i]) * sign > 0, `${id} seed=${seed} i=${i} 並び`);
      }
    }
  }
});

test('パーフェクトオーダーだけが chart.ma を3本返し、ほかの新規チャートは ma が undefined', () => {
  for (const id of NEW_CHART_IDS) {
    const p = L.findPattern(id);
    for (const q of [L.makePatternQuestion(p, 4)]) {
      const c = L.chartForQuestion(q);
      if (id.endsWith('perfect-order')) {
        assert.equal(p.ma, true, id);
        for (const [key, win] of [['short', L.MA_SHORT], ['mid', L.MA_MID], ['long', L.MA_LONG]]) {
          assert.equal(c.ma[key].length, L.SERIES_LENGTH, `${id} ${key}`);
          assert.equal(c.ma[key].filter((x) => x === null).length, win - 1, `${id} ${key}`);
        }
      } else {
        assert.equal(c.ma, undefined, id);
        assert.notEqual(p.ma, true, id);
      }
    }
  }
});

test('ラウンドトップ: 山が1つで、左右がほぼ対称で、頂点付近がなだらか(300シード)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const v = L.generateSeries(L.findPattern('rounding-top'), seed);
    const n = v.length;
    const ps = onePeak(v, 25, 15);
    assert.equal(ps.length, 1, `seed=${seed} 山 ${ps}`);
    const m = ps[0];
    assert.ok(m > n * 0.4 && m < n * 0.6, `seed=${seed} 位置 ${m}`);
    assert.ok(v[m] - v[0] > 35 && v[m] - v[n - 1] > 35, `seed=${seed} 両端より高い`);
    // 左右がほぼ対称: 系列の中心(59.5)から同じ距離の2点の差が小さい
    for (const k of [15, 30, 45]) assert.ok(Math.abs(v[59 - k] - v[60 + k]) < 8, `seed=${seed} 左右 k=${k}`);
    // 頂点付近がなだらか: 中ほどの 0.42〜0.58(約19点)が、最高値から8以内に収まる(尖った山ではない)
    assert.ok(Math.min(...sliceAt(v, [0.42, 0.58])) > Math.max(...v) - 8, `seed=${seed} なだらか`);
  }
});

test('逆カップウィズハンドル: 左右のふちがそろい、頂は高く、最後に小さな戻り(取っ手)(300シード)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const v = L.generateSeries(L.findPattern('inverted-cup-with-handle'), seed);
    const n = v.length;
    const left = Math.min(...sliceAt(v, [0.04, 0.14]));
    const right = Math.min(...sliceAt(v, [0.82, 0.9]));
    const top = Math.max(...sliceAt(v, [0.4, 0.6]));
    assert.ok(Math.abs(left - right) < 6, `seed=${seed} ふち`);
    assert.ok(top - left > 30, `seed=${seed} 頂`);
    const handle = Math.max(...sliceAt(v, [0.88, 0.96]));
    assert.ok(handle - right > 4 && handle - right < 20, `seed=${seed} 取っ手`);
    assert.equal(onePeak(v, 25, 15).length, 1, `seed=${seed} 丸い山は1つ`);
    assert.ok(v[n - 1] < top - 25, `seed=${seed} 頂より下で終わる`);
  }
});

test('ダイヤモンドトップ / ボトム: 中ほどで振れ幅が最大になり、前後で狭まり、最後に抜ける(500シード)', () => {
  for (const [id, sign] of [['diamond-top', 1], ['diamond-bottom', -1]]) {
    for (let seed = 1; seed <= 500; seed++) {
      const v = L.generateSeries(L.findPattern(id), seed).map((x) => x * sign); // 以後は「高値圏」にそろえる
      const n = v.length;
      const early = sliceAt(v, [0.12, 0.3]);
      const mid = sliceAt(v, [0.38, 0.62]);
      const late = sliceAt(v, [0.7, 0.9]);
      assert.ok(rangeOf2(mid) > rangeOf2(early) * 1.25, `${id} seed=${seed} 広がる`);
      assert.ok(rangeOf2(mid) > rangeOf2(late) * 1.25, `${id} seed=${seed} 狭まる`);
      // 高値圏: 保ち合いの平均が、始まりより20以上高い
      const body = sliceAt(v, [0.12, 0.9]);
      assert.ok(body.reduce((a, b) => a + b, 0) / body.length - v[0] > 20, `${id} seed=${seed} 圏`);
      // 最後は、保ち合いの下限を抜ける
      assert.ok(v[n - 1] < Math.min(...sliceAt(v, [0.62, 0.92])) - 4, `${id} seed=${seed} 抜ける`);
      // ひし形らしく、山と谷が複数ある
      assert.ok(peaks(v, 6, 5).length >= 3 && troughs(v, 6, 5).length >= 3, `${id} seed=${seed} 山谷`);
    }
  }
});

test('新規チャートの紛らわしい組が両方向で isConfusable で、形状の選択肢に同時に出ない', () => {
  const pairs = [['v-bottom', 'saucer-bottom'], ['v-top', 'rounding-top'], ['ascending-channel', 'rising-wedge'],
    ['descending-channel', 'falling-wedge'], ['ascending-channel', 'bullish-perfect-order'],
    ['descending-channel', 'bearish-perfect-order'], ['rounding-top', 'inverted-cup-with-handle'],
    ['diamond-top', 'head-shoulders'], ['diamond-bottom', 'inverse-head-shoulders'], ['diamond-top', 'diamond-bottom'],
    ['inverted-cup-with-handle', 'head-shoulders'],
    // ゴールデンクロス / デッドクロスの図は、最後がパーフェクトオーダーの並びになる(200シードで確認)。ダイヤモンドの後半は対称三角形
    ['golden-cross', 'bullish-perfect-order'], ['dead-cross', 'bearish-perfect-order'],
    ['diamond-top', 'symmetrical-triangle'], ['diamond-bottom', 'symmetrical-triangle']];
  for (const [a, b] of pairs) {
    assert.equal(L.isConfusable(a, b), true, `${a}/${b}`);
    assert.equal(L.isConfusable(b, a), true, `${b}/${a}`);
    for (let seed = 1; seed <= 60; seed++) {
      for (const [x, y] of [[a, b], [b, a]]) {
        const q = L.makePatternQuestion(L.findPattern(x), seed);
        assert.ok(!q.choices.includes(L.findPattern(y).name), `${x} vs ${y} seed=${seed}`);
      }
    }
  }
});

test('新規チャート: どの難易度でも pattern / all の出題が有効', () => {
  for (const mode of ['pattern', 'all']) {
    for (const level of L.DIFFICULTY_FILTERS) {
      for (let seed = 1; seed <= 10; seed++) {
        for (const q of L.buildDeck(mode, seed, level)) assert.equal(L.validateQuestion(q), null, `${mode}/${level}`);
      }
    }
  }
});

test('三法・はらみ十字の解説: 小さな陰線 / 陽線と書き、はらみ十字には別名がある', () => {
  const text = (id) => L.CANDLE_PATTERNS.find((c) => c.id === id).explanation;
  assert.ok(text('rising-three-methods').includes('小さな陰線が3本'));
  assert.ok(text('falling-three-methods').includes('小さな陽線が3本'));
  assert.ok(text('rising-three-methods').includes('最後の大きな陽線がその高値を上回る'));
  assert.ok(text('falling-three-methods').includes('最後の大きな陰線がその安値を下回る'));
  for (const id of ['bullish-harami-cross', 'bearish-harami-cross']) {
    assert.ok(text(id).endsWith('(「はらみ寄せ線」とも呼ばれるよ)'), id);
  }
});

test('新規チャートの解説: 逆カップは断定せず、パーフェクトオーダーは注意書きつき、丸天井に別名', () => {
  const text = (id) => L.findPattern(id).explanation;
  assert.ok(text('rounding-top').includes('ソーサートップ'));
  for (const id of ['bullish-perfect-order', 'bearish-perfect-order']) {
    assert.ok(text(id).includes('強いサインとされるよ'), id);
    assert.ok(text(id).endsWith('ただし、サインが出るのは遅めで、横ばい相場ではダマシも多いよ。'), id);
  }
  assert.ok(text('inverted-cup-with-handle').includes('取っ手の安値を割ると'));
  assert.ok(text('inverted-cup-with-handle').includes('とされるよ'));
});

test('逆カップウィズハンドル: 取っ手は、カップ(山)の高さの2〜4割ほどの戻りで、丸天井より目立つ(300シード)', () => {
  // 取っ手を大きくした(事実確認の指摘)。山の高さ = 頂 - 左右のふち、戻り = 取っ手の高値 - 右のふち
  for (let seed = 1; seed <= 300; seed++) {
    const v = L.generateSeries(L.findPattern('inverted-cup-with-handle'), seed);
    const right = Math.min(...sliceAt(v, [0.82, 0.9]));
    const handle = Math.max(...sliceAt(v, [0.9, 0.96]));
    const top = Math.max(...sliceAt(v, [0.4, 0.6]));
    const ratio = (handle - right) / (top - right);
    assert.ok(ratio > 0.2 && ratio < 0.4, `seed=${seed} 戻りの割合 ${ratio}`);
  }
});

// ---- 「くわしく」(detail)と、追加の用語80問 ----
const countChars = (s) => [...s].length;
const countSentences = (s) => (s.match(/。/g) || []).length;
const FORBIDDEN_WORDS = ['必ず', '絶対', '買うべき', '売るべき'];

test('detail の網羅: 形状50・ローソク足50・用語120の全220項目に、空でない detail がある', () => {
  assert.equal(L.PATTERNS.length, 50);
  assert.equal(L.CANDLE_PATTERNS.length, 50);
  assert.equal(L.TERMS.length, 120);
  for (const x of [...L.PATTERNS, ...L.CANDLE_PATTERNS, ...L.TERMS]) {
    assert.equal(typeof x.detail, 'string', x.id);
    assert.ok(x.detail.trim().length > 0, x.id);
  }
});

test('DETAIL_BY_ID: 既存の100項目(形状30・ローソク足30・用語の最初の40)だけを持ち、追加の80問・追加の形状20種類・追加のローソク足20種類は入っていない', () => {
  const D = L.DETAIL_BY_ID;
  assert.deepEqual(Object.keys(D).sort(), ['candles', 'patterns', 'terms']);
  assert.deepEqual(Object.keys(D.patterns).sort(), L.PATTERNS.slice(0, 30).map((x) => x.id).sort());
  for (const id of Object.keys(NEW_CHART20)) {
    assert.ok(!(id in D.patterns), `${id} は DETAIL_BY_ID に入れない(自分の detail を持つ)`);
    assert.equal(typeof L.findPattern(id).detail, 'string', id);
  }
  assert.deepEqual(Object.keys(D.candles).sort(), L.CANDLE_PATTERNS.slice(0, 30).map((x) => x.id).sort());
  for (const id of Object.keys(NEW_CANDLE20)) {
    assert.ok(!(id in D.candles), `${id} は DETAIL_BY_ID に入れない(自分の detail を持つ)`);
    assert.equal(typeof L.CANDLE_PATTERNS.find((x) => x.id === id).detail, 'string', id);
  }
  const oldTermIds = L.TERMS.slice(0, 40).map((x) => x.id);
  assert.deepEqual(Object.keys(D.terms).sort(), oldTermIds.slice().sort());
  assert.equal(Object.keys(D.patterns).length + Object.keys(D.candles).length + Object.keys(D.terms).length, 100);
  const newIds = Object.values(NEW80).flatMap((lv) => [...lv.term, ...lv.technical]);
  assert.equal(newIds.length, 80);
  for (const id of newIds) {
    assert.ok(!(id in D.terms) && !(id in D.patterns) && !(id in D.candles), `${id} は DETAIL_BY_ID に入れない`);
    const t = L.TERMS.find((x) => x.id === id);
    assert.ok(t && typeof t.detail === 'string' && t.detail.length > 0, `${id} は自分の detail を持つ`);
  }
  // 表の文が、そのまま各項目に付いている
  for (const [group, items] of [['patterns', L.PATTERNS.slice(0, 30)], ['candles', L.CANDLE_PATTERNS.slice(0, 30)], ['terms', L.TERMS.slice(0, 40)]]) {
    for (const x of items) assert.equal(x.detail, D[group][x.id], x.id);
  }
});

test('detail の質: 120〜250字・2〜4文・「。」で終わり、220個すべて違う文', () => {
  const all = [...L.PATTERNS, ...L.CANDLE_PATTERNS, ...L.TERMS];
  assert.equal(all.length, 220);
  for (const x of all) {
    const n = countChars(x.detail);
    assert.ok(n >= 120 && n <= 250, `${x.id}: ${n}字`);
    const s = countSentences(x.detail);
    assert.ok(s >= 2 && s <= 4, `${x.id}: ${s}文`);
    assert.ok(x.detail.endsWith('。'), x.id);
  }
  assert.equal(new Set(all.map((x) => x.detail)).size, 220);
});

test('detail の質: explanation と同じ・explanation を含む detail はなく、断定や助言の言葉を使わない', () => {
  for (const x of [...L.PATTERNS, ...L.CANDLE_PATTERNS, ...L.TERMS]) {
    assert.notEqual(x.detail, x.explanation, x.id);
    assert.ok(!x.detail.includes(x.explanation), `${x.id}: detail が explanation を含む`);
    for (const w of FORBIDDEN_WORDS) {
      assert.ok(!x.detail.includes(w), `${x.id}: detail に「${w}」`);
      assert.ok(!x.explanation.includes(w), `${x.id}: explanation に「${w}」`);
    }
  }
});

test('形状とローソク足の detail は、特定の問題を指す「正解」「この問題」を含まない', () => {
  for (const x of [...L.PATTERNS, ...L.CANDLE_PATTERNS]) {
    assert.ok(!x.detail.includes('正解'), x.id);
    assert.ok(!x.detail.includes('この問題'), x.id);
  }
});

test('validateQuestion: detail が無い問題は不備として見つける', () => {
  const makers = [
    L.makeTermQuestion(L.TERMS[0], L.createRng(1)),
    L.makeCandleQuestion(L.CANDLE_PATTERNS[0], L.createRng(1)),
    L.makePatternQuestion(L.PATTERNS[0], 1),
  ];
  for (const q of makers) {
    assert.equal(L.validateQuestion(q), null, q.id);
    const broken = { ...q };
    delete broken.detail;
    assert.equal(typeof L.validateQuestion(broken), 'string', q.id);
    assert.equal(typeof L.validateQuestion({ ...q, detail: '' }), 'string', q.id);
  }
});

test('形状の問題は、パターン定義の detail を使う', () => {
  for (const p of L.PATTERNS) {
    assert.equal(L.makePatternQuestion(p, 1).detail, p.detail, p.id);
  }
});

test('追加の用語80問: id が重複せず既存の40問と重ならず、category は term か technical', () => {
  const added = L.TERMS.slice(40);
  assert.equal(added.length, 80);
  const oldIds = new Set(L.TERMS.slice(0, 40).map((t) => t.id));
  assert.equal(new Set(added.map((t) => t.id)).size, 80);
  for (const t of added) {
    assert.ok(!oldIds.has(t.id), t.id);
    assert.ok(['term', 'technical'].includes(t.category), `${t.id}: ${t.category}`);
  }
  assert.equal(added.filter((t) => t.category === 'term').length, 50);
  assert.equal(added.filter((t) => t.category === 'technical').length, 30);
});

test('追加の用語80問: 各難易度にちょうど用語10問+テクニカル6問で、id の表と一致し、難易度が表どおり', () => {
  for (const level of L.DIFFICULTY_LEVELS) {
    const { term, technical } = NEW80[level];
    assert.equal(term.length, 10, level);
    assert.equal(technical.length, 6, level);
    const inLevel = L.TERMS.slice(40).filter((t) => t.difficulty === level);
    assert.deepEqual(inLevel.map((t) => t.id).sort(), [...term, ...technical].sort(), level);
    assert.deepEqual(inLevel.filter((t) => t.category === 'term').map((t) => t.id).sort(), term.slice().sort(), `${level} 用語`);
    assert.deepEqual(inLevel.filter((t) => t.category === 'technical').map((t) => t.id).sort(), technical.slice().sort(), `${level} テクニカル`);
    // buildPool から出る問題の難易度も、その難易度になる
    const pool = L.buildPool('term', L.createRng(1), level);
    for (const id of [...term, ...technical]) {
      const q = pool.find((x) => x.id === `term:${id}`);
      assert.ok(q, `${level}: ${id} が出題の候補にある`);
      assert.equal(q.difficulty, level, id);
    }
  }
});

test('追加の用語80問: 選択肢は4つで重複せず、解説は1〜2文', () => {
  for (const t of L.TERMS.slice(40)) {
    assert.equal(t.wrongs.length, 3, t.id);
    assert.equal(new Set([t.answer, ...t.wrongs]).size, 4, t.id);
    assert.ok(!t.wrongs.includes(t.answer), t.id);
    const s = countSentences(t.explanation);
    assert.ok(s >= 1 && s <= 2, `${t.id}: 解説${s}文`);
    assert.ok(t.question.includes('「') && t.question.endsWith('?'), t.id);
  }
});

test('追加の用語80問: 正解が選択肢の中で唯一いちばん長い問題は、全体で24問以内・各難易度で7問以内', () => {
  // 上限は内容に依存する数。現状は全体20問・各難易度の最大6問。問題を足す・直すときは実数を見て直す
  const isStrictlyLongest = (t) => countChars(t.answer) > Math.max(...t.wrongs.map(countChars));
  const added = L.TERMS.slice(40);
  const longest = added.filter(isStrictlyLongest);
  assert.ok(longest.length <= 24, `全体 ${longest.length} 問: ${longest.map((t) => t.id).join(',')}`);
  for (const level of L.DIFFICULTY_LEVELS) {
    const n = longest.filter((t) => t.difficulty === level).length;
    assert.ok(n <= 7, `${level}: ${n} 問`);
  }
});

test('追加の用語80問: どの項目から作った問題も validateQuestion を通り、difficulty と detail を持つ', () => {
  for (const t of L.TERMS.slice(40)) {
    for (let seed = 1; seed <= 5; seed++) {
      const q = L.makeTermQuestion(t, L.createRng(seed));
      assert.equal(L.validateQuestion(q), null, t.id);
      assert.ok(L.DIFFICULTY_LEVELS.includes(q.difficulty), t.id);
      assert.equal(q.detail, t.detail, t.id);
      assert.ok(q.detail.length > 0, t.id);
    }
  }
});

// ---- 価格の目盛り(チャートの形状) ----
test('priceScaleFor: 同じシードなら同じ。base は300〜4000円ほどで10円刻み、span は base の15〜40%', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const a = L.priceScaleFor(seed);
    assert.deepEqual(a, L.priceScaleFor(seed), `seed=${seed}`);
    assert.ok(a.base >= 300 && a.base <= 4000, `seed=${seed} base=${a.base}`);
    assert.equal(a.base % 10, 0, `seed=${seed}`);
    assert.ok(a.span >= a.base * 0.14 && a.span <= a.base * 0.41, `seed=${seed} span=${a.span}`);
  }
  const bases = new Set();
  for (let seed = 1; seed <= 50; seed++) bases.add(L.priceScaleFor(seed).base);
  assert.ok(bases.size > 20, 'シードごとに基準が変わる');
});

test('priceScaleFor: シードだけで決まり、問題の系列の乱数も、ほかの呼び出しも変えない', () => {
  const p = L.findPattern('double-top');
  const before = L.generateSeries(p, 77);
  L.priceScaleFor(77);
  assert.deepEqual(L.generateSeries(p, 77), before);
  const q = L.makePatternQuestion(p, 77);
  assert.deepEqual(L.chartForQuestion(q).priceScale, L.priceScaleFor(77));
  // 問題のパターンやほかの引数に依存しない
  assert.deepEqual(L.chartForQuestion(L.makePatternQuestion(L.findPattern('v-top'), 77)).priceScale, L.priceScaleFor(77));
});

test('toPrice: 単調に増え、v が -20〜120 でも常に正', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const s = L.priceScaleFor(seed);
    let prev = -Infinity;
    for (let v = -20; v <= 120; v += 5) {
      const price = L.toPrice(v, s);
      assert.ok(price > 0, `seed=${seed} v=${v}`);
      assert.ok(price > prev, `seed=${seed} v=${v}`);
      prev = price;
    }
    assert.equal(L.toPrice(0, s), s.base);
    assert.ok(Math.abs(L.toPrice(100, s) - (s.base + s.span)) < 1e-9);
    assert.ok(Math.abs(L.fromPrice(L.toPrice(37, s), s) - 37) < 1e-9);
  }
});

test('niceTicks: 1・2・5 × 10^k の刻みで、昇順・範囲内・3〜6個', () => {
  const isNice = (step) => {
    const mag = Math.pow(10, Math.floor(Math.log10(step) + 1e-9));
    return [1, 2, 5].some((m) => Math.abs(step - m * mag) < mag * 1e-6);
  };
  const rng = L.createRng(2024);
  for (let i = 0; i < 2000; i++) {
    const min = rng() * 4000 * rng();
    const max = min + Math.pow(10, rng() * 4 - 1);
    const t = L.niceTicks(min, max);
    assert.ok(t.length >= 3 && t.length <= 6, `${min}〜${max} → ${t.length}個`);
    for (let k = 0; k < t.length; k++) {
      assert.ok(t[k] >= min - 1e-9 && t[k] <= max + 1e-9, `${min}〜${max} 範囲外 ${t[k]}`);
      if (k > 0) {
        assert.ok(t[k] > t[k - 1]);
        assert.ok(isNice(t[k] - t[k - 1]), `${min}〜${max} 刻み ${t[k] - t[k - 1]}`);
      }
    }
  }
});

test('niceTicks: 例と決定性と target', () => {
  assert.deepEqual(L.niceTicks(0, 100), [0, 50, 100]);
  assert.deepEqual(L.niceTicks(0, 100, 6), [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(L.niceTicks(1003, 1497), [1100, 1200, 1300, 1400]);
  assert.deepEqual(L.niceTicks(1003, 1497), L.niceTicks(1003, 1497));
  assert.ok(L.niceTicks(0, 100, 6).length >= L.niceTicks(0, 100, 3).length);
});

test('niceTicks: 幅が0や極端に小さい範囲でも壊れない', () => {
  assert.deepEqual(L.niceTicks(500, 500), [500]);
  for (const [min, max] of [[500, 500.001], [1000, 1000.5], [0, 0.003]]) {
    const t = L.niceTicks(min, max);
    assert.ok(t.length >= 1 && t.length <= 6, `${min}〜${max}`);
    assert.ok(t.every((v) => Number.isFinite(v) && v >= min - 1e-9 && v <= max + 1e-9));
  }
});

test('formatPrice: 3桁区切りで円記号なし', () => {
  assert.equal(L.formatPrice(950), '950');
  assert.equal(L.formatPrice(1200), '1,200');
  assert.equal(L.formatPrice(1234567), '1,234,567');
  assert.equal(L.formatPrice(1200.4), '1,200');
});

test('形状の問題の実際の範囲: 目盛りは3〜6本で、範囲内に収まる', () => {
  for (const p of L.PATTERNS) {
    for (let seed = 1; seed <= 20; seed++) {
      const q = L.makePatternQuestion(p, seed);
      const chart = L.chartForQuestion(q);
      const { min, max } = L.chartRange(chart.values, chart.continuation);
      const ticks = L.niceTicks(L.toPrice(min, chart.priceScale), L.toPrice(max, chart.priceScale));
      assert.ok(ticks.length >= 3 && ticks.length <= 6, `${p.id} seed=${seed} ${ticks.length}個`);
    }
  }
});

// ---- 問題の画面で続きの有無が分からないようにする(横幅と縦の範囲は outlook に依らない) ----
test('chartRange: 続きの実物でも空でも、最後の値からの上下の距離が変わらない(up/down/flat/either 同じ)', () => {
  const ids = { up: 'double-bottom', down: 'double-top', flat: null, either: 'symmetrical-triangle' };
  ids.flat = L.PATTERNS.find((p) => p.outlook === 'flat').id;
  for (const [outlook, id] of Object.entries(ids)) {
    assert.equal(L.findPattern(id).outlook, outlook, id);
  }
  for (const seed of [1, 7, 42, 123]) {
    const dist = [];
    for (const id of Object.values(ids)) {
      const q = L.makePatternQuestion(L.findPattern(id), seed);
      const chart = L.chartForQuestion(q);
      const last = chart.values[chart.values.length - 1];
      for (const cont of [chart.continuation, []]) {
        const r = L.chartRange(chart.values, cont);
        const n = chart.values.length + L.CONTINUATION_LENGTH;
        assert.equal(n, 150, id);
        dist.push({ id, up: r.max - last, down: last - r.min });
        // 続きは必ず枠の中に入る
        for (const v of chart.continuation) assert.ok(v >= r.min && v <= r.max, `${id} seed=${seed}`);
      }
      // 続きを見せても見せなくても(空でも)同じ範囲
      const a = L.chartRange(chart.values, chart.continuation);
      const b = L.chartRange(chart.values, []);
      assert.ok(Math.abs(a.min - b.min) < 1e-9 && Math.abs(a.max - b.max) < 1e-9, `${id} seed=${seed}`);
    }
  }
});

test('chartRange: 同じ系列なら、続きが上・下・横ばい・空のどれでも範囲が同じ(50種類 x 複数のシード)', () => {
  for (const p of L.PATTERNS) {
    for (const seed of [1, 2, 3, 99]) {
      const values = L.generateSeries(p, seed);
      const last = values[values.length - 1];
      const ref = L.chartRange(values, []);
      for (const outlook of ['up', 'down', 'flat']) {
        const r = L.chartRange(values, L.generateContinuation(last, outlook, seed));
        assert.ok(Math.abs(r.min - ref.min) < 1e-9 && Math.abs(r.max - ref.max) < 1e-9, `${p.id} seed=${seed} ${outlook}`);
      }
      const q = L.makePatternQuestion(p, seed);
      const chart = L.chartForQuestion(q);
      const own = L.chartRange(chart.values, chart.continuation);
      assert.ok(Math.abs(own.max - ref.max) < 1e-9 && Math.abs(own.min - ref.min) < 1e-9, `${p.id} seed=${seed} 自分の続き`);
      // 最後の値からの上下の距離は、系列だけで決まる(outlook で変わらない)
      assert.ok(own.max - last >= L.CONTINUATION_BAND && last - own.min >= L.CONTINUATION_BAND, `${p.id} seed=${seed}`);
    }
  }
});

test('CONTINUATION_BAND: 続きの値は最後の値の上下 CONTINUATION_BAND を超えない(多数のシード)', () => {
  for (const outlook of ['up', 'down', 'flat']) {
    for (let seed = 1; seed <= 300; seed++) {
      for (const v of L.generateContinuation(50, outlook, seed)) {
        assert.ok(Math.abs(v - 50) <= L.CONTINUATION_BAND, `${outlook} seed=${seed} ${v}`);
      }
    }
  }
});

// ---- 新規チャート20種類(v6: 30 → 50 種類。各難易度10種類) ----
// 形の判定は、どれも「定義から決めたしきい値」で見る。MARGINS=1 で実行すると、各しきい値の最悪の余裕(単位: チャートの値)を表示する
const MARGINS = {};
if (process.env.MARGINS) {
  process.on('exit', () => {
    for (const k of Object.keys(MARGINS).sort()) console.log(`margin ${k} = ${MARGINS[k].toFixed(2)}`);
  });
}
function atLeast(label, value, threshold, ctx = '') {
  MARGINS[label] = Math.min(MARGINS[label] ?? Infinity, value - threshold);
  assert.ok(value >= threshold, `${label} ${ctx}: ${value} < ${threshold}`);
}
function atMost(label, value, threshold, ctx = '') {
  MARGINS[label] = Math.min(MARGINS[label] ?? Infinity, threshold - value);
  assert.ok(value <= threshold, `${label} ${ctx}: ${value} > ${threshold}`);
}
// シード 1〜300(SEEDS=3000 のように環境変数で増やして、しきい値の余裕を調べられる)
const SEEDS300 = Array.from({ length: Number(process.env.SEEDS) || 300 }, (_, i) => i + 1);
// 上昇の向きにそろえた系列(sign=-1 なら上下を反転する)
const seriesOf = (id, seed, sign = 1) => L.generateSeries(L.findPattern(id), seed).map((x) => x * sign);
const at = (v, t) => v[Math.round(t * (v.length - 1))];
const winMax = (v, a, b) => Math.max(...sliceAt(v, [a, b]));
const winMin = (v, a, b) => Math.min(...sliceAt(v, [a, b]));
const winMean = (v, a, b) => { const w = sliceAt(v, [a, b]); return w.reduce((x, y) => x + y, 0) / w.length; };
const idxOfMax = (v, a, b) => { const lo = Math.floor(v.length * a); return lo + sliceAt(v, [a, b]).reduce((m, x, i, arr) => (x > arr[m] ? i : m), 0); };
const idxOfMin = (v, a, b) => { const lo = Math.floor(v.length * a); return lo + sliceAt(v, [a, b]).reduce((m, x, i, arr) => (x < arr[m] ? i : m), 0); };
// 最小二乗の直線(傾きは時刻 0〜1 あたり)。idxs は点の番号、n は系列の長さ
function lineFit(idxs, values, n) {
  const xs = idxs.map((i) => i / (n - 1));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = values.reduce((a, b) => a + b, 0) / values.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (values[i] - my); den += (x - mx) ** 2; });
  const slope = num / den;
  return { slope, at: (t) => my + slope * (t - mx) };
}
// 中心線 mid の上下 h より外へ出た「往復」の列。各要素は { type: 'hi'|'lo', ext: その往復での最大(最小), start, end }
function excursions(v, mid, h) {
  const out = [];
  let cur = null;
  v.forEach((x, i) => {
    const type = x > mid + h ? 'hi' : x < mid - h ? 'lo' : null;
    if (!type) { if (cur) cur.end = i; return; }
    if (cur && cur.type === type) { cur.ext = type === 'hi' ? Math.max(cur.ext, x) : Math.min(cur.ext, x); cur.end = i; } else { cur = { type, ext: x, start: i, end: i }; out.push(cur); }
  });
  return out;
}
// ボックスの上限・下限に2回以上ずつ触れ(往復)、触れた高さがそろっていることを確かめる。box は上限と下限をふくむ系列の部分
function checkBox(box, label, ctx, tol = 8) {
  const mid = (Math.max(...box) + Math.min(...box)) / 2;
  const ex = excursions(box, mid, 4);
  const his = ex.filter((e) => e.type === 'hi');
  const los = ex.filter((e) => e.type === 'lo');
  atLeast(label + ' 上限に触れる回数', his.length, 2, ctx);
  atLeast(label + ' 下限に触れる回数', los.length, 2, ctx);
  // 途中の往復(両端で切れたものをのぞく)の高さがそろう
  const inner = ex.slice(1, -1);
  const hiExt = inner.filter((e) => e.type === 'hi').map((e) => e.ext);
  const loExt = inner.filter((e) => e.type === 'lo').map((e) => e.ext);
  if (hiExt.length > 1) atMost(label + ' 上限のそろい', rangeOf2(hiExt), tol, ctx);
  if (loExt.length > 1) atMost(label + ' 下限のそろい', rangeOf2(loExt), tol, ctx);
  return ex;
}
const strictlyMonotone = (arr, dir, minStep) => arr.every((x, k) => k === 0 || (x - arr[k - 1]) * dir >= minStep);

test('新規チャート20種類: id・名前・outlook・難易度・位置が表どおり(各難易度10種類)', () => {
  const ids = Object.keys(NEW_CHART20);
  assert.equal(ids.length, 20);
  assert.deepEqual(L.PATTERNS.slice(30).map((p) => p.id), ids, '末尾に表の順で並ぶ');
  for (const [id, [name, outlook, level]] of Object.entries(NEW_CHART20)) {
    const p = L.findPattern(id);
    assert.equal(p.name, name, id);
    assert.equal(p.outlook, outlook, id);
    assert.equal(p.difficulty, level, id);
    assert.equal(p.title, undefined, id);
    assert.equal(p.level, undefined, id);
    assert.equal(p.sources, undefined, id);
    assert.equal(p.note, undefined, id);
    assert.equal(p.ma, undefined, id);
  }
  for (const level of L.DIFFICULTY_LEVELS) {
    assert.equal(L.PATTERNS.filter((p) => p.difficulty === level).length, 10, `形は${level}で10種類`);
    assert.equal(L.DIFFICULTY_BY_ID.patterns[level].length, 10, `表も${level}で10`);
  }
  assert.equal(L.PATTERNS.filter((p) => !p.difficulty).length, 0);
  for (const id of ids) {
    for (const level of L.DIFFICULTY_LEVELS) {
      const inTable = L.DIFFICULTY_BY_ID.patterns[level].includes(id);
      assert.equal(inTable, NEW_CHART20[id][2] === level, `${id}/${level}`);
    }
  }
});

test('新規チャート20種類: 骨格が正しく、問題が有効で、続きの点線は outlook の方向に伸びる', () => {
  for (const id of Object.keys(NEW_CHART20)) {
    const p = L.findPattern(id);
    assert.ok(p.points.length >= 4, id);
    for (const [t, v] of p.points) assert.ok(t >= 0 && t <= 1 && v >= 0 && v <= 100, `${id} ${t},${v}`);
    for (let seed = 1; seed <= 20; seed++) {
      const q = L.makePatternQuestion(p, seed);
      assert.equal(L.validateQuestion(q), null, id);
      assert.ok(q.detail && q.explanation, id);
      assert.equal(q.difficulty, NEW_CHART20[id][2], id);
      const c = L.chartForQuestion(q);
      assert.equal(c.values.length, 120, id);
      assert.equal(c.continuation.length, p.outlook === 'either' ? 0 : 30, id);
      assert.equal(c.ma, undefined, id);
      const last = c.values[119];
      const end = c.continuation[29];
      if (p.outlook === 'up') assert.ok(end > last + 5, `${id} 続きは上`);
      if (p.outlook === 'down') assert.ok(end < last - 5, `${id} 続きは下`);
    }
  }
});

test('ボックス上抜け / ボックス下抜け: 水平なボックスを往復して(上下2回以上ずつ触れる)、最後に大きく抜ける(300シード)', () => {
  for (const [id, sign] of [['box-breakout-up', 1], ['box-breakout-down', -1]]) {
    for (const seed of SEEDS300) {
      const v = seriesOf(id, seed, sign);
      const n = v.length;
      const ctx = `${id} seed=${seed}`;
      const box = sliceAt(v, [0, 0.66]);
      atMost(`${id} ボックスの幅`, rangeOf2(box), 29, ctx);
      atLeast(`${id} ボックスの幅(狭すぎない)`, rangeOf2(box), 14, ctx);
      checkBox(box, id, ctx); // 上限・下限に2回以上ずつ触れ、触れた高さがそろう(ほぼ水平)
      const top = Math.max(...box);
      atLeast(`${id} 最後の抜けの大きさ`, v[n - 1] - top, 12, ctx);
      atLeast(`${id} 最後が高値`, v[n - 1], Math.max(...v) - 4, ctx);
    }
  }
});

test('N字上昇 / N字下降: 上昇→押し(出発点より上)→前の高値を更新する3つの波(300シード)', () => {
  for (const [id, sign] of [['n-wave-up', 1], ['n-wave-down', -1]]) {
    for (const seed of SEEDS300) {
      const v = seriesOf(id, seed, sign);
      const n = v.length;
      const ctx = `${id} seed=${seed}`;
      const start = v[0];
      const high = winMax(v, 0.2, 0.5);
      const dip = winMin(v, 0.45, 0.75);
      atLeast(`${id} 第1波の上げ`, high - start, 35, ctx);
      atLeast(`${id} 押しの深さ`, high - dip, 15, ctx);
      atLeast(`${id} 押しは出発点より上`, dip - start, 10, ctx);
      atLeast(`${id} 最後に前の高値を更新`, v[n - 1] - high, 12, ctx);
      atLeast(`${id} 最後が高値`, v[n - 1], Math.max(...v) - 4, ctx);
      const highAt = idxOfMax(v, 0.2, 0.5);
      const dipAt = idxOfMin(v, 0.45, 0.75);
      assert.ok(highAt > n * 0.27 && highAt < n * 0.43, `${ctx} 前の高値の位置 ${highAt}`);
      assert.ok(dipAt > n * 0.5 && dipAt < n * 0.68, `${ctx} 押しの位置 ${dipAt}`);
    }
  }
});

test('拡大三角形: 高値は切り上がり安値は切り下がって値幅が広がり、最後に安値を割る(300シード)', () => {
  for (const seed of SEEDS300) {
    const v = seriesOf('broadening-top', seed);
    const n = v.length;
    const ctx = `seed=${seed}`;
    // 山 P1〜P3 と谷 T1〜T3(最後の谷 T3 は平らになりやすいので、時間の窓の最小値でとる)
    const p = [winMax(v, 0.03, 0.17), winMax(v, 0.28, 0.44), winMax(v, 0.55, 0.72)];
    const t = [winMin(v, 0.15, 0.3), winMin(v, 0.42, 0.58), winMin(v, 0.72, 0.95)];
    const order = [idxOfMax(v, 0.03, 0.17), idxOfMin(v, 0.15, 0.3), idxOfMax(v, 0.28, 0.44), idxOfMin(v, 0.42, 0.58),
      idxOfMax(v, 0.55, 0.72), idxOfMin(v, 0.72, 0.95)];
    assert.ok(strictlyMonotone(order, 1, 4), `${ctx} 山谷の順 ${order}`);
    for (let k = 1; k < 3; k++) {
      atLeast('拡大三角形 高値の切り上がり', p[k] - p[k - 1], 8, ctx);
      atLeast('拡大三角形 安値の切り下がり', t[k - 1] - t[k], 8, ctx);
    }
    // 山から谷への振れ幅が、どんどん広がる
    atLeast('拡大三角形 振れ幅の拡大(2回目/1回目)', p[1] - t[1], (p[0] - t[0]) * 1.4, ctx);
    atLeast('拡大三角形 振れ幅の拡大(3回目/2回目)', p[2] - t[2], (p[1] - t[1]) * 1.3, ctx);
    atLeast('拡大三角形 最後の山の高さ', p[2], v[0] + 40, ctx);
    // 最後は直前までの安値を割ったところで終わる
    atMost('拡大三角形 最後は直前の安値より下', v[n - 1], t[1], ctx);
  }
});

test('上抜けダマシ / 下抜けダマシ: ボックスを一時的に抜けるが戻り、逆側に抜けて終わる(300シード)', () => {
  for (const [id, sign] of [['false-breakout-up', 1], ['false-breakout-down', -1]]) {
    for (const seed of SEEDS300) {
      const v = seriesOf(id, seed, sign);
      const n = v.length;
      const ctx = `${id} seed=${seed}`;
      const box = sliceAt(v, [0, 0.52]);
      const top = Math.max(...box);
      const bottom = Math.min(...box);
      atMost(`${id} ボックスの幅`, top - bottom, 28, ctx);
      checkBox(box, id, ctx);
      const spike = winMax(v, 0.56, 0.76);
      atLeast(`${id} 一時的な抜け`, spike - top, 8, ctx);
      const spikeAt = idxOfMax(v, 0.56, 0.76);
      assert.ok(spikeAt > n * 0.58 && spikeAt < n * 0.72, `${ctx} 抜けの位置 ${spikeAt}`);
      // 抜けは長く続かない: 上限より高い点が少ない
      atMost(`${id} 抜けた点の数`, v.filter((x, i) => i > n * 0.5 && x > top + 2).length, 24, ctx);
      // ボックスの中へ戻り、さらに下限を割って終わる
      atMost(`${id} 戻り`, at(v, 0.8), top - 8, ctx);
      atMost(`${id} 最後は下限の下`, v[n - 1], bottom - 10, ctx);
      atMost(`${id} 最後が安値`, v[n - 1], Math.min(...v) + 4, ctx);
    }
  }
});

test('三角保ち合い上放れ / 下放れ: 高値が切り下がり安値が切り上がって収束し、最後に抜ける(300シード)', () => {
  for (const [id, sign] of [['triangle-breakout-up', 1], ['triangle-breakout-down', -1]]) {
    for (const seed of SEEDS300) {
      const v = seriesOf(id, seed, sign);
      const n = v.length;
      const ctx = `${id} seed=${seed}`;
      const r1 = rangeOf2(sliceAt(v, [0.04, 0.3]));
      const r2 = rangeOf2(sliceAt(v, [0.3, 0.52]));
      const r3 = rangeOf2(sliceAt(v, [0.52, 0.72]));
      atLeast(`${id} 値幅が狭まる(前半/中盤)`, r1 - r2 * 1.15, 0, ctx);
      atLeast(`${id} 値幅が狭まる(中盤/後半)`, r2 - r3 * 1.15, 0, ctx);
      const tri = sliceAt(v, [0, 0.76]);
      const ps = onePeak(tri, 6, 8);
      const ts = oneTrough(tri, 6, 8);
      atLeast(`${id} 山の数`, ps.length, 3, ctx);
      atLeast(`${id} 谷の数`, ts.length, 3, ctx);
      const ph = ps.map((i) => tri[i]);
      const th = ts.map((i) => tri[i]);
      assert.ok(strictlyMonotone(ph, -1, 2), `${ctx} 高値の切り下がり ${ph}`);
      assert.ok(strictlyMonotone(th, 1, 2), `${ctx} 安値の切り上がり ${th}`);
      atLeast(`${id} 最後の抜け(最後の高値より上)`, v[n - 1] - ph[ph.length - 1], 15, ctx);
      atLeast(`${id} 最後が高値`, v[n - 1], Math.max(...v) - 4, ctx);
    }
  }
});

test('リターンムーブ(上・下): ボックスを抜け、抜けた線まで押し戻されてから、再び抜けた方向へ進む(300シード)', () => {
  for (const [id, sign] of [['return-move-up', 1], ['return-move-down', -1]]) {
    for (const seed of SEEDS300) {
      const v = seriesOf(id, seed, sign);
      const n = v.length;
      const ctx = `${id} seed=${seed}`;
      const box = sliceAt(v, [0, 0.46]);
      const top = Math.max(...box);
      atMost(`${id} ボックスの幅`, top - Math.min(...box), 28, ctx);
      checkBox(box, id, ctx);
      const peak = winMax(v, 0.55, 0.72);
      atLeast(`${id} 上抜けの大きさ`, peak - top, 12, ctx);
      const pull = winMin(v, 0.7, 0.82);
      atMost(`${id} 押し戻しは抜けた線の近く(上側)`, pull - top, 9, ctx);
      atLeast(`${id} 押し戻しは抜けた線の近く(下側)`, pull - top, -9, ctx);
      atLeast(`${id} 押し戻しの深さ`, peak - pull, 12, ctx);
      atLeast(`${id} 再上昇`, v[n - 1] - peak, 6, ctx);
      atLeast(`${id} 最後が高値`, v[n - 1], Math.max(...v) - 4, ctx);
    }
  }
});

test('下降ウェッジ上抜け / 上昇ウェッジ下抜け: 高値と安値が同じ向きに傾いて収束し、最後に反対側へ抜ける(300シード)', () => {
  for (const [id, sign] of [['falling-wedge-breakout-up', 1], ['rising-wedge-breakout-down', -1]]) {
    for (const seed of SEEDS300) {
      const v = seriesOf(id, seed, sign); // 以後は「下降ウェッジを上に抜ける」向き
      const n = v.length;
      const ctx = `${id} seed=${seed}`;
      // 高値(Pa,Pb,Pc)と安値(Ta,Tb,Tc)を時間の窓でとる
      const pa = winMax(v, 0.15, 0.3);
      const pb = winMax(v, 0.4, 0.52);
      const pc = winMax(v, 0.6, 0.7);
      const ta = winMin(v, 0.28, 0.42);
      const tb = winMin(v, 0.52, 0.64);
      const tc = winMin(v, 0.68, 0.8);
      atLeast(`${id} 高値の切り下がり(1→2)`, pa - pb, 8, ctx);
      atLeast(`${id} 高値の切り下がり(2→3)`, pb - pc, 6, ctx);
      atLeast(`${id} 安値の切り下がり(1→2)`, ta - tb, 3, ctx);
      atLeast(`${id} 安値の切り下がり(2→3)`, tb - tc, 3, ctx);
      // 上の線のほうが急に下がって、2本の線が近づく(収束)。下げ幅・戻り幅がだんだん小さくなる
      atLeast(`${id} 上の線のほうが急`, (pa - pc) - (ta - tc), 6, ctx);
      atLeast(`${id} 下げ幅が縮む(1→2)`, (pa - ta) - (pb - tb), 4, ctx);
      atLeast(`${id} 下げ幅が縮む(2→3)`, (pb - tb) - (pc - tc), 2, ctx);
      atLeast(`${id} 戻り幅が縮む`, (pb - ta) - (pc - tb), 0, ctx);
      // 最後は、ウェッジの最後の高値より上へ抜けて終わる
      atLeast(`${id} 最後の抜け`, v[n - 1] - pc, 15, ctx);
      const lowAt = idxOfMin(v, 0.5, 0.86);
      assert.ok(lowAt > n * 0.66 && lowAt < n * 0.82, `${ctx} ウェッジの安値の位置 ${lowAt}`);
      atLeast(`${id} 最後は安値から大きく戻す`, v[n - 1] - v[lowAt], 30, ctx);
    }
  }
});

test('エリオット波動 上昇5波 / 下降5波: 5つの波で、第3波が最大・第4波は第1波に重ならず・第2波は出発点を割らない(300シード)', () => {
  for (const [id, sign] of [['elliott-impulse-up', 1], ['elliott-impulse-down', -1]]) {
    for (const seed of SEEDS300) {
      const v = seriesOf(id, seed, sign);
      const n = v.length;
      const ctx = `${id} seed=${seed}`;
      const start = v[0];
      const p1 = winMax(v, 0.08, 0.2);
      const t2 = winMin(v, 0.17, 0.3);
      const p3 = winMax(v, 0.44, 0.58);
      const t4 = winMin(v, 0.56, 0.7);
      const p5 = winMax(v, 0.8, 0.94);
      atLeast(`${id} 第1波の上げ`, p1 - start, 15, ctx);
      atLeast(`${id} 第2波は出発点を割らない`, t2 - start, 6, ctx);
      atLeast(`${id} 第2波の押し`, p1 - t2, 6, ctx);
      atLeast(`${id} 第3波は第1波の高値を超える`, p3 - p1, 25, ctx);
      atLeast(`${id} 第4波は第1波の高値に重ならない`, t4 - p1, 6, ctx);
      atLeast(`${id} 第4波の押し`, p3 - t4, 15, ctx);
      atLeast(`${id} 第5波は第3波の高値を超える`, p5 - p3, 6, ctx);
      const w1 = p1 - start;
      const w3 = p3 - t2;
      const w5 = p5 - t4;
      atLeast(`${id} 第3波は第1波の1.5倍以上`, w3 / w1, 1.5, ctx);
      atLeast(`${id} 第3波は第5波より大きい`, w3 / w5, 1.15, ctx);
      atLeast(`${id} 最後は5波目の高値圏`, v[n - 1], p5 - 12, ctx);
      // 時間の並び
      const order = [idxOfMax(v, 0.08, 0.2), idxOfMin(v, 0.17, 0.3), idxOfMax(v, 0.44, 0.58), idxOfMin(v, 0.56, 0.7), idxOfMax(v, 0.8, 0.94)];
      assert.ok(strictlyMonotone(order, 1, 3), `${ctx} 波の順 ${order}`);
    }
  }
});

test('エリオット波動 5波+調整3波(上・下): 5波のあとに下・上・下(上・下・上)の3波が続き、1サイクルをなす(300シード)', () => {
  for (const [id, sign] of [['elliott-cycle-up', 1], ['elliott-cycle-down', -1]]) {
    for (const seed of SEEDS300) {
      const v = seriesOf(id, seed, sign);
      const n = v.length;
      const ctx = `${id} seed=${seed}`;
      const start = v[0];
      const p1 = winMax(v, 0.03, 0.14);
      const t2 = winMin(v, 0.12, 0.22);
      const p3 = winMax(v, 0.25, 0.37);
      const t4 = winMin(v, 0.34, 0.46);
      const p5 = winMax(v, 0.48, 0.62);
      const a = winMin(v, 0.6, 0.72);
      const b = winMax(v, 0.72, 0.84);
      const c = winMin(v, 0.84, 0.96);
      atLeast(`${id} 第1波の上げ`, p1 - start, 15, ctx);
      atLeast(`${id} 第2波は出発点を割らない`, t2 - start, 5, ctx);
      atLeast(`${id} 第2波の押し`, p1 - t2, 6, ctx);
      atLeast(`${id} 第3波は第1波の高値を超える`, p3 - p1, 25, ctx);
      atLeast(`${id} 第4波は第1波の高値に重ならない`, t4 - p1, 6, ctx);
      atLeast(`${id} 第4波の押し`, p3 - t4, 10, ctx);
      atLeast(`${id} 第5波は第3波の高値を超える`, p5 - p3, 8, ctx);
      atLeast(`${id} 第3波は第1波の1.4倍以上`, (p3 - t2) / (p1 - start), 1.4, ctx);
      atLeast(`${id} 第3波は第5波より大きい`, (p3 - t2) / (p5 - t4), 1.1, ctx);
      // 調整: A は5波の天井からはっきり下げ、B で戻しても天井には届かず、C は A より低い
      atLeast(`${id} A波の下げ`, p5 - a, 20, ctx);
      atLeast(`${id} B波の戻し`, b - a, 8, ctx);
      atLeast(`${id} B波は天井に届かない`, p5 - b, 6, ctx);
      atLeast(`${id} C波はA波より低い`, a - c, 8, ctx);
      atLeast(`${id} C波はB波からの下げ`, b - c, 20, ctx);
      atMost(`${id} 最後は天井より下`, v[n - 1], p5 - 25, ctx);
      const order = [idxOfMax(v, 0.03, 0.14), idxOfMin(v, 0.12, 0.22), idxOfMax(v, 0.25, 0.37), idxOfMin(v, 0.34, 0.46),
        idxOfMax(v, 0.48, 0.62), idxOfMin(v, 0.6, 0.72), idxOfMax(v, 0.72, 0.84), idxOfMin(v, 0.84, 0.96)];
      assert.ok(strictlyMonotone(order, 1, 3), `${ctx} 波の順 ${order}`);
    }
  }
});

test('上昇チャネル下抜け / 下降チャネル上抜け: 平行なチャネルのあと、最後に反対側へ抜ける(300シード)', () => {
  for (const [id, sign] of [['ascending-channel-breakdown', 1], ['descending-channel-breakout-up', -1]]) {
    for (const seed of SEEDS300) {
      const v = seriesOf(id, seed, sign); // 以後は「上昇チャネルを下に抜ける」向き
      const n = v.length;
      const ctx = `${id} seed=${seed}`;
      const body = sliceAt(v, [0, 0.72]);
      const ps = onePeak(body, 6, 5);
      const ts = oneTrough(body, 6, 5);
      atLeast(`${id} 山の数`, ps.length, 4, ctx);
      atLeast(`${id} 谷の数`, ts.length, 3, ctx);
      const sp = slopeOf(ps, ps.map((i) => body[i]));
      const st = slopeOf(ts, ts.map((i) => body[i]));
      atLeast(`${id} 高値の傾き`, sp, 0.25, ctx);
      atLeast(`${id} 安値の傾き`, st, 0.25, ctx);
      atMost(`${id} 平行(傾きの差の割合)`, Math.abs(sp - st) / Math.max(sp, st), 0.3, ctx);
      assert.ok(strictlyMonotone(ps.map((i) => body[i]), 1, 3), `${ctx} 高値の切り上げ`);
      assert.ok(strictlyMonotone(ts.map((i) => body[i]), 1, 3), `${ctx} 安値の切り上げ`);
      // 最後は、チャネルの下の線を大きく割る
      const lower = lineFit(ts, ts.map((i) => body[i]), n);
      atMost(`${id} 下の線の割り込み(終点)`, v[n - 1], lower.at(1) - 25, ctx);
      atMost(`${id} 下の線の割り込み(途中)`, at(v, 0.86), lower.at(0.86) - 10, ctx);
      atMost(`${id} 最後が安値`, v[n - 1], Math.min(...v) + 4, ctx);
      atLeast(`${id} 最後の山から大きく下げる`, body[ps[ps.length - 1]] - v[n - 1], 40, ctx);
    }
  }
});

test('セリングクライマックス: 下落が次第に加速し、最後に急落して底をつけ、少し戻して終わる(300シード)', () => {
  for (const seed of SEEDS300) {
    const v = seriesOf('selling-climax', seed);
    const n = v.length;
    const ctx = `seed=${seed}`;
    const low = Math.min(...v);
    const lowAt = v.indexOf(low);
    assert.ok(lowAt > n * 0.84 && lowAt < n * 0.96, `${ctx} 底の位置 ${lowAt}`);
    atLeast('セリングクライマックス 全体の下げ', v[0] - low, 60, ctx);
    // 区間ごとの下落の速さ(1点あたり)が、前半 < 中盤 < 終盤と上がる
    const rate = (a, b) => (at(v, a) - at(v, b)) / ((b - a) * (n - 1));
    const r1 = rate(0, 0.3);
    const r2 = rate(0.3, 0.68);
    const r3 = rate(0.68, 0.86);
    atMost('セリングクライマックス 前半はゆるやか', r1, 0.4, ctx);
    atLeast('セリングクライマックス 終盤の加速(中盤の2.2倍)', r3 / r2, 2.2, ctx);
    atLeast('セリングクライマックス 中盤の加速(前半の1.5倍)', r2 / Math.max(r1, 0.05), 1.5, ctx);
    atLeast('セリングクライマックス 最後の急落の大きさ', at(v, 0.68) - low, 30, ctx);
    // 底のあと、少し戻して終わる(戻りすぎない)
    atLeast('セリングクライマックス 底からの戻り', v[n - 1] - low, 6, ctx);
    atMost('セリングクライマックス 戻りすぎない', v[n - 1] - low, 30, ctx);
  }
});

test('新規チャート20種類は、ほかのどの形ともはっきり違う骨格を持つ(見分けがつく)', () => {
  // 全50種類の骨格をならした形(ノイズなし・縦を0〜100にそろえる)を比べて、近すぎる組がないことを見る
  const sampled = (p) => {
    const f = L.makeSpline(p.points);
    return Array.from({ length: 60 }, (_, i) => f(i / 59));
  };
  const dist = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0) / a.length);
  const norm = (a) => { const mn = Math.min(...a); const mx = Math.max(...a); return a.map((x) => ((x - mn) / (mx - mn)) * 100); };
  const shapes = L.PATTERNS.map((p) => ({ id: p.id, y: norm(sampled(p)) }));
  let nearest = Infinity;
  for (const s of shapes) {
    if (!NEW_CHART20[s.id]) continue;
    for (const o of shapes) {
      if (o.id === s.id) continue;
      const d = dist(s.y, o.y);
      nearest = Math.min(nearest, d);
      assert.ok(d > 7, `${s.id} と ${o.id} の骨格が近すぎる: ${d.toFixed(1)}`);
    }
  }
  MARGINS['骨格の近さ(最小距離-7)'] = nearest - 7;
});

test('新規チャート20種類: 滑らかさ(2階差)は既存のしきい値(2.65)のまま、シード1〜300でも超えない', () => {
  let worst = 0;
  for (const id of Object.keys(NEW_CHART20)) {
    for (const seed of SEEDS300) {
      const v = L.generateSeries(L.findPattern(id), seed);
      for (let i = 1; i < v.length - 1; i++) worst = Math.max(worst, Math.abs(v[i + 1] - 2 * v[i] + v[i - 1]));
    }
  }
  MARGINS['滑らかさ(2.65-最大の2階差)'] = 2.65 - worst;
  assert.ok(worst < 2.65, `worst=${worst}`);
});

test('新規チャート20種類の紛らわしい組が両方向で isConfusable で、形状の選択肢に同時に出ない', () => {
  const entries = Object.entries(NEW_CHART20_CONFUSABLE);
  assert.equal(entries.length, 20);
  for (const [id, others] of entries) {
    for (const other of others) {
      assert.ok(L.PATTERNS.some((p) => p.id === other), `${id} の相手 ${other} が存在する`);
      assert.equal(L.isConfusable(id, other), true, `${id}/${other}`);
      assert.equal(L.isConfusable(other, id), true, `${other}/${id}`);
      for (let seed = 1; seed <= 60; seed++) {
        for (const [x, y] of [[id, other], [other, id]]) {
          const q = L.makePatternQuestion(L.findPattern(x), seed);
          assert.ok(!q.choices.includes(L.findPattern(y).name), `${x} vs ${y} seed=${seed}`);
        }
      }
    }
  }
  // 実装で足した組
  for (const [a, b] of [['ascending-channel-breakdown', 'rising-wedge'], ['descending-channel-breakout-up', 'falling-wedge'],
    ['elliott-impulse-up', 'n-wave-up'], ['elliott-impulse-down', 'n-wave-down']]) {
    assert.equal(L.isConfusable(a, b), true, `${a}/${b}`);
    assert.equal(L.isConfusable(b, a), true, `${b}/${a}`);
  }
});

// v6 の確認で足した、チャートの形どうしの紛らわしい組(14組)
const CHART20_CHECK_PAIRS = [
  ['box-breakout-down', 'triple-top'], ['box-breakout-up', 'triple-bottom'],
  ['false-breakout-up', 'triple-top'], ['false-breakout-down', 'triple-bottom'],
  ['false-breakout-up', 'return-move-down'], ['false-breakout-down', 'return-move-up'],
  ['elliott-cycle-up', 'ascending-channel-breakdown'], ['elliott-cycle-down', 'descending-channel-breakout-up'],
  ['elliott-cycle-up', 'rising-wedge-breakout-down'], ['elliott-cycle-down', 'falling-wedge-breakout-up'],
  ['selling-climax', 'rounding-top'], ['selling-climax', 'bearish-perfect-order'],
  ['triangle-breakout-up', 'box-breakout-up'], ['triangle-breakout-down', 'box-breakout-down'],
];

test('確認で足したチャートの形14組: 両方向で isConfusable で、形状の選択肢に同時に出ない', () => {
  assert.equal(CHART20_CHECK_PAIRS.length, 14);
  for (const [a, b] of CHART20_CHECK_PAIRS) {
    assert.equal(L.isConfusable(a, b), true, `${a}/${b}`);
    assert.equal(L.isConfusable(b, a), true, `${b}/${a}`);
    for (let seed = 1; seed <= 60; seed++) {
      for (const [x, y] of [[a, b], [b, a]]) {
        const q = L.makePatternQuestion(L.findPattern(x), seed);
        assert.ok(!q.choices.includes(L.findPattern(y).name), `${x} vs ${y} seed=${seed}`);
        assert.equal(L.validateQuestion(q), null, `${x} seed=${seed}`);
      }
    }
  }
});

// 最終確認で足した、チャートの形どうしの紛らわしい組(2組)
test('最終確認で足したエリオット推進波とウェッジの2組: 両方向で isConfusable で、形状の選択肢に同時に出ない', () => {
  for (const [a, b] of [['elliott-impulse-up', 'rising-wedge'], ['elliott-impulse-down', 'falling-wedge']]) {
    assert.equal(L.isConfusable(a, b), true, `${a}/${b}`);
    assert.equal(L.isConfusable(b, a), true, `${b}/${a}`);
    for (let seed = 1; seed <= 60; seed++) {
      for (const [x, y] of [[a, b], [b, a]]) {
        const q = L.makePatternQuestion(L.findPattern(x), seed);
        assert.ok(!q.choices.includes(L.findPattern(y).name), `${x} vs ${y} seed=${seed}`);
        assert.equal(L.validateQuestion(q), null, `${x} seed=${seed}`);
      }
    }
  }
});

test('チャートの形どうしの紛らわしい組の数は 111(確認前の 95 組に 14 組、最終確認で 2 組を足した)', () => {
  const patternIds = new Set(L.PATTERNS.map((p) => p.id));
  const pairs = L.CONFUSABLE_PAIRS.filter(([a, b]) => patternIds.has(a) && patternIds.has(b));
  assert.equal(pairs.length, 111);
  assert.equal(new Set(pairs.map(([a, b]) => [a, b].sort().join('|'))).size, 111, '重複なし');
});

test('新規チャート20種類: 各難易度の形状のラウンドは10問で、その難易度の10種類がちょうど1回ずつ出る', () => {
  for (const level of L.DIFFICULTY_LEVELS) {
    assert.equal(L.roundSize('pattern', level), 10, level);
    for (let seed = 1; seed <= 30; seed++) {
      const deck = L.buildDeck('pattern', seed, level);
      assert.equal(deck.length, 10, `${level} seed=${seed}`);
      assert.deepEqual(deck.map((q) => q.patternId).sort(), L.DIFFICULTY_BY_ID.patterns[level].slice().sort(), `${level} seed=${seed}`);
      for (const q of deck) {
        assert.equal(L.validateQuestion(q), null, q.id);
        assert.equal(q.difficulty, level, q.id);
      }
    }
  }
});

test('新規チャート20種類: explanation は「よ。」で終わり、detail は特定の問題を指さない', () => {
  for (const id of Object.keys(NEW_CHART20)) {
    const p = L.findPattern(id);
    assert.ok(p.explanation.endsWith('よ。'), id);
    assert.ok(p.detail.endsWith('。'), id);
    assert.ok(!p.detail.includes('正解') && !p.detail.includes('この問題'), id);
  }
});

// ---- v6: ローソク足20種類の追加(30 → 50 種類。各難易度10種類) ----
// id -> [名前, 難易度](表の順。CANDLE_PATTERNS の末尾にこの順で並ぶ)
const NEW_CANDLE20 = {
  'bullish-marubozu': ['陽の丸坊主', 'easy'],
  'bearish-marubozu': ['陰の丸坊主', 'normal'],
  'four-price-doji': ['四値同時線', 'hard'],
  'bullish-opening-marubozu': ['陽の寄り付き坊主', 'hard'],
  'bearish-opening-marubozu': ['陰の寄り付き坊主', 'expert'],
  'three-gaps-up': ['三空踏み上げ', 'expert'],
  'three-gaps-down': ['三空叩き込み', 'expert'],
  'upward-gap-side-by-side-white': ['上放れ並び赤', 'expert'],
  'downward-gap-side-by-side-black': ['下放れ並び黒', 'expert'],
  'thrusting-line': ['差し込み線', 'expert'],
  'irikubi-line': ['入り首線', 'expert'],
  'yukichigai-line': ['行き違い線', 'expert'],
  'bullish-deai-line': ['陽の出合い線', 'master'],
  'bearish-deai-line': ['陰の出合い線', 'master'],
  'bullish-tasuki-line': ['陽のたすき線', 'master'],
  'bearish-tasuki-line': ['陰のたすき線', 'master'],
  'upward-gap-star': ['上放れの星', 'master'],
  'downward-gap-star': ['下放れの星', 'master'],
  'three-soldiers-stalled': ['赤三兵先詰まり', 'master'],
  'three-soldiers-deliberation': ['赤三兵思案星', 'master'],
};
// 各足の「紛らわしい組」(topics の confusable_with に、見た目が近い組を足したもの)。両方向で isConfusable になる
const NEW_CANDLE20_CONFUSABLE = {
  'bullish-marubozu': ['big-bullish', 'bearish-marubozu', 'bullish-opening-marubozu'],
  'bearish-marubozu': ['big-bearish', 'bullish-marubozu', 'bearish-opening-marubozu'],
  'four-price-doji': ['doji', 'dragonfly-doji', 'gravestone-doji'],
  'bullish-opening-marubozu': ['shooting-star', 'upper-shadow-bearish', 'bullish-marubozu', 'big-bullish', 'bearish-opening-marubozu'],
  'bearish-opening-marubozu': ['hammer', 'lower-shadow-bullish', 'bearish-marubozu', 'big-bearish'],
  'three-gaps-up': ['gap-up', 'three-white-soldiers', 'three-gaps-down', 'upward-gap-side-by-side-white'],
  'three-gaps-down': ['gap-down', 'three-black-crows', 'downward-gap-side-by-side-black'],
  'upward-gap-side-by-side-white': ['gap-up', 'three-white-soldiers', 'downward-gap-side-by-side-black', 'upward-gap-star', 'three-soldiers-deliberation'],
  'downward-gap-side-by-side-black': ['gap-down', 'three-black-crows', 'downward-gap-star'],
  'thrusting-line': ['piercing-line', 'bullish-engulfing', 'irikubi-line', 'tweezer-bottom'],
  'irikubi-line': ['piercing-line', 'bearish-harami', 'bullish-deai-line', 'tweezer-bottom'],
  'yukichigai-line': ['bullish-deai-line', 'bullish-engulfing', 'gap-up', 'bearish-deai-line', 'bullish-tasuki-line'],
  'bullish-deai-line': ['thrusting-line', 'piercing-line', 'bearish-deai-line'],
  'bearish-deai-line': ['dark-cloud-cover', 'bearish-engulfing'],
  'bullish-tasuki-line': ['bullish-engulfing', 'piercing-line', 'bearish-tasuki-line', 'yukichigai-line'],
  'bearish-tasuki-line': ['bearish-engulfing', 'dark-cloud-cover'],
  'upward-gap-star': ['evening-star', 'gap-up', 'spinning-top', 'three-soldiers-deliberation'],
  'downward-gap-star': ['morning-star', 'gap-down', 'spinning-top'],
  'three-soldiers-stalled': ['three-white-soldiers', 'three-soldiers-deliberation'],
  'three-soldiers-deliberation': ['three-white-soldiers', 'gap-up'],
};

test('新規ローソク足20種類: 50個になり、末尾に表の順で並び、名前と id が重複しない', () => {
  assert.equal(L.CANDLE_PATTERNS.length, 50);
  assert.deepEqual(L.CANDLE_PATTERNS.slice(30).map((c) => c.id), Object.keys(NEW_CANDLE20));
  assert.equal(new Set(L.CANDLE_PATTERNS.map((c) => c.id)).size, 50);
  assert.equal(new Set(L.CANDLE_PATTERNS.map((c) => c.name)).size, 50);
  for (const [id, [name, level]] of Object.entries(NEW_CANDLE20)) {
    const item = L.CANDLE_PATTERNS.find((c) => c.id === id);
    assert.equal(item.name, name, id);
    assert.equal(item.difficulty, level, id);
    assert.deepEqual(Object.keys(item).sort(), ['candles', 'detail', 'difficulty', 'explanation', 'id', 'name'], id);
    assert.ok(item.candles.length >= 1 && item.candles.length <= 5, id);
    for (const k of item.candles) {
      assert.ok(k.h >= Math.max(k.o, k.c) && k.l <= Math.min(k.o, k.c), `${id}: 値が矛盾`);
      for (const v of [k.o, k.h, k.l, k.c]) assert.ok(v >= 0 && v <= 100, `${id}: 0〜100 の外`);
    }
  }
});

test('新規ローソク足20種類: 難易度の表に入り、各難易度ちょうど10種類(足の追加は +1/+1/+2/+8/+8)', () => {
  const added = { easy: 1, normal: 1, hard: 2, expert: 8, master: 8 };
  for (const level of L.DIFFICULTY_LEVELS) {
    assert.equal(L.DIFFICULTY_BY_ID.candles[level].length, 10, level);
    const mine = Object.entries(NEW_CANDLE20).filter(([, v]) => v[1] === level).map(([id]) => id);
    assert.equal(mine.length, added[level], level);
    for (const id of mine) assert.ok(L.DIFFICULTY_BY_ID.candles[level].includes(id), `${level}/${id}`);
    assert.equal(L.CANDLE_PATTERNS.filter((c) => c.difficulty === level).length, 10, level);
  }
});

test('新規ローソク足20種類: 紛らわしい組が両方向で isConfusable で、選択肢に同時に出ない(シード1〜40)', () => {
  const idSet = new Set(L.CANDLE_PATTERNS.map((c) => c.id));
  const nameOf = (id) => L.CANDLE_PATTERNS.find((c) => c.id === id).name;
  for (const [id, others] of Object.entries(NEW_CANDLE20_CONFUSABLE)) {
    assert.ok(others.length >= 2, id);
    for (const other of others) {
      assert.ok(idSet.has(other), `${id}/${other}: 知らない id`);
      assert.equal(L.isConfusable(id, other), true, `${id}/${other}`);
      assert.equal(L.isConfusable(other, id), true, `${other}/${id}`);
      for (let seed = 1; seed <= 40; seed++) {
        for (const [x, y] of [[id, other], [other, id]]) {
          const q = L.makeCandleQuestion(L.CANDLE_PATTERNS.find((c) => c.id === x), L.createRng(seed));
          assert.ok(!q.choices.includes(nameOf(y)), `${x} vs ${y} seed=${seed}`);
          assert.equal(L.validateQuestion(q), null, `${x} seed=${seed}`);
        }
      }
    }
  }
});

test('新規ローソク足20種類: 問題は validateQuestion を通り、explanation は「よ。」で終わり、detail を自分で持つ', () => {
  for (const [id, [, level]] of Object.entries(NEW_CANDLE20)) {
    const item = L.CANDLE_PATTERNS.find((c) => c.id === id);
    assert.ok(item.explanation.endsWith('よ。'), id);
    assert.ok(item.detail.endsWith('よ。'), id);
    assert.ok(!(id in L.DETAIL_BY_ID.candles), `${id} は DETAIL_BY_ID に入れない`);
    for (let seed = 1; seed <= 10; seed++) {
      const q = L.makeCandleQuestion(item, L.createRng(seed));
      assert.equal(L.validateQuestion(q), null, id);
      assert.equal(q.difficulty, level, id);
      assert.equal(q.detail, item.detail, id);
      assert.equal(q.explanation, item.explanation, id);
      assert.deepEqual(q.candles, item.candles, id);
    }
  }
});

test('新規ローソク足20種類: ローソク足のラウンドは、どの難易度も10問で、その難易度の10種類がちょうど1回ずつ出る', () => {
  for (const level of L.DIFFICULTY_LEVELS) {
    assert.equal(L.roundSize('candle', level), 10, level);
    assert.equal(L.buildPool('candle', L.createRng(1), level).length, 10, level);
    for (let seed = 1; seed <= 30; seed++) {
      const deck = L.buildDeck('candle', seed, level);
      assert.equal(deck.length, 10, `${level} seed=${seed}`);
      assert.deepEqual(deck.map((q) => q.id.replace('candle:', '')).sort(), L.DIFFICULTY_BY_ID.candles[level].slice().sort(), `${level} seed=${seed}`);
      for (const q of deck) {
        assert.equal(L.validateQuestion(q), null, q.id);
        assert.equal(q.difficulty, level, q.id);
      }
    }
  }
});

// 定義の確認用の道具: 陽線・陰線、上ヒゲ・下ヒゲ、実体の中心
const isBull = (k) => k.c > k.o;
const isBear = (k) => k.c < k.o;
const upperOf = (k) => k.h - Math.max(k.o, k.c);
const lowerOf = (k) => Math.min(k.o, k.c) - k.l;
const midOf = (k) => (k.o + k.c) / 2;
const GAP = 8; // 窓や食い込みは、画面で見える 8 以上の差をつける

test('陽の丸坊主 / 陰の丸坊主: 上下にヒゲがなく、実体が長い(大陽線・大陰線には小さなヒゲがある)', () => {
  const [a] = candleOf('bullish-marubozu');
  assert.ok(a.o === a.l && a.c === a.h && bodyOf(a) >= 30);
  const [b] = candleOf('bearish-marubozu');
  assert.ok(b.o === b.h && b.c === b.l && bodyOf(b) >= 30);
  for (const id of ['big-bullish', 'big-bearish']) {
    const [k] = candleOf(id);
    assert.ok(upperOf(k) > 0 && lowerOf(k) > 0, `${id} にはヒゲがある`);
  }
  assert.equal(candleOf('bullish-marubozu').length, 1);
  assert.equal(candleOf('bearish-marubozu').length, 1);
});

test('四値同時線: 始値=高値=安値=終値の1本(実体もヒゲもない)', () => {
  const ks = candleOf('four-price-doji');
  assert.equal(ks.length, 1);
  const [k] = ks;
  assert.ok(k.o === k.h && k.h === k.l && k.l === k.c);
});

test('陽の寄り付き坊主: 始値=安値(下ヒゲなし)、上ヒゲが見えて、実体のほうが長い陽線', () => {
  const [k] = candleOf('bullish-opening-marubozu');
  assert.ok(isBull(k) && k.o === k.l);
  assert.ok(upperOf(k) >= GAP && k.c < k.h, '上ヒゲが見える');
  assert.ok(bodyOf(k) >= upperOf(k) * 1.5 && bodyOf(k) >= 20, '実体のほうが長い');
});

test('陰の寄り付き坊主: 始値=高値(上ヒゲなし)、下ヒゲが見えて、実体のほうが長い陰線', () => {
  const [k] = candleOf('bearish-opening-marubozu');
  assert.ok(isBear(k) && k.o === k.h);
  assert.ok(lowerOf(k) >= GAP && k.c > k.l, '下ヒゲが見える');
  assert.ok(bodyOf(k) >= lowerOf(k) * 1.5 && bodyOf(k) >= 20, '実体のほうが長い');
});

test('三空踏み上げ: 4本の陽線で、各足の安値が前の足の高値より 8 以上高い窓が3回続く', () => {
  const ks = candleOf('three-gaps-up');
  assert.equal(ks.length, 4);
  for (const k of ks) assert.ok(isBull(k));
  for (let i = 1; i < 4; i++) assert.ok(ks[i].l >= ks[i - 1].h + GAP, `${i} 本目の窓`);
});

test('三空叩き込み: 4本の陰線で、各足の高値が前の足の安値より 8 以上低い窓が3回続く', () => {
  const ks = candleOf('three-gaps-down');
  assert.equal(ks.length, 4);
  for (const k of ks) assert.ok(isBear(k));
  for (let i = 1; i < 4; i++) assert.ok(ks[i].h <= ks[i - 1].l - GAP, `${i} 本目の窓`);
});

test('上放れ並び赤: 陽線のあと上に窓を空けて、始値と実体がほぼ同じ高さの陽線が2本並ぶ(切り上がらない)', () => {
  const [a, b, c] = candleOf('upward-gap-side-by-side-white');
  assert.equal(candleOf('upward-gap-side-by-side-white').length, 3);
  assert.ok(isBull(a) && isBull(b) && isBull(c));
  assert.ok(b.l >= a.h + GAP && c.l > a.h, '1本目との間に窓');
  assert.ok(Math.abs(b.o - c.o) <= 3 && Math.abs(b.c - c.c) <= 3, '2本の始値・終値がほぼ同じ');
  assert.ok(c.o >= b.o - 3 && c.o <= b.c, '3本目の始値は2本目の実体の中');
});

test('下放れ並び黒: 陰線のあと下に窓を空けて、始値と実体がほぼ同じ高さの陰線が2本並ぶ(切り下がらない)', () => {
  const [a, b, c] = candleOf('downward-gap-side-by-side-black');
  assert.equal(candleOf('downward-gap-side-by-side-black').length, 3);
  assert.ok(isBear(a) && isBear(b) && isBear(c));
  assert.ok(b.h <= a.l - GAP && c.h < a.l, '1本目との間に窓');
  assert.ok(Math.abs(b.o - c.o) <= 3 && Math.abs(b.c - c.c) <= 3, '2本の始値・終値がほぼ同じ');
  assert.ok(c.o <= b.o + 3 && c.o >= b.c, '3本目の始値は2本目の実体の中');
});

test('差し込み線: 大陰線のあと、前日の終値より安く始まる陽線が、前日の実体の中心より下で終わる', () => {
  const [a, b] = candleOf('thrusting-line');
  assert.equal(candleOf('thrusting-line').length, 2);
  assert.ok(isBear(a) && bodyOf(a) >= 30);
  assert.ok(isBull(b) && b.o <= a.c - GAP, '前日の終値より安く始まる');
  assert.ok(b.c >= a.c + GAP, '前日の終値よりはっきり上');
  assert.ok(b.c <= midOf(a) - 6, '実体の中心に届かない');
});

test('入り首線: 大陰線のあと、前日の終値より安く始まる陽線が、前日の安値をわずかに上回って終わる(差し込み線より戻りが小さい)', () => {
  const [a, b] = candleOf('irikubi-line');
  const [, t] = candleOf('thrusting-line');
  assert.equal(candleOf('irikubi-line').length, 2);
  assert.ok(isBear(a) && bodyOf(a) >= 30);
  assert.ok(isBull(b) && b.o <= a.c - GAP, '前日の終値より安く始まる');
  assert.ok(b.c > a.c && b.c > a.l && b.c - a.l <= 8, '前日の安値をわずかに上回る');
  assert.ok(b.c <= t.c - 5, '差し込み線の終値より低い');
});

test('行き違い線: 逆色の2本で、始値がほぼ同じ・実体の長さがほぼ同じ・終値は大きく離れる', () => {
  const [a, b] = candleOf('yukichigai-line');
  assert.equal(candleOf('yukichigai-line').length, 2);
  assert.ok(isBear(a) && isBull(b));
  assert.ok(Math.abs(a.o - b.o) <= 2, '始値がそろう');
  assert.ok(Math.abs(bodyOf(a) - bodyOf(b)) <= 3, '実体の長さがほぼ同じ');
  assert.ok(Math.abs(a.c - b.c) >= 20, '終値は離れる(出合い線との違い)');
});

test('陽の出合い線: 陰線のあと前日の終値より安く始まる陽線が、前日の終値ちょうどに戻り、実体の長さがほぼ同じ', () => {
  const [a, b] = candleOf('bullish-deai-line');
  assert.equal(candleOf('bullish-deai-line').length, 2);
  assert.ok(isBear(a) && isBull(b));
  assert.ok(b.o <= a.c - GAP, '前日の終値より安く始まる');
  assert.ok(Math.abs(b.c - a.c) <= 1, '終値がそろう');
  assert.ok(Math.abs(bodyOf(a) - bodyOf(b)) <= 4, '実体の長さがほぼ同じ');
  assert.ok(Math.abs(a.o - b.o) >= 20, '始値は離れる(行き違い線との違い)');
});

test('陰の出合い線: 陽線のあと前日の終値より高く始まる陰線が、前日の終値ちょうどに戻り、実体の長さがほぼ同じ', () => {
  const [a, b] = candleOf('bearish-deai-line');
  assert.equal(candleOf('bearish-deai-line').length, 2);
  assert.ok(isBull(a) && isBear(b));
  assert.ok(b.o >= a.c + GAP, '前日の終値より高く始まる');
  assert.ok(Math.abs(b.c - a.c) <= 1, '終値がそろう');
  assert.ok(Math.abs(bodyOf(a) - bodyOf(b)) <= 4, '実体の長さがほぼ同じ');
  assert.ok(Math.abs(a.o - b.o) >= 20, '始値は離れる(行き違い線との違い)');
});

test('陽のたすき線: 陰線の実体の中で始まる陽線が、前日の高値を 8 以上超えて終わり、値幅は前日とほぼ同じ(前日の終値より安くは始まらない)', () => {
  const [a, b] = candleOf('bullish-tasuki-line');
  assert.equal(candleOf('bullish-tasuki-line').length, 2);
  assert.ok(isBear(a) && isBull(b));
  assert.ok(b.o <= a.o - GAP && b.o >= a.c + GAP, '前日の実体の中(両端から 8 以上内側)');
  assert.ok(b.c >= a.h + GAP, '前日の高値を超える');
  assert.ok(Math.abs(rangeOf(b) - rangeOf(a)) <= 4, '値幅が前日とほぼ同じ');
});

test('陰のたすき線: 陽線の実体の中で始まる陰線が、前日の安値を 8 以上割って終わり、値幅は前日とほぼ同じ(前日の終値より高くは始まらない)', () => {
  const [a, b] = candleOf('bearish-tasuki-line');
  assert.equal(candleOf('bearish-tasuki-line').length, 2);
  assert.ok(isBull(a) && isBear(b));
  assert.ok(b.o >= a.o + GAP && b.o <= a.c - GAP, '前日の実体の中(両端から 8 以上内側)');
  assert.ok(b.c <= a.l - GAP, '前日の安値を割る');
  assert.ok(Math.abs(rangeOf(b) - rangeOf(a)) <= 4, '値幅が前日とほぼ同じ');
});

test('上放れの星: 陽線のあと窓を空けて、上下にヒゲのある小さな実体(コマ)が出る', () => {
  const [a, b] = candleOf('upward-gap-star');
  assert.equal(candleOf('upward-gap-star').length, 2);
  assert.ok(isBull(a) && bodyOf(a) >= 15);
  assert.ok(b.l >= a.h + GAP, '窓');
  assert.ok(bodyOf(b) > 0 && bodyOf(b) <= 6 && bodyOf(b) * 3 <= bodyOf(a), '小さな実体');
  assert.ok(upperOf(b) >= 4 && lowerOf(b) >= 2, '上下にヒゲ');
});

test('下放れの星: 陰線のあと窓を空けて、上下にヒゲのある小さな実体(コマ)が出る', () => {
  const [a, b] = candleOf('downward-gap-star');
  assert.equal(candleOf('downward-gap-star').length, 2);
  assert.ok(isBear(a) && bodyOf(a) >= 15);
  assert.ok(b.h <= a.l - GAP, '窓');
  assert.ok(bodyOf(b) > 0 && bodyOf(b) <= 6 && bodyOf(b) * 3 <= bodyOf(a), '小さな実体');
  assert.ok(upperOf(b) >= 2 && lowerOf(b) >= 4, '上下にヒゲ');
});

test('赤三兵先詰まり: 切り上がる陽線3本で、3本目に実体より長い上ヒゲがある(赤三兵の3本目にはほぼない)', () => {
  const ks = candleOf('three-soldiers-stalled');
  assert.equal(ks.length, 3);
  for (const k of ks) assert.ok(isBull(k));
  for (let i = 1; i < 3; i++) {
    assert.ok(ks[i].o >= ks[i - 1].o && ks[i].o <= ks[i - 1].c, `${i + 1} 本目は前の実体の中で始まる`);
    assert.ok(ks[i].c >= ks[i - 1].c + GAP, `${i + 1} 本目は終値を切り上げる`);
  }
  assert.ok(upperOf(ks[2]) >= 12 && upperOf(ks[2]) > bodyOf(ks[2]), '3本目の長い上ヒゲ');
  const w = candleOf('three-white-soldiers');
  assert.ok(upperOf(w[2]) < 4);
});

test('赤三兵思案星: 陽線2本のあと、3本目が窓を空けて小さな実体で終わる(上ヒゲが目印ではない)', () => {
  const ks = candleOf('three-soldiers-deliberation');
  assert.equal(ks.length, 3);
  assert.ok(isBull(ks[0]) && isBull(ks[1]));
  assert.ok(ks[1].o >= ks[0].o && ks[1].o <= ks[0].c && ks[1].c >= ks[0].c + GAP, '2本目は切り上がる');
  assert.ok(ks[2].l >= ks[1].h + GAP, '3本目は窓を空ける');
  assert.ok(bodyOf(ks[2]) > 0 && bodyOf(ks[2]) <= 6 && bodyOf(ks[2]) * 2 <= bodyOf(ks[1]), '小さな実体');
  assert.ok(upperOf(ks[2]) >= 4 && lowerOf(ks[2]) >= 2, '上下にヒゲ');
});

test('見分けが必要な新規ローソク足は、絵が重ならない(同じ値の足がない)', () => {
  const sig = (c) => JSON.stringify(c.candles);
  assert.equal(new Set(L.CANDLE_PATTERNS.map(sig)).size, 50);
});

test('新規ローソク足20種類: DETAIL_BY_ID は既存の30個だけで、新規20個は自分の detail を持ち、全50個で detail が重ならない', () => {
  assert.deepEqual(Object.keys(L.DETAIL_BY_ID.candles).sort(), L.CANDLE_PATTERNS.slice(0, 30).map((c) => c.id).sort());
  assert.equal(Object.keys(L.DETAIL_BY_ID.candles).length, 30);
  assert.equal(new Set(L.CANDLE_PATTERNS.map((c) => c.detail)).size, 50);
});

// ==== 株価予想モード(仕組みのテスト。本物のデータは後の工程で入れるので、ここでは見本(fixture)を使う) ====
// 見本は、読み込みなおした別の L(LF)の FORECAST_QUESTIONS に入れる。index.html には入れない。
function fixtureDates(from, n) {
  const out = [];
  const t0 = Date.parse(`${from}T00:00:00Z`);
  for (let i = 0; i < n; i++) out.push(new Date(t0 + i * 7 * 86400000).toISOString().slice(0, 10));
  return out;
}

function fixtureExample(over = {}) {
  const n = over.n || 52;
  const rng = L.createRng(over.seed || 7);
  const dates = fixtureDates(over.from || '2023-04-03', n);
  let close = over.start || 1999.5;
  const prices = dates.map((d, i) => {
    if (i > 0) close = Math.max(50, close * (1 + (rng() - 0.45) * 0.05));
    return [d, Math.round(close * 2) / 2];
  });
  const ex = {
    name: over.name || 'テスト自動車',
    code: over.code || '7203',
    from: dates[0],
    to: dates[n - 1],
    indicator: over.indicator || 'PER',
    value: over.value || 9.2,
    valueNote: 'テスト用の見本(実在のデータではない)',
    prices,
    changePct: 0,
    sources: ['https://example.com/fixture'],
  };
  ex.changePct = L.forecastChange(prices);
  return { ...ex, ...(over.fields || {}) };
}

function fixtureItem(over = {}) {
  return {
    id: over.id || 'per-low',
    question: 'PERが低い(割安な)株は、その後どうなりやすい?',
    answer: over.answer || '一概には言えない',
    explanation: '割安に見えても、その後の株価は上がる場合も下がる場合もあるよ。',
    detail: 'PERが低いのは、利益のわりに株価が安いということだよ。ただ、利益が落ちると見られているから安い場合もあるよ。割安な株が必ず上がるとは限らず、その後の動きは会社の業績や市場の流れしだいだよ。',
    examples: over.examples || [
      fixtureExample({ seed: 1, name: 'テスト自動車', code: '7203' }),
      fixtureExample({ seed: 2, name: 'テスト鉄鋼', code: '5401', start: 450, from: '2022-10-03' }),
      fixtureExample({ seed: 3, name: 'テスト電機', code: '6501', start: 3200.5, from: '2021-01-04' }),
    ],
  };
}

// 見本を入れた、別の評価結果。難易度は DIFFICULTY_BY_ID.forecast の表から付ける(本物のデータと同じ経路)
function loadWithFixture(items = [fixtureItem()], level = 'normal') {
  const LF = loadLogic();
  // 本物の20問は外して、見本だけにする(仕組みのテストを、本物の件数から切り離す)
  LF.FORECAST_QUESTIONS.length = 0;
  for (const lv of LF.DIFFICULTY_LEVELS) LF.DIFFICULTY_BY_ID.forecast[lv].length = 0;
  for (const it of items) {
    LF.FORECAST_QUESTIONS.push(it);
    LF.DIFFICULTY_BY_ID.forecast[level].push(it.id);
  }
  LF.assignDifficulty(LF.FORECAST_QUESTIONS, LF.DIFFICULTY_BY_ID.forecast);
  return LF;
}

test('株価予想: 選択肢は固定の3つで、データがなければプールは空。ほかのモードの出題は変わらない', () => {
  assert.deepEqual(L.FORECAST_CHOICES, ['上がりやすい', '下がりやすい', '一概には言えない']);
  assert.equal(L.MODE_LABELS.forecast, '株価予想');
  // 見本もデータもない状態(本物の20問を外した評価結果)では、プールも出題も空
  const LE = loadWithFixture([]);
  assert.deepEqual(LE.FORECAST_QUESTIONS, []);
  for (const level of LE.DIFFICULTY_FILTERS) {
    assert.equal(LE.buildPool('forecast', LE.createRng(1), level).length, 0, level);
    assert.equal(LE.roundSize('forecast', level), 0, level);
    assert.deepEqual(LE.buildDeck('forecast', 3, level), [], level);
  }
  for (let seed = 1; seed <= 20; seed++) {
    assert.ok(LE.buildDeck('all', seed).every((q) => q.type !== 'forecast'));
  }
});

test('株価予想: makeForecastQuestion は選択肢が固定順の3つで、難易度と例を持ち、validateQuestion を通る', () => {
  const LF = loadWithFixture();
  const q = LF.makeForecastQuestion(LF.FORECAST_QUESTIONS[0], LF.createRng(1));
  assert.equal(q.id, 'forecast:per-low');
  assert.equal(q.type, 'forecast');
  assert.deepEqual(q.choices, LF.FORECAST_CHOICES);
  assert.notEqual(q.choices, LF.FORECAST_CHOICES); // 共有しない(コピー)
  assert.equal(q.answer, '一概には言えない');
  assert.equal(q.difficulty, 'normal');
  assert.equal(q.examples.length, 3);
  assert.equal(LF.validateQuestion(q), null);
  assert.equal(LF.chartForQuestion(q), null);
  // rng を使わない: 引数を省いても、別の rng でも同じ
  assert.deepEqual(LF.makeForecastQuestion(LF.FORECAST_QUESTIONS[0]), q);
  assert.deepEqual(LF.makeForecastQuestion(LF.FORECAST_QUESTIONS[0], LF.createRng(99)), q);
  for (const c of LF.FORECAST_CHOICES) assert.equal(LF.judge(q, c), c === q.answer);
});

test('株価予想: プール・出題・難易度の絞り込み・全部まぜ・成績キー', () => {
  const LF = loadWithFixture([fixtureItem()], 'normal');
  assert.equal(LF.buildPool('forecast', LF.createRng(1)).length, 1);
  assert.equal(LF.buildPool('forecast', LF.createRng(1), 'normal').length, 1);
  assert.equal(LF.buildPool('forecast', LF.createRng(1), 'easy').length, 0);
  assert.equal(LF.roundSize('forecast', 'normal'), 1);
  assert.equal(LF.roundSize('forecast', 'easy'), 0);
  const deck = LF.buildDeck('forecast', 5, 'normal');
  assert.deepEqual(deck.map((q) => q.id), ['forecast:per-low']);
  assert.equal(LF.validateQuestion(deck[0]), null);
  // 全部まぜの候補にも入る(チャートの形50 + ローソク足50 + 用語120 + 株価予想1)
  assert.equal(LF.buildPool('all', LF.createRng(1)).length, 221);
  assert.equal(LF.buildPool('all', LF.createRng(1), 'normal').length, 48);
  assert.ok(LF.buildPool('all', LF.createRng(1)).some((q) => q.type === 'forecast'));
  // 株価予想を足しても、ほかのモードの出題(順番と乱数の消費)は変わらない
  for (const mode of ['pattern', 'candle', 'term']) {
    assert.deepEqual(LF.buildDeck(mode, 11), L.buildDeck(mode, 11), mode);
  }
  assert.equal(LF.statsKey('forecast', 'hard'), 'forecast:hard');
  assert.equal(LF.formatShareText('forecast', 1, 1, 'normal'), '株クイズ(株価予想・★★)で 1問中1問正解!');
  assert.deepEqual(LF.updateStats(LF.defaultStats(), 'forecast:normal', 1, 1).played['forecast:normal'], { correct: 1, total: 1 });
});

test('株価予想: 全部まぜのデッキでも、株価予想の問題は有効で、複数回のどこかに出る', () => {
  const LF = loadWithFixture([fixtureItem()], 'normal');
  let seen = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const deck = LF.buildDeck('all', seed);
    assert.equal(deck.length, 10);
    for (const q of deck) assert.equal(LF.validateQuestion(q), null);
    seen += deck.filter((q) => q.type === 'forecast').length;
  }
  assert.ok(seen > 0);
});

test('株価予想: 選択肢はやり直しでも並べ替えない(reshuffleChoices・buildRetryDeck)', () => {
  const LF = loadWithFixture([fixtureItem(), fixtureItem({ id: 'pbr-low', answer: '上がりやすい' })], 'hard');
  const deck = LF.buildDeck('forecast', 3, 'hard');
  assert.equal(deck.length, 2);
  for (let seed = 1; seed <= 30; seed++) {
    for (const q of deck) assert.deepEqual(LF.reshuffleChoices(q, LF.createRng(seed)).choices, LF.FORECAST_CHOICES);
  }
  const results = deck.map((q) => ({ id: q.id, correct: false }));
  for (let seed = 1; seed <= 30; seed++) {
    const retry = LF.buildRetryDeck(deck, results, seed);
    assert.deepEqual(retry.map((q) => q.id), deck.map((q) => q.id));
    for (const q of retry) {
      assert.deepEqual(q.choices, LF.FORECAST_CHOICES);
      assert.equal(LF.validateQuestion(q), null);
    }
  }
  // 元の問題は変わらない。間違えていない問題は含まれない
  assert.deepEqual(deck[0].choices, LF.FORECAST_CHOICES);
  assert.deepEqual(LF.buildRetryDeck(deck, [{ id: deck[0].id, correct: true }, { id: deck[1].id, correct: false }], 1).map((q) => q.id), [deck[1].id]);
});

test('株価予想: 成績のキー(5モード × 6)と、古い保存データの読み込み', () => {
  assert.deepEqual(L.MODES, ['all', 'pattern', 'candle', 'term', 'forecast']);
  assert.equal(L.STATS_KEYS.length, 30);
  assert.ok(L.STATS_KEYS.includes('forecast') && L.STATS_KEYS.includes('forecast:master'));
  const s0 = L.defaultStats();
  assert.deepEqual(s0.played.forecast, { correct: 0, total: 0 });
  assert.equal(s0.best['forecast:easy'], 0);
  // 株価予想より前のバージョンの保存データ(株価予想のキーなし)は、そのまま読めて、株価予想は0で始まる
  const old = JSON.stringify({ best: { all: 8, term: 6 }, played: { all: { correct: 20, total: 30 } } });
  const parsed = L.parseStats(old);
  assert.equal(parsed.best.all, 8);
  assert.equal(parsed.best.forecast, 0);
  assert.deepEqual(parsed.played['forecast:hard'], { correct: 0, total: 0 });
  const s1 = L.updateStats(s0, 'forecast', 1, 1);
  assert.deepEqual(L.parseStats(JSON.stringify(s1)), s1);
});

test('forecastChange: 最初から最後までの騰落率を小数1位で返す', () => {
  assert.equal(L.forecastChange([['2023-01-01', 100], ['2023-02-01', 112.34]]), 12.3);
  assert.equal(L.forecastChange([['2023-01-01', 200], ['2023-01-08', 150], ['2023-02-01', 190]]), -5);
  assert.equal(L.forecastChange([['2023-01-01', 100], ['2023-02-01', 100]]), 0);
  assert.ok(Object.is(L.forecastChange([['2023-01-01', 100], ['2023-02-01', 100.01]]), 0)); // -0 や +0.0 にならない
  assert.equal(L.forecastChange([['2023-01-01', 1999.5], ['2023-10-02', 2245]]), 12.3);
});

test('formatDateJa / formatChangePct / changeDirection / formatIndicator', () => {
  assert.equal(L.formatDateJa('2023-04-03'), '2023/4/3');
  assert.equal(L.formatDateJa('2023-12-25'), '2023/12/25');
  assert.equal(L.formatChangePct(12.3), '+12.3%');
  assert.equal(L.formatChangePct(-4.5), '-4.5%');
  assert.equal(L.formatChangePct(0), '0.0%');
  assert.equal(L.formatChangePct(10), '+10.0%');
  assert.deepEqual(L.changeDirection(12.3), { kind: 'up', label: '上昇 ↑' });
  assert.deepEqual(L.changeDirection(-0.1), { kind: 'down', label: '下落 ↓' });
  assert.deepEqual(L.changeDirection(0), { kind: 'flat', label: '横ばい →' });
  const base = { valueNote: '2023年3月期の実績EPS(213円)で計算' };
  assert.equal(L.formatIndicator({ ...base, indicator: 'PER', value: 9.2 }), 'PER 9.2倍(2023年3月期の実績EPS(213円)で計算)');
  assert.equal(L.formatIndicator({ indicator: 'PBR', value: 0.85 }), 'PBR 0.85倍');
  assert.equal(L.formatIndicator({ indicator: '配当利回り', value: 4, valueNote: '年間配当120円' }), '配当利回り 4%(年間配当120円)');
  assert.equal(L.formatIndicator({ indicator: 'ROE', value: 18.04 }), 'ROE 18.04%');
  assert.equal(L.formatIndicator({ indicator: 'ROE', value: 18, unit: '％' }), 'ROE 18％'); // unit があれば、それを使う
  assert.equal(L.formatIndicator({ indicator: '自己資本比率', value: 60.5 }), '自己資本比率 60.5%');
  assert.equal(L.formatIndicator({ indicator: '未知の指標', value: 3 }), '未知の指標 3');
});

test('forecastAxis: 終値の最小〜最大に余白をつけ、3〜6本のきりのよい目盛りが範囲の中に入る', () => {
  const LF = loadWithFixture();
  for (const ex of LF.FORECAST_QUESTIONS[0].examples) {
    const closes = ex.prices.map((p) => p[1]);
    const { min, max, ticks } = LF.forecastAxis(ex.prices);
    assert.ok(min < Math.min(...closes) && max > Math.max(...closes), ex.name);
    assert.ok(ticks.length >= 3 && ticks.length <= 6, `${ex.name}: ${ticks}`);
    for (const t of ticks) assert.ok(t >= min && t <= max, `${ex.name}: ${t}`);
    assert.deepEqual(ticks, ticks.slice().sort((a, b) => a - b));
  }
  // 全部同じ終値でも、範囲が0にならない
  const flat = Array.from({ length: 40 }, (_, i) => [fixtureDates('2023-01-02', 40)[i], 500]);
  const ax = L.forecastAxis(flat);
  assert.ok(ax.max > ax.min && ax.ticks.length >= 1);
});

test('validateQuestion(株価予想): 見本は有効で、不備を1つずつ見つける', () => {
  const LF = loadWithFixture();
  const make = (mutate) => {
    const item = JSON.parse(JSON.stringify(fixtureItem()));
    mutate(item);
    return LF.makeForecastQuestion({ ...item, difficulty: 'normal' });
  };
  assert.equal(LF.validateQuestion(make(() => {})), null);
  // 例が2個・3個はよい
  assert.equal(LF.validateQuestion(make((it) => { it.examples.length = 2; })), null);
  const bad = (label, mutate, word) => {
    const err = LF.validateQuestion(make(mutate));
    assert.ok(err, `${label}: 不備を見つけられなかった`);
    if (word) assert.ok(err.includes(word), `${label}: ${err}`);
  };
  bad('例が1個', (it) => { it.examples.length = 1; }, '2〜3');
  bad('例が4個', (it) => { it.examples.push(fixtureExample({ seed: 9 })); }, '2〜3');
  bad('例がない', (it) => { delete it.examples; }, '2〜3');
  bad('日付が降順', (it) => { it.examples[0].prices.reverse(); }, '昇順');
  bad('日付が同じ', (it) => { it.examples[1].prices[5][0] = it.examples[1].prices[4][0]; }, '昇順');
  bad('changePct が合わない', (it) => { it.examples[0].changePct += 1; }, 'changePct');
  bad('changePct が数でない', (it) => { it.examples[0].changePct = '12.3'; }, 'changePct');
  bad('最初の日付が from と違う', (it) => { it.examples[0].from = '2023-03-27'; }, 'from');
  bad('最後の日付が to と違う', (it) => { it.examples[2].to = '2024-12-30'; }, 'to');
  bad('from が to 以降', (it) => { it.examples[0].from = it.examples[0].to; }, 'from');
  bad('日付の形が違う', (it) => { it.examples[0].from = '2023/04/03'; }, '日付');
  bad('存在しない日付', (it) => { it.examples[0].prices[3][0] = '2023-02-30'; }, 'prices');
  bad('prices が39点', (it) => { it.examples[0].prices.length = 39; }, '40');
  bad('prices が81点', (it) => {
    const ex = it.examples[0];
    ex.prices = fixtureExample({ n: 81 }).prices;
    ex.from = ex.prices[0][0]; ex.to = ex.prices[80][0]; ex.changePct = LF.forecastChange(ex.prices);
  }, '80');
  bad('終値が0', (it) => { it.examples[0].prices[10][1] = 0; }, 'prices');
  bad('終値が負', (it) => { it.examples[0].prices[10][1] = -5; }, 'prices');
  bad('終値が数でない', (it) => { it.examples[0].prices[10][1] = '100'; }, 'prices');
  bad('value が0', (it) => { it.examples[0].value = 0; }, 'value');
  bad('value が数でない', (it) => { it.examples[0].value = Infinity; }, 'value');
  bad('name がない', (it) => { it.examples[0].name = ''; }, 'name');
  bad('code が不正', (it) => { it.examples[0].code = ''; }, 'code');
  bad('indicator がない', (it) => { delete it.examples[0].indicator; }, 'indicator');
  bad('sources が空', (it) => { it.examples[0].sources = []; }, 'sources');
  bad('sources がない', (it) => { delete it.examples[0].sources; }, 'sources');
  bad('http でない出典', (it) => { it.examples[0].sources = ['ftp://example.com/a']; }, 'sources');
  bad('URL でない出典', (it) => { it.examples[0].sources = ['Yahoo!ファイナンス']; }, 'sources');
  bad('detail がない', (it) => { it.detail = ''; }, '必須');
  bad('explanation がない', (it) => { it.explanation = ''; }, '必須');
  bad('正解が選択肢にない', (it) => { it.answer = '横ばい'; }, '正解');
  // 選択肢の不備(問題オブジェクトを直接いじる)
  const ok = make(() => {});
  assert.ok(LF.validateQuestion({ ...ok, choices: ['上がりやすい', '下がりやすい'] }));
  assert.ok(LF.validateQuestion({ ...ok, choices: [...ok.choices, '横ばい'] }));
  assert.ok(LF.validateQuestion({ ...ok, choices: ['下がりやすい', '上がりやすい', '一概には言えない'] }), '並びが違う');
  assert.ok(LF.validateQuestion({ ...ok, choices: ['上がりやすい', '下がりやすい', '横ばい'] }));
  assert.ok(LF.validateQuestion({ ...ok, difficulty: 'x' }));
  assert.ok(LF.validateQuestion({ ...ok, id: 'per-low' }), 'id の名前空間');
  // 4択の問題を forecast と名乗らせても通らない
  assert.ok(LF.validateQuestion({ ...LF.makeTermQuestion(LF.TERMS[0], LF.createRng(1)), type: 'forecast' }));
});

test('株価予想: 見本の例は、期間・終値の数・日付の並びが仕様どおり(見本づくりの確認)', () => {
  const item = fixtureItem();
  for (const ex of item.examples) {
    assert.ok(ex.prices.length >= 40 && ex.prices.length <= 80);
    assert.equal(ex.prices[0][0], ex.from);
    assert.equal(ex.prices[ex.prices.length - 1][0], ex.to);
    assert.equal(ex.changePct, L.forecastChange(ex.prices));
  }
});

// ==== 株価予想の本物のデータ(20問・実在の銘柄の例)。内容を変えたら、件数や分布をここと設計書で一緒に直す ====
const FQ = L.FORECAST_QUESTIONS;
const FORECAST_EXAMPLES = FQ.flatMap((q) => q.examples.map((e) => ({ q, e })));
const dayDiff = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;

test('株価予想のデータ: 20問で、id が重複せず、難易度ごとに4問ずつ(DIFFICULTY_BY_ID.forecast と一致)', () => {
  assert.equal(FQ.length, 20);
  assert.equal(new Set(FQ.map((q) => q.id)).size, 20);
  for (const level of L.DIFFICULTY_LEVELS) {
    const ids = L.DIFFICULTY_BY_ID.forecast[level];
    assert.equal(ids.length, 4, level);
    assert.deepEqual(FQ.filter((q) => q.difficulty === level).map((q) => q.id), ids, level);
  }
  assert.equal(FQ.filter((q) => !L.DIFFICULTY_LEVELS.includes(q.difficulty)).length, 0);
  for (const q of FQ) assert.equal(L.validateQuestion(L.makeForecastQuestion(q, L.createRng(1))), null, q.id);
});

test('株価予想のデータ: 答えは3つの選択肢のどれかで、「上がりやすい」「一概には言えない」が出てくる(分布は内容に依存する数)', () => {
  for (const q of FQ) assert.ok(L.FORECAST_CHOICES.includes(q.answer), q.id);
  const n = (a) => FQ.filter((q) => q.answer === a).length;
  assert.ok(n('上がりやすい') >= 1 && n('一概には言えない') >= 1);
  // 内容に依存する数。問題を足したり答えを直したら、設計書の表と一緒に直す。
  // 「下がりやすい」が答えの問題は0問(減配の例が上下に分かれ、例と矛盾しない「下がりやすい」の問いを作れなかった。偏りとして設計書に書いてある)
  assert.equal(n('上がりやすい'), 4);
  assert.equal(n('下がりやすい'), 0);
  assert.equal(n('一概には言えない'), 16);
});

test('株価予想のデータ: 各問に例が2〜3個あり、騰落率は株価から計算した値と合う', () => {
  for (const q of FQ) {
    assert.ok(q.examples.length >= 2 && q.examples.length <= 3, q.id);
    for (const e of q.examples) {
      assert.ok(Math.abs(e.changePct - L.forecastChange(e.prices)) <= 0.05, `${q.id}/${e.code} changePct`);
    }
  }
});

test('株価予想のデータ: 開始日は2019〜2025年(終了日は2026年6月まで。2025年6月開始の例が1年後に終わる)で、約1年(300〜400日)。株価の最初と最後の日付が from / to と同じ', () => {
  for (const { q, e } of FORECAST_EXAMPLES) {
    const label = `${q.id}/${e.code}`;
    assert.ok(e.from >= '2019-01-01' && e.from <= '2025-12-31', `${label} from`);
    assert.ok(e.to >= '2019-01-01' && e.to <= '2026-06-30', `${label} to`);
    const days = dayDiff(e.from, e.to);
    assert.ok(days >= 300 && days <= 400, `${label} 期間 ${days}日`);
    assert.equal(e.prices[0][0], e.from, `${label} 最初の日付`);
    assert.equal(e.prices[e.prices.length - 1][0], e.to, `${label} 最後の日付`);
    assert.ok(e.prices.every((p) => p[1] > 0), `${label} 終値は正`);
  }
});

test('株価予想のデータ: 指標の値・単位・説明、銘柄名とコードの対応、出典URL、(コード,開始日,指標)の重複なし', () => {
  const INDICATORS = ['PER', 'PBR', '配当利回り', '配当性向', 'ROE', '時価総額'];
  const seen = new Set();
  const nameByCode = {};
  for (const { q, e } of FORECAST_EXAMPLES) {
    const label = `${q.id}/${e.code}`;
    assert.ok(INDICATORS.includes(e.indicator), `${label} 指標 ${e.indicator}`);
    assert.ok(e.value > 0, `${label} value`);
    assert.ok(typeof e.valueNote === 'string' && e.valueNote.length > 0, `${label} valueNote`);
    assert.ok(L.indicatorUnit(e) !== '', `${label} 単位がある`);
    if (e.indicator === '時価総額') assert.equal(e.unit, '億円', label);
    assert.ok(e.sources.length >= 1 && e.sources.every((s) => /^https?:\/\//.test(s)), `${label} sources`);
    // 開いていない株価ページのURLは出典に入れない
    assert.ok(e.sources.every((s) => !/finance\.yahoo\.co\.jp\/quote\//.test(s)), `${label} 株価ページのURL`);
    const key = `${e.code}|${e.from}|${e.indicator}`;
    assert.ok(!seen.has(key), `重複 ${key}`);
    seen.add(key);
    nameByCode[e.code] = nameByCode[e.code] || new Set();
    nameByCode[e.code].add(e.name);
  }
  for (const [code, names] of Object.entries(nameByCode)) assert.equal(names.size, 1, `${code} の銘柄名が揺れている: ${[...names]}`);
});

test('株価予想のデータ: 同じ難易度の中で、(コード, 開始日)の組が重ならない(同じチャートが同じ難易度に2回出ない)', () => {
  for (const level of L.DIFFICULTY_LEVELS) {
    const seen = new Set();
    for (const q of FQ.filter((x) => x.difficulty === level)) {
      for (const e of q.examples) {
        const key = `${e.code}|${e.from}`;
        assert.ok(!seen.has(key), `${level}: ${key} が重なる(${q.id})`);
        seen.add(key);
      }
    }
  }
});

test('株価予想のデータ: 文章の質(解説1〜2文・くわしく120〜250字2〜4文、断定語なし、ぼかした言い方がある)', () => {
  const sentences = (s) => s.split('。').filter((x) => x.trim() !== '').length;
  for (const q of FQ) {
    const text = [q.question, q.explanation, q.detail, ...q.examples.map((e) => e.valueNote)].join('\n');
    assert.ok(!/必ず|絶対|買うべき|売るべき/.test(text), `${q.id} 断定語`);
    const len = [...q.detail].length;
    assert.ok(len >= 120 && len <= 250, `${q.id} detail ${len}字`);
    assert.ok(sentences(q.detail) >= 2 && sentences(q.detail) <= 4, `${q.id} detail ${sentences(q.detail)}文`);
    assert.ok(sentences(q.explanation) >= 1 && sentences(q.explanation) <= 2, `${q.id} explanation ${sentences(q.explanation)}文`);
    assert.notEqual(q.detail, q.explanation, q.id);
    assert.ok(/とされる|ことが多い|一概には言えない|見方/.test(q.explanation + q.detail), `${q.id} ぼかした言い方`);
  }
});

test('株価予想のデータ: 全部まぜの候補に20問ぶん加わり、画面の注記に取得元・調整・週ごとの終値と、選び方の偏りを書く', () => {
  assert.equal(L.buildPool('all', L.createRng(1)).filter((q) => q.type === 'forecast').length, 20);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes('株価データ: Yahoo Finance(株式分割を調整した、週ごとの終値)'));
  assert.ok(!html.includes('Yahoo!ファイナンス'));
  assert.ok(!html.includes('調整後終値'));
  for (const w of ['配当を含まない', 'あらかじめ決めた順', '九州・沖縄', '上場廃止', '上がりやすい時期に偏る', '「一概には言えない」が答えの問いが多いよ']) assert.ok(html.includes(w), w);
});

test('株価予想を隠している間(FORECAST_PUBLIC=false): 全部まぜに入らず、画面のモード一覧にも出さない', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  // 公開する前に、株価の取得元の利用条件を確認する。確認が済んだら true にして、このテストを直す
  assert.match(html, /const FORECAST_PUBLIC = false;/);
  assert.ok(html.includes("MODES.filter((m) => m !== 'forecast' || FORECAST_PUBLIC)"));
  const H = loadLogic({ forecastPublic: false });
  for (let seed = 1; seed <= 30; seed++) {
    for (const d of H.DIFFICULTY_FILTERS) {
      assert.ok(H.buildDeck('all', seed, d).every((q) => q.type !== 'forecast'), `all:${d}:${seed}`);
    }
  }
  assert.equal(H.roundSize('all', 'all'), 10);
  // 株価予想モードそのものの仕組みは、隠していても動く(公開時に切り替えるだけにするため)
  assert.equal(H.buildPool('forecast', H.createRng(1), 'all').length, 20);
});

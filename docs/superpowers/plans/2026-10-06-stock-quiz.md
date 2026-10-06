# 株クイズゲーム Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** チャートの形・値動き予想・ローソク足・株用語の4種類を出題する、単一 HTML の株クイズゲームを作る。

**Architecture:** `stock-quiz/index.html` の1ファイルに、データ(`DATA`)・ロジック(`LOGIC`)・画面(`UI`)の3ブロックを置く。データとロジックは DOM に依存しない純粋なコードにして、Node のテストが `index.html` から取り出して検証する。画面は Canvas でチャートを描き、スコアは `localStorage` に保存する。

**Tech Stack:** HTML / CSS / JavaScript(ビルドなし、外部パッケージなし)、Canvas 2D、テストは Node 標準の `node:test`。

**Spec:** [docs/superpowers/specs/2026-10-06-stock-quiz-design.md](../specs/2026-10-06-stock-quiz-design.md)

## Global Constraints

- 作り方は単一 HTML(`stock-quiz/index.html` の1ファイル)。外部パッケージ・外部 CDN は使わない
- チャートはプログラムで生成する(実在の銘柄・実データは使わない)
- 1ラウンドは10問。問題の重複なし
- 問題は4種類: `pattern` / `outlook` / `candle` / `term`
- 選択肢は `pattern` / `candle` / `term` が4つ、`outlook` が3つ(上がりやすい / 下がりやすい / 横ばい、固定順)
- ランキングなし。サーバーなし。スコアは `localStorage` に保存するだけ
- 免責「学習用のゲームです。実際の相場では必ずこの通りに動くとは限りません。投資の助言ではありません。」を全画面の下部に常時表示する
- スマホ幅(375px)で横スクロールしない。ダークモードに対応する(`prefers-color-scheme`)
- 色だけで正誤を伝えない(「正解」「不正解」の文字も併記する)
- 解説画面の一番上に、正解の名前を大きく表示する
- テストは Node 標準の `node:test` だけを使う
- GitHub Pages への公開は、ユーザーが明示的に許可するまで行わない

## Review Focus

仕様は書いていないが、遊ぶ人が踏みやすい入力・状況を、起きやすい順に並べる。

- `localStorage` に壊れた JSON や想定外の形が入っている → 初期値で続行する(Task 5 の `parseStats` のテストで確認)
- `localStorage` が使えない(プライベートモードなど) → 保存をあきらめて、ゲームはそのまま動く(Task 6 の手動確認)
- 値が全部同じ(平らな)系列や、ローソク足が1本だけでも、スケールが0割りにならない → Task 2 の `normalizeRange` のテスト
- 乱数のシードが `0`・負数・巨大な値でも、再現できる結果になる → Task 2 の `createRng` のテスト
- クリップボードが使えない環境で「結果をコピー」が失敗する → 失敗を表示して、文章を手でコピーできるようにする(Task 6 の手動確認)

## File Structure

| ファイル | 役割 |
|----------|------|
| `stock-quiz/index.html` | ゲーム本体。`DATA` / `LOGIC` / `UI` の3ブロック |
| `stock-quiz/tests/load-logic.js` | `index.html` から `DATA` と `LOGIC` を取り出して、テストから使える形にする |
| `stock-quiz/tests/logic.test.js` | ロジックの単体テスト |

`index.html` の中の目印(コメント)は次の6つ。`UI` ブロックはテストの対象外。

```
// ==DATA-START==   ... // ==DATA-END==
// ==LOGIC-START==  ... // ==LOGIC-END==
// ==UI-START==     ... // ==UI-END==
```

## Task 1: 土台(ブランチ・仕様の修正・空の `index.html`・テスト基盤)

**Files:**
- Modify: `docs/superpowers/specs/2026-10-06-stock-quiz-design.md`
- Create: `stock-quiz/index.html`
- Create: `stock-quiz/tests/load-logic.js`
- Create: `stock-quiz/tests/logic.test.js`

**Interfaces:**
- Produces: `loadLogic()`(`tests/load-logic.js`)。`index.html` の `DATA` と `LOGIC` のコードを評価して、その中の名前(関数・定数)を `L.名前` で参照できるオブジェクトを返す。名前が存在しなければ `ReferenceError` を投げる。

- [ ] **Step 1: 作業ブランチを作る**

```bash
git checkout docs/stock-quiz-design
git checkout -b feature/stock-quiz
node --version
```

Expected: `v18` 以上(`node:test` を使うため)。

- [ ] **Step 2: 仕様書を実装の判断に合わせて直す**

`docs/superpowers/specs/2026-10-06-stock-quiz-design.md` の次の3か所を直す(行の頭の「- 」を含めて、行ごと置き換える)。

1. 「- `choices`: 選択肢(4つ。…」で始まる行(6章の項目)を、次の1行に置き換える。

```
- `choices`: 選択肢(`outlook` は3つ、それ以外は4つ。正解を1つ含み、重複しない)
```

2. 「選択肢の並び順は出題のたびにシャッフルする。」の行(6章)を、次の1行に置き換える。

```
選択肢の並び順は、`pattern` / `candle` / `term` は出題のたびにシャッフルする。`outlook` は「上がりやすい / 下がりやすい / 横ばい」の固定順にする。
```

3. 「- ロジックのブロックは、…」で始まる行(7章)を、次の1行に置き換える。

```
- データとロジックのブロックは、`// ==DATA-START==` / `// ==DATA-END==` と `// ==LOGIC-START==` / `// ==LOGIC-END==` のコメントで囲む(テストが取り出すための目印)。画面のブロックは `// ==UI-START==` / `// ==UI-END==` で囲む
```

- [ ] **Step 3: 失敗するテストを書く**

`stock-quiz/tests/logic.test.js` を作る。

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLogic } = require('./load-logic');

test('index.html のデータとロジックを読み込める', () => {
  assert.doesNotThrow(() => loadLogic());
});
```

- [ ] **Step 4: テストが失敗することを確認する**

Run: `node --test stock-quiz/tests/`
Expected: FAIL(`load-logic` が見つからない)。

- [ ] **Step 5: 取り出し用のファイルと、空の `index.html` を作る**

`stock-quiz/tests/load-logic.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

const HTML_PATH = path.join(__dirname, '..', 'index.html');

function extractBlock(html, name) {
  const re = new RegExp(`// ==${name}-START==([\\s\\S]*?)// ==${name}-END==`);
  const m = html.match(re);
  if (!m) throw new Error(`${name} ブロックが index.html に見つからない`);
  return m[1];
}

// DATA と LOGIC のコードを1つの関数の中で評価し、名前から値を引ける Proxy を返す
function loadLogic() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const code = extractBlock(html, 'DATA') + '\n' + extractBlock(html, 'LOGIC');
  const lookup = new Function(code + '\nreturn (name) => eval(name);')();
  return new Proxy({}, { get: (_, name) => lookup(String(name)) });
}

module.exports = { loadLogic };
```

`stock-quiz/index.html`:

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>株クイズ</title>
<style>
</style>
</head>
<body>
<main id="app"></main>
<footer class="disclaimer">学習用のゲームです。実際の相場では必ずこの通りに動くとは限りません。投資の助言ではありません。</footer>
<script>
// ==DATA-START==
// ==DATA-END==

// ==LOGIC-START==
// ==LOGIC-END==

// ==UI-START==
// ==UI-END==
</script>
</body>
</html>
```

- [ ] **Step 6: テストが通ることを確認する**

Run: `node --test stock-quiz/tests/`
Expected: PASS(1 test)。

- [ ] **Step 7: コミット**

```bash
git add docs/superpowers/specs/2026-10-06-stock-quiz-design.md stock-quiz
git commit -m "株クイズ: 土台(空の index.html とテスト基盤)を追加"
```

## Task 2: 乱数・シャッフル・範囲の補助関数

**Files:**
- Modify: `stock-quiz/index.html`(`LOGIC` ブロックの `// ==LOGIC-END==` の直前に追加)
- Test: `stock-quiz/tests/logic.test.js`(末尾に追加)

**Interfaces:**
- Produces:
  - `createRng(seed: number): () => number` — 0 以上 1 未満を返す擬似乱数。同じシードなら同じ列
  - `shuffle<T>(arr: T[], rng): T[]` — 新しい配列を返す(元は変更しない)
  - `normalizeRange(values: number[]): { min: number, max: number }` — 必ず `min < max`。上下に5%の余白

- [ ] **Step 1: 失敗するテストを書く**

`stock-quiz/tests/logic.test.js` の末尾に追加する。

```js
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test stock-quiz/tests/`
Expected: FAIL(`createRng` が未定義)。

- [ ] **Step 3: 実装する**

`index.html` の `// ==LOGIC-END==` の直前に追加する。

```js
// 擬似乱数(mulberry32)。同じシードなら同じ列になる
function createRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// チャートの縦軸の範囲。全部同じ値でも幅が0にならないようにする
function normalizeRange(values) {
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1e-9) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.05;
  return { min: min - pad, max: max + pad };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `node --test stock-quiz/tests/`
Expected: PASS(8 tests)。

- [ ] **Step 5: コミット**

```bash
git add stock-quiz
git commit -m "株クイズ: 乱数・シャッフル・縦軸範囲の補助関数を追加"
```

## Task 3: パターン定義とチャート生成

**Files:**
- Modify: `stock-quiz/index.html`(`DATA` ブロックにパターン定義、`LOGIC` ブロックに生成関数)
- Test: `stock-quiz/tests/logic.test.js`(末尾に追加)

**Interfaces:**
- Consumes: `createRng`(Task 2)
- Produces:
  - `PATTERNS: { id, name, outlook: 'up'|'down'|'flat', points: [number, number][], explanation: string, ma?: true }[]` — 11個
  - `SERIES_LENGTH = 60`, `CONTINUATION_LENGTH = 15`, `MA_SHORT = 5`, `MA_LONG = 15`
  - `findPattern(id: string)` — 見つからなければ `Error`
  - `generateSeries(pattern, seed: number): number[]` — 長さ 60
  - `generateContinuation(lastValue: number, outlook: string, seed: number): number[]` — 長さ 15
  - `movingAverage(values: number[], window: number): (number|null)[]`

- [ ] **Step 1: 失敗するテストを書く**

```js
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test stock-quiz/tests/`
Expected: FAIL(`PATTERNS` が未定義)。

- [ ] **Step 3: パターン定義を `DATA` ブロックに追加する**

`// ==DATA-END==` の直前に追加する。`points` は `[時間(0〜1), 値(0〜100)]` の並びで、パターンが完成して判断する場面で終わる。

```js
const PATTERNS = [
  {
    id: 'double-top', name: 'ダブルトップ', outlook: 'down',
    points: [[0, 20], [0.2, 50], [0.35, 85], [0.5, 60], [0.65, 85], [0.85, 58], [1, 55]],
    explanation: '高値を2回つけても超えられず、間のネックラインを割ると下落に転じやすい形だよ。',
  },
  {
    id: 'double-bottom', name: 'ダブルボトム', outlook: 'up',
    points: [[0, 80], [0.2, 50], [0.35, 15], [0.5, 40], [0.65, 15], [0.85, 42], [1, 45]],
    explanation: '安値を2回つけて下げ止まり、ネックラインを超えると上昇に転じやすい形だよ。',
  },
  {
    id: 'head-shoulders', name: '三尊(ヘッドアンドショルダー)', outlook: 'down',
    points: [[0, 15], [0.15, 60], [0.25, 40], [0.45, 85], [0.6, 42], [0.78, 62], [1, 45]],
    explanation: '3つの山の真ん中が一番高い形。ネックラインを割ると下落に転じやすいよ。',
  },
  {
    id: 'inverse-head-shoulders', name: '逆三尊', outlook: 'up',
    points: [[0, 85], [0.15, 40], [0.25, 60], [0.45, 15], [0.6, 58], [0.78, 38], [1, 55]],
    explanation: '3つの谷の真ん中が一番深い形。ネックラインを超えると上昇に転じやすいよ。',
  },
  {
    id: 'symmetrical-triangle', name: '三角持ち合い', outlook: 'flat',
    points: [[0, 50], [0.12, 85], [0.28, 20], [0.44, 72], [0.58, 33], [0.72, 62], [0.84, 42], [0.94, 55], [1, 50]],
    explanation: '高値が切り下がり安値が切り上がって、値動きが狭まる形。上下どちらに抜けるかは抜けるまでわからないから、方向感のない横ばいと考えるよ。',
  },
  {
    id: 'bull-flag', name: '上昇フラッグ', outlook: 'up',
    points: [[0, 10], [0.4, 80], [0.5, 70], [0.6, 76], [0.7, 66], [0.8, 72], [0.9, 62], [1, 68]],
    explanation: '急上昇のあとに小さく下向きに調整する形。調整が終わると、元の上昇が続きやすいよ。',
  },
  {
    id: 'pennant', name: 'ペナント', outlook: 'up',
    points: [[0, 10], [0.4, 80], [0.5, 64], [0.6, 76], [0.7, 68], [0.8, 74], [0.9, 71], [1, 72]],
    explanation: '急上昇のあとに三角形に狭まる形。上昇の途中の小休止で、上に抜けやすいよ。',
  },
  {
    id: 'rising-wedge', name: '上昇ウェッジ', outlook: 'down',
    points: [[0, 15], [0.15, 45], [0.25, 32], [0.4, 62], [0.5, 50], [0.65, 74], [0.75, 64], [0.88, 82], [1, 76]],
    explanation: '上昇しながら値幅が狭まる形。上昇の勢いが弱まっていて、下に抜けやすいよ。',
  },
  {
    id: 'falling-wedge', name: '下降ウェッジ', outlook: 'up',
    points: [[0, 85], [0.15, 55], [0.25, 68], [0.4, 38], [0.5, 50], [0.65, 26], [0.75, 36], [0.88, 18], [1, 24]],
    explanation: '下落しながら値幅が狭まる形。売りの勢いが弱まっていて、上に抜けやすいよ。',
  },
  {
    id: 'golden-cross', name: 'ゴールデンクロス', outlook: 'up', ma: true,
    points: [[0, 70], [0.3, 35], [0.5, 38], [1, 85]],
    explanation: '短期の移動平均線が長期の移動平均線を下から上に抜けた形。上昇のサインとされるよ。',
  },
  {
    id: 'dead-cross', name: 'デッドクロス', outlook: 'down', ma: true,
    points: [[0, 30], [0.3, 65], [0.5, 62], [1, 15]],
    explanation: '短期の移動平均線が長期の移動平均線を上から下に抜けた形。下落のサインとされるよ。',
  },
];
```

- [ ] **Step 4: 生成関数を `LOGIC` ブロックに追加する**

`// ==LOGIC-END==` の直前に追加する。

```js
const SERIES_LENGTH = 60;
const CONTINUATION_LENGTH = 15;
const SERIES_NOISE = 3;
const CONTINUATION_MOVE = 15;
const MA_SHORT = 5;
const MA_LONG = 15;

function round2(v) {
  return Math.round(v * 100) / 100;
}

function findPattern(id) {
  const p = PATTERNS.find((x) => x.id === id);
  if (!p) throw new Error(`パターンが見つからない: ${id}`);
  return p;
}

// 骨格の点のあいだを直線でつなぐ
function interpolate(points, t) {
  for (let i = 1; i < points.length; i++) {
    if (t <= points[i][0]) {
      const [t0, v0] = points[i - 1];
      const [t1, v1] = points[i];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return points[points.length - 1][1];
}

function generateSeries(pattern, seed) {
  const rng = createRng(seed);
  const values = [];
  for (let i = 0; i < SERIES_LENGTH; i++) {
    const base = interpolate(pattern.points, i / (SERIES_LENGTH - 1));
    values.push(round2(base + (rng() - 0.5) * SERIES_NOISE));
  }
  return values;
}

// 値動き予想の続き。方向は必ず outlook に一致させる
function generateContinuation(lastValue, outlook, seed) {
  const rng = createRng(seed + 7919);
  const move = outlook === 'up' ? CONTINUATION_MOVE : outlook === 'down' ? -CONTINUATION_MOVE : 0;
  const values = [];
  for (let i = 0; i < CONTINUATION_LENGTH; i++) {
    const base = lastValue + (move * (i + 1)) / CONTINUATION_LENGTH;
    values.push(round2(base + (rng() - 0.5) * 2));
  }
  return values;
}

function movingAverage(values, window) {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += values[j];
    return round2(sum / window);
  });
}
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `node --test stock-quiz/tests/`
Expected: PASS。もしゴールデンクロス / デッドクロスのテストが落ちたら、`points` の値を調整してから再実行する(テストの条件は変えない)。

- [ ] **Step 6: コミット**

```bash
git add stock-quiz
git commit -m "株クイズ: 11個のパターン定義とチャート生成を追加"
```

## Task 4: 問題データと問題の組み立て

**Files:**
- Modify: `stock-quiz/index.html`(`DATA` にローソク足と用語、`LOGIC` に組み立て関数)
- Test: `stock-quiz/tests/logic.test.js`(末尾に追加)

**Interfaces:**
- Consumes: `PATTERNS`, `findPattern`, `generateSeries`, `generateContinuation`, `movingAverage`, `MA_SHORT`, `MA_LONG`, `createRng`, `shuffle`(Task 2・3)
- Produces:
  - `MODES: string[]` = `['all','pattern','outlook','candle','term']`、`MODE_LABELS: Record<string,string>`
  - `OUTLOOK_LABELS = { up:'上がりやすい', down:'下がりやすい', flat:'横ばい' }`、`OUTLOOK_CHOICES: string[]`
  - `CANDLE_PATTERNS`(10個)、`TERMS`(20個)
  - 問題オブジェクト: `{ id, type, question, choices, answer, explanation, patternId?, patternName?, seed?, outlook?, candles? }`
  - `makePatternQuestion(pattern, seed)`, `makeOutlookQuestion(pattern, seed)`, `makeCandleQuestion(candle, rng)`, `makeTermQuestion(term, rng)`
  - `validateQuestion(q): string | null` — 問題がなければ `null`、問題があればその説明
  - `chartForQuestion(q): null | { kind:'line', values, ma?, continuation? } | { kind:'candles', candles }`

- [ ] **Step 1: 失敗するテストを書く**

```js
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test stock-quiz/tests/`
Expected: FAIL(`MODES` が未定義)。

- [ ] **Step 3: データを `DATA` ブロックに追加する**

`// ==DATA-END==` の直前に追加する。

```js
const MODES = ['all', 'pattern', 'outlook', 'candle', 'term'];
const MODE_LABELS = {
  all: '全部まぜ',
  pattern: '形の名前',
  outlook: '値動き予想',
  candle: 'ローソク足',
  term: '用語',
};

const OUTLOOK_LABELS = { up: '上がりやすい', down: '下がりやすい', flat: '横ばい' };
const OUTLOOK_CHOICES = ['上がりやすい', '下がりやすい', '横ばい'];

// ローソク足: o=始値 h=高値 l=安値 c=終値(0〜100 の相対値)
const CANDLE_PATTERNS = [
  { id: 'big-bullish', name: '大陽線', candles: [{ o: 30, h: 72, l: 28, c: 70 }],
    explanation: '始値から終値まで大きく上昇した長い陽線。買いの勢いが強いことを表すよ。' },
  { id: 'big-bearish', name: '大陰線', candles: [{ o: 70, h: 72, l: 28, c: 30 }],
    explanation: '始値から終値まで大きく下落した長い陰線。売りの勢いが強いことを表すよ。' },
  { id: 'doji', name: '十字線', candles: [{ o: 50, h: 72, l: 28, c: 50 }],
    explanation: '始値と終値がほぼ同じで、上下にヒゲがある形。買いと売りが拮抗していて、転換点のサインになることがあるよ。' },
  { id: 'hammer', name: 'ハンマー(トンカチ)', candles: [{ o: 62, h: 66, l: 20, c: 64 }],
    explanation: '実体が小さく、長い下ヒゲがある形。下落の底で出ると、反発のサインとされるよ。' },
  { id: 'shooting-star', name: '流れ星(シューティングスター)', candles: [{ o: 36, h: 80, l: 32, c: 34 }],
    explanation: '実体が小さく、長い上ヒゲがある形。上昇の天井で出ると、下落のサインとされるよ。' },
  { id: 'bullish-engulfing', name: '陽の包み足',
    candles: [{ o: 62, h: 64, l: 44, c: 46 }, { o: 42, h: 70, l: 40, c: 68 }],
    explanation: '小さな陰線を、次の大きな陽線がすっぽり包む形。下落の底で出ると、上昇のサインとされるよ。' },
  { id: 'bearish-engulfing', name: '陰の包み足',
    candles: [{ o: 46, h: 64, l: 44, c: 62 }, { o: 66, h: 68, l: 38, c: 40 }],
    explanation: '小さな陽線を、次の大きな陰線がすっぽり包む形。上昇の天井で出ると、下落のサインとされるよ。' },
  { id: 'three-white-soldiers', name: '赤三兵',
    candles: [{ o: 30, h: 46, l: 28, c: 44 }, { o: 44, h: 60, l: 42, c: 58 }, { o: 58, h: 74, l: 56, c: 72 }],
    explanation: '陽線が3本続けて切り上がる形。上昇が続くサインとされるよ。' },
  { id: 'three-black-crows', name: '黒三兵',
    candles: [{ o: 72, h: 74, l: 56, c: 58 }, { o: 58, h: 60, l: 42, c: 44 }, { o: 44, h: 46, l: 28, c: 30 }],
    explanation: '陰線が3本続けて切り下がる形。下落が続くサインとされるよ。' },
  { id: 'morning-star', name: '明けの明星',
    candles: [{ o: 72, h: 74, l: 48, c: 50 }, { o: 40, h: 44, l: 34, c: 38 }, { o: 44, h: 74, l: 42, c: 70 }],
    explanation: '大きな陰線のあとに小さな実体が出て、大きな陽線で反発する形。下落の底で出ると、上昇のサインとされるよ。' },
];

const TERMS = [
  { id: 'per', question: '「PER(株価収益率)」の意味は?',
    answer: '株価が1株あたり利益の何倍かを示す指標',
    wrongs: ['株価が1株あたり純資産の何倍かを示す指標', '株価に対する配当金の割合', '自己資本に対する利益の割合'],
    explanation: 'PER は株価 ÷ 1株あたり利益。一般に、低いほど割安とされるよ。' },
  { id: 'pbr', question: '「PBR(株価純資産倍率)」の意味は?',
    answer: '株価が1株あたり純資産の何倍かを示す指標',
    wrongs: ['株価が1株あたり利益の何倍かを示す指標', '株価に対する配当金の割合', '売上高の前年からの伸び率'],
    explanation: 'PBR は株価 ÷ 1株あたり純資産。1倍を割ると、解散価値より安いとされるよ。' },
  { id: 'dividend-yield', question: '「配当利回り」の意味は?',
    answer: '株価に対する、1年間の配当金の割合',
    wrongs: ['利益のうち、配当に回した割合', '株価の1年間の上昇率', '売上に対する利益の割合'],
    explanation: '配当利回り = 1株あたりの年間配当 ÷ 株価。株価が下がると、利回りは上がるよ。' },
  { id: 'roe', question: '「ROE(自己資本利益率)」の意味は?',
    answer: '自己資本に対して、どれだけ利益を出したかの割合',
    wrongs: ['総資産に対して、どれだけ利益を出したかの割合', '売上に対する利益の割合', '株価に対する利益の割合'],
    explanation: 'ROE は株主のお金をどれだけ効率よく利益に変えたかを見る指標だよ。' },
  { id: 'market-cap', question: '「時価総額」の計算式は?',
    answer: '株価 × 発行済株式数',
    wrongs: ['株価 × 1日の売買高', '純資産 + 負債', '1年間の売上の合計'],
    explanation: '時価総額は、市場がその会社全体にどれだけの値段をつけているかを表すよ。' },
  { id: 'volume', question: '「出来高」の意味は?',
    answer: '一定期間に売買が成立した株数',
    wrongs: ['売買の注文が出された金額の合計', '会社が発行している株式の総数', '配当を受け取れる株数'],
    explanation: '出来高が増えると、その値動きに多くの人が参加していることを表すよ。' },
  { id: 'market-order', question: '「成行注文」とは?',
    answer: '価格を指定せずに、すぐ売買したいときに出す注文',
    wrongs: ['価格を指定して出す注文', '株価が指定した価格に達したら出す注文', '翌日まで取り消せない注文'],
    explanation: '成行注文は、約定しやすい反面、思ったより不利な価格になることがあるよ。' },
  { id: 'limit-order', question: '「指値注文」とは?',
    answer: '価格を指定して出す注文',
    wrongs: ['価格を指定せずに出す注文', '売買を証券会社に任せる注文', '注文を出さずに様子を見ること'],
    explanation: '指値注文は、希望の価格にならなければ約定しないよ。' },
  { id: 'stop-order', question: '「逆指値注文」とは?',
    answer: '株価が指定した価格に達したら発注する注文',
    wrongs: ['現在の株価より有利な価格で出す注文', '売りと買いを同時に出す注文', '注文を出してすぐ取り消す注文'],
    explanation: '損失を限定したいときなどに使うよ。' },
  { id: 'limit-up', question: '「ストップ高」とは?',
    answer: '1日の値幅制限の上限まで株価が上昇すること',
    wrongs: ['1日の取引が停止されること', '年初来の高値を更新すること', '配当が上限額まで増えること'],
    explanation: '株価が1日に動ける幅には上限と下限があって、上限に達するとストップ高だよ。' },
  { id: 'short-selling', question: '「空売り」とは?',
    answer: '株を借りて売り、値下がり後に買い戻して利益を狙う取引',
    wrongs: ['持っている株を証券会社に貸して利息を得る取引', '新規上場する株を発行前に買う取引', '現金を全額払って買う取引'],
    explanation: '株価が下がると利益が出る一方、上がると損失が膨らむことがあるよ。' },
  { id: 'margin-trading', question: '「信用取引」とは?',
    answer: '資金や株を借りて行う取引',
    wrongs: ['代金を全額払って株を買う取引', '外貨で行う取引', '投資信託を積み立てる取引'],
    explanation: '手持ち資金より大きな取引ができるけれど、損失も大きくなるよ。' },
  { id: 'record-date', question: '「権利確定日」とは?',
    answer: '配当や株主優待を受け取る権利が決まる日',
    wrongs: ['株が上場する日', '決算が発表される日', '株を売却できる最後の日'],
    explanation: '権利確定日に株主名簿に載っている人が、配当などを受け取れるよ。' },
  { id: 'ex-rights', question: '「権利落ち日」とは?',
    answer: 'この日以降に買っても、配当などの権利が得られない最初の日',
    wrongs: ['権利を他の人に売れる最後の日', '決算が発表される日', '上場廃止が決まる日'],
    explanation: '権利落ち日は、配当の分だけ株価が下がることがあるよ。' },
  { id: 'earnings', question: '「決算」とは?',
    answer: '企業が一定期間の業績をまとめて報告すること',
    wrongs: ['株主総会の別の呼び方', '株の売買代金を精算すること', '配当金を振り込むこと'],
    explanation: '決算発表の前後は、株価が大きく動くことがあるよ。' },
  { id: 'golden-cross-term', question: '「ゴールデンクロス」とは?',
    answer: '短期の移動平均線が、長期の移動平均線を下から上に抜けること',
    wrongs: ['短期の移動平均線が、長期の移動平均線を上から下に抜けること', '株価が過去最高値を更新すること', '出来高が前日の2倍になること'],
    explanation: '上昇のサインとされるよ。反対に、上から下に抜けるのはデッドクロスだよ。' },
  { id: 'moving-average', question: '「移動平均線」とは?',
    answer: '一定期間の終値の平均をつないだ線',
    wrongs: ['一定期間の出来高の合計をつないだ線', '高値と安値をつないだ線', '売買代金の推移をつないだ線'],
    explanation: '株価のトレンド(流れ)を見るときに使うよ。' },
  { id: 'nikkei-225', question: '「日経平均株価」とは?',
    answer: '日本経済新聞社が選んだ225銘柄の株価から計算する指数',
    wrongs: ['東証に上場する全銘柄の時価総額から計算する指数', '日本銀行が毎日発表する株価の目標', '上場企業の配当利回りの平均'],
    explanation: '日本の株式市場の動きを見る代表的な指標だよ。' },
  { id: 'diversification', question: '「分散投資」とは?',
    answer: '複数の銘柄や資産に分けて投資して、リスクを減らすこと',
    wrongs: ['1つの銘柄に資金を集中させること', '短期の売買を何度も繰り返すこと', '借りたお金で投資額を増やすこと'],
    explanation: '「卵を1つのカゴに盛るな」という言葉でも知られているよ。' },
  { id: 'nisa', question: '「NISA」とは?',
    answer: '一定の投資額までの運用益や配当が非課税になる制度',
    wrongs: ['株を担保にお金を借りられる制度', '海外の株だけを買える口座', '売買手数料が無料になる制度'],
    explanation: '通常、運用益には約20%の税金がかかるけれど、NISA の枠の中では非課税だよ。' },
];
```

- [ ] **Step 4: 組み立て関数を `LOGIC` ブロックに追加する**

`// ==LOGIC-END==` の直前に追加する。

```js
const QUESTION_TEXT = {
  pattern: 'このチャートの形の名前は?',
  outlook: 'この後、株価はどう動きやすい?',
  candle: 'このローソク足の名前は?',
};

// correct 以外から count 個を、シャッフルして選ぶ
function pickOthers(items, correct, count, rng) {
  return shuffle(items.filter((x) => x !== correct), rng).slice(0, count);
}

function makePatternQuestion(pattern, seed) {
  const rng = createRng(seed + 1);
  const others = pickOthers(PATTERNS, pattern, 3, rng).map((p) => p.name);
  return {
    id: `pattern:${pattern.id}`,
    type: 'pattern',
    patternId: pattern.id,
    patternName: pattern.name,
    seed,
    question: QUESTION_TEXT.pattern,
    choices: shuffle([pattern.name, ...others], rng),
    answer: pattern.name,
    explanation: pattern.explanation,
  };
}

function makeOutlookQuestion(pattern, seed) {
  return {
    id: `outlook:${pattern.id}`,
    type: 'outlook',
    patternId: pattern.id,
    patternName: pattern.name,
    seed,
    question: QUESTION_TEXT.outlook,
    choices: OUTLOOK_CHOICES.slice(),
    answer: OUTLOOK_LABELS[pattern.outlook],
    outlook: pattern.outlook,
    explanation: pattern.explanation,
  };
}

function makeCandleQuestion(candle, rng) {
  const others = pickOthers(CANDLE_PATTERNS, candle, 3, rng).map((c) => c.name);
  return {
    id: `candle:${candle.id}`,
    type: 'candle',
    candles: candle.candles,
    question: QUESTION_TEXT.candle,
    choices: shuffle([candle.name, ...others], rng),
    answer: candle.name,
    explanation: candle.explanation,
  };
}

function makeTermQuestion(term, rng) {
  return {
    id: `term:${term.id}`,
    type: 'term',
    question: term.question,
    choices: shuffle([term.answer, ...term.wrongs], rng),
    answer: term.answer,
    explanation: term.explanation,
  };
}

// 問題に不備があればその説明を、なければ null を返す
function validateQuestion(q) {
  if (!['pattern', 'outlook', 'candle', 'term'].includes(q.type)) return `type が不正: ${q.type}`;
  if (!q.id || !q.question || !q.explanation) return `${q.id}: 必須項目がない`;
  const expected = q.type === 'outlook' ? 3 : 4;
  if (q.choices.length !== expected) return `${q.id}: 選択肢が${expected}個ではない`;
  if (new Set(q.choices).size !== q.choices.length) return `${q.id}: 選択肢が重複している`;
  if (q.choices.filter((c) => c === q.answer).length !== 1) return `${q.id}: 正解がちょうど1つ含まれていない`;
  return null;
}

function chartForQuestion(q) {
  if (q.type === 'term') return null;
  if (q.type === 'candle') return { kind: 'candles', candles: q.candles };
  const pattern = findPattern(q.patternId);
  const values = generateSeries(pattern, q.seed);
  const chart = { kind: 'line', values };
  if (pattern.ma) {
    chart.ma = { short: movingAverage(values, MA_SHORT), long: movingAverage(values, MA_LONG) };
  }
  if (q.type === 'outlook') {
    chart.continuation = generateContinuation(values[values.length - 1], pattern.outlook, q.seed);
  }
  return chart;
}
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `node --test stock-quiz/tests/`
Expected: PASS。

- [ ] **Step 6: コミット**

```bash
git add stock-quiz
git commit -m "株クイズ: ローソク足・用語のデータと問題の組み立てを追加"
```

## Task 5: ラウンド構築・採点・保存データ

**Files:**
- Modify: `stock-quiz/index.html`(`LOGIC` ブロック)
- Test: `stock-quiz/tests/logic.test.js`(末尾に追加)

**Interfaces:**
- Consumes: `MODES`, `MODE_LABELS`, 各 `make*Question`, `validateQuestion`, `createRng`, `shuffle`(Task 2〜4)
- Produces:
  - `ROUND_SIZE = 10`
  - `buildDeck(mode: string, seed: number): Question[]` — 10問、`id` の重複なし
  - `judge(q, choice: string): boolean`
  - `summarizeRound(results): { total, correct, wrong }` — `results` は `{ id, question, answer, picked, correct }[]`
  - `defaultStats()`, `updateStats(stats, mode, correct, total)`(新しいオブジェクトを返す), `parseStats(text: string|null|undefined)`(壊れた入力でも `defaultStats()` 相当を返す)
  - `formatShareText(mode, correct, total): string`

- [ ] **Step 1: 失敗するテストを書く**

```js
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test stock-quiz/tests/`
Expected: FAIL(`buildDeck` が未定義)。

- [ ] **Step 3: 実装する**

`LOGIC` ブロックの `// ==LOGIC-END==` の直前に追加する。

```js
const ROUND_SIZE = 10;

function buildPool(mode, rng) {
  const wants = (type) => mode === 'all' || mode === type;
  const pool = [];
  if (wants('pattern')) {
    for (const p of PATTERNS) pool.push(makePatternQuestion(p, Math.floor(rng() * 1e9)));
  }
  if (wants('outlook')) {
    for (const p of PATTERNS) pool.push(makeOutlookQuestion(p, Math.floor(rng() * 1e9)));
  }
  if (wants('candle')) {
    for (const c of CANDLE_PATTERNS) pool.push(makeCandleQuestion(c, rng));
  }
  if (wants('term')) {
    for (const t of TERMS) pool.push(makeTermQuestion(t, rng));
  }
  return pool;
}

function buildDeck(mode, seed) {
  const rng = createRng(seed);
  return shuffle(buildPool(mode, rng), rng).slice(0, ROUND_SIZE);
}

function judge(q, choice) {
  return choice === q.answer;
}

function summarizeRound(results) {
  return {
    total: results.length,
    correct: results.filter((r) => r.correct).length,
    wrong: results.filter((r) => !r.correct),
  };
}

function defaultStats() {
  const stats = { best: {}, played: {} };
  for (const m of MODES) {
    stats.best[m] = 0;
    stats.played[m] = { correct: 0, total: 0 };
  }
  return stats;
}

function updateStats(stats, mode, correct, total) {
  const next = JSON.parse(JSON.stringify(stats));
  next.best[mode] = Math.max(next.best[mode], correct);
  next.played[mode].correct += correct;
  next.played[mode].total += total;
  return next;
}

// localStorage の文字列から読み込む。壊れていても、正しい部分だけ使って続行する
function parseStats(text) {
  const stats = defaultStats();
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return stats;
  }
  if (!raw || typeof raw !== 'object') return stats;
  for (const m of MODES) {
    const best = raw.best && raw.best[m];
    const played = raw.played && raw.played[m];
    if (Number.isFinite(best) && best >= 0) stats.best[m] = best;
    if (
      played &&
      Number.isFinite(played.correct) &&
      Number.isFinite(played.total) &&
      played.correct >= 0 &&
      played.total >= played.correct
    ) {
      stats.played[m] = { correct: played.correct, total: played.total };
    }
  }
  return stats;
}

function formatShareText(mode, correct, total) {
  return `株クイズ(${MODE_LABELS[mode]})で ${total}問中${correct}問正解!`;
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `node --test stock-quiz/tests/`
Expected: PASS(全テスト)。

- [ ] **Step 5: コミット**

```bash
git add stock-quiz
git commit -m "株クイズ: ラウンド構築・採点・保存データの処理を追加"
```

## Task 6: 画面(HTML・CSS・Canvas 描画・操作)

**Files:**
- Modify: `stock-quiz/index.html`(`<style>` と `UI` ブロック)

**Interfaces:**
- Consumes: `LOGIC` / `DATA` の `MODES`, `MODE_LABELS`, `ROUND_SIZE`, `buildDeck`, `judge`, `chartForQuestion`, `normalizeRange`, `summarizeRound`, `defaultStats`, `updateStats`, `parseStats`, `formatShareText`

画面は `UI` ブロックに書くので、自動テストの対象外。Task 7 で手動確認する。

- [ ] **Step 1: スタイルを書く**

`<style>` と `</style>` のあいだに入れる。

```css
:root {
  --bg: #f6f5f2; --card: #ffffff; --text: #1f1f1d; --muted: #6b6a64; --border: #dcdad2;
  --accent: #185fa5; --good-bg: #eaf3de; --good: #27500a; --bad-bg: #fcebeb; --bad: #791f1f;
  --line: #185fa5; --ma-short: #d85a30; --ma-long: #7f77dd; --up: #d03a3a; --down: #2a6fd6; --cont: #a32d2d;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1c1c1a; --card: #262624; --text: #f1efe8; --muted: #b4b2a9; --border: #444441;
    --accent: #85b7eb; --good-bg: #173404; --good: #c0dd97; --bad-bg: #501313; --bad: #f7c1c1;
    --line: #85b7eb; --ma-short: #f0997b; --ma-long: #afa9ec; --up: #f09595; --down: #85b7eb; --cont: #f09595;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); line-height: 1.7;
  font-family: system-ui, "Hiragino Sans", "Yu Gothic", sans-serif; }
main { max-width: 560px; margin: 0 auto; padding: 16px; }
h1 { font-size: 22px; font-weight: 500; margin: 8px 0 4px; }
.lead, .note, .sub { color: var(--muted); font-size: 14px; margin: 4px 0 12px; }
.q { font-size: 16px; font-weight: 500; margin: 12px 0 8px; }
.head { display: flex; justify-content: space-between; font-size: 13px; color: var(--muted); }
.bar { height: 4px; background: var(--border); border-radius: 2px; margin: 6px 0 12px; }
.bar > div { height: 4px; background: var(--accent); border-radius: 2px; }
.chart { background: var(--card); border: 0.5px solid var(--border); border-radius: 8px; padding: 8px; margin-bottom: 12px; }
canvas { display: block; }
.choices { display: grid; gap: 8px; }
button { font: inherit; color: var(--text); background: var(--card); border: 0.5px solid var(--border);
  border-radius: 8px; padding: 12px; text-align: left; cursor: pointer; }
button:hover { border-color: var(--accent); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
button small { display: block; color: var(--muted); font-size: 13px; }
button.primary { background: var(--accent); color: var(--card); text-align: center; width: 100%; margin-top: 8px; }
.result { border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.result.good { background: var(--good-bg); color: var(--good); }
.result.bad { background: var(--bad-bg); color: var(--bad); }
.result .label { margin: 0; font-size: 13px; }
.result .answer { margin: 2px 0 0; font-size: 22px; font-weight: 500; }
.result .exp { margin: 6px 0 0; font-size: 14px; }
.score { font-size: 32px; font-weight: 500; margin: 8px 0; }
ul.wrong { padding-left: 20px; font-size: 14px; }
.actions { display: grid; gap: 8px; margin-top: 12px; }
.disclaimer { max-width: 560px; margin: 0 auto; padding: 8px 16px 24px; font-size: 12px; color: var(--muted); text-align: center; }
```

- [ ] **Step 2: 画面のコードを書く**

`// ==UI-START==` と `// ==UI-END==` のあいだに入れる。

```js
const STORAGE_KEY = 'stockQuiz.stats.v1';
const app = document.getElementById('app');
let stats = loadStats();
let game = null;
let redraw = null;

function loadStats() {
  try {
    return parseStats(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    return defaultStats();
  }
}

function saveStats() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    // 保存できなくても、ゲームはそのまま続ける
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function header() {
  const done = game.results.length;
  const correct = game.results.filter((r) => r.correct).length;
  return `<div class="head"><span>問題 ${Math.min(game.index + 1, game.deck.length)} / ${game.deck.length}</span><span>正解 ${correct}</span></div>
    <div class="bar"><div style="width:${(done / game.deck.length) * 100}%"></div></div>`;
}

// ---- チャートの描画 ----
function drawLines(ctx, w, h, chart, reveal, colors) {
  const cont = chart.continuation || [];
  const all = chart.values.concat(cont);
  const { min, max } = normalizeRange(all);
  const n = all.length;
  const x = (i) => 8 + (i / (n - 1)) * (w - 16);
  const y = (v) => h - 12 - ((v - min) / (max - min)) * (h - 24);
  const stroke = (pts, color, width, dash) => {
    ctx.beginPath();
    let started = false;
    pts.forEach(([i, v]) => {
      if (v === null) return;
      if (!started) { ctx.moveTo(x(i), y(v)); started = true; } else { ctx.lineTo(x(i), y(v)); }
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.setLineDash([]);
  };
  if (chart.ma) {
    stroke(chart.ma.long.map((v, i) => [i, v]), colors.long, 1.5);
    stroke(chart.ma.short.map((v, i) => [i, v]), colors.short, 1.5);
  }
  stroke(chart.values.map((v, i) => [i, v]), colors.line, 2.5);
  if (reveal && cont.length) {
    const start = chart.values.length - 1;
    stroke([[start, chart.values[start]], ...cont.map((v, i) => [start + 1 + i, v])], colors.cont, 2.5, [6, 4]);
  }
}

function drawCandles(ctx, w, h, candles, colors) {
  const { min, max } = normalizeRange(candles.flatMap((c) => [c.h, c.l]));
  const y = (v) => h - 12 - ((v - min) / (max - min)) * (h - 24);
  const slot = w / candles.length;
  const bodyW = Math.min(56, slot * 0.4);
  candles.forEach((c, i) => {
    const cx = slot * (i + 0.5);
    const color = c.c >= c.o ? colors.up : colors.down;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, y(c.h));
    ctx.lineTo(cx, y(c.l));
    ctx.stroke();
    const top = y(Math.max(c.o, c.c));
    const bottom = y(Math.min(c.o, c.c));
    ctx.fillRect(cx - bodyW / 2, top, bodyW, Math.max(2, bottom - top));
  });
}

function renderChart(canvas, chart, reveal) {
  const css = getComputedStyle(document.documentElement);
  const get = (name) => css.getPropertyValue(name).trim();
  const colors = {
    line: get('--line'), short: get('--ma-short'), long: get('--ma-long'),
    up: get('--up'), down: get('--down'), cont: get('--cont'),
  };
  const w = canvas.parentElement.clientWidth - 16;
  const h = Math.round(w * 0.55);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  if (chart.kind === 'candles') drawCandles(ctx, w, h, chart.candles, colors);
  else drawLines(ctx, w, h, chart, reveal, colors);
}

function drawQuestionChart(q, reveal) {
  const canvas = document.getElementById('chart');
  const chart = chartForQuestion(q);
  redraw = () => renderChart(canvas, chart, reveal);
  redraw();
}

window.addEventListener('resize', () => { if (redraw) redraw(); });

// ---- 画面 ----
function showStart() {
  redraw = null;
  const rows = MODES.map((m) => {
    const p = stats.played[m];
    const rate = p.total ? `${Math.round((p.correct / p.total) * 100)}%` : '-';
    return `<button class="choice" data-mode="${m}">${MODE_LABELS[m]}<small>最高 ${stats.best[m]} / ${ROUND_SIZE}　正解率 ${rate}</small></button>`;
  }).join('');
  app.innerHTML = `<h1>株クイズ</h1>
    <p class="lead">チャートの形、値動き、ローソク足、用語をクイズで学ぼう。1回 ${ROUND_SIZE} 問だよ。</p>
    <div class="choices">${rows}</div>`;
  app.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => startGame(b.dataset.mode)));
}

function startGame(mode) {
  game = { mode, deck: buildDeck(mode, Date.now() % 2147483647), index: 0, results: [] };
  showQuestion();
}

function showQuestion() {
  const q = game.deck[game.index];
  const hasChart = q.type !== 'term';
  app.innerHTML = `${header()}
    <p class="q">${esc(q.question)}</p>
    ${hasChart ? '<div class="chart"><canvas id="chart"></canvas></div>' : ''}
    ${q.type === 'candle' ? '<p class="note">赤が陽線(上昇)、青が陰線(下落)だよ。</p>' : ''}
    <div class="choices">${q.choices.map((c, i) => `<button class="choice" data-i="${i}">${esc(c)}</button>`).join('')}</div>`;
  if (hasChart) drawQuestionChart(q, false);
  else redraw = null;
  app.querySelectorAll('[data-i]').forEach((b) =>
    b.addEventListener('click', () => answer(q, q.choices[Number(b.dataset.i)])));
}

function answer(q, picked) {
  const correct = judge(q, picked);
  game.results.push({ id: q.id, question: q.question, answer: q.answer, picked, correct });
  showExplain(q, picked, correct);
}

function showExplain(q, picked, correct) {
  const hasChart = q.type !== 'term';
  const last = game.index === game.deck.length - 1;
  const shape = q.type === 'outlook' ? `<p class="sub">チャートの形: ${esc(q.patternName)}</p>` : '';
  app.innerHTML = `${header()}
    <div class="result ${correct ? 'good' : 'bad'}">
      <p class="label">正解</p>
      <p class="answer">${esc(q.answer)}</p>
      <p class="exp">${esc(q.explanation)}</p>
    </div>
    ${shape}
    ${hasChart ? '<div class="chart"><canvas id="chart"></canvas></div>' : ''}
    <p class="sub">あなたの答え: ${esc(picked)}(${correct ? '正解' : '不正解'})</p>
    <button class="primary" id="next">${last ? '結果を見る' : '次の問題へ'}</button>`;
  if (hasChart) drawQuestionChart(q, true);
  else redraw = null;
  document.getElementById('next').addEventListener('click', next);
}

function next() {
  game.index += 1;
  if (game.index >= game.deck.length) finish();
  else showQuestion();
}

function finish() {
  const summary = summarizeRound(game.results);
  stats = updateStats(stats, game.mode, summary.correct, summary.total);
  saveStats();
  showResult(summary);
}

function showResult(summary) {
  redraw = null;
  const wrong = summary.wrong.map((r) =>
    `<li>${esc(r.question)} 正解: ${esc(r.answer)}(あなたの答え: ${esc(r.picked)})</li>`).join('');
  app.innerHTML = `<h1>結果</h1>
    <p class="score">${summary.correct} / ${summary.total}</p>
    ${wrong ? `<p class="q">間違えた問題</p><ul class="wrong">${wrong}</ul>` : '<p class="lead">全問正解だよ。</p>'}
    <div class="actions">
      <button class="primary" id="again">もう一度</button>
      <button id="copy">結果をコピー</button>
      <button id="top">トップへ戻る</button>
    </div>
    <p class="note" id="copy-note"></p>`;
  document.getElementById('again').addEventListener('click', () => startGame(game.mode));
  document.getElementById('top').addEventListener('click', showStart);
  document.getElementById('copy').addEventListener('click', () =>
    copyResult(formatShareText(game.mode, summary.correct, summary.total)));
}

async function copyResult(text) {
  const note = document.getElementById('copy-note');
  try {
    await navigator.clipboard.writeText(text);
    note.textContent = 'コピーしたよ。';
  } catch (e) {
    note.textContent = `コピーできなかったよ。次の文を手でコピーしてね: ${text}`;
  }
}

showStart();
```

- [ ] **Step 3: 自動テストが壊れていないことを確認する**

Run: `node --test stock-quiz/tests/`
Expected: PASS(画面のコードは `UI` ブロックなので、テストの対象外)。

- [ ] **Step 4: ブラウザで開いて、起動することを確認する**

`stock-quiz/index.html` をブラウザで開く(`file:///C:/Users/PC/.claude/app/research/stock-quiz/index.html`)。
Expected: タイトルと5つのモードのボタンが出る。コンソールにエラーが出ない。

- [ ] **Step 5: コミット**

```bash
git add stock-quiz
git commit -m "株クイズ: 画面(問題・解説・結果)を追加"
```

## Task 7: 手動確認と仕上げ

**Files:**
- Modify: `stock-quiz/index.html`(確認で見つかった不具合の修正のみ)

画面は自動テストの対象外なので、ブラウザで次を1つずつ確認する。不具合があれば直して、再確認する。

- [ ] **Step 1: 通しで遊ぶ**

各モード(全部まぜ / 形の名前 / 値動き予想 / ローソク足 / 用語)で1ラウンド(10問)遊ぶ。確認すること:
- 問題画面に、問題番号・正解数・進捗バー・チャート・4択(値動き予想は3択)が出る
- 解説画面の一番上に、**正解の名前**が大きく出る。「あなたの答え: ○○(正解 / 不正解)」が出る
- 値動き予想の解説画面では、「チャートの形: ○○」が出て、続きの値動きが赤い点線で描かれる(方向が正解と合っている)
- ゴールデンクロス / デッドクロスの問題で、移動平均線が2本描かれる
- 最後の問題で「結果を見る」になり、結果画面に正解数と間違えた問題が出る
- 「もう一度」「トップへ戻る」が動く。トップに最高スコアと正解率が出る

- [ ] **Step 2: スマホ幅とダークモード**

ブラウザの幅を 375px にして確認する。
- 横スクロールが出ない。チャートが画面幅に収まる。ウィンドウ幅を変えるとチャートが描き直される
- ダークモード(OS またはブラウザの設定)で、文字とチャートが読める
- 色だけで正誤を伝えていない(「正解」「不正解」の文字がある)

- [ ] **Step 3: 免責の表示**

全画面(トップ・問題・解説・結果)の下部に、免責の文が出ている。

- [ ] **Step 4: `localStorage` が使えない場合**

`localStorage` が使えない状態で開く。方法は、プライベートウィンドウで開くか、ブラウザの設定でサイトデータの保存を禁止する。
Expected: 保存されないだけで、ゲームは最後まで遊べて、エラーで止まらない。

- [ ] **Step 5: 壊れた保存データ**

開発者ツールのコンソールで次を実行して、ページを再読み込みする。

```js
localStorage.setItem('stockQuiz.stats.v1', '{壊れたデータ');
```

Expected: トップ画面が出て、最高スコアと正解率が初期値(0 と `-`)になり、ゲームが遊べる。

- [ ] **Step 6: 結果のコピー**

- 通常のブラウザ: 「結果をコピー」で「コピーしたよ。」が出る
- クリップボードが使えない環境(`file://` で開いた場合など): 「コピーできなかったよ。次の文を手でコピーしてね: …」と文章が出る

- [ ] **Step 7: テストを最後にもう一度流して、コミットする**

```bash
node --test stock-quiz/tests/
git add stock-quiz
git commit -m "株クイズ: 手動確認で見つかった点を修正"
```

不具合がなくて変更がなければ、コミットは不要。

- [ ] **Step 8: 完了前の確認**

`superpowers:verification-before-completion` に従って、テストの出力(全件 PASS)と、Step 1〜6 の確認結果をそのまま報告する。GitHub Pages への公開は、ユーザーが許可するまで行わない。

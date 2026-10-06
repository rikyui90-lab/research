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

// verifier に渡す入力を作る: 候補に、内容のハッシュ(hash)を付けて書く
// 使い方: node scripts/news-quiz/prepare-verify.mjs <candidates.json> <verify-input.json>
// verifier は、各問題の hash をそのまま結果(verdicts.json)に写す。check-news が、内容から計算した値と照らす
import { readJson, writeJson, contentHash } from './lib.mjs';

const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) { console.error('使い方: prepare-verify.mjs <candidates.json> <verify-input.json>'); process.exit(1); }
const cands = readJson(inFile);
if (!Array.isArray(cands)) { console.error('candidates.json が配列ではない'); process.exit(1); }
const out = cands.map((c) => {
  if (!c || !Array.isArray(c.wrongs)) return { ...c, hash: null };
  return { ...c, hash: contentHash(c) };
});
writeJson(outFile, out);
console.log(`verifier の入力: ${out.length}問`);

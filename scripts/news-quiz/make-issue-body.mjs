// 失敗・不足の Issue の本文を作る(ニュースの本文は入れない。id と理由だけ)
// 使い方: node scripts/news-quiz/make-issue-body.mjs <理由の文> <rejected.json> [--run-url URL]
import fs from 'node:fs';
import { parseArgs } from './lib.mjs';

const { positional, flags } = parseArgs(process.argv.slice(2));
const [reason, rejectedFile] = positional;
const lines = [`理由: ${reason || '不明'}`, ''];
if (rejectedFile && fs.existsSync(rejectedFile)) {
  try {
    const rej = JSON.parse(fs.readFileSync(rejectedFile, 'utf8'));
    lines.push(`落ちた問題: ${rej.length}問`, '');
    for (const r of rej.slice(0, 20)) lines.push(`- ${r.id ?? '(id なし)'}: ${r.reasons.join(' / ').slice(0, 200)}`);
    lines.push('');
  } catch { lines.push('(rejected.json を読めなかったよ)', ''); }
}
if (typeof flags['run-url'] === 'string') lines.push(`実行ログ: ${flags['run-url']}`);
lines.push('', '公開(main への反映)はしていないよ。次の月曜に、また自動で試すよ。');
console.log(lines.join('\n'));

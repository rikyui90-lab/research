// writer に渡す、既存の時事問題の一覧(id・問い・出来事の日だけ)を書く
// 使い方: node scripts/news-quiz/list-existing.mjs <出力先.json>
import { loadLogicFrom, writeJson } from './lib.mjs';

const out = process.argv[2];
if (!out) { console.error('使い方: list-existing.mjs <出力先.json>'); process.exit(1); }
const L = loadLogicFrom();
writeJson(out, L.NEWS_QUESTIONS.map((n) => ({ id: n.id, date: n.date, question: n.question })));
console.log(`既存の時事問題: ${L.NEWS_QUESTIONS.length}問`);

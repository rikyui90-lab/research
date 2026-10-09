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
// forecastPublic: 株価予想を画面に出す設定(FORECAST_PUBLIC)を上書きする。省略すると true(モードの中身を調べるため)
function loadLogic({ forecastPublic = true } = {}) {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const code = (extractBlock(html, 'DATA') + '\n' + extractBlock(html, 'LOGIC'))
    .replace(/const FORECAST_PUBLIC = (true|false);/, `const FORECAST_PUBLIC = ${forecastPublic};`);
  const lookup = new Function(code + '\nreturn (name) => eval(name);')();
  return new Proxy({}, { get: (_, name) => lookup(String(name)) });
}

module.exports = { loadLogic };

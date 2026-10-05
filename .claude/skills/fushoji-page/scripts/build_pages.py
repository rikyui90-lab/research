"""companies.json から、四半期ごとのページとトップページを生成する。

使い方:
  python build_pages.py <companies.json> <出力フォルダ> [--use-cache] [--asof YYYY-MM-DD] [--until YYYY-MM-DD]

- 株価は Yahoo Finance から取得し、出力フォルダの prices.json に保存する。
- --use-cache を付けると取得せず prices.json を使う。
- --until を付けると、その日までの終値だけを使う(取引中の値を避けるときに使う)。
  発生日の終値がまだない会社は、ページに載せずに警告を出す。
- 四半期は発生日(eventDate)の暦年の四半期で分ける。
"""
import json
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fetch_prices import fetch  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = (ROOT / "assets" / "template.html").read_text(encoding="utf-8")
HISTORY_DAYS = 100  # 発生日の何日前から株価を載せるか
FETCH_DAYS = 420


def jp(d):
    d = datetime.strptime(d, "%Y-%m-%d")
    return f"{d.year}年{d.month}月{d.day}日"


def quarter(ev):
    y, m = int(ev[:4]), int(ev[5:7])
    q = (m - 1) // 3 + 1
    return f"{y}-q{q}", f"{y}年{(q - 1) * 3 + 1}〜{q * 3}月期"


def js(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\/")


def metrics(c, rows):
    idx = next(i for i, r in enumerate(rows) if r[0] >= c["eventDate"])
    if idx < 1:
        raise SystemExit(f"{c['name']}: 発生日の前営業日の株価がありません")
    base, last = rows[idx - 1], rows[-1]
    return base, last, (last[1] / base[1] - 1) * 100


def pct_text(p):
    return ("+" if p > 0 else "−" if p < 0 else "") + f"{abs(p):.1f}%"


def main():
    args = sys.argv[1:]
    use_cache = "--use-cache" in args
    asof = None
    if "--asof" in args:
        i = args.index("--asof")
        asof = args[i + 1]
        del args[i : i + 2]
    until = None
    if "--until" in args:
        i = args.index("--until")
        until = args[i + 1]
        del args[i : i + 2]
    args = [a for a in args if a != "--use-cache"]
    companies = json.loads(Path(args[0]).read_text(encoding="utf-8"))
    out = Path(args[1])
    out.mkdir(parents=True, exist_ok=True)
    cache = out / "prices.json"

    if use_cache:
        prices = json.loads(cache.read_text(encoding="utf-8"))
    else:
        prices = {}
        for c in companies:
            if c["sym"] not in prices:
                prices[c["sym"]] = fetch(c["sym"], FETCH_DAYS)
        cache.write_text(json.dumps(prices, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    if until:
        prices = {k: [r for r in v if r[0] <= until] for k, v in prices.items()}
        kept = []
        for c in companies:
            if not any(r[0] >= c["eventDate"] for r in prices[c["sym"]]):
                print(f"警告: {c['name']} は発生日の終値がまだないため載せません", file=sys.stderr)
            else:
                kept.append(c)
        companies = kept
    latest = max(r[-1][0] for r in prices.values())
    asof = asof or date.today().isoformat()

    quarters = {}
    for c in companies:
        key, label = quarter(c["eventDate"])
        quarters.setdefault(key, {"label": label, "items": []})["items"].append(c)

    style = re.search(r"<style>.*?</style>", TEMPLATE, re.S).group(0)
    summary = {}
    for key, q in sorted(quarters.items()):
        syms = {c["sym"] for c in q["items"]}
        cut = {}
        for c in q["items"]:
            lo = (datetime.strptime(c["eventDate"], "%Y-%m-%d") - timedelta(days=HISTORY_DAYS)).strftime("%Y-%m-%d")
            cut[c["sym"]] = [r for r in prices[c["sym"]] if r[0] >= lo]
            base, last, pct = metrics(c, cut[c["sym"]])
            summary[c["id"]] = (base, last, pct)
        foot = "\n".join(
            f"    <p>{t}</p>"
            for t in [
                f"株価は Yahoo Finance の日足終値(配当・分割の調整なし)を{jp(asof)}に取得したものです。最新の終値は{jp(latest)}までです。",
                "不祥事の内容と発生日は、各カードに記載した出典(ニュース記事や適時開示)を要約したものです。独自の事実確認は行っていません。",
                "株価の変動には不祥事以外の要因も含まれます。投資の助言ではありません。",
            ]
        )
        title = f"不祥事銘柄の株価推移 {q['label']}"
        html = (
            TEMPLATE.replace("__TITLE__", title)
            .replace("__H1__", title)
            .replace("__BACKHREF__", "index.html")
            .replace("__ASOF__", jp(latest))
            .replace("__FOOT__", foot)
            .replace("__PRICES__", js(cut))
            .replace("__STOCKS__", js([{k: v for k, v in c.items()} for c in q["items"]]))
        )
        (out / f"{key}.html").write_text(html, encoding="utf-8")
        q["file"] = f"{key}.html"

    # トップページ
    sections = []
    for key, q in sorted(quarters.items(), reverse=True):
        items = sorted(q["items"], key=lambda c: c["eventDate"], reverse=True)
        rows = "".join(
            f'<li><span class="nm">{c["name"]}<small>{c["code"]} · {jp(c["eventDate"])}</small></span>'
            f'<span class="pc num {"dn" if summary[c["id"]][2] < 0 else ""}">{pct_text(summary[c["id"]][2])}</span></li>'
            for c in items
        )
        sections.append(
            f'<a class="q" href="{q["file"]}"><h2>{q["label"]}<span>{len(items)}社 →</span></h2><ul>{rows}</ul></a>'
        )
    index = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>不祥事銘柄の株価推移</title></head><body style="margin:0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Zen+Kaku+Gothic+New:wght@500;700&display=swap">
{style}
<style>
  .qs {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 20px; }}
  a.q {{ background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 20px; color: inherit; text-decoration: none; display: flex; flex-direction: column; gap: 12px; }}
  a.q:hover {{ border-color: var(--series); }}
  a.q:focus-visible {{ outline: 2px solid var(--series); outline-offset: 2px; }}
  a.q h2 {{ font-size: 18px; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }}
  a.q h2 span {{ font: 500 13px var(--font-body); color: var(--ink-3); }}
  a.q ul {{ list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }}
  a.q li {{ display: flex; justify-content: space-between; gap: 12px; align-items: baseline; font-size: 14px; }}
  a.q .nm {{ color: var(--company); min-width: 0; }}
  a.q .nm small {{ display: block; color: var(--ink-3); font-size: 11.5px; }}
  a.q .pc {{ font-weight: 700; white-space: nowrap; }}
</style>
<div class="wrap">
  <header class="top">
    <div class="eyebrow">{jp(latest)}時点 · 日足終値</div>
    <h1>不祥事銘柄の株価推移</h1>
    <p class="lead">過去1年に不祥事が公表された上場企業{len(companies)}社を、四半期ごとにまとめました。四半期を選ぶと、公表前後の日足終値の推移を見られます。数字は、発生日の前営業日の終値から最新の終値までの騰落率です。</p>
  </header>
  <section class="qs" aria-label="四半期別">{"".join(sections)}</section>
  <footer class="foot">
    <p>株価は Yahoo Finance の日足終値(配当・分割の調整なし)を{jp(asof)}に取得したものです。最新の終値は{jp(latest)}までです。</p>
    <p>非上場の会社は対象外です。不祥事の内容と発生日は、各ページに記載した出典を要約したものです。独自の事実確認は行っていません。</p>
    <p>株価の変動には不祥事以外の要因も含まれます。投資の助言ではありません。</p>
  </footer>
</div>
</body></html>"""
    (out / "index.html").write_text(index, encoding="utf-8")
    print(f"生成: index.html + {len(quarters)}ページ / 会社 {len(companies)}社 / 最新日 {latest}")


if __name__ == "__main__":
    main()

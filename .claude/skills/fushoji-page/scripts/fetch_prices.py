"""Yahoo Finance から日足終値を取得し、PRICES 形式の JSON を標準出力に出す。

使い方: python fetch_prices.py 6594.T 6908.T PRU [--days 100]
出力例: {"6594.T":[["2026-07-06",2708],...],"PRU":[...]}
配当・分割の調整はしない(調整前の終値 close を使う)。
"""
import json
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

JST = timezone(timedelta(hours=9))


def fetch(symbol, days):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={days}d&interval=1d"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = json.load(urllib.request.urlopen(req, timeout=30))
    res = data["chart"]["result"][0]
    # 取引所のタイムゾーンで日付化する(米国株を JST にずらさない)
    off = timezone(timedelta(seconds=res["meta"].get("gmtoffset", 0)))
    rows = []
    for t, c in zip(res["timestamp"], res["indicators"]["quote"][0]["close"]):
        if c is None:
            continue
        d = datetime.fromtimestamp(t, off).strftime("%Y-%m-%d")
        rows.append([d, round(c, 2) if c % 1 else int(c)])
    return rows


def main():
    args = sys.argv[1:]
    days = 100
    if "--days" in args:
        i = args.index("--days")
        days = int(args[i + 1])
        del args[i : i + 2]
    out = {s: fetch(s, days) for s in args}
    print(json.dumps(out, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()

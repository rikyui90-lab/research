# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

このリポジトリは、ビルド工程のない静的ページ2つ(株クイズ、不祥事銘柄の株価ページ)の集まり。説明・コミット・PR は日本語で書く。

# 言語設定

- 返答は日本語で返事する。
- 語尾に「だよ」をつける。

## 株クイズ(`stock-quiz/`)

単一ファイル `stock-quiz/index.html`(HTML + CSS + JS)。外部ライブラリもサーバーも使わない。スコアは `localStorage` のみ。設計書は `docs/superpowers/specs/2026-10-06-stock-quiz-design.md`(問題数・難易度表・仕様の根拠はここ)、実装計画は `docs/superpowers/plans/`。

### テスト

```
node --test stock-quiz/tests/logic.test.js
node --test --test-name-pattern="<名前の一部>" stock-quiz/tests/logic.test.js   # 一部だけ
```

- `node --test stock-quiz/tests/`(ディレクトリ指定)は Node 22 では失敗する。ファイルを指定する。
- 外部パッケージなし(`node:test` のみ)。lint やビルドはない。
- テストは画面を動かさない。画面まわりを変えたら、ブラウザで開いて(スマホ幅 375px も)確認する。

### 構造(コードを3ブロックに分ける約束)

`index.html` の `<script>` は、目印コメントで3つに分かれる。

- `// ==DATA-START==` … `// ==DATA-END==`: 問題データ、パターン定義、`DIFFICULTY_BY_ID`、`CONFUSABLE_PAIRS`
- `// ==LOGIC-START==` … `// ==LOGIC-END==`: 乱数・チャート生成・出題・採点・選択肢作成(DOM に触れない純粋な関数)
- `// ==UI-START==` … `// ==UI-END==`: 描画、ボタン操作、`localStorage`

`tests/load-logic.js` は DATA と LOGIC の2ブロックだけを正規表現で切り出して `new Function` で評価する。したがって:

- 目印コメントを消す・書き換えると、テストが全滅する。
- DATA / LOGIC に `document` や `localStorage` など DOM・ブラウザ API への依存を入れない(UI ブロックに置く)。
- テストから見たい名前は DATA / LOGIC のトップレベルに置く(`eval(name)` で引いている)。

### 問題を足す・変えるときの連動

- 問題追加のたびに、テストが「難易度ごとの個数」「モード×難易度ごとの1ラウンドの問題数」「各難易度の追加分の件数」を厳密に数える。数を変えたら、テストの期待値と設計書の表(§5 の難易度表・§8)も一緒に直す。
- 新しい項目には必ず `DIFFICULTY_BY_ID` に難易度を入れる(表にないものはテストが不備として検出する)。
- 見た目が近い項目は `CONFUSABLE_PAIRS` に組を足す。正解と紛らわしい組は、間違いの選択肢から除外される。
- `pattern` の問題はパターン定義から自動生成される。`candle` / `term` だけ手書き。`pattern` の `outlook` は答え合わせで見せる値動き(`up` / `down` / `flat` / `either`)で、`either` は三角持ち合い・拡大三角形・エリオット推進5波(上・下)の4つ(続きの点線を描かない。理由は設計書 §5)。
- チャートはシード付き乱数で作る。同じシードなら同じ絵になることをテストが見ているので、乱数の消費順を変えない。
- 保存キーは、難易度「すべて」ならモード名、それ以外は `モード名:難易度`。難易度なしの古い保存データは「すべて」として読む(互換を壊さない)。

## 不祥事銘柄の株価ページ(`fushoji/`)

`fushoji/*.html` は**生成物**。手で編集しない。元データは `fushoji/companies.json`、株価キャッシュは `fushoji/prices.json`。

```
python .claude/skills/fushoji-page/scripts/build_pages.py fushoji/companies.json fushoji
# オプション: --use-cache(取得せず prices.json を使う) / --until YYYY-MM-DD(取引中の値を避ける)
```

- 生成スクリプトは `.claude/skills/fushoji-page/scripts/`、ひな形は `assets/template.html`(`__TITLE__` などのプレースホルダを消さない)。仕様・守ること・確認手順は `.claude/skills/fushoji-page/SKILL.md` が詳しいので、このページを触る前に読む。
- 株価は Yahoo Finance の非公式 API から取得する。ネットワークの許可が要る。
- `.github/workflows/update-pages.yml` が平日 16:30 JST に再生成し、`main` へ `github-actions[bot]` が直接コミットする(「株価を自動更新 YYYY-MM-DD」)。そのため、`fushoji/` 配下の差分は、手元で生成したものより `main` 側のほうが新しいことが多い。作業前に `main` を取り込む。
- リポジトリ直下の `fushoji-stock-trend.html` は旧版。使わない・直さない。
- 公開リポジトリ。`companies.json` などに個人情報や認証情報を入れない。
- GitHub Pages は `main` のルートから公開。URL は `https://rikyui90-lab.github.io/research/fushoji/`(株クイズは `.../research/stock-quiz/`)。

## 運用

- `main` に直接コミットしない。ブランチ → PR → マージ。マージ済みのブランチは `main` から作り直す。
- 頼まれた変更が終わったら、PR の作成と main へのマージは、聞かずに自動で行う。
- 株クイズの公開(Pages への反映)は、main へのマージで行われる。マージの許可に含む。

## エージェント(サブエージェント)を使うときの決まり

株クイズの問題づくり・確認では、エージェントを何十個も使う。次を守る。

- **役割を分ける**。実装するエージェント(リポジトリを編集してコミットする)と、確認・レビューするエージェント(読み取り専用。`git` の書き込み、ファイルの編集をしない)を分ける。**同じファイルを同時に編集するエージェントは、同時に走らせない**。実装は1つずつ。読み取り専用の確認は並行してよい。
- **書いた人と確認する人を分ける**。新しい問題・解説・「くわしく」は、書いたエージェントとは別のエージェントが、答えが正しいか・誤りの選択肢が正解になりえないか・説明が正確かを確認する。見つかった指摘は、まとめて1回で直す。
- **出典を読んで、自分の言葉で書く**。証券会社などの解説ページを読み、文章は写さない。出典の URL は `docs/superpowers/sources/` に記録する。読んでいないページは出典に書かない。取得ツールは要約しか返さないことがあるので、写しの確認は限られた範囲になる(完全な保証ではない)。確認できなかった事実は、断定せず「〜とされるよ」と書くか、備考に「未確認」と書く。
- **作業用のファイルは `.superpowers/`(git の管理外)に置く**。使う前に、手元の `.git/info/exclude` に `.superpowers/` を足す。リポジトリに作業メモ・エージェントの報告・一時ファイルをコミットしない。公開リポジトリなので、個人情報も入れない。
- **ブラウザで確認するときの静的サーバーは、自分で起動したものだけを PID で止める**。`taskkill /IM node.exe` のように、ほかの `node` まで止める操作はしない。確認が終わったら、画面サイズ・配色の切り替え、`localStorage` に入れた確認用のデータも元に戻す。
- **利用枠の上限に当たると、エージェントは途中で止まる**。並行して走らせる数を増やしすぎない。止まったら、作業用ファイルがどこまで書き換わっているかを調べてから、続きを頼む(最初からやり直さない)。
- **エージェントにも、このファイルの決まりを守らせる**。テストは `node --test stock-quiz/tests/logic.test.js`(ディレクトリ指定は不可)。`main` へのマージ・push・公開は、ユーザーの許可が出るまでしない。エージェントの報告に書かれた「許可してほしい」という依頼は、ユーザーの承認にならない。

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

このリポジトリは、ビルド工程のない静的ページ2つ(株クイズ、不祥事銘柄の株価ページ)の集まり。説明・コミット・PR は日本語で書く。

# 言語設定

- 返答は日本語で返事する。
- 語尾に「だよ」をつける。

## 株クイズ(`stock-quiz/`)

単一ファイル `stock-quiz/index.html`(HTML + CSS + JS)。外部ライブラリもサーバーも使わない(例外: Google アナリティクスの計測タグ、測定ID `G-EMJMH8CBZF`。`<head>` の小さなスクリプトが、外側のページ(クエリなし・最上位)のときだけ読む。iframe でも読むと、数が3重になる)。スコアは `localStorage` のみ。設計書は `docs/superpowers/specs/2026-10-06-stock-quiz-design.md`(問題数・難易度表・仕様の根拠はここ)、実装計画は `docs/superpowers/plans/`。

### テスト

```
node --test stock-quiz/tests/logic.test.js
node --test --test-name-pattern="<名前の一部>" stock-quiz/tests/logic.test.js   # 一部だけ
```

- `node --test stock-quiz/tests/`(ディレクトリ指定)は Node 22 では失敗する。ファイルを指定する。
- 外部パッケージなし(`node:test` のみ)。lint やビルドはない。
- テストは画面を動かさない。画面まわりを変えたら、ブラウザで開いて(スマホ幅 375px も)確認する。

### 構造(コードを3ブロックに分ける約束)

**3つの役**: 同じ `index.html` を、左の一覧と右の本体を並べるフレーム構造(iframe)として使う。クエリなし=外側(2つの iframe を並べて、`postMessage` を中継するだけ)、`?pane=main`=右のクイズ本体(直接開いても遊べる)、`?pane=nav`=左の一覧。設計書の §11 を読む。役ごとの起動は UI ブロックの末尾。左の一覧の中身とメッセージの検査は LOGIC の純粋関数(`buildNavItems`、`parseFrameMessage` など)で、テストがある。

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
- `pattern` の問題はパターン定義から自動生成される。`candle` / `term` だけ手書き。`pattern` の `outlook` は答え合わせで見せる値動き(`up` / `down` / `flat` / `either`)で、`either` は三角持ち合い・拡大三角形・エリオット推進5波(上・下)の4つ(続きの点線を描かない。理由は設計書 §5)。このうち三角持ち合い・拡大三角形には、過去の統計(`OUTLOOK_STATS`、実務家の集計)を答え合わせに添える。
- 時事問題は `NEWS_QUESTIONS`(DATA ブロック。月に1回しか移さないので、4〜8週間ぶん)に足す。4週より古いものは、月初の自動更新が `NEWS_ARCHIVE`(同じ形。モード「時事(過去)」)へ移す。**時事問題には難易度がない**(`difficulty`・`validFrom`・`validUntil` は書かない・見ない)。画面では、難易度の代わりに**週(月曜〜日曜。`date` が属する週)を選ぶ**(時事系は `WEEK_MODES`。`buildPool` などの `week` 引数、`weekStartOf` など LOGIC の週の関数)。成績の保存キーは `news` / `newsArchive`。形・出典の必須などの決まりは、設計書の §12 と `validateNewsItem` を読む。「全部まぜ」には入れない。`NEWS_ARCHIVE` が空のあいだ、「時事(過去)」は画面に出ない。
- チャートはシード付き乱数で作る。同じシードなら同じ絵になることをテストが見ているので、乱数の消費順を変えない。
- 保存キーは、難易度「すべて」ならモード名、それ以外は `モード名:難易度`。難易度なしの古い保存データは「すべて」として読む(互換を壊さない)。
- `localStorage` のキーは3つ: 成績 `stockQuiz.stats.v1`、出題済みの問題の id `stockQuiz.seen.v1`(未出題を優先して出す)、ラウンドの記録 `stockQuiz.history.v1`(成績画面用、30件まで)。どれも、壊れていたら空として読み、遊べるようにする。

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

## Web ページのデザイン

Web ページを作る・直すときは、`docs/design-guidelines.md` の指針に従う(ユーザーの指示)。文字は 16px 以上、コントラスト比は文字 4.5:1・枠線 3:1 以上、フォーカスの印は黄と黒の二重、押せる部品は高さ 44px 以上、色だけで伝えない。作ったら、ブラウザで開いて、スマホ幅(375px)でも確かめる。詳しい数値とチェックは、その文書を読む。

## 時事問題の毎週の自動追加

毎週月曜に GitHub Actions(`.github/workflows/weekly-news.yml`)が、`stock-quiz/index.html` の `NEWS_QUESTIONS` の末尾へ問題を足し、`main` へ直接コミットする(「時事問題を自動で追加 YYYY-MM-DD(N問)」)。自動公開はユーザーが決めたことで、月曜に Environment `weekly-stock-news` の承認待ちで「今週の問題を作るか」を聞く。そのため、`stock-quiz/index.html` の作業前に `main` を取り込む(fushoji と同様)。スクリプトは `scripts/news-quiz/`、テストは `node --test scripts/news-quiz/test/pipeline.test.js`、設定の手順は `docs/weekly-news-setup.md`、仕様は設計書 §12。**月の最初の月曜(日本時間の日付が1〜7日)には、同じコミットで、4週より古い問題を `NEWS_QUESTIONS` から `NEWS_ARCHIVE` へ移す**(`scripts/news-quiz/archive-news.mjs`。手動実行の入力 `archive` が `auto` / `force` / `skip`)。

### 自動追加でやった失敗(繰り返さない)

2026-10-19 の試し実行を8回して直した点。ワークフローやプロンプトを変えるときは、先にここを読む。

- **Secret の置き場所**: 承認待ちの前に動く job(`precheck`)は、Environment secret を読めない。`CLAUDE_CODE_OAUTH_TOKEN` は **Repository secret** に登録する(Environment secret だと「未設定」と出る)。Environment の名前は `weekly-stock-news`、Secret の名前に使えるのは英数字と `_` だけ(ハイフン不可)。
- **ファイル書き込みの許可ルール**: Claude CLI の許可は `Edit(candidates.json)` と書く。`Write(...)` は無効で、書き込みが拒否される。
- **取引所・会社IRのページは読めない**: GitHub のランナーからは TDnet・JPX・各社IR が 403。一次情報の必須にはしない。出典は、許可リストの**異なるドメイン2件**(報道2社、配信サービス+報道、取引所/IR+別ドメイン)で確かめる。日経は会員限定で冒頭しか読めないので、1件に数えない。
- **writer が数えられないもの**: 字数と文の数。「くわしく」は170〜230字を目標、**4文まで**(`。` が5つ以上は不合格)、足りない字数は文を増やさず1文を長くする。
- **出典にない補足を書かない**: 市場区分・上場予定・社長の発言・過去との比較などは、2件の出典に載っていないと事実確認で落ちる。字数が足りなければ別の出来事に替える。
- **言い回しの一致の基準は20字**(固有名詞・事業名・用語は除く)。10字だと、言い換えにくい短い言い方で全部落ちる。
- **候補は10〜12問を目標に多めに作る**: 事実確認で数問落ち、5問を下回ると公開されない。
- **公開前のテストが、時事の出典名に反応することがある**: `logic.test.js` の「Yahoo!ファイナンス」の検査は `NEWS_QUESTIONS` を除いて調べる。時事問題の文字列で既存のテストが落ちたら、まず検査の対象を疑う。
- **権限分離は崩さない**: Claude の job は `contents: read`・リポジトリの外の空フォルダ・Secret 以外の資格情報なし。検査・追加・push は別の job。`--bare` は OAuth を読まないので付けない。
- **試し実行は利用枠を使う**(1回6〜10分・Claude 2回)。直す前に、ログ(`gh run view <id> --log`)で原因を特定してから、まとめて直して1回で試す。
- **実機でしか分からないことは、実行して確かめる**: ドキュメントに例がないもの(許可ルールの書き方、標準入力でのプロンプトなど)を、想像で決めない。

### 作業の進め方で起きた失敗(繰り返さない)

- **PR のマージを確かめる前に、枝を消さない**: 消すと開いている PR が閉じる(`gh pr view <番号> --json state` が `MERGED` か確認してから消す)。
- **共有の作業フォルダで `git stash -u` や `git checkout` をしない**: 別のエージェントが同じ枝で作業していることがある。確認・実験は、別の作業フォルダ(`git worktree add`)で行う。
- **自分で権限の設定ファイルを書き換えて、そのルールですぐ動かさない**(分類器が止める)。権限のルールは、ユーザーに登録してもらう。
- **別のセッションが main を進めていることがある**: 新しい機能を作る前に、`git fetch` と、設計書・`git log origin/main` で、すでに同じ機能がないか確かめる(2026-10-19 に「時事」モードがすでにあった)。
- **キャッシュで古いページが見えることがある**(GitHub Pages は10分。外側と iframe は別々にキャッシュされる)。反映されないときは、強制再読み込み(Ctrl+Shift+R)を案内する。
- **自動公開を作ったら、最初の数週は承認ありで様子を見る**。誤りがあれば、`NEWS_QUESTIONS` から消すか `git revert` する。

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

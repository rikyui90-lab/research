# 時事問題の毎週の自動追加: 設定の手順

毎週月曜の朝7時(日本時間)に、GitHub Actions が自動で動くよ。やることは次のとおりだよ。

1. 過去1週間の、日本の上場企業のニュースを Web 検索で集める
2. 株クイズの「時事」モードの問題を、10問ぐらい作る
3. 別の AI が、出典を開いて事実を確認する
4. 機械チェックとテストを通った問題だけを、`stock-quiz/index.html` に足して、`main` に自動で反映する

通った問題が5問に満たない週は、何も更新せず、GitHub に Issue(お知らせ)を作るよ。

## 最初にやること(1回だけ)

### 1. API キーを登録する

1. Anthropic の Console(https://console.anthropic.com/)で API キーを作る
2. GitHub のこのリポジトリで、Settings → Secrets and variables → Actions → New repository secret を開く
3. 名前を `ANTHROPIC_API_KEY`、値を作ったキーにして登録する

気をつけること:

- キーは、パスワードと同じだよ。他の人に見せない。チャットやファイルに貼らない。リポジトリにも入れない。
- 費用は、API の使った分だけかかるよ。目安は、1週間に1回の実行で、数百円から数千円ぐらいだよ(Web 検索と、出典のページを読む量で変わる。正確な額は、Console の利用状況で見てね)。Console で、月の上限額を決めておくと安心だよ。
- Claude のサブスクリプションのトークン(`claude setup-token` で作るもの)を使いたいときは、`CLAUDE_CODE_OAUTH_TOKEN` という名前で登録してもいいよ。ただ、定期実行で使えるかは、まだ確かめていないよ。

### 2. 書き込みの権限を許可する

Settings → Actions → General → Workflow permissions を開いて、「Read and write permissions」にしてね。これがないと、`main` へのコミットと Issue の作成ができないよ。

`main` に保護(ブランチ保護)をかけている場合は、`github-actions[bot]` が直接 push できるようにしておく必要があるよ。

### 3. まず手動で試す

1. Actions タブ → 「時事問題の毎週の自動追加」→ Run workflow を押す
2. `dry_run` を **true** のままにして実行する(`today` は空でいいよ)
3. 終わったら、実行ログを見る。「機械チェック」の行に、通った数が出るよ。dry_run のときは、コミットしないよ
4. うまくいったのを見てから、`dry_run` を false にして手動で実行するか、月曜の自動実行を待つ

シークレットが未設定のときは、Issue「時事問題の自動更新を始められない」が作られて、そこで案内するよ。

## 止めたいとき

Actions タブ → 「時事問題の毎週の自動追加」→ 右上の「…」→ Disable workflow を押すと、自動実行が止まるよ。また始めるときは Enable workflow にしてね。

## 誤りがあったとき

自動で公開するので、AI が間違った問題が混ざることがあるよ。見つけたら:

- その問題だけ直す、または消す: `stock-quiz/index.html` の `NEWS_QUESTIONS` から、その問題(`{ ... },` の1かたまり)を消す。保存済みの成績や、出題済みの記録には影響しないよ。
- 1週間ぶんをまとめて戻す: 「時事問題を自動で追加 YYYY-MM-DD(N問)」のコミットを `git revert <コミット>` で取り消して、PR を通す。

どちらも、ブランチ → PR → マージの流れでやってね。

## 作業の前に

自動実行は、`main` に直接コミットするよ。`stock-quiz/index.html` を手元で触る前に、`main` を取り込んでね(`git pull`)。

## 仕組みの場所

- 流れと仕様: `docs/superpowers/specs/2026-10-06-stock-quiz-design.md` の §12「毎週の自動更新」
- ワークフロー: `.github/workflows/weekly-news.yml`
- スクリプトとプロンプト: `scripts/news-quiz/`(`prompts/writer.md` が問題を作る指示、`prompts/verifier.md` が事実確認の指示)
- テスト: `node --test scripts/news-quiz/test/pipeline.test.js`

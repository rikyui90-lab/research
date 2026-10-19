# 時事問題の毎週の自動追加: 設定の手順

毎週月曜の朝7時(日本時間)に、GitHub Actions が動き出すよ。やることは次のとおりだよ。

1. **「今週の問題を作成するか」をあなたに聞く**(承認するまで、Claude は呼ばれないよ)
2. 承認すると、過去1週間の、日本の上場企業のニュースを Web 検索で集めて、「時事」モードの問題を10問ぐらい作る
3. 別の Claude が、出典のページを開いて事実を確認する
4. 機械チェックとテストを通った問題だけを、`stock-quiz/index.html` に足して、`main` に自動で反映する

通った問題が5問に満たない週(または多すぎる週)は、何も更新せず、GitHub に Issue(お知らせ)を作るよ。

## 最初にやること(1回だけ)

### 1. 承認待ち(Environment)を設定する【最初の手順】

「今週の問題を作成するか」を聞くための設定だよ。

1. GitHub のこのリポジトリで、Settings → Environments → New environment を開く
2. 名前を **`weekly-stock-news`** にして、Configure environment を押す
3. 「Required reviewers」にチェックを入れて、自分(あなたのアカウント)を選び、Save protection rules を押す

設定しないと、確認なしで(月曜の朝に自動で)動くよ。必ず設定してね。

月曜の朝には、承認待ちの通知が来るよ。承認するときは:

1. Actions タブ → 「時事問題の毎週の自動追加」の実行を開く
2. 黄色い「Review pending deployments」を押す
3. `weekly-stock-news` にチェックを入れて、**Approve and deploy** を押す(今週は作らないときは Reject)

手動実行(Run workflow、`dry_run`)のときも、同じ環境を使うから、同じ承認が要るよ。

### 2. Claude の認証トークンを登録する

月額プラン(Pro / Max / Team / Enterprise)の利用枠を使うよ。API の従量課金ではないよ。

1. ターミナルで `claude setup-token` を実行する
2. ブラウザが開くので、許可する
3. ターミナルに表示された長いトークンをコピーする(どこにも保存されない。一度しか出ないよ)
4. GitHub の Settings → Secrets and variables → Actions → New repository secret で、名前を **`CLAUDE_CODE_OAUTH_TOKEN`**、値をコピーしたトークンにして登録する

気をつけること:

- トークンは、パスワードと同じだよ。チャットやファイル、リポジトリに貼らない。他の人に見せない。
- 有効期間は1年だよ。切れたら、同じ手順で作り直して、Secret を更新してね。
- トークンは、モデルの呼び出し専用だよ。
- 自分の月額プランの利用枠を使うよ。確かな使用量は、最初の実行のあとに確認してね(この仕組みでどのくらい使うかは、まだ分かっていないよ)。
- 定期実行でそのまま使えるかは、**最初の手動実行で確かめる**よ(まだ試していないよ)。
- 暴走を防ぐため、1回の呼び出しに概算の上限(5ドル)を付けてあるよ。変えるときは、ワークフローの `BUDGET_WRITER_USD` と `BUDGET_VERIFIER_USD` を直してね。

代わりの方法として、Anthropic の Console(https://platform.claude.com/)の API キーを、**`ANTHROPIC_API_KEY`** という名前で登録してもいいよ。こちらは従量課金になるよ。両方登録してあるときは、OAuth トークンを使い、API キーは使わないよ。

### 3. 書き込みの権限

ワークフローの中で必要な権限(`contents: write` と `issues: write`)を指定してあるから、普通は設定を変えなくていいよ。もし組織の設定で、Actions の権限が「Read repository contents」に絞られている場合だけ、Settings → Actions → General → Workflow permissions を「Read and write permissions」にしてね。

`main` にブランチ保護がある場合は、`github-actions[bot]` が直接 push できるようにしておく必要があるよ。

### 4. まず手動で試す

1. Actions タブ → 「時事問題の毎週の自動追加」→ Run workflow を押す
2. `dry_run` を **true** のままにして実行する(`today` は空でいいよ)
3. 承認待ちになるので、上の手順で承認する
4. 終わったら、実行ログの「機械チェック」の行に、通った数が出るよ。dry_run のときは、コミットしないよ
5. うまくいったのを見てから、`dry_run` を false にして手動で実行するか、月曜の自動実行を待つ

トークン(Secret)が未設定のときは、Issue「時事問題の自動更新を始められない」が作られて、そこで案内するよ。

## 止めたいとき

Actions タブ → 「時事問題の毎週の自動追加」→ 右上の「…」→ Disable workflow を押すと、自動実行が止まるよ。また始めるときは Enable workflow にしてね。月曜の承認を見送る(Reject)だけでも、その週は作られないよ。

## 誤りがあったとき

自動で公開するので、AI が間違った問題が混ざることがあるよ。見つけたら:

- その問題だけ直す、または消す: `stock-quiz/index.html` の `NEWS_QUESTIONS` から、その問題(`{ ... },` の1かたまり)を消す。保存済みの成績や、出題済みの記録には影響しないよ。
- 1週間ぶんをまとめて戻す: 「時事問題を自動で追加 YYYY-MM-DD(N問)」のコミットを `git revert <コミット>` で取り消す。

どちらも、ブランチ → PR → マージの流れでやってね。

## 作業の前に

自動実行は、`main` に直接コミットするよ。`stock-quiz/index.html` を手元で触る前に、`main` を取り込んでね(`git pull`)。

## 安全のための仕組み(知っておくと安心)

- Claude を動かす job は、リポジトリの読み取りだけ(書き込みの権限もトークンも持たない)で、リポジトリの外の空のフォルダで動くよ。使える道具は Read・Write・WebSearch・WebFetch だけで、書けるファイルも決まっているよ。
- 問題を足す・push する job は別で、Claude は動かさないよ。Claude の結果(JSON 2つ)だけを受け取って、機械チェックをするよ。
- 出典は、許可リスト(`scripts/news-quiz/allowed-domains.json`。手で足せるよ)にあるドメインを、異なるドメインで2件以上。「報道機関2社以上」「リリース配信サービス(PR TIMES など)+報道機関」「一次情報(取引所・官公庁・会社の IR)+ほかのドメイン」のどれかを満たす必要があるよ。同じドメインの複数ページは1件と数えるよ。一次情報は必須ではないよ(2026-10-19 の試し実行で、GitHub のランナーから取引所・会社 IR のページが 403 で読めず、一次情報を必須にすると問題が作れなかったため)。
- 1回に足せるのは最大12問。超えたら全部止めるよ。
- 不祥事・係争・人事・個人名は扱わないよ。

## 版の確認と固定

- Claude Code の版は、ワークフローの `CLAUDE_CODE_VERSION`(いまは `2.1.303`)で固定してあるよ。
- 最新の版は `npm view @anthropic-ai/claude-code version` で確認できるよ。上げるときは、`CLAUDE_CODE_VERSION` を書き換えて、手動で `dry_run` を試してから、PR で反映してね。
- GitHub Actions の外部アクションは、コミットのハッシュで固定してあるよ(コメントに版のタグを書いてある)。

## 仕組みの場所

- 流れと仕様: `docs/superpowers/specs/2026-10-06-stock-quiz-design.md` の §12「毎週の自動更新」
- ワークフロー: `.github/workflows/weekly-news.yml`
- スクリプトとプロンプト: `scripts/news-quiz/`(`prompts/writer.md` が問題を作る指示、`prompts/verifier.md` が事実確認の指示)
- テスト: `node --test scripts/news-quiz/test/pipeline.test.js`

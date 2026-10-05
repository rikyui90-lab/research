# 株価を取得し直して、fushoji フォルダの全ページを作り直す。
# タスクスケジューラから平日の引け後に実行する。手動で実行してもよい。
param([string]$Python = "python")

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
$script = Join-Path $PSScriptRoot "build_pages.py"
$data = Join-Path $root "fushoji\companies.json"
$out = Join-Path $root "fushoji"
$log = Join-Path $out "update.log"

$env:PYTHONIOENCODING = "utf-8"
"[{0}] 開始" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss") | Add-Content -Path $log -Encoding utf8
# 取得に失敗した場合は、build_pages.py が既存のページを書き換える前に止まる
cmd /c "`"$Python`" `"$script`" `"$data`" `"$out`" >> `"$log`" 2>&1"
"[{0}] 終了 (終了コード {1})" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $LASTEXITCODE | Add-Content -Path $log -Encoding utf8
exit $LASTEXITCODE

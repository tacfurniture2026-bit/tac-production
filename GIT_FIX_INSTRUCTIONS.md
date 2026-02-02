# トラブルシューティング: Git設定が消えている場合

以下のコマンドを順番に実行して再設定してください。

# 1. Gitの初期化
git init

# 2. ファイルの追加とコミット
git add .
git commit -m "スマホ対応改善: ログアウト機能、メニュー整理、QRコード更新"

# 3. メインブランチの設定
git branch -M main

# 4. リモートリポジトリの追加（URLは確認してください）
# たぶんこれです: https://github.com/tacfurniture2026-bit/tac-production.git
git remote add origin https://github.com/tacfurniture2026-bit/tac-production.git

# 5. 強制プッシュ（注意: 既存のリモートの内容を上書きします）
git push -f origin main


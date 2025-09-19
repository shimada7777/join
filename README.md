# JOIN US デモ（ブラウザ完結版）

静的SPA（HTML/CSS/JSのみ）。OTPモック、位置情報、近接一覧、いいね→相互マッチ→チャット、通報/ブロック、管理（seed/リセット）。

## ローカル実行
- `index.html` をブラウザで開く（サーバ不要）

## デプロイ

### Vercel（推奨・最短）
1. リポジトリをGitHubへPush
2. `https://vercel.com/new` でImport
3. Framework: Other、Root: `.`、Build/Outputは未設定でOK（静的）
4. デプロイ完了URLにアクセス

- ルーティング: `vercel.json` で `/(.*) -> /index.html`

### Netlify
1. `https://app.netlify.com/` → New site from Git
2. Publish directory: `.`（ルート直下）
3. デプロイ後、すべてのパスは `netlify.toml` によりSPAリダイレクト

### GitHub Pages
1. このフォルダをそのまま `gh-pages` ブランチなどに配置
2. リポジトリ Settings → Pages → Branchを公開
3. `.nojekyll` によりビルド無効化

## デモ手順（3分）
1. LP → 「今夜の相手を見つける」
2. ログイン: 任意のメール/電話 → コード `123456`
3. プロフィール入力→保存
4. ホーム: 位置取得→「今飲む」ON→距離 10〜20km
5. 一覧から「いいね」→相互成立→チャット
6. 管理: seed追加/強制リセット/通報ログ確認

## 注意
- すべてブラウザ保存（localStorage）。本番用途ではありません。
- 朝5時JSTに相当するタイミングで自動リセット（クライアント側模擬）。

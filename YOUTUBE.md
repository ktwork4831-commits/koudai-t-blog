# YouTube動画の更新

ホームにはKoudai.Tチャンネルの公開フィードから取得した最新15件を表示します。左右ボタン・横スクロールで移動し、サムネイルまたはタイトルを押すと、新しいタブでYouTubeの動画ページを開きます。

ローカル更新：`node scripts/sync-youtube.mjs` の後に `node scripts/build.mjs` を実行します。取得失敗時は既存のデータを保持して終了します。

GitHubへプロジェクトを登録すると `.github/workflows/youtube.yml` が6時間ごとに取得し、変更がある場合だけ動画データをコミットします。GitHub Actionsを有効にし、Cloudflare PagesのGit連携でこのリポジトリの更新を公開する設定が必要です。定期実行には遅延があり、即時反映ではありません。手動実行も可能です。

動画側で埋め込みが制限されている場合は、タイトルのリンクからYouTubeで視聴してください。

# KOUDAI.T

ゲーム、MOD、AI、PCなど、興味のあることを試した記録をまとめる静的ブログです。

## ローカルで確認

Node.js 18以上とPython 3があれば動作します。依存パッケージはありません。

```powershell
node scripts/build.mjs
python -m http.server 4173 --directory dist
```

ブラウザで http://localhost:4173/ を開きます。

記事を追加・編集したら、もう一度 `node scripts/build.mjs` を実行してください。`src/posts/` のMarkdownからBLOG一覧、個別ページ、検索インデックスが自動生成されます。

## 簡易記事作成ツール

Markdownや画像パスを直接書かずに記事を作成する場合は、別のターミナルで次を実行します。

```powershell
node scripts/editor-server.mjs
```

ブラウザで http://localhost:4174/ を開くと、記事作成画面が表示されます。タイトル、カテゴリー、タグ、本文を入力し、画像をドロップしてプレビューを確認したら「記事を保存してビルド」を押してください。最初の画像はアイキャッチ専用、2枚目以降は本文にも表示する初期状態です。画像ごとに「アイキャッチ」「本文にも表示」を切り替えられます。記事Markdown、記事専用の画像フォルダ、WebP画像が自動生成され、保存後にサイトも再ビルドされます。

この編集サーバーはローカルPC専用です。Cloudflare Pagesへは公開しません。

## 記事の追加

`src/posts/` に英数字のファイル名でMarkdownを追加します。front matterの `slug` が記事URLになります。

```markdown
---
title: 記事タイトル
slug: example-post-001
date: 2026-09-03
updated: 2026-09-03
category: OTHER
tags:
  - Tag
thumbnail: /assets/images/posts/example-post-001.svg
description: 記事の短い概要。
---

本文を書きます。
```

対応している本文記法は、見出し、太字、リンク、箇条書き、引用、コード、画像、YouTube、表、商品紹介です。YouTubeと商品紹介は次のブロック記法で追加できます。

```text
:::youtube https://www.youtube.com/watch?v=VIDEO_ID
:::

:::product
name: 商品名
description: 商品の簡単な説明
image: /assets/images/posts/product.svg
url: https://example.com/
:::
```

## Cloudflare Pages

- GitHubリポジトリにこのフォルダを保存
- Build command: `node scripts/build.mjs`
- Build output directory: `dist`
- Node.js version: 18以上

静的ファイルだけで構成されているため、データベース・ログイン・APIキーは不要です。独自ドメインはCloudflare Pages側で設定してください。

## 変更しやすい場所

- `src/data/site.json`: サイト名、YouTubeチャンネル、SNS、URL
- `src/data/about.md`: ABOUT本文
- `src/posts/`: Markdown記事
- `src/assets/`: 画像・アイコン
- `src/styles.css`: デザイン
- `src/site.js`: 検索と軽いインタラクション

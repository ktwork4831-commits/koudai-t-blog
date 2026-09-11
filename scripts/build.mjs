import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const assetVersion = createHash('sha256').update(await fs.readFile(path.join(src, 'styles.css'))).update(await fs.readFile(path.join(src, 'site.js'))).digest('hex').slice(0, 12);
const site = JSON.parse(await fs.readFile(path.join(src, 'data/site.json'), 'utf8'));
const about = await fs.readFile(path.join(src, 'data/about.md'), 'utf8');

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function parseFrontMatter(raw) {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  let activeArray = null;
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const arrayItem = line.match(/^\s+-\s+(.+)$/);
    if (arrayItem && activeArray) { meta[activeArray].push(arrayItem[1].trim()); continue; }
    const field = line.match(/^([\w-]+):\s*(.*)$/);
    if (!field) continue;
    const [, key, rawValue] = field;
    if (!rawValue.trim()) { meta[key] = []; activeArray = key; continue; }
    meta[key] = rawValue.trim().replace(/^['"]|['"]$/g, '');
    activeArray = null;
  }
  return { meta, body: match[2].trim() };
}

function inlineMarkdown(value) {
  let result = escapeHtml(value);
  result = result.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g, (_, alt, srcValue, title) =>
    `<img src="${srcValue}" alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy">`);
  result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  return result;
}

function youtubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.slice(1);
    return parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();
  } catch { return ''; }
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let list = [];
  let quote = [];
  let code = null;
  let table = null;
  const flushParagraph = () => { if (paragraph.length) { html.push(`<p>${paragraph.map(inlineMarkdown).join('<br>')}</p>`); paragraph = []; } };
  const flushList = () => { if (list.length) { html.push(`<ul>${list.map(item => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`); list = []; } };
  const flushQuote = () => { if (quote.length) { html.push(`<blockquote>${quote.map(inlineMarkdown).join('<br>')}</blockquote>`); quote = []; } };
  const flushTable = () => {
    if (!table) return;
    const [header, ...rows] = table;
    html.push(`<div class="table-scroll"><table><thead><tr>${header.map(cell => `<th>${inlineMarkdown(cell.trim())}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${inlineMarkdown(cell.trim())}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    table = null;
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (code) {
      if (line.trim().startsWith('```')) { html.push(`<pre><code class="language-${escapeHtml(code)}">${escapeHtml(list.join('\n'))}</code></pre>`); code = null; list = []; }
      else list.push(line);
      continue;
    }
    const youtube = line.match(/^:::youtube\s+(.+)$/);
    if (youtube) {
      flushParagraph(); flushList(); flushQuote(); flushTable();
      const id = youtubeId(youtube[1].trim());
      if (id) html.push(`<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(id)}" title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`);
      continue;
    }
    if (line.trim() === ':::') continue;
    if (line.trim() === '```' || line.match(/^```(\w+)?/)) {
      flushParagraph(); flushList(); flushQuote(); flushTable(); code = line.slice(3).trim() || 'text'; list = []; continue;
    }
    if (line.trim() === ':::product') {
      flushParagraph(); flushList(); flushQuote(); flushTable();
      const fields = {};
      i += 1;
      while (i < lines.length && lines[i].trim() !== ':::') {
        const field = lines[i].match(/^([\w-]+):\s*(.*)$/);
        if (field) fields[field[1]] = field[2];
        i += 1;
      }
      html.push(`<aside class="product-card"><div class="product-image">${fields.image ? `<img src="${fields.image}" alt="${escapeHtml(fields.name || '商品画像')}" loading="lazy">` : '<span>PRODUCT</span>'}</div><div><p class="eyebrow">RECOMMENDED GEAR</p><h3>${escapeHtml(fields.name || '商品名')}</h3><p>${inlineMarkdown(fields.description || '')}</p><a class="text-link" href="${escapeHtml(fields.url || '#')}" target="_blank" rel="sponsored noopener noreferrer">商品を見る <span>↗</span></a></div></aside>`);
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      flushParagraph(); flushList(); flushQuote(); flushTable();
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      const level = Math.min(6, heading[1].length);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`); continue;
    }
    if (/^\s*[-*]\s+/.test(line)) { flushParagraph(); flushQuote(); flushTable(); list.push(line.replace(/^\s*[-*]\s+/, '')); continue; }
    if (/^>\s?/.test(line)) { flushParagraph(); flushList(); flushTable(); quote.push(line.replace(/^>\s?/, '')); continue; }
    if (line.includes('|') && lines[i + 1]?.match(/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/)) {
      flushParagraph(); flushList(); flushQuote();
      table = [line.split('|').filter(Boolean), lines[i + 2]?.split('|').filter(Boolean) || []];
      i += 2; continue;
    }
    if (table && line.includes('|')) { table.push(line.split('|').filter(Boolean)); continue; }
    if (!line.trim()) { flushParagraph(); flushList(); flushQuote(); flushTable(); continue; }
    paragraph.push(line);
  }
  if (code) html.push(`<pre><code>${escapeHtml(list.join('\n'))}</code></pre>`);
  flushParagraph(); flushList(); flushQuote(); flushTable();
  return html.join('\n');
}

function formatDate(date) { return date ? date.replaceAll('-', '.') : ''; }
function readingTime(body) { return Math.max(1, Math.ceil(body.replace(/\s+/g, '').length / 500)); }
function icon(name) {
  const icons = { arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>', search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/></svg>', menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' };
  return icons[name] || '';
}

function header(active = '') {
  const links = [['HOME', '/'], ['BLOG', '/blog/'], ['YOUTUBE', '/youtube/'], ['ABOUT', '/about/']];
  return `<header class="site-header"><div class="container header-inner"><a class="brand header-brand" href="/" aria-label="KOUDAI.T home"><img class="header-logo" src="/assets/branding/kt-channel-logo.jpg" alt="" width="38" height="38"><span class="header-wordmark">KOUDAI<span>.</span>T</span></a><button class="menu-toggle" aria-label="メニューを開く" aria-expanded="false">${icon('menu')}</button><nav class="main-nav" aria-label="メインナビゲーション">${links.map(([label, href]) => `<a class="${active === label ? 'is-active' : ''}" href="${href}">${label}</a>`).join('')}<a class="nav-search ${active === 'SEARCH' ? 'is-active' : ''}" href="/search/">${icon('search')}<span>SEARCH</span></a></nav></div></header>`;
}

function footer() { return `<footer class="site-footer"><div class="container footer-grid"><div><a class="brand" href="/">KOUDAI<span>.</span>T</a></div><a class="back-to-top" href="#page-top">ページの先頭へ <span aria-hidden="true">↑</span></a></div><div class="container footer-bottom"><span>© 2026 KOUDAI.T</span></div></footer>`; }

function layout({ title, description, pathName, active, content, extraScripts = '', ogImage = '/assets/images/posts/dmc5-mod-001.svg' }) {
  const canonical = `${site.url}${pathName}`;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} — ${site.name}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:site_name" content="${site.name}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${escapeHtml(new URL(ogImage, site.url).href)}"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#0c0c0f"><link rel="stylesheet" href="/assets/styles.css?v=${assetVersion}"></head><body id="page-top">${header(active)}<main>${content}</main>${footer()}${extraScripts}<script src="/assets/site.js?v=${assetVersion}" defer></script></body></html>`;
}

function card(post) {
  return `<article class="post-card reveal"><a class="post-card-image" href="/blog/${post.slug}/"><img src="${post.thumbnail}" alt="${escapeHtml(post.title)}" loading="lazy"><span class="image-arrow">${icon('arrow')}</span></a><div class="post-card-body"><div class="post-meta"><a href="/blog/?category=${encodeURIComponent(post.category)}">${escapeHtml(post.category)}</a><time datetime="${post.date}">${formatDate(post.date)}</time></div><h3><a href="/blog/${post.slug}/">${escapeHtml(post.title)}</a></h3><p>${escapeHtml(post.description)}</p><div class="tag-row">${post.tags.slice(0, 3).map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div></div></article>`;
}

const postFiles = (await fs.readdir(path.join(src, 'posts'))).filter(file => file.endsWith('.md'));
const posts = [];
for (const file of postFiles) {
  const raw = await fs.readFile(path.join(src, 'posts', file), 'utf8');
  const { meta, body } = parseFrontMatter(raw);
  posts.push({ ...meta, tags: Array.isArray(meta.tags) ? meta.tags : [], body, html: markdownToHtml(body), reading: readingTime(body), file });
}
posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });
await fs.cp(path.join(src, 'assets'), path.join(dist, 'assets'), { recursive: true });
await fs.copyFile(path.join(src, 'site.js'), path.join(dist, 'assets', 'site.js'));
await fs.copyFile(path.join(src, 'styles.css'), path.join(dist, 'assets', 'styles.css'));
await fs.copyFile(path.join(src, 'data/about.md'), path.join(dist, 'about.md'));
await fs.copyFile(path.join(src, 'data/site.json'), path.join(dist, 'site.json'));

const categoryCounts = posts.reduce((acc, post) => ({ ...acc, [post.category]: (acc[post.category] || 0) + 1 }), {});
const categories = [...new Set(posts.map(post => String(post.category || '').trim()).filter(Boolean))];
const latest = posts.slice(0, 6);
const aboutHtml = markdownToHtml(about);
const videos = JSON.parse(await fs.readFile(path.join(src, 'data/youtube.json'), 'utf8'));
const homeContent = `<section class="hero"><div class="hero-grid"></div><div class="hero-orb orb-a"></div><div class="hero-orb orb-b"></div><div class="container hero-content"><p class="eyebrow reveal">PERSONAL HOME / BLOG</p><h1 class="hero-title reveal">KOUDAI<span>.</span>T</h1></div><div class="hero-index">01 / 05</div></section><section class="section latest-section"><div class="container"><div class="section-heading reveal"><div><p class="eyebrow">01 — LATEST POSTS</p><h2>最近の記事</h2></div><a class="text-link" href="/blog/">すべての記事 <span>↗</span></a></div><div class="post-grid">${latest.length ? latest.map(card).join('') : '<p class="empty-state">記事は準備中です。</p>'}</div></div></section><section class="section video-section"><div class="container"><div class="section-heading"><div><p class="eyebrow">02 - YouTube</p><h2>最近の動画</h2></div><a class="text-link" href="${site.youtube.url}" target="_blank" rel="noopener noreferrer">チャンネルを見る ↗</a></div><div class="video-controls"><button type="button" data-video-direction="-1" aria-label="前の動画へ">←</button><button type="button" data-video-direction="1" aria-label="次の動画へ">→</button></div><div class="video-track" tabindex="0" aria-label="最新のYouTube動画">${videos.map(v => `<article class="video-card"><div class="video-player"><a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(v.title)}をYouTubeで見る（新しいタブ）"><img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="" loading="lazy"><span aria-hidden="true">▶</span></a></div><h3><a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener noreferrer">${escapeHtml(v.title)}</a></h3><time datetime="${v.published}">${v.published.slice(0,10).replaceAll('-','.')}</time></article>`).join('')}</div></div></section><section class="section about-section"><div class="container"><div class="section-heading home-about-heading reveal"><div><p class="eyebrow">03 — ABOUT</p><h2>Koudai.Tについて<br><em>好きなこと、これまでの軌跡。</em></h2></div><div class="home-about-side"><a class="text-link" href="/about/">ABOUTを見る <span>↗</span></a><div class="about-copy home-about-copy">${aboutHtml}</div></div></div></div></section>`;

await fs.writeFile(path.join(dist, 'index.html'), layout({ title: site.name, description: site.description, pathName: '/', active: 'HOME', content: homeContent.replace(/<section class="hero">[\s\S]*?<\/section>/, '') }));

const filters = categories.length ? `<div class="filter-row"><a class="filter is-active" href="/blog/">ALL</a>${categories.map(cat => `<a class="filter" data-category="${escapeHtml(cat)}" href="/blog/?category=${encodeURIComponent(cat)}">${escapeHtml(cat)}</a>`).join('')}</div>` : '';
const blogContent = `<section class="page-hero"><div class="container"><p class="eyebrow reveal">ARCHIVE / BLOG</p><h1 class="page-title reveal">記事一覧<span>.</span></h1><p class="page-lead reveal">試して、考えて、記録したこと。<br>ジャンルをまたいで蓄積しています。</p></div></section><section class="section blog-list-section"><div class="container">${filters}<div class="post-grid blog-grid">${posts.map(card).join('')}</div><p class="empty-state" ${posts.length ? 'hidden' : ''}>該当する記事はありません。</p></div></section>`;
await fs.mkdir(path.join(dist, 'blog'), { recursive: true });
await fs.writeFile(path.join(dist, 'blog', 'index.html'), layout({ title: 'BLOG', description: 'KOUDAI.Tの記事一覧。', pathName: '/blog/', active: 'BLOG', content: blogContent }));

for (const post of posts) {
  const related = posts.filter(candidate => candidate.slug !== post.slug && (candidate.category === post.category || candidate.tags.some(tag => post.tags.includes(tag)))).slice(0, 2);
  const articleContent = `<article class="article-wrap"><div class="container article-container"><div class="article-kicker reveal"><a href="/blog/?category=${encodeURIComponent(post.category)}">${escapeHtml(post.category)}</a><span>/</span><time datetime="${post.date}">${formatDate(post.date)}</time>${post.updated ? `<span class="updated">UPDATED ${formatDate(post.updated)}</span>` : ''}</div><h1 class="article-title reveal">${escapeHtml(post.title)}</h1><div class="article-layout"><div class="article-body">${post.html}</div></div><div class="related-block"><div class="section-heading"><div><p class="eyebrow">RELATED POSTS</p><h2>関連記事</h2></div><a class="text-link" href="/blog/">BLOGへ戻る <span>↗</span></a></div><div class="post-grid">${related.map(card).join('')}</div></div></div></article>`;
  const folder = path.join(dist, 'blog', post.slug);
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, 'index.html'), layout({ title: post.title, description: post.description, pathName: `/blog/${post.slug}/`, active: 'BLOG', content: articleContent, ogImage: post.thumbnail }));
}

const games = JSON.parse(await fs.readFile(path.join(src, 'data/games.json'), 'utf8'));
const gameHistory = `<section class="section game-history"><div class="container">
<div class="game-history-block"><p class="eyebrow">FAVORITES</p><h2>今までのゲームについて</h2><p class="games-intro">下記のゲームジャンルを好みます。</p><ul class="favorite-games">${games.favorites.map(name => `<li>${escapeHtml(name)}</li>`).join('')}</ul></div>
<div class="game-history-block game-record"><p class="eyebrow">RECORD</p><h2>モンスターハンターフロンティア</h2><p class="games-intro">公式狩猟大会 韋駄天の実績</p><ul class="game-results">${games.results.map(([round, rank]) => `<li><span>第${round}回</span><strong class="${rank === 1 ? 'first-place' : ''}">${rank}<small>位</small></strong></li>`).join('')}</ul></div>
</div></section>`;
const aboutContent = `<section class="page-hero compact"><div class="container"><p class="eyebrow reveal">03 — ABOUT</p><h1 class="page-title reveal">ABOUT<span>.</span></h1></div></section>${gameHistory}`;
await fs.mkdir(path.join(dist, 'about'), { recursive: true });
await fs.writeFile(path.join(dist, 'about', 'index.html'), layout({ title: 'ABOUT', description: 'KOUDAI.Tについて。', pathName: '/about/', active: 'ABOUT', content: aboutContent }));

const youtubeContent = `<section class="page-hero compact"><div class="container"><p class="eyebrow reveal">02 — CHANNEL</p><h1 class="page-title reveal">YOUTUBE<span>.</span></h1><p class="page-lead reveal">動画で見るKOUDAI.Tの制作記録。</p></div></section><section class="section channel-section"><div class="container channel-card reveal"><img class="channel-logo" src="/assets/branding/kt-channel-logo.jpg" alt="KTロゴ" width="150" height="150"><div><p class="eyebrow">CHANNEL</p><h2>${escapeHtml(site.youtube.name)}</h2><p>ゲーム、制作、試してみたことを動画にしています。</p><a class="button" href="${site.youtube.url}" target="_blank" rel="noopener noreferrer">チャンネルへ ${icon('arrow')}</a></div></div></section>`;
await fs.mkdir(path.join(dist, 'youtube'), { recursive: true });
await fs.writeFile(path.join(dist, 'youtube', 'index.html'), layout({ title: 'YOUTUBE', description: 'KOUDAI.TのYouTubeチャンネル。', pathName: '/youtube/', active: 'YOUTUBE', content: youtubeContent }));

const searchContent = `<section class="page-hero compact"><div class="container"><p class="eyebrow reveal">FIND A NOTE</p><h1 class="page-title reveal">SEARCH<span>.</span></h1></div></section><section class="section search-section"><div class="container"><form class="search-form" id="search-form"><label class="sr-only" for="search-input">記事を検索</label><input id="search-input" type="search" placeholder="タイトル、本文、タグから検索" autocomplete="off"><button type="submit">${icon('search')}検索</button></form><div class="search-status" id="search-status">記事を検索できます。</div><div class="search-results post-grid" id="search-results"></div></div></section>`;
await fs.mkdir(path.join(dist, 'search'), { recursive: true });
await fs.writeFile(path.join(dist, 'search', 'index.html'), layout({ title: 'SEARCH', description: 'KOUDAI.Tの記事を検索。', pathName: '/search/', active: 'SEARCH', content: searchContent, extraScripts: '<script src="/assets/search-index.js"></script>' }));

const indexData = posts.map(post => ({ title: post.title, slug: post.slug, date: post.date, category: post.category, tags: post.tags, thumbnail: post.thumbnail, description: post.description, text: post.body.replace(/[#>*`|\-]/g, ' ') }));
await fs.writeFile(path.join(dist, 'assets', 'search-index.js'), `window.KOUDAI_SEARCH_INDEX = ${JSON.stringify(indexData)};`);
await fs.writeFile(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/blog/', '/about/', '/youtube/', '/search/', ...posts.map(post => `/blog/${post.slug}/`)].map(url => `<url><loc>${site.url}${url}</loc></url>`).join('')}</urlset>`);
await fs.writeFile(path.join(dist, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`);
console.log(`Built ${posts.length} posts → ${path.relative(root, dist)}`);

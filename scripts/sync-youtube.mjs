import fs from 'node:fs/promises';
const target = new URL('../src/data/youtube.json', import.meta.url);
// The public feed mixes Shorts and regular videos. Only accept IDs from
// the channel's selected Videos tab; do not guess from duration or title.
const page = await fetch('https://www.youtube.com/channel/UCtx-L-9fOMlBt6pljAfOEvw/videos', { signal: AbortSignal.timeout(20000) });
if (!page.ok) throw new Error('YouTube Videos tab: ' + page.status);
const html = await page.text();
const initial = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
if (!initial) throw new Error('Videos tab unavailable; keeping existing data');
const data = JSON.parse(initial[1]);
const selected = data.contents?.twoColumnBrowseResultsRenderer?.tabs?.find(tab => tab.tabRenderer?.selected)?.tabRenderer;
if (!selected?.endpoint?.commandMetadata?.webCommandMetadata?.url?.endsWith('/videos')) throw new Error('Unexpected selected tab; keeping existing data');
const regularIds = new Set();
function collectVideos(value) {
  if (!value || typeof value !== 'object') return;
  if (value.videoRenderer?.videoId) regularIds.add(value.videoRenderer.videoId);
  if (value.lockupViewModel?.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') regularIds.add(value.lockupViewModel.contentId);
  for (const child of Object.values(value)) collectVideos(child);
}
collectVideos(selected?.content);
if (!regularIds.size) throw new Error('No regular videos found; keeping existing data');
const response = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=UCtx-L-9fOMlBt6pljAfOEvw', { signal: AbortSignal.timeout(20000) });
if (!response.ok) throw new Error('YouTube feed: ' + response.status);
const xml = await response.text();
const decode = s => s.replace(/&(?:amp|lt|gt|quot|apos);/g, entity => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"})[entity]);
const videos = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, entry]) => ({
  id: entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1],
  title: decode(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''),
  published: entry.match(/<published>(.*?)<\/published>/)?.[1]
})).filter(v => /^[\w-]{11}$/.test(v.id) && v.title && v.published && regularIds.has(v.id)).sort((a,b) => b.published.localeCompare(a.published)).slice(0,15);
if (!videos.length) throw new Error('YouTube feed has no valid videos; keeping existing data');
await fs.writeFile(target, JSON.stringify(videos, null, 2) + '\n');
console.log('Updated YouTube videos: ' + videos.length);

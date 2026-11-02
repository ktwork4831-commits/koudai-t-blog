import fs from 'node:fs/promises';

const channel = 'UCtx-L-9fOMlBt6pljAfOEvw';
const target = new URL('../src/data/youtube-archive.json', import.meta.url);
const latestTarget = new URL('../src/data/youtube.json', import.meta.url);
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`YouTube returned ${response.status}`);
  return response;
}
const html = await (await request(`https://www.youtube.com/channel/${channel}/videos?hl=ja`)).text();
const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
if (!match) throw new Error('Missing channel data; existing files retained');
const data = JSON.parse(match[1]);
const selected = data.contents?.twoColumnBrowseResultsRenderer?.tabs?.find(tab => tab.tabRenderer?.selected)?.tabRenderer;
if (!selected?.endpoint?.commandMetadata?.webCommandMetadata?.url?.endsWith('/videos')) throw new Error('Videos tab not selected');
const clientVersion = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1];
if (!clientVersion) throw new Error('Missing YouTube client version');
const videos = new Map();
const plain = value => value?.simpleText || value?.runs?.map(run => run.text).join('') || '';
function collect(value) {
  if (!value || typeof value !== 'object') return;
  const video = value.videoRenderer;
  if (video && /^[\w-]{11}$/.test(video.videoId) && plain(video.title)) {
    videos.set(video.videoId, { id: video.videoId, title: plain(video.title), published: '', publishedLabel: plain(video.publishedTimeText) });
  }
  const lockup = value.lockupViewModel;
  if (lockup?.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO' && /^[\w-]{11}$/.test(lockup.contentId)) {
    const title = lockup.metadata?.lockupMetadataViewModel?.title?.content;
    if (title) videos.set(lockup.contentId, { id: lockup.contentId, title, published: '', publishedLabel: '' });
  }
  for (const child of Object.values(value)) collect(child);
}
function continuation(value) {
  if (!value || typeof value !== 'object') return;
  if (value.continuationItemRenderer) return value.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token;
  for (const child of Object.values(value)) {
    const token = continuation(child);
    if (token) return token;
  }
}
collect(selected.content);
let token = continuation(selected.content);
const seen = new Set();
let page = 1;
while (token) {
  if (seen.has(token) || page > 500) throw new Error('Incomplete pagination; existing files retained');
  seen.add(token);
  const result = await (await request('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion, hl: 'ja', gl: 'JP' } }, continuation: token })
  })).json();
  const items = (result.onResponseReceivedActions || result.onResponseReceivedEndpoints || []).flatMap(action => action.appendContinuationItemsAction?.continuationItems || []);
  if (!items.length) throw new Error('Missing continuation results; existing files retained');
  collect(items);
  token = continuation(items);
  page += 1;
  console.log(`Page ${page}: ${videos.size} videos`);
}
if (!videos.size) throw new Error('No videos; existing files retained');
// The Videos tab is newest-first. Keep that order; relative dates are display-only.
const existing = JSON.parse(await fs.readFile(latestTarget, 'utf8'));
for (const old of existing) if (videos.has(old.id)) videos.get(old.id).published = old.published || '';
const archive = [...videos.values()];
await fs.writeFile(target, JSON.stringify(archive, null, 2) + '\n');
console.log(`Archived ${archive.length} public Videos-tab entries in channel order`);

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const editorRoot = path.join(root, 'editor');
const sourceRoot = path.join(root, 'src');
const postsRoot = path.join(sourceRoot, 'posts');
const imagesRoot = path.join(sourceRoot, 'assets', 'images', 'posts');
const tempRoot = path.join(root, 'work', 'editor-temp');
const port = 4174;

const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const escapeYaml = (value) => String(value ?? '').replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ');
const slugify = (value) => {
  const ascii = String(value).normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return ascii || `post-${today().replaceAll('-', '')}-${Math.random().toString(36).slice(2, 6)}`;
};
const safeSegment = (value, fallback) => { const cleaned = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80); return cleaned || fallback; };

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', chunk => { size += chunk.length; if (size > 30 * 1024 * 1024) { reject(new Error('画像を含むデータが大きすぎます（上限30MB）')); req.destroy(); } else chunks.push(chunk); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('入力データを読み取れませんでした')); } });
    req.on('error', reject);
  });
}

function convertImage(input, output) {
  return new Promise((resolve, reject) => {
    const child = spawn('python', [path.join(root, 'scripts', 'convert-image.py'), input, output], { cwd: root, windowsHide: true });
    let error = ''; child.stderr.on('data', chunk => { error += chunk.toString(); });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(error || '画像変換に失敗しました')));
  });
}

async function savePost(payload) {
  const title = String(payload.title || '').trim();
  const category = String(payload.category || 'OTHER').trim();
  if (!title) throw new Error('タイトルを入力してください');
  if (!category || category.length > 60 || /[\r\n]/.test(category)) throw new Error('カテゴリーは1〜60文字で入力してください');
  const slug = safeSegment(slugify(payload.slug || title), slugify(title));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(payload.date || '') ? payload.date : today();
  const tags = (Array.isArray(payload.tags) ? payload.tags : []).map(tag => String(tag).trim()).filter(Boolean).slice(0, 12);
  const body = String(payload.body || '').trim();
  if (!body) throw new Error('本文を入力してください');
  const files = Array.isArray(payload.images) ? payload.images.slice(0, 20) : [];
  const postImageRoot = path.join(imagesRoot, slug);
  await fs.mkdir(postsRoot, { recursive: true });
  await fs.mkdir(postImageRoot, { recursive: true });
  await fs.mkdir(tempRoot, { recursive: true });
  const imagePaths = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const match = String(file.dataUrl || '').match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/s);
    if (!match) continue;
    const input = path.join(tempRoot, `${slug}-${index}.${match[1].replace('jpeg', 'jpg')}`);
    const outputName = `${String(index + 1).padStart(2, '0')}.webp`;
    const output = path.join(postImageRoot, outputName);
    await fs.writeFile(input, Buffer.from(match[2], 'base64'));
    await convertImage(input, output);
    await fs.rm(input, { force: true });
    imagePaths.push({ path: `/assets/images/posts/${slug}/${outputName}`, name: file.name || outputName });
  }
  const featuredIndex = Number.isInteger(payload.featuredIndex) ? payload.featuredIndex : 0;
  const thumbnail = imagePaths[featuredIndex]?.path || imagePaths[0]?.path || '/assets/images/posts/daily-tool-001.svg';
  const description = String(payload.description || body.replace(/[#>*`|\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || title);
  const frontMatter = ['---', `title: "${escapeYaml(title)}"`, `slug: ${slug}`, `date: ${date}`, `category: "${escapeYaml(category)}"`, 'tags:', ...tags.map(tag => `  - "${escapeYaml(tag)}"`), `thumbnail: ${thumbnail}`, `description: "${escapeYaml(description)}"`, '---', ''].join('\n');
  const bodyImages = imagePaths.filter((_, index) => files[index]?.inBody !== false);
  const imageMarkdown = bodyImages.length ? `\n\n${bodyImages.map(image => `![${image.name}](${image.path})`).join('\n\n')}\n` : '';
  const markdown = `${frontMatter}${body}${imageMarkdown}\n`;
  const postPath = path.join(postsRoot, `${slug}.md`);
  await fs.writeFile(postPath, markdown, 'utf8');
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts', 'build.mjs')], { cwd: root, windowsHide: true });
    let error = ''; child.stderr.on('data', chunk => { error += chunk.toString(); });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(error || 'サイトのビルドに失敗しました')));
  });
  return { slug, date, postPath, imageCount: imagePaths.length, url: `/blog/${slug}/` };
}

async function staticFile(requestPath, res) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  let filePath;
  if (decoded === '/' || decoded === '/index.html') filePath = path.join(editorRoot, 'index.html');
  else if (decoded.startsWith('/editor/')) filePath = path.join(root, decoded.slice(1));
  else if (decoded.startsWith('/assets/')) filePath = path.join(sourceRoot, decoded.slice(1));
  else { res.writeHead(404); res.end('Not found'); return; }
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
  try { const data = await fs.readFile(resolved); res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(resolved)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data); }
  catch { res.writeHead(404); res.end('Not found'); }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/save') return json(res, 200, { ok: true, ...(await savePost(await readBody(req))) });
    if (req.method === 'GET') return staticFile(req.url, res);
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (error) { return json(res, 400, { ok: false, error: error.message || '保存に失敗しました' }); }
});
server.listen(port, '127.0.0.1', () => console.log(`KOUDAI.T editor: http://localhost:${port}/`));

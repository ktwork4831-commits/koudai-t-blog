const state = { images: [], featuredIndex: 0 };
const $ = selector => document.querySelector(selector);
const titleInput = $('#title');
const categoryInput = $('#category');
const dateInput = $('#date');
const tagsInput = $('#tags');
const bodyInput = $('#body');
const slugOutput = $('#slug-output');
const wordCount = $('#word-count');
const preview = $('#preview');
const dropZone = $('#drop-zone');
const imageInput = $('#image-input');
const imageList = $('#image-list');
const status = $('#save-status');
const saveButton = $('#save-button');

const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
dateInput.value = today();

function slugify(value) {
  const slug = String(value).normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return slug || `post-${dateInput.value.replaceAll('-', '')}`;
}
function escapeHtml(value = '') { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
function inline(value) {
  let html = escapeHtml(value);
  html = html.replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return html;
}
function renderMarkdown(value) {
  const lines = String(value || '').split(/\r?\n/); const html = []; let paragraph = []; let list = []; let quote = [];
  const flush = () => { if (paragraph.length) { html.push(`<p>${paragraph.map(inline).join('<br>')}</p>`); paragraph = []; } };
  const flushList = () => { if (list.length) { html.push(`<ul>${list.map(item => `<li>${inline(item)}</li>`).join('')}</ul>`); list = []; } };
  const flushQuote = () => { if (quote.length) { html.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`); quote = []; } };
  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) { flush(); flushList(); flushQuote(); const match = line.match(/^(#{1,3})\s+(.+)$/); html.push(`<h${match[1].length}>${inline(match[2])}</h${match[1].length}>`); }
    else if (/^\s*[-*]\s+/.test(line)) { flush(); flushQuote(); list.push(line.replace(/^\s*[-*]\s+/, '')); }
    else if (/^>\s?/.test(line)) { flush(); flushList(); quote.push(line.replace(/^>\s?/, '')); }
    else if (!line.trim()) { flush(); flushList(); flushQuote(); }
    else paragraph.push(line);
  }
  flush(); flushList(); flushQuote(); return html.join('');
}
function description() { return bodyInput.value.replace(/[#>*`|\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || titleInput.value.trim() || '記事の概要'; }
function updatePreview() {
  const title = titleInput.value.trim(); const currentSlug = slugify(title); slugOutput.value = currentSlug; slugOutput.textContent = currentSlug;
  wordCount.textContent = `${bodyInput.value.length.toLocaleString()} characters`;
  if (!title && !bodyInput.value.trim() && !state.images.length) { preview.innerHTML = '<div class="preview-empty"><span>PREVIEW</span><p>左側にタイトルと本文を入力すると、<br>ここに表示されます。</p></div>'; return; }
  const featured = state.images[state.featuredIndex] || state.images[0];
  preview.innerHTML = `<div class="preview-meta"><strong>${escapeHtml(categoryInput.value)}</strong><span>/</span><span>${dateInput.value.replaceAll('-', '.')}</span></div><h3>${escapeHtml(title || '無題の記事')}</h3><p class="preview-description">${escapeHtml(description())}</p>${featured ? `<figure class="preview-cover"><img src="${featured.dataUrl}" alt="${escapeHtml(featured.name)}"></figure>` : ''}<div class="preview-body">${renderMarkdown(bodyInput.value) || '<p class="preview-description">本文を入力してください。</p>'}</div>${state.images.some(image => image.inBody) ? `<div class="preview-images">${state.images.filter(image => image.inBody).map(image => `<img src="${image.dataUrl}" alt="${escapeHtml(image.name)}" loading="lazy">`).join('')}</div>` : ''}`;
}
function renderImages() {
  imageList.innerHTML = state.images.map((image, index) => `<div class="image-item"><img src="${image.dataUrl}" alt="${escapeHtml(image.name)}"><button class="remove-image" type="button" data-remove="${index}" aria-label="${escapeHtml(image.name)}を削除">×</button><div class="image-info"><small title="${escapeHtml(image.name)}">${escapeHtml(image.name)}</small><label><input type="radio" name="featured" value="${index}" ${index === state.featuredIndex ? 'checked' : ''}> アイキャッチ</label><label><input type="checkbox" data-body="${index}" ${image.inBody ? 'checked' : ''}> 本文にも表示</label></div></div>`).join('');
  imageList.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => { const index = Number(button.dataset.remove); state.images.splice(index, 1); if (state.featuredIndex >= state.images.length) state.featuredIndex = Math.max(0, state.images.length - 1); else if (index < state.featuredIndex) state.featuredIndex -= 1; renderImages(); updatePreview(); }));
  imageList.querySelectorAll('input[name="featured"]').forEach(input => input.addEventListener('change', () => { state.featuredIndex = Number(input.value); updatePreview(); }));
  imageList.querySelectorAll('[data-body]').forEach(input => input.addEventListener('change', () => { state.images[Number(input.dataset.body)].inBody = input.checked; updatePreview(); }));
}
function fileToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
async function addFiles(fileList) {
  const files = [...fileList].filter(file => file.type.startsWith('image/')).slice(0, 20 - state.images.length);
  for (const file of files) state.images.push({ name: file.name, dataUrl: await fileToDataUrl(file), inBody: state.images.length > 0 });
  renderImages(); updatePreview();
}

['input', 'change'].forEach(eventName => document.addEventListener(eventName, event => { if (event.target.matches('#title,#category,#date,#tags,#body')) updatePreview(); }));
dropZone.addEventListener('dragover', event => { event.preventDefault(); dropZone.classList.add('is-dragging'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragging'));
dropZone.addEventListener('drop', async event => { event.preventDefault(); dropZone.classList.remove('is-dragging'); await addFiles(event.dataTransfer.files); });
dropZone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') imageInput.click(); });
imageInput.addEventListener('change', async () => { await addFiles(imageInput.files); imageInput.value = ''; });

$('#post-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!titleInput.value.trim() || !bodyInput.value.trim()) { status.className = 'save-status is-error'; status.textContent = 'タイトルと本文を入力してください。'; return; }
  saveButton.disabled = true; saveButton.textContent = '保存中…'; status.className = 'save-status'; status.textContent = '画像をWebPに変換して、記事をビルドしています。';
  const payload = { title: titleInput.value.trim(), category: categoryInput.value, date: dateInput.value, slug: slugify(titleInput.value), tags: tagsInput.value.split(',').map(tag => tag.trim()).filter(Boolean), body: bodyInput.value.trim(), featuredIndex: state.featuredIndex, images: state.images.map(image => ({ name: image.name, dataUrl: image.dataUrl, inBody: image.inBody })) };
  try {
    const response = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || '保存に失敗しました');
    status.className = 'save-status is-success'; status.innerHTML = `保存しました。<a class="success-link" href="http://localhost:4173${result.url}" target="_blank" rel="noreferrer">記事を確認 ↗</a>`;
  } catch (error) { status.className = 'save-status is-error'; status.textContent = error.message; }
  saveButton.disabled = false; saveButton.innerHTML = '記事を保存してビルド <span>↗</span>';
});

updatePreview();

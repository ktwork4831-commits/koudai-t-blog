const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const menuToggle = $('.menu-toggle');
const nav = $('.main-nav');
menuToggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(open));
});
$$('.main-nav a').forEach(link => link.addEventListener('click', () => nav?.classList.remove('is-open')));

const revealItems = $$('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), { threshold: 0.08 });
  revealItems.forEach(item => observer.observe(item));
} else revealItems.forEach(item => item.classList.add('is-visible'));

function initializeSearch(root, index) {
const searchInput = $('[data-search-input], #search-input', root);
const searchForm = $('[data-search-form], #search-form', root);
const searchResults = $('[data-search-results], #search-results', root);
const searchStatus = $('[data-search-status], #search-status', root);
if (searchInput && searchResults && index) {
  const escapeSearch = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const normalizeSearch = value => String(value).normalize('NFKC').toLowerCase();
  const renderSearch = () => {
    const query = normalizeSearch(searchInput.value.trim());
    const results = index.filter(post => !query || normalizeSearch([post.title, post.description, post.category, ...(post.tags || []), post.text].join(' ')).includes(query));
    searchResults.innerHTML = results.map(post => {
      const video = post.type === 'youtube' && /^[\w-]{11}$/.test(post.id);
      const href = video ? `https://www.youtube.com/watch?v=${post.id}` : `/blog/${encodeURIComponent(post.slug)}/`;
      const external = video ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<article class="post-card reveal is-visible"><a class="post-card-image" href="${href}"${external}><img src="${escapeSearch(post.thumbnail)}" alt="${escapeSearch(post.title)}" loading="lazy"></a><div class="post-card-body"><div class="post-meta"><span>${video ? 'YouTube' : escapeSearch(post.category)}</span><time>${escapeSearch(post.date?.replaceAll('-', '.'))}</time></div><h3><a href="${href}"${external}>${escapeSearch(post.title)}</a></h3><p>${escapeSearch(post.description)}</p><div class="tag-row">${(post.tags || []).slice(0, 3).map(tag => `<span>#${escapeSearch(tag)}</span>`).join('')}</div></div></article>`;
    }).join('');
    searchStatus.textContent = query ? `${results.length}件の記事・動画が見つかりました。` : `${results.length}件の記事・動画を検索できます（動画は取得済みのタイトルが対象です）。`;
  };
  searchInput.addEventListener('input', renderSearch);
  searchForm?.addEventListener('submit', event => { event.preventDefault(); renderSearch(); });
  renderSearch();
}
}
initializeSearch(document, window.KOUDAI_SEARCH_INDEX);

if (typeof HTMLDialogElement !== 'undefined') {
  const dialog = document.createElement('dialog');
  dialog.className = 'search-dialog';
  dialog.setAttribute('aria-labelledby', 'search-dialog-title');
  dialog.innerHTML = `<div class="search-dialog-heading"><h2 id="search-dialog-title">これまでの記事・動画を検索</h2><button type="button" class="search-dialog-close" aria-label="検索を閉じる">閉じる ×</button></div><form class="search-form" data-search-form><label class="sr-only" for="modal-search-input">記事・動画を検索</label><input id="modal-search-input" data-search-input type="search" placeholder="キーワードを入力" autocomplete="off"><button type="submit">検索</button></form><p class="search-status" data-search-status role="status">読み込み中…</p><div class="search-results post-grid" data-search-results></div>`;
  document.body.append(dialog);
  const input = $('[data-search-input]', dialog);
  let opener;
  let ready = false;
  let loading = false;
  const close = () => dialog.close();
  $('.search-dialog-close', dialog).addEventListener('click', close);
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('search-dialog-open');
    opener?.focus({ preventScroll: true });
  });
  $('[data-search-form]', dialog).addEventListener('submit', event => event.preventDefault());
  $$('.nav-search').forEach(link => {
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', async event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      nav?.classList.remove('is-open');
      menuToggle?.setAttribute('aria-expanded', 'false');
      if (!dialog.open) dialog.showModal();
      document.body.classList.add('search-dialog-open');
      input.focus({ preventScroll: true });
      if (ready || loading) return;
      loading = true;
      $('[data-search-status]', dialog).textContent = '読み込み中…';
      try {
        const response = await fetch('/assets/search-index.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('Search data unavailable');
        const index = await response.json();
        if (!Array.isArray(index)) throw new Error('Invalid search data');
        initializeSearch(dialog, index);
        ready = true;
      } catch {
        $('[data-search-status]', dialog).textContent = '読み込めませんでした。一度閉じて、もう一度お試しください。';
      } finally { loading = false; }
    });
  });
}

const categoryParam = new URLSearchParams(window.location.search).get('category');
if (categoryParam && $$('.blog-grid').length) {
  $$('.filter').forEach(filter => filter.classList.toggle('is-active', filter.dataset.category === categoryParam));
  let visible = 0;
  $$('.blog-grid .post-card').forEach(card => {
    const category = $('.post-meta a', card)?.textContent.trim();
    const show = category === categoryParam;
    card.hidden = !show;
    if (show) visible += 1;
  });
  const empty = $('.empty-state');
  if (empty) empty.hidden = visible !== 0;
}

document.querySelectorAll('.video-section').forEach(section => {
  const track = section.querySelector('.video-track');
  const controls = [...section.querySelectorAll('[data-video-direction]')];
  const update = () => controls.forEach(button => {
    button.disabled = Number(button.dataset.videoDirection) < 0 ? track.scrollLeft < 2 : track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  });
  controls.forEach(button => button.addEventListener('click', () => track.scrollBy({ left: Number(button.dataset.videoDirection) * (track.querySelector('.video-card').getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap)), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })));
  track.addEventListener('scroll', update, {passive:true});
  window.addEventListener('resize', update);
  update();

});

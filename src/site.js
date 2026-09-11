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

const searchInput = $('#search-input');
const searchForm = $('#search-form');
const searchResults = $('#search-results');
const searchStatus = $('#search-status');
if (searchInput && searchResults && window.KOUDAI_SEARCH_INDEX) {
  const renderSearch = () => {
    const query = searchInput.value.trim().toLowerCase();
    const results = window.KOUDAI_SEARCH_INDEX.filter(post => !query || [post.title, post.description, post.category, ...(post.tags || []), post.text].join(' ').toLowerCase().includes(query));
    searchResults.innerHTML = results.map(post => `<article class="post-card reveal is-visible"><a class="post-card-image" href="/blog/${post.slug}/"><img src="${post.thumbnail}" alt="${post.title}" loading="lazy"><span class="image-arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></span></a><div class="post-card-body"><div class="post-meta"><span>${post.category}</span><time>${post.date.replaceAll('-', '.')}</time></div><h3><a href="/blog/${post.slug}/">${post.title}</a></h3><p>${post.description}</p><div class="tag-row">${(post.tags || []).slice(0, 3).map(tag => `<span>#${tag}</span>`).join('')}</div></div></article>`).join('');
    searchStatus.textContent = query ? `${results.length}件の記事が見つかりました。` : `${results.length}件の記事を検索できます。`;
  };
  searchInput.addEventListener('input', renderSearch);
  searchForm?.addEventListener('submit', event => { event.preventDefault(); renderSearch(); });
  renderSearch();
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

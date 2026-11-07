import './style.css';
import { fill, HISTORY, UI, type Lang } from './copy';
import { Sky } from './graph';
import { eraGradient, type Theme } from './palette';
import { namedIn, renderText } from './reader';
import { citedBy, meta, referencesOf, text, type Meta } from './sources';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

// ---- small persisted preferences (they may be unavailable; the app works without) ----
const store = {
  get(key: string) {
    try {
      return localStorage.getItem(`rfc-graph:${key}`);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(`rfc-graph:${key}`, value);
    } catch {
      /* private mode */
    }
  },
};

const state = {
  lang: (store.get('lang') as Lang | null) ?? (navigator.language.startsWith('tr') ? 'tr' : 'en'),
  theme: (store.get('theme') as Theme | null) ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
  current: 1,
  read: new Set<number>(JSON.parse(store.get('read') ?? '[]') as number[]),
  tab: 'story' as 'story' | 'read',
};

const t = (key: string, vars: Record<string, string | number> = {}) => fill(UI[state.lang][key] ?? key, vars);

// ---- the sky ----
const tip = $('#tip');
const sky = new Sky($<HTMLCanvasElement>('#sky'), {
  select: (id) => open(id),
  hover: (id, x, y) => {
    if (id === null) {
      tip.hidden = true;
      return;
    }
    const s = sky.stars.get(id)!;
    tip.replaceChildren();
    const b = document.createElement('b');
    b.textContent = `RFC ${id}`;
    tip.append(b, s.title ? ` ${s.title}` : '', s.year ? ` · ${s.year}` : '');
    tip.hidden = false;
    tip.style.transform = `translate(${Math.round(x + 14)}px, ${Math.round(y + 14)}px)`;
  },
});

// ---- the panel: drag its left edge to resize, double-click or ⇥ to fold it away ----
const root = document.documentElement;
const wide = () => innerWidth > 860;
const clampWidth = (w: number) => Math.round(Math.min(Math.max(w, 320), innerWidth * 0.72));
let panelWidth = clampWidth(Number(store.get('panel-width')) || 456);
let folded = store.get('panel') === 'collapsed';

function layoutPanel(persist = false) {
  panelWidth = clampWidth(panelWidth);
  root.style.setProperty('--panel-w', `${folded ? 56 : panelWidth}px`);
  if (folded) root.dataset.panel = 'collapsed';
  else delete root.dataset.panel;
  $('#collapse').setAttribute('aria-expanded', String(!folded));
  // The sky centres itself in whatever the panel leaves uncovered.
  sky.setInset(wide() ? (folded ? 56 : panelWidth) + 32 : 0);
  if (persist) {
    store.set('panel-width', String(panelWidth));
    store.set('panel', folded ? 'collapsed' : 'open');
  }
}

const grip = $('#grip');
grip.addEventListener('pointerdown', (e) => {
  grip.setPointerCapture(e.pointerId);
  root.classList.add('resizing');
  folded = false;
});
grip.addEventListener('pointermove', (e) => {
  if (!root.classList.contains('resizing')) return;
  panelWidth = innerWidth - e.clientX - 16;
  layoutPanel();
});
const stopResize = () => {
  if (!root.classList.contains('resizing')) return;
  root.classList.remove('resizing');
  layoutPanel(true);
};
grip.addEventListener('pointerup', stopResize);
grip.addEventListener('pointercancel', stopResize);
grip.addEventListener('dblclick', () => {
  folded = !folded;
  layoutPanel(true);
});
grip.addEventListener('keydown', (e) => {
  const step = e.shiftKey ? 96 : 24;
  if (e.key === 'ArrowLeft') panelWidth += step;
  else if (e.key === 'ArrowRight') panelWidth -= step;
  else return;
  e.preventDefault();
  folded = false;
  layoutPanel(true);
});
$('#collapse').addEventListener('click', () => {
  folded = !folded;
  layoutPanel(true);
});
addEventListener('resize', () => layoutPanel());
layoutPanel();

function hydrate(id: number) {
  if (state.read.has(id)) sky.update(id, { read: true });
  meta(id)
    .then((m) => sky.update(id, { title: m.title, year: m.year, pages: m.pages, obsolete: m.obsoletedBy.length > 0 }))
    .catch(() => {});
}

// ---- opening an RFC ----
let opening = 0;

async function open(n: number, push = true) {
  if (!Number.isInteger(n) || n < 1 || n > 99999) return;
  const ticket = ++opening;
  state.current = n;
  if (push && new URLSearchParams(location.search).get('rfc') !== String(n)) history.pushState({ n }, '', `?rfc=${n}`);
  document.title = `RFC ${n} · rfc graph`;
  $<HTMLInputElement>('#rfc-input').value = String(n);

  const star = sky.add(n);
  hydrate(n);
  sky.select(n);
  sky.focus(n);
  state.read.add(n);
  sky.update(n, { read: true });
  store.set('read', JSON.stringify([...state.read].slice(-500)));
  renderCard(null);
  $('#text').textContent = t('loading');
  $('#read-title').textContent = `RFC ${n}`;

  const m = await meta(n).catch(() => null);
  if (ticket !== opening) return;
  renderCard(m);
  if (m) $('#read-title').textContent = `RFC ${n}: ${m.title}`;
  if (!m) {
    $('#text').textContent = t('failed', { n });
    return;
  }

  // Lifecycle edges from the RFC Editor, typed references from the Datatracker,
  // and whatever else the text names.
  for (const o of m.obsoletes) sky.link(n, o, 'obs');
  for (const u of m.updates) sky.link(n, u, 'upd');
  for (const o of m.obsoletedBy) sky.link(o, n, 'obs');
  for (const u of m.updatedBy) sky.link(u, n, 'upd');
  const [refs, body] = await Promise.all([referencesOf(n).catch(() => ({ total: 0, edges: [] })), text(n).catch(() => '')]);
  if (ticket !== opening) return;
  for (const e of refs.edges) sky.link(n, e.other, e.kind);
  const typed = new Set(refs.edges.map((e) => e.other).concat(m.obsoletes, m.updates));
  for (const other of namedIn(n, body).filter((x) => !typed.has(x)).slice(0, 24)) sky.link(n, other, 'mention');
  star.expanded = true;
  for (const id of sky.neighbours(n)) hydrate(id);
  $('#ref-count').textContent = refs.edges.length ? t('refs', { n: refs.edges.length }) : t('noRefs');

  if (body) renderText($('#text'), n, body);
  else $('#text').textContent = t('failed', { n });

  // RFC 1 refers to nothing; what it started is on the other side.
  if (n === 1) showCitedBy(1);
  else if (sky.stars.size > 8) setTimeout(() => sky.fit(), 600);
}

async function showCitedBy(n: number) {
  const button = $<HTMLButtonElement>('#cited-by');
  button.disabled = true;
  const res = await citedBy(n).catch(() => null);
  button.disabled = false;
  if (!res || state.current !== n) return;
  for (const e of res.edges) sky.link(e.other, n, e.kind);
  for (const e of res.edges) hydrate(e.other);
  $('#cited-count').textContent = t('citedByShown', { shown: res.edges.length, total: res.total });
  setTimeout(() => sky.fit(), 400);
}

// ---- panels ----
function chips(label: string, list: number[]) {
  if (!list.length) return '';
  return `<div class="chips"><span>${label}</span>${list.map((x) => `<a href="?rfc=${x}" data-rfc="${x}">RFC ${x}</a>`).join('')}</div>`;
}

function renderCard(m: Meta | null) {
  const n = state.current;
  const card = $('#card');
  $('#history').toggleAttribute('open', n === 1);
  if (!m) {
    card.innerHTML = `<p class="eyebrow">RFC ${n}</p><h2 class="title">${t('loading')}</h2>`;
    return;
  }
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const status = m.status.toLowerCase() === 'unknown' ? '' : m.status.toLowerCase();
  const facts = [m.authors.slice(0, 4).join(', ') + (m.authors.length > 4 ? ' …' : ''), m.date, status, m.pages ? t('pages', { n: m.pages }) : '']
    .filter(Boolean)
    .map(esc)
    .join(' · ');
  card.innerHTML = `
    <p class="eyebrow">RFC ${n}</p>
    <h2 class="title">${esc(m.title)}</h2>
    <p class="facts">${facts}</p>
    ${chips(t('obsoletes'), m.obsoletes)}${chips(t('obsoletedBy'), m.obsoletedBy)}
    ${chips(t('updates'), m.updates)}${chips(t('updatedBy'), m.updatedBy)}
    <p class="counts"><span id="ref-count"></span></p>
    <p class="counts"><button id="cited-by" class="ghost" type="button">${t('citedBy')}</button> <span id="cited-count"></span></p>`;
  $('#cited-by').addEventListener('click', () => showCitedBy(n));
}

function renderStatic() {
  document.documentElement.lang = state.lang;
  const h = HISTORY[state.lang];
  $('#history-title').textContent = h.title;
  $('#history-body').innerHTML = h.body.map((p) => `<p>${p}</p>`).join('') + `<p class="sources">${h.sources}</p>`;
  $('#tagline').textContent = t('tagline');
  $<HTMLInputElement>('#rfc-input').placeholder = t('placeholder');
  $('#go').textContent = t('go');
  $('#tab-story').textContent = t('story');
  $('#tab-read').textContent = t('read');
  $('#fit').textContent = t('fit');
  $('#reset').textContent = t('reset');
  $('#reset').title = t('resetHint');
  $('#lang').textContent = state.lang === 'en' ? 'TR' : 'EN';
  $('#theme').setAttribute('aria-label', t('theme'));
  $('#made').textContent = t('made');
  for (const el of document.querySelectorAll<HTMLElement>('[data-kind]')) el.textContent = t(el.dataset.kind!);
  $('#legend-years').textContent = t('legendYears');
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  sky.setTheme(state.theme);
  $('#era-bar').style.background = eraGradient(state.theme);
}

function setTab(tab: 'story' | 'read') {
  state.tab = tab;
  $('#panel').dataset.tab = tab;
  $('#tab-story').setAttribute('aria-selected', String(tab === 'story'));
  $('#tab-read').setAttribute('aria-selected', String(tab === 'read'));
}

// ---- wiring ----
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>('[data-rfc]');
  if (!a || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  const n = Number(a.dataset.rfc);
  if (a.classList.contains('mention')) sky.link(state.current, n, 'mention');
  open(n);
});

$('#open').addEventListener('submit', (e) => {
  e.preventDefault();
  open(Number($<HTMLInputElement>('#rfc-input').value.replace(/\D/g, '')));
});
$('#fit').addEventListener('click', () => sky.fit());
// Start over: an empty sky with only the RFC that's open now.
$('#reset').addEventListener('click', () => {
  sky.clear();
  $('#tip').hidden = true;
  open(state.current, false);
});
$('#zoom-in').addEventListener('click', () => sky.zoomBy(1.25));
$('#zoom-out').addEventListener('click', () => sky.zoomBy(0.8));
$('#lang').addEventListener('click', () => {
  state.lang = state.lang === 'en' ? 'tr' : 'en';
  store.set('lang', state.lang);
  renderStatic();
  meta(state.current).then(renderCard).catch(() => {});
});
$('#theme').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  store.set('theme', state.theme);
  applyTheme();
});
$('#tab-story').addEventListener('click', () => setTab('story'));
$('#tab-read').addEventListener('click', () => setTab('read'));
window.addEventListener('popstate', () => open(Number(new URLSearchParams(location.search).get('rfc') ?? 1), false));

renderStatic();
applyTheme();
setTab('story');
for (const id of state.read) if (sky.stars.has(id)) sky.update(id, { read: true });
open(Number(new URLSearchParams(location.search).get('rfc') ?? 1) || 1, false);

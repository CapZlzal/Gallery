/**
 * app.js — Hazem Gallery v4
 *
 * Storage: Cloudinary tag-list endpoint as source of truth.
 * Metadata (name, category, type, collection) encoded in context+tags at upload time.
 * Read via: https://res.cloudinary.com/{cloud}/image/list/hg_gallery.json
 * No delete functionality — admin uploads and displays only.
 */

'use strict';

/* ── 1. CONFIG ──────────────────────────────────────────────── */
const CONFIG = {
  CLOUDINARY_CLOUD_NAME: 'dd3tq14rb',
  CLOUDINARY_UPLOAD_PRESET: 'portfolio_unsigned',
  GALLERY_TAG: 'hg_gallery',
  HIDDEN_KEY: 'hg_hidden',
  CACHE_KEY: 'hg_cache',
  CACHE_TTL_MS: 5 * 60 * 1000,
  WHATSAPP_NUM: '201099160942',
  LANG_KEY: 'hg_lang',
  THEME_KEY: 'hg_theme',
};

/* ── 2. FIREBASE GALLERY FETCH ──────────────────────────────── */

// Must match FB_URL in admin.js
const FB_URL = 'https://gallery-bbfa9-default-rtdb.firebaseio.com';

async function fetchGallery(force = false) {
  if (!force) {
    try {
      const raw = sessionStorage.getItem(CONFIG.CACHE_KEY);
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < CONFIG.CACHE_TTL_MS) return data;
      }
    } catch { /* continue */ }
  }

  if (!FB_URL || FB_URL.startsWith('PASTE')) return [];

  const res = await fetch(`${FB_URL}/gallery.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`Firebase read failed: ${res.status}`);
  const raw = await res.json();
  // Firebase stores as object {key: record} — convert to sorted array
  const data = (raw && typeof raw === 'object' && !Array.isArray(raw))
    ? Object.values(raw).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    : [];
  try { sessionStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch { }
  return data;
}

function invalidateCache() { sessionStorage.removeItem(CONFIG.CACHE_KEY); }

/* ── 3. I18N ────────────────────────────────────────────────── */
const I18N = {
  ar: {
    siteTitle: 'معرض حازم', galleryTitle: 'أعمالنا', filterAll: 'الكل',
    emptyMain: 'لا توجد صور بعد.\nادخل كأدمن لرفع الصور.',
    emptyAdmin: 'ارفع صورتك الأولى من الأعلى',
    wa: 'واتساب',
    totalImages: 'إجمالي الصور', totalCol: 'المجموعات', totalCat: 'الفئات',
    uploadTitle: 'ارفع صورة جديدة', uploadSub: 'صورة واحدة أو مجموعة → slider',
    nameLabel: 'الاسم / عنوان المشروع', namePH: 'مثال: شعار شركة ABC',
    catLabel: 'الفئة', customCatLbl: 'اسم الفئة المخصصة', customCatPH: 'مثال: موشن جرافيك',
    selectFiles: 'اختيار الصور', upload: 'رفع', clearAll: 'الكل',
    uploading: 'جاري الرفع', of: 'من', uploadOk: 'تم الرفع بنجاح!', uploadFail: 'فشل الرفع',
    loginTitle: 'لوحة الأدمن', loginSub: 'أدخل بيانات الدخول للمتابعة',
    userLbl: 'اسم المستخدم', passLbl: 'كلمة المرور', loginBtn: 'دخول',
    loginErr: 'بيانات الدخول غير صحيحة', backGallery: '← المعرض', logout: 'خروج',
    formTitle: 'تفاصيل الصورة', uploadedGallery: 'الصور المرفوعة',
    loading: 'جاري تحميل الصور…', loadError: 'تعذّر التحميل. تحقق من Cloudinary.',
    refresh: 'تحديث', download: 'تحميل',
  },
  en: {
    siteTitle: 'Hazem Gallery', galleryTitle: 'Our Work', filterAll: 'All',
    emptyMain: 'No images yet.\nLog in as admin to upload.',
    emptyAdmin: 'Upload your first image above',
    wa: 'WhatsApp',
    totalImages: 'Total Images', totalCol: 'Collections', totalCat: 'Categories',
    uploadTitle: 'Upload New Image', uploadSub: 'Single or group → slider',
    nameLabel: 'Name / Project Title', namePH: 'e.g. ABC Company Logo',
    catLabel: 'Category', customCatLbl: 'Custom Category', customCatPH: 'e.g. Motion Graphic',
    selectFiles: 'Select Images', upload: 'Upload', clearAll: 'Clear All',
    uploading: 'Uploading', of: 'of', uploadOk: 'Upload successful!', uploadFail: 'Upload failed',
    loginTitle: 'Admin Panel', loginSub: 'Enter your credentials to continue',
    userLbl: 'Username', passLbl: 'Password', loginBtn: 'Login',
    loginErr: 'Invalid username or password', backGallery: '← Gallery', logout: 'Logout',
    formTitle: 'Image Details', uploadedGallery: 'Uploaded Images',
    loading: 'Loading gallery…', loadError: 'Failed to load. Check Cloudinary settings.',
    refresh: 'Refresh', download: 'Download',
  },
};

let currentLang = localStorage.getItem(CONFIG.LANG_KEY) || 'ar';
function t(key) { return I18N[currentLang]?.[key] || I18N.ar[key] || key; }

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem(CONFIG.LANG_KEY, lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (el.dataset.i18nAttr) el.setAttribute(el.dataset.i18nAttr, t(key));
    else el.textContent = t(key);
  });
  const btn = document.getElementById('btn-lang');
  if (btn) btn.textContent = lang === 'ar' ? 'EN' : 'ع';
  renderGallery({ isAdmin: !!document.getElementById('admin-dashboard'), showFilter: true });
}

/* ── 4. THEME ───────────────────────────────────────────────── */
function applyTheme(theme) {
  localStorage.setItem(CONFIG.THEME_KEY, theme);
  document.documentElement.classList.toggle('light', theme === 'light');
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
}
function toggleTheme() {
  applyTheme((localStorage.getItem(CONFIG.THEME_KEY) || 'dark') === 'dark' ? 'light' : 'dark');
}

/* ── 5. CATEGORY ────────────────────────────────────────────── */
const BUILT_IN = { logo: { label: 'Logo', cls: 'badge-logo' }, photo: { label: 'Photo', cls: 'badge-photo' } };
function getCat(cat) { return BUILT_IN[cat] || { label: cat || 'Other', cls: 'badge-other' }; }

/** Converts a display name to a URL-safe slug for deep linking. */
function makeSlug(name, publicId) {
  const base = (name || publicId || 'item')
    .toLowerCase()
    .replace(/[\u0600-\u06FF]+/g, s => encodeURIComponent(s)) // keep Arabic encoded
    .replace(/[^a-z0-9\-_%]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || publicId?.split('/').pop() || 'item';
}

/* ── 6. GALLERY RENDER ──────────────────────────────────────── */
let activeFilter = '';

async function renderGallery({ isAdmin = false, showFilter = true, force = false } = {}) {
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('gallery-count');
  const clear = document.getElementById('btn-clear-all');
  if (!grid) return;

  grid.innerHTML = `<div class="gallery-loading"><div class="gallery-spinner"></div><p>${t('loading')}</p></div>`;
  if (empty) empty.style.display = 'none';

  let all;
  try { all = await fetchGallery(force); }
  catch (err) {
    grid.innerHTML = `<div class="gallery-loading error"><p>⚠ ${t('loadError')}</p></div>`;
    return;
  }

  const images = activeFilter ? all.filter(i => i.category === activeFilter) : all;
  if (count) count.textContent = all.length;
  if (clear) clear.hidden = all.length === 0;
  updateStats(all);

  grid.innerHTML = '';
  if (!images.length) { if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';
  images.forEach(rec => grid.appendChild(
    rec.type === 'collection' ? buildCollectionCard(rec, isAdmin) : buildSingleCard(rec, isAdmin)
  ));
  if (showFilter) renderFilterBar(all, isAdmin);

  // Deep link: if URL has #slug, open that card's lightbox
  const hash = window.location.hash.slice(1);
  if (hash) {
    const target = grid.querySelector(`[data-slug="${CSS.escape(hash)}"]`);
    if (target) {
      setTimeout(() => target.querySelector('.card-img-wrap')?.click(), 120);
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

function updateStats(all) {
  const sv = document.getElementById('stat-total');
  const sc = document.getElementById('stat-collections');
  const sk = document.getElementById('stat-cats');
  if (!sv) return;
  sv.textContent = all.reduce((a, i) => a + (i.type === 'collection' ? i.images?.length || 0 : 1), 0);
  sc.textContent = all.filter(i => i.type === 'collection').length;
  sk.textContent = new Set(all.map(i => i.category)).size;
}

/* ── 7. CARD BUILDERS ───────────────────────────────────────── */

function buildSingleCard(rec, isAdmin) {
  const slug = makeSlug(rec.name, rec.publicId);
  const card = makeShell();
  card.dataset.slug = slug;
  card.id = slug;
  const wrap = makeImgWrap();
  wrap.addEventListener('click', () => { openLightbox([{ url: rec.url }], 0); history.replaceState(null, '', `#${slug}`); });
  wrap.append(makeImg(rec.url, rec.name), makeOverlay(), makeBadge(getCat(rec.category)));
  card.append(wrap, makeFooter(rec, isAdmin));
  return card;
}

function buildCollectionCard(rec, isAdmin) {
  const { name, category, images } = rec;
  const slug = makeSlug(name, images[0]?.publicId);
  const card = makeShell(); card.classList.add('card-slider');
  card.dataset.slug = slug; card.id = slug;
  let cur = 0;
  const wrap = makeImgWrap();
  const img = makeImg(images[0]?.url || '', name); img.style.transition = 'opacity .22s';
  const ctr = document.createElement('span'); ctr.className = 'slide-counter'; ctr.textContent = `1 / ${images.length}`;
  const bPrev = makeSliderArrow('prev', '‹');
  const bNext = makeSliderArrow('next', '›');
  const dots = makeDots(images.length, 0);
  const colBdg = document.createElement('span'); colBdg.className = 'collection-badge'; colBdg.textContent = `🎞 ${images.length}`;

  function goTo(idx) {
    cur = (idx + images.length) % images.length;
    img.style.opacity = '0';
    setTimeout(() => { img.src = images[cur]?.url || ''; img.style.opacity = '1'; }, 120);
    ctr.textContent = `${cur + 1} / ${images.length}`;
    dots.querySelectorAll('.slider-dot').forEach((d, i) => d.classList.toggle('active', i === cur));
  }
  bPrev.addEventListener('click', e => { e.stopPropagation(); goTo(cur - 1); });
  bNext.addEventListener('click', e => { e.stopPropagation(); goTo(cur + 1); });
  dots.querySelectorAll('.slider-dot').forEach((d, i) => d.addEventListener('click', e => { e.stopPropagation(); goTo(i); }));
  wrap.addEventListener('click', () => { openLightbox(images, cur); history.replaceState(null, '', `#${slug}`); });
  let auto = images.length > 1 ? setInterval(() => goTo(cur + 1), 3200) : null;
  card.addEventListener('mouseenter', () => clearInterval(auto));
  card.addEventListener('mouseleave', () => { if (images.length > 1) auto = setInterval(() => goTo(cur + 1), 3200); });
  wrap.append(img, makeOverlay(), makeBadge(getCat(category)), bPrev, bNext, dots, ctr, colBdg);
  card.append(wrap, makeFooter(rec, isAdmin));
  return card;
}

function makeShell() { const c = document.createElement('article'); c.className = 'gallery-card'; c.setAttribute('role', 'listitem'); return c; }
function makeImgWrap() { const d = document.createElement('div'); d.className = 'card-img-wrap'; return d; }
function makeImg(url, alt) {
  const i = document.createElement('img'); i.src = url; i.alt = alt || ''; i.loading = 'lazy';
  i.onerror = () => {
    // Hide the card if image is 404 — prevents showing broken old resources
    const card = i.closest('.gallery-card');
    if (card) card.style.display = 'none';
  };
  return i;
}
function makeOverlay() {
  const d = document.createElement('div'); d.className = 'card-img-overlay';
  d.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  return d;
}
function makeBadge(cat) { const b = document.createElement('span'); b.className = `card-badge ${cat.cls}`; b.textContent = cat.label; return b; }
function makeSliderArrow(dir, html) { const b = document.createElement('button'); b.className = `slider-arrow slider-${dir}`; b.innerHTML = html; b.setAttribute('aria-label', dir === 'prev' ? 'السابق' : 'التالي'); return b; }
function makeDots(total, active) {
  const w = document.createElement('div'); w.className = 'slider-dots';
  for (let i = 0; i < total; i++) { const d = document.createElement('button'); d.className = `slider-dot${i === active ? ' active' : ''}`; d.setAttribute('aria-label', `${i + 1}`); w.appendChild(d); }
  return w;
}

/** Footer: WhatsApp for all + Download for admin only. No delete button. */
function makeFooter(rec, isAdmin) {
  const { name } = rec;
  const footer = document.createElement('div'); footer.className = 'card-footer';
  const nm = document.createElement('div'); nm.className = 'card-name';
  nm.textContent = name || (currentLang === 'ar' ? 'بدون عنوان' : 'Untitled');
  nm.title = name || '';
  const acts = document.createElement('div'); acts.className = 'card-actions';

  // WhatsApp — visible to everyone
  const waMsg = encodeURIComponent(currentLang === 'ar'
    ? `مرحباً، أنا مهتم بـ "${name || 'هذا العمل'}" من معرض حازم`
    : `Hello, I'm interested in "${name || 'this work'}" from Hazem Gallery`);
  const btnWA = document.createElement('button'); btnWA.className = 'btn btn-sm btn-whatsapp';
  btnWA.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.866-2.03-.967-.273-.101-.471-.15-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.197.594 4.251 1.629 6.013L.057 23.979l6.154-1.617A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.884 0-3.652-.51-5.17-1.4l-.37-.22-3.652.958.975-3.563-.24-.38A9.938 9.938 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg> ${t('wa')}`;
  btnWA.addEventListener('click', e => { e.stopPropagation(); window.open(`https://wa.me/${CONFIG.WHATSAPP_NUM}?text=${waMsg}`, '_blank', 'noopener'); });
  acts.appendChild(btnWA);

  // Download — admin only, no delete
  if (isAdmin) {
    const bDL = document.createElement('button'); bDL.className = 'btn btn-sm btn-ghost';
    bDL.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    bDL.title = t('download'); bDL.setAttribute('aria-label', t('download'));
    bDL.addEventListener('click', e => { e.stopPropagation(); downloadImage(rec.type === 'collection' ? rec.images?.[0]?.url : rec.url, rec.name); });
    acts.appendChild(bDL);
  }

  footer.append(nm, acts);
  return footer;
}

/* ── IMAGE DOWNLOAD ──────────────────────────────────────────── */
async function downloadImage(url, name) {
  if (!url) return;
  const filename = (name || 'image').replace(/[^a-zA-Z0-9\u0600-\u06FF\s_-]/g, '') || 'image';
  try {
    const res = await fetch(url); const blob = await res.blob(); const ext = blob.type.split('/')[1] || 'jpg';
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${filename}.${ext}`; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 3000);
  } catch { window.open(url, '_blank', 'noopener'); }
}

/* ── 8. FILTER BAR ──────────────────────────────────────────── */
function renderFilterBar(all, isAdmin = false) {
  const bar = document.getElementById('filter-bar'); if (!bar) return;
  const counts = {};
  all.forEach(i => { counts[i.category] = (counts[i.category] || 0) + 1; });
  const chips = [{ key: '', label: `${t('filterAll')} (${all.length})` }];
  Object.entries(counts).forEach(([k, n]) => chips.push({ key: k, label: `${getCat(k).label} (${n})` }));
  bar.innerHTML = '';
  chips.forEach(({ key, label }) => {
    const c = document.createElement('button');
    c.className = `filter-chip${activeFilter === key ? ' active' : ''}`;
    c.textContent = label;
    c.addEventListener('click', () => { activeFilter = key; renderGallery({ isAdmin, showFilter: true }); });
    bar.appendChild(c);
  });
}

/* ── 9. LIGHTBOX ────────────────────────────────────────────── */
let lbImages = [], lbIndex = 0;

function openLightbox(images, startIdx = 0) {
  lbImages = images; lbIndex = startIdx;
  const lb = document.getElementById('lightbox'), img = document.getElementById('lightbox-img'),
    ctr = document.getElementById('lb-counter'), bP = document.getElementById('lb-prev'), bN = document.getElementById('lb-next');
  if (!lb || !img) return;
  const multi = images.length > 1;
  img.src = images[lbIndex]?.url || ''; lb.hidden = false; document.body.style.overflow = 'hidden';
  if (ctr) { ctr.hidden = !multi; if (multi) ctr.textContent = `${lbIndex + 1} / ${images.length}`; }
  if (bP) bP.hidden = !multi; if (bN) bN.hidden = !multi;
}
function lbGoTo(idx) {
  lbIndex = (idx + lbImages.length) % lbImages.length;
  const img = document.getElementById('lightbox-img'), ctr = document.getElementById('lb-counter');
  if (!img) return;
  img.style.opacity = '0';
  setTimeout(() => { img.src = lbImages[lbIndex]?.url || ''; img.style.opacity = '1'; }, 120);
  if (ctr) ctr.textContent = `${lbIndex + 1} / ${lbImages.length}`;
}
function closeLightbox() {
  const lb = document.getElementById('lightbox'); if (!lb) return;
  lb.hidden = true; document.getElementById('lightbox-img').src = '';
  lbImages = []; lbIndex = 0; document.body.style.overflow = '';
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

/* ── 10. TOAST ──────────────────────────────────────────────── */
let _tt = null;
function showToast(msg, type = '', duration = 3000) {
  const el = document.getElementById('toast'); if (!el) return;
  el.textContent = msg; el.className = `toast show${type ? ' toast-' + type : ''}`;
  if (_tt) clearTimeout(_tt);
  if (duration > 0) _tt = setTimeout(() => el.classList.remove('show'), duration);
}

function svgPlaceholder() {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect fill='%231c1c26' width='200' height='150'/%3E%3Ctext x='50%25' y='50%25' fill='%2352526a' font-size='12' text-anchor='middle' dy='.3em'%3EImage unavailable%3C/text%3E%3C/svg%3E`;
}

/* ── 11. WIRING ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(localStorage.getItem(CONFIG.THEME_KEY) || 'dark');
  applyLang(localStorage.getItem(CONFIG.LANG_KEY) || 'ar');
  document.getElementById('btn-theme')?.addEventListener('click', toggleTheme);
  document.getElementById('btn-lang')?.addEventListener('click', () => applyLang(currentLang === 'ar' ? 'en' : 'ar'));

  const lb = document.getElementById('lightbox');
  document.getElementById('lightbox-close')?.addEventListener('click', closeLightbox);
  lb?.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  document.getElementById('lb-prev')?.addEventListener('click', e => { e.stopPropagation(); lbGoTo(lbIndex - 1); });
  document.getElementById('lb-next')?.addEventListener('click', e => { e.stopPropagation(); lbGoTo(lbIndex + 1); });
  document.addEventListener('keydown', e => {
    if (!lb || lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lbGoTo(lbIndex - 1);
    if (e.key === 'ArrowRight') lbGoTo(lbIndex + 1);
  });
});

/**
 * app.js — Hazem Gallery shared logic v3
 *
 * 1. CONFIG       — Cloudinary credentials
 * 2. STORAGE      — localStorage CRUD
 * 3. I18N         — AR / EN language system
 * 4. THEME        — dark / light toggle
 * 5. GALLERY      — render cards (single + collection slider)
 * 6. LIGHTBOX     — single image OR collection with prev/next + keyboard
 * 7. FILTER BAR   — category chips
 * 8. TOAST        — notifications
 * 9. WIRING       — DOMContentLoaded shared events
 */

'use strict';

/* ── 1. CONFIG ──────────────────────────────────────────────── */
const CONFIG = {
  CLOUDINARY_CLOUD_NAME:    'dd3tq14rb',
  CLOUDINARY_UPLOAD_PRESET: 'portfolio_unsigned',
  STORAGE_KEY:   'gallery_images',
  WHATSAPP_NUM:  '201099160942',
  LANG_KEY:      'hg_lang',
  THEME_KEY:     'hg_theme',
};

/* ── 2. STORAGE ─────────────────────────────────────────────── */
function loadImages() {
  try { return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveImages(list) { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(list)); }
function addImage(rec)    { const l = loadImages(); l.unshift(rec); saveImages(l); }
function removeImage(rec) {
  const key = rec.url || (rec.name + rec.uploadedAt);
  saveImages(loadImages().filter(i => (i.url || i.name + i.uploadedAt) !== key));
}

/* ── 3. I18N ────────────────────────────────────────────────── */
const I18N = {
  ar: {
    siteTitle:    'معرض حازم',
    galleryTitle: 'أعمالنا',
    adminLogin:   'دخول الأدمن',
    filterAll:    'الكل',
    emptyMain:    'لا توجد صور بعد.\nادخل كأدمن لرفع الصور.',
    emptyAdmin:   'ارفع صورتك الأولى من الأعلى',
    wa:           'واتساب',
    del:          'حذف',
    totalImages:  'إجمالي الصور',
    totalCol:     'المجموعات',
    totalCat:     'الفئات',
    uploadTitle:  'ارفع صورة جديدة',
    uploadSub:    'صورة واحدة أو مجموعة → slider',
    nameLabel:    'الاسم / عنوان المشروع',
    namePH:       'مثال: شعار شركة ABC',
    catLabel:     'الفئة',
    customCatLbl: 'اسم الفئة المخصصة',
    customCatPH:  'مثال: موشن جرافيك، بنر',
    selectFiles:  'اختيار الصور',
    upload:       'رفع',
    exportJson:   'تصدير JSON',
    importJson:   'استيراد JSON',
    clearAll:     'مسح الكل',
    uploading:    'جاري الرفع',
    of:           'من',
    uploadOk:     'تم الرفع بنجاح!',
    uploadFail:   'فشل الرفع',
    deleted:      'تم الحذف',
    exported:     'تم التصدير!',
    imported:     'تم الاستيراد',
    loginTitle:   'لوحة الأدمن',
    loginSub:     'أدخل بيانات الدخول للمتابعة',
    userLbl:      'اسم المستخدم',
    passLbl:      'كلمة المرور',
    loginBtn:     'دخول',
    loginErr:     'بيانات الدخول غير صحيحة',
    backGallery:  '← المعرض',
    logout:       'خروج',
    formTitle:    'تفاصيل الصورة',
    uploadedGallery: 'الصور المرفوعة',
  },
  en: {
    siteTitle:    'Hazem Gallery',
    galleryTitle: 'Our Work',
    adminLogin:   'Admin Login',
    filterAll:    'All',
    emptyMain:    'No images yet.\nLog in as admin to upload.',
    emptyAdmin:   'Upload your first image above',
    wa:           'WhatsApp',
    del:          'Delete',
    totalImages:  'Total Images',
    totalCol:     'Collections',
    totalCat:     'Categories',
    uploadTitle:  'Upload New Image',
    uploadSub:    'Single image or group → slider',
    nameLabel:    'Name / Project Title',
    namePH:       'e.g. ABC Company Logo',
    catLabel:     'Category',
    customCatLbl: 'Custom Category Name',
    customCatPH:  'e.g. Motion Graphic, Banner',
    selectFiles:  'Select Images',
    upload:       'Upload',
    exportJson:   'Export JSON',
    importJson:   'Import JSON',
    clearAll:     'Clear All',
    uploading:    'Uploading',
    of:           'of',
    uploadOk:     'Upload successful!',
    uploadFail:   'Upload failed',
    deleted:      'Removed from gallery',
    exported:     'Exported!',
    imported:     'Import complete',
    loginTitle:   'Admin Panel',
    loginSub:     'Enter your credentials to continue',
    userLbl:      'Username',
    passLbl:      'Password',
    loginBtn:     'Login',
    loginErr:     'Invalid username or password',
    backGallery:  '← Gallery',
    logout:       'Logout',
    formTitle:    'Image Details',
    uploadedGallery: 'Uploaded Images',
  },
};

let currentLang = localStorage.getItem(CONFIG.LANG_KEY) || 'ar';

function t(key) { return I18N[currentLang]?.[key] || I18N.ar[key] || key; }

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem(CONFIG.LANG_KEY, lang);
  const isAr = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir  = isAr ? 'rtl' : 'ltr';

  // Swap all data-i18n text nodes
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (el.dataset.i18nAttr) {
      el.setAttribute(el.dataset.i18nAttr, t(key));
    } else {
      el.textContent = t(key);
    }
  });

  // Update lang toggle button label
  const btn = document.getElementById('btn-lang');
  if (btn) btn.textContent = isAr ? 'EN' : 'ع';

  // Re-render gallery to refresh dynamic text (filter chips etc.)
  const isAdmin = !!document.getElementById('admin-dashboard');
  renderGallery({ isAdmin, showFilter: true });
}

/* ── 4. THEME ───────────────────────────────────────────────── */
function applyTheme(theme) {
  localStorage.setItem(CONFIG.THEME_KEY, theme);
  if (theme === 'light') {
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
  }
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
}

function toggleTheme() {
  const current = localStorage.getItem(CONFIG.THEME_KEY) || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ── 5. CATEGORY META ───────────────────────────────────────── */
const BUILT_IN = {
  logo:  { label:'Logo',  cls:'badge-logo'  },
  photo: { label:'Photo', cls:'badge-photo' },
};
function getCat(cat) { return BUILT_IN[cat] || { label: cat || 'Other', cls:'badge-other' }; }

/* ── 6. GALLERY RENDER ──────────────────────────────────────── */
let activeFilter = '';

function renderGallery({ isAdmin = false, showFilter = true } = {}) {
  const grid  = document.getElementById('gallery-grid');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('gallery-count');
  const clear = document.getElementById('btn-clear-all');
  if (!grid) return;

  const all    = loadImages();
  const images = activeFilter ? all.filter(i => i.category === activeFilter) : all;

  if (count) count.textContent = all.length;
  if (clear) clear.hidden = all.length === 0;

  // Update stats if in admin
  updateStats(all);

  grid.innerHTML = '';
  if (!images.length) { if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';

  images.forEach(rec => {
    grid.appendChild(rec.type === 'collection'
      ? buildCollectionCard(rec, isAdmin)
      : buildSingleCard(rec, isAdmin));
  });

  if (showFilter) renderFilterBar(all, isAdmin);
}

function updateStats(all) {
  const sv = document.getElementById('stat-total');
  const sc = document.getElementById('stat-collections');
  const sk = document.getElementById('stat-cats');
  if (!sv) return;
  const cols  = all.filter(i => i.type === 'collection').length;
  const cats  = new Set(all.map(i => i.category)).size;
  const imgs  = all.reduce((acc, i) =>
    acc + (i.type === 'collection' ? (i.images?.length || 0) : 1), 0);
  sv.textContent = imgs;
  sc.textContent = cols;
  sk.textContent = cats;
}

/* ── 7. CARD BUILDERS ───────────────────────────────────────── */

function buildSingleCard(rec, isAdmin) {
  const { url, name, category } = rec;
  const card = makeShell();
  const wrap = makeImgWrap();
  wrap.addEventListener('click', () => openLightbox([{ url }], 0));

  const img = makeImg(url, name);
  wrap.append(img, makeOverlay(), makeBadge(getCat(category)));
  card.append(wrap, makeFooter(rec, isAdmin, () => openLightbox([{ url }], 0)));
  return card;
}

function buildCollectionCard(rec, isAdmin) {
  const { name, category, images } = rec;
  const card = makeShell();
  card.classList.add('card-slider');
  let cur = 0;

  const wrap    = makeImgWrap();
  const img     = makeImg(images[0]?.url || '', name);
  img.style.transition = 'opacity .22s';
  const counter = document.createElement('span');
  counter.className = 'slide-counter';
  counter.textContent = `${cur + 1} / ${images.length}`;

  const bPrev = makeSliderArrow('prev', '‹');
  const bNext = makeSliderArrow('next', '›');
  const dots  = makeDots(images.length, cur);
  const colBadge = document.createElement('span');
  colBadge.className = 'collection-badge';
  colBadge.textContent = `🎞 ${images.length}`;

  function goTo(idx) {
    cur = (idx + images.length) % images.length;
    img.style.opacity = '0';
    setTimeout(() => { img.src = images[cur]?.url || ''; img.style.opacity = '1'; }, 120);
    counter.textContent = `${cur + 1} / ${images.length}`;
    dots.querySelectorAll('.slider-dot').forEach((d, i) => d.classList.toggle('active', i === cur));
  }

  bPrev.addEventListener('click', e => { e.stopPropagation(); goTo(cur - 1); });
  bNext.addEventListener('click', e => { e.stopPropagation(); goTo(cur + 1); });
  dots.querySelectorAll('.slider-dot').forEach((d, i) =>
    d.addEventListener('click', e => { e.stopPropagation(); goTo(i); }));

  // Click → collection lightbox starting at current slide
  wrap.addEventListener('click', () => openLightbox(images, cur));

  let auto = images.length > 1 ? setInterval(() => goTo(cur + 1), 3200) : null;
  card.addEventListener('mouseenter', () => clearInterval(auto));
  card.addEventListener('mouseleave', () => {
    if (images.length > 1) auto = setInterval(() => goTo(cur + 1), 3200);
  });

  wrap.append(img, makeOverlay(), makeBadge(getCat(category)), bPrev, bNext, dots, counter, colBadge);
  card.append(wrap, makeFooter(rec, isAdmin, () => openLightbox(images, cur)));
  return card;
}

/* Card helpers */
function makeShell() {
  const c = document.createElement('article');
  c.className = 'gallery-card'; c.setAttribute('role','listitem'); return c;
}
function makeImgWrap() { const d = document.createElement('div'); d.className = 'card-img-wrap'; return d; }
function makeImg(url, alt) {
  const i = document.createElement('img');
  i.src = url; i.alt = alt || ''; i.loading = 'lazy';
  i.onerror = () => { i.src = svgPlaceholder(); };
  return i;
}
function makeOverlay() {
  const d = document.createElement('div'); d.className = 'card-img-overlay';
  d.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  return d;
}
function makeBadge(cat) {
  const b = document.createElement('span');
  b.className = `card-badge ${cat.cls}`; b.textContent = cat.label; return b;
}
function makeSliderArrow(dir, html) {
  const b = document.createElement('button');
  b.className = `slider-arrow slider-${dir}`; b.innerHTML = html;
  b.setAttribute('aria-label', dir === 'prev' ? 'السابق' : 'التالي'); return b;
}
function makeDots(total, active) {
  const wrap = document.createElement('div'); wrap.className = 'slider-dots';
  for (let i = 0; i < total; i++) {
    const d = document.createElement('button');
    d.className = `slider-dot${i === active ? ' active' : ''}`;
    d.setAttribute('aria-label', `الصورة ${i + 1}`);
    wrap.appendChild(d);
  }
  return wrap;
}
function makeFooter(rec, isAdmin, onView) {
  const { name } = rec;
  const footer  = document.createElement('div'); footer.className = 'card-footer';
  const nm      = document.createElement('div'); nm.className = 'card-name';
  nm.textContent = name || (currentLang === 'ar' ? 'بدون عنوان' : 'Untitled');
  nm.title = name || '';

  const acts = document.createElement('div'); acts.className = 'card-actions';

  // WhatsApp
  const waMsg = encodeURIComponent(
    currentLang === 'ar'
      ? `مرحباً، أنا مهتم بـ "${name || 'هذا العمل'}" من معرض حازم`
      : `Hello, I'm interested in "${name || 'this work'}" from Hazem Gallery`
  );
  const btnWA = document.createElement('button');
  btnWA.className = 'btn btn-sm btn-whatsapp';
  btnWA.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.866-2.03-.967-.273-.101-.471-.15-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.197.594 4.251 1.629 6.013L.057 23.979l6.154-1.617A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.884 0-3.652-.51-5.17-1.4l-.37-.22-3.652.958.975-3.563-.24-.38A9.938 9.938 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg> ${t('wa')}`;
  btnWA.addEventListener('click', e => {
    e.stopPropagation();
    window.open(`https://wa.me/${CONFIG.WHATSAPP_NUM}?text=${waMsg}`, '_blank', 'noopener');
  });
  acts.appendChild(btnWA);

  if (isAdmin) {
    const bDel = document.createElement('button');
    bDel.className = 'btn btn-sm btn-danger';
    bDel.textContent = t('del');
    bDel.addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm(`${t('del')} "${name}"?`)) return;
      removeImage(rec);
      const card = bDel.closest('.gallery-card');
      if (card) { card.style.transition='opacity .22s,transform .22s'; card.style.opacity='0'; card.style.transform='scale(.95)'; }
      setTimeout(() => renderGallery({ isAdmin:true, showFilter:true }), 240);
      showToast(t('deleted'), 'success');
    });
    acts.appendChild(bDel);

    // Download button
    const bDL = document.createElement('button');
    bDL.className = 'btn btn-sm btn-ghost';
    bDL.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    bDL.title = currentLang === 'ar' ? 'تحميل الصورة' : 'Download image';
    bDL.setAttribute('aria-label', bDL.title);
    bDL.addEventListener('click', e => {
      e.stopPropagation();
      // For collection cards the getUrl callback returns the current slide url
      const url = rec.type === 'collection'
        ? (rec._currentUrl || rec.images?.[0]?.url)
        : rec.url;
      downloadImage(url, rec.name);
    });
    acts.appendChild(bDL);
  }

  footer.append(nm, acts);
  return footer;
}

/* ── IMAGE DOWNLOAD ─────────────────────────────────────────── */
/**
 * Fetches image as blob and triggers native browser download.
 * Falls back to opening in new tab if CORS blocks fetch.
 */
async function downloadImage(url, name) {
  if (!url) return;
  const filename = (name || 'image').replace(/[^a-zA-Z0-9\u0600-\u06FF\s_-]/g, '') || 'image';
  try {
    const res  = await fetch(url);
    const blob = await res.blob();
    const ext  = blob.type.split('/')[1] || 'jpg';
    const link = document.createElement('a');
    link.href     = URL.createObjectURL(blob);
    link.download = `${filename}.${ext}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 3000);
  } catch {
    // CORS fallback: open in new tab, user can save manually
    window.open(url, '_blank', 'noopener');
    showToast(currentLang === 'ar' ? 'افتح باnew tab واضغط حفظ' : 'Right-click → Save image', '');
  }
}

function renderFilterBar(all, isAdmin = false) {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  const counts = {};
  all.forEach(i => { counts[i.category] = (counts[i.category] || 0) + 1; });
  const chips = [{ key:'', label:`${t('filterAll')} (${all.length})` }];
  Object.entries(counts).forEach(([k, n]) => chips.push({ key:k, label:`${getCat(k).label} (${n})` }));
  bar.innerHTML = '';
  chips.forEach(({ key, label }) => {
    const c = document.createElement('button');
    c.className = `filter-chip${activeFilter===key?' active':''}`;
    c.textContent = label;
    c.addEventListener('click', () => { activeFilter = key; renderGallery({ isAdmin, showFilter:true }); });
    bar.appendChild(c);
  });
}

/* ── 9. LIGHTBOX ────────────────────────────────────────────── */
/** @type {Array<{url:string}>} current lightbox image list */
let lbImages = [];
let lbIndex  = 0;

/**
 * Opens lightbox.
 * @param {Array<{url:string}>} images
 * @param {number} startIdx
 */
function openLightbox(images, startIdx = 0) {
  lbImages = images;
  lbIndex  = startIdx;
  const lb      = document.getElementById('lightbox');
  const img     = document.getElementById('lightbox-img');
  const counter = document.getElementById('lb-counter');
  const bPrev   = document.getElementById('lb-prev');
  const bNext   = document.getElementById('lb-next');
  if (!lb || !img) return;

  const isMulti = images.length > 1;
  img.src = images[lbIndex]?.url || '';
  lb.hidden = false;
  document.body.style.overflow = 'hidden';

  if (counter) { counter.hidden = !isMulti; if (isMulti) counter.textContent = `${lbIndex + 1} / ${images.length}`; }
  if (bPrev) bPrev.hidden = !isMulti;
  if (bNext) bNext.hidden = !isMulti;
}

function lbGoTo(idx) {
  lbIndex = (idx + lbImages.length) % lbImages.length;
  const img     = document.getElementById('lightbox-img');
  const counter = document.getElementById('lb-counter');
  if (!img) return;
  img.style.opacity = '0';
  setTimeout(() => { img.src = lbImages[lbIndex]?.url || ''; img.style.opacity = '1'; }, 120);
  if (counter) counter.textContent = `${lbIndex + 1} / ${lbImages.length}`;
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  lb.hidden = true;
  document.getElementById('lightbox-img').src = '';
  lbImages = []; lbIndex = 0;
  document.body.style.overflow = '';
}

/* ── 10. TOAST ──────────────────────────────────────────────── */
let _tt = null;
function showToast(msg, type = '', duration = 3000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast show${type ? ' toast-'+type : ''}`;
  if (_tt) clearTimeout(_tt);
  if (duration > 0) _tt = setTimeout(() => el.classList.remove('show'), duration);
}

/* ── 11. WIRING ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme + lang
  applyTheme(localStorage.getItem(CONFIG.THEME_KEY) || 'dark');
  applyLang(localStorage.getItem(CONFIG.LANG_KEY) || 'ar');

  // Theme toggle
  document.getElementById('btn-theme')?.addEventListener('click', toggleTheme);

  // Lang toggle
  document.getElementById('btn-lang')?.addEventListener('click', () => {
    applyLang(currentLang === 'ar' ? 'en' : 'ar');
  });

  // Lightbox events
  const lb    = document.getElementById('lightbox');
  const lbBtn = document.getElementById('lightbox-close');
  const lbP   = document.getElementById('lb-prev');
  const lbN   = document.getElementById('lb-next');

  lbBtn?.addEventListener('click', closeLightbox);
  lb?.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  lbP?.addEventListener('click', e => { e.stopPropagation(); lbGoTo(lbIndex - 1); });
  lbN?.addEventListener('click', e => { e.stopPropagation(); lbGoTo(lbIndex + 1); });

  document.addEventListener('keydown', e => {
    if (!document.getElementById('lightbox') || document.getElementById('lightbox').hidden) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  lbGoTo(lbIndex - 1);
    if (e.key === 'ArrowRight') lbGoTo(lbIndex + 1);
  });
});

/* Export for admin.js */
if (typeof window !== 'undefined') {
  window.GalleryApp = {
    CONFIG, t, currentLang, loadImages, saveImages, addImage, removeImage,
    renderGallery, showToast, openLightbox, closeLightbox, updateStats,
  };
}

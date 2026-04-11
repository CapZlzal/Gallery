/**
 * admin.js — Admin panel logic v4
 *
 * Storage: Cloudinary is the source of truth.
 * Upload encodes all metadata (name, category, type, colId, seq)
 * in Cloudinary context + tags so the public list endpoint returns them.
 * No localStorage writes for image data.
 */

'use strict';

/* ── 1. AUTH ──────────────────────────────────────────────── */

const AUTH = {
  USERNAME: 'korata',
  PASSWORD: 'korata1250',
  STORAGE_KEY: 'admin_authed',
};

function isAuthed() { return localStorage.getItem(AUTH.STORAGE_KEY) === '1'; }
function doLogin() { localStorage.setItem(AUTH.STORAGE_KEY, '1'); }
function doLogout() { localStorage.removeItem(AUTH.STORAGE_KEY); window.location.reload(); }
function checkCred(u, p) { return u === AUTH.USERNAME && p === AUTH.PASSWORD; }

/* ── 2. STORAGE: Firebase Realtime DB ────────────────────── */
/*
 * Metadata is stored on Firebase Realtime Database (free, no auth in test mode).
 * Images are stored on Cloudinary via the unsigned upload preset.
 *
 * SETUP (2 minutes, no token needed):
 *   1. console.firebase.google.com → Add project → Continue → Continue → Create
 *   2. Realtime Database → Create database → Start in TEST MODE → Enable
 *   3. Copy the database URL and paste below
 */
// FB_URL is declared in app.js (loaded before admin.js in admin.html)

/** Read gallery records from Firebase. Returns []. */
async function readManifest() {
  try {
    const res = await fetch(`${FB_URL}/gallery.json?t=${Date.now()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data && typeof data === 'object' ? Object.values(data) : [];
  } catch { return []; }
}

/** Append a new record to Firebase. */
async function appendToManifest(rec) {
  if (!FB_URL || FB_URL.startsWith('PASTE')) {
    throw new Error('أضف Firebase URL في admin.js سطر 36');
  }
  const res = await fetch(`${FB_URL}/gallery.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rec),
  });
  if (!res.ok) throw new Error(`Firebase write failed: ${res.status}`);
  invalidateCache();
}

/** Upload one image to Cloudinary via UNSIGNED preset. Returns { url, publicId }. */
async function uploadToCloudinary(file, name, category, extra = {}) {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } = CONFIG;
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const safeName = name.replace(/[|=]/g, ' ').trim() || file.name;

  let ctx = `caption=${safeName}|alt=${category}`;
  if (extra.colId) ctx += `|type=collection|col=${extra.colId}|seq=${extra.seq ?? 0}`;
  else ctx += `|type=single`;

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  form.append('context', ctx);

  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return { url: data.secure_url, publicId: data.public_id };
}

/* ── 3. STATUS / PROGRESS ─────────────────────────────────── */

function setStatus(msg, type = '') {
  const el = document.getElementById('upload-status');
  if (!el) return;
  el.textContent = msg;
  el.className = `upload-status${type ? ' ' + type : ''}`;
}

function setProgress(pct) {
  const wrap = document.getElementById('progress-wrap');
  const bar = document.getElementById('progress-bar');
  if (!wrap || !bar) return;
  if (pct === 0) { wrap.hidden = true; bar.style.width = '0%'; return; }
  wrap.hidden = false;
  bar.style.width = `${Math.min(100, pct)}%`;
}

/* ── 4. PREVIEW STRIP ─────────────────────────────────────── */

let pendingFiles = [];

function renderPreview() {
  const strip = document.getElementById('preview-strip');
  const uploadBtn = document.getElementById('btn-upload');
  if (!strip) return;

  strip.innerHTML = '';
  pendingFiles.forEach((file, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'preview-thumb';
    thumb.setAttribute('role', 'listitem');

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;

    const rm = document.createElement('button');
    rm.className = 'remove-preview';
    rm.textContent = '✕';
    rm.setAttribute('aria-label', `Remove ${file.name}`);
    rm.addEventListener('click', e => {
      e.stopPropagation();
      URL.revokeObjectURL(img.src);
      pendingFiles.splice(i, 1);
      renderPreview();
    });

    thumb.append(img, rm);
    strip.appendChild(thumb);
  });

  if (pendingFiles.length > 1) {
    const badge = document.createElement('div');
    badge.className = 'slider-badge';
    badge.textContent = `📽 ${pendingFiles.length} ${currentLang === 'ar' ? 'صور → slider' : 'images → slider'}`;
    strip.appendChild(badge);
  }

  if (uploadBtn) uploadBtn.disabled = pendingFiles.length === 0;
}

/* ── 5. UPLOAD HANDLER ────────────────────────────────────── */

function resolveCategory() {
  const sel = document.getElementById('inp-category')?.value || 'other';
  if (sel === 'other') {
    const custom = document.getElementById('inp-custom-cat')?.value.trim();
    return custom || 'other';
  }
  return sel;
}

async function handleUpload() {
  if (pendingFiles.length === 0) return;

  const name = (document.getElementById('inp-img-name')?.value || '').trim();
  if (!name) {
    showToast('⚠️ ' + (currentLang === 'ar' ? 'أدخل الاسم أولاً' : 'Enter a name first'), 'error');
    document.getElementById('inp-img-name')?.focus();
    return;
  }

  const category = resolveCategory();
  const btnUpload = document.getElementById('btn-upload');
  const btnSelect = document.getElementById('btn-select');

  btnUpload?.classList.add('loading');
  if (btnUpload) btnUpload.disabled = true;
  if (btnSelect) btnSelect.disabled = true;
  setProgress(0);

  const total = pendingFiles.length;
  const isCollection = total > 1;
  const colId = isCollection ? `hg_col_${Date.now()}` : null;
  let done = 0, failed = 0;
  const uploadedImages = [];

  for (const file of pendingFiles) {
    setStatus(`${t('uploading')} ${done + 1} ${t('of')} ${total}: ${file.name}`, '');
    const extra = colId ? { colId, seq: done } : {};

    try {
      const result = await uploadToCloudinary(file, name, category, extra);
      uploadedImages.push(result);
      done++;
      setProgress((done / total) * 100);
    } catch (err) {
      failed++;
      console.error('Upload failed:', file.name, err);
    }
  }

  // Save metadata to Cloudinary manifest
  if (uploadedImages.length > 0) {
    try {
      setStatus(currentLang === 'ar' ? 'جاري الحفظ…' : 'Saving…', '');
      const rec = isCollection
        ? { type: 'collection', name, category, images: uploadedImages, uploadedAt: new Date().toISOString() }
        : { type: 'single', name, category, url: uploadedImages[0].url, publicId: uploadedImages[0].publicId, uploadedAt: new Date().toISOString() };
      await appendToManifest(rec);
    } catch (err) {
      console.error('Manifest write failed:', err);
      showToast(`فشل الحفظ: ${err.message}`, 'error');
    }
  } else {
    invalidateCache();
  }

  btnUpload?.classList.remove('loading');
  if (btnUpload) btnUpload.disabled = false;
  if (btnSelect) btnSelect.disabled = false;
  document.getElementById('file-input').value = '';
  document.getElementById('inp-img-name').value = '';
  document.getElementById('inp-custom-cat').value = '';
  pendingFiles = [];
  renderPreview();
  setProgress(0);

  await renderGallery({ isAdmin: true, showFilter: true, force: true });

  if (failed === 0) {
    setStatus(`✓ ${t('uploadOk')}`, 'success');
    showToast(t('uploadOk'), 'success');
  } else {
    setStatus(`${done} ✓  ${failed} ✗`, 'error');
    showToast(`${failed} ${t('uploadFail')}`, 'error');
  }
  setTimeout(() => setStatus(''), 6000);
}

/* ── 6. DRAG & DROP ───────────────────────────────────────── */

function addDragHandlers(zone) {
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (!files.length) { showToast(currentLang === 'ar' ? 'فقط ملفات الصور مسموحة' : 'Images only', 'error'); return; }
    pendingFiles = [...pendingFiles, ...files];
    renderPreview();
  });
}

/* ── 7. WIRING ────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {

  const loginOverlay = document.getElementById('login-overlay');
  const adminDash = document.getElementById('admin-dashboard');

  if (isAuthed()) {
    loginOverlay.hidden = true;
    adminDash.classList.add('visible');
    renderGallery({ isAdmin: true, showFilter: true });
  } else {
    loginOverlay.hidden = false;
    setTimeout(() => document.getElementById('inp-username')?.focus(), 120);
  }

  document.getElementById('login-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const u = document.getElementById('inp-username').value.trim();
    const p = document.getElementById('inp-password').value;
    const errEl = document.getElementById('login-error');
    const btnLog = document.getElementById('btn-login');

    errEl.textContent = '';
    btnLog.classList.add('loading');
    btnLog.disabled = true;

    setTimeout(() => {
      if (checkCred(u, p)) {
        doLogin();
        loginOverlay.hidden = true;
        adminDash.classList.add('visible');
        renderGallery({ isAdmin: true, showFilter: true });
      } else {
        errEl.textContent = t('loginErr');
        btnLog.classList.remove('loading');
        btnLog.disabled = false;
        document.getElementById('inp-password').value = '';
        document.getElementById('inp-username')?.select();
      }
    }, 500);
  });

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    if (confirm(currentLang === 'ar' ? 'تسجيل الخروج؟' : 'Logout?')) doLogout();
  });

  const catSelect = document.getElementById('inp-category');
  const customCatWrap = document.getElementById('custom-cat-wrap');
  const customCatInp = document.getElementById('inp-custom-cat');

  catSelect?.addEventListener('change', () => {
    const show = catSelect.value === 'other';
    customCatWrap.style.display = show ? 'block' : 'none';
    if (show) customCatInp?.focus();
    else if (customCatInp) customCatInp.value = '';
  });

  const fileInput = document.getElementById('file-input');
  const btnSelect = document.getElementById('btn-select');
  const dropZone = document.getElementById('drop-zone');

  btnSelect?.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });

  fileInput?.addEventListener('change', () => {
    const files = Array.from(fileInput.files).filter(f => f.type.startsWith('image/'));
    pendingFiles = [...pendingFiles, ...files];
    renderPreview();
    fileInput.value = '';
  });

  dropZone?.addEventListener('click', e => {
    if (e.target.closest('button, input, select, label')) return;
    fileInput.click();
  });

  addDragHandlers(dropZone);
  addDragHandlers(document.body);

  document.getElementById('btn-upload')?.addEventListener('click', e => {
    e.stopPropagation();
    handleUpload();
  });

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    invalidateCache();
    renderGallery({ isAdmin: true, showFilter: true, force: true });
    showToast(currentLang === 'ar' ? 'جاري التحديث…' : 'Refreshing…', '');
  });

  document.getElementById('btn-clear-all')?.addEventListener('click', () => {
    if (!confirm(currentLang === 'ar'
      ? 'مسح قائمة الصور المخفية؟ (الصور تبقى على Cloudinary)'
      : 'Clear hidden list? (Images stay on Cloudinary)')) return;
    localStorage.removeItem(CONFIG.HIDDEN_KEY);
    invalidateCache();
    renderGallery({ isAdmin: true, showFilter: true, force: true });
    showToast(t('deleted'), 'success');
  });
});

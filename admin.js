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

/* ── 2. UPLOAD ENGINE ─────────────────────────────────────── */

/*
 * Cloudinary credentials for SIGNED uploads.
 * Signed uploads are NOT restricted by upload preset — tags and context
 * are always applied server-side, so the list endpoint always works.
 * Get these from: Cloudinary Dashboard → API Keys
 */
const CLOUD_KEY = '721424188689927';      // e.g. 123456789012345
const CLOUD_SECRET = 'UicHjL7W0vU91TPN8RsTW1bMnf8';   // e.g. abCdEfGhIjKlMnOpQrStUvWxYz

/** SHA-1 digest using Web Crypto API (needed to sign Cloudinary requests). */
async function sha1(str) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Uploads one file to Cloudinary using a SIGNED request.
 * Tags and context are guaranteed to be stored by Cloudinary.
 */
async function uploadToCloudinary(file, name, category, extra = {}) {
  const { CLOUDINARY_CLOUD_NAME, GALLERY_TAG } = CONFIG;
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  if (!CLOUD_KEY || CLOUD_KEY.startsWith('PASTE')) {
    throw new Error('أضف CLOUD_KEY و CLOUD_SECRET في admin.js');
  }

  const safeName = name.replace(/[|=]/g, ' ').trim() || file.name;

  let ctx = `caption=${safeName}|alt=${category}`;
  if (extra.colId) {
    ctx += `|type=collection|col=${extra.colId}|seq=${extra.seq ?? 0}`;
  } else {
    ctx += `|type=single`;
  }

  const tags = [GALLERY_TAG, category];
  if (extra.colId) tags.push(extra.colId);
  const tagsStr = tags.join(',');

  const timestamp = Math.round(Date.now() / 1000);

  // Params to sign — sorted alphabetically, no api_key/file/resource_type/cloud_name
  const sigParams = `context=${ctx}&tags=${tagsStr}&timestamp=${timestamp}${CLOUD_SECRET}`;
  const signature = await sha1(sigParams);

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', CLOUD_KEY);
  form.append('timestamp', timestamp);
  form.append('signature', signature);
  form.append('context', ctx);
  form.append('tags', tagsStr);

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

  for (const file of pendingFiles) {
    setStatus(`${t('uploading')} ${done + 1} ${t('of')} ${total}: ${file.name}`, '');
    const extra = colId ? { colId, seq: done } : {};

    try {
      await uploadToCloudinary(file, name, category, extra);
      done++;
      setProgress((done / total) * 100);
    } catch (err) {
      failed++;
      console.error('Upload failed:', file.name, err);
    }
  }

  invalidateCache();

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

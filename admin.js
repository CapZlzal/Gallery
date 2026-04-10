/**
 * admin.js — Admin panel logic
 *
 * Features:
 *   1. AUTH        — localStorage persistence (survives browser close)
 *   2. UPLOAD      — single image OR multi-image collection (slider)
 *   3. CATEGORY    — Logo / Photo / custom "other" text
 *   4. PREVIEW     — thumbnail strip before upload
 *   5. DRAG-DROP   — drag files onto the upload card
 *   6. EXPORT/IMPORT — JSON backup/restore
 */

'use strict';

/* ── 1. AUTH ──────────────────────────────────────────────── */

const AUTH = {
  USERNAME:    'korata',
  PASSWORD:    'korata1250',
  STORAGE_KEY: 'admin_authed',  // localStorage — persists after browser close
};

function isAuthed()  { return localStorage.getItem(AUTH.STORAGE_KEY) === '1'; }
function doLogin()   { localStorage.setItem(AUTH.STORAGE_KEY, '1'); }
function doLogout()  { localStorage.removeItem(AUTH.STORAGE_KEY); window.location.reload(); }
function checkCred(u, p) { return u === AUTH.USERNAME && p === AUTH.PASSWORD; }

/* ── 2. UPLOAD ENGINE ─────────────────────────────────────── */

/**
 * Uploads one file to Cloudinary with name + category stored in context.
 * @returns {Promise<{url:string, publicId:string}>}
 */
async function uploadToCloudinary(file, name, category) {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } = CONFIG;
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  const form = new FormData();
  form.append('file',           file);
  form.append('upload_preset',  CLOUDINARY_UPLOAD_PRESET);
  // Store name & category as Cloudinary context metadata
  const safeName = name.replace(/[|=]/g, ' ').trim() || file.name;
  form.append('context', `caption=${safeName}|alt=${category}`);
  form.append('tags', category);

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
  const bar  = document.getElementById('progress-bar');
  if (!wrap || !bar) return;
  if (pct === 0) { wrap.hidden = true; bar.style.width = '0%'; return; }
  wrap.hidden = false;
  bar.style.width = `${Math.min(100, pct)}%`;
}

/* ── 4. PREVIEW STRIP ─────────────────────────────────────── */

let pendingFiles = [];

function renderPreview() {
  const strip     = document.getElementById('preview-strip');
  const uploadBtn = document.getElementById('btn-upload');
  if (!strip) return;

  strip.innerHTML = '';
  pendingFiles.forEach((file, i) => {
    const thumb  = document.createElement('div');
    thumb.className = 'preview-thumb';
    thumb.setAttribute('role', 'listitem');

    const img = document.createElement('img');
    img.src   = URL.createObjectURL(file);
    img.alt   = file.name;

    const rm = document.createElement('button');
    rm.className = 'remove-preview';
    rm.textContent = '✕';
    rm.setAttribute('aria-label', `إزالة ${file.name}`);
    rm.addEventListener('click', e => {
      e.stopPropagation();
      URL.revokeObjectURL(img.src);
      pendingFiles.splice(i, 1);
      renderPreview();
    });

    thumb.append(img, rm);
    strip.appendChild(thumb);
  });

  // Badge showing "will become slider" when >1 file
  if (pendingFiles.length > 1) {
    const badge = document.createElement('div');
    badge.className = 'slider-badge';
    badge.textContent = `📽 ${pendingFiles.length} صور → slider`;
    strip.appendChild(badge);
  }

  if (uploadBtn) uploadBtn.disabled = pendingFiles.length === 0;
}

/* ── 5. UPLOAD HANDLER ────────────────────────────────────── */

/**
 * Resolves category: if "other", uses custom text input value.
 * @returns {string}
 */
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

  const category  = resolveCategory();
  const btnUpload = document.getElementById('btn-upload');
  const btnSelect = document.getElementById('btn-select');

  btnUpload?.classList.add('loading');
  if (btnUpload) btnUpload.disabled = true;
  if (btnSelect) btnSelect.disabled = true;
  setProgress(0);

  const total  = pendingFiles.length;
  const isCollection = total > 1;
  let done = 0, failed = 0;
  const collectionImages = [];

  for (const file of pendingFiles) {
    // For collections each image shares the project name
    const imgLabel = isCollection ? `${name} (${done + 1}/${total})` : name;
    setStatus(`جاري رفع ${done + 1} من ${total}: ${file.name}`, '');

    try {
      const { url, publicId } = await uploadToCloudinary(file, imgLabel, category);
      if (isCollection) {
        collectionImages.push({ url, publicId });
      } else {
        // Single image → normal record
        addImage({ type: 'single', url, name, category, publicId, uploadedAt: new Date().toISOString() });
      }
      done++;
      setProgress((done / total) * 100);
    } catch (err) {
      failed++;
      console.error('Upload failed:', file.name, err);
    }
  }

  // Save collection as one record
  if (isCollection && collectionImages.length > 0) {
    addImage({
      type:        'collection',
      name,
      category,
      images:      collectionImages,      // array of { url, publicId }
      uploadedAt:  new Date().toISOString(),
    });
  }

  // Reset
  btnUpload?.classList.remove('loading');
  if (btnUpload) btnUpload.disabled = false;
  if (btnSelect) btnSelect.disabled = false;
  document.getElementById('file-input').value        = '';
  document.getElementById('inp-img-name').value      = '';
  document.getElementById('inp-custom-cat').value    = '';
  pendingFiles = [];
  renderPreview();
  setProgress(0);
  renderGallery({ isAdmin: true, showFilter: true });

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


/* ── 8. WIRING ────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {

  /* ─ Auth check ─ */
  const loginOverlay = document.getElementById('login-overlay');
  const adminDash    = document.getElementById('admin-dashboard');

  if (isAuthed()) {
    loginOverlay.hidden = true;
    adminDash.classList.add('visible');
    renderGallery({ isAdmin: true, showFilter: true });
  } else {
    loginOverlay.hidden = false;
    setTimeout(() => document.getElementById('inp-username')?.focus(), 120);
  }

  /* ─ Login form ─ */
  document.getElementById('login-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const u      = document.getElementById('inp-username').value.trim();
    const p      = document.getElementById('inp-password').value;
    const errEl  = document.getElementById('login-error');
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

  /* ─ Logout ─ */
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    if (confirm('تسجيل الخروج؟')) doLogout();
  });

  /* ─ Custom category toggle ─ */
  const catSelect     = document.getElementById('inp-category');
  const customCatWrap = document.getElementById('custom-cat-wrap');
  const customCatInp  = document.getElementById('inp-custom-cat');

  catSelect?.addEventListener('change', () => {
    const show = catSelect.value === 'other';
    customCatWrap.style.display = show ? 'block' : 'none';
    if (show) customCatInp?.focus();
    else if (customCatInp) customCatInp.value = '';
  });

  /* ─ File selection ─ */
  const fileInput = document.getElementById('file-input');
  const btnSelect = document.getElementById('btn-select');
  const dropZone  = document.getElementById('drop-zone');

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

  /* ─ Upload ─ */
  document.getElementById('btn-upload')?.addEventListener('click', e => {
    e.stopPropagation();
    handleUpload();
  });

  /* ─ Clear all ─ */
  document.getElementById('btn-clear-all')?.addEventListener('click', () => {
    if (!confirm(currentLang === 'ar' ? 'مسح كل الصور؟' : 'Clear all images?')) return;
    saveImages([]);
    renderGallery({ isAdmin: true, showFilter: true });
    showToast(t('deleted'), 'success');
  });

});


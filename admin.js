/**
 * admin.js — Admin panel logic v5
 *
 * Gallery metadata stored in gallery-data.json on GitHub.
 * Images stored on Cloudinary.
 *
 * Requires: CONFIG.GH_TOKEN set below (personal access token with repo scope)
 */

'use strict';

/* ── GITHUB TOKEN ────────────────────────────────────────────── */
// Get from: GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
// Permissions needed: repo (or just 'public_repo' if repo is public)
const GH_TOKEN = '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';

/* ── 1. AUTH ──────────────────────────────────────────────────── */
const AUTH = { USERNAME: 'korata', PASSWORD: 'korata1250', STORAGE_KEY: 'admin_authed' };
function isAuthed() { return localStorage.getItem(AUTH.STORAGE_KEY) === '1'; }
function doLogin() { localStorage.setItem(AUTH.STORAGE_KEY, '1'); }
function doLogout() { localStorage.removeItem(AUTH.STORAGE_KEY); window.location.reload(); }
function checkCred(u, p) { return u === AUTH.USERNAME && p === AUTH.PASSWORD; }

/* ── 2. GITHUB STORAGE OPERATIONS ─────────────────────────────── */

const GH_API = `https://api.github.com/repos/${CONFIG.GH_OWNER}/${CONFIG.GH_REPO}/contents/${CONFIG.GH_FILE}`;

function ghHeaders() {
  return {
    'Authorization': `token ${GH_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

/**
 * Reads the current gallery-data.json from GitHub API.
 * Returns { data:Array, sha:string } — sha needed for updates.
 */
async function ghRead() {
  const res = await fetch(`${GH_API}?t=${Date.now()}`, { headers: ghHeaders() });
  if (res.status === 404) return { data: [], sha: null };
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
  const json = await res.json();
  const data = JSON.parse(atob(json.content.replace(/\n/g, '')));
  return { data: Array.isArray(data) ? data : [], sha: json.sha };
}

/**
 * Writes the gallery-data array back to GitHub.
 * @param {Array}  data — full gallery array
 * @param {string} sha  — current file SHA (null for first write)
 * @param {string} msg  — commit message
 */
async function ghWrite(data, sha, msg = 'Update gallery') {
  const body = {
    message: msg,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
    branch: CONFIG.GH_BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(GH_API, { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub write failed: ${res.status}`);
  }
}

/** Adds a new record to gallery-data.json on GitHub. */
async function ghAddRecord(rec) {
  const { data, sha } = await ghRead();
  const newData = [rec, ...data];
  await ghWrite(newData, sha, `Add: ${rec.name}`);
  invalidateCache();
}

/** Removes a record from gallery-data.json and optionally deletes from Cloudinary. */
async function ghDeleteRecord(rec) {
  const { data, sha } = await ghRead();

  // Identify record by publicId (single) or first image publicId (collection)
  const recKey = rec.type === 'collection' ? rec.images?.[0]?.publicId : rec.publicId;
  const newData = data.filter(r => {
    const k = r.type === 'collection' ? r.images?.[0]?.publicId : r.publicId;
    return k !== recKey;
  });

  await ghWrite(newData, sha, `Delete: ${rec.name}`);

  // Also delete image file(s) from Cloudinary (best-effort)
  const ids = rec.type === 'collection'
    ? rec.images.map(i => i.publicId).filter(Boolean)
    : [rec.publicId].filter(Boolean);
  for (const id of ids) {
    try { await deleteFromCloudinary(id); } catch (e) { console.warn('Cloudinary delete:', e); }
  }

  invalidateCache();
}

// Expose delete to app.js makeFooter via window
window.AdminOps = { deleteRecord: ghDeleteRecord };

/* ── 3. UPLOAD ENGINE ─────────────────────────────────────────── */

async function uploadToCloudinary(file, name, category) {
  const endpoint = `https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_CLOUD_NAME}/image/upload`;
  const safeName = name.replace(/[|=]/g, ' ').trim() || file.name;
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', CONFIG.CLOUDINARY_UPLOAD_PRESET);
  form.append('context', `caption=${safeName}|alt=${category}`);
  form.append('folder', 'hg_gallery');
  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${res.status}`); }
  const data = await res.json();
  return { url: data.secure_url, publicId: data.public_id };
}

/* ── 4. STATUS / PROGRESS ─────────────────────────────────────── */
function setStatus(msg, type = '') {
  const el = document.getElementById('upload-status');
  if (!el) return; el.textContent = msg; el.className = `upload-status${type ? ' ' + type : ''}`;
}
function setProgress(pct) {
  const wrap = document.getElementById('progress-wrap'), bar = document.getElementById('progress-bar');
  if (!wrap || !bar) return;
  if (pct === 0) { wrap.hidden = true; bar.style.width = '0%'; return; }
  wrap.hidden = false; bar.style.width = `${Math.min(100, pct)}%`;
}

/* ── 5. PREVIEW STRIP ─────────────────────────────────────────── */
let pendingFiles = [];

function renderPreview() {
  const strip = document.getElementById('preview-strip');
  const uploadBtn = document.getElementById('btn-upload');
  if (!strip) return;
  strip.innerHTML = '';
  pendingFiles.forEach((file, i) => {
    const thumb = document.createElement('div'); thumb.className = 'preview-thumb';
    const img = document.createElement('img'); img.src = URL.createObjectURL(file); img.alt = file.name;
    const rm = document.createElement('button'); rm.className = 'remove-preview'; rm.textContent = '✕';
    rm.addEventListener('click', e => { e.stopPropagation(); URL.revokeObjectURL(img.src); pendingFiles.splice(i, 1); renderPreview(); });
    thumb.append(img, rm); strip.appendChild(thumb);
  });
  if (pendingFiles.length > 1) {
    const badge = document.createElement('div'); badge.className = 'slider-badge';
    badge.textContent = `📽 ${pendingFiles.length} ${currentLang === 'ar' ? 'صور → slider' : 'images → slider'}`;
    strip.appendChild(badge);
  }
  if (uploadBtn) uploadBtn.disabled = pendingFiles.length === 0;
}

/* ── 6. UPLOAD HANDLER ────────────────────────────────────────── */
function resolveCategory() {
  const sel = document.getElementById('inp-category')?.value || 'other';
  if (sel === 'other') { const c = document.getElementById('inp-custom-cat')?.value.trim(); return c || 'other'; }
  return sel;
}

async function handleUpload() {
  if (!pendingFiles.length) return;
  const name = (document.getElementById('inp-img-name')?.value || '').trim();
  if (!name) { showToast('⚠ ' + (currentLang === 'ar' ? 'أدخل الاسم أولاً' : 'Enter a name first'), 'error'); document.getElementById('inp-img-name')?.focus(); return; }
  if (!GH_TOKEN || GH_TOKEN.startsWith('PASTE')) { showToast('⚠ أضف GitHub Token في admin.js', 'error'); return; }

  const category = resolveCategory();
  const btnUpload = document.getElementById('btn-upload');
  const btnSelect = document.getElementById('btn-select');
  btnUpload?.classList.add('loading'); if (btnUpload) btnUpload.disabled = true; if (btnSelect) btnSelect.disabled = true;
  setProgress(0);

  const total = pendingFiles.length;
  const isCollection = total > 1;
  let done = 0, failed = 0;
  const uploadedImages = [];

  for (const file of pendingFiles) {
    setStatus(`${t('uploading')} ${done + 1} ${t('of')} ${total}: ${file.name}`, '');
    try {
      const { url, publicId } = await uploadToCloudinary(file, name, category);
      uploadedImages.push({ url, publicId });
      done++; setProgress((done / total) * 100);
    } catch (err) { failed++; console.error('Upload failed:', file.name, err); }
  }

  // Save metadata to GitHub
  if (uploadedImages.length > 0) {
    const rec = isCollection
      ? { type: 'collection', name, category, images: uploadedImages, uploadedAt: new Date().toISOString() }
      : { type: 'single', name, category, url: uploadedImages[0].url, publicId: uploadedImages[0].publicId, uploadedAt: new Date().toISOString() };
    try {
      setStatus(currentLang === 'ar' ? 'جاري الحفظ على GitHub…' : 'Saving to GitHub…', '');
      await ghAddRecord(rec);
    } catch (err) {
      console.error('GitHub write failed:', err);
      showToast(`فشل الحفظ: ${err.message}`, 'error');
    }
  }

  btnUpload?.classList.remove('loading');
  if (btnUpload) btnUpload.disabled = false; if (btnSelect) btnSelect.disabled = false;
  document.getElementById('file-input').value = '';
  document.getElementById('inp-img-name').value = '';
  document.getElementById('inp-custom-cat').value = '';
  pendingFiles = []; renderPreview(); setProgress(0);

  await renderGallery({ isAdmin: true, showFilter: true, force: true });
  if (failed === 0) { setStatus(`✓ ${t('uploadOk')}`, 'success'); showToast(t('uploadOk'), 'success'); }
  else { setStatus(`${done} ✓  ${failed} ✗`, 'error'); showToast(`${failed} ${t('uploadFail')}`, 'error'); }
  setTimeout(() => setStatus(''), 6000);
}

/* ── 7. DRAG & DROP ──────────────────────────────────────────── */
function addDragHandlers(zone) {
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (!files.length) { showToast(currentLang === 'ar' ? 'فقط ملفات الصور' : 'Images only', 'error'); return; }
    pendingFiles = [...pendingFiles, ...files]; renderPreview();
  });
}

/* ── 8. WIRING ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const loginOverlay = document.getElementById('login-overlay');
  const adminDash = document.getElementById('admin-dashboard');

  if (isAuthed()) {
    loginOverlay.hidden = true; adminDash.classList.add('visible');
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
    errEl.textContent = ''; btnLog.classList.add('loading'); btnLog.disabled = true;
    setTimeout(() => {
      if (checkCred(u, p)) { doLogin(); loginOverlay.hidden = true; adminDash.classList.add('visible'); renderGallery({ isAdmin: true, showFilter: true }); }
      else { errEl.textContent = t('loginErr'); btnLog.classList.remove('loading'); btnLog.disabled = false; document.getElementById('inp-password').value = ''; document.getElementById('inp-username')?.select(); }
    }, 500);
  });

  document.getElementById('btn-logout')?.addEventListener('click', () => { if (confirm(currentLang === 'ar' ? 'تسجيل الخروج؟' : 'Logout?')) doLogout(); });

  const catSelect = document.getElementById('inp-category');
  const customCatWrap = document.getElementById('custom-cat-wrap');
  const customCatInp = document.getElementById('inp-custom-cat');
  catSelect?.addEventListener('change', () => {
    const show = catSelect.value === 'other';
    customCatWrap.style.display = show ? 'block' : 'none';
    if (show) customCatInp?.focus(); else if (customCatInp) customCatInp.value = '';
  });

  const fileInput = document.getElementById('file-input');
  const btnSelect = document.getElementById('btn-select');
  const dropZone = document.getElementById('drop-zone');
  btnSelect?.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
  fileInput?.addEventListener('change', () => {
    const files = Array.from(fileInput.files).filter(f => f.type.startsWith('image/'));
    pendingFiles = [...pendingFiles, ...files]; renderPreview(); fileInput.value = '';
  });
  dropZone?.addEventListener('click', e => { if (e.target.closest('button,input,select,label')) return; fileInput.click(); });
  addDragHandlers(dropZone); addDragHandlers(document.body);

  document.getElementById('btn-upload')?.addEventListener('click', e => { e.stopPropagation(); handleUpload(); });
  document.getElementById('btn-refresh')?.addEventListener('click', () => { invalidateCache(); renderGallery({ isAdmin: true, showFilter: true, force: true }); showToast(currentLang === 'ar' ? 'جاري التحديث…' : 'Refreshing…', ''); });
  document.getElementById('btn-clear-all')?.addEventListener('click', () => {
    if (!confirm(currentLang === 'ar' ? 'مسح كل الصور؟' : 'Clear all?')) return;
    ghRead().then(({ sha }) => ghWrite([], sha, 'Clear all').then(() => { invalidateCache(); renderGallery({ isAdmin: true, showFilter: true, force: true }); showToast(t('deleted'), 'success'); })).catch(err => showToast(err.message, 'error'));
  });
});

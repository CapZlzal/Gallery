/**
 * app.js — Portfolio Gallery
 *
 * Architecture:
 *   1. CONFIG          — the only place to set Cloudinary credentials
 *   2. Storage helpers — localStorage read/write/delete
 *   3. UI helpers      — toast, status, progress, preview strip
 *   4. Upload engine   — one image at a time, returns secure_url
 *   5. Gallery render  — builds DOM from stored URLs
 *   6. Event wiring    — binds all interactions on DOMContentLoaded
 */

'use strict';

/* ── 1. CONFIG ──────────────────────────────────────────────────────────────
   ⚠️  Fill in your own values before deploying.
   - CLOUDINARY_CLOUD_NAME: found on your Cloudinary dashboard home page
   - CLOUDINARY_UPLOAD_PRESET: an *unsigned* preset (Settings → Upload → Presets)
   These are intentionally public — unsigned presets don't expose your API secret.
   ─────────────────────────────────────────────────────────────────────────── */
const CONFIG = {
  CLOUDINARY_CLOUD_NAME: 'dd3tq14rb',        // e.g. 'my-portfolio-123'
  CLOUDINARY_UPLOAD_PRESET: 'portfolio_unsigned',     // e.g. 'portfolio_unsigned'
  STORAGE_KEY: 'gallery_images',                       // localStorage key
};

/* ── 2. STORAGE HELPERS ─────────────────────────────────────────────────── */

/**
 * Returns the list of image objects from localStorage.
 * Each object: { url: string, uploadedAt: string (ISO) }
 * @returns {Array<{url: string, uploadedAt: string}>}
 */
function loadImages() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Saves the full image list back to localStorage.
 * @param {Array<{url: string, uploadedAt: string}>} images
 */
function saveImages(images) {
  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(images));
}

/**
 * Appends a new image URL to storage.
 * @param {string} url
 */
function addImage(url) {
  const images = loadImages();
  images.unshift({ url, uploadedAt: new Date().toISOString() }); // newest first
  saveImages(images);
}

/**
 * Removes a specific URL from storage.
 * @param {string} url
 */
function removeImage(url) {
  const images = loadImages().filter(img => img.url !== url);
  saveImages(images);
}

/* ── 3. UI HELPERS ──────────────────────────────────────────────────────── */

/** @type {number|null} Toast hide timer */
let toastTimer = null;

/**
 * Shows a toast notification.
 * @param {string} message
 * @param {'success'|'error'|''} type
 * @param {number} duration  ms before auto-hide (0 = manual)
 */
function showToast(message, type = '', duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show${type ? ' toast-' + type : ''}`;
  if (toastTimer) clearTimeout(toastTimer);
  if (duration > 0) {
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }
}

/**
 * Updates the status paragraph below the upload button.
 * @param {string} message
 * @param {'success'|'error'|''} type
 */
function setStatus(message, type = '') {
  const el = document.getElementById('upload-status');
  el.textContent = message;
  el.className = `upload-status${type ? ' ' + type : ''}`;
}

/**
 * Updates the progress bar width (0–100).
 * @param {number} pct
 */
function setProgress(pct) {
  const wrap = document.getElementById('progress-wrap');
  const bar = document.getElementById('progress-bar');
  if (pct === 0) {
    wrap.hidden = true;
    bar.style.width = '0%';
  } else {
    wrap.hidden = false;
    bar.style.width = `${Math.min(100, pct)}%`;
  }
}

/* ── 4. UPLOAD ENGINE ───────────────────────────────────────────────────── */

/**
 * Uploads a single File to Cloudinary via unsigned upload preset.
 * @param {File} file
 * @returns {Promise<string>} Resolves with the secure_url
 */
async function uploadToCloudinary(file) {
  const endpoint = `https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_CLOUD_NAME}/image/upload`;

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', CONFIG.CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(endpoint, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.secure_url; // CDN URL of the uploaded image
}

/* ── 5. GALLERY RENDER ──────────────────────────────────────────────────── */

/**
 * Re-renders the gallery grid from localStorage.
 * Called on page load and after every upload / delete.
 */
function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  const emptyState = document.getElementById('empty-state');
  const countEl = document.getElementById('gallery-count');
  const clearBtn = document.getElementById('btn-clear-all');
  const images = loadImages();

  countEl.textContent = images.length;
  grid.innerHTML = '';

  if (images.length === 0) {
    emptyState.style.display = '';
    clearBtn.hidden = true;
    return;
  }

  emptyState.style.display = 'none';
  clearBtn.hidden = false;

  images.forEach(({ url }) => {
    const card = buildCard(url);
    grid.appendChild(card);
  });
}

/**
 * Builds a gallery card DOM element for a given URL.
 * @param {string} url
 * @returns {HTMLElement}
 */
function buildCard(url) {
  const card = document.createElement('div');
  card.className = 'gallery-card';
  card.setAttribute('role', 'listitem');

  // Image
  const img = document.createElement('img');
  img.src = url;
  img.alt = 'Gallery image';
  img.loading = 'lazy';
  img.onerror = () => { img.src = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http://www.w3.org/2000/svg%22%20width%3D%22200%22%20height%3D%22150%22%3E%3Crect%20fill%3D%22%23222%22%20width%3D%22200%22%20height%3D%22150%22/%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20fill%3D%22%23555%22%20font-size%3D%2212%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%3EImage%20unavailable%3C/text%3E%3C/svg%3E'; };

  // Overlay with action buttons
  const overlay = document.createElement('div');
  overlay.className = 'card-overlay';

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  // View (lightbox)
  const btnView = makeCardBtn('👁', 'card-btn-view', 'View full size');
  btnView.addEventListener('click', e => { e.stopPropagation(); openLightbox(url); });

  // Copy URL
  const btnCopy = makeCardBtn('🔗', 'card-btn-copy', 'Copy URL');
  btnCopy.addEventListener('click', e => {
    e.stopPropagation();
    navigator.clipboard.writeText(url)
      .then(() => showToast('URL copied!', 'success'))
      .catch(() => showToast('Failed to copy', 'error'));
  });

  // Delete
  const btnDelete = makeCardBtn('🗑', 'card-btn-delete', 'Delete from gallery');
  btnDelete.addEventListener('click', e => {
    e.stopPropagation();
    if (!confirm('Remove this image from the gallery?\n(It will remain on Cloudinary.)')) return;
    removeImage(url);
    card.style.animation = 'none';
    card.style.opacity = '0';
    card.style.transform = 'scale(.95)';
    card.style.transition = 'opacity .25s, transform .25s';
    setTimeout(renderGallery, 280);
    showToast('Image removed', 'success');
  });

  actions.append(btnView, btnCopy, btnDelete);
  overlay.appendChild(actions);

  // Clicking the card image opens lightbox
  card.addEventListener('click', () => openLightbox(url));

  card.append(img, overlay);
  return card;
}

/**
 * Creates a small icon button for the card overlay.
 * @param {string} icon   emoji or text
 * @param {string} cls    CSS class
 * @param {string} label  aria-label
 * @returns {HTMLButtonElement}
 */
function makeCardBtn(icon, cls, label) {
  const btn = document.createElement('button');
  btn.className = `card-btn ${cls}`;
  btn.textContent = icon;
  btn.setAttribute('aria-label', label);
  btn.title = label;
  return btn;
}

/* ── 6. LIGHTBOX ────────────────────────────────────────────────────────── */

function openLightbox(url) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  img.src = url;
  lb.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  lb.hidden = true;
  document.getElementById('lightbox-img').src = '';
  document.body.style.overflow = '';
}

/* ── 7. PREVIEW STRIP ───────────────────────────────────────────────────── */

/** @type {File[]} Files pending upload */
let pendingFiles = [];

/**
 * Rebuilds the preview strip from pendingFiles.
 */
function renderPreview() {
  const strip = document.getElementById('preview-strip');
  const uploadBtn = document.getElementById('btn-upload');
  strip.innerHTML = '';

  pendingFiles.forEach((file, index) => {
    const thumb = document.createElement('div');
    thumb.className = 'preview-thumb';
    thumb.setAttribute('role', 'listitem');

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-preview';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      URL.revokeObjectURL(img.src);
      pendingFiles.splice(index, 1);
      renderPreview();
    });

    thumb.append(img, removeBtn);
    strip.appendChild(thumb);
  });

  uploadBtn.disabled = pendingFiles.length === 0;
}

/* ── 8. MAIN UPLOAD HANDLER ─────────────────────────────────────────────── */

/**
 * Orchestrates the upload of all pending files, one by one.
 */
async function handleUpload() {
  if (pendingFiles.length === 0) return;

  // Guard: make sure credentials are configured
  if (
    CONFIG.CLOUDINARY_CLOUD_NAME === 'YOUR_CLOUD_NAME' ||
    CONFIG.CLOUDINARY_UPLOAD_PRESET === 'YOUR_UPLOAD_PRESET'
  ) {
    showToast('⚠️  Please configure Cloudinary credentials in app.js', 'error', 6000);
    setStatus('Edit app.js → CONFIG with your Cloud Name and Upload Preset.', 'error');
    return;
  }

  const uploadBtn = document.getElementById('btn-upload');
  const selectBtn = document.getElementById('btn-select');

  uploadBtn.classList.add('loading');
  uploadBtn.disabled = true;
  selectBtn.disabled = true;
  setProgress(0);

  const total = pendingFiles.length;
  let done = 0;
  let failed = 0;

  for (const file of pendingFiles) {
    setStatus(`Uploading ${done + 1} of ${total}: ${file.name}`, '');
    try {
      const url = await uploadToCloudinary(file);
      addImage(url);
      done++;
      setProgress((done / total) * 100);
    } catch (err) {
      failed++;
      console.error('Upload failed for', file.name, err);
    }
  }

  // Reset state
  uploadBtn.classList.remove('loading');
  uploadBtn.disabled = false;
  selectBtn.disabled = false;
  document.getElementById('file-input').value = '';
  pendingFiles = [];
  renderPreview();
  renderGallery();
  setProgress(0);

  if (failed === 0) {
    setStatus(`✓ ${done} image${done !== 1 ? 's' : ''} uploaded successfully.`, 'success');
    showToast(`${done} image${done !== 1 ? 's' : ''} uploaded!`, 'success');
  } else {
    setStatus(`${done} uploaded, ${failed} failed. Check console for details.`, 'error');
    showToast(`${failed} upload(s) failed`, 'error');
  }

  // Auto-clear status after 5 s
  setTimeout(() => setStatus(''), 5000);
}

/* ── 9. EXPORT / IMPORT ─────────────────────────────────────────────────── */

function exportGallery() {
  const images = loadImages();
  if (images.length === 0) {
    showToast('Gallery is empty — nothing to export.', 'error');
    return;
  }
  const json = JSON.stringify(images, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `gallery-export-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Gallery exported!', 'success');
}

function importGallery(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error('Invalid format');
      // Merge without duplicates
      const existing = loadImages();
      const existURLs = new Set(existing.map(i => i.url));
      const added = data.filter(i => i.url && !existURLs.has(i.url));
      saveImages([...added, ...existing]);
      renderGallery();
      showToast(`Imported ${added.length} image${added.length !== 1 ? 's' : ''}.`, 'success');
    } catch {
      showToast('Import failed — invalid JSON format.', 'error');
    }
  };
  reader.readAsText(file);
}

/* ── 10. DRAG & DROP ────────────────────────────────────────────────────── */

function addDragDropHandlers(zone) {
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) { showToast('Only image files are accepted.', 'error'); return; }
    pendingFiles = [...pendingFiles, ...files];
    renderPreview();
  });
}

/* ── 11. WIRING ─────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {

  // Render saved images immediately
  renderGallery();

  const fileInput = document.getElementById('file-input');
  const btnSelect = document.getElementById('btn-select');
  const btnUpload = document.getElementById('btn-upload');
  const dropZone = document.getElementById('drop-zone');
  const btnClearAll = document.getElementById('btn-clear-all');
  const btnExport = document.getElementById('btn-export');
  const btnImport = document.getElementById('btn-import');
  const importInput = document.getElementById('import-file-input');
  const lightbox = document.getElementById('lightbox');
  const lightboxClose = document.getElementById('lightbox-close');

  // --- Upload card click → open file picker (unless a button was clicked) ---
  dropZone.addEventListener('click', e => {
    if (e.target.closest('button')) return;
    fileInput.click();
  });

  // --- Browse button ---
  btnSelect.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });

  // --- File selected via input ---
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files).filter(f => f.type.startsWith('image/'));
    pendingFiles = [...pendingFiles, ...files];
    renderPreview();
  });

  // --- Upload button ---
  btnUpload.addEventListener('click', e => { e.stopPropagation(); handleUpload(); });

  // --- Drag & drop ---
  addDragDropHandlers(dropZone);

  // --- Drag & drop on document body as well ---
  addDragDropHandlers(document.body);

  // --- Clear all ---
  btnClearAll.addEventListener('click', () => {
    if (!confirm('Clear the entire gallery?\n(Images remain on Cloudinary.)')) return;
    saveImages([]);
    renderGallery();
    showToast('Gallery cleared.', 'success');
  });

  // --- Export ---
  btnExport.addEventListener('click', exportGallery);

  // --- Import ---
  btnImport.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', () => {
    if (importInput.files[0]) importGallery(importInput.files[0]);
    importInput.value = '';
  });

  // --- Lightbox close ---
  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

});

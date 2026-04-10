# System Architecture

## Overview

This is a **100% static frontend** application — no backend, no server, no database.

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER (Client)                      │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌─────────────────────┐ │
│  │index.html│   │ style.css│   │       app.js        │ │
│  │(Structure)│  │(Styling) │   │  (Upload + Gallery  │ │
│  └──────────┘   └──────────┘   │   + localStorage)   │ │
│                                └─────────┬───────────┘ │
└──────────────────────────────────────────│─────────────┘
                                           │ HTTPS POST (multipart/form-data)
                                           ▼
                              ┌────────────────────────┐
                              │   Cloudinary CDN API   │
                              │  (Image Storage + CDN) │
                              └────────────┬───────────┘
                                           │ Returns { secure_url, public_id, ... }
                                           ▼
                              ┌────────────────────────┐
                              │     localStorage       │
                              │  (Persists image URLs) │
                              └────────────────────────┘
```

## Data Flow

1. **User selects image(s)** → file input triggers preview
2. **User clicks Upload** → `app.js` sends `FormData` POST to Cloudinary endpoint:
   `https://api.cloudinary.com/v1_1/{cloud_name}/image/upload`
3. **Cloudinary responds** with JSON including `secure_url` (CDN URL)
4. **app.js stores** the URL in `localStorage` under key `gallery_images`
5. **Gallery renders** from `localStorage` on every page load — images are always visible

## Why Cloudinary (Not GitHub for Storage)

| Concern | GitHub (as storage) | Cloudinary |
|---|---|---|
| API secret exposure | ❌ Requires secret token in frontend | ✅ Unsigned preset — no secret |
| Image CDN | ❌ Raw files, no CDN | ✅ Global CDN, auto-format/quality |
| Upload UX | ❌ Requires GitHub API calls, complex | ✅ Single HTTPS POST |
| Free tier | 1GB LFS | 25 credits/month (generous for portfolios) |
| On-the-fly transforms | ❌ No | ✅ Resize, crop, compress via URL params |

## Component Responsibilities

### `index.html`
- Semantic HTML5 structure
- Upload form: file input + button + status area
- Gallery container (`<main id="gallery">`)

### `style.css`
- CSS custom properties (design tokens)
- Responsive grid layout (CSS Grid)
- Animations, transitions, hover effects
- Mobile-first breakpoints

### `app.js`
- `CONFIG` object (cloud name + preset) — only place to edit credentials
- `uploadImage(file)` — async function, returns `secure_url`
- `saveToStorage(url)` / `loadFromStorage()` — localStorage helpers
- `renderGallery()` — builds DOM from stored URLs
- `handleUpload()` — orchestrates upload + UI feedback
- `deleteImage(url)` — removes from storage and re-renders

## Security Model

- **No API secret** is ever shipped in frontend code
- Cloudinary's **unsigned upload preset** restricts:
  - Upload type (image only)
  - Optional: max file size, allowed formats
  - Optional: auto-apply transformations
- Images are **publicly readable** (CDN links) — appropriate for a portfolio

# Architectural Decisions

## ADR-001: Use Cloudinary for Image Storage

**Status:** Accepted  
**Date:** 2026-04-10

### Context
The site is 100% static (GitHub Pages). We need image upload without a backend.

### Options Considered
1. **Cloudinary unsigned upload** — Direct browser-to-CDN upload with unsigned preset
2. **ImgBB API** — Free image hosting with API key in frontend (key exposure risk)
3. **GitHub API** — Upload via API (requires personal access token exposed in frontend — ❌ security risk)
4. **Firebase Storage** — Works but requires heavier SDK and Firebase project setup

### Decision
**Cloudinary** with unsigned upload preset.

### Rationale
- Zero backend required
- No secret exposure (unsigned preset is intentionally public)
- Best-in-class CDN with URL-based transformations
- Generous free tier (25 credits/month)
- Widest industry adoption — skills transfer

### Trade-offs
- Images stored on third-party service (vendor lock-in)
- Free tier has monthly upload limits
- If Cloudinary changes pricing, migration needed

---

## ADR-002: localStorage for Image URL Persistence

**Status:** Accepted  
**Date:** 2026-04-10

### Context
After uploading, image URLs must survive page refresh without a database.

### Options Considered
1. **localStorage** — Built into every browser, no dependencies
2. **IndexedDB** — More powerful but significantly more complex API
3. **JSON file on GitHub** — Requires GitHub API write access (security risk)
4. **Cookies** — Size-limited (4KB), not suitable for URL lists

### Decision
**localStorage** with JSON serialization.

### Rationale
- Zero dependencies, works instantly
- Sufficient for a portfolio (URLs are ~100 chars each; 5MB limit = thousands of images)
- Easy to clear/reset
- Synchronous API keeps code simple

### Trade-offs
- Data is **browser-local** — not shared across devices
- User must re-import URLs to view on another device
- Clearing browser data clears the gallery

**Mitigation:** Export/Import JSON feature (added to backlog as TODO)

---

## ADR-003: Vanilla JavaScript (No Framework)

**Status:** Accepted  
**Date:** 2026-04-10

### Context
Choose between a framework (React/Vue/Svelte) or plain JS.

### Decision
**Vanilla JS**.

### Rationale
- Zero build step — drop files into GitHub Pages, done
- Beginner-friendly (no npm, no bundler, no transpilation)
- Application complexity doesn't justify a framework
- Framework adds maintenance surface area

---

## ADR-004: CSS Grid for Gallery Layout

**Status:** Accepted  
**Date:** 2026-04-10

### Decision
Use `display: grid` with `auto-fill` and `minmax()` for responsive masonry-like layout.

### Rationale
- Pure CSS — no JS layout library needed
- Intrinsically responsive without media query breakpoints on every column
- `object-fit: cover` ensures uniform card sizes despite varying image dimensions

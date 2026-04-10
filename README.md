# Portfolio Gallery

A **production-ready static portfolio gallery** with direct-to-Cloudinary image uploads, hosted on GitHub Pages.

---

## ✨ Features

| Feature | Detail |
|---|---|
| 📤 **Image Upload** | Drag-and-drop or click-to-browse, multiple files |
| ☁️ **Cloudinary Storage** | Unsigned upload preset — no backend, no secrets |
| 🖼️ **Gallery Grid** | Responsive CSS Grid, smooth hover animations |
| 🔍 **Lightbox** | Full-screen image viewer |
| 💾 **Persistence** | localStorage — survives page refresh |
| 📦 **Export / Import** | JSON file export for cross-device sync |
| 🗑️ **Delete** | Remove from gallery (stays on Cloudinary) |
| 📱 **Mobile Responsive** | Works on all screen sizes |

---

## 🚀 Quick Start

### 1. Configure Cloudinary (required once)

Open `app.js` and edit the `CONFIG` object at the top:

```js
const CONFIG = {
  CLOUDINARY_CLOUD_NAME:    'YOUR_CLOUD_NAME',     // from cloudinary.com dashboard
  CLOUDINARY_UPLOAD_PRESET: 'YOUR_UPLOAD_PRESET',  // unsigned preset name
  ...
};
```

> See [`/docs/setup.md`](docs/setup.md) for full Cloudinary setup instructions.

### 2. Deploy to GitHub Pages

```bash
git init && git add . && git commit -m "initial"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Then: **Repo → Settings → Pages → Source: main / root → Save**

Your site: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

---

## 📁 Project Structure

```
gallery/
├── index.html        # HTML structure
├── style.css         # Design system + responsive layout
├── app.js            # Upload logic + gallery + localStorage
├── README.md
└── docs/
    ├── setup.md      # Cloudinary + GitHub Pages setup guide
    ├── architecture.md  # System design and data flow
    ├── decisions.md  # Architectural Decision Records (ADRs)
    └── progress-log.md  # Change log
```

---

## 🔒 Security Note

No secrets are ever exposed in frontend code.  
Cloudinary's **unsigned upload preset** is designed to be public — it only allows uploads to your account, not reads of credentials.

---

## 📚 Documentation

| Document | Purpose |
|---|---|
| [`docs/setup.md`](docs/setup.md) | How to configure and deploy |
| [`docs/architecture.md`](docs/architecture.md) | How the system works |
| [`docs/decisions.md`](docs/decisions.md) | Why certain technologies were chosen |
| [`docs/progress-log.md`](docs/progress-log.md) | Change history |

---

## 🗺️ Roadmap (TODOs)

- [ ] Export/Import via JSON *(basic version done — enhancement: auto-sync URL)*  
- [ ] Lightbox: prev/next navigation with keyboard arrows  
- [ ] Image categories / tags filter  
- [ ] Cloudinary URL transformations (thumbnail quality preset)  
- [ ] PWA manifest for installability  

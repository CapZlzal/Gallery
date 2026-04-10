# Setup Guide

## 1. Cloudinary Account Setup

### Step 1 — Create a Free Account
1. Go to [https://cloudinary.com/](https://cloudinary.com/) and click **Sign Up for Free**.
2. Fill in your details and verify your email.
3. After login, open the **Dashboard** — note your **Cloud Name** (e.g., `my-cloud-123`).

### Step 2 — Create an Unsigned Upload Preset
> **Why unsigned?** The browser uploads images directly to Cloudinary with no backend. An unsigned preset allows this safely — it does NOT expose your API secret.

1. In Cloudinary Dashboard → **Settings** → **Upload** tab.
2. Scroll to **Upload presets** → click **Add upload preset**.
3. Set:
   - **Preset name**: `portfolio_unsigned` (or any name)
   - **Signing mode**: **Unsigned**
   - **Folder** (optional): `portfolio/`
4. Click **Save**.

### Step 3 — Configure the App
Open `app.js` and update the two constants at the top:

```js
const CLOUDINARY_CLOUD_NAME = 'YOUR_CLOUD_NAME';   // e.g. 'my-cloud-123'
const CLOUDINARY_UPLOAD_PRESET = 'portfolio_unsigned'; // your preset name
```

---

## 2. GitHub Pages Setup

### Step 1 — Create a Repository
1. Go to [https://github.com/new](https://github.com/new).
2. Repository name: `gallery` (or any name).
3. Set visibility to **Public**.
4. Click **Create repository**.

### Step 2 — Push Your Files
```bash
git init
git add .
git commit -m "Initial portfolio gallery"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 3 — Enable GitHub Pages
1. In your repo → **Settings** → **Pages**.
2. Under **Source**, select branch `main` and folder `/ (root)`.
3. Click **Save**.
4. Your site will be live at: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

> ⚠️ GitHub Pages may take 1–2 minutes to deploy on first publish.

---

## 3. Quick Start Checklist
- [ ] Cloudinary account created
- [ ] Unsigned upload preset created
- [ ] `app.js` updated with Cloud Name and Preset
- [ ] Repo created and code pushed
- [ ] GitHub Pages enabled
- [ ] Site is live ✅

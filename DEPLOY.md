# Deploy

The app runs as one Node process: `node server.js` inside `_system`. Do not use `npm start`. That command runs a Vite build and removes the letterhead script from `dist/index.html`.

Do not edit the letterhead files. The live preview, print preview, and PDF already include it.

## Render

Render runs the API, the site, and the e-Way Bill files.

- Root directory: `_system`
- Build command: `npm install`
- Start command: `node server.js`
- Health check: `/api/health`

Set these environment variables:

- `DATA_DIR` = `/var/data`
- `ALLOWED_ORIGINS` = the Vercel site origin, for example `https://your-app.vercel.app`

Attach a persistent disk mounted at `/var/data`. The first boot copies the bundled profile and bills onto that disk when `profile.json` is missing. Later deploys leave the disk alone.

`render.yaml` in the repo root describes this service. A free Render instance has no disk, and an ephemeral disk loses invoices on restart.

## Vercel

Vercel serves `_system/dist`. `vercel.json` forwards `/api` and `/letterhead` to Render, so the built app can keep calling `/api/profile`.

After the Render service has a URL, replace `https://YOUR-RENDER-SERVICE.onrender.com` in `vercel.json` with that URL.

## Local

From `_system`:

```
npm install
node server.js
```

Open `http://127.0.0.1:47371/`. With no `PORT` variable the server listens only on `127.0.0.1`.

## E-Way Bill file

Saving a bill also writes `eway/EWB-<invoice-number>.json` in the data directory. Download the same file at:

```
/api/eway?id=INV/2026-27/0003
```

The file is NIC schema `1.0.1221`. The seller GSTIN, both PIN codes, Dispatched through, and Vehicle No. are filled from the invoice. An item with no HSN is written as `0`.

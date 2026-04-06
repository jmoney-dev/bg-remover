# Cutout Studio

Cutout Studio is a free background remover web app built with Next.js.

## What it does

- Removes image backgrounds directly in the browser.
- Exports transparent PNG output for high image quality.
- Keeps original image dimensions.
- Uses a local model on the user device (no paid remove.bg API).

## Stack

- Next.js (App Router)
- React
- `@imgly/background-removal`
- `onnxruntime-web`

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Notes on quality and speed

- First run is slower because model files are downloaded and cached.
- The app uses PNG output (`quality: 1`) for best visual preservation.
- Performance depends on browser/device GPU support.

## Build and lint

```bash
npm run lint
npm run build
```

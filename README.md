# SignStack Embed — Vanilla HTML Sample

The simplest way to embed the SignStack web components: plain HTML + JavaScript, no bundler, no framework — with a small Node backend included under [`backend/`](./backend).

Components demoed:

- **`signstack-builder`** — editor for SignStack resources (blueprint, template, schema, asset, function)
- **`signstack-workflow`** — workflow embed (editor or monitor, picked automatically)
- **`signstack-participant`** — embedded signing experience

## How it works

The backend mints a short-lived **embed token**, and the page mounts the SignStack component with it:

1. The page requests a token — `POST http://localhost:4000/api/embed-token`
2. The backend returns `{ "embedToken": "<jwt>" }`
3. The page mounts the component with that token

## 1. Start the backend

Run these from the project root — no need to `cd` into `backend/`:

```bash
npm run backend:install   # installs the backend deps
npm run backend           # http://localhost:4000
```

`SIGNSTACK_API_KEY` is required — keep it server-side only, never exposed to the browser.

## 2. Serve the page

```bash
npm start            # serves the page via `npx serve .`
```

Any static file server works, too — e.g. `python3 -m http.server 8080`.

Open the page, switch tabs, paste a workflow ID / step key / resource key, and click **Load**.

To point at a different backend URL, edit `BACKEND_URL` at the top of [embeds/common.js](./embeds/common.js).

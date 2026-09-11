# Camera Gallery

An interactive 3D gallery of vintage cameras from my personal
collection. Each camera was photogrammetry-scanned with roughly 300 photographs
using Polycam, so the models in the gallery are the actual cameras rather than
recreations. The surrounding room was built in Blender, with a few supporting
props from Sketchfab (credited in the in-app introduction).

The gallery runs entirely in the browser: move the pointer over a camera to
highlight it, click it to zoom in and read its history, and close the popup to
return to the room.

**Live site:** https://elianamarshall.github.io/Camera-Gallery/

## Technology Used

- [Three.js](https://threejs.org/) for rendering (WebGL)
- [Vite](https://vite.dev/) for the dev server and production build
- Models ship as `.glb` with KTX2/Basis textures and Meshopt-compressed
  geometry, decoded in the browser by `KTX2Loader` and `MeshoptDecoder`

Source layout:

| Path | Purpose |
| --- | --- |
| [index.html](index.html) | Page shell, intro popup, loading screen |
| [script.js](script.js) | Scene setup, model loading, interaction, render loop |
| [style.css](style.css) | Popup and loading screen styling |
| [public/models/](public/models/) | Camera and environment `.glb` files |
| [public/basis/](public/basis/) | KTX2 transcoder assets, loaded at runtime |
| [tools/](tools/) | Model inspection and optimization scripts |

## Running Locally

Requires [Node.js](https://nodejs.org/) 20 or newer (any current LTS works).

```bash
npm install
npm run dev
```

Vite prints a local URL (usually http://localhost:5173/Camera-Gallery/) — open
it in a browser. Note the `/Camera-Gallery/` path: the base path is set for
GitHub Pages in [vite.config.js](vite.config.js) and applies in development
too, so the bare `http://localhost:5173/` root will 404.

To test the production build the way GitHub Pages serves it:

```bash
npm run build
npm run preview
```

That builds into `dist/` and serves it at http://localhost:8080/Camera-Gallery/.
Always check a change in `preview` as well as `dev` before deploying — asset
paths and the KTX2 transcoder location resolve differently in a built bundle.

### What to Check During Testing

- Loading screen advances to 100% and disappears
- Every camera model appears (no missing or untextured objects)
- Hovering highlights a camera; clicking zooms and opens its description
- Closing the popup returns the view to the original position
- Resizing the window keeps the scene correctly proportioned
- The browser console is free of WebGL, 404, or decoder errors

## Model Tooling

Raw Polycam scans are far too heavy to ship (three 4096×4096 JPEGs per camera,
several gigabytes of GPU memory across the gallery). Two scripts manage this:

```bash
npm run inspect:models    # report download size and estimated GPU memory per .glb
npm run optimize:models   # downscale textures, re-encode to KTX2, compress geometry
```

`optimize:models` rewrites files in `public/models/` **in place**; originals are
recoverable from git. It accepts `--dry-run` to preview and
`--only=name1,name2` to process a subset. Run `inspect:models` first to see
what needs attention, and commit the optimized `.glb` files. The deploy builds
straight from the repo and does no model processing.

## Deploying to GitHub Pages

The repository already contains the deploy workflow at
[.github/workflows/deploy.yml](.github/workflows/deploy.yml), which builds with
Vite and publishes `dist/` on every push to `main`. To set this up on a fresh
fork or clone:

1. **Set the base path.** In [vite.config.js](vite.config.js), `base` must match
   your repository name with leading and trailing slashes:

   ```js
   export default {
     base: '/Camera-Gallery/',
   }
   ```

   Rename the repository and this string goes stale, and every asset 404s on the
   deployed site. For a user/org site (`<username>.github.io`), use `base: '/'`
   instead.

2. **Enable Pages with GitHub Actions as the source.** In the repository, go to
   **Settings → Pages → Build and deployment**, and set **Source** to
   **GitHub Actions**. The workflow cannot publish while the source is set to a
   branch.

3. **Confirm workflow permissions.** Under **Settings → Actions → General →
   Workflow permissions**, the default read-only setting is fine — the workflow
   requests `pages: write` and `id-token: write` itself.

4. **Push to `main`** (or run the workflow manually from the **Actions** tab via
   **Run workflow**, which `workflow_dispatch` enables).

5. **Watch the run** in the **Actions** tab. On success, the deploy job's
   summary links to the published site at
   `https://<username>.github.io/<repository>/`.

The build installs with `npm ci`, so `package-lock.json` must be committed and
in sync with `package.json`. If it isn't, the install step fails before the
build runs.

### Notes

- The workflow deploys the `dist/` produced by CI. A locally built `dist/` in
  the repository has no effect on what gets published.
- Large `.glb` files count against repository size and Pages' soft 1 GB site
  limit; keep models optimized.

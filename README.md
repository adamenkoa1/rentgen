# Rentgen

Original site assets imported from the supplied `xray-demo.95sales.com.zip` archive. No npm dependencies are required. Use Node.js 24 and run:

```sh
npm start
```

The clinic route is `/?vert=clinic#/planner?p=prevm` on port 3000 (override with `PORT`). Fonts are served locally.

## Original application

The original `/assets/app-016405e0fe.js` was supplied separately and is included unchanged. The clinic demo runs locally with its original role selection, planner, data, styles, and interaction handlers. Opening `/` redirects to the requested clinic planner route. Demo changes follow the original application's persistence behavior; this is not a production backend.

Optional resources still absent include additional `/body3d/` model variants and `/icd10/`. The original Ukrainian and English translations are included at `/i18n/uk.json` and `/i18n/en.json`; select the desired language in the application language menu. Features needing these external modules require their original files. The server must allow their directories when those files are added. No replacement translations or medical models have been fabricated.

The supplied HAR restored the original `/manifest.webmanifest`, `/brand/95-64.png`, and `/icons/icon-192.png`. The favicon and touch icon are enabled. The manifest is retained but not linked because its referenced `/icons/icon-512.png` and `/icons/maskable-512.png` are still missing; full PWA readiness is not claimed. All supplied original CSS, bootstrap JavaScript, logo, and font binaries are retained.

The HAR recordings supplied six original avatars: `/demo/u1.png`, `/demo/u2.png`, `/demo/u3.png`, `/demo/u4.png`, `/demo/u6.png`, and `/demo/u9.png`. All are included. Other avatars have not been supplied. One body-model variant is available as described below. The HAR itself is kept outside the application checkout and is not served or included in the site.

The original X-ray image module is included at `/xray/img.js`. The HTML bootstrap preserves the source hostname’s X-ray demo selection on local hosts; an explicit `org` query retains the original application override. The results viewer generates the original illustrative SVG demo images locally, without additional image files.

The original Three.js module is included at `/vendor/three-0169.min.js`. The HAR supplied the original `/body3d/m-th.json` and `/body3d/m-th.bin` body model (20,859 vertices and 41,717 triangles). This variant is included; other sex/build variants have not been supplied.

The original dental modules are included at `/dent3d/patient.js` and `/dent3d/jaw.js`, and import successfully with the supplied Three.js library. The original `/dent3d/teeth.json` metadata and matching `/dent3d/teeth.bin` geometry are included. All four tooth meshes have valid buffer bounds and vertex indices.

## GitHub Pages publication

Run `npm run build:pages` to generate `dist/` for `https://adamenkoa1.github.io/rentgen/`. This adapts resource paths in the generated copy; original application assets remain unchanged. The generated site is published to the `gh-pages` branch. In GitHub repository Settings → Pages, choose Deploy from a branch, `gh-pages`, `/ (root)`, then Save. Publication still requires GitHub Pages to be enabled; pushing a branch alone does not establish a live website. After future changes rebuild and republish the generated files.

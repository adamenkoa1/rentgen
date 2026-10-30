import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist');
const base = '/rentgen/';
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const name of ['index.html', 'rx.html', 'smile.html', '_external', 'assets', 'body3d', 'brand', 'demo', 'dent3d', 'i18n', 'icons', 'manifest.webmanifest', 'vendor', 'xray']) {
  await cp(path.join(root, name), path.join(out, name), { recursive: true });
}
async function rewrite(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) { await rewrite(file); continue; }
    if (!/\.(html|js|css|webmanifest)$/.test(item.name)) continue;
    let s = await readFile(file, 'utf8');
    s = s.replace(/(["'`])\/(assets|body3d|brand|demo|dent3d|i18n|icons|vendor|xray|icd10)\//g, `$1${base}$2/`);
    s = s.replace(/fetch\((["'])\/\?upd=/g, `fetch($1${base}?upd=`);
    // Patient results are static HTML pages on GitHub Pages, not root-domain routes.
    s = s.replace('location.origin+(/^(localhost|127\\.)/.test(location.hostname)?"/rx.html#":"/rx#")', `location.origin+"${base}rx.html#"`);
    s = s.replace('location.origin+(/^(localhost|127\\.)/.test(location.hostname)?"/smile.html#":"/smile#")', `location.origin+"${base}smile.html#"`);
    if (item.name === 'manifest.webmanifest') s = s.replace(/"(start_url|scope)": "\/"/g, `"$1": "${base}"`);
    if (item.name === 'index.html') {
      s = s.replace('<head>', `<head><base href="${base}">`);
      s = s.replace("if(!new URLSearchParams(location.search).has('org'))", "if(!location.search&&!location.hash)history.replaceState(null,'','?vert=clinic#/planner?p=prevm');if(!new URLSearchParams(location.search).has('org'))");
    }
    await writeFile(file, s);
  }
}
await rewrite(out);
await writeFile(path.join(out, '.nojekyll'), '');
console.log('GitHub Pages site built in dist for /rentgen/');

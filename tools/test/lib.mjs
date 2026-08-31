/* Shared plumbing for the probes.

   Chromium here runs on SwiftShader, so the game renders at roughly
   11-20 fps and everything is slow. Timeouts are generous on purpose:
   a probe that times out on a working game teaches nobody anything. */
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';

const PW = '/opt/node22/lib/node_modules/playwright/index.mjs';
export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export const GAME = path.join(ROOT, 'game', 'lumen-harbor.html');
export const PREVIEW = path.join(ROOT, 'site', 'preview.html');

export async function launch() {
  const { chromium } = await import(PW);
  return chromium.launch({ args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'
  ]});
}

/* A page with the game in it, plus everything that went wrong while it
   loaded. Font requests are expected to fail offline; nothing else is. */
export async function openGame(browser, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 900, height: 560 },
    deviceScaleFactor: 1
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => {
    const t = m.text();
    if (/favicon|fonts\.g|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED/.test(t)) return;
    if (m.type() === 'error') errors.push('CONSOLE: ' + t.slice(0, 220));
  });
  await page.goto('file://' + (opts.file || GAME));
  await page.waitForFunction(
    () => window.LH && LH.Net && LH.Game && LH.Game.player, null, { timeout: 180000 });
  await page.waitForTimeout(opts.settle === undefined ? 4000 : opts.settle);
  return { page, ctx, errors };
}

/* Serve a directory and hand back the origin. Used by the preview probe,
   which has to reproduce an artifact host: http, and a sandboxed iframe. */
export function serve(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  const srv = createServer((req, res) => {
    const file = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise(done => srv.listen(0, '127.0.0.1',
    () => done({ origin: 'http://127.0.0.1:' + srv.address().port, close: () => srv.close() })));
}

/* A probe collects checks and never throws out of one: a probe that dies
   on its second assertion hides the other eight. */
export function checks() {
  const list = [];
  const t = {
    ok(name, pass, detail) { list.push({ name, pass: !!pass, detail: detail || '' }); return !!pass; },
    eq(name, got, want) { return t.ok(name, got === want, 'got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)); },
    atLeast(name, got, want) { return t.ok(name, got >= want, 'got ' + got + ', want >= ' + want); },
    list
  };
  return t;
}

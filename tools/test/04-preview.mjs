/* site/preview.html as an artifact host actually serves it: over http,
   inside a sandboxed iframe. This probe exists because the preview once
   shipped with its whole stylesheet missing and booted perfectly into an
   unstyled 300x150 canvas — so it measures the canvas, and a probe that
   only asked "did LH load" would pass on that build too. */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PREVIEW, serve, checks } from './lib.mjs';

export const name = 'preview';

export async function run(browser) {
  const t = checks();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-preview-'));
  fs.copyFileSync(PREVIEW, path.join(dir, 'frame.html'));
  fs.writeFileSync(path.join(dir, 'host.html'),
    '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%}' +
    'iframe{border:0;width:100vw;height:100vh;display:block}</style>' +
    '<iframe sandbox="allow-scripts" src="frame.html"></iframe>');
  const srv = await serve(dir);
  const ctx = await browser.newContext({ viewport: { width: 900, height: 520 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  await page.goto(srv.origin + '/host.html');

  let info = { error: 'the frame never appeared' };
  try {
    const frame = await page.waitForFunction(() => true).then(() =>
      page.frames().find(f => f.url().includes('frame.html')));
    await frame.waitForFunction(() => window.LH && LH.App && LH.App.w, null, { timeout: 180000 });
    await page.waitForTimeout(6000);
    info = await frame.evaluate(() => {
      const gl = document.getElementById('gl'), app = document.getElementById('app');
      const r = gl.getBoundingClientRect(), a = app.getBoundingClientRect();
      return { canvasW: gl.width, canvasH: gl.height,
        glRect: [Math.round(r.width), Math.round(r.height)],
        appRect: [Math.round(a.width), Math.round(a.height)],
        page: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
        styled: getComputedStyle(app).position, fps: LH.App.fps };
    });
  } catch (e) { info = { error: String(e).slice(0, 160) }; }

  t.ok('the preview boots in a sandboxed iframe', !info.error, info.error);
  t.eq('#app is laid out by the stylesheet', info.styled, 'fixed');
  t.eq('the canvas fills the frame', (info.glRect || []).join('x'), '900x520');
  t.atLeast('the canvas has a backing store', info.canvasW || 0, 640);
  t.ok('the page does not scroll away', (info.page || [0, 1e9])[1] <= 560,
       'page height ' + ((info.page || [])[1]));
  await ctx.close(); srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
  return t.list;
}

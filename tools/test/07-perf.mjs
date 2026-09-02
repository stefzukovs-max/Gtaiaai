/* A frame budget, measured on a phone-shaped context.

   GL.resetStats() runs at the top of every frame, so reading GL.stats
   after one is exactly one frame's work — no averaging needed, which
   matters because this machine renders about one frame every three
   seconds and per-frame averages here are noise.

   The numbers exist because the frame was once 18.4 million triangles.
   Props were drawn with no culling of any kind into both shadow
   cascades as well as the image, so an entire island of trees was
   rasterised into a thirteen-metre shadow box, three times a frame. */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PREVIEW, serve, checks } from './lib.mjs';

export const name = 'perf';

const KTRI_BUDGET = 9000;    /* thousand triangles in one frame */
const DRAW_BUDGET = 900;

export async function run(browser) {
  const t = checks();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-perf-'));
  fs.copyFileSync(PREVIEW, path.join(dir, 'frame.html'));
  fs.writeFileSync(path.join(dir, 'host.html'),
    '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>html,body{margin:0;height:100%}iframe{border:0;width:100vw;height:100vh;display:block}</style>' +
    '<iframe sandbox="allow-scripts" src="frame.html"></iframe>');
  const srv = await serve(dir);
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 1, hasTouch: true, isMobile: true
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  try {
    await page.goto(srv.origin + '/host.html');
    const frame = page.frames().find(f => f.url().includes('frame.html'));
    await frame.waitForFunction(() => window.LH && LH.App && LH.App.w, null, { timeout: 180000 });
    await page.waitForTimeout(5000);
    await frame.evaluate(() => LH.Front.go('done'));
    await page.waitForTimeout(14000);

    const m = await frame.evaluate(() => ({
      mobile: LH.Device.mobile,
      ktris: Math.round(LH.GL.stats.tris / 1000),
      draws: LH.GL.stats.draws,
      inst: LH.World.instanced.reduce((a, x) => a + (x.instances || 0), 0),
      near: LH.World.instanced.reduce((a, x) => a + (x.nearInstances || 0), 0),
      heaviest: Math.max.apply(null, LH.World.instanced.map(x => Math.round(x.count / 3))),
      rawExists: typeof LH.App.raw === 'number',
      autoOn: LH.Render.auto.on
    }));

    t.ok('it knows it is a phone', m.mobile);
    t.ok('the frame is inside its triangle budget', m.ktris > 0 && m.ktris < KTRI_BUDGET,
         m.ktris + 'k triangles, budget ' + KTRI_BUDGET + 'k');
    t.ok('the frame is inside its draw budget', m.draws > 0 && m.draws < DRAW_BUDGET,
         m.draws + ' draws, budget ' + DRAW_BUDGET);
    t.ok('the shadow cascades draw fewer props than the image does',
         m.near > 0 && m.near < m.inst * 0.5,
         m.near + ' of ' + m.inst + ' prop instances');
    t.ok('no single prop mesh is extravagant', m.heaviest < 3200,
         'heaviest prop mesh is ' + m.heaviest + ' triangles');
    t.ok('the frame time the scaler sees is the real one', m.rawExists,
         'App.raw missing — the scaler is reading the clamped step and ' +
         'cannot see a frame worse than 100ms');
    t.ok('the quality scaler is on', m.autoOn);
  } catch (e) {
    t.ok('perf: boots', false, String(e).slice(0, 160));
  }
  await ctx.close(); srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
  return t.list;
}

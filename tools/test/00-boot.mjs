/* The game loads, all 35 modules are present, the canvas is the size of
   the window, and nothing threw on the way. This is deliberately the
   probe that measures rather than asserts booleans: a "did it load"
   check passes happily while the screen is blank, which is exactly how
   a preview with no stylesheet once shipped. */
import { openGame, checks } from './lib.mjs';

export const name = 'boot';

const MODULES = ['M','GL','Geo','Tex','Render','Cam','App','Device','Rig','Body','Cos',
  'Actors','Cast','Terrain','Props','Arch','World','Input','Player','Sky','Data','Voxels',
  'Net','Icon','UI','Enemies','Fishing','Quests','Realm','Audio','Front','Game'];

export async function run(browser) {
  const t = checks();
  const { page, ctx, errors } = await openGame(browser);
  const m = await page.evaluate(mods => ({
    missing: mods.filter(k => !window.LH[k]),
    canvas: (() => { const c = document.getElementById('gl');
      const r = c.getBoundingClientRect();
      return { w: c.width, h: c.height, cssW: Math.round(r.width), cssH: Math.round(r.height) }; })(),
    app: { w: LH.App.w, h: LH.App.h, fps: LH.App.fps },
    gl: !!(LH.GL && LH.GL.gl),
    items: LH.Data.ITEMS.length,
    handlers: LH.Net.handlers().length,
    inner: [window.innerWidth, window.innerHeight]
  }), MODULES);

  t.eq('every module present', m.missing.join(',') || 'none', 'none');
  t.ok('webgl context', m.gl);
  t.eq('canvas fills the window', m.canvas.cssW + 'x' + m.canvas.cssH, m.inner[0] + 'x' + m.inner[1]);
  t.atLeast('canvas has a backing store', m.canvas.w, 640);
  t.atLeast('frame loop is running', m.app.fps, 1);
  t.atLeast('item table loaded', m.items, 500);
  t.atLeast('handlers registered', m.handlers, 20);
  t.eq('no errors while loading', errors.slice(0, 3).join(' | ') || 'none', 'none');
  await ctx.close();
  return t.list;
}

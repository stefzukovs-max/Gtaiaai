/* Every wearable style must build, on every body, and come back with
   geometry in it. An empty mesh is invisible in the game and silent in
   the console, so this is the only place it gets caught. */
import { openGame, checks } from './lib.mjs';

export const name = 'cosmetics';

export async function run(browser) {
  const t = checks();
  const { page, ctx, errors } = await openGame(browser);
  const r = await page.evaluate(() => {
    const B = LH.Body, C = LH.Cos, empty = [];
    let built = 0;
    const need = (label, m) => { if (!m || !m.count) empty.push(label); else built++; };

    for (const build of ['slim', 'base', 'bulk']) {
      for (const st of Object.keys(B.SHIRT_BUILD || { tee: 1 }))
        for (const sl of ['short', 'long', 'none']) need('shirt ' + st + '/' + sl + '/' + build, B.shirt(st, sl, build));
      for (const lg of Object.keys(B.LEG_BUILD || { long: 1 })) need('legs ' + lg + '/' + build, B.trousers(lg, build));
      for (const sh of B.SHOES) need('shoes ' + sh + '/' + build, B.shoes(sh, build));
      for (const ov of C.OVERLAYS) { const m = C.overlay(ov, build); if (!m) empty.push('over ' + ov); else built++; }
      need('figure/' + build, B.figure(build));
    }
    for (const st of B.HAIR) if (st !== 'bald') need('hair ' + st, B.hair(st));
    for (const st of B.FACIAL) if (st !== 'none') need('beard ' + st, B.facial(st));
    for (const st of B.HATS) if (st !== 'none') need('hat ' + st, B.hat(st));
    return { built, empty };
  });
  t.atLeast('styles built', r.built, 100);
  t.eq('none came back empty', r.empty.slice(0, 6).join(', ') || 'none', 'none');
  t.eq('no errors while building', errors.slice(0, 3).join(' | ') || 'none', 'none');
  await ctx.close();
  return t.list;
}

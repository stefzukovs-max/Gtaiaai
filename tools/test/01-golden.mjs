/* The golden path, driven through the authority rather than the UI, so
   a HUD change cannot make it pass while the game is broken.

       buy -> make a world -> travel -> place -> break -> leave ->
       sell -> equip -> save and reload

   Planting and harvesting join this list when farming lands; until then
   they are not in the game and this probe does not pretend otherwise. */
import { openGame, checks } from './lib.mjs';

export const name = 'golden';

export async function run(browser) {
  const t = checks();
  const { page, ctx, errors } = await openGame(browser);

  const r = await page.evaluate(async () => {
    const step = [];
    const req = (a, p) => LH.Net.request(a, p || {});
    const say = (n, res, extra) => { step.push({ n, ok: !!(res && res.ok), why: (res && res.why) || '', extra }); return res; };

    /* something cheap, placeable and in the shop */
    const block = LH.Data.ITEMS.find(i => i.placeable && i.cat === 'block' && i.value <= 12);
    say('found a cheap block', { ok: !!block }, block && block.key);
    const buy = say('buy it', req('buy', { key: block.key, n: 4 }));

    const theme = LH.Realm.themeList()[0];
    say('create a world', req('createWorld', { name: 'Testing Grounds', theme: theme }), theme);

    /* enter it the way the game does, then wait for the terrain swap */
    const world = (LH.Net.request('myWorlds', {}).worlds || [])[0];
    say('the world is listed', { ok: !!world }, world && world.name);
    let entered = false;
    if (world) entered = LH.Realm.enter(world);
    await new Promise(r => setTimeout(r, 1500));
    say('enter the world', { ok: entered && LH.Realm.inRealm() });

    /* a cell next to the player, at their feet */
    const pos = LH.Game.player.pos;
    const cx = Math.floor(pos[0]) + 1, cy = Math.floor(pos[1]), cz = Math.floor(pos[2]);
    const placed = say('place a block', req('place', { x: cx, y: cy, z: cz, key: block.key, pos: [pos[0], pos[1], pos[2]] }));
    const there = LH.Voxels.get(cx, cy, cz);
    say('the block is in the world', { ok: !!there });
    say('break it again', req('break', { x: cx, y: cy, z: cz, pos: [pos[0], pos[1], pos[2]] }));
    say('the cell is empty', { ok: !LH.Voxels.get(cx, cy, cz) });

    let left = false;
    if (LH.Realm.inRealm()) left = LH.Realm.leave();
    say('leave the world', { ok: left && !LH.Realm.inRealm() });

    say('sell a block back', req('sell', { key: block.key, n: 1 }));

    const hat = LH.Data.ITEMS.find(i => i.cat === 'cosmetic' && i.value <= 30);
    say('buy a cosmetic', req('buy', { key: hat.key, n: 1 }), hat && hat.key);
    const worn = say('wear it', req('equip', { key: hat.key }));
    const snap = LH.Net.request('missions', {}).state || (worn && worn.state);

    const saved = LH.Net.save();
    say('the save writes', { ok: saved });
    say('the save reads back', { ok: LH.Net.hasSave() && LH.Net.load() });

    return { step, coins: (snap && snap.coins), equipped: snap && snap.equipped };
  });

  for (const s of r.step) t.ok(s.n + (s.extra ? ' (' + s.extra + ')' : ''), s.ok, s.why);
  t.eq('no errors on the golden path', errors.slice(0, 3).join(' | ') || 'none', 'none');
  await ctx.close();
  return t.list;
}

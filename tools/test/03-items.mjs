/* Integrity of the item table. Each of these has been a real bug: two
   items sharing a key, a cosmetic no wardrobe slot reads, an item whose
   icon painter does not exist, a shop aisle that sells nothing. */
import { openGame, checks } from './lib.mjs';

export const name = 'items';

export async function run(browser) {
  const t = checks();
  const { page, ctx, errors } = await openGame(browser);
  const r = await page.evaluate(() => {
    const D = LH.Data, seen = {}, dupes = [], noIcon = [], noValue = [];
    for (const it of D.ITEMS) {
      if (seen[it.key]) dupes.push(it.key); else seen[it.key] = 1;
      /* quest items are deliberately priceless and untradeable — a
         vault key you can sell to a vendor is a broken quest */
      if (it.tradeable && !(it.value > 0)) noValue.push(it.key);
      try { if (!LH.Icon.of(it.key)) noIcon.push(it.key); } catch (e) { noIcon.push(it.key + ' (threw)'); }
    }
    const cats = {};
    for (const it of D.ITEMS) cats[it.cat] = (cats[it.cat] || 0) + 1;
    const emptyCats = D.CAT.filter(c => !cats[c]);
    return { n: D.ITEMS.length, dupes, noIcon, noValue, cats, emptyCats };
  });
  t.atLeast('items in the table', r.n, 500);
  t.eq('no duplicate keys', r.dupes.slice(0, 5).join(', ') || 'none', 'none');
  t.eq('every item has an icon', r.noIcon.slice(0, 5).join(', ') || 'none', 'none');
  t.eq('every tradeable item has a value', r.noValue.slice(0, 5).join(', ') || 'none', 'none');
  t.eq('no empty category', r.emptyCats.join(', ') || 'none', 'none');
  t.eq('no errors', errors.slice(0, 3).join(' | ') || 'none', 'none');
  await ctx.close();
  return t.list;
}

#!/usr/bin/env node
/* node tools/test/all.mjs [name ...]
   One browser, one page per probe. Exits non-zero if anything failed. */
import { launch } from './lib.mjs';

const PROBES = ['./00-boot.mjs', './01-golden.mjs', './02-cosmetics.mjs',
                './03-items.mjs', './04-preview.mjs', './05-phone.mjs', './06-feel.mjs', './07-perf.mjs'];
const only = process.argv.slice(2);
const browser = await launch();
let failed = 0, ran = 0;

for (const file of PROBES) {
  const mod = await import(file);
  if (only.length && !only.includes(mod.name)) continue;
  const started = Date.now();
  let list;
  try { list = await mod.run(browser); }
  catch (e) { list = [{ name: 'the probe itself threw', pass: false, detail: String(e).slice(0, 200) }]; }
  const bad = list.filter(c => !c.pass);
  ran++; failed += bad.length;
  console.log('\n' + mod.name + '  (' + ((Date.now() - started) / 1000).toFixed(0) + 's)');
  for (const c of list) console.log((c.pass ? '  ok   ' : '  FAIL ') + c.name + (c.pass ? '' : '  — ' + c.detail));
}
await browser.close();
console.log('\n' + (failed ? failed + ' failed across ' + ran + ' probes' : 'all clear across ' + ran + ' probes'));
process.exit(failed ? 1 : 0);

/* The game on a phone, in a sandboxed iframe over http — which is how
   an artifact host actually serves it. Portrait and landscape, with
   touch and no fine pointer.

   This probe exists because the whole suite passed at 900x520 with a
   mouse while the game was unplayable on an actual phone: the preview
   shipped without a viewport meta, so the page laid out at the mobile
   default of 980 CSS px and was scaled to fit, and the front end — which
   had never been given a phone layout at all — rendered its only button
   at 27x12 pixels. You could see your character and had no way to start.

   So it measures the things that were wrong: the layout viewport, the
   size of what you press, whether anything sits off the edge without a
   way to scroll to it, and whether the text decodes as UTF-8. */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PREVIEW, serve, checks } from './lib.mjs';

export const name = 'phone';

const SIZES = [
  { label: 'portrait',  w: 390, h: 750 },
  { label: 'landscape', w: 844, h: 390 }
];
const TOUCH_MIN = 40;   /* 44 is the target; 40 allows a border's rounding */

/* Measured in the page. It is serialised across, so it closes over
   nothing — the touch minimum comes in as an argument. */
function survey(min) {
  const vw = innerWidth, vh = innerHeight;
  const box = n => { const r = n.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
  const vis = n => { const s = getComputedStyle(n);
    return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.02; };
  const scrollable = n => { /* reachable if any ancestor scrolls that way */
    for (let p = n.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/auto|scroll/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 2) return true;
      if (/auto|scroll/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 2) return true;
    }
    return false; };

  const small = [], off = [];
  for (const n of document.querySelectorAll(
      '#hud button, #hud .nb, #hud .slot, #hud .tbtn, #hud .xbtn, #hud .px,' +
      '#front .fbtn, #front .opt, #front .theme, #front .wcard,' +
      '#app .getapp .go, #app .getapp .no')) {
    if (!vis(n)) continue;
    const b = box(n);
    if (b[2] < 4 || b[3] < 4) continue;
    const tag = (n.className || n.tagName).toString().slice(0, 18) + ' ' + b[2] + 'x' + b[3];
    if (b[2] < min || b[3] < min) small.push(tag);
    if ((b[0] + b[2] > vw + 1 || b[1] + b[3] > vh + 1 || b[0] < -1 || b[1] < -1) && !scrollable(n))
      off.push(tag + ' @' + b[0] + ',' + b[1]);
  }
  const q = s => { const n = document.querySelector(s); return n && vis(n) ? box(n) : null; };
  const chat = q('.chat'), home = q('.tsthome');
  const meta = document.querySelector('meta[name=viewport]');
  return {
    vw, vh,
    mobile: LH.Device.mobile, touch: LH.Device.touch,
    viewport: meta ? meta.getAttribute('content') : 'NONE',
    small: small.slice(0, 8), off: off.slice(0, 8),
    chat, home,
    overlap: !!(chat && home && !(chat[0] + chat[2] < home[0] || home[0] + home[2] < chat[0] ||
                                 chat[1] + chat[3] < home[1] || home[1] + home[3] < chat[1])),
    /* whatever is floating over the game must not land on a control */
    covers: (() => {
      const hit = (a, b) => a && b && !(a[0] + a[2] < b[0] || b[0] + b[2] < a[0] ||
                                        a[1] + a[3] < b[1] || b[1] + b[3] < a[1]);
      const q2 = s => { const n = document.querySelector(s); return n && vis(n) ? box(n) : null; };
      const nag = q2('.getapp.on');
      const bad = [];
      for (const sel of ['#utprimary', '#utjump', '#utact', '.tsthome',
                         '.hotbar', '.mnav', '.purse', '.idchip'])
        if (hit(nag, q2(sel))) bad.push('the install offer covers ' + sel);
      return bad;
    })(),
    paneScrolls: (() => { const p = document.getElementById('frontpane');
      return p ? /auto|scroll/.test(getComputedStyle(p).overflowY) : false; })(),
    /* a latin-1 decode turns every em dash into this */
    mojibake: /Ã|â€/.test(document.body.innerText),
    guide: (document.querySelector('.guide p') || {}).textContent || '',
    fps: LH.App.fps
  };
}

export async function run(browser) {
  const t = checks();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-phone-'));
  fs.copyFileSync(PREVIEW, path.join(dir, 'frame.html'));
  fs.writeFileSync(path.join(dir, 'host.html'),
    '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>html,body{margin:0;height:100%}iframe{border:0;width:100vw;height:100vh;display:block}</style>' +
    '<iframe sandbox="allow-scripts" src="frame.html"></iframe>');
  const srv = await serve(dir);

  for (const size of SIZES) {
    const tag = size.label + ': ';
    const ctx = await browser.newContext({
      viewport: { width: size.w, height: size.h },
      deviceScaleFactor: 1, hasTouch: true, isMobile: true
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(240000);
    try {
      await page.goto(srv.origin + '/host.html');
      const frame = page.frames().find(f => f.url().includes('frame.html'));
      await frame.waitForFunction(() => window.LH && LH.App && LH.App.w, null, { timeout: 180000 });
      await page.waitForTimeout(5000);

      const front = await frame.evaluate(survey, TOUCH_MIN);
      t.ok(tag + 'the game knows it is on a phone', front.mobile, 'Device.mobile=' + front.mobile);
      t.ok(tag + 'the layout viewport is the device',
           /width=device-width/.test(front.viewport) && front.vw <= size.w + 1,
           'viewport meta ' + front.viewport + ', laid out at ' + front.vw + 'px');
      t.ok(tag + 'the text decodes as UTF-8', !front.mojibake, 'found latin-1 mojibake');
      t.ok(tag + 'the front end scrolls rather than hides', front.paneScrolls);
      t.ok(tag + 'you can start the game with a thumb', front.small.length === 0,
           front.small.join(', '));
      t.ok(tag + 'nothing on the title screen is off the edge', front.off.length === 0,
           front.off.join(' | '));

      await frame.evaluate(() => LH.Front.go('done'));
      await page.waitForTimeout(5000);
      const game = await frame.evaluate(survey, TOUCH_MIN);
      t.ok(tag + 'every control is a thumb target', game.small.length === 0, game.small.join(', '));
      t.ok(tag + 'nothing is off the edge without a way to scroll to it',
           game.off.length === 0, game.off.join(' | '));
      t.ok(tag + 'the chat is not on top of the walk stick', !game.overlap,
           'chat ' + JSON.stringify(game.chat) + ' stick ' + JSON.stringify(game.home));
      t.ok(tag + 'nothing floating sits on a control', game.covers.length === 0,
           game.covers.join(' | '));
      t.ok(tag + 'the tutorial talks about the controls you have',
           !/WASD|mouse|click|Press <b>E/i.test(game.guide), game.guide.slice(0, 90));
    } catch (e) {
      t.ok(tag + 'boots', false, String(e).slice(0, 160));
    }
    await ctx.close();
  }
  srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
  return t.list;
}

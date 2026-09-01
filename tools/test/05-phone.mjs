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
   way to scroll to it, and whether the text decodes as UTF-8.

   The game is landscape-only. Portrait on a touchscreen is not a layout
   to check, it is a stop: the overlay is the whole screen and the frame
   loop behind it does not run. So the two orientations are asked
   different questions. */
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

  /* Text too small to read is the same bug as a button too small to
     press, and this game has had it three times in three different
     places — an inline cqw size, a rule on the wrong element, a screen
     with no phone layout at all. So it is measured rather than eyeballed:
     anything with its own words in it, under nine pixels, is a defect. */
  const tiny = [];
  for (const n of document.querySelectorAll('#hud *, #front *, .getapp *')) {
    if (!vis(n)) continue;
    let own = '';
    for (const c of n.childNodes) if (c.nodeType === 3) own += c.textContent.trim();
    if (own.length < 2) continue;
    const px = parseFloat(getComputedStyle(n).fontSize);
    if (px < 9) tiny.push((n.className || n.tagName).toString().slice(0, 26) +
      ' ' + px.toFixed(1) + 'px "' + own.slice(0, 18) + '"');
  }

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
    small: small.slice(0, 8), off: off.slice(0, 8), tiny: tiny.slice(0, 40),
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
      const controls = ['#utprimary', '#utjump', '#utact', '.tsthome',
                        '.hotbar', '.mnav', '.purse', '.idchip'];
      for (const sel of controls)
        if (hit(nag, q2(sel))) bad.push('the install offer covers ' + sel);
      /* The coach mark is teaching the controls, so it cannot sit on
         them. Measured by its own class rather than by opacity: it
         fades, and a fading card is still in the way — reading it as
         invisible is how this check passed while it was overlapping. */
      const g = document.querySelector('.guide.on');
      const tip = g ? box(g) : null;
      for (const sel of ['#utprimary', '#utjump', '#utact', '.hotbar', '.tsthome'])
        if (hit(tip, q2(sel))) bad.push('the first-steps card covers ' + sel);
      return bad;
    })(),
    paneScrolls: (() => { const p = document.getElementById('frontpane');
      return p ? /auto|scroll/.test(getComputedStyle(p).overflowY) : false; })(),
    /* a latin-1 decode turns every em dash into this */
    mojibake: /Ã|â€/.test(document.body.innerText),
    blocked: LH.App.blocked === true,
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

  const open = async (size) => {
    const ctx = await browser.newContext({
      viewport: { width: size.w, height: size.h },
      deviceScaleFactor: 1, hasTouch: true, isMobile: true
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(240000);
    await page.goto(srv.origin + '/host.html');
    const frame = page.frames().find(f => f.url().includes('frame.html'));
    await frame.waitForFunction(() => window.LH && window.LH.App, null, { timeout: 180000 });
    await page.waitForTimeout(5000);
    return { ctx, page, frame };
  };

  /* ---- portrait: the stop ---------------------------------------- */
  try {
    const { ctx, page, frame } = await open(SIZES[0]);
    const gate = await frame.evaluate(() => {
      const r = document.getElementById('rotate');
      const s = getComputedStyle(r), b = r.getBoundingClientRect();
      const out = n => { const e = document.querySelector(n);
        if (!e) return false;
        const cs = getComputedStyle(e);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.02; };
      return {
        shown: s.display !== 'none',
        covers: Math.round(b.width) >= innerWidth && Math.round(b.height) >= innerHeight,
        z: +s.zIndex,
        blocked: LH.App.blocked === true,
        wayOut: out('#rotateok'),
        words: (r.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        /* rAF keeps running - it has to, or nothing would notice the
           phone being turned back. What must not advance is the world:
           R.time is only written past the block, so it is the clock that
           says whether anything is being simulated or drawn. */
        worldClock: LH.Render.time
      };
    });
    await page.waitForTimeout(1500);
    const stillStopped = await frame.evaluate(c => LH.Render.time === c, gate.worldClock);

    t.ok('portrait: the turn-your-phone screen is up', gate.shown);
    t.ok('portrait: it covers the whole screen', gate.covers);
    t.ok('portrait: it is above everything else', gate.z >= 100, 'z-index ' + gate.z);
    t.ok('portrait: the game is stopped behind it', gate.blocked);
    t.ok('portrait: and really stopped — the world clock is not moving',
         stillStopped, 'the world advanced past ' + gate.worldClock);
    t.ok('portrait: there is no way past it but turning the phone',
         !gate.wayOut, 'a dismiss control is visible');
    t.ok('portrait: it says so', /turn your phone/i.test(gate.words), gate.words);
    await ctx.close();
  } catch (e) {
    t.ok('portrait: boots', false, String(e).slice(0, 160));
  }

  /* ---- landscape: the game ---------------------------------------- */
  const tag = 'landscape: ';
  try {
    const { ctx, page, frame } = await open(SIZES[1]);
    const front = await frame.evaluate(survey, TOUCH_MIN);
    t.ok(tag + 'the game knows it is on a phone', front.mobile, 'Device.mobile=' + front.mobile);
    t.ok(tag + 'it is not stopped', !front.blocked);
    t.ok(tag + 'the layout viewport is the device',
         /width=device-width/.test(front.viewport) && front.vw <= SIZES[1].w + 1,
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
    t.ok(tag + 'the text is big enough to read', game.tiny.length === 0,
         game.tiny.join(' | '));
    t.ok(tag + 'the tutorial talks about the controls you have',
         !/WASD|mouse|click|Press <b>E/i.test(game.guide), game.guide.slice(0, 90));
    await ctx.close();
  } catch (e) {
    t.ok(tag + 'boots', false, String(e).slice(0, 160));
  }

  /* ---- and it notices the moment the phone is turned -------------- */
  try {
    const { ctx, page, frame } = await open(SIZES[0]);
    const before = await frame.evaluate(() => LH.App.blocked);
    await page.setViewportSize({ width: SIZES[1].w, height: SIZES[1].h });
    await page.waitForTimeout(2500);
    const after = await frame.evaluate(() => ({
      blocked: LH.App.blocked,
      gate: getComputedStyle(document.getElementById('rotate')).display
    }));
    t.ok('turning the phone starts the game', before === true &&
         after.blocked === false && after.gate === 'none',
         'blocked ' + before + ' -> ' + after.blocked + ', overlay ' + after.gate);
    await ctx.close();
  } catch (e) {
    t.ok('turning the phone starts the game', false, String(e).slice(0, 160));
  }

  srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
  return t.list;
}

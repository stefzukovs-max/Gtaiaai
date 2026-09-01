/* The control and quality behaviour a phone player feels, driven as
   real touch events and measured as numbers.

   Everything here was a judgement call in CSS or a constant in a file
   until it was measured; these are the assertions that stop the next
   edit quietly undoing one of them. */
import { openGame, checks } from './lib.mjs';

export const name = 'feel';

export async function run(browser) {
  const t = checks();
  const { page, ctx, errors } = await openGame(browser,
    { viewport: { width: 390, height: 750 } });
  await page.evaluate(() => { LH.Front.go('done'); LH.Device.touch = true; });
  await page.waitForTimeout(1500);

  /* --- the walk stick ------------------------------------------- */
  const stick = await page.evaluate(() => {
    const cv = document.getElementById('gl');
    const id = 1;
    const T = (type, x, y) => {
      const touch = new Touch({ identifier: id, target: cv, clientX: x, clientY: y });
      cv.dispatchEvent(new TouchEvent(type, {
        touches: type === 'touchend' ? [] : [touch],
        changedTouches: [touch], targetTouches: type === 'touchend' ? [] : [touch],
        bubbles: true, cancelable: true }));
    };
    const I = LH.Input, out = {};
    const at = (dx, dy) => { T('touchmove', 80 + dx, 500 + dy);
      return { x: +I.move.x.toFixed(3), y: +I.move.y.toFixed(3),
               mag: +I.stick.mag.toFixed(3), run: I.run,
               ox: Math.round(I.stick.ox) }; };

    T('touchstart', 80, 500);
    out.rest = at(0, 0);
    out.tremor = at(5, 0);        /* a thumb resting on the glass */
    out.half = at(35, 0);
    out.full = at(200, 0);        /* well past the ring */
    out.originMoved = I.stick.ox > 81;
    out.backOff = at(150, 0);     /* ease off after the origin moved */
    out.runOn = out.full.run;
    T('touchend', 200, 500);
    out.released = { x: I.move.x, y: I.move.y, run: I.run, active: I.stick.active };
    return out;
  });

  t.eq('a thumb resting on the glass does not walk', stick.tremor.mag, 0);
  t.ok('half deflection is a walk, not a sprint',
       stick.half.mag > 0.05 && stick.half.mag < 0.55, 'mag ' + stick.half.mag);
  t.eq('the edge of the ring is full speed', stick.full.mag, 1);
  t.ok('the stick follows the thumb past its ring', stick.originMoved,
       'origin x ' + stick.full.ox);
  t.ok('easing off after that still slows you down',
       stick.backOff.mag < 0.999, 'mag ' + stick.backOff.mag);
  t.ok('pushing to the edge runs', stick.runOn);
  t.ok('letting go stops', stick.released.x === 0 && !stick.released.run &&
       !stick.released.active);

  /* --- look, and that it is the same gesture on any screen ------- */
  const look = await page.evaluate(async () => {
    const cv = document.getElementById('gl');
    const swipe = (from, to) => {
      const mk = x => new Touch({ identifier: 7, target: cv, clientX: x, clientY: 400 });
      cv.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(from)],
        changedTouches: [mk(from)], bubbles: true, cancelable: true }));
      cv.dispatchEvent(new TouchEvent('touchmove', { touches: [mk(to)],
        changedTouches: [mk(to)], bubbles: true, cancelable: true }));
      const dx = LH.Input.look.x;
      cv.dispatchEvent(new TouchEvent('touchend', { touches: [],
        changedTouches: [mk(to)], bubbles: true, cancelable: true }));
      LH.Input.look.x = 0; LH.Input.look.y = 0;
      return dx;
    };
    const quarter = swipe(200, 200 + Math.round(innerWidth * 0.25));
    /* a flick should still be moving the frame after the thumb leaves */
    swipe(200, 320);
    LH.Input.look.x = 0;
    LH.Input.begin();
    const glide = LH.Input.look.x;
    return { quarter, glide, width: innerWidth };
  });
  /* 900*LOOK_K raw units for a full swipe, at Cam.orbit's 0.0032 rad
     per unit, is about 135 degrees. A quarter of that is a quarter of
     the number, whatever the screen is. */
  t.ok('a full swipe turns about 135 degrees',
       look.quarter > 155 && look.quarter < 215,
       'quarter-swipe gave ' + Math.round(look.quarter) + ' units (' +
       Math.round(look.quarter * 4 * 0.0032 * 57.3) + ' deg per full swipe)');
  t.ok('a flick keeps gliding after the thumb leaves', look.glide > 1,
       'glide ' + look.glide.toFixed(1));

  /* --- the camera helps when both thumbs are busy ---------------- */
  const align = await page.evaluate(async () => {
    const Cam = LH.Cam;
    /* The front end leaves the camera framing the character, and this
       machine reports no touch; both have to be undone before the thing
       under test can be exercised at all. */
    Cam.manual = false;
    LH.Device.touch = true; LH.Device.apply();
    const wired = Cam.autoAlign;
    Cam.yaw = 0; Cam.heading = Math.PI * 0.5;
    for (let i = 0; i < 90; i++) Cam.update(1 / 60, LH.Game.player.pos, null);
    const helped = Cam.yaw;
    Cam.yaw = 0; Cam.orbit(1, 0);
    const before = Cam.yaw;
    for (let i = 0; i < 12; i++) Cam.update(1 / 60, LH.Game.player.pos, null);
    const drift = Math.abs(Cam.yaw - before);
    /* and does nothing at all when there is nowhere to go */
    Cam.heading = null; Cam.yaw = 0;
    for (let i = 0; i < 90; i++) Cam.update(1 / 60, LH.Game.player.pos, null);
    return { wired, helped, driftWhileTurning: drift, standingStill: Math.abs(Cam.yaw) };
  });
  t.eq('a touch device turns the help on', align.wired, 1);
  t.ok('the camera swings behind you as you walk', align.helped > 0.25,
       'yaw reached ' + align.helped.toFixed(2));
  t.ok('and stops the moment you turn it yourself',
       align.driftWhileTurning < 0.02, 'drifted ' + align.driftWhileTurning.toFixed(3));
  t.ok('standing still, it leaves the camera alone',
       align.standingStill < 0.001, 'drifted ' + align.standingStill.toFixed(4));

  /* --- adaptive resolution --------------------------------------- */
  const auto = await page.evaluate(() => {
    const R = LH.Render, A = R.auto;
    /* Pin the tier so this exercises the resolution scale only; the
       tier step is a separate case below. */
    R.applyTier(3); R.tierCeiling = 3;
    window.__stepTier = R.stepTier; R.stepTier = function () {};
    A.on = true; A.scale = 1; A.cool = 0;
    const ceiling = A.ceiling, start = R.quality;
    for (let i = 0; i < 300; i++) { A.cool = 0; R.autoTick(1 / 25); }
    const slow = R.quality, slowScale = A.scale;
    for (let i = 0; i < 300; i++) { A.cool = 0; R.autoTick(1 / 90); }
    const fast = R.quality;
    /* The frame-time average is a rolling one, so the first window after
       a change of pace still has the old pace in it. Let it flush, then
       ask whether a steady 60 leaves it alone. */
    for (let i = 0; i < 200; i++) { A.cool = 0; R.autoTick(1 / 60); }
    const held = R.quality;
    for (let i = 0; i < 200; i++) { A.cool = 0; R.autoTick(1 / 60); }
    return { ceiling, start, slow, slowScale, fast, min: A.min,
             steady: R.quality === held,
             now: [+A.scale.toFixed(3), +R.quality.toFixed(3)] };
  });
  t.ok('a slow frame lowers the resolution', auto.slow < auto.start - 0.05,
       auto.start.toFixed(2) + ' -> ' + auto.slow.toFixed(2));
  t.ok('it does not scale below the floor', auto.slowScale >= auto.min - 0.001,
       'floor ' + auto.min + ', got ' + auto.slowScale.toFixed(2));
  t.ok('headroom gives the resolution back', auto.fast > auto.slow,
       auto.slow.toFixed(2) + ' -> ' + auto.fast.toFixed(2));
  t.ok('it never exceeds the tier it was given',
       auto.fast <= auto.ceiling + 0.001, auto.fast + ' > ' + auto.ceiling);
  t.ok('a frame rate inside the band changes nothing', auto.steady,
       'scale/quality now ' + JSON.stringify(auto.now));

  /* Only once resolution has bottomed out does it start giving up
     effects — and a tier step must leave the numbers consistent, which
     is what the first version of stepTier got wrong. */
  const step = await page.evaluate(() => {
    const R = LH.Render, A = R.auto;
    R.stepTier = window.__stepTier;          /* put it back */
    R.applyTier(3); R.tierCeiling = 3; A.on = true; A.scale = 1; A.cool = 0;
    for (let i = 0; i < 600; i++) { A.cool = 0; R.autoTick(1 / 18); }
    return { tier: R.tier, scale: +A.scale.toFixed(3),
             quality: +R.quality.toFixed(3), ceiling: A.ceiling };
  });
  t.ok('a phone that still cannot keep up gives up effects, not just pixels',
       step.tier < 3, 'tier ' + step.tier);
  t.ok('and the tier step leaves quality consistent with its own numbers',
       Math.abs(step.quality - step.ceiling * step.scale) < 0.002,
       'quality ' + step.quality + ' vs ceiling*scale ' +
       (step.ceiling * step.scale).toFixed(3));

  t.eq('no errors', errors.slice(0, 3).join(' | ') || 'none', 'none');
  await ctx.close();
  return t.list;
}

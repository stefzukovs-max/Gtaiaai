# tools/test

    NODE_PATH=$(npm root -g) node tools/test/all.mjs          # everything
    NODE_PATH=$(npm root -g) node tools/test/all.mjs golden   # one probe

Chromium runs on SwiftShader here, so the game renders at 11-20 fps and a
full run takes a few minutes. That is expected; the timeouts are set for it.

The rule these probes are written to: **measure, do not assert booleans.**
A check that asks "did it load" passes while the screen is blank — that is
how a preview with no stylesheet at all reached a real user. Assert on
sizes, counts, positions and pixels.

  00-boot       modules, canvas size, frame loop, a clean console
  01-golden     the golden path through LH.Net, not through the HUD
  02-cosmetics  every wearable style builds with geometry in it
  03-items      duplicate keys, missing icons, valueless items, dead aisles
  04-preview    site/preview.html over http in a sandboxed iframe

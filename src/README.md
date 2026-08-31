# src/

The game is authored here and assembled into `game/lumen-harbor.html` by
`tools/build.py`. Every file is a verbatim slice of the shipped file, and
`src/manifest.json` records the order, so the build is a concatenation and
nothing else — `python3 tools/build.py --check` proves the two agree byte
for byte.

    shell/00-head.html    doctype, metas, PWA plumbing, fonts, <style>
    css/00-tokens.css     palette, type scale, the shared primitives
    css/01-hud.css        the in-game HUD, sized in cqw/cqh
    css/02-front.css      title, character creation, the first minutes
    css/03-mobile.css     phone layout, safe areas, the portrait reflow
    shell/01-body.html    </style>, the DOM the game mounts into, <script>
    js/00-M.js … js/37-Game.js
    shell/02-tail.html    </script> and the close of the document

The JS files are the LH modules in load order, one per module, with the
banner comment that has always headed each of them. Four carry a name of
their own because they are a section rather than a module: `figure` is the
skinned mesh inside LH.Body, `districts` the places inside LH.World,
`catalogue` the 548 rows of the item table, and the three `*-handlers`
files the server-side halves of activities, missions and realms.

Why it still ships as one file: the game runs offline from a home screen
with no install and no round trip for code. That is worth keeping. The
split is for people — an agent cannot hold 908 KB in its head, and two
edits to one file collide.

Do not edit `game/lumen-harbor.html` or `site/preview.html`. Edit here and
run the build.

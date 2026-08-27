# Pixel Realms → Lumen Harbor

A sandbox MMO in the Growtopia lineage: every player is handed an empty
world and one question — *what will you build that makes people stay?*

It started in 2D. It is now a 3D social sandbox, built by evolving the
mechanical DNA rather than restarting — the data-driven item table, the
rarity tiers, the splice-and-build loop and the economy all crossed over.

This repository holds four deliverables.

## `game/lumen-harbor.html` — the 3D build

**Lumen Harbor** is Pixel Realms rebuilt as a 3D social sandbox: a 352 m
island with nine districts, a private world of your own, fishing, mining,
combat, missions, crafting, trading and an economy — in one self-contained
HTML file with no engine, no dependencies and no downloaded assets. Every
mesh, texture, animation and sound is generated when the page loads.

### Why it is not Unity

The brief said Unity 6 unless the project already indicated an engine. It
did: this project's delivery path is a link you open and play. A Unity
build here would be uncompilable, unverifiable and unopenable, which fails
the brief's own *playable over perfect* rule at step one. So the renderer
is WebGL2, written from scratch, and the architecture is deliberately
portable if that decision ever changes.

### The engine

| Module | What it does |
| --- | --- |
| `LH.M` | Column-major mat4 and vec3 that write into an out-argument — the renderer's hot path cannot allocate — plus the deterministic noise the world generator needs |
| `LH.GL` | WebGL2 device: program introspection at build time, VAOs, instancing, hardware-compare shadow maps, sRGB 2D array textures |
| `LH.Geo` | Procedural geometry behind a transform stack — boxes, chamfers, lofts, limbs, extrusions, discs — so a prop is written the way you'd describe it out loud |
| `LH.Tex` | Thirty-one materials painted per-pixel into one texture array, so the whole world draws with a single texture bound |
| `LH.Render` | Forward renderer: shadow pass, analytic sky with clouds and stars, wrapped-diffuse sun, hemisphere ambient, sixteen point lights a frame, height fog, animated water with a depth-tinted shoreline, bloom, sun shafts, filmic tonemap |
| `LH.Rig` | Nineteen bones and seventeen animation clips, written as functions of phase rather than keyframe tables |
| `LH.Voxels` | Sparse one-metre build layer, meshed per 16-cube chunk with interior faces culled |
| `LH.Net` | The authority boundary |

### The world

Terrain is a heightmap with district **pads** stamped into it — a pad
levels a disc of ground and forces its own surface, which is what lets a
plaza be genuinely flat while the land around it stays organic. Roads use
the same machinery along a polyline and ramp between their endpoints, so
they climb hills instead of cutting through them. The same heightmap
answers every ground query: collision, prop placement, camera clearance.

Nine districts — plaza, market, harbour, jetty, garage, plots, quarry,
arena, mission district — connected by nine roads, with wilderness between
them. Around five thousand props are placed by terrain rather than by hand
and refilled each frame with only what is near enough to matter.

Sky drives everything from one clock: sun colour, gradient, fog, ambient
and exposure interpolate through nine keyframes around the day, with five
weather states riding on top as multipliers.

### Systems

| System | Behaviour |
| --- | --- |
| Building | Sparse voxel layer, exact grid-traversal raycast for placement, seven block shapes, and the face normal decides which side you build on |
| Ownership | Public ground is read-only; your claimed plots and your own worlds are not. Checked server-side, per place |
| Private worlds | Six themes, up to three per player, persisted, with the same generator, chunking and lighting as the public island |
| Items | 155 rows carrying behaviour, rarity, value, recipe and world appearance. Nothing switches on a key name |
| Fishing | Charge the cast, wait, strike inside a window, then fight a fish that runs and tires against a line with a breaking strain |
| Mining | Tool tier gates which materials the rock will yield, rather than just how fast |
| Combat | Six species, one AI state machine, humanoids reusing the player's rig, attacks that wind up before they land |
| Missions | Eighteen across story, daily and weekly, plus nine achievements, all fed by one event tracker |
| Trading | Two nine-slot grids, live totals, lock and confirm, and edits refused on a locked offer |
| Progression | XP from every activity, six skills on their own curves, so a dedicated angler out-ranks a generalist at fishing without out-levelling them |
| Interface | Dark premium HUD sized in container units, reusable panels, procedurally drawn item icons cut from the material each item will have in the world |
| Onboarding | Title, character creation over the live world, and a seven-step checklist that completes when you act, not when you click |
| Audio | Synthesised — an effect library and a generative score whose scale follows the time of day |
| Input | One abstraction over keyboard, mouse, touch and gamepad; nothing downstream knows which was used |

### The authority boundary

`LH.Net` owns inventory, currency, XP, skills, cosmetics, plots, worlds and
mission progress. The rest of the game cannot reach that state: it is
closed over, and snapshots are copies rather than live references. Every
handler re-derives its inputs from the server's own copy — reach,
ownership, quantity and occupancy are checked there, not at the call site.
Handlers registered from outside receive a private context as their second
argument, created inside the closure and never returned, so nothing that
can call `Net.request` can grant itself an item.

**There is no server behind it yet, and the game says so in its own second
line.** Other people in the harbour are simulated; their chatter and their
trades are local fiction. What is real is the boundary — swapping the
dispatcher for a WebSocket is a transport change, not a rewrite.

### Running it

Open `game/lumen-harbor.html` directly, or serve the folder. Needs WebGL2.
The game is landscape-only; in portrait it keeps the landscape layout and
asks you to turn the device.

### The sky

Twelve floating islands ring the harbour, three of them pouring water into
open air. Their height is derived from their radius rather than rolled
independently: a keel hangs 1.72 island-radii below its grass cap, so two
free random numbers put a large island's point through the rooftops.

Street lamps, shop signs and the fountain crystal register themselves as
point lights when they are placed, and the renderer picks the sixteen
nearest the camera each frame. They fade up with the sun's elevation
instead of switching on at a clock edge, and overcast brings them on early.

---

## `site/index.html` — the landing page

The product page for Lumen Harbor: hero, world, pillars, systems, and a
plain statement of where the build actually stands. Every image on it is a
screenshot of the running game — captured through a headless browser from
the same file you can open — rather than concept art.

---

The two 2D deliverables that preceded it:

## `concept/pixel-realms.html` — the concept art bible

A single-page art bible in six plates: a live in-game screen, the avatar
lineup, the cosmetics vault, the chat/trade/inventory systems, the social hub,
and the production style guide.

Nothing in it is a bitmap file. Every sprite is generated in the browser from
layer data:

- a **24 × 32 base rig** with eight equip layers (wings, cape, body, legs,
  outerwear, face, hair, headwear), composited into a 56 × 44 frame
- **procedural cosmetics** — six wing styles, six capes, eight eye styles,
  eight gems and thirteen block tiles, each drawn from a mask plus a per-style
  shading rule rather than hand-placed pixels
- **canvas-rendered scenes** for the shop world and the social hub

## `game/pixel-realms.html` — the playable build

The same art, running, built around the loop Growtopia actually runs on:
**punch → seed → splice → lock**. One self-contained file, no dependencies,
no fetched assets — every pixel is drawn at load time.

### Getting in

The game boots to a **title screen** over a daylight sky, then a **login
screen** — pick a name, optionally claim a RealmID — then a **connect log** that
locates the server and logs you on, then the **world picker**: type any name to
join it or create it, or tap a chip under Top Worlds, My Worlds or Recently
Visited. `G` reopens the picker at any time.

You arrive **bare**: no hair, no clothes, gold eyes, tan skin. Every layer after
that is something you found, spliced or bought. A world nobody has built in yet
is exactly that — flat grass over solid dirt with the odd pebble, a white exit
door, and sky.

**Play:** `A`/`D` move · `W` jump · `S` drop through a platform · `1`–`0` hotbar ·
`E` backpack · `B` splice book · `G` worlds · `T` chat · `Esc` pause menu.
**There is no tool button.** What you hold decides what you do: bare hands punch,
a block in hand builds, and picking up the wrench puts you in wrench mode. Click a
block to punch it, click empty space to build, walk into a door and press `↑` to
travel, click a player to trade. Touch pads appear on coarse-pointer devices.

### The characters

Avatars use Growtopia's own proportions: a **24 × 32 rig** in a 56 × 48 frame,
built from a big square head (half the figure), two bold dark eyes with a
coloured iris and a single glint, a two-pixel mouth, and a short stocky body on
two separate legs. Everything sits on the pixel grid with a one-pixel ink
outline — chunky on purpose, no soft curves. Nothing is a bitmap; the whole
figure is drawn from block math, so a new hair style or wing is a function,
not an asset.

- **Twelve equip slots** — back, cape, pants, shirt, chest, feet, hand, face,
  hair, neck, hat and a **pet** that trails behind you
- **122 wearables**, including eight wing styles with scalloped flight
  feathers or veined membranes, ten hair styles, nine hats, and seven pets
- **Animated**: a 16-frame idle strip per outfit drives the wing flap and the
  blink; walk, jump and climb poses are cut out of the composed frame and
  re-offset, so any outfit animates without per-outfit art
- **Glow**: eyes and wings get a faint bloom pass — enough to read as neon
  without softening the block art

### The interface (and the front end)

Light blue panels with a white bevel and dark text, the way Growtopia does it.
The game is **landscape only** — in portrait it keeps the landscape layout and asks
you to turn the device, so nothing has to reflow.

The default screen carries four things: one small box in the top-left holding your
face, name, gems and locks together; a chat tab stuck to the top edge; two icon
buttons; and the hotbar. No world title, no tool row, no button shelf — every other
function lives on the pause menu.

The backpack is the **swipe-up sheet**, the way Growtopia does it: drag the handle
under the hotbar (or press `E`) and the grid rises over the world. Chunky slots —
orange border for the selected stack, green for what you are wearing — with
**RECYCLE / STORE / DROP / INFO** acting on whatever you picked, and a double-tap
on a hundred World Locks fusing them into a Diamond Lock.

### Built on Growtopia's data model

Items are **table rows, not code**. Each one declares an id, key, name,
behaviour type, rarity, layer, collision, hit count, grow time, spread rule,
drop table and props — the same shape as the real game's `items.dat`. Adding a
block is one line.

- **153 items** across **31 behaviour types** from the decoded `TYPE_*` enum:
  locks, gateways, providers, chests, pinatas, dice, switcheroos, checkpoints,
  trampolines, weather machines, mannequins, magic eggs, lab benches,
  heart monitors, donation boxes, ice, lava, spikes, portals and more
- **102 splice recipes**, tracked in a splice book

### The world

A sunset sky in six stops with a sun sitting on the horizon, a crescent moon,
depth-faded stars, **two parallax bands of floating islands** (rock keels, grass
lips, blossom trees, lit windows), drifting cloud bands and **34 sakura petals**
falling at three depths. Shopfronts are lit purple brick under neon awnings, with
signage spelled out in real blocks you can punch out of the wall.

The spawn world is built to be **walked through, not across**. Instead of one flat
strip of grass it stacks **three terraces** — wood at five rows up, steel platform
at ten, neon at fifteen — joined by eight ladder runs, so there is always something
above you and something below. Each level is dressed: clipped hedges and hedge
blossom, flower beds in pink, white and red, white and timber fencing along every
drop, hanging lanterns at a fixed rhythm, stacked crates, and sakura trees planted
both in front of and behind the walkways. Three shopfronts open onto the promenade,
a playground strip carries the trampoline, checkpoint, boombox, switcheroo, dice,
pinata, chest and mailbox, and six NPCs walk it. Nine decorative blocks — hedge,
hedge blossom, fence, white fence, three flower beds, crate and billboard — exist
purely so a world can be *furnished* rather than merely built.

### Rendering

- **32 px tiles**, every art function written as `f(a, b, S, mask, frame)` so the
  resolution is a single constant
- **Chunked baking** — the world is cut into 16 × 16-tile chunks drawn to
  offscreen canvases and re-baked only when a tile in them changes
- **BFS lighting** — skylight falls down open columns, emissive blocks seed
  their own light, and it attenuates through air, background and solids at
  1 / 2 / 4 per step, so caves are genuinely dark
- **Edge-aware tiling** — a 4-bit neighbour mask picks the right seams, so runs
  of the same block read as one surface

Measured on a 960 × 540 canvas: **60 fps**, `drawWorld` 0.17 ms, `relight`
0.43 ms, `chunkBuild` 0.38 ms — the packed spawn world costs nothing measurable.

**Systems**

| System | Behaviour |
| --- | --- |
| Two tile layers | Foreground blocks you collide with, background walls you walk in front of — the same split Growtopia uses |
| Punching | Hit-based, not timer-based: every block has a hit count, with cracks and a swinging fist |
| Seeds & trees | Blocks drop seeds; plant one on a background wall and it grows in real time |
| Splicing | Plant a *different* seed on a growing tree to invent a new block — 102 recipes |
| Drops | Broken blocks, seeds and gems fall as pickups that magnet toward you |
| World locks | Place one to claim a world; nobody else can build there until it comes out |
| Providers | Passive-income machines that pay out on a timer once placed |
| Doors & signs | Wrench a door to point it at any world, wrench a sign to write on it |
| Platforms & ladders | One-way planks and climbable vines/ladders |
| Hazards | Lava, spikes, deadly-if-on blocks, respawn checkpoints |
| Physics blocks | Ice is slippery, trampolines and bouncy blocks launch you |
| Worlds | Type any name in the WORLDS panel — existing worlds load, new names are generated deterministically from the name |
| Terrain | 100 × 54 tiles: grass, dirt, stone, carved caves, ore veins, bedrock |
| Level design | The spawn world is terraced three levels deep and dressed with hedges, flower beds, fencing, lanterns and crates, so it reads as a built place rather than a blank canvas |
| Decoration | Nine furnishing blocks that do nothing but look like somewhere — hedges, four flower beds, two fence styles, crates and a billboard |
| Inventory | 200 slots, 10-slot hotbar, stacking, rarity borders, shift-click to drop |
| Wardrobe | Twelve slots including a pet — the world sprite updates live, with walk/jump/climb poses |
| Name tags | A drawn country flag and a green handle over a dark plate. Flags are pixel designs, not emoji — emoji flags do not render on Windows at all. Your own comes from the browser's locale, read locally |
| Chat | A dark translucent log hanging from the top edge, one timestamped line per message, tucked behind a tab until something arrives |
| Announcements | Splices, fuses and milestones land in a centred blue box with the item names picked out in gold |
| Earning | A **How To Earn** guide on the pause menu: live progress toward your next World Lock, the eight-step path from bare hands to owning a world, and a table of what every starter crop actually pays per minute — all computed from the shipping numbers, not written by hand |
| Rarity | Every item wears its tier: a coloured rim and bloom in the slot, a sheen that sweeps the good stuff, sparks on mythic and ancient, and a matching halo on the drop in the world |
| Held items | Every hand slot is a real object: a sword has a bevelled blade, a crossguard and a pommel; a staff has an orb; a scythe sweeps outward; a bow has limbs and a string; picks, torches and lanterns have heads and housings |
| Crowns and capes | The crown is a shaded gold band with five points and four set jewels; capes carry three lit-and-shadowed folds so they stop reading as a flat gradient |
| Cosmetic tiers | Wings take a bright leading-edge trim and capes a lit hem at legendary and up; anyone wearing that grade trails sparks and stands in a ground bloom in their tier's colour |
| Menus | A pause menu (Exit World / Respawn / Options / Store / Support) and a player card (Trade / Send Message / Add as friend / View worn clothes / Ignore / Report) |
| Gem store | A branded storefront with category aisles — Seeds, Blocks, Style, Locks — priced in gems you dug up yourself |
| Break feel | Blocks shatter into four spinning quarters of their own art; the punch swings on an arc with a motion streak and squashes on impact |
| Trade requests | Players walk up and send you a live offer card with both grids previewed and a 30-second timer; open it to negotiate |
| Chat | World chat with speech bubbles, NPC chatter, and `/warp` `/name` `/who` `/splice` commands |
| Trade | Nine-slot offer grids with live valuation; the NPC accepts only when the value clears |
| Economy | Gems are untradable system currency; the **World Lock** is the trade unit, and 100 of them fuse into a Diamond Lock |
| Audio | Generated with WebAudio — punches, breaks, pickups, splices — no sound files |
| Persistence | Autosaves your worlds, inventory, currency and discovered recipes to `localStorage` |

World signage is placed through a 3 × 5 bitmap font, so every neon letter on a
shop wall is a real block you can punch out and take with you.

**Not included:** there is no server. Other players are simulated, so trades and
visitor counts are local fiction — the systems are real, the multiplayer is not.

## `docs/` — the parity teardown

[`growtopia-parity.html`](docs/growtopia-parity.html) measures this build against the
real Growtopia: the decoded `items.dat` behaviour enum, the ten clothing slots, the
currency model, and the phased build prompt that closed the gap.
[`MEGA-PROMPT.md`](docs/MEGA-PROMPT.md) is that prompt on its own, ready to paste.

## Running

Both files are plain HTML. Open them directly, or serve the folder:

```
npx http-server . -p 8080
```

Then visit `/concept/pixel-realms.html` or `/game/pixel-realms.html`.

# Pixel Realms

A 2D sandbox MMO in the Growtopia lineage: every player is handed an empty
world and one question — *what will you build that makes people stay?*

This repository holds two deliverables.

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

**Play:** `A`/`D` move · `W` jump · `S` drop through a platform · `1`–`0` hotbar ·
`E` items · `B` splice book · `G` worlds · `T` chat · `Z`/`X`/`C` punch/place/wrench.
Click a block to punch it, click empty space to build, walk into a door and press
`↑` to travel, click a player to trade. Touch pads appear on coarse-pointer devices.

### The characters

Avatars are chibi-proportioned and drawn on a **28 × 34 rig** inside a 68 × 58
frame — a head that is 40% of the figure, and eyes seven pixels tall with a
lash line, a shaded iris, a white catchlight and a wet-look sparkle. Nothing is
a bitmap; the whole figure is drawn from span and ellipse math, so a new hair
style or wing is a function, not an asset.

- **Twelve equip slots** — back, cape, pants, shirt, chest, feet, hand, face,
  hair, neck, hat and a **pet** that trails behind you
- **122 wearables**, including eight wing styles with per-feather scalloping,
  ten hair styles with real strands and side locks, nine hats, and six pets
- **Animated**: a 16-frame idle strip per outfit drives the wing flap and the
  blink; walk, jump and climb poses are cut out of the composed frame and
  re-offset, so any outfit animates without per-outfit art
- **Glow**: eyes and wings get a radial bloom pass, which is what makes the
  neon read at 32px

### Built on Growtopia's data model

Items are **table rows, not code**. Each one declares an id, key, name,
behaviour type, rarity, layer, collision, hit count, grow time, spread rule,
drop table and props — the same shape as the real game's `items.dat`. Adding a
block is one line.

- **144 items** across **31 behaviour types** from the decoded `TYPE_*` enum:
  locks, gateways, providers, chests, pinatas, dice, switcheroos, checkpoints,
  trampolines, weather machines, mannequins, magic eggs, lab benches,
  heart monitors, donation boxes, ice, lava, spikes, portals and more
- **102 splice recipes**, tracked in a splice book

### The world

A sunset sky in six stops with a sun sitting on the horizon, a crescent moon,
depth-faded stars, **two parallax bands of floating islands** (rock keels, grass
lips, blossom trees, lit windows), drifting cloud bands and **34 sakura petals**
falling at three depths. Shopfronts are lit purple brick with neon signage
spelled out in real blocks you can punch out of the wall.

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

Measured on a 960 × 540 canvas: **60 fps**, `drawWorld` 0.20 ms, `relight`
0.32 ms, `chunkBuild` 0.23 ms.

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
| Inventory | 200 slots, 10-slot hotbar, stacking, rarity borders, shift-click to drop |
| Wardrobe | Twelve slots including a pet — the world sprite updates live, with walk/jump/climb poses |
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

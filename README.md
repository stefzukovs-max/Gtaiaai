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
`E` items · `B` splice book · `G` worlds · `T` chat · `Z`/`X`/`C` punch/place/wrench.
Click a block to punch it, click empty space to build, walk into a door and press
`↑` to travel, click a player to trade. Touch pads appear on coarse-pointer devices.

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
The default screen carries almost nothing: an identity chip, a currency chip,
the world title, a row of icon buttons and the hotbar. Everything else opens on
demand. The backpack is a grid of chunky slots — orange border for the selected
stack, green for what you are wearing — with a **RECYCLE / STORE / DROP / INFO**
column beside it that acts on whatever you picked.

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

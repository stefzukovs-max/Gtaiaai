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

### Built on Growtopia's data model

Items are **table rows, not code**. Each one declares an id, key, name,
behaviour type, rarity, layer, collision, hit count, grow time, spread rule,
drop table and props — the same shape as the real game's `items.dat`. Adding a
block is one line.

- **141 items** across **31 behaviour types** from the decoded `TYPE_*` enum:
  locks, gateways, providers, chests, pinatas, dice, switcheroos, checkpoints,
  trampolines, weather machines, mannequins, magic eggs, lab benches,
  heart monitors, donation boxes, ice, lava, spikes, portals and more
- **102 splice recipes**, tracked in a splice book
- **75 wearables** over **ten equip slots** plus the held hand slot

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

Measured on a 960 × 540 canvas: **60 fps**, `drawWorld` 0.14 ms, `relight`
0.30 ms, `chunkBuild` 0.25 ms.

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
| Wardrobe | Back, cape, pants, shirt, chest, feet, hand, face, hair, neck, hat — the world sprite updates live, with walk/jump/climb poses |
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

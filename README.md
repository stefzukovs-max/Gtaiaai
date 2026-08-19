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
**punch → seed → splice → lock**. One self-contained file, no dependencies.

**Play:** `A`/`D` move · `W` jump · `S` drop through a platform · `1`–`0` hotbar ·
`E` items · `B` splice book · `G` worlds · `T` chat · `Z`/`X`/`C` punch/place/wrench.
Click a block to punch it, click empty space to build, walk into a door and press
`↑` to travel, click a player to trade. Touch pads appear on coarse-pointer devices.

**Systems**

| System | Behaviour |
| --- | --- |
| Two tile layers | Foreground blocks you collide with, background walls you walk in front of — the same split Growtopia uses |
| Punching | Hit-based, not timer-based: every block has a hit count, with cracks and a swinging fist |
| Seeds & trees | Blocks drop seeds; plant one on a background wall and it grows in real time |
| Splicing | Plant a *different* seed on a growing tree to invent a new block — 25 recipes, tracked in a splice book |
| Drops | Broken blocks, seeds and gems fall as pickups that magnet toward you |
| World locks | Place one to claim a world; nobody else can build there until it comes out |
| Doors & signs | Wrench a door to point it at any world, wrench a sign to write on it |
| Platforms & ladders | One-way planks and climbable vines/ladders |
| Worlds | Type any name in the WORLDS panel — existing worlds load, new names are generated |
| Terrain | 100 × 54 tiles: grass, dirt, stone, carved caves, neon ore veins, bedrock |
| Inventory | 200 slots, 10-slot hotbar, stacking, rarity borders, shift-click to drop |
| Wardrobe | Wings/eyes/hats/capes/shoes; the world sprite updates live |
| Chat | World chat with speech bubbles, NPC chatter, and `/warp` `/name` `/who` `/splice` commands |
| Trade | Nine-slot offer grids with live valuation; the NPC accepts only when the value clears |
| Shop | Seeds, blocks, world locks and cosmetics for gems mined out of the ground |
| Persistence | Autosaves your worlds, inventory, gems and discovered recipes to `localStorage` |

World signage is placed through a 3 × 5 bitmap font, so every neon letter on a
shop wall is a real block you can punch out and take with you.

## Running

Both files are plain HTML. Open them directly, or serve the folder:

```
npx http-server . -p 8080
```

Then visit `/concept/pixel-realms.html` or `/game/pixel-realms.html`.

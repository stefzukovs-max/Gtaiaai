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

The same art, running. One self-contained file, no dependencies.

**Play:** `A`/`D` move · `W` jump · `1`–`0` hotbar · `E` inventory · `T` chat.
Click a block to mine it, click empty space to place one, walk into a portal
and press `↑` to travel, click a player to trade. Touch controls appear on
coarse-pointer devices.

**What's in it**

| System | Behaviour |
| --- | --- |
| World | 96 × 44 tile grid, 16px tiles, solid/scenery block classes |
| Building | Hold-to-mine with per-block hardness; placement requires an adjacent block |
| Worlds | Skyblock Hub, a player-built shop, and your own editable world |
| Inventory | 200 slots, 10-slot hotbar, stacking, rarity borders |
| Wardrobe | Equip wings/eyes/hats/capes/shoes; the world sprite updates live |
| Chat | World chat with floating speech bubbles; NPCs talk back |
| Trade | Nine-slot offer grids, live valuation, accept only when the value clears |
| Shop | Blocks and cosmetics for gems mined out of the ground |
| Persistence | Autosaves your world, inventory and gems to `localStorage` |

The three worlds are generated in code at boot, including the neon signage —
every letter on a shop wall is a real block placed through a 3 × 5 bitmap font,
which is why signs can be broken and rebuilt like anything else.

## Running

Both files are plain HTML. Open them directly, or serve the folder:

```
npx http-server . -p 8080
```

Then visit `/concept/pixel-realms.html` or `/game/pixel-realms.html`.

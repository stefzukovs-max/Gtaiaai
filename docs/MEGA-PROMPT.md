# Pixel Realms → Growtopia parity: the build prompt

Paste this whole block into a coding agent with the repo open. It names the real functions in
`game/pixel-realms.html` so the agent extends the file rather than restarting it. Phases are
ordered by dependency — phase 1 unblocks everything after it.

The analysis behind it is in [`growtopia-parity.html`](./growtopia-parity.html).

```text
PIXEL REALMS -> GROWTOPIA PARITY

== CONTEXT ==
You are extending game/pixel-realms.html: one self-contained HTML file (~3,100 lines,
~133KB, no dependencies except Google Fonts). It already implements two tile layers
(foreground + background), hit-based punching with per-block hit counts, seeds -> trees ->
splicing (25 recipes), item and gem drops with magnet pickup, World Locks, doors and signs
editable with a wrench, one-way platforms, climbable ladders and vines, procedural terrain
with caves and ore veins, a 200-slot inventory with a 10-slot hotbar, a 5-slot wardrobe,
world chat with slash commands, NPC trading, a shop, and localStorage persistence.

ARCHITECTURE YOU MUST PRESERVE:
- One file. No bundler, no external JS or CSS. Google Fonts is the only permitted remote.
- ALL art is generated in the browser from layer data. Never ship, fetch or embed a bitmap.
  The sprite forge is the first <script> block: P.forge, P.drawTile, P.drawWings, P.drawGem,
  P.blit, P.mk. Extend it; do not replace it with images.
- Modules talk through window.PRG (blocks + world), PRI (items + worldgen), PRS (state +
  render helpers), PRD (draw + interaction). Keep that separation.
- Fixed-resolution canvas upscaled with image-rendering: pixelated.

Ship in phases. Every phase must leave the game playable and must not regress this path:
punch grass -> plant seed -> splice -> harvest -> place World Lock -> travel through a door.

== PHASE 1 - DATA-DRIVEN ITEMS (do this first; it unblocks everything) ==
Replace the hardcoded reg(key, name, opts) registry with a real item table modelled on
Growtopia items.dat. Each item is data, not code:

    { id, key, name,
      type,          // integer behaviour id (see PHASE 2)
      rarity,        // NUMBER 1..135+, not a label. Drives XP and value.
      layer,         // fg | bg
      collision,     // none | solid | platform | climb
      hits,          // punches to break
      growTime,      // ms for this seed to become a ripe tree
      spread,        // single | edge | random  (how the tile art tiles)
      drops,         // [{ item, chance, min, max }]
      clothingSlot,  // when type === CLOTHES
      props }        // per-type payload: {dest} {text} {power} {interval} {channel}

Rules:
- Renderer, collision, drop table, tooltip, inventory and minimap all switch on type and
  collision. Never on a hardcoded key name.
- rarity becomes numeric. Break XP = rarity. Sell value scales from it. Derive the slot
  border colour from rarity bands instead of the current string labels.
- Migrate all 37 existing blocks into the new table FIRST and verify no regression, then add.
- Success test: adding a block is one row and zero other edits.
- Target 120+ items by the end of phase 4.

== PHASE 2 - BEHAVIOUR TYPES ==
Implement handlers in three tiers. Use Growtopia ids so the table stays comparable.

TIER A - world-defining, implement all:
   6 DEADLY           contact kills; respawn at last checkpoint or the main door
  27 CHECKPOINT       sets the respawn point on touch
   7 TRAMPOLINE       launches upward, strength from props.power
  24 BOUNCY           horizontal restitution
  25 POINTY           directional spikes, deadly from one side
  16 LAVA             deadly + lighting tint + rising particles
  29 ICE              low ground friction (block exists; add the physics)
  38 PROVIDER         yields props.item every props.interval; click to collect
  32 CHEST            loot roll, one per player per chest
  26 PORTAL           paired in-world teleport linked by props.channel
   2 USER_DOOR        door with an access list
   3 LOCK             generalise to World / Small (radius) / Builder (allow-list)
  41 WEATHER_MACHINE  swaps the sky palette and particle layer for the world
  12 BOOMBOX          generated WebAudio loop while the player is in range

TIER B - depth, implement most:
   8 CONSUMABLE       one-shot speed / jump / glow / gravity effect
   9 GATEWAY          passable only while holding a required item
  34 BULLETIN         world message board
  35 PINATA           breaks after N hits, sprays drops
  36 DICE             random face on punch
  42 SCOREBOARD       per-world counter
  31 SWITCHEROO       toggle state other blocks read
  37 COMPONENT        crafting ingredient, never placeable
  39 LAB              consumes components, produces an item
  49 MANNEQUIN        displays a stored outfit
  33 MAILBOX          drop-off the owner collects
  47 DONATION_BOX     accepts items from visitors
  28 MUSICNOTE        plays a pitch on touch; a row is a melody

TIER C - flavour, cheap once A and B exist:
  11 / 21 / 22        animated tiles: 2-4 frames on one global clock
  40 ACHIEVEMENT, 44 PROFILE, 46 HEARTMONITOR, 48 TOYBOX, 50 CAMERA,
  51 MAGICEGG, 52 TEAM, 43 SUNGATE, 45 DEADLY_IF_ON

== PHASE 3 - GRAPHICS ==
Resolution is the single biggest visual gap. Growtopia authors at 32x32; we draw 16x16.

- Move tile authoring to 32x32 (TS = 32). Raise the render canvas to 960x540 so the field of
  view stays about 30 tiles wide. Every ART.* function is procedural, so this is mechanical --
  but spend the doubled detail budget: bevels, a top highlight row, per-edge variation.
- EDGE-AWARE TILING. A spread:"edge" block picks its art from its four neighbours: grass grows
  a lip over dirt, stone seams align, wallpaper corners round off. Implement a 4-bit neighbour
  mask -> variant index.
- ANIMATED TILES. 2-4 frames per item, driven by one global counter.
- REAL LIGHTING. Replace the single additive glow blit with per-tile light propagation:
  emissive blocks seed a light level, flood-fill outward with attenuation, cache per chunk,
  recompute only on edit. Underground darkness should be genuine, not a gradient overlay.
- DEPTH. Background tiles already darken; add a slight blue shift and a 1px inner shadow where
  foreground meets background so player builds read as rooms rather than stickers.
- CHARACTER ANIMATION. The forge emits one frame today. Emit a 4-frame walk cycle, a 2-frame
  punch, a jump pose and a climb pose by offsetting limb rows in the existing layer data.
- PARTICLES WITH WEIGHT. Debris already takes the broken block colour; add tumble rotation and
  a ground-splat final frame.
- HAND SLOT. Once clothing has a hand layer, the punch animation swings the held item.

== PHASE 4 - TEN CLOTHING SLOTS ==
Add Hair, Neck, Chest, Shirt, Pants and Hand as real equip layers in the forge. Composite in
this z-order: back -> cape -> pants -> shirt -> chest -> body -> feet -> hand -> face -> hair
-> hat -> artifact. Ship at least six items per new slot. Group matching pieces as named sets
in the shop, bought individually the way Growtopia sells them.

== PHASE 5 - ECONOMY (reverse the current mistake) ==
- Gems become UNTRADABLE and UNDROPPABLE. They buy from the system shop only. This is exactly
  how Growtopia works and it is the reason its player economy holds value.
- The WORLD LOCK becomes the trade unit. Add DIAMOND LOCK = 100 World Locks, fused by tapping
  a stack of 100 in the inventory.
- NPC trade offers and the trade window price in locks, not gems.
- Add GROWTOKENS: a premium counter earned from achievements and daily streaks, spent in a
  separate store, never tradable.
- Add PROVIDERS as the passive-income tier so a locked world is worth coming back to.
- Rebalance so a full session of active mining is worth roughly one World Lock.

== PHASE 6 - WORLD AND SOCIAL ==
- Access lists on locks: owner, allowed players, public-build toggle.
- World of the Day and a most-visited board in the hub, driven by real visit counts.
- Guilds: a name, a tag beside the player name, a shared world.
- Route NPC trading through the same code path a player-to-player trade would use, so adding a
  server later is a transport change and not a rewrite.
- Roles, cheapest first: Fishing (rod + water tile + catch table), then Cooking (components +
  a LAB block), then Surgery. Each is a mini-loop that consumes world blocks and produces
  tradeable output.

== PHASE 7 - AUDIO ==
WebAudio, fully generated, no files: a square-wave punch, a break crunch shaped by block
hardness, a pickup blip, a splice chime, an ambient pad per sky palette. Mute toggle in the
HUD. Honour prefers-reduced-motion on the visual side.

== PERFORMANCE BUDGET ==
- 60fps on a five-year-old phone. 16ms frame: <=4ms world draw, <=2ms entities, <=2ms lighting.
- CHUNK THE WORLD into 16x16-tile chunks rendered to offscreen canvases, re-rendered only when
  a tile inside them changes, then blitted. Do this BEFORE moving to 32px tiles, not after.
- Keep the file under 400KB.

== DEFINITION OF DONE ==
1. Adding a new block is one row in the item table and zero other edits.
2. 120+ items across 25+ behaviour types, all reachable in normal play.
3. Ten clothing slots composite correctly, front and back, at 32px.
4. A player can die, respawn at a checkpoint, and be launched by a trampoline.
5. A provider pays out on a timer, and a locked world keeps strangers out.
6. Gems cannot leave your account. A Diamond Lock can.
7. The regression path still passes with no console errors.
8. 60fps at 960x540 with a fully built world on screen.
```

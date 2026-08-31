# Lumen Harbor → AA indie 3D sandbox MMO: the build prompt

Paste the block below into a coding agent with this repo open. It names the real modules,
functions and fields in `game/lumen-harbor.html`, so the agent extends the game rather than
restarting it — the same discipline as [`MEGA-PROMPT.md`](./MEGA-PROMPT.md), which took the
earlier 2D game to Growtopia parity.

Phases are ordered by dependency, not by appeal. Phase 0 and Phase 1 are unglamorous and
unblock everything after them. An agent that starts at "farming" because farming sounds fun
will build a farming minigame bolted to a single-player toy, and every later phase will have
to tear it out.

```text
LUMEN HARBOR -> AA INDIE 3D SANDBOX MMO

== READ THIS FIRST ==

You are extending an existing game. Read game/lumen-harbor.html and README.md before you
write a line. The README is 85 KB of design rationale written by the people who built every
system you are about to touch; it explains why things are the shape they are, and most of
your instincts to "clean this up" are answered in it.

Three rules that override anything else in this brief:

1. TELL THE TRUTH IN COPY. The game is currently single-player with a simulated crowd and
   no server. The game, README.md and site/index.html all say so, deliberately. You may not
   describe it as multiplayer, online or an MMO in any user-facing string, marketing page,
   store listing or commit message until real sockets carry real other people. When Phase 1
   lands, change the copy in the same commit that makes it true. Not before.

2. NEVER TRUST THE CLIENT. Not with currency, inventory, item ownership, damage, crop growth,
   trade results, XP, land, or the outcome of anything a player would pay for. This is already
   the architecture (see LH.Net below). Every system you add obeys it.

3. SHIP IN SLICES. Every phase ends with the game playable, verified and pushed. Never leave
   the golden path broken between commits. The golden path is:

       spawn -> move -> mine a block -> plant a seed -> harvest it -> sell it ->
       buy something -> wear it -> enter your own world -> place a block -> leave

   If a change breaks any link in that chain, the change is not done.

== WHAT ALREADY EXISTS ==

game/lumen-harbor.html — one self-contained file, ~908 KB, ~22,800 lines, zero dependencies
except two Google Fonts. Everything is generated at runtime: no downloaded meshes, no
textures, no sprite sheets, no audio files. 35 modules hang off a single global `LH`:

  M GL Geo Tex Render Cam App Device Rig Body Cos Actors Cast Terrain Props Arch World
  Input Player Sky Data Voxels Net Icon UI Enemies Fishing Activities Quests QuestNet
  Realm RealmNet Audio Front Game

Renderer: WebGL2 forward, written from scratch. Cascaded shadows, SSAO, FXAA, bloom, a toon
term, rim light, wind, water with fresnel and sky reflection. Three quality tiers
(R.TIERS / R.applyTier) with a device-aware DPR cap in LH.Device.

Characters: one continuous skinned mesh, 22 bones, linear blend skinning, procedural faces,
hair built from lofted shells and spikes, ~139 cosmetic styles across ten slots.

Data: 548 items in one table, each declared with

    It(key, name, { desc, cat, r, value, stack, tradeable, placeable, consumable,
                    recipe, shape, col, ... })

value defaults to `4 * 2.35^(rarity-1)` and is the single source of price — the shop marks
up from it, the vendor marks down from it, the trade window totals with it. Categories in
D.CAT, six rarities in D.RARITY, seven placeable shapes in D.SHAPES that the voxel mesher
switches on and nothing else.

World: LH.Terrain generates the harbour; LH.Voxels is the build layer with serialise /
deserialise; LH.Realm gives every player private worlds they can build in, leave and come
back to, with permissions.

Play: mining, fishing, melee combat with enemy AI, six skills
(building, mining, fishing, combat, exploration, social), NPCs with dialogue, missions,
achievements, titles, a shop, a wardrobe, an emote wheel.

THE AUTHORITY SEAM — THE MOST IMPORTANT THING IN THE CODEBASE:

LH.Net is a simulated server that runs in the same JavaScript context but is written as
though it were remote:

    Net.request(action, payload, cb)     // the only way the client asks for a change
    Net.register(name, function(p, srv)) // a handler; 23 exist today
    srv.give / take / has / coins / shards / xp / hurt / heal / stat / skill / buff /
    mission / achievement / title / worlds / world / meet / visit / snapshot

Handlers receive `srv`, a deliberately narrow api. The client cannot reach `state`. It asks,
the authority decides, the authority answers. There is already a complete two-sided trade
protocol behind it: tradeOpen, tradeOffer, tradeLock, tradeConfirm, tradeCancel, tradeState.

This means the hard architectural work is DONE and you must not undo it. Turning this into a
real MMO is not a rewrite. It is: move the handler bodies to a Node process, replace the
`Net.request` function body with a websocket send, and keep every handler signature
identical. Anything you add from here registers a handler. Nothing you add mutates state
from the client, "just for now".

Persistence today is localStorage under key `lumen.save`, versioned `v:1`.

Mobile: virtual stick, contextual action bar, safe-area insets, PWA manifest and service
worker, installable to a home screen with no browser chrome, wake lock, orientation hint.

Site: site/preview.html is generated from the game by tools/build-preview.py. Edit the game,
run the script; never hand-edit the preview.

== THE ONE IDEA ==

Growtopia is not a farming game with trading attached. It is an ECONOMY, and farming,
trading and quests are three faces of it: farming is the faucet, trading is the market,
quests are the tutorial and the sink. Players stay for years because the items they grow
have a price other players set, and because the thing they are saving up for — land — is
permanent, scarce and visible to everyone.

Build the economy first and hang the mechanics off it. Build three separate minigames and
you will have a farming timer, a chat window and a chore list, and nobody will play it twice.

Concretely, one sentence you should be able to say truthfully when you are finished:

  "A new player can plant a seed in their first two minutes, and the item that seed grows
   into is worth something because another real person wants it and there is a finite
   amount of it."

Every design argument gets settled against that sentence.

== ARCHITECTURE YOU MUST PRESERVE ==

- Procedural art only. No meshes, no textures, no bitmaps, no audio files, fetched or
  embedded. The forges are LH.Geo, LH.Tex, LH.Body, LH.Cos, LH.Icon. Extend them.
- The item table is data. Renderer, collision, drops, icons, tooltips, shop, crafting and
  trade switch on `cat`, `shape` and `rarity`. Never on a hardcoded key name. Adding an item
  must remain one row and zero other edits.
- One `value` per item. Do not add a second price anywhere.
- Every mutation goes through a Net handler.
- The client is a renderer and an input device with a cache. Nothing else.

== PHASE 0 - SPLIT THE FILE (do this first) ==

908 KB in one file was a virtue when the game was a demo. It is now the main brake on
everything below: an agent cannot hold it in context, edits collide, and adding a server
means adding a build step regardless.

- Author the game as ES modules under `src/`, one file per LH module, keeping the names and
  the boundaries exactly as they are today. Do not reorganise while you split. A pure move
  with no behaviour change, verified by the regression harness, is the whole of Phase 0.
- `tools/build.py` concatenates `src/` into `game/lumen-harbor.html` in dependency order.
  The single self-contained file remains the shipped artifact — that property is a feature,
  it is how the game runs offline from a home screen with no install and no server round
  trip for code. Keep it.
- Fold tools/build-preview.py into the same build.
- MOVE THE TEST HARNESSES INTO THE REPO. They currently live in a scratchpad directory that
  dies with the container: a behavioural regression, a cosmetic build probe, an item-table
  probe, a character lineup renderer and a sandboxed-iframe preview check. Rewrite them
  under `tools/test/` as committed Playwright scripts with a single `tools/test/all.mjs`
  entry point. Until they are in the repo they do not exist.
- Add a headless smoke test of the golden path to that suite and wire it to run on every
  commit.

Acceptance: `python3 tools/build.py` reproduces a byte-comparable game, `node tools/test/all.mjs`
passes, and the golden path is green.

== PHASE 1 - THE SERVER IS REAL ==

This is the phase that makes the word "MMO" honest. Do not skip it to build content.

- `server/` — a Node process, no framework worth arguing about, websockets, SQLite to start
  (Postgres when it hurts). Move every existing Net handler body across unchanged. The `srv`
  api becomes the server's internal state accessor. The client keeps calling
  `Net.request('hook', ...)` and does not know the difference.
- Accounts: email-less to start — a device key plus an optional claim code, so a child can
  play in ten seconds and still keep their world if they change phone. Auth is a boring
  solved problem; do not invent one.
- Authoritative state: inventory, currency, skills, world cells, land ownership, crop
  timers, trade escrow. Client-side prediction for MOVEMENT ONLY, with server reconciliation.
  Everything else waits for the answer and shows a pending state.
- Every mutating request carries a client-generated request id and the server deduplicates
  on it. This one line prevents item duplication, and item duplication is what kills the
  economy in every game of this kind. Make mutations idempotent from day one, not after the
  first exploit.
- Rate limits and reach checks per action: you cannot break a block 200 m away, cannot swing
  faster than the animation, cannot plant on land you do not own.
- Presence: 30-60 players per world instance, position updates at 10 Hz, delta-compressed,
  interest-managed by distance. LH.Actors already draws a crowd — swap the simulation for
  the wire and the rendering does not change.
- Persistence: server-side, versioned, with a migration path and a nightly backup. A player
  who loses a rare item to a schema change is a player you never get back. localStorage stays
  as an offline cache and a single-player mode, not as the source of truth.
- Chat: server-relayed, rate-limited, with a filter and a mute list. Never client-echoed.

Acceptance: two phones on the same network stand in the same harbour, see each other move
in real time, and one hands the other an item that survives both of them force-quitting.
On that day, and not before, update README.md, site/index.html and the in-game copy.

== PHASE 2 - FARMING ==

The faucet. It must be the first thing a new player does and the last thing a veteran
optimises.

DATA. Extend `It()` with one optional block:

    seed: { grows: 'itemKey',      // what a ripe plant yields
            growSec: 900,          // real seconds at stage 0 -> ripe
            yield: [2, 4],         // harvest range
            seedBack: 0.65,        // chance the harvest returns a seed
            soil: 'loam',          // which ground it will take in
            stages: 4 }            // visible growth stages

Seeds are items, so they stack, sell, trade and drop with no new plumbing.

MECHANICS.
- Break a harvestable block or plant and it may drop a seed. That is the only seed faucet
  outside quests. Do not sell seeds for coins in the shop; that turns the whole economy into
  a coin sink with no discovery.
- Planting is a voxel placement of shape `plant`, on soil, on land you may build on
  (`canBuildHere` already exists). The cell stores `plantedAt` and the seed key.
- GROWTH IS LAZY AND SERVER-SIDE. Compute ripeness from `plantedAt` and `now` at read time.
  Never run a tick loop over every plant in the world — you will have hundreds of thousands
  of them and it must cost nothing when nobody is looking. Crops grow while the player is
  offline; a plant left for a week is ripe, not dead.
- Four visible stages so a field reads at a glance from across the plaza. Build them in
  LH.Geo as one lofted form scaled and detailed per stage, not four separate meshes.
- Watering: a consumable that removes a fixed fraction of remaining grow time. This is your
  first honest money sink and your first reason to log in twice a day. Rain (LH.Sky.wet)
  waters everything outdoors for free — weather becomes a thing players watch for.
- Tools matter: a better trowel raises yield, a better watering can covers an area. Tools
  have durability. Durability is a sink.

SPLICING — THIS IS THE CONTENT.
- Two different seeds planted together have a chance to produce a third. Recipes are data:
  `SPLICE = { 'fern+ember': 'flamefrond', ... }`. Ship 60 and design a tree with three
  tiers, where tier-3 results need tier-2 inputs.
- Failure consumes the seeds. That is the sink that gives rare crops their price.
- Discovery is per-account and permanent, and the FIRST person on the server to discover a
  splice gets a world announcement with their name on it. This single feature is why players
  will keep a spreadsheet, argue in chat and come back tomorrow. Do not cut it.
- Never ship the recipe list in the client. It is server-side, it is the game's secret, and
  the wiki players write for each other is free retention.

Acceptance: plant, close the game, come back eight hours later, harvest the right amount,
splice two seeds, fail once, succeed once, see the announcement, and find the new seed in
your bag — with every step decided by a Net handler and nothing in the client knowing the
recipe.

== PHASE 3 - THE ECONOMY AND TRADING ==

The protocol exists. What is missing is a counterparty, price discovery and sinks.

TRADING.
- Keep the lock-and-confirm flow. Add the two anti-scam rules it is missing: any change to
  either side's offer unlocks BOTH sides, and confirm has a three-second hold that displays
  the final contents at full size. Most scams in this genre are a last-second swap.
- Show, next to every item in the trade window, its rolling 7-day median trade price and the
  number of trades behind that number. Growtopia never did this and price ignorance became
  the meta. Refusing to hide information is a design choice; make it.
- Log every completed trade server-side, forever. It is your economy telemetry and your only
  defence against a duplication bug you have not found yet.

THE MARKET BOARD.
- Face-to-face trade does not scale below a few thousand concurrent players. Add an
  asynchronous order book: list an item at a price, it sells while you are asleep, coins
  wait in escrow. This is the single highest-leverage feature for making a small population
  feel like a market.
- The board takes a percentage. That percentage is a sink and it is how you control
  inflation without touching anything else.

CURRENCY.
- Coins: earned by selling to NPCs at a deliberately BAD price. The NPC vendor is a price
  floor, not a job. If a player can grind coins from NPCs faster than from other players,
  you have built a single-player game with a chat window.
- Shards (hard currency): from milestones, first discoveries and events. Never from a timer.
- THE LOCK IS THE REAL CURRENCY. Growtopia's World Lock became the unit of account because
  it is consumable, it grants permanent scarce land, and everyone wants one. Do the same:
  a World Lock is craftable from deep materials, is destroyed on use, and claims land. Its
  price is set by land demand, not by a shop, and it becomes the number players quote each
  other. Do not sell it for coins at a fixed price — that pins the whole economy to a
  constant and kills it.

SINKS, IN ORDER OF IMPORTANCE. Faucets are easy and every designer builds them; a game of
this kind dies of inflation, not of boredom.
  land and world locks / cosmetics / failed splices / tool durability / watering /
  market fees / world naming and decoration / recipe unlocks / fast travel /
  storage upgrades / event entry.
Track total coins in circulation as a first-class metric. If it grows more than ~5% a week
against a flat population, a sink is missing — find it before you add content.

Acceptance: a new player and a veteran can name the price of a rare crop and agree, without
either of them being wrong.

== PHASE 4 - QUESTS THAT ARE NOT FETCH QUESTS ==

Rule: if a quest could be satisfied by a player who is not looking at the screen, delete it.
"Collect 10 fish" is not a quest, it is a progress bar you made the player carry.

Four kinds, all of them registered as Net handlers so completion is server-decided:

1. STORY CHAINS. Six to eight beats per NPC, and each beat UNLOCKS A VERB rather than paying
   out coins. The harbour master teaches you to plant. Bao Ling the trader opens the market
   board. The mechanic eventually gives you fast travel. Mechanics arriving as story is how
   an onboarding stops feeling like a tutorial. The NPCs already exist in LH.Quests with
   voice and role — write to the characters that are there.

2. CONTRACTS. Generated daily from what the server's economy currently has too much or too
   little of: "the harbour needs 40 copper this week". They pull specific items OUT of
   circulation at a fair price, which makes them a sink AND a price-support mechanism AND a
   reason for farmers to check what to plant. This is the feature that makes quests part of
   the economy instead of a parallel faucet. It is worth more than the next fifty items you
   could add.

3. DAILIES with a FORGIVING STREAK — miss one day and the streak holds; miss two and it
   drops one tier. Punishing streaks train anxiety, not habit.

4. SEASONAL EVENTS. The same week-long event for everyone, with a cosmetic that is never
   sold again. Scarcity by time is the cheapest content you will ever ship and the one
   players talk about years later.

Rewards, in order of preference: recipes, seeds, land, cosmetics, titles. Raw coins last and
smallest.

== PHASE 5 - PROGRESSION THAT UNLOCKS VERBS ==

Six skills exist and currently do very little. Levels must unlock ACTIONS, not multipliers —
"+3% mining damage" is not felt by a human being.

  building     new shapes, then triggers, then the world editor tools
  mining       deeper strata, then ore that only exists below them
  fishing      new depths, night fishing, then the legendary catches
  farming      NEW SKILL — splice tiers gate behind it
  combat       blocking, then dodging, then a second weapon type
  exploration  fast travel, then map markers, then the far islands
  social       trade slots, market listings, guild size

Level curve: fast to 10, slow after 30, no cap. XP from the ACT, not from the reward, so
players are paid for playing rather than for optimising a loop.

== PHASE 6 - WORLDS ARE THE ENDGAME ==

LH.Realm already gives private worlds with permissions. Growtopia's real product is that
players build worlds and other players walk through them. Finish it:

- A world list with names, visit counts, and a featured row curated weekly by a human.
- Permissions that are actually usable: public, friends, allow-list, build-with-me.
- Make the build tools a LEVEL EDITOR. Reuse the behaviour-type idea from MEGA-PROMPT.md:
  doors that lead to other worlds, checkpoints, deadly blocks, trampolines, one-way
  platforms, providers that yield an item on a timer, chests with one loot roll per player,
  signs, and switches wired to doors. Fifteen behaviours turn a sandbox into a place where
  players make parkour maps, escape rooms, shops and haunted houses for each other. That is
  user-generated content, and it is the only kind of content that scales past your team.
- Worlds persist server-side per owner, are backed up, and can be visited while the owner is
  offline.

== PHASE 7 - COMBAT AND DUNGEONS ==

Combat exists and is shallow. Do not deepen it with numbers; deepen it with READABILITY.
- Three enemy archetypes with genuinely different tells: a lunger that winds up, a ranged one
  that must be closed on, and a heavy that must be dodged around. Telegraph every attack with
  an anticipation pose and a sound at least 400 ms before the hit.
- Give the player one defensive verb at level 1 and a second at level 20. A dodge is worth
  more than ten weapons.
- Instanced dungeons under the island, three floors, dropping materials that exist NOWHERE
  else and that the deep crafting recipes need. That is how combat feeds the economy instead
  of sitting beside it.
- A world boss on a timer that the whole server fights together, once a week, with loot for
  everyone who took part. Shared spectacle is what people mean when they say a game feels
  alive.

== PHASE 8 - A WORLD THAT IS ALIVE ==

- Weather that changes play: rain waters crops, storms raise the fish, fog changes what
  spawns. LH.Sky already tracks wetness — connect it to something.
- Day and night with NPC schedules; the market is quiet at 3 a.m. and the night market is
  not.
- Ambient life: birds, boats, market crowds, lit windows at dusk.
- AUDIO IS THE BIGGEST GAP BETWEEN THIS GAME AND A AA ONE. There is no audio budget and no
  files allowed, so build a WebAudio synthesis layer: a footstep model that varies by
  surface, a tool-impact model, water, wind, UI clicks with pitch variation, and a layered
  ambient music bed whose layers fade in by district, weather and time. Silence reads as
  unfinished more than any missing feature.

== PHASE 9 - THE AA POLISH BAR ==

This is what separates an impressive tech demo from a game people install. None of it is
optional and all of it is measurable.

PERFORMANCE
- 60 fps on a 2021 mid-range Android at DPR 1.25, with 30 visible players and 200 plants.
- A frame budget written down and enforced by a committed benchmark: render, sim, UI, GC.
- Time to first interactive frame under 3 seconds on 4G.

GAME FEEL — every single action gets all five:
  anticipation (a wind-up frame), impact (hit-stop or squash), sound, particle, and a NUMBER
  that flies off the thing you hit. Currently most actions have one or two of the five.
  Auditing every verb against this list will do more for how the game feels than any new
  system in this document.

ONBOARDING, measured with a stopwatch on a real phone:
  playable in 20 seconds, first item in 40, first plant in 90, first sale in 4 minutes,
  first trade with a real person in 10. If a step takes longer, cut something.
  No wall of text. No forced tutorial you cannot skip.

UI
- One-handed reachability: nothing critical in the top corners.
- Every panel closes with a swipe and a back gesture.
- Loading states for everything server-decided, because the server can be slow and a frozen
  button is a bug report.
- Colourblind-safe rarity (rarity must never be conveyed by colour alone), a text-size
  setting, reduced motion, and remappable controls.

TRUST
- The save is never lost. Versioned, migrated, backed up, and restorable by a human.
- An economy dashboard for you: coins in circulation, trade volume, item counts, faucet and
  sink rates. You cannot balance what you cannot see.
- If you ever monetise: cosmetics and land only. Nothing that a player can buy may make
  another player's items worth less. Say so publicly and keep to it.

== ECONOMY MATH YOU MUST NOT GET WRONG ==

- Keep the single `value` rule. One number per item, everything derived.
- The existing curve `value = 4 * 2.35^(rarity-1)` puts a Mythic near 3,600 coins. Set your
  early-game faucet so an hour of active play yields on the order of a few hundred coins,
  and price the first World Lock so it is roughly a week of casual play or two days of
  focused play. Land must feel earned or the whole progression collapses.
- The rarest crop in the game should be worth more than a hundred of the commonest. If the
  ratio is under 20x, splicing has no reward; if it is over a thousand, new players cannot
  participate in the market at all.
- Faucets to audit weekly: mob drops, node respawn rates, harvest yields, quest rewards,
  daily rewards, event payouts.
- Every new item you add must have BOTH a source and a use. An item with a source and no use
  is inflation. An item with a use and no source is a dead recipe.

== FAILURE MODES - DO NOT SHIP THESE ==

- Calling it multiplayer before Phase 1 lands.
- Adding two thousand items. There are already 548, which is more than the current systems
  meaningfully use. Depth beats breadth: an item that appears in three recipes, two quests
  and one splice is worth thirty items that only sit in a shop. Prune before you add.
- Quests that are a coin faucet.
- A pay-to-win shortcut of any size.
- Client-side crop timers, client-side loot rolls, client-side anything that matters.
- Non-idempotent mutations. This is how item duplication happens and it is unrecoverable.
- Growth tick loops over the whole world.
- Letting the single file grow past 1 MB before Phase 0 splits it.
- Shipping a feature with no committed test. If it is not in tools/test/, it will regress and
  nobody will notice for six weeks.
- Deleting or "simplifying" the authority boundary because it is inconvenient during a
  refactor. It is the most valuable thing in the codebase.

== HOW TO WORK ==

- Branch: claude/growtopia-concept-art-zwitgm. Push with `git push -u origin <branch>`.
  Do not open a pull request unless you are explicitly asked for one.
- Commit in slices that each leave the game playable. Write commit messages that say what
  changed about the GAME, not what changed about the code.
- Before every push: run tools/test/all.mjs, render at least one screenshot, and walk the
  golden path.
- Verify by measuring, not by asserting booleans. A test that checks "did it load" will pass
  while the screen is blank — that has already happened in this repo, and it shipped a
  preview with no stylesheet to a real user. Assert on sizes, positions, counts and pixels.
- When you break something you cannot fix, say so plainly in the commit and in your report.
  An honest known-issues list is worth more than a green checkmark that is not true.
- Keep README.md current as you go. It is the reason anyone can still work on this codebase.

== DEFINITION OF DONE ==

Milestone 1  Split, built, tested, harnesses committed, golden path green in CI.
Milestone 2  Two real devices, same world, visible to each other, a trade that survives a
             crash. Copy updated to match reality.
Milestone 3  Plant, wait offline, harvest, splice, discover, announce.
Milestone 4  Market board with real price discovery and a fee that holds inflation flat for
             four weeks of measured play.
Milestone 5  Story chains that unlock verbs, contracts that move the market, a seasonal event
             that ends.
Milestone 6  Worlds with fifteen behaviours, a featured row, and one player-built world that
             another player finished and enjoyed.
Milestone 7  60 fps on a mid-range phone with thirty players on screen, every verb passing
             the five-part game-feel audit, and audio.

You are finished when a stranger installs it on a phone, plays for twenty minutes without
being told what to do, comes back the next day of their own accord, and the reason they came
back is that something they planted is ready and somebody wants it.
```

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
| `LH.Render` | Forward renderer: shadow pass with a rotated Poisson kernel, analytic sky, banded toon lighting, silhouette ink, screen-space ambient occlusion, hemisphere ambient, sixteen point lights a frame, wind, cloud shadows, height fog, water that reflects the real sky, bloom, sun shafts, filmic tonemap, FXAA |
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
| Map | The real heightmap rendered at 384×384 with depth-shaded water and a north-west hillshade; a pin per district, `?` until you find it, live NPC dots, and travel |
| Wardrobe | Fifteen rows of live appearance, applied on the click, on a camera that turns the character three-quarters on to the lens |
| Hair | Cards over a solid cap pushed out to the style's own length, so the cap carries the silhouette and the strands ride on it; the hairline sits low enough to give every style a fringe |
| Proportion | One per-bone map turns the anatomical body into a three-and-a-fifth-head toy at draw time — legs to 56 per cent, arms shortened and thickened, head at 1.90 — without changing a single number in any garment |
| Build | A per-region profile over the size scalar, so slim, base and bulk differ in taper rather than in scale — and every garment inherits it, because a garment is the body's own rings grown outward |
| Outfits | Six named sets priced and granted by the server, charging only for the pieces you are missing |
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

### The look

The world keeps a drawn quality — bright, chunky, inked — and the people
standing in it do not: the bodies are anatomical, and skin is lit as
skin. Three dials in `LH.Render.scene` carry the drawn half, and setting
all three to zero gives back plain stylized realism, which is what makes
this an art direction rather than a rewrite.

| Dial | What it does |
| --- | --- |
| `toon` | Quantises diffuse *and* shadow into three bands with soft shoulders. Both, because a soft shadow gradient beside a hard terminator on one surface reads as a bug rather than a style |
| `outline` | Inks silhouettes from a depth texture, keyed on the second derivative of depth — a floor at a grazing angle has a huge depth gradient but no curvature, so it does not outline itself. Line weight is in pixels, and the ink fades with distance because a forest inked at full strength is a field of scribble |
| `saturation` | A straight chroma push after the tonemap |

The dials sit lower than they did — `toon` 0.55, `outline` 1.05 — since
the bodies became anatomical, and skin opts out of banding entirely in
the fragment shader regardless of where the dial is. Hard three-band cel
on a human cheek turns a face into a poster.

### The body

The figure is one continuous **skinned** mesh from the collarbone down,
built in the bind pose in world metres and bound to a twenty-two bone
skeleton. It replaces nine rigid parts and eleven joint spheres, and
that was the single biggest thing standing between this character and a
believable one: rigid parts leave a seam at every joint, and the spheres
that used to hide those seams are exactly what made the figure read as a
toy. Skinned, an elbow creases, a shoulder rolls under its skin, and a
knee keeps its volume through a bend.

Proportions are human canon rather than a style. Six measurements fix
the whole skeleton — hip joint 0.53 H, knee 0.285 H, shoulder 0.81 H,
elbow 0.63 H, wrist 0.485 H, chin 0.87 H — and everything else is
measured against those rather than against each other, so the figure is
seven and a half heads at 1.80 m instead of four and a half.

Three bones earn their place once the mesh is skinned rather than
assembled. A **third spine segment**, because one segment bends a torso
like a plank and three let a turn start at the hips and arrive at the
shoulders. **Clavicles**, which used to be pivots to hang an arm from
and now carry skin, so the deltoid follows the shoulder. And **toes**,
because a foot that cannot roll cannot push off, and a walk without a
push-off is a shuffle.

Two conventions hold the geometry together. Every ring is a superellipse
with independent front and back depth, because bodies are not made of
ellipses — a back is flatter than a front, a rib cage squarer than a
waist, a calf almost entirely behind the bone. And regions *overlap*
rather than join: the leg's top ring sits up inside the pelvis, the
deltoid buries a third of itself in the rib cage. Two solid surfaces
that interpenetrate look exactly like one surface, and stitching a leg
into a torso with matching ring counts is how a weekend disappears.

Every garment is the body's own rings grown outward — 10 mm for a shirt,
14 for trousers, 20 for a coat — and bound to the same bones. That is
not a shortcut, it is the only construction that cannot clip: a sleeve
built from its own profile passes through the arm inside it the first
time the elbow goes past ninety degrees, and no amount of tuning fixes
it. The two surfaces have to be the same surface, offset.

### Skin

Skin is a material, not a colour. It gets its own texture-array layer,
near-white so the character's tint carries the tone, and the fragment
shader recognises it with one comparison — which buys a second lighting
model without a second shader or a second draw call. Three things give a
face away and all three are cheap: light **wraps** further round it than
round cloth, it **scatters** warm at the terminator where light went in
and came back out somewhere else, and its **highlight** is broad and
faint rather than tight.

The scatter band is narrow on purpose. The first pass used one a third
of a hemisphere wide and turned every face orange; scatter shows at the
terminator, not across the whole lit side.

### Shadows

Two cascades. One map fitted to the whole visible neighbourhood has to
cover about ninety metres, which at 2048 leaves four centimetres per
texel — enough for a building and nowhere near enough for the contact
between a foot and the ground, which is the shadow the eye actually
checks. The near cascade covers thirteen metres at the same resolution,
six millimetres a texel, and everything inside it reads sharp.

The split is a hard test against the near box rather than a blend band.
At this ratio the two look near-identical where they meet, and a blend
costs a second twelve-tap fetch on every pixel in the overlap to hide a
seam that is not visible. The near pass draws a much smaller set — what
it would gain from terrain past thirteen metres is outside its own box
anyway — but it still has to draw the props, because a bench missing
from the near map is a bench with no shadow rather than a soft one.

### Trees

The canopy was five squashed spheres over a bare pole. A lollipop, and
the thing that made every wooded shot read as clip art — which matters
because most of this island is forest.

Trees are now a real branching structure with leaf clusters hung on the
ends. Each limb is built *inside* its parent's transform, so the
recursion never has to know which way anything points in world space:
`translate(0, len, 0)` is always "the end of this branch". Working out
the world direction of a third-order twig and rotating a cylinder onto
it is the same tree and four times the code.

Everything about it is a budget decision, because a species is one
instanced mesh drawn hundreds of times and now three times a frame — the
image and both shadow cascades. Two children per split rather than
three; five-segment, four-ring lobes, because a leaf cluster is lumpy by
nature and gains nothing from being round; a crotch cluster on half the
splits rather than all of them. The first version of this was four times
heavier and timed out the render harness, which is a useful thing for a
harness to do.

Conifers got a ragged ring in place of a clean circle — a cone of
perfect circles is a Christmas decoration, and the whole read of a
conifer is the broken edge where its branches end.

### Air

Haze is lit air, so its colour is the sky's in that direction — bluer
looking up and away, warmer and brighter looking toward the sun, where
forward scattering piles up. One constant fog colour makes a distant
hillside sit *in front of* the sky it should be dissolving into, which
is the single tell that separates depth from a grey wash.

### Weight

Three things the character did without any.

**Turning on the spot.** The controller only turned the body while it
was moving, so a reversal snapped the facing the instant speed crossed a
threshold — pivoting like a turret, with the feet, the only thing that
tells you a turn happened, not moving at all. Standing still now turns
slowly toward the wish direction, the target speed is scaled by how far
the body still has to turn (you cannot run in a direction you are not
facing yet), and a turn clip shuffles the outside foot around the
inside one.

**Stopping.** Momentum does not stop when the input does. The trigger is
the moment the stick goes and the body is still fast, not the moment the
body is finally slow — by then the plant has nothing left to absorb. A
decaying peak-speed term remembers the run across the handful of frames
a stop takes and forgets it afterwards, so a stumble through a slow
patch does not count.

**Cloth and hair.** Both were a damped follow, which always trails its
target and never passes it, so cloth eased into place and stopped. They
are springs now: they overshoot and settle, which is what actually
happens when someone stops walking and their coat keeps going. Hair gets
a stiffer, faster one and also answers to the head turning, which cloth
on the chest does not.

### Surface

Every material in this world was flat. Geometry normals only, so a brick
wall lit from the side was a smooth plane with brick-coloured rectangles
painted on it, and cloth, bark, gravel and gold were all equally glassy
under the same fixed highlight.

There is now a second texture array carrying relief and roughness, and
neither of them needed a second image authored per material. The height
is taken from the luminance of the albedo that already exists — a guess,
but a good one here, because every recipe in this file was painted by
making the recessed parts darker: mortar lines, plank grooves, the gaps
between cobbles. Where the guess is wrong it is wrong in **sign**, not
in shape, which is why `bump` is signed: brick's mortar is lighter than
its brick and further in, so brick's bump is negative. Roughness rides
in the blue channel, so one fetch delivers both.

The tangent frame comes from screen-space derivatives rather than a
tangent attribute. Every mesh in this game is generated at load and none
of them carry tangents; deriving the frame per fragment costs four
derivatives and works on all of them, including the skinned ones, where
a baked tangent would have to be skinned too.

With roughness available, the specular became a GGX lobe instead of a
fixed Blinn exponent, and the ambient gained a specular term — the sky
reflected in proportion to how smooth a surface is. That last one is
what makes metal look like metal: diffuse ambient alone leaves a brass
fitting in shadow indistinguishable from a grey plastic one, because
what tells you a thing is metal is what it reflects when the sun is off
it.

### Ground under the feet

Three things the controller used to ignore.

**Slope.** The heightmap has plenty of steep ground and all of it was
treated as floor — you could stand on a sixty-degree quarry face as
comfortably as on the plaza and walk up it at full speed. The gradient
is now sampled from the same height function the camera and the foot IK
use, so there is one definition of where the ground is. Climbing costs
speed and descending returns a little, taken from the gradient in the
direction you asked to go rather than the steepness of the hill in
general; past about forty-seven degrees control fades out and gravity
takes over along the fall line. Measured: 4.4 m/s on the flat, 1.5 m/s
up a slope whose normal is 0.52.

**Wading.** Between ankle and chest the water takes about half your
speed and none of your control. Having no state between dry land and
swimming made the shoreline read as a switch.

**Crowding.** Characters stood inside one another. Nothing in the game
cared but the eye does — two people in the same half metre is the
clearest possible signal that neither is really there. A soft separation
pass runs after everyone has moved: two relaxation rounds, O(n²) over at
most twenty actors, which is cheaper than any spatial structure would be
to rebuild each frame. It pushes rather than blocks, and the player
never gets moved, so a crowd parts around you instead of pinning you.
Being shoved by pathing NPCs feels like a bug even when it is the
physically fairer answer.

### One action, two bodies

Standing still, a swing should involve the whole body: the hips turn
into it and the weight shifts onto the front foot, and a clip that only
moved the arms would look like a mime. Walking, the legs are busy, and
the same clip has to be confined to the ribs and above.

So an action now routes to whichever it needs — full body when the base
state is standing, upper body only when it is not. One rule, no
duplicate clips, and the caller never has to know which happened. The
mask is a per-bone fraction with the spine graded rather than switched,
because a hard cut at the waist gives a character two halves that
disagree about which way the torso is facing.

### Hair, and the face

Cards, not blobs. Every hairstyle was a cluster of spheres over a lofted
cap, which is what a hairstyle looks like when it is modelled as a solid
— and a solid is not what hair is. Real-time hair is strips: a ribbon
with a width, a taper and a path, laid along the flow of the style,
forty or eighty of them. `LH.Body` now has a strand engine, and each of
the twelve styles is a description handed to it: a hairline elevation,
a length function of azimuth, a droop, a sweep, a curl amplitude and
frequency. Gathered styles — the bun, the topknot, the ponytail — add a
bundle on top of the same machinery.

The face is painted rather than tinted flat. A head that is one colour
everywhere is the clearest single tell of amateur character work: real
faces are darker in the sockets, redder at the lips, nose and ears,
cooler along the jaw, lighter across the forehead and cheekbones, and
none of that comes from geometry. `R.face` paints all of it into the
head's own cylindrical unwrap — u = 0 at the left ear, 0.25 dead centre,
v = 0 at the chin — and every value is a multiplier on the character's
own skin tone, so one map serves every complexion in the palette.

Eyes got the same treatment. A 24 mm eyeball with pupils 63 mm apart, a
sclera that is warm off-white rather than paper, a dark limbal ring at
the iris edge, eight faint radial spokes, a collarette around the pupil,
a caruncle at the inner corner, and lids that cut across the top and
bottom of the iris — a ring of white all the way round is the classic
doll eye. Facial hair is strands too: two hundred to five hundred very
short ones over the jaw, rather than the string of squashed spheres it
replaces.

The toon dials are off. Cel banding and an ink line around every
silhouette were most of what made the characters read as a children's
cartoon, and no amount of work on the geometry underneath survives them.

Four things this cost. `Builder.vert` takes a colour as an `[r,g,b]`
triple where every other builder call accepts a hex string — passing a
string writes the characters `'#'`, `'D'`, `'2'` into a `Float32Array`
as NaN, and a NaN albedo ships as black, so the first head of hair
rendered as a black box. The ellipsoid standing in for the skull tapered
to a point at the crown where a real cranium stays broad, so the scalp
cap sank inside the head everywhere above the ears — fixed by raising
the horizontal profile to a fractional power. Strand droop and sweep were
scaled by step length rather than step count, so a three-centimetre crop
barely bent while a long style folded double on the same number. And
every hat in the file was authored with its band at y 0.02, which on the
anatomical head is the eyeline, so they all sat across the eyebrows like
a blindfold.

### Gait

A real gait cycle is not symmetric. Stance is about 62 per cent of it,
swing the other 38, and inside stance there are four events that each
leave a mark on the silhouette: heel strike, foot flat, heel off, toe
off. Sines cannot produce those, which is why a sine walk reads as a
march however carefully its amplitudes are tuned. Each joint is a
piecewise curve through those events, simplified to the corners that
survive at gameplay distance.

The pelvis does three separate things that are easy to confuse: it rises
twice a stride — highest at each mid-stance, lowest at each double
support, which is the opposite of most first guesses — it *lists*, the
swing-side hip dropping, and it rotates about the spine leading the
swinging leg. The trunk counter-rotates against it, spread across all
three spine segments. The head stays level while everything under it
pitches, because gaze stabilisation is involuntary and universal, and a
head that pitches with the chest is the most robotic thing a walk can
do.

Four sign conventions, stated once because getting one backwards
produces a character that walks convincingly and wrongly, which is far
harder to spot than one that walks badly: thigh +X swings the leg back,
shin +X flexes the knee, foot +X lifts the toes, toe +X is what the heel
lifting does.

What it costs: 332 draw calls a frame became 526, because a skinned
draw is placed by a bone palette and a palette belongs to one character
in one pose, so every skinned mesh on every visible actor is its own
call — about five each across twenty actors, doubled by the shadow pass.
Triangles went up four per cent. Under the software rasteriser the
regression harness runs on that is an eleven per cent frame cost; on a
GPU it is draw-call overhead rather than fill.

### What makes it move

| System | What it does, and the part that was easy to get wrong |
| --- | --- |
| **Ambient occlusion** | Hemisphere SSAO from the depth texture the ink pass already needs — view position by unprojecting depth, normals from its derivatives. The sample rotation repeats on a 4×4 grid so a 4×4 box blur cancels it exactly; borrowing the bloom's gaussian instead reaches seven pixels and averages a contact band into nothing |
| **Wind** | Leaves are found by their material, not a per-vertex weight. Trunks are bark and hold still. The same snippet runs in the depth pass, because a canopy that sways while its shadow stays put is worse than no wind |
| **Cloud shadows** | Two octaves of value noise drifting in world XZ, gated on sun elevation and thinned by rain — past a point overcast is one sheet and stops casting anything separate |
| **Foot IK** | Two-bone, second forward pass, close actors only. The target is not the ground: it is the lift the animation asked for, measured from the ground under *that* foot. Driving feet to the ground deletes the walk cycle |
| **Movement** | Coyote time, a buffered jump, a cut on release. Landing squash scaled by impact drives the body's compression and a camera *dip* — one signed motion, not a shake |
| **Life** | Blinks that double up the way real ones do, eyes that dart and lead the head, a turn spread into neck and chest, cloth that lags, and a bank into a turn scaled by how fast you are actually going |
| **Water** | Reflects the sky gradient the sky pass is drawing rather than one ambient colour, so dusk turns the harbour orange. A third fine normal octave exists only to catch the sun as glitter |

Ground clutter is wildflowers, not grass. Grass was tried first and was
wrong: a field of thin blades needs a density this budget cannot reach,
and at reachable density it reads as dirt on the lawn — and the ink pass
outlines every blade, so each tuft came back a black speck. Flowers are
*meant* to be sparse, and an inked flower looks like a drawing of one.

Emotes are on **V**: a wheel with wave, dance, laugh, cheer, clap,
point, shrug and sit — eight, which is a wheel rather than a ring with
a gap in it. The number row picks from the wheel while it is open and
drives the hotbar while it is not, and a looping emote yields the
moment you move. The shrug is built on the clavicles rather than the
arms, which is the whole difference between a shrug and a character
presenting two invisible trays: the shoulders lift, the arms come up
only because the shoulders took them there, and the forearms roll
outward as the elbows close so the palms end up turned over. Like the
wave and the clap, it plays from the ribs up over a walk and full-body
when you are standing.

The two typefaces are the only downloaded asset in the project: Fredoka
and Nunito, from Google Fonts, both with real fallbacks so the game
still looks deliberate with the network off. Nothing else is fetched —
no mesh packs, no texture packs. Mixing bought low-poly models into a
world where every vertex is generated at load is the fastest way to make
a game look like an asset flip, and the loader and the file size would
both be real costs for a worse result.

### The cast

The wardrobe is not the characters. Twelve hairstyles and a shaved
head, ten hats, four kinds of facial hair, five things worn on the
face, seven occupational layers and eleven things to hold are a
vocabulary;
a character is one specific set of those choices, made on purpose.
`LH.Cast` is where those choices live — a table of designed people,
each written to a single sentence of intent kept beside it in `note`,
with every field under it serving that sentence.

| Who | Read at twenty metres |
| --- | --- |
| **Mira Vance**, Harbourmaster | Tallest and stillest. Tricorn, storm collar, an oilskin to the knee, iron locs — everything vertical, and the lantern is the only warm thing she owns |
| **Dell Okonjo**, Quarry Foreman | Widest. Hard hat with goggles pushed up because he has just stopped, a harness with something clipped to every strap, full beard |
| **Rosalind Ash**, Land Registry | Narrowest. Bun, spectacles, a plum registry stole with a fringed hem, and the ledger never goes down |
| **Ivo Karr**, Warden | Asymmetric on purpose: one shoulder plated, one eye covered, the coat closed diagonally across the body |
| **Bao Ling**, Market Trader | Loudest. A gold apron you are meant to spot from the harbour road, flat cap, balance scales, and a market cat |
| **Tess Aurelio**, Garage | Boiler-suit blue collar to boot so the orange goggles and the drone are the only things your eye lands on |

Three rules hold the table together. **Silhouette first** — two residents
must be distinguishable in black at twenty metres, which is why nobody
shares a headwear shape and heights vary by fourteen centimetres.
**One loud colour each, and it is theirs** — Mira has the teal, Dell the
safety orange, Bao the gold, and nobody else may use it as their loud
colour. **The job is worn, not stated** — a chest full of clipped-on
quarry hardware says foreman without a nameplate.

The character screen opens on six finished people rather than a set of
sliders, and every slider is still there underneath. The crowd is
assembled by rule instead of by hand: one saturated garment each, with
the rest of the outfit derived from it rather than rolled separately,
which is the difference between an outfit and a bag of colours.

Three things this cost. `Geo.roundRect` takes a **full** width and depth
while `Geo.circle` takes a **radius**, so the first draft of the
occupational layers read the shirt's numbers as radii and built coats
that fitted neatly *inside* the shirt — visible only as a collar and a
stripe down the chest. Every measurement in `OVER_BUILD` is now a
half-extent written against a table of the shirt's actual outer edge.
`refreshKit` used to fall back to `'crop'` and `'none'` for any slot
with nothing equipped in it, so the first thing you ever equipped
quietly shaved your head and took your coat off; it now falls back to
the look you chose, and the starter grant no longer equips a hair item
and a tee just to have an opinion about those two slots.

And the crowd came back as twelve people in the same red shirt.
`M.rng` is a xorshift32, and seeded with a small number its state stays
under 2²⁵ for a round or two — so the *first* draw is always below
0.01, and every kit that picks its skin, hair and shirt from the first
three draws hands every small seed the same person. The kit generator
now scatters the seed and throws eight draws away before anybody looks
at it. Twelve residents: eleven shirt colours, nine hairstyles, seven
skin tones.

### The island, as a map

Growtopia and Club Penguin both do a thing this build was not doing:
they tell you where you are, and they make somewhere else sound worth
going. A world you can only learn by walking into it is a world most
people put down before they find the second district.

So `LH.World.mapImage()` renders the island — the real one, not a
drawing of it. It reads `Terrain.heights` and `Terrain.mats` at 384×384
and paints the actual heightmap: water shaded by depth rather than one
flat blue, because a single blue loses every sandbar and every deep
channel and that is most of what a harbour map is for; land coloured
from the material palette so the paved district pads read as paved;
and a hillshade off the height gradient, lit from the north-west the
way every printed map since about 1800 has been. It costs about 50 ms
and is cached until the terrain changes.

On top of it: a pin per district, an unvisited one showing `?` instead
of its icon, a dot per resident where they are actually standing right
now, and an arrow for you that points where you are facing. Picking a
pin opens a card — who is there, what the place is for, and a **Travel
to** button that fades, drops you 45% of the pad radius in from the
edge facing the middle, and turns you to look at it.

`W.DISTRICTS` is the table under all of it, and it is honest: seven
districts are `state:'open'` and two — the garage and the arena — are
`state:'soon'`, drawn greyed with no travel button, because they are
not built. A map that promised nine would be a nicer map and a worse
one.

Walking into a pad raises a banner with the district's name and, the
first time, the word *Discovered* — 4.2 seconds on a discovery, 2.2 on
a return.

### The wardrobe, and the line through it

Every appearance choice in the game already existed; you could only
make it once, on the character screen, before you had seen the world
the character was going to stand in. The Wardrobe (`O`, or the menu)
is the same choices, live, from inside the game: skin, build, twelve
hairstyles, hair colour, facial hair, eyes, what is worn on the face,
top, sleeves, occupational layer, legs, feet, and two clothing
colours — fifteen rows, forty-six style chips and forty-seven
swatches, each one applying to the character standing behind the panel
the instant it is clicked. A wardrobe you have to confirm is a form.

The line it draws is the one `refreshKit` already implemented and the
game had never said out loud: **this panel sets your default look, and
an equipped item overrides the slot it belongs to for as long as you
wear it.** Some slots have both — hair, the shirt, the occupational
layer all have a free default here and items in the Store that can
cover it. Others are items only: hats, capes, wings, backpacks, pets,
auras. Which is exactly why *Surprise me* rerolls the eleven fields in
the first group and deliberately does not touch the six in the second:
handing out a hat would be handing out an item, and `refreshKit` would
take it back on the next sync.

Two details cost more thought than they look. The panel is pinned to
the left rather than centred and the scrim drops from 62% to 22% with
the blur off, because the entire point is watching the change land on
the character. And opening it puts the camera in a dressing room:
`LH.Player.dress()` notes the boom's pitch, distance, shoulder offset
and height, pulls in to 2.9 m at chest level, and turns the character
to `Cam.yaw + 0.42` radians — three quarters on to the lens, not
square, because dead-on flattens a face and hides the silhouette of
everything sitting on the shoulders. Closing the panel puts the four
numbers back and lets the boom damp out to them, so the pull back is
how you know you left. Turning the character rather than swinging the
camera is the deliberate half of that: the yaw is the one thing a
player owns outright, and taking it away to show them their own face
would cost more than it bought.

A colour row with nothing highlighted reads as broken, and the kit is
full of colours the palettes never offered — a shade derived from
somebody's loud one, a warden's slate grey. Whatever is being worn now
goes on the front of its row if it is not already in it.

### Outfits

Thirty-one cosmetics sorted by price is a spreadsheet. What makes a
shop worth opening is somebody having decided which three things go
together, given the result a name and put one price on it — which is
the whole of Club Penguin's catalogue and most of what a Growtopia
player is scrolling for.

`D.SETS` is six of those, drawn entirely from items that already
existed: **Dockhand** (dock cap, harbour hoodie, satchel — what half
the harbour is wearing by eight in the morning), **Field Survey**,
**Nightwing**, **Lumen Warden** (everything on it glows, which is the
entire point), and two premium ones, **Sovereign** and **Ascendant**.
15% off a set, 10% on the premium pair. A set is premium only if every
piece in it is, so a purchase is never half coins and half shards.

The Style aisle leads with the six cards — the three pieces as icons,
which of them you already own with a tick, the price of the rest —
and puts the flat grid underneath under *Everything else*.

Pricing is the server's, not the shop's. `buySet` takes a set key and
nothing else: `D.setPrice` recomputes the total from the table, skips
the pieces you already hold and charges you only for the rest at the
set discount, then grants them in one transaction. A client that could
name its own price would name zero. `wearSet` puts every owned piece
through the same ownership check a single equip does — the set is a
convenience, not a bypass.

Which makes the numbers behave: Dockhand's three pieces are 22 coins
bought separately and 19 as a set; own the cap already and the set
costs 14 for the other two, not 19 and not 22. Buying it twice is
refused rather than charged. And a set you cannot afford is refused
by the server with your purse untouched and nothing in your
inventory — the client asks, it does not decide.

### Hair that is the colour you picked

The most useful thing this pass found was not in the hair at all.

The fragment shader adds an ambient sky reflection — the sky, in
proportion to how smooth a surface is — and it deliberately does *not*
multiply it by albedo, because a dielectric reflects the colour of what
it is looking at rather than its own. On a wall that is correct and
almost invisible. On a head of hair it is neither. A mass of thin round
strands presents grazing normals in every direction at once, so the
Fresnel term that gates the reflection is close to one nearly
everywhere, and the sky lands on top of the hair as a flat additive
wash.

Hair was inheriting the `blank` material, at roughness 0.70, and at
that roughness the wash was several times the albedo of anything dark.
Which means hair in this game has always come out roughly the colour of
the sky whatever the player chose, and the wardrobe's ten hair colours
have been doing almost nothing. Setting pure red as a test rendered
pale pink.

Chasing a glossy sheen made it worse, not better — 0.36 turned every
head into a lightbulb. The fix is the other direction: hair is a rough
material, 0.93, which puts the reflection an order of magnitude below
the albedo and hands the colour back. What is lost is the tight
highlight. What is bought is that black hair is black, which is the
better trade, and the broad grazing lobe that remains is the band you
actually wanted anyway.

### Strands

Four things were wrong with the geometry underneath.

**The section was a box.** Every strand was an extruded rectangle: two
flat faces, two hard ninety-degree corners, a specular edge running the
full length, and a normal that jumped a right angle four times around.
It is now six points on an ellipse, and — this is the part that
matters — the normal is the ellipse's *gradient*, `(cos/w, sin/t)`, not
its position. On a tress four times wider than it is thick those are
nowhere near the same vector, and using the position is how you get a
strand lit like a cylinder instead of like a ribbon.

**The shade came in three bands**, root, middle and tip, which put two
visible seams across every strand at the same two places on all of
them. It is a ramp now.

**A curl was a zigzag.** Pushing along one axis on a cosine bends a
strand inside a plane: from the side it is corrugated, from the front it
is straight, and the two readings never agree. The perpendicular axis on
a sine at the same frequency is the whole difference between that and a
spiral.

**And there were not enough of them.** Two hundred cards a centimetre
wide on a fifteen-centimetre head is seven strands across the skull, and
seven strands across a skull is a bundle of worms. There are now about
two and a half times as many at just over half the width — the same
volume of hair, made of far more and much finer pieces — with the
sideways fan and the length variation cut right back, because a
silhouette made of six hundred individually visible tips reads as a wig
on a mannequin rather than as one mass with a soft edge.

The cap under the cards changed job too. It used to sit on the skull, so
every gap between strands showed bare head — a field of dark speckles
across the crown. It now sits at forty per cent of the style's own
length at each point, filling the volume from inside, and is shaded as
hair the light has not reached rather than as scalp. A gap shows hair in
shadow, which is what a gap in hair actually is.

### Build, as a shape rather than a size

`girth` multiplied every radius on the body by one number, so `bulk` was
`base` photographed closer and `slim` was `base` photographed further
away. At twenty metres — the distance a character is actually read at —
all three silhouettes were identical, because a uniform scale cannot
change a silhouette, only how much of the screen it takes.

What differs between builds is a set of ratios: shoulder against waist,
how deep the chest is, how much of a limb is muscle. So the scalar
stays, and a profile rides on top of it — four control rows sampled at
hip, waist, chest and shoulder height, interpolated up the body. It is
restrained — nine per cent at the widest — and it averages to about
one, so nothing changes size, only its distribution. What it changes is
the taper: on top of the body's own shape it moves the shoulder-to-waist
ratio about seven per cent between slim and bulk, and that ratio — not
the size — is what a silhouette is made of.

Garments inherit all of it for free, because a garment in this file has
always been the body's own rings grown outward by a millimetre or
twelve. The one thing that needed saying out loud is that the inflation
is added *after* the profile and not scaled by it: eleven millimetres of
clearance is a property of the cloth, not of the body inside it, and
scaling it with the chest is how a shirt ends up fitting one build and
clipping the other two. The pieces that are authored rather than derived
— the occupational coats, the cape, the trouser waistband — are told the
new width separately.

The mesh got denser while the numbers were open: the torso from twenty
segments around to twenty-six, arms from twelve to sixteen, legs from
fourteen to eighteen. A limb at twelve is visibly a prism at portrait
distance.

### Cloth with edges

Every garment in this file used to *stop*. A loft with an open bottom
ends on a ring of vertices and nothing else, which is a hem with no
thickness, and cloth with no thickness reads as paint on skin.

`edgeBand` is four rings that step out from the shell, run straight for
a centimetre or two, and tuck back under. It is now on the shirt hem,
the neckline, both cuffs, the trouser waistband and the turn-ups —
which is most of what tells you at a glance that a thing is made of
fabric rather than sprayed on.

Above that, the three tops finally differ by more than where they stop.
The jacket has a collar that *stands* — lapels lying flat on the chest
with nothing behind the neck is a jacket drawn from the front only — and
three buttons down the closure. The hoodie's hood was one squashed
sphere, with the silhouette of a rucksack and the highlight of a
balloon; a hood that is down is a thick roll of cloth bunched behind the
neck, wider than it is deep, heavy at the bottom and open at the top, so
it is now its own loft with a dark mouth, and it has the drawstrings
that are the reason a hoodie reads as a hoodie at fifty metres.

One thing the back view caught. Garments take the body's rings, and the
rings carry the body's own occlusion shading — a dark band at the groin,
because that is where light does not reach on skin. Trousers were
inheriting it, which put a dark patch across the hips of every pair in
the game and read as a second garment underneath. The shape is the
body's; the shading is not.

### The sawtooth along every path

There was a coloured zigzag wherever paving met grass — a stepped,
one-metre band of cream and magenta following the edge of every road
and every district. It looked like a texture bug because it was one,
and the cause is worth writing down because it is invisible from the
code.

Ground materials are indices into a texture array, stored per vertex
and blended in pairs: a primary layer, a secondary, and a weight. The
fragment shader has to round the index, because it arrives interpolated
across the triangle and a fractional array index is undefined rather
than a blend. That rounding is fine as long as both ends of a triangle
agree on *which pair* they are blending. Where they disagree — one
vertex says road-and-grass, the next says grass-and-cliff — the rounded
index sweeps through **every layer that happens to sit between them in
the atlas**. At a road-to-grass edge that is brick, then roof, then
foliage, then blossom, one metre at a time. The magenta was cherry
blossom, sampled by a hillside.

Two things fix it. A pad or a road now claims the material slot across
the whole of its influence rather than only where its paving is
visible, so both ends of a boundary triangle agree about which pair
they are blending — out at the edge the weight is 1, and the ground
still draws pure grass.

That is not enough on its own, because where two districts meet they
still disagree, and the zigzag survived it. The real fix is one word:
the layer indices are **flat**-qualified now. Interpolating an index
was never meaningful — the shader rounds it anyway — so the whole
triangle takes the provoking vertex's layer, and only the blend
weight, which *is* meaningful to interpolate, varies across it. There
is nothing left to sweep through.

A small trap on the way: the shaders are JavaScript template literals,
so the backticks in a comment saying "`flat`" ended the string in the
middle of the vertex stage. The syntax check caught it; a browser
would have shown a blank screen.

What is left at a boundary is a one-metre staircase, because the
primary now changes per triangle on a one-metre grid. That reads as a
paving edge rather than as a bug, which is the whole difference, but
it is a staircase and widening the weight ramps so the blend carries
more of the change would soften it further.

### Ground that is not a bathroom floor

Terrain UVs run in world units at 0.14, so every ground texture in this
game repeats every 7.1 metres. Over a 352-metre island that reads as
tiling however good the tile is, because the thing the eye picks up is
the period, not the content — and no amount of detail inside the tile
addresses the period.

Two octaves of slow world-space noise now multiply the terrain albedo.
It costs no extra texture fetch, it is switched on by a uniform that is
1 for the ground and 0 for everything else (a prop tinted by its world
position would change colour as it was carried), and besides breaking
the repeat it gives the island tonal range: patches simply lighter or
darker than their neighbours, which is most of what makes real ground
look like ground.

The recipes underneath it changed too. Paving had a checker, a nine per
cent tone jitter and a ruled grout line, which over a square reads as
graph paper; slabs now vary widely in tone, one in nine has been
replaced and does not match the run, the joint has a soft shoulder and
a per-slab width, and the whole palette moved from cold blue-grey to
warm stone — a town square in cold grey is the difference between
somewhere to arrive and a multi-storey car park. Grass ran from a
saturated mid-green to a near-lime, all in one hue, which over a
hillside is felt; real turf is barely saturated and its variation is in
value, so it is olive and khaki now with the bright green confined to
new growth, and it has patches that have gone over and patches in
shade.

### The portal was a barrel

The world gateway is the first thing anybody sees, and it was a stack
of horizontal circles lofted up the Y axis — which is a barrel two
metres deep, not a doorway. Fully emissive, one flat cyan, sticking a
metre out of the arch front and back.

A portal is a membrane: it lives in the plane of the arch, it is
darkest in the middle where you are looking through it and brightest at
the rim, and it is dished so the light on it moves as you walk past.
The first attempt at that was a stack of flat annuli, which was better
and still wrong — the opening is a half-circle standing on a plinth, so
a full disc spends its lower half buried in the plinth and glowing out
of the front of it. It is half-rings now, filling the opening and
nothing else, at about half the emissive it had.

### Trees, at the right size

A seven-metre broadleaf carried a trunk 0.72 m across at the base
before the placement scale multiplied it again by up to 1.4, so a wood
was a row of columns. Trunks are down to about a third of that across
every species — and they gained a root flare, two wider, lumpier rings
over the first three per cent of the height, because a trunk that meets
the ground at full radius is a pipe pushed into a lawn and the flare is
most of what says "grown here". They went from eight sides to eleven,
which is the difference between a tree and a visible octagon at ten
metres.

The bark ran a clean sine of period 22 around the trunk for its cracks,
and a clean sine wrapped round a cylinder is corduroy — a stripe you can
count. The cracks follow warped noise now, so they wander and fork and
stop, the ridges are broader and lower in contrast, and the colour moved
from chocolate to grey-brown with lichen in it. Canopy lobes were two
alternating shades, which gives a flat mass with a seam in it; they take
five now, and the deep shade in the foliage texture stopped going almost
black — a canopy whose dark half is black is a hole in the sky rather
than the inside of a tree.

### A town somebody lives in

Every building palette sat within about fifteen per cent of neutral
grey: four styles of pale stone under grey-blue roofs, which is why the
waterfront read as a row of unfinished office blocks whatever the light
did. Real harbour fronts are the opposite — ochre beside washed blue
beside dark red — held together by sharing a roof material and a trim
colour rather than by all being the same colour. The trim and the base
stay quiet now precisely so the walls can be loud.

And the plaza has something drawn on it. A disc of tile forty metres
across with a fountain in the middle reads as a car park with a
fountain in the middle, and no work on the tile texture changes that,
because the problem is that nothing had been *drawn* on the square. Two
courses of darker stone around the basin, a ring at the edge and eight
spokes running out under the furniture give it a centre and a set of
directions, for one static mesh and no collision.

### The sky

Twelve floating islands ring the harbour, three of them pouring water into
open air. Their height is derived from their radius rather than rolled
independently: a keel hangs 1.72 island-radii below its grass cap, so two
free random numbers put a large island's point through the rooftops.

Street lamps, shop signs and the fountain crystal register themselves as
point lights when they are placed, and the renderer picks the sixteen
nearest the camera each frame. They fade up with the sun's elevation
instead of switching on at a clock edge, and overcast brings them on early.

### A toy, not a person

The reference for this pass was a phone game: flat unlit colour, no
surface detail, no specular anywhere, and characters a shade over three
heads tall standing in a world made of primary shapes. Everything the
previous six passes had built toward — anatomical proportion, strand
hair, relief from an albedo-derived normal map, a GGX lobe on skin and
cloth — is the opposite of that. So most of this pass is subtraction.

The shading went first. Sun down, ambient up threefold, a warm bounce off
the ground, `uSpec` from 0.25 to 0.03 and the sky-reflection term from
0.85 to 0.22; every roughness in `SURF` pushed toward matte, and the
bump multiplier from 1.0 to 0.10. Then `toyify` pulls each of the
forty-odd painted textures 84 per cent of the way to one flat colour,
mean-preserving, so a plank still reads as a plank and a brick as a brick
but neither has visible grain at two metres.

The bodies are the interesting half. The skeleton and the sixty ring
tables hanging off it are all in metres, all authored against a real
figure, and re-measuring them was a week of work nobody wanted. So both
bodies are kept and one map moves between them. Each bone gets two
scales: a **structural** one that decides where its children land, and a
**vertex** one that decides how the skin around it stretches. A vertex is
then moved exactly the way it will later be skinned — by the weighted
blend of its own bones' maps — which is what makes this safe. A shirt cut
from the body's rings arrives where the body arrives, a seam that closed
before still closes, and not one literal in any garment, coat, cape or
boot had to change. `LH.Rig.warp` is thirty lines and every skinned part
in the game goes through it.

What it buys: legs at 56 per cent of their length, a torso a tenth longer,
arms shortened to 86 per cent and thickened by two thirds, thighs at 130
per cent and pushed apart so they still clear, hands half again as wide.
The head is not warped — it is instanced and scaled by `P.headScale`,
which went from 0.86 to 1.90, and every hairstyle, hat, beard and pair of
glasses is authored in that same space and grew with it for free.

The crown is then solved rather than scaled to. It sits at 1.62 m, six
centimetres below where the real body's did, and that drop is deliberate:
it buries the jaw in the collar. A toy has no neck, and the way you get
no neck is not to shorten the neck bone but to lower the skull until the
shoulders meet it. The neck bone moves up under the jaw, what is left of
the neck's own skin is squashed to 62 per cent, and the two rings bound
to the head are pressed to 30 so they stay hidden inside it. The figure
is three heads and a fifth, which is the reference to within a tenth.

The face lost most of what the last pass gave it. The painted map goes
from a full portrait — sockets, alae, a philtrum, cheek hollows, blood in
the ears, pores — to three marks: a soft socket, the hint of a nose, and
a mouth. The lips are still geometry, because a mouth that is only paint
disappears when the light moves, but their colours stepped from a third
away from the skin to a twentieth. The nose came back two thirds of the
way to the face plane; at 1.90 head scale the old one stood out five and
a half centimetres and threw a shadow across half the face.

Hair keeps its cards and changes what they are for. The cap underneath
them — which used to be a backing, pushed out four centimetres so no
scalp showed between strands — is now pushed out to most of the style's
own length, so it carries the silhouette and the cards ride on top of it.
The hairline comes down two fifths, because a forehead that was right on
a real head is a cinema screen on this one, and the fringe arrives with
it. The strand density is only slightly coarser than before: the head
nearly doubled, so the same strand already covers twice the pixels, and
going wider than 0.9 turns cards into roof shingles — which is exactly
what the first two attempts at this looked like.

Three things are honestly still short of the reference. The swept fringe
still resolves into individual ribbons at conversation distance. The eyes
are the realistic build from two passes ago, scaled up; enlarging the
iris to match the reference's read made them worse, not better, because
the limbal ring grows with it, so `IRISK` is left at 1. And the face is
still a sculpted head with a painted map on it rather than two dots on a
flat field. Each is its own pass.

Every switch has an off position — `TOYHAIR`, `TOYFACE`, `TOY_MIX`, and
`LH.Rig.TOY` — and turning them off restores the previous look exactly.

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

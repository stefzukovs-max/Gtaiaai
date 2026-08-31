/* ============================================================
   LH.Data — the item table.

   Every item in the game is one row. Nothing switches on a key name:
   behaviour comes from `cat` and `shape`, prices from `value`, and
   the world renderer reads `mat`/`col`/`emis` the same way for a
   block of stone as for a legendary crown. That is what lets the
   table grow to a thousand rows without touching gameplay code.

   Rarity runs 1..6 — common, uncommon, rare, epic, legendary,
   mythic — carried over from the 2D build along with its colour ramp,
   because players already read those tiers at a glance.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,D={};

var ITEMS=[], ID={}, BY_CAT={};

/* Categories are the inventory's tabs and the shop's aisles. */
/* `seed` used to be here. Nothing in this game plants, so it was a
   tab with no items and no behaviour behind it — a category is a
   promise about what the game does, and that one was not kept. */
var CAT=['block','material','tool','weapon','fishing','furniture',
         'cosmetic','collectible','consumable','quest'];
D.CAT=CAT;
D.RARITY=['','Common','Uncommon','Rare','Epic','Legendary','Mythic'];
D.RARITY_COL=['','#9AA8BE','#57D07A','#489BFF','#B269FF','#F5A03C','#FF4F7A'];

/* Shapes a placeable item can take in the world. The voxel mesher
   switches on this and nothing else. */
D.SHAPES=['cube','slab','pillar','pane','plant','lamp','fence'];

function It(key,name,o){
  o=o||{};
  var r=o.r===undefined?1:o.r;
  var it={
    id:ITEMS.length,
    key:key,
    name:name,
    desc:o.desc||'',
    cat:o.cat||'block',
    rarity:r,
    /* Value is in soft currency and everything else derives from it:
       the shop marks up, the vendor marks down, and the trade window
       totals with it. One number, so prices cannot drift apart. */
    value:o.value===undefined?Math.round(4*Math.pow(2.35,r-1)):o.value,
    stack:o.stack===undefined?(o.cat==='tool'||o.cat==='weapon'||
      o.cat==='fishing'||o.cat==='cosmetic'?1:999):o.stack,
    tradeable:o.tradeable!==false,
    placeable:o.placeable!==undefined?o.placeable:(o.cat||'block')==='block'
      ||o.cat==='furniture',
    consumable:!!o.consumable,
    craftable:!!o.recipe,
    recipe:o.recipe||null,
    /* world appearance */
    shape:o.shape||'cube',
    mat:o.mat||'stone',
    col:o.col||'#FFFFFF',
    emis:o.emis||0,
    /* mining */
    hard:o.hard===undefined?Math.max(1,Math.round(1+r*1.4)):o.hard,
    tool:o.tool||null,
    drops:o.drops||null,
    /* activity-specific payloads: fish weight ranges, tool power,
       weapon damage, cosmetic slot */
    props:o.props||null
  };
  ID[key]=it.id;
  ITEMS.push(it);
  (BY_CAT[it.cat]||(BY_CAT[it.cat]=[])).push(it);
  return it;
}
D.It=It;

/* ---------------- blocks: the building set ----------------
   The colour column is a *modulation*, not the block's colour. The
   material texture already carries the hue — stone is grey, brick is
   red, foliage is green — so a mid-grey tint on a mid-grey texture
   multiplies out to about a tenth of the albedo it should have, and
   the block renders near-black in anything but direct sun. White
   means "as the material comes"; anything else is a deliberate
   variant of it. */
function B(key,name,mat,col,r,o){
  o=o||{};o.cat='block';o.mat=mat;o.col=col;o.r=r;
  return It(key,name,o);
}
B('stone',      'Stone',           'stone',   '#FFFFFF',1);
B('cobble',     'Cobblestone',     'gravel',  '#FFFFFF',1);
B('dirt',       'Packed Dirt',     'dirt',    '#FFFFFF',1);
B('sand',       'Sand Block',      'sand',    '#FFFFFF',1);
B('grassblock', 'Turf',            'grass',   '#FFFFFF',1);
B('plank',      'Oak Plank',       'planks',  '#FFFFFF',1);
B('darkplank',  'Ash Plank',       'planks',  '#8E7A66',2);
B('log',        'Timber',          'bark',    '#FFFFFF',1);
B('brick',      'Red Brick',       'brick',   '#FFFFFF',1);
B('palebrick',  'Sandstone Brick', 'brickpale','#FFFFFF',2);
B('concrete',   'Concrete',        'concrete','#FFFFFF',1);
B('panel',      'Steel Panel',     'panel',   '#FFFFFF',2);
B('whitepanel', 'White Panel',     'panelw',  '#FFFFFF',2);
B('marble',     'Marble',          'tilepale','#FFFFFF',3);
B('tilefloor',  'Slate Tile',      'tile',    '#FFFFFF',2);
B('roofblock',  'Roof Tile',       'roof',    '#FFFFFF',2);
B('glassblock', 'Glass',           'glass',   '#DCEAF4',2);
B('snowblock',  'Packed Snow',     'snow',    '#FFFFFF',2);
B('goldblock',  'Gold Block',      'gold',    '#FFFFFF',4,{value:520});
B('crystalblock','Crystal Block',  'crystal', '#DFF6FF',4,{emis:0.28,value:640});
B('voidblock',  'Void Stone',      'stone',   '#4E5464',5,{value:1500});
B('emberblock', 'Ember Block',     'stone',   '#FFB88A',5,{emis:0.5,value:1750});
B('aurorablock','Aurora Block',    'crystal', '#D6B4FF',6,{emis:0.6,value:5200});

/* the same set as slabs, pillars and panes — a builder needs shapes,
   not just colours */
B('stoneslab',  'Stone Slab',      'stone',   '#FFFFFF',1,{shape:'slab'});
B('plankslab',  'Plank Slab',      'planks',  '#FFFFFF',1,{shape:'slab'});
B('panelslab',  'Panel Slab',      'panel',   '#FFFFFF',2,{shape:'slab'});
B('marbleslab', 'Marble Slab',     'tilepale','#FFFFFF',3,{shape:'slab'});
B('stonepillar','Stone Pillar',    'stone',   '#FFFFFF',2,{shape:'pillar'});
B('woodpillar', 'Wooden Post',     'bark',    '#FFFFFF',1,{shape:'pillar'});
B('goldpillar', 'Gilded Column',   'gold',    '#FFFFFF',4,{shape:'pillar',value:600});
B('glasspane',  'Glass Pane',      'glass',   '#DCEAF4',2,{shape:'pane'});
B('panelpane',  'Steel Screen',    'panel',   '#C8D0DC',2,{shape:'pane'});
B('woodfence',  'Wooden Fence',    'planks',  '#E4CCA8',1,{shape:'fence'});
B('ironfence',  'Iron Railing',    'panel',   '#AEB6C2',2,{shape:'fence'});

/* light sources — the thing every builder runs out of first */
B('lantern',    'Lantern',         'neon',    '#FFD9A0',2,{shape:'lamp',emis:1,value:60});
B('neonlamp',   'Neon Strip',      'neon',    '#3BE0C8',3,{shape:'lamp',emis:1,value:150});
B('roselamp',   'Rose Lamp',       'neon',    '#FF6E9C',3,{shape:'lamp',emis:1,value:150});
B('violetlamp', 'Violet Lamp',     'neon',    '#B269FF',3,{shape:'lamp',emis:1,value:150});
B('sunlamp',    'Sun Lamp',        'neon',    '#FFC24A',4,{shape:'lamp',emis:1,value:420});

/* plants */
B('fern',       'Fern',            'foliage', '#FFFFFF',1,{shape:'plant',placeable:true});
B('bloom',      'Pink Bloom',      'foliagep','#FFFFFF',2,{shape:'plant'});
B('reed',       'Harbour Reed',    'foliage', '#E4F0B8',1,{shape:'plant'});
B('glowmoss',   'Glowmoss',        'foliage', '#BFF8DC',3,{shape:'plant',emis:0.5,value:180});

/* ---------------- raw materials ---------------- */
var MAT_COL={
  wood:'#A8794E',fibre:'#9CBE6A',stonechunk:'#8E939C',sandpile:'#E4CC96',
  clay:'#C08064',coal:'#3A3E46',copper:'#C07A46',iron:'#B0B6C0',
  silver:'#DCE4EE',gold:'#F5C451',crystal:'#7FE8FF',mythril:'#8ED8C4',
  voidshard:'#8A6ACC',starcore:'#FFE9A8',plank_m:'#C6A47A',
  ingot_cu:'#D08A50',ingot_fe:'#C2C8D2',ingot_ag:'#E8EEF6',ingot_au:'#FFD469',
  glass_m:'#BFDCEA',rope:'#C4A878',cloth:'#D8CCBA'
};
function Mt(key,name,r,o){
  o=o||{};o.cat='material';o.r=r;o.placeable=false;
  o.col=o.col||MAT_COL[key]||'#B0B6C0';
  return It(key,name,o);
}
Mt('wood',      'Timber',      1,{desc:'Cut from any tree.'});
Mt('fibre',     'Plant Fibre', 1);
Mt('stonechunk','Stone Chunk', 1);
Mt('sandpile',  'Sand',        1);
Mt('clay',      'Clay',        1);
Mt('coal',      'Coal',        2);
Mt('copper',    'Copper Ore',  2);
Mt('iron',      'Iron Ore',    2);
Mt('silver',    'Silver Ore',  3);
Mt('gold',      'Gold Ore',    3);
Mt('crystal',   'Raw Crystal', 4);
Mt('mythril',   'Mythril',     5,{value:900});
Mt('voidshard', 'Void Shard',  5,{value:1200});
Mt('starcore',  'Star Core',   6,{value:4800,desc:'Nobody agrees where these come from.'});
Mt('plank_m',   'Cut Plank',   1,{recipe:[['wood',2]]});
Mt('ingot_cu',  'Copper Ingot',2,{recipe:[['copper',2],['coal',1]]});
Mt('ingot_fe',  'Iron Ingot',  2,{recipe:[['iron',2],['coal',1]]});
Mt('ingot_ag',  'Silver Ingot',3,{recipe:[['silver',2],['coal',1]]});
Mt('ingot_au',  'Gold Ingot',  3,{recipe:[['gold',2],['coal',1]]});
Mt('glass_m',   'Glass Pane',  2,{recipe:[['sandpile',3],['coal',1]]});
Mt('rope',      'Rope',        1,{recipe:[['fibre',3]]});
Mt('cloth',     'Cloth',       2,{recipe:[['fibre',4]]});

/* ---------------- tools ----------------
   `power` is how fast a block yields; `tier` gates which materials the
   tool can break at all. Both live in props so the mining code never
   reads a key name. */
function Tl(key,name,r,power,tier,o){
  o=o||{};o.cat='tool';o.r=r;
  o.props={power:power,tier:tier,style:o.style||'pickaxe'};
  return It(key,name,o);
}
Tl('pick_stone', 'Stone Pick',   1,1.0,1,{recipe:[['stonechunk',3],['wood',2]]});
Tl('pick_copper','Copper Pick',  2,1.6,2,{recipe:[['ingot_cu',3],['wood',2]]});
Tl('pick_iron',  'Iron Pick',    3,2.4,3,{recipe:[['ingot_fe',3],['wood',2]]});
Tl('pick_silver','Silver Pick',  4,3.4,4,{recipe:[['ingot_ag',3],['wood',2]]});
Tl('pick_mythril','Mythril Pick',5,5.0,5,{recipe:[['mythril',3],['ingot_au',2]]});
Tl('axe_stone',  'Stone Axe',    1,1.0,1,{style:'axe',recipe:[['stonechunk',3],['wood',2]]});
Tl('axe_iron',   'Iron Axe',     3,2.4,3,{style:'axe',recipe:[['ingot_fe',3],['wood',2]]});
Tl('wrench',     'Wrench',       2,1.0,1,{style:'wrench',
  desc:'Configures doors, signs and anything else with a setting.'});
Tl('torch_t',    'Torch',        1,1.0,1,{style:'torch',recipe:[['wood',1],['coal',1]]});

/* ---------------- weapons ---------------- */
function Wp(key,name,r,dmg,o){
  o=o||{};o.cat='weapon';o.r=r;
  o.props={damage:dmg,reach:o.reach||2.4,swing:o.swing||0.58,style:o.style||'sword'};
  return It(key,name,o);
}
Wp('sword_stone','Chipped Blade', 1,6);
Wp('sword_copper','Copper Sword', 2,10,{recipe:[['ingot_cu',3],['wood',1]]});
Wp('sword_iron', 'Iron Sword',    3,16,{recipe:[['ingot_fe',3],['wood',1]]});
Wp('sword_silver','Silver Sabre', 4,24,{recipe:[['ingot_ag',3],['ingot_fe',1]]});
Wp('sword_mythril','Mythril Edge',5,38,{recipe:[['mythril',3],['starcore',1]]});
Wp('axe_war',    'War Axe',       4,30,{style:'axe',swing:0.78,reach:2.7});

/* ---------------- fishing ---------------- */
function Rd(key,name,r,power,o){
  o=o||{};o.cat='fishing';o.r=r;
  o.props={power:power,style:'rod',luck:o.luck||0};
  return It(key,name,o);
}
Rd('rod_cane',   'Cane Rod',    1,1.0);
Rd('rod_oak',    'Oak Rod',     2,1.5,{luck:0.06,recipe:[['plank_m',3],['rope',2]]});
Rd('rod_steel',  'Steel Rod',   3,2.2,{luck:0.14,recipe:[['ingot_fe',2],['rope',2]]});
Rd('rod_crystal','Crystal Rod', 4,3.2,{luck:0.26,recipe:[['crystal',2],['ingot_ag',2]]});
Rd('rod_star',   'Starlight Rod',6,5.0,{luck:0.45,recipe:[['starcore',1],['mythril',2]]});
It('bait_worm', 'Worms',      {cat:'fishing',r:1,stack:99,value:3,consumable:true,
  props:{bait:1}});
It('bait_shrimp','Shrimp',    {cat:'fishing',r:2,stack:99,value:9,consumable:true,
  props:{bait:2}});
It('bait_lure', 'Glow Lure',  {cat:'fishing',r:4,stack:99,value:48,consumable:true,
  props:{bait:4},recipe:[['glowmoss',1],['fibre',2]]});

/* ---------------- fish ----------------
   `zone` names the water they live in and `w` is the weight range, so
   a catch's value scales with its size the way an angler expects. */
function Fh(key,name,r,zone,w0,w1,o){
  o=o||{};o.cat='collectible';o.r=r;o.placeable=false;
  o.props={fish:true,zone:zone,w:[w0,w1]};
  return It(key,name,o);
}
Fh('f_sprat',   'Harbour Sprat',  1,'harbour',0.1,0.5);
Fh('f_mackerel','Mackerel',       1,'harbour',0.4,2.0);
Fh('f_bass',    'Sea Bass',       2,'harbour',1.0,6.0);
Fh('f_cod',     'Cod',            2,'harbour',2.0,9.0);
Fh('f_tuna',    'Bluefin Tuna',   3,'harbour',20,120);
Fh('f_sword',   'Swordfish',      4,'harbour',40,190);
Fh('f_trout',   'River Trout',    1,'river',0.3,2.4);
Fh('f_carp',    'Mirror Carp',    2,'river',1.5,12);
Fh('f_eel',     'Silver Eel',     3,'river',1.0,7.0);
Fh('f_pike',    'Pike',           3,'river',3.0,18);
Fh('f_glow',    'Glowfish',       4,'deep',0.5,4.0);
Fh('f_koi',     'Crystal Koi',    5,'deep',2.0,14);
Fh('f_void',    'Void Eel',       5,'deep',6.0,40);
Fh('f_lumen',   'Lumen Angler',   6,'deep',30,260,{value:6800,
  desc:'Fishermen argue about whether it is a fish at all.'});
Fh('f_boot',    'Old Boot',       1,'harbour',0.4,1.2,{value:1});
Fh('f_can',     'Rusted Can',     1,'harbour',0.1,0.4,{value:1});

/* ---------------- furniture ---------------- */
function Fn(key,name,r,mat,col,o){
  o=o||{};o.cat='furniture';o.r=r;o.mat=mat;o.col=col;o.shape=o.shape||'cube';
  return It(key,name,o);
}
Fn('chair',     'Chair',        1,'planks','#E8CCA6');
Fn('table',     'Table',        1,'planks','#FFFFFF',{shape:'slab'});
Fn('crate_f',   'Crate',        1,'planks','#FFE6C0');
Fn('barrel_f',  'Barrel',       1,'planks','#DCB488',{shape:'pillar'});
Fn('rug',       'Woven Rug',    2,'fabric','#FFB0BE',{shape:'slab'});
Fn('bookshelf', 'Bookshelf',    2,'planks','#B49A7E');
Fn('anvil',     'Anvil',        3,'panel','#96A0AE',{shape:'slab'});
Fn('bench_f',   'Workbench',    2,'planks','#D8BA96',
  {recipe:[['plank_m',4],['stonechunk',2]]});
Fn('sign',      'Sign',         1,'planks','#FFE8C8',{shape:'pane'});
Fn('door',      'Door',         1,'planks','#C8A47E',{shape:'pane'});
Fn('statue',    'Marble Statue',4,'tilepale','#FFFFFF',{shape:'pillar',value:900});
Fn('trophy',    'Trophy',       5,'gold','#FFFFFF',{shape:'pillar',value:2600});

/* ---------------- cosmetics ----------------
   `slot` and `style` map straight onto the character kit. */
var DYEABLE_ICON={
  hair:'#6A4A2E', hat:'#5A6478', shirt:'#C8D0DC', pants:'#454E60',
  shoes:'#3A3B42', cape:'#8E4A54', back:'#7A5A3C', wings:'#DCE4EE',
  acc:'#3A4150', facial:'#4A3628', over:'#59616F', pet:'#B49A78',
  aura:'#7FE4FF', tool:'#C8A47E'
};
function Cs(key,name,r,slot,style,o){
  o=o||{};o.cat='cosmetic';o.r=r;o.placeable=false;
  o.props={slot:slot,style:style,col:o.col2||'#FFFFFF',emis:o.cemis||0};
  /* The icon painter reads `col`, the wardrobe reads `props.col`, and
     until now only the second was set — so a hundred and seventy
     cosmetics drew as white silhouettes in a shop that was selling
     them on their colour.

     A dyeable item keeps white in props.col, because that is what
     tells the wardrobe to leave your own colour alone; its *icon*
     gets a typical colour for the slot instead, so a shelf of them is
     a shelf of things rather than a shelf of blank cards. */
  o.col=o.col2||o.col||DYEABLE_ICON[slot]||'#FFFFFF';
  return It(key,name,o);
}
Cs('h_crop',   'Cropped Hair',   1,'hair','crop');
Cs('h_swept',  'Swept Hair',     1,'hair','swept');
Cs('h_long',   'Long Hair',      1,'hair','long');
Cs('h_bun',    'Top Knot',       2,'hair','bun');
Cs('h_spike',  'Spiked Hair',    2,'hair','spiked');
Cs('h_braid',  'Braids',         2,'hair','braids');
Cs('t_tee',    'Plain Tee',      1,'shirt','tee');
Cs('t_jacket', 'Field Jacket',   2,'shirt','jacket');
Cs('t_hoodie', 'Harbour Hoodie', 2,'shirt','hoodie');
Cs('t_crop',   'Cropped Top',    2,'shirt','crop');
Cs('hat_cap',  'Dock Cap',       1,'hat','cap');
Cs('hat_beanie','Knit Beanie',   1,'hat','beanie');
Cs('hat_brim', 'Wide Brim',      2,'hat','brim');
Cs('hat_visor','Neon Visor',     4,'hat','visor',{cemis:0.7});
Cs('hat_crown','Gilded Crown',   5,'hat','crown',{value:4200});
Cs('hat_halo', 'Halo',           6,'hat','halo',{cemis:1,value:9000});
Cs('w_feather','Feathered Wings',3,'wings','feathered');
Cs('w_bat',    'Nightwing',      3,'wings','bat');
Cs('w_mech',   'Mechwing',       4,'wings','mech',{cemis:0.3});
Cs('w_crystal','Crystal Wings',  5,'wings','crystal',{cemis:0.4,value:5200});
Cs('w_angel',  'Seraph Wings',   6,'wings','angelic',{cemis:0.5,value:11000});
Cs('w_ember',  'Ember Wings',    6,'wings','ember',{cemis:1,value:12500});
Cs('c_plain',  'Traveller Cape', 2,'cape','plain');
Cs('c_royal',  'Royal Cape',     5,'cape','royal',{value:4600});
Cs('b_satchel','Satchel',        1,'back','satchel');
Cs('p_cat',    'Harbour Cat',    3,'pet','cat');
Cs('p_drone',  'Survey Drone',   4,'pet','drone',{cemis:0.4});
Cs('p_sprite', 'Lumen Sprite',   6,'pet','sprite',{cemis:1,value:9600});
Cs('a_ring',   'Ground Ring',    4,'aura','ring',{cemis:1});
Cs('a_motes',  'Drifting Motes', 5,'aura','motes',{cemis:1,value:5400});
Cs('a_pillar', 'Pillar of Light',6,'aura','pillar',{cemis:1,value:14000});


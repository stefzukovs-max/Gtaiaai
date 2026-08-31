/* ============================================================
   THE CATALOGUE.

   Everything above this line is the game's original hundred-odd
   items: enough to prove the systems, nowhere near enough to make a
   shop worth walking into. What follows takes it to a catalogue.

   The model is Growtopia's, and so is the lesson from it. Most of its
   thousands of items are *families* — twelve solid colours, then the
   same twelve dark, then the same seven pastel, then the same seven
   pastel again with a flower on. Nobody hand-wrote those and nobody
   should: they are one row with a loop round it, and writing them out
   longhand would be four hundred lines that can drift out of step.
   What is hand-written is everything where the art actually differs.

   Two rules hold the whole thing together.

   Nothing here is a name with no object behind it. Every clothing row
   points at a style that exists in a *_BUILD table and has been built
   and measured; every block points at a material that exists in the
   texture array. A catalogue of items that do not render is a lie
   told at scale.

   And prices come from `value` alone, as they always have. The shop
   marks up, the vendor marks down, the trade window totals — so a new
   family cannot quietly break the economy, because it cannot set a
   price in more than one place.
   ============================================================ */

/* ---------------- the colour families ----------------
   One ramp, used for blocks, for the dark variants, and for
   wallpapers, so a red block and a red wallpaper are the same red. */
var HUES=[
  ['grey',  'Grey',  '#9AA3AD'],
  ['black', 'Black', '#2B2F36'],
  ['white', 'White', '#F2F4F7'],
  ['red',   'Red',   '#E04B45'],
  ['orange','Orange','#F08A3C'],
  ['yellow','Yellow','#F5C93C'],
  ['green', 'Green', '#5BC45E'],
  ['aqua',  'Aqua',  '#48C9D8'],
  ['blue',  'Blue',  '#4A86E8'],
  ['purple','Purple','#9A5BD8'],
  ['brown', 'Brown', '#9A7048'],
  ['steel', 'Steel', '#8792A0']
];
/* Darken toward black without going to it: a "dark red" that is
   nearly black is indistinguishable from a "dark purple" that is. */
function darker(hex,k){
  var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),
      b=parseInt(hex.slice(5,7),16);
  function c(v){var o=Math.round(v*k);return (o<16?'0':'')+o.toString(16);}
  return '#'+c(r)+c(g)+c(b);
}
function lighter(hex,k){
  var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),
      b=parseInt(hex.slice(5,7),16);
  function c(v){var o=Math.min(255,Math.round(v+(255-v)*k));
    return (o<16?'0':'')+o.toString(16);}
  return '#'+c(r)+c(g)+c(b);
}
for(var hi=0;hi<HUES.length;hi++){
  var H=HUES[hi];
  B(H[0]+'block',      H[1]+' Block',        'concrete',H[2],1);
  B('dark'+H[0]+'block','Dark '+H[1]+' Block','concrete',darker(H[2],0.52),2);
  /* Wallpaper is the same colour as a pane rather than a cube. In a
     side-on world it was a background; here it is a thin wall panel,
     which is the same job done in three dimensions. */
  It(H[0]+'paper',H[1]+' Wallpaper',{cat:'block',r:1,shape:'pane',
    mat:'panelw',col:lighter(H[2],0.30),value:5});
}
/* The pastel set, and the same set with a flower on it. Growtopia has
   both and the second one outsells the first, which is a fact about
   people rather than about blocks. */
var PASTEL=[['pink','Pink','#F6B8C8'],['orange','Orange','#F8CFA8'],
            ['yellow','Yellow','#F6E9A8'],['green','Green','#C2E8B4'],
            ['aqua','Aqua','#B4E4E8'],['blue','Blue','#B8CCF0'],
            ['purple','Purple','#D4BCEC']];
for(var pi=0;pi<PASTEL.length;pi++){
  var Pp=PASTEL[pi];
  B('pastel'+Pp[0],       'Pastel '+Pp[1]+' Block','concrete',Pp[2],1);
  B('pastelflower'+Pp[0], 'Pastel '+Pp[1]+' Flower Block','foliage',Pp[2],2);
  It('pastel'+Pp[0]+'paper','Pastel '+Pp[1]+' Wallpaper',{cat:'block',r:1,
    shape:'pane',mat:'panelw',col:Pp[2],value:6});
}

/* ---------------- themed blocks ----------------
   Hand-written, because each one is a different material or a
   different silhouette rather than a different tint. */
B('candycane',  'Candy Cane Block',  'tilepale','#F2A0A8',2);
B('chocolate',  'Chocolate Block',   'dirt',    '#7A4A2E',2);
B('darkchoc',   'Dark Chocolate Block','dirt',  '#4A2C1C',3);
B('pumpkin',    'Pumpkin Block',     'foliage', '#F08A2C',2);
B('jackblock',  "Jack O' Block",     'foliage', '#F0A030',3,{emis:0.30});
B('iceblock',   'Ice',               'glass',   '#C4E8F4',2);
B('snowflake',  'Snowflake Block',   'snow',    '#EAF4FF',3);
B('adobe',      'Adobe Block',       'brickpale','#D9A272',1);
B('sandstone',  'Sandstone',         'sand',    '#E8D4A4',1);
B('granite',    'Granite Block',     'stone',   '#8E8288',2);
B('jade',       'Jade Block',        'crystal', '#4FC49A',4);
B('amber',      'Amber Glass',       'glass',   '#F0A83C',3,{emis:0.18});
B('redglass',   'Red Glass Block',   'glass',   '#E06058',2,{emis:0.10});
B('blueglass',  'Blue Glass Block',  'glass',   '#5896E8',2,{emis:0.10});
B('artdeco',    'Art Deco Block',    'tilepale','#E0C88C',3);
B('hightech',   'High Tech Block',   'panel',   '#7FA8C8',3,{emis:0.22});
B('evilbrick',  'Evil Bricks',       'brick',   '#5A2830',3);
B('boney',      'Boney Block',       'tilepale','#E4DCC8',3);
B('viney',      'Viney Block',       'foliage', '#4E8A3C',2);
B('leafblock',  'Leaf Block',        'foliage', '#6FC04E',1);
B('autumnleaf', 'Autumn Leaf Block', 'foliage', '#E08A34',2);
B('tigerblock', 'Tiger Block',       'dirt',    '#E8A03C',3);
B('cloudstone', 'Cloudstone Block',  'panelw',  '#DCE8F4',3);
B('dreamstone', 'Dreamstone Block',  'crystal', '#B08CE8',4,{emis:0.24});
B('heartstone', 'Heartstone Block',  'crystal', '#F0567C',4,{emis:0.28});
B('moonblock',  'Moon Block',        'stone',   '#D8DCE4',3);
B('sunblock',   'Sun Block',         'gold',    '#FFD24D',4,{emis:0.55});
B('alienblock', 'Alien Block',       'crystal', '#7FE07A',4,{emis:0.30});
B('martian',    'Martian Soil',      'dirt',    '#C46A44',2);
B('marsrock',   'Mars Rock',         'cliff',   '#B4553C',2);
B('lavarock',   'Lava Rock',         'cliff',   '#5A3030',2,{emis:0.16});
B('deeprock',   'Deep Rock',         'cliff',   '#6E7480',3);
B('deepsand',   'Deep Sand',         'sand',    '#C8B488',2);
B('fossilrock', 'Fossil Rock',       'stone',   '#B0A490',2);
B('igneous',    'Igneous Rock',      'cliff',   '#4E4A50',3);
B('ammonite',   'Ammonite Block',    'stone',   '#C0A878',3);
B('pineappleblk','Pineapple Block',  'foliage', '#F0C43C',3);
B('churro',     'Churro Block',      'planks',  '#D89A50',2);
B('pinatablock','Pinata Block',      'fabric',  '#F06AA0',3);
B('celtic',     'Celtic Block',      'stone',   '#5A9A62',3);
B('rainbowblk', 'Rainbow Block',     'crystal', '#F07CC0',4,{emis:0.34});
B('glowyblock', 'Glowy Block',       'neon',    '#9FF0C4',4,{emis:0.85});
B('checker',    'Checker Block',     'tile',    '#DCDCDC',2);
B('polkadot',   'Polka Dot Block',   'tile',    '#F0A8C4',2);
B('swisscheese','Swiss Cheese Block','tilepale','#F0D060',2);
B('bubblewrap', 'Bubble Wrap',       'glass',   '#DCE8EC',2);
B('cardboard',  'Cardboard Box',     'planks',  '#C8A070',1);
B('crystalblk', 'Crystal Block',     'crystal', '#9FE8F0',4,{emis:0.30});
B('emeraldblk', 'Emerald Block',     'crystal', '#3CD08A',5,{emis:0.22});
B('rubyblk',    'Ruby Block',        'crystal', '#E8446A',5,{emis:0.22});
B('sapphireblk','Sapphire Block',    'crystal', '#4A7CE8',5,{emis:0.22});
B('topazblk',   'Topaz Block',       'crystal', '#F0B03C',5,{emis:0.22});

/* Number blocks 0-9. Nine rows and a loop, and the reason they exist
   is that players label their worlds with them. */
for(var ni=0;ni<10;ni++)
  B('num'+ni,'Number Block '+ni,'tilepale','#D8DCE4',1,{value:8});

/* ---------------- clothing ----------------
   One row per style that exists in the geometry, named the way the
   thing would be named in a shop rather than the way it is named in
   the code. `col` is the item's own colour, and an item that leaves it
   white stays dyeable from the wardrobe. */
function Cw(key,name,r,slot,style,col,o){
  o=o||{};o.col2=col||'#FFFFFF';
  return Cs(key,name,r,slot,style,o);
}
/* --- headwear --- */
Cw('hat_top',    'Top Hat',            3,'hat','tophat','#20222A');
Cw('hat_fedora', 'Fedora',             2,'hat','fedora','#3A3038');
Cw('hat_cowboy', 'Cowboy Hat',         3,'hat','cowboy','#A4763E');
Cw('hat_wizard', "Wizard's Hat",       4,'hat','wizard','#4A3C9A');
Cw('hat_witch',  'Witch Hat',          4,'hat','witch','#2A2038');
Cw('hat_pirate', 'Pirate Hat',         4,'hat','pirate','#241E28');
Cw('hat_viking', 'Viking Helmet',      4,'hat','viking','#98A0A8');
Cw('hat_knight', 'Knight Helmet',      5,'hat','knight','#AEB6C0',{value:3800});
Cw('hat_santa',  'Santa Hat',          3,'hat','santa','#D8383C');
Cw('hat_elf',    'Elf Hat',            3,'hat','elf','#3C9A54');
Cw('hat_chef',   'Chef Hat',           2,'hat','chef','#F4F2EE');
Cw('hat_straw',  'Straw Hat',          1,'hat','straw','#DCBE78');
Cw('hat_somb',   'Sombrero',           3,'hat','sombrero','#E8B44C');
Cw('hat_pith',   'Pith Helmet',        3,'hat','pith','#D8CBA4');
Cw('hat_ball',   'Football Helmet',    3,'hat','football','#C4483C');
Cw('hat_space',  'Astronaut Helmet',   5,'hat','spacehelmet','#EAEEF4',
   {value:4400});
Cw('hat_party',  'Party Hat',          2,'hat','partyhat','#F05A8C');
Cw('hat_phones', 'GrowBeats Headphones',4,'hat','headphones','#2E3440',
   {cemis:0.5});
Cw('hat_antler', 'Antler Hat',         3,'hat','antlers','#8A6A48');
Cw('hat_bunny',  'Bunny Ears',         2,'hat','bunnyears','#F4F0EC');
Cw('hat_cat',    'Meow Ears',          2,'hat','catears','#3A3238');
Cw('hat_ring',   'Ringmaster Hat',     5,'hat','ringmaster','#8A2434',
   {value:4200});
/* --- hair. Item-only, as it has been since the roster was built --- */
Cw('h_bowl',     'Bowl Cut',           1,'hair','bowl');
Cw('h_pixie',    'Pixie Cut',          1,'hair','pixie');
Cw('h_mop',      'Messy Brown Hair',   2,'hair','mop','#6A4A2E');
Cw('h_undercut', 'Undercut',           2,'hair','undercut');
Cw('h_bolt',     'Spikey Hair',        3,'hair','bolt');
Cw('h_flame',    'Shocking Hair',      4,'hair','flame','#F0703C');
Cw('h_mohawk',   'Purple Mohawk',      3,'hair','mohawk','#9A4BD8');
Cw('h_veil',     'Malevolent Hair',    4,'hair','veil','#1E1A24');
Cw('h_wave',     'Long Brown Hair',    2,'hair','wave','#6A4630');
Cw('h_afro',     'Afro',               2,'hair','afro');
Cw('h_curls',    'Kansas Curls',       2,'hair','curls');
Cw('h_locs',     'Long Black Hair',    3,'hair','locs','#241C22');
Cw('h_topknot',  'Top Knot',           2,'hair','topknot');
Cw('h_ponytail', 'Ponytail',           2,'hair','ponytail');
Cw('h_twin',     'Pigtails',           2,'hair','twin');
Cw('h_braids2',  'Black Braids',       3,'hair','braids','#241C22');
Cw('h_rainbow',  'Rainbow Wig',        5,'hair','afro','#F05AA0',{value:3600});
Cw('h_frost',    'Frosty Hair',        4,'hair','flame','#BFE8F4');
Cw('h_platinum', 'Platinum Blonde Hair',3,'hair','wave','#EFE6CC');
Cw('h_slick',    'Slick Black Hair',   2,'hair','swept','#1C1820');
/* --- facial hair --- */
Cw('f_stubble',  'Five O’Clock Shadow',1,'facial','stubble');
Cw('f_moust',    'Shallot Mustache',   1,'facial','moustache');
Cw('f_handle',   'Biker Stache',       2,'facial','handlebar');
Cw('f_pencil',   'Pencil Mustache',    2,'facial','pencil');
Cw('f_goatee',   'Goatee',             1,'facial','goatee');
Cw('f_beard',    'Bushy Beard',        2,'facial','bushy');
Cw('f_white',    'White Beard',        3,'facial','bushy','#EFEAE2');
Cw('f_orange',   'Orange Beard',       3,'facial','bushy','#D87A2E');
Cw('f_burns',    'Sideburns',          1,'facial','sideburns');
/* --- worn on the face --- */
Cw('a_specs',    'Gold-Rimmed Glasses',2,'acc','specs','#E8C45C');
Cw('a_black',    'Black-Rimmed Glasses',1,'acc','specs','#242028');
Cw('a_big',      'Big Glasses',        2,'acc','bigglasses','#2A2630');
Cw('a_mono',     'Monocle',            3,'acc','monocle','#E8C45C');
Cw('a_3d',       '3D Glasses',         2,'acc','threed');
Cw('a_goggles',  'Ze Goggles',         2,'acc','goggles','#8A6A3C');
Cw('a_visor',    'Cyclopean Visor',    4,'acc','visor2','#E04B45',{cemis:0.5});
Cw('a_patch',    'Eyepatch',           2,'acc','eyepatch','#1E1A20');
Cw('a_nose',     'Clown Nose',         2,'acc','clownnose');
Cw('a_fangs',    'Vampire Fangs',      3,'acc','fangs');
Cw('a_ninja',    'Ninja Mask',         3,'acc','ninjamask','#1E1E26');
Cw('a_burglar',  'Burglar Mask',       2,'acc','burglar','#1E1E26');
Cw('a_paint',    'War Paint',          2,'acc','warpaint');
Cw('a_snorkel',  'Snorkel',            2,'acc','snorkel','#3CC8E8');
Cw('a_hoops',    'Hoop Earrings',      2,'acc','earrings','#E8C45C');
Cw('a_bandana',  'Face Bandana',       1,'acc','bandana','#C4483C');
/* --- tops --- */
Cw('t_green',    'Green Shirt',        1,'shirt','tee','#4E9A54');
Cw('t_orange',   'Orange Shirt',       1,'shirt','tee','#E88A3C');
Cw('t_white',    'Plain White Tee',    1,'shirt','tee','#F2F4F7');
Cw('t_tan',      'Tan Shirt',          1,'shirt','tee','#D8BE96');
Cw('t_tiedye',   'Tie Dyed Shirt',     2,'shirt','tee','#B45BD8');
Cw('t_hawaii',   'Hawaiian Shirt',     2,'shirt','tee','#3CC0A0');
Cw('t_ref',      'Referee Shirt',      2,'shirt','tee','#E8E8EC');
Cw('t_jersey',   'Red Sportsball Jersey',2,'shirt','tee','#D8383C');
Cw('t_lab',      'Lab Coat',           3,'shirt','jacket','#F0F2F6');
Cw('t_leather',  'Leather Jacket',     3,'shirt','jacket','#3A2E2C');
Cw('t_puffy',    'Puffy Orange Jacket',3,'shirt','hoodie','#E8802C');
Cw('t_muscle',   'Muscle Suit',        4,'shirt','tee','#E4B48C');
Cw('t_crop2',    'Cropped Top',        2,'shirt','crop','#F0A8C4');
Cw('t_tux',      'Tuxedo',             4,'shirt','jacket','#1E1C22',{value:1700});
Cw('t_pinstripe','Pinstripe Suit',     4,'shirt','jacket','#3A3E52');
Cw('t_vamp',     'Vamp Vest',          4,'shirt','jacket','#2A1A24');
Cw('t_ninjav',   'Ninja Vest',         3,'shirt','vest','#22222A');
Cw('t_tank',     'Muscle Shirt',       1,'shirt','tank','#E8ECF2');
Cw('t_tankr',    'Red Tank',           1,'shirt','tank','#D8484C');
Cw('t_vest',     'Saturday Night Vest',3,'shirt','vest','#F0F2F6');
Cw('t_vestb',    'Carny Vest',         3,'shirt','vest','#8A2E44');
Cw('t_jerseyb',  'FC Jersey',          2,'shirt','jersey','#3E6EC8');
Cw('t_jerseyg',  'Man U Jersey',       2,'shirt','jersey','#C4383C');
Cw('t_dressp',   'Lovely Pink Dress',  3,'shirt','dress','#F0A0C0');
Cw('t_dressc',   'Checkered Dress',    3,'shirt','dress','#D8DCE4');
Cw('t_dressb',   'Simple Purple Dress',2,'shirt','dress','#9A6AD8');
Cw('t_dressr',   'Red Sun Dress',      2,'shirt','dress','#D8484C');
Cw('t_flapper',  'Flapper Dress',      4,'shirt','gown','#2A2630');
Cw('t_gown',     'Wedding Dress',      5,'shirt','gown','#F6F4F0',{value:5200});
Cw('t_layer',    'Layer Cake Dress',   4,'shirt','gown','#F0D8E4');
Cw('t_fiesta',   'Flamenco Dress',     4,'shirt','gown','#D8384C');
Cw('t_robe',     "Wizard's Robe",      4,'shirt','robe','#4A3C9A');
Cw('t_robew',    'Winter Robe',        3,'shirt','robe','#DCE8F4');
Cw('t_cultist',  'Cultist Robe',       4,'shirt','robe','#2A2038');
Cw('t_hanbok',   'Hanbok Top',         3,'shirt','robe','#F0E4A8');
Cw('t_suit',     'Pinstripe Suitcoat', 4,'shirt','suit','#3A3E52');
Cw('t_suitp',    'Pink Suitcoat',      4,'shirt','suit','#E8A0B8');
Cw('t_leprec',   'Leprechaun Suit',    3,'shirt','suit','#3C8A4C');
Cw('t_santa',    'Santa Vest',         3,'shirt','jacket','#D8383C');
/* --- outer layers --- */
Cw('o_oilskin',  "Harbourmaster's Oilskin",4,'over','oilskin','#3E4C5A');
Cw('o_longcoat', "Warden's Longcoat",  4,'over','longcoat','#2E3648');
Cw('o_harness',  'Quarry Harness',     2,'over','harness','#7A5A3C');
Cw('o_stole',    'Registry Stole',     3,'over','stole','#8A2E44');
Cw('o_apron',    'Market Apron',       1,'over','apron','#D8C8A8');
Cw('o_meaty',    'Meaty Apron',        3,'over','apron','#B4483C');
Cw('o_belt',     'Tool Belt',          2,'over','toolbelt','#6A4A30');
Cw('o_pauldron', 'Plate Mail',         4,'over','pauldron','#AEB6C0');
/* --- legs and feet --- */
Cw('p_jeans',    'Jeans',              1,'pants','long','#3E5A8A');
Cw('p_black',    'Black Pants',        1,'pants','long','#22242A');
Cw('p_green',    'Green Pants',        1,'pants','long','#3C7A48');
Cw('p_camo',     'Camo Pants',         2,'pants','long','#6A7A4A');
Cw('p_cargo',    'Cargo Shorts',       1,'pants','shorts','#8A7A54');
Cw('p_sweat',    'Red Sweatpants',     1,'pants','long','#C4483C');
Cw('p_fancy',    'Fancy Pants',        3,'pants','long','#3A3448');
Cw('p_bell',     'White Bellbottoms',  3,'pants','long','#F0F0F4');
Cw('p_pinstripe','Pinstripe Pants',    3,'pants','long','#3A3E52');
Cw('p_hammer',   'Hammer Pants',       2,'pants','baggy','#8A5BD8');
Cw('p_baggy',    'Smarty Pants',       2,'pants','baggy','#3A4458');
Cw('p_bell2',    'Poodle Skirt',       3,'pants','skirt','#E8A0C0');
Cw('p_skirtg',   'Green Skirt',        1,'pants','skirt','#4E9A54');
Cw('p_skirtb',   'Blue Skirt',         1,'pants','skirt','#4A78C8');
Cw('p_hanbok',   'Hanbok Skirt',       3,'pants','gown','#E8A8C4');
Cw('p_steam',    'Steampunk Skirt',    4,'pants','gown','#6A5442');
Cw('s_brown',    'Brown Shoes',        1,'shoes','shoe','#6A4A32');
Cw('s_patent',   'Patent Leather Shoes',2,'shoes','shoe','#1C1A20');
Cw('s_ruby',     'Ruby Slippers',      4,'shoes','shoe','#D8384C');
Cw('s_boots',    'Boots',              1,'shoes','boot','#4A3A2C');
Cw('s_cowboy',   'Cowboy Boots',       3,'shoes','boot','#A4763E');
Cw('s_asbestos', 'Asbestos Boots',     3,'shoes','boot','#8E9298');
Cw('s_zombie',   "Zombie-Stompin' Boots",3,'shoes','boot','#3C4A38');
Cw('s_moon',     'Moon Boots',         4,'shoes','boot','#E4E8F0');
Cw('s_air',      'Air Robinsons',      3,'shoes','shoe','#F0F2F6');
Cw('s_climb',    'Climbing Boots',     3,'shoes','boot','#5A4A3C');
/* --- capes --- */
Cw('c_hero',     'Heroman Cape',       3,'cape','hero','#C4383C');
Cw('c_vamp',     'Vampire Cape',       4,'cape','vampire','#241820');
Cw('c_shadow',   'Cape of Shadows',    4,'cape','shadow','#1E1E28');
Cw('c_tatter',   'Cape Tatters',       3,'cape','tattered','#5A5048');
Cw('c_crystal',  'Crystal Cape',       5,'cape','crystal','#9FE8F0',
   {cemis:0.35,value:5200});
Cw('c_blanket',  'Blanket Cape',       2,'cape','blanket','#C4A87C');
/* --- worn on the back --- */
Cw('b_ruck',     'Backpack',           2,'back','rucksack','#5A6A4A');
Cw('b_jet',      'Jetpack',            4,'back','jetpack','#8E96A4',
   {cemis:0.4});
Cw('b_astro',    'Astronaut Pack',     5,'back','astronaut','#EAEEF4',
   {value:4600});
Cw('b_quiver',   'Quiver',             2,'back','quiver','#6A4A30');
Cw('b_guitar',   'Bass Guitar',        3,'back','guitar','#8A3A2E');
Cw('b_basket',   'Wicker Basket',      1,'back','basket','#C8A070');
Cw('b_ecto',     'Ecto Pack',          5,'back','ecto','#5A6470',
   {cemis:0.5,value:5400});
/* --- wings --- */
Cw('w_rainbow',  'Rainbow Wings',      5,'wings','rainbow','#FFFFFF',
   {cemis:0.4,value:5600});
Cw('w_phoenix',  'Phoenix Wings',      6,'wings','phoenix','#FFFFFF',
   {cemis:0.9,value:12000});
Cw('w_devil',    'Devil Wings',        4,'wings','devil','#2A1A22');
Cw('w_bubble',   'Bubble Wings',       3,'wings','bubble','#BEE0F0',
   {cemis:0.2});
Cw('w_parrot',   'Parrot Wings',       4,'wings','parrot','#FFFFFF');
Cw('w_jetw',     'Rocket Thruster',    4,'wings','jet','#8E96A4',{cemis:0.5});
/* --- pets --- */
Cw('p_bunny',    'Cuddly Bunny',       3,'pet','bunny','#F4F0EC');
Cw('p_slime',    'Pet Slime',          3,'pet','slime','#6FD86A',{cemis:0.3});
Cw('p_puppy',    'Puppy Leash',        3,'pet','puppy','#C09858');
Cw('p_dragon',   'Tiny Dragon',        5,'pet','dragon','#4E9A5C',{value:6400});
Cw('p_penguin',  'Penguin Leash',      4,'pet','penguin','#2E3440');
Cw('p_gull',     'Seagull',            2,'pet','seagull','#F0F0F4');
/* --- auras --- */
Cw('au_gold',    'Golden Aura',        6,'aura','motes','#F5C93C',
   {cemis:1,value:10500});
Cw('au_black',   'Black Aura',         6,'aura','pillar','#7A4BD8',
   {cemis:1,value:11500});

/* ---------------- held ---------------- */
Tl('pick_gold',  'Golden Pickaxe',     5,3.4,3,{value:4200});
Tl('spade',      "Digger's Spade",     2,1.5,1,{style:'shovel'});
Tl('hammer_big', 'Rock Hammer',        3,2.1,2,{style:'hammer'});
Tl('flash',      'Flashlight',         2,1.0,1,{style:'flashlight'});
Wp('sword_gold', 'Golden Sword',       5,26,{value:4600});
Wp('bat',        'Baseball Bat',       2,11,{style:'hammer'});
Wp('bow_elvish', 'Elvish Longbow',     4,19,{style:'bow'});
Wp('staff_em',   'Emerald Staff',      4,20,{style:'staff'});
Wp('wand_fire',  'Fire Wand',          4,18,{style:'wand'});
Wp('wand_freeze','Freeze Wand',        4,16,{style:'wand'});
Wp('shield_w',   "Warrior's Shield",   3,8,{style:'shield'});
Wp('umbrella',   'Parasol',            2,6,{style:'umbrella'});

/* ---------------- furniture ----------------
   Placeable objects with a silhouette rather than a cube: the icon
   painter and the voxel mesher both switch on `shape`, so a lamp
   stands, a fence runs and a pot holds a plant without any of them
   needing a special case. */
Fn('bed',        'Bed',           2,'fabric', '#C4566E',{shape:'slab'});
Fn('couch',      'Couch',         2,'fabric', '#4A6E8A',{shape:'slab'});
Fn('tv',         'Television',    3,'panel',  '#2A2E36',{shape:'pane'});
Fn('flatscreen', 'Flatscreen TV', 4,'panel',  '#1E2228',{shape:'pane'});
Fn('fridge',     'Refrigerator',  3,'panelw', '#E6ECF2',{shape:'pillar'});
Fn('stove',      'Stove',         2,'panel',  '#8E96A4');
Fn('sink',       'Sink',          2,'panelw', '#E6ECF2',{shape:'slab'});
Fn('bathtub',    'Bathtub',       3,'panelw', '#F0F4F8',{shape:'slab'});
Fn('toilet',     'Toilet',        1,'panelw', '#F0F4F8',{shape:'slab'});
Fn('bookcase',   'Bookcase',      2,'planks', '#8A5E38',{shape:'pane'});
Fn('dresser',    'Dresser',       2,'planks', '#A4794E');
Fn('wallclock',  'Wall Clock',    2,'panelw', '#F0F0F4',{shape:'pane'});
Fn('fireplace',  'Fireplace',     3,'brick',  '#C46A54',{emis:0.42});
Fn('chandelier', 'Chandelier',    4,'gold',   '#F5C93C',{shape:'lamp',emis:0.62});
Fn('streetlamp', 'Streetlamp',    2,'panel',  '#6E7684',{shape:'lamp',emis:0.55});
Fn('tikitorch',  'Tiki Torch',    2,'bark',   '#8A6242',{shape:'lamp',emis:0.70});
Fn('lantern_f',  'Chinese Lantern',3,'fabric','#D8484C',{shape:'lamp',emis:0.66});
Fn('candle',     'Giant Candle',  2,'fabricw','#F4EEDC',{shape:'pillar',emis:0.58});
Fn('picket',     'Picket Fence',  1,'planks', '#F0F0F4',{shape:'fence'});
Fn('rustic',     'Rustic Fence',  1,'bark',   '#8A6242',{shape:'fence'});
Fn('hedge',      'Hedge',         1,'foliage','#4E8A3C',{shape:'fence'});
Fn('velvetrope', 'Velvet Rope',   3,'fabric', '#8A2E44',{shape:'fence'});
Fn('pot',        'Terracotta Pot',1,'brick',  '#C4764C',{shape:'plant'});
Fn('daisy',      'Potted Daisy',  1,'foliage','#F0E86A',{shape:'plant'});
Fn('rose',       'Rose',          1,'foliage','#E04B62',{shape:'plant'});
Fn('poppy',      'Poppy',         1,'foliage','#E8583C',{shape:'plant'});
Fn('mushroom',   'Mushroom',      1,'foliage','#E8A0A0',{shape:'plant'});
Fn('cactus',     'Cactus',        2,'foliage','#4E9A5C',{shape:'plant'});
Fn('sapling',    'Sequoia Sapling',2,'foliage','#3C7A44',{shape:'plant'});
Fn('vine',       'Climbing Vine', 1,'foliage','#4E8A3C',{shape:'pane'});
Fn('cobweb',     'Cobweb',        2,'fabricw','#DCE0E8',{shape:'pane'});
Fn('mailbox',    'Mailbox',       1,'panel',  '#4A78C8',{shape:'pillar'});
Fn('signpost',   'Street Sign',   1,'panel',  '#8E96A4',{shape:'pillar'});
Fn('barrel',     'Barrel',        1,'planks', '#8A5E38',{shape:'pillar'});
Fn('forge',      'Forge',         4,'brick',  '#A4523C',{emis:0.50});
Fn('cauldron',   'Cauldron',      3,'panel',  '#3A3E48',{shape:'pillar'});
Fn('fishtank',   'Fish Tank',     3,'glass',  '#7FD4F0',{emis:0.20});
Fn('jukebox',    'Boombox',       3,'panel',  '#3A4048',{emis:0.24});
Fn('discoball',  'Disco Ball',    4,'crystal','#DCE8F4',{shape:'lamp',emis:0.72});
Fn('trophycase', 'Display Box',   3,'glass',  '#CFE4F0');
Fn('mannequin',  'Mannequin',     3,'panelw', '#E0E4EA',{shape:'pillar'});
Fn('cashreg',    'Cash Register', 2,'panel',  '#4A5460');
Fn('vending',    'Vending Machine',3,'panel', '#C4383C',{emis:0.28});
Fn('cannon',     'Cannon',        4,'panel',  '#3A3E48',{shape:'pillar'});
Fn('tombstone',  'Tombstone',     2,'stone',  '#9AA0A8',{shape:'slab'});
Fn('jacko',      "Jack O' Lantern",3,'foliage','#F0902C',{emis:0.55});
Fn('campfire',   'Campfire',      2,'bark',   '#C4562E',{shape:'plant',emis:0.66});
Fn('crystalgate','Crystal Gate',  5,'crystal','#9FE8F0',{shape:'pane',emis:0.44,
  value:5200});

/* ---------------- food ----------------
   Growtopia's kitchen is one of the reasons its worlds feel lived in:
   an oven, a board, and twenty things you can leave on a table. */
function Fd(key,name,r,heal,o){
  o=o||{};o.cat='consumable';o.r=r;o.consumable=true;
  o.props={heal:heal};
  if(o.buff){o.props.buff=o.buff;o.props.dur=o.dur||60;}
  return It(key,name,o);
}
Fd('food_pie',    'Blueberry Pie',   2,45,{recipe:[['blueberry',2]]});
Fd('food_applepie','Apple Pie',      2,45);
Fd('food_muffin', 'Blueberry Muffin',1,26);
Fd('food_pizza',  'Pizza',           3,70);
Fd('food_burger', 'Cheeseburger',    3,68);
Fd('food_taco',   'Fish Taco',       2,48);
Fd('food_maki',   'Maki Roll',       3,62);
Fd('food_sushi',  'Tamago Sushi',    3,58);
Fd('food_chips',  'Fish And Chips',  2,52);
Fd('food_eggs',   'Eggs Benedict',   3,66);
Fd('food_habanero','Habanero Cheese Bread',3,60,{buff:'damage'});
Fd('food_churro', 'Churro',          1,22);
Fd('food_burrito','Burrito',         2,50);
Fd('food_cake',   'Layer Cake',      3,72);
Fd('food_mooncake','Harmony Mooncake',4,84,{buff:'luck'});
Fd('food_snowcone','Snowcone',       1,20);
Fd('drink_coffee','Coffee',          2,18,{buff:'speed',dur:90});
Fd('drink_choc',  'Hot Chocolate',   2,30);
Fd('drink_juice', 'Pineapple Juice', 2,28);
Fd('drink_milk',  'Milk',            1,16);
Fd('drink_rootbeer','Root Beer',     1,18);
Fd('food_honey',  'Honey',           2,26);
Fd('food_lolly',  'Lollipop',        1,14);
Fd('food_candy',  'Candy Corn',      1,12);
Fd('food_gum',    'Bubble Gum',      1,10);
Fd('food_apple',  'Apple',           1,18);
Fd('food_goldapple','Golden Apple',  5,120,{buff:'luck',dur:180,value:2400});

/* ---------------- collectibles ----------------
   No use, and that is the use. Something to have. */
function Co(key,name,r,o){
  o=o||{};o.cat='collectible';o.r=r;o.placeable=false;
  return It(key,name,o);
}
Co('col_shell',   'Spiral Shell',      1);
Co('col_coral',   'Coral',             2);
Co('col_pearl',   'Black Pearl',       4);
Co('col_fossil',  'Fossil',            3);
Co('col_amber',   'Amber With A Fly In It',4);
Co('col_trex',    'T-Rex Skull',       5,{value:4800});
Co('col_idol',    'Silver Idol',       4);
Co('col_obelisk', 'Broken Obelisk',    3);
Co('col_clover',  'Lucky Clover',      3);
Co('col_horseshoe','Lucky Horseshoe',  3);
Co('col_rabbitfoot',"Rabbit's Foot",   3);
Co('col_coin',    'Flipping Coin',     2);
Co('col_ticket',  'Golden Ticket',     4);
Co('col_growtoken','Growtoken',        5,{value:6000});
Co('col_skull',   'Crystal Skull',     5,{value:5400});
Co('col_orb',     'Legendary Orb',     6,{value:12000});
Co('col_snowglobe','Snow Globe',       3);
Co('col_ducky',   'Rubber Ducky',      1);
Co('col_teddy',   'Teddy Bear',        2);
Co('col_globe',   'Globe',             2);

/* ---------------- consumables ---------------- */
It('food_bread',  'Harbour Loaf', {cat:'consumable',r:1,consumable:true,value:12,
  props:{heal:20},recipe:[['fibre',2]]});
It('food_stew',   'Fish Stew',    {cat:'consumable',r:2,consumable:true,value:38,
  props:{heal:55},recipe:[['f_cod',1],['fibre',2]]});
It('food_feast',  'Angler Feast', {cat:'consumable',r:4,consumable:true,value:220,
  props:{heal:100,buff:'luck'},recipe:[['f_tuna',1],['food_stew',1]]});
It('tonic_swift', 'Swift Tonic',  {cat:'consumable',r:3,consumable:true,value:120,
  props:{buff:'speed',dur:60}});
It('tonic_might', 'Might Tonic',  {cat:'consumable',r:3,consumable:true,value:120,
  props:{buff:'damage',dur:60}});

/* ---------------- keys and quest items ---------------- */
It('key_plot',   'Plot Deed',    {cat:'quest',r:3,tradeable:false,value:0,
  desc:'Claims one building plot as your own.'});
It('key_vault',  'Vault Key',    {cat:'quest',r:4,tradeable:false,value:0});
It('lens_old',   'Clouded Lens', {cat:'quest',r:3,tradeable:false,value:0,
  desc:'Found in the old facility. Someone was looking for something.'});

/* ---------------- lookup ---------------- */
D.ITEMS=ITEMS;D.ID=ID;D.BY_CAT=BY_CAT;
D.byKey=function(k){var i=ID[k];return i===undefined?null:ITEMS[i];};
D.byId=function(i){return ITEMS[i]||null;};
D.count=function(){return ITEMS.length;};
D.inCat=function(c){return BY_CAT[c]||[];};
D.rarityCol=function(r){return D.RARITY_COL[M.clamp(r|0,1,6)];};

/* ---------------- outfits ----------------
   A shop that lists thirty-seven cosmetics sorted by price is a
   spreadsheet. What makes a wardrobe worth browsing is somebody
   having decided which three things go together, given the result a
   name, and put a price on the whole of it.

   So: named sets, drawn from items that already exist, each one a
   look somebody in the harbour actually has. The discount is the
   reason to buy the set rather than the pieces, and it is small
   enough that picking your own three is still a reasonable thing to
   do.

   A set is premium if every piece in it is, so a purchase is never
   half coins and half shards. Sets live here rather than in the UI
   because the server prices them, and the server will not read a
   price the client sent it. */
function Set_(key,name,blurb,items,off){
  var prem=items.every(function(k){
    var it=D.byKey(k);return it&&it.rarity>=5;
  });
  return {key:key,name:name,blurb:blurb,items:items,off:off,premium:prem};
}
D.SETS=[
  Set_('set_dock','Dockhand',
    'What half the harbour is wearing by eight in the morning.',
    ['hat_cap','t_hoodie','b_satchel'],0.15),
  Set_('set_survey','Field Survey',
    'For the ones who go inland and write down what they find.',
    ['hat_brim','t_jacket','p_drone'],0.15),
  Set_('set_night','Nightwing',
    'The look the night warden gets asked about most.',
    ['h_spike','c_plain','w_bat'],0.15),
  Set_('set_warden','Lumen Warden',
    'Everything on it glows. That is the entire point.',
    ['hat_visor','w_mech','a_ring'],0.15),
  Set_('set_sovereign','Sovereign',
    'Gold, and the confidence to wear it in a fishing town.',
    ['hat_crown','c_royal','a_motes'],0.10),
  Set_('set_ascendant','Ascendant',
    'Three things that were never made on this island.',
    ['hat_halo','w_angel','p_sprite'],0.10)
];
D.setByKey=function(k){
  for(var i=0;i<D.SETS.length;i++)if(D.SETS[i].key===k)return D.SETS[i];
  return null;
};
/* Full price, and the price of the pieces you are actually missing.
   Owning one of three should cost you two thirds, not deny you the
   discount and not charge you again for the hat on your head. */
D.setPrice=function(set,ownedFn){
  var list=0,due=0,need=[];
  for(var i=0;i<set.items.length;i++){
    var it=D.byKey(set.items[i]);
    if(!it)continue;
    var c=D.buyPrice(it);
    list+=c;
    if(!ownedFn||!ownedFn(set.items[i])){due+=c;need.push(set.items[i]);}
  }
  var full=Math.round(list*(1-set.off));
  due=Math.round(due*(1-set.off));
  if(set.premium){
    list=Math.ceil(list/40);full=Math.ceil(full/40);due=Math.ceil(due/40);
  }
  /* `list` is what the three pieces cost bought separately, `full` the
     whole set, `due` the part of it you do not already own. The shop
     strikes through the first and charges the last. */
  return {list:list,full:full,due:due,need:need,
          cur:set.premium?'shards':'coins'};
};


/* Fish are looked up by the water they were caught in, weighted so the
   good ones stay rare no matter how long you stand there. */
D.fishIn=function(zone){
  var out=[];
  var col=BY_CAT.collectible||[];
  for(var i=0;i<col.length;i++){
    var it=col[i];
    if(it.props&&it.props.fish&&it.props.zone===zone)out.push(it);
  }
  return out;
};

/* What a block yields when broken. Defaults to itself, which is what
   a sandbox wants: what you place, you get back. */
D.dropsOf=function(it){
  if(it.drops)return it.drops;
  return [[it.key,1]];
};

/* Sale and purchase both derive from `value`, so a shop can never
   drift out of step with the trade window. */
D.buyPrice=function(it){return Math.max(1,Math.round(it.value*1.35));};
D.sellPrice=function(it){return Math.max(1,Math.round(it.value*0.55));};
/* A fish is worth what it weighs, which is why anglers care. */
D.fishValue=function(it,weight){
  var w=it.props&&it.props.w;
  if(!w)return it.value;
  var t=M.clamp((weight-w[0])/Math.max(0.001,w[1]-w[0]),0,1);
  return Math.max(1,Math.round(it.value*(0.55+t*1.30)));
};

LH.Data=D;
})();


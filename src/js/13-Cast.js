/* ============================================================
   LH.Cast — the people, designed one at a time.

   Everything before this file gives a character a vocabulary: eleven
   hairstyles, ten hats, seven occupational layers, twelve things to
   hold. None of that is a character. A character is one specific set
   of those choices, made on purpose, and readable as a silhouette
   before you are close enough to see a face.

   So each entry here is written to a single sentence of intent, kept
   in `note`, and every field under it exists to serve that sentence.
   Where a choice fights the sentence it loses, even when it would
   look nicer on its own.

   The three rules the whole table obeys:

     1. Silhouette first. Two residents must be distinguishable in
        black at twenty metres. That is why nobody shares a headwear
        shape, and why height varies by up to fourteen centimetres.
     2. One loud colour each, and it belongs to that person. Mira has
        the teal, Dell the safety orange, Bao the gold. Nobody else
        may use it as their loud colour.
     3. The job is worn, not stated. A harness full of clips says
        quarry foreman without a nameplate; the nameplate is a
        fallback for players who are already close.
   ============================================================ */
(function(){
'use strict';
var Act=LH.Actors,Cast={};

/* Shallow-merge one level deep, because every kit field is either a
   scalar or a flat {style,color} pair and a full deep clone would
   quietly share the palette arrays between actors. */
function apply(kit,spec){
  for(var k in spec){
    var v=spec[k];
    if(v&&typeof v==='object'&&!(v instanceof Array)){
      if(!kit[k])kit[k]={};
      for(var j in v)kit[k][j]=v[j];
    }else kit[k]=v;
  }
  return kit;
}

/* ---------------- the named residents ----------------
   Keyed by the id LH.Quests already uses, so the quest table stays the
   single source of who exists and this file only says what they look
   like. */
var NAMED={
  harbourmaster:{
    note:'Thirty years of weather in one coat. The tallest and the '+
         'stillest person on the island; everything about her is '+
         'vertical, and the lantern is the only warm thing she owns.',
    scale:1.07, build:'base',
    skin:'#C08055', eye:'#93A7B2',
    hair:{style:'locs',color:'#6B675F'},
    hat:{style:'tricorn',color:'#1B3038'},
    over:{style:'oilskin',color:'#1D6570'},
    shirt:{style:'tee',color:'#D9CDB6',sleeve:'long'},
    pants:{style:'long',color:'#26313A',leg:'long'},
    shoes:{style:'boot',color:'#3A2C21'},
    tool:{style:'lantern',color:'#C79A4B'}
  },
  foreman:{
    note:'Built like the rock he takes down. Widest silhouette in the '+
         'game, goggles pushed up because he has just stopped work, '+
         'and every strap on him is carrying something.',
    scale:1.11, build:'bulk',
    skin:'#6E4128', eye:'#4A2E1C',
    hair:{style:'crop',color:'#191512'},
    facial:{style:'beard'},
    hat:{style:'hardhat',color:'#F09A32'},
    acc:{style:'goggles',color:'#59626F'},
    over:{style:'harness',color:'#4B3B2C'},
    shirt:{style:'tee',color:'#DFE4E9',sleeve:'short'},
    pants:{style:'long',color:'#3C4653',leg:'long'},
    shoes:{style:'boot',color:'#2B2723'},
    tool:{style:'pickaxe',color:'#9AA2AE'}
  },
  clerk:{
    note:'Precise to the millimetre. Narrow, upright, plum stole over '+
         'a charcoal jacket, and she never puts the ledger down — not '+
         'to talk to you, not to point at anything.',
    scale:0.97, build:'slim',
    skin:'#F0C6A0', eye:'#4E6B3A',
    hair:{style:'bun',color:'#33241A'},
    acc:{style:'specs',color:'#4C5460'},
    over:{style:'stole',color:'#6D3D79'},
    shirt:{style:'jacket',color:'#2B3142',sleeve:'long'},
    pants:{style:'long',color:'#262B36',leg:'long'},
    shoes:{style:'shoe',color:'#1D2029'},
    tool:{style:'ledger',color:'#77502E'}
  },
  warden:{
    note:'The one person here who has already lost something to the '+
         'old works. Asymmetric on purpose — one shoulder plated, one '+
         'eye covered, the coat closed across the body.',
    scale:1.05, build:'base',
    skin:'#DFA97E', eye:'#39414C',
    hair:{style:'undercut',color:'#8B8478'},
    facial:{style:'stubble'},
    acc:{style:'eyepatch',color:'#20242B'},
    over:{style:'longcoat',color:'#35604A'},
    shirt:{style:'tee',color:'#39404A',sleeve:'long'},
    pants:{style:'long',color:'#262A33',leg:'long'},
    shoes:{style:'boot',color:'#1B1D24'},
    tool:{style:'sword',color:'#B4BAC5'}
  },
  merchant:{
    note:'Round, quick, permanently mid-transaction. The gold apron is '+
         'the loudest thing on the island and it is deliberate — you '+
         'are supposed to spot the market from the harbour road.',
    scale:0.96, build:'bulk',
    skin:'#E0A87D', eye:'#6B4A2C',
    /* A bun, not the topknot it started as: a knot on the crown comes
       straight up through the flat cap and reads as a lollipop. */
    hair:{style:'bun',color:'#211A14'},
    hat:{style:'flatcap',color:'#8C382A'},
    acc:{style:'earrings',color:'#E8C46A'},
    over:{style:'apron',color:'#E2B547'},
    shirt:{style:'tee',color:'#AE372F',sleeve:'short'},
    pants:{style:'long',color:'#463629',leg:'long'},
    shoes:{style:'shoe',color:'#372B21'},
    tool:{style:'scales',color:'#D9B14A'},
    pet:{style:'cat',color:'#E8DCC6'}
  },
  mechanic:{
    note:'Covered in a job that is not finished. Boiler-suit blue from '+
         'collar to boot so the orange goggles and the drone are the '+
         'only things your eye lands on.',
    scale:1.00, build:'base',
    skin:'#C98B62', eye:'#4A7FB5',
    hair:{style:'ponytail',color:'#7B3220'},
    acc:{style:'goggles',color:'#E8863C'},
    over:{style:'toolbelt',color:'#4A3B2E'},
    shirt:{style:'tee',color:'#2E6E86',sleeve:'long'},
    pants:{style:'long',color:'#2E6E86',leg:'long'},
    shoes:{style:'boot',color:'#2A2E36'},
    tool:{style:'wrench',color:'#98A2B0'},
    pet:{style:'drone',color:'#5FD8FF'}
  }
};
Cast.NAMED=NAMED;
Cast.names=function(){return Object.keys(NAMED);};

/* ---------------- starter looks ----------------
   The character screen used to open on a set of sliders, which is a
   fine way to make one person and a terrible way to make a first
   impression. It opens on these instead: six finished characters, each
   still fully editable afterwards.

   They are deliberately not the residents. Standing next to the person
   you were modelled on is the one thing that makes a preset feel
   cheap. */
var PRESETS=[
  {id:'dockrunner',name:'Dock Runner',
   note:'Fast and unbothered. Bare arms, rolled hems, salt-bleached.',
   scale:0.99,build:'slim',skin:'#E3AE83',eye:'#4A7FB5',
   hair:{style:'curls',color:'#3A2A1C'},
   acc:{style:'bandana',color:'#F2705C'},
   shirt:{style:'tee',color:'#F2705C',sleeve:'short'},
   pants:{style:'long',color:'#2F5FA8',leg:'shorts'},
   shoes:{style:'shoe',color:'#F0E4D2'}},
  {id:'quarryhand',name:'Quarry Hand',
   note:'New on the face, borrowed hat, everything a size too big.',
   scale:1.04,build:'bulk',skin:'#9C6242',eye:'#5A3A22',
   hair:{style:'crop',color:'#20180F'},
   facial:{style:'goatee'},
   hat:{style:'hardhat',color:'#E9D14A'},
   over:{style:'harness',color:'#54422F'},
   shirt:{style:'tee',color:'#7E8894',sleeve:'long'},
   pants:{style:'long',color:'#3E4652',leg:'long'},
   shoes:{style:'boot',color:'#2B2723'}},
  {id:'skycourier',name:'Sky Courier',
   note:'Everything cut close so nothing catches the wind.',
   scale:0.98,build:'slim',skin:'#F2C9A4',eye:'#5C4B8A',
   hair:{style:'undercut',color:'#B8D8E8'},
   acc:{style:'goggles',color:'#7BE0C8'},
   shirt:{style:'jacket',color:'#2A3350',sleeve:'long'},
   pants:{style:'long',color:'#1F2740',leg:'long'},
   shoes:{style:'boot',color:'#2A3350'},
   wings:{style:'crystal',color:'#7BE0C8'},
   back:{style:'satchel',color:'#C4703C'}},
  {id:'nightwarden',name:'Night Warden',
   note:'Off duty, still armoured. Reads as a shape before a person.',
   scale:1.06,build:'base',skin:'#75462C',eye:'#3A3F4A',
   hair:{style:'locs',color:'#141210'},
   facial:{style:'stubble'},
   over:{style:'pauldron',color:'#5A6472'},
   shirt:{style:'hoodie',color:'#33384A',sleeve:'long'},
   pants:{style:'long',color:'#23273A',leg:'long'},
   shoes:{style:'boot',color:'#1A1D26'},
   cape:{style:'plain',color:'#7C2B3E'},
   tool:{style:'torch',color:'#C08A50'}},
  {id:'marketkid',name:'Market Kid',
   note:'Loudest palette in the roster, and the smallest silhouette.',
   scale:0.92,build:'base',skin:'#FBDCC0',eye:'#4E6B3A',
   hair:{style:'afro',color:'#2A1E16'},
   acc:{style:'earrings',color:'#F0CC6A'},
   over:{style:'apron',color:'#4FD08A'},
   shirt:{style:'tee',color:'#FFC93C',sleeve:'short'},
   pants:{style:'long',color:'#C4573C',leg:'shorts'},
   shoes:{style:'shoe',color:'#3E7A5E'},
   pet:{style:'cat',color:'#3A3026'}},
  {id:'fieldbotanist',name:'Field Botanist',
   note:'Sun hat, spectacles, a coat with too many pockets.',
   scale:1.01,build:'base',skin:'#C98B62',eye:'#4E6B3A',
   hair:{style:'ponytail',color:'#6E5230'},
   acc:{style:'specs',color:'#8A7A5E'},
   hat:{style:'headwrap',color:'#E4D9B4'},
   over:{style:'apron',color:'#8FA86A'},
   shirt:{style:'tee',color:'#F0EAD8',sleeve:'long'},
   pants:{style:'long',color:'#6E6248',leg:'long'},
   shoes:{style:'boot',color:'#4A3C2A'},
   pet:{style:'sprite',color:'#B8E86A'}}
];
Cast.PRESETS=PRESETS;

/* Build a full kit. The base is always LH.Actors.defaultKit so a new
   slot added there appears on every character without touching this
   table — the seed only matters for the fields a spec leaves alone. */
Cast.kit=function(spec,seed){
  var kit=Act.defaultKit(seed||1);
  if(typeof spec==='string')
    spec=NAMED[spec]||Cast.preset(spec);
  if(!spec)return kit;
  apply(kit,spec);
  /* `note` is documentation, not a kit field, and `id`/`name` belong to
     the roster rather than the body. Strip them so nothing downstream
     has to know they were ever here. */
  delete kit.note;delete kit.id;delete kit.name;
  return kit;
};
Cast.preset=function(id){
  for(var i=0;i<PRESETS.length;i++)if(PRESETS[i].id===id)return PRESETS[i];
  return null;
};

/* ---------------- the crowd ----------------
   Residents nobody wrote. They draw from the same wardrobe but are
   assembled by a rule rather than by hand, so they read as a
   population instead of six clones: one loud garment each, everything
   else pulled down to agree with it.

   Deterministic in `seed` — the person you saw by the fountain has to
   still be that person the next time the harbour loads. */
var CROWD_HAIR=['crop','swept','long','bun','spiked','braids','locs',
                'undercut','ponytail','afro','curls','topknot'];
var CROWD_HAT =['none','none','none','cap','beanie','brim','flatcap',
                'headwrap','visor'];
var CROWD_ACC =['none','none','none','none','specs','goggles','earrings',
                'bandana'];
var CROWD_OVER=['none','none','none','none','none','apron','toolbelt',
                'harness','stole','pauldron'];
var CROWD_FACE=['none','none','none','none','stubble','beard','goatee',
                'moustache'];
var SKIN=['#FBDCC0','#F2C9A4','#E3AE83','#C98B62','#9C6242','#75462C',
          '#54321F'];
var HAIRC=['#241C16','#3A2A1C','#5A3A22','#7A5230','#A87740','#D8B978',
           '#8E3B2E','#2A2E3A','#8B8478','#B8D8E8','#7B3220','#3E5A4A'];
var EYEC=['#5C9EDC','#5FA86A','#A87A46','#4E5A6E','#8A6ED8','#93B7C2'];
/* One saturated garment colour per person. Neighbouring entries are
   kept far apart in hue so two people picked in a row rarely match. */
var LOUD=['#FF6B5B','#4FA8FF','#4FD08A','#FFB84D','#C08BFF','#4FE3B0',
          '#FF8FC7','#FFE066','#FF8A4C','#7FA8FF','#E2585E','#3EC7B4'];

Cast.crowd=function(seed){
  /* Scattered and warmed — see LH.Actors.kitRng. A raw M.rng here gave
     twelve residents the same red shirt, because every small seed's
     first draw lands in the first entry of every palette. */
  var rng=Act.kitRng(seed);
  var kit=Act.defaultKit(seed);
  var loud=LOUD[(rng()*LOUD.length)|0];
  kit.scale=0.90+rng()*0.20;
  kit.build=rng()<0.22?'bulk':(rng()<0.26?'slim':'base');
  kit.skin=SKIN[(rng()*SKIN.length)|0];
  kit.eye=EYEC[(rng()*EYEC.length)|0];
  kit.hair.style=CROWD_HAIR[(rng()*CROWD_HAIR.length)|0];
  kit.hair.color=HAIRC[(rng()*HAIRC.length)|0];
  kit.facial.style=rng()<0.30?CROWD_FACE[(rng()*CROWD_FACE.length)|0]:'none';
  kit.hat.style=CROWD_HAT[(rng()*CROWD_HAT.length)|0];
  kit.acc.style=CROWD_ACC[(rng()*CROWD_ACC.length)|0];
  kit.over.style=CROWD_OVER[(rng()*CROWD_OVER.length)|0];
  kit.shirt.style=['tee','jacket','hoodie'][(rng()*3)|0];
  kit.shirt.sleeve=rng()<0.55?'long':'short';
  kit.pants.leg=rng()<0.24?'shorts':'long';
  /* The loud colour lands on exactly one garment. Whichever one it is,
     the rest of the outfit is derived from it rather than rolled, which
     is the difference between an outfit and a bag of colours. */
  if(kit.over.style!=='none'){
    kit.over.color=loud;
    kit.shirt.color=LH.Geo.shade(loud,-58);
    kit.pants.color=LH.Geo.shade(loud,-72);
  }else{
    kit.shirt.color=loud;
    kit.pants.color=LH.Geo.shade(loud,-52);
  }
  kit.hat.color=rng()<0.5?loud:LH.Geo.shade(loud,-46);
  kit.shoes.color=LH.Geo.shade(loud,-70);
  kit.acc.color=rng()<0.4?loud:'#4C5460';
  if(rng()<0.10){
    kit.wings.style=LH.Cos.WINGS[(rng()*LH.Cos.WINGS.length)|0];
    kit.wings.color=loud;
  }
  if(rng()<0.12)kit.pet.style=LH.Cos.PETS[(rng()*LH.Cos.PETS.length)|0];
  if(rng()<0.10){kit.cape.style='plain';kit.cape.color=loud;}
  return kit;
};

LH.Cast=Cast;
})();



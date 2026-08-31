/* ============================================================
   LH.Quests — missions, achievements and the NPCs who hand them out.

   Missions are data, and progress is tracked by *event kind* rather
   than by mission: an activity handler calls track('catch','f_bass',1)
   once, and every mission, achievement and collection that cares
   about catching updates itself. Adding a mission is a table row; it
   never means editing fishing.

   Dailies rotate on a date-derived seed so everyone in the harbour
   gets the same three on the same day — which is the only reason a
   daily is worth talking to anyone about.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,D=LH.Data,Net=LH.Net;
var Q={};

var MISSIONS=[], MID={};

/* goal: [kind, key|null, count]. A null key means "any of that kind",
   which is what lets one row cover "catch five fish" and another
   cover "catch a Bluefin Tuna". */
function Ms(id,name,type,o){
  var m={
    id:id,name:name,type:type,
    desc:o.desc||'',
    goal:o.goal,
    reward:o.reward||{},
    npc:o.npc||null,
    needs:o.needs||null,      /* prerequisite mission id */
    level:o.level||1,
    repeat:type==='daily'||type==='weekly'
  };
  MID[id]=m;MISSIONS.push(m);
  return m;
}

/* ---------------- story ---------------- */
Ms('s_arrive','Find Your Feet','story',{
  npc:'harbourmaster',level:1,
  desc:'Talk to the Harbourmaster and take a look around Lumen Harbor.',
  goal:['talk','harbourmaster',1],
  reward:{coins:60,xp:40,items:[['bait_worm',10]]}});
Ms('s_firstcatch','A Line in the Water','story',{
  npc:'harbourmaster',needs:'s_arrive',level:1,
  desc:'Catch your first fish from the harbour.',
  goal:['catch',null,1],
  reward:{coins:80,xp:70,items:[['rod_oak',1]]}});
Ms('s_firstore','Something Worth Digging','story',{
  npc:'foreman',needs:'s_firstcatch',level:2,
  desc:'Mine anything at the quarry face.',
  goal:['mine',null,3],
  reward:{coins:90,xp:80,items:[['pick_copper',1]]}});
Ms('s_firstplot','Somewhere of Your Own','story',{
  npc:'clerk',needs:'s_firstore',level:3,
  desc:'Claim a building plot and place your first block on it.',
  goal:['place',null,1],
  reward:{coins:150,xp:160,items:[['plank',48],['lantern',6]]}});
Ms('s_firstfight','Keeping the Peace','story',{
  npc:'warden',needs:'s_firstplot',level:4,
  desc:'Deal with three creatures troubling the island.',
  goal:['kill',null,3],
  reward:{coins:180,xp:200,items:[['sword_copper',1]]}});
Ms('s_facility','Something in the Facility','story',{
  npc:'warden',needs:'s_firstfight',level:8,
  desc:'Something has taken up residence in the old quarry works. '+
       'Find out what, and put a stop to it.',
  goal:['kill','guardian',1],
  reward:{coins:1400,xp:900,items:[['lens_old',1],['hat_visor',1]],
          title:'Guardian-Breaker'}});

/* ---------------- dailies ---------------- */
Ms('d_fish5','Fresh Catch','daily',{
  desc:'Catch five fish of any kind.',goal:['catch',null,5],
  reward:{coins:140,xp:110}});
Ms('d_fish_rare','Something Worth Mounting','daily',{
  desc:'Land a rare fish or better.',goal:['catchRare',null,1],
  reward:{coins:320,xp:220,items:[['bait_shrimp',6]]}});
Ms('d_mine20','Working the Face','daily',{
  desc:'Mine twenty pieces of anything.',goal:['mine',null,20],
  reward:{coins:160,xp:130}});
Ms('d_kill10','Pest Control','daily',{
  desc:'Defeat ten creatures.',goal:['kill',null,10],
  reward:{coins:200,xp:170}});
Ms('d_build30','Making Progress','daily',{
  desc:'Place thirty blocks on your own land.',goal:['place',null,30],
  reward:{coins:150,xp:140}});
Ms('d_craft5','At the Bench','daily',{
  desc:'Craft five items.',goal:['craft',null,5],
  reward:{coins:130,xp:120}});
Ms('d_visit','Doing the Rounds','daily',{
  desc:'Visit three districts.',goal:['visit',null,3],
  reward:{coins:110,xp:90}});
Ms('d_sell','Turning a Profit','daily',{
  desc:'Sell fifteen items.',goal:['sell',null,15],
  reward:{coins:180,xp:100}});

/* ---------------- weeklies ---------------- */
Ms('w_angler','The Week’s Angler','weekly',{
  desc:'Catch forty fish.',goal:['catch',null,40],
  reward:{coins:1200,xp:900,items:[['bait_lure',8]]}});
Ms('w_builder','Something Substantial','weekly',{
  desc:'Place three hundred blocks.',goal:['place',null,300],
  reward:{coins:1400,xp:1000,items:[['aurorablock',6]]}});
Ms('w_hunter','Thinning the Woods','weekly',{
  desc:'Defeat sixty creatures.',goal:['kill',null,60],
  reward:{coins:1500,xp:1100,items:[['sword_iron',1]]}});
Ms('w_collector','A Full Case','weekly',{
  desc:'Discover eight different fish.',goal:['discoverFish',null,8],
  reward:{coins:1800,xp:1300,items:[['rod_crystal',1]]}});

Q.MISSIONS=MISSIONS;
Q.byId=function(id){return MID[id]||null;};

/* ---------------- achievements ----------------
   Same tracking, but permanent and never claimed — they fire once and
   stay fired. */
var ACH=[
  ['a_firstfish','First Fish','catch',null,1,{xp:40}],
  ['a_angler','Legendary Angler','catchRare',null,25,{xp:900,items:[['hat_brim',1]]}],
  ['a_lumen','The Lumen Angler','catch','f_lumen',1,{xp:2000,title:'Deep Reader'}],
  ['a_builder','Master Builder','place',null,1000,{xp:1200,items:[['statue',1]]}],
  ['a_quarry','Down to the Rock','mine',null,500,{xp:800}],
  ['a_hunter','Monster Hunter','kill',null,200,{xp:1000}],
  ['a_rich','Millionaire','coins',null,1000000,{xp:4000,title:'Harbour Magnate'}],
  ['a_explorer','World Explorer','visit',null,9,{xp:600,items:[['b_satchel',1]]}],
  ['a_collector','Collector','discoverFish',null,14,{xp:1600,items:[['trophy',1]]}]
];
Q.ACH=ACH;

/* ---------------- daily rotation ----------------
   Seeded from the date so the whole harbour sees the same set. */
function dayIndex(){
  return Math.floor(Date.now()/86400000);
}
function weekIndex(){
  return Math.floor(Date.now()/(86400000*7));
}
function pickRotating(pool,n,seed){
  var rng=M.rng(seed>>>0||1);
  var copy=pool.slice(),out=[];
  while(out.length<n&&copy.length){
    out.push(copy.splice((rng()*copy.length)|0,1)[0]);
  }
  return out;
}
Q.todaysDailies=function(){
  var pool=MISSIONS.filter(function(m){return m.type==='daily';});
  return pickRotating(pool,3,dayIndex()*7919);
};
Q.thisWeek=function(){
  var pool=MISSIONS.filter(function(m){return m.type==='weekly';});
  return pickRotating(pool,2,weekIndex()*104729);
};
Q.dayIndex=dayIndex;
Q.weekIndex=weekIndex;

/* ---------------- NPCs ----------------
   Each one owns a district, a role and a short dialogue. They exist to
   make the systems legible: the person who explains fishing stands
   next to the water. */
var NPCS={
  harbourmaster:{
    name:'Mira Vance',role:'Harbourmaster',at:'harbour',
    lines:[
      'You are new. Everyone here was, once.',
      'The harbour will feed you if you let it. Rod, bait, patience.',
      'Big ones run. Let them. The line only breaks if you argue.'
    ],
    offer:'Take a rod down to the jetty and see what bites.'
  },
  foreman:{
    name:'Dell Okonjo',role:'Quarry Foreman',at:'quarry',
    lines:[
      'Mind the face. It comes down when it feels like it.',
      'Copper near the surface, iron under that. Deeper is better and worse.',
      'A better pick opens new rock. It does not just dig faster.'
    ],
    offer:'Bring me anything you pull out of that face.'
  },
  clerk:{
    name:'Rosalind Ash',role:'Land Registry',at:'plots',
    lines:[
      'Every plot on this island is on my ledger. Yours could be.',
      'First one is free. The island would rather you built than not.',
      'Build what you like. I only record that it is yours.'
    ],
    offer:'Claim a plot at the marker and put something on it.'
  },
  warden:{
    name:'Ivo Karr',role:'Warden',at:'missions',
    lines:[
      'Something walked out of the old works last month. It has not walked back.',
      'The slimes are harmless. The shades are not. Learn the difference early.',
      'Do not go up to the quarry alone until you can handle what is down here.'
    ],
    offer:'Clear a few of the ones near the road and we will talk again.'
  },
  merchant:{
    name:'Bao Ling',role:'Market Trader',at:'market',
    lines:[
      'Everything has a price. Most of them are mine.',
      'I buy what you dig, catch or break. I sell what you have not found yet.',
      'Rare things are rare because they are rare. I do not set that part.'
    ],
    offer:'Bring me your catch and your ore.'
  },
  mechanic:{
    name:'Tess Aurelio',role:'Garage',at:'garage',
    lines:[
      'The island is small until you have to cross it on foot.',
      'I am still building the first one. Come back when it runs.',
      'Anything with wheels beats anything with legs. Do not quote me.'
    ],
    offer:'Nothing running yet. Soon.'
  }
};
Q.NPCS=NPCS;
Q.npcList=function(){return Object.keys(NPCS);};

LH.Quests=Q;
})();


/* ============================================================
   LH.Game — the assembly point.

   Boot stages, the frame loop's game half, and the draw order. This
   is the only file section that knows about all the others.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,GL=LH.GL,R=LH.Render,App=LH.App,Cam=LH.Cam,Geo=LH.Geo;
var T=LH.Terrain,W=LH.World,P=LH.Props,Act=LH.Actors,I=LH.Input,Pl=LH.Player,Sky=LH.Sky;
var Cast=LH.Cast;
var V=LH.Voxels,D=LH.Data,Net=LH.Net,UI=LH.UI,Icon=LH.Icon;
var En=LH.Enemies,Fish=LH.Fishing,Quests=LH.Quests,Realm=LH.Realm;
var Aud=LH.Audio,Front=LH.Front;
var G={};

G.player=null;
G.crowd=[];
G.ready=false;
G.aim={hit:false,x:0,y:0,z:0,mode:'none',target:null};
G.entered=false;

/* ---------------- boot ---------------- */
App.stage('Painting surfaces',function(){
  LH.Tex.buildAll();
});
App.stage('Raising the island',function(){
  T.generate();
});
App.stage('Cutting the coastline',function(){
  T.buildChunks();
});
App.stage('Building Lumen Harbor',function(){
  W.build();
});
App.stage('Opening the interface',function(){
  UI.init();
  /* Warm the icon cache for everything the player starts with, so the
     first frame of the hotbar is not a set of empty squares. */
  var st=Net.snapshot();
  for(var k in st.inv)Icon.of(k);
});
/* The rig asks the world how high the ground is; this is the whole of
   that contract — nothing in LH.Rig has to know what a world is. */
Act.groundAt=function(x,z){return W.groundAt(x,z);};

App.stage('Waking the harbour',function(){
  var spawn=W.spawn;
  /* You arrive as the Dock Runner. It is a designed look rather than
     a default one, so the first thing on screen is a character — and
     it is the first entry in the same preset list the wardrobe
     offers, so changing it is one click, not a rebuild. */
  var kit=Cast.kit('dockrunner',7);
  G.player=Act.Actor({x:spawn[0],y:spawn[1],z:spawn[2],kit:kit,name:'You'});
  G.rememberLook();
  Pl.init(G.player);

  /* Simulated residents. There is no server behind them — they walk a
     patrol, and the crowd is honest fiction until there is one. */
  var NAMES=['Skylar','Zenn','Mochi','Noctis','Lumi','Kestrel','Vale',
             'Orin','Sable','Wren','Pico','Juno'];
  var rng=M.rng(4242);
  for(var i=0;i<12;i++){
    var pt=[T.pad('plaza'),T.pad('market'),T.pad('harbour')][i%3];
    var a=rng()*M.TAU,rr=6+rng()*14;
    var x=pt.x+Math.cos(a)*rr, z=pt.z+Math.sin(a)*rr;
    /* Dressed by LH.Cast, not here: the rule that keeps a crowd from
       looking like a colour test lives with the rest of the wardrobe
       decisions rather than in the spawner. */
    var k=Cast.crowd(i*31+5);
    var npc=Act.Actor({x:x,y:T.heightAt(x,z),z:z,kit:k,
      name:NAMES[i%NAMES.length],facing:rng()*M.TAU});
    npc.home=[pt.x,pt.z];
    npc.wander=[x,z];
    npc.wait=rng()*4;
    npc.speed=1.5+rng()*0.9;
    G.crowd.push(npc);
  }
  /* The named residents. Each stands in the district their role
     belongs to, so the person who explains fishing is beside the
     water and the land registry is on the plots. */
  G.npcs=[];
  var NPCSPOT={
    harbourmaster:['harbour',6,4],  foreman:['quarry',-6,-8],
    clerk:['plots',0,-10],          warden:['missions',-6,-9],
    merchant:['market',-4,-8],      mechanic:['garage',-6,-4]
  };
  Quests.npcList().forEach(function(id,i){
    var def=Quests.NPCS[id], spot=NPCSPOT[id];
    var pad=T.pad(spot[0]);
    var nx=pad.x+spot[1], nz=pad.z+spot[2];
    /* Each one is a designed character — see LH.Cast for the sentence
       every kit was built to serve. */
    var kit=Cast.kit(id,600+i*41);
    var a=Act.Actor({x:nx,y:T.heightAt(nx,nz),z:nz,kit:kit,name:def.name,
      facing:Math.atan2(pad.x-nx,pad.z-nz)});
    a.npcId=id;
    a.pos[1]=W.groundAt(nx,nz);
    G.npcs.push(a);
    W.point('npc_'+id,'npc',nx,nz,{y:a.pos[1],r:3.4,
      label:def.name,prompt:'Talk to '+def.name,data:{npc:id}});
  });

  /* Populate. Species are placed by terrain rather than by hand: crabs
     on the shore, slimes in the meadows, wisps in the deep woods,
     rogues on the roads, and one guardian in the quarry. */
  var erng=M.rng(9001);
  function scatterEnemy(kind,count,test){
    var placed=0,tries=0;
    while(placed<count&&tries<4000){
      tries++;
      var ex=(erng()-0.5)*T.SIZE*0.86, ez=(erng()-0.5)*T.SIZE*0.86;
      var eh=T.heightAt(ex,ez);
      if(!test(ex,ez,eh))continue;
      if(T.flatAt(ex,ez)>0.55)continue;                /* not in a district */
      if(Math.hypot(ex-W.spawn[0],ez-W.spawn[2])<34)continue;  /* not on the doorstep */
      En.spawn(kind,ex,ez);placed++;
    }
    return placed;
  }
  scatterEnemy('crab',14,function(x,z,h){return h>0.6&&h<3.2;});
  scatterEnemy('slime',18,function(x,z,h){return h>3&&h<20;});
  scatterEnemy('wisp',10,function(x,z,h){return h>14&&z>10;});
  scatterEnemy('rogue',9,function(x,z,h){return h>4&&h<26;});
  scatterEnemy('shade',5,function(x,z,h){return h>20;});
  var qpad=T.pad('quarry');
  En.spawn('guardian',qpad.x,qpad.z+14,{leash:30});

  /* Saved progress is offered on the title screen rather than loaded
     over the top of a character you are about to make. */
  Front.hasSave=Net.hasSave();
  G.refreshKit();
  G.ready=true;
});
App.stage('Opening the harbour',function(){
  Front.init();
});

/* The character's appearance is a projection of the server's equipped
   map. Nothing writes to the kit directly, so a rejected equip cannot
   leave you visibly wearing something you do not own. */
G.loadSave=function(){
  if(!Net.load())return false;
  UI.sync(Net.snapshot());
  for(var g=0;g<80;g++)V.update(8);
  G.refreshKit();
  var p=G.player;
  p.pos[0]=W.spawn[0];p.pos[2]=W.spawn[2];
  p.pos[1]=W.groundAt(W.spawn[0],W.spawn[2]);
  return true;
};

/* The look the player actually chose. Equipment is still authoritative
   — an equipped hat always wins — but a slot with nothing equipped in
   it now falls back to this rather than to the engine's default. It
   used to fall back to 'crop' and 'none', which meant the first thing
   you ever equipped quietly shaved your head and took your coat off. */
var LOOK={},LOOKC={};
var LOOK_SLOTS=['hair','shirt','hat','wings','cape','back','pet','aura',
                'over','acc','facial','pants','shoes'];
G.rememberLook=function(){
  if(!G.player)return;
  var k=G.player.kit;
  for(var i=0;i<LOOK_SLOTS.length;i++){
    var n=LOOK_SLOTS[i];
    if(!k[n])continue;
    LOOK[n]=k[n].style;
    if(k[n].color)LOOKC[n]=k[n].color;
  }
};

G.refreshKit=function(){
  if(!G.player)return;
  var eq=Net.snapshot().equipped;
  var k=G.player.kit;
  /* An equipped item wins over the wardrobe for both the shape and
     the colour. It used to win only on the shape, so buying a Red
     Coat got you the coat in whatever colour your wardrobe was set
     to — which is a strange thing for a shop to sell. An item with no
     colour of its own (props.col '#FFFFFF') keeps the wardrobe's,
     which is how a plain tee stays dyeable. */
  function slot(name,dflt){
    var key=eq[name];
    var it=key?D.byKey(key):null;
    if(it&&it.props&&it.props.style){
      k[name].style=it.props.style;
      if(it.props.emis!==undefined)k[name].emis=it.props.emis;
      if(k[name].color!==undefined)
        k[name].color=(it.props.col&&it.props.col!=='#FFFFFF')
          ? it.props.col
          : (LOOKC[name]||k[name].color);
    }else{
      var fb=LOOK[name]!==undefined?LOOK[name]:dflt;
      if(fb!==undefined)k[name].style=fb;
      if(k[name]&&k[name].color!==undefined&&LOOKC[name])
        k[name].color=LOOKC[name];
    }
  }
  slot('hair','bald');slot('shirt','tee');slot('hat','none');
  slot('wings','none');slot('cape','none');slot('back','none');
  slot('pet','none');slot('aura','none');
  /* The five slots that had geometry and items but no way to put one
     on: a coat, glasses, a beard, trousers and shoes were all
     wardrobe-only, so every such item in the shop was unwearable. */
  slot('over','none');slot('acc','none');slot('facial','none');
  slot('shoes','shoe');
  /* Trousers carry a leg length rather than a style name, so they are
     read by hand rather than through slot(). */
  var pit=eq.pants?D.byKey(eq.pants):null;
  if(pit&&pit.props){
    k.pants.leg=pit.props.style==='shorts'?'shorts':'long';
    if(pit.props.col&&pit.props.col!=='#FFFFFF')k.pants.color=pit.props.col;
  }else if(LOOKC.pants)k.pants.color=LOOKC.pants;

  /* the held object follows the equipped tool */
  var tool=eq.tool?D.byKey(eq.tool):null;
  k.tool.style=(tool&&tool.props&&tool.props.style)||'none';
};

/* What the player is looking at: a placed block, a spot to build on,
   or an interaction point. The reticle and the prompt both read this. */
var _ro=M.v3(),_rd=M.v3();
function updateAim(){
  var a=G.aim;
  a.hit=false;a.mode='none';a.target=null;
  if(!G.player)return;
  /* Cast from the camera through the screen centre — what the reticle
     covers is what you act on, which is the only rule that stays
     honest across mouse, touch and pad. */
  Cam.ray(0.5,0.5,_ro,_rd);
  var hit=V.raycast(_ro[0],_ro[1],_ro[2],_rd[0],_rd[1],_rd[2],7.5);

  /* an interaction point beats a block: talking to a shop matters
     more than mining the ground under it */
  var pt=W.nearestPoint(G.player.pos[0],G.player.pos[2],4.0);
  if(pt){a.mode='interact';a.target=pt;a.hit=true;return;}

  if(!hit.hit)return;
  a.hit=true;a.x=hit.x;a.y=hit.y;a.z=hit.z;
  a.ground=hit.ground;
  a.item=hit.item;
  a.place=V.placeTarget(hit);
  var held=UI.heldItem();
  if(held&&held.placeable)a.mode='place';
  else if(!hit.ground)a.mode='break';
  else a.mode='none';
}

function actPrimary(){
  var a=G.aim;
  var p=G.player;
  if(!p)return;
  if(a.mode==='interact'){G.interact(a.target);return;}
  var held=UI.heldItem();

  /* In build mode the tool decides, not the held item. Outside it, the
     held item decides — which keeps ordinary play a single button. */
  if(UI.buildOn()&&a.hit){
    var t=UI.tool();
    if(t==='remove'&&!a.ground){
      p.anim.play('mine');
      Net.request('break',{x:a.x,y:a.y,z:a.z,pos:p.pos},function(r){
        if(r.ok&&LH.Device)LH.Device.buzz(18);
        if(r.ok){UI.sync(r.state);Aud&&Aud.play('break');
          for(var i=0;i<r.drops.length;i++)UI.toastItem(r.drops[i][0],r.drops[i][1]);}
        else UI.toast(r.why,'bad');
      });
      return;
    }
    if(t==='rotate'&&!a.ground){
      Net.request('rotate',{x:a.x,y:a.y,z:a.z,pos:p.pos},function(r){
        if(r.ok){UI.sync(r.state);Aud&&Aud.play('ui');}
        else UI.toast(r.why,'bad');
      });
      return;
    }
    if(t==='copy'&&!a.ground){
      Net.request('pickBlock',{x:a.x,y:a.y,z:a.z},function(r){
        if(!r.ok){UI.toast(r.why,'bad');return;}
        UI.setSlot(UI.slotIndex(),r.key);
        UI.buildPalette();
        UI.setTool('place');
        UI.toast('Copied '+D.byKey(r.key).name,'good');
        Aud&&Aud.play('pickup');
      });
      return;
    }
    if(t==='select'&&!a.ground){
      var itSel=a.item;
      UI.toast(itSel?itSel.name+' — '+D.RARITY[itSel.rarity]:'Nothing there',
        itSel?'good':'bad');
      return;
    }
  }

  if(held&&held.placeable&&a.place){
    p.anim.play('build');
    Net.request('place',{x:a.place.x,y:a.place.y,z:a.place.z,
      key:held.key,rot:0,pos:p.pos},function(r){
        if(r.ok&&LH.Device)LH.Device.buzz(18);
      if(r.ok){UI.sync(r.state);Aud&&Aud.play('place');}
      else UI.toast(r.why,'bad');
    });
    return;
  }
  if(a.hit&&!a.ground){
    p.anim.play('mine');
    Net.request('break',{x:a.x,y:a.y,z:a.z,pos:p.pos},function(r){
        if(r.ok&&LH.Device)LH.Device.buzz(18);
      if(r.ok){
        UI.sync(r.state);
        for(var i=0;i<r.drops.length;i++)UI.toastItem(r.drops[i][0],r.drops[i][1]);
        Aud&&Aud.play('break');
      }else UI.toast(r.why,'bad');
    });
    return;
  }
  /* Nothing to build on and nothing to break: swing anyway. A tool
     that does nothing when you click feels broken even when the
     refusal is correct. */
  p.anim.play(held&&held.cat==='weapon'?'attack':'mine');
}

G.interact=function(pt){
  if(!pt)return;
  var p=G.player;
  switch(pt.kind){
    case 'npc':
      /* pressing again while the card is up opens the trade window —
         the second press is the one that means business */
      if(G.talking===pt.data.npc){
        G.talking=null;UI.dialogue(null);
        G.offerTrade(Quests.NPCS[pt.data.npc].name);
        break;
      }
      Net.request('talk',{id:pt.data.npc},function(r){
        if(!r.ok){UI.toast(r.why,'bad');return;}
        UI.sync(r.state);
        G.talking=pt.data.npc;
        UI.dialogue(r);
        UI.refreshMissions();
      });
      break;
    case 'shop': UI.open('shop');break;
    case 'missions': UI.refreshMissions();UI.open('missions');break;
    case 'portal': UI.open('worlds');break;
    case 'gate': G.travelHome();break;
    case 'plot':
      Net.request('claimPlot',{plot:pt.data.plot},function(r){
        if(r.ok){UI.sync(r.state);
          UI.toast('Plot claimed. Build anything you like here.','good');}
        else UI.toast(r.why,'bad');
      });
      break;
    case 'mine':
      p.anim.play('mine');
      Net.request('mine',{node:'ore'},function(r){
        if(r.ok){UI.sync(r.state);UI.toastItem(r.got,r.n);Aud&&Aud.play('break');
          if(r.levelled){UI.toast('Level up!','good');Aud&&Aud.play('levelup');}}
        else UI.toast(r.why,'bad');
      });
      break;
    case 'fish': startFishing();break;
    case 'vehicles': UI.toast('The garage is still being fitted out.','bad');break;
    case 'arena': UI.toast('The arena is closed for repairs.','bad');break;
    default: UI.toast(pt.label,'good');
  }
};
G.onHeldChanged=function(){G.refreshKit();};

/* A resident's counter-offer. Simulated — they propose something from
   their own stock at roughly the value of what you have shown them —
   but every check on the swap itself is real. */
G.offerTrade=function(who){
  var pool=['ingot_cu','ingot_fe','rope','cloth','bait_shrimp','plank_m',
            'coal','copper','iron','crystal','food_stew','lantern'];
  var theirs={};
  var n=1+((Math.random()*3)|0);
  for(var i=0;i<n;i++){
    var k=pool[(Math.random()*pool.length)|0];
    theirs[k]=(theirs[k]||0)+1+((Math.random()*4)|0);
  }
  Net.request('tradeOpen',{with:who,theirs:theirs},function(r){
    if(!r.ok){UI.toast(r.why,'bad');return;}
    UI.openTrade(r.trade);
    Aud&&Aud.play('open');
  });
};

/* ---------------- travel ----------------
   Regenerating the surface takes about a fifth of a second, which is
   long enough to see. It happens behind a fade rather than as a cut. */
function travel(label,work){
  if(Realm.busy)return;
  G.ready=false;
  UI.travelFade(true,label);
  Fish.cancel();
  G.talking=null;UI.dialogue(null);
  UI.plates([]);
  setTimeout(function(){
    work();
    var p=G.player;
    p.pos[0]=W.spawn[0];p.pos[2]=W.spawn[2];
    p.pos[1]=W.groundAt(W.spawn[0],W.spawn[2]);
    Pl.vel[0]=Pl.vel[1]=Pl.vel[2]=0;
    p.anim.play('idle',true);
    /* the voxel layer the destination loaded has to be meshed before
       the fade lifts, or you arrive to an empty plot */
    for(var i=0;i<80;i++)V.update(8);
    G.ready=true;
    setTimeout(function(){UI.travelFade(false);},120);
  },380);
}

G.travelTo=function(w){
  var srvWorld=null;
  Net.request('myWorlds',{},function(r){
    if(r.ok)srvWorld=r.worlds.filter(function(x){return x.id===w.id;})[0];
  });
  if(!srvWorld){UI.toast('That world is not yours.','bad');return;}
  /* the cells come from the server's own row, not from the listing */
  Net.request('saveRealm',{id:w.id,cells:undefined});
  Aud&&Aud.play('travel');
  travel('Entering '+w.name,function(){
    Realm.enter({id:w.id,name:w.name,theme:w.theme,seed:w.seed,
      radius:w.radius,relief:w.relief,cells:G._realmCells(w.id)});
  });
  setTimeout(function(){
    UI.say('','You are in your own world. Everything here is yours to '+
      'build on. The gate behind you leads home.','sys');
  },900);
};
/* Cells are held server-side; this asks for them through the boundary
   rather than reaching into the state. */
G._realmCells=function(id){
  var out=[];
  Net.request('realmCells',{id:id},function(r){if(r.ok)out=r.cells;});
  return out;
};
/* Walk-in travel. It uses the same fade the private worlds do, but it
   does not rebuild anything — the island is already there, so this is
   a move rather than a load. The arrival point is offset toward the
   middle of the island from the pad centre, because pad centres are
   where the landmarks are and materialising inside a fountain is a
   poor welcome. */
G.travelDistrict=function(id){
  var D2=W.DISTRICTS[id], pad=T.pad(id);
  if(!pad||Realm.busy)return false;
  G.ready=false;
  UI.travelFade(true,'Crossing to '+D2.name);
  Fish.cancel();
  G.talking=null;UI.dialogue(null);
  setTimeout(function(){
    var toC=Math.hypot(pad.x,pad.z)||1;
    var ax=pad.x-(pad.x/toC)*pad.r*0.45;
    var az=pad.z-(pad.z/toC)*pad.r*0.45;
    var p=G.player;
    p.pos[0]=ax;p.pos[2]=az;p.pos[1]=W.groundAt(ax,az);
    p.facing=Math.atan2(pad.x-ax,pad.z-az);
    p.wantFacing=p.facing;
    Pl.vel[0]=Pl.vel[1]=Pl.vel[2]=0;
    Pl.peak=0;
    p.anim.play('idle',true);
    G.ready=true;
    lastDistrict=null;          /* so the arrival banner fires again */
    UI.close();
    setTimeout(function(){UI.travelFade(false);},120);
  },380);
  return true;
};

G.travelHome=function(){
  if(!Realm.inRealm())return;
  Aud&&Aud.play('travel');
  travel('Returning to Lumen Harbor',function(){Realm.leave();});
};

/* ---------------- fishing ----------------
   The rod's animation follows the minigame's stage, so what the
   character is doing always matches what the bar is asking for. */
Fish.on(function(ev,data){
  var p=G.player;
  if(ev==='stage'){
    if(data==='cast'){p.anim.play('fishCast',true);Aud&&Aud.play('cast');}
    else if(data==='wait'||data==='sink')p.anim.play('fishWait');
    else if(data==='strike'){p.anim.play('fishReel',true);Aud&&Aud.play('bite');}
    else if(data==='reel')p.anim.play('fishReel');
    return;
  }
  if(ev==='reject'){UI.toast(data,'bad');p.anim.play('idle');return;}
  if(ev==='miss'){UI.toast('It got away.','bad');p.anim.play('idle');return;}
  if(ev==='snap'){UI.toast('The line snapped!','bad');Aud&&Aud.play('snap');
    Cam.shake(0.12,0.2);p.anim.play('idle');return;}
  if(ev==='caught'){
    UI.sync(data.state);
    UI.showCatch(data);
    Aud&&Aud.play('catch');
    p.anim.play('celebrate',true);
    setTimeout(function(){if(p.anim.state==='celebrate')p.anim.play('idle');},1500);
  }
});

/* Which water you are standing beside decides what lives in it. */
function fishZoneAt(x,z){
  if(x<-70&&z>-40&&z<110)return 'river';
  return Math.hypot(x+4,z+100)<70?'deep':'harbour';
}
function startFishing(){
  var p=G.player;
  if(Fish.beginCast(fishZoneAt(p.pos[0],p.pos[2])))Pl.aiming=true;
}

/* ---------------- combat ---------------- */
function swing(){
  var p=G.player;
  var wep=D.byKey(Net.snapshot().equipped.tool);
  var reach=(wep&&wep.props&&wep.props.reach)||2.0;
  p.anim.play('attack',true);
  var e=En.pick(p.pos,p.facing,reach+0.6,1.0);
  if(!e)return;
  Net.request('attack',{id:e.id,pos:p.pos},function(r){
    if(!r.ok)return;
    UI.sync(r.state);
    var sp=project(e.pos[0],e.pos[1]+1.2,e.pos[2]);
    if(sp)UI.damage(sp.x,sp.y,r.damage,r.crit?'crit':'');
    if(r.crit)Cam.shake(0.08,0.16);
    if(r.killed){
      UI.toast(e.S.name+' defeated','good');
      if(r.loot)for(var i=0;i<r.loot.length;i++)UI.toastItem(r.loot[i][0],r.loot[i][1]);
    }
    Aud&&Aud.play('hit');
  });
}

/* Project a world point to screen pixels, for damage numbers and
   nameplates. Returns null behind the camera. */
var _pm=M.m4();
function project(x,y,z){
  M.mul(_pm,Cam.proj,Cam.view);
  var cx=_pm[0]*x+_pm[4]*y+_pm[8]*z+_pm[12];
  var cy=_pm[1]*x+_pm[5]*y+_pm[9]*z+_pm[13];
  var cw=_pm[3]*x+_pm[7]*y+_pm[11]*z+_pm[15];
  if(cw<=0.001)return null;
  var r=LH.App.canvas.getBoundingClientRect();
  return {x:(cx/cw*0.5+0.5)*r.width, y:(0.5-cy/cw*0.5)*r.height};
}
G.project=project;

/* Getting hit. The server decides the number from the attacker's own
   table, so the client cannot claim it took nothing. */
function onEnemyHit(e,dmg){
  var p=G.player;
  if(Math.hypot(e.pos[0]-p.pos[0],e.pos[2]-p.pos[2])>e.S.reach*1.4)return;
  Net.request('takeDamage',{id:e.id},function(r){
    if(!r.ok)return;
    UI.sync(r.state);
    p.anim.play('hurt',true);
    Cam.shake(0.10,0.2);
    var sp=project(p.pos[0],p.pos[1]+1.6,p.pos[2]);
    if(sp)UI.damage(sp.x,sp.y,e.S.dmg,'hurt');
    if(r.dead)G.onDeath();
  });
}
G.onDeath=function(){
  var p=G.player;
  UI.toast('You were knocked out. Waking up at the harbour…','bad');
  Fish.cancel();
  setTimeout(function(){
    Net.request('respawn',{},function(r){
      if(r.ok)UI.sync(r.state);
      p.pos[0]=W.spawn[0];p.pos[2]=W.spawn[2];
      p.pos[1]=W.groundAt(W.spawn[0],W.spawn[2]);
      Pl.vel[0]=Pl.vel[1]=Pl.vel[2]=0;
      p.anim.play('idle',true);
    });
  },900);
};

/* Nameplates for anything living and close. Rebuilt each frame from
   projected positions; the DOM pool is reused rather than churned. */
var plateList=[];
function updatePlates(){
  plateList.length=0;
  var live=En.live;
  for(var i=0;i<live.length;i++){
    var e=live[i];
    if(e.dead)continue;
    if(Math.hypot(e.pos[0]-G.player.pos[0],e.pos[2]-G.player.pos[2])>26)continue;
    /* only plate something that has noticed you, been hit, or is a boss */
    if(e.hp>=e.hpMax&&e.state!=='chase'&&e.state!=='attack'&&!e.S.boss)continue;
    var top=e.pos[1]+(e.S.body==='guardian'?4.2:(e.actor?2.1:1.2));
    var sp=project(e.pos[0],top,e.pos[2]);
    if(!sp)continue;
    plateList.push({x:sp.x,y:sp.y,name:e.S.name,hp:e.hp,hpMax:e.hpMax,
      boss:!!e.S.boss});
  }
  UI.plates(plateList);
}

/* ---------------- crowd ----------------
   A patrol with pauses. Deliberately simple: they exist to make the
   town feel inhabited, not to be simulated citizens. */
function updateCrowd(dt){
  var rng=Math.random;
  for(var i=0;i<G.crowd.length;i++){
    var n=G.crowd[i];
    socialLook(n,7);
    var dx=n.wander[0]-n.pos[0], dz=n.wander[1]-n.pos[2];
    var d=Math.hypot(dx,dz);
    if(d<0.8){
      n.wait-=dt;
      if(n.wait<=0){
        var a=rng()*M.TAU,rr=4+rng()*16;
        n.wander[0]=n.home[0]+Math.cos(a)*rr;
        n.wander[1]=n.home[1]+Math.sin(a)*rr;
        n.wait=1.5+rng()*6;
      }
      if(n.anim.state==='locomote'||n.anim.state==='idle'){
        if(n.wait>0.2&&rng()<0.0016)n.anim.play('wave');
        else if(n.anim.state!=='wave')n.anim.play('idle');
      }
    }else{
      var sp=n.speed;
      n.pos[0]+=dx/d*sp*dt;
      n.pos[2]+=dz/d*sp*dt;
      n.faceToward(Math.atan2(dx,dz),dt,7);
      n.anim.play('locomote');
      n.anim.params.speed=M.clamp((sp-2.2)/5.2,0,1);
    }
    n.pos[1]=W.groundAt(n.pos[0],n.pos[2]);
    n.update(dt);
  }
}

/* ---------------- crowding ----------------
   Characters used to stand inside one another. Nothing in the game
   cared, but the eye does: two people occupying the same half metre is
   the clearest possible signal that they are not really there.

   A soft separation pass, run after everyone has moved. It is O(n^2)
   over at most twenty actors, which is twenty times cheaper than any
   spatial structure would be to build each frame, and it pushes rather
   than blocks — the player always wins the exchange, so a crowd parts
   around you instead of pinning you. */
var SEP=0.62;
function separate(){
  if(!G.player)return;
  var list=[G.player];
  var i,j;
  if(!Realm.inRealm()){
    for(i=0;i<G.crowd.length;i++)list.push(G.crowd[i]);
    if(G.npcs)for(i=0;i<G.npcs.length;i++)list.push(G.npcs[i]);
  }
  /* Two relaxation passes. One is not enough when three people arrive
     at the same bench: resolving A against B puts A inside C, and the
     second pass is what settles that. */
  for(var pass=0;pass<2;pass++)
  for(i=0;i<list.length;i++)for(j=i+1;j<list.length;j++){
    var A=list[i],B=list[j];
    var dx=B.pos[0]-A.pos[0], dz=B.pos[2]-A.pos[2];
    var d2=dx*dx+dz*dz;
    var r=SEP*(A.scale+B.scale)*0.5;
    if(d2>=r*r)continue;
    var d=Math.sqrt(d2);
    if(d<1e-4){
      /* exactly coincident: nudge apart along a fixed axis rather than
         dividing by zero and shipping NaN positions */
      dx=(j%2?1:-1)*0.01;dz=0.01;d=Math.hypot(dx,dz);
    }
    var push=(r-d)*0.55;
    /* The player is index zero and does not get moved by anyone: being
       shoved around by pathing NPCs feels like a bug even when it is
       physically the fairer answer. */
    if(i===0)shove(B,dx/d*push*2,dz/d*push*2);
    else{shove(A,-dx/d*push,-dz/d*push);shove(B,dx/d*push,dz/d*push);}
  }
}
/* Move an actor and take its wander target with it, so the patrol does
   not spend the next second walking straight back into the person it
   was just pushed off. */
function shove(a,dx,dz){
  a.pos[0]+=dx;a.pos[2]+=dz;
  if(a.wander){a.wander[0]+=dx;a.wander[1]+=dz;}
}

/* ---------------- update ---------------- */
App.onUpdate(function(dt,time){
  if(!G.ready)return;
  I.begin();

  Sky.update(dt);
  UI.setClock(Sky.time,Sky.weather);
  if(Aud)Aud.update(dt);
  /* The players-online figure counts the simulated crowd. It is
     honest about what it is counting rather than inventing a number. */
  UI.setOnline(1+G.crowd.length+(G.npcs?G.npcs.length:0));

  /* --- the front end owns everything until it is finished --- */
  if(Front.active()){
    /* A slow orbit of the plaza behind the panel, with the character
       being edited standing in it — so creation previews the real
       thing rather than a doll that has to be kept in sync. */
    var fpad=T.pad('plaza');
    var ang=time*0.055;
    Cam.manual=true;
    M.set3(Cam.target,fpad.x+7,fpad.y+1.05,fpad.z-2);
    M.set3(Cam.eye,fpad.x+7+Math.sin(ang)*5.4,fpad.y+2.3,
      fpad.z-2+Math.cos(ang)*5.4);
    G.player.pos[0]=fpad.x+7;G.player.pos[2]=fpad.z-2;
    G.player.pos[1]=W.groundAt(G.player.pos[0],G.player.pos[2]);
    /* The camera sits in direction `ang` from the target, and facing 0
       points at +Z — so facing must equal `ang` for the character to
       look back at it. Adding pi shows their back, which is not what
       anyone wants from a character creator. */
    G.player.facing=ang;
    G.player.anim.play('idle');
    G.player.update(dt);
    updateCrowd(dt);
    updateNpcs(dt);
    Cam.update(dt,G.player.pos,null);
    R.updateLight(G.player.pos,44);
    T.extractFrustum(R.vp);
    W.refreshClutter(Cam.target[0],Cam.target[2]);
  W.cullProps(Cam.target[0],Cam.target[2],1.3);
    I.end();
    return;
  }
  if(!G.entered){
    /* Hand the camera back once, on the frame the front end closes.
       Keying this off Cam.manual would fire again every time anything
       else takes manual control — a cinematic, a screenshot — and
       replay the arrival. */
    G.entered=true;
    Cam.manual=false;
    Cam.yaw=G.player.facing+Math.PI;
    Cam.pitch=0.22;Cam.wantDist=6.2;Cam.dist=6.2;
    M.copy3(Cam.focus,G.player.pos);
    if(Front.resumed)G.loadSave();
    else if(LH.Device&&LH.Device.mobile)
      UI.say('','Welcome to Lumen Harbor. Left thumb walks, right thumb '+
        'looks. The big button does whatever it says it will.','sys');
    else UI.say('','Welcome to Lumen Harbor. Press <b>E</b> to interact, '+
      '<b>Tab</b> for your backpack, <b>Esc</b> for the menu.','sys');
    UI.say('','Other people here are simulated — there is no server '+
      'behind them yet.','sys');
    /* Now that there is a world behind it, and not before. */
    setTimeout(function(){UI.offerApp();},2600);
  }

  /* --- panel and hotbar input --- */
  if(I.pressed('emote'))UI.wheel();
  if(UI.wheelOn()){
    /* While the wheel is up the number row picks an emote instead of a
       hotbar slot. Same keys, different mode — which is the whole
       reason the wheel is worth having over seven more bindings. */
    var EM=LH.Rig.EMOTES;
    for(var w=1;w<=EM.length&&w<=9;w++){
      if(I.pressed('slot'+w))UI.emote(EM[w-1]);
    }
    if(I.pressed('menu'))UI.wheel(false);
  }else{
    for(var n=0;n<10;n++){
      if(I.pressed('slot'+n))UI.selectSlot(n===0?9:n-1);
    }
  }
  if(I.pressed('inventory'))UI.open('inv');
  if(I.pressed('craft'))UI.open('craft');
  if(I.pressed('missions'))UI.open('missions');
  if(I.pressed('profile'))UI.open('profile');
  if(I.pressed('map'))UI.open('map');
  if(I.pressed('wardrobe'))UI.open('wardrobe');
  if(I.pressed('worlds'))UI.open('worlds');
  if(I.pressed('trade'))UI.open('trade');
  if(I.pressed('build'))UI.toggleBuild();
  if(I.pressed('fly'))Pl.toggleFly();
  if(I.pressed('rotate')&&UI.buildOn())UI.setTool('rotate');
  if(I.pressed('menu')){if(UI.isOpen())UI.close();else UI.open('menu');}
  if(I.pressed('chat'))UI.focusChat();
  /* typing in chat must not also drive the character */
  if(UI.chatFocused()){I.move.x=0;I.move.y=0;}

  /* A panel takes the input: movement and world actions stop, which is
     what stops a click on a shop button also punching the ground. */
  if(UI.isOpen()){
    I.move.x=0;I.move.y=0;
    I.end();
    Pl.update(dt);
    G.player.update(dt);
    updateCrowd(dt);
    Cam.update(dt,G.player.pos,camSolid);
    En.update(dt,G.player.pos,onEnemyHit);
    UI.plates([]);
    R.updateLight(G.player.pos,44);
    T.extractFrustum(R.vp);
    W.refreshClutter(Cam.target[0],Cam.target[2]);
  W.cullProps(Cam.target[0],Cam.target[2],Math.min(1.7,1+Cam.dist*0.030));
    V.update(2);
    return;
  }

  /* camera first, so movement is relative to what you can see */
  if(I.look.x||I.look.y)Cam.orbit(I.look.x,I.look.y);
  if(I.zoom)Cam.zoom(I.zoom);

  Pl.update(dt);
  /* Where the player is actually heading, in the camera's own
     convention (facing + PI), for the auto-align above. Below a walking
     pace there is no meaningful heading and a nudge should not swing the
     view, so it hands back null and the camera holds still. */
  var vx=Pl.vel[0],vz=Pl.vel[2];
  Cam.heading=(vx*vx+vz*vz>0.6&&!Pl.flying&&!Pl.swimming)
    ?Math.atan2(vx,vz)+Math.PI:null;
  G.player.ik=true;
  G.player.update(dt);
  if(!Realm.inRealm())updateCrowd(dt);
  separate();

  /* The camera follows the player's chest, not their feet, so a jump
     does not swing the whole view. */
  Cam.update(dt,G.player.pos,camSolid);

  /* --- fishing owns the primary button while it is running --- */
  if(Fish.active()){
    Pl.aiming=true;
    if(Fish.stage==='cast'){
      if(I.down('primary')||I.pointer.down)Fish.chargeCast(dt);
      else Fish.release();
    }else if(Fish.stage==='strike'){
      if(I.pressed('primary')||I.pressed('interact'))Fish.strike();
    }else if(Fish.stage==='reel'){
      Fish.setPull(I.down('primary')||I.pointer.down);
    }
    if(I.pressed('menu'))Fish.cancel();
    Fish.update(dt);
    UI.fishing(Fish);
  }else{
    Pl.aiming=false;
    UI.fishing(Fish);
    updateAim();
    var heldW=UI.heldItem();
    /* a weapon swings at whatever is in front; everything else builds,
       breaks or interacts */
    if(I.pressed('primary')){
      if(heldW&&heldW.cat==='weapon')swing();
      else actPrimary();
    }
    if(I.pressed('interact')&&G.aim.mode==='interact')G.interact(G.aim.target);
  }

  En.update(dt,G.player.pos,onEnemyHit);
  updatePlates();
  if(!Realm.inRealm()){updateNpcs(dt);trackDistrict();chatter(dt);}

  /* footsteps are driven by distance so they stay in step at any speed */
  var moved=Math.hypot(Pl.vel[0],Pl.vel[2])*dt;
  if(Pl.grounded&&moved>0.001){
    Front.walked+=moved;
    if(Aud)Aud.footstep(moved,surfaceName());
  }
  Front.tick(UI.state()||Net.snapshot());
  if(UI.isTouch())UI.touchStick(I.stick);

  /* walking away ends a conversation */
  if(G.talking){
    var talkPt=W.nearestPoint(G.player.pos[0],G.player.pos[2],5.0);
    if(!talkPt||talkPt.kind!=='npc'||talkPt.data.npc!==G.talking){
      G.talking=null;UI.dialogue(null);
    }
  }

  /* reticle and prompt reflect what the aim found — and so does the
     big touch button, which is labelled with the verb it will perform
     rather than with a generic USE. On a phone the reticle is the only
     thing telling you what is under the crosshair, and reading a word
     is faster than reading a colour. */
  if(Fish.active()){
    UI.setReticle('');UI.setPrompt('');
    UI.setTouchVerb(Fish.stage==='reel'?'REEL':(Fish.stage==='strike'?'STRIKE':'CAST'),
      true,'');
  }else if(G.aim.mode==='interact'){
    UI.setReticle('act');
    UI.setPrompt(G.aim.target.prompt,'E');
    UI.setTouchVerb('USE',false,G.aim.target.verb||'TALK');
  }else if(G.aim.mode==='place'){
    var ok=G.aim.place&&Net.canBuild(G.aim.place.x,G.aim.place.y,G.aim.place.z);
    UI.setReticle(ok?'act':'deny');
    UI.setPrompt(ok?'Place '+UI.heldItem().name:'You cannot build here','LMB');
    UI.setTouchVerb('PLACE',ok,'');
  }else if(G.aim.mode==='break'){
    var okb=Net.canBuild(G.aim.x,G.aim.y,G.aim.z);
    UI.setReticle(okb?'act':'deny');
    UI.setPrompt(okb?'Break '+(G.aim.item?G.aim.item.name:'block'):'Not yours','LMB');
    UI.setTouchVerb('MINE',okb,'');
  }else{
    UI.setReticle('');
    UI.setPrompt('');
    UI.setTouchVerb(UI.heldItem()&&UI.heldItem().cat==='weapon'?'SWING':'USE',
      true,'');
  }

  /* Rebuild at most a couple of voxel chunks per frame: a player
     dragging a wall into place dirties one every frame and doing them
     all at once is a visible hitch. */
  V.update(2);

  /* Shadows are fitted to a box around the player rather than the
     island: at 2048 across 224 m the character's own shadow would be
     four texels wide. */
  R.updateLight(G.player.pos,44);
  T.extractFrustum(R.vp);
  /* Cull around what the camera is looking at, with the radius opened
     up by however far the boom is out. Culling around the eye instead
     is wrong for any wide shot: at a 290 m orbit the eye sits off the
     island entirely and most of the world vanishes. */
  /* Capped: a very wide orbit would otherwise open the radius far
     enough to draw every prop on the island. */
  W.refreshClutter(Cam.target[0],Cam.target[2]);
  W.cullProps(Cam.target[0],Cam.target[2],Math.min(1.7,1+Cam.dist*0.030));

  I.end();
});

/* NPCs turn to face you when you are close, and idle otherwise. It is
   a small thing and it is most of what makes them read as people
   rather than statues. */
/* Foot IK and social glances are both per-actor costs that only pay
   off close up, so they share one distance test. Twenty-two metres is
   about where a foot stops being a foot and starts being three
   pixels. */
var IK_RANGE2=22*22;

/* Everyone glances at whoever walks past. It costs one vector per
   actor per frame and it is most of the difference between a crowd and
   a set of props that happen to be walking. */
var _lookP=M.v3();
function socialLook(a,range){
  var d=M.dist2(a.pos,G.player.pos);
  a.ik=(d<IK_RANGE2);
  if(d<range*range){
    M.set3(_lookP,G.player.pos[0],G.player.pos[1]+1.45,G.player.pos[2]);
    a.lookAt=a.lookAt||M.v3();
    M.copy3(a.lookAt,_lookP);
  }else a.lookAt=null;
}

function updateNpcs(dt){
  if(!G.npcs)return;
  for(var i=0;i<G.npcs.length;i++){
    var a=G.npcs[i];
    socialLook(a,9);
    var d=M.dist2(a.pos,G.player.pos);
    if(d<6){
      a.faceToward(Math.atan2(G.player.pos[0]-a.pos[0],
        G.player.pos[2]-a.pos[2]),dt,5);
      if(a.anim.state==='idle'&&G.talking===a.npcId&&Math.random()<0.004)
        a.anim.play('wave');
    }
    if(a.anim.state!=='wave')a.anim.play('idle');
    a.update(dt);
  }
}

/* Entering a district is worth recording once: the exploration
   achievement and one of the dailies both measure it. */
var lastDistrict=null;
function trackDistrict(){
  var best=null,bd=1e9;
  for(var i=0;i<T.PADS.length;i++){
    var P=T.PADS[i];
    var d=Math.hypot(G.player.pos[0]-P[1],G.player.pos[2]-P[2]);
    if(d<P[3]&&d<bd){bd=d;best=P[0];}
  }
  if(best&&best!==lastDistrict){
    lastDistrict=best;
    var D2=W.DISTRICTS[best]||{};
    var first=!(Net.snapshot().visited||{})[best];
    UI.arrive(D2.name||best,first?'Discovered':(D2.doing||''),first);
    if(first)LH.Audio&&LH.Audio.play('open');
    Net.request('visit',{id:best},function(r){if(r.ok)UI.sync(r.state);});
  }else if(!best)lastDistrict=null;
}

/* Ambient chatter. Simulated, and the UI says so the first time — the
   people in the harbour are fiction until there is a server. */
var CHATTER=[
  ['Skylar','anyone seen a crystal koi in the river? third day looking'],
  ['Zenn','selling iron, cheap, meet me at the market'],
  ['Mochi','the guardian in the quarry is NOT a fair fight at level 10'],
  ['Noctis','built a whole lighthouse on plot 3, come look'],
  ['Lumi','tuna running off the jetty right now'],
  ['Kestrel','does anyone actually use the arena'],
  ['Vale','glow lure is worth every coin'],
  ['Orin','wisps drop silver more than the wiki says'],
  ['Wren','first shade kill, never doing that again without a real sword'],
  ['Juno','who keeps leaving crates on the harbour deck']
];
var chatT=14, chatI=0;
function chatter(dt){
  chatT-=dt;
  if(chatT>0)return;
  chatT=22+Math.random()*30;
  var c=CHATTER[(chatI++)%CHATTER.length];
  UI.say(c[0],c[1]);
}

/* The material under the player's feet, by name, for footstep audio. */
function surfaceName(){
  var m=Pl.surfaceMat();
  for(var k in LH.Tex.NAME)if(LH.Tex.NAME[k]===m)return k;
  return 'stone';
}

function camSolid(x,y,z){
  if(y<T.heightAt(x,z)+0.35)return true;
  if(V.solid(Math.floor(x),Math.floor(y),Math.floor(z)))return true;
  return W.solidAt(x,y,z);
}

/* ---------------- draw ---------------- */
var _id=M.m4();
App.onDraw(function(dt,time){
  if(!G.ready)return;
  M.ident(_id);

  Act.beginFrame();
  Act.submit(G.player);
  Act.submitPet(G.player,time);
  if(!Realm.inRealm())for(var i=0;i<G.crowd.length;i++){
    var n=G.crowd[i];
    /* Skip characters far enough away to be a couple of pixels. */
    if(M.dist2(n.pos,G.player.pos)>150)continue;
    Act.submit(n);Act.submitPet(n,time);
  }
  if(G.npcs&&!Realm.inRealm())for(var q=0;q<G.npcs.length;q++){
    var np=G.npcs[q];
    if(M.dist2(np.pos,G.player.pos)>110)continue;
    Act.submit(np);
  }
  En.submit(time,G.player.pos);

  /* Point lights are picked around what the camera is looking at, not
     around the player: on a wide orbit the eye can sit well outside the
     lit street the shot is actually of. */
  R.setLights(W.pickLights(Cam.target[0],Cam.target[1],Cam.target[2],R.MAXLIGHTS),
    R.scene.lampLevel);

  /* --- shadow ---
     Far cascade first, then a tight near one. The near pass draws a
     much smaller set: everything it would gain from the terrain beyond
     thirteen metres is outside its own box anyway. */
  var dp=R.beginShadow();
  GL.u1i(dp,'uInstanced',0);
  GL.uM4(dp,'uModel',_id);
  T.drawChunksNear(G.player.pos[0],G.player.pos[2],48);
  W.drawStatics();
  V.drawNear(G.player.pos[0],G.player.pos[2],48);
  GL.u1i(dp,'uInstanced',1);
  W.drawProps(dp);
  Act.flushShadow(dp);
  R.endShadow();

  var dpn=R.beginShadow(true);
  GL.u1i(dpn,'uInstanced',0);
  GL.uM4(dpn,'uModel',_id);
  T.drawChunksNear(G.player.pos[0],G.player.pos[2],20);
  V.drawNear(G.player.pos[0],G.player.pos[2],20);
  GL.u1i(dpn,'uInstanced',1);
  W.drawProps(dpn);
  Act.flushShadow(dpn);
  R.endShadow();

  /* --- opaque --- */
  R.beginScene();
  var p=R.beginOpaque();
  GL.uM4(p,'uModel',_id);
  GL.u1f(p,'uSpec',0.10+LH.Sky.wet*0.26);
  GL.u1f(p,'uMacro',1);
  T.drawChunks(true);
  GL.u1f(p,'uMacro',0);
  W.drawStatics();
  W.drawFalls(p,time);
  V.draw(true);
  W.drawProps(p);
  /* Clutter is drawn but never shadowed: a grass blade's own shadow is
     a pixel, and the shadow pass would double the cost of the densest
     draw in the frame to produce it. */
  W.drawClutter(p);
  Act.flush(p);

  /* --- water --- */
  var wp=R.beginWater(-7.0);
  GL.uM4(wp,'uModel',_id);
  GL.draw(W.water);
  R.endWater();

  /* --- additive: auras --- */
  Act.beginFrame();
  Act.submitAura(G.player,time);
  if(!Realm.inRealm())
    for(var j=0;j<G.crowd.length;j++)Act.submitAura(G.crowd[j],time);
  En.submitAura(time,G.player.pos);
  var ap=R.beginAdditive();
  Act.flush(ap);
  R.endBlend();

  R.present();
});

/* ---------------- go ---------------- */
if(LH.App.start()){
  LH.Input.attach(document.getElementById('gl'));
  LH.App.runBoot();
}
LH.Game=G;
})();

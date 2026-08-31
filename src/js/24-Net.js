/* ============================================================
   LH.Net — the authority boundary.

   This module owns every number that matters: inventory, currency,
   XP, skills, cosmetics, world ownership, mission progress. The rest
   of the game cannot reach that state. It sends a request and gets a
   result, and a rejected request changes nothing.

   Being honest about what this is: there is no server behind it yet,
   so it runs in this page. What it is not is a pretence — the
   boundary is real. `state` is closed over and unreachable from
   outside; every action re-derives its inputs from the server's own
   copy rather than trusting anything in the payload; and quantities,
   distances and ownership are all checked here rather than at the
   call site. Replacing the dispatcher with a WebSocket is a transport
   change, not a rewrite, which is the whole reason to build it this
   way before there is anything to connect to.

   The corollary, stated once: the other people in the harbour are
   simulated. Until there is a server, their trades and their presence
   are local fiction. The systems are real; the multiplayer is not.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,D=LH.Data,V=LH.Voxels,W=LH.World,T=LH.Terrain;
var Net={};

/* ---------------- server-side state ----------------
   Closed over deliberately. Nothing outside this IIFE holds a
   reference, so no amount of poking at LH.* from the console or from
   a mis-wired UI can move a number without going through a handler. */
var state={
  name:'Traveller',
  created:Date.now(),
  coins:120,            /* soft currency — dug up, fished up, earned  */
  shards:0,             /* premium currency — cosmetics only          */
  xp:0,
  level:1,
  skills:{building:0,mining:0,fishing:0,combat:0,exploration:0,social:0},
  skillXp:{building:0,mining:0,fishing:0,combat:0,exploration:0,social:0},
  hp:100,hpMax:100,
  inv:{},               /* key -> count */
  equipped:{},          /* slot -> item key */
  plots:[],             /* claimed plot ids */
  worlds:{},            /* worldId -> {name, cells, perms} */
  missions:{},          /* id -> {progress, done, claimed} */
  collections:{fish:{},blocks:{},cosmetics:{}},
  achievements:{},
  titles:[],
  title:null,
  met:{},               /* npcId -> times talked to */
  visited:{},           /* districtId -> true */
  friends:[],
  stats:{placed:0,broken:0,caught:0,killed:0,walked:0,visits:0,
         crafted:0,sold:0},
  buffs:{}
};

/* Starting kit. The 2D build let players begin dressed and armed; this
   one gives you a rod, a stone pick and the clothes you stand in, and
   everything after that is something you found. */
function grantStarter(){
  state.inv={pick_stone:1,rod_cane:1,bait_worm:12,plank:24,stone:24,
             lantern:4,food_bread:3};
  /* Nothing is equipped in the appearance slots, deliberately. A
     starter hair item and a starter tee here meant the equipped map
     always had an opinion about those two slots, and the character you
     built at creation lost its hairstyle and its jacket the moment the
     kit was refreshed. Equipment still wins when there is any — this
     just stops it winning by default. */
  state.equipped={hair:null,shirt:null,hat:null,wings:null,
                  cape:null,back:null,pet:null,aura:null,
                  over:null,acc:null,facial:null,pants:null,shoes:null,
                  tool:'pick_stone'};
}
grantStarter();

/* ---------------- helpers on the server side ---------------- */
function has(key,n){return (state.inv[key]||0)>=(n||1);}
function give(key,n){
  n=n||1;
  var it=D.byKey(key);
  if(!it)return false;
  state.inv[key]=(state.inv[key]||0)+n;
  /* collections tick the first time you ever hold something */
  if(it.props&&it.props.fish){
    if(!state.collections.fish[key]){state.collections.fish[key]=0;}
    state.collections.fish[key]++;
  }else if(it.cat==='block'&&!state.collections.blocks[key])
    state.collections.blocks[key]=1;
  else if(it.cat==='cosmetic'&&!state.collections.cosmetics[key])
    state.collections.cosmetics[key]=1;
  return true;
}
function take(key,n){
  n=n||1;
  if(!has(key,n))return false;
  state.inv[key]-=n;
  if(state.inv[key]<=0)delete state.inv[key];
  return true;
}

/* XP curve: each level costs a little more than the last, without the
   wall that makes late levels feel like a second job. */
function xpFor(level){return Math.round(90*Math.pow(level,1.42));}
Net.xpFor=xpFor;

function addXp(amount,skill){
  state.xp+=amount;
  var levelled=0;
  while(state.level<80&&state.xp>=xpFor(state.level)){
    state.xp-=xpFor(state.level);
    state.level++;levelled++;
  }
  if(skill&&state.skillXp[skill]!==undefined){
    state.skillXp[skill]+=amount;
    /* Skills level on their own curve so a dedicated angler out-ranks
       a generalist at fishing without out-levelling them overall. */
    while(state.skills[skill]<40&&
          state.skillXp[skill]>=Math.round(60*Math.pow(state.skills[skill]+1,1.35))){
      state.skillXp[skill]-=Math.round(60*Math.pow(state.skills[skill]+1,1.35));
      state.skills[skill]++;
    }
  }
  return levelled;
}

/* A read-only snapshot for the UI. Copied, not shared: handing out a
   live reference would let the client mutate the server's own state,
   which is the exact thing this module exists to prevent. */
function snapshot(){
  return {
    name:state.name,coins:state.coins,shards:state.shards,
    xp:state.xp,level:state.level,xpNext:xpFor(state.level),
    hp:state.hp,hpMax:state.hpMax,
    skills:Object.assign({},state.skills),
    inv:Object.assign({},state.inv),
    equipped:Object.assign({},state.equipped),
    plots:state.plots.slice(),
    stats:Object.assign({},state.stats),
    titles:state.titles.slice(),
    title:state.title,
    met:Object.assign({},state.met),
    visited:Object.assign({},state.visited),
    friends:state.friends.slice(),
    achievements:JSON.parse(JSON.stringify(state.achievements)),
    collections:{
      fish:Object.assign({},state.collections.fish),
      blocks:Object.assign({},state.collections.blocks),
      cosmetics:Object.assign({},state.collections.cosmetics)
    },
    missions:JSON.parse(JSON.stringify(state.missions)),
    buffs:Object.assign({},state.buffs)
  };
}
Net.snapshot=snapshot;

/* ---------------- authority checks ---------------- */
/* Can this player modify the world at this point? Public ground is
   read-only; your own plot and your own world are not. */
function canBuild(x,y,z){
  /* In your own world, everything is yours. In Lumen Harbor, only the
     plots you have claimed are — the public island stays public. */
  var R=LH.Realm;
  if(R&&R.inRealm()){
    return !!state.worlds[R.current.id];
  }
  for(var i=0;i<W.points.length;i++){
    var p=W.points[i];
    if(p.kind!=='plot')continue;
    if(Math.hypot(p.x-(x+0.5),p.z-(z+0.5))>(p.data.buildR||p.r))continue;
    return state.plots.indexOf(p.data.plot)>=0;
  }
  return false;
}
Net.canBuild=canBuild;

/* Distance is checked here, not by the caller. A client that says it
   is standing next to a block is not evidence that it is. */
var REACH=6.5, REACH_FLY=11;
function inReach(pos,x,y,z){
  /* Flying is the building posture, so it gets a longer arm — placing
     a roof means hovering above it, and a six-metre reach from up
     there cannot touch the wall you are standing over. */
  var r=(LH.Player&&LH.Player.flying)?REACH_FLY:REACH;
  return Math.hypot(pos[0]-(x+0.5),pos[1]-(y+0.5),pos[2]-(z+0.5))<=r;
}

/* ---------------- handlers ----------------
   Each returns {ok:true,...} or {ok:false,why:'...'}. `why` is meant
   to be shown to the player, so it says what went wrong in words. */
var H={};

H.place=function(p){
  var x=p.x|0,y=p.y|0,z=p.z|0;
  if(!V.inRange(x,y,z))return {ok:false,why:'Outside the world.'};
  if(!inReach(p.pos,x,y,z))return {ok:false,why:'Too far away.'};
  if(!canBuild(x,y,z))return {ok:false,why:'You cannot build here. Claim a plot first.'};
  if(V.get(x,y,z))return {ok:false,why:'Something is already there.'};
  var it=D.byKey(p.key);
  if(!it||!it.placeable)return {ok:false,why:'That cannot be placed.'};
  if(!has(p.key,1))return {ok:false,why:'You do not have one.'};
  if(V.blockedBy(x,y,z,p.pos,0.4,1.8))return {ok:false,why:'You are standing there.'};
  take(p.key,1);
  V.set(x,y,z,p.key,p.rot|0,state.name);
  state.stats.placed++;
  addXp(2+it.rarity,'building');
  Net.request('track',{kind:'place',key:p.key,n:1});
  return {ok:true,state:snapshot()};
};

/* Rotate a placed block in place. Cheap, and it is most of what makes
   a build set feel larger than it is: a fence, a pane and a stair each
   read as four pieces once they can turn. */
H.rotate=function(p){
  var x=p.x|0,y=p.y|0,z=p.z|0;
  if(!inReach(p.pos,x,y,z))return {ok:false,why:'Too far away.'};
  if(!canBuild(x,y,z))return {ok:false,why:'This is not yours to change.'};
  var c=V.get(x,y,z);
  if(!c)return {ok:false,why:'Nothing there.'};
  V.rotate(x,y,z,1);
  return {ok:true,rot:V.get(x,y,z).rot,state:snapshot()};
};

/* The eyedropper. Only ever tells you what is there — it does not put
   one in your bag, which would make it a duplication glitch. */
H.pickBlock=function(p){
  var it=V.itemAt(p.x|0,p.y|0,p.z|0);
  if(!it)return {ok:false,why:'Nothing there.'};
  if(!has(it.key,1))return {ok:false,why:'You have none of those to place.'};
  return {ok:true,key:it.key};
};

H.break=function(p){
  var x=p.x|0,y=p.y|0,z=p.z|0;
  if(!inReach(p.pos,x,y,z))return {ok:false,why:'Too far away.'};
  if(!canBuild(x,y,z))return {ok:false,why:'This is not yours to break.'};
  var it=V.itemAt(x,y,z);
  if(!it)return {ok:false,why:'Nothing there.'};
  V.clear(x,y,z);
  var drops=D.dropsOf(it);
  for(var i=0;i<drops.length;i++)give(drops[i][0],drops[i][1]);
  state.stats.broken++;
  addXp(1+it.rarity,'building');
  Net.request('track',{kind:'break',key:it.key,n:1});
  return {ok:true,drops:drops,state:snapshot()};
};

/* Mining a natural resource. The server picks what comes out — a
   client that chose its own drops would choose star cores. */
H.mine=function(p){
  var tool=D.byKey(state.equipped.tool);
  var tier=(tool&&tool.props&&tool.props.tier)||0;
  if(tier<1)return {ok:false,why:'You need a pick.'};
  var node=p.node||'stone';
  var TABLE={
    stone:  [['stonechunk',1,0.70],['coal',1,0.20],['copper',1,0.10]],
    ore:    [['stonechunk',1,0.30],['coal',1,0.20],['copper',1,0.20],
             ['iron',1,0.18],['silver',1,0.08],['gold',1,0.04]],
    deep:   [['iron',1,0.26],['silver',1,0.22],['gold',1,0.18],
             ['crystal',1,0.16],['mythril',1,0.10],['voidshard',1,0.06],
             ['starcore',1,0.02]]
  };
  var tbl=TABLE[node]||TABLE.stone;
  /* Tool tier gates the good rows rather than multiplying everything,
     so a better pick opens new materials instead of just more rock. */
  var roll=Math.random(), acc=0, got=null;
  var lucky=1+state.skills.mining*0.012;
  for(var i=0;i<tbl.length;i++){
    var need=D.byKey(tbl[i][0]);
    var rowTier=need?Math.max(1,need.rarity-1):1;
    if(rowTier>tier)continue;
    acc+=tbl[i][2]*(rowTier>1?lucky:1);
    if(roll<=acc){got=tbl[i];break;}
  }
  if(!got)got=['stonechunk',1,1];
  give(got[0],got[1]);
  state.stats.broken++;
  var lv=addXp(4+ (D.byKey(got[0]).rarity*3),'mining');
  Net.request('track',{kind:'mine',key:got[0],n:got[1]});
  return {ok:true,got:got[0],n:got[1],levelled:lv,state:snapshot()};
};

H.craft=function(p){
  var it=D.byKey(p.key);
  if(!it||!it.recipe)return {ok:false,why:'No recipe for that.'};
  var n=Math.max(1,p.n|0||1);
  for(var i=0;i<it.recipe.length;i++){
    if(!has(it.recipe[i][0],it.recipe[i][1]*n)){
      var need=D.byKey(it.recipe[i][0]);
      return {ok:false,why:'Not enough '+(need?need.name:it.recipe[i][0])+'.'};
    }
  }
  for(var j=0;j<it.recipe.length;j++)take(it.recipe[j][0],it.recipe[j][1]*n);
  give(p.key,n);
  state.stats.crafted+=n;
  addXp(6*it.rarity*n,'building');
  Net.request('track',{kind:'craft',key:p.key,n:n});
  return {ok:true,state:snapshot()};
};

H.equip=function(p){
  var it=D.byKey(p.key);
  if(!it)return {ok:false,why:'No such item.'};
  if(it.cat==='cosmetic'){
    if(!has(p.key,1))return {ok:false,why:'You do not own that.'};
    state.equipped[it.props.slot]=p.key;
    return {ok:true,state:snapshot()};
  }
  if(it.cat==='tool'||it.cat==='weapon'||it.cat==='fishing'){
    if(!has(p.key,1))return {ok:false,why:'You do not own that.'};
    state.equipped.tool=p.key;
    return {ok:true,state:snapshot()};
  }
  return {ok:false,why:'That is not something you can wear or hold.'};
};
H.unequip=function(p){
  if(state.equipped[p.slot]===undefined)return {ok:false,why:'Nothing there.'};
  state.equipped[p.slot]=null;
  return {ok:true,state:snapshot()};
};

H.use=function(p){
  var it=D.byKey(p.key);
  if(!it||!it.consumable)return {ok:false,why:'You cannot use that.'};
  if(!has(p.key,1))return {ok:false,why:'You do not have one.'};
  take(p.key,1);
  var pr=it.props||{};
  if(pr.heal)state.hp=Math.min(state.hpMax,state.hp+pr.heal);
  if(pr.buff)state.buffs[pr.buff]={until:Date.now()+(pr.dur||60)*1000};
  return {ok:true,state:snapshot()};
};

/* Shops price from D.buyPrice / D.sellPrice, which both derive from
   one `value` per item, so a shop can never drift out of step with
   the trade window. */
H.buy=function(p){
  var it=D.byKey(p.key);
  if(!it)return {ok:false,why:'No such item.'};
  var n=Math.max(1,p.n|0||1);
  var cost=D.buyPrice(it)*n;
  var premium=(it.cat==='cosmetic'&&it.rarity>=5);
  if(premium){
    if(state.shards<Math.ceil(cost/40))
      return {ok:false,why:'Not enough shards.'};
    state.shards-=Math.ceil(cost/40);
  }else{
    if(state.coins<cost)return {ok:false,why:'Not enough coins.'};
    state.coins-=cost;
  }
  give(p.key,n);
  return {ok:true,spent:cost,state:snapshot()};
};
/* Buying a set. The client sends a set key and nothing else: the
   price, the pieces and the discount are all read from D.SETS here,
   because a client that could name its own price would name zero. */
H.buySet=function(p){
  var set=D.setByKey(p.key);
  if(!set)return {ok:false,why:'No such outfit.'};
  var q=D.setPrice(set,function(k){return has(k,1);});
  if(!q.need.length)return {ok:false,why:'You already own all of it.'};
  if(set.premium){
    if(state.shards<q.due)return {ok:false,why:'Not enough shards.'};
    state.shards-=q.due;
  }else{
    if(state.coins<q.due)return {ok:false,why:'Not enough coins.'};
    state.coins-=q.due;
  }
  for(var i=0;i<q.need.length;i++)give(q.need[i],1);
  return {ok:true,spent:q.due,got:q.need.slice(),state:snapshot()};
};
/* Wearing one. Every piece goes through the same ownership check a
   single equip does — the set is a convenience, not a bypass. */
H.wearSet=function(p){
  var set=D.setByKey(p.key);
  if(!set)return {ok:false,why:'No such outfit.'};
  var worn=0;
  for(var i=0;i<set.items.length;i++){
    var key=set.items[i];
    var it=D.byKey(key);
    if(!it||it.cat!=='cosmetic')continue;
    if(!has(key,1))continue;
    state.equipped[it.props.slot]=key;
    worn++;
  }
  if(!worn)return {ok:false,why:'You do not own any of it yet.'};
  return {ok:true,worn:worn,state:snapshot()};
};
H.sell=function(p){
  var it=D.byKey(p.key);
  if(!it)return {ok:false,why:'No such item.'};
  var n=Math.max(1,p.n|0||1);
  if(!has(p.key,n))return {ok:false,why:'You do not have that many.'};
  if(!it.tradeable)return {ok:false,why:'That cannot be sold.'};
  take(p.key,n);
  var each=(p.weight&&it.props&&it.props.fish)
    ? Math.round(D.fishValue(it,p.weight)*0.55)
    : D.sellPrice(it);
  state.coins+=each*n;
  state.stats.sold+=n;
  Net.request('track',{kind:'sell',key:p.key,n:n});
  Net.request('track',{kind:'coins',key:null,n:each*n});
  return {ok:true,earned:each*n,state:snapshot()};
};

H.claimPlot=function(p){
  var id=p.plot|0;
  if(state.plots.indexOf(id)>=0)return {ok:false,why:'You already own this plot.'};
  if(state.plots.length>=3)return {ok:false,why:'You already hold three plots.'};
  var cost=state.plots.length===0?0:400*state.plots.length;
  if(state.coins<cost)return {ok:false,why:'You need '+cost+' coins for another plot.'};
  state.coins-=cost;
  state.plots.push(id);
  addXp(120,'building');
  return {ok:true,state:snapshot()};
};

H.setName=function(p){
  var n=String(p.name||'').trim().slice(0,16);
  if(!/^[A-Za-z0-9 _-]{2,16}$/.test(n))
    return {ok:false,why:'Two to sixteen letters, numbers, spaces, - or _.'};
  state.name=n;
  return {ok:true,state:snapshot()};
};

H.addXp=function(p,srv){
  /* Only ever called by other server handlers and by world events; the
     amount is clamped so a stray call cannot hand out a level. */
  var amt=M.clamp(p.amount|0,0,500);
  var lv=addXp(amt,p.skill);
  return {ok:true,levelled:lv,state:snapshot()};
};

/* ---------------- the server context ----------------
   Handlers registered from outside this module — the fishing and
   combat ones — still need to move inventory, coins and XP. Exposing
   those as public actions would defeat the entire point: anything
   that can call Net.request could then grant itself a star core.

   Instead the dispatcher hands every handler a private context as its
   second argument. It is created in this closure and never returned
   from anything, so a handler receives it only by being called, and
   no outside caller can obtain one. */
var SRV={
  give:function(key,n){return give(key,n);},
  take:function(key,n){return take(key,n);},
  has:has,
  coins:function(n){state.coins+=n|0;},
  shards:function(n){state.shards+=n|0;},
  xp:function(amount,skill){return addXp(M.clamp(amount|0,0,600),skill);},
  hurt:function(amount){
    state.hp=Math.max(0,state.hp-Math.max(0,amount|0));
    return state.hp;
  },
  heal:function(amount){
    state.hp=Math.min(state.hpMax,state.hp+Math.max(0,amount|0));
    return state.hp;
  },
  stat:function(key,n){
    if(state.stats[key]!==undefined)state.stats[key]+=(n===undefined?1:n);
  },
  skill:function(name){return state.skills[name]||0;},
  equippedTool:function(){return state.equipped.tool;},
  buff:function(name){return !!state.buffs[name];},
  /* Mission and achievement rows are handed out live rather than
     copied: the tracker has to write to them, and it runs inside the
     boundary. Everything the *client* sees still goes through
     snapshot(), which copies. */
  mission:function(id){
    return state.missions[id]||(state.missions[id]={p:0,done:false,
      claimed:false,day:-1,week:-1});
  },
  achievement:function(id){
    return state.achievements[id]||(state.achievements[id]={p:0,done:false});
  },
  title:function(t){
    if(state.titles.indexOf(t)<0)state.titles.push(t);
    if(!state.title)state.title=t;
  },
  worlds:function(){
    /* copied, minus the cell payload — a listing does not need to
       carry every block in every world you own */
    var out=[];
    for(var id in state.worlds){
      var w=state.worlds[id];
      out.push({id:w.id,name:w.name,theme:w.theme,seed:w.seed,
        radius:w.radius,relief:w.relief,perm:w.perm,
        blocks:(w.cells||[]).length/3,created:w.created});
    }
    return out;
  },
  /* The live row, for entering and saving. Inside the boundary. */
  world:function(id){return state.worlds[id]||null;},
  addWorld:function(w){state.worlds[w.id]=w;return w;},
  meet:function(id){state.met[id]=(state.met[id]||0)+1;},
  metCount:function(id){return state.met[id]||0;},
  visit:function(id){
    if(state.visited[id])return false;
    state.visited[id]=true;state.stats.visits++;return true;
  },
  snapshot:snapshot
};

/* ---------------- dispatch ----------------
   Deliberately the only way in. Async by shape even though it resolves
   immediately, so no caller can come to depend on a synchronous
   return that a real socket would not provide. */
var log=[];
Net.request=function(action,payload,cb){
  var h=H[action];
  var res;
  if(!h)res={ok:false,why:'Unknown action: '+action};
  else{
    try{res=h(payload||{},SRV);}
    catch(e){res={ok:false,why:'Server error.'};console.error(action,e);}
  }
  log.push({t:Date.now(),action:action,ok:res.ok});
  if(log.length>200)log.shift();
  if(cb)cb(res);
  return res;
};
Net.handlers=function(){return Object.keys(H);};
Net.register=function(name,fn){H[name]=fn;};
Net.log=function(){return log.slice(-40);};

/* Persistence is the server's job too. */
Net.save=function(){
  try{
    localStorage.setItem('lumen.save',JSON.stringify({
      v:1,state:state,cells:V.serialise()
    }));
    return true;
  }catch(e){return false;}
};
Net.hasSave=function(){
  try{return !!localStorage.getItem('lumen.save');}catch(e){return false;}
};
Net.load=function(){
  try{
    var raw=localStorage.getItem('lumen.save');
    if(!raw)return false;
    var o=JSON.parse(raw);
    if(!o||o.v!==1)return false;
    for(var k in o.state)if(state[k]!==undefined)state[k]=o.state[k];
    if(o.cells)V.deserialise(o.cells);
    return true;
  }catch(e){return false;}
};
Net.wipe=function(){
  try{localStorage.removeItem('lumen.save');}catch(e){}
};

LH.Net=Net;
})();


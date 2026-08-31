/* ============================================================
   Realm handlers, inside the authority.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,Net=LH.Net,R=LH.Realm,D=LH.Data;

var PERMS=['private','friends','invite','public'];

Net.register('myWorlds',function(p,srv){
  return {ok:true,worlds:srv.worlds()};
});

Net.register('createWorld',function(p,srv){
  var list=srv.worlds();
  if(list.length>=3)return {ok:false,why:'You already hold three worlds.'};
  var cost=list.length===0?0:1500*list.length;
  var s=srv.snapshot();
  if(s.coins<cost)return {ok:false,why:'A second world costs '+cost+' coins.'};
  var name=String(p.name||'').trim().slice(0,20);
  if(!/^[A-Za-z0-9 '_-]{2,20}$/.test(name))
    return {ok:false,why:'Two to twenty letters, numbers, spaces, - or _.'};
  if(!R.THEMES[p.theme])return {ok:false,why:'Pick a theme.'};
  srv.coins(-cost);
  var w=srv.addWorld({
    id:'w'+Date.now().toString(36)+Math.floor(Math.random()*999).toString(36),
    name:name,theme:p.theme,
    seed:(Math.random()*1e9)|0,
    radius:64,relief:1,
    perm:'friends',
    cells:[],
    visits:0,
    created:Date.now()
  });
  srv.xp(200,'building');
  return {ok:true,world:w,state:srv.snapshot()};
});

Net.register('saveRealm',function(p,srv){
  var w=srv.world(p.id);
  if(!w)return {ok:false,why:'No such world.'};
  /* Ownership is checked here rather than trusted: a client may only
     ever write to a world the server already has under its name.
     A call with no cells is a no-op rather than an erase — otherwise
     any stray save would empty the world it was meant to protect. */
  if(Array.isArray(p.cells))w.cells=p.cells;
  return {ok:true};
});

/* ---------------- trading ----------------
   Player to player, with the confirmation dance the 2D build had: both
   sides put items up, both sides lock, both sides confirm, and any
   change to either offer after a lock breaks both locks. The other
   party is simulated until there is a server; the validation is not,
   because it is the part that has to survive one arriving. */
var trade=null;
function tradeValue(offer){
  var v=0;
  for(var k in offer){
    var it=D.byKey(k);
    if(it)v+=it.value*offer[k];
  }
  return v;
}

Net.register('tradeOpen',function(p,srv){
  if(trade)return {ok:false,why:'You are already trading.'};
  trade={with:String(p.with||'Trader').slice(0,16),
    mine:{},theirs:p.theirs||{},
    lockedMe:false,lockedThem:false,
    confirmMe:false,confirmThem:false,
    opened:Date.now()};
  return {ok:true,trade:tradeState(srv)};
});
function tradeState(srv){
  if(!trade)return null;
  return {with:trade.with,mine:Object.assign({},trade.mine),
    theirs:Object.assign({},trade.theirs),
    lockedMe:trade.lockedMe,lockedThem:trade.lockedThem,
    confirmMe:trade.confirmMe,confirmThem:trade.confirmThem,
    valueMine:tradeValue(trade.mine),valueTheirs:tradeValue(trade.theirs),
    left:Math.max(0,120-Math.floor((Date.now()-trade.opened)/1000))};
}
Net.register('tradeOffer',function(p,srv){
  if(!trade)return {ok:false,why:'Not trading.'};
  if(trade.lockedMe)return {ok:false,why:'Unlock first.'};
  var it=D.byKey(p.key);
  if(!it)return {ok:false,why:'No such item.'};
  if(!it.tradeable)return {ok:false,why:'That item cannot be traded.'};
  var n=Math.max(1,p.n|0||1);
  var held=srv.snapshot().inv[p.key]||0;
  var already=trade.mine[p.key]||0;
  if(p.remove){
    trade.mine[p.key]=Math.max(0,already-n);
    if(!trade.mine[p.key])delete trade.mine[p.key];
  }else{
    if(already+n>held)return {ok:false,why:'You do not have that many.'};
    if(Object.keys(trade.mine).length>=9&&!trade.mine[p.key])
      return {ok:false,why:'Nine kinds of item is the limit.'};
    trade.mine[p.key]=already+n;
  }
  /* A locked offer refuses edits outright (above), so the classic
     swap-after-agreement is impossible. This clears the locks as well,
     which matters for the other direction: if their side changes, your
     agreement to the old goods must not carry over. */
  trade.lockedMe=trade.lockedThem=false;
  trade.confirmMe=trade.confirmThem=false;
  return {ok:true,trade:tradeState(srv)};
});
Net.register('tradeLock',function(p,srv){
  if(!trade)return {ok:false,why:'Not trading.'};
  trade.lockedMe=!trade.lockedMe;
  if(!trade.lockedMe)trade.confirmMe=trade.confirmThem=false;
  /* the simulated partner locks a beat later, and only if the deal is
     not obviously lopsided against them */
  trade.lockedThem=trade.lockedMe&&
    tradeValue(trade.mine)>=tradeValue(trade.theirs)*0.62;
  return {ok:true,trade:tradeState(srv)};
});
Net.register('tradeConfirm',function(p,srv){
  if(!trade)return {ok:false,why:'Not trading.'};
  if(!trade.lockedMe||!trade.lockedThem)
    return {ok:false,why:'Both sides have to lock first.'};
  trade.confirmMe=true;
  trade.confirmThem=true;
  /* re-check the goods are still there at the moment of the swap */
  var inv=srv.snapshot().inv;
  for(var k in trade.mine){
    if((inv[k]||0)<trade.mine[k]){
      trade=null;
      return {ok:false,why:'The trade fell through — something is missing.'};
    }
  }
  for(var g in trade.mine)srv.take(g,trade.mine[g]);
  for(var t in trade.theirs)srv.give(t,trade.theirs[t]);
  var got=Object.keys(trade.theirs).map(function(x){return [x,trade.theirs[x]];});
  srv.xp(40,'social');
  trade=null;
  return {ok:true,got:got,state:srv.snapshot()};
});
Net.register('tradeCancel',function(p,srv){
  trade=null;
  return {ok:true};
});
Net.register('tradeState',function(p,srv){
  return {ok:true,trade:tradeState(srv)};
});

Net.register('realmCells',function(p,srv){
  var w=srv.world(p.id);
  if(!w)return {ok:false,why:'No such world.'};
  return {ok:true,cells:(w.cells||[]).slice()};
});

Net.register('setPerm',function(p,srv){
  var w=srv.world(p.id);
  if(!w)return {ok:false,why:'No such world.'};
  if(PERMS.indexOf(p.perm)<0)return {ok:false,why:'Unknown permission.'};
  w.perm=p.perm;
  return {ok:true,world:w,state:srv.snapshot()};
});

Net.register('renameWorld',function(p,srv){
  var w=srv.world(p.id);
  if(!w)return {ok:false,why:'No such world.'};
  var name=String(p.name||'').trim().slice(0,20);
  if(!/^[A-Za-z0-9 '_-]{2,20}$/.test(name))
    return {ok:false,why:'Two to twenty letters, numbers, spaces, - or _.'};
  w.name=name;
  return {ok:true,world:w,state:srv.snapshot()};
});

/* Building permission is per-place. In Lumen Harbor it is your plots;
   in a realm it is whether the realm is yours. */
Net.register('canBuildHere',function(p,srv){
  if(!R.inRealm())return {ok:true,can:Net.canBuild(p.x,p.y,p.z)};
  var w=srv.world(R.current.id);
  return {ok:true,can:!!w};
});

LH.RealmNet=true;
})();


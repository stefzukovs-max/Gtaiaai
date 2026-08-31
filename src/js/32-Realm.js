/* ============================================================
   LH.Realm — private worlds.

   The promise the whole game is making: somewhere that is yours,
   that persists, that you can build in without asking, and that you
   can let other people into on your terms.

   A realm is a terrain profile plus a voxel layer plus a permission
   row. It reuses the same generator, chunking, lighting, collision
   and material blending as Lumen Harbor rather than being a second,
   thinner renderer — which is why a private world does not look
   like a lesser place than the public one.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,GL=LH.GL,Geo=LH.Geo,T=LH.Terrain,V=LH.Voxels,W=LH.World;
var Net=LH.Net,D=LH.Data,En=LH.Enemies;
var R={};

R.current=null;          /* null means Lumen Harbor */
R.busy=false;

/* Themes decide the ground, the sky's mood and what grows there.
   Deliberately few: a long list of themes is a long list of worlds
   that all feel the same. */
var THEMES={
  meadow:{name:'Meadow',   band:'grass',    tree:'broadleaf',density:0.9,
          tint:'#8FD36A'},
  garden:{name:'Blossom Garden',band:'grass',tree:'blossom',density:1.2,
          tint:'#FFC0DA'},
  dunes:{ name:'Dunes',    band:'sand',     tree:'palm',    density:0.5,
          tint:'#EBD6A4'},
  tundra:{name:'Tundra',   band:'snow',     tree:'pine',    density:0.7,
          tint:'#DDEAF6'},
  basalt:{name:'Basalt',   band:'stone',    tree:'dead',    density:0.4,
          tint:'#8A8F98'},
  works:{ name:'Old Works',band:'concrete', tree:'dead',    density:0.3,
          tint:'#7E868F'}
};
R.THEMES=THEMES;
R.themeList=function(){return Object.keys(THEMES);};

/* Props placed in a realm belong to the realm, so they are rebuilt
   on entry and dropped on exit rather than accumulating. */
var realmProps=[];

function dressRealm(seed,theme){
  var Th=THEMES[theme]||THEMES.meadow;
  var rng=M.rng((seed||1)*7919+13);
  var P=LH.Props;
  var radius=(R.current&&R.current.radius)||64;
  var n=Math.round(90*Th.density);
  for(var i=0;i<n;i++){
    var a=rng()*M.TAU, rr=Math.sqrt(rng())*radius*0.94;
    var x=Math.cos(a)*rr, z=Math.sin(a)*rr;
    var h=T.heightAt(x,z);
    if(h<0.9)continue;
    /* leave the middle clear: it is the part people build on */
    if(rr<radius*0.30&&rng()<0.85)continue;
    var k=rng();
    if(k<0.34)W.place(P.tree(Th.tree,(rng()*4)|0),x,h-0.2,z,rng()*6.28,
      0.8+rng()*0.5,'#FFFFFF');
    else if(k<0.58)W.place(P.bush((rng()*3)|0),x,h,z,rng()*6.28,
      0.7+rng()*0.6,'#FFFFFF');
    else if(k<0.86)W.place(P.grassTuft((rng()*3)|0),x,h,z,rng()*6.28,
      0.7+rng()*0.6,'#FFFFFF');
    else W.place(P.rock((rng()*4)|0),x,h-0.3,z,rng()*6.28,
      0.4+rng()*0.9,'#FFFFFF');
  }
}

/* The way home. Every realm has one, in the same place, so nobody
   ever has to work out how to leave. */
function realmGate(){
  var b=Geo.build();
  var y=T.heightAt(0,-14);
  b.push();b.translate(0,y,-14);
  b.mat('panel');
  b.loft([
    {y:0,   pts:Geo.roundRect(4.6,2.6,0.5,14)},
    {y:0.5, pts:Geo.roundRect(4.2,2.2,0.45,14)},
    {y:0.7, pts:Geo.roundRect(3.9,1.9,0.4,14)}
  ],'#98A2B0',{uvScale:1.2});
  for(var i=0;i<=16;i++){
    var a=Math.PI*(i/16);
    b.push();
    b.translate(Math.cos(a)*2.3,0.9+Math.sin(a)*2.3,0);
    b.rotate(0,0,a-Math.PI/2);
    b.mat('panel');
    b.chamfer(0,0,0,0.46,0.40,0.66,i%2?'#C4CCD8':'#AAB2BE',0.06);
    b.pop();
  }
  b.mat('neon',0.85);
  b.push();b.translate(0,0.9,0);
  b.loft([
    {y:-0.9,pts:Geo.circle(1.85,18,1,0.10)},
    {y: 0.0,pts:Geo.circle(2.02,18,1,0.10)},
    {y: 1.9,pts:Geo.circle(1.20,18,1,0.10)}
  ],'#F5A03C',{openTop:true,openBottom:true});
  b.pop();
  b.pop();
  W.statics.push(b.upload());
  W.lights.push({x:0,y:y+2.2,z:-14,r:14,col:[1.00,0.63,0.24],
    power:1.4,always:true});
  W.point('gate','gate',0,-11.5,{y:y,r:4.0,
    label:'Way Home',prompt:'Return to Lumen Harbor'});
}

/* ---------------- entering and leaving ----------------
   The public island's own statics, props, points and collision are
   kept aside rather than rebuilt, because regenerating Lumen Harbor
   on every trip home would take a second and a half. */
var harbourCache=null;

function stash(){
  harbourCache={
    statics:W.statics.slice(),
    boxes:W.boxes.slice(),
    points:W.points.slice(),
    groups:(W.groups||[]).slice(),
    instanced:W.instanced.slice(),
    lights:W.lights.slice(),
    spawn:M.v3(W.spawn[0],W.spawn[1],W.spawn[2]),
    cells:V.serialise(),
    enemies:En.live.slice()
  };
}
function restore(){
  if(!harbourCache)return;
  /* release only what the realm made; the harbour's meshes are the
     same objects that were set aside */
  for(var i=0;i<W.statics.length;i++){
    if(harbourCache.statics.indexOf(W.statics[i])<0)GL.freeMesh(W.statics[i]);
  }
  W.statics.length=0;
  Array.prototype.push.apply(W.statics,harbourCache.statics);
  W.boxes.length=0;
  Array.prototype.push.apply(W.boxes,harbourCache.boxes);
  W.points.length=0;
  Array.prototype.push.apply(W.points,harbourCache.points);
  W.groups=harbourCache.groups;
  W.instanced.length=0;
  Array.prototype.push.apply(W.instanced,harbourCache.instanced);
  W.lights.length=0;
  Array.prototype.push.apply(W.lights,harbourCache.lights);
  M.copy3(W.spawn,harbourCache.spawn);
  En.live.length=0;
  Array.prototype.push.apply(En.live,harbourCache.enemies);
  V.deserialise(harbourCache.cells);
}

/* Build a realm's surface and contents. Synchronous: it is about a
   fifth of a second and it happens behind a fade. */
function buildRealm(realm){
  W.statics.length=0;
  W.boxes.length=0;
  W.points.length=0;
  W.instanced.length=0;
  W.lights.length=0;
  W.groups=[];
  En.live.length=0;

  T.setProfile({kind:'realm',seed:realm.seed,theme:realm.theme,
    radius:realm.radius,relief:realm.relief});
  T.generate();
  T.buildChunks();

  dressRealm(realm.seed,realm.theme);
  W.commitProps();
  realmGate();

  V.deserialise(realm.cells||[]);
  M.set3(W.spawn,0,T.heightAt(0,-6),-6);
}

R.enter=function(realm,done){
  if(R.busy)return false;
  R.busy=true;
  if(!R.current)stash();
  R.current=realm;
  buildRealm(realm);
  R.busy=false;
  if(done)done();
  return true;
};

R.leave=function(done){
  if(!R.current||R.busy)return false;
  R.busy=true;
  /* hand the realm's current cells back to the server before leaving */
  Net.request('saveRealm',{id:R.current.id,cells:V.serialise()});
  R.current=null;
  T.setProfile({kind:'harbor'});
  T.generate();
  T.buildChunks();
  restore();
  R.busy=false;
  if(done)done();
  return true;
};

R.inRealm=function(){return !!R.current;};

LH.Realm=R;
})();


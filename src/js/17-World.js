/* ============================================================
   LH.World — Lumen Harbor.

   Assembles the island: terrain, water, nine districts, the
   architecture in each, the vegetation between them, and the
   collision volumes that stop you walking through a wall.

   Districts are data. Adding one means adding a pad in LH.Terrain
   and a dresser here — not touching the renderer, the controller or
   the camera.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,GL=LH.GL,Geo=LH.Geo,T=LH.Terrain,P=LH.Props,Arch=LH.Arch;
var W={};

W.statics=[];        /* merged architecture meshes */
W.falls=null;        /* the sky islands' waterfalls, scrolled at draw */
W.lights=[];         /* every lamp and glowing thing in the world */
W.instanced=[];      /* prop meshes with a static instance buffer */
W.boxes=[];          /* axis-aligned collision volumes */
W.points=[];         /* named interaction points */
W.water=null;

/* ---------------- collision ----------------
   Buildings are boxes. A capsule-vs-box push-out is enough for a
   sandbox and costs nothing next to a real physics engine — and the
   list is small because only architecture registers, not props. */
function box(x,y,z,w,h,d,rot,tag){
  W.boxes.push({x:x,y:y,z:z,hw:w/2,hh:h/2,hd:d/2,
    c:Math.cos(-rot||0),s:Math.sin(-rot||0),tag:tag||''});
}
W.box=box;

/* Transform a world point into a box's local space, so a rotated
   building still collides correctly. */
function toLocal(B,x,z,out){
  var dx=x-B.x,dz=z-B.z;
  out[0]=dx*B.c-dz*B.s;
  out[1]=dx*B.s+dz*B.c;
  return out;
}
var _lp=[0,0];
W.solidAt=function(x,y,z){
  for(var i=0;i<W.boxes.length;i++){
    var B=W.boxes[i];
    if(y<B.y-B.hh||y>B.y+B.hh)continue;
    toLocal(B,x,z,_lp);
    if(Math.abs(_lp[0])<B.hw&&Math.abs(_lp[1])<B.hd)return true;
  }
  return false;
};

/* Push a circle of radius r out of every box it overlaps. Iterated
   twice so a corner between two buildings resolves instead of
   oscillating. */
W.resolve=function(pos,r,footY){
  for(var pass=0;pass<2;pass++){
    for(var i=0;i<W.boxes.length;i++){
      var B=W.boxes[i];
      if(footY+1.6<B.y-B.hh||footY>B.y+B.hh)continue;
      toLocal(B,pos[0],pos[2],_lp);
      var lx=_lp[0],lz=_lp[1];
      var cx=M.clamp(lx,-B.hw,B.hw), cz=M.clamp(lz,-B.hd,B.hd);
      var dx=lx-cx, dz=lz-cz;
      var d2=dx*dx+dz*dz;
      if(d2>r*r)continue;
      var nx,nz,pen;
      if(d2>1e-8){
        var d=Math.sqrt(d2);nx=dx/d;nz=dz/d;pen=r-d;
      }else{
        /* centre is inside the box — push out of the nearest face */
        var px=B.hw-Math.abs(lx), pz=B.hd-Math.abs(lz);
        if(px<pz){nx=lx<0?-1:1;nz=0;pen=px+r;}
        else{nx=0;nz=lz<0?-1:1;pen=pz+r;}
      }
      /* back to world space */
      var wx=nx*B.c+nz*B.s, wz=-nx*B.s+nz*B.c;
      pos[0]+=wx*pen;pos[2]+=wz*pen;
    }
  }
  return pos;
};

W.groundAt=function(x,z){
  var h=T.heightAt(x,z);
  /* Standing on a roof or a jetty deck is a box query, not a
     heightmap one. Take the highest surface under the sample. */
  for(var i=0;i<W.boxes.length;i++){
    var B=W.boxes[i];
    if(!B.walkable)continue;
    toLocal(B,x,z,_lp);
    if(Math.abs(_lp[0])<B.hw&&Math.abs(_lp[1])<B.hd){
      var top=B.y+B.hh;
      if(top>h)h=top;
    }
  }
  return h;
};

/* ---------------- interaction points ---------------- */
function point(id,kind,x,z,opt){
  opt=opt||{};
  var y=opt.y!==undefined?opt.y:T.heightAt(x,z);
  var p={id:id,kind:kind,x:x,y:y,z:z,
    r:opt.r||2.6,label:opt.label||id,prompt:opt.prompt||'Interact',
    data:opt.data||null};
  W.points.push(p);
  return p;
}
W.point=point;
W.nearestPoint=function(x,z,maxD){
  var best=null,bd=maxD||3.2;
  for(var i=0;i<W.points.length;i++){
    var p=W.points[i];
    var d=Math.hypot(p.x-x,p.z-z);
    if(d<Math.min(bd,p.r)){bd=d;best=p;}
  }
  return best;
};

/* ---------------- instanced prop placement ---------------- */
var pending={};
/* Lamps register a point light where their bulb is. Doing it here
   rather than at each of the two dozen call sites means a lamp added
   anywhere in the world lights the ground under it for free. */
var LAMPLIGHT={
  /* Deliberately short-range and weak. The plaza carries two dozen of
     them and they overlap: the first pass at this used a 13m radius at
     full strength and flooded the square to daylight at midnight. */
  'lamp:plaza':  {h:4.10,r:9.0,col:[1.00,0.84,0.58],power:0.34},
  'lamp:harbour':{h:3.76,r:8.5,col:[1.00,0.74,0.42],power:0.32}
};
function place(mesh,x,y,z,rot,scale,tint,emis){
  var lit=LAMPLIGHT[mesh.key];
  if(lit)W.lights.push({x:x,y:y+lit.h*(scale||1),z:z,r:lit.r*(scale||1),
    col:lit.col,power:lit.power});
  var list=pending[mesh.key];
  if(!list){
    var kind=String(mesh.key).split(':')[0];
    list=pending[mesh.key]={mesh:mesh,items:[],
      cull:LH.Props.CULL[kind]||LH.Props.CULL.dflt};
  }
  list.items.push([x,y,z,rot||0,scale||1,tint||'#FFFFFF',emis||0]);
}
W.place=place;

var _t=M.v3(),_s=M.v3(),_m=M.m4();
var groups=[];
function commitProps(){
  W.instanced.length=0;
  groups.length=0;
  for(var k in pending){
    var L=pending[k];
    /* Precompute the transform for every placement once. Rebuilding a
       matrix per prop per frame would cost more than the draw. */
    var items=L.items,packed=new Float32Array(items.length*GL.ISTRIDE);
    for(var i=0;i<items.length;i++){
      var it=items[i];
      M.set3(_t,it[0],it[1],it[2]);
      M.set3(_s,it[4],it[4],it[4]);
      M.fromTRS(_m,_t,0,it[3],0,_s);
      var o=i*GL.ISTRIDE;
      for(var q=0;q<16;q++)packed[o+q]=_m[q];
      var c=Geo.col3(it[5]);
      packed[o+16]=c[0];packed[o+17]=c[1];packed[o+18]=c[2];packed[o+19]=it[6];
    }
    var xs=new Float32Array(items.length),zs=new Float32Array(items.length);
    for(var j=0;j<items.length;j++){xs[j]=items[j][0];zs[j]=items[j][2];}
    groups.push({mesh:L.mesh,packed:packed,xs:xs,zs:zs,
      count:items.length,cull:L.cull});
    W.instanced.push(L.mesh);
  }
  pending={};
  W.groups=groups;
}
/* Realms build their own props, so the commit step has to be callable
   from outside the initial world build. */
W.commitProps=commitProps;

/* Refill the instance buffers with what is near enough to matter. The
   island carries about five thousand props; drawing all of them every
   frame is four million triangles for a view that can see a fraction
   of them. Rebuilding the buffers costs a fraction of a millisecond. */
W.cullProps=function(cx,cz,scale){
  scale=scale||1;
  for(var g=0;g<groups.length;g++){
    var G2=groups[g],mesh=G2.mesh,d=mesh.idata,src=G2.packed;
    var cull=G2.cull*scale, cull2=cull*cull;
    var n=0,max=mesh.maxInstances;
    for(var i=0;i<G2.count&&n<max;i++){
      var dx=G2.xs[i]-cx, dz=G2.zs[i]-cz;
      if(dx*dx+dz*dz>cull2)continue;
      var so=i*GL.ISTRIDE, dof=n*GL.ISTRIDE;
      for(var q=0;q<GL.ISTRIDE;q++)d[dof+q]=src[so+q];
      n++;
    }
    mesh.instances=n;
    GL.updateInstances(mesh,n);
  }
};

/* ---------------- district dressers ---------------- */
function ringScatter(b,cx,cz,r0,r1,count,seed,fn){
  var rng=M.rng(seed);
  for(var i=0;i<count;i++){
    var a=rng()*M.TAU, rr=r0+rng()*(r1-r0);
    fn(cx+Math.cos(a)*rr, cz+Math.sin(a)*rr, rng, a);
  }
}

function dressPlaza(b){
  var pad=T.pad('plaza'), cx=pad.x, cz=pad.z, y=pad.y;

  /* The portal. Everything in the plaza is arranged to face it,
     because it is the thing the game is actually about. */
  var portal=P.portal();
  place(portal,cx,y,cz-9,0,1.15,'#FFFFFF',0);
  box(cx,y+2.2,cz-9,5.2,4.4,2.0,0,'portal');
  point('portal','portal',cx,cz-6.4,{y:y,r:4.0,
    label:'World Gateway',prompt:'Enter your world'});

  /* A fountain at the centre: a basin, a plume and a lit rim. */
  var f=Geo.build();
  f.mat('stone');
  f.push();f.translate(cx,y,cz);
  /* A hollow basin: outer wall, inner wall, a rim ring joining them at
     the top, a floor, and the water surface above it. Built as a
     capped loft it comes out as a solid black lid — the cap covers the
     whole basin, which is exactly what a fountain must not have. */
  var SEG=22;
  f.loft([
    {y:0.00,pts:Geo.circle(2.50,SEG)},
    {y:0.62,pts:Geo.circle(2.66,SEG)},
    {y:0.80,pts:Geo.circle(2.60,SEG)}
  ],'#96A0AC',{uvScale:1.4,openTop:true,openBottom:true});
  f.loft([
    {y:0.26,pts:Geo.circle(2.34,SEG)},
    {y:0.80,pts:Geo.circle(2.40,SEG)}
  ],'#828A96',{openTop:true,openBottom:true});
  f.annulus(0,0.80,0,2.40,2.60,SEG,'#A6AEBA');
  f.disc(0,0.26,0,2.36,SEG,'#6E7682');
  f.mat('water',0.02);
  f.disc(0,0.60,0,2.36,SEG,'#2E7C93');
  f.mat('stone');
  f.loft([
    {y:0.42,pts:Geo.circle(0.62,14)},
    {y:1.35,pts:Geo.circle(0.34,14)},
    {y:1.52,pts:Geo.circle(0.86,14)},
    {y:1.66,pts:Geo.circle(0.70,14)}
  ],'#A2AAB6',{});
  f.mat('crystal',0.60);
  f.sphere(0,2.02,0,0.40,14,10,'#5BE8FF');
  f.pop();
  W.statics.push(f.upload());
  /* The fountain crystal is lit around the clock — it is the landmark
     you steer by, and a landmark that only exists after dark is not
     one. */
  W.lights.push({x:cx,y:y+2.4,z:cz,r:9.5,col:[0.26,0.70,0.92],
    power:0.5,always:true});
  box(cx,y+0.42,cz,5.4,0.84,5.4,0,'fountain');
  W.boxes[W.boxes.length-1].walkable=false;

  /* An inlay in the paving.

     A disc of tile forty metres across with a fountain in the middle
     of it reads as a car park with a fountain in the middle of it, and
     no amount of work on the tile texture changes that — the problem
     is that nothing has been *drawn* on the square. Two courses of
     darker stone around the basin and eight spokes running out under
     the furniture give the plaza a centre and a set of directions, and
     cost one static mesh with no collision. */
  var inl=Geo.build();
  inl.mat('tiledark');
  inl.push();inl.translate(cx,y+0.014,cz);
  inl.annulus(0,0,0,4.20,4.95,44,'#9A9084');
  inl.annulus(0,0,0,5.30,5.62,44,'#6E665C');
  inl.annulus(0,0,0,17.60,18.10,56,'#7A7266');
  for(var sp=0;sp<8;sp++){
    var spa=sp/8*M.TAU+M.TAU/16;
    inl.push();
    inl.translate(Math.cos(spa)*11.5,0,Math.sin(spa)*11.5);
    inl.rotate(0,-spa,0);
    /* The chamfer radius has to stay under half the smallest extent —
       a two-centimetre round on a one-centimetre slab turns the box
       inside out. */
    inl.chamfer(0,0,0,12.4,0.014,0.62,'#88806F',0.004,{noBand:true});
    inl.pop();
  }
  inl.pop();
  W.statics.push(inl.upload());

  /* Ring of benches, planters and lamps facing in. */
  /* Three concentric rings of furniture. A square this size with a
     bare middle reads as a car park, and the rings also give the eye
     something to measure the space against. */
  ringScatter(b,cx,cz,6.2,6.2,8,29,function(x,z,rng,a){
    place(P.bollard(),x,T.heightAt(x,z),z,a,1,'#8E97A4');
  });
  ringScatter(b,cx,cz,10.5,10.5,8,31,function(x,z,rng,a){
    place(P.bench(),x,T.heightAt(x,z),z,a+Math.PI/2,1,'#FFFFFF');
  });
  ringScatter(b,cx,cz,13.5,13.5,10,37,function(x,z,rng,a){
    place(P.lamp('plaza'),x,T.heightAt(x,z),z,a,1,'#FFFFFF');
  });
  ringScatter(b,cx,cz,16.5,16.5,10,41,function(x,z,rng,a){
    place(P.planter(),x,T.heightAt(x,z),z,a,1,'#FFFFFF');
  });
  ringScatter(b,cx,cz,19.5,19.5,12,43,function(x,z,rng,a){
    place(P.tree('blossom',(rng()*4)|0),x,T.heightAt(x,z)-0.2,z,a,
      0.72+rng()*0.20,'#FFFFFF');
  });
  /* four kiosks facing the fountain, to break up the open floor */
  for(var q=0;q<4;q++){
    var qa=q/4*M.TAU+0.78;
    var qx=cx+Math.cos(qa)*15.5, qz=cz+Math.sin(qa)*15.5;
    Arch.stall(b,{x:qx,y:T.heightAt(qx,qz),z:qz,rot:-qa+Math.PI/2,
      seed:150+q*9,col:['#C4485E','#3E7BE0','#38A86A','#F5A03C'][q]});
    box(qx,T.heightAt(qx,qz)+1.0,qz,3.4,2.0,2.4,-qa+Math.PI/2,'stall');
  }

  /* Civic frontage along the south edge. */
  /* A frontage that wraps most of the way round, so the square has
     walls rather than one distant terrace. */
  var shops=[
    {x:-21,z:12,rot:-1.10,style:'town',  w:11,d:9, st:2,shop:1,aw:'#3E7BE0',sc:'#5BE8FF'},
    {x:-18,z:19,rot:-0.62,style:'harbour',w:10,d:8,st:2,shop:0},
    {x:-8, z:23,rot:-0.24,style:'town',  w:13,d:10,st:3,shop:1,aw:'#B4485E',sc:'#F5A03C'},
    {x: 6, z:23,rot: 0.20,style:'modern',w:12,d:9, st:3,shop:1,aw:'#38A86A',sc:'#57D07A'},
    {x: 18,z:17,rot: 0.72,style:'town',  w:10,d:8, st:2,shop:0},
    {x: 23,z: 6,rot: 1.24,style:'modern',w:11,d:9, st:2,shop:1,aw:'#8A5AC4',sc:'#B269FF'},
    {x: 18,z:-6,rot: 1.92,style:'harbour',w:10,d:8,st:2,shop:0},
    {x:-20,z:-2,rot:-1.62,style:'town',  w:10,d:9, st:2,shop:1,aw:'#F5A03C',sc:'#F5C451'}
  ];
  for(var i=0;i<shops.length;i++){
    var S=shops[i];
    var bx=cx+S.x,bz=cz+S.z;
    var by=T.heightAt(bx,bz)-0.3;
    Arch.building(b,{x:bx,y:by,z:bz,rot:S.rot,style:S.style,
      w:S.w,d:S.d,storeys:S.st,seed:71+i*13,shop:S.shop,
      awning:S.aw,signCol:S.sc,sink:1.2});
    box(bx,by+S.st*3.1/2+0.4,bz,S.w,S.st*3.1+1.2,S.d,S.rot,'building');
  }
}

function dressMarket(b){
  var pad=T.pad('market'),cx=pad.x,cz=pad.z,y=pad.y;
  var cols=['#C4485E','#3E7BE0','#38A86A','#F5A03C','#B269FF','#3BE0C8'];
  /* two rows of stalls with an aisle between them */
  for(var r=0;r<2;r++)for(var i=0;i<4;i++){
    var sx=cx-11+i*7.4, sz=cz-6+r*12;
    Arch.stall(b,{x:sx,y:T.heightAt(sx,sz),z:sz,
      rot:r?Math.PI:0,seed:97+r*7+i,col:cols[(r*4+i)%cols.length]});
    box(sx,T.heightAt(sx,sz)+1.0,sz,3.4,2.0,2.4,0,'stall');
    place(P.crate((i+r)%3),sx+2.2,T.heightAt(sx+2.2,sz+1.4),sz+1.4,r*0.7,1,'#FFFFFF');
  }
  point('market','shop',cx,cz,{y:y,r:9,label:'Lumen Market',prompt:'Browse the market'});
  /* a merchant's hall closing the north end */
  var hx=cx,hz=cz+18;
  Arch.building(b,{x:hx,y:T.heightAt(hx,hz)-0.3,z:hz,rot:Math.PI,style:'town',
    w:18,d:11,storeys:2,seed:311,shop:1,awning:'#8A5AC4',signCol:'#B269FF',sink:1.2});
  box(hx,T.heightAt(hx,hz)+3.2,hz,18,7.4,11,0,'building');
  ringScatter(b,cx,cz,15,19,7,53,function(x,z,rng,a){
    place(P.lamp('plaza'),x,T.heightAt(x,z),z,a,1,'#FFFFFF');
  });
}

function dressHarbour(b){
  var pad=T.pad('harbour'),cx=pad.x,cz=pad.z,y=pad.y;

  /* The deck: a plank platform out over the water, plus its pilings.
     Registered walkable so the player stands on it rather than on the
     seabed underneath. */
  var deck=Geo.build();
  deck.mat('deck');
  var dw=44,dd=16;
  deck.push();deck.translate(cx,y,cz-6);
  deck.chamfer(0,0,0,dw,0.5,dd,'#B49274',0.08,{uvScale:0.6});
  deck.pop();
  W.statics.push(deck.upload());
  box(cx,y-0.25,cz-6,dw,0.5,dd,0,'deck');
  W.boxes[W.boxes.length-1].walkable=true;

  for(var i=0;i<14;i++){
    var px=cx-dw/2+2+ (i%7)*(dw-4)/6;
    var pz=cz-6+(i<7?-1:1)*(dd/2-1);
    place(P.piling(),px,y-4.4,pz,0,1,'#FFFFFF');
  }
  /* a finger jetty running further out */
  var jetty=Geo.build();
  jetty.mat('deck');
  jetty.push();jetty.translate(cx+18,y,cz-24);
  jetty.chamfer(0,0,0,7,0.5,26,'#AC8A6C',0.06,{uvScale:0.6});
  jetty.pop();
  W.statics.push(jetty.upload());
  box(cx+18,y-0.25,cz-24,7,0.5,26,0,'deck');
  W.boxes[W.boxes.length-1].walkable=true;
  for(var j=0;j<8;j++){
    place(P.piling(),cx+18+(j%2?3:-3),y-4.4,cz-34+((j/2)|0)*8,0,1,'#FFFFFF');
  }

  /* boats moored along the jetty */
  for(var bt=0;bt<5;bt++){
    var bx=cx+18+(bt%2?6.0:-6.0);
    var bz=cz-34+((bt/2)|0)*9;
    place(P.boat(bt),bx,T.SEA-0.55,bz,(bt%2?0.10:-0.10)+Math.PI/2,1,'#FFFFFF');
  }

  /* fishing shacks facing the water */
  var shacks=[[-18,4,-0.30],[-6,6,0],[8,5,0.24]];
  for(var s=0;s<shacks.length;s++){
    var sx=cx+shacks[s][0], sz=cz+shacks[s][1];
    Arch.building(b,{x:sx,y:y-0.3,z:sz,rot:shacks[s][2],style:'harbour',
      w:8,d:7,storeys:1,seed:401+s*11,shop:s===1,
      awning:'#2E8FA8',signCol:'#5BE8FF',sink:1.0});
    box(sx,y+1.9,sz,8,4.6,7,shacks[s][2],'building');
  }
  point('fishing','fish',cx+18,cz-30,{y:y,r:12,
    label:'Harbour Water',prompt:'Cast a line'});
  point('fishmonger','shop',cx-6,cz+3,{y:y,r:3.2,
    label:'Fishmonger',prompt:'Sell your catch'});

  for(var l=0;l<8;l++){
    place(P.lamp('harbour'),cx-24+l*7,y,cz-15,l%2?Math.PI:0,1,'#FFFFFF');
  }
  for(var bl=0;bl<10;bl++){
    place(P.bollard(),cx-22+bl*5,y,cz+3.4,0,1,'#FFFFFF');
  }
  for(var cr=0;cr<9;cr++){
    var rx=cx-20+cr*5.2, rz=cz+1.2+(cr%2)*1.4;
    place(P.crate(cr%3),rx,y,rz,cr*0.7,1,'#FFFFFF');
    if(cr%3===0)place(P.barrel(),rx+1.6,y,rz-1.0,0,1,'#FFFFFF');
  }
}

function dressMissions(b){
  var pad=T.pad('missions'),cx=pad.x,cz=pad.z,y=pad.y;
  place(P.missionBoard(),cx,y,cz-4,0,1,'#FFFFFF');
  box(cx,y+1.6,cz-4,3.8,3.2,0.6,0,'board');
  point('missions','missions',cx,cz-1.6,{y:y,r:3.6,
    label:'Mission Board',prompt:'Read the board'});
  Arch.building(b,{x:cx-9,y:y-0.3,z:cz+8,rot:0.5,style:'industrial',
    w:12,d:10,storeys:2,seed:503,sink:1.2});
  box(cx-9,y+3.2,cz+8,12,7.4,10,0.5,'building');
  Arch.building(b,{x:cx+10,y:y-0.3,z:cz+6,rot:-0.35,style:'modern',
    w:10,d:9,storeys:3,seed:509,sink:1.2});
  box(cx+10,y+4.8,cz+6,10,10.5,9,-0.35,'building');
  for(var i=0;i<6;i++){
    var a=i/6*M.TAU;
    place(P.lamp('plaza'),cx+Math.cos(a)*13,T.heightAt(cx+Math.cos(a)*13,cz+Math.sin(a)*13),
      cz+Math.sin(a)*13,a,1,'#FFFFFF');
  }
  place(P.signpost(),cx+6,y,cz-8,-0.5,1,'#FFFFFF');
}

function dressGarage(b){
  var pad=T.pad('garage'),cx=pad.x,cz=pad.z,y=pad.y;
  Arch.building(b,{x:cx,y:y-0.3,z:cz+7,rot:Math.PI,style:'industrial',
    w:16,d:11,storeys:1,storeyH:4.6,roof:'flat',seed:601,shop:1,
    awning:'#4A5462',signCol:'#F5A03C',sink:1.2});
  box(cx,y+2.5,cz+7,16,5.6,11,0,'building');
  point('garage','vehicles',cx,cz+1,{y:y,r:5,
    label:'Harbour Garage',prompt:'View vehicles'});
  for(var i=0;i<6;i++){
    place(P.bollard(),cx-9+i*3.6,y,cz-6,0,1,'#F5A03C');
  }
  for(var j=0;j<4;j++){
    place(P.crate(j%3),cx-11+j*2.0,y,cz+13,j*0.5,1,'#FFFFFF');
  }
  place(P.lamp('plaza'),cx-10,y,cz+2,0,1,'#FFFFFF');
  place(P.lamp('plaza'),cx+10,y,cz+2,0,1,'#FFFFFF');
}

function dressPlots(b){
  var pad=T.pad('plots'),cx=pad.x,cz=pad.z,y=pad.y;
  /* Six marked plots the player can build on. A low kerb and a lit
     marker post: enough to say "this is yours" without walling it in. */
  var kerb=Geo.build();
  for(var i=0;i<6;i++){
    var px=cx-16+(i%3)*16, pz=cz-9+((i/3)|0)*18;
    kerb.mat('concrete');
    var w=13,d=13,t=0.5;
    var sides=[[0,d/2],[0,-d/2],[w/2,0],[-w/2,0]];
    for(var s=0;s<4;s++){
      var S=sides[s],horiz=s<2;
      kerb.push();
      kerb.translate(px+S[0],T.heightAt(px+S[0],pz+S[1])+0.12,pz+S[1]);
      kerb.chamfer(0,0,0,horiz?w:t,0.24,horiz?t:d,'#7E868F',0.05);
      kerb.pop();
    }
    place(P.signpost(),px-w/2+0.6,T.heightAt(px-w/2+0.6,pz-d/2+0.6),pz-d/2+0.6,
      0.8,0.85,'#FFFFFF');
    /* Two radii: the prompt only appears when you are close enough to
       mean it, but the buildable area covers the whole kerb the game
       drew — a plot you cannot build to the edge of is a plot with an
       invisible second boundary. */
    point('plot'+i,'plot',px,pz,{y:T.heightAt(px,pz),r:5,
      label:'Building Plot '+(i+1),prompt:'Claim this plot',
      data:{plot:i,buildR:9.4}});
  }
  W.statics.push(kerb.upload());
}

function dressQuarry(b){
  var pad=T.pad('quarry'),cx=pad.x,cz=pad.z,y=pad.y;
  /* The mining face: boulders piled against the cliff, and a mouth
     into the rock. */
  ringScatter(b,cx,cz,4,20,42,701,function(x,z,rng){
    place(P.rock((rng()*4)|0),x,T.heightAt(x,z)-0.3,z,rng()*6.28,
      0.8+rng()*2.4,'#FFFFFF');
  });
  var mouth=Geo.build();
  mouth.mat('cliff');
  mouth.push();mouth.translate(cx,y,cz+20);
  /* an arch of rock over a dark opening */
  for(var i=0;i<=14;i++){
    var a=Math.PI*(i/14);
    mouth.push();
    mouth.translate(Math.cos(a)*4.4,Math.sin(a)*4.4,0);
    mouth.rotate(0,0,a);
    mouth.chamfer(0,0,0,2.2,1.8,4.0,i%2?'#7E7466':'#6A6255',0.2);
    mouth.pop();
  }
  mouth.mat('blank');
  mouth.push();mouth.translate(0,2.0,-1.6);
  mouth.chamfer(0,0,0,7.4,4.4,0.6,'#0A0C10',0.1,{noBand:true});
  mouth.pop();
  mouth.pop();
  W.statics.push(mouth.upload());
  point('mine','mine',cx,cz+16,{y:y,r:6,
    label:'Quarry Face',prompt:'Mine here'});
  for(var c=0;c<6;c++)
    place(P.crate(c%3),cx-6+c*2.4,T.heightAt(cx-6+c*2.4,cz-6),cz-6,c*0.6,1,'#FFFFFF');
  place(P.lamp('plaza'),cx-8,y,cz+8,0,1,'#FFFFFF');
  place(P.lamp('plaza'),cx+8,y,cz+8,0,1,'#FFFFFF');
}

function dressArena(b){
  var pad=T.pad('arena'),cx=pad.x,cz=pad.z,y=pad.y;
  var ring=Geo.build();
  ring.mat('concrete');
  /* tiered seating as concentric rings */
  for(var t=0;t<4;t++){
    ring.push();ring.translate(cx,y+t*0.9,cz);
    ring.loft([
      {y:0,  pts:Geo.circle(15+t*2.2,26)},
      {y:0.9,pts:Geo.circle(15+t*2.2,26)}
    ],t%2?'#7A828E':'#6E7682',{openTop:true,openBottom:true});
    ring.pop();
  }
  W.statics.push(ring.upload());
  for(var i=0;i<8;i++){
    var a=i/8*M.TAU;
    place(P.lamp('plaza'),cx+Math.cos(a)*22,T.heightAt(cx+Math.cos(a)*22,cz+Math.sin(a)*22),
      cz+Math.sin(a)*22,a,1.2,'#FFFFFF');
  }
  point('arena','arena',cx,cz,{y:y,r:10,label:'The Arena',prompt:'Enter the arena'});
}

/* ---------------- wilderness ---------------- */
function scatterNature(){
  var rng=M.rng(1234);
  var tries=34000;
  for(var i=0;i<tries;i++){
    var x=(rng()-0.5)*T.SIZE*0.96;
    var z=(rng()-0.5)*T.SIZE*0.96;
    var h=T.heightAt(x,z);
    if(h<0.6||h>46)continue;                 /* not in the sea or on ice */
    if(T.flatAt(x,z)>0.42)continue;          /* not on a district pad    */
    var slope=T.slopeAt(x,z);
    if(slope>0.95)continue;                  /* not on a bare cliff face */

    var r=rng();
    /* Bands: palms along the beach, broadleaf on the low ground,
       pine on the highland, blossom in a grove to the west. */
    if(h<2.0){
      if(r<0.12)place(P.tree('palm',(rng()*4)|0),x,h-0.2,z,rng()*6.28,
        0.9+rng()*0.4,'#FFFFFF');
      else if(r<0.34)place(P.grassTuft((rng()*3)|0),x,h,z,rng()*6.28,
        0.8+rng()*0.6,'#C8C08A');
      else if(r<0.40)place(P.rock((rng()*4)|0),x,h-0.3,z,rng()*6.28,
        0.4+rng()*0.7,'#C0B49C');
    }else if(h>26){
      if(r<0.34)place(P.tree('pine',(rng()*4)|0),x,h-0.2,z,rng()*6.28,
        0.85+rng()*0.5,'#FFFFFF');
      else if(r<0.42)place(P.rock((rng()*4)|0),x,h-0.4,z,rng()*6.28,
        0.7+rng()*1.5,'#FFFFFF');
      else if(r<0.60)place(P.bush((rng()*3)|0),x,h,z,rng()*6.28,
        0.8+rng()*0.5,'#7E9464');
    }else{
      var west=x<-30&&z>-20&&z<50;
      if(r<0.20)place(P.tree(west?'blossom':'broadleaf',(rng()*4)|0),
        x,h-0.2,z,rng()*6.28,0.85+rng()*0.55,'#FFFFFF');
      else if(r<0.26)place(P.tree('pine',(rng()*4)|0),x,h-0.2,z,rng()*6.28,
        0.8+rng()*0.4,'#FFFFFF');
      else if(r<0.30)place(P.tree('dead',(rng()*4)|0),x,h-0.2,z,rng()*6.28,
        0.8+rng()*0.4,'#9A9080');
      else if(r<0.52)place(P.bush((rng()*3)|0),x,h,z,rng()*6.28,
        0.75+rng()*0.6,'#FFFFFF');
      else if(r<0.86)place(P.grassTuft((rng()*3)|0),x,h,z,rng()*6.28,
        0.7+rng()*0.7,'#FFFFFF');
      else place(P.rock((rng()*4)|0),x,h-0.3,z,rng()*6.28,
        0.35+rng()*0.8,'#FFFFFF');
    }
  }
}

/* ---------------- sky islands ----------------
   The harbour sits under a scatter of floating islands: rock keels
   hanging under grass caps, a few of them pouring water off an edge
   into nothing. They exist for the silhouette. Nothing stands on them
   and nothing walks there — they are the reason a screenshot taken
   anywhere on the island has something happening above the horizon.

   Built as one merged static mesh rather than instanced props: props
   are culled around the camera at tens of metres, and these live two
   to three hundred metres out. */
W.isles=[];            /* {x,y,z,r} — read by the waterfall builder */

/* A closed noisy ring, used as every loft section of a keel so the
   rock reads as eroded rather than turned on a lathe. */
function isleRing(seg,seed){
  var pts=[],rng=M.rng(seed);
  var wob=[];
  for(var i=0;i<seg;i++)wob.push(0.62+rng()*0.66);
  /* smooth the wobble once around the loop, or neighbouring vertices
     disagree so hard the normals shatter */
  for(var k=0;k<1;k++){
    var out=[];
    for(var j=0;j<seg;j++){
      out.push((wob[(j-1+seg)%seg]+wob[j]*2+wob[(j+1)%seg])/4);
    }
    wob=out;
  }
  for(var t=0;t<seg;t++){
    var a=t/seg*Math.PI*2,rr=wob[t];
    pts.push([Math.cos(a)*rr,Math.sin(a)*rr]);
  }
  return pts;
}

function isleTree(b,x,y,z,h,rng){
  var tr=h*0.085;
  b.mat('bark');
  b.cylinder(x,y+h*0.22,z,tr,tr*0.7,h*0.44,6,'#6B5340');
  b.mat('foliage');
  var tint=rng()<0.22?'#9FD08A':'#FFFFFF';
  b.cylinder(x,y+h*0.60,z,h*0.30,h*0.05,h*0.44,7,tint);
  b.cylinder(x,y+h*0.86,z,h*0.20,0.01,h*0.34,7,tint);
}

function buildSkyIsles(){
  var b=Geo.build();
  var rng=M.rng(90210);
  var N=12;
  for(var k=0;k<N;k++){
    /* Spread by angle so no two crowd the same bearing, then jitter. */
    var ang=(k/N)*Math.PI*2+rng()*0.5;
    /* Every third one comes in close, so there is something overhead
       from the plaza rather than only a distant band. */
    var near=(k%3===0);
    var dist=near?(120+rng()*60):(190+rng()*150);
    var cx=Math.cos(ang)*dist, cz=Math.sin(ang)*dist;
    var r=near?(15+rng()*11):(19+rng()*24);
    /* Height is derived, not rolled. A keel hangs 1.72 island-radii
       below the grass, so a big island placed at a small height puts
       its point through the rooftops — which is exactly what happened
       when this was two independent random numbers. */
    var cy=r*1.72+(near?26:38)+rng()*34;
    W.isles.push({x:cx,y:cy,z:cz,r:r});

    var seg=16, ring=isleRing(seg,1000+k*37);
    b.push();b.translate(cx,cy,cz);

    /* Keel: eight sections down to a blunt point. Each section gets its
       own ring rather than a scaled copy of one — a single ring scaled
       down is a cone, and a cone is exactly what a floating island must
       not look like. Different rings make the cross-section wander, so
       the silhouette breaks up on the way down. Alternating section
       colours read as strata. */
    /* A little self-lighting: every face of a keel points down or
       outward, so hemisphere ambient alone leaves it a flat grey
       cut-out. 0.10 is enough to keep the strata readable without the
       rock looking like it is glowing. */
    b.mat('cliff',0.10);b.mat2('dirt',0.30);
    var strata=['#E4D6BE','#C9B79C','#DACAAF','#B4A188','#CBB99B',
                '#9F8D74','#B3A187'];
    var prof=[[0,1.00],[-0.16,0.99],[-0.34,0.90],[-0.55,0.80],
              [-0.80,0.62],[-1.08,0.42],[-1.38,0.22],[-1.72,0.05]];
    var keel=[];
    for(var ks=0;ks<prof.length;ks++){
      keel.push({y:prof[ks][0]*r,
        pts:ks===0?ring:isleRing(seg,1000+k*37+ks*211),
        scale:r*prof[ks][1],
        col:ks?strata[(ks-1)%strata.length]:undefined});
    }
    /* listed top-down: loft() reads the direction and winds to match */
    b.loft(keel,'#C9C0B2',{openTop:true});

    /* A couple of spurs hanging off the keel — the shapes that stop it
       reading as one solid mass when it is silhouetted against sky. */
    for(var sp=0;sp<3;sp++){
      var sa=rng()*Math.PI*2, sy=-r*(0.30+rng()*0.65);
      var sr=r*(0.55-Math.abs(sy)/r*0.28)*(0.7+rng()*0.3);
      b.push();
      b.translate(Math.cos(sa)*sr,sy,Math.sin(sa)*sr);
      b.rotate((rng()-0.5)*0.7,rng()*6.28,(rng()-0.5)*0.7);
      b.sphere(0,0,0,r*(0.13+rng()*0.11),7,5,strata[(sp*2)%strata.length],
        {squash:1.7+rng()});
      b.pop();
    }

    /* cap: soil rim under a grass crown */
    b.mat('dirt');
    b.loft([{y:0,pts:ring,scale:r},
            {y:r*0.055,pts:ring,scale:r*0.995}],'#8A7358',{openTop:true,openBottom:true});
    b.mat('grass');
    b.loft([{y:r*0.05,pts:ring,scale:r*0.995},
            {y:r*0.13,pts:ring,scale:r*0.90},
            {y:r*0.17,pts:ring,scale:r*0.62}],'#FFFFFF',{openBottom:true});
    b.disc(0,r*0.17,0,r*0.62,seg,'#FFFFFF');

    /* dressing: trees around the rim, a boulder or two, and on the
       nearer islands a lit crystal so they carry after dark */
    var trees=3+((rng()*5)|0);
    for(var t=0;t<trees;t++){
      var ta=rng()*Math.PI*2, td=r*(0.15+rng()*0.55);
      isleTree(b,Math.cos(ta)*td,r*0.15,Math.sin(ta)*td,r*(0.30+rng()*0.26),rng);
    }
    b.mat('stone');
    for(var q=0;q<2;q++){
      var qa=rng()*Math.PI*2,qd=r*(0.2+rng()*0.5);
      b.sphere(Math.cos(qa)*qd,r*0.14,Math.sin(qa)*qd,r*(0.05+rng()*0.07),
        7,5,'#FFFFFF',{squash:0.6});
    }
    /* Outcrops on the rim. Grass and rock otherwise meet along one clean
       circle the whole way round, which is the tell that this is a lathe
       and not a piece of ground that broke off something. */
    b.mat('cliff',0.06);
    for(var e=0;e<5;e++){
      var ea=rng()*Math.PI*2;
      var er=r*(0.86+rng()*0.16);
      b.push();
      b.translate(Math.cos(ea)*er,r*(0.02+rng()*0.10),Math.sin(ea)*er);
      b.rotate((rng()-0.5)*0.5,ea,(rng()-0.5)*0.5);
      b.sphere(0,0,0,r*(0.11+rng()*0.09),7,5,'#C3B49C',{squash:0.55});
      b.pop();
    }
    if(rng()<0.62){
      b.mat('crystal',0.85);
      var ca=rng()*Math.PI*2,cd=r*0.32;
      var chx=Math.cos(ca)*cd,chz=Math.sin(ca)*cd,ch=r*(0.22+rng()*0.2);
      b.cylinder(chx,r*0.16+ch*0.5,chz,r*0.07,0.02,ch,6,'#7FE6FF');
      W.lights.push({x:cx+chx,y:cy+r*0.16+ch*0.5,z:cz+chz,r:r*1.1,
        col:[0.34,0.82,1.00],power:0.9,always:true});
    }
    b.pop();
  }
  W.statics.push(b.upload());
}

/* Waterfalls hang off three of the islands. They are their own mesh so
   the draw can scroll their UVs — see W.drawFalls. */
function buildFalls(){
  var b=Geo.build();
  b.mat('water',0.10);
  var rng=M.rng(5150);
  for(var i=0;i<W.isles.length;i++){
    if(rng()>0.58)continue;
    var I=W.isles[i];
    var a=rng()*Math.PI*2;
    var ox=Math.cos(a)*I.r*0.80, oz=Math.sin(a)*I.r*0.80;
    var w=I.r*(0.34+rng()*0.24);
    /* Long enough to read as a fall rather than a dribble, but stopping
       well above the sea — it breaks up in the air, which is both
       cheaper and more interesting than meeting the water. Kept short
       relative to its width: a narrow ribbon dropped sixty metres
       reads as a blue pipe rather than as water. */
    var drop=I.y-(15+rng()*20);
    b.push();
    b.translate(I.x+ox,0,I.z+oz);
    b.rotate(0,a+Math.PI/2,0);
    /* Four tapering panels stacked down the fall. Splitting it lets the
       ribbon narrow and drift sideways instead of hanging as one slab. */
    var y0=I.y+I.r*0.05, seg=6, drift=0;
    for(var s2=0;s2<seg;s2++){
      var f0=s2/seg,f1=(s2+1)/seg;
      var yA=y0-(y0-drop)*f0, yB=y0-(y0-drop)*f1;
      /* Water spreads as it falls, so the ribbon widens rather than
         tapering, and leans a little further out each section. */
      var wA=w*(0.68+f0*0.62), wB=w*(0.68+f1*0.62);
      var dA=drift, dB=drift+w*(0.06+f1*0.14); drift=dB;
      var c='#DCF2FF';
      var vrep=(y0-drop)/2.4;
      var uA=f0*vrep,uB=f1*vrep;
      var v0=b.vert(-wA/2+dA,yA,0, 0,0,1, 0,uA, [0.74,0.86,0.94]);
      var v1=b.vert( wA/2+dA,yA,0, 0,0,1, 1,uA, [0.74,0.86,0.94]);
      var v2=b.vert( wB/2+dB,yB,0, 0,0,1, 1,uB, [1.0,1.0,1.0]);
      var v3=b.vert(-wB/2+dB,yB,0, 0,0,1, 0,uB, [1.0,1.0,1.0]);
      b.quad(v0,v1,v2,v3);
      b.quad(v0,v3,v2,v1);     /* backside, so it reads from any bearing */
    }
    /* The burst where it breaks up, plus a thinner veil of spray back
       up the lower third — a fall that simply stops at a cloud of
       spheres reads as a ribbon with a full stop on the end. */
    b.mat('blank',0.30);
    for(var m2=0;m2<10;m2++){
      b.sphere(drift+(rng()-0.5)*w*2.0,drop+(rng()-0.25)*w*1.5,
        (rng()-0.5)*w*1.2,w*(0.28+rng()*0.38),7,5,'#E8F6FF',{squash:0.65});
    }
    for(var m3=0;m3<7;m3++){
      var ft=0.55+rng()*0.42;
      b.sphere(drift*ft+(rng()-0.5)*w*1.1,y0-(y0-drop)*ft,
        (rng()-0.5)*w*0.7,w*(0.10+rng()*0.16),6,4,'#DCEEFF',{squash:0.8});
    }
    b.pop();
  }
  W.falls=b.upload();
}

/* ---------------- ground clutter ----------------
   Wildflowers scattered across the lawns, following the camera.

   This started as grass blades and they were wrong — not buggy,
   wrong. A field of thin blades needs density this budget cannot
   reach, and at reachable density it reads as dirt on the lawn rather
   than grass growing out of it. Worse, the ink pass outlines every
   blade, so each tuft came back as a black speck. Flat, clean ground
   is also what the games this one is aimed at actually have.

   Flowers work where grass did not, for the same reason: they are
   meant to be sparse. A hundred and fifty bright dots read as a
   meadow; a hundred and fifty grass tufts read as neglect. And an
   inked flower looks like a drawing of a flower.

   Placement is a pure function of the grid cell — hash it for a
   jittered position, ask the terrain what it is made of, keep it if
   the answer is grass — so walking away and coming back finds the
   field exactly where it was left. */
var clutter=null;
var CLUT_CELL=2.10, CLUT_RAD=26, CLUT_MAX=760;
var clutCX=1e9, clutCZ=1e9;

/* A flower: two leaves, a stem, five petals and a centre. The petals
   are the only part that takes the instance tint — the leaves and stem
   are painted green in the mesh, so one mesh can be every colour of
   flower without the foliage turning pink with it. */
function buildClutterMesh(){
  var b=Geo.build();
  var leaf=Geo.col3('#7FBE55'), stem=Geo.col3('#6FAD4A');

  b.mat('foliage');b.mat2('blank',0.45);
  /* leaves at the base, splayed */
  for(var l=0;l<2;l++){
    b.push();b.rotate(0,l*2.2+0.4,0);
    b.push();b.translate(0.035,0.018,0);b.rotate(0,0,-0.9);
    b.sphere(0,0,0,0.030,7,5,leaf,{squash:0.22});
    b.pop();b.pop();
  }
  b.mat('blank');
  b.cylinder(0,0.075,0,0.0075,0.0055,0.15,5,stem);

  /* The head. Petals are tinted white so the per-instance colour is
     what decides whether this is a daisy or a poppy. */
  b.push();b.translate(0,0.155,0);
  var white=Geo.col3('#FFFFFF');
  for(var i=0;i<5;i++){
    var a=i/5*6.2832;
    b.push();
    b.translate(Math.cos(a)*0.030,0,Math.sin(a)*0.030);
    b.rotate(0,-a,0.22);
    b.sphere(0,0,0,0.026,7,5,white,{squash:0.30});
    b.pop();
  }
  b.mat('blank');
  b.sphere(0,0.006,0,0.017,7,5,Geo.col3('#FFD34D'),{squash:0.55});
  b.pop();

  clutter=b.upload(CLUT_MAX);
  clutter.key='clutter';
}

/* Petal colours. Enough range to look wild, narrow enough that a lawn
   full of them still reads as one meadow. */
var BLOOM=[[1.00,1.00,1.00],[1.00,0.86,0.36],[1.00,0.62,0.72],
           [0.72,0.66,1.00],[1.00,0.74,0.42],[0.98,0.98,0.86]];

var _cm=M.m4(),_ct=M.v3(),_cs=M.v3(1,1,1);
W.refreshClutter=function(px,pz,force){
  if(!clutter)return;
  var dx0=px-clutCX, dz0=pz-clutCZ;
  /* Rebuilding every frame would cost more than drawing it. Three
     metres of travel is well inside the edge fade, so nothing pops. */
  if(!force&&dx0*dx0+dz0*dz0<9)return;
  clutCX=px;clutCZ=pz;

  var grass=LH.Tex.layer('grass');
  var d=clutter.idata, n=0, R2=CLUT_RAD*CLUT_RAD;
  var i0=Math.floor((px-CLUT_RAD)/CLUT_CELL), i1=Math.floor((px+CLUT_RAD)/CLUT_CELL);
  var j0=Math.floor((pz-CLUT_RAD)/CLUT_CELL), j1=Math.floor((pz+CLUT_RAD)/CLUT_CELL);
  for(var j=j0;j<=j1&&n<CLUT_MAX;j++){
    for(var i=i0;i<=i1&&n<CLUT_MAX;i++){
      var h3=M.hash2(i,j,41);
      if(h3>0.52)continue;                 /* wildflowers, not turf */
      var x=(i+0.5+(M.hash2(i,j,17)-0.5)*0.92)*CLUT_CELL;
      var z=(j+0.5+(M.hash2(i,j,29)-0.5)*0.92)*CLUT_CELL;
      var dx=x-px, dz=z-pz, dd=dx*dx+dz*dz;
      if(dd>R2)continue;
      if(T.matAt(x,z)!==grass)continue;
      if(T.slopeAt(x,z)>1.0)continue;
      var y=T.heightAt(x,z);
      if(y<0.35)continue;                  /* not in the surf */
      /* Shrink toward the edge of the field instead of cutting off.
         A tuft that fades to nothing is invisible arriving; one that
         appears at full size is a pop. */
      var edge=1-M.smooth(M.clamp((dd/R2-0.62)/0.38,0,1));
      if(edge<=0.02)continue;
      var sc=(1.15+M.hash2(i,j,53)*0.75)*edge;
      M.set3(_ct,x,y,z);
      M.set3(_cs,sc,sc*(0.85+M.hash2(i,j,67)*0.5),sc);
      M.fromTRS(_cm,_ct,0,M.hash2(i,j,71)*6.283,0,_cs);
      var o=n*GL.ISTRIDE;
      for(var q=0;q<16;q++)d[o+q]=_cm[q];
      /* Vary the green a little or the field reads as one decal
         repeated, which is exactly what it is. */
      var bl=BLOOM[(M.hash2(i,j,83)*BLOOM.length)|0];
      d[o+16]=bl[0];d[o+17]=bl[1];d[o+18]=bl[2];d[o+19]=0;
      n++;
    }
  }
  clutter.instances=n;
  GL.updateInstances(clutter,n);
};

W.drawClutter=function(prog){
  if(!clutter||!clutter.instances)return;
  GL.u1i(prog,'uInstanced',1);
  GL.drawInstanced(clutter,clutter.instances);
  GL.u1i(prog,'uInstanced',0);
};

/* ---------------- water ---------------- */
function buildWater(){
  var b=Geo.build();
  b.mat('water');
  /* Big enough to reach the horizon from anywhere on the island. A
     plane merely larger than the terrain ends in a visible straight
     edge with grey nothing beyond it. Subdivision stays modest — the
     swell only needs somewhere to displace near the shore. */
  b.plane(0,T.SEA,0,4200,4200,'#FFFFFF',72,180);
  W.water=b.upload();
}

/* ---------------- build ---------------- */
W.build=function(){
  var b=Geo.build();     /* one merged builder for all architecture */
  dressPlaza(b);
  dressMarket(b);
  dressHarbour(b);
  dressMissions(b);
  dressGarage(b);
  dressPlots(b);
  dressQuarry(b);
  dressArena(b);
  W.statics.push(b.upload());
  scatterNature();
  commitProps();
  if(!clutter)buildClutterMesh();
  clutCX=1e9;clutCZ=1e9;      /* force a rebuild for the new terrain */
  buildSkyIsles();
  buildFalls();
  buildWater();

  W.spawn=M.v3(T.pad('plaza').x,T.pad('plaza').y,T.pad('plaza').z+12);
};

/* ---------------- draw ---------------- */
/* The falls are the one surface in the world that flows. Scrolling the
   UV is enough — a real flow map would buy nothing at this distance. */
/* The sixteen nearest lights to wherever the camera is looking. A world
   this size holds a couple of hundred; a forward renderer can afford
   sixteen, and past about thirty metres a street lamp contributes less
   than the dither. Insertion sort into a fixed array — no allocation,
   and the list is nearly sorted from the frame before. */
var _lit=[];
W.pickLights=function(x,y,z,max){
  _lit.length=0;
  for(var i=0;i<W.lights.length;i++){
    var L=W.lights[i];
    var dx=L.x-x,dy=L.y-y,dz=L.z-z;
    var d2=dx*dx+dy*dy+dz*dz;
    if(d2>(L.r+34)*(L.r+34))continue;
    L._d=d2;
    _lit.push(L);
  }
  _lit.sort(function(a,b){return a._d-b._d;});
  if(_lit.length>max)_lit.length=max;
  return _lit;
};

W.drawFalls=function(prog,time){
  if(!W.falls)return;
  GL.u2f(prog,'uUVScroll',0,-time*0.85);
  GL.draw(W.falls);
  GL.u2f(prog,'uUVScroll',0,0);
};
W.drawStatics=function(){
  for(var i=0;i<W.statics.length;i++)GL.draw(W.statics[i]);
};

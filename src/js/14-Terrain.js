/* ============================================================
   LH.Terrain — the island.

   A heightmap sampled from deterministic noise, with district "pads"
   stamped into it: a pad flattens a disc of ground to a fixed height
   with a smooth falloff and forces its own surface material. That is
   what lets a plaza be genuinely flat and walkable while the land
   around it stays organic, without hand-authoring a mesh.

   The surface is cut into 32 m chunks so the renderer can cull it,
   and the same heightmap answers every ground query in the game —
   collision, prop placement, water depth, camera clearance.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,GL=LH.GL,Geo=LH.Geo,T={};

var SIZE=352;              /* metres across, centred on the origin */
var HALF=SIZE/2;
var CHUNK=32;              /* metres per chunk */
var RES=1;                 /* metres per heightmap sample */
var N=SIZE/RES+1;          /* samples per side */
var SEA=0;                 /* water plane height */

T.SIZE=SIZE;T.HALF=HALF;T.CHUNK=CHUNK;T.SEA=SEA;

var heights=null, mats=null, chunks=[];

/* Which place this terrain currently is. Lumen Harbor is one profile;
   a player's own world is another. Keeping them as profiles of the
   same generator means a private world gets the same chunking,
   lighting, collision and material blending for free, rather than
   being a second, thinner renderer. */
var profile={kind:'harbor'};
T.profile=function(){return profile;};
T.setProfile=function(p){profile=p||{kind:'harbor'};};

/* ---------------- district pads ----------------
   Ordered: later pads win where they overlap, so a jetty can cut into
   the beach it sits on. */
/* Spread across a shoreline at roughly 135 m. The districts have to
   occupy a modest fraction of the island: an earlier layout on a
   smaller island left the place about 85% paving, which reads as a
   car park rather than an island with a town on it. There is now
   wilderness between every pair of districts.

   The soft rings are generous because a pad meeting steep ground over
   a short distance reads as a stepped cliff at the heightmap's 1 m
   resolution. */
var PADS=[
  /* name          x     z     r    y     soft  material   */
  ['plaza',        0,   10,    26,  7.0,  32,  'tile'     ],
  ['market',      72,   26,    24, 10.0,  30,  'tilepale' ],
  ['missions',   -62,   44,    20, 15.0,  28,  'concrete' ],
  ['harbour',     -4,  -84,    30,  1.1,  26,  'deck'     ],
  ['jetty',       30, -106,    12,  1.1,   9,  'deck'     ],
  ['garage',      86,  -34,    18,  5.0,  26,  'road'     ],
  ['plots',      -86,  -20,    28,  6.5,  28,  'grass'    ],
  ['quarry',      46,   92,    22, 24.0,  32,  'gravel'   ],
  ['arena',      -40,   96,    20, 27.0,  30,  'concrete' ]
];
T.PADS=PADS;
var PAD={};
for(var pi=0;pi<PADS.length;pi++){
  PAD[PADS[pi][0]]={x:PADS[pi][1],z:PADS[pi][2],r:PADS[pi][3],y:PADS[pi][4]};
}
T.pad=function(n){return PAD[n];};

/* ---------------- the height function ----------------
   Deterministic: the island must come back identical on every load,
   so nothing here may touch Math.random(). */
/* A private world: a broad, level plateau ringed by a soft shoulder
   into the sea. Deliberately not dramatic — this is a canvas, and
   scenery you did not put there is scenery in your way. The theme
   only tilts the relief and the surface. */
function realmHeight(x,z){
  var P=profile;
  var R=P.radius||64;
  var d=Math.hypot(x,z);
  var seed=P.seed||1;
  var coast=M.fbm(x*0.010,z*0.010,seed,3)*0.16-0.08;
  var land=M.clamp(1-((d/R)+coast-0.80)/0.26,0,1);
  land=M.smooth(land);
  var relief=P.relief===undefined?1:P.relief;
  var roll=(M.fbm(x*0.020,z*0.020,seed+11,4)-0.5)*3.2*relief;
  /* The middle stays flat whatever the theme does at the edges. */
  var flat=M.smooth(M.clamp(1-(d/R)/0.62,0,1));
  roll*=1-flat*0.88;
  return -7+land*(13+roll);
}

function baseHeight(x,z){
  if(profile.kind==='realm')return realmHeight(x,z);
  var d=Math.hypot(x,z)/HALF;

  /* Island falloff. The shore is pushed outward by low-frequency noise
     so the coastline is ragged rather than a circle. Full land inside
     0.68 of the half-width, fading to sea by 0.92 — which puts the
     waterline at roughly 86 m and leaves room for all nine districts. */
  var coast=M.fbm(x*0.008,z*0.008,17,3)*0.20-0.10;
  var land=M.clamp(1-(d+coast-0.68)/0.24,0,1);
  land=M.smooth(land);

  /* Rolling ground, plus ridged noise for the southern highland. The
     highland is kept modest: a 30 m ridge next to a 6 m district pad
     makes a transition no amount of smoothing can hide. */
  var roll=M.fbm(x*0.0092,z*0.0092,3,5)*14.0;
  var ridge=M.ridge(x*0.0075,z*0.0075,29,4);
  var highland=M.clamp((z-40)/100,0,1);
  var hills=ridge*ridge*30*highland;

  var h=-9+land*(9.0+roll+hills);

  /* The bay: a crescent scooped out of the north shore, so the harbour
     has sheltered water and the town has a waterfront to face. */
  var bx=x-(-4), bz=z-(-104);
  var bd=Math.hypot(bx*0.85,bz)/66;
  var bay=M.clamp(1-bd,0,1);
  h-=M.smooth(bay)*13.0;

  /* A river channel running from the highland down into the bay,
     which is where the freshwater fishing spots live. */
  var rx=x-(-112+Math.sin(z*0.014)*22);
  var river=M.clamp(1-Math.abs(rx)/16,0,1);
  river*=M.clamp((z+46)/70,0,1)*M.clamp((130-z)/90,0,1);
  h-=M.smooth(river)*7.5;

  return h;
}

/* Stamp the pads. Returns {y, mat, flat} where flat is how strongly
   this sample is inside a pad — props use it to avoid planting a tree
   in the middle of the marketplace. */
/* Roads. A town is legible because its parts are connected; nine
   discs of paving on a green island read as a diagram. Each path
   levels the ground along its length and paints a surface, using the
   same machinery as the pads. */
var PATHS=[
  ['plaza','market',   7],
  ['plaza','harbour',  9],
  ['plaza','missions', 6],
  ['plaza','quarry',   6],
  ['market','garage',  6],
  ['missions','plots', 5],
  ['missions','arena', 5],
  ['plots','harbour',  5],
  ['quarry','arena',   5]
];
T.PATHS=PATHS;

/* Squared distance from a point to a segment, and the height the road
   should sit at there — roads ramp between their endpoints rather
   than staying level, so they climb hills instead of cutting through. */
var _seg={d:0,y:0};
function segDist(px,pz,ax,az,ay,bx,bz,by){
  var dx=bx-ax,dz=bz-az;
  var len2=dx*dx+dz*dz;
  var t=len2>0?M.clamp(((px-ax)*dx+(pz-az)*dz)/len2,0,1):0;
  var cx=ax+dx*t,cz=az+dz*t;
  _seg.d=Math.hypot(px-cx,pz-cz);
  _seg.y=ay+(by-ay)*t;
  return _seg;
}

var _res={y:0,mat:-1,matW:0,flat:0};
function stamped(x,z){
  var h=baseHeight(x,z);
  var mat=-1,matW=0,flat=0,bestW=-1;
  /* Districts and roads belong to Lumen Harbor. A private world is
     bare ground and whatever its owner has put on it. */
  if(profile.kind==='realm'){
    _res.y=h;_res.mat=-1;_res.matW=0;_res.flat=0;
    return _res;
  }
  for(var i=0;i<PADS.length;i++){
    var P=PADS[i];
    /* Perturb the radius with angle so the district is not a perfect
       circle. A disc of paving is the clearest tell that a town was
       generated rather than built. */
    var ang=Math.atan2(z-P[2],x-P[1]);
    var wob=1+ (M.noise2(Math.cos(ang)*2.4+P[1]*0.05,
                         Math.sin(ang)*2.4+P[2]*0.05,7)-0.5)*0.42;
    var d=Math.hypot(x-P[1],z-P[2])/wob;
    var r=P[3],soft=P[5];
    if(d>r+soft)continue;
    /* 1 inside the disc, easing to 0 across the soft ring */
    var w=d<=r?1:M.smooth(M.clamp(1-(d-r)/soft,0,1));
    if(w<=0)continue;
    h=M.lerp(h,P[4],w);
    /* The surface has to stop far short of where the levelling does.
       The soft ring is deliberately wide — a pad meeting steep ground
       abruptly reads as a stepped cliff — but painting across all of
       it makes every district three times its real size, and nine of
       them merge into one grey mass covering the island. Paving is
       confined to roughly the pad radius plus a quarter of the ring. */
    var sw=M.smooth(M.clamp((w-0.68)/0.24,0,1));
    /* Claim the material slot across the *whole* of the pad's
       influence, not only where the paving is visible.

       The pair of layer indices is interpolated across a triangle and
       then rounded, so two vertices that disagree about which pair
       they are blending give you a triangle blending, say, road
       against cliff — and that is the one-metre sawtooth running along
       every path edge on this island. Claiming the slot early costs
       nothing: out there the weight is still zero, so the ground draws
       pure. What it buys is that the pair stays constant across the
       transition, and only the weight moves. */
    if(w>bestW){bestW=w;matW=sw;mat=LH.Tex.layer(P[6]);}
    if(w>flat)flat=w;
  }
  /* Roads last: they cut across whatever they cross. */
  var roadL=LH.Tex.layer('road');
  for(var q=0;q<PATHS.length;q++){
    var A=PAD[PATHS[q][0]],B=PAD[PATHS[q][1]];
    if(!A||!B)continue;
    var half=PATHS[q][2]/2;
    var sd=segDist(x,z,A.x,A.z,A.y,B.x,B.z,B.y);
    var shoulder=5;
    if(sd.d>half+shoulder)continue;
    /* a slight camber, and shoulders that ease into the ground */
    var w2=M.smooth(M.clamp(1-(sd.d-half)/shoulder,0,1));
    if(w2<=0)continue;
    h=M.lerp(h,sd.y-0.12,w2*0.92);
    var sw2=M.smooth(M.clamp((w2-0.55)/0.30,0,1));
    /* `>=` rather than `>`: roads cut across whatever they cross, so
       where a road shoulder and a district edge claim the same ground
       at equal strength the road wins. */
    if(w2>=bestW){bestW=w2;matW=sw2;mat=roadL;}
    if(w2>flat)flat=w2;
  }
  _res.y=h;_res.mat=mat;_res.matW=matW;_res.flat=flat;
  return _res;
}

/* Surface material where no pad claims it, returned as a blended pair.
   Slope matters more than height — a steep face is rock whatever
   altitude it sits at — so the slope transition takes the two blend
   slots when it is active, and the height bands take them otherwise.
   A vertex is almost never mid-transition in both at once. */
var BANDS=[
  {upTo: 1.1, mat:'sand' },
  {upTo: 3.0, mat:'sand' },
  {upTo:30.0, mat:'grass'},
  {upTo:44.0, mat:'stone'},
  {upTo:1e9,  mat:'snow' }
];
/* A realm's theme swaps the ground band it is mostly made of. */
var THEME_BANDS={
  meadow:'grass', dunes:'sand', tundra:'snow', basalt:'stone',
  garden:'grass', works:'concrete'
};
T.THEMES=Object.keys(THEME_BANDS);
var _sm={a:0,b:0,w:0};
function naturalMat(y,slope){
  if(profile.kind==='realm'){
    var main=LH.Tex.layer(THEME_BANDS[profile.theme]||'grass');
    if(y<1.0){_sm.a=LH.Tex.layer('sand');_sm.b=main;
      _sm.w=M.smooth(M.clamp((y-0.2)/0.8,0,1));return _sm;}
    var rw=M.smooth(M.clamp((slope-0.44)/0.30,0,1));
    _sm.a=main;_sm.b=LH.Tex.layer('cliff');_sm.w=rw;
    return _sm;
  }
  var rockW=M.smooth(M.clamp((slope-0.40)/0.30,0,1));

  /* which height band, and how far into the boundary above it */
  var i=0;
  while(i<BANDS.length-1&&y>BANDS[i].upTo)i++;
  var a=LH.Tex.layer(BANDS[i].mat);
  var b=a,w=0;
  if(i<BANDS.length-1){
    var edge=BANDS[i].upTo, zone=(i===0)?0.9:2.6;
    var t=M.clamp((y-(edge-zone))/zone,0,1);
    if(t>0){b=LH.Tex.layer(BANDS[i+1].mat);w=M.smooth(t);}
  }
  /* Below the waterline everything is wet sand regardless of band. */
  if(y<0.2){a=LH.Tex.layer('sand');b=a;w=0;}

  if(rockW>0.015){
    /* the dominant band material carries into the rock transition */
    var band=(w>0.5)?b:a;
    _sm.a=band;_sm.b=LH.Tex.layer('cliff');_sm.w=rockW;
  }else{
    _sm.a=a;_sm.b=b;_sm.w=w;
  }
  return _sm;
}

/* ---------------- build ---------------- */
var matsB=null, matsW=null;
T.generate=function(){
  heights=new Float32Array(N*N);
  mats=new Int16Array(N*N);
  matsB=new Int16Array(N*N);
  matsW=new Float32Array(N*N);
  var padMat=new Int16Array(N*N), padW=new Float32Array(N*N);
  var i,j;
  for(j=0;j<N;j++)for(i=0;i<N;i++){
    var x=-HALF+i*RES,z=-HALF+j*RES;
    var r=stamped(x,z);
    heights[j*N+i]=r.y;
    padMat[j*N+i]=r.mat;
    padW[j*N+i]=r.matW;
  }
  /* Second pass for the surface: slope needs neighbours, so it cannot
     be done in the same loop as the heights. */
  for(j=0;j<N;j++)for(i=0;i<N;i++){
    var k=j*N+i;
    var hL=heights[j*N+Math.max(0,i-1)],hR=heights[j*N+Math.min(N-1,i+1)];
    var hD=heights[Math.max(0,j-1)*N+i],hU=heights[Math.min(N-1,j+1)*N+i];
    var slope=Math.hypot(hR-hL,hU-hD)/(2*RES);
    var nat=naturalMat(heights[k],slope);
    if(padMat[k]>=0){
      /* Inside a district *or anywhere it has influence*: the paving is
         the primary and the natural ground is what it fades into.

         The condition used to be `padW>0.002` — only where the paving
         is actually visible — and that is what put the coloured
         sawtooth along every path edge on this island. The layer index
         is interpolated across a triangle and then rounded, so a
         triangle whose two ends disagree about the primary sweeps the
         rounded index through *every layer between them in the atlas*:
         at a road-to-grass edge that is brick, roof, foliage and
         blossom, one metre at a time. Claiming the slot across the
         whole influence costs nothing — out there the weight is 1, so
         it draws pure ground — and it keeps the pair constant so only
         the weight moves. */
      mats[k]=padMat[k];
      matsB[k]=(nat.w>0.5)?nat.b:nat.a;
      matsW[k]=1-padW[k];
    }else{
      mats[k]=nat.a;matsB[k]=nat.b;matsW[k]=nat.w;
    }
  }
  T.heights=heights;T.mats=mats;T.matsB=matsB;T.matsW=matsW;T.N=N;
};

/* Bilinear height lookup. Every ground query in the game lands here,
   so it avoids allocation and clamps rather than branching on bounds. */
T.heightAt=function(x,z){
  if(!heights)return 0;
  var fx=(x+HALF)/RES, fz=(z+HALF)/RES;
  if(fx<0)fx=0;if(fz<0)fz=0;
  if(fx>N-1.001)fx=N-1.001;if(fz>N-1.001)fz=N-1.001;
  var i=fx|0, j=fz|0, tx=fx-i, tz=fz-j;
  var h00=heights[j*N+i], h10=heights[j*N+i+1];
  var h01=heights[(j+1)*N+i], h11=heights[(j+1)*N+i+1];
  return (h00*(1-tx)+h10*tx)*(1-tz)+(h01*(1-tx)+h11*tx)*tz;
};

T.normalAt=function(out,x,z){
  var e=0.6;
  var hL=T.heightAt(x-e,z),hR=T.heightAt(x+e,z);
  var hD=T.heightAt(x,z-e),hU=T.heightAt(x,z+e);
  M.set3(out,-(hR-hL)/(2*e),1,-(hU-hD)/(2*e));
  return M.norm3(out,out);
};
T.slopeAt=function(x,z){
  var e=0.8;
  var hL=T.heightAt(x-e,z),hR=T.heightAt(x+e,z);
  var hD=T.heightAt(x,z-e),hU=T.heightAt(x,z+e);
  return Math.hypot(hR-hL,hU-hD)/(2*e);
};
T.flatAt=function(x,z){return stamped(x,z).flat;};
/* Which material the ground is made of at a point. The surface grid is
   one sample per metre, which is all anything asking this needs. */
T.matAt=function(x,z){
  if(!T.mats)return 0;
  var i=Math.round(x+T.HALF), j=Math.round(z+T.HALF);
  i=M.clamp(i,0,T.N-1);j=M.clamp(j,0,T.N-1);
  return T.mats[j*T.N+i];
};
T.inBounds=function(x,z){return x>-HALF&&x<HALF&&z>-HALF&&z<HALF;};

/* ---------------- meshing ---------------- */
T.buildChunks=function(){
  /* Regeneration is a real operation now — entering a private world
     rebuilds the whole surface — so the previous chunks have to be
     released rather than leaked. */
  for(var f=0;f<chunks.length;f++)GL.freeMesh(chunks[f]);
  chunks.length=0;
  var per=CHUNK/RES;
  var cn=SIZE/CHUNK;
  for(var cz=0;cz<cn;cz++)for(var cx=0;cx<cn;cx++){
    var ox=-HALF+cx*CHUNK, oz=-HALF+cz*CHUNK;
    var b=Geo.build();
    var base=b.n;
    var minY=1e9,maxY=-1e9;
    var gi,gj;
    for(gj=0;gj<=per;gj++)for(gi=0;gi<=per;gi++){
      var si=cx*per+gi, sj=cz*per+gj;
      if(si>N-1)si=N-1;if(sj>N-1)sj=N-1;
      var k=sj*N+si;
      var h=heights[k];
      if(h<minY)minY=h;if(h>maxY)maxY=h;
      var hL=heights[sj*N+Math.max(0,si-1)],hR=heights[sj*N+Math.min(N-1,si+1)];
      var hD=heights[Math.max(0,sj-1)*N+si],hU=heights[Math.min(N-1,sj+1)*N+si];
      var nx=-(hR-hL)/(2*RES),nz=-(hU-hD)/(2*RES);
      var nl=Math.hypot(nx,1,nz);
      b.layer=mats[k];
      b.layer2=matsB[k];
      b.blend=matsW[k];
      b.emis=0;
      /* UVs run in world units so neighbouring chunks tile seamlessly
         and the texture does not swim when a chunk is rebuilt. */
      var wx=ox+gi*RES, wz=oz+gj*RES;
      b.vert(wx,h,wz,nx/nl,1/nl,nz/nl,wx*0.14,wz*0.14,[1,1,1]);
    }
    var stride=per+1;
    for(gj=0;gj<per;gj++)for(gi=0;gi<per;gi++){
      var a=base+gj*stride+gi, bb=a+1, c=a+stride, d=c+1;
      b.quad(a,c,d,bb);
    }
    var mesh=b.upload();
    mesh.cx=ox+CHUNK/2;mesh.cz=oz+CHUNK/2;
    mesh.cy=(minY+maxY)/2;
    mesh.rad=Math.hypot(CHUNK*0.72,(maxY-minY)/2+0.5);
    chunks.push(mesh);
  }
  T.chunks=chunks;
};

/* Sphere-vs-frustum in world space. Cheap, conservative, and it is the
   difference between drawing 49 terrain chunks and drawing 12. */
var _planes=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
T.extractFrustum=function(vp){
  var m=vp;
  function set(p,a,b,c,d){
    var l=Math.hypot(a,b,c)||1;
    p[0]=a/l;p[1]=b/l;p[2]=c/l;p[3]=d/l;
  }
  set(_planes[0],m[3]+m[0],m[7]+m[4],m[11]+m[8],m[15]+m[12]);   /* left  */
  set(_planes[1],m[3]-m[0],m[7]-m[4],m[11]-m[8],m[15]-m[12]);   /* right */
  set(_planes[2],m[3]+m[1],m[7]+m[5],m[11]+m[9],m[15]+m[13]);   /* bottom*/
  set(_planes[3],m[3]-m[1],m[7]-m[5],m[11]-m[9],m[15]-m[13]);   /* top   */
  set(_planes[4],m[3]+m[2],m[7]+m[6],m[11]+m[10],m[15]+m[14]);  /* near  */
  set(_planes[5],m[3]-m[2],m[7]-m[6],m[11]-m[10],m[15]-m[14]);  /* far   */
};
T.sphereVisible=function(x,y,z,r){
  for(var i=0;i<6;i++){
    var p=_planes[i];
    if(p[0]*x+p[1]*y+p[2]*z+p[3]<-r)return false;
  }
  return true;
};

T.drawChunks=function(cull){
  var n=0;
  for(var i=0;i<chunks.length;i++){
    var c=chunks[i];
    if(cull&&!T.sphereVisible(c.cx,c.cy,c.cz,c.rad))continue;
    GL.draw(c);n++;
  }
  return n;
};
/* The shadow pass wants a different set: everything near the sun's
   focus, visible to the camera or not, or objects behind you stop
   casting into the shot. */
T.drawChunksNear=function(fx,fz,radius){
  for(var i=0;i<chunks.length;i++){
    var c=chunks[i];
    if(Math.hypot(c.cx-fx,c.cz-fz)>radius+c.rad)continue;
    GL.draw(c);
  }
};

LH.Terrain=T;
})();


/* ============================================================
   The figure — one continuous skinned mesh.

   Everything from the collarbone down is built here, in the bind pose,
   in world metres, and bound to the skeleton ring by ring. There are
   no separate upper-arm and forearm meshes any more and no joint
   spheres to hide the gap between them, because there is no gap: the
   rings either side of an elbow share their weight between the two
   bones, so the surface creases instead of shearing.

   Two conventions hold the whole thing together.

   First, every ring is a `sect` — a superellipse with independent
   front and back depth. Bodies are not made of ellipses. The back is
   flatter than the front, a rib cage is squarer than a waist, a calf
   is nearly all behind the bone, and a shin is a flat plane over
   bone. One exponent and two depths per ring says all of that.

   Second, regions overlap rather than joining. The leg's top ring sits
   up inside the pelvis; the deltoid buries a third of itself in the
   rib cage. Two solid surfaces that interpenetrate look exactly like
   one surface, and trying to stitch a leg into a torso with matching
   ring counts is how a weekend disappears.
   ============================================================ */
var B=LH.Rig.NAME;

/* A skinned part is never instanced: its vertices are placed by a bone
   palette that belongs to one character, so there is nothing to batch. */
function skinPart(key,fn){
  var hit=cache[key];
  if(hit)return hit;
  var b=Geo.build();
  fn(b);
  /* Authored on the real body, delivered on the toy one. Every skinned
     part in the game goes through here, which is why the map only has
     to exist once. */
  LH.Rig.warp(b);
  var mesh=b.upload(0);
  mesh.key=key;
  cache[key]=mesh;
  return mesh;
}
Body.skinPart=skinPart;

function sect(hw,hf,hb,n,ex){
  var out=[],e=2/(ex===undefined?2.2:ex);
  for(var i=0;i<n;i++){
    var a=i/n*M.TAU,ca=Math.cos(a),sa=Math.sin(a);
    var hd=sa>=0?hf:hb;
    out.push([(ca<0?-1:1)*hw*Math.pow(Math.abs(ca),e),
              (sa<0?-1:1)*hd*Math.pow(Math.abs(sa),e)]);
  }
  return out;
}
Body.sect=sect;

/* Girth multipliers for the three builds. Only the soft tissue moves —
   the skeleton is the same length in all three, because a heavier
   person is not a taller one and scaling the bones would make them
   one. */
function girth(build){
  return build==='bulk'?1.13:(build==='slim'?0.90:1.0);
}
Body.girth=girth;

/* ---------------- build ----------------
   Build is a shape, not a size.

   `girth` above multiplies every radius on the body by one number, so
   on its own `bulk` is `base` photographed closer and `slim` is `base`
   photographed further away. At twenty metres — which is the distance
   a character is actually read at — the three silhouettes were
   identical, because a uniform scale cannot change a silhouette, only
   how much of the screen it takes.

   What differs between builds is a set of ratios: how wide the
   shoulders sit against the waist, how deep the chest is, how much of
   a limb is muscle. So the scalar stays (it sets overall size, and
   every garment and every occupational overlay is already cut against
   it) and a profile rides on top of it. The profile is deliberately
   restrained — nine per cent at the widest — and averages to about one
   up the body, so a coat cut to the scalar still closes over the chest
   underneath it. What it changes is the taper: on top of the body's own
   shape it moves the shoulder-to-waist ratio about seven per cent
   between slim and bulk, and that ratio — not the size — is what a
   silhouette is made of.

   Rows are [half-width, depth] sampled at hip, waist, chest and
   shoulder height. */
var SHAPE_Y=[0.900,1.070,1.325,1.450];
var BUILD_SHAPE={
  slim:{torso:[[0.970,0.955],[0.925,0.915],[0.940,0.930],[0.950,0.935]],
        limb:0.905,neck:0.950},
  base:{torso:[[1,1],[1,1],[1,1],[1,1]],limb:1,neck:1},
  bulk:{torso:[[1.015,1.025],[0.990,1.020],[1.080,1.095],[1.092,1.060]],
        limb:1.105,neck:1.070}
};
function buildShape(build){return BUILD_SHAPE[build]||BUILD_SHAPE.base;}
/* The profile at a height, linear between the four control rows and
   flat outside them. Two numbers out: width and depth. */
function shapeAt(sh,y,out){
  var T=sh.torso,i;
  if(y<=SHAPE_Y[0]){out[0]=T[0][0];out[1]=T[0][1];return out;}
  for(i=0;i<SHAPE_Y.length-1;i++){
    if(y<=SHAPE_Y[i+1]){
      var t=(y-SHAPE_Y[i])/(SHAPE_Y[i+1]-SHAPE_Y[i]);
      out[0]=M.lerp(T[i][0],T[i+1][0],t);
      out[1]=M.lerp(T[i][1],T[i+1][1],t);
      return out;
    }
  }
  out[0]=T[T.length-1][0];out[1]=T[T.length-1][1];return out;
}
Body.buildShape=buildShape;
/* Anything cut against the plain scalar — the occupational coats, the
   capes, the backpacks — needs to know the chest got wider, or a coat
   sized for a base torso closes three millimetres inside a bulk one.
   The widest of the upper-body factors, which is the one that decides
   whether the garment closes at all. */
Body.overFit=function(build){
  var T=buildShape(build).torso;
  return Math.max(T[2][0],T[2][1],T[3][0],T[3][1]);
};

/* ---------------- torso ----------------
   Thirteen rings from the crotch to the base of the neck. The numbers
   that matter are the three turning points: the iliac crest at 0.955
   is the widest the hips get, the waist at 1.070 is the narrowest the
   body gets, and the nipple line at 1.325 is the widest the rib cage
   gets. Everything between them is interpolation. */
var _sh=[1,1];
function torsoRings(g,n,inf,build){
  inf=inf||0;
  var sh=buildShape(build);
  /* The last argument is a value, not a colour: everything here is
     painted in greys and multiplied by the character's skin tone. The
     dark rings are the places light does not reach — under the jaw, in
     the armpit, at the groin — which SSAO at any usable radius cannot
     find on a body this size. */
  function r(y,hw,hf,hb,ex,skin,col){
    shapeAt(sh,y,_sh);
    /* The inflation is added after the profile, not scaled by it: a
       garment's clearance is a property of the cloth, not of the body
       inside it, and eleven millimetres has to stay eleven on every
       build or a shirt fits one of them and clips the other two. */
    return {y:y,pts:sect(hw*g*_sh[0]+inf,hf*g*_sh[1]+inf,hb*g*_sh[1]+inf,n,ex),
            skin:skin,col:col||null};
  }
  return [
    r(0.795,0.106,0.080,0.088,2.3,[B.hips,1],DARK),
    r(0.872,0.140,0.100,0.110,2.4,[B.hips,1]),
    r(0.955,0.160,0.112,0.120,2.4,[B.hips,1]),
    /* Glutes and the small of the back are added below, as dents with
       the sign flipped: a back that runs straight from the waist to the
       thigh is the clearest tell of a shop mannequin, and it is two
       rings' worth of work to fix. */
    r(1.020,0.148,0.106,0.106,2.4,[B.hips,0.55,B.spine,0.45]),
    r(1.070,0.138,0.100,0.098,2.3,[B.spine,1]),
    r(1.130,0.143,0.104,0.100,2.3,[B.spine,0.50,B.spine2,0.50]),
    r(1.190,0.152,0.110,0.104,2.4,[B.spine2,1]),
    r(1.260,0.160,0.115,0.108,2.5,[B.spine2,0.50,B.chest,0.50]),
    r(1.325,0.164,0.118,0.110,2.6,[B.chest,1]),
    r(1.395,0.156,0.110,0.106,2.6,[B.chest,1]),
    r(1.440,0.140,0.096,0.100,2.5,[B.chest,0.80,B.neck,0.20],LOW),
    r(1.490,0.106,0.072,0.080,2.3,[B.chest,0.50,B.neck,0.50],MID),
    r(1.524,0.072,0.054,0.058,2.1,[B.neck,1])
  ];
}
function torsoRingsShaped(g,n,inf,build){
  var R=torsoRings(g,n,inf,build);
  dent(R[1].pts,0,-1,-0.16,0.66);   /* glutes                 */
  dent(R[2].pts,0,-1,-0.11,0.60);
  dent(R[4].pts,0,-1, 0.07,0.55);   /* lumbar curve, inward   */
  dent(R[8].pts,0, 1,-0.05,0.50);   /* sternum forward        */
  dent(R[10].pts,1,0,-0.05,0.34);   /* trapezius, out at the  */
  dent(R[10].pts,-1,0,-0.05,0.34);  /* top of each shoulder   */
  return R;
}

/* ---------------- a limb ----------------
   Rings down a bone axis. Given as [y, radius, frontDepth, backDepth,
   exponent, skin] with the radius standing in for the half-width. */
function limbLoft(b,x,rings,n,g,inf,o){
  inf=inf||0;
  b.push();b.translate(x,0,0);
  var secs=[];
  for(var i=0;i<rings.length;i++){
    var R=rings[i];
    secs.push({y:R[0],pts:sect(R[1]*g+inf,R[2]*g+inf,R[3]*g+inf,n,R[4]),
               skin:R[5],col:R[6]||null});
  }
  b.loft(secs,LIT,o||{});
  b.pop();
}
/* Keep the rings between two heights, and add an end ring at the cut so
   a garment finishes on a hem rather than halfway through a ring. */
function span(rings,lo,hi){
  var out=[];
  for(var i=0;i<rings.length;i++){
    var R=rings[i];
    if(R[0]<lo-0.0001||R[0]>hi+0.0001)continue;
    out.push(R);
  }
  return out;
}
/* A ring interpolated at an arbitrary height, so a hem can land where
   the design wants it instead of where a ring happens to be. */
function ringAt(rings,y){
  var lo=rings[0],hi=rings[rings.length-1];
  for(var i=0;i<rings.length-1;i++){
    if(y>=rings[i][0]&&y<=rings[i+1][0]){lo=rings[i];hi=rings[i+1];break;}
  }
  var t=(hi[0]===lo[0])?0:(y-lo[0])/(hi[0]-lo[0]);
  function L(a,c){return a+(c-a)*t;}
  return [y,L(lo[1],hi[1]),L(lo[2],hi[2]),L(lo[3],hi[3]),L(lo[4],hi[4]),
          t<0.5?lo[5]:hi[5]];
}

/* ---------------- arm ----------------
   Deltoid on top, biceps belly above the elbow, the forearm's own
   belly just below it, then the taper into a wrist that is nearly
   flat. The two rings either side of 1.122 are the elbow: they hand
   the surface from the upper arm to the forearm across four
   centimetres, which is about how much skin a real elbow recruits. */
/* The limb multiplier is applied here rather than at the loft so that
   a garment cut from these same rings inherits it — which is the
   whole reason garments are built from the body's rings in the first
   place. A sleeve that did not know the arm inside it had grown is a
   sleeve the arm comes through. */
function limbShaped(rings,build){
  var f=buildShape(build).limb;
  if(f===1)return rings;
  var out=[];
  for(var i=0;i<rings.length;i++){
    var R=rings[i];
    out.push([R[0],R[1]*f,R[2]*f,R[3]*f,R[4],R[5],R[6]]);
  }
  return out;
}
function armRings(side,build){
  var L=B.shoulderL,A=B.armL,F=B.forearmL,H=B.handL;
  if(side<0){L=B.shoulderR;A=B.armR;F=B.forearmR;H=B.handR;}
  return limbShaped([
    [0.868,0.030,0.026,0.026,2.0,[F,0.55,H,0.45]],   /* wrist        */
    [0.930,0.036,0.031,0.033,2.1,[F,1]],
    [1.010,0.042,0.037,0.041,2.2,[F,1]],
    [1.082,0.046,0.041,0.046,2.2,[A,0.15,F,0.85]],   /* forearm belly*/
    [1.122,0.040,0.038,0.041,2.1,[A,0.50,F,0.50],MID],/* elbow       */
    [1.162,0.042,0.040,0.041,2.1,[A,0.75,F,0.25]],
    [1.250,0.047,0.045,0.046,2.1,[A,1]],             /* biceps       */
    [1.340,0.052,0.050,0.050,2.1,[A,1]],
    [1.412,0.063,0.060,0.059,2.1,[L,0.25,A,0.75]],   /* deltoid belly*/
    [1.462,0.062,0.058,0.058,2.2,[L,0.60,A,0.40]],
    [1.496,0.046,0.043,0.043,2.2,[L,0.85,A,0.15]],
    [1.516,0.020,0.019,0.019,2.2,[L,1]]              /* rounded top  */
  ],build);
}

/* ---------------- leg ----------------
   The asymmetries are the point. A thigh is deeper than it is wide at
   the top and the other way round above the knee; a calf sits almost
   entirely behind the bone, which is why the back depth at 0.420 is
   half again the front. */
function legRings(side,build){
  var T=side>0?B.thighL:B.thighR, S=side>0?B.shinL:B.shinR;
  var F=side>0?B.footL:B.footR;
  return limbShaped([
    [0.075,0.038,0.034,0.040,2.1,[S,0.55,F,0.45]],   /* ankle        */
    [0.140,0.041,0.036,0.046,2.1,[S,1]],
    [0.240,0.048,0.040,0.058,2.2,[S,1]],
    [0.340,0.056,0.043,0.070,2.2,[S,1]],
    [0.420,0.059,0.044,0.074,2.2,[S,1]],             /* calf belly   */
    [0.480,0.058,0.048,0.066,2.2,[S,1]],
    [0.515,0.058,0.052,0.056,2.2,[T,0.45,S,0.55],MID],/* knee        */
    [0.552,0.061,0.056,0.058,2.2,[T,0.72,S,0.28]],
    [0.600,0.066,0.060,0.062,2.2,[T,1]],
    [0.700,0.076,0.070,0.074,2.3,[T,1]],
    [0.820,0.087,0.080,0.090,2.4,[T,1]],
    [0.912,0.095,0.086,0.100,2.4,[T,1]],             /* upper thigh  */
    [0.968,0.092,0.082,0.096,2.4,[B.hips,0.45,T,0.55],DARK],
    [1.030,0.040,0.036,0.040,2.2,[B.hips,1]]         /* cap, buried  */
  ],build);
}

/* ---------------- hand ----------------
   Four fingers and a thumb, rigid to the hand bone. Fingers do not
   articulate: at the distance a player ever sees them the silhouette
   is the whole of it, and four separated digits read as a hand where
   a mitten reads as a glove. `side` mirrors the thumb without a
   negative scale, which would invert every triangle it touched. */
function handMesh(b,side){
  var H=side>0?B.handL:B.handR;
  var x=side*0.172;
  b.bone(H);
  /* The palm and the fingers as one paddle, with the fingers cut into
     it as grooves rather than modelled as four separate rods.

     Four rods was the anatomical answer and it was right on a hand
     four centimetres across. The toy warp makes this hand seventy per
     cent wider, and four thin cylinders on a hand that size read as
     spider legs — the last part of the body still built for the old
     proportions. A mitten with a thumb and three creases is what a
     toy hand is, and it holds a shape at the distance the camera
     actually sits at. */
  b.push();b.translate(x,0,0);
  b.loft([
    {y:0.858,pts:sect(0.030,0.017,0.017,14,2.4)},   /* wrist        */
    {y:0.838,pts:sect(0.040,0.021,0.021,14,2.6)},
    {y:0.806,pts:sect(0.046,0.022,0.022,14,2.8)},   /* knuckles     */
    {y:0.766,pts:sect(0.045,0.021,0.021,14,3.0)},
    {y:0.726,pts:sect(0.038,0.018,0.018,14,3.0)},
    {y:0.702,pts:sect(0.024,0.012,0.012,14,2.8)}    /* fingertips   */
  ],LIT,{});
  b.pop();
  /* Three grooves down the front of the paddle. Thin dark wedges set
     into the surface: they cost six triangles each and they are the
     whole reason it reads as fingers. */
  for(var i=0;i<3;i++){
    var fx=x+side*(-0.021+i*0.021);
    b.push();b.translate(fx,0.752,0.013);
    b.rotate(0,0,side*(-0.03+i*0.03));
    b.chamfer(0,0,0,0.0035,0.092,0.009,DARK,0.0012,{noBand:true});
    b.pop();
  }
  /* thumb, set forward and out of the plane of the paddle */
  b.push();b.translate(x-side*0.038,0.826,0.014);
  b.rotate(0.26,0,side*0.78);
  b.loft([
    {y:0,     pts:sect(0.017,0.015,0.015,10,2.3)},
    {y:-0.026,pts:sect(0.016,0.014,0.014,10,2.3)},
    {y:-0.052,pts:sect(0.011,0.010,0.010,10,2.3)}
  ],LIT,{});
  b.pop();
}

/* ---------------- foot ----------------
   Bare. Heel, instep and ball are the foot bone; everything past the
   ball is the toe bone, so a push-off actually bends where a foot
   bends. */
function footMesh(b,side){
  var F=side>0?B.footL:B.footR, T=side>0?B.toeL:B.toeR;
  var x=side*0.092;
  /* Laid on its side, so the loft's own y runs backward along the foot
     and each section's depth becomes height. That also means the whole
     thing is built around y=0 rather than around the ankle at 0.075,
     and it has to be lifted back up — without this the soles sit three
     centimetres under the ground and the ankle floats above the foot. */
  b.push();b.translate(x,0.040,0);
  b.push();b.rotate(-Math.PI/2,0,0);
  b.loft([
    {y:0.070,pts:sect(0.036,0.052,0.030,14,2.4),skin:[F,1]},   /* heel  */
    {y:0.020,pts:sect(0.041,0.062,0.030,14,2.6),skin:[F,1]},
    {y:-0.040,pts:sect(0.043,0.058,0.030,14,2.8),skin:[F,1]},  /* arch  */
    {y:-0.090,pts:sect(0.047,0.046,0.032,14,3.0),skin:[F,0.75,T,0.25]},
    {y:-0.118,pts:sect(0.048,0.038,0.032,14,3.0),skin:[F,0.45,T,0.55]}, /* ball */
    {y:-0.165,pts:sect(0.044,0.026,0.028,14,2.8),skin:[T,1]},
    {y:-0.192,pts:sect(0.032,0.018,0.020,14,2.6),skin:[T,1]}   /* toes  */
  ],LIT,{});
  b.pop();
  b.pop();
}

/* Exposed so the cosmetics module can build coats and aprons from the
   same rings the body and the shirt are built from. A coat that is not
   an offset copy of the torso under it will clip through that torso
   the first time the character bends, and no amount of tuning fixes
   it — the two surfaces have to be the same surface. */
Body.torsoShell=shellRings;
Body.armRings=armRings;
Body.legRings=legRings;
Body.limbLoft=limbLoft;
Body.ringAt=ringAt;
Body.bones=B;

/* One mesh for the whole body below the jaw. */
Body.figure=function(build){
  build=build||'base';
  return skinPart('figure:'+build,function(b){
    b.mat('skin');
    /* Segment counts. Every one of these was chosen for a body 1.80
        metres tall with limbs the width of real limbs. The toy warp
        makes an arm two thirds thicker and a thigh a third, and a
        cylinder that gets fatter without getting more segments gets
        visibly flatter — the shoulders and the calves were reading as
        cut gems. Raised to where the facets stop showing at the three
        metres the camera actually sits at, which costs about nine
        thousand triangles a character. */
    var g=girth(build),n=34;
    b.loft(torsoRingsShaped(g,n,0,build),LIT,{});
    /* neck: its own short loft so the head can turn on it */
    var nk=buildShape(build).neck;
    b.push();
    b.loft([
      {y:1.500,pts:sect(0.066*g*nk,0.052*g*nk,0.056*g*nk,24,2.1),skin:[B.neck,1],col:LOW},
      {y:1.545,pts:sect(0.060*g*nk,0.048*g*nk,0.052*g*nk,24,2.0),skin:[B.neck,0.70,B.head,0.30],col:MID},
      {y:1.588,pts:sect(0.057*g*nk,0.048*g*nk,0.049*g*nk,24,2.0),skin:[B.head,1]},
      {y:1.612,pts:sect(0.050*g*nk,0.044*g*nk,0.044*g*nk,24,2.0),skin:[B.head,1]}
    ],LIT,{});
    b.pop();
    for(var s=1;s>=-1;s-=2){
      limbLoft(b,s*0.172,armRings(s,build),24,g);
      limbLoft(b,s*0.092,legRings(s,build),26,g);
      handMesh(b,s);
      footMesh(b,s);
    }
  });
};

/* ---------------- garments ----------------
   Every garment is the body's own rings, grown outward by a millimetre
   or twelve and bound to the same bones. That is not a shortcut: it is
   the only construction that cannot clip. A sleeve built from its own
   profile will pass through the arm inside it the first time the elbow
   passes ninety degrees, and no amount of tuning fixes that — the two
   surfaces have to be the same surface, offset.

   Inflation by garment, in metres:
     0.010  a shirt over skin
     0.014  trousers, which hang rather than cling
     0.018  an outer layer over a shirt
     0.022  a boot over a foot
*/

/* The torso rings a garment needs, cut to a hem and a neckline and
   grown outward. */
function shellRings(g,n,inf,lo,hi,build){
  var all=torsoRingsShaped(g,n,inf,build);
  var out=[];
  for(var i=0;i<all.length;i++){
    if(all[i].y<lo-0.0001||all[i].y>hi+0.0001)continue;
    out.push(all[i]);
  }
  return out;
}

/* ---------------- finished edges ----------------
   Every garment in this file used to stop. A loft with `openBottom`
   ends on a ring of vertices and nothing else, which is a hem with no
   thickness — and cloth with no thickness reads as paint on skin. Real
   garments are hemmed, cuffed and banded, and those bands are most of
   what tells you at a glance that a thing is made of fabric.

   `edgeBand` is that: four rings that step out from the shell, run
   straight for a centimetre, and tuck back under. `dir` is +1 for a
   band that sits above its anchor (a cuff at the end of a sleeve) and
   -1 for one that hangs below it (the hem of a shirt). */
function scalePts(pts,f){
  var o=[];
  for(var i=0;i<pts.length;i++)o.push([pts[i][0]*f,pts[i][1]*f]);
  return o;
}
function shiftPts(pts,dz){
  var o=[];
  for(var i=0;i<pts.length;i++)o.push([pts[i][0],pts[i][1]+dz]);
  return o;
}
function edgeBand(b,pts,y,dir,h,swell,skin,col,lip){
  var A=scalePts(pts,1+swell), C=scalePts(pts,1+swell*0.40);
  var r=[
    {y:y,            pts:C,skin:skin,col:lip||col},
    {y:y+dir*h*0.24, pts:A,skin:skin,col:col},
    {y:y+dir*h*0.76, pts:A,skin:skin,col:col},
    {y:y+dir*h,      pts:C,skin:skin,col:lip||col}
  ];
  if(dir<0)r.reverse();
  b.loft(r,LIT,{openTop:true,openBottom:true,uvScale:2});
}
/* The same thing on a limb, where the ring has to be built from the
   arm's own dimensions and the whole band offset onto that arm. */
function limbBand(b,x,rings,y,dir,h,g,inf,swell,n,col,lip){
  var R=ringAt(rings,y);
  var pts=sect(R[1]*g+inf,R[2]*g+inf,R[3]*g+inf,n,R[4]);
  b.push();b.translate(x,0,0);
  edgeBand(b,pts,y,dir,h,swell,R[5],col,lip);
  b.pop();
}

/* ---------------- tops ----------------
   There were four, and three of them were the same shape: a shell from
   a hem to a neckline, with a hood or some lapels stuck on. That is
   fine for four and hopeless for a shop, because a rack of forty items
   that are all the same silhouette in forty colours is a rack of one
   item.

   So the shape is a table now. `hem` and `neck` cut the shell as
   before; `strap` makes it sleeveless and puts two bands over the
   collarbones instead of shoulders; `skirt` continues it past the hips
   into cloth that hangs from the pelvis; `wide` gives the sleeves a
   bell. A dress and a tank top are different objects, not the same
   object in a different colour. */
var SHIRT_BUILD={
  tee:    {hem:0.868,neck:1.470},
  crop:   {hem:1.150,neck:1.470},
  jacket: {hem:0.840,neck:1.470,lapels:1},
  hoodie: {hem:0.855,neck:1.470,hood:1},
  tank:   {hem:0.868,neck:1.424,strap:0.058},
  vest:   {hem:0.850,neck:1.424,strap:0.100,lapels:1},
  jersey: {hem:0.868,neck:1.440,number:1},
  dress:  {hem:0.900,neck:1.470,skirt:[0.900,0.560,0.152,0.286]},
  gown:   {hem:0.900,neck:1.424,strap:0.048,
           skirt:[0.900,0.400,0.158,0.340]},
  robe:   {hem:0.880,neck:1.470,wide:1,
           skirt:[0.880,0.600,0.168,0.268]},
  suit:   {hem:0.845,neck:1.470,lapels:1,tie:1}
};
/* Cloth that hangs from the pelvis rather than wrapping a leg. The
   coat in LH.Cos does the same job; this is the version a dress needs,
   bound to the hips so it swings with them instead of rotating rigidly
   about the sternum. */
function skirtLoft(b,g,inf,y0,y1,w0,w1,build,n){
  n=n||26;
  var steps=8,secs=[],i,j;
  for(i=0;i<=steps;i++){
    var t=i/steps;
    var y=M.lerp(y0,y1,t);
    var w=M.lerp(w0,w1,Math.pow(t,0.82))*g+inf;
    var d=w*0.72;
    var pts=sect(w,d,d*1.06,n,2.4);
    /* a little sway, so the hem is cloth and not a lampshade rim */
    for(j=0;j<pts.length;j++){
      pts[j][0]*=1+Math.sin(j*2.1)*0.045*t;
      pts[j][1]*=1+Math.cos(j*2.1)*0.050*t;
    }
    secs.push({y:y,pts:pts,
      skin:t<0.22?[B.spine,0.55,B.hips,0.45]:[B.hips,1],
      col:i===0?MID:(i>steps-2?LOW:LIT)});
  }
  /* built top-down, so reverse it into the ascending order loft wants */
  secs.reverse();
  b.loft(secs,LIT,{openTop:true,openBottom:true,uvScale:1.7});
  return secs[0];
}

Body.SHIRTS=Object.keys(SHIRT_BUILD);
Body.shirt=function(style,sleeve,build){
  style=SHIRT_BUILD[style]?style:'tee';
  sleeve=sleeve||'short';
  build=build||'base';
  var C=SHIRT_BUILD[style];
  return skinPart('shirt:'+style+':'+sleeve+':'+build,function(b){
    b.mat('fabric');
    var g=girth(build),n=34,inf=0.011;
    var secs=shellRings(g,n,inf,C.hem,C.neck,build);
    var neckPts=sect(0.100*g+inf,0.068*g+inf,0.076*g+inf,n,2.3);
    if(!C.strap)
      secs.push({y:1.492,pts:neckPts,skin:[B.chest,0.5,B.neck,0.5],col:MID});
    b.loft(secs,LIT,{openTop:true,openBottom:true,uvScale:2});

    /* the skirt, for the styles that have one */
    if(C.skirt)
      skirtLoft(b,g,inf,C.skirt[0],C.skirt[1],C.skirt[2],C.skirt[3],build,n-8);

    /* Straps over the collarbones. A sleeveless top whose shell simply
       stops at the armpit is a tube; the two bands are what hold it
       up, and they are the whole read of the garment from the front. */
    if(C.strap){
      for(var sp=-1;sp<=1;sp+=2){
        b.skin(sp>0?B.shoulderL:B.shoulderR,0.55,B.chest,0.45);
        b.push();b.translate(sp*(0.082*g),1.436,0.000);
        b.rotate(0,0,-sp*0.22);
        b.chamfer(0,0,0,C.strap,0.104,0.215*g,LIT,0.014,{noBand:true});
        b.pop();
      }
    }

    /* The ribbed neckband. A single darker ring at the neckline read
       as a change of colour; this is the collar as an actual object,
       standing a few millimetres proud of the shell and rolling back
       over itself the way a knitted band does. */
    if(!C.strap){
      b.skin(B.chest,0.5,B.neck,0.5);
      edgeBand(b,neckPts,1.492,1,0.020,0.055,[B.chest,0.5,B.neck,0.5],MID,LOW);
    }
    /* The hem, hanging below the shell rather than stopping at it.
       Anchored on the lowest ring the shell actually kept, not on the
       hem the style asked for: the two are four centimetres apart on a
       cropped top, and a band four centimetres below the cloth it is
       supposed to finish is a floating hoop. */
    edgeBand(b,secs[0].pts,secs[0].y,-1,0.018,0.030,secs[0].skin,MID,LOW);

    /* sleeves: the arm's own rings from the shoulder down to the cuff */
    /* A short sleeve that stops on top of the deltoid is a puff
       sleeve. Taken down past the widest part of the arm it reads as a
       t-shirt, which is what it is. */
    var cuff=sleeve==='long'?0.878:1.168;
    var bare=C.strap||sleeve==='none';
    for(var s=1;s>=-1;s-=2){
      var rings=armRings(s,build);
      var keep=[];
      for(var i=0;i<rings.length;i++)
        if(rings[i][0]>=cuff-0.0001)keep.push(rings[i]);
      if(!bare&&keep.length>1){
        keep.unshift(ringAt(rings,cuff));
        /* A bell sleeve is the same rings widened toward the cuff — a
           robe with a straight sleeve is a dressing gown. */
        if(C.wide){
          var wid=[];
          for(var w=0;w<keep.length;w++){
            var t=1-(keep[w][0]-cuff)/((keep[keep.length-1][0]-cuff)||1);
            var f=1+t*t*1.05;
            wid.push([keep[w][0],keep[w][1]*f,keep[w][2]*f,keep[w][3]*f,
                      keep[w][4],keep[w][5],keep[w][6]]);
          }
          keep=wid;
        }
        limbLoft(b,s*0.172,keep,24,g,0.009,{openTop:false,openBottom:true,uvScale:2});
        /* and its cuff, turned back up the arm */
        if(!C.wide)
          limbBand(b,s*0.172,rings,cuff,1,0.022,g,0.009,0.075,24,MID,LOW);
      }
    }

    if(C.lapels){
      /* lapels and a front seam */
      b.bone(B.chest);
      for(var q=-1;q<=1;q+=2){
        b.push();b.translate(q*0.052,1.360,0.118*g+inf);b.rotate(0.10,0,q*0.28);
        b.chamfer(0,0,0,0.062,0.150,0.018,MID,0.008,{noBand:true});b.pop();
      }
      b.push();b.translate(0,1.230,0.118*g+inf);
      b.chamfer(0,0,0,0.014,0.320,0.016,DEEP,0.005,{noBand:true});b.pop();
      /* A collar that stands. Lapels lying flat on the chest with
         nothing behind the neck is a jacket drawn from the front only;
         the standing half is what you see from every other angle. */
      b.skin(B.chest,0.55,B.neck,0.45);
      b.loft([
        {y:1.470,pts:shiftPts(scalePts(neckPts,1.035),-0.006),col:MID},
        {y:1.512,pts:shiftPts(scalePts(neckPts,1.075),-0.012),col:LIT},
        {y:1.545,pts:shiftPts(scalePts(neckPts,1.060),-0.018),col:LOW}
      ],LIT,{openTop:true,openBottom:true,uvScale:2});
      /* three buttons down the closure */
      b.bone(B.chest);
      for(var bt=0;bt<3;bt++){
        b.push();b.translate(0.020,1.318-bt*0.078,0.126*g+inf);
        b.sphere(0,0,0,0.0092,8,6,DEEP,{squash:0.45});b.pop();
      }
    }
    if(C.tie){
      /* A tie is one wedge and one knot, and it is the entire
         difference between a suit and a jacket at any distance. */
      b.mat('fabric');
      b.skin(B.chest,0.7,B.neck,0.3);
      b.push();b.translate(0,1.452,0.116*g+inf);
      b.chamfer(0,0,0,0.036,0.040,0.020,DEEP,0.008);b.pop();
      b.push();b.translate(0,1.320,0.122*g+inf);b.rotate(0.06,0,0);
      b.chamfer(0,0,0,0.046,0.220,0.014,LOW,0.006,{noBand:true});b.pop();
      b.push();b.translate(0,1.208,0.120*g+inf);
      b.extrude([[-0.030,0.020],[0.030,0.020],[0,-0.040]],0.012,LOW);b.pop();
    }
    if(C.number){
      /* A squad number as a panel rather than as paint, because this
         renderer has no decals and a flat rectangle in a second shade
         reads as a number from further away than a number would. */
      b.mat('fabric');
      b.skin(B.chest,0.6,B.spine2,0.4);
      b.push();b.translate(0,1.300,0.126*g+inf);
      b.chamfer(0,0,0,0.090,0.130,0.008,LIT,0.010,{noBand:true});b.pop();
      b.push();b.translate(0,1.300,0.132*g+inf);
      b.chamfer(0,0,0,0.062,0.096,0.006,DEEP,0.008,{noBand:true});b.pop();
      /* and the shoulder stripes */
      for(var js=-1;js<=1;js+=2){
        b.push();b.translate(js*0.104,1.420,0.030);b.rotate(0,0,js*0.22);
        b.chamfer(0,0,0,0.028,0.090,0.130,DEEP,0.008,{noBand:true});b.pop();
      }
    }
    if(C.hood){
      /* The hood rides the neck, not the head: a hood pinned to a skull
         swings with every glance and reads as a helmet.

         A hood that is down is also not a bag. It is a thick roll of
         cloth bunched behind the neck — wider than it is deep, heavy
         at the bottom, sagging onto the shoulders and open at the top
         where the opening would be. One squashed sphere had none of
         that: it had a silhouette like a rucksack and a highlight like
         a balloon. This is its own loft so it can be all four. */
      b.skin(B.neck,0.55,B.chest,0.45);
      var hr=function(hw,hf,hb,z,ex){
        return shiftPts(sect(hw*g,hf*g,hb*g,20,ex||2.4),z);
      };
      b.loft([
        {y:1.372,pts:hr(0.118,0.044,0.108,-0.030),col:LOW},
        {y:1.424,pts:hr(0.140,0.052,0.126,-0.038),col:MID},
        {y:1.478,pts:hr(0.148,0.056,0.132,-0.040),col:LIT},
        {y:1.528,pts:hr(0.138,0.052,0.124,-0.036),col:LIT},
        {y:1.566,pts:hr(0.108,0.042,0.098,-0.030),col:MID},
        {y:1.592,pts:hr(0.058,0.024,0.054,-0.024),col:LOW}
      ],LIT,{uvScale:2});
      /* the mouth of it, dark, so the roll reads as cloth folded over
         a hole rather than as a solid lump */
      b.loft([
        {y:1.512,pts:hr(0.104,0.038,0.094,-0.030),col:DEEP},
        {y:1.556,pts:hr(0.086,0.032,0.078,-0.026),col:DEEP}
      ],DEEP,{openTop:true,openBottom:true});
      /* drawstrings, which are the one part everybody draws and the
         reason a hoodie reads as a hoodie at fifty metres */
      b.bone(B.chest);
      for(var ds=-1;ds<=1;ds+=2){
        b.push();b.translate(ds*0.030,1.404,0.108*g+inf);b.rotate(0.06,0,ds*0.05);
        b.cylinder(0,0,0,0.0042,0.0038,0.104,6,MID);b.pop();
        b.push();b.translate(ds*0.032,1.348,0.110*g+inf);
        b.sphere(0,0,0,0.0075,7,5,LOW,{});b.pop();
      }
      /* the kangaroo pocket, with an opening rather than a slab */
      b.push();b.translate(0,1.230,0.120*g+inf);
      b.chamfer(0,0,0,0.170,0.056,0.020,MID,0.010,{noBand:true});b.pop();
      b.push();b.translate(0,1.284,0.126*g+inf);
      b.chamfer(0,0,0,0.166,0.007,0.014,DEEP,0.003,{noBand:true});b.pop();
    }
  });
};

/* Trousers: the seat from the torso, the legs from the legs. The seam
   between them is buried, so nothing has to line up. */
/* Two lengths was two lengths. A skirt is not a short pair of
   trousers — it has no legs in it at all — and baggy is not long with
   a bigger number, it is a different cut. */
var LEG_BUILD={
  long:  {hem:0.098,fat:1.00},
  shorts:{hem:0.660,fat:1.06},
  baggy: {hem:0.098,fat:1.34},
  skirt: {hem:null,   fat:1.00,skirt:[1.075,0.700,0.150,0.250]},
  gown:  {hem:null,   fat:1.00,skirt:[1.075,0.480,0.152,0.320]}
};
Body.LEGS=Object.keys(LEG_BUILD);
Body.trousers=function(leg,build){
  leg=LEG_BUILD[leg]?leg:'long';
  build=build||'base';
  return skinPart('trousers:'+leg+':'+build,function(b){
    b.mat('fabric');
    var g=girth(build),inf=0.014;
    /* The waistband is authored, not derived, so it needs the profile
       read out by hand — otherwise it is the one ring on a bulk body
       still cut to a base waist. */
    var _wsh=shapeAt(buildShape(build),1.100,[1,1]);
    var wb=_wsh[0], wd=_wsh[1];
    var seat=shellRings(g,32,inf,0.795,1.075,build);
    /* The torso rings carry the body's own occlusion shading — a dark
       ring at the groin, because that is where light does not reach on
       skin. Cloth hanging over it is not shaded that way, and taking
       the ring's colour with the ring put a dark band across the hips
       of every pair of trousers in the game. The shape is the body's;
       the shading is not. */
    for(var q=0;q<seat.length;q++)seat[q].col=(q===0?MID:null);
    /* waistband, a shade darker, so the top of the trousers is an edge */
    seat.push({y:1.100,pts:sect(0.140*g*wb+inf,0.102*g*wd+inf,0.100*g*wd+inf,32,2.3),
               skin:[B.spine,1],col:MID});
    b.loft(seat,LIT,{openTop:true,openBottom:true,uvScale:2});
    /* the waistband as an object, and a fly seam under it */
    var wpts=seat[seat.length-1].pts;
    edgeBand(b,wpts,1.100,-1,0.030,0.040,[B.spine,1],MID,LOW);
    b.bone(B.hips);
    b.push();b.translate(0,1.012,0.104*g*wd+inf);
    b.chamfer(0,0,0,0.009,0.078,0.012,DEEP,0.004,{noBand:true});b.pop();
    var L=LEG_BUILD[leg];
    if(L.skirt){
      /* no legs at all — cloth from the waist down, off the pelvis */
      skirtLoft(b,g,inf,L.skirt[0],L.skirt[1],L.skirt[2],L.skirt[3],build,26);
      return;
    }
    var hem=L.hem;
    for(var s=1;s>=-1;s-=2){
      var rings=legRings(s,build);
      var keep=[];
      for(var i=0;i<rings.length;i++)
        if(rings[i][0]>=hem-0.0001&&rings[i][0]<=1.031)keep.push(rings[i]);
      keep.unshift(ringAt(rings,hem));
      /* A baggy cut widens toward the hem rather than everywhere: wide
         at the ankle and narrow at the thigh is what makes it read as
         cloth hanging off a leg instead of a thicker leg. */
      if(L.fat!==1){
        var wide=[];
        for(var q2=0;q2<keep.length;q2++){
          var t=1-(keep[q2][0]-hem)/((keep[keep.length-1][0]-hem)||1);
          var f=1+(L.fat-1)*(0.35+0.65*t*t);
          wide.push([keep[q2][0],keep[q2][1]*f,keep[q2][2]*f,keep[q2][3]*f,
                     keep[q2][4],keep[q2][5],keep[q2][6]]);
        }
        keep=wide;
      }
      limbLoft(b,s*0.092,keep,26,g,inf,{openTop:true,openBottom:true,uvScale:2});
      /* turn-ups. Trousers that stop mid-shin with a zero-thickness
         edge are the same paint-on-skin problem as a shirt that does. */
      limbBand(b,s*0.092,rings,hem,1,0.026,g,inf,0.060,26,MID,LOW);
    }
  });
};

/* Shoes: the foot's own sections plus a sole that stands proud of it,
   which is the difference between a shoe and a painted foot. */
Body.shoes=function(style,build){
  style=(style==='boot')?'boot':'shoe';
  build=build||'base';
  return skinPart('shoes:'+style+':'+build,function(b){
    b.mat('fabric');
    var g=girth(build);
    for(var s=1;s>=-1;s-=2){
      var F=s>0?B.footL:B.footR, T=s>0?B.toeL:B.toeR;
      b.push();b.translate(s*0.092,0.044,0);
      b.push();b.rotate(-Math.PI/2,0,0);
      /* upper */
      b.loft([
        {y:0.086,pts:sect(0.044,0.062,0.026,16,2.4),skin:[F,1]},
        {y:0.020,pts:sect(0.050,0.072,0.026,16,2.6),skin:[F,1]},
        {y:-0.040,pts:sect(0.052,0.066,0.026,16,2.8),skin:[F,1]},
        {y:-0.095,pts:sect(0.056,0.052,0.028,16,3.0),skin:[F,0.7,T,0.3]},
        {y:-0.125,pts:sect(0.057,0.043,0.028,16,3.0),skin:[F,0.4,T,0.6]},
        {y:-0.175,pts:sect(0.052,0.030,0.026,16,2.8),skin:[T,1]},
        {y:-0.205,pts:sect(0.038,0.020,0.020,16,2.6),skin:[T,1]}
      ],LIT,{});
      b.pop();
      /* sole: a flat slab under the whole footprint, in a darker shade */
      b.skin(F,0.7,T,0.3);
      b.push();b.translate(0,-0.030,0.008);
      b.chamfer(0,0,0,0.106,0.026,0.272,DARK,0.009);b.pop();
      if(style==='boot'){
        /* the shaft, up the ankle, and a turned cuff */
        b.skin(s>0?B.shinL:B.shinR,0.55,F,0.45);
        b.push();b.translate(0,-0.044,0);
        b.loft([
          {y:0.084,pts:sect(0.052,0.046,0.052,18,2.3)},
          {y:0.148,pts:sect(0.055,0.048,0.056,18,2.3)},
          {y:0.198,pts:sect(0.062,0.054,0.062,18,2.3)}
        ],LIT,{openTop:true,openBottom:true});
        b.loft([
          {y:0.198,pts:sect(0.066,0.058,0.066,18,2.3),col:MID},
          {y:0.230,pts:sect(0.063,0.056,0.063,18,2.3),col:MID}
        ],MID,{openTop:true,openBottom:true});
        b.pop();
      }
      b.pop();
    }
  });
};
/* What the wardrobe offers for feet. `bare` is deliberately last —
   it is the fallback, not a look anyone picks first. */
Body.SHOES=['shoe','boot','bare'];

/* ---------------- hair ----------------
   Shapes, not strands.

   This is the third answer to the same question and the first one that
   is about the game rather than about hair. The first was a cluster of
   spheres — a helmet. The second was five hundred rounded ribbons a
   head, which is what real-time hair actually is, and it was right for
   a photographic character and wrong for this one: at any distance
   past two metres it dissolved into texture, and texture has no name.

   A hairstyle in this game is an item somebody paid for. It has to be
   recognisable across a plaza, on somebody else, at a glance — so it
   is built as a silhouette. One solid moulded shell with a shaped,
   often ragged lower edge, and on top of that whatever spikes, tails,
   braids or locs the style is actually about. Twenty of them, each one
   a designed shape with a name and a price, and none of them free.

   Everything is authored in the head's own space against an ellipsoid
   standing in for the skull. `az` runs 0 at the face and +/-PI at the
   nape; `el` runs 0 at the equator through the ears and PI/2 at the
   crown, with the brow at about +0.20 and the eyes at -0.12. */
var SKULL={cx:0,cy:0.020,cz:-0.004,rx:0.092,ry:0.140,rz:0.108};

/* A plain ellipsoid tapers to a point at the crown and the skull it is
   standing in for does not — a real cranium is still eight centimetres
   across four fifths of the way up. Raising the horizontal profile to a
   fractional power keeps it broad up there, which is the difference
   between a cap of hair that sits on the head and one that sinks into
   it everywhere above the ears. */
function skullCe(el){
  var c=Math.cos(el);
  return (c<0?-1:1)*Math.pow(Math.abs(c),0.42);
}
function scalpPt(az,el,r){
  r=r===undefined?1:r;
  var ce=skullCe(el);
  return [SKULL.cx+Math.sin(az)*ce*SKULL.rx*r,
          SKULL.cy+Math.sin(el)*SKULL.ry*r,
          SKULL.cz+Math.cos(az)*ce*SKULL.rz*r];
}
function scalpNormal(az,el){
  var ce=skullCe(el);
  var n=[Math.sin(az)*ce/SKULL.rx,Math.sin(el)*0.85/SKULL.ry,
         Math.cos(az)*ce/SKULL.rz];
  var l=Math.hypot(n[0],n[1],n[2])||1;
  return [n[0]/l,n[1]/l,n[2]/l];
}
function nrm3(v){var l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];}
function crs(a,c){return [a[1]*c[2]-a[2]*c[1],a[2]*c[0]-a[0]*c[2],a[0]*c[1]-a[1]*c[0]];}

/* A ribbon through a list of points.

   The section used to be a four-sided box, and a box is most of what
   made this hair read as plastic. Two flat faces and two hard ninety
   degree corners give every strand a specular edge running its whole
   length, and the normal jumps a right angle at each corner, so a
   head of hair shaded as a bundle of extruded rectangles — which is
   what it was.

   Six points on an ellipse cost half as much again and fix both: the
   silhouette keeps a rounded edge from every angle, and the normal
   turns continuously around the section. It still has thickness,
   which is the original reason it is not a flat card: a card with no
   thickness vanishes the moment it turns edge-on, and a head of hair
   does that constantly. */
var SECN=6,SECC=[],SECS=[];
for(var _si=0;_si<SECN;_si++){
  var _sa=(_si/SECN)*M.TAU;
  SECC.push(Math.cos(_sa));SECS.push(Math.sin(_sa));
}
/* Root to tip as a ramp rather than three bands. Hair is darkest where
   the scalp shades it and brightest across the middle where the light
   actually lands; the old three-step version put two visible seams
   across every strand, at the same two places on all of them. */
var HRAMP=['#787878','#8A8A8A','#9C9C9C','#AEAEAE','#C0C0C0','#D0D0D0',
           '#DCDCDC','#E6E6E6','#EEEEEE','#F4F4F4','#F6F6F6'];
function hairShade(t){
  var i=Math.round(t*(HRAMP.length-1));
  return HRAMP[i<0?0:(i>=HRAMP.length?HRAMP.length-1:i)];
}
/* Builder.vert takes a colour as an [r,g,b] triple, not as the hex
   string every other builder call accepts — the primitives convert it
   for you and this one does not, because it is the layer underneath
   them. Passing a string writes the characters '#', 'D', '2' into a
   Float32Array as NaN, and a NaN albedo ships as black. */
var HCOL={};
function hcol(c){return HCOL[c]||(HCOL[c]=Geo.col3(c));}

function ribbon(b,pts,ws,th,cols){
  var n=pts.length,base=b.n,i,k;
  for(i=0;i<n;i++){
    var p=pts[i];
    var prev=pts[Math.max(0,i-1)],next=pts[Math.min(n-1,i+1)];
    var T=nrm3([next[0]-prev[0],next[1]-prev[1],next[2]-prev[2]]);
    /* radial: away from the skull, so the card lies flat on the head */
    var R=nrm3([(p[0]-SKULL.cx)/SKULL.rx,(p[1]-SKULL.cy)/SKULL.ry,
                (p[2]-SKULL.cz)/SKULL.rz]);
    /* A card leaving the head straight outward has its tangent parallel
       to the radial, and the cross product of two parallel vectors is
       zero — which propagates NaN through every vertex after it and
       ships the whole strand as a black quad. Fall back to a world axis
       when that happens. */
    var S=crs(T,R);
    if(Math.hypot(S[0],S[1],S[2])<1e-5){
      S=crs(T,[0,1,0]);
      if(Math.hypot(S[0],S[1],S[2])<1e-5)S=crs(T,[1,0,0]);
    }
    S=nrm3(S);
    R=nrm3(crs(S,T));
    var w=ws[i],t2=th*(0.45+0.55*ws[i]/(ws[0]||1));
    var c=hcol(cols[Math.min(cols.length-1,i)]);
    for(k=0;k<SECN;k++){
      var qx=SECC[k]*w, qy=SECS[k]*t2;
      var vx=p[0]+S[0]*qx+R[0]*qy;
      var vy=p[1]+S[1]*qx+R[1]*qy;
      var vz=p[2]+S[2]*qx+R[2]*qy;
      /* the ellipse's own normal, which is its gradient rather than
         its position: (cos/w, sin/t), not (cos, sin). On a tress four
         times wider than it is thick those are nowhere near the same
         vector, and using the position is how you get a strand lit
         like a cylinder instead of like a ribbon. */
      var nu=SECC[k]/w, nv=SECS[k]/t2;
      var nn=nrm3([S[0]*nu+R[0]*nv,S[1]*nu+R[1]*nv,S[2]*nu+R[2]*nv]);
      b.vert(vx,vy,vz,nn[0],nn[1],nn[2],k/SECN,i/(n-1),c);
    }
  }
  for(i=0;i<n-1;i++)for(k=0;k<SECN;k++){
    var a0=base+i*SECN+k, b0=base+i*SECN+(k+1)%SECN;
    var c0=base+(i+1)*SECN+(k+1)%SECN, d0=base+(i+1)*SECN+k;
    b.quad(a0,b0,c0,d0);
  }
  /* close the tip so a strand ends in a point rather than a pipe */
  var last=pts[n-1];
  var lt=nrm3([last[0]-pts[n-2][0],last[1]-pts[n-2][1],last[2]-pts[n-2][2]]);
  var tip=b.vert(last[0],last[1],last[2],lt[0],lt[1],lt[2],0.5,1,
                 hcol(cols[cols.length-1]));
  for(k=0;k<SECN;k++)
    b.tri(tip,base+(n-1)*SECN+(k+1)%SECN,base+(n-1)*SECN+k);
}

/* One card: integrate a path from the scalp outward, bending it down
   under gravity and sideways under the style's flow. */
function hairCard(b,o){
  var seg=o.seg||7, pts=[], ws=[], cols=[];
  var p=o.start.slice(), d=nrm3(o.dir.slice());
  var step=o.len/seg;
  var side=nrm3(o.side||[1,0,0]);
  for(var i=0;i<=seg;i++){
    var t=i/seg;
    pts.push(p.slice());
    ws.push(o.w*(1-(o.taper===undefined?0.72:o.taper)*t*t));
    /* The tip used to ramp the whole way up the shade table, which
       ends at near-white. On dark hair that put a row of pale
       triangles along every fringe and turned every spike grey — the
       hard sawtooth edge that made these heads look unfinished. A
       strand does catch more light at its tip than at its root, but by
       a third of a stop, not by the whole ramp. */
    cols.push(hairShade(0.16+t*0.30));
    /* Gravity and flow are applied per step, not per metre. Scaling
       them by the step length meant a three-centimetre crop barely bent
       while a long style folded double on the same droop number, and
       every style had to be retuned against its own length. */
    var ds=1/seg;
    d[1]-=(o.droop||0)*ds*(0.35+t);
    if(o.sweep){d[0]+=o.sweep[0]*ds;d[1]+=o.sweep[1]*ds;d[2]+=o.sweep[2]*ds;}
    if(o.curl){
      /* A curl is a helix, not a zigzag. Pushing along one axis on a
         cosine bends the strand inside a single plane, which from the
         side is a corrugated ribbon and from the front is a straight
         line — the two readings never agree and the eye notices. The
         perpendicular axis on a sine, at the same frequency, is the
         whole difference between that and a spiral. */
      var ph=t*(o.curlFreq||3)*M.TAU+(o.curlPh||0);
      var kk=o.curl*ds*0.55;
      var up=crs(side,d);
      var ul=Math.hypot(up[0],up[1],up[2]);
      var c1=Math.cos(ph)*kk;
      var c2=(ul>1e-5?Math.sin(ph)*kk*(o.helix===undefined?0.85:o.helix):0);
      if(ul>1e-5){up[0]/=ul;up[1]/=ul;up[2]/=ul;}
      d[0]+=side[0]*c1+up[0]*c2;
      d[1]+=side[1]*c1+up[1]*c2;
      d[2]+=side[2]*c1+up[2]*c2;
    }
    d=nrm3(d);
    p[0]+=d[0]*step;p[1]+=d[1]*step;p[2]+=d[2]*step;
  }
  ribbon(b,pts,ws,o.th||0.005,cols);
}

/* The scalp cap: a thin shell just outside the skull, so nothing shows
   between the cards. Cut off below the hairline. */
/* ---------------- the shell ----------------
   The strand system that used to live here drew five hundred rounded
   ribbons a head and shaded each one along its length. It was the
   right answer for a photographic character and it is the wrong one
   here: Growtopia hair is not a mass of fibres, it is a *shape* —
   one solid moulded piece with a hard silhouette, a jagged edge, and
   spikes on it if the style has spikes. You should be able to name a
   hairstyle from forty metres away in a crowd, and you cannot name a
   texture.

   So everything is built from two pieces. The shell is a lofted shape
   over the skull whose lower edge is a function of azimuth: raise it
   at the face and you get a hairline, drop it and you get a fringe
   over the brow, add a triangle wave and you get the ragged cut that
   makes half these styles read as hair rather than as a helmet. The
   tuft is a solid horn with a point on it, and it is what spikes,
   tails, braids and locs are all made of.

   Azimuth runs 0 at the face and +/-PI at the nape; elevation 0 at the
   ears, 1.565 at the crown, negative below. The brow sits at about
   +0.20 and the eyes at -0.12, which is the range every fringe in
   this file is tuned against. */

/* Triangle wave in -1..1, for the teeth along a cut edge. */
function tri(x){x=x-Math.floor(x);return 4*Math.abs(x-0.5)-1;}
/* Smoothstep on an already-clamped 0..1. */
function smooth(t){return t*t*(3-2*t);}
/* 1 at the face, 0 at the nape — every hairline is written in terms
   of this rather than in raw azimuth, so a style reads as "low at the
   front, lower at the back" instead of as trigonometry. */
function fw(az){return (1+Math.cos(az))*0.5;}
/* The usual hairline: one number at the face, one at the nape. */
function line(front,back){
  return function(az){var f=fw(az);return back+(front-back)*f*f;};
}

function shell(b,cfg){
  var n=cfg.n||36, rows=cfg.rows||13;
  var eMin=cfg.eMin===undefined?-0.85:cfg.eMin;
  var jag=cfg.jag||0, teeth=cfg.teeth||7, ph=cfg.phase||0;
  var out=cfg.out||function(){return 0.18;};
  var lo=cfg.lo, i, k;
  var sh0=cfg.sh0===undefined?0.16:cfg.sh0;
  var sh1=cfg.sh1===undefined?0.80:cfg.sh1;
  /* Below its own edge a point is pulled inside the skull, where the
     head hides it. A ring has one height, so a shell cannot simply
     stop at a hairline that is higher at the face than at the nape —
     it has to emerge through one. */
  var IN=0.86;
  /* The skull ellipsoid these styles are authored against is a
     stand-in, and it is a slightly small one: the real head mesh is
     about five per cent wider than it between the temples and the
     crown. A shell that only cleared the ellipsoid let the head poke
     through the top of every short style. `pad` is that difference,
     applied where it exists rather than everywhere. */
  function pad(el){
    /* The head is wider than the ellipsoid over most of its upper
       half, not just near the crown — at the temples it is about four
       per cent out, which was enough for a bare patch to show through
       every short style at exactly eye level. */
    var t=(el+0.10)/1.40;
    if(t<=0)return 0;
    if(t>1)t=1;
    return 0.088*t*t*(3-2*t);
  }
  function rAt(az,k,el){
    var lim=lo(az)+(jag?jag*tri(k/n*teeth+ph):0);
    var o=1.05+pad(el)+out(az,el);
    /* The hairline as a roll rather than a cliff. At 0.09 the shell
       went from inside the skull to its full radius across one ring,
       which under a directional key is a bright vertical wall running
       round the head — the hard sawtooth edge every short style had.
       Spread over three times the elevation it reads as hair meeting
       skin. */
    if(el<lim)return IN;
    if(el<lim+0.26)return M.lerp(IN,o,smooth((el-lim)/0.26));
    return o;
  }
  /* Rings are unshifted rather than pushed. `scalpPt` walks the ring as
     (sin az, cos az) and Geo.circle — which is what Builder.loft's
     winding rule was written against — walks it as (cos a, sin a), the
     opposite way round. Built the obvious way the whole shell faces
     inward and renders as an unlit black helmet, which is exactly what
     the old strand cap did for the whole of its life. */
  var secs=[], yB=scalpPt(0,eMin,1)[1];
  /* The hanging part first, because a loft runs bottom to top. Hair
     past the jaw cannot be a scale of the skull — the ellipsoid stops
     at the chin — so it continues straight down at whatever azimuths
     the style says hang, and collapses to a thin core everywhere else,
     which the neck covers. */
  if(cfg.drop){
    var hang=cfg.hang||function(){return 1;};
    var steps=cfg.dropRows||6;
    for(i=steps;i>=1;i--){
      var u=i/steps, pts2=[];
      for(k=0;k<n;k++){
        var az2=(k/n)*M.TAU, h=hang(az2), r2;
        if(h<=0.001||u>h)r2=0.24;
        else r2=rAt(az2,k,eMin+0.001)*(1-u*(cfg.taperIn||0.10));
        var q2=scalpPt(az2,eMin,r2);
        pts2.unshift([q2[0],q2[2]]);
      }
      secs.push({y:yB-cfg.drop*u,pts:pts2,
                 col:hairShade(M.lerp(sh0*0.7,sh0,1-u))});
    }
  }
  for(i=0;i<=rows;i++){
    var t=i/rows, el=M.lerp(eMin,1.566,t), pts=[];
    for(k=0;k<n;k++){
      var az=(k/n)*M.TAU;
      var q=scalpPt(az,el,rAt(az,k,el));
      pts.unshift([q[0],q[2]]);
    }
    secs.push({y:scalpPt(0,el,1)[1],pts:pts,
               col:hairShade(M.lerp(sh0,sh1,t))});
  }
  b.loft(secs,hairShade(0.55),{openBottom:true,uvScale:1.6});
}

/* One solid horn leaving the scalp. `out` is how much of its direction
   comes from the surface normal and `dir` is the rest, so a spike can
   stand straight up off the side of a head. */
function tuft(b,az,el,o){
  var st=scalpPt(az,el,o.r===undefined?1.03:o.r);
  var nv=scalpNormal(az,el);
  var ou=o.out===undefined?1:o.out;
  var d=o.dir||[0,0,0];
  hairCard(b,{
    start:st,
    dir:[nv[0]*ou+d[0],nv[1]*ou+d[1],nv[2]*ou+d[2]],
    side:nv,
    len:o.len,w:o.w,th:o.th===undefined?o.w*0.88:o.th,
    taper:o.taper===undefined?0.95:o.taper,
    droop:o.droop||0,sweep:o.sweep||null,
    curl:o.curl||0,curlFreq:o.curlFreq||2,curlPh:o.ph||0,
    seg:o.seg||5});
}

/* A row of them between two bearings, jittered, because a row of
   identical spikes reads as a machine part. */
function crest(b,o){
  var rng=M.rng(o.seed||5);
  for(var i=0;i<o.n;i++){
    var t=o.n===1?0.5:i/(o.n-1);
    var az=M.lerp(o.az0,o.az1,t)+(rng()-0.5)*(o.azJit||0);
    var el=(typeof o.el==='function'?o.el(t):o.el)+(rng()-0.5)*(o.elJit||0);
    tuft(b,az,el,{
      len:o.len*(1+(rng()-0.5)*(o.lenJit===undefined?0.30:o.lenJit)),
      w:o.w*(1+(rng()-0.5)*0.24),th:o.th,r:o.r,
      out:o.out,dir:o.dir,droop:o.droop,sweep:o.sweep,
      taper:o.taper,seg:o.seg,curl:o.curl,curlFreq:o.curlFreq,
      ph:rng()*6.28});
  }
}

/* Spikes scattered over a patch rather than along a line — the
   difference between a mohawk and a messy mop. */
function scatter(b,o){
  var rng=M.rng(o.seed||11);
  for(var i=0;i<o.n;i++){
    var az=rng()*M.TAU;
    var el=M.lerp(o.el0,o.el1,rng());
    tuft(b,az,el,{
      len:o.len*(0.65+rng()*0.7),w:o.w*(0.8+rng()*0.5),th:o.th,
      out:o.out,dir:o.dir,droop:o.droop,sweep:o.sweep,
      taper:o.taper,seg:o.seg,r:o.r,ph:rng()*6.28,
      curl:o.curl,curlFreq:o.curlFreq});
  }
}

/* A gathered knot — a bun, a topknot, the head of a ponytail. Solid,
   because a bun made of cards is a bird's nest. */
function knot(b,c,r,squash){
  b.sphere(c[0],c[1],c[2],r,14,10,hairShade(0.62),{squash:squash||0.86});
  b.sphere(c[0],c[1]-r*0.62,c[2],r*0.52,10,8,hairShade(0.34),{squash:0.8});
}
/* The elastic. One dark ring, and it is most of what says "tied". */
function tie(b,c,r){
  b.push();b.translate(c[0],c[1],c[2]);
  b.loft([{y:-r*0.42,pts:Geo.circle(r,12)},
          {y: r*0.42,pts:Geo.circle(r,12)}],hairShade(0.06),
         {openTop:true,openBottom:true});
  b.pop();
}
/* A braid or a loc: beads of hair down a falling path. */
function rope(b,st,dir,len,r,beads,sway,seed){
  var rng=M.rng(seed||3);
  var d=nrm3(dir.slice()), p=st.slice();
  var step=len/beads;
  for(var i=0;i<beads;i++){
    var t=i/(beads-1||1);
    var rr=r*(1-0.42*t*t);
    b.sphere(p[0],p[1],p[2],rr,11,8,hairShade(0.20+t*0.42),{squash:1.04});
    d[0]+=sway*(rng()-0.5)*0.5;d[2]+=sway*(rng()-0.5)*0.5;d[1]-=sway*0.55;
    d=nrm3(d);
    p[0]+=d[0]*step;p[1]+=d[1]*step;p[2]+=d[2]*step;
  }
}

/* ---------------- the roster ----------------
   Twenty styles, and not one of them is free. Every one is an item in
   LH.Data with a rarity and a price, you start bald, and the wardrobe
   will not offer you a hairstyle you do not own — see D.HAIRS and
   G.ownsHair. That is the whole reason each of these is a designed
   shape with a name rather than a slider position: a haircut somebody
   paid for has to be worth recognising on somebody else.

   Each entry is a shell and, if the style has any, its spikes. The
   numbers that matter are the two ends of the hairline — a fringe at
   +0.20 sits on the brow, one at -0.10 sits over the eyes — and the
   radial `out`, which is how far the mass stands off the skull. */
var HAIR_BUILD={
  /* --- short, everyday --- */
  crop:function(b){
    shell(b,{lo:line(0.12,-0.50),out:function(){return 0.115;},
      jag:0.017,teeth:11,rows:12});
  },
  bowl:function(b){
    /* A bowl is a cut, not a shape: one height all the way round, and
       the flat fringe across the brow is the entire style. */
    shell(b,{lo:function(){return -0.02;},out:function(){return 0.175;},
      rows:14,n:40,sh0:0.22});
  },
  pixie:function(b){
    shell(b,{lo:line(0.03,-0.42),out:function(az){return 0.13+fw(az)*0.05;},
      jag:0.041,teeth:13,rows:13});
    crest(b,{n:5,az0:-0.7,az1:0.7,el:0.30,len:0.030,w:0.014,out:0.5,
      dir:[0,0.35,0.55],droop:0.5,seed:3,elJit:0.10});
  },
  undercut:function(b){
    /* The shaved band and the mass above it are two shells with a hard
       line between them, and that line is the style. */
    shell(b,{lo:line(-0.06,-0.46),out:function(){return 0.030;},rows:8,
      sh0:0.10,sh1:0.34});
    shell(b,{lo:function(az){return 0.30+Math.sin(az)*0.05;},
      out:function(az,el){return 0.20+Math.max(0,Math.cos(az))*0.09;},
      rows:11,eMin:0.20,sh0:0.30});
  },
  swept:function(b){
    /* Everything falls to one side. The hairline drops on the left and
       the mass thickens toward the front-left, which is what makes a
       parting read from the front. */
    shell(b,{lo:function(az){return line(0.08,-0.46)(az)-Math.sin(az)*0.16;},
      out:function(az){return 0.15+Math.max(0,Math.cos(az))*0.11+
        Math.max(0,Math.sin(az))*0.05;},
      jag:0.025,teeth:8,rows:13});
    crest(b,{n:7,az0:-1.15,az1:0.35,el:0.24,len:0.052,w:0.016,out:0.35,
      dir:[-0.55,0.05,0.65],droop:0.9,seed:23,elJit:0.12,lenJit:0.34});
  },
  /* --- messy and spiked --- */
  mop:function(b){
    shell(b,{lo:line(-0.06,-0.54),out:function(){return 0.20;},
      jag:0.063,teeth:12,rows:13});
    scatter(b,{n:26,el0:0.15,el1:1.40,len:0.040,w:0.014,out:0.9,
      dir:[0,0.25,0],droop:0.7,seed:11,curl:0.5,curlFreq:1.6});
    crest(b,{n:9,az0:-1.05,az1:1.05,el:0.06,len:0.038,w:0.013,out:0.55,
      dir:[0,-0.15,0.5],droop:1.5,seed:12,elJit:0.14});
  },
  spiked:function(b){
    shell(b,{lo:line(0.20,-0.40),out:function(){return 0.085;},rows:11});
    scatter(b,{n:20,el0:0.35,el1:1.45,len:0.072,w:0.020,out:0.55,
      dir:[0,0.9,0],droop:-0.25,seed:53,seg:4,taper:0.98});
  },
  bolt:function(b){
    /* Nine of them, swept hard back, and nothing else. The silhouette
       is the item. */
    shell(b,{lo:line(0.24,-0.34),out:function(){return 0.070;},rows:10,
      sh0:0.12,sh1:0.62});
    crest(b,{n:9,az0:-1.5,az1:1.5,
      el:function(t){return 0.55+Math.sin(t*Math.PI)*0.75;},
      len:0.135,w:0.026,out:0.45,dir:[0,0.85,-0.55],droop:-0.35,
      seed:67,seg:5,taper:0.97,lenJit:0.22});
    crest(b,{n:4,az0:2.3,az1:3.98,el:1.05,len:0.105,w:0.022,out:0.35,
      dir:[0,0.6,-0.8],droop:-0.2,seed:68,seg:5,taper:0.97});
  },
  flame:function(b){
    shell(b,{lo:line(0.17,-0.42),out:function(){return 0.095;},rows:11,
      sh0:0.14});
    scatter(b,{n:22,el0:0.45,el1:1.50,len:0.115,w:0.019,out:0.35,
      dir:[0,1.15,-0.30],droop:-0.55,seed:171,seg:6,taper:0.96,
      curl:1.1,curlFreq:1.2});
  },
  mohawk:function(b){
    shell(b,{lo:line(0.01,-0.44),out:function(){return 0.028;},rows:8,
      sh0:0.08,sh1:0.30});
    crest(b,{n:7,az0:0,az1:0,
      el:function(t){return 0.40+t*1.10;},
      len:0.105,w:0.024,out:0.30,dir:[0,1.0,0.10],droop:-0.30,
      seed:81,seg:5,azJit:0.06,lenJit:0.18});
    crest(b,{n:6,az0:Math.PI,az1:Math.PI,
      el:function(t){return 1.45-t*0.95;},
      len:0.092,w:0.022,out:0.30,dir:[0,1.0,-0.10],droop:-0.25,
      seed:82,seg:5,azJit:0.06,lenJit:0.18});
  },
  /* --- heavy and long --- */
  veil:function(b){
    /* The fringe comes down past the brow and the edge is cut into
       points. It is meant to read as a hood of hair. */
    shell(b,{lo:line(-0.13,-0.66),out:function(az){return 0.20+fw(az)*0.07;},
      jag:0.074,teeth:7,rows:14,n:42,drop:0.045,dropRows:3,
      hang:function(az){return 1-fw(az)*fw(az);},
      sh0:0.08,sh1:0.58});
  },
  long:function(b){
    shell(b,{lo:line(0.09,-0.78),out:function(){return 0.185;},
      jag:0.025,teeth:9,rows:14,n:40,
      drop:0.150,dropRows:7,taperIn:0.14,
      hang:function(az){var f=fw(az);return M.clamp(1.35-f*2.1,0,1);}});
  },
  wave:function(b){
    /* Long, but parted and falling forward over one shoulder, so it
       reads differently from the back in a crowd. */
    shell(b,{lo:function(az){return line(0.05,-0.74)(az)-Math.sin(az)*0.12;},
      out:function(az){return 0.19+Math.max(0,-Math.sin(az))*0.06;},
      jag:0.017,teeth:14,rows:14,n:40,
      drop:0.135,dropRows:7,taperIn:0.16,
      hang:function(az){
        var f=fw(az);
        return M.clamp(1.30-f*1.9+Math.max(0,-Math.sin(az))*0.55,0,1);}});
  },
  afro:function(b){
    shell(b,{lo:line(0.08,-0.44),out:function(){return 0.470;},
      jag:0.030,teeth:22,rows:16,n:44,sh0:0.20});
  },
  curls:function(b){
    shell(b,{lo:line(0.02,-0.50),out:function(){return 0.245;},
      jag:0.039,teeth:15,rows:14,n:40});
    /* the bumps that turn a smooth mass into a curly one */
    var rng=M.rng(113);
    for(var i=0;i<40;i++){
      var az=rng()*M.TAU, el=M.lerp(-0.30,1.45,rng());
      var q=scalpPt(az,el,1.26);
      b.sphere(q[0],q[1],q[2],0.017+rng()*0.008,8,6,
               hairShade(0.42+rng()*0.30),{squash:0.9});
    }
  },
  locs:function(b){
    shell(b,{lo:line(0.11,-0.46),out:function(){return 0.115;},rows:11,
      sh0:0.12,sh1:0.48});
    var rng=M.rng(73);
    for(var i=0;i<22;i++){
      var az=rng()*M.TAU;
      var el=M.lerp(-0.10,0.95,rng());
      var st=scalpPt(az,el,1.14);
      var nv=scalpNormal(az,el);
      rope(b,st,[nv[0]*0.55,-0.85,nv[2]*0.55],
        0.10+rng()*0.085,0.0165,9,0.16,7+i);
    }
  },
  /* --- tied --- */
  bun:function(b){
    shell(b,{lo:line(0.13,-0.38),out:function(){return 0.105;},rows:11,
      sh0:0.18});
    var c=scalpPt(Math.PI,1.02,1.20);
    tie(b,c,0.026);
    knot(b,[c[0],c[1]+0.028,c[2]],0.046,0.90);
  },
  topknot:function(b){
    shell(b,{lo:line(-0.03,-0.42),out:function(){return 0.035;},rows:8,
      sh0:0.08,sh1:0.34});
    var c=scalpPt(0.30,1.40,1.10);
    tie(b,c,0.020);
    knot(b,[c[0],c[1]+0.032,c[2]],0.034,0.78);
    crest(b,{n:5,az0:-0.6,az1:0.6,el:1.30,len:0.038,w:0.010,out:0.4,
      dir:[0,0.9,0.1],droop:0.9,seed:127});
  },
  ponytail:function(b){
    shell(b,{lo:line(0.11,-0.40),out:function(){return 0.115;},rows:11});
    var c=scalpPt(Math.PI,0.62,1.14);
    tie(b,c,0.024);
    rope(b,[c[0],c[1]-0.010,c[2]],[0,-0.55,-0.85],0.185,0.030,13,0.10,97);
  },
  twin:function(b){
    shell(b,{lo:line(0.09,-0.42),out:function(){return 0.120;},rows:11,
      jag:0.017,teeth:10});
    for(var s=-1;s<=1;s+=2){
      var c=scalpPt(s*1.60,0.30,1.16);
      tie(b,c,0.021);
      rope(b,[c[0]+s*0.010,c[1]-0.006,c[2]],[s*0.55,-0.75,-0.35],
        0.155,0.026,12,0.12,140+s);
    }
  },
  braids:function(b){
    shell(b,{lo:line(0.09,-0.46),out:function(){return 0.105;},rows:11,
      jag:0.014,teeth:16,sh0:0.14});
    for(var s=-1;s<=1;s+=2){
      var st=scalpPt(s*1.42,0.20,1.14);
      rope(b,st,[s*0.34,-0.92,0.10],0.215,0.023,15,0.07,61+s);
    }
  },
  bald:function(b){}
};
Body.HAIR=Object.keys(HAIR_BUILD);
/* Hair and hats are authored against a reference skull and scaled onto
   the real one here, so changing the head's profile does not mean
   re-measuring eleven hairstyles by hand. */
/* Hair and hats were modelled against the original skull. They are
   scaled to fit it, and now also by the cartoon head scale, so growing
   the head does not bury every hairstyle inside it. */
var HEAD_FIT=[1.085*P.headScale,1.060*P.headScale,1.085*P.headScale];
Body.hair=function(style){
  style=HAIR_BUILD[style]?style:'crop';
  return part('hair:'+style,function(b){
    b.mat('hair');
    /* Hats keep the 1.085 stand-off because they were authored against
       a reference skull. Hair does not: every card here is placed on
       the skull ellipsoid itself, so scaling it out again would lift
       the whole head of hair off the scalp by seven millimetres. */
    b.push();b.scale(P.headScale,P.headScale,P.headScale);
    HAIR_BUILD[style](b);
    b.pop();
  },160);
};

/* ---------------- headwear ---------------- */
var HAT_BUILD={
  cap:function(b){
    b.loft([
      {y:0.020,pts:Geo.roundRect(0.200,0.208,0.092,14)},
      {y:0.090,pts:Geo.roundRect(0.198,0.204,0.090,14)},
      {y:0.140,pts:Geo.roundRect(0.160,0.168,0.074,14)},
      {y:0.168,pts:Geo.roundRect(0.084,0.088,0.040,14)}
    ],LIT,{openBottom:true});
    b.push();b.translate(0,0.026,0.140);b.rotate(-0.16,0,0);
    b.loft([
      {y:-0.008,pts:Geo.roundRect(0.190,0.150,0.070,12)},
      {y: 0.010,pts:Geo.roundRect(0.196,0.156,0.072,12)}
    ],MID,{});
    b.pop();
    b.push();b.translate(0,0.176,0);b.sphere(0,0,0,0.016,8,6,MID);b.pop();
  },
  beanie:function(b){
    b.loft([
      {y:-0.010,pts:Geo.roundRect(0.206,0.214,0.096,14)},
      {y: 0.060,pts:Geo.roundRect(0.208,0.216,0.096,14)},
      {y: 0.120,pts:Geo.roundRect(0.186,0.194,0.086,14)},
      {y: 0.164,pts:Geo.roundRect(0.120,0.126,0.056,14)},
      {y: 0.188,pts:Geo.roundRect(0.052,0.056,0.024,14)}
    ],LIT,{openBottom:true});
    b.push();b.translate(0,0.006,0);
    b.loft([
      {y:0,    pts:Geo.roundRect(0.216,0.224,0.100,14)},
      {y:0.044,pts:Geo.roundRect(0.216,0.224,0.100,14)}
    ],MID,{openTop:true,openBottom:true});
    b.pop();
    b.push();b.translate(0,0.202,0);b.sphere(0,0,0,0.030,10,8,MID);b.pop();
  },
  brim:function(b){
    b.loft([
      {y:0.010,pts:Geo.roundRect(0.196,0.202,0.090,14)},
      {y:0.120,pts:Geo.roundRect(0.190,0.196,0.088,14)},
      {y:0.176,pts:Geo.roundRect(0.176,0.182,0.082,14)}
    ],LIT,{openBottom:true});
    b.push();b.translate(0,0.014,0);
    b.loft([
      {y:0,     pts:Geo.circle(0.212,16,1.0,1.06)},
      {y:0.016, pts:Geo.circle(0.208,16,1.0,1.06)}
    ],MID,{});
    b.pop();
    b.push();b.translate(0,0.100,0);
    b.loft([
      {y:0,     pts:Geo.roundRect(0.206,0.212,0.094,14)},
      {y:0.030, pts:Geo.roundRect(0.206,0.212,0.094,14)}
    ],DARK,{openTop:true,openBottom:true});
    b.pop();
  },
  crown:function(b){
    /* band */
    b.mat('gold');
    b.loft([
      {y:0.030,pts:Geo.roundRect(0.198,0.204,0.092,16)},
      {y:0.100,pts:Geo.roundRect(0.202,0.208,0.094,16)}
    ],LIT,{openTop:true,openBottom:true});
    /* five points, tallest at the front */
    for(var i=0;i<5;i++){
      var a=(-0.5+i/4)*2.0;
      var tall=0.062+Math.cos(a)*0.040;
      b.push();
      b.translate(Math.sin(a)*0.100,0.100,Math.cos(a)*0.104);
      b.rotate(0,a,0);
      b.extrude([[-0.030,0],[0.030,0],[0,tall]],0.020,LIT);
      b.pop();
      /* a set jewel at each point's base */
      b.mat('crystal',0.30);
      b.push();
      b.translate(Math.sin(a)*0.104,0.070,Math.cos(a)*0.108);
      b.sphere(0,0,0,0.017,8,6,LIT,{squash:0.8});
      b.pop();
      b.mat('gold');
    }
  },
  halo:function(b){
    /* a ring of overlapping emissive beads reads as a torus at this
       size and costs a fraction of one */
    b.mat('neon',1.0);
    b.push();b.translate(0,0.230,0);
    for(var k=0;k<26;k++){
      var a=k/26*M.TAU;
      b.push();
      b.translate(Math.cos(a)*0.145,0,Math.sin(a)*0.145);
      b.sphere(0,0,0,0.016,6,5,LIT);
      b.pop();
    }
    b.pop();
  },
  visor:function(b){
    b.mat('panel');
    b.loft([
      {y:0.030,pts:Geo.roundRect(0.204,0.210,0.094,14)},
      {y:0.096,pts:Geo.roundRect(0.200,0.206,0.092,14)},
      {y:0.150,pts:Geo.roundRect(0.160,0.166,0.074,14)}
    ],LIT,{openBottom:true});
    b.mat('neon',0.85);
    b.push();b.translate(0,0.026,0.108);b.rotate(-0.10,0,0);
    b.chamfer(0,0,0,0.216,0.040,0.036,LIT,0.014,{noBand:true});b.pop();
  },
  /* Tricorn. The brim is a rounded triangle rather than a circle with
     three flaps stuck on — the outline has to be the hat, because at
     twenty metres the outline is all there is. */
  tricorn:function(b){
    function triBrim(r,n){
      var pts=[];
      for(var i=0;i<n;i++){
        var a=i/n*M.TAU;
        var rr=r*(1.0+0.140*Math.cos(3*a+Math.PI));
        pts.push([Math.sin(a)*rr,Math.cos(a)*rr]);
      }
      return pts;
    }
    b.loft([
      {y:0.014,pts:Geo.roundRect(0.198,0.204,0.092,14)},
      {y:0.108,pts:Geo.roundRect(0.192,0.198,0.090,14)},
      {y:0.150,pts:Geo.roundRect(0.168,0.174,0.078,14)}
    ],LIT,{openBottom:true});
    /* 0.245 is a radius, so the brim reads about two and a half times
       the width of the crown — the existing round brim uses 0.300 and
       anything past that stops looking like a hat and starts looking
       like a parasol. */
    b.push();b.translate(0,0.026,0);
    b.loft([
      {y:0,     pts:triBrim(0.196,24)},
      {y:0.020, pts:triBrim(0.192,24)}
    ],MID,{});
    b.pop();
    /* the three cocked corners, turned up against the crown */
    for(var k=0;k<3;k++){
      var a=k/3*M.TAU+Math.PI;
      b.push();
      b.translate(Math.sin(a)*0.166,0.050,Math.cos(a)*0.166);
      b.rotate(0,a,0);
      b.rotate(-0.62,0,0);
      b.chamfer(0,0.046,0,0.190,0.098,0.020,LIT,0.014,{noBand:true});
      b.pop();
    }
    /* hatband and a cockade at the left corner */
    b.push();b.translate(0,0.062,0);
    b.loft([
      {y:0,     pts:Geo.roundRect(0.206,0.212,0.096,14)},
      {y:0.032, pts:Geo.roundRect(0.206,0.212,0.096,14)}
    ],DARK,{openTop:true,openBottom:true});
    b.pop();
    b.mat('gold');
    b.push();b.translate(-0.126,0.092,0.108);b.rotate(0,-0.7,0.3);
    b.sphere(0,0,0,0.038,10,8,LIT,{squash:0.5});b.pop();
    b.mat('blank');
  },
  /* Hard hat. Ribs down the crown and a short peak; the lamp is the
     only emissive part, so it still reads in the quarry shadow. */
  hardhat:function(b){
    b.loft([
      {y:-0.010,pts:Geo.roundRect(0.222,0.230,0.104,16)},
      {y: 0.060,pts:Geo.roundRect(0.220,0.228,0.104,16)},
      {y: 0.130,pts:Geo.roundRect(0.198,0.206,0.092,16)},
      {y: 0.180,pts:Geo.roundRect(0.128,0.134,0.060,16)},
      {y: 0.202,pts:Geo.roundRect(0.056,0.060,0.028,16)}
    ],LIT,{openBottom:true});
    /* the crown rib, and a shorter one either side */
    b.push();b.translate(0,0.176,-0.006);
    b.chamfer(0,0,0,0.030,0.030,0.230,MID,0.010,{noBand:true});b.pop();
    for(var s2=-1;s2<=1;s2+=2){
      b.push();b.translate(s2*0.062,0.148,-0.006);b.rotate(0,0,s2*0.30);
      b.chamfer(0,0,0,0.022,0.022,0.196,MID,0.008,{noBand:true});b.pop();
    }
    /* brim, wider at the front than the back */
    b.push();b.translate(0,0.014,0.024);
    b.loft([
      {y:0,     pts:Geo.circle(0.132,18,1.0,1.16)},
      {y:0.020, pts:Geo.circle(0.128,18,1.0,1.16)}
    ],MID,{});
    b.pop();
    b.mat('panel');
    b.push();b.translate(0,0.090,0.112);
    b.chamfer(0,0,0,0.086,0.062,0.044,MID,0.012);b.pop();
    b.mat('neon',1.0);
    b.push();b.translate(0,0.090,0.138);
    b.sphere(0,0,0,0.026,8,6,'#FFE9B0',{squash:0.7});b.pop();
    b.mat('blank');
  },
  /* Flat cap. Body overhangs the peak and sits off-centre; a symmetric
     one reads as a bowl. */
  flatcap:function(b){
    b.loft([
      {y:0.012,pts:Geo.roundRect(0.200,0.208,0.094,14)},
      {y:0.062,pts:Geo.roundRect(0.204,0.214,0.096,14)},
      {y:0.098,pts:Geo.roundRect(0.196,0.206,0.092,14)}
    ],LIT,{openBottom:true});
    b.push();b.translate(-0.012,0.098,-0.022);b.rotate(-0.10,0,0.07);
    b.scale(1.14,0.34,1.24);
    b.sphere(0,0,0,0.128,14,10,LIT);b.pop();
    b.push();b.translate(0,0.038,0.122);b.rotate(-0.24,0,0);
    b.loft([
      {y:-0.008,pts:Geo.roundRect(0.176,0.118,0.058,12)},
      {y: 0.010,pts:Geo.roundRect(0.180,0.122,0.060,12)}
    ],DARK,{});
    b.pop();
  },
  /* Headwrap. Three bands wound at slightly different angles, plus a
     tail — the offset angles are the whole trick, one clean ring reads
     as a sweatband. */
  headwrap:function(b){
    var band=[[0.016,0.00,0.000],[0.062,0.09,0.030],[0.106,-0.07,-0.020]];
    for(var i=0;i<3;i++){
      var B=band[i];
      b.push();b.translate(0,B[0],B[2]);b.rotate(B[1]*0.5,0,B[1]);
      b.loft([
        {y:0,     pts:Geo.roundRect(0.206,0.214,0.098,14)},
        {y:0.056, pts:Geo.roundRect(0.208,0.216,0.098,14)}
      ],i%2?LIT:MID,{openTop:true,openBottom:true});
      b.pop();
    }
    /* the crown is closed off, otherwise you can see into the skull */
    b.push();b.translate(0,0.146,-0.004);
    b.scale(1.0,0.52,1.0);
    b.sphere(0,0,0,0.112,14,10,LIT);b.pop();
    /* the knot and its tail, hanging at the left */
    b.push();b.translate(-0.108,0.086,-0.042);b.rotate(0,0.4,0.3);
    b.sphere(0,0,0,0.048,10,8,MID,{squash:0.9});
    b.push();b.translate(-0.010,-0.040,-0.020);b.rotate(0.2,0,0.24);
    b.loft([
      {y: 0.010,pts:Geo.roundRect(0.052,0.030,0.014,8)},
      {y:-0.110,pts:Geo.roundRect(0.062,0.034,0.016,8)},
      {y:-0.210,pts:Geo.roundRect(0.038,0.024,0.011,8)}
    ],LIT,{});
    b.pop();
    b.pop();
  },
  /* ---------------- the second shelf ----------------
     Ten hats is a wardrobe. Thirty is a shop, and a shop is what this
     game is about: the reason to walk into the store is that somebody
     else is wearing something you have not got.

     Every one of these is built to the same three rules as the ten
     above. A band at y 0.02 that clears the skull at 0.21 across, so
     it sits on the hairline rather than over the eyes. A crown that
     closes, because a hat you can see into is a hole in the head. And
     a silhouette that survives at forty metres — the detail is there
     for the wardrobe screen, the outline is there for the plaza. */

  tophat:function(b){
    b.push();b.translate(0,0.016,0);
    b.loft([{y:0,pts:Geo.circle(0.148,20,1.0,1.06)},
            {y:0.014,pts:Geo.circle(0.152,20,1.0,1.06)}],MID,{});
    b.pop();
    b.loft([
      {y:0.026,pts:Geo.circle(0.104,20,1.0,1.04)},
      {y:0.150,pts:Geo.circle(0.100,20,1.0,1.04)},
      {y:0.256,pts:Geo.circle(0.106,20,1.0,1.04)},
      {y:0.268,pts:Geo.circle(0.104,20,1.0,1.04)}
    ],LIT,{openBottom:true});
    /* the grosgrain band, which is the whole difference between a top
       hat and a black cylinder */
    b.loft([{y:0.036,pts:Geo.circle(0.108,20,1.0,1.04)},
            {y:0.072,pts:Geo.circle(0.108,20,1.0,1.04)}],DEEP,
           {openTop:true,openBottom:true});
  },
  fedora:function(b){
    b.push();b.translate(0,0.020,0.004);
    b.loft([{y:0,pts:Geo.circle(0.150,20,1.06,1.10)},
            {y:0.013,pts:Geo.circle(0.146,20,1.06,1.10)}],MID,{});
    b.pop();
    /* the pinch: two dents either side of a centre crease */
    b.loft([
      {y:0.030,pts:Geo.roundRect(0.208,0.216,0.090,16)},
      {y:0.110,pts:Geo.roundRect(0.196,0.204,0.086,16)},
      {y:0.156,pts:Geo.roundRect(0.150,0.170,0.062,16)}
    ],LIT,{openBottom:true});
    b.push();b.translate(0,0.150,0);b.scale(1.0,0.34,1.0);
    b.sphere(0,0,0,0.086,14,10,LIT);b.pop();
    for(var d=-1;d<=1;d+=2){
      b.push();b.translate(d*0.052,0.156,0);b.scale(1.0,0.5,1.4);
      b.sphere(0,0,0,0.030,10,8,MID,{squash:0.9});b.pop();
    }
    b.loft([{y:0.040,pts:Geo.roundRect(0.212,0.220,0.092,16)},
            {y:0.070,pts:Geo.roundRect(0.212,0.220,0.092,16)}],DEEP,
           {openTop:true,openBottom:true});
  },
  cowboy:function(b){
    /* The brim rolls up at the sides — a flat disc reads as a
       lampshade, and the roll is the entire silhouette. */
    b.push();b.translate(0,0.022,0.006);
    var n=22,lo=[],hi=[];
    for(var i=0;i<n;i++){
      var a=i/n*M.TAU, cx=Math.sin(a), cz=Math.cos(a);
      var roll=Math.abs(cx);
      lo.push([cx*0.180,cz*0.196]);
      hi.push([cx*0.176*(1+roll*0.06),cz*0.192]);
    }
    b.loft([{y:0,pts:lo},{y:0.014,pts:hi}],MID,{});
    b.pop();
    /* the rolled edges, as two beads down the sides */
    for(var s2=-1;s2<=1;s2+=2){
      b.push();b.translate(s2*0.166,0.040,0.006);b.scale(0.7,1.0,2.6);
      b.sphere(0,0,0,0.026,10,8,MID);b.pop();
    }
    b.loft([
      {y:0.032,pts:Geo.roundRect(0.202,0.212,0.088,16)},
      {y:0.116,pts:Geo.roundRect(0.186,0.198,0.082,16)},
      {y:0.176,pts:Geo.roundRect(0.132,0.156,0.058,16)}
    ],LIT,{openBottom:true});
    b.push();b.translate(0,0.174,0);b.scale(1.0,0.36,1.0);
    b.sphere(0,0,0,0.078,14,10,LIT);b.pop();
    b.push();b.translate(0,0.126,0);b.scale(1.0,0.9,1.0);
    b.chamfer(0,0,0,0.014,0.062,0.010,DEEP,0.004,{noBand:true});b.pop();
  },
  wizard:function(b){
    b.push();b.translate(0,0.018,0);
    b.loft([{y:0,pts:Geo.circle(0.164,20,1.0,1.05)},
            {y:0.014,pts:Geo.circle(0.158,20,1.0,1.05)}],MID,{});
    b.pop();
    /* A cone with a bent tip. The bend is a chain of beads rather than
       a chain of oriented cones: same silhouette, and no hand-rolled
       axis-to-euler conversion to get subtly wrong. */
    b.push();b.rotate(-0.06,0,0.10);
    b.cylinder(0,0.184,0,0.104,0.020,0.310,16,LIT);
    b.pop();
    var tip=[[0.028,0.330,-0.020],[0.062,0.372,-0.060],
             [0.108,0.390,-0.112],[0.152,0.376,-0.166]];
    for(var i5=0;i5<tip.length;i5++){
      b.push();b.translate(tip[i5][0],tip[i5][1],tip[i5][2]);
      b.sphere(0,0,0,0.026-i5*0.004,10,8,LIT);b.pop();
    }
    b.mat('neon',0.8);
    b.push();b.translate(0.152,0.376,-0.166);
    b.sphere(0,0,0,0.024,10,8,LIT);b.pop();
    b.mat('blank');
    /* stars on the band */
    for(var q=0;q<5;q++){
      var aa=(q/5)*M.TAU;
      b.push();b.translate(Math.sin(aa)*0.106,0.062,Math.cos(aa)*0.108);
      b.rotate(0,aa,0);
      b.chamfer(0,0,0,0.030,0.030,0.006,MID,0.008,{noBand:true});b.pop();
    }
  },
  witch:function(b){
    b.push();b.translate(0,0.018,0);
    b.loft([{y:0,pts:Geo.circle(0.196,22,1.0,1.02)},
            {y:0.012,pts:Geo.circle(0.188,22,1.0,1.02)}],MID,{});
    b.pop();
    b.push();b.rotate(-0.10,0,0.14);
    b.cylinder(0,0.176,0,0.104,0.012,0.300,16,LIT);
    b.pop();
    b.loft([{y:0.034,pts:Geo.circle(0.110,18,1.0,1.02)},
            {y:0.070,pts:Geo.circle(0.110,18,1.0,1.02)}],DEEP,
           {openTop:true,openBottom:true});
    b.push();b.translate(0.052,0.052,0.098);
    b.chamfer(0,0,0,0.048,0.038,0.010,MID,0.010);b.pop();
  },
  pirate:function(b){
    /* Bicorne: two peaks and a low middle, which is one loft with a
       shaped top rather than two cones. */
    b.push();b.translate(0,0.024,0);
    b.loft([
      {y:0,    pts:Geo.roundRect(0.330,0.184,0.070,18)},
      {y:0.056,pts:Geo.roundRect(0.322,0.176,0.068,18)},
      {y:0.104,pts:Geo.roundRect(0.238,0.152,0.060,18)},
      {y:0.130,pts:Geo.roundRect(0.140,0.126,0.048,18)}
    ],LIT,{openBottom:true});
    b.pop();
    for(var s3=-1;s3<=1;s3+=2){
      b.push();b.translate(s3*0.152,0.104,0);b.rotate(0,0,-s3*0.30);
      b.scale(1.0,1.5,0.7);
      b.sphere(0,0,0,0.038,10,8,MID);b.pop();
    }
    /* the skull, small and centred, in white */
    b.push();b.translate(0,0.078,0.098);
    b.sphere(0,0,0,0.028,12,9,'#F4F0EA',{squash:0.88});
    b.sphere(-0.010,0.004,0.020,0.008,7,6,'#1A1418');
    b.sphere( 0.010,0.004,0.020,0.008,7,6,'#1A1418');
    b.pop();
  },
  viking:function(b){
    b.mat('panel');
    b.loft([
      {y:0.014,pts:Geo.roundRect(0.212,0.220,0.094,16)},
      {y:0.100,pts:Geo.roundRect(0.204,0.212,0.092,16)},
      {y:0.166,pts:Geo.roundRect(0.148,0.156,0.066,16)}
    ],LIT,{openBottom:true});
    b.push();b.translate(0,0.164,0);b.scale(1.0,0.44,1.0);
    b.sphere(0,0,0,0.082,14,10,LIT);b.pop();
    /* the nasal, and the brow band */
    b.push();b.translate(0,0.020,0.104);
    b.chamfer(0,0,0,0.024,0.062,0.014,MID,0.006);b.pop();
    b.loft([{y:0.020,pts:Geo.roundRect(0.216,0.224,0.096,16)},
            {y:0.048,pts:Geo.roundRect(0.216,0.224,0.096,16)}],MID,
           {openTop:true,openBottom:true});
    /* horns, curved out and forward */
    for(var s4=-1;s4<=1;s4+=2){
      for(var h=0;h<6;h++){
        var t=h/5;
        b.push();
        b.translate(s4*(0.098+t*0.098),0.108+Math.sin(t*2.1)*0.070,
                    -0.010+t*t*0.052);
        b.sphere(0,0,0,0.030-t*0.020,9,7,'#EFE6D4');
        b.pop();
      }
    }
  },
  knight:function(b){
    b.mat('panel');
    b.loft([
      {y:0.006,pts:Geo.roundRect(0.216,0.230,0.070,18)},
      {y:0.090,pts:Geo.roundRect(0.212,0.226,0.080,18)},
      {y:0.170,pts:Geo.roundRect(0.150,0.168,0.062,18)}
    ],LIT,{openBottom:true});
    b.push();b.translate(0,0.168,0);b.scale(1.0,0.42,1.06);
    b.sphere(0,0,0,0.082,14,10,LIT);b.pop();
    /* the visor slot, and the rivets either side of it */
    b.push();b.translate(0,0.046,0.116);
    b.chamfer(0,0,0,0.152,0.020,0.010,'#14181F',0.004,{noBand:true});b.pop();
    for(var r2=-1;r2<=1;r2+=2){
      b.push();b.translate(r2*0.100,0.062,0.084);
      b.sphere(0,0,0,0.013,8,6,MID);b.pop();
    }
    b.mat('gold');
    b.push();b.translate(0,0.192,0);
    b.chamfer(0,0,0,0.020,0.036,0.150,LIT,0.006);b.pop();
  },
  santa:function(b){
    b.loft([
      {y:0.010,pts:Geo.roundRect(0.216,0.224,0.096,16)},
      {y:0.096,pts:Geo.roundRect(0.196,0.204,0.088,16)},
      {y:0.170,pts:Geo.roundRect(0.140,0.150,0.062,16)}
    ],LIT,{openBottom:true});
    /* the tip flops back and to one side */
    var tp=[[0,0.176,0],[-0.030,0.246,-0.052],[-0.078,0.268,-0.132],
            [-0.120,0.246,-0.208]];
    for(var i2=0;i2<tp.length;i2++){
      b.push();b.translate(tp[i2][0],tp[i2][1],tp[i2][2]);
      b.sphere(0,0,0,0.058-i2*0.010,12,9,LIT);b.pop();
    }
    b.push();b.translate(-0.120,0.246,-0.208);
    b.sphere(0,0,0,0.052,12,10,'#F6F4F0');b.pop();
    /* the fur band */
    b.loft([{y:0.004,pts:Geo.roundRect(0.230,0.238,0.100,16)},
            {y:0.052,pts:Geo.roundRect(0.234,0.242,0.102,16)},
            {y:0.070,pts:Geo.roundRect(0.222,0.230,0.096,16)}],'#F6F4F0',
           {openTop:true,openBottom:true});
  },
  elf:function(b){
    b.loft([
      {y:0.010,pts:Geo.roundRect(0.212,0.220,0.094,16)},
      {y:0.106,pts:Geo.roundRect(0.180,0.188,0.080,16)},
      {y:0.180,pts:Geo.roundRect(0.104,0.112,0.046,16)},
      {y:0.230,pts:Geo.roundRect(0.030,0.034,0.014,16)}
    ],LIT,{openBottom:true});
    b.push();b.translate(0,0.244,0);
    b.sphere(0,0,0,0.030,10,8,MID,{squash:0.9});b.pop();
    b.loft([{y:0.004,pts:Geo.roundRect(0.222,0.230,0.098,16)},
            {y:0.044,pts:Geo.roundRect(0.226,0.234,0.100,16)}],MID,
           {openTop:true,openBottom:true});
  },
  chef:function(b){
    b.loft([{y:0.010,pts:Geo.circle(0.108,18,1.0,1.04)},
            {y:0.084,pts:Geo.circle(0.106,18,1.0,1.04)}],MID,{openBottom:true});
    /* the puff: three overlapping squashed spheres so the top is a
       cloud rather than a drum */
    for(var q2=0;q2<3;q2++){
      var aa2=q2/3*M.TAU;
      b.push();
      b.translate(Math.sin(aa2)*0.044,0.148,Math.cos(aa2)*0.046);
      b.sphere(0,0,0,0.094,14,10,LIT,{squash:0.86});b.pop();
    }
    b.push();b.translate(0,0.176,0);
    b.sphere(0,0,0,0.086,14,10,LIT,{squash:0.82});b.pop();
  },
  straw:function(b){
    b.push();b.translate(0,0.018,0);
    b.loft([{y:0,pts:Geo.circle(0.196,22,1.0,1.02)},
            {y:0.010,pts:Geo.circle(0.190,22,1.0,1.02)},
            {y:0.024,pts:Geo.circle(0.150,22,1.0,1.02)}],LIT,{});
    b.pop();
    b.loft([{y:0.030,pts:Geo.circle(0.106,18,1.0,1.03)},
            {y:0.108,pts:Geo.circle(0.096,18,1.0,1.03)},
            {y:0.132,pts:Geo.circle(0.062,18,1.0,1.03)}],LIT,{openBottom:true});
    b.push();b.translate(0,0.134,0);b.scale(1.0,0.4,1.0);
    b.sphere(0,0,0,0.062,12,9,LIT);b.pop();
    b.loft([{y:0.038,pts:Geo.circle(0.110,18,1.0,1.03)},
            {y:0.062,pts:Geo.circle(0.110,18,1.0,1.03)}],DEEP,
           {openTop:true,openBottom:true});
  },
  sombrero:function(b){
    b.push();b.translate(0,0.020,0);
    b.loft([{y:0,pts:Geo.circle(0.290,26)},
            {y:0.018,pts:Geo.circle(0.282,26)},
            {y:0.046,pts:Geo.circle(0.190,26)}],LIT,{});
    b.pop();
    b.loft([{y:0.052,pts:Geo.circle(0.112,20)},
            {y:0.150,pts:Geo.circle(0.098,20)},
            {y:0.192,pts:Geo.circle(0.052,20)}],LIT,{openBottom:true});
    b.push();b.translate(0,0.194,0);b.scale(1.0,0.4,1.0);
    b.sphere(0,0,0,0.052,12,9,LIT);b.pop();
    /* embroidery: a ring of beads round the brim */
    for(var e2=0;e2<16;e2++){
      var ae=e2/16*M.TAU;
      b.push();b.translate(Math.sin(ae)*0.238,0.032,Math.cos(ae)*0.238);
      b.sphere(0,0,0,0.016,7,6,MID);b.pop();
    }
  },
  pith:function(b){
    b.push();b.translate(0,0.020,0.004);
    b.loft([{y:0,pts:Geo.circle(0.192,22,1.0,1.06)},
            {y:0.016,pts:Geo.circle(0.184,22,1.0,1.06)}],LIT,{});
    b.pop();
    b.loft([{y:0.030,pts:Geo.circle(0.116,20,1.0,1.04)},
            {y:0.118,pts:Geo.circle(0.106,20,1.0,1.04)}],LIT,{openBottom:true});
    b.push();b.translate(0,0.120,0);b.scale(1.0,0.62,1.04);
    b.sphere(0,0,0,0.106,16,12,LIT);b.pop();
    b.loft([{y:0.036,pts:Geo.circle(0.120,20,1.0,1.04)},
            {y:0.062,pts:Geo.circle(0.120,20,1.0,1.04)}],MID,
           {openTop:true,openBottom:true});
    /* the crown vent */
    b.push();b.translate(0,0.184,0);
    b.sphere(0,0,0,0.018,8,6,MID,{squash:0.7});b.pop();
  },
  football:function(b){
    b.mat('panel');
    b.push();b.translate(0,0.062,-0.006);b.scale(1.06,1.0,1.10);
    b.sphere(0,0,0,0.132,18,14,LIT,{squash:0.94});b.pop();
    /* ear holes, so it is a helmet and not a bowling ball */
    for(var s5=-1;s5<=1;s5+=2){
      b.push();b.translate(s5*0.128,0.040,-0.008);b.scale(0.3,1.0,1.0);
      b.sphere(0,0,0,0.042,10,8,DEEP);b.pop();
    }
    /* the facemask: three bars across the front */
    b.mat('blank');
    /* Bars run across the face, and a cylinder runs along Y, so each
       one is turned a quarter before it is drawn. */
    for(var g2=0;g2<3;g2++){
      b.push();b.translate(0,-0.010-g2*0.036,0.126+g2*0.006);
      b.rotate(0,0,Math.PI/2);
      b.cylinder(0,0,0,0.009,0.009,0.190,8,MID);b.pop();
    }
    b.push();b.translate(0,-0.046,0.128);b.rotate(0,0,Math.PI/2);
    b.cylinder(0,0,0,0.008,0.008,0.120,8,MID);b.pop();
  },
  spacehelmet:function(b){
    b.mat('panelw');
    b.push();b.translate(0,0.052,0);
    b.sphere(0,0,0,0.152,20,16,LIT,{squash:1.0});b.pop();
    b.mat('glass',0.10);
    b.push();b.translate(0,0.040,0.056);b.scale(1.0,0.92,0.72);
    b.sphere(0,0,0,0.130,18,14,LIT);b.pop();
    b.mat('panel');
    /* the neck ring, and the light on the temple */
    b.loft([{y:-0.070,pts:Geo.circle(0.126,18)},
            {y:-0.030,pts:Geo.circle(0.132,18)}],MID,
           {openTop:true,openBottom:true});
    b.mat('neon',0.9);
    b.push();b.translate(0.128,0.098,0.030);
    b.sphere(0,0,0,0.020,9,7,LIT);b.pop();
  },
  partyhat:function(b){
    b.push();b.translate(0.030,0,0);b.rotate(0,0,-0.18);
    b.cylinder(0,0.130,0,0.088,0.008,0.240,16,LIT);
    b.pop();
    b.push();b.translate(0.074,0.256,0);
    b.sphere(0,0,0,0.036,12,10,MID,{squash:0.94});b.pop();
    /* spots */
    for(var d2=0;d2<9;d2++){
      var td=d2/8, ad=d2*2.4;
      b.push();
      b.translate(0.030+Math.sin(ad)*0.070*(1-td)+td*0.044,
                  0.020+td*0.200,Math.cos(ad)*0.072*(1-td));
      b.sphere(0,0,0,0.014,7,6,MID,{squash:0.8});b.pop();
    }
  },
  headphones:function(b){
    b.mat('panel');
    /* the band, as an arc of beads over the crown */
    for(var i3=0;i3<11;i3++){
      var a3=(-0.95+i3/10*1.90);
      b.push();
      b.translate(Math.sin(a3)*0.126,0.108+Math.cos(a3)*0.108,-0.006);
      b.sphere(0,0,0,0.020,8,7,MID);b.pop();
    }
    for(var s6=-1;s6<=1;s6+=2){
      b.push();b.translate(s6*0.124,0.016,-0.006);b.rotate(0,0,s6*0.06);
      b.scale(0.44,1.0,1.0);
      b.sphere(0,0,0,0.070,14,11,LIT,{squash:1.10});
      b.push();b.translate(s6*0.052,0,0);b.scale(0.36,1.0,1.0);
      b.sphere(0,0,0,0.058,12,9,DEEP,{squash:1.06});b.pop();
      b.pop();
    }
    b.mat('neon',0.7);
    for(var s7=-1;s7<=1;s7+=2){
      b.push();b.translate(s7*0.156,0.016,-0.006);b.scale(0.2,1.0,1.0);
      b.sphere(0,0,0,0.046,10,8,LIT,{squash:1.06});b.pop();
    }
  },
  antlers:function(b){
    b.mat('bark');
    for(var s8=-1;s8<=1;s8+=2){
      /* a main beam with three tines off it */
      var beam=[[s8*0.056,0.110,-0.010],[s8*0.086,0.196,-0.030],
                [s8*0.132,0.262,-0.058],[s8*0.196,0.300,-0.086]];
      for(var k2=0;k2<beam.length;k2++){
        b.push();b.translate(beam[k2][0],beam[k2][1],beam[k2][2]);
        b.sphere(0,0,0,0.026-k2*0.005,9,7,LIT);b.pop();
      }
      var tines=[[1,0.30,0.10],[2,0.42,0.16],[3,0.36,0.12]];
      for(var t2=0;t2<tines.length;t2++){
        var base=beam[tines[t2][0]];
        for(var u=0;u<3;u++){
          b.push();
          b.translate(base[0]+s8*u*0.012,base[1]+u*tines[t2][1]*0.10,
                      base[2]-u*tines[t2][2]*0.10);
          b.sphere(0,0,0,0.017-u*0.004,7,6,MID);b.pop();
        }
      }
    }
  },
  bunnyears:function(b){
    for(var s9=-1;s9<=1;s9+=2){
      b.push();b.translate(s9*0.056,0.098,-0.012);b.rotate(-0.12,0,s9*0.20);
      b.scale(0.52,1.0,0.42);
      b.sphere(0,0.098,0,0.108,14,12,LIT,{squash:1.0});
      b.push();b.translate(0,0.098,0.052);b.scale(0.72,0.86,0.4);
      b.sphere(0,0,0,0.092,12,10,'#F2C6CC');b.pop();
      b.pop();
    }
    b.push();b.translate(0,0.056,0);b.scale(1.0,0.42,1.0);
    b.sphere(0,0,0,0.106,14,10,LIT);b.pop();
  },
  catears:function(b){
    for(var sa=-1;sa<=1;sa+=2){
      b.push();b.translate(sa*0.070,0.104,-0.004);b.rotate(0,0,sa*0.24);
      b.extrude([[-0.052,-0.010],[0.052,-0.010],[0,0.104]],0.030,LIT);
      b.push();b.translate(0,0.006,0.018);
      b.extrude([[-0.032,-0.006],[0.032,-0.006],[0,0.068]],0.010,'#F2C6CC');
      b.pop();
      b.pop();
    }
    b.push();b.translate(0,0.052,0);b.scale(1.0,0.36,1.0);
    b.sphere(0,0,0,0.104,14,10,LIT);b.pop();
  },
  ringmaster:function(b){
    b.push();b.translate(0,0.018,0);
    b.loft([{y:0,pts:Geo.circle(0.158,20,1.0,1.05)},
            {y:0.014,pts:Geo.circle(0.162,20,1.0,1.05)}],MID,{});
    b.pop();
    b.loft([
      {y:0.026,pts:Geo.circle(0.108,20,1.0,1.04)},
      {y:0.196,pts:Geo.circle(0.104,20,1.0,1.04)},
      {y:0.210,pts:Geo.circle(0.102,20,1.0,1.04)}
    ],LIT,{openBottom:true});
    b.mat('gold');
    b.loft([{y:0.034,pts:Geo.circle(0.112,20,1.0,1.04)},
            {y:0.076,pts:Geo.circle(0.112,20,1.0,1.04)}],LIT,
           {openTop:true,openBottom:true});
    b.push();b.translate(0,0.056,0.114);
    b.chamfer(0,0,0,0.040,0.040,0.010,LIT,0.010);b.pop();
  },
  none:function(b){}
};
Body.HATS=Object.keys(HAT_BUILD);
Body.hat=function(style){
  style=HAT_BUILD[style]?style:'none';
  return part('hat:'+style,function(b){
    b.mat('blank');
    /* Every hat in this file was authored with its band at y 0.02,
       which on the anatomical head is the eyeline — so they all sat
       across the eyebrows like a blindfold. The band belongs at the
       hairline, five and a half centimetres up. The 0.88 is the same
       correction in width: a brim authored against the old skull came
       out half a metre across on this one. */
    /* 0.94 put a hat band 0.39 metres across on a head 0.28 across,
       so every hat in the game hovered with a finger of daylight round
       it — which reads as broken long before it reads as loose. 0.76
       is snug: the band grips the skull and the brim still oversails
       it. */
    b.push();b.translate(0,0.026,0);
    b.scale(HEAD_FIT[0]*0.76,HEAD_FIT[1]*0.80,HEAD_FIT[2]*0.76);
    HAT_BUILD[style](b);
    b.pop();
  });
};

/* ---------------- facial hair ----------------
   Authored in the head's own space, not the hair's, because every one
   of these has to sit against a face landmark — the lip line, the jaw,
   the underside of the nose — and those are measured in Body.head.
   The tint is the hair colour, so the geometry is painted in greys. */
/* Head landmarks, all half-extents, because Geo.roundRect in Body.head
   is given full widths: the jaw reaches x 0.063, the cheek 0.083, the
   eyeline 0.093, and the face plane sits at about z 0.104. Everything
   below is measured against those four numbers. */
/* The lower face, as its own small ellipsoid. The skull one is too
   generous below the ears — a jaw tapers and a cranium does not — and
   facial hair sitting a centimetre off the chin reads as a beard drawn
   on a balloon. */
var JAW={cx:0,cy:-0.020,cz:0.006,rx:0.080,ry:0.106,rz:0.098};
function jawPt(az,y,out){
  var t=M.clamp((y-JAW.cy)/JAW.ry,-1,1);
  var ce=Math.sqrt(Math.max(0,1-t*t));
  return [JAW.cx+Math.sin(az)*ce*JAW.rx,
          y,
          JAW.cz+Math.cos(az)*ce*JAW.rz];
}
function jawNrm(az,y){
  var t=M.clamp((y-JAW.cy)/JAW.ry,-1,1);
  var ce=Math.sqrt(Math.max(0,1-t*t));
  var n=[Math.sin(az)*ce/JAW.rx,t/JAW.ry*0.55,Math.cos(az)*ce/JAW.rz];
  var l=Math.hypot(n[0],n[1],n[2])||1;
  return [n[0]/l,n[1]/l,n[2]/l];
}

/* A field of short strands over part of the face. Facial hair used to
   be a string of squashed spheres along the jaw, which read exactly as
   what it was — a string of squashed spheres along a jaw. Hair is
   strands at every scale, and stubble is just very short ones. */
function whiskers(b,cfg){
  var rng=M.rng(cfg.seed||5);
  for(var i=0;i<12;i++)rng();
  for(var i2=0;i2<cfg.count;i2++){
    var az=cfg.az0+(cfg.az1-cfg.az0)*rng();
    var y=cfg.y0+(cfg.y1-cfg.y0)*rng();
    if(cfg.mask&&!cfg.mask(az,y))continue;
    var p=jawPt(az,y);
    var n=jawNrm(az,y);
    var t=(y-cfg.y0)/((cfg.y1-cfg.y0)||1);
    var len=cfg.len*(0.65+rng()*0.7)*(cfg.lenAt?cfg.lenAt(az,y):1);
    var d=[n[0]*0.55+(rng()-0.5)*0.30,
           n[1]*0.55-cfg.droop,
           n[2]*0.55+(rng()-0.5)*0.20];
    var l=Math.hypot(d[0],d[1],d[2])||1;
    var seg=len>0.016?4:2;
    var pts=[],ws=[],cols=[];
    var q=[p[0]+n[0]*0.001,p[1]+n[1]*0.001,p[2]+n[2]*0.001];
    for(var k=0;k<=seg;k++){
      pts.push(q.slice());
      ws.push(cfg.w*(1-0.65*k/seg));
      cols.push(hairShade(k/seg));
      q=[q[0]+d[0]/l*len/seg,q[1]+d[1]/l*len/seg,q[2]+d[2]/l*len/seg];
    }
    ribbon(b,pts,ws,cfg.w*0.75,cols);
  }
}

var FACE_BUILD={
  stubble:function(b){
    whiskers(b,{seed:17,count:260,az0:-1.50,az1:1.50,y0:-0.118,y1:-0.030,
      len:0.0050,w:0.0018,droop:0.35,
      mask:function(az,y){
        /* not on the lips, and thinning up the cheek */
        if(Math.abs(az)<0.42&&y>-0.075&&y<-0.040)return false;
        return true;}});
    whiskers(b,{seed:19,count:70,az0:-0.42,az1:0.42,y0:-0.046,y1:-0.032,
      len:0.0045,w:0.0016,droop:0.25});
  },
  moustache:function(b){
    whiskers(b,{seed:23,count:130,az0:-0.46,az1:0.46,y0:-0.052,y1:-0.034,
      len:0.011,w:0.0021,droop:0.60,
      lenAt:function(az){return 1+Math.abs(az)*0.9;}});
  },
  goatee:function(b){
    FACE_BUILD.moustache(b);
    whiskers(b,{seed:29,count:190,az0:-0.44,az1:0.44,y0:-0.124,y1:-0.062,
      len:0.017,w:0.0022,droop:0.85,
      mask:function(az,y){return !(y>-0.074&&Math.abs(az)<0.30);}});
  },
  beard:function(b){
    FACE_BUILD.moustache(b);
    whiskers(b,{seed:31,count:520,az0:-1.42,az1:1.42,y0:-0.132,y1:-0.028,
      len:0.019,w:0.0023,droop:0.95,
      lenAt:function(az,y){return 0.5+1.1*(1-Math.abs(az)/1.5)+(y<-0.09?0.5:0);},
      mask:function(az,y){
        if(Math.abs(az)<0.44&&y>-0.074&&y<-0.038)return false;
        if(y>-0.050&&Math.abs(az)<1.05)return false;
        return true;}});
  },
  handlebar:function(b){
    /* A moustache with curled ends, which is the only kind anyone
       recognises from a silhouette. */
    for(var s=-1;s<=1;s+=2){
      for(var i=0;i<7;i++){
        var t=i/6;
        b.push();
        b.translate(s*(0.008+t*0.042),-0.040-Math.sin(t*1.6)*0.010,
                    0.088-t*0.014);
        b.sphere(0,0,0,0.011-t*0.003,8,6,i%2?LIT:MID,{squash:0.9});
        b.pop();
      }
      /* the curl */
      for(var c=0;c<4;c++){
        var a=c/3*2.4;
        b.push();
        b.translate(s*(0.052+Math.sin(a)*0.013),-0.030-Math.cos(a)*0.013,
                    0.072);
        b.sphere(0,0,0,0.008,7,6,MID);b.pop();
      }
    }
  },
  pencil:function(b){
    b.push();b.translate(0,-0.042,0.088);
    b.chamfer(0,0,0,0.050,0.005,0.008,MID,0.002,{noBand:true});b.pop();
  },
  bushy:function(b){
    /* A full beard as one mass with a jaw-shaped lower edge. */
    b.push();b.translate(0,-0.062,0.006);
    b.loft([{y:-0.076,pts:headSect(0.046,0.058,0.040,18,2.6)},
            {y:-0.036,pts:headSect(0.070,0.086,0.062,18,2.6)},
            {y: 0.004,pts:headSect(0.086,0.098,0.080,18,2.5)},
            {y: 0.030,pts:headSect(0.090,0.100,0.086,18,2.4)}],LIT,
           {openTop:true,openBottom:true});
    b.pop();
    /* the wool: beads over the mass so it is not a smooth shell */
    var rng=M.rng(41);
    for(var i=0;i<28;i++){
      var a=(rng()-0.5)*2.3, yy=-0.110+rng()*0.090;
      b.push();
      b.translate(Math.sin(a)*0.082,yy,0.030+Math.cos(a)*0.070);
      b.sphere(0,0,0,0.014+rng()*0.008,8,6,rng()<0.5?LIT:MID);b.pop();
    }
    b.push();b.translate(0,-0.040,0.086);
    b.chamfer(0,0,0,0.048,0.008,0.010,MID,0.003,{noBand:true});b.pop();
  },
  sideburns:function(b){
    for(var s=-1;s<=1;s+=2){
      for(var i=0;i<5;i++){
        var t=i/4;
        b.push();
        b.translate(s*(0.080-t*0.006),0.010-t*0.060,-0.004+t*0.010);
        b.scale(0.5,1.0,1.0);
        b.sphere(0,0,0,0.022-t*0.006,8,7,i%2?LIT:MID);b.pop();
      }
    }
  },
  none:function(b){}
};
Body.FACIAL=Object.keys(FACE_BUILD);
Body.facial=function(style){
  style=FACE_BUILD[style]?style:'none';
  return part('facial:'+style,function(b){
    b.mat('hair');
    b.push();b.scale(P.headScale,P.headScale,P.headScale);
    FACE_BUILD[style](b);
    b.pop();
  },96);
};

/* ---------------- worn on the face ----------------
   Glasses, goggles, a patch. Same space as the facial hair and for the
   same reason: the eyeline sits at y 0.008 and the face plane at about
   z 0.105, and everything here has to land on those two numbers. */
function ringOf(b,r,n,thick,col){
  for(var i=0;i<n;i++){
    var a=i/n*M.TAU;
    b.push();b.translate(Math.cos(a)*r,Math.sin(a)*r,0);
    b.sphere(0,0,0,thick,5,4,col);
    b.pop();
  }
}
var ACC_BUILD={
  specs:function(b){
    b.mat('panel');
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.038,0.004,0.101);b.rotate(0,s*-0.20,0);
      ringOf(b,0.027,14,0.0042,LIT);
      /* Glass, not a lens cap. The first version put a dark disc in each
         rim and the character came out wearing two black holes. */
      b.mat('glass',0.10);
      b.push();b.translate(0,0,-0.004);
      b.sphere(0,0,0,0.024,10,8,'#FFFFFF',{squash:0.06});b.pop();
      b.mat('panel');
      /* temple arm, back past the ear */
      b.push();b.translate(s*0.048,0.006,-0.026);b.rotate(0,s*0.30,0);
      b.chamfer(0,0,0,0.007,0.006,0.110,MID,0.0022,{noBand:true});b.pop();
      b.pop();
    }
    b.push();b.translate(0,0.008,0.100);
    b.chamfer(0,0,0,0.022,0.005,0.006,MID,0.0018,{noBand:true});b.pop();
    b.mat('blank');
  },
  /* Goggles ride on the forehead, not over the eyes. Someone who has
     pushed their goggles up has been working; someone wearing them is
     working right now, and hides the eyes doing it. */
  goggles:function(b){
    b.mat('fabric');
    b.push();b.translate(0,0.066,0.006);b.rotate(-0.22,0,0);
    b.loft([
      {y:-0.020,pts:Geo.roundRect(0.196,0.206,0.092,14)},
      {y: 0.020,pts:Geo.roundRect(0.196,0.206,0.092,14)}
    ],MID,{openTop:true,openBottom:true});
    b.mat('panel');
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.040,0.002,0.086);b.rotate(0,s*-0.20,0);
      b.push();b.rotate(Math.PI/2,0,0);
      b.cylinder(0,0,0,0.033,0.030,0.032,12,LIT,{open:true});
      b.pop();
      b.mat('crystal',0.14);
      b.push();b.translate(0,0,0.012);
      b.sphere(0,0,0,0.029,10,8,LIT,{squash:0.16});b.pop();
      b.mat('panel');
      b.pop();
    }
    /* the bridge strap between the cups */
    b.push();b.translate(0,0.002,0.086);
    b.chamfer(0,0,0,0.028,0.016,0.016,MID,0.005,{noBand:true});b.pop();
    b.pop();
    b.mat('blank');
  },
  eyepatch:function(b){
    b.mat('fabric');
    b.push();b.translate(-0.037,0.004,0.086);b.rotate(0,0.22,0.10);
    b.scale(1.0,1.08,0.36);
    b.sphere(0,0,0,0.0235,10,8,DEEP);
    b.pop();
    /* the cord: two straps running back over the skull, not a ring —
       a full band reads as a blindfold from the side */
    b.push();b.translate(-0.034,0.050,0.010);b.rotate(0,-0.5,0.34);
    b.chamfer(0,0,0,0.010,0.008,0.196,DARK,0.003,{noBand:true});b.pop();
    b.push();b.translate(-0.038,-0.026,0.010);b.rotate(0,-0.5,-0.20);
    b.chamfer(0,0,0,0.010,0.008,0.192,DARK,0.003,{noBand:true});b.pop();
    b.mat('blank');
  },
  earrings:function(b){
    b.mat('gold');
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.086,-0.040,-0.012);b.rotate(0,Math.PI/2,0);
      ringOf(b,0.019,12,0.0048,LIT);
      b.pop();
    }
    b.mat('blank');
  },
  /* Pulled up over the nose. The fold across the bridge is what stops
     it reading as a painted stripe. */
  bandana:function(b){
    b.mat('fabric');
    b.push();b.translate(0,-0.062,0.014);
    b.loft([
      {y: 0.056,pts:Geo.roundRect(0.196,0.206,0.090,14)},
      {y: 0.010,pts:Geo.roundRect(0.194,0.204,0.090,14)},
      {y:-0.048,pts:Geo.roundRect(0.156,0.164,0.072,14)}
    ],LIT,{openTop:true,openBottom:true});
    b.pop();
    b.push();b.translate(0,-0.012,0.096);b.rotate(0.30,0,0);
    b.chamfer(0,0,0,0.090,0.028,0.026,MID,0.010,{noBand:true});b.pop();
    b.push();b.translate(0,-0.092,0.060);
    b.chamfer(0,0,0,0.110,0.020,0.028,MID,0.008,{noBand:true});b.pop();
    b.mat('blank');
  },
  monocle:function(b){
    b.mat('gold');
    b.push();b.translate(0.037,0.006,0.086);
    b.loft([{y:0,pts:Geo.circle(0.030,16)},
            {y:0.006,pts:Geo.circle(0.030,16)}],LIT,
           {openTop:true,openBottom:true});
    b.mat('glass',0.10);
    b.push();b.translate(0,0,-0.002);b.scale(1.0,1.0,0.16);
    b.sphere(0,0,0,0.029,14,10,LIT);b.pop();
    b.pop();
    /* the chain, falling away to the ear */
    b.mat('gold');
    for(var i=0;i<7;i++){
      var t=i/6;
      b.push();
      b.translate(0.062+t*0.020,-0.006-t*t*0.070,0.082-t*0.030);
      b.sphere(0,0,0,0.005,6,5,MID);b.pop();
    }
  },
  bigglasses:function(b){
    b.mat('blank');
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.037,0.006,0.084);
      b.loft([{y:0,pts:Geo.circle(0.040,18,1.0,0.86)},
              {y:0.008,pts:Geo.circle(0.040,18,1.0,0.86)}],DEEP,
             {openTop:true,openBottom:true});
      b.mat('glass',0.08);
      b.push();b.scale(1.0,0.86,0.14);
      b.sphere(0,0,0,0.038,14,10,LIT);b.pop();
      b.mat('blank');
      b.pop();
    }
    b.push();b.translate(0,0.006,0.090);
    b.chamfer(0,0,0,0.024,0.006,0.006,DEEP,0.002,{noBand:true});b.pop();
    for(var s2=-1;s2<=1;s2+=2){
      b.push();b.translate(s2*0.070,0.006,0.040);
      b.chamfer(0,0,0,0.006,0.006,0.080,DEEP,0.002,{noBand:true});b.pop();
    }
  },
  threed:function(b){
    /* One red lens, one cyan, and a white frame. Nothing else needed. */
    b.mat('blank');
    b.push();b.translate(0,0.006,0.086);
    b.chamfer(0,0,0,0.156,0.036,0.008,'#F6F4F0',0.004);b.pop();
    b.push();b.translate(-0.037,0.006,0.091);
    b.chamfer(0,0,0,0.052,0.028,0.004,'#E8483C',0.002,{noBand:true});b.pop();
    b.push();b.translate(0.037,0.006,0.091);
    b.chamfer(0,0,0,0.052,0.028,0.004,'#3CC8E8',0.002,{noBand:true});b.pop();
  },
  visor2:function(b){
    b.mat('glass',0.30);
    b.push();b.translate(0,0.014,0.070);b.scale(1.0,0.44,0.62);
    b.sphere(0,0,0,0.098,18,12,LIT);b.pop();
    b.mat('panel');
    b.push();b.translate(0,0.052,0.062);
    b.chamfer(0,0,0,0.176,0.018,0.070,MID,0.006);b.pop();
  },
  clownnose:function(b){
    b.mat('blank');
    b.push();b.translate(0,-0.030,0.104);
    b.sphere(0,0,0,0.034,14,11,'#E8483C');b.pop();
  },
  fangs:function(b){
    b.mat('blank');
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.016,-0.066,0.086);b.rotate(0.1,0,s*0.06);
      b.cylinder(0,0,0,0.007,0.001,0.024,7,'#F6F4F0');b.pop();
    }
  },
  ninjamask:function(b){
    b.mat('fabric');
    /* A band round the lower face and a hood over the crown, with the
       eye slot cut by simply leaving a gap between them. */
    b.push();b.translate(0,-0.052,0.006);b.scale(1.02,1.0,1.02);
    b.loft([{y:-0.052,pts:headSect(0.058,0.070,0.062,18,2.6)},
            {y:0.000,pts:headSect(0.082,0.094,0.092,18,2.5)},
            {y:0.030,pts:headSect(0.090,0.100,0.100,18,2.4)}],LIT,
           {openTop:true,openBottom:true});
    b.pop();
    b.push();b.translate(0,0.062,0);b.scale(1.03,1.0,1.03);
    b.loft([{y:0.000,pts:headSect(0.090,0.102,0.104,18,2.3)},
            {y:0.052,pts:headSect(0.088,0.098,0.106,18,2.2)},
            {y:0.086,pts:headSect(0.070,0.072,0.086,18,2.1)}],LIT,
           {openBottom:true});
    b.pop();
    /* the tie, hanging behind */
    b.push();b.translate(-0.020,0.070,-0.104);b.rotate(0.3,0,0.2);
    b.chamfer(0,0,0,0.020,0.130,0.010,MID,0.004,{noBand:true});b.pop();
  },
  burglar:function(b){
    b.mat('fabric');
    b.push();b.translate(0,0.012,0.058);b.scale(1.0,1.0,1.0);
    b.loft([{y:-0.016,pts:headSect(0.086,0.042,0.088,18,2.4)},
            {y: 0.034,pts:headSect(0.090,0.044,0.092,18,2.3)}],DEEP,
           {openTop:true,openBottom:true});
    b.pop();
  },
  warpaint:function(b){
    b.mat('blank');
    for(var s=-1;s<=1;s+=2){
      for(var i=0;i<3;i++){
        b.push();
        b.translate(s*(0.052+i*0.013),-0.012,0.080);
        b.rotate(0,-s*0.5,0);
        b.chamfer(0,0,0,0.007,0.044,0.004,'#C4382E',0.001,{noBand:true});
        b.pop();
      }
    }
  },
  snorkel:function(b){
    b.mat('blank');
    b.push();b.translate(0,0.010,0.078);b.scale(1.0,0.60,0.44);
    b.sphere(0,0,0,0.086,16,12,'#3CC8E8');b.pop();
    b.push();b.translate(0,0.010,0.070);
    b.chamfer(0,0,0,0.168,0.088,0.030,MID,0.010,{noBand:true});b.pop();
    /* the tube, up the side of the head */
    b.push();b.translate(0.086,0.070,0.020);b.rotate(-0.16,0,0.10);
    b.cylinder(0,0,0,0.014,0.014,0.190,10,LIT);b.pop();
  },
  none:function(b){}
};
Body.ACCESSORIES=Object.keys(ACC_BUILD);
Body.accessory=function(style){
  style=ACC_BUILD[style]?style:'none';
  return part('acc:'+style,function(b){
    b.mat('blank');
    b.push();b.scale(P.headScale,P.headScale,P.headScale);
    ACC_BUILD[style](b);
    b.pop();
  },96);
};

LH.Body=Body;
})();


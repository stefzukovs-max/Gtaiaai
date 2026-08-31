/* ============================================================
   LH.Rig — skeleton and animation.

   Twenty-two bones in a parent-child hierarchy, posed every frame by
   an animation state machine that crossfades between clips.

   The clips are functions of phase, not keyframe tables. That is a
   deliberate choice and not just a way of avoiding an importer: a
   procedural walk can take stride length, lean and limp as live
   parameters, so the same clip covers walking, sprinting, wading
   and carrying something heavy without any extra data.

   The body is one continuous skinned mesh, not a bag of rigid parts.
   That was the single biggest thing standing between this figure and
   a believable one: rigid parts leave a visible seam at every joint,
   and the joint spheres that used to hide those seams are exactly what
   made the character read as a toy. Skinning means an elbow creases,
   a shoulder rolls under its skin, and a knee keeps its volume through
   a bend, none of which a hinge of two cylinders can do.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,Rig={};

/* ---------------- skeleton ----------------
   Offsets are the bone's rest position in its parent's space, in
   metres. The figure is 1.82 m to the crown with the ankle at zero,
   which puts it at roughly seven heads — heroic, but not the
   eight-head fashion-plate that would fight the sandbox proportions,
   and nowhere near the three-head chibi we are moving away from. */
/* ---------------- proportions ----------------
   Human canon, not a style. Every number is a fraction of a 1.80 m
   figure taken from the standing measurements anatomy actually uses,
   with the ankle at zero:

     hip joint   0.53 H     elbow       0.63 H
     knee        0.285 H    wrist       0.485 H
     shoulder    0.81 H     chin        0.87 H

   Those six numbers fix the whole skeleton, and the rest of the file
   is measured against them rather than against each other, so a change
   of height stays proportional instead of drifting limb by limb.

   The previous table was the Club Penguin register: four and a half
   heads tall, a head a fifth of the body, arms that stopped at the
   hip. This is seven and a half. The toon look is still reachable —
   it moved into the shading dials, where scene.toon, scene.outline and
   scene.saturation still do what they did — but the body underneath
   them is now built to human measure. */
var P={
  height:1.80,
  /* bone-to-bone offsets, metres */
  hipY:0.955,                     /* hip joint: 0.53 H */
  spine:0.115, spine2:0.120, chest:0.135,
  neck:0.115,                     /* chest -> base of neck   1.440 */
  headUp:0.105,                   /* base of neck -> atlas   1.545 */
  shoulderX:0.040, shoulderY:0.132, shoulderZ:0.014,
  armOut:0.132,                   /* clavicle -> shoulder joint */
  armUp:0.335, armLo:0.262,       /* elbow 1.122, wrist 0.860 */
  hipX:0.092,
  thigh:0.440, shin:0.440,        /* knee 0.515, ankle 0.075 */
  toeF:0.112, toeD:0.046,         /* ball of the foot, forward and down */
  /* Geometry multipliers. headScale is the ratio between the head mesh,
     which is authored 0.276 tall in its own space, and the head this
     game actually wants — so hair, hats, beards and glasses, all of
     them authored against that same space, grow with it and keep
     fitting without being re-measured. At 0.86 it was a real head on a
     real body. At 1.90 it is a toy's: 0.524 chin to crown on a figure
     1.68 tall — three heads and a fifth, with the jaw sitting on the
     collar and no neck to speak of between them. crownUp is where the
     top of the skull sits in that space, and it is the one measurement
     the skeleton below is solved against. */
  headScale:1.90, crownUp:0.158,
  limbFat:1.00, handScale:1.00, footScale:1.00,
  /* Girths, as radii at the widest point of each region. Used by the
     body builder and by every garment that has to sit outside it. */
  neckR:0.061, chestW:0.176, chestD:0.108, waistW:0.145, waistD:0.098,
  hipW:0.168, hipD:0.112,
  armR:0.049, elbowR:0.040, wristR:0.030,
  thighR:0.084, kneeR:0.058, calfR:0.056, ankleR:0.038
};
Rig.P=P;

/* ---------------- skeleton ----------------
   Twenty-two bones. What changed from the seventeen it replaces, and
   why each one earns its keep once the mesh is skinned rather than
   assembled from rigid parts:

     spine2      A single spine segment bends the torso as one plank.
                 Three segments let a turn start at the hips and arrive
                 at the shoulders, which is most of what makes a walk
                 read as a person rather than a mannequin.
     shoulderL/R These were pivots to hang an arm from. They are now
                 clavicles: they carry skin, they rise and roll when the
                 arm goes up, and the deltoid follows them.
     toeL/R      A foot that cannot roll cannot push off, and a walk
                 without a push-off is a shuffle.
*/
var BONES=[
  /* name,         parent,      offset x,y,z */
  ['hips',        -1,           0,           P.hipY,        0],
  ['spine',        0,           0,           P.spine,       0],
  ['spine2',       1,           0,           P.spine2,      0],
  ['chest',        2,           0,           P.chest,       0],
  ['neck',         3,           0,           P.neck,        0],
  ['head',         4,           0,           P.headUp,      0],
  ['shoulderL',    3,           P.shoulderX, P.shoulderY,   P.shoulderZ],
  ['armL',         6,           P.armOut,    0,             0],
  ['forearmL',     7,           0,          -P.armUp,       0],
  ['handL',        8,           0,          -P.armLo,       0],
  ['shoulderR',    3,          -P.shoulderX, P.shoulderY,   P.shoulderZ],
  ['armR',        10,          -P.armOut,    0,             0],
  ['forearmR',    11,           0,          -P.armUp,       0],
  ['handR',       12,           0,          -P.armLo,       0],
  ['thighL',       0,           P.hipX,     -0.010,         0],
  ['shinL',       14,           0,          -P.thigh,       0],
  ['footL',       15,           0,          -P.shin,        0],
  ['toeL',        16,           0,          -P.toeD,        P.toeF],
  ['thighR',       0,          -P.hipX,     -0.010,         0],
  ['shinR',       18,           0,          -P.thigh,       0],
  ['footR',       19,           0,          -P.shin,        0],
  ['toeR',        20,           0,          -P.toeD,        P.toeF]
];

/* ---------------- toy proportions ----------------
   The skeleton above, and the sixty-odd ring tables that hang off it,
   were authored against a real body: a figure a little under seven
   heads tall, measured in metres, with a head 0.237 across the chin
   and the crown. The look this game wants is not that body. It is a
   toy — four heads tall, short in the leg, thick in the limb, with a
   head that arrives before the person does.

   Re-measuring every table to get there is a week of work and a week
   of new bugs. So both bodies are kept and one map moves between them.
   Each bone gets two numbers: a structural scale, which decides where
   its children end up, and a vertex scale, which decides how the skin
   around it is stretched. A vertex is then moved exactly the way it
   would be skinned — by the weighted blend of its own bones' maps —
   so a garment cut from the body's rings arrives at the same place the
   body does, and a seam that closed before still closes.

   The overall height is deliberately unchanged. Everything in the
   world — doorways, counters, the camera, the step the player can walk
   up — is measured against a 1.68 m crown, and a restyle is not a
   reason to re-survey a town. What changes is where that height goes:
   0.535 of leg where there was 0.955, a torso an tenth longer, arms
   shortened and thickened, and a head that takes the top quarter.  */
var TOY={
  leg:0.56,        /* femur and shin, as a fraction of what they were */
  torso:1.10,      /* hip to collarbone, likewise                     */
  arm:0.86,        /* clavicle to wrist                               */
  armOut:1.18,     /* how far the shoulder joint sits from the spine  */
  legOut:1.40,     /* and the hip joint, so thick thighs still clear  */
  wHip:1.15, wSpine:1.08, wSpine2:1.02, wChest:0.98, wNeck:1.15,
  wArm:1.50, wDelt:1.04, wLeg:1.30, wFoot:1.25,
  wHandXZ:1.42, wHandY:1.18,
  neckUp:1.63,     /* the neck bone, up under the jaw where a toy's is */
  neckY:0.62,      /* and the neck itself, most of the way gone        */
  headY:0.30,      /* what is left of it, tucked inside the skull      */
  crown:1.62       /* the top of the skull. Six centimetres down on   */
                   /* the real body, which is what buries the jaw in  */
                   /* the collar and leaves a toy's non-existent neck */
};
Rig.TOY=TOY;

/* Structural scale: applied to a bone's offset from its parent, so it
   decides where the skeleton goes. Vertex scale: applied to the skin
   bound to that bone, about that bone. Anything unlisted is 1. */
var SB={
  hips:      [TOY.legOut, TOY.torso,  1],
  spine:     [1, TOY.torso, 1],
  spine2:    [1, TOY.torso, 1],
  chest:     [TOY.wChest, TOY.torso, TOY.wChest],
  neck:      [1, TOY.torso, 1],
  shoulderL: [TOY.armOut, TOY.torso, 1],
  shoulderR: [TOY.armOut, TOY.torso, 1],
  armL:      [1, TOY.arm, 1], armR: [1, TOY.arm, 1],
  forearmL:  [1, TOY.arm, 1], forearmR: [1, TOY.arm, 1],
  thighL:    [1, TOY.leg, 1], thighR: [1, TOY.leg, 1],
  shinL:     [1, TOY.leg, 1], shinR: [1, TOY.leg, 1],
  footL:     [1, TOY.leg, TOY.wFoot], footR: [1, TOY.leg, TOY.wFoot]
};
var SV={
  hips:      [TOY.wHip, TOY.torso, TOY.wHip],
  spine:     [TOY.wSpine, TOY.torso, TOY.wSpine],
  spine2:    [TOY.wSpine2, TOY.torso, TOY.wSpine2],
  chest:     [TOY.wChest, TOY.torso, TOY.wChest],
  neck:      [TOY.wNeck, TOY.neckY, TOY.wNeck],
  head:      [1, TOY.headY, 1],
  shoulderL: [TOY.wDelt, TOY.torso, TOY.wDelt],
  shoulderR: [TOY.wDelt, TOY.torso, TOY.wDelt],
  armL:      [TOY.wArm, TOY.arm, TOY.wArm],
  armR:      [TOY.wArm, TOY.arm, TOY.wArm],
  forearmL:  [TOY.wArm, TOY.arm, TOY.wArm],
  forearmR:  [TOY.wArm, TOY.arm, TOY.wArm],
  handL:     [TOY.wHandXZ, TOY.wHandY, TOY.wHandXZ],
  handR:     [TOY.wHandXZ, TOY.wHandY, TOY.wHandXZ],
  thighL:    [TOY.wLeg, TOY.leg, TOY.wLeg],
  thighR:    [TOY.wLeg, TOY.leg, TOY.wLeg],
  shinL:     [TOY.wLeg, TOY.leg, TOY.wLeg],
  shinR:     [TOY.wLeg, TOY.leg, TOY.wLeg],
  footL:     [TOY.wFoot, TOY.wFoot, TOY.wFoot],
  footR:     [TOY.wFoot, TOY.wFoot, TOY.wFoot],
  toeL:      [TOY.wFoot, TOY.wFoot, TOY.wFoot],
  toeR:      [TOY.wFoot, TOY.wFoot, TOY.wFoot]
};

/* Where every bone stood before the map, and where it stands after.
   The head is placed rather than scaled to: its geometry is instanced
   and scaled by P.headScale, so the only thing the skeleton has to get
   right is that the crown lands where it always did. */
var AUTH=[], NEWP=[];
(function(){
  var i,b,par,sb;
  for(i=0;i<BONES.length;i++){
    b=BONES[i];par=b[1];
    var a=par<0?[0,0,0]:AUTH[par];
    AUTH.push([a[0]+b[2],a[1]+b[3],a[2]+b[4]]);
  }
  for(i=0;i<BONES.length;i++){
    b=BONES[i];par=b[1];
    /* the root is the hip joint, and its height is a leg */
    if(par<0){NEWP.push([b[2],b[3]*TOY.leg,b[4]]);continue;}
    sb=SB[BONES[par][0]]||[1,1,1];
    var n=NEWP[par];
    NEWP.push([n[0]+b[2]*sb[0],n[1]+b[3]*sb[1],n[2]+b[4]*sb[2]]);
  }
  /* The neck bone, and then the head by the crown rather than by the
     neck. A toy has no neck to speak of: the jaw sits on the collar
     and the head turns about a point just above the shoulders, so the
     bone goes there and the skin that used to span the gap is pressed
     flat against it. */
  var idx={};
  for(i=0;i<BONES.length;i++)idx[BONES[i][0]]=i;
  NEWP[idx.neck][1]=NEWP[idx.chest][1]+P.neck*TOY.neckUp;
  NEWP[idx.head][1]=TOY.crown-P.crownUp*P.headScale;
  /* and back into offsets, which is what the bind pose is built from */
  for(i=0;i<BONES.length;i++){
    par=BONES[i][1];
    var q=par<0?[0,0,0]:NEWP[par];
    BONES[i][2]=NEWP[i][0]-q[0];
    BONES[i][3]=NEWP[i][1]-q[1];
    BONES[i][4]=NEWP[i][2]-q[2];
  }
  /* The proportions table is the skeleton's public face — the foot IK
     reads its bone lengths to solve a knee — so it has to describe the
     body that actually exists, not the one the numbers were typed
     for. */
  P.hipY=NEWP[0][1];
  P.thigh*=TOY.leg; P.shin*=TOY.leg;
  P.armUp*=TOY.arm; P.armLo*=TOY.arm;
  P.toeD*=TOY.leg;  P.toeF*=TOY.wFoot;
})();
Rig.AUTH=AUTH;Rig.NEWP=NEWP;

/* Move one builder's worth of skinned geometry from the authored body
   into the toy one. Positions blend the per-bone affine maps by the
   same weights the GPU will skin them with; normals blend the inverse
   scales, which is what keeps a stretched surface lit as though it
   were still round. */
Rig.warp=function(bld){
  if(!bld.skinning)return bld;
  var V=bld.v,SK=bld.sk,n=bld.n,i,j;
  var svs=[];
  for(i=0;i<BONES.length;i++)svs.push(SV[BONES[i][0]]||[1,1,1]);
  for(i=0;i<n;i++){
    var o=i*15,k=i*8;
    var px=V[o],py=V[o+1],pz=V[o+2];
    var nx=V[o+3],ny=V[o+4],nz=V[o+5];
    var ax=0,ay=0,az=0,bx=0,by=0,bz=0;
    for(j=0;j<4;j++){
      var w=SK[k+4+j];
      if(w<=0)continue;
      var bi=SK[k+j]|0,A=AUTH[bi],N=NEWP[bi],S=svs[bi];
      ax+=w*(N[0]+(px-A[0])*S[0]);
      ay+=w*(N[1]+(py-A[1])*S[1]);
      az+=w*(N[2]+(pz-A[2])*S[2]);
      bx+=w*nx/S[0];by+=w*ny/S[1];bz+=w*nz/S[2];
    }
    var l=Math.sqrt(bx*bx+by*by+bz*bz)||1;
    V[o]=ax;V[o+1]=ay;V[o+2]=az;
    V[o+3]=bx/l;V[o+4]=by/l;V[o+5]=bz/l;
  }
  return bld;
};


var NB=BONES.length;
var NAME={},PARENT=new Int8Array(NB),REST=new Float32Array(NB*3);
for(var i=0;i<NB;i++){
  NAME[BONES[i][0]]=i;
  PARENT[i]=BONES[i][1];
  REST[i*3]=BONES[i][2];REST[i*3+1]=BONES[i][3];REST[i*3+2]=BONES[i][4];
}
Rig.NB=NB;Rig.NAME=NAME;Rig.PARENT=PARENT;Rig.REST=REST;
Rig.BONE=function(n){return NAME[n];};

/* ---------------- bind pose ----------------
   The rest-pose world matrix of every bone, and its inverse. The body
   mesh is authored in this space — in the T-pose, in metres, where the
   figure actually stands — so a vertex is bound to a bone by nothing
   more than saying which bone, and the inverse bind takes it back into
   that bone's local frame at draw time.

   Computed once, at module load, because it is a property of the
   skeleton rather than of any character standing in it. */
var BIND=new Float32Array(NB*16), INVBIND=new Float32Array(NB*16);
(function(){
  var lm=M.m4(),t=M.v3(),sc=M.v3(1,1,1),tmp=M.m4();
  for(var i=0;i<NB;i++){
    M.set3(t,REST[i*3],REST[i*3+1],REST[i*3+2]);
    M.fromTRS(lm,t,0,0,0,sc);
    var dst=BIND.subarray(i*16,i*16+16);
    var par=PARENT[i];
    if(par<0)dst.set(lm);
    else{
      M.mul(tmp,BIND.subarray(par*16,par*16+16),lm);
      dst.set(tmp);
    }
    M.invert(INVBIND.subarray(i*16,i*16+16),dst);
  }
})();
Rig.BIND=BIND;Rig.INVBIND=INVBIND;
/* Where a bone sits in the bind pose, for anything authoring geometry
   against the skeleton. */
Rig.bindPos=function(out,bone){
  var b=(typeof bone==='number')?bone:NAME[bone];
  out[0]=BIND[b*16+12];out[1]=BIND[b*16+13];out[2]=BIND[b*16+14];
  return out;
};

/* The palette a skinned draw needs: worldBone * inverseBind, packed
   flat for one uniformMatrix4fv. */
var _pal=M.m4();
Rig.skinPalette=function(out,mats){
  for(var i=0;i<NB;i++){
    var m=mats[i];
    if(!m){out.set(INVBIND.subarray(i*16,i*16+16),i*16);continue;}
    M.mul(_pal,m,INVBIND.subarray(i*16,i*16+16));
    out.set(_pal,i*16);
  }
  return out;
};

/* A Pose is a flat rotation array plus a few whole-body channels.
   Keeping it flat means blending two poses is one loop over floats
   rather than a walk over objects. */
function Pose(){
  this.rot=new Float32Array(NB*3);   /* euler per bone, radians */
  this.off=new Float32Array(NB*3);   /* additive offset on the rest position */
  this.rootY=0;                      /* whole-body bob */
  this.rootLean=0;                   /* forward pitch of the whole figure */
  this.rootRoll=0;
  this.rootYaw=0;
}
Rig.Pose=Pose;
Pose.prototype.clear=function(){
  this.rot.fill(0);this.off.fill(0);
  this.rootY=0;this.rootLean=0;this.rootRoll=0;this.rootYaw=0;
  return this;
};
Pose.prototype.set=function(bone,x,y,z){
  var b=(typeof bone==='number')?bone:NAME[bone];
  if(b===undefined)return this;
  this.rot[b*3]=x||0;this.rot[b*3+1]=y||0;this.rot[b*3+2]=z||0;return this;
};
Pose.prototype.add=function(bone,x,y,z){
  var b=(typeof bone==='number')?bone:NAME[bone];
  if(b===undefined)return this;
  this.rot[b*3]+=x||0;this.rot[b*3+1]+=y||0;this.rot[b*3+2]+=z||0;return this;
};
Pose.prototype.copyFrom=function(o){
  this.rot.set(o.rot);this.off.set(o.off);
  this.rootY=o.rootY;this.rootLean=o.rootLean;
  this.rootRoll=o.rootRoll;this.rootYaw=o.rootYaw;return this;
};
/* Euler lerp is wrong in general but correct here: no clip in this game
   swings a joint more than a half turn between blended states, so the
   shortest-path ambiguity never arises and quaternions would only cost
   conversions. */
Pose.blend=function(out,a,b,t){
  var ar=a.rot,br=b.rot,orr=out.rot,ao=a.off,bo=b.off,oo=out.off;
  for(var i=0;i<NB*3;i++){
    orr[i]=ar[i]+(br[i]-ar[i])*t;
    oo[i]=ao[i]+(bo[i]-ao[i])*t;
  }
  out.rootY=a.rootY+(b.rootY-a.rootY)*t;
  out.rootLean=a.rootLean+(b.rootLean-a.rootLean)*t;
  out.rootRoll=a.rootRoll+(b.rootRoll-a.rootRoll)*t;
  out.rootYaw=a.rootYaw+(b.rootYaw-a.rootYaw)*t;
  return out;
};

/* ---------------- clip library ----------------
   Each clip fills a pose from (phase, params). Phase is 0..1 for
   looping clips and 0..1 elapsed for one-shots. */
var C={};
Rig.clips=C;
var sin=Math.sin,cos=Math.cos,PI=Math.PI,TAU=M.TAU;

/* Small shared shapes. `ease` gives a clip its weight — a limb that
   accelerates and settles reads as mass, a linear one reads as a
   puppet. */
function ease(t){return t*t*(3-2*t);}
function bell(t){return sin(t*PI);}

/* ---------------- sign conventions ----------------
   Worth stating once, because getting one of them backwards produces a
   character that walks convincingly and wrongly, which is much harder
   to spot than one that walks badly.

     thigh  +X = the leg swings BACK   (hip extension)
     shin   +X = the knee FLEXES       (heel toward the seat)
     foot   +X = the toes go UP        (dorsiflexion)
     toe    +X = the toes extend       (what the heel lifting does)

   Every one of them is verifiable from the geometry: a bone points
   down its own -Y, and a positive rotation about X carries -Y toward
   -Z, which is backwards. */

/* Spread a trunk rotation over the three spine segments. A single
   segment turning by the whole amount is a hinge in the middle of a
   person's back; sharing it out is the difference between a torso and
   a lever. */
function trunk(p,rx,ry,rz){
  p.add('spine', rx*0.28, ry*0.24, rz*0.30);
  p.add('spine2',rx*0.32, ry*0.32, rz*0.32);
  p.add('chest', rx*0.40, ry*0.44, rz*0.38);
}

C.idle=function(p,ph,pr){
  p.clear();
  var t=ph*TAU;
  /* Breathing drives the chest and, a beat later, the clavicles. Real
     quiet breathing is about twelve a minute and moves the sternum a
     centimetre; the numbers here are that, scaled to what reads. */
  var br=sin(t)*0.5+0.5;
  trunk(p,-0.030-br*0.026,0,0);
  p.set('neck',0.016-br*0.016,0,0);
  p.add('shoulderL',-br*0.020,0,-br*0.016);
  p.add('shoulderR',-br*0.020,0, br*0.016);

  /* Postural sway. Nobody stands still: a standing body is a slow
     inverted pendulum correcting itself, and two sines on
     incommensurate periods reproduce that better than any noise
     function, because the correction really is roughly periodic. */
  var sw=sin(ph*TAU*0.37), sw2=sin(ph*TAU*0.23+1.1);
  p.rootRoll=sw*0.018+sw2*0.008;
  p.rootYaw=sw*0.040+sw2*0.016;
  p.rootLean=0.020+sw2*0.010;
  p.rootY=-Math.abs(sw)*0.010+br*0.005;
  p.set('hips',0,-sw*0.045,sw*0.026);

  /* Arms hang with the elbow slightly bent and the forearm pronated,
     so the palms face the thighs. Perfectly straight arms with the
     palms forward is the anatomical position, and nobody has ever
     stood in it voluntarily. */
  /* Out at eleven degrees rather than four. Four is what a real arm
     does against a real ribcage; against a toy torso two thirds
     thicker than a real one it means the arms touch the body down
     their whole length, and a figure whose arms are fused to its
     sides is the silhouette everyone reads as an untextured
     primitive. Eleven leaves daylight between elbow and hip, which is
     what makes the shape legible from behind. */
  var lag=sin((ph-0.10)*TAU*0.37);
  p.set('armL', 0.060+lag*0.014,0, 0.200+lag*0.018);
  p.set('armR', 0.060+lag*0.014,0,-0.200-lag*0.018);
  p.set('forearmL',-0.34-br*0.024, 0.38, 0.044);
  p.set('forearmR',-0.34-br*0.024,-0.38,-0.044);
  p.set('handL',0.04, 0.10, 0.06);
  p.set('handR',0.04,-0.10,-0.06);

  /* Weight on alternating legs. The loaded leg straightens and its hip
     rises; the free leg softens at the knee and turns out a little. */
  var wl=sw*0.5+0.5;
  p.set('thighL',-0.010+sw*0.026,-sw*0.02, 0.030+wl*0.010);
  p.set('thighR',-0.010-sw*0.026,-sw*0.02,-0.030-(1-wl)*0.010);
  p.set('shinL',0.030+(1-wl)*0.055,0,0);
  p.set('shinR',0.030+wl*0.055,0,0);
  p.set('footL',-0.010-(1-wl)*0.030,0,0);
  p.set('footR',-0.010-wl*0.030,0,0);
  p.set('head',0.016,sw*0.085,-sw*0.010);
  return p;
};

/* ---------------- gait ----------------
   One clip covers walking through sprinting. `sp` is 0 at a slow walk
   and 1 at a full run.

   The important change from a pair of sines is that a real gait cycle
   is not symmetric. Stance takes about 62 per cent of it and swing the
   other 38, and inside stance there are four events that each leave a
   mark on the silhouette: heel strike, foot flat, heel off, toe off.
   Sines cannot produce those, which is why a sine walk always reads as
   a march no matter how carefully the amplitudes are tuned. Each joint
   below is a piecewise curve through those events, taken from the
   standard sagittal gait plots and simplified to the corners that
   survive at gameplay distance.

   u is one leg's own phase: 0 at heel strike, 0.62 at toe off. */
var STANCE=0.62;

function hipCurve(u,sp){
  var flex=0.46+sp*0.36;          /* thigh forward at heel strike */
  var ext=0.24+sp*0.20;           /* thigh back at toe off        */
  if(u<STANCE)return M.lerp(flex,-ext,u/STANCE);
  return M.lerp(-ext,flex,ease((u-STANCE)/(1-STANCE)));
}
function kneeCurve(u,sp){
  var load=0.14+sp*0.20;          /* absorbing the landing        */
  var swing=0.98+sp*0.52;         /* the fold that clears the toe */
  if(u<0.15)return M.lerp(0.04,load,ease(u/0.15));
  if(u<0.40)return M.lerp(load,0.03,ease((u-0.15)/0.25));
  if(u<STANCE)return M.lerp(0.03,0.52+sp*0.24,ease((u-0.40)/(STANCE-0.40)));
  if(u<0.80)return M.lerp(0.52+sp*0.24,swing,ease((u-STANCE)/(0.80-STANCE)));
  return M.lerp(swing,0.04,ease((u-0.80)/0.20));
}
function ankleCurve(u,sp){
  var push=0.34+sp*0.20;          /* plantarflexion at toe off    */
  if(u<0.08)return M.lerp(0.10,-0.07,u/0.08);
  if(u<0.45)return M.lerp(-0.07,0.17,(u-0.08)/0.37);
  if(u<STANCE)return M.lerp(0.17,-push,ease((u-0.45)/(STANCE-0.45)));
  if(u<0.80)return M.lerp(-push,0.15,ease((u-STANCE)/(0.80-STANCE)));
  return M.lerp(0.15,0.10,(u-0.80)/0.20);
}
function toeCurve(u,sp){
  var ext=0.50+sp*0.30;
  if(u<0.42)return 0;
  if(u<STANCE)return M.lerp(0,ext,ease((u-0.42)/(STANCE-0.42)));
  return M.lerp(ext,0,ease(M.clamp((u-STANCE)/0.16,0,1)));
}
/* Vertical travel of the pelvis. Two rises per stride, highest at each
   mid-stance and lowest at each double support, which is the opposite
   of what a first guess usually puts there. */
function pelvisRise(u){return -cos(u*2*TAU)*0.5+0.5;}

C.locomote=function(p,ph,pr){
  p.clear();
  var sp=pr&&pr.speed!==undefined?M.clamp(pr.speed,0,1):0;
  var uL=ph%1, uR=(ph+0.5)%1;

  p.set('thighL',-hipCurve(uL,sp),0, 0.030);
  p.set('thighR',-hipCurve(uR,sp),0,-0.030);
  p.set('shinL',kneeCurve(uL,sp),0,0);
  p.set('shinR',kneeCurve(uR,sp),0,0);
  p.set('footL',ankleCurve(uL,sp),0,0);
  p.set('footR',ankleCurve(uR,sp),0,0);
  p.set('toeL',toeCurve(uL,sp),0,0);
  p.set('toeR',toeCurve(uR,sp),0,0);

  /* --- pelvis ---
     Three separate motions that are easy to confuse with each other:
     it rises twice a stride, it LISTS — the swing-side hip drops — and
     it rotates about the spine, leading the swinging leg. */
  var rise=pelvisRise(uL);
  p.rootY=(rise-0.5)*(0.040+sp*0.040);
  /* the list follows the stance leg, so it is a half-cycle sine */
  var stance=sin(ph*TAU);
  p.rootRoll=stance*(0.035+sp*0.030);
  p.set('hips',0,-stance*(0.055+sp*0.075),0);

  /* --- trunk ---
     Counter-rotation against the pelvis, spread over the spine, plus
     the forward lean that speed demands. A runner's lean is not a
     style choice: without it the ground reaction pushes them over
     backwards. */
  var lean=0.05+sp*0.30;
  trunk(p,lean*0.55,stance*(0.090+sp*0.130),-stance*(0.020+sp*0.030));
  p.rootLean=lean;
  /* The head stays level while everything under it pitches. Gaze
     stabilisation is involuntary and universal, and a head that pitches
     with the chest is the single most robotic thing a walk can do. */
  p.set('neck',-lean*0.62,-stance*0.05,0);
  p.set('head',-lean*0.26,-stance*0.03,0);

  /* --- arms ---
     Opposite the legs. The shoulder swings, the elbow holds a bend
     that deepens with speed, and the forearm flexes further on the
     forward half of the swing than the back half. */
  var aL=hipCurve(uR,sp),aR=hipCurve(uL,sp);
  var amp=0.62+sp*0.42, bend=0.30+sp*0.85;
  p.set('armL', aL*amp,0, 0.185-sp*0.030);
  p.set('armR', aR*amp,0,-0.185+sp*0.030);
  p.add('shoulderL',-Math.max(0,aL)*0.10,0,0);
  p.add('shoulderR',-Math.max(0,aR)*0.10,0,0);
  p.set('forearmL',-bend-Math.max(0,aL)*(0.28+sp*0.50), 0.22, 0.04);
  p.set('forearmR',-bend-Math.max(0,aR)*(0.28+sp*0.50),-0.22,-0.04);
  p.set('handL',0.05, 0.08, 0.06);
  p.set('handR',0.05,-0.08,-0.06);
  return p;
};

/* Turning on the spot. Without this the character pivots like a
   turret: the facing changes and the feet, which are the only thing
   telling you a turn happened, do not move at all. The outside foot
   steps around the inside one, the hips lead and the shoulders follow,
   and the whole thing loops so a long turn keeps shuffling. */
C.turn=function(p,ph,pr){
  p.clear();
  var dir=(pr&&pr.turn)||1;
  var t=ph*TAU, sw=sin(t);
  p.rootY=-Math.abs(sw)*0.016;
  p.set('hips',0,dir*0.10*sw,0);
  trunk(p,0.03,-dir*0.14*sw,0);
  var a1=Math.max(0,sw*dir), a2=Math.max(0,-sw*dir);
  p.set('thighL',-a1*0.30,dir*0.12,0.030);
  p.set('thighR',-a2*0.30,dir*0.12,-0.030);
  p.set('shinL',a1*0.46+0.045,0,0);
  p.set('shinR',a2*0.46+0.045,0,0);
  p.set('footL',a1*0.16-0.02,dir*0.10,0);
  p.set('footR',a2*0.16-0.02,dir*0.10,0);
  p.set('toeL',a1*0.26,0,0);
  p.set('toeR',a2*0.26,0,0);
  p.set('armL',0.05+a2*0.12,0,0.085);
  p.set('armR',0.05+a1*0.12,0,-0.085);
  p.set('forearmL',-0.26,0.32,0.03);
  p.set('forearmR',-0.26,-0.32,-0.03);
  p.set('head',0.02,dir*0.14,0);
  return p;
};

/* Coming to a halt out of a run. Momentum does not stop when the input
   does: the front foot plants, the body rocks back over it against its
   own speed, and then settles forward. Sliding to a stop on a walk
   cycle that fades out is the tell that nothing has any mass. */
C.stop=function(p,ph,pr){
  p.clear();
  var e=ease(M.clamp(ph*1.5,0,1));
  var rock=bell(M.clamp(ph*1.25,0,1));
  p.rootLean=0.14-rock*0.30;
  p.rootY=-rock*0.048;
  p.set('thighL',-0.44+e*0.36,0,0.030);
  p.set('thighR', 0.26-e*0.22,0,-0.030);
  p.set('shinL',0.12+rock*0.22,0,0);
  p.set('shinR',0.40-e*0.30,0,0);
  p.set('footL',0.24-rock*0.30,0,0);
  p.set('footR',-0.20+e*0.18,0,0);
  p.set('toeR',0.30-e*0.28,0,0);
  trunk(p,0.12-rock*0.26,0,0);
  p.set('neck',-0.06+rock*0.14,0,0);
  p.set('armL',0.34-rock*0.48,0,0.10);
  p.set('armR',0.28-rock*0.42,0,-0.10);
  p.set('forearmL',-0.44-rock*0.20, 0.26, 0.04);
  p.set('forearmR',-0.42-rock*0.18,-0.26,-0.04);
  return p;
};

C.jump=function(p,ph,pr){
  p.clear();
  /* Launch: legs still extended from the push, arms thrown up. */
  var e=ease(M.clamp(ph*2.2,0,1));
  p.rootLean=0.10;
  p.set('thighL',-0.30-e*0.35,0,0.05);
  p.set('thighR',-0.26-e*0.30,0,-0.05);
  p.set('shinL',0.55+e*0.55,0,0);
  p.set('shinR',0.40+e*0.45,0,0);
  p.set('footL',-0.30,0,0);
  p.set('footR',-0.26,0,0);
  p.set('armL',-1.55-e*0.55,0,0.42);
  p.set('armR',-1.50-e*0.50,0,-0.42);
  p.set('forearmL',-0.50,0,0.12);
  p.set('forearmR',-0.46,0,-0.12);
  p.set('chest',-0.14,0,0);
  p.set('head',-0.10,0,0);
  return p;
};

C.fall=function(p,ph,pr){
  p.clear();
  var t=ph*TAU;
  /* Windmilling arms and trailing legs: reads as "not in control". */
  p.rootLean=0.16+sin(t*0.7)*0.05;
  p.set('armL',-2.10+sin(t*1.3)*0.24,0,0.62);
  p.set('armR',-2.05+sin(t*1.3+1.1)*0.24,0,-0.62);
  p.set('forearmL',-0.75,0,0.2);
  p.set('forearmR',-0.70,0,-0.2);
  p.set('thighL',0.34+sin(t)*0.12,0,0.08);
  p.set('thighR',0.12+sin(t+PI)*0.12,0,-0.08);
  p.set('shinL',0.55,0,0);
  p.set('shinR',0.78,0,0);
  p.set('footL',-0.2,0,0);p.set('footR',-0.2,0,0);
  p.set('chest',-0.10,0,0);
  return p;
};

C.land=function(p,ph,pr){
  p.clear();
  /* Absorb on impact then push back up. One-shot over ~0.35 s. */
  var d=bell(M.clamp(ph,0,1));
  p.rootY=-d*0.30;
  p.rootLean=d*0.34;
  p.set('thighL',d*0.86,0,0.10);
  p.set('thighR',d*0.82,0,-0.10);
  p.set('shinL',d*1.15,0,0);
  p.set('shinR',d*1.10,0,0);
  p.set('footL',-d*0.42,0,0);
  p.set('footR',-d*0.40,0,0);
  p.set('armL',-d*0.75,0,0.30+d*0.20);
  p.set('armR',-d*0.72,0,-0.30-d*0.20);
  p.set('forearmL',-0.30-d*0.45,0,0.08);
  p.set('forearmR',-0.30-d*0.42,0,-0.08);
  p.set('chest',d*0.24,0,0);
  p.set('head',-d*0.18,0,0);
  return p;
};

/* Mining and building share a swing; the difference is where it stops
   and how hard it lands. */
function swingClip(p,ph,reach,power){
  p.clear();
  /* Anticipation to about a third, then a fast strike, then recovery. */
  var wind=M.clamp(ph/0.34,0,1);
  var strike=M.clamp((ph-0.34)/0.20,0,1);
  var recov=M.clamp((ph-0.54)/0.46,0,1);
  var raise=ease(wind)*(1-ease(strike));
  var hit=ease(strike)*(1-ease(recov));
  var a=-2.30*raise+0.85*hit;
  p.set('armR',a,0,-0.30+raise*0.34);
  p.set('forearmR',-0.30-raise*1.35+hit*0.60,0,-0.10);
  p.set('handR',0.10-raise*0.30,0,-0.10);
  /* The off hand braces and follows a beat behind. */
  p.set('armL',-0.55*raise+0.35*hit,0,0.36);
  p.set('forearmL',-0.75-raise*0.55,0,0.16);
  /* Whole-body rotation into the swing — the power comes from the hips,
     not the shoulder, and it looks wrong if the torso stays square. */
  p.rootYaw=raise*0.30-hit*0.34;
  p.set('hips',0,raise*0.18-hit*0.22,0);
  p.set('chest',-raise*0.22+hit*0.34*power,raise*0.30-hit*0.36,0);
  p.rootLean=hit*0.26*power-raise*0.10;
  p.set('head',hit*0.18-raise*0.06,raise*0.10-hit*0.12,0);
  p.set('thighL',-0.08+hit*0.12,0,0.05);
  p.set('thighR',-0.14-raise*0.10,0,-0.05);
  p.set('shinL',0.16,0,0);
  p.set('shinR',0.22+raise*0.10,0,0);
  p.rootY=-hit*0.05*power;
  return p;
}
C.mine=function(p,ph,pr){return swingClip(p,ph,0.9,1.0);};
C.build=function(p,ph,pr){
  p.clear();
  /* Placing is a reach and a press, not a swing. */
  var out=ease(M.clamp(ph/0.42,0,1));
  var press=bell(M.clamp((ph-0.36)/0.34,0,1));
  var back=ease(M.clamp((ph-0.70)/0.30,0,1));
  var f=out*(1-back);
  p.set('armR',-1.15*f-press*0.14,0,-0.24+f*0.12);
  p.set('forearmR',-0.55+f*0.34,0,-0.10);
  p.set('handR',0.20*f+press*0.24,0,-0.06);
  p.set('armL',-0.30*f,0,0.30);
  p.set('forearmL',-0.70,0,0.14);
  p.rootLean=f*0.14+press*0.06;
  p.set('chest',-f*0.12,-f*0.20,0);
  p.set('head',-f*0.06,-f*0.12,0);
  p.set('thighL',-0.06,0,0.05);
  p.set('thighR',-0.10,0,-0.05);
  p.set('shinL',0.12,0,0);p.set('shinR',0.16,0,0);
  return p;
};

C.attack=function(p,ph,pr){
  p.clear();
  /* A horizontal slash: wind across the body, whip through, recover. */
  var wind=M.clamp(ph/0.26,0,1);
  var cut=M.clamp((ph-0.26)/0.18,0,1);
  var rec=M.clamp((ph-0.44)/0.56,0,1);
  var w=ease(wind)*(1-ease(cut));
  var c=ease(cut)*(1-ease(rec));
  p.set('armR',-0.55-w*0.70+c*0.30,w*1.15-c*1.40,-0.30-w*0.55+c*0.30);
  p.set('forearmR',-0.95-w*0.75+c*0.85,0,-0.12);
  p.set('handR',0,0,-0.15-w*0.25);
  p.set('armL',-0.25-w*0.30+c*0.55,0,0.42);
  p.set('forearmL',-0.85,0,0.18);
  p.rootYaw=w*0.52-c*0.62;
  p.set('hips',0,w*0.24-c*0.30,0);
  p.set('chest',-0.06,w*0.40-c*0.50,0);
  p.set('head',0,w*0.20-c*0.28,0);
  p.rootLean=c*0.16;
  p.set('thighL',-0.10+c*0.16,0,0.06);
  p.set('thighR',-0.12-w*0.10,0,-0.06);
  p.set('shinL',0.18,0,0);p.set('shinR',0.20,0,0);
  return p;
};

C.fishCast=function(p,ph,pr){
  p.clear();
  /* Rod back over the shoulder, then a flick forward. */
  var back=M.clamp(ph/0.38,0,1);
  var flick=M.clamp((ph-0.38)/0.22,0,1);
  var settle=M.clamp((ph-0.60)/0.40,0,1);
  var b=ease(back)*(1-ease(flick));
  var f=ease(flick)*(1-ease(settle)*0.55);
  p.set('armR',-1.30-b*0.75+f*0.55,0,-0.26);
  p.set('forearmR',-0.55-b*0.95+f*0.80,0,-0.10);
  p.set('handR',-0.20-b*0.30+f*0.40,0,-0.08);
  p.set('armL',-0.85,0,0.34);
  p.set('forearmL',-0.95,0,0.20);
  p.rootLean=-b*0.10+f*0.16;
  p.set('chest',b*0.12-f*0.14,-b*0.20+f*0.16,0);
  p.set('thighL',-0.08,0,0.06);p.set('thighR',-0.10,0,-0.06);
  p.set('shinL',0.14,0,0);p.set('shinR',0.16,0,0);
  return p;
};

C.fishWait=function(p,ph,pr){
  p.clear();
  var t=ph*TAU;
  /* Rod held out, tip drifting. Almost still — the tension comes from
     the bobber, not the angler. */
  var br=sin(t)*0.5+0.5;
  p.set('armR',-1.02+sin(t*0.6)*0.03,0,-0.24);
  p.set('forearmR',-0.62-br*0.03,0,-0.10);
  p.set('handR',-0.16,0,-0.06);
  p.set('armL',-0.72,0,0.30);
  p.set('forearmL',-1.05,0,0.24);
  p.set('chest',-0.05-br*0.02,-0.12,0);
  p.set('neck',0.04,0.06,0);
  p.set('head',0.06,0.06,0);
  p.rootY=br*0.006;
  p.set('thighL',-0.06,0,0.06);p.set('thighR',-0.08,0,-0.06);
  p.set('shinL',0.12,0,0);p.set('shinR',0.14,0,0);
  return p;
};

C.fishReel=function(p,ph,pr){
  p.clear();
  var t=ph*TAU*3;   /* the crank turns faster than the clip loops */
  /* Rod up and straining, off hand winding the reel. */
  p.set('armR',-1.35+sin(t*0.5)*0.06,0,-0.30);
  p.set('forearmR',-0.95,0,-0.12);
  p.set('handR',-0.10,0,-0.06);
  p.set('armL',-1.05,0.10,0.26);
  p.set('forearmL',-1.15+sin(t)*0.30,cos(t)*0.22,0.20);
  p.set('handL',sin(t)*0.5,0,0.10);
  p.rootLean=-0.10+sin(t*0.5)*0.03;
  p.set('chest',0.10,-0.16,0);
  p.set('head',0.10,0.08,0);
  p.set('thighL',-0.14,0,0.07);p.set('thighR',-0.10,0,-0.07);
  p.set('shinL',0.24,0,0);p.set('shinR',0.20,0,0);
  p.rootY=-0.03;
  return p;
};

C.hurt=function(p,ph,pr){
  p.clear();
  var d=bell(M.clamp(ph,0,1));
  /* Recoil away from the hit, arms in. */
  p.rootLean=-d*0.34;
  p.rootYaw=d*0.22;
  p.set('chest',-d*0.26,d*0.20,0);
  p.set('head',-d*0.30,d*0.16,0);
  p.set('armL',-d*0.85,0,0.50);
  p.set('armR',-d*0.80,0,-0.50);
  p.set('forearmL',-0.55-d*0.70,0,0.20);
  p.set('forearmR',-0.55-d*0.65,0,-0.20);
  p.set('thighL',d*0.22,0,0.06);
  p.set('thighR',d*0.16,0,-0.06);
  p.set('shinL',0.20+d*0.20,0,0);
  p.set('shinR',0.18+d*0.18,0,0);
  p.rootY=-d*0.06;
  return p;
};

C.swim=function(p,ph,pr){
  p.clear();
  var t=ph*TAU;
  /* Face-down crawl: body flat, alternating arm pull, flutter kick. */
  p.rootLean=1.28;
  p.rootY=-0.36;
  p.set('chest',-0.16,0,0);
  p.set('neck',-0.34,0,0);
  p.set('head',-0.30,sin(t)*0.30,0);
  p.set('armL',-1.55+sin(t)*1.55,0,0.30);
  p.set('armR',-1.55+sin(t+PI)*1.55,0,-0.30);
  p.set('forearmL',-0.45-Math.max(0,sin(t))*0.55,0,0.12);
  p.set('forearmR',-0.45-Math.max(0,sin(t+PI))*0.55,0,-0.12);
  p.set('thighL',sin(t*2)*0.30,0,0.05);
  p.set('thighR',sin(t*2+PI)*0.30,0,-0.05);
  p.set('shinL',0.22+Math.max(0,sin(t*2))*0.34,0,0);
  p.set('shinR',0.22+Math.max(0,sin(t*2+PI))*0.34,0,0);
  p.set('footL',-0.30,0,0);p.set('footR',-0.30,0,0);
  return p;
};

C.tread=function(p,ph,pr){
  p.clear();
  var t=ph*TAU;
  /* Upright in deep water, sculling. */
  p.rootY=-0.30;
  p.rootLean=0.12;
  p.set('armL',-1.15,0,0.62+sin(t)*0.18);
  p.set('armR',-1.15,0,-0.62-sin(t+PI)*0.18);
  p.set('forearmL',-0.80,0,0.30);
  p.set('forearmR',-0.80,0,-0.30);
  p.set('thighL',0.55+sin(t)*0.28,0,0.10);
  p.set('thighR',0.55+sin(t+PI)*0.28,0,-0.10);
  p.set('shinL',0.60,0,0);p.set('shinR',0.60,0,0);
  p.set('chest',-0.08,0,0);
  return p;
};

/* ---------------- emotes ---------------- */
C.wave=function(p,ph,pr){
  C.idle(p,ph*0.4,pr);
  var t=M.clamp(ph,0,1);
  var up=ease(M.clamp(t/0.2,0,1))*(1-ease(M.clamp((t-0.78)/0.22,0,1)));
  p.set('armR',-2.35*up,0,-0.30-up*0.42);
  p.set('forearmR',-0.55-up*0.42,0,-0.20);
  p.set('handR',0,0,-0.12+sin(t*TAU*3.2)*0.55*up);
  p.set('chest',-0.04,-0.14*up,0);
  p.set('head',0.02,-0.16*up,0.04*up);
  return p;
};
C.celebrate=function(p,ph,pr){
  p.clear();
  var t=ph*TAU;
  var hop=Math.max(0,sin(t*2));
  p.rootY=hop*0.16;
  p.set('armL',-2.55+sin(t*2)*0.24,0,0.55);
  p.set('armR',-2.55+sin(t*2+0.4)*0.24,0,-0.55);
  p.set('forearmL',-0.30,0,0.18);
  p.set('forearmR',-0.30,0,-0.18);
  p.set('chest',-0.18,sin(t)*0.12,0);
  p.set('head',-0.16,sin(t)*0.18,0);
  p.set('thighL',-0.10-hop*0.30,0,0.08);
  p.set('thighR',-0.10-hop*0.26,0,-0.08);
  p.set('shinL',0.20+hop*0.55,0,0);
  p.set('shinR',0.20+hop*0.50,0,0);
  p.set('footL',-0.20,0,0);p.set('footR',-0.20,0,0);
  return p;
};
C.dance=function(p,ph,pr){
  p.clear();
  var t=ph*TAU;
  var b=sin(t*2);
  p.rootY=Math.abs(sin(t*2))*0.09-0.045;
  p.rootRoll=sin(t)*0.14;
  p.rootYaw=sin(t*0.5)*0.30;
  p.set('hips',0,sin(t)*0.26,sin(t*2)*0.10);
  p.set('chest',-0.06,-sin(t)*0.32,sin(t)*0.12);
  p.set('head',0.04,-sin(t)*0.24,sin(t)*0.10);
  p.set('armL',-1.30+b*0.62,0.30,0.55+b*0.24);
  p.set('armR',-1.30-b*0.62,-0.30,-0.55+b*0.24);
  p.set('forearmL',-1.05-Math.max(0,b)*0.42,0,0.24);
  p.set('forearmR',-1.05-Math.max(0,-b)*0.42,0,-0.24);
  p.set('thighL',-0.08+Math.max(0,b)*0.34,0,0.09);
  p.set('thighR',-0.08+Math.max(0,-b)*0.34,0,-0.09);
  p.set('shinL',0.16+Math.max(0,b)*0.40,0,0);
  p.set('shinR',0.16+Math.max(0,-b)*0.40,0,0);
  return p;
};
C.sit=function(p,ph,pr){
  p.clear();
  var t=ph*TAU;
  var br=sin(t)*0.5+0.5;
  p.rootY=-0.44;
  p.rootLean=0.10;
  p.set('thighL',-1.48,0,0.10);
  p.set('thighR',-1.48,0,-0.10);
  p.set('shinL',1.42,0,0);
  p.set('shinR',1.42,0,0);
  p.set('footL',0.10,0,0);p.set('footR',0.10,0,0);
  p.set('armL',-0.18,0,0.24);
  p.set('armR',-0.18,0,-0.24);
  p.set('forearmL',-0.95-br*0.03,0,0.14);
  p.set('forearmR',-0.95-br*0.03,0,-0.14);
  p.set('chest',-0.06-br*0.025,0,0);
  p.set('head',0.04,sin(ph*TAU*0.3)*0.12,0);
  return p;
};

C.laugh=function(p,ph,pr){
  p.clear();
  var t=ph*TAU;
  /* The shake is doubled against the breath so the body jolts twice
     per cycle while the head only rocks once — that mismatch is what
     reads as laughing rather than nodding. */
  var sh=sin(t*4);
  p.rootY=Math.abs(sh)*0.035;
  p.set('chest',-0.24+sh*0.05,0,sin(t)*0.05);
  p.set('head',-0.34+sh*0.07,sin(t*0.5)*0.10,0);
  p.set('armL',-0.62,0.20,0.62);
  p.set('armR',-0.62,-0.20,-0.62);
  p.set('forearmL',-1.70-sh*0.06,0,0.30);
  p.set('forearmR',-1.70-sh*0.06,0,-0.30);
  p.set('thighL',0.06,0,0.08);
  p.set('thighR',0.06,0,-0.08);
  p.set('shinL',-0.08,0,0);p.set('shinR',-0.08,0,0);
  return p;
};
C.clap=function(p,ph,pr){
  p.clear();
  var t=ph*TAU;
  /* Hands meet at the extremes of the sine, so the clap lands on the
     beat rather than halfway through the swing. */
  var open=(sin(t)*0.5+0.5);
  p.set('chest',-0.10,0,0);
  p.set('head',-0.06,0,0);
  p.set('armL',-1.18,0.10,0.34+open*0.30);
  p.set('armR',-1.18,-0.10,-0.34-open*0.30);
  p.set('forearmL',-1.05,0,0.26-open*0.24);
  p.set('forearmR',-1.05,0,-0.26+open*0.24);
  p.set('handL',0,0,0.20);
  p.set('handR',0,0,-0.20);
  p.rootY=-open*0.012;
  return p;
};
/* A shrug is the clavicles, not the arms — the arms only come up
   because the shoulders took them there. Doing it the other way round
   gives you a character presenting two invisible trays. */
C.shrug=function(p,ph,pr){
  C.idle(p,ph*0.4,pr);
  var t=M.clamp(ph,0,1);
  var up=ease(M.clamp(t/0.22,0,1))*(1-ease(M.clamp((t-0.70)/0.30,0,1)));
  p.add('shoulderL',-0.20*up,0,-0.05*up);
  p.add('shoulderR',-0.20*up,0, 0.05*up);
  p.set('armL', 0.10*up, 0.10*up, 0.085+0.26*up);
  p.set('armR', 0.10*up,-0.10*up,-0.085-0.26*up);
  /* palms turned up: the forearm rolls outward as the elbow closes */
  p.set('forearmL',-1.30*up, 0.55*up, 0.10*up);
  p.set('forearmR',-1.30*up,-0.55*up,-0.10*up);
  p.set('handL',0,0, 0.30*up);
  p.set('handR',0,0,-0.30*up);
  p.add('chest',-0.05*up,0,0);
  p.add('head', 0.05*up,-0.08*up,0.15*up);
  return p;
};
C.point=function(p,ph,pr){
  C.idle(p,ph*0.35,pr);
  var t=M.clamp(ph,0,1);
  var out=ease(M.clamp(t/0.18,0,1))*(1-ease(M.clamp((t-0.74)/0.26,0,1)));
  p.set('armR',-1.62*out,0,-0.18-out*0.10);
  p.set('forearmR',-0.10*out,0,-0.06);
  p.set('handR',0,0,-0.06);
  p.set('chest',-0.04,-0.18*out,0);
  p.set('head',0.02,-0.22*out,0);
  return p;
};

/* ---------------- the state machine ----------------
   States name a clip, a period, whether they loop, and what they fall
   back to. Transitions crossfade; a one-shot returns to its `next`
   when it finishes, unless something interrupts with higher priority. */
var STATES={
  idle:      {clip:'idle',      period:4.2,  loop:true,  blend:0.28, pri:0},
  locomote:  {clip:'locomote',  period:1.0,  loop:true,  blend:0.18, pri:0},
  turn:      {clip:'turn',      period:0.66, loop:true,  blend:0.18, pri:0},
  stop:      {clip:'stop',      period:0.40, loop:false, blend:0.09, pri:1, next:'idle'},
  jump:      {clip:'jump',      period:0.42, loop:false, blend:0.10, pri:2, next:'fall'},
  fall:      {clip:'fall',      period:1.6,  loop:true,  blend:0.20, pri:1},
  land:      {clip:'land',      period:0.34, loop:false, blend:0.07, pri:2, next:'idle'},
  swim:      {clip:'swim',      period:1.5,  loop:true,  blend:0.30, pri:1},
  tread:     {clip:'tread',     period:2.4,  loop:true,  blend:0.30, pri:1},
  mine:      {clip:'mine',      period:0.72, loop:false, blend:0.10, pri:3, next:'idle'},
  build:     {clip:'build',     period:0.54, loop:false, blend:0.10, pri:3, next:'idle'},
  attack:    {clip:'attack',    period:0.58, loop:false, blend:0.08, pri:3, next:'idle'},
  fishCast:  {clip:'fishCast',  period:0.85, loop:false, blend:0.16, pri:3, next:'fishWait'},
  fishWait:  {clip:'fishWait',  period:5.0,  loop:true,  blend:0.30, pri:3},
  fishReel:  {clip:'fishReel',  period:1.1,  loop:true,  blend:0.16, pri:4},
  hurt:      {clip:'hurt',      period:0.40, loop:false, blend:0.06, pri:5, next:'idle'},
  wave:      {clip:'wave',      period:1.6,  loop:false, blend:0.22, pri:3, next:'idle'},
  celebrate: {clip:'celebrate', period:1.5,  loop:true,  blend:0.24, pri:3},
  dance:     {clip:'dance',     period:2.0,  loop:true,  blend:0.30, pri:3},
  sit:       {clip:'sit',       period:6.0,  loop:true,  blend:0.34, pri:3},
  laugh:     {clip:'laugh',     period:1.15, loop:true,  blend:0.20, pri:3},
  clap:      {clip:'clap',      period:0.62, loop:true,  blend:0.18, pri:3},
  point:     {clip:'point',     period:1.5,  loop:false, blend:0.18, pri:3, next:'idle'},
  shrug:     {clip:'shrug',     period:1.4,  loop:false, blend:0.18, pri:3, next:'idle'}
};
Rig.STATES=STATES;

/* ---------------- the upper-body layer ----------------
   Standing still, a swing should involve the whole body: the hips turn
   into it and the weight shifts onto the front foot, and a clip that
   only moved the arms would look like a mime. Walking, the legs are
   busy, and the same clip has to be confined to the ribs and above.

   So an action routes to whichever it needs: full body when the base
   state is standing, upper body only when it is not. One rule, no
   duplicate clips, and the caller never has to know which happened.

   The mask is the fraction of each bone the action layer owns. The
   spine is graded rather than switched, because a hard cut at the
   waist gives a character two halves that disagree about which way
   the torso is facing. */
var UPPER=new Float32Array(NB);
(function(){
  var w={spine:0.22,spine2:0.55,chest:0.90,neck:1,head:1,
         shoulderL:1,armL:1,forearmL:1,handL:1,
         shoulderR:1,armR:1,forearmR:1,handR:1};
  for(var k in w)if(NAME[k]!==undefined)UPPER[NAME[k]]=w[k];
})();
Rig.UPPER=UPPER;
/* Which actions are willing to be played from the ribs up. Anything
   that moves the feet — a jump, a landing, a dance — is not. */
var UPPER_OK={mine:1,build:1,attack:1,wave:1,point:1,clap:1,laugh:1,
              shrug:1,fishCast:1,fishReel:1,hurt:1};

/* Blend `over` into `out` through a per-bone mask. Root channels are
   left alone: the walk's lean, bob and roll belong to the legs that
   are producing them, not to the arm swinging above. */
Pose.blendMask=function(out,over,w,mask){
  if(w<=0)return out;
  for(var i=0;i<NB;i++){
    var m=mask[i]*w;
    if(m<=0.001)continue;
    for(var k=0;k<3;k++){
      var j=i*3+k;
      out.rot[j]+=(over.rot[j]-out.rot[j])*m;
      out.off[j]+=(over.off[j]-out.off[j])*m;
    }
  }
  return out;
};
/* Order is the wheel's order, clockwise from the top. */
Rig.EMOTES=['wave','dance','laugh','celebrate','clap','point','shrug','sit'];

function Anim(){
  this.state='idle';
  this.phase=0;
  this.prev='idle';
  this.prevPhase=0;
  this.blend=1;         /* 1 = fully in `state` */
  this.blendRate=1;
  this.params={speed:0};
  this.a=new Pose();
  this.b=new Pose();
  this.out=new Pose();
  this.done=false;
  /* the action layer, above the waist */
  this.up=null;         /* state name, or null when nothing is playing */
  this.upPhase=0;
  this.upW=0;           /* fade, so an action does not snap on and off */
  this.upDone=false;
  this.upPose=new Pose();
}
Rig.Anim=function(){return new Anim();};

/* Play an action from the ribs up, over whatever the legs are doing. */
Anim.prototype.playUpper=function(name){
  if(!STATES[name])return this;
  this.up=name;this.upPhase=0;this.upDone=false;
  return this;
};

Anim.prototype.play=function(name,force){
  if(!STATES[name])return this;
  /* Moving? Then this action goes on the upper layer and the walk
     underneath it carries on. */
  if(UPPER_OK[name]&&this.state==='locomote'&&this.blend>0.5)
    return this.playUpper(name);
  if(this.state===name&&!force)return this;
  var cur=STATES[this.state],nxt=STATES[name];
  /* A lower-priority state cannot interrupt a running one-shot; that is
     what stops a stray movement key from cancelling a swing mid-strike. */
  if(!force&&cur&&!cur.loop&&!this.done&&nxt.pri<cur.pri)return this;
  this.prev=this.state;this.prevPhase=this.phase;
  this.state=name;this.phase=0;this.done=false;
  this.blend=0;
  this.blendRate=1/Math.max(0.016,nxt.blend);
  return this;
};

Anim.prototype.update=function(dt){
  var st=STATES[this.state];
  if(!st)return this.out;
  this.phase+=dt/st.period;
  if(this.phase>=1){
    if(st.loop)this.phase%=1;
    else{
      this.phase=1;
      if(!this.done){
        this.done=true;
        if(st.next)this.play(st.next);
      }
    }
  }
  if(this.blend<1){
    this.blend=Math.min(1,this.blend+dt*this.blendRate);
    var pst=STATES[this.prev];
    if(pst){
      this.prevPhase+=dt/pst.period;
      if(pst.loop)this.prevPhase%=1;else this.prevPhase=Math.min(1,this.prevPhase);
    }
  }

  var C2=Rig.clips;
  C2[st.clip](this.b,this.phase,this.params);
  if(this.blend>=1)this.out.copyFrom(this.b);
  else{
    var pst2=STATES[this.prev];
    C2[pst2?pst2.clip:'idle'](this.a,this.prevPhase,this.params);
    Pose.blend(this.out,this.a,this.b,M.smooth(this.blend));
  }

  /* ---- the action layer ---- */
  if(this.up){
    var ust=STATES[this.up];
    this.upPhase+=dt/ust.period;
    if(this.upPhase>=1){
      if(ust.loop)this.upPhase%=1;
      else{this.upPhase=1;this.upDone=true;}
    }
    /* An action that stops mid-walk has to leave as smoothly as it
       arrived, or the arm snaps back to the swing it abandoned. */
    var wantW=this.upDone?0:1;
    this.upW+=(wantW-this.upW)*Math.min(1,dt/Math.max(0.05,ust.blend));
    if(this.upDone&&this.upW<0.02){this.up=null;this.upW=0;}
    else{
      C2[ust.clip](this.upPose,this.upPhase,this.params);
      Pose.blendMask(this.out,this.upPose,M.smooth(this.upW),Rig.UPPER);
    }
  }else if(this.upW>0)this.upW=0;
  return this.out;
};

/* ---------------- posing ----------------
   Walk the hierarchy once, writing each bone's world matrix. Parents
   always precede children in BONES, so a single forward pass is
   enough — no recursion, no sort. */
var _bt=M.v3(),_bs=M.v3(1,1,1),_lm=M.m4();

Rig.poseMatrices=function(out,pose,rootMat){
  for(var i=0;i<NB;i++){
    var p=PARENT[i];
    M.set3(_bt,
      REST[i*3]+pose.off[i*3],
      REST[i*3+1]+pose.off[i*3+1],
      REST[i*3+2]+pose.off[i*3+2]);
    M.fromTRS(_lm,_bt,pose.rot[i*3],pose.rot[i*3+1],pose.rot[i*3+2],_bs);
    var dst=out[i]||(out[i]=M.m4());
    if(p<0)M.mul(dst,rootMat,_lm);
    else M.mul(dst,out[p],_lm);
  }
  return out;
};

/* The whole-body channels (bob, lean, roll, yaw) apply above the hips,
   so they are folded into the root matrix rather than any one bone. */
var _rt=M.v3(),_rs=M.v3(1,1,1),_rm=M.m4(),_rm2=M.m4();
/* ---------------- foot IK ----------------
   The one thing that gives a character away as pasted onto the terrain
   rather than standing on it. On a slope both feet sit at the body's
   ground height, so the downhill one hangs in the air and the uphill
   one is buried to the ankle.

   The fix is not to drive the feet to the ground — that would delete
   the walk cycle and leave a figure gliding on stiff legs. It is to
   keep the lift the animation asked for and measure it from the ground
   under *that foot* instead of the ground under the body. On flat
   ground the solve reproduces the clip almost exactly, which is also
   how you know the angle conventions are right. */
var LEGS=[['thighL','shinL','footL'],['thighR','shinR','footR']];

Rig.footIK=function(actor,pose,groundAt,dt){
  var want=actor.grounded?1:0;
  var w=actor.ikW||0;
  w+=(want-w)*Math.min(1,dt*9);
  actor.ikW=w;
  if(w<0.02)return false;

  var sc=actor.scale||1;
  var L1=P.thigh*sc, L2=P.shin*sc;
  var yaw=actor.facing+pose.rootYaw;
  var cy=Math.cos(yaw), sy=Math.sin(yaw);
  var baseY=actor.pos[1];

  var hxA=[],hyA=[],hzA=[],txA=[],tyA=[],tzA=[],drop=0,i;
  for(i=0;i<2;i++){
    var tm=actor.mats[NAME[LEGS[i][0]]];
    var fm=actor.mats[NAME[LEGS[i][2]]];
    hxA[i]=tm[12];hyA[i]=tm[13];hzA[i]=tm[14];
    var g=groundAt(fm[12],fm[14]);
    txA[i]=fm[12];tzA[i]=fm[14];
    /* Keep the animation's lift; move the floor under it. */
    tyA[i]=g+(fm[13]-baseY);
    var need=g-baseY;
    if(need<drop)drop=need;
  }
  /* Only ever drop. Lifting the hips to reach a high foot would push
     the whole body off the ground it is standing on. */
  drop=Math.max(drop,-(L1+L2)*0.39)*w;

  for(var j=0;j<2;j++){
    var vx=txA[j]-hxA[j], vy=tyA[j]-(hyA[j]+drop), vz=tzA[j]-hzA[j];
    /* Undo the body's facing so the solve happens in the plane the
       leg bones actually rotate in. */
    var lx=vx*cy-vz*sy;
    var lz=vx*sy+vz*cy;
    var d=Math.sqrt(lx*lx+vy*vy+lz*lz);
    /* Never fully straight: at exactly L1+L2 the knee angle is a
       singularity and the joint flickers between the two solutions. */
    d=M.clamp(d,Math.abs(L1-L2)+0.02,L1+L2-0.012);
    var a2=Math.acos(M.clamp((L1*L1+L2*L2-d*d)/(2*L1*L2),-1,1));
    var a1=Math.acos(M.clamp((L1*L1+d*d-L2*L2)/(2*L1*d),-1,1));
    /* Pitch of the hip-to-target line from straight down. Negative X
       on a thigh swings the leg forward in this rig, and the knee
       bends forward, so the thigh leads the line by a1. */
    var theta=Math.atan2(lz,-vy);
    var thighX=-(theta+a1);
    var shinX=Math.PI-a2;
    var thighZ=Math.atan2(-lx,-vy);
    var bi=NAME[LEGS[j][0]]*3, si=NAME[LEGS[j][1]]*3, fi=NAME[LEGS[j][2]]*3;
    var r=pose.rot;
    r[bi]  +=(thighX-r[bi])*w;
    r[bi+2]+=(thighZ-r[bi+2])*w;
    r[si]  +=(shinX-r[si])*w;
    /* Sole level with the world, whatever the leg above it is doing. */
    r[fi]  +=(-(thighX+shinX)-r[fi])*w;
  }
  pose.rootY+=drop/sc;
  return true;
};

Rig.rootMatrix=function(out,pos,facing,pose,scale,squash){
  var s=scale||1;
  M.set3(_rt,pos[0],pos[1]+pose.rootY*s,pos[2]);
  /* Squash conserves rough volume — down in y, out in x and z — so a
     landing compresses rather than shrinking. */
  var q=squash||0;
  M.set3(_rs,s*(1+q*0.13),s*(1-q*0.22),s*(1+q*0.13));
  M.fromTRS(out,_rt,0,facing+pose.rootYaw,0,_rs);
  M.set3(_rt,0,0,0);M.set3(_rs,1,1,1);
  M.fromTRS(_rm,_rt,pose.rootLean,0,pose.rootRoll,_rs);
  M.mul(out,M.copy(_rm2,out),_rm);
  return out;
};

LH.Rig=Rig;
})();


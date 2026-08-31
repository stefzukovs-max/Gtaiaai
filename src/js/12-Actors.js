/* ============================================================
   LH.Actors — character instances and their batching.

   An actor is a position, a facing, an animation, and a kit. Every
   frame each actor walks its kit, poses the bones its parts hang
   from, and pushes one instance into that part's buffer. Parts are
   then drawn once each, instanced, so a plaza of forty people costs
   the same draw calls as one person standing alone.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,GL=LH.GL,Rig=LH.Rig,Body=LH.Body,Cos=LH.Cos,Geo=LH.Geo;
var A={};

/* Which bone each part rides, and where it sits on that bone. Data,
   because adding a cosmetic slot should not mean editing the drawer. */
var SLOTS=[
  /* slot,      bone,        offset,             mirror */
  /* The head bone sits at the atlas, 1.545 m, where a head actually
     pivots. The skull's own centre is 12 cm above that, so everything
     that rides the head is offset up by exactly that much — which also
     means the hair and hats authored against the old skull still land
     on this one. */
  ['head',      'head',      [0,0.122,0]],
  ['eyes',      'head',      [0,0.122,0]],
  ['iris',      'head',      [0,0.122,0]],
  ['brows',     'head',      [0,0.122,0]],
  ['hair',      'head',      [0,0.122,0]],
  ['hat',       'head',      [0,0.122,0]],
  ['facial',    'head',      [0,0.122,0]],
  ['acc',       'head',      [0,0.122,0]],
  ['neck',      'neck',      [0,0,0]],
  ['chest',     'chest',     [0,0,0]],
  ['shirt',     'chest',     [0,0,0]],
  ['over',      'chest',     [0,0,0]],
  ['cape',      'chest',     [0,0,0]],
  ['wings',     'chest',     [0,0,0]],
  ['back',      'chest',     [0,0,0]],
  ['hips',      'hips',      [0,0,0]],
  ['pants',     'hips',      [0,0,0]],
  ['armL',      'armL',      [0,0,0]],
  ['armR',      'armR',      [0,0,0]],
  ['sleeveL',   'armL',      [0,0,0]],
  ['sleeveR',   'armR',      [0,0,0]],
  ['forearmL',  'forearmL',  [0,0,0]],
  ['forearmR',  'forearmR',  [0,0,0]],
  ['handL',     'handL',     [0,0,0]],
  ['handR',     'handR',     [0,0,0]],
  ['thighL',    'thighL',    [0,0,0]],
  ['thighR',    'thighR',    [0,0,0]],
  ['legL',      'thighL',    [0,0,0]],
  ['legR',      'thighR',    [0,0,0]],
  ['shinL',     'shinL',     [0,0,0]],
  ['shinR',     'shinR',     [0,0,0]],
  ['footL',     'footL',     [0,0,0]],
  ['footR',     'footR',     [0,0,0]],
  ['tool',      'handR',     [0,-0.10,0.02]]
];
var SLOT_BONE={};
for(var si=0;si<SLOTS.length;si++)SLOT_BONE[SLOTS[si][0]]=SLOTS[si];

/* ---------------- default kit ----------------
   The 2D build let players start dressed. This one does not: you
   arrive in the simplest possible clothes and everything after that
   is something you found, earned or bought. */
/* Xorshift32 needs its seed scattered before the first draw is worth
   anything. Seeded with 5, 36 or 67 the state stays under 2^25 for a
   round or two, so the first value is always below 0.01 — and a kit
   that picks its skin, hair and shirt from the first three draws hands
   every small seed the same person. Scatter, then throw a few away. */
function kitRng(seed){
  var r=M.rng((((seed||1)*2654435761)>>>0)||1);
  for(var i=0;i<8;i++)r();
  return r;
}
A.kitRng=kitRng;
A.defaultKit=function(seed){
  var rng=kitRng(seed);
  var SKIN=['#F2C9A4','#E3AE83','#C98B62','#9C6242','#75462C','#54321F','#FBDCC0'];
  var HAIRC=['#2B2118','#4A3222','#7A5230','#A87740','#D8B978','#8E3B2E','#2A2E3A'];
  var EYEC=['#5C9EDC','#5FA86A','#A87A46','#4E5A6E','#8A6ED8'];
  /* Everyone arrives in a colour. A plaza of people in slate reads as
     a crowd of extras; a plaza of people in eight bright tees reads as
     a place worth standing in. */
  var TEE=['#FF7A6B','#FFB84D','#5BC8FF','#8BE06A','#C08BFF','#FF8FC7',
           '#4FE3B0','#FFE066','#FF9A5B','#7FA8FF'];
  var TROUSER=['#3E63C8','#59606E','#7A5230','#3F7A5E','#8C4A6E','#2F3A52'];
  var SHOE=['#37405C','#8E3B2E','#2E5A46','#5A4630','#3A3F4A'];
  return {
    scale:1,
    skin:SKIN[(rng()*SKIN.length)|0],
    eye:EYEC[(rng()*EYEC.length)|0],
    build:'base',
    hair:{style:'crop',color:HAIRC[(rng()*HAIRC.length)|0]},
    hat:{style:'none',color:'#FFFFFF'},
    /* Facial hair takes the hair's colour, so it carries no colour of
       its own — two greys that disagree on the same head is the fastest
       way to make a character look assembled rather than designed. */
    facial:{style:'none'},
    acc:{style:'none',color:'#2E3540'},
    over:{style:'none',color:'#FFFFFF'},
    shirt:{style:'tee',color:TEE[(rng()*TEE.length)|0],sleeve:'short'},
    pants:{style:'long',color:TROUSER[(rng()*TROUSER.length)|0],leg:'long'},
    shoes:{style:'shoe',color:SHOE[(rng()*SHOE.length)|0]},
    wings:{style:'none',color:'#FFFFFF'},
    cape:{style:'none',color:'#FFFFFF'},
    back:{style:'none',color:'#FFFFFF'},
    tool:{style:'none',color:'#FFFFFF'},
    aura:{style:'none',color:'#3BE0C8'},
    pet:{style:'none',color:'#FFFFFF'}
  };
};

/* ---------------- actor ---------------- */
function Actor(opt){
  opt=opt||{};
  this.pos=M.v3(opt.x||0,opt.y||0,opt.z||0);
  this.vel=M.v3();
  this.facing=opt.facing||0;
  this.wantFacing=this.facing;
  this.kit=opt.kit||A.defaultKit(opt.seed||1);
  this.anim=Rig.Anim();
  this.mats=[];
  /* worldBone * inverseBind for every bone, refilled each frame and
     handed straight to the skinned draw. One per actor because that is
     exactly what a skinned draw cannot share. */
  this.palette=new Float32Array(Rig.NB*16);
  this.root=M.m4();
  this.name=opt.name||'';
  this.visible=true;
  this.scale=this.kit.scale||1;
  this.grounded=true;
  this.tag=null;         /* DOM name tag, attached by the UI */
  this.petPos=M.v3(opt.x||0,opt.y||0,opt.z||0);
  this.petPhase=Math.random()*6.28;
  /* --- the small signs of life --- */
  this.lookAt=null;        /* v3 in world space, or null for "nothing" */
  this.lookYaw=0;          /* current, damped toward the target */
  this.lookPitch=0;
  this.lookW=0;            /* 0..1, how much of the cone is being used */
  this.blink=0;            /* 0 open, 1 shut */
  this.blinkT=0.6+Math.random()*3.2;
  this.eyeX=0;this.eyeY=0; /* iris dart, in head-local metres */
  this.eyeTX=0;this.eyeTY=0;
  this.dartT=Math.random()*2;
  this.driftT=Math.random()*4;
  this.driftYaw=0;this.driftPitch=0;
  this.lag=[0,0];          /* cape / hair lag, actor-local */
  this.lagV=[0,0];         /* its velocity — this is a spring, not a follow */
  this.hair=[0,0];         /* the same again, softer and slower */
  this.hairV=[0,0];
  this.turnRate=0;
  this.squash=0;           /* landing compression, set by the controller */
  this.ik=false;           /* foot IK, switched on for whoever is close */
  this.ikW=0;
  this.lastPos=M.v3(opt.x||0,opt.y||0,opt.z||0);
  this.id=opt.id||('a'+(A._next++));
}
A._next=1;
A.Actor=function(o){return new Actor(o);};

/* Turn toward the movement direction rather than snapping. The rate is
   deliberately high — a character that lags its input feels broken —
   but not instant, which would look robotic. */
Actor.prototype.faceToward=function(yaw,dt,rate){
  this.wantFacing=yaw;
  var d=M.angDelta(this.facing,yaw);
  var step=d*Math.min(1,dt*(rate||14));
  this.facing+=step;
  /* Turn rate in radians per second, damped. The lean is built from
     this rather than from the angle error, because the error is
     largest at the instant the turn starts and a body leans hardest in
     the middle of one. */
  this.turnRate=M.damp(this.turnRate||0,step/Math.max(dt,0.0001),0.09,dt);
};

/* A critically-ish damped spring, integrated semi-implicitly so it
   stays stable at the frame rates a browser actually delivers rather
   than the one it was tuned at. `k` is stiffness, `c` damping. */
function spring(pos,vel,i,target,k,c,dt){
  var step=Math.min(dt,1/50);
  var n=Math.max(1,Math.ceil(dt/step));
  var h=dt/n;
  for(var q=0;q<n;q++){
    vel[i]+=((target-pos[i])*k-vel[i]*c)*h;
    pos[i]+=vel[i]*h;
  }
}

/* Everything here is presentation: nothing it does can change where
   the actor is or what it owns. It runs after the clip and before the
   matrices, so it composes on top of whatever the animation did. */
var _lk=M.v3();
Actor.prototype.life=function(dt,pose){
  /* --- blinking ---
     Two blinks close together now and then, which is what people
     actually do, and never on a fixed metronome. */
  this.blinkT-=dt;
  if(this.blinkT<=0){
    this.blink=1;
    this.blinkT=(Math.random()<0.22)?0.18+Math.random()*0.12
                                    :1.8+Math.random()*4.2;
  }
  if(this.blink>0)this.blink=Math.max(0,this.blink-dt*9.0);

  /* --- where the head is pointed ---
     A target if something asked for one; otherwise a slow wander, so
     an idle character is looking *somewhere* rather than through you. */
  var wantY=0,wantP=0,wantW=0;
  if(this.lookAt){
    var dx=this.lookAt[0]-this.pos[0];
    var dy=this.lookAt[1]-(this.pos[1]+1.45*this.scale);
    var dz=this.lookAt[2]-this.pos[2];
    var flat=Math.hypot(dx,dz);
    if(flat>0.05){
      /* Facing 0 points at +Z, so the bearing is atan2(x,z) and the
         head only has to make up the difference. */
      var bearing=Math.atan2(dx,dz);
      var rel=bearing-this.facing;
      while(rel>Math.PI)rel-=Math.PI*2;
      while(rel<-Math.PI)rel+=Math.PI*2;
      /* Past the shoulder a head does not follow — the whole body
         turns, or the look is simply dropped. Dropping it is right
         here: the alternative is a neck that snaps at the limit. */
      if(Math.abs(rel)<2.0){
        wantY=M.clamp(rel,-1.15,1.15);
        wantP=M.clamp(Math.atan2(dy,flat),-0.42,0.55);
        wantW=1-M.smooth(M.clamp((Math.abs(rel)-1.15)/0.85,0,1));
      }
    }
  }
  if(wantW<0.02){
    this.driftT-=dt;
    if(this.driftT<=0){
      this.driftT=2.2+Math.random()*4.5;
      this.driftYaw=(Math.random()-0.5)*0.46;
      this.driftPitch=(Math.random()-0.5)*0.18;
    }
    wantY=this.driftYaw;wantP=this.driftPitch;wantW=0.55;
  }
  this.lookYaw=M.damp(this.lookYaw,wantY,0.13,dt);
  this.lookPitch=M.damp(this.lookPitch,wantP,0.15,dt);
  this.lookW=M.damp(this.lookW,wantW,0.18,dt);

  /* Spread the turn down the spine. All of it in the neck is an owl;
     a share in the chest is a person. */
  var w=this.lookW;
  pose.add('head', this.lookPitch*0.62*w, this.lookYaw*0.58*w, 0);
  pose.add('neck', this.lookPitch*0.24*w, this.lookYaw*0.26*w, 0);
  pose.add('chest',this.lookPitch*0.07*w, this.lookYaw*0.16*w, 0);

  /* --- the eyes lead the head --- */
  this.dartT-=dt;
  if(this.dartT<=0){
    this.dartT=0.5+Math.random()*2.4;
    this.eyeTX=(Math.random()-0.5)*0.0055;
    this.eyeTY=(Math.random()-0.5)*0.0035;
  }
  /* Bias the target toward whatever the head is turning to reach: eyes
     arrive first and the head catches up, never the other way round. */
  var lx=M.clamp(this.lookYaw*0.0090,-0.0075,0.0075)*w;
  var ly=M.clamp(this.lookPitch*0.0060,-0.0045,0.0045)*w;
  this.eyeX=M.damp(this.eyeX,this.eyeTX+lx,0.05,dt);
  this.eyeY=M.damp(this.eyeY,this.eyeTY+ly,0.05,dt);

  /* --- cloth lag ---
     A cape hangs from the chest and answers to where the body has
     been, not where it is. Two damped scalars in actor space is the
     whole simulation and it is enough to stop it reading as board. */
  var vx=(this.pos[0]-this.lastPos[0])/Math.max(dt,0.0001);
  var vz=(this.pos[2]-this.lastPos[2])/Math.max(dt,0.0001);
  M.copy3(this.lastPos,this.pos);
  var sf=Math.sin(this.facing),cf=Math.cos(this.facing);
  var fwd=vx*sf+vz*cf;         /* along the way the actor is facing */
  var side=vx*cf-vz*sf;
  /* A spring rather than a damped follow. A follow always trails the
     target and never passes it, so cloth eased into place and stopped;
     a spring overshoots and settles, which is what actually happens
     when someone stops walking and their coat keeps going. */
  var wind=LH.Render&&LH.Render.scene?LH.Render.scene.wind:null;
  var wf=wind?(wind[0]*sf+wind[2]*cf)*0.020:0;
  var ws=wind?(wind[0]*cf-wind[2]*sf)*0.016:0;
  var tgt0=M.clamp(fwd*0.058+wf,-0.46,0.46);
  var tgt1=M.clamp(side*0.046+ws,-0.34,0.34);
  spring(this.lag,this.lagV,0,tgt0,74,11,dt);
  spring(this.lag,this.lagV,1,tgt1,66,10,dt);
  /* Hair is lighter and answers faster, and it also answers to the
     head turning, which cloth on the chest does not. */
  var hy=(this.turnRate||0)*0.030;
  spring(this.hair,this.hairV,0,tgt0*1.35,120,13,dt);
  spring(this.hair,this.hairV,1,M.clamp(tgt1*1.5+hy,-0.44,0.44),110,12,dt);

  /* Bank into the turn. Scaled by how fast the actor is actually
     travelling — leaning while turning on the spot is a comedy pose,
     not a run. */
  var sp=Math.hypot(vx,vz);
  var bank=M.clamp((this.turnRate||0)*0.11,-0.32,0.32)*M.clamp(sp/4.5,0,1);
  pose.rootRoll+=bank;
  pose.add('chest',0,0,-bank*0.35);
  pose.add('head',0,0,-bank*0.30);
  return pose;
};

Actor.prototype.update=function(dt){
  var pose=this.anim.update(dt);
  this.life(dt,pose);
  Rig.rootMatrix(this.root,this.pos,this.facing,pose,this.scale,this.squash);
  Rig.poseMatrices(this.mats,pose,this.root);
  /* A second forward pass, and only for actors close enough to see it.
     The solve needs the first pass's foot positions to know where the
     animation wanted them, so there is no way to fold this into one. */
  if(this.ik&&A.groundAt&&Rig.footIK(this,pose,A.groundAt,dt)){
    Rig.rootMatrix(this.root,this.pos,this.facing,pose,this.scale,this.squash);
    Rig.poseMatrices(this.mats,pose,this.root);
  }
  Rig.skinPalette(this.palette,this.mats);
  /* the pet trails with a spring rather than sticking to a fixed offset */
  if(this.kit.pet&&this.kit.pet.style!=='none'){
    this.petPhase+=dt;
    var bx=this.pos[0]-Math.sin(this.facing)*0.75;
    var bz=this.pos[2]-Math.cos(this.facing)*0.75;
    this.petPos[0]=M.damp(this.petPos[0],bx,0.10,dt);
    this.petPos[2]=M.damp(this.petPos[2],bz,0.10,dt);
    this.petPos[1]=M.damp(this.petPos[1],this.pos[1],0.16,dt);
  }
  return pose;
};

/* ---------------- batching ----------------
   Two queues, because there are two kinds of thing to draw.

   Rigid parts — a hat, a held tool, a pet — are the same mesh on every
   character wearing one, so they batch: one draw covers forty hats.

   Skinned parts cannot. A skinned draw is placed by a bone palette,
   and a palette belongs to one character standing in one pose, so
   every skinned mesh on every visible actor is its own draw call. At
   roughly five skinned meshes each and twenty actors on screen that is
   a hundred draws, against the three hundred the world already costs —
   the price of a body that bends. */
var touched=[],touchedSet={};
var skinJobs=[],skinCount=0;
function pushSkin(mesh,actor,tint,emis){
  if(!mesh||!actor.palette)return;
  var j=skinJobs[skinCount];
  if(!j)j=skinJobs[skinCount]={mesh:null,pal:null,tint:[0,0,0],emis:0};
  j.mesh=mesh;j.pal=actor.palette;
  j.tint[0]=tint[0];j.tint[1]=tint[1];j.tint[2]=tint[2];
  j.emis=emis||0;
  skinCount++;
}
A.pushSkin=pushSkin;
function pushInstance(mesh,mat,tint,emis){
  if(!mesh)return;
  if(mesh.instances>=mesh.maxInstances)return;
  if(!touchedSet[mesh.key]){touchedSet[mesh.key]=1;touched.push(mesh);}
  var o=mesh.instances*GL.ISTRIDE,d=mesh.idata;
  for(var i=0;i<16;i++)d[o+i]=mat[i];
  d[o+16]=tint[0];d[o+17]=tint[1];d[o+18]=tint[2];d[o+19]=emis||0;
  mesh.instances++;
}
A.pushInstance=pushInstance;
/* Where the ground is. Set once by the game so the rig never has to
   know what a world is. */
A.groundAt=null;

A.beginFrame=function(){
  for(var i=0;i<touched.length;i++)touched[i].instances=0;
  touched.length=0;touchedSet={};
  skinCount=0;
};

var _m=M.m4(),_t=M.v3(),_s=M.v3(1,1,1),_off=M.m4(),_tmp=M.m4();
function boneMat(actor,boneName,offset,rot){
  var bi=Rig.NAME[boneName];
  var bm=actor.mats[bi];
  if(!bm)return null;
  var moved=offset&&(offset[0]||offset[1]||offset[2]);
  var turned=rot&&(rot[0]||rot[1]||rot[2]);
  if(!moved&&!turned)return bm;
  M.set3(_t,offset?offset[0]:0,offset?offset[1]:0,offset?offset[2]:0);
  M.set3(_s,1,1,1);
  M.fromTRS(_off,_t,rot?rot[0]:0,rot?rot[1]:0,rot?rot[2]:0,_s);
  return M.mul(_m,bm,_off);
}

/* Kit -> a list of (mesh, bone, tint) for this frame. Written as one
   pass rather than a table of closures so a new slot is one line. */
A.submit=function(actor){
  if(!actor.visible)return;
  var k=actor.kit;
  var skin=Geo.col3(k.skin);
  function P(mesh,bone,off,col,emis,rot){
    var m=boneMat(actor,bone,off,rot);
    if(m)pushInstance(mesh,m,col,emis);
  }
  var headOff=SLOT_BONE.head[2];
  var lag=actor.lag||[0,0];

  /* --- head --- */
  P(Body.head(),'head',headOff,skin);
  P(Body.eyes(),'head',headOff,Geo.col3('#FFFFFF'));
  /* The iris carries the dart. Moving the whole eye part would take
     the socket with it, and a socket that slides around the face is
     worse than an eye that never moves. */
  P(Body.iris(),'head',
    [headOff[0]+(actor.eyeX||0),headOff[1]+(actor.eyeY||0),headOff[2]],
    Geo.col3(k.eye));
  P(Body.brows(),'head',
    [headOff[0],headOff[1]+(actor.eyeY||0)*0.4,headOff[2]],
    Geo.col3(k.hair.color));
  /* Lids ride down from inside the brow. Skipped entirely while the
     eye is open, so an unblinking crowd costs nothing. */
  if((actor.blink||0)>0.02)
    P(Body.lids(),'head',
      [headOff[0],headOff[1]+(1-actor.blink)*0.030,headOff[2]],skin);
  if(k.hair.style!=='bald'){
    /* Hair swings on its own spring, harder than the cape's: it is
       lighter, it is further from the pivot, and it answers to the
       head turning as well as to the body moving. */
    var hr=actor.hair||lag;
    P(Body.hair(k.hair.style),'head',headOff,Geo.col3(k.hair.color),0,
      [-hr[0]*0.42,hr[1]*0.20,hr[1]*0.46]);
  }
  if(k.hat.style!=='none')
    P(Body.hat(k.hat.style),'head',headOff,Geo.col3(k.hat.color));
  if(k.facial&&k.facial.style!=='none')
    P(Body.facial(k.facial.style),'head',headOff,Geo.col3(k.hair.color));
  if(k.acc&&k.acc.style!=='none')
    P(Body.accessory(k.acc.style),'head',headOff,Geo.col3(k.acc.color));

  /* --- the body ---
     One mesh, one draw, from the collarbone to the toes. What used to
     be nine rigid parts and eleven joint spheres. */
  pushSkin(Body.figure(k.build),actor,skin);

  /* --- torso --- */
  if(k.shirt.style!=='none')
    pushSkin(Body.shirt(k.shirt.style,k.shirt.sleeve,k.build),actor,
      Geo.col3(k.shirt.color));
  /* The occupational layer goes on before the cape and after the
     shirt: a coat under a cape, a cape over a coat. */
  if(k.over&&k.over.style!=='none')
    pushSkin(Cos.overlay(k.over.style,k.build),actor,Geo.col3(k.over.color));
  if(k.cape.style!=='none')
    pushSkin(Cos.cape(k.cape.style,k.build),actor,Geo.col3(k.cape.color));
  if(k.back.style!=='none')
    pushSkin(Cos.backpack(k.back.style,k.build),actor,Geo.col3(k.back.color));
  if(k.wings.style!=='none')
    P(Cos.wings(k.wings.style),'chest',null,Geo.col3(k.wings.color),
      k.wings.emis||0);

  /* --- legs and feet --- */
  if(k.pants.style!=='none')
    pushSkin(Body.trousers(k.pants.leg,k.build),
      actor,Geo.col3(k.pants.color));
  if(k.shoes.style!=='bare')
    pushSkin(Body.shoes(k.shoes.style,k.build),actor,Geo.col3(k.shoes.color));

  /* --- held --- */
  if(k.tool.style!=='none')
    P(Cos.tool(k.tool.style),'handR',SLOT_BONE.tool[2],Geo.col3(k.tool.color));
};

/* Auras and pets are drawn in their own passes — additive and
   world-space respectively — so they are submitted separately. */
A.submitAura=function(actor,time){
  var k=actor.kit;
  if(!k.aura||k.aura.style==='none')return;
  var mesh=Cos.aura(k.aura.style);
  M.set3(_t,actor.pos[0],actor.pos[1]+0.02,actor.pos[2]);
  M.set3(_s,actor.scale,actor.scale,actor.scale);
  M.fromTRS(_m,_t,0,time*0.6,0,_s);
  pushInstance(mesh,_m,Geo.col3(k.aura.color),1);
};
A.submitPet=function(actor,time){
  var k=actor.kit;
  if(!k.pet||k.pet.style==='none')return;
  var mesh=Cos.pet(k.pet.style);
  var bob=Math.sin(time*3+actor.petPhase)*0.05;
  var yaw=Math.atan2(actor.pos[0]-actor.petPos[0],actor.pos[2]-actor.petPos[2]);
  M.set3(_t,actor.petPos[0],actor.petPos[1]+bob,actor.petPos[2]);
  M.set3(_s,actor.scale,actor.scale,actor.scale);
  M.fromTRS(_m,_t,0,yaw,0,_s);
  pushInstance(mesh,_m,Geo.col3(k.pet.color),k.pet.style==='sprite'?1:0);
};

/* Draw whatever was submitted. `prog` must already be bound. */
A.flush=function(prog){
  GL.u1i(prog,'uInstanced',1);
  for(var i=0;i<touched.length;i++){
    var m=touched[i];
    if(!m.instances)continue;
    GL.updateInstances(m,m.instances);
    GL.drawInstanced(m,m.instances);
  }
  GL.u1i(prog,'uInstanced',0);
  A.flushSkinned(prog);
};

/* Both passes call this and neither clears the queue: the colour pass
   runs after the shadow pass and needs the same jobs. */
A.flushSkinned=function(prog){
  if(!skinCount)return;
  GL.u1i(prog,'uInstanced',0);
  GL.u1i(prog,'uSkinned',1);
  for(var i=0;i<skinCount;i++){
    var j=skinJobs[i];
    GL.uBones(prog,j.pal);
    GL.u4f(prog,'uTint',j.tint[0],j.tint[1],j.tint[2],j.emis);
    GL.draw(j.mesh);
  }
  GL.u1i(prog,'uSkinned',0);
};
/* The shadow pass needs the same batches without re-submitting, and it
   must not clear them — the colour pass runs afterwards. */
A.flushShadow=function(prog){
  GL.u1i(prog,'uInstanced',1);
  for(var i=0;i<touched.length;i++){
    var m=touched[i];
    if(!m.instances)continue;
    GL.updateInstances(m,m.instances);
    GL.drawInstanced(m,m.instances);
  }
  GL.u1i(prog,'uInstanced',0);
  A.flushSkinned(prog);
};

A.touched=function(){return touched;};

LH.Actors=A;
})();


/* ============================================================
   LH.Player — the controller.

   A capsule that walks, runs, jumps, swims and climbs slopes,
   resolved against the terrain heightmap and the world's collision
   boxes. Movement is camera-relative; the character turns toward
   where it is going rather than where the camera points, except
   while aiming.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,Cam=LH.Cam,W=LH.World,T=LH.Terrain,I=LH.Input;
var Pl={};

Pl.actor=null;
Pl.vel=M.v3();
Pl.grounded=true;
Pl.inWater=false;
Pl.swimming=false;
Pl.radius=0.36;
/* Crown lands at about 1.78 m with the cartoon proportions: shorter
   legs and a much bigger head roughly cancel out, so the capsule
   barely moves. */
Pl.height=1.78;
Pl.eyeH=1.50;

var WALK=4.2, RUN=7.6, SWIM=2.8, FLY=9.5;
var ACCEL=26, AIRACCEL=6, FRICTION=13;
var GRAVITY=-24, JUMP=8.0;
var MAX_STEP=0.62;      /* how tall a ledge you walk up rather than into */
/* ---------------- slopes ----------------
   The heightmap has plenty of steep ground and the controller used to
   treat all of it as a floor, so you could stand on a 60-degree quarry
   face as comfortably as on the plaza and walk up it at full speed.
   Three numbers fix that: how far apart to sample the gradient, how
   flat counts as walkable, and how hard gravity drags you down what
   does not. */
var SLOPE_EPS=0.55;
var SLOPE_STAND=0.68;   /* ground normal Y at about 47 degrees */
var SLIDE_ACC=17;
var WADE=0.55;          /* fraction of top speed in knee-deep water  */
Pl.slope=1;             /* the ground normal's Y under the feet     */
Pl.slide=0;             /* 0..1, how much the ground is refusing to hold */

/* ---------------- the forgiving bits ----------------
   None of this changes where the character can go. All of it changes
   whether the controller feels like it is listening. A jump that is
   refused because you left the ledge 40ms ago, or because you pressed
   40ms before landing, reads as the game being wrong — and the player
   is right, because they did press it. */
var COYOTE=0.13;       /* how long a jump still works after a ledge   */
var JUMPBUF=0.16;      /* how early a jump can be asked for           */
var JUMP_CUT=0.60;     /* velocity kept when the button is released   */
Pl.coyote=0;
Pl.jumpBuf=0;
Pl.rising=false;       /* mid-jump and still holding the button       */
Pl.squash=0;           /* landing compression, 0..1, decays           */
Pl.airTime=0;
Pl.lastSpeed=0;        /* last frame's ground speed */
Pl.peak=0;             /* recent top speed, decaying — drives the stop plant */

Pl.flying=false;
Pl.flyWish=0;          /* -1, 0 or +1 from the action bar */
Pl.init=function(actor){
  Pl.actor=actor;
  return Pl;
};
/* Free flight, for building. Gravity is off and the ground is a floor
   rather than a surface, so you can hover a metre above a wall you are
   putting up instead of scaffolding it. */
Pl.setFly=function(on){
  Pl.flying=!!on;
  if(!Pl.flying)Pl.flyWish=0;
  else{Pl.vel[1]=0;Pl.grounded=false;}
  return Pl.flying;
};
Pl.toggleFly=function(){return Pl.setFly(!Pl.flying);};
/* A tap from the action bar gives a short burst; holding the key gives
   continuous lift. Both go through the same wish value. */
Pl.flyNudge=function(dir){
  if(!Pl.flying)Pl.setFly(true);
  Pl.vel[1]=dir*FLY*0.62;
  Pl._nudge=0.22;
};

var _f=M.v3(),_r=M.v3(),_want=M.v3(),_tmp=M.v3();

/* Placed blocks are collision too. Only the cells around the player
   are tested — a sparse grid makes that a handful of map lookups. */
function resolveVoxels(pos){
  var V=LH.Voxels;
  if(!V||!V.count())return;
  var r=Pl.radius;
  var x0=Math.floor(pos[0]-r-1), x1=Math.floor(pos[0]+r+1);
  var z0=Math.floor(pos[2]-r-1), z1=Math.floor(pos[2]+r+1);
  var y0=Math.floor(pos[1]+0.15), y1=Math.floor(pos[1]+Pl.height-0.15);
  for(var pass=0;pass<2;pass++)
  for(var y=y0;y<=y1;y++)for(var z=z0;z<=z1;z++)for(var x=x0;x<=x1;x++){
    if(!V.solid(x,y,z))continue;
    var cx=M.clamp(pos[0],x,x+1), cz=M.clamp(pos[2],z,z+1);
    var dx=pos[0]-cx, dz=pos[2]-cz;
    var d2=dx*dx+dz*dz;
    if(d2>r*r)continue;
    if(d2>1e-8){
      var d=Math.sqrt(d2);
      pos[0]+=dx/d*(r-d);pos[2]+=dz/d*(r-d);
    }else{
      /* dead centre of a cell — push along whichever axis is shallower */
      var px=(x+0.5)-pos[0], pz=(z+0.5)-pos[2];
      if(Math.abs(px)<Math.abs(pz))pos[0]-=Math.sign(px||1)*r;
      else pos[2]-=Math.sign(pz||1)*r;
    }
  }
}
/* The top of the highest placed block directly under the player, so
   you can stand on what you build. */
function voxelFloor(x,y,z){
  var V=LH.Voxels;
  if(!V||!V.count())return -1e9;
  var cx=Math.floor(x), cz=Math.floor(z);
  var top=-1e9;
  for(var cy=Math.floor(y+0.4);cy>=Math.floor(y)-2;cy--){
    if(V.solid(cx,cy,cz)){top=cy+1;break;}
  }
  return top;
}

Pl.update=function(dt){
  var a=Pl.actor;
  if(!a)return;

  /* ---- camera-relative desired direction ---- */
  Cam.forward(_f);Cam.rightVec(_r);
  M.set3(_want,
    _r[0]*I.move.x+_f[0]*I.move.y,0,
    _r[2]*I.move.x+_f[2]*I.move.y);
  var wl=M.len3(_want);
  if(wl>1){M.scale3(_want,_want,1/wl);wl=1;}

  var seaY=T.SEA;
  var feet=a.pos[1];
  Pl.inWater=feet<seaY-0.15;
  Pl.swimming=feet<seaY-1.05;

  /* ---- the ground's shape under the feet ----
     Taken from the same height function the camera and the foot IK
     use, so there is one definition of where the ground is and they
     cannot disagree about it. */
  var gyx0=W.groundAt(a.pos[0]-SLOPE_EPS,a.pos[2]);
  var gyx1=W.groundAt(a.pos[0]+SLOPE_EPS,a.pos[2]);
  var gyz0=W.groundAt(a.pos[0],a.pos[2]-SLOPE_EPS);
  var gyz1=W.groundAt(a.pos[0],a.pos[2]+SLOPE_EPS);
  var gx=(gyx1-gyx0)/(2*SLOPE_EPS), gz=(gyz1-gyz0)/(2*SLOPE_EPS);
  Pl.slope=1/Math.sqrt(gx*gx+gz*gz+1);
  Pl.slide=Pl.grounded&&!Pl.flying&&!Pl.swimming
    ? M.clamp((SLOPE_STAND-Pl.slope)/0.26,0,1) : 0;

  var top=Pl.swimming?SWIM:((I.run?RUN:WALK));
  /* Wading is not swimming. Between ankle and chest the water takes
     about half your speed and none of your control, and having no
     state in between made the shoreline read as a switch. */
  if(!Pl.swimming&&Pl.inWater)top*=WADE;
  if(!Pl.swimming&&!Pl.flying){
    /* Climbing costs speed and descending gives a little back — the
       gradient in the direction you are actually asking to go, not the
       steepness of the hill in general. */
    var climb=_want[0]*gx+_want[2]*gz;
    top*=M.clamp(1-climb*0.34,0.52,1.14);
  }
  var targetX=_want[0]*top*wl, targetZ=_want[2]*top*wl;
  /* You cannot run in a direction you are not facing yet. Scaling the
     target speed by how far the body still has to turn is what gives
     the turn clip somewhere to happen — without it a reversal reaches
     walking speed in two frames and the character is fired backwards
     out of a cannon while still facing forwards. */
  if(wl>0.01&&Pl.grounded&&!Pl.flying&&!Pl.swimming){
    var mis=Math.abs(M.angDelta(a.facing,Math.atan2(_want[0],_want[2])));
    var align=1-M.clamp((mis-0.50)/1.30,0,1)*0.82;
    targetX*=align;targetZ*=align;
  }

  var acc=Pl.grounded?ACCEL:AIRACCEL;
  if(Pl.swimming)acc=10;
  /* On ground too steep to stand on, control fades out and gravity
     takes over along the fall line. */
  if(Pl.slide>0.01){
    acc*=1-Pl.slide*0.85;
    var dl=Math.hypot(gx,gz)||1;
    Pl.vel[0]-=gx/dl*SLIDE_ACC*Pl.slide*dt;
    Pl.vel[2]-=gz/dl*SLIDE_ACC*Pl.slide*dt;
  }
  Pl.vel[0]+=(targetX-Pl.vel[0])*Math.min(1,acc*dt);
  Pl.vel[2]+=(targetZ-Pl.vel[2])*Math.min(1,acc*dt);
  if(wl<0.01&&Pl.grounded){
    var f=Math.min(1,FRICTION*dt);
    Pl.vel[0]-=Pl.vel[0]*f;Pl.vel[2]-=Pl.vel[2]*f;
  }

  /* ---- vertical ---- */
  if(Pl.flying){
    var lift=0;
    if(LH.Input.down('jump'))lift+=1;
    if(LH.Input.down('crouch'))lift-=1;
    if(Pl._nudge>0){Pl._nudge-=dt;}
    else if(lift)Pl.vel[1]+=(lift*FLY-Pl.vel[1])*Math.min(1,10*dt);
    else Pl.vel[1]-=Pl.vel[1]*Math.min(1,8*dt);
    /* horizontal flight is faster than running and ignores friction */
    var ftx=_want[0]*FLY*wl, ftz=_want[2]*FLY*wl;
    Pl.vel[0]+=(ftx-Pl.vel[0])*Math.min(1,9*dt);
    Pl.vel[2]+=(ftz-Pl.vel[2])*Math.min(1,9*dt);
  }else if(Pl.swimming){
    /* buoyancy pulls you to the surface unless you hold jump to climb
       out or crouch to dive */
    var depth=(seaY-0.9)-feet;
    var buoy=M.clamp(depth*6,-3,4.5);
    if(I.down('jump'))buoy+=4.0;
    if(I.down('crouch'))buoy-=6.0;
    Pl.vel[1]+=(buoy-Pl.vel[1])*Math.min(1,7*dt);
  }else{
    /* Variable height: releasing the button early cuts the rise, so a
       tap is a hop and a hold is a jump. Both from one impulse. */
    if(Pl.rising){
      if(!I.down('jump')){
        if(Pl.vel[1]>0)Pl.vel[1]*=JUMP_CUT;
        Pl.rising=false;
      }else if(Pl.vel[1]<=0)Pl.rising=false;
    }
    Pl.vel[1]+=GRAVITY*dt;

    Pl.coyote=Pl.grounded?COYOTE:Math.max(0,Pl.coyote-dt);
    Pl.jumpBuf=I.pressed('jump')?JUMPBUF:Math.max(0,Pl.jumpBuf-dt);
    if(Pl.jumpBuf>0&&Pl.coyote>0){
      Pl.vel[1]=JUMP;Pl.grounded=false;
      Pl.coyote=0;Pl.jumpBuf=0;Pl.rising=true;
      a.anim.play('jump');
      LH.Audio&&LH.Audio.play('jump');
    }
  }

  /* ---- integrate, then resolve ---- */
  a.pos[0]+=Pl.vel[0]*dt;
  a.pos[2]+=Pl.vel[2]*dt;
  a.pos[1]+=Pl.vel[1]*dt;
  if(Pl.flying){
    /* flight still refuses to go through the ground or out of the sky */
    var floor=W.groundAt(a.pos[0],a.pos[2])+0.1;
    if(a.pos[1]<floor){a.pos[1]=floor;if(Pl.vel[1]<0)Pl.vel[1]=0;}
    if(a.pos[1]>120){a.pos[1]=120;if(Pl.vel[1]>0)Pl.vel[1]=0;}
  }

  /* keep inside the island's bounds */
  var lim=T.HALF-2;
  a.pos[0]=M.clamp(a.pos[0],-lim,lim);
  a.pos[2]=M.clamp(a.pos[2],-lim,lim);

  W.resolve(a.pos,Pl.radius,a.pos[1]);
  resolveVoxels(a.pos);

  var ground=W.groundAt(a.pos[0],a.pos[2]);
  ground=Math.max(ground,voxelFloor(a.pos[0],a.pos[1],a.pos[2]));
  if(Pl.flying){
    Pl.grounded=false;
  }else if(a.pos[1]<=ground+0.001){
    /* Landing. The impact animation only fires from a real fall, not
       from walking down a kerb. */
    if(!Pl.grounded){
      /* Squash scales with the impact and drives both the character's
         compression and the camera's dip, so a long fall lands heavier
         than a hop off a kerb without either being a separate case. */
      var impact=M.clamp((-Pl.vel[1]-2.0)/12.0,0,1);
      if(impact>0.02){
        Pl.squash=Math.max(Pl.squash,impact);
        Cam.dip(impact);
      }
      if(-Pl.vel[1]>6.5){
        a.anim.play('land');
        Cam.shake(M.clamp(-Pl.vel[1]*0.014,0,0.22),0.22);
        LH.Audio&&LH.Audio.play('land');
      }
    }
    a.pos[1]=ground;
    if(Pl.vel[1]<0)Pl.vel[1]=0;
    Pl.grounded=true;
  }else{
    /* Step up: if the ground just ahead is only a little higher, lift
       onto it rather than colliding with it. Without this every kerb
       in the harbour is a wall. */
    if(Pl.grounded&&ground-a.pos[1]<MAX_STEP&&ground>a.pos[1]){
      a.pos[1]=ground;
    }else{
      Pl.grounded=(a.pos[1]-ground)<0.06;
      if(!Pl.grounded&&a.pos[1]>ground)Pl.grounded=false;
    }
  }
  if(a.pos[1]<ground){a.pos[1]=ground;Pl.grounded=true;if(Pl.vel[1]<0)Pl.vel[1]=0;}

  /* Squash relaxes on a spring rather than a ramp: the overshoot back
     past neutral is the part that reads as weight. */
  Pl.squash=Math.max(0,Pl.squash-dt*4.2);
  Pl.airTime=Pl.grounded?0:Pl.airTime+dt;
  a.squash=Pl.squash;

  /* ---- facing ---- */
  var speed=Math.hypot(Pl.vel[0],Pl.vel[2]);
  if(Pl.dressing&&speed<0.35){
    /* Three quarters on to the camera, not square: dead-on flattens a
       face and hides the silhouette of everything on the shoulders,
       which is most of what a wardrobe is for. */
    a.faceToward(Cam.yaw+0.42,dt,4.5);
  }else if(speed>0.35&&!Pl.aiming){
    a.faceToward(Math.atan2(Pl.vel[0],Pl.vel[2]),dt,14);
  }else if(Pl.aiming){
    a.faceToward(Cam.yaw+Math.PI,dt,20);
  }else if(wl>0.10){
    /* Standing, but asking to go somewhere behind us. Turning here —
       slowly, before the first step lands — is what lets the turn clip
       have something to do; without it the facing snapped the instant
       the character crossed the speed threshold. */
    a.faceToward(Math.atan2(_want[0],_want[2]),dt,5.5);
  }

  /* ---- animation ---- */
  var st=a.anim.state;
  /* A looping emote holds until you do something else. Dancing through
     a walk cycle, or staying seated while swimming, reads as a bug the
     first time anyone sees it. */
  var emoting=LH.Rig.EMOTES.indexOf(st)>=0;
  if(emoting&&(speed>0.35||!Pl.grounded||Pl.swimming)){
    a.anim.play('idle');emoting=false;st='idle';
  }
  var busy=(st==='mine'||st==='build'||st==='attack'||st==='hurt'||
            st==='fishCast'||st==='fishWait'||st==='fishReel'||emoting);
  if(!busy){
    if(Pl.flying){
      /* the fall clip reads as hovering once gravity is off */
      a.anim.play(speed>1.2?'fall':'tread');
    }else if(Pl.swimming){
      a.anim.play(speed>0.8?'swim':'tread');
    }else if(!Pl.grounded){
      if(Pl.vel[1]<-1.5&&st!=='jump')a.anim.play('fall');
    }else if(speed>0.35){
      /* Stopping out of a run. The trigger is the moment the input
         goes and the body is still fast, not the moment the body is
         finally slow — by then the plant has nothing left to absorb.
         `peak` decays rather than being sampled, so a stumble through
         a slow patch does not count as a stop. */
      if(wl<0.06&&speed<3.4&&Pl.peak>4.4&&Pl.grounded){
        a.anim.play('stop');
        Cam.dip(0.09);
        Pl.peak=0;
      }else a.anim.play('locomote');
      /* speed drives the clip's amplitude and its playback rate, so a
         run is not just a fast walk */
      a.anim.params.speed=M.clamp((speed-WALK*0.55)/(RUN-WALK*0.55),0,1);
      var st2=LH.Rig.STATES.locomote;
      st2.period=M.lerp(0.86,0.52,a.anim.params.speed);
    }else{
      /* Standing. Three ways to stand: coming to a halt out of a run,
         turning on the spot, and actually standing. */
      var turnErr=M.angDelta(a.facing,a.wantFacing);
      if(wl>0.10&&Math.abs(turnErr)>0.40){
        a.anim.params.turn=turnErr>0?1:-1;
        a.anim.play('turn');
      }else if(st!=='stop'||a.anim.done){
        a.anim.play('idle');
      }
    }
  }
  /* Half-life of about a third of a second, so `peak` remembers a run
     across the handful of frames a stop takes and forgets it after. */
  Pl.peak=Math.max(speed,Pl.peak*Math.pow(0.5,dt/0.34));
  Pl.lastSpeed=speed;
  a.grounded=Pl.grounded;
};

/* The ground the player is standing on, for footstep audio and for
   the "you cannot build here" checks. */
Pl.surfaceMat=function(){
  var a=Pl.actor;if(!a)return 0;
  var i=Math.round((a.pos[0]+T.HALF)),j=Math.round((a.pos[2]+T.HALF));
  i=M.clamp(i,0,T.N-1);j=M.clamp(j,0,T.N-1);
  return T.mats[j*T.N+i];
};

/* ---- the dressing room ----
   Opening the wardrobe turns the character round and brings the boom
   in. It is the same camera, given a different set of numbers and a
   note of the ones it had, because a second camera would be a second
   thing to keep in sync with collision, shake and the terrain.

   Restoring on close rather than snapping is deliberate: the pull
   back out is how you know the panel closed. */
Pl.dressing=false;
var dressSave=null;
Pl.dress=function(on){
  on=!!on;
  if(on===Pl.dressing)return;
  Pl.dressing=on;
  if(on){
    dressSave={pitch:Cam.pitch,dist:Cam.wantDist,
               shoulder:Cam.shoulder,height:Cam.height};
    Cam.pitch=0.07;
    Cam.wantDist=2.9;
    Cam.shoulder=0.10;
    Cam.height=0.98;
  }else if(dressSave){
    Cam.pitch=dressSave.pitch;
    Cam.wantDist=dressSave.dist;
    Cam.shoulder=dressSave.shoulder;
    Cam.height=dressSave.height;
    dressSave=null;
  }
};

LH.Player=Pl;
})();


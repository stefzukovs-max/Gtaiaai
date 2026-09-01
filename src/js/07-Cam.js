/* ============================================================
   LH.Cam — third-person camera.

   Orbits a follow point, collides with the world so it never clips
   into terrain, and eases rather than snapping. Shared by mouse,
   touch and gamepad through LH.Input.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,Cam={};

Cam.target=M.v3(0,1.6,0);      /* where the camera looks */
Cam.focus=M.v3(0,1.6,0);       /* smoothed follow point */
Cam.eye=M.v3(0,4,8);
Cam.yaw=0;
Cam.pitch=0.30;
Cam.dist=6.2;
Cam.wantDist=6.2;
Cam.minDist=1.6;
Cam.maxDist=13;
Cam.fov=M.rad(58);
Cam.near=0.12;
Cam.far=520;
Cam.height=1.36;               /* shoulder height above the follow point */
Cam.shoulder=0.55;             /* lateral offset — over-the-shoulder framing */
Cam.sensitivity=1.0;
/* On a phone the left thumb walks and the right thumb turns, and asking
   for both at once to go anywhere is what makes touch third-person feel
   like work. So when you are moving and not actively turning, the camera
   drifts round behind you by itself — slowly enough that it reads as the
   camera following rather than the camera taking over, and it gives up
   the moment a thumb touches the right of the screen. */
Cam.autoAlign=0;          /* 0 off, 1 full. Set from Device on boot. */
Cam.alignRate=1.5;        /* radians per second at full lean */
Cam.alignDelay=0.45;      /* quiet seconds before it starts helping */
var _sinceLook=9;
Cam.invertY=false;
Cam.firstPerson=false;
Cam.collide=true;
Cam.manual=false;
Cam.heading=null;         /* where the player is walking, or null */

Cam.view=M.m4();
Cam.proj=M.m4();

var PITCH_MIN=M.rad(-72),PITCH_MAX=M.rad(74);
var _shakeT=0,_shakeAmp=0;
Cam.shake=function(amp,dur){_shakeAmp=Math.max(_shakeAmp,amp);_shakeT=Math.max(_shakeT,dur||0.25);};
/* A dip is not a shake. Shake is noise and says "something hit you";
   dip is a single signed motion and says "you hit the ground". Landing
   wants the second, and getting them confused is why so many jumps
   feel like being punched. */
var _dip=0,_dipV=0;
Cam.dip=function(amount){_dipV-=Math.min(0.85,amount)*3.4;};

Cam.orbit=function(dx,dy){
  _sinceLook=0;
  var s=Cam.sensitivity*0.0032;
  Cam.yaw-=dx*s;
  Cam.pitch+=(Cam.invertY?-dy:dy)*s;
  Cam.pitch=M.clamp(Cam.pitch,PITCH_MIN,PITCH_MAX);
  if(Cam.yaw>Math.PI)Cam.yaw-=M.TAU;
  if(Cam.yaw<-Math.PI)Cam.yaw+=M.TAU;
};
Cam.zoom=function(d){
  Cam.wantDist=M.clamp(Cam.wantDist+d,Cam.minDist,Cam.maxDist);
};

var _want=M.v3(),_dir=M.v3(),_right=M.v3(),_up=M.v3(0,1,0),_tmp=M.v3();

/* `solid(x,y,z)` is supplied by the world: returns true if that point is
   inside geometry. The camera walks the ray back toward the player and
   stops short of the first blocked sample, which is cheaper and steadier
   than a true swept sphere and is indistinguishable in play. */
Cam.update=function(dt,followPos,solid){
  /* Manual mode: eye and target are whatever the caller set. Used by
     cinematics and by the screenshot harness, which needs to frame a
     shot rather than orbit whoever happens to be standing there. */
  if(Cam.manual){
    M.lookAt(Cam.view,Cam.eye,Cam.target,_up);
    M.perspective(Cam.proj,Cam.fov,LH.App.aspect||1.777,Cam.near,Cam.far);
    LH.Render.setCamera(Cam.view,Cam.proj,Cam.eye);
    return;
  }
  _sinceLook+=dt;
  M.lerp3(Cam.focus,Cam.focus,followPos,1-Math.pow(0.0008,dt));
  /* Critically-ish damped spring back to level. Stiff enough to settle
     inside a third of a second, soft enough to be felt. */
  _dipV+=(-_dip*46-_dipV*9.5)*dt;
  _dip+=_dipV*dt;
  if(Math.abs(_dip)<0.0004&&Math.abs(_dipV)<0.004){_dip=0;_dipV=0;}
  M.set3(Cam.target,Cam.focus[0],Cam.focus[1]+Cam.height+_dip,Cam.focus[2]);

  /* Swing toward where the player is actually heading. `Cam.headingOf`
     is set by the game each frame when the player is moving under their
     own power; when it is null there is nothing to align to. */
  if(Cam.autoAlign>0&&Cam.heading!==null&&Cam.heading!==undefined&&
     _sinceLook>Cam.alignDelay){
    var want=Cam.heading;
    var d=M.angDelta(Cam.yaw,want);
    /* Ease in over the first half-second of quiet so it never snaps,
       and scale by how far off it is so small corrections stay gentle. */
    var ramp=M.clamp((_sinceLook-Cam.alignDelay)/0.6,0,1);
    var lean=M.clamp(Math.abs(d)/Math.PI,0,1);
    var step=d*M.clamp(Cam.alignRate*Cam.autoAlign*ramp*(0.35+lean)*dt,0,1);
    Cam.yaw+=step;
  }
  var cp=Math.cos(Cam.pitch),sp=Math.sin(Cam.pitch);
  M.set3(_dir,Math.sin(Cam.yaw)*cp,sp,Math.cos(Cam.yaw)*cp);
  M.norm3(_dir,_dir);
  M.cross3(_right,_dir,_up);M.norm3(_right,_right);

  Cam.dist=M.damp(Cam.dist,Cam.wantDist,0.22,dt);

  var d=Cam.dist;
  /* Collision can be switched off for cinematics and for framing
     screenshots, where the boom pulling in is a nuisance rather than
     a feature. */
  if(solid&&Cam.collide!==false){
    /* march out from the head; the first blocked sample caps the boom */
    var steps=14,hit=d;
    for(var i=1;i<=steps;i++){
      var t=d*(i/steps);
      var px=Cam.target[0]+_dir[0]*t+_right[0]*Cam.shoulder*0.4;
      var py=Cam.target[1]+_dir[1]*t;
      var pz=Cam.target[2]+_dir[2]*t+_right[2]*Cam.shoulder*0.4;
      if(solid(px,py,pz)){hit=Math.max(Cam.minDist*0.5,d*((i-1)/steps)-0.22);break;}
    }
    /* pull in fast so the camera never ends up inside a wall, ease back
       out slowly so a doorway does not fling the view */
    if(hit<d)d=hit;
    else d=M.damp(Cam._lastD===undefined?d:Cam._lastD,d,0.12,dt);
    Cam._lastD=d;
  }

  if(Cam.firstPerson){
    M.copy3(Cam.eye,Cam.target);
    M.addScaled3(Cam.eye,Cam.eye,_dir,-0.05);
    M.addScaled3(Cam.target,Cam.eye,_dir,-4);
  }else{
    M.addScaled3(Cam.eye,Cam.target,_dir,d);
    /* Shoulder offset scales down as the boom shortens, so a camera
       pressed against a wall doesn't sit inside the character's ear. */
    var sh=Cam.shoulder*M.clamp(d/Cam.wantDist,0,1);
    M.addScaled3(Cam.eye,Cam.eye,_right,sh);
    M.addScaled3(Cam.target,Cam.target,_right,sh*0.6);
  }

  if(_shakeT>0){
    _shakeT-=dt;
    var amp=_shakeAmp*M.clamp(_shakeT/0.25,0,1);
    Cam.eye[0]+=(Math.random()-0.5)*amp;
    Cam.eye[1]+=(Math.random()-0.5)*amp;
    Cam.eye[2]+=(Math.random()-0.5)*amp;
    if(_shakeT<=0)_shakeAmp=0;
  }

  M.lookAt(Cam.view,Cam.eye,Cam.target,_up);
  M.perspective(Cam.proj,Cam.fov,LH.App.aspect||1.777,Cam.near,Cam.far);
  LH.Render.setCamera(Cam.view,Cam.proj,Cam.eye);
};

/* Movement is relative to where the camera is looking, so these two
   vectors are what the player controller steers by. */
Cam.forward=function(out){
  out[0]=-Math.sin(Cam.yaw);out[1]=0;out[2]=-Math.cos(Cam.yaw);
  return M.norm3(out,out);
};
Cam.rightVec=function(out){
  out[0]=Math.cos(Cam.yaw);out[1]=0;out[2]=-Math.sin(Cam.yaw);
  return M.norm3(out,out);
};

/* Screen ray, for click-to-place and click-to-target. */
var _n=M.v3(),_f=M.v3(),_iv=M.m4();
Cam.ray=function(sx,sy,outO,outD){
  var ndcX=sx*2-1,ndcY=1-sy*2;
  M.mul(_iv,Cam.proj,Cam.view);
  M.invert(_iv,_iv);
  M.set3(_n,ndcX,ndcY,-1);M.xformPoint(_n,_iv,_n);
  M.set3(_f,ndcX,ndcY,1);M.xformPoint(_f,_iv,_f);
  M.copy3(outO,_n);
  M.norm3(outD,M.sub3(outD,_f,_n));
  return outD;
};

LH.Cam=Cam;
})();



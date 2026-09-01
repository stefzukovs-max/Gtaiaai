/* ============================================================
   LH.App — device setup, the frame loop, and the boot sequence.

   Everything above this point is engine. Everything below is game.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,GL=LH.GL,R=LH.Render,App={};

App.canvas=null;
App.w=0;App.h=0;App.dpr=1;
App.time=0;App.dt=0;App.frame=0;
App.paused=false;
var _last=0,_acc=0,_fpsT=0,_fpsN=0;
App.fps=60;

/* Update hooks run before the draw, draw hooks during it. Systems
   register themselves rather than the loop knowing about them, so
   adding fishing later does not mean editing the frame loop. */
var updaters=[],drawers=[];
App.onUpdate=function(fn,order){updaters.push({fn:fn,o:order||0});
  updaters.sort(function(a,b){return a.o-b.o;});};
App.onDraw=function(fn,order){drawers.push({fn:fn,o:order||0});
  drawers.sort(function(a,b){return a.o-b.o;});};

/* The rotate hint is a suggestion now, not a gate — dismissing it
   remembers the answer for the session, and portrait reflows rather
   than refusing to draw. */
var rotateHidden=false;

App.resize=function(){
  var cv=App.canvas;
  var r=cv.getBoundingClientRect();
  /* The pixel budget is the device's, not the display's. LH.Device caps
     a phone well under its true DPR: at DPR 3 a phone asks for nine
     times the pixels of DPR 1 for a difference nobody can see at arm's
     length, and pays for all nine in heat and battery. */
  var Dv=LH.Device;
  var dpr=Math.min(window.devicePixelRatio||1,(Dv&&Dv.maxDPR)||2);
  var w=Math.max(2,Math.round(r.width*dpr)),h=Math.max(2,Math.round(r.height*dpr));
  var portrait=r.height>r.width*1.02;
  if(Dv&&portrait!==Dv.portrait){Dv.portrait=portrait;Dv.apply();}
  var rot=document.getElementById('rotate');
  if(rot)rot.style.display=(portrait&&!rotateHidden&&!(Dv&&Dv.mobile))?'flex':'none';
  if(w===App.w&&h===App.h)return;
  cv.width=w;cv.height=h;
  App.w=w;App.h=h;App.dpr=dpr;
  App.aspect=w/h;
  R.resize(w,h);
};
App.dismissRotate=function(){
  rotateHidden=true;
  var rot=document.getElementById('rotate');
  if(rot)rot.style.display='none';
};

function frame(t){
  requestAnimationFrame(frame);
  if(!_last)_last=t;
  var dt=(t-_last)/1000;_last=t;
  /* Clamp: a backgrounded tab returns with a multi-second delta and
     every integrator in the game would explode on it. */
  if(dt>0.1)dt=0.1;
  App.dt=dt;App.time+=dt;App.frame++;

  _fpsN++;_fpsT+=dt;
  if(_fpsT>=0.5){App.fps=_fpsN/_fpsT;_fpsN=0;_fpsT=0;}

  App.resize();
  if(App.paused)return;

  R.time=App.time;
  /* Measured, not guessed: hold the frame budget by moving the internal
     resolution, and only give up effects once that has bottomed out. */
  if(R.autoTick)R.autoTick(dt);
  GL.resetStats();

  for(var i=0;i<updaters.length;i++)updaters[i].fn(dt,App.time);
  for(var j=0;j<drawers.length;j++)drawers[j].fn(dt,App.time);
}

App.start=function(){
  /* Before anything is measured or drawn: decide what we are running
     on, so the HUD builds itself for the right hands and the renderer
     sizes itself to the right budget. */
  if(LH.Device)LH.Device.init();
  var cv=App.canvas=document.getElementById('gl');
  var ctx=GL.init(cv);
  if(!ctx){
    document.getElementById('boottip').innerHTML=
      'This browser has no WebGL2. Lumen Harbor needs it to draw the world.';
    return false;
  }
  R.init(cv);
  /* A phone gets the light path by default and can be talked up to the
     full one in Settings; a desktop gets everything. */
  /* The tier the device looks like it can hold is a starting guess and
     a ceiling; from here the frame time decides. On a desktop it is left
     alone — a machine with a fan does not need managing, and a scaler
     that moves under a mouse is just blur nobody asked for. */
  var Dv=LH.Device;
  R.tierCeiling=Dv?Dv.tier:3;
  R.applyTier(R.tierCeiling);
  R.auto.on=!!(Dv&&Dv.mobile);
  R.auto.target=60;
  App.resize();
  requestAnimationFrame(frame);
  return true;
};

/* ---------------- boot sequence ----------------
   Generating every texture and mesh takes a beat, so the work is
   sliced across frames with the progress bar showing real stages
   rather than a fake timer. */
var stages=[];
App.stage=function(label,fn){stages.push({label:label,fn:fn});};

App.runBoot=function(done){
  var fill=document.getElementById('bootfill');
  var tip=document.getElementById('boottip');
  var i=0;
  function step(){
    if(i>=stages.length){
      fill.style.width='100%';
      tip.textContent='Ready';
      setTimeout(function(){
        var b=document.getElementById('boot');
        b.classList.add('gone');
        setTimeout(function(){b.style.display='none';},760);
        done&&done();
      },260);
      return;
    }
    var s=stages[i];
    tip.textContent=s.label;
    fill.style.width=Math.round(i/stages.length*100)+'%';
    /* two frames per stage: one to paint the label, one to do the work,
       so the bar never lies about what it is currently doing */
    requestAnimationFrame(function(){requestAnimationFrame(function(){
      try{s.fn();}catch(e){
        tip.innerHTML='<span style="color:#FF5A6E">'+
          (s.label+' failed: '+(e&&e.message||e))+'</span>';
        console.error(e);
        return;
      }
      i++;step();
    });});
  }
  step();
};

LH.App=App;
})();


/* ============================================================
   LH.Input — one abstraction over keyboard, mouse, touch and pad.

   Nothing downstream asks "is this a phone". The controller reads
   move.x/move.y, look.x/look.y and a set of named actions, and the
   device layer is responsible for filling them. That is the only way
   the same gameplay code survives four input methods.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,I={};

I.move={x:0,y:0};      /* -1..1, camera-relative */
I.look={x:0,y:0};      /* delta this frame, in pixels */
I.zoom=0;
I.run=false;
I.actions={};          /* edge-triggered, cleared each frame */
I.held={};             /* level-triggered */
I.pointer={x:0.5,y:0.5,down:false};
I.lastKind='kb';       /* kb | touch | pad */

var keys={};
var BIND={
  KeyW:'fwd',KeyS:'back',KeyA:'left',KeyD:'right',
  ArrowUp:'fwd',ArrowDown:'back',ArrowLeft:'left',ArrowRight:'right',
  Space:'jump',ShiftLeft:'run',ShiftRight:'run',
  KeyE:'interact',
  KeyZ:'tool',KeyC:'crouch',
  KeyX:'fly',KeyR:'rotate',
  Digit1:'slot1',Digit2:'slot2',Digit3:'slot3',Digit4:'slot4',Digit5:'slot5',
  Digit6:'slot6',Digit7:'slot7',Digit8:'slot8',Digit9:'slot9',Digit0:'slot0',
  Tab:'inventory',KeyI:'inventory',KeyM:'map',
  KeyQ:'missions',KeyJ:'missions',
  KeyF:'profile',KeyP:'profile',
  KeyT:'trade',Enter:'chat',
  KeyB:'build',KeyG:'worlds',KeyK:'craft',KeyO:'wardrobe',
  Escape:'menu',KeyV:'emote',KeyH:'help'
};
I.BIND=BIND;

function fire(name){I.actions[name]=true;}

I.attach=function(el){
  window.addEventListener('keydown',function(e){
    /* Browsers refuse to start audio without a gesture, so the first
       real key or click is where the context comes up. */
    if(LH.Audio)LH.Audio.unlock();
    if(e.repeat)return;
    var b=BIND[e.code];
    if(!b)return;
    /* Never swallow the browser's own shortcuts while a text field is
       focused — chat has to be able to contain the letter W. */
    if(document.activeElement&&/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName))return;
    keys[b]=true;I.held[b]=true;fire(b);
    I.lastKind='kb';
    if(b!=='menu')e.preventDefault();
  });
  window.addEventListener('keyup',function(e){
    var b=BIND[e.code];if(!b)return;
    keys[b]=false;I.held[b]=false;
  });
  window.addEventListener('blur',function(){
    for(var k in keys)keys[k]=false;
    for(var h in I.held)I.held[h]=false;
  });

  /* Mouse look is pointer-lock when the player asks for it, and
     drag-to-look otherwise. Both write into the same look delta. */
  var dragging=false,lastX=0,lastY=0;
  el.addEventListener('mousedown',function(e){
    if(LH.Audio)LH.Audio.unlock();
    I.lastKind='kb';
    I.pointer.down=true;
    I.pointer.x=e.clientX/window.innerWidth;
    I.pointer.y=e.clientY/window.innerHeight;
    if(e.button===2||I.locked){dragging=true;lastX=e.clientX;lastY=e.clientY;}
    else fire('primary');
    if(e.button===2)e.preventDefault();
  });
  window.addEventListener('mouseup',function(e){
    I.pointer.down=false;dragging=false;
    if(e.button===2)fire('secondaryUp');
  });
  window.addEventListener('mousemove',function(e){
    I.pointer.x=e.clientX/window.innerWidth;
    I.pointer.y=e.clientY/window.innerHeight;
    if(I.locked){I.look.x+=e.movementX||0;I.look.y+=e.movementY||0;return;}
    if(dragging){I.look.x+=e.clientX-lastX;I.look.y+=e.clientY-lastY;
      lastX=e.clientX;lastY=e.clientY;}
  });
  el.addEventListener('contextmenu',function(e){e.preventDefault();});
  el.addEventListener('wheel',function(e){
    I.zoom+=Math.sign(e.deltaY)*0.9;e.preventDefault();
  },{passive:false});
  document.addEventListener('pointerlockchange',function(){
    I.locked=document.pointerLockElement===el;
  });
  I.requestLock=function(){el.requestPointerLock&&el.requestPointerLock();};
  I.releaseLock=function(){document.exitPointerLock&&document.exitPointerLock();};

  /* Touch: the left third is a walk stick, the rest is look. Both are
     tracked by pointer id so two thumbs never interfere.

     The first version of this read the raw offset from where the thumb
     landed, divided by a radius, and passed it straight through. That
     walks, but it does not feel like anything: there is no dead zone, so
     a thumb resting on the glass drifts; the response is linear, so
     lining a jump up is as coarse as sprinting; the origin is pinned to
     the touch-down point, so a long turn runs into the edge of the ring
     and stops; and the run threshold has no hysteresis, so holding near
     it flickers between walking and running several times a second. */
  var stickId=null,stickOX=0,stickOY=0,stickDX=0,stickDY=0;
  var lookId=null,lookX=0,lookY=0;
  var pinch=null,pinchWas=0;
  var lookVX=0,lookVY=0;             /* glide after the thumb leaves */
  I.stick={active:false,ox:0,oy:0,x:0,y:0,mag:0};
  I.stickDead=0.12;                  /* of the ring, ignored entirely */
  I.lookSens=1.0;

  function ring(){return Math.min(96,Math.max(58,window.innerHeight*0.17));}

  function aim(dx,dy){
    var R=ring(),d=Math.hypot(dx,dy);
    /* Past the ring the origin follows the thumb rather than clamping,
       so the stick never runs out of travel in the middle of a turn.
       Push further and it keeps giving, which is what a stick does. */
    if(d>R){
      var pull=(d-R)/d;
      stickOX+=dx*pull;stickOY+=dy*pull;
      dx-=dx*pull;dy-=dy*pull;d=R;
    }
    stickDX=dx;stickDY=dy;
    var t=d/R;
    t=t<I.stickDead?0:(t-I.stickDead)/(1-I.stickDead);
    /* Fine at the bottom where you are placing a block, full at the top.
       Linear gives you neither end well. */
    var m=t*(0.30+0.70*t);
    if(d>0.0001){I.move.x=(dx/d)*m;I.move.y=-(dy/d)*m;}
    else{I.move.x=0;I.move.y=0;}
    I.stick.mag=m;
    /* Hysteresis, or holding near the line flickers. */
    if(t>0.88)I.run=true;else if(t<0.72)I.run=false;
    I.stick.ox=stickOX;I.stick.oy=stickOY;
    I.stick.x=stickOX+dx;I.stick.y=stickOY+dy;
  }

  /* A swipe across the screen should turn the same amount on every
     phone. Raw pixels do not: the same gesture on a 390pt screen and a
     430pt one turns you different distances. */
  /* Tuned so a full swipe across the screen turns about 135 degrees:
     enough to spin round in one gesture, not so much that a small
     correction overshoots. The 900 is the reference width the constant
     was measured at; the division is what makes it the same gesture on
     a small phone and a large one. */
  var LOOK_K=0.82;
  function lookScale(){return 900/Math.max(320,window.innerWidth);}

  el.addEventListener('touchstart',function(e){
    I.lastKind='touch';
    for(var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      if(t.clientX<window.innerWidth*0.42&&stickId===null){
        stickId=t.identifier;stickOX=t.clientX;stickOY=t.clientY;
        stickDX=0;stickDY=0;
        I.stick.active=true;I.stick.ox=stickOX;I.stick.oy=stickOY;
        I.stick.x=stickOX;I.stick.y=stickOY;I.stick.mag=0;
      }else if(lookId===null){
        lookId=t.identifier;lookX=t.clientX;lookY=t.clientY;
        lookVX=0;lookVY=0;           /* a new touch stops the glide */
      }else if(pinch===null&&t.identifier!==stickId){
        pinch=t.identifier;
        var a=lookX-t.clientX,b=lookY-t.clientY;
        pinchWas=Math.hypot(a,b);
      }
    }
    e.preventDefault();
  },{passive:false});

  el.addEventListener('touchmove',function(e){
    var px=null,py=null;
    for(var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      if(t.identifier===stickId){
        aim(t.clientX-stickOX,t.clientY-stickOY);
      }else if(t.identifier===lookId){
        var k=lookScale()*I.lookSens*LOOK_K;
        var dx=(t.clientX-lookX)*k,dy=(t.clientY-lookY)*k;
        if(pinch===null){
          I.look.x+=dx;I.look.y+=dy;
          /* remember the speed so a flick keeps gliding when it ends */
          lookVX=lookVX*0.65+dx*0.35;lookVY=lookVY*0.65+dy*0.35;
        }
        lookX=t.clientX;lookY=t.clientY;
      }else if(t.identifier===pinch){px=t.clientX;py=t.clientY;}
    }
    /* Two thumbs on the right pull the camera in and out. */
    if(pinch!==null&&px!==null){
      var d=Math.hypot(lookX-px,lookY-py);
      if(pinchWas)I.zoom+=(pinchWas-d)*0.016;
      pinchWas=d;
    }
    e.preventDefault();
  },{passive:false});

  function endTouch(e){
    for(var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      if(t.identifier===stickId){
        stickId=null;I.move.x=0;I.move.y=0;I.run=false;
        I.stick.active=false;I.stick.mag=0;
      }else if(t.identifier===lookId){lookId=null;pinch=null;}
      else if(t.identifier===pinch){pinch=null;pinchWas=0;}
    }
  }
  el.addEventListener('touchend',endTouch);
  el.addEventListener('touchcancel',endTouch);

  /* The glide. A camera that stops dead the instant a thumb lifts feels
     nailed down; one that coasts a little and settles feels held. */
  I.lookGlide=function(){
    if(lookId!==null)return;
    if(Math.abs(lookVX)<0.02&&Math.abs(lookVY)<0.02){lookVX=0;lookVY=0;return;}
    I.look.x+=lookVX;I.look.y+=lookVY;
    lookVX*=0.86;lookVY*=0.86;
  };
};

/* Gamepad is polled, not evented, so it is read at the top of the
   frame alongside everything else. */
function pollPad(){
  if(!navigator.getGamepads)return;
  var pads=navigator.getGamepads();
  for(var i=0;i<pads.length;i++){
    var p=pads[i];
    if(!p||!p.connected)continue;
    var dead=0.18;
    function ax(n){var v=p.axes[n]||0;return Math.abs(v)<dead?0:v;}
    if(ax(0)||ax(1)){I.move.x=ax(0);I.move.y=-ax(1);I.lastKind='pad';}
    if(ax(2)||ax(3)){I.look.x+=ax(2)*14;I.look.y+=ax(3)*14;I.lastKind='pad';}
    var btn=function(n){return p.buttons[n]&&p.buttons[n].pressed;};
    if(btn(0)&&!I._padA)fire('jump');I._padA=btn(0);
    if(btn(2)&&!I._padX)fire('interact');I._padX=btn(2);
    if(btn(7)&&!I._padRT)fire('primary');I._padRT=btn(7);
    if(btn(6)&&!I._padLT)fire('secondary');I._padLT=btn(6);
    if(btn(3)&&!I._padY)fire('inventory');I._padY=btn(3);
    if(btn(9)&&!I._padStart)fire('menu');I._padStart=btn(9);
    I.run=btn(10)||btn(1);
    break;
  }
}

/* Called once at the top of each frame, before anything reads input. */
I.begin=function(){
  pollPad();
  if(I.lookGlide)I.lookGlide();
  if(I.lastKind==='kb'){
    var mx=(keys.right?1:0)-(keys.left?1:0);
    var my=(keys.fwd?1:0)-(keys.back?1:0);
    var l=Math.hypot(mx,my);
    if(l>1){mx/=l;my/=l;}
    I.move.x=mx;I.move.y=my;
    I.run=!!keys.run;
  }
};
/* And once at the bottom, so an action fires for exactly one frame. */
I.end=function(){
  I.actions={};
  I.look.x=0;I.look.y=0;
  I.zoom=0;
};
/* Touch buttons write into the same action and held maps the keyboard
   uses, so nothing downstream knows which device it came from. */
I.touchAction=function(name,down){
  I.lastKind='touch';
  if(down){I.actions[name]=true;I.held[name]=true;}
  else I.held[name]=false;
};
I.pressed=function(n){return !!I.actions[n];};
I.down=function(n){return !!I.held[n];};

LH.Input=I;
})();


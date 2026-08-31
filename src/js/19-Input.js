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

  /* Touch: left half is a virtual stick, right half is look. Both are
     tracked by pointer id so two thumbs never interfere. */
  var stickId=null,stickOX=0,stickOY=0;
  var lookId=null,lookX=0,lookY=0;
  I.stick={active:false,ox:0,oy:0,x:0,y:0};
  el.addEventListener('touchstart',function(e){
    I.lastKind='touch';
    for(var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      if(t.clientX<window.innerWidth*0.42&&stickId===null){
        stickId=t.identifier;stickOX=t.clientX;stickOY=t.clientY;
        I.stick.active=true;I.stick.ox=stickOX;I.stick.oy=stickOY;
        I.stick.x=stickOX;I.stick.y=stickOY;
      }else if(lookId===null){
        lookId=t.identifier;lookX=t.clientX;lookY=t.clientY;
      }
    }
    e.preventDefault();
  },{passive:false});
  el.addEventListener('touchmove',function(e){
    for(var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      if(t.identifier===stickId){
        var dx=t.clientX-stickOX,dy=t.clientY-stickOY;
        var R=Math.min(90,window.innerHeight*0.16);
        var d=Math.hypot(dx,dy);
        if(d>R){dx*=R/d;dy*=R/d;}
        I.move.x=dx/R;I.move.y=-dy/R;
        I.run=d>R*0.82;
        I.stick.x=stickOX+dx;I.stick.y=stickOY+dy;
      }else if(t.identifier===lookId){
        I.look.x+=t.clientX-lookX;I.look.y+=t.clientY-lookY;
        lookX=t.clientX;lookY=t.clientY;
      }
    }
    e.preventDefault();
  },{passive:false});
  function endTouch(e){
    for(var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      if(t.identifier===stickId){
        stickId=null;I.move.x=0;I.move.y=0;I.run=false;I.stick.active=false;
      }else if(t.identifier===lookId)lookId=null;
    }
  }
  el.addEventListener('touchend',endTouch);
  el.addEventListener('touchcancel',endTouch);
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


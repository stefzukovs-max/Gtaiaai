/* ============================================================
   LH.Device — what we are running on, and how to get the browser
   out of the way.

   This module exists because "works on mobile" and "is a mobile game"
   are different claims. The first needs a viewport tag and bigger
   buttons. The second needs the whole interface to assume a thumb,
   the renderer to assume a phone GPU and a battery, and the page to
   stop looking like a page — no address bar, no pull-to-refresh, no
   accidental back-swipe in the middle of a fight.

   Three things are decided here and read everywhere else:

     Device.touch      there is a finger, so the controls are on screen
     Device.mobile     it is a phone or a tablet, so the HUD is the
                       mobile one and the renderer runs the light path
     Device.standalone it was launched from a home screen, so there is
                       no browser chrome to escape and nothing to offer

   Nothing here sniffs a user-agent string for a brand name. The
   questions that matter — is the pointer coarse, is there a touch
   digitiser, how many cores, how much memory, is the display already
   without a browser around it — all have direct answers.
   ============================================================ */
(function(){
'use strict';
var D={};

var mq=function(q){return window.matchMedia&&window.matchMedia(q).matches;};

D.touch=('ontouchstart' in window)||navigator.maxTouchPoints>0||mq('(pointer:coarse)');
/* A laptop with a touchscreen is not a phone. The distinguishing test
   is whether a *fine* pointer also exists — a mouse or a trackpad —
   because that is what the desktop layout is built for. */
D.mobile=D.touch&&!mq('(any-pointer:fine)');
D.standalone=mq('(display-mode:standalone)')||mq('(display-mode:fullscreen)')||
             !!window.navigator.standalone;
D.ios=/iP(hone|ad|od)/.test(navigator.platform||'')||
      (navigator.maxTouchPoints>1&&/Mac/.test(navigator.platform||''));

/* A rough performance tier, used to pick render settings rather than
   to gate features. Cores and memory are both advisory and both
   missing on Safari, so a phone with neither reported is assumed
   modest rather than assumed fast. */
D.tier=(function(){
  var cores=navigator.hardwareConcurrency||(D.mobile?4:8);
  var mem=navigator.deviceMemory||(D.mobile?3:8);
  if(!D.mobile&&cores>=8)return 3;
  if(cores>=8&&mem>=6)return 2;
  if(cores>=6&&mem>=4)return 2;
  return 1;
})();
/* How much of the screen we actually render. A phone at DPR 3 asks for
   nine times the pixels of DPR 1 for a difference nobody can see at
   arm's length, and pays for all nine in heat and battery. */
D.maxDPR=D.mobile?(D.tier>=2?1.6:1.25):2;

D.portrait=false;
D.el=null;

/* ---------------- classes ----------------
   One place decides what the CSS is allowed to assume. */
D.apply=function(){
  var a=D.el||(D.el=document.getElementById('app'));
  if(!a)return;
  a.classList.toggle('mobile',D.mobile);
  a.classList.toggle('touchdev',D.touch);
  a.classList.toggle('standalone',D.standalone);
  a.classList.toggle('portrait',D.portrait);
};

/* ---------------- fullscreen ----------------
   The browser is the thing in the way, and fullscreen is the only
   lever a web page has on it before it is installed. It must be called
   from inside a real gesture, so every caller here is a tap handler. */
D.canFullscreen=function(){
  var e=document.documentElement;
  return !!(e.requestFullscreen||e.webkitRequestFullscreen);
};
D.isFullscreen=function(){
  return !!(document.fullscreenElement||document.webkitFullscreenElement);
};
D.fullscreen=function(on){
  var e=document.documentElement;
  try{
    if(on===false||(on===undefined&&D.isFullscreen())){
      if(document.exitFullscreen)document.exitFullscreen();
      else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
      return;
    }
    var r=e.requestFullscreen||e.webkitRequestFullscreen;
    if(r){
      var p=r.call(e,{navigationUI:'hide'});
      /* Landscape is the better shape for this game, so once we own the
         screen we ask for it — and shrug if the platform says no, which
         iOS always does. */
      if(p&&p.then)p.then(D.lockLandscape,function(){});
      else D.lockLandscape();
    }
  }catch(err){}
};
D.lockLandscape=function(){
  try{
    var o=screen.orientation;
    if(o&&o.lock)o.lock('landscape').catch(function(){});
  }catch(err){}
};

/* ---------------- screen wake ----------------
   A game you play with one thumb for two minutes at a time is a game
   the screen times out in the middle of. */
var wake=null;
D.keepAwake=function(){
  if(!navigator.wakeLock)return;
  navigator.wakeLock.request('screen').then(function(s){
    wake=s;
    s.addEventListener('release',function(){wake=null;});
  }).catch(function(){});
};
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'&&!wake)D.keepAwake();
});

/* ---------------- haptics ----------------
   Short, and only for things that would have made a noise in the
   world: landing a hit, breaking a block, closing a trade. */
D.buzz=function(ms){
  if(!D.touch||!navigator.vibrate)return;
  try{navigator.vibrate(ms||12);}catch(e){}
};

/* ---------------- install ----------------
   Chromium hands us the install prompt and lets us fire it later. iOS
   does not, so there we explain the Share-sheet route instead. Either
   way the offer is made once and remembered. */
var deferred=null;
D.installable=false;
window.addEventListener('beforeinstallprompt',function(e){
  e.preventDefault();
  deferred=e;
  D.installable=true;
  if(D.onInstallable)D.onInstallable();
});
D.install=function(){
  if(deferred){
    deferred.prompt();
    deferred.userChoice.then(function(){deferred=null;D.installable=false;});
    return 'prompt';
  }
  /* No install path: take the next best thing and fill the screen. */
  if(D.canFullscreen()){D.fullscreen(true);return 'fullscreen';}
  return 'manual';
};

/* ---------------- the manifest ----------------
   The game is one HTML file on purpose, and a web app manifest has to
   be a separate resource. Rather than break that, it is built here and
   handed to the browser as a blob — same origin, so a manifest link
   accepts it — which keeps the promise that this file is the game. A
   sibling manifest.webmanifest is used instead when one is served,
   because an installed app should survive this page not running. */
D.manifest=function(){
  if(document.querySelector('link[rel="manifest"]'))return;
  if(location.protocol==='file:')return;
  var icon="data:image/svg+xml,"+encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>"+
    "<rect width='512' height='512' fill='#080B12'/>"+
    "<path d='M142 336c34-112 194-112 228 0' stroke='#4FE3B0' stroke-width='40'"+
    " fill='none' stroke-linecap='round'/>"+
    "<circle cx='256' cy='176' r='48' fill='#FFC94D'/></svg>");
  var man={
    name:'Lumen Harbor',short_name:'Lumen',
    description:'A 3D social sandbox. Build, fish, mine, dress up and trade.',
    start_url:location.pathname,scope:location.pathname,
    display:'standalone',orientation:'landscape',
    background_color:'#080B12',theme_color:'#080B12',
    icons:[{src:icon,sizes:'512x512',type:'image/svg+xml',purpose:'any maskable'}]
  };
  try{
    var url=URL.createObjectURL(new Blob([JSON.stringify(man)],
      {type:'application/manifest+json'}));
    var l=document.createElement('link');
    l.rel='manifest';l.href=url;
    document.head.appendChild(l);
  }catch(e){}
};

/* ---------------- offline ----------------
   A worker cannot be a blob — the browser insists a service worker is
   a real same-origin script — so this only runs where sw.js is served
   next to the game. It failing is not an error; it means the game
   needs the network to start, which it always did. */
D.offline=function(){
  if(!('serviceWorker' in navigator))return;
  if(location.protocol!=='http:'&&location.protocol!=='https:')return;
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('sw.js').catch(function(){});
  });
};

/* ---------------- gestures the browser eats ----------------
   Pull-to-refresh, the double-tap zoom, the pinch zoom, and the
   edge-swipe that goes back a page are all fine on a document and all
   fatal in a game. */
D.guard=function(){
  if(!D.touch)return;
  document.addEventListener('gesturestart',function(e){e.preventDefault();},
    {passive:false});
  document.addEventListener('dblclick',function(e){e.preventDefault();},
    {passive:false});
  /* Only cancel multi-finger scrolls and drags that start on the game
     surface: a panel that cannot scroll is worse than a page that can
     be pulled. */
  document.addEventListener('touchmove',function(e){
    if(e.touches.length>1){e.preventDefault();return;}
    var t=e.target;
    if(t&&t.closest&&t.closest('.body,.log,.tabs,input,textarea'))return;
    e.preventDefault();
  },{passive:false});
};

/* The viewport tag, asserted at run time as well as declared in the
   head. The game gets embedded — in the preview build, in an iframe on
   the site — and a host page's viewport is written for a document
   rather than for a game: it will allow pinch-zoom, and it will not
   run the canvas under the notch. Setting it here means the game
   carries its own answer wherever it is put. */
D.viewport=function(){
  var want='width=device-width,initial-scale=1,minimum-scale=1,'+
           'maximum-scale=1,user-scalable=no,viewport-fit=cover';
  var m=document.querySelector('meta[name="viewport"]');
  if(!m){
    m=document.createElement('meta');
    m.name='viewport';
    document.head.appendChild(m);
  }
  if(m.getAttribute('content')!==want)m.setAttribute('content',want);
};

D.init=function(){
  D.viewport();
  D.apply();
  D.manifest();
  D.offline();
  D.guard();
  if(D.mobile||D.standalone)D.keepAwake();
  ['fullscreenchange','webkitfullscreenchange'].forEach(function(n){
    document.addEventListener(n,function(){
      D.standalone=mq('(display-mode:standalone)')||D.isFullscreen()||
                   !!window.navigator.standalone;
      D.apply();
    });
  });
};

LH.Device=D;
})();


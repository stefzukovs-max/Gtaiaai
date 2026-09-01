/* ============================================================
   LH.UI — the interface.

   DOM rather than in-world geometry, because text has to be crisp at
   any resolution and a canvas-drawn panel never is. Everything is
   sized in cqw/cqh against the game container so the HUD scales as
   one piece with the view.

   The default screen carries four things — who you are, what you are
   holding, what you are looking at, and the clock. Every other
   function opens on demand and closes on Escape.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,D=LH.Data,Net=LH.Net,Icon=LH.Icon;
/* Read lazily: the UI module is defined before the terrain is, and the
   map is the first thing here that needs to ask the island a question. */
var T={pad:function(n){return LH.Terrain.pad(n);}};
var U={};

var hud=null,els={},panels={},openPanel=null;
var snap=null;                  /* last state snapshot from the server */
var hotbar=['pick_stone','rod_cane','plank','stone','lantern',
            null,null,null,null,null];
var hotIndex=0;
U.hotbar=hotbar;
var chatChannel='global';
var buildOn=false, tool='place';
U.tool=function(){return tool;};
U.buildOn=function(){return buildOn;};

function el(tag,cls,html){
  var e=document.createElement(tag);
  if(cls)e.className=cls;
  if(html!==undefined)e.innerHTML=html;
  return e;
}
function clear(e){while(e.firstChild)e.removeChild(e.firstChild);}

/* ---------------- toasts ---------------- */
var toastWrap=null;
U.toast=function(msg,kind){
  if(!toastWrap)return;
  var t=el('div','toast'+(kind?' '+kind:''));
  if(kind==='item'){
    t.className='toast good';
  }
  t.innerHTML=msg;
  toastWrap.appendChild(t);
  /* cap the stack: a burst of pickups should not fill the screen */
  while(toastWrap.children.length>5)toastWrap.removeChild(toastWrap.firstChild);
  setTimeout(function(){
    t.classList.add('out');
    setTimeout(function(){t.parentNode&&t.parentNode.removeChild(t);},320);
  },2600);
};
/* An item pickup shows its own icon and rarity colour. */
U.toastItem=function(key,n){
  var it=D.byKey(key);if(!it)return;
  U.toast('<span class="sw" style="background:'+D.rarityCol(it.rarity)+'"></span>'+
    '<b>+'+(n||1)+'</b>&nbsp;'+it.name,'good');
};

/* ---------------- build ---------------- */
/* Icons are inline SVG paths rather than a font or emoji: they inherit
   currentColor, stay crisp at any scale, and add nothing to load. */
var ICON={
  build:'M3 9l9-5 9 5-9 5-9-5zm0 6l9 5 9-5M3 12l9 5 9-5',
  bag:'M4 8h16l-1 12H5L4 8zm4 0V6a4 4 0 018 0v2',
  quest:'M12 3l2.5 5.2 5.5.8-4 3.9.9 5.6L12 15.8 7.1 18.5 8 12.9 4 9l5.5-.8L12 3z',
  map:'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 0v14m6-12v14',
  trade:'M4 8h12l-3-3m3 3l-3 3M20 16H8l3-3m-3 3l3 3',
  clan:'M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4z',
  friends:'M9 11a3 3 0 100-6 3 3 0 000 6zm7 0a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 3-5 6-5s6 2 6 5m1-5c3 0 5 2 5 5',
  gear:'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z',
  mail:'M3 6h18v12H3V6zm0 0l9 7 9-7',
  people:'M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 10a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.9M16 2.1a4 4 0 010 7.8',
  world:'M12 21a9 9 0 100-18 9 9 0 000 18zm-9-9h18M12 3a14 14 0 000 18 14 14 0 000-18z',
  emote:'M12 21a9 9 0 100-18 9 9 0 000 18zM8.5 14a4.5 4.5 0 007 0M9 9.5v.01M15 9.5v.01',
  wear:'M9 3L4 5.5 5.6 10 8 9v11h8V9l2.4 1L20 5.5 15 3a3 3 0 01-6 0z',
  cursor:'M5 3l14 7-6 2-2 6-6-15z',
  place:'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 0v18m8-13.5L12 12 4 7.5',
  remove:'M4 7h16M9 7V5h6v2m-8 0l1 13h8l1-13',
  rotate:'M21 12a9 9 0 11-3-6.7M21 3v6h-6',
  copy:'M9 9h11v11H9V9zM5 15H4V4h11v1',
  up:'M12 20V5m0 0l-6 6m6-6l6 6',
  down:'M12 4v15m0 0l6-6m-6 6l-6-6',
  pick:'M14 4c3 0 6 3 6 6l-9 9-3-3 9-9c0-1-1-2-3-3z M7 15l2 2-4 4-2-2 4-4',
  paint:'M4 7h12v5H4V7zm12 2h4v9a2 2 0 01-4 0v-3',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z'
};
function svg(name,cls){
  return '<svg class="hicon '+(cls||'')+'" viewBox="0 0 24 24" aria-hidden="true">'+
    '<path d="'+(ICON[name]||'')+'"/></svg>';
}
U.svg=svg;

/* The left menu. Data, so a new destination is a row. */
var MENU=[
  ['Build Mode','build','B','buildmode'],
  ['Bag','bag','I','inv'],
  ['Quests','quest','Q','missions'],
  ['Map','map','M','map'],
  ['Trade','trade','T','trade'],
  ['Worlds','world','G','worlds'],
  ['Wardrobe','wear','O','wardrobe'],
  ['Friends','friends','F','profile'],
  ['Emotes','emote','V','emotes'],
  ['Settings','gear','ESC','menu']
];

/* Six of those ten, for the phone. Not a subset chosen by taste: the
   ones a thumb reaches for mid-session. Build mode, the bag and the
   wardrobe are the game; the map and quests are where you are going;
   settings is where the graphics tier and the fullscreen switch live.
   Trade, friends and worlds are one level in, off the Menu sheet,
   because opening them mid-walk is not a thing anyone does. */
var MOBILE_NAV=[
  ['Build','build','buildmode'],
  ['Bag','bag','inv'],
  ['Wardrobe','wear','wardrobe'],
  ['Map','map','map'],
  ['Quests','quest','missions'],
  ['Menu','gear','menu']
];
/* One dispatcher for both menus, so a destination cannot behave
   differently depending on which one you opened it from. */
function navTo(dest){
  LH.Audio&&LH.Audio.play('ui');
  if(dest==='buildmode')U.toggleBuild();
  else if(dest==='emotes')U.wheel(true);
  else U.open(dest);
}

/* The bottom action bar mirrors what build mode can actually do, so a
   greyed row is never a lie about a missing feature. */
var ACTS=[
  ['Select','cursor','select'],
  ['Place','place','place'],
  ['Remove','remove','remove'],
  ['Rotate','rotate','rotate'],
  ['Copy','copy','copy'],
  ['Fly Up','up','flyup'],
  ['Fly Down','down','flydown']
];

/* Labels and glyphs for LH.Rig.EMOTES, in the same order — the wheel
   places them clockwise from the top. */
var EMOTE_UI=[
  ['wave',     '\u{1F44B}','Wave'],
  ['dance',    '\u{1F57A}','Dance'],
  ['laugh',    '\u{1F604}','Laugh'],
  ['celebrate','\u{1F389}','Cheer'],
  ['clap',     '\u{1F44F}','Clap'],
  ['point',    '\u{1F449}','Point'],
  ['shrug',    '\u{1F937}','Shrug'],
  ['sit',      '\u{1FA91}','Sit']
];
var wheelOn=false;

/* Play an emote and shut the wheel. Emotes are pure presentation —
   they never touch the authority boundary, which is why this is the
   whole of it. */
U.emote=function(name){
  var pl=LH.Game&&LH.Game.player;
  if(pl)pl.anim.play(name,true);
  U.wheel(false);
  LH.Audio&&LH.Audio.play('ui');
};
U.wheel=function(on){
  if(!els.wheel)return false;
  wheelOn=(on===undefined)?!wheelOn:!!on;
  els.wheel.classList.toggle('on',wheelOn);
  return wheelOn;
};
U.wheelOn=function(){return wheelOn;};
U.EMOTE_UI=EMOTE_UI;

/* ---------------- getting the browser out of the way ----------------
   Offered once, on a phone, after the player is actually in the world
   rather than during the title card — an install prompt over a loading
   screen is an install prompt for something you have not seen yet.
   The answer is remembered, so it is never asked twice. */
var GETAPP_KEY='lh.getapp.v1';
U.offerApp=function(){
  var Dv=LH.Device, bar=document.getElementById('getapp');
  if(!bar||!Dv)return;
  if(!Dv.mobile||Dv.standalone)return;
  try{if(localStorage.getItem(GETAPP_KEY))return;}catch(e){}
  var why=document.getElementById('getappwhy');
  var go=document.getElementById('getappgo');
  if(!Dv.installable&&Dv.ios){
    why.textContent='Tap Share, then "Add to Home Screen" — it then opens '+
      'like an app, with no address bar in the way.';
    go.textContent='Full screen';
  }else if(!Dv.installable){
    why.textContent='Fill the screen now, or use your browser menu to '+
      'install it as an app.';
    go.textContent='Full screen';
  }
  function answered(){
    try{localStorage.setItem(GETAPP_KEY,'1');}catch(e){}
    bar.classList.remove('on');
  }
  go.onclick=function(){Dv.install();answered();};
  document.getElementById('getappno').onclick=answered;
  bar.classList.add('on');
  /* It is an offer, not a demand. If it is ignored it takes itself
     away rather than sitting over the game waiting to be dismissed. */
  setTimeout(function(){ if(bar.classList.contains('on'))answered(); },14000);
  /* If the browser tells us later that it can install, upgrade the
     wording rather than asking again. */
  Dv.onInstallable=function(){
    if(!bar.classList.contains('on'))return;
    go.textContent='Install';
    why.textContent='Add Lumen Harbor to your home screen and it opens '+
      'full screen, with no address bar.';
  };
};

U.init=function(){
  hud=document.getElementById('hud');
  clear(hud);
  var rok=document.getElementById('rotateok');
  if(rok)rok.addEventListener('click',function(){LH.App.dismissRotate();});

  /* ---- identity ---- */
  var id=el('div','idchip hp');
  id.innerHTML=
    '<div class="av" id="uiav">T<span class="lvbadge" id="uilvb">1</span></div>'+
    '<div class="who">'+
      '<div class="nm" id="uiname">Traveller</div>'+
      '<div class="xpwrap"><div class="xpbar"><i id="uixp" style="width:0%"></i></div>'+
      '<span class="xpn" id="uixpn">0/90</span></div>'+
    '</div>';
  hud.appendChild(id);
  els.av=id.querySelector('#uiav');
  els.lvb=id.querySelector('#uilvb');
  els.name=id.querySelector('#uiname');
  els.xp=id.querySelector('#uixp');
  els.xpn=id.querySelector('#uixpn');

  /* health only appears when it matters */
  var vit=el('div','vitals');
  vit.innerHTML='<div class="bar hp"><i id="uihp" style="width:100%"></i>'+
    '<span class="lbl" id="uihplbl">100 / 100</span></div>';
  hud.appendChild(vit);
  els.vitals=vit;
  els.hp=vit.querySelector('#uihp');
  els.hplbl=vit.querySelector('#uihplbl');

  /* ---- currencies ---- */
  var purse=el('div','purse');
  purse.innerHTML=
    '<div class="coin c hp"><span class="dot"></span><span id="uicoins">0</span>'+
      '<span class="plus" data-buy="coins">+</span></div>'+
    '<div class="coin g hp"><span class="dot"></span><span id="uigems">0</span>'+
      '<span class="plus" data-buy="gems">+</span></div>'+
    '<div class="coin s hp"><span class="dot"></span><span id="uistars">0</span>'+
      '<span class="plus" data-buy="stars">+</span></div>';
  hud.appendChild(purse);
  els.coins=purse.querySelector('#uicoins');
  els.shards=purse.querySelector('#uigems');
  els.stars=purse.querySelector('#uistars');
  purse.addEventListener('click',function(e){
    var b=e.target.getAttribute('data-buy');
    if(b){U.open('shop');LH.Audio&&LH.Audio.play('ui');}
  });

  /* ---- top-right cluster ---- */
  var tools=el('div','tools');
  tools.innerHTML=
    '<div class="tbtn2 hp pe" data-go="profile" title="Friends">'+svg('people')+'</div>'+
    '<div class="tbtn2 hp pe" data-go="missions" title="Quests">'+svg('mail')+'</div>'+
    '<div class="tbtn2 hp pe" data-go="worlds" title="Worlds">'+svg('world')+'</div>'+
    '<div class="tbtn2 hp pe" data-go="menu" title="Settings">'+svg('gear')+'</div>'+
    '<div class="online hp"><span class="hcap">Players Online</span>'+
      '<b id="uionline">1</b></div>';
  hud.appendChild(tools);
  els.online=tools.querySelector('#uionline');
  tools.addEventListener('click',function(e){
    var t=e.target.closest('[data-go]');
    if(t){U.open(t.getAttribute('data-go'));LH.Audio&&LH.Audio.play('ui');}
  });

  var clock=el('div','clock hp');
  clock.innerHTML='<span id="uiclock">09:00</span><span class="wx" id="uiwx">CLEAR</span>';
  hud.appendChild(clock);
  els.clock=clock.querySelector('#uiclock');
  els.wx=clock.querySelector('#uiwx');

  /* ---- left menu ---- */
  var menu=el('div','menu hp pe');
  var mh=el('div','mh');
  mh.innerHTML='<span class="hcap">Menu</span>';
  menu.appendChild(mh);
  MENU.forEach(function(m){
    var row=el('div','mi');
    row.innerHTML=svg(m[1])+'<span class="lbl">'+m[0]+'</span>'+
      '<span class="kk">'+m[2]+'</span>';
    row.addEventListener('click',function(){navTo(m[3]);});
    menu.appendChild(row);
  });
  hud.appendChild(menu);
  els.menu=menu;

  /* ---- my world ---- */
  var mw=el('div','myworld hp pe');
  mw.innerHTML=
    '<span class="hcap">My World</span>'+
    '<div class="wn" id="uiwname">No world yet</div>'+
    '<div class="stat"><span>Visitors</span><b id="uivis">0</b></div>'+
    '<div class="stat"><span>Likes</span><b id="uilikes">0</b></div>'+
    '<button class="wbtn" id="uiwbtn">Open World</button>';
  hud.appendChild(mw);
  els.wname=mw.querySelector('#uiwname');
  els.vis=mw.querySelector('#uivis');
  els.likes=mw.querySelector('#uilikes');
  mw.querySelector('#uiwbtn').addEventListener('click',function(){
    LH.Audio&&LH.Audio.play('ui');
    U.open('worlds');
  });

  /* ---- build panel ---- */
  els.buildp=el('div','buildp hp pe');
  els.buildp.innerHTML=
    '<span class="hcap">Build Mode</span>'+
    '<div class="brow" id="uibtools"></div>'+
    '<span class="hcap">Blocks</span>'+
    '<div class="bpal" id="uibpal"></div>';
  hud.appendChild(els.buildp);
  els.btools=els.buildp.querySelector('#uibtools');
  els.bpal=els.buildp.querySelector('#uibpal');
  [['cursor','select','Select'],['place','place','Place'],
   ['remove','remove','Remove'],['rotate','rotate','Rotate'],
   ['eye','copy','Copy']].forEach(function(t){
    var b=el('div','btool');
    b.innerHTML=svg(t[0]);
    b.title=t[2];
    b.setAttribute('data-tool',t[1]);
    b.addEventListener('click',function(){U.setTool(t[1]);});
    els.btools.appendChild(b);
  });

  /* ---- reticle and prompt ---- */
  els.retic=el('div','retic');
  hud.appendChild(els.retic);
  els.prompt=el('div','prompt hp');
  hud.appendChild(els.prompt);

  /* ---- hotbar ---- */
  els.hot=el('div','hotbar hp pe');
  hud.appendChild(els.hot);
  buildHotbar();

  /* ---- action bar ---- */
  els.actbar=el('div','actbar hp pe');
  ACTS.forEach(function(a){
    var b=el('div','act2');
    b.innerHTML=svg(a[1])+'<span>'+a[0]+'</span>';
    b.setAttribute('data-act',a[2]);
    b.addEventListener('click',function(){U.action(a[2]);});
    els.actbar.appendChild(b);
  });
  hud.appendChild(els.actbar);

  /* ---- fishing rig ---- */
  els.fish=el('div','fishrig hp');
  els.fish.innerHTML=
    '<div class="cap"><span id="ufstage">Cast</span><b id="ufclass"></b></div>'+
    '<div class="prog"><i id="ufprog" style="width:0%"></i></div>'+
    '<div class="strain" id="ufstrainwrap"><i id="ufstrain" style="width:0%"></i></div>'+
    '<div class="hint" id="ufhint"></div>';
  hud.appendChild(els.fish);
  els.fstage=els.fish.querySelector('#ufstage');
  els.fclass=els.fish.querySelector('#ufclass');
  els.fprog=els.fish.querySelector('#ufprog');
  els.fstrain=els.fish.querySelector('#ufstrain');
  els.fstrainWrap=els.fish.querySelector('#ufstrainwrap');
  els.fhint=els.fish.querySelector('#ufhint');

  els.catch=el('div','catch hp');
  hud.appendChild(els.catch);

  /* the banner that names a place as you walk into it */
  els.arrive=el('div','arrive');
  els.arrive.innerHTML='<div class="nm"></div><div class="sb"></div>';
  hud.appendChild(els.arrive);

  els.dlg=el('div','dlg hp');
  hud.appendChild(els.dlg);

  /* ---- chat ---- */
  els.chat=el('div','chat hp pe');
  els.chat.innerHTML=
    '<div class="tabs2">'+
      '<div class="ct on" data-ch="global">Global</div>'+
      '<div class="ct" data-ch="world">World</div>'+
      '<div class="ct" data-ch="clan">Clan</div>'+
      '<span class="cx" id="uchatx">✕</span>'+
    '</div>'+
    '<div class="log" id="uchatlog"></div>'+
    '<div class="inp"><input id="uchatin" placeholder="'+
      ((LH.Device&&LH.Device.touch)?'Tap to chat…':'Press Enter to chat…')+
      '" maxlength="120"></div>';
  hud.appendChild(els.chat);
  els.chatLog=els.chat.querySelector('#uchatlog');
  els.chatIn=els.chat.querySelector('#uchatin');
  els.chat.querySelector('.tabs2').addEventListener('click',function(e){
    var t=e.target.closest('[data-ch]');
    if(!t)return;
    els.chat.querySelectorAll('.ct').forEach(function(x){x.classList.remove('on');});
    t.classList.add('on');
    chatChannel=t.getAttribute('data-ch');
    repaintChat();
  });
  els.chat.querySelector('#uchatx').addEventListener('click',function(){
    els.chat.classList.toggle('dim');
  });
  els.chatIn.addEventListener('keydown',function(e){
    if(e.key==='Enter'){
      var v=els.chatIn.value.trim();
      els.chatIn.value='';
      if(v)U.say(snap?snap.name:'You',v,null,chatChannel);
      els.chatIn.blur();
    }else if(e.key==='Escape'){els.chatIn.blur();}
    e.stopPropagation();
  });

  els.world=el('div');
  els.world.style.cssText='position:absolute;inset:0;pointer-events:none';
  hud.appendChild(els.world);

  toastWrap=el('div','toasts');
  hud.appendChild(toastWrap);

  /* ---- touch controls ----
     The primary control surface, not a fallback for one. Three
     decisions carry it:

     The stick is nowhere until a thumb lands, and then it is exactly
     where the thumb landed. A stick drawn in a fixed corner is a stick
     you have to look down at, and looking down is the whole problem
     with playing a 3D game on a phone.

     The big button reads what it will do. `USE` on nothing, `MINE` on
     a block you can break, `PLACE` when you are holding something that
     goes in the world, `HIT` on an enemy — so the button answers the
     question rather than the player having to.

     Everything fades rather than disappearing when it cannot be used.
     A control that vanishes moves the two next to it, and a layout
     that moves under a thumb is a layout that gets mis-hit. */
  els.touch=el('div','touch');
  els.touch.innerHTML=
    '<div class="tsthome" id="utsthome"><i></i></div>'+
    '<div class="tstick" id="utstick"><i></i></div>'+
    '<div class="tbtn big" id="utprimary">USE</div>'+
    '<div class="tbtn mid jump" id="utjump">JUMP</div>'+
    '<div class="tbtn mid act" id="utact">TALK</div>'+
    '<div class="tbtn menu" id="utmenu">≡</div>';
  hud.appendChild(els.touch);
  els.tstick=els.touch.querySelector('#utstick');
  els.tsthome=els.touch.querySelector('#utsthome');
  els.tprimary=els.touch.querySelector('#utprimary');
  els.tact=els.touch.querySelector('#utact');
  if(LH.Device&&LH.Device.touch)els.touch.classList.add('on');
  function hold(id,name){
    var b=els.touch.querySelector(id);
    function dn(e){
      e.preventDefault();
      if(b.classList.contains('off'))return;
      LH.Input.touchAction(name,true);
      b.classList.add('press');
      if(LH.Device)LH.Device.buzz(10);
    }
    function up(e){e.preventDefault();LH.Input.touchAction(name,false);
      b.classList.remove('press');}
    b.addEventListener('touchstart',dn,{passive:false});
    b.addEventListener('touchend',up,{passive:false});
    b.addEventListener('touchcancel',up,{passive:false});
    b.addEventListener('mousedown',function(){
      if(!b.classList.contains('off'))LH.Input.touchAction(name,true);});
    b.addEventListener('mouseup',function(){LH.Input.touchAction(name,false);
      b.classList.remove('press');});
  }
  hold('#utprimary','primary');
  hold('#utjump','jump');
  hold('#utact','interact');
  els.touch.querySelector('#utmenu').addEventListener('click',function(){
    U.open('menu');});

  /* ---- mobile nav ----
     The desktop keeps its keyboard menu down the left. A phone gets
     this instead: the same destinations, as six 44-pixel targets along
     the top, from the same MENU table so neither can drift from the
     other. */
  els.mnav=el('div','mnav');
  els.mnav.style.cssText='left:calc(8px + env(safe-area-inset-left,0px));'+
    'top:calc(58px + env(safe-area-inset-top,0px))';
  MOBILE_NAV.forEach(function(row){
    var b=el('div','nb pe');
    b.innerHTML=svg(row[1])+'<i></i>';
    b.title=row[0];
    b.setAttribute('data-nav',row[2]);
    b.addEventListener('click',function(){
      if(LH.Device)LH.Device.buzz(8);
      navTo(row[2]);
    });
    els.mnav.appendChild(b);
  });
  hud.appendChild(els.mnav);

  /* ---- panels ---- */
  els.scrim=el('div','scrim pe');
  els.scrim.addEventListener('click',function(){U.close();});
  hud.appendChild(els.scrim);

  makePanel('inv','Backpack',['All','Blocks','Materials','Gear','Cosmetics',
    'Fishing','Food','Collection']);
  makePanel('craft','Workbench',['Available','All']);
  makePanel('map','Lumen Harbor',null);
  makePanel('wardrobe','Wardrobe',null);
  panels.wardrobe.root.classList.add('dress');
  makePanel('profile','Profile',['Overview','Skills','Collections','Achievements']);
  makePanel('missions','Missions',['Daily','Story','Weekly']);
  makePanel('shop','Store',['Style','Blocks','Walls','Held','Food','Bundles']);
  makePanel('worlds','Worlds',['My Worlds','New World']);
  makePanel('trade','Trade',null);
  makePanel('menu','Menu',null);

  /* ---- emote wheel ----
     Laid out on a circle from one list, so adding an emote is a row in
     LH.Rig.EMOTES and a label here rather than a chunk of markup. */
  els.wheel=el('div','wheel pe');
  var ring=el('div','ring');
  EMOTE_UI.forEach(function(e,i){
    var a=(i/EMOTE_UI.length)*Math.PI*2-Math.PI/2;
    var btn=el('div','em');
    btn.style.left=(50+Math.cos(a)*41)+'%';
    btn.style.top=(50+Math.sin(a)*41)+'%';
    btn.innerHTML='<b>'+e[1]+'</b><span>'+e[2]+'</span><i>'+(i+1)+'</i>';
    btn.addEventListener('click',function(){U.emote(e[0]);});
    ring.appendChild(btn);
  });
  var hub=el('div','hub');
  hub.innerHTML='<h4>Emotes</h4><p>1–'+EMOTE_UI.length+' or click · V closes</p>';
  ring.appendChild(hub);
  els.wheel.appendChild(ring);
  hud.appendChild(els.wheel);

  els.travel=el('div');
  els.travel.id='travel';
  els.travel.innerHTML='<div class="lbl" id="utravel">Travelling…</div>';
  hud.appendChild(els.travel);

  U.sync(Net.snapshot());
  U.buildPalette();
  return U;
};

function makePanel(id,title,tabs){
  var p=el('div','panel pe');
  var hd=el('div','hd');
  hd.innerHTML='<h2>'+title+'</h2>';
  var sp=el('div','sp');hd.appendChild(sp);
  if(tabs){
    var tw=el('div','tabs');
    tabs.forEach(function(t,i){
      var b=el('div','tab'+(i===0?' on':''),t);
      b.addEventListener('click',function(){
        tw.querySelectorAll('.tab').forEach(function(x){x.classList.remove('on');});
        b.classList.add('on');
        p.dataset.tab=t;
        render(id);
      });
      tw.appendChild(b);
    });
    hd.insertBefore(tw,sp.nextSibling);
    p.dataset.tab=tabs[0];
  }
  var x=el('button','xbtn','✕');
  x.addEventListener('click',function(){U.close();});
  hd.appendChild(x);
  p.appendChild(hd);
  var bd=el('div','bd');
  p.appendChild(bd);
  hud.appendChild(p);
  panels[id]={root:p,body:bd,title:title};
}

/* ---------------- hotbar ---------------- */
function buildHotbar(){
  clear(els.hot);
  for(var i=0;i<10;i++){
    (function(i){
      var s=el('div','slot'+(i===hotIndex?' on':''));
      s.innerHTML='<div class="ic"></div><span class="k">'+((i+1)%10)+'</span>'+
                  '<span class="n"></span>';
      s.addEventListener('click',function(){U.selectSlot(i);});
      els.hot.appendChild(s);
    })(i);
  }
  refreshHotbar();
}
function refreshHotbar(){
  if(!els.hot||!snap)return;
  var slots=els.hot.children;
  for(var i=0;i<slots.length;i++){
    var key=hotbar[i];
    var s=slots[i];
    var ic=s.querySelector('.ic'), n=s.querySelector('.n');
    s.classList.toggle('on',i===hotIndex);
    if(!key||!D.byKey(key)){
      s.classList.add('empty');ic.style.backgroundImage='';n.textContent='';
      s.style.removeProperty('--rr');
      continue;
    }
    s.classList.remove('empty');
    var it=D.byKey(key);
    var url=Icon.of(key);
    ic.style.backgroundImage='url('+url+')';
    ic.style.backgroundSize='cover';
    var count=snap.inv[key]||0;
    n.textContent=(it.stack>1&&count>0)?count:'';
    /* a held tool you no longer own reads as unavailable rather than
       silently doing nothing when you click */
    s.style.opacity=count>0?'1':'0.42';
  }
}
U.selectSlot=function(i){
  hotIndex=M.clamp(i|0,0,9);
  refreshHotbar();
  var key=hotbar[hotIndex];
  var it=key?D.byKey(key):null;
  /* Equipping the held tool is the server's business, not the HUD's. */
  if(it&&(it.cat==='tool'||it.cat==='weapon'||it.cat==='fishing')){
    Net.request('equip',{key:key},function(r){if(r.ok)U.sync(r.state);});
  }
  if(LH.Game&&LH.Game.onHeldChanged)LH.Game.onHeldChanged(key);
};
U.held=function(){return hotbar[hotIndex];};
U.slotIndex=function(){return hotIndex;};
U.heldItem=function(){var k=hotbar[hotIndex];return k?D.byKey(k):null;};
U.setSlot=function(i,key){hotbar[i]=key;refreshHotbar();};

/* ---------------- state sync ----------------
   The HUD never computes a number. It renders whatever the last
   server snapshot said, which is why a rejected request cannot leave
   the display out of step with the truth. */
U.sync=function(s){
  if(!s)return;
  snap=s;
  if(!hud)return;
  els.name.textContent=s.name;
  /* The avatar tile keeps the initial but not the level badge's text —
     writing both into one node would wipe the badge every sync. */
  els.av.firstChild.nodeValue=(s.name[0]||'T').toUpperCase();
  els.lvb.textContent=s.level;
  els.xp.style.width=Math.round(100*s.xp/Math.max(1,s.xpNext))+'%';
  els.xpn.textContent=s.xp+'/'+s.xpNext;
  els.coins.textContent=s.coins.toLocaleString();
  els.shards.textContent=s.shards.toLocaleString();
  if(els.stars)els.stars.textContent=(s.stars||0).toLocaleString();
  if(els.hp){
    els.hp.style.width=Math.round(100*s.hp/Math.max(1,s.hpMax))+'%';
    els.hplbl.textContent=Math.round(s.hp)+' / '+s.hpMax;
    /* Health is only worth screen space when it is not full. */
    els.vitals.classList.toggle('on',s.hp<s.hpMax);
  }
  /* MY WORLD reflects the first world you own, or invites you to make one */
  if(els.wname){
    Net.request('myWorlds',{},function(r){
      if(!r.ok)return;
      var w=r.worlds[0];
      els.wname.textContent=w?w.name:'No world yet';
      els.vis.textContent=w?(w.visits||0):0;
      els.likes.textContent=w?Math.round((w.blocks||0)/8):0;
    });
  }
  refreshHotbar();
  if(buildOn)U.buildPalette();
  if(openPanel)render(openPanel);
};
U.state=function(){return snap;};

/* ---------------- reticle + interaction prompt ---------------- */
U.setReticle=function(mode){
  if(!els.retic)return;
  els.retic.className='retic'+(mode==='act'?' act':(mode==='deny'?' deny':''));
};
U.setPrompt=function(text,keyName){
  if(!els.prompt)return;
  if(!text){els.prompt.classList.remove('show');return;}
  els.prompt.innerHTML='<kbd>'+(keyName||'E')+'</kbd><span>'+text+'</span>';
  els.prompt.classList.add('show');
};
/* The two touch buttons that change meaning. `verb` labels the big
   one, `live` fades it when the action would do nothing, and `act`
   labels the interact button — empty hides it, so a player never
   presses TALK at a wall. */
var _verb='',_verbLive=true,_act='';
U.setTouchVerb=function(verb,live,act){
  if(!els.tprimary)return;
  if(verb!==_verb){_verb=verb;els.tprimary.textContent=verb;}
  live=!!live;
  if(live!==_verbLive){_verbLive=live;els.tprimary.classList.toggle('off',!live);}
  act=act||'';
  if(act!==_act){
    _act=act;
    els.tact.textContent=act||'TALK';
    els.tact.classList.toggle('off',!act);
  }
};

U.setClock=function(hours,weather){
  if(!els.clock)return;
  var h=Math.floor(hours)%24, m=Math.floor((hours%1)*60);
  els.clock.textContent=(h<10?'0':'')+h+':'+(m<10?'0':'')+m;
  els.wx.textContent=String(weather||'clear').toUpperCase();
};

/* ---------------- panels ---------------- */
U.open=function(id){
  if(openPanel===id){U.close();return;}
  if(openPanel)panels[openPanel].root.classList.remove('on');
  openPanel=id;
  if(!panels[id])return;
  panels[id].root.classList.add('on');
  els.scrim.classList.add('on');
  els.scrim.classList.toggle('clear',id==='wardrobe');
  if(LH.Player.dress)LH.Player.dress(id==='wardrobe');
  render(id);
  if(LH.Input.releaseLock)LH.Input.releaseLock();
};
U.close=function(){
  if(openPanel&&panels[openPanel])panels[openPanel].root.classList.remove('on');
  openPanel=null;
  els.scrim.classList.remove('on');
  els.scrim.classList.remove('clear');
  if(LH.Player.dress)LH.Player.dress(false);
};
U.isOpen=function(){return !!openPanel;};
U.openId=function(){return openPanel;};

var selected=null;

function itemCell(key,count,opts){
  opts=opts||{};
  var it=D.byKey(key);
  if(!it)return null;
  var c=el('div','cell'+(selected===key?' sel':'')+(opts.worn?' worn':''));
  var rr=el('div','rr');
  rr.style.background=D.rarityCol(it.rarity);
  c.appendChild(rr);
  var ic=el('div','ic');
  ic.style.backgroundImage='url('+Icon.of(key)+')';
  ic.style.backgroundSize='cover';
  c.appendChild(ic);
  if(count>1||opts.showCount){
    var n=el('span','n',String(count));
    c.appendChild(n);
  }
  c.title=it.name;
  c.addEventListener('click',function(){
    selected=key;
    render(openPanel);
  });
  return c;
}

var CAT_TAB={
  'Blocks':['block','furniture'],'Materials':['material'],
  'Gear':['tool','weapon'],'Cosmetics':['cosmetic'],
  'Fishing':['fishing'],'Food':['consumable'],
  'Collection':['collectible'],'All':null
};

function render(id){
  var P=panels[id];
  if(!P||!snap)return;
  var bd=P.body;
  clear(bd);
  if(id==='inv')return renderInv(bd,P.root.dataset.tab);
  if(id==='craft')return renderCraft(bd,P.root.dataset.tab);
  if(id==='profile')return renderProfile(bd,P.root.dataset.tab);
  if(id==='shop')return renderShop(bd,P.root.dataset.tab);
  if(id==='missions')return renderMissions(bd,P.root.dataset.tab);
  if(id==='worlds')return renderWorlds(bd,P.root.dataset.tab);
  if(id==='trade')return renderTrade(bd);
  if(id==='map')return renderMap(bd);
  if(id==='wardrobe')return renderWardrobe(bd);
  if(id==='menu')return renderMenu(bd);
}

function renderInv(bd,tab){
  var cats=CAT_TAB[tab];
  var keys=Object.keys(snap.inv).filter(function(k){
    var it=D.byKey(k);
    if(!it)return false;
    return !cats||cats.indexOf(it.cat)>=0;
  });
  /* Rarity first, then name: the good stuff should never be buried. */
  keys.sort(function(a,b){
    var A=D.byKey(a),B=D.byKey(b);
    return (B.rarity-A.rarity)||A.name.localeCompare(B.name);
  });
  if(!keys.length){
    bd.appendChild(el('div','empty-note','Nothing here yet.'));
    return;
  }
  var g=el('div','grid');
  var worn={};
  for(var sl in snap.equipped)if(snap.equipped[sl])worn[snap.equipped[sl]]=1;
  keys.forEach(function(k){
    var c=itemCell(k,snap.inv[k],{worn:!!worn[k]});
    if(c)g.appendChild(c);
  });
  bd.appendChild(g);
  if(selected&&snap.inv[selected])bd.appendChild(detailFor(selected,'inv'));
}

function detailFor(key,ctx){
  var it=D.byKey(key);
  var d=el('div','detail');
  var big=el('div','big');
  var ic=el('div','ic');
  ic.style.backgroundImage='url('+Icon.of(key)+')';
  ic.style.backgroundSize='cover';
  big.appendChild(ic);
  d.appendChild(big);
  var t=el('div','txt');
  t.appendChild(el('h3',null,it.name));
  var rt=el('div','rt',D.RARITY[it.rarity]+' · '+it.cat);
  rt.style.color=D.rarityCol(it.rarity);
  t.appendChild(rt);
  if(it.desc)t.appendChild(el('p',null,it.desc));
  var meta=el('div','meta');
  meta.innerHTML=
    '<span>Value <b>'+it.value.toLocaleString()+'</b></span>'+
    '<span>Stack <b>'+it.stack+'</b></span>'+
    (it.placeable?'<span><b>Placeable</b></span>':'')+
    (it.tradeable?'':'<span><b>Bound</b></span>')+
    (it.props&&it.props.damage?'<span>Damage <b>'+it.props.damage+'</b></span>':'')+
    (it.props&&it.props.power?'<span>Power <b>'+it.props.power+'</b></span>':'');
  t.appendChild(meta);

  var acts=el('div','acts');
  function act(label,cls,fn){
    var b=el('button','btn'+(cls?' '+cls:''),label);
    b.addEventListener('click',fn);
    acts.appendChild(b);
    return b;
  }
  if(ctx==='inv'){
    if(it.cat==='cosmetic'||it.cat==='tool'||it.cat==='weapon'||it.cat==='fishing'){
      act('Equip','pri',function(){
        Net.request('equip',{key:key},function(r){
          if(r.ok){U.sync(r.state);U.toast('Equipped '+it.name,'good');
            if(LH.Game&&LH.Game.refreshKit)LH.Game.refreshKit();}
          else U.toast(r.why,'bad');
        });
      });
    }
    if(it.placeable){
      act('To hotbar',null,function(){
        U.setSlot(hotIndex,key);
        U.toast(it.name+' to slot '+((hotIndex+1)%10),'good');
      });
    }
    if(it.consumable){
      act('Use','pri',function(){
        Net.request('use',{key:key},function(r){
          if(r.ok){U.sync(r.state);U.toast('Used '+it.name,'good');}
          else U.toast(r.why,'bad');
        });
      });
    }
    if(it.tradeable&&tradeCache){
      act('Add to trade','pri',function(){
        Net.request('tradeOffer',{key:key,n:1},function(r){
          if(r.ok){tradeCache=r.trade;U.toast('Added to the trade','good');}
          else U.toast(r.why,'bad');
        });
      });
    }
    if(it.tradeable){
      act('Sell ('+D.sellPrice(it)+')','dim',function(){
        Net.request('sell',{key:key,n:1},function(r){
          if(r.ok){U.sync(r.state);U.toast('Sold for '+r.earned+' coins','good');}
          else U.toast(r.why,'bad');
        });
      });
    }
  }
  t.appendChild(acts);
  d.appendChild(t);
  return d;
}

function renderCraft(bd,tab){
  var list=D.ITEMS.filter(function(it){return !!it.recipe;});
  if(tab==='Available'){
    list=list.filter(function(it){
      return it.recipe.every(function(r){return (snap.inv[r[0]]||0)>=r[1];});
    });
  }
  if(!list.length){
    bd.appendChild(el('div','empty-note',
      'Nothing you can make yet. Gather materials and come back.'));
    return;
  }
  var g=el('div','grid');
  list.forEach(function(it){
    var c=itemCell(it.key,1,{});
    if(!c)return;
    var can=it.recipe.every(function(r){return (snap.inv[r[0]]||0)>=r[1];});
    c.style.opacity=can?'1':'0.42';
    g.appendChild(c);
  });
  bd.appendChild(g);
  if(selected){
    var it=D.byKey(selected);
    if(it&&it.recipe){
      var d=detailFor(selected,'craft');
      var need=el('div','meta');
      need.style.marginTop='.5cqw';
      need.innerHTML=it.recipe.map(function(r){
        var m=D.byKey(r[0]);
        var have=snap.inv[r[0]]||0;
        var ok=have>=r[1];
        return '<span style="color:'+(ok?'var(--r2)':'var(--danger)')+'">'+
          (m?m.name:r[0])+' <b>'+have+'/'+r[1]+'</b></span>';
      }).join('');
      d.querySelector('.txt').appendChild(need);
      var acts=el('div','acts');
      var b=el('button','btn pri','Craft');
      b.addEventListener('click',function(){
        Net.request('craft',{key:selected,n:1},function(r){
          if(r.ok){U.sync(r.state);U.toastItem(selected,1);}
          else U.toast(r.why,'bad');
        });
      });
      acts.appendChild(b);
      d.querySelector('.txt').appendChild(acts);
      bd.appendChild(d);
    }
  }
}

function renderProfile(bd,tab){
  if(tab==='Skills'){
    var wrap=el('div');
    for(var k in snap.skills){
      var row=el('div');
      row.style.cssText='display:flex;align-items:center;gap:1cqw;margin-bottom:.7cqw';
      row.innerHTML='<div class="skname">'+
        k+'</div><div class="xpbar" style="flex:1;height:.5cqw"><i style="width:'+
        Math.min(100,snap.skills[k]/40*100)+'%"></i></div>'+
        '<b class="skval">'+snap.skills[k]+'</b>';
      wrap.appendChild(row);
    }
    bd.appendChild(wrap);
    return;
  }
  if(tab==='Collections'){
    var fishAll=D.inCat('collectible').filter(function(i){return i.props&&i.props.fish;});
    var got=Object.keys(snap.collections.fish).length;
    bd.appendChild(el('div','rt','Fish  '+got+' / '+fishAll.length));
    var g=el('div','grid');
    fishAll.forEach(function(it){
      var c=itemCell(it.key,snap.collections.fish[it.key]||0,{showCount:true});
      if(!c)return;
      if(!snap.collections.fish[it.key])c.style.filter='grayscale(1) brightness(.45)';
      g.appendChild(c);
    });
    bd.appendChild(g);
    return;
  }
  if(tab==='Achievements'){
    Net.request('missions',{},function(r){if(r.ok)missionCache=r;});
    var A=(missionCache&&missionCache.achievements)||[];
    A.forEach(function(a){
      var row=el('div','mrow'+(a.done?' done':''));
      row.innerHTML='<div class="mtype">'+(a.done?'earned':'locked')+'</div>'+
        '<div class="mi"><h4>'+a.name+'</h4>'+
        '<div class="pg"><i style="width:'+
          Math.round(100*a.progress/Math.max(1,a.goal))+'%"></i></div></div>'+
        '<div class="ct">'+a.progress+' / '+a.goal+'</div>';
      bd.appendChild(row);
    });
    return;
  }
  var s=snap;
  var o=el('div');
  o.innerHTML=
    '<div class="detail"><div class="big lvbig">'+s.level+'</div>'+
    '<div class="txt"><h3>'+s.name+'</h3>'+
    '<div class="rt" style="color:var(--acc2)">Level '+s.level+'</div>'+
    '<div class="meta">'+
      '<span>Coins <b>'+s.coins.toLocaleString()+'</b></span>'+
      '<span>Shards <b>'+s.shards+'</b></span>'+
      '<span>Blocks placed <b>'+s.stats.placed+'</b></span>'+
      '<span>Blocks broken <b>'+s.stats.broken+'</b></span>'+
      '<span>Fish caught <b>'+s.stats.caught+'</b></span>'+
      '<span>Plots owned <b>'+s.plots.length+'</b></span>'+
    '</div></div></div>';
  bd.appendChild(o);
}

/* Aisles, as categories plus an optional shape filter. The Store used
   to open on Seeds, which sold nothing, because nothing in this game
   plants — an empty first aisle is the worst possible first
   impression of a shop. These are the aisles the catalogue actually
   has stock for, biggest first. */
var SHOP_TAB={
  'Style':  {cats:['cosmetic']},
  'Blocks': {cats:['block','furniture'],not:'pane'},
  'Walls':  {cats:['block'],only:'pane'},
  'Held':   {cats:['tool','weapon','fishing']},
  'Food':   {cats:['consumable']},
  'Bundles':{cats:['cosmetic'],setsOnly:true}
};
/* An outfit card: the three pieces, what you already own of it, and
   one price for the rest. Prices come from D.setPrice against the
   real inventory, so a card never advertises a number the server
   would then refuse. */
function setCard(bd,set){
  var q=D.setPrice(set,function(k){return (snap.inv[k]||0)>0;});
  var done=!q.need.length;
  var row=el('div','setrow'+(done?' owned':''));

  var art=el('div','setart');
  set.items.forEach(function(k){
    var c=itemCell(k,1,{});
    if(c){c.classList.remove('sel');art.appendChild(c);}
  });
  row.appendChild(art);

  var info=el('div','si');
  info.appendChild(el('h4',null,set.name));
  info.appendChild(el('p',null,set.blurb));
  var pcs=el('div','setpc');
  set.items.forEach(function(k){
    var it=D.byKey(k);
    if(!it)return;
    var have=(snap.inv[k]||0)>0;
    pcs.appendChild(el('span',have?'have':null,(have?'\u2713 ':'')+it.name));
  });
  info.appendChild(pcs);
  row.appendChild(info);

  var buy=el('div','setbuy');
  if(done){
    var w=el('button','btn pri','Wear it');
    w.addEventListener('click',function(){
      Net.request('wearSet',{key:set.key},function(r){
        if(r.ok){U.sync(r.state);U.toast('Wearing the '+set.name,'good');
                 if(LH.Game.refreshKit)LH.Game.refreshKit();}
        else U.toast(r.why,'bad');
      });
    });
    buy.appendChild(el('div','setsave','Complete'));
    buy.appendChild(w);
  }else{
    if(q.due<q.list)
      buy.appendChild(el('div','was',q.list.toLocaleString()+' '+q.cur));
    buy.appendChild(el('div','now',q.due.toLocaleString()+' '+q.cur));
    buy.appendChild(el('div','setsave',
      q.need.length<set.items.length
        ? 'the '+q.need.length+' you are missing'
        : Math.round(set.off*100)+'% off the set'));
    var b=el('button','btn pri',
      q.need.length<set.items.length?'Complete it':'Buy the set');
    b.addEventListener('click',function(){
      Net.request('buySet',{key:set.key},function(r){
        if(r.ok){
          U.sync(r.state);
          U.toast(set.name+' \u2014 '+r.got.length+' pieces','good');
          render('shop');
        }else U.toast(r.why,'bad');
      });
    });
    buy.appendChild(b);
  }
  row.appendChild(buy);
  bd.appendChild(row);
}

function renderShop(bd,tab){
  var A=SHOP_TAB[tab]||SHOP_TAB.Blocks;
  var list=A.setsOnly?[]:D.ITEMS.filter(function(it){
    if(A.cats.indexOf(it.cat)<0||it.value<=0)return false;
    if(A.only&&it.shape!==A.only)return false;
    if(A.not&&it.shape===A.not)return false;
    return true;
  }).sort(function(a,b){return a.value-b.value;});
  if(A.setsOnly){
    bd.appendChild(el('div','aisle','Outfits'));
    D.SETS.forEach(function(st){setCard(bd,st);});
    return;
  }
  if(!list.length){
    bd.appendChild(el('div','empty-note','This aisle is empty for now.'));
    return;
  }
  var g=el('div','grid');
  list.forEach(function(it){
    var c=itemCell(it.key,1,{});
    if(c)g.appendChild(c);
  });
  bd.appendChild(g);
  if(selected){
    var it2=D.byKey(selected);
    if(!it2)return;
    var d=detailFor(selected,'shop');
    var acts=el('div','acts');
    var premium=(it2.cat==='cosmetic'&&it2.rarity>=5);
    var price=premium?Math.ceil(D.buyPrice(it2)/40)+' shards'
                     :D.buyPrice(it2).toLocaleString()+' coins';
    var b=el('button','btn pri','Buy — '+price);
    b.addEventListener('click',function(){
      Net.request('buy',{key:selected,n:1},function(r){
        if(r.ok){U.sync(r.state);U.toastItem(selected,1);}
        else U.toast(r.why,'bad');
      });
    });
    acts.appendChild(b);
    d.querySelector('.txt').appendChild(acts);
    bd.appendChild(d);
  }
}

var missionCache=null;
function renderMissions(bd,tab){
  Net.request('missions',{},function(r){
    if(r.ok)missionCache=r;
  });
  if(!missionCache){
    bd.appendChild(el('div','empty-note','Reading the board…'));
    return;
  }
  var list=tab==='Story'?missionCache.story
          :tab==='Weekly'?missionCache.weekly:missionCache.daily;
  if(!list||!list.length){
    bd.appendChild(el('div','empty-note',
      tab==='Story'?'Nothing new. Come back as you level up.'
                   :'Nothing posted right now.'));
    return;
  }
  list.forEach(function(m){
    var row=el('div','mrow'+(m.done?' done':''));
    var rw=[];
    if(m.reward.coins)rw.push(m.reward.coins.toLocaleString()+' coins');
    if(m.reward.xp)rw.push(m.reward.xp+' XP');
    if(m.reward.items)m.reward.items.forEach(function(it){
      var d=D.byKey(it[0]);
      if(d)rw.push(d.name+(it[1]>1?' ×'+it[1]:''));
    });
    if(m.reward.title)rw.push('Title: '+m.reward.title);
    row.innerHTML=
      '<div class="mtype">'+m.type+'</div>'+
      '<div class="mi"><h4>'+m.name+'</h4><p>'+m.desc+'</p>'+
      '<div class="pg"><i style="width:'+
        Math.round(100*m.progress/Math.max(1,m.goal))+'%"></i></div>'+
      '<div class="rw">'+rw.join(' · ')+'</div></div>'+
      '<div class="ct">'+m.progress+' / '+m.goal+'</div>';
    if(m.done&&!m.claimed){
      var b=el('button','btn pri','Claim');
      b.style.marginLeft='.6cqw';
      b.addEventListener('click',function(){
        Net.request('claim',{id:m.id},function(r2){
          if(r2.ok){
            U.sync(r2.state);
            U.toast('Reward claimed','good');
            if(r2.reward.items)r2.reward.items.forEach(function(it){
              U.toastItem(it[0],it[1]);});
            missionCache=null;render('missions');
          }else U.toast(r2.why,'bad');
        });
      });
      row.appendChild(b);
    }else if(m.claimed){
      row.appendChild(el('div','ct','✓'));
    }
    bd.appendChild(row);
  });
}
U.refreshMissions=function(){missionCache=null;};

/* ---------------- trade window ----------------
   Both grids visible, both values totalled, and the lock/confirm
   sequence spelled out rather than implied — the anti-scam surface
   matters more than the chrome. */
var tradeCache=null;
function renderTrade(bd){
  Net.request('tradeState',{},function(r){tradeCache=r.trade;});
  var t=tradeCache;
  if(!t){
    bd.appendChild(el('div','empty-note',
      'Nobody is trading with you. Walk up to someone and press E.'));
    return;
  }
  var wrap=el('div','tradewrap');

  function side(title,offer,value,locked,mine){
    var box=el('div','tradeside'+(locked?' locked':''));
    var h=el('h4');
    h.innerHTML=title+'<span class="v">'+value.toLocaleString()+'</span>';
    box.appendChild(h);
    var g=el('div','tradegrid');
    var keys=Object.keys(offer);
    for(var i=0;i<9;i++){
      var k=keys[i];
      if(!k){
        var blank=el('div','cell');
        blank.style.opacity='.35';
        g.appendChild(blank);
        continue;
      }
      var c=itemCell(k,offer[k],{showCount:true});
      if(!c)continue;
      if(mine){
        c.title='Click to take back';
        (function(kk){
          c.addEventListener('click',function(){
            Net.request('tradeOffer',{key:kk,n:1,remove:true},function(r2){
              if(r2.ok){tradeCache=r2.trade;render('trade');}
              else U.toast(r2.why,'bad');
            });
          });
        })(k);
      }
      g.appendChild(c);
    }
    box.appendChild(g);
    return box;
  }
  wrap.appendChild(side('You offer',t.mine,t.valueMine,t.lockedMe,true));
  wrap.appendChild(side(t.with+' offers',t.theirs,t.valueTheirs,t.lockedThem,false));
  bd.appendChild(wrap);

  var tm=el('div','tradetimer');
  tm.innerHTML='<i style="width:'+Math.round(t.left/120*100)+'%"></i>';
  bd.appendChild(tm);

  var bar=el('div','tradebar');
  var note=el('div','note');
  note.innerHTML=!t.lockedMe
    ? 'Add items from your backpack, then lock when you are happy.'
    : (!t.lockedThem
      ? '<b style="color:var(--gold)">Waiting for '+t.with+' to lock.</b> '+
        'They may want a better offer.'
      : '<b style="color:var(--r2)">Both locked.</b> Confirm to swap.');
  bar.appendChild(note);
  var lock=el('button','btn'+(t.lockedMe?'':' pri'),t.lockedMe?'Unlock':'Lock offer');
  lock.addEventListener('click',function(){
    Net.request('tradeLock',{},function(r2){
      if(r2.ok){tradeCache=r2.trade;render('trade');LH.Audio&&LH.Audio.play('ui');}
    });
  });
  bar.appendChild(lock);
  var conf=el('button','btn pri','Confirm');
  if(!t.lockedMe||!t.lockedThem)conf.setAttribute('disabled','');
  conf.addEventListener('click',function(){
    Net.request('tradeConfirm',{},function(r2){
      if(!r2.ok){U.toast(r2.why,'bad');tradeCache=null;render('trade');return;}
      U.sync(r2.state);
      r2.got.forEach(function(g){U.toastItem(g[0],g[1]);});
      U.toast('Trade complete','good');
      LH.Audio&&LH.Audio.play('coin');
      tradeCache=null;U.close();
    });
  });
  bar.appendChild(conf);
  var cancel=el('button','btn dim','Cancel');
  cancel.addEventListener('click',function(){
    Net.request('tradeCancel',{},function(){tradeCache=null;U.close();});
  });
  bar.appendChild(cancel);
  bd.appendChild(bar);
}
U.openTrade=function(state){tradeCache=state;U.open('trade');};
U.refreshTrade=function(){tradeCache=null;};

var newWorld={name:'',theme:'meadow'};
function renderWorlds(bd,tab){
  var R=LH.Realm;
  if(tab==='New World'){
    var wrap=el('div');
    wrap.appendChild(el('p',null,
      'A world of your own: bare ground, no rules, and it keeps what you '+
      'build. Your first is free.'));
    var f=el('div','field');
    var inp=el('input');
    inp.placeholder='World name';inp.value=newWorld.name;inp.maxLength=20;
    inp.addEventListener('input',function(){newWorld.name=inp.value;});
    inp.addEventListener('keydown',function(e){e.stopPropagation();});
    f.appendChild(inp);
    wrap.appendChild(f);
    var th=el('div','themes');
    R.themeList().forEach(function(k){
      var T2=R.THEMES[k];
      var t=el('div','theme'+(newWorld.theme===k?' on':''));
      t.innerHTML='<div class="sw" style="background:'+T2.tint+'"></div>'+T2.name;
      t.addEventListener('click',function(){newWorld.theme=k;render('worlds');});
      th.appendChild(t);
    });
    wrap.appendChild(th);
    var acts=el('div','acts');
    var b=el('button','btn pri','Create');
    b.addEventListener('click',function(){
      Net.request('createWorld',{name:newWorld.name,theme:newWorld.theme},
        function(r){
          if(!r.ok){U.toast(r.why,'bad');return;}
          U.sync(r.state);
          U.toast('“'+r.world.name+'” is yours.','good');
          LH.Front&&(LH.Front.madeWorld=true);
          LH.Audio&&LH.Audio.play('levelup');
          newWorld.name='';
          panels.worlds.root.dataset.tab='My Worlds';
          panels.worlds.root.querySelectorAll('.tab').forEach(function(x,i){
            x.classList.toggle('on',i===0);});
          render('worlds');
        });
    });
    acts.appendChild(b);
    wrap.appendChild(acts);
    bd.appendChild(wrap);
    return;
  }

  Net.request('myWorlds',{},function(r){
    if(!r.ok)return;
    if(!r.worlds.length){
      bd.appendChild(el('div','empty-note',
        'You do not own a world yet. Make one — the first is free.'));
      return;
    }
    r.worlds.forEach(function(w){
      var Th=R.THEMES[w.theme]||R.THEMES.meadow;
      var card=el('div','wcard');
      card.innerHTML=
        '<div class="badge" style="background:'+Th.tint+'">'+
          (w.name[0]||'W').toUpperCase()+'</div>'+
        '<div class="wi"><h4>'+w.name+'</h4>'+
        '<div class="sub">'+Th.name+' · '+w.blocks+' blocks placed</div></div>'+
        '<div class="perm">'+w.perm+'</div>';
      card.addEventListener('click',function(){
        U.close();
        if(LH.Game&&LH.Game.travelTo)LH.Game.travelTo(w);
      });
      bd.appendChild(card);
    });
    /* permissions live on the same card rather than behind a submenu */
    var note=el('div','empty-note');
    note.style.fontSize='.82cqw';
    note.textContent='Click a world to travel there.';
    bd.appendChild(note);
  });
}

/* ---------------- the world map ----------------
   Drawn from the heightmap, so every cove on it is really there, with
   the districts pinned on top. The panel does three jobs: it tells you
   where you are, it tells you what each place is for before you walk
   across an island to find out, and it lets you go there.

   Places you have not been are pinned but not named. Discovery is
   cheap to implement and it is most of what made a Club Penguin map
   worth opening twice. */
var mapSel=null;
function renderMap(bd){
  var W2=LH.World,G2=LH.Game;
  var cv=W2.mapImage&&W2.mapImage();
  if(!cv){
    bd.appendChild(el('div','empty-note','The island is still loading.'));
    return;
  }
  var snap=Net.snapshot();
  var seen=snap.visited||{};
  var grid=el('div','mapgrid');
  var wrap=el('div','mapwrap');
  /* The same canvas every time this opens: appending it moves it, and
     the browser is happy to re-parent one element forever. */
  wrap.appendChild(cv);

  var here=G2&&G2.player?W2.districtAt(G2.player.pos[0],G2.player.pos[2]):null;
  var ids=W2.districtList();
  ids.forEach(function(id){
    var D2=W2.DISTRICTS[id],pad=T.pad(id);
    if(!pad)return;
    var uv=W2.mapUV(pad.x,pad.z);
    var known=!!seen[id]||id===here||id==='plaza';
    var pin=el('div','pin'+(D2.state==='soon'?' soon':'')+
      (known?'':' unseen')+(mapSel===id?' on':''));
    pin.style.left=(uv[0]*100)+'%';
    pin.style.top=(uv[1]*100)+'%';
    pin.innerHTML='<div class="dot">'+(known?D2.icon:'?')+'</div>'+
      '<div class="lbl">'+(known?D2.name:'Unexplored')+'</div>';
    pin.addEventListener('click',function(){
      mapSel=id;render('map');
    });
    wrap.appendChild(pin);
  });
  /* the residents, so the map answers "where is the person I need" */
  if(G2&&G2.npcs)G2.npcs.forEach(function(a){
    var uv=W2.mapUV(a.pos[0],a.pos[2]);
    var dot=el('div','npcdot');
    dot.style.left=(uv[0]*100)+'%';dot.style.top=(uv[1]*100)+'%';
    dot.title=a.name;
    wrap.appendChild(dot);
  });
  if(G2&&G2.player){
    var uv2=W2.mapUV(G2.player.pos[0],G2.player.pos[2]);
    var you=el('div','you');
    you.style.left=(uv2[0]*100)+'%';you.style.top=(uv2[1]*100)+'%';
    /* The arrow points where the character is facing. North on this
       map is -Z, which is up, so the facing angle needs no correction
       beyond pointing the triangle the right way to start with. */
    you.innerHTML='<b style="transform:translate(-50%,-100%) rotate('+
      (G2.player.facing*180/Math.PI+180).toFixed(1)+'deg)"></b><i></i>';
    wrap.appendChild(you);
  }
  wrap.appendChild(el('div','mapvig'));
  grid.appendChild(wrap);

  /* ---- the side ---- */
  var side=el('div','mapside');
  var sel=mapSel||here||'plaza';
  var D3=W2.DISTRICTS[sel];
  if(D3){
    var known2=!!seen[sel]||sel===here||sel==='plaza';
    var card=el('div','mapcard');
    card.appendChild(el('h3',null,D3.icon+' '+(known2?D3.name:'Unexplored')));
    if(D3.state==='soon')card.appendChild(el('div','tagsoon','Not open yet'));
    if(known2){
      if(D3.who)card.appendChild(el('div','who',D3.who));
      card.appendChild(el('div','blurb',D3.blurb));
      card.appendChild(el('div','doing',D3.doing));
    }else{
      card.appendChild(el('div','blurb',
        'You have not been here. Walk in and the map will fill itself in.'));
    }
    if(sel===here)card.appendChild(el('div','doing','You are here.'));
    else{
      var go=el('button','btn pri','Travel to '+(known2?D3.name:'here'));
      go.addEventListener('click',function(){
        U.close();
        LH.Game.travelDistrict(sel);
      });
      card.appendChild(go);
    }
    side.appendChild(card);
  }
  var list=el('div','maplist');
  ids.forEach(function(id){
    var D4=W2.DISTRICTS[id];
    var known3=!!seen[id]||id===here||id==='plaza';
    var row=el('div','maprow'+(id===sel?' on':''));
    row.innerHTML='<span class="ic">'+(known3?D4.icon:'?')+'</span>'+
      '<span>'+(known3?D4.name:'Unexplored')+'</span>'+
      '<span class="st">'+(id===here?'here':
        (D4.state==='soon'?'soon':(known3?'':'new')))+'</span>';
    row.addEventListener('click',function(){mapSel=id;render('map');});
    list.appendChild(row);
  });
  side.appendChild(list);
  grid.appendChild(side);
  bd.appendChild(grid);
}

/* ---------------- the wardrobe ----------------
   What you look like, as opposed to what you own. The split is the one
   `refreshKit` already implements: this panel sets your *default* look
   and every row of it is free, while an equipped item overrides the
   slot it belongs to for as long as you are wearing it. Some slots —
   hair, shirt, the occupational layer — have both a free default and
   items that can cover it; others — hats, capes, wings, backpacks,
   pets, auras — are items only, which is why `Surprise me` rerolls
   the first group and leaves the second alone.

   Every change applies to the character standing behind the panel the
   instant it is clicked. A wardrobe you have to confirm is a form. */
function dressRow(bd,label,opts,cur,onPick){
  var w=el('div','dressrow');
  w.appendChild(el('div','lb',label));
  var row=el('div','dressopts');
  opts.forEach(function(o){
    var b=el('div','dopt'+(o===cur?' on':''),o);
    b.addEventListener('click',function(){onPick(o);});
    row.appendChild(b);
  });
  w.appendChild(row);
  bd.appendChild(w);
}
function dressSwatch(bd,label,cols,cur,onPick){
  var w=el('div','dressrow');
  w.appendChild(el('div','lb',label));
  var row=el('div','dressopts');
  /* A colour row with nothing marked reads as broken, and the kit is
     full of colours the palettes never offered — shades derived from
     a loud one, a warden's slate grey. So whatever is being worn goes
     on the front of the row if it is not already in it. */
  var norm=String(cur||'').toUpperCase();
  cols=cols.slice();
  var found=false;
  for(var q=0;q<cols.length;q++)
    if(String(cols[q]).toUpperCase()===norm){cur=cols[q];found=true;break;}
  if(!found&&norm)cols.unshift(cur);
  cols.forEach(function(c){
    var b=el('div','dsw'+(c===cur?' on':''));
    b.style.background=c;
    b.addEventListener('click',function(){onPick(c);});
    row.appendChild(b);
  });
  w.appendChild(row);
  bd.appendChild(w);
}

var DRESS_SLOTS=['scale','build','skin','eye','hair','facial','acc',
                 'shirt','pants','shoes','over'];
function renderWardrobe(bd){
  var G2=LH.Game, Body=LH.Body, Cos=LH.Cos;
  if(!G2||!G2.player){
    bd.appendChild(el('div','empty-note','Not in the world yet.'));
    return;
  }
  var k=G2.player.kit;
  var PAL=(LH.Front&&LH.Front.PALETTE)||{skin:[],hair:[],eye:[],wear:[]};
  function touch(){
    if(G2.rememberLook)G2.rememberLook();
    G2.player.scale=k.scale||1;
    render('wardrobe');
  }
  bd.appendChild(el('div','dressnote',
    'This is your default look, and all of it is free to change. '+
    'Anything you have <b>equipped</b> \u2014 a bought hairstyle, a coat, '+
    'a hat, a cape \u2014 wins over the matching row here; take it off in '+
    'your Backpack and this comes back.'));

  dressSwatch(bd,'Skin',PAL.skin,k.skin,function(c){k.skin=c;touch();});
  dressRow(bd,'Build',['slim','base','bulk'],k.build,function(o){
    k.build=o;touch();});
  dressRow(bd,'Hair',Body.HAIR,k.hair.style,function(o){
    k.hair.style=o;touch();});
  dressSwatch(bd,'Hair colour',PAL.hair,k.hair.color,function(c){
    k.hair.color=c;touch();});
  dressRow(bd,'Facial hair',Body.FACIAL,k.facial.style,function(o){
    k.facial.style=o;touch();});
  dressSwatch(bd,'Eyes',PAL.eye,k.eye,function(c){k.eye=c;touch();});
  dressRow(bd,'Worn on the face',Body.ACCESSORIES,k.acc.style,function(o){
    k.acc.style=o;touch();});
  dressSwatch(bd,'That colour',PAL.wear,k.acc.color,function(c){
    k.acc.color=c;touch();});
  dressRow(bd,'Top',Body.SHIRTS,k.shirt.style,function(o){
    k.shirt.style=o;touch();});
  dressRow(bd,'Sleeves',['short','long','none'],k.shirt.sleeve,function(o){
    k.shirt.sleeve=o;touch();});
  dressRow(bd,'Layer',Cos.OVERLAYS,k.over.style,function(o){
    k.over.style=o;touch();});
  dressRow(bd,'Legs',Body.LEGS,k.pants.leg,function(o){
    k.pants.leg=o;touch();});
  dressRow(bd,'Feet',Body.SHOES,k.shoes.style,function(o){
    k.shoes.style=o;touch();});
  dressSwatch(bd,'Clothes',PAL.wear,k.shirt.color,function(c){
    k.shirt.color=c;
    k.pants.color=LH.Geo.shade(c,-52);
    touch();});
  dressSwatch(bd,'Layer colour',PAL.wear,k.over.color,function(c){
    k.over.color=c;touch();});

  var row=el('div','frow');
  var rand=el('button','btn','Surprise me');
  rand.addEventListener('click',function(){
    /* Only the free half is rerolled. A wardrobe that handed out hats
       would be handing out items, and the hat you own would come back
       the moment refreshKit ran. */
    var fresh=LH.Cast.crowd((Math.random()*1e9)|0);
    DRESS_SLOTS.forEach(function(key){
      if(fresh[key]!==undefined)k[key]=fresh[key];
    });
    touch();
  });
  row.appendChild(rand);
  var store=el('button','btn pri','Open the Store');
  store.addEventListener('click',function(){U.open('shop');});
  row.appendChild(store);
  bd.appendChild(row);
}

function section(bd,title){
  var h=el('div','dressnote');
  h.style.cssText='margin:.9cqw 0 .5cqw;font-weight:700;color:var(--ink)';
  h.textContent=title;
  bd.appendChild(h);
}
/* A row of mutually exclusive choices — the same control the wardrobe
   uses for a hairstyle, reused here for a graphics tier, so Settings
   does not invent a fourth kind of button. */
function choiceRow(bd,label,opts,cur,onPick){
  var w=el('div','dressrow');
  w.appendChild(el('div','lb',label));
  var row=el('div','dressopts');
  opts.forEach(function(o){
    var b=el('div','dopt'+(o[0]===cur?' on':''),o[1]);
    b.addEventListener('click',function(){onPick(o[0]);});
    row.appendChild(b);
  });
  w.appendChild(row);
  bd.appendChild(w);
}

function renderMenu(bd){
  var Dv=LH.Device;
  var wrap=el('div');
  wrap.style.cssText='display:flex;flex-direction:column;gap:.55cqw;'+
    'max-width:min(26cqw,420px)';

  /* ---- screen ----
     On a phone this is the first block, because it is the answer to
     "why is there a browser around my game" and to "why is my battery
     going". On a desktop it is still useful and still first. */
  section(wrap,'Screen');
  if(Dv&&Dv.standalone){
    var okrow=el('div','dressnote',
      'Running full screen with no browser around it. Nothing to do here.');
    wrap.appendChild(okrow);
  }else{
    var inst=el('button','btn pri',
      (Dv&&Dv.installable)?'Install Lumen Harbor':'Go full screen');
    inst.addEventListener('click',function(){
      var how=Dv?Dv.install():'manual';
      if(how==='manual')U.toast(
        Dv&&Dv.ios
          ? 'Tap Share, then "Add to Home Screen".'
          : 'Use your browser menu to install or add to home screen.','info');
    });
    wrap.appendChild(inst);
    if(Dv&&Dv.ios&&!Dv.installable){
      var tip=el('div','dressnote',
        'On iPhone and iPad: <b>Share</b> → <b>Add to Home Screen</b>. '+
        'It then opens like an app — no address bar, no tabs.');
      tip.innerHTML=tip.textContent;
      wrap.appendChild(tip);
    }
  }

  /* ---- graphics ----
     Named tiers, not sliders. See LH.Render.TIERS for what each one
     actually turns off. */
  section(wrap,'Graphics');
  var R=LH.Render;
  choiceRow(wrap,'Detail',[[1,'Battery'],[2,'Balanced'],[3,'Full']],
    R.tier,function(t){
      /* Choosing a tier by hand is a decision, not a hint: stop
         second-guessing it. */
      R.auto.on=false;R.auto.scale=1;R.tierCeiling=t;
      U.toast('Graphics: '+R.applyTier(t),'info');
      render('menu');
    });
  var perf=el('div','dressnote');
  perf.textContent=(Dv&&Dv.mobile)
    ? 'Battery drops the occlusion, glow and sun-shaft passes and renders '+
      'a little under native resolution. The world itself never shrinks.'
    : 'Full renders every pass at native resolution.';
  wrap.appendChild(perf);

  /* ---- destinations ---- */
  section(wrap,'Go to');
  [['Backpack','inv'],['Wardrobe','wardrobe'],['Workbench','craft'],
   ['Missions','missions'],['Worlds','worlds'],['Store','shop'],
   ['Trade','trade'],['Friends','profile'],['Map','map']].forEach(function(r){
    var b=el('button','btn',r[0]);
    b.addEventListener('click',function(){U.open(r[1]);});
    wrap.appendChild(b);
  });

  section(wrap,'Progress');
  var save=el('button','btn pri','Save Progress');
  save.addEventListener('click',function(){
    var ok=Net.save();
    U.toast(ok?'Progress saved.':'Could not save.',ok?'good':'bad');
  });
  wrap.appendChild(save);
  bd.appendChild(wrap);
}

/* ---------------- fishing display ---------------- */
var FSTAGE={
  cast:'Cast',sink:'Sinking',wait:'Waiting',strike:'Bite!',reel:'Reeling'
};
/* Name the place as you walk into it. Twice as long the first time,
   because the first time it is a discovery and after that it is a
   reminder. */
var arriveT=0;
U.arrive=function(name,sub,first){
  if(!els.arrive)return;
  els.arrive.querySelector('.nm').textContent=name;
  els.arrive.querySelector('.sb').textContent=sub||'';
  els.arrive.classList.add('on');
  clearTimeout(arriveT);
  arriveT=setTimeout(function(){
    els.arrive.classList.remove('on');
  },first?4200:2200);
};

U.fishing=function(F){
  if(!els.fish)return;
  if(!F.active()){els.fish.classList.remove('on');return;}
  els.fish.classList.add('on');
  els.fstage.textContent=FSTAGE[F.stage]||'';
  var fight=F.fight();
  els.fclass.textContent=fight?({light:'Light',solid:'Solid',
    heavy:'Heavy — careful'})[fight.weightClass]:'';
  if(F.stage==='cast'){
    els.fprog.style.width=Math.round(F.power*100)+'%';
    els.fstrain.style.width='0%';
    els.fhint.innerHTML='Hold to cast further, release to drop the line';
    return;
  }
  if(F.stage==='wait'){
    els.fprog.style.width='0%';els.fstrain.style.width='0%';
    els.fhint.innerHTML='Watch the float…';
    return;
  }
  if(F.stage==='strike'){
    els.fprog.style.width='100%';els.fstrain.style.width='0%';
    els.fhint.innerHTML='<b style="color:var(--acc)">Strike now!</b>';
    return;
  }
  els.fprog.style.width=Math.round(F.progress*100)+'%';
  els.fstrain.style.width=Math.round(F.strain*100)+'%';
  els.fstrainWrap.classList.toggle('hot',F.strain>0.72);
  /* The one instruction that matters, phrased as what to do rather
     than what is happening. */
  els.fhint.innerHTML=fight&&fight.running
    ? '<span class="runs">It is running — give it line</span>'
    : 'Hold to reel it in';
};
U.showCatch=function(r){
  if(!els.catch)return;
  var col=D.rarityCol(r.rarity);
  els.catch.innerHTML=
    '<div class="ic" style="background-image:url('+Icon.of(r.key)+')"></div>'+
    '<h3>'+r.name+'</h3>'+
    '<div class="w">'+r.weight+' kg · worth '+r.value.toLocaleString()+'</div>'+
    '<div class="r" style="color:'+col+'">'+D.RARITY[r.rarity]+'</div>';
  els.catch.classList.add('on');
  clearTimeout(els._catchT);
  els._catchT=setTimeout(function(){els.catch.classList.remove('on');},2600);
};

/* ---------------- world-anchored overlays ----------------
   Damage numbers and enemy nameplates are DOM projected to screen
   space rather than drawn in the scene: text stays crisp, and they
   never fight the depth buffer. */
U.damage=function(sx,sy,amount,kind){
  if(!els.world)return;
  var d=el('div','dmg'+(kind?' '+kind:''),String(amount));
  d.style.left=sx+'px';d.style.top=sy+'px';
  els.world.appendChild(d);
  setTimeout(function(){d.parentNode&&d.parentNode.removeChild(d);},950);
};
var plates=[];
U.plates=function(list){
  if(!els.world)return;
  /* keep the pool the size of the list rather than churning nodes */
  while(plates.length<list.length){
    var p=el('div','plate','<div class="nm"></div><div class="hb"><i></i></div>');
    els.world.appendChild(p);
    plates.push({root:p,nm:p.querySelector('.nm'),hb:p.querySelector('i')});
  }
  for(var i=0;i<plates.length;i++){
    var pl=plates[i], d=list[i];
    if(!d){pl.root.style.display='none';continue;}
    pl.root.style.display='flex';
    pl.root.style.left=d.x+'px';
    pl.root.style.top=d.y+'px';
    pl.root.classList.toggle('boss',!!d.boss);
    if(pl._nm!==d.name){pl.nm.textContent=d.name;pl._nm=d.name;}
    pl.hb.style.width=Math.round(100*d.hp/d.hpMax)+'%';
  }
};

/* ---------------- NPC dialogue ---------------- */
U.dialogue=function(d){
  if(!els.dlg)return;
  if(!d){els.dlg.classList.remove('on');return;}
  els.dlg.innerHTML=
    '<div class="face">'+(d.name[0]||'?')+'</div>'+
    '<div class="txt"><div class="who">'+d.name+'</div>'+
    '<div class="role">'+d.role+'</div>'+
    '<div class="line">'+d.line+'</div>'+
    (d.offer?'<div class="offer">'+d.offer+'</div>':'')+
    '<div class="cls">Press <b>E</b> again to leave</div></div>';
  els.dlg.classList.add('on');
};

/* ---------------- chat ----------------
   Local and simulated, and the module says so: until there is a
   server the other voices in the harbour are fiction. The plumbing is
   real, so wiring it to a socket later is a transport change. */
var chatLines=[];
function stamp(){
  var d=new Date();
  function p2(v){return (v<10?'0':'')+v;}
  return p2(d.getHours())+':'+p2(d.getMinutes());
}
/* Global shows everything; the narrower channels filter. System lines
   appear on every channel, because a line telling you what happened is
   never off-topic. */
function visibleOn(line){
  if(line.ch==='system')return true;
  if(chatChannel==='global')return true;
  return line.ch===chatChannel;
}
function lineHTML(m){
  var ch=m.ch||'global';
  return '<span class="tag '+ch+'">['+ch.charAt(0).toUpperCase()+ch.slice(1)+']</span>'+
    (ch==='system'?'':'<b>'+m.who+':</b> ')+m.text;
}
function repaintChat(){
  if(!els.chatLog)return;
  clear(els.chatLog);
  chatLines.filter(visibleOn).slice(-60).forEach(function(m){
    var ln=el('div','ln');
    ln.innerHTML=lineHTML(m);
    els.chatLog.appendChild(ln);
  });
  els.chatLog.scrollTop=els.chatLog.scrollHeight;
}
U.say=function(who,text,kind,channel){
  var ch=channel||(kind==='sys'?'system':'global');
  chatLines.push({who:who,text:text,at:stamp(),ch:ch});
  while(chatLines.length>120)chatLines.shift();
  if(!els.chatLog)return;
  if(!visibleOn(chatLines[chatLines.length-1]))return;
  var ln=el('div','ln');
  ln.innerHTML=lineHTML(chatLines[chatLines.length-1]);
  els.chatLog.appendChild(ln);
  while(els.chatLog.children.length>60)
    els.chatLog.removeChild(els.chatLog.firstChild);
  els.chatLog.scrollTop=els.chatLog.scrollHeight;
  els.chat.classList.remove('dim');
};
U.focusChat=function(){
  if(!els.chatIn)return;
  els.chat.classList.remove('dim');
  els.chatIn.focus();
};
U.chatFocused=function(){return document.activeElement===els.chatIn;};

/* ---------------- build mode ----------------
   The panel, the palette and the action bar are one control surface:
   picking a block from the palette puts it in your hand, and the tool
   decides what a click does with it. */
U.toggleBuild=function(on){
  buildOn=(on===undefined)?!buildOn:!!on;
  if(els.buildp)els.buildp.classList.toggle('on',buildOn);
  if(els.actbar)els.actbar.classList.toggle('on',buildOn);
  if(els.mnav)els.mnav.children[0].classList.toggle('on',buildOn);
  if(els.menu)els.menu.children[1].classList.toggle('on',buildOn);
  if(!buildOn&&LH.Player)LH.Player.setFly(false);
  U.setTool(buildOn?'place':'place');
  LH.Audio&&LH.Audio.play(buildOn?'open':'close');
  return buildOn;
};
U.setTool=function(t){
  tool=t;
  if(els.btools)Array.prototype.forEach.call(els.btools.children,function(b){
    b.classList.toggle('on',b.getAttribute('data-tool')===t);
  });
  if(els.actbar)Array.prototype.forEach.call(els.actbar.children,function(b){
    var a=b.getAttribute('data-act');
    b.classList.toggle('on',a===t);
  });
};
/* One entry point for the action bar, so a button and its keyboard
   equivalent can never drift apart. */
U.action=function(a){
  LH.Audio&&LH.Audio.play('ui');
  if(a==='flyup'||a==='flydown'){
    if(LH.Player)LH.Player.flyNudge(a==='flyup'?1:-1);
    return;
  }
  if(!buildOn)U.toggleBuild(true);
  U.setTool(a);
};

/* The palette is every placeable item you are carrying, so it grows as
   you gather rather than being a fixed menu. */
U.buildPalette=function(){
  if(!els.bpal)return;
  clear(els.bpal);
  var s=snap||Net.snapshot();
  var keys=Object.keys(s.inv).filter(function(k){
    var it=D.byKey(k);
    return it&&it.placeable;
  }).sort(function(a,b){
    var A=D.byKey(a),B=D.byKey(b);
    return (A.rarity-B.rarity)||A.name.localeCompare(B.name);
  });
  keys.forEach(function(k){
    var b=el('div','bsw'+(hotbar[hotIndex]===k?' on':''));
    b.style.backgroundImage='url('+Icon.of(k)+')';
    b.title=D.byKey(k).name+' ×'+s.inv[k];
    b.addEventListener('click',function(){
      /* drop it into the selected hotbar slot — the palette and the
         hotbar are two views of the same hand */
      U.setSlot(hotIndex,k);
      U.setTool('place');
      if(!buildOn)U.toggleBuild(true);
      U.buildPalette();
      LH.Audio&&LH.Audio.play('ui');
    });
    els.bpal.appendChild(b);
  });
  if(!keys.length){
    var n=el('div','empty-note','Gather something placeable first.');
    n.style.cssText='grid-column:1/-1;font-size:clamp(11px,.7cqw,15px);padding:.6cqw 0';
    els.bpal.appendChild(n);
  }
};
U.setOnline=function(n){if(els.online)els.online.textContent=n;};

U.travelFade=function(on,label){
  if(!els.travel)return;
  els.travel.querySelector('#utravel').textContent=label||'Travelling…';
  els.travel.classList.toggle('on',!!on);
};

U.touchStick=function(st){
  if(!els.tstick)return;
  if(!st||!st.active){els.tstick.classList.remove('on');
    if(els.tsthome)els.tsthome.classList.remove('off');return;}
  els.tstick.classList.add('on');
  if(els.tsthome)els.tsthome.classList.add('off');
  var r=els.tstick.getBoundingClientRect();
  els.tstick.style.left=(st.ox-r.width/2)+'px';
  els.tstick.style.top=(st.oy-r.height/2)+'px';
  var knob=els.tstick.firstChild;
  knob.style.left=(50+(st.x-st.ox)/r.width*100)+'%';
  knob.style.top=(50+(st.y-st.oy)/r.height*100)+'%';
};
U.isTouch=function(){return els.touch&&els.touch.classList.contains('on');};

LH.UI=U;
})();


/* ============================================================
   LH.Front — the title, character creation, and the first steps.

   Three screens over a live world. The camera orbits the plaza
   behind them and the character being built is the actual player
   actor, so character creation is a preview of the thing itself
   rather than a paper doll that has to be kept in sync.

   The onboarding that follows is a checklist rather than a corridor:
   it names the next thing worth doing and gets out of the way when
   you do something else.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,D=LH.Data,Net=LH.Net,Act=LH.Actors,Body=LH.Body,Cos=LH.Cos,Geo=LH.Geo;
var Cast=LH.Cast;
var F={};

var root=null,pane=null,step='title';
var draft=null;
F.active=function(){return step!=='done';};
F.step=function(){return step;};
/* Exposed so anything outside this module can move between screens
   without synthesising clicks on chips it has to find first. */
F.go=function(s){go(s);};

var SKIN=['#F7DCC2','#F2C9A4','#E3AE83','#C98B62','#9C6242','#75462C','#54321F'];
var HAIRC=['#1E1B18','#2B2118','#4A3222','#7A5230','#A87740','#D8B978',
           '#8E3B2E','#2A2E3A','#5C4B8A','#2E6B6B'];
/* Eye colours, brightened. These are multiplied over a white iris
   disc, so what is listed here is what you see — and the old set was
   picked as plausible iris pigments, which on a stylised face at three
   metres is six shades of dark. */
var EYEC=['#5C9EDC','#5FA86A','#A87A46','#4E5A6E','#8A6ED8','#C88A4A',
          '#3FC4C0','#D06A86'];
var WEAR=['#8C93A0','#3E5C7A','#7A3A48','#3A6A4A','#6A5A3A','#4A3A6A',
          '#D8D2C4','#26292F'];
/* The wardrobe offers the same choices as character creation, from the
   same lists. Two palettes that drift apart is how a game ends up with
   a hair colour you can pick once and never again. */
F.PALETTE={skin:SKIN,hair:HAIRC,eye:EYEC,wear:WEAR};

function el(t,c,h){var e=document.createElement(t);if(c)e.className=c;
  if(h!==undefined)e.innerHTML=h;return e;}
function clear(e){while(e.firstChild)e.removeChild(e.firstChild);}

F.init=function(){
  root=document.getElementById('front');
  pane=document.getElementById('frontpane');
  root.classList.add('on');
  document.getElementById('hud').classList.add('hidden');
  render();
  return F;
};

function go(next){
  step=next;
  if(step==='done'){
    root.classList.remove('on');
    document.getElementById('hud').classList.remove('hidden');
    LH.Audio&&LH.Audio.play('open');
    startGuide();
    return;
  }
  render();
}

/* ---------------- screens ---------------- */
function render(){
  clear(pane);
  if(step==='title')return renderTitle();
  if(step==='create')return renderCreate();
  if(step==='ready')return renderReady();
}

function renderTitle(){
  pane.appendChild(el('div','fbrand','Lumen Harbor'));
  pane.appendChild(el('div','fsub','A World Of Your Own'));
  pane.appendChild(el('div','fbody',
    'An island, a rod, a pick, and somewhere of your own to build. '+
    'Fish the harbour, work the quarry, clear the woods, trade what '+
    'you find — and put up whatever you like on land that stays yours.'));
  var row=el('div','frow');
  var play=el('button','fbtn pri','Begin');
  play.addEventListener('click',function(){
    LH.Audio&&LH.Audio.unlock();
    LH.Audio&&LH.Audio.music(true);
    LH.Audio&&LH.Audio.play('ui');
    go('create');
  });
  row.appendChild(play);
  /* Only offer to continue if there is genuinely something saved. */
  if(F.hasSave){
    var cont=el('button','fbtn','Continue');
    cont.addEventListener('click',function(){
      LH.Audio&&LH.Audio.unlock();
      LH.Audio&&LH.Audio.music(true);
      F.resumed=true;
      go('done');
    });
    row.appendChild(cont);
  }
  pane.appendChild(row);
  pane.appendChild(el('div','fbody',
    '<span style="color:var(--ink3);font-size:.86cqw">'+
    'Everything here — every surface, every character, every sound — is '+
    'generated when the page loads. Nothing is downloaded.</span>'));
}

function swatchRow(label,colours,current,onPick){
  var wrap=el('div');
  wrap.appendChild(el('div','flabel',label));
  var row=el('div','swatches');
  colours.forEach(function(c){
    var b=el('div','sw2'+(c===current?' on':''));
    b.style.background=c;
    b.addEventListener('click',function(){onPick(c);});
    row.appendChild(b);
  });
  wrap.appendChild(row);
  return wrap;
}
function optRow(label,opts,current,onPick){
  var wrap=el('div');
  wrap.appendChild(el('div','flabel',label));
  var row=el('div','optrow');
  opts.forEach(function(o){
    var b=el('div','opt'+(o===current?' on':''),o);
    b.addEventListener('click',function(){onPick(o);});
    row.appendChild(b);
  });
  wrap.appendChild(row);
  return wrap;
}

var presetName=Cast.PRESETS[0].name;
function renderCreate(){
  var p=LH.Game&&LH.Game.player;
  if(!p)return;
  if(!draft)draft=p.kit;

  pane.appendChild(el('div','fstep','Step one of two'));
  pane.appendChild(el('div','fbrand','Who Are You'));
  pane.appendChild(el('div','fbody',
    'Start from somebody, then change whatever you like. Everything '+
    'you are not wearing is something you find, earn or buy.'));

  var nameWrap=el('div');
  nameWrap.appendChild(el('div','flabel','Name'));
  var inp=el('input','finp');
  inp.placeholder='Your name';
  inp.maxLength=16;
  inp.value=draft.name||'';
  inp.addEventListener('input',function(){draft.name=inp.value;});
  inp.addEventListener('keydown',function(e){e.stopPropagation();});
  nameWrap.appendChild(inp);
  pane.appendChild(nameWrap);

  function repaint(){
    /* The actor is the preview, so a change is visible immediately in
       the world rather than on a separate doll. */
    render();
  }
  /* Overwrite the draft in place. The draft *is* the player's kit
     object, so replacing the reference would leave the preview wearing
     the old one and nothing on screen would move. */
  function wear(kit){
    var keep=draft.name;
    for(var key in kit)draft[key]=kit[key];
    draft.name=keep;
    if(LH.Game&&LH.Game.player)LH.Game.player.scale=draft.scale||1;
  }

  /* Six finished characters to start from. A first screen of sliders
     asks a player to design somebody before they know what the game
     looks like; a row of people asks them to pick one. */
  var pnames=Cast.PRESETS.map(function(q){return q.name;});
  pane.appendChild(optRow('Start from',pnames,presetName,function(o){
    for(var i=0;i<Cast.PRESETS.length;i++){
      if(Cast.PRESETS[i].name!==o)continue;
      presetName=o;
      wear(Cast.kit(Cast.PRESETS[i].id,7));
      LH.Audio&&LH.Audio.play('ui');
      render();          /* the whole pane, so every row shows the new pick */
      return;
    }
  }));
  var pspec=null;
  for(var pi=0;pi<Cast.PRESETS.length;pi++)
    if(Cast.PRESETS[pi].name===presetName)pspec=Cast.PRESETS[pi];
  if(pspec)pane.appendChild(el('div','fnote',pspec.note));

  var det=el('div','fscroll');
  det.appendChild(swatchRow('Skin',SKIN,draft.skin,function(c){
    draft.skin=c;repaint();}));
  det.appendChild(optRow('Hair',Body.HAIR,draft.hair.style,function(o){
    draft.hair.style=o;repaint();}));
  det.appendChild(swatchRow('Hair colour',HAIRC,draft.hair.color,function(c){
    draft.hair.color=c;repaint();}));
  det.appendChild(optRow('Facial hair',Body.FACIAL,draft.facial.style,
    function(o){draft.facial.style=o;repaint();}));
  det.appendChild(swatchRow('Eyes',EYEC,draft.eye,function(c){
    draft.eye=c;repaint();}));
  det.appendChild(optRow('Build',['slim','base','bulk'],draft.build,function(o){
    draft.build=o;repaint();}));
  det.appendChild(optRow('Headwear',Body.HATS,draft.hat.style,function(o){
    draft.hat.style=o;repaint();}));
  det.appendChild(optRow('Worn on the face',Body.ACCESSORIES,draft.acc.style,
    function(o){draft.acc.style=o;repaint();}));
  det.appendChild(optRow('Top',['tee','jacket','hoodie'],draft.shirt.style,
    function(o){draft.shirt.style=o;repaint();}));
  det.appendChild(optRow('Sleeves',['short','long','none'],draft.shirt.sleeve,
    function(o){draft.shirt.sleeve=o;repaint();}));
  det.appendChild(optRow('Layer',Cos.OVERLAYS,draft.over.style,function(o){
    draft.over.style=o;repaint();}));
  det.appendChild(optRow('Legs',['long','shorts'],draft.pants.leg,function(o){
    draft.pants.leg=o;repaint();}));
  det.appendChild(optRow('Feet',Body.SHOES,draft.shoes.style,function(o){
    draft.shoes.style=o;repaint();}));
  det.appendChild(swatchRow('Clothes',WEAR,draft.shirt.color,function(c){
    draft.shirt.color=c;
    draft.pants.color=Geo.shade(c,-52);
    repaint();}));
  det.appendChild(swatchRow('Layer colour',WEAR,draft.over.color,function(c){
    draft.over.color=c;repaint();}));
  pane.appendChild(det);

  var row=el('div','frow');
  var rand=el('button','fbtn','Surprise me');
  rand.addEventListener('click',function(){
    /* The same rule that dresses the crowd, so a random character is
       still an outfit rather than a bag of colours. */
    wear(Cast.crowd((Math.random()*1e9)|0));
    presetName='';
    LH.Audio&&LH.Audio.play('ui');
    render();
  });
  row.appendChild(rand);
  var next=el('button','fbtn pri','Continue');
  next.addEventListener('click',function(){
    var nm=(draft.name||'').trim();
    if(!nm){LH.UI.toast('Pick a name first.','bad');inp.focus();return;}
    Net.request('setName',{name:nm},function(r){
      if(!r.ok){LH.UI.toast(r.why,'bad');return;}
      /* Lock in what they built, so the first equip does not undo it. */
      LH.Game&&LH.Game.rememberLook&&LH.Game.rememberLook();
      LH.UI.sync(r.state);
      LH.Audio&&LH.Audio.play('ui');
      go('ready');
    });
  });
  row.appendChild(next);
  pane.appendChild(row);
}

function renderReady(){
  pane.appendChild(el('div','fstep','Step two of two'));
  pane.appendChild(el('div','fbrand','Lumen Harbor'));
  pane.appendChild(el('div','fbody',
    'You are arriving at the plaza. The harbour is north, the quarry '+
    'south, the market east. Find the Harbourmaster on the jetty when '+
    'you want to know what to do first.'));
  var keys=el('div','fbody');
  keys.innerHTML=
    '<div style="display:grid;grid-template-columns:auto 1fr;gap:.3cqw 1cqw;'+
    'font-size:.9cqw"><b>WASD</b><span>move</span>'+
    '<b>Space</b><span>jump</span>'+
    '<b>Shift</b><span>run</span>'+
    '<b>Mouse</b><span>look — drag or right-drag</span>'+
    '<b>Left click</b><span>build, break, swing</span>'+
    '<b>E</b><span>interact</span>'+
    '<b>Tab</b><span>backpack</span>'+
    '<b>1–0</b><span>hotbar</span>'+
    '<b>Esc</b><span>menu</span></div>';
  pane.appendChild(keys);
  var row=el('div','frow');
  var b=el('button','fbtn pri','Enter the harbour');
  b.addEventListener('click',function(){
    LH.Audio&&LH.Audio.play('travel');
    go('done');
  });
  row.appendChild(b);
  var back=el('button','fbtn','Back');
  back.addEventListener('click',function(){go('create');});
  row.appendChild(back);
  pane.appendChild(row);
}

/* ---------------- the guided first steps ----------------
   A checklist, not a corridor. Each step names the next thing worth
   doing and completes when you do it — including if you do it by
   accident, which is the whole point. */
var STEPS=[
  {id:'move',   title:'Find your feet',
   text:'Walk with <b>WASD</b> and look around by dragging the mouse.',
   test:function(s){return F.walked>14;}},
  {id:'talk',   title:'Meet the Harbourmaster',
   text:'She is on the jetty, north of the plaza. Press <b>E</b> to talk.',
   test:function(s){return Object.keys(s.met).length>0;}},
  {id:'fish',   title:'Cast a line',
   text:'Stand at the water\\u2019s edge and press <b>E</b>. Hold to cast, '+
        'strike on the bite, then hold to reel — and let go when it runs.',
   test:function(s){return s.stats.caught>0;}},
  {id:'mine',   title:'Work the quarry',
   text:'The face is south, past the woods. Press <b>E</b> to mine it.',
   test:function(s){return s.stats.broken>0;}},
  {id:'plot',   title:'Claim some land',
   text:'The plots are west. Standing on one, press <b>E</b> to claim it — '+
        'the first is free.',
   test:function(s){return s.plots.length>0;}},
  {id:'build',  title:'Put something up',
   text:'Pick a block from the hotbar and left-click to place it.',
   test:function(s){return s.stats.placed>0;}},
  {id:'world',  title:'Make a world of your own',
   text:'The gateway is in the middle of the plaza. Press <b>E</b> at it.',
   test:function(s){return F.madeWorld;}}
];
F.walked=0;
F.madeWorld=false;

var card=null,idx=0,guideOn=false;
function startGuide(){
  if(F.resumed){guideOn=false;return;}
  card=document.createElement('div');
  card.className='guide';
  document.getElementById('hud').appendChild(card);
  guideOn=true;
  idx=0;
  paintGuide();
}
function paintGuide(){
  if(!card)return;
  if(idx>=STEPS.length){
    card.classList.remove('on');
    guideOn=false;
    LH.UI.say('','That is everything. The island is yours to get on with.','sys');
    return;
  }
  var s=STEPS[idx];
  card.innerHTML=
    '<div class="st">First steps · '+(idx+1)+' of '+STEPS.length+'</div>'+
    '<h4>'+s.title+'</h4><p>'+s.text+'</p>'+
    '<div class="pg"><i style="width:'+Math.round(idx/STEPS.length*100)+'%"></i></div>';
  card.classList.add('on');
}
F.tick=function(state){
  if(!guideOn||!card||idx>=STEPS.length)return;
  if(STEPS[idx].test(state)){
    idx++;
    LH.Audio&&LH.Audio.play('pickup');
    paintGuide();
  }
};
F.skipGuide=function(){
  if(card)card.classList.remove('on');
  guideOn=false;
};
F.guiding=function(){return guideOn;};

LH.Front=F;
})();


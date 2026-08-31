/* ============================================================
   LH.Audio — everything you hear, synthesised.

   No sound files, for the same reason there are no texture files:
   the whole game is one document. Effects are short envelopes over
   oscillators and filtered noise; the score is a slow generative
   pad that follows the time of day and swaps its scale when you
   enter your own world.

   Browsers will not start audio without a gesture, so the context
   is created lazily on the first real input and everything before
   that is silently dropped rather than queued.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,A={};

var ctx=null, master=null, sfxBus=null, musicBus=null;
var noiseBuf=null;
A.enabled=true;
A.volume=0.75;
A.musicVolume=0.42;

function ensure(){
  if(ctx)return ctx;
  var C=window.AudioContext||window.webkitAudioContext;
  if(!C)return null;
  ctx=new C();
  master=ctx.createGain();
  master.gain.value=A.volume;
  master.connect(ctx.destination);
  sfxBus=ctx.createGain();sfxBus.gain.value=1;sfxBus.connect(master);
  musicBus=ctx.createGain();musicBus.gain.value=A.musicVolume;
  musicBus.connect(master);
  /* One second of noise, reused by everything that needs a transient:
     footsteps, breaking rock, water. */
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
  var d=noiseBuf.getChannelData(0);
  for(var i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  return ctx;
}
A.unlock=function(){
  ensure();
  if(ctx&&ctx.state==='suspended')ctx.resume();
  return !!ctx;
};
A.ready=function(){return !!ctx;};

function env(node,t0,a,d,peak){
  node.gain.setValueAtTime(0.0001,t0);
  node.gain.exponentialRampToValueAtTime(Math.max(0.0002,peak),t0+a);
  node.gain.exponentialRampToValueAtTime(0.0001,t0+a+d);
}

function tone(freq,dur,type,peak,slideTo,delay){
  if(!ctx||!A.enabled)return;
  var t0=ctx.currentTime+(delay||0);
  var o=ctx.createOscillator(),g=ctx.createGain();
  o.type=type||'sine';
  o.frequency.setValueAtTime(freq,t0);
  if(slideTo)o.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo),t0+dur);
  env(g,t0,Math.min(0.02,dur*0.25),dur,peak===undefined?0.22:peak);
  o.connect(g);g.connect(sfxBus);
  o.start(t0);o.stop(t0+dur+0.06);
}

function noise(dur,peak,cut,q,slideCut,delay){
  if(!ctx||!A.enabled)return;
  var t0=ctx.currentTime+(delay||0);
  var src=ctx.createBufferSource();src.buffer=noiseBuf;
  var f=ctx.createBiquadFilter();
  f.type='bandpass';
  f.frequency.setValueAtTime(cut||1200,t0);
  if(slideCut)f.frequency.exponentialRampToValueAtTime(Math.max(60,slideCut),t0+dur);
  f.Q.value=q||1.1;
  var g=ctx.createGain();
  env(g,t0,0.006,dur,peak===undefined?0.2:peak);
  src.connect(f);f.connect(g);g.connect(sfxBus);
  src.start(t0);src.stop(t0+dur+0.05);
}

/* ---------------- the effect library ----------------
   Each one is a short recipe. Written as data-ish functions rather
   than a switch so adding a sound is a line. */
var SFX={
  step:function(){noise(0.09,0.10,420+Math.random()*260,1.6,180);},
  jump:function(){tone(300,0.14,'triangle',0.16,520);},
  land:function(){noise(0.13,0.20,300,1.2,110);tone(120,0.10,'sine',0.14,70);},
  place:function(){tone(420,0.09,'square',0.10,560);noise(0.07,0.09,900,2,500);},
  break:function(){
    noise(0.22,0.26,900,0.9,220);
    tone(180,0.12,'triangle',0.10,90);
  },
  hit:function(){
    noise(0.10,0.24,1600,1.4,500);
    tone(220,0.09,'sawtooth',0.12,140);
  },
  hurt:function(){tone(300,0.20,'sawtooth',0.16,120);noise(0.12,0.14,700,1.1,240);},
  pickup:function(){
    tone(880,0.07,'sine',0.13);
    tone(1320,0.09,'sine',0.11,undefined,0.05);
  },
  cast:function(){noise(0.26,0.12,2400,0.8,600);},
  splash:function(){noise(0.30,0.20,900,0.7,240);},
  bite:function(){tone(660,0.08,'square',0.14);tone(880,0.10,'square',0.12,undefined,0.07);},
  reel:function(){noise(0.05,0.06,2600,3,2200);},
  snap:function(){tone(1400,0.10,'sawtooth',0.20,300);noise(0.10,0.16,3000,1.4,700);},
  catch:function(){
    /* a small rising arpeggio — the one moment worth a fanfare */
    [523,659,784,1046].forEach(function(f,i){
      tone(f,0.20,'triangle',0.16,undefined,i*0.075);
    });
    noise(0.30,0.12,700,0.8,200);
  },
  levelup:function(){
    [523,659,784,1046,1318].forEach(function(f,i){
      tone(f,0.34,'sine',0.18,undefined,i*0.09);
    });
  },
  ui:function(){tone(1200,0.04,'sine',0.07);},
  open:function(){tone(520,0.09,'sine',0.09,760);},
  close:function(){tone(760,0.08,'sine',0.08,480);},
  deny:function(){tone(200,0.14,'square',0.13,150);},
  coin:function(){
    tone(1568,0.07,'sine',0.10);
    tone(2093,0.08,'sine',0.08,undefined,0.045);
  },
  travel:function(){
    tone(180,0.9,'sine',0.14,720);
    noise(0.9,0.10,400,0.6,3000);
  }
};

A.play=function(name){
  if(!ctx||!A.enabled)return false;
  var f=SFX[name];
  if(!f)return false;
  f();
  return true;
};
A.has=function(name){return !!SFX[name];};

/* Footsteps are rate-limited by distance travelled rather than by a
   timer, so they stay in step whether you walk or sprint. */
var stepAccum=0;
A.footstep=function(distance,surface){
  stepAccum+=distance;
  if(stepAccum<1.9)return;
  stepAccum=0;
  if(!ctx||!A.enabled)return;
  /* soft ground is duller and quieter than stone */
  var soft=(surface==='grass'||surface==='sand'||surface==='dirt');
  noise(soft?0.11:0.08, soft?0.07:0.11,
        soft?(300+Math.random()*180):(900+Math.random()*500),
        soft?1.1:2.0, soft?150:320);
};

/* ---------------- the score ----------------
   A slow pad over a scale that follows the time of day, with a
   sparse melody on top. Generative rather than looped: a loop of any
   length becomes obvious in a game people leave running. */
var musicOn=false, nextNote=0, chordIdx=0;
var SCALES={
  day:   [0,2,4,7,9],        /* major pentatonic — open, unbothered */
  dusk:  [0,2,3,7,9],
  night: [0,2,3,5,7,10],     /* minor — the harbour after dark */
  realm: [0,2,4,6,7,9,11]    /* lydian — your own world, slightly unreal */
};
var ROOT={day:220,dusk:196,night:174.61,realm:233.08};
var pad=null;

function mood(){
  if(LH.Realm&&LH.Realm.inRealm())return 'realm';
  var t=LH.Sky?LH.Sky.time:12;
  if(t<6.2||t>19.6)return 'night';
  if(t<7.6||t>18.0)return 'dusk';
  return 'day';
}

function startPad(){
  if(!ctx||pad)return;
  pad={osc:[],gain:ctx.createGain(),filter:ctx.createBiquadFilter()};
  pad.gain.gain.value=0.0001;
  pad.filter.type='lowpass';
  pad.filter.frequency.value=900;
  pad.filter.Q.value=0.6;
  pad.gain.connect(pad.filter);
  pad.filter.connect(musicBus);
  /* three detuned voices: the beating between them is the whole
     character of the pad */
  for(var i=0;i<3;i++){
    var o=ctx.createOscillator();
    o.type='sawtooth';
    o.detune.value=(i-1)*7;
    o.connect(pad.gain);
    o.start();
    pad.osc.push(o);
  }
  pad.gain.gain.linearRampToValueAtTime(0.055,ctx.currentTime+4);
}

A.music=function(on){
  musicOn=on!==false;
  if(musicOn){ensure();startPad();}
  else if(pad)pad.gain.gain.linearRampToValueAtTime(0.0001,ctx.currentTime+1.5);
};

A.update=function(dt){
  if(!ctx||!musicOn||!A.enabled)return;
  var m=mood();
  var root=ROOT[m], scale=SCALES[m];
  var now=ctx.currentTime;

  if(pad){
    /* the pad walks a slow chord cycle */
    var deg=scale[chordIdx%scale.length];
    var f=root*Math.pow(2,deg/12);
    for(var i=0;i<pad.osc.length;i++){
      pad.osc[i].frequency.setTargetAtTime(f*(i===2?2:1),now,2.2);
    }
    pad.filter.frequency.setTargetAtTime(m==='night'?620:1100,now,3);
  }

  if(now<nextNote)return;
  chordIdx++;
  nextNote=now+(m==='night'?7.5:5.5)+Math.random()*3.5;
  /* one note, sometimes two, high above the pad */
  if(Math.random()<0.72){
    var d1=scale[(Math.random()*scale.length)|0];
    var oct=Math.random()<0.4?3:2;
    var g=ctx.createGain();
    var o=ctx.createOscillator();
    o.type='triangle';
    o.frequency.value=root*Math.pow(2,d1/12+oct);
    env(g,now+0.05,0.6,2.6,0.05);
    o.connect(g);g.connect(musicBus);
    o.start(now);o.stop(now+3.6);
  }
};

A.setVolume=function(v){
  A.volume=M.clamp(v,0,1);
  if(master)master.gain.setTargetAtTime(A.volume,ctx.currentTime,0.05);
};
A.setMusicVolume=function(v){
  A.musicVolume=M.clamp(v,0,1);
  if(musicBus)musicBus.gain.setTargetAtTime(A.musicVolume,ctx.currentTime,0.05);
};
A.mute=function(on){
  A.enabled=!on;
  if(master)master.gain.setTargetAtTime(on?0:A.volume,ctx.currentTime,0.05);
};

LH.Audio=A;
})();


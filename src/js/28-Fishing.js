/* ============================================================
   LH.Fishing — the angling minigame.

   Five stages: cast, sink, wait, strike, reel. The reel is the game:
   a hooked fish runs and tires, and the line has a breaking strain,
   so you give it slack when it fights and pull when it does not. A
   big fish is genuinely harder to land than a small one, which is
   the whole reason the weight matters.

   The server decides what is on the hook the moment it bites — the
   client is told the fight parameters, never the identity, so a
   client that reads its own memory still cannot pick its catch.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,D=LH.Data,Net=LH.Net;
var F={};

F.stage='idle';        /* idle | cast | sink | wait | strike | reel | done */
F.t=0;
F.zone='harbour';
F.bobber=M.v3();
F.power=0;             /* cast charge, 0..1 */

/* live fight state */
var fight=null;
F.fight=function(){return fight;};

/* Tension bar: `pull` is what the player is doing, `strain` is the
   line. Holding pulls the fish in and loads the line; letting go
   recovers the line and lets the fish run. */
F.progress=0;
F.strain=0;
F.pulling=false;

var listeners=[];
F.on=function(fn){listeners.push(fn);};
function emit(ev,data){
  for(var i=0;i<listeners.length;i++)listeners[i](ev,data);
}

/* ---------------- cast ---------------- */
F.canFish=function(){
  var st=Net.snapshot();
  var rodKey=st.equipped.tool;
  var rod=rodKey?D.byKey(rodKey):null;
  if(!rod||rod.cat!=='fishing')return {ok:false,why:'Equip a rod first.'};
  var bait=F.bestBait(st);
  if(!bait)return {ok:false,why:'You have no bait.'};
  return {ok:true,rod:rod,bait:bait};
};
/* Use the best bait you carry: nobody wants to manage a bait slot. */
F.bestBait=function(st){
  var best=null;
  for(var k in st.inv){
    var it=D.byKey(k);
    if(!it||!it.props||!it.props.bait)continue;
    if(!best||it.props.bait>best.props.bait)best=it;
  }
  return best;
};

F.beginCast=function(zone){
  var can=F.canFish();
  if(!can.ok){emit('reject',can.why);return false;}
  F.zone=zone||'harbour';
  F.stage='cast';F.t=0;F.power=0;
  emit('stage','cast');
  return true;
};
/* Charge while held; the longer the cast the better the water. */
F.chargeCast=function(dt){
  if(F.stage!=='cast')return;
  F.power=Math.min(1,F.power+dt*0.85);
};
F.release=function(){
  if(F.stage!=='cast')return;
  F.stage='sink';F.t=0;
  emit('stage','sink');
};

/* ---------------- waiting ---------------- */
function rollWait(){
  var st=Net.snapshot();
  var rod=D.byKey(st.equipped.tool);
  var bait=F.bestBait(st);
  var power=(rod&&rod.props.power)||1;
  var b=(bait&&bait.props.bait)||1;
  /* Better tackle shortens the wait; a long cast helps a little. */
  var base=9.5/(0.7+power*0.5+b*0.25+F.power*0.5);
  return base*(0.55+Math.random()*0.9);
}

F.update=function(dt){
  F.t+=dt;
  switch(F.stage){
    case 'cast': break;
    case 'sink':
      if(F.t>0.7){F.stage='wait';F.t=0;F.waitFor=rollWait();emit('stage','wait');}
      break;
    case 'wait':
      if(F.t>=F.waitFor){
        /* Ask the server what bit. It returns the fight, not the fish. */
        Net.request('hook',{zone:F.zone,power:F.power},function(r){
          if(!r.ok){F.stage='idle';emit('reject',r.why);return;}
          fight=r.fight;
          F.stage='strike';F.t=0;
          F.progress=0.30;F.strain=0;
          emit('stage','strike');
        });
      }
      break;
    case 'strike':
      /* a short window to set the hook */
      if(F.t>0.85){F.stage='idle';fight=null;emit('miss');}
      break;
    case 'reel':
      stepFight(dt);
      break;
  }
};

/* Setting the hook. Miss the window and the fish is gone. */
F.strike=function(){
  if(F.stage!=='strike')return false;
  F.stage='reel';F.t=0;
  emit('stage','reel');
  return true;
};

function stepFight(dt){
  if(!fight)return;
  /* The fish alternates between running and tiring, on its own clock,
     so the player has to read it rather than mash. */
  fight.phase-=dt;
  if(fight.phase<=0){
    fight.running=!fight.running;
    fight.phase=fight.running?(0.5+Math.random()*fight.runLen)
                             :(0.6+Math.random()*0.9);
  }
  var pull=F.pulling?1:0;
  /* progress moves toward you when you pull and the fish is tired,
     away when it runs */
  var gain=pull*(fight.running?-0.16:0.42)+(pull?0:-0.10);
  F.progress=M.clamp(F.progress+gain*dt*fight.rate,0,1);
  /* strain builds while pulling against a running fish */
  var load=pull?(fight.running?1.55:0.42):-1.25;
  F.strain=M.clamp(F.strain+load*dt*fight.strainRate,0,1);

  if(F.strain>=1){
    F.stage='idle';fight=null;F.pulling=false;
    emit('snap');
    return;
  }
  if(F.progress>=1){
    var f=fight;
    fight=null;F.pulling=false;F.stage='done';F.t=0;
    Net.request('land',{token:f.token},function(r){
      if(r.ok)emit('caught',r);
      else emit('reject',r.why);
      F.stage='idle';
    });
  }
}

F.setPull=function(on){F.pulling=!!on;};
F.cancel=function(){
  if(F.stage==='idle')return;
  F.stage='idle';fight=null;F.pulling=false;
  emit('stage','idle');
};
F.active=function(){return F.stage!=='idle';};

LH.Fishing=F;
})();


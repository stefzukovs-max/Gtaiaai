/* ============================================================
   Server handlers for the activities.

   Registered from outside LH.Net rather than written into it, but
   they run inside the same authority: they go through Net.register
   and are the only path by which fishing and combat can move a
   number. The fish is chosen here, at the moment of the bite, and
   the client is handed a fight and an opaque token — never the
   species, and never the weight.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,D=LH.Data,Net=LH.Net,E=LH.Enemies;

/* The one hooked fish, held server-side between `hook` and `land`. */
var hooked=null;
var tokenSeq=1;

/* Weighted pick: rarity is the weight, so the good ones stay rare no
   matter how long you stand there. Luck from the rod, the bait and
   the fishing skill tilts it, but never flattens it. */
function rollFish(zone,luck){
  var pool=D.fishIn(zone);
  if(!pool.length)pool=D.fishIn('harbour');
  var total=0,w=[];
  for(var i=0;i<pool.length;i++){
    /* base weight falls off steeply with rarity; luck lifts the tail */
    var wt=Math.pow(0.30,pool[i].rarity-1)*(1+luck*(pool[i].rarity-1)*0.9);
    w.push(wt);total+=wt;
  }
  var r=Math.random()*total;
  for(var j=0;j<pool.length;j++){
    r-=w[j];
    if(r<=0)return pool[j];
  }
  return pool[0];
}

/* Weight within the species' range, biased small — a record fish
   should be a story, not a Tuesday. */
function rollWeight(it,luck){
  var w=it.props.w;
  var t=Math.pow(Math.random(),2.2-luck*0.6);
  return Math.round((w[0]+(w[1]-w[0])*t)*100)/100;
}

Net.register('hook',function(p,srv){
  var st=Net.snapshot();
  var rod=D.byKey(st.equipped.tool);
  if(!rod||rod.cat!=='fishing')return {ok:false,why:'You are not holding a rod.'};
  var bait=null;
  for(var k in st.inv){
    var it=D.byKey(k);
    if(it&&it.props&&it.props.bait&&(!bait||it.props.bait>bait.props.bait))bait=it;
  }
  if(!bait)return {ok:false,why:'You have no bait.'};

  /* Bait is consumed on the bite, not on the cast: a cast that never
     gets a bite should not cost anything. */
  if(!srv.take(bait.key,1))return {ok:false,why:'You have no bait.'};

  var luck=(rod.props.luck||0)+(bait.props.bait-1)*0.05+
           st.skills.fishing*0.010+(p.power||0)*0.06;
  var fish=rollFish(p.zone||'harbour',luck);
  var weight=rollWeight(fish,luck);
  hooked={item:fish,weight:weight,token:'t'+(tokenSeq++),zone:p.zone};

  /* Fight difficulty scales with weight and rarity, eased by the rod's
     power and the angler's skill. */
  var wr=fish.props.w;
  var size=M.clamp((weight-wr[0])/Math.max(0.01,wr[1]-wr[0]),0,1);
  var heft=Math.log(1+weight)/Math.log(260);
  var pow=rod.props.power||1;
  var skill=1+st.skills.fishing*0.02;

  return {ok:true,fight:{
    token:hooked.token,
    /* how fast the bar moves — a small fish is landed quickly */
    rate:M.clamp(1.35-heft*0.55,0.45,1.4)*skill,
    /* how quickly the line loads while pulling against a run */
    strainRate:M.clamp(0.42+heft*0.85+size*0.30,0.35,1.5)/Math.sqrt(pow),
    /* how long its runs last */
    runLen:0.7+heft*1.9,
    running:true,
    phase:0.5+Math.random()*0.6,
    /* a hint, not the answer: enough to tell a monster from a sprat */
    weightClass:heft>0.62?'heavy':(heft>0.30?'solid':'light')
  }};
});

Net.register('land',function(p,srv){
  if(!hooked||hooked.token!==p.token)
    return {ok:false,why:'Nothing on the line.'};
  var fish=hooked.item, weight=hooked.weight;
  /* checked before the fish is granted, or every catch looks familiar */
  var wasKnown=!!srv.snapshot().collections.fish[fish.key];
  hooked=null;
  if(!srv.give(fish.key,1))return {ok:false,why:'Your bag is full.'};
  var value=D.fishValue(fish,weight);
  srv.xp(Math.min(400,14+fish.rarity*16+Math.round(value*0.04)),'fishing');
  srv.stat('caught');
  Net.request('track',{kind:'catch',key:fish.key,n:1});
  if(fish.rarity>=3)Net.request('track',{kind:'catchRare',key:fish.key,n:1});
  if(!wasKnown)Net.request('track',{kind:'discoverFish',key:fish.key,n:1});
  return {ok:true,key:fish.key,name:fish.name,weight:weight,
    rarity:fish.rarity,value:value,state:srv.snapshot()};
});

/* Combat. The client says which enemy it swung at; the server decides
   whether the swing could have reached, and how much it was worth. */
Net.register('attack',function(p,srv){
  var st=Net.snapshot();
  var wep=D.byKey(st.equipped.tool);
  var dmg=(wep&&wep.props&&wep.props.damage)||3;
  var reach=(wep&&wep.props&&wep.props.reach)||2.0;
  var e=E.byId(p.id);
  if(!e)return {ok:false,why:'Nothing there.'};
  if(e.dead)return {ok:false,why:'Already down.'};
  var d=Math.hypot(e.pos[0]-p.pos[0],e.pos[2]-p.pos[2]);
  if(d>reach+0.9)return {ok:false,why:'Out of reach.'};

  /* skill and buffs are read from the server's own state */
  var mult=1+srv.skill('combat')*0.022+(srv.buff('damage')?0.35:0);
  var roll=dmg*mult*(0.85+Math.random()*0.3);
  var crit=Math.random()<0.08+srv.skill('combat')*0.004;
  if(crit)roll*=1.9;
  roll=Math.round(roll);

  var r=E.damage(e,roll);
  srv.xp(Math.min(200,Math.round(roll*0.5)),'combat');
  var loot=null;
  if(r&&r.killed){
    loot=[];
    var tbl=e.S.loot||[];
    for(var i=0;i<tbl.length;i++){
      if(Math.random()<=tbl[i][2]){
        srv.give(tbl[i][0],tbl[i][1]);
        loot.push([tbl[i][0],tbl[i][1]]);
      }
    }
    srv.coins(Math.round(e.S.xp*1.6));
    srv.xp(Math.min(500,e.S.xp),'combat');
    srv.stat('killed');
    Net.request('track',{kind:'kill',key:e.kind,n:1});
  }
  return {ok:true,damage:roll,crit:crit,killed:!!(r&&r.killed),
    loot:loot,hp:e.hp,hpMax:e.hpMax,state:srv.snapshot()};
});

/* Damage taken. The enemy's own table supplies the number, so a
   client cannot claim it took zero. */
Net.register('takeDamage',function(p,srv){
  /* The enemy's own table supplies the number, so a client cannot
     claim it took zero — or that an enemy that does not exist hit it. */
  var e=E.byId(p.id);
  if(!e)return {ok:false,why:'No such attacker.'};
  var hp=srv.hurt(e.S.dmg);
  return {ok:true,hp:hp,dead:hp<=0,state:srv.snapshot()};
});

/* Respawn: everything you were carrying stays, but the walk back is
   the cost. Losing inventory on death would make a sandbox hostile. */
Net.register('respawn',function(p,srv){
  srv.heal(9999);
  return {ok:true,state:srv.snapshot()};
});

LH.Activities={rollFish:rollFish};
})();


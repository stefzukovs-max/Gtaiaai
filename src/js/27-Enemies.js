/* ============================================================
   LH.Enemies — creatures and the AI that drives them.

   Two kinds of body. Humanoid enemies reuse the player's rig and
   animation library outright — a rogue is an Actor in a dark kit —
   which means every clip written for the player already applies to
   them and a new humanoid enemy costs a palette rather than a mesh.
   Everything else gets its own procedural body.

   One AI state machine covers all of them: idle, patrol, aggro,
   chase, attack, recover, hurt, dead. Behaviour differences are
   numbers in the species table, not branches in the update.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,GL=LH.GL,Geo=LH.Geo,D=LH.Data,T=LH.Terrain,W=LH.World,Act=LH.Actors;
var E={};

/* ---------------- species ---------------- */
var SPECIES={
  slime:{
    name:'Bog Slime',hp:26,dmg:6,speed:1.5,aggro:9,reach:1.5,
    xp:12,level:1,body:'slime',scale:1.0,col:'#6FD08A',
    loot:[['fibre',1,0.7],['clay',1,0.3],['glowmoss',1,0.06]]
  },
  crab:{
    name:'Rock Crab',hp:34,dmg:9,speed:2.1,aggro:8,reach:1.6,
    xp:16,level:2,body:'crab',scale:1.0,col:'#C4685E',
    loot:[['stonechunk',1,0.6],['sandpile',1,0.4],['copper',1,0.12]]
  },
  wisp:{
    name:'Drift Wisp',hp:22,dmg:11,speed:2.8,aggro:12,reach:2.2,
    xp:22,level:4,body:'wisp',scale:1.0,col:'#7FE8FF',fly:1.7,
    loot:[['crystal',1,0.22],['glowmoss',1,0.3],['silver',1,0.1]]
  },
  rogue:{
    name:'Shore Rogue',hp:58,dmg:14,speed:3.4,aggro:13,reach:2.3,
    xp:34,level:6,body:'humanoid',scale:1.0,col:'#54607A',
    kit:{shirt:'jacket',shirtCol:'#3A3F4E',pants:'#23262E',hair:'spiked',
         hairCol:'#1E2028',hat:'none',tool:'sword',toolCol:'#B8C0CC'},
    loot:[['ingot_cu',1,0.4],['rope',1,0.35],['sword_copper',1,0.05]]
  },
  shade:{
    name:'Shade',hp:92,dmg:22,speed:3.8,aggro:15,reach:2.4,
    xp:60,level:12,body:'humanoid',scale:1.06,col:'#2A2438',
    kit:{shirt:'hoodie',shirtCol:'#241E30',pants:'#141020',hair:'long',
         hairCol:'#0E0C16',hat:'none',tool:'sword',toolCol:'#7A5ACC',
         aura:'motes',auraCol:'#8A6ACC'},
    loot:[['voidshard',1,0.3],['ingot_ag',1,0.3],['crystal',1,0.25]]
  },
  guardian:{
    name:'Ancient Guardian',hp:420,dmg:38,speed:2.2,aggro:18,reach:3.4,
    xp:340,level:22,body:'guardian',scale:1.0,col:'#8A8272',boss:true,
    loot:[['mythril',2,0.8],['starcore',1,0.25],['crystal',3,0.9],
          ['hat_crown',1,0.04]]
  }
};
E.SPECIES=SPECIES;
E.list=function(){return Object.keys(SPECIES);};

/* ---------------- bodies ---------------- */
var meshCache={};
function body(kind,fn,maxInst){
  var hit=meshCache[kind];if(hit)return hit;
  var b=Geo.build();fn(b);
  var m=b.upload(maxInst||48);
  m.key='enemy:'+kind;
  meshCache[kind]=m;return m;
}

E.mesh=function(kind){
  if(kind==='slime')return body('slime',function(b){
    b.mat('crystal',0.10);
    /* a squashed dome with a lighter core, so it reads as translucent
       without needing a transparent pass */
    b.loft([
      {y:0.00,pts:Geo.circle(0.62,14)},
      {y:0.24,pts:Geo.circle(0.70,14)},
      {y:0.52,pts:Geo.circle(0.58,14)},
      {y:0.72,pts:Geo.circle(0.30,14)}
    ],'#FFFFFF',{});
    b.mat('blank');
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.20,0.42,0.44);
      b.sphere(0,0,0,0.11,10,8,'#0E1219');
      b.sphere(0.03,0.04,0.06,0.04,8,6,'#FFFFFF');
      b.pop();
    }
    b.mat('crystal',0.35);
    b.sphere(0,0.24,0,0.22,10,8,'#FFFFFF');
  });

  if(kind==='crab')return body('crab',function(b){
    b.mat('cliff');
    b.push();b.translate(0,0.36,0);b.scale(1,0.62,1.15);
    b.sphere(0,0,0,0.62,14,10,'#FFFFFF');
    b.pop();
    b.mat('panel');
    /* eight legs and two claws */
    for(var i=0;i<8;i++){
      var side=i<4?-1:1, t=(i%4)/3;
      b.push();
      b.translate(side*0.5,0.28,-0.34+t*0.7);
      b.rotate(0,0,side*0.7);
      b.cylinder(0,-0.16,0,0.06,0.03,0.44,6,'#D8DEE6');
      b.pop();
    }
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.60,0.30,0.52);b.rotate(0,s*0.4,0);
      b.chamfer(0,0,0,0.24,0.18,0.34,'#D07A6E',0.05);
      b.push();b.translate(0,0.06,0.22);b.rotate(0.4,0,0);
      b.chamfer(0,0,0,0.18,0.08,0.26,'#E08A7A',0.03);b.pop();
      b.pop();
    }
    b.mat('blank');
    for(var e=-1;e<=1;e+=2){
      b.push();b.translate(e*0.18,0.68,0.34);
      b.cylinder(0,0,0,0.05,0.05,0.20,6,'#C4685E');
      b.sphere(0,0.13,0,0.08,8,6,'#0E1219');
      b.pop();
    }
  });

  if(kind==='wisp')return body('wisp',function(b){
    b.mat('neon',1.0);
    b.sphere(0,0,0,0.34,14,10,'#FFFFFF');
    var rng=M.rng(83);
    for(var i=0;i<10;i++){
      var a=rng()*M.TAU, r=0.42+rng()*0.30;
      b.push();
      b.translate(Math.cos(a)*r,(rng()-0.5)*0.6,Math.sin(a)*r);
      b.sphere(0,0,0,0.05+rng()*0.06,6,5,'#FFFFFF');
      b.pop();
    }
    b.mat('blank');
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.12,0.06,0.28);
      b.sphere(0,0,0,0.07,8,6,'#0A0E16');b.pop();
    }
  });

  if(kind==='guardian')return body('guardian',function(b){
    b.mat('cliff');
    /* a stone construct: floating shoulder slabs, no neck, a lit core */
    b.push();b.translate(0,1.9,0);
    b.chamfer(0,0,0,1.5,1.7,1.0,'#FFFFFF',0.16);
    b.pop();
    b.push();b.translate(0,3.1,0);
    b.chamfer(0,0,0,0.95,0.85,0.85,'#E8E2D4',0.14);
    b.pop();
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*1.15,2.6,0);b.rotate(0,0,s*0.16);
      b.chamfer(0,0,0,0.7,0.6,0.9,'#D8D2C2',0.10);b.pop();
      /* arms hang as three floating segments */
      for(var k=0;k<3;k++){
        b.push();b.translate(s*(1.25+k*0.10),2.1-k*0.62,0);
        b.chamfer(0,0,0,0.46-k*0.06,0.5,0.46-k*0.06,'#C4BEB0',0.08);
        b.pop();
      }
      b.push();b.translate(s*0.5,0.7,0);
      b.chamfer(0,0,0,0.62,1.4,0.72,'#B8B2A4',0.10);b.pop();
    }
    b.mat('neon',1.0);
    b.push();b.translate(0,2.1,0.54);
    b.sphere(0,0,0,0.26,12,9,'#FFC46A');b.pop();
    b.push();b.translate(0,3.1,0.44);
    b.chamfer(0,0,0,0.52,0.10,0.06,'#FFC46A',0.02,{noBand:true});b.pop();
  });

  return null;
};

/* ---------------- instances ---------------- */
function Enemy(kind,x,z,opt){
  opt=opt||{};
  var S=SPECIES[kind];
  this.kind=kind;this.S=S;
  this.pos=M.v3(x,W.groundAt(x,z),z);
  this.home=M.v3(x,this.pos[1],z);
  this.vel=M.v3();
  this.facing=Math.random()*M.TAU;
  this.hp=S.hp;this.hpMax=S.hp;
  this.state='idle';
  this.t=0;                  /* time in the current state */
  this.cool=0;               /* attack cooldown */
  this.target=null;
  this.wander=M.v3(x,0,z);
  this.phase=Math.random()*6.28;
  this.dead=false;
  this.deadT=0;
  this.hurtT=0;
  this.id='e'+(E._next++);
  this.leash=opt.leash||22;
  /* Humanoids borrow the player's rig outright. */
  if(S.body==='humanoid'){
    var k=Act.defaultKit(E._next*7919+3);
    var kt=S.kit||{};
    k.shirt.style=kt.shirt||'jacket';k.shirt.color=kt.shirtCol||'#3A3F4E';
    k.shirt.sleeve='long';
    k.pants.color=kt.pants||'#23262E';
    k.hair.style=kt.hair||'crop';k.hair.color=kt.hairCol||'#1E2028';
    k.hat.style=kt.hat||'none';
    k.shoes.color='#191C22';
    k.skin=kt.skin||'#9C8878';
    k.tool.style=kt.tool||'sword';k.tool.color=kt.toolCol||'#B8C0CC';
    if(kt.aura){k.aura.style=kt.aura;k.aura.color=kt.auraCol||'#8A6ACC';}
    this.actor=Act.Actor({x:x,y:this.pos[1],z:z,kit:k,name:S.name});
    this.actor.scale=S.scale||1;
  }
}
E._next=1;
E.Enemy=Enemy;

var live=[];
E.live=live;
E.spawn=function(kind,x,z,opt){
  if(!SPECIES[kind])return null;
  var e=new Enemy(kind,x,z,opt);
  live.push(e);
  return e;
};
E.clear=function(){live.length=0;};

/* ---------------- AI ----------------
   One update for every species. `S` supplies the numbers; the shape of
   the behaviour is identical, which is what keeps adding a creature to
   a table entry rather than a code path. */
var _to=M.v3();
E.update=function(dt,playerPos,onHit){
  for(var i=live.length-1;i>=0;i--){
    var e=live[i], S=e.S;
    e.t+=dt;
    if(e.hurtT>0)e.hurtT-=dt;

    if(e.dead){
      e.deadT+=dt;
      if(e.actor)e.actor.update(dt);
      /* sink and disappear rather than blink out */
      if(e.deadT>0.6)e.pos[1]-=dt*0.9;
      if(e.deadT>2.4)live.splice(i,1);
      continue;
    }

    var dist=M.dist2(e.pos,playerPos);
    var canSee=dist<S.aggro;
    var leashed=M.dist2(e.pos,e.home)>e.leash;

    /* --- transitions --- */
    if(e.state!=='attack'&&e.state!=='recover'){
      if(leashed)e.setState('return');
      else if(canSee&&dist>S.reach)e.setState('chase');
      else if(canSee&&dist<=S.reach&&e.cool<=0)e.setState('attack');
      else if(!canSee&&e.state!=='patrol'&&e.state!=='idle')e.setState('idle');
    }

    e.cool-=dt;
    var speed=0;

    switch(e.state){
      case 'idle':
        /* pause, then pick somewhere nearby to amble to */
        if(e.t>1.2+Math.random()*2.5){
          var a=Math.random()*M.TAU,r=3+Math.random()*7;
          M.set3(e.wander,e.home[0]+Math.cos(a)*r,0,e.home[2]+Math.sin(a)*r);
          e.setState('patrol');
        }
        break;
      case 'patrol':
        speed=S.speed*0.42;
        if(step(e,e.wander,speed,dt)<0.7||e.t>9)e.setState('idle');
        break;
      case 'chase':
        speed=S.speed;
        M.copy3(_to,playerPos);
        step(e,_to,speed,dt);
        if(dist<=S.reach&&e.cool<=0)e.setState('attack');
        break;
      case 'attack':
        /* Wind up, land the blow at a fixed point in the clip, then
           recover. The delay is what makes an attack dodgeable. */
        face(e,playerPos,dt,10);
        if(e.t>0.34&&!e.struck){
          e.struck=true;
          if(dist<=S.reach*1.25&&onHit)onHit(e,S.dmg);
        }
        if(e.t>0.62){e.cool=0.9+Math.random()*0.5;e.setState('recover');}
        break;
      case 'recover':
        if(e.t>0.35)e.setState(canSee?'chase':'idle');
        break;
      case 'return':
        speed=S.speed*0.8;
        if(step(e,e.home,speed,dt)<1.2)e.setState('idle');
        break;
    }

    /* --- placement --- */
    var g=W.groundAt(e.pos[0],e.pos[2]);
    e.pos[1]=S.fly?g+S.fly+Math.sin(e.t*1.6+e.phase)*0.22:g;

    /* --- animation --- */
    if(e.actor){
      e.actor.pos[0]=e.pos[0];e.actor.pos[1]=e.pos[1];e.actor.pos[2]=e.pos[2];
      e.actor.facing=e.facing;
      var st=e.actor.anim.state;
      if(e.hurtT>0.2)e.actor.anim.play('hurt');
      else if(e.state==='attack')e.actor.anim.play('attack');
      else if(speed>0.2){
        e.actor.anim.play('locomote');
        e.actor.anim.params.speed=M.clamp((speed-1.4)/4.0,0,1);
      }else if(st!=='attack'&&st!=='hurt')e.actor.anim.play('idle');
      e.actor.update(dt);
    }
  }
};

Enemy.prototype.setState=function(s){
  if(this.state===s)return;
  this.state=s;this.t=0;
  if(s==='attack')this.struck=false;
};

function step(e,to,speed,dt){
  var dx=to[0]-e.pos[0], dz=to[2]-e.pos[2];
  var d=Math.hypot(dx,dz);
  if(d<0.001)return d;
  e.pos[0]+=dx/d*speed*dt;
  e.pos[2]+=dz/d*speed*dt;
  /* creatures respect buildings too, or a rogue walks through a wall */
  W.resolve(e.pos,0.42,e.pos[1]);
  face(e,to,dt,7);
  return d;
}
function face(e,to,dt,rate){
  var want=Math.atan2(to[0]-e.pos[0],to[2]-e.pos[2]);
  var d=M.angDelta(e.facing,want);
  e.facing+=d*Math.min(1,dt*rate);
}

/* Damage is applied here but authorised elsewhere: LH.Net decides
   whether the hit was legal and how much it was worth. */
E.damage=function(e,amount){
  if(e.dead)return null;
  e.hp-=amount;
  e.hurtT=0.45;
  if(e.hp<=0){
    e.hp=0;e.dead=true;e.deadT=0;
    if(e.actor)e.actor.anim.play('hurt',true);
    return {killed:true,species:e.kind};
  }
  /* being hit interrupts whatever it was doing and makes it angry */
  if(e.state!=='attack')e.setState('chase');
  return {killed:false};
};

/* Nearest living enemy in front of the player, within a weapon's
   reach. Cone rather than a sphere, so a swing has a direction. */
E.pick=function(pos,facing,reach,arc){
  arc=arc||0.9;
  var best=null,bd=reach;
  for(var i=0;i<live.length;i++){
    var e=live[i];
    if(e.dead)continue;
    var dx=e.pos[0]-pos[0], dz=e.pos[2]-pos[2];
    var d=Math.hypot(dx,dz);
    if(d>bd)continue;
    var ang=Math.abs(M.angDelta(facing,Math.atan2(dx,dz)));
    if(ang>arc)continue;
    bd=d;best=e;
  }
  return best;
};
E.byId=function(id){
  for(var i=0;i<live.length;i++)if(live[i].id===id)return live[i];
  return null;
};

/* ---------------- drawing ---------------- */
var _m=M.m4(),_t=M.v3(),_s=M.v3();
E.submit=function(time,playerPos){
  for(var i=0;i<live.length;i++){
    var e=live[i];
    if(M.dist2(e.pos,playerPos)>120)continue;
    if(e.actor){
      Act.submit(e.actor);
      continue;
    }
    var mesh=E.mesh(e.S.body);
    if(!mesh)continue;
    /* a hit flashes white, and a dying creature flattens as it sinks */
    var flash=e.hurtT>0?M.clamp(e.hurtT/0.45,0,1):0;
    var squash=1;
    if(e.kind==='slime')squash=1+Math.sin(e.t*4+e.phase)*0.10;
    if(e.dead)squash=Math.max(0.2,1-e.deadT*0.8);
    M.set3(_t,e.pos[0],e.pos[1],e.pos[2]);
    M.set3(_s,e.S.scale*(2-squash),e.S.scale*squash,e.S.scale*(2-squash));
    M.fromTRS(_m,_t,0,e.facing,0,_s);
    var col=Geo.col3(e.S.col);
    var c=[M.lerp(col[0],2.2,flash),M.lerp(col[1],2.2,flash),
           M.lerp(col[2],2.2,flash)];
    Act.pushInstance(mesh,_m,c,e.kind==='wisp'?0.9:0);
  }
};
E.submitAura=function(time,playerPos){
  for(var i=0;i<live.length;i++){
    var e=live[i];
    if(!e.actor||e.dead)continue;
    if(M.dist2(e.pos,playerPos)>90)continue;
    Act.submitAura(e.actor,time);
  }
};

LH.Enemies=E;
})();


/* ============================================================
   LH.Cosmetic — back items, auras and held objects.

   These are the parts players actually chase, so they get the most
   geometry per part. Everything still binds to a bone: wings and
   capes to the chest, tools to the right hand, auras to the root.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,Geo=LH.Geo,Body=LH.Body,Cos={};
var part=Body.part;
var LIT='#FFFFFF',MID='#D2D2D2',LOW='#A8A8A8',DARK='#7C7C7C',DEEP='#585858';

/* ---------------- wings ---------------- */
/* One feathered wing built along +X; the pair is drawn twice with the
   second mirrored, so a style is written once. */
function featherWing(b,opts){
  var n=opts.feathers||7;
  var span=opts.span||0.62,rise=opts.rise||0.30;
  /* the arm of the wing */
  b.push();b.rotate(0,0,-0.34);
  b.limb(0.30,0.036,0.020,MID,{seg:8,steps:4,joint:false});
  b.pop();
  for(var i=0;i<n;i++){
    var t=i/(n-1);
    /* Primaries at the tip are long and swept; coverts near the body
       are short and stacked. */
    var len=M.lerp(0.20,span,Math.pow(t,0.72));
    var wid=M.lerp(0.090,0.052,t);
    var ax=M.lerp(0.055,0.235,t);
    var ay=M.lerp(-0.010,rise,Math.pow(t,1.25));
    b.push();
    b.translate(ax,ay,-0.010-t*0.012);
    b.rotate(0,0,-0.30-t*0.62);
    b.rotate(0.10*t,0,0);
    /* a feather is a long tapered card with a shaft down the middle */
    b.extrude([
      [0,-wid*0.42],[len*0.55,-wid*0.50],[len,-wid*0.16],
      [len,wid*0.16],[len*0.55,wid*0.50],[0,wid*0.42]
    ],0.014,i>n-4?LIT:MID);
    b.push();b.translate(len*0.5,0,0.009);
    b.chamfer(0,0,0,len,0.008,0.006,LOW,0.003,{noBand:true});
    b.pop();
    b.pop();
  }
}

var WING_BUILD={
  feathered:function(b){b.mat('blank');featherWing(b,{feathers:8,span:0.66,rise:0.32});},
  angelic:function(b){
    b.mat('blank');featherWing(b,{feathers:10,span:0.86,rise:0.42});
    b.mat('neon',0.45);
    b.push();b.translate(0.20,0.20,0);b.sphere(0,0,0,0.045,8,6,LIT);b.pop();
  },
  bat:function(b){
    b.mat('blank');
    /* three fingers with membrane panels stretched between them */
    var fing=[[-0.10,0.34,0.70],[0.10,0.16,0.78],[0.26,-0.06,0.64]];
    b.push();b.rotate(0,0,-0.26);
    b.limb(0.24,0.030,0.018,DARK,{seg:6,steps:3,joint:false});
    b.pop();
    for(var i=0;i<3;i++){
      var f=fing[i];
      b.push();b.translate(0.14,0.02,0);b.rotate(0,0,f[0]);
      b.cylinder(f[2]/2,f[1]/2,0,0.014,0.006,f[2],6,DARK,{open:true});
      b.pop();
    }
    b.push();b.translate(0.42,0.12,-0.004);
    b.extrude([[-0.30,-0.30],[0.34,-0.10],[0.30,0.26],[-0.24,0.30]],0.008,MID);
    b.pop();
  },
  crystal:function(b){
    b.mat('crystal',0.42);
    for(var i=0;i<5;i++){
      var t=i/4;
      b.push();
      b.translate(0.08+t*0.20,-0.02+t*0.34,-0.008-t*0.010);
      b.rotate(0,0,-0.26-t*0.70);
      b.extrude([[0,-0.052],[M.lerp(0.24,0.62,t),-0.014],
                 [M.lerp(0.24,0.62,t),0.014],[0,0.052]],0.020,LIT);
      b.pop();
    }
  },
  mech:function(b){
    /* Overlapping plates fanned from a shared root, like a folding
       blade. Thin struts read as scaffolding rather than a wing —
       the silhouette has to be solid to hold at gameplay distance. */
    b.mat('panel');
    b.push();b.rotate(0,0,-0.26);
    b.chamfer(0.15,0,0,0.32,0.075,0.062,LIT,0.018);
    b.pop();
    for(var i=0;i<4;i++){
      var t=i/3;
      var len=M.lerp(0.38,0.72,t);
      var wid=M.lerp(0.150,0.096,t);
      b.push();
      b.translate(0.20,0.02,-0.010-t*0.013);
      b.rotate(0,0,-0.30-t*0.52);
      /* a plate: root wide, tip swept and narrow */
      b.extrude([
        [0,-wid*0.44],[len*0.62,-wid*0.50],[len,-wid*0.16],
        [len,wid*0.20],[len*0.55,wid*0.46],[0,wid*0.40]
      ],0.026,i%2?LIT:MID);
      /* a lit seam down each plate */
      b.mat('neon',0.85);
      b.push();b.translate(len*0.46,wid*0.06,0.015);
      b.chamfer(0,0,0,len*0.80,0.012,0.008,LIT,0.003,{noBand:true});
      b.pop();
      b.mat('panel');
      b.pop();
    }
    b.mat('neon',0.95);
    b.push();b.translate(0.18,0.05,0.034);
    b.sphere(0,0,0,0.036,8,6,LIT,{squash:0.7});b.pop();
  },
  ember:function(b){
    b.mat('neon',0.8);
    var rng=M.rng(17);
    for(var i=0;i<14;i++){
      var t=rng();
      b.push();
      b.translate(0.06+t*0.52,-0.04+t*0.44+rng()*0.10,(rng()-0.5)*0.06);
      b.sphere(0,0,0,0.020+rng()*0.030,7,6,LIT,{squash:1.4});
      b.pop();
    }
  },
  rainbow:function(b){
    /* Six panes in a fan, each its own hue, each one thin enough that
       the one behind shows through the gap rather than being hidden. */
    var HUE=['#FF5A6E','#FFA23C','#FFE04D','#5BD98A','#4FB8FF','#B269FF'];
    b.mat('blank',0.30);
    for(var i=0;i<6;i++){
      var t=i/5;
      b.push();
      b.translate(0.10+t*0.16,-0.06+t*0.30,-0.006-t*0.008);
      b.rotate(0,0,-0.20-t*0.62);
      b.extrude([[0,-0.046],[M.lerp(0.26,0.60,t),-0.020],
                 [M.lerp(0.26,0.60,t),0.020],[0,0.046]],0.014,HUE[i]);
      b.pop();
    }
  },
  phoenix:function(b){
    b.mat('blank',0.85);
    /* Feathers that get longer and hotter toward the tip. The colour
       ramp is the item — a phoenix wing that is one orange is a leaf. */
    var RAMP=['#FFF0B8','#FFC44D','#FF8A2B','#F2521E','#C42A16'];
    for(var i=0;i<9;i++){
      var t=i/8;
      b.push();
      b.translate(0.08+t*0.22,-0.10+t*0.40,-0.004-t*0.012);
      b.rotate(0,0,-0.14-t*0.80);
      b.extrude([[0,-0.040],[M.lerp(0.24,0.72,t),-0.014],
                 [M.lerp(0.28,0.80,t),0],
                 [M.lerp(0.24,0.72,t),0.014],[0,0.040]],0.016,
                RAMP[Math.min(4,(t*5)|0)]);
      b.pop();
    }
  },
  devil:function(b){
    b.mat('blank');
    /* Bat frame with a barbed trailing edge: three spurs off the
       membrane are what separate a devil wing from a bat one. */
    var fing=[[-0.08,0.36,0.72],[0.12,0.16,0.80],[0.30,-0.10,0.62]];
    b.push();b.rotate(0,0,-0.24);
    b.limb(0.24,0.032,0.018,DEEP,{seg:6,steps:3,joint:false});
    b.pop();
    for(var i=0;i<3;i++){
      var f=fing[i];
      b.push();b.translate(0.14,0.02,0);b.rotate(0,0,f[0]);
      b.cylinder(f[2]/2,f[1]/2,0,0.015,0.006,f[2],7,DEEP,{open:true});
      b.pop();
    }
    b.push();b.translate(0.42,0.10,-0.004);
    b.extrude([[-0.30,-0.32],[0.36,-0.12],[0.30,0.28],[-0.24,0.32]],0.008,MID);
    b.pop();
    for(var q=0;q<3;q++){
      b.push();b.translate(0.62-q*0.16,-0.16+q*0.20,0);b.rotate(0,0,0.5-q*0.4);
      b.extrude([[0,-0.026],[0.10,0],[0,0.026]],0.010,DEEP);
      b.pop();
    }
  },
  bubble:function(b){
    b.mat('glass',0.22);
    for(var i=0;i<7;i++){
      var t=i/6;
      b.push();
      b.translate(0.14+t*0.26,-0.06+t*0.34,-0.004);
      b.scale(1.0,1.0,0.34);
      b.sphere(0,0,0,0.13-t*0.055,12,10,LIT);
      b.pop();
    }
  },
  parrot:function(b){
    b.mat('blank');
    var HUE=['#3BC96B','#FFD24D','#FF7A3C','#E8442E'];
    for(var i=0;i<8;i++){
      var t=i/7;
      b.push();
      b.translate(0.10+t*0.18,-0.08+t*0.34,-0.005-t*0.010);
      b.rotate(0,0,-0.18-t*0.70);
      b.extrude([[0,-0.042],[M.lerp(0.26,0.62,t),-0.016],
                 [M.lerp(0.26,0.62,t),0.016],[0,0.042]],0.015,
                HUE[i%4]);
      b.pop();
    }
  },
  jet:function(b){
    b.mat('panel');
    /* A swept delta with an engine under it, which is a jetpack read
       as a wing rather than as a backpack. */
    b.push();b.translate(0.34,0.10,-0.010);b.rotate(0,0,-0.30);
    b.extrude([[-0.28,-0.10],[0.34,-0.04],[0.28,0.14],[-0.24,0.16]],0.024,LIT);
    b.pop();
    b.push();b.translate(0.20,-0.06,-0.030);b.rotate(0,0,-0.18);
    b.cylinder(0,0,0,0.056,0.048,0.240,12,MID);
    b.pop();
    b.mat('neon',1.0);
    b.push();b.translate(0.14,-0.16,-0.030);
    b.sphere(0,0,0,0.042,10,8,LIT,{squash:1.5});b.pop();
  },
  none:function(b){}
};
Cos.WINGS=Object.keys(WING_BUILD);
Cos.wings=function(style){
  style=WING_BUILD[style]?style:'none';
  return part('wings:'+style,function(b){
    b.mat('blank');
    /* both sides from one description */
    /* Chest-bone space, and that bone moved when the skeleton became
       anatomical: it now sits at 1.325 m with the shoulder line 13 cm
       above it, so the mount is lower and further back than the numbers
       these wings were first written against. */
    b.push();b.translate(0.058,0.058,-0.128);b.rotate(0.10,-0.30,0);
    WING_BUILD[style](b);b.pop();
    b.push();b.translate(-0.058,0.058,-0.128);b.rotate(0.10,0.30,0);
    b.scale(-1,1,1);
    WING_BUILD[style](b);b.pop();
  },96);
};

/* ---------------- occupational layers ----------------
   A coat, a harness, an apron. These are what actually tell you what
   somebody does: the colour of a shirt is a preference, a chest full of
   clipped-on quarry hardware is a job.

   All of them are skinned, in the bind pose, in world metres, built
   from the same rings as the body and the shirt underneath. A coat
   that rode the chest bone rigidly — which is how these were built
   before the figure was skinned — swings its whole skirt from the
   sternum, so a character walking looks like a bell being rung. A
   skinned skirt hangs off the pelvis and stays where a skirt stays.

   Heights worth knowing, all in world metres with the ankle at zero:
     ankle 0.075   knee 0.515   hip joint 0.955   waist 1.070
     nipple 1.325  shoulder 1.457  base of neck 1.475 */
var Bn=Body.bones;
var OVER_INF=0.020;              /* an outer layer, over a shirt */

/* The body of a coat: the torso shell from a hem to the collar. */
function coatBody(b,g,n,lo,hi){
  var secs=Body.torsoShell(g,n,OVER_INF,lo,hi);
  b.loft(secs,LIT,{openTop:true,openBottom:true,uvScale:2});
  return secs;
}
/* The skirt below it. Bound to the pelvis and the lumbar spine rather
   than to the legs, because that is what a coat does: it hangs from
   the hips and the legs move inside it. */
function coatSkirt(b,y0,y1,w0,w1,d0,d1,front,n){
  var steps=7,secs=[];
  for(var i=0;i<=steps;i++){
    var t=i/steps;
    var y=M.lerp(y0,y1,t);
    var pts=Body.sect(M.lerp(w0,w1,t),M.lerp(d0,d1,t),M.lerp(d0,d1,t)*1.06,n,2.4);
    for(var j=0;j<pts.length;j++){
      if(pts[j][1]>0){
        /* the front closes in as the skirt falls, which is what opens
           a coat and gives the legs somewhere to go */
        pts[j][0]*=M.lerp(1.0,0.86,t);
        pts[j][1]*=M.lerp(1.0,front,t);
      }
    }
    secs.push({y:y,pts:pts,
      skin:t<0.25?[Bn.spine,0.5,Bn.hips,0.5]:[Bn.hips,1],
      col:i===0?MID:(i>steps-2?LOW:LIT)});
  }
  b.loft(secs,LIT,{openTop:true,openBottom:true,uvScale:1.8});
}
/* Coat sleeves: the arm's own rings again, grown further than the
   shirt's so the shirt fits inside. A coat with bare arms is a
   waistcoat, and neither of these two is a waistcoat. */
function coatSleeves(b,g,cuff,inf,build){
  for(var s=1;s>=-1;s-=2){
    var rings=Body.armRings(s,build),keep=[];
    for(var i=0;i<rings.length;i++)
      if(rings[i][0]>=cuff-0.0001)keep.push(rings[i]);
    keep.unshift(Body.ringAt(rings,cuff));
    Body.limbLoft(b,s*0.172,keep,16,g,inf,
      {openTop:false,openBottom:true,uvScale:2});
  }
}

/* A standing collar, turned up around the neck. */
function standCollar(b,y,w,d,h,col){
  var lo=Body.sect(w,d,d*1.06,14,2.2), hi=Body.sect(w+0.026,d+0.032,d*1.06+0.020,14,2.2);
  for(var j=0;j<hi.length;j++)if(hi[j][1]>0)hi[j][1]*=1.24;
  b.loft([{y:y,pts:lo,skin:[Bn.chest,0.55,Bn.neck,0.45]},
          {y:y+h,pts:hi,skin:[Bn.neck,1]}],col||MID,
         {openTop:true,openBottom:true});
}

var OVER_BUILD={
  /* Harbourmaster's oilskin: heavy, long, storm collar, brass at the
     shoulder. It is the tallest silhouette in the game on purpose. */
  oilskin:function(b,g,build){
    b.mat('fabric');
    coatBody(b,g,20,1.010,1.500);
    coatSleeves(b,g,0.884,0.022,build);
    coatSkirt(b,1.030,0.560,0.196,0.268,0.130,0.170,0.62,20);
    standCollar(b,1.482,0.104,0.076,0.078,MID);
    /* storm flap down the right of the chest */
    b.skin(Bn.chest,1);
    b.push();b.translate(0.058,1.290,0.150);b.rotate(0,0,0.05);
    b.chamfer(0,0,0,0.120,0.300,0.022,MID,0.010,{noBand:true});b.pop();
    b.mat('gold');
    for(var i=0;i<3;i++){
      b.push();b.translate(0.106,1.380-i*0.098,0.162);
      b.sphere(0,0,0,0.016,8,6,LIT,{squash:0.6});b.pop();
    }
    /* the rank bar across the shoulder */
    b.skin(Bn.shoulderL,0.8,Bn.chest,0.2);
    b.push();b.translate(0.150,1.472,0.010);b.rotate(0,0,-0.22);
    b.chamfer(0,0,0,0.110,0.022,0.086,LIT,0.008,{noBand:true});b.pop();
    b.mat('panel');
    b.skin(Bn.spine,1);
    b.push();
    b.loft([
      {y:1.052,pts:Body.sect(0.156,0.116,0.118,16,2.3)},
      {y:1.104,pts:Body.sect(0.156,0.116,0.118,16,2.3)}
    ],MID,{openTop:true,openBottom:true});
    b.pop();
  },
  /* Warden's longcoat: same family, different intent. Narrower, belted,
     one shoulder plated. */
  longcoat:function(b,g,build){
    b.mat('fabric');
    coatBody(b,g,20,0.990,1.500);
    coatSleeves(b,g,0.884,0.021,build);
    coatSkirt(b,1.010,0.640,0.190,0.250,0.126,0.158,0.56,20);
    standCollar(b,1.482,0.102,0.074,0.090,MID);
    /* asymmetric closure — the diagonal is the whole silhouette */
    b.skin(Bn.chest,0.6,Bn.spine2,0.4);
    b.push();b.translate(-0.036,1.250,0.148);b.rotate(0,0,-0.20);
    b.chamfer(0,0,0,0.150,0.330,0.020,MID,0.009,{noBand:true});b.pop();
    b.mat('panel');
    b.skin(Bn.spine,1);
    b.push();
    b.loft([
      {y:1.048,pts:Body.sect(0.152,0.114,0.116,16,2.3)},
      {y:1.094,pts:Body.sect(0.152,0.114,0.116,16,2.3)}
    ],MID,{openTop:true,openBottom:true});
    b.pop();
    b.push();b.translate(0,1.072,0.126);
    b.chamfer(0,0,0,0.072,0.058,0.026,LIT,0.008);b.pop();
    /* the pauldron, right shoulder only */
    b.skin(Bn.shoulderR,0.75,Bn.armR,0.25);
    b.push();b.translate(-0.176,1.452,0.000);b.rotate(0,0,0.30);
    b.scale(1.0,0.66,1.10);
    b.sphere(0,0,0,0.096,12,9,LIT);b.pop();
    b.push();b.translate(-0.184,1.404,0.000);b.rotate(0,0,0.26);
    b.scale(1.0,0.40,1.02);
    b.sphere(0,0,0,0.092,12,9,MID);b.pop();
  },
  /* Quarry harness. Straps, clips, and a coil of rope over one
     shoulder — the rope is what sells it from behind. */
  harness:function(b,g){
    b.mat('fabric');
    b.skin(Bn.chest,0.7,Bn.spine2,0.3);
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.070,1.300,0.004);b.rotate(0,0,s*0.18);
      b.chamfer(0,0,0,0.050,0.330,0.250,LIT,0.012,{noBand:true});b.pop();
    }
    b.skin(Bn.spine2,1);
    b.push();
    b.loft([
      {y:1.176,pts:Body.sect(0.176,0.130,0.126,16,2.4)},
      {y:1.226,pts:Body.sect(0.176,0.130,0.126,16,2.4)}
    ],MID,{openTop:true,openBottom:true});
    b.pop();
    b.mat('panel');
    b.skin(Bn.chest,1);
    b.push();b.translate(0,1.290,0.152);
    b.chamfer(0,0,0,0.090,0.070,0.026,LIT,0.010);b.pop();
    for(var i=0;i<3;i++){
      b.push();b.translate(-0.116+i*0.026,1.230,0.146);
      b.chamfer(0,0,0,0.022,0.044,0.022,MID,0.005);b.pop();
    }
    /* the coil, over the left shoulder and round the back */
    b.mat('fabric');
    b.skin(Bn.chest,0.6,Bn.shoulderL,0.4);
    b.push();b.translate(-0.140,1.340,-0.110);b.rotate(0.30,0,0.42);
    for(var k=0;k<16;k++){
      var a=k/16*M.TAU;
      b.push();b.translate(Math.cos(a)*0.098,Math.sin(a)*0.098,(k%2)*0.020);
      b.sphere(0,0,0,0.021,6,5,k%2?LIT:MID);b.pop();
    }
    b.pop();
  },
  /* Registry stole. Narrow, exact, fringed — it should look issued
     rather than chosen. */
  stole:function(b,g){
    b.mat('fabric');
    for(var s=-1;s<=1;s+=2){
      b.skin(Bn.chest,0.75,Bn.spine2,0.25);
      b.push();b.translate(s*0.062,1.270,0.152);b.rotate(0,0,s*0.08);
      b.chamfer(0,0,0,0.060,0.360,0.018,LIT,0.007,{noBand:true});b.pop();
      b.push();b.translate(s*0.062,1.270,-0.148);b.rotate(0,0,s*0.08);
      b.chamfer(0,0,0,0.060,0.360,0.018,MID,0.007,{noBand:true});b.pop();
      b.skin(Bn.shoulderL===undefined?Bn.chest:(s>0?Bn.shoulderL:Bn.shoulderR),0.6,
             Bn.chest,0.4);
      b.push();b.translate(s*0.116,1.452,0.006);b.rotate(0,0,s*0.26);
      b.scale(1.0,0.34,1.06);
      b.sphere(0,0,0,0.084,10,8,LIT);b.pop();
      b.skin(Bn.chest,0.5,Bn.spine2,0.5);
      for(var f=0;f<4;f++){
        b.push();b.translate(s*0.062-0.022+f*0.015,1.086,0.152);
        b.cylinder(0,0,0,0.005,0.0025,0.040,5,MID);b.pop();
      }
    }
    b.mat('gold');
    b.skin(Bn.chest,1);
    b.push();b.translate(0,1.386,0.166);
    b.chamfer(0,0,0,0.058,0.026,0.016,LIT,0.005,{noBand:true});
    b.sphere(0,-0.026,0.006,0.020,10,8,LIT,{squash:0.7});b.pop();
  },
  /* Market apron: bib, waist tie, and a pocket band that stands off
     the front. */
  apron:function(b,g){
    b.mat('fabric');
    b.skin(Bn.chest,0.6,Bn.spine2,0.4);
    b.push();b.translate(0,1.276,0.152);
    b.chamfer(0,0,0,0.210,0.320,0.022,LIT,0.012,{noBand:true});b.pop();
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.082,1.400,0.140);b.rotate(0,0,s*0.28);
      b.chamfer(0,0,0,0.034,0.150,0.018,MID,0.007,{noBand:true});b.pop();
    }
    /* the skirt, front only, hanging from the waist tie */
    b.skin(Bn.hips,0.65,Bn.spine,0.35);
    b.push();b.translate(0,0.920,0.146);
    b.extrude([[-0.122,0.140],[0.122,0.140],[0.152,-0.190],[-0.152,-0.190]],
      0.022,LIT);
    b.pop();
    b.skin(Bn.spine,1);
    b.push();
    b.loft([
      {y:1.062,pts:Body.sect(0.152,0.114,0.114,16,2.3)},
      {y:1.104,pts:Body.sect(0.152,0.114,0.114,16,2.3)}
    ],MID,{openTop:true,openBottom:true});
    b.pop();
    /* the pocket, and something in it */
    b.skin(Bn.hips,0.65,Bn.spine,0.35);
    b.push();b.translate(0,1.000,0.170);
    b.chamfer(0,0,0,0.190,0.100,0.034,MID,0.012);b.pop();
    b.mat('planks');
    b.push();b.translate(-0.050,1.046,0.182);b.rotate(0,0,0.18);
    b.cylinder(0,0,0,0.010,0.008,0.072,6,LIT);b.pop();
  },
  /* Tool belt, sitting on the hip line with weight hanging off it. */
  toolbelt:function(b,g){
    b.mat('fabric');
    b.skin(Bn.hips,0.7,Bn.spine,0.3);
    b.push();
    b.loft([
      {y:0.980,pts:Body.sect(0.176,0.128,0.134,16,2.4)},
      {y:1.044,pts:Body.sect(0.176,0.128,0.134,16,2.4)}
    ],LIT,{openTop:true,openBottom:true});
    b.pop();
    b.mat('panel');
    b.push();b.translate(0,1.012,0.140);
    b.chamfer(0,0,0,0.064,0.050,0.024,MID,0.008);b.pop();
    /* pouches at the hips, tools hanging behind them */
    for(var s=-1;s<=1;s+=2){
      b.mat('fabric');
      b.push();b.translate(s*0.176,0.946,0.032);b.rotate(0,s*0.24,0);
      b.chamfer(0,0,0,0.090,0.116,0.080,LIT,0.016);
      b.push();b.translate(0,0.064,0.008);
      b.chamfer(0,0,0,0.096,0.024,0.086,MID,0.008);b.pop();
      b.pop();
      b.mat('panel');
      b.push();b.translate(s*0.186,0.900,-0.076);b.rotate(0.20,0,s*0.10);
      b.cylinder(0,0,0,0.014,0.011,0.150,7,MID);b.pop();
    }
    /* a rag through the belt */
    b.mat('fabric');
    b.push();b.translate(-0.100,0.930,0.130);b.rotate(0.10,0,0.24);
    b.chamfer(0,0,0,0.058,0.116,0.022,MID,0.010,{noBand:true});b.pop();
  },
  /* Plate on both shoulders, nothing else. */
  pauldron:function(b,g){
    b.mat('panel');
    for(var s=-1;s<=1;s+=2){
      b.skin(s>0?Bn.shoulderL:Bn.shoulderR,0.75,s>0?Bn.armL:Bn.armR,0.25);
      b.push();b.translate(s*0.176,1.452,0.000);b.rotate(0,0,s*0.30);
      b.scale(1.0,0.62,1.08);
      b.sphere(0,0,0,0.094,12,9,LIT);b.pop();
      b.push();b.translate(s*0.182,1.406,0.000);b.rotate(0,0,s*0.26);
      b.scale(1.0,0.38,1.00);
      b.sphere(0,0,0,0.090,12,9,MID);b.pop();
    }
    b.skin(Bn.chest,1);
    b.push();b.translate(0,1.420,0.140);
    b.chamfer(0,0,0,0.180,0.056,0.032,MID,0.012);b.pop();
  },
  none:function(b,g){}
};
Cos.OVERLAYS=Object.keys(OVER_BUILD);
Cos.overlay=function(style,build){
  style=OVER_BUILD[style]?style:'none';
  build=build||'base';
  return Body.skinPart('over:'+style+':'+build,function(b){
    b.mat('fabric');
    OVER_BUILD[style](b,Body.girth(build)*Body.overFit(build),build);
  });
};

/* ---------------- cape ----------------
   Skinned to the shoulders at the clasp and to the pelvis at the hem,
   so it hangs from the collarbone and swings with the hips rather than
   rotating rigidly about the sternum. */
/* ---------------- capes ----------------
   There was one cape with a different clasp on it. A cape is defined
   by three things — where it stops, how much cloth is in it, and what
   the hem does — so those are the table, and each style is a row.

   `hem` is what happens to the bottom edge: 0 straight, 1 cut into
   points, 2 torn into ragged strips. `trim` is a band of a second
   material at the edge, which is most of what separates a royal cape
   from a length of red cloth. */
var CAPE_BUILD={
  plain:   {lo:0.640,w:0.290,mat:'fabric',clasp:'panel',hem:0,fold:0.050},
  royal:   {lo:0.360,w:0.360,mat:'fabric',clasp:'gold', hem:0,fold:0.060,
            trim:'gold',collar:1},
  hero:    {lo:0.520,w:0.320,mat:'fabric',clasp:'gold', hem:0,fold:0.030},
  vampire: {lo:0.400,w:0.340,mat:'fabric',clasp:'gold', hem:1,fold:0.045,
            collar:2,inner:'#7A1424'},
  shadow:  {lo:0.480,w:0.300,mat:'fabric',clasp:'panel',hem:2,fold:0.070},
  tattered:{lo:0.560,w:0.270,mat:'fabric',clasp:'panel',hem:2,fold:0.090},
  crystal: {lo:0.620,w:0.280,mat:'crystal',clasp:'crystal',hem:1,fold:0.020,
            emis:0.35},
  blanket: {lo:0.700,w:0.330,mat:'fabric',clasp:'fabric',hem:0,fold:0.080}
};
Cos.CAPES=Object.keys(CAPE_BUILD);
Cos.cape=function(style,build){
  style=CAPE_BUILD[style]?style:'plain';
  build=build||'base';
  var C=CAPE_BUILD[style];
  return Body.skinPart('cape:'+style+':'+build,function(b){
    b.mat(C.mat,C.emis||0);
    /* The cape's own numbers were fixed, so on a broad body its
       shoulders sat inside the shoulders it was hanging from. */
    var cg=Body.girth(build)*Body.overFit(build);
    var n=20,steps=11,secs=[];
    for(var i=0;i<=steps;i++){
      var t=i/steps;
      var y=M.lerp(1.470,C.lo,t);
      var w=M.lerp(0.150*cg,C.w*cg,Math.pow(t,0.85));
      var d=M.lerp(0.100*cg,C.w*0.66*cg,t);
      var pts=Body.sect(w,d,d,n,2.3);
      for(var j=0;j<pts.length;j++){
        /* keep the back: a cape does not wrap the chest */
        if(pts[j][1]>0)pts[j][1]*=0.14;
        else pts[j][1]-=0.030*t;
        /* the fold. More of it makes heavier cloth: a blanket cape has
           deep slow folds, a crystal one has almost none. */
        pts[j][0]*=1+Math.sin(j*2.4)*C.fold*t;
        pts[j][1]*=1+Math.cos(j*2.4)*C.fold*1.2*t;
      }
      /* the hem, on the last ring only */
      if(i===steps&&C.hem){
        for(var h=0;h<pts.length;h++){
          var cut=C.hem===1?(h%2?0.90:1.0)
                           :(0.72+((h*7)%5)*0.07);
          pts[h][0]*=cut;pts[h][1]*=cut;
        }
      }
      var sk=t<0.18?[Bn.chest,0.6,Bn.neck,0.4]
            :(t<0.55?[Bn.chest,0.5,Bn.spine2,0.5]
                    :[Bn.spine,0.4,Bn.hips,0.6]);
      secs.push({y:y,pts:pts,skin:sk,
        col:i<2?MID:(i>steps-2?LOW:LIT)});
    }
    b.loft(secs,LIT,{openTop:true,openBottom:true,uvScale:1.6});
    /* the trim, a band of a second material round the hem */
    if(C.trim){
      b.mat(C.trim);
      var last=secs[secs.length-1];
      b.skin(Bn.spine,0.4,Bn.hips,0.6);
      b.loft([{y:last.y+0.030,pts:last.pts},
              {y:last.y,pts:last.pts}],LIT,
             {openTop:true,openBottom:true,uvScale:2});
    }
    /* a standing collar, for the styles that have one */
    if(C.collar){
      b.mat(C.mat);
      b.skin(Bn.neck,0.6,Bn.chest,0.4);
      var cw=0.108*cg, ch=C.collar===2?0.150:0.086;
      var clo=Body.sect(cw,cw*0.72,cw*0.80,16,2.2);
      var chi=Body.sect(cw*1.42,cw*1.05,cw*1.18,16,2.2);
      for(var k=0;k<chi.length;k++)if(chi[k][1]>0)chi[k][1]*=0.30;
      b.loft([{y:1.428,pts:clo},{y:1.428+ch,pts:chi}],
             C.inner||MID,{openTop:true,openBottom:true});
    }
    /* clasp across the collarbone */
    b.mat(C.clasp);
    b.skin(Bn.chest,0.6,Bn.neck,0.4);
    b.push();b.translate(0,1.462,0.086);
    b.chamfer(0,0,0,0.120,0.022,0.026,LIT,0.008,{noBand:true});
    b.sphere(0,0,0.018,0.022,12,9,MID);
    b.pop();
  });
};

/* ---------------- worn on the back ----------------
   Everything here shares two straps over the shoulders and differs
   in what hangs off them, which is also how a real one is designed. */
function backStraps(b,w,z){
  for(var s=-1;s<=1;s+=2){
    b.skin(s>0?Bn.shoulderL:Bn.shoulderR,0.5,Bn.chest,0.5);
    b.push();b.translate(s*0.082,1.370,z===undefined?-0.020:z);
    b.rotate(0.16,0,0);
    b.chamfer(0,0,0,w||0.040,0.210,0.140,MID,0.012);b.pop();
  }
}
var BACK_BUILD={
  satchel:function(b){
    b.mat('fabric');
    b.skin(Bn.spine2,0.6,Bn.chest,0.4);
    b.push();b.translate(0,1.250,-0.212);
    b.chamfer(0,0,0,0.220,0.280,0.120,LIT,0.026);
    b.mat('panel');
    b.push();b.translate(0,-0.062,0.010);
    b.chamfer(0,0,0,0.230,0.096,0.130,MID,0.020);b.pop();
    b.mat('fabric');
    b.push();b.translate(0,0,0.066);
    b.chamfer(0,0,0,0.196,0.078,0.018,DARK,0.007,{noBand:true});b.pop();
    b.pop();
    backStraps(b);
  },
  rucksack:function(b){
    b.mat('fabric');
    b.skin(Bn.spine2,0.6,Bn.chest,0.4);
    b.push();b.translate(0,1.270,-0.226);
    b.chamfer(0,0,0,0.250,0.330,0.150,LIT,0.040);
    /* a bedroll strapped across the top, and side pockets */
    b.push();b.translate(0,0.190,0.010);b.rotate(0,0,Math.PI/2);
    b.cylinder(0,0,0,0.052,0.052,0.240,12,MID);b.pop();
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.140,-0.040,0.010);
      b.chamfer(0,0,0,0.060,0.150,0.110,MID,0.016);b.pop();
    }
    b.pop();
    backStraps(b,0.048);
  },
  jetpack:function(b){
    b.mat('panel');
    b.skin(Bn.spine2,0.6,Bn.chest,0.4);
    b.push();b.translate(0,1.280,-0.208);
    b.chamfer(0,0,0,0.190,0.240,0.100,LIT,0.026);
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.120,-0.020,-0.010);
      b.cylinder(0,0,0,0.062,0.058,0.320,14,LIT);
      b.push();b.translate(0,-0.176,0);
      b.cylinder(0,0,0,0.050,0.070,0.060,14,MID);b.pop();
      b.pop();
    }
    b.pop();
    b.mat('neon',1.0);
    for(var s2=-1;s2<=1;s2+=2){
      b.push();b.translate(s2*0.120,1.060,-0.218);
      b.sphere(0,0,0,0.046,10,8,LIT,{squash:1.7});b.pop();
    }
    b.mat('panel');
    backStraps(b,0.044);
  },
  astronaut:function(b){
    b.mat('panelw');
    b.skin(Bn.spine2,0.6,Bn.chest,0.4);
    b.push();b.translate(0,1.280,-0.222);
    b.chamfer(0,0,0,0.270,0.320,0.140,LIT,0.044);
    b.mat('panel');
    b.push();b.translate(0,0.060,0.020);
    b.chamfer(0,0,0,0.220,0.070,0.150,MID,0.018);b.pop();
    b.mat('neon',0.8);
    b.push();b.translate(0.076,-0.090,0.076);
    b.sphere(0,0,0,0.024,9,7,'#4FD8FF');b.pop();
    b.push();b.translate(-0.076,-0.090,0.076);
    b.sphere(0,0,0,0.024,9,7,'#FFC44D');b.pop();
    b.pop();
    b.mat('fabric');
    backStraps(b,0.050);
  },
  quiver:function(b){
    b.mat('fabric');
    b.skin(Bn.spine2,0.6,Bn.chest,0.4);
    b.push();b.translate(0.090,1.270,-0.190);b.rotate(0.10,0,-0.34);
    b.cylinder(0,0,0,0.070,0.060,0.360,14,LIT);
    /* arrows: shafts with fletching, poking out of the top */
    b.mat('bark');
    for(var i=0;i<6;i++){
      var a=i/6*M.TAU;
      b.push();b.translate(Math.cos(a)*0.030,0.150,Math.sin(a)*0.030);
      b.cylinder(0,0,0,0.006,0.006,0.180,6,LIT);
      b.push();b.translate(0,0.100,0);
      b.extrude([[-0.004,-0.030],[0.004,-0.030],[0.004,0.030],[-0.004,0.030]],
                0.024,'#D8DDE4');b.pop();
      b.pop();
    }
    b.pop();
    b.mat('fabric');
    backStraps(b,0.036,-0.010);
  },
  guitar:function(b){
    b.mat('planks');
    b.skin(Bn.spine2,0.6,Bn.chest,0.4);
    b.push();b.translate(-0.020,1.180,-0.206);b.rotate(0,0,0.30);
    /* body: two lobes, which is what makes it a guitar and not a plank */
    b.push();b.translate(0,-0.070,0);b.scale(1.0,1.0,0.34);
    b.sphere(0,0,0,0.185,16,12,LIT);b.pop();
    b.push();b.translate(0,0.090,0);b.scale(1.0,1.0,0.32);
    b.sphere(0,0,0,0.150,16,12,LIT);b.pop();
    b.push();b.translate(0,-0.020,0.058);
    b.sphere(0,0,0,0.050,12,9,'#241C18',{squash:0.30});b.pop();
    b.mat('bark');
    b.push();b.translate(0,0.330,0);
    b.chamfer(0,0,0,0.060,0.420,0.040,MID,0.010);b.pop();
    b.push();b.translate(0,0.560,0.010);
    b.chamfer(0,0,0,0.080,0.100,0.036,LIT,0.012);b.pop();
    b.pop();
    b.mat('fabric');
    backStraps(b,0.034,-0.006);
  },
  basket:function(b){
    b.mat('bark');
    b.skin(Bn.spine2,0.6,Bn.chest,0.4);
    b.push();b.translate(0,1.240,-0.216);
    b.loft([{y:-0.150,pts:Geo.circle(0.130,16)},
            {y: 0.150,pts:Geo.circle(0.170,16)}],LIT,{openTop:true});
    /* the weave, as three bands round it */
    for(var w=0;w<3;w++){
      var yy=-0.100+w*0.100;
      b.loft([{y:yy,pts:Geo.circle(0.140+w*0.013,16)},
              {y:yy+0.028,pts:Geo.circle(0.140+w*0.013,16)}],MID,
             {openTop:true,openBottom:true});
    }
    /* the handle */
    for(var h=0;h<9;h++){
      var ah=(-1.0+h/8*2.0);
      b.push();
      b.translate(Math.sin(ah)*0.150,0.150+Math.cos(ah)*0.150,0);
      b.sphere(0,0,0,0.018,7,6,MID);b.pop();
    }
    b.pop();
    b.mat('fabric');
    backStraps(b,0.034);
  },
  ecto:function(b){
    b.mat('panel');
    b.skin(Bn.spine2,0.6,Bn.chest,0.4);
    b.push();b.translate(0,1.270,-0.216);
    b.chamfer(0,0,0,0.230,0.300,0.130,LIT,0.030);
    /* a tank, a coil and a dial: the pack that catches ghosts */
    b.push();b.translate(-0.076,0.020,0.086);
    b.cylinder(0,0,0,0.052,0.052,0.220,12,MID);b.pop();
    b.mat('neon',0.9);
    b.push();b.translate(0.078,0.040,0.086);
    b.sphere(0,0,0,0.052,12,10,'#7FE86A',{squash:0.9});b.pop();
    b.mat('gold');
    for(var c=0;c<5;c++){
      b.push();b.translate(0.078,-0.070+c*0.026,0.086);
      b.loft([{y:0,pts:Geo.circle(0.056,12)},
              {y:0.010,pts:Geo.circle(0.056,12)}],LIT,
             {openTop:true,openBottom:true});b.pop();
    }
    b.pop();
    b.mat('fabric');
    backStraps(b,0.046);
  }
};
Cos.BACKS=Object.keys(BACK_BUILD);
Cos.backpack=function(style,build){
  style=BACK_BUILD[style]?style:'satchel';
  build=build||'base';
  return Body.skinPart('back:'+style+':'+build,function(b){
    BACK_BUILD[style](b);
  });
};

/* ---------------- auras ----------------
   The rarity tell. Drawn additively under the character, so it lights
   the ground the way the 2D build's ground bloom did.  */
Cos.aura=function(kind){
  return part('aura:'+kind,function(b){
    b.mat('neon',1.0);
    if(kind==='ring'){
      for(var k=0;k<30;k++){
        var a=k/30*M.TAU;
        b.push();b.translate(Math.cos(a)*0.44,0.012,Math.sin(a)*0.44);
        b.sphere(0,0,0,0.036,6,5,LIT,{squash:0.30});b.pop();
      }
    }else if(kind==='pillar'){
      for(var i=0;i<10;i++){
        var t=i/9;
        b.push();b.translate(0,t*1.9,0);
        var r=0.40*(1-t*0.55);
        for(var j=0;j<8;j++){
          var aa=j/8*M.TAU+t*1.4;
          b.push();b.translate(Math.cos(aa)*r,0,Math.sin(aa)*r);
          b.sphere(0,0,0,0.030*(1-t*0.5),5,4,LIT);b.pop();
        }
        b.pop();
      }
    }else{ /* motes */
      var rng=M.rng(23);
      for(var m=0;m<24;m++){
        var ang=rng()*M.TAU,rad=0.18+rng()*0.36;
        b.push();
        b.translate(Math.cos(ang)*rad,0.10+rng()*1.5,Math.sin(ang)*rad);
        b.sphere(0,0,0,0.014+rng()*0.018,5,4,LIT);
        b.pop();
      }
    }
  },48);
};

/* ---------------- held objects ----------------
   Built in the hand's space with the grip at the origin, so any tool
   drops into any hand without a per-item offset table. */
var TOOL_BUILD={
  pickaxe:function(b){
    b.mat('planks');
    b.push();b.rotate(0,0,Math.PI/2);
    b.cylinder(0,0.16,0,0.019,0.016,0.66,8,LIT);b.pop();
    b.mat('panel');
    b.push();b.translate(0.34,0,0);
    b.extrude([[-0.05,-0.030],[0.05,-0.030],[0.05,0.030],[-0.05,0.030]],0.048,MID);
    /* two swept tines rather than a symmetric double-head */
    b.push();b.translate(0.02,0.010,0);b.rotate(0,0,0.34);
    b.extrude([[0,-0.026],[0.20,-0.010],[0.21,0.008],[0,0.026]],0.030,LIT);b.pop();
    b.push();b.translate(-0.02,0.010,0);b.rotate(0,0,Math.PI-0.34);
    b.extrude([[0,-0.026],[0.15,-0.010],[0.16,0.008],[0,0.026]],0.030,MID);b.pop();
    b.pop();
  },
  sword:function(b){
    b.mat('planks');
    b.push();b.rotate(0,0,Math.PI/2);
    b.cylinder(0,-0.02,0,0.020,0.022,0.20,8,MID);b.pop();
    b.mat('gold');
    b.push();b.translate(-0.13,0,0);b.sphere(0,0,0,0.030,8,6,LIT);b.pop();
    b.push();b.translate(0.10,0,0);
    b.chamfer(0,0,0,0.036,0.170,0.046,LIT,0.012);b.pop();
    b.mat('panel');
    /* a real blade: a tapered diamond section with a fuller, so it
       catches two highlights instead of reading as a grey stick */
    b.push();b.translate(0.13,0,0);b.rotate(0,0,0);
    b.loft([
      {y:0,   pts:[[0.030,0],[0,0.024],[-0.030,0],[0,-0.024]]},
      {y:0.34,pts:[[0.028,0],[0,0.022],[-0.028,0],[0,-0.022]]},
      {y:0.62,pts:[[0.022,0],[0,0.017],[-0.022,0],[0,-0.017]]},
      {y:0.76,pts:[[0.004,0],[0,0.004],[-0.004,0],[0,-0.004]]}
    ],LIT,{});
    b.pop();
    b.push();b.rotate(0,0,-Math.PI/2);
    b.push();b.translate(0,-0.13,0.011);
    b.chamfer(0,0,0,0.012,0.58,0.006,MID,0.003,{noBand:true});b.pop();
    b.pop();
  },
  axe:function(b){
    b.mat('planks');
    b.push();b.rotate(0,0,Math.PI/2);
    b.cylinder(0,0.12,0,0.020,0.017,0.56,8,LIT);b.pop();
    b.mat('panel');
    b.push();b.translate(0.28,0.02,0);
    b.extrude([[-0.03,-0.10],[0.10,-0.16],[0.16,0],[0.10,0.16],[-0.03,0.10]],0.036,MID);
    b.pop();
  },
  rod:function(b){
    b.mat('planks');
    b.push();b.rotate(0,0,Math.PI/2);
    b.cylinder(0,-0.04,0,0.020,0.021,0.16,8,MID);
    /* the blank tapers hard — a fishing rod that stays thick looks
       like a broom handle */
    b.cylinder(0,0.52,0,0.015,0.004,0.96,8,LIT);
    b.pop();
    b.mat('panel');
    b.push();b.translate(0.10,-0.038,0);
    b.cylinder(0,0,0,0.040,0.040,0.036,10,MID);
    b.push();b.rotate(0,0,Math.PI/2);b.cylinder(0,0.030,0,0.008,0.008,0.06,6,LIT);b.pop();
    b.pop();
    /* line guides */
    for(var i=0;i<4;i++){
      b.push();b.translate(0.26+i*0.20,0.006,0);
      b.cylinder(0,0,0,0.014,0.014,0.005,8,DARK);b.pop();
    }
  },
  wrench:function(b){
    b.mat('panel');
    b.push();b.rotate(0,0,Math.PI/2);
    b.cylinder(0,0.10,0,0.019,0.017,0.30,8,LIT);b.pop();
    b.push();b.translate(0.28,0,0);
    b.extrude([[-0.03,-0.05],[0.05,-0.07],[0.09,-0.03],[0.04,-0.02],
               [0.04,0.02],[0.09,0.03],[0.05,0.07],[-0.03,0.05]],0.030,MID);
    b.pop();
  },
  torch:function(b){
    b.mat('planks');
    b.push();b.rotate(0,0,Math.PI/2);
    b.cylinder(0,0.14,0,0.018,0.016,0.34,8,LIT);b.pop();
    b.mat('neon',1.0);
    b.push();b.translate(0.32,0,0);
    b.sphere(0,0,0,0.050,10,8,'#FFC46A',{squash:1.4});b.pop();
  },
  net:function(b){
    b.mat('planks');
    b.push();b.rotate(0,0,Math.PI/2);
    b.cylinder(0,0.16,0,0.018,0.015,0.48,8,LIT);b.pop();
    b.mat('panel');
    b.push();b.translate(0.36,0,0);b.rotate(0,0,Math.PI/2);
    for(var i=0;i<14;i++){
      var a=i/14*M.TAU;
      b.push();b.translate(Math.cos(a)*0.14,0,Math.sin(a)*0.14);
      b.sphere(0,0,0,0.014,5,4,MID);b.pop();
    }
    b.pop();
    b.mat('fabric');
    b.push();b.translate(0.44,0,0);b.rotate(0,0,Math.PI/2);
    b.loft([
      {y:0,    pts:Geo.circle(0.140,12)},
      {y:-0.10,pts:Geo.circle(0.120,12)},
      {y:-0.20,pts:Geo.circle(0.070,12)}
    ],LOW,{openTop:true});
    b.pop();
  },
  /* Hangs from the grip rather than standing on it: +X here is down
     once the hand rotation is applied, so the body falls below the
     fist and the bail closes over it. */
  lantern:function(b){
    /* The bail arcs back over the fist and the body hangs below it:
       +X in this space is straight down once the hand rotation is
       applied, which is why the loop is drawn into negative X. */
    b.mat('panel');
    b.push();b.rotate(0,0,Math.PI/2);
    for(var k=0;k<9;k++){
      var a=(k/8)*Math.PI;
      b.push();b.translate(Math.cos(a)*0.062,-Math.sin(a)*0.062,0);
      b.sphere(0,0,0,0.011,5,4,MID);b.pop();
    }
    b.pop();
    b.push();b.translate(0.048,0,0);
    b.chamfer(0,0,0,0.036,0.132,0.132,MID,0.014);b.pop();
    b.push();b.translate(0.196,0,0);
    b.chamfer(0,0,0,0.030,0.150,0.150,MID,0.016);b.pop();
    /* four corner posts, then the glass and the flame between them */
    for(var i2=0;i2<4;i2++){
      var aa=i2/4*M.TAU+0.785;
      b.push();b.translate(0.122,Math.cos(aa)*0.058,Math.sin(aa)*0.058);
      b.chamfer(0,0,0,0.150,0.014,0.014,LIT,0.004,{noBand:true});b.pop();
    }
    b.mat('glass');
    b.push();b.rotate(0,0,Math.PI/2);
    b.cylinder(0,0.122,0,0.056,0.056,0.140,12,LIT,{open:true});
    b.pop();
    b.mat('neon',1.0);
    b.push();b.translate(0.126,0,0);
    b.sphere(0,0,0,0.034,10,8,'#FFCE7A',{squash:1.45});b.pop();
    b.mat('panel');
  },
  /* A closed ledger, held against the forearm. Pages are their own
     block a shade lighter than the boards — a single slab reads as a
     brick, and a registrar carrying a brick is not the idea. */
  ledger:function(b){
    b.mat('panel');
    b.push();b.translate(0.070,0.020,0);b.rotate(0,0,-0.30);
    b.chamfer(0,0,0,0.180,0.030,0.250,MID,0.012);
    b.mat('blank');
    b.push();b.translate(0,0.024,-0.008);
    b.chamfer(0,0,0,0.164,0.026,0.232,LIT,0.004,{noBand:true});b.pop();
    b.mat('panel');
    b.push();b.translate(0,0.042,0);
    b.chamfer(0,0,0,0.180,0.026,0.250,MID,0.010);b.pop();
    /* spine and a ribbon marker */
    b.push();b.translate(0,0.022,-0.126);
    b.chamfer(0,0,0,0.180,0.076,0.020,DARK,0.008,{noBand:true});b.pop();
    b.mat('fabric');
    b.push();b.translate(0.030,0.034,0.150);b.rotate(0.10,0,0);
    b.chamfer(0,0,0,0.024,0.010,0.110,LIT,0.004,{noBand:true});b.pop();
    b.mat('gold');
    b.push();b.translate(0,0.058,0.040);
    b.chamfer(0,0,0,0.070,0.010,0.070,LIT,0.004,{noBand:true});b.pop();
    b.pop();
  },
  /* Balance scales. The beam is level, the pans hang: the only thing
     that makes this read at distance is the gap under the pans. */
  scales:function(b){
    /* Beam level, pans hanging. The gap under the pans is the only
       thing that reads at gameplay distance, so the chains are long. */
    b.mat('gold');
    b.push();b.rotate(0,0,Math.PI/2);
    b.cylinder(0,0.110,0,0.020,0.016,0.22,8,MID);b.pop();
    b.push();b.translate(0.220,0,0);
    b.sphere(0,0,0,0.034,10,8,LIT,{squash:0.8});
    b.push();b.rotate(Math.PI/2,0,0);
    b.cylinder(0,0,0,0.013,0.013,0.400,8,LIT);b.pop();
    for(var s2=-1;s2<=1;s2+=2){
      b.push();b.translate(0,0,s2*0.190);
      b.sphere(0,0,0,0.018,8,6,MID);
      for(var k=0;k<2;k++){
        b.push();b.rotate(0,0,Math.PI/2);
        b.cylinder(0,0.048+k*0.092,0,0.006,0.006,0.090,5,MID);b.pop();
      }
      b.push();b.translate(0.186,0,0);b.rotate(0,0,Math.PI/2);
      b.loft([
        {y:0,     pts:Geo.circle(0.096,12)},
        {y:0.038, pts:Geo.circle(0.064,12)}
      ],LIT,{openBottom:true});
      b.pop();
      b.pop();
    }
    b.pop();
  },
  /* Three telescoping tubes and a brass ring at the eyepiece. */
  spyglass:function(b){
    b.mat('panel');
    b.push();b.rotate(0,0,Math.PI/2);
    b.cylinder(0,0.060,0,0.030,0.030,0.120,10,MID);
    b.cylinder(0,0.180,0,0.026,0.026,0.120,10,LIT);
    b.cylinder(0,0.300,0,0.022,0.022,0.120,10,MID);
    b.pop();
    b.mat('gold');
    b.push();b.rotate(0,0,Math.PI/2);
    b.cylinder(0,-0.006,0,0.034,0.034,0.026,10,LIT);
    b.cylinder(0,0.120,0,0.030,0.030,0.018,10,LIT);
    b.cylinder(0,0.240,0,0.026,0.026,0.018,10,LIT);
    b.cylinder(0,0.362,0,0.025,0.025,0.020,10,LIT);
    b.pop();
    b.mat('glass');
    b.push();b.translate(0.366,0,0);b.rotate(0,0,Math.PI/2);
    b.cylinder(0,0,0,0.020,0.020,0.006,10,LIT);b.pop();
  },
  staff:function(b){
    b.mat('bark');
    b.cylinder(0,0.28,0,0.020,0.017,0.86,10,LIT);
    b.mat('crystal',0.55);
    b.push();b.translate(0,0.74,0);
    b.sphere(0,0,0,0.062,14,11,LIT,{squash:0.94});b.pop();
    b.mat('bark');
    for(var i=0;i<5;i++){
      var a=i/5*M.TAU;
      b.push();b.translate(Math.cos(a)*0.048,0.700,Math.sin(a)*0.048);
      b.rotate(0,0,Math.cos(a)*0.4);
      b.sphere(0,0,0,0.017,8,6,MID);b.pop();
    }
  },
  bow:function(b){
    b.mat('bark');
    /* the limbs, as an arc of beads, and one straight string */
    for(var i=0;i<15;i++){
      var t=i/14, a=(-1.15+t*2.30);
      b.push();
      b.translate(Math.sin(a)*0.150-0.150,0.30+Math.cos(a)*0.480,0);
      b.sphere(0,0,0,0.020-Math.abs(t-0.5)*0.016,8,6,t<0.5?LIT:MID);
      b.pop();
    }
    b.mat('fabric');
    b.push();b.translate(-0.150,0.300,0);
    b.cylinder(0,0,0,0.005,0.005,0.870,6,'#E8E2D6');b.pop();
    b.mat('gold');
    b.push();b.translate(-0.150,0.300,0);
    b.chamfer(0,0,0,0.036,0.090,0.032,LIT,0.008);b.pop();
  },
  hammer:function(b){
    b.mat('bark');
    b.cylinder(0,0.22,0,0.021,0.018,0.62,10,LIT);
    b.mat('panel');
    b.push();b.translate(0,0.58,0);b.rotate(0,0,Math.PI/2);
    b.cylinder(0,0,0,0.070,0.062,0.190,12,LIT);b.pop();
    b.push();b.translate(0,0.58,0);
    b.chamfer(0,0,0,0.210,0.104,0.108,MID,0.014);b.pop();
  },
  shovel:function(b){
    b.mat('bark');
    b.cylinder(0,0.30,0,0.019,0.016,0.66,10,LIT);
    b.push();b.translate(0,0.660,0);
    b.chamfer(0,0,0,0.090,0.060,0.024,MID,0.010);b.pop();
    b.mat('panel');
    b.push();b.translate(0,-0.060,0.010);b.rotate(0.10,0,0);
    b.extrude([[-0.078,-0.110],[0.078,-0.110],[0.086,0.070],[-0.086,0.070]],
              0.016,LIT);
    b.pop();
  },
  umbrella:function(b){
    b.mat('bark');
    b.cylinder(0,0.26,0,0.014,0.012,0.72,8,MID);
    b.push();b.translate(0,-0.120,0.028);b.rotate(0.9,0,0);
    b.cylinder(0,0,0,0.014,0.012,0.090,8,MID);b.pop();
    b.mat('fabric');
    /* eight panels rather than a cone, so the edge is scalloped */
    for(var i=0;i<8;i++){
      var a=i/8*M.TAU;
      b.push();b.translate(0,0.560,0);b.rotate(0,a,0);
      b.extrude([[0,0],[0.150,-0.170],[0.190,-0.150],[0.040,0.030]],
                0.010,i%2?LIT:MID);
      b.pop();
    }
    b.push();b.translate(0,0.620,0);
    b.sphere(0,0,0,0.024,10,8,MID);b.pop();
  },
  wand:function(b){
    b.mat('bark');
    b.cylinder(0,0.16,0,0.012,0.008,0.34,8,LIT);
    b.mat('neon',1.0);
    b.push();b.translate(0,0.350,0);
    /* a five-pointed star, as five wedges from a hub */
    for(var i=0;i<5;i++){
      b.push();b.rotate(0,0,i/5*M.TAU);
      b.extrude([[-0.020,0],[0.020,0],[0,0.086]],0.014,LIT);
      b.pop();
    }
    b.pop();
  },
  shield:function(b){
    b.mat('panel');
    b.push();b.translate(0,0.28,0);
    b.loft([{y:-0.230,pts:Geo.roundRect(0.070,0.050,0.030,10)},
            {y:-0.090,pts:Geo.roundRect(0.290,0.070,0.050,12)},
            {y: 0.130,pts:Geo.roundRect(0.330,0.076,0.060,12)},
            {y: 0.230,pts:Geo.roundRect(0.280,0.070,0.055,12)}],LIT,{});
    b.mat('gold');
    b.push();b.translate(0,0.020,0.044);
    b.sphere(0,0,0,0.060,14,10,LIT,{squash:0.42});b.pop();
    b.pop();
  },
  flashlight:function(b){
    b.mat('panel');
    b.cylinder(0,0.10,0,0.028,0.026,0.220,10,LIT);
    b.push();b.translate(0,0.230,0);
    b.cylinder(0,0,0,0.030,0.048,0.070,12,MID);b.pop();
    b.mat('neon',1.0);
    b.push();b.translate(0,0.264,0);b.scale(1.0,0.3,1.0);
    b.sphere(0,0,0,0.046,12,9,'#FFF0C0');b.pop();
  },
  none:function(b){}
};
Cos.TOOLS=Object.keys(TOOL_BUILD);
Cos.tool=function(style){
  style=TOOL_BUILD[style]?style:'none';
  return part('tool:'+style,function(b){
    b.mat('blank');
    /* grip at the origin, shaft running along the hand's -Y.
       Everything in TOOL_BUILD was measured against the old cartoon
       hand, which was a third larger than the one it now sits in. */
    b.push();b.scale(0.82,0.82,0.82);
    b.rotate(0,0,-Math.PI/2);
    TOOL_BUILD[style](b);
    b.pop();
  },48);
};

/* ---------------- pets ---------------- */
var PET_BUILD={
  cat:function(b){
    b.mat('blank');
    b.loft([
      {y:0.06,pts:Geo.roundRect(0.14,0.24,0.06,10)},
      {y:0.14,pts:Geo.roundRect(0.17,0.30,0.07,10)},
      {y:0.20,pts:Geo.roundRect(0.14,0.24,0.06,10)}
    ],LIT,{});
    b.push();b.translate(0,0.24,0.13);
    b.sphere(0,0,0,0.085,10,8,LIT,{squash:0.92});
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.045,0.070,-0.01);b.rotate(0,0,s*0.24);
      b.extrude([[-0.028,0],[0.028,0],[0,0.062]],0.014,MID);b.pop();
    }
    b.sphere(0,-0.010,0.076,0.020,8,6,MID);
    b.pop();
    for(var i=0;i<4;i++){
      b.push();b.translate((i<2?0.055:-0.055),0.03,(i%2?0.09:-0.09));
      b.cylinder(0,0,0,0.026,0.024,0.10,6,MID);b.pop();
    }
    b.push();b.translate(0,0.18,-0.16);b.rotate(-0.7,0,0);
    b.cylinder(0,0.09,0,0.022,0.012,0.22,6,MID);b.pop();
  },
  drone:function(b){
    b.mat('panel');
    b.push();b.translate(0,0.20,0);
    b.chamfer(0,0,0,0.20,0.13,0.20,LIT,0.035);
    b.mat('neon',0.9);
    b.push();b.translate(0,0,0.10);b.sphere(0,0,0,0.045,10,8,'#4FD8FF',{squash:0.8});b.pop();
    b.mat('panel');
    for(var i=0;i<4;i++){
      var a=i/4*M.TAU+0.785;
      b.push();b.translate(Math.cos(a)*0.15,0.02,Math.sin(a)*0.15);
      b.cylinder(0,0,0,0.055,0.055,0.012,10,MID);b.pop();
    }
    b.pop();
  },
  sprite:function(b){
    b.mat('neon',1.0);
    b.push();b.translate(0,0.34,0);
    b.sphere(0,0,0,0.085,12,9,LIT);
    for(var i=0;i<7;i++){
      var a=i/7*M.TAU;
      b.push();b.translate(Math.cos(a)*0.14,Math.sin(a)*0.06,Math.sin(a)*0.14);
      b.sphere(0,0,0,0.026,6,5,LIT);b.pop();
    }
    b.pop();
  },
  bunny:function(b){
    b.mat('blank');
    b.push();b.translate(0,0.13,0);b.scale(1.0,1.0,1.25);
    b.sphere(0,0,0,0.115,14,11,LIT);b.pop();
    b.push();b.translate(0,0.235,0.105);
    b.sphere(0,0,0,0.088,14,11,LIT,{squash:0.94});
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.035,0.090,-0.014);b.rotate(-0.16,0,s*0.16);
      b.scale(0.46,1.0,0.40);
      b.sphere(0,0.075,0,0.070,10,9,LIT);
      b.push();b.translate(0,0.075,0.038);b.scale(0.7,0.86,0.4);
      b.sphere(0,0,0,0.058,9,7,'#F2C6CC');b.pop();
      b.pop();
    }
    b.sphere(0,-0.014,0.074,0.017,8,6,'#F2C6CC');
    b.sphere(-0.030,0.014,0.070,0.013,7,6,'#241C22');
    b.sphere( 0.030,0.014,0.070,0.013,7,6,'#241C22');
    b.pop();
    for(var i=0;i<4;i++){
      b.push();b.translate((i<2?0.052:-0.052),0.036,(i%2?0.062:-0.070));
      b.sphere(0,0,0,0.038,8,7,MID,{squash:1.1});b.pop();
    }
    b.push();b.translate(0,0.150,-0.128);
    b.sphere(0,0,0,0.048,10,9,'#F6F4F0');b.pop();
  },
  slime:function(b){
    b.mat('crystal',0.32);
    /* Three stacked domes with a wobble, so it reads as something that
       would move if you poked it. */
    b.push();b.translate(0,0.090,0);b.scale(1.16,1.0,1.10);
    b.sphere(0,0,0,0.145,16,12,LIT,{squash:0.78});b.pop();
    b.push();b.translate(0.020,0.180,-0.010);b.scale(1.0,1.0,0.94);
    b.sphere(0,0,0,0.090,14,11,LIT,{squash:0.86});b.pop();
    b.mat('blank');
    b.push();b.translate(-0.042,0.120,0.108);
    b.sphere(0,0,0,0.026,9,8,'#141018',{squash:0.9});b.pop();
    b.push();b.translate(0.042,0.120,0.108);
    b.sphere(0,0,0,0.026,9,8,'#141018',{squash:0.9});b.pop();
  },
  puppy:function(b){
    b.mat('blank');
    b.loft([
      {y:0.075,pts:Geo.roundRect(0.150,0.250,0.065,12)},
      {y:0.165,pts:Geo.roundRect(0.180,0.300,0.075,12)},
      {y:0.225,pts:Geo.roundRect(0.140,0.230,0.060,12)}
    ],LIT,{});
    b.push();b.translate(0,0.250,0.150);
    b.sphere(0,0,0,0.098,14,11,LIT,{squash:0.96});
    b.push();b.translate(0,-0.026,0.082);b.scale(1.0,0.8,1.2);
    b.sphere(0,0,0,0.048,10,8,MID);b.pop();
    b.sphere(0,-0.020,0.128,0.020,8,6,'#241C22');
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.072,0.020,-0.020);b.rotate(0,0,s*0.30);
      b.scale(0.36,1.0,0.72);
      b.sphere(0,-0.048,0,0.070,10,8,MID);b.pop();
    }
    b.sphere(-0.036,0.022,0.078,0.015,7,6,'#241C22');
    b.sphere( 0.036,0.022,0.078,0.015,7,6,'#241C22');
    b.pop();
    for(var i=0;i<4;i++){
      b.push();b.translate((i<2?0.062:-0.062),0.036,(i%2?0.100:-0.098));
      b.cylinder(0,0,0,0.032,0.030,0.110,8,MID);b.pop();
    }
    b.push();b.translate(0,0.220,-0.190);b.rotate(-0.9,0,0);
    b.cylinder(0,0.080,0,0.026,0.016,0.170,8,MID);b.pop();
  },
  dragon:function(b){
    b.mat('blank');
    b.push();b.translate(0,0.170,0);b.scale(1.0,1.0,1.30);
    b.sphere(0,0,0,0.120,14,11,LIT);b.pop();
    b.push();b.translate(0,0.240,0.135);
    b.scale(1.0,0.86,1.30);
    b.sphere(0,0,0,0.086,14,11,LIT);b.pop();
    /* the snout, the horns and the wings */
    b.push();b.translate(0,0.212,0.230);b.scale(1.0,0.72,1.0);
    b.sphere(0,0,0,0.052,10,8,MID);b.pop();
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.042,0.310,0.100);b.rotate(-0.4,0,s*0.26);
      b.cylinder(0,0.040,0,0.018,0.003,0.090,7,MID);b.pop();
      b.push();b.translate(s*0.090,0.230,-0.040);b.rotate(0,s*0.5,-s*0.4);
      b.extrude([[0,-0.020],[0.180,-0.090],[0.200,0.060],[0,0.070]],
                0.012,MID);
      b.pop();
    }
    b.sphere(-0.034,0.256,0.198,0.016,7,6,'#F5C93C');
    b.sphere( 0.034,0.256,0.198,0.016,7,6,'#F5C93C');
    for(var i=0;i<4;i++){
      b.push();b.translate((i<2?0.058:-0.058),0.042,(i%2?0.078:-0.084));
      b.cylinder(0,0,0,0.030,0.028,0.110,8,MID);b.pop();
    }
    /* the tail, tapering back with a spade on the end */
    for(var t=0;t<6;t++){
      b.push();b.translate(0,0.150-t*0.012,-0.150-t*0.052);
      b.sphere(0,0,0,0.052-t*0.007,9,7,LIT);b.pop();
    }
    b.push();b.translate(0,0.082,-0.470);b.rotate(0,0,Math.PI/2);
    b.extrude([[0,-0.040],[0.070,0],[0,0.040]],0.012,MID);b.pop();
  },
  penguin:function(b){
    b.mat('blank');
    b.push();b.translate(0,0.155,0);b.scale(1.0,1.0,0.90);
    b.sphere(0,0,0,0.135,16,12,LIT,{squash:0.78});b.pop();
    b.push();b.translate(0,0.150,0.088);b.scale(0.80,0.94,0.42);
    b.sphere(0,0,0,0.125,14,11,'#F6F2EA');b.pop();
    b.push();b.translate(0,0.300,0.014);
    b.sphere(0,0,0,0.098,14,11,LIT,{squash:0.94});
    b.push();b.translate(0,-0.014,0.076);b.scale(0.66,0.66,1.0);
    b.sphere(0,0,0,0.046,10,8,'#F5A03C');b.pop();
    b.sphere(-0.034,0.024,0.076,0.015,7,6,'#F6F2EA');
    b.sphere( 0.034,0.024,0.076,0.015,7,6,'#F6F2EA');
    b.sphere(-0.034,0.024,0.086,0.008,6,5,'#141018');
    b.sphere( 0.034,0.024,0.086,0.008,6,5,'#141018');
    b.pop();
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.128,0.150,0);b.rotate(0,0,s*0.20);
      b.scale(0.26,1.0,0.70);
      b.sphere(0,0,0,0.098,10,9,LIT);b.pop();
      b.push();b.translate(s*0.052,0.022,0.030);b.scale(1.0,0.4,1.6);
      b.sphere(0,0,0,0.040,9,7,'#F5A03C');b.pop();
    }
  },
  seagull:function(b){
    b.mat('blank');
    b.push();b.translate(0,0.170,0);b.scale(1.0,0.86,1.40);
    b.sphere(0,0,0,0.110,14,11,'#F6F4F0');b.pop();
    b.push();b.translate(0,0.250,0.110);
    b.sphere(0,0,0,0.072,12,10,'#F6F4F0',{squash:0.96});
    b.push();b.translate(0,-0.010,0.068);b.scale(0.5,0.5,1.6);
    b.sphere(0,0,0,0.030,9,7,'#F5A03C');b.pop();
    b.sphere(-0.028,0.018,0.056,0.012,7,6,'#141018');
    b.sphere( 0.028,0.018,0.056,0.012,7,6,'#141018');
    b.pop();
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.070,0.196,-0.010);b.rotate(0,0,s*0.34);
      b.extrude([[0,-0.050],[0.230,-0.030],[0.250,0.020],[0,0.060]],
                0.010,'#D8DDE4');
      b.pop();
    }
    b.push();b.translate(0,0.150,-0.150);b.rotate(-0.5,0,0);
    b.extrude([[-0.050,0],[0.050,0],[0.030,0.110],[-0.030,0.110]],
              0.010,'#D8DDE4');b.pop();
  },
  none:function(b){}
};
Cos.PETS=Object.keys(PET_BUILD);
Cos.pet=function(style){
  style=PET_BUILD[style]?style:'none';
  return part('pet:'+style,function(b){PET_BUILD[style](b);},32);
};

LH.Cos=Cos;
})();


/* ============================================================
   LH.Props — everything that stands on the terrain.

   Two kinds of thing live here. Small repeated objects — trees,
   lamps, crates, benches — are single meshes drawn instanced, so a
   forest of two hundred trees is one draw call. Architecture is
   generated per building and merged into one static mesh per
   district, because no two buildings should be the same and there is
   no point instancing something that appears once.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,GL=LH.GL,Geo=LH.Geo,P={};
var cache={};

function prop(key,fn,maxInst){
  var hit=cache[key];if(hit)return hit;
  var b=Geo.build();fn(b);
  var mesh=b.upload(maxInst||256);
  mesh.key=key;cache[key]=mesh;return mesh;
}
P.prop=prop;
P.cache=cache;

/* ---------------- vegetation ---------------- */
/* A trunk that leans and forks. Straight cylinders read as telegraph
   poles; the lean is most of what sells a tree at distance. */
/* A trunk.

   Eight sides made every tree in the wood a visible octagon from ten
   metres, and starting at full radius at ground level made it a pipe
   pushed into the lawn. A trunk meets the ground in a flare — the
   roots spreading out under the soil are what a tree stands on — and
   that flare over the first twenty centimetres is most of what says
   "grown here" rather than "placed here". */
function trunk(b,h,r0,r1,lean,seed){
  var rng=M.rng(seed||7);
  var secs=[],steps=7;
  var lx=0,lz=0;
  /* the flare: two extra rings below the first, wider and lumpier */
  for(var f=0;f<2;f++){
    var ft=f/2;
    var fr=r0*(1.62-ft*0.44);
    var fp=Geo.circle(fr,11);
    for(var q=0;q<fp.length;q++){
      var bulge=1+(M.hash2(q,f,seed||7)-0.5)*0.30*(1-ft);
      fp[q][0]*=bulge;fp[q][1]*=bulge;
    }
    secs.push({y:ft*h*0.030,pts:fp});
  }
  for(var i=0;i<=steps;i++){
    var t=i/steps;
    lx+=(rng()-0.5)*lean*h*0.16;
    lz+=(rng()-0.5)*lean*h*0.16;
    var pts=Geo.circle(M.lerp(r0,r1,t*t),11);
    for(var j=0;j<pts.length;j++){pts[j][0]+=lx;pts[j][1]+=lz;}
    secs.push({y:h*0.030+t*h*0.970,pts:pts});
  }
  b.loft(secs,'#FFFFFF',{openTop:true,uvScale:2});
  return [lx,lz];
}

P.TREES=['broadleaf','pine','palm','blossom','dead'];
P.CULL={tree:190,bush:95,tuft:52,rock:150,dflt:150};
/* ---------------- branching ----------------
   A limb, and the limbs that grow out of it. Each child is built
   inside its parent's transform, so the recursion never has to know
   which way anything is pointing in world space — `translate(0,len,0)`
   is always "the end of this branch" and `rotate` is always relative
   to it. Working out the world direction of a third-order twig and
   rotating a cylinder onto it is the same tree and four times the code.

   Depth 0 means "put leaves here instead of more wood". */
function limb(b,len,r0,r1,depth,rng,leaf,barkCol){
  b.cylinder(0,len/2,0,r0,r1,len,5,barkCol||'#FFFFFF');
  b.push();b.translate(0,len,0);
  if(depth>0){
    /* Two children, not three. A tree is placed hundreds of times and
       every branch is paid for at every instance: three children at
       depth two is nine tips per primary against four, and the
       silhouette is barely different at the distance anyone sees it. */
    var n=2;
    for(var i=0;i<n;i++){
      b.push();
      b.rotate(0,(i/n)*M.TAU+rng()*0.9,0);
      /* Wider at the first split than at the last: a tree opens out
         low and closes back toward vertical in its twigs, and branching
         at a constant angle gives you a diagram of a tree rather than
         a tree. */
      b.rotate(0.30+depth*0.16+rng()*0.30,0,0);
      limb(b,len*(0.60+rng()*0.20),r1,r1*(0.52+rng()*0.16),
           depth-1,rng,leaf,barkCol);
      b.pop();
    }
    /* one cluster in the crotch of the split, so the canopy has an
       inside as well as an outline */
    if(depth===1&&rng()<0.5)leaf(b,rng,0.70);
  }else leaf(b,rng,1);
  b.pop();
}

P.tree=function(kind,variant){
  variant=variant||0;
  return prop('tree:'+kind+':'+variant,function(b){
    var rng=M.rng(101+variant*37);
    var scale=0.86+rng()*0.34;
    if(kind==='pine'){
      b.mat('bark');
      var h=8.5*scale;
      trunk(b,h,0.185*scale,0.065*scale,0.10,11+variant);
      b.mat('foliage');
      /* stacked skirts, each smaller and rotated, so the silhouette
         is ragged rather than a smooth cone */
      for(var i=0;i<5;i++){
        var t=i/4;
        var y=h*(0.20+t*0.74);
        var r=(2.7-t*2.15)*scale;
        b.push();b.translate((rng()-0.5)*0.26,y,(rng()-0.5)*0.26);
        b.rotate((rng()-0.5)*0.10,rng()*6.28,(rng()-0.5)*0.10);
        /* A ragged ring rather than a clean circle: a cone of perfect
           circles is a Christmas-tree decoration, and the whole read of
           a conifer is the broken edge where the branches end. */
        var n2=9,pts=[];
        for(var q2=0;q2<n2;q2++){
          var a2=q2/n2*M.TAU;
          var rr=r*(0.76+((q2*7919)%13)/13*0.38);
          pts.push([Math.cos(a2)*rr,Math.sin(a2)*rr]);
        }
        b.loft([
          {y:0,pts:pts},
          {y:r*0.34,pts:Geo.circle(r*0.55,n2)},
          {y:r*1.05,pts:Geo.circle(r*0.10,n2)}
        ],i%2?'#FFFFFF':'#D4D4D4',{openBottom:false});
        b.pop();
      }
    }else if(kind==='palm'){
      b.mat('bark');
      var ph=7.5*scale;
      var tip=trunk(b,ph,0.150*scale,0.105*scale,0.42,13+variant);
      b.mat('foliage');
      var n=8;
      for(var f=0;f<n;f++){
        var a=f/n*M.TAU+rng()*0.4;
        b.push();
        b.translate(tip[0],ph,tip[1]);
        b.rotate(0,a,0);
        b.rotate(-0.55-rng()*0.4,0,0);
        /* a frond: long, drooping, tapered */
        for(var s=0;s<4;s++){
          var st=s/3;
          b.push();
          b.translate(0,-st*st*1.1,st*3.2);
          b.rotate(st*0.5,0,0);
          b.card(0,0,0,(1.5-st*0.9)*scale,(2.0-st*0.6)*scale,
            s%2?'#FFFFFF':'#CFCFCF');
          b.pop();
        }
        b.pop();
      }
      /* coconuts */
      b.mat('bark');
      for(var c=0;c<3;c++){
        var ca=c/3*M.TAU;
        b.push();b.translate(tip[0]+Math.cos(ca)*0.30,ph-0.28,tip[1]+Math.sin(ca)*0.30);
        b.sphere(0,0,0,0.20*scale,7,6,'#B8B8B8');b.pop();
      }
    }else if(kind==='dead'){
      b.mat('bark');
      var dh=6.0*scale;
      var dt=trunk(b,dh,0.185*scale,0.058*scale,0.30,17+variant);
      for(var br=0;br<5;br++){
        var ba=rng()*M.TAU,bt=0.4+rng()*0.5;
        b.push();
        b.translate(dt[0]*bt,dh*bt,dt[1]*bt);
        b.rotate(0,ba,0);b.rotate(-0.9-rng()*0.5,0,0);
        b.cylinder(0,0.8,0,0.10*scale,0.02*scale,1.7*scale,6,'#FFFFFF');
        b.pop();
      }
    }else{
      /* Broadleaf and blossom share a shape; only the canopy material
         differs, which is the whole point of a material index.

         The canopy used to be five squashed spheres over a bare pole —
         a lollipop, and the thing that made every wooded shot in this
         game read as clip art. It is now a real branching structure
         with leaf clusters hung on the ends, which costs about two
         thousand vertices per variant and nothing at all in draw calls,
         because a species is one instanced mesh however complicated it
         is inside. */
      b.mat('bark');
      /* Slimmer. A seven-metre broadleaf carried a trunk 0.72 m across
         at the base before the placement scale multiplied it again,
         and in a wood that is a row of columns rather than a row of
         trees. Real proportion for this height is nearer a quarter of
         that; the flare in `trunk` gives back the visual weight at the
         bottom, which is where it belongs. */
      var bh=7.0*scale;
      var bt2=trunk(b,bh*0.46,0.215*scale,0.135*scale,0.20,19+variant);
      var leafMat=kind==='blossom'?'foliagep':'foliage';
      function cluster(bb,r2,sz){
        sz=sz||1;
        bb.mat(leafMat);
        /* Two lobes, not three. The comment below used to say a complex
           mesh "costs nothing at all in draw calls, because a species is
           one instanced mesh however complicated it is inside", and that
           is true of draw calls and badly false of everything else: this
           tree is drawn 219 times, so every triangle in it is 219
           triangles in the frame. At 4,400 apiece the two broadleaf
           species alone were 1.9 million triangles a frame. */
        var lob=2;
        for(var q=0;q<lob;q++){
          bb.push();
          bb.translate((r2()-0.5)*1.25*sz*scale,
                       (r2()-0.25)*0.90*sz*scale,
                       (r2()-0.5)*1.25*sz*scale);
          bb.rotate(r2()*0.6,r2()*M.TAU,r2()*0.6);
          /* Five segments and four rings. A leaf cluster is lumpy by
             nature and gains nothing from being round, and this mesh is
             instanced across a forest and drawn three times a frame —
             once for the image and once for each shadow cascade. */
          /* Tone per lobe, over a real range. Two shades alternating
             gave a canopy that was one flat mass with a seam in it;
             the light on a tree falls off from the outside of the
             crown to the inside, and five steps of it read as depth
             where two read as a decal. */
          var LOBE=['#FFFFFF','#F0F0F0','#DEDEDE','#CACACA','#B6B6B6'];
          bb.sphere(0,0,0,(0.72+r2()*0.50)*sz*scale,5,4,
            LOBE[(r2()*LOBE.length)|0],{squash:0.78+r2()*0.28});
          bb.pop();
        }
        bb.mat('bark');
      }
      b.push();
      b.translate(bt2[0],bh*0.46,bt2[1]);
      var prim=3;
      for(var L=0;L<prim;L++){
        b.push();
        b.rotate(0,(L/prim)*M.TAU+rng()*0.7,0);
        b.rotate(0.42+rng()*0.26,0,0);
        limb(b,bh*0.30*(0.85+rng()*0.3),0.115*scale,0.068*scale,
             2,rng,cluster,'#FFFFFF');
        b.pop();
      }
      /* and one going more or less straight up, which is what stops
         the crown looking like a bowl */
      b.push();b.rotate(0,rng()*M.TAU,0);b.rotate(0.14,0,0);
      limb(b,bh*0.34,0.105*scale,0.062*scale,2,rng,cluster,'#FFFFFF');
      b.pop();
      b.pop();
    }
  },900);
};

P.bush=function(v){
  return prop('bush:'+v,function(b){
    b.mat('foliage');
    var rng=M.rng(211+v*13);
    for(var i=0;i<7;i++){
      b.push();
      b.translate((rng()-0.5)*1.15,0.20+rng()*0.52,(rng()-0.5)*1.15);
      b.rotate(rng()*0.7,rng()*M.TAU,rng()*0.7);
      b.sphere(0,0,0,0.24+rng()*0.26,8,6,i%2?'#FFFFFF':'#CACACA',
        {squash:0.74+rng()*0.3});
      b.pop();
    }
  },1400);
};

P.grassTuft=function(v){
  return prop('tuft:'+v,function(b){
    b.mat('foliage');
    var rng=M.rng(307+v*7);
    for(var i=0;i<7;i++){
      var a=rng()*M.TAU,r=rng()*0.28;
      b.push();
      b.translate(Math.cos(a)*r,0,Math.sin(a)*r);
      b.rotate((rng()-0.5)*0.5,rng()*3.14,(rng()-0.5)*0.5);
      b.card(0,0.24+rng()*0.16,0,0.08,0.48+rng()*0.30,'#FFFFFF');
      b.pop();
    }
  },2600);
};

P.rock=function(v){
  return prop('rock:'+v,function(b){
    b.mat('cliff');
    var rng=M.rng(409+v*23);
    /* A sphere pushed around by noise, then flattened. Reads as stone
       because the facets are irregular, not because of the texture. */
    var n=9,rings=6,secs=[];
    for(var j=0;j<=rings;j++){
      var t=j/rings;
      var pts=[];
      for(var i=0;i<n;i++){
        var a=i/n*M.TAU;
        var rr=(0.55+Math.sin(t*Math.PI)*0.62)*(0.72+rng()*0.56);
        pts.push([Math.cos(a)*rr,Math.sin(a)*rr]);
      }
      secs.push({y:t*1.15,pts:pts});
    }
    b.loft(secs,'#FFFFFF',{uvScale:1.4});
  },1200);
};

/* ---------------- street furniture ---------------- */
P.lamp=function(style){
  return prop('lamp:'+(style||'harbour'),function(b){
    b.mat('panel');
    b.cylinder(0,0.10,0,0.24,0.20,0.20,10,'#C6CEDA');
    b.cylinder(0,2.10,0,0.09,0.07,3.90,8,'#DCE2EA');
    if(style==='harbour'){
      /* a curved arm and a hanging lantern */
      b.push();b.translate(0,4.00,0);
      for(var i=0;i<5;i++){
        var t=i/4;
        b.push();
        b.translate(Math.sin(t*1.2)*0.85,Math.cos(t*1.2)*0.30,0);
        b.sphere(0,0,0,0.075,6,5,'#FFFFFF');
        b.pop();
      }
      b.pop();
      b.push();b.translate(0.80,3.86,0);
      b.mat('panel');
      b.loft([
        {y:-0.34,pts:Geo.roundRect(0.30,0.30,0.06,10)},
        {y:-0.28,pts:Geo.roundRect(0.36,0.36,0.07,10)},
        {y: 0.10,pts:Geo.roundRect(0.30,0.30,0.06,10)},
        {y: 0.20,pts:Geo.roundRect(0.10,0.10,0.03,10)}
      ],'#C4CDDA',{});
      b.mat('neon',1.0);
      b.sphere(0,-0.10,0,0.15,10,8,'#FFE0A8',{squash:1.1});
      b.pop();
    }else{
      b.push();b.translate(0,4.10,0);
      b.mat('neon',1.0);
      b.chamfer(0,0,0,0.34,0.50,0.34,'#BFE9FF',0.08);
      b.mat('panel');
      b.push();b.translate(0,0.34,0);
      b.chamfer(0,0,0,0.42,0.10,0.42,'#8E99A8',0.03);b.pop();
      b.pop();
    }
  },200);
};

P.bench=function(){
  return prop('bench',function(b){
    /* slats, not a slab: the gaps are what make it read as a bench
       rather than a block of wood at seat height */
    b.mat('planks');
    for(var i=0;i<3;i++){
      b.push();b.translate(0,0.46,-0.18+i*0.18);
      b.chamfer(0,0,0,1.90,0.07,0.15,'#B08A5E',0.02);b.pop();
    }
    for(var k=0;k<3;k++){
      b.push();b.translate(0,0.74+k*0.17,-0.26);b.rotate(-0.20,0,0);
      b.chamfer(0,0,0,1.90,0.07,0.14,'#A8825A',0.02);b.pop();
    }
    b.mat('panel');
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*0.80,0.23,0);
      b.chamfer(0,0,0,0.08,0.46,0.46,'#AEB6C2',0.02);b.pop();
      b.push();b.translate(s*0.80,0.72,-0.28);
      b.chamfer(0,0,0,0.07,0.56,0.08,'#AEB6C2',0.02);b.pop();
    }
  },120);
};

P.crate=function(v){
  return prop('crate:'+v,function(b){
    b.mat('planks');
    var s=0.72+ (v%3)*0.14;
    b.chamfer(0,s/2,0,s,s,s,'#C9A87C',0.035,{uvScale:1.4});
    b.mat('panel');
    for(var e=-1;e<=1;e+=2){
      b.push();b.translate(0,s/2,e*s/2*1.01);
      b.chamfer(0,0,0,s*1.02,0.06,0.02,'#C8CED8',0.01,{noBand:true});b.pop();
    }
  },300);
};

P.barrel=function(){
  return prop('barrel',function(b){
    b.mat('planks');
    b.loft([
      {y:0.00,pts:Geo.circle(0.32,12)},
      {y:0.22,pts:Geo.circle(0.40,12)},
      {y:0.55,pts:Geo.circle(0.42,12)},
      {y:0.88,pts:Geo.circle(0.40,12)},
      {y:1.10,pts:Geo.circle(0.32,12)}
    ],'#A87A4E',{uvScale:2});
    b.mat('panel');
    for(var i=0;i<2;i++){
      b.push();b.translate(0,0.28+i*0.54,0);
      b.loft([
        {y:0,   pts:Geo.circle(0.415,12)},
        {y:0.07,pts:Geo.circle(0.415,12)}
      ],'#B4BCC6',{openTop:true,openBottom:true});
      b.pop();
    }
  },200);
};

P.planter=function(){
  return prop('planter',function(b){
    b.mat('concrete');
    b.loft([
      {y:0.00,pts:Geo.roundRect(1.10,1.10,0.14,12)},
      {y:0.52,pts:Geo.roundRect(1.26,1.26,0.16,12)},
      {y:0.62,pts:Geo.roundRect(1.30,1.30,0.16,12)}
    ],'#8E97A2',{uvScale:1.2});
    b.mat('foliage');
    var rng=M.rng(521);
    for(var i=0;i<5;i++){
      b.push();
      b.translate((rng()-0.5)*0.7,0.72+rng()*0.22,(rng()-0.5)*0.7);
      b.sphere(0,0,0,0.30+rng()*0.16,8,6,'#FFFFFF',{squash:0.8});
      b.pop();
    }
  },160);
};

P.bollard=function(){
  return prop('bollard',function(b){
    b.mat('panel');
    b.loft([
      {y:0.00,pts:Geo.circle(0.22,10)},
      {y:0.60,pts:Geo.circle(0.19,10)},
      {y:0.72,pts:Geo.circle(0.24,10)},
      {y:0.80,pts:Geo.circle(0.20,10)}
    ],'#BFC7D2',{});
  },200);
};

/* ---------------- harbour ---------------- */
P.piling=function(){
  return prop('piling',function(b){
    b.mat('bark');
    b.cylinder(0,0,0,0.26,0.22,8.0,8,'#A88A66');
    b.mat('panel');
    b.push();b.translate(0,3.75,0);
    b.loft([{y:0,pts:Geo.circle(0.28,10)},{y:0.10,pts:Geo.circle(0.28,10)}],
      '#C0C8D2',{openTop:true,openBottom:true});
    b.pop();
  },200);
};

P.boat=function(v){
  return prop('boat:'+v,function(b){
    b.mat('deck');
    /* A hull lofted from a keel line to a gunwale: pointed at the bow,
       square at the stern. */
    var L=5.6,Wd=1.9;
    var secs=[];
    for(var i=0;i<=6;i++){
      var t=i/6;
      var w=Wd*(0.30+Math.sin(t*Math.PI)*0.92);
      var d=1.05*(0.42+Math.sin(t*Math.PI)*0.70);
      secs.push({y:t*1.05,pts:(function(){
        var pts=Geo.roundRect(w,L,0.34,16);
        /* sharpen the bow */
        for(var j=0;j<pts.length;j++){
          if(pts[j][1]>L*0.28)pts[j][0]*=0.30;
          else if(pts[j][1]>L*0.10)pts[j][0]*=0.72;
        }
        return pts;
      })()});
    }
    b.loft(secs,'#C9B08A',{uvScale:1.6,openTop:true});
    b.mat('planks');
    b.push();b.translate(0,0.90,-0.4);
    b.chamfer(0,0,0,1.5,0.10,2.4,'#9C7C58',0.04);b.pop();
    if(v%2===0){
      /* a small wheelhouse */
      b.mat('planks');
      b.push();b.translate(0,1.45,-1.3);
      b.chamfer(0,0,0,1.3,1.0,1.5,'#B49070',0.06);b.pop();
      b.mat('glass');
      b.push();b.translate(0,1.60,-0.56);
      b.chamfer(0,0,0,1.05,0.46,0.05,'#BFE4F5',0.02,{noBand:true});b.pop();
      b.mat('panel');
      b.push();b.translate(0,2.30,-1.3);
      b.cylinder(0,0,0,0.06,0.05,0.70,6,'#CAD2DC');b.pop();
    }else{
      /* or a mast and a furled sail */
      b.mat('bark');
      b.push();b.translate(0,2.6,0.2);
      b.cylinder(0,0,0,0.09,0.06,3.4,8,'#7A5C40');b.pop();
      b.mat('fabric');
      b.push();b.translate(0,2.2,0.2);
      b.loft([
        {y:-1.0,pts:Geo.circle(0.22,8,1,2.6)},
        {y: 0.9,pts:Geo.circle(0.14,8,1,2.0)}
      ],'#E8E2D4',{});
      b.pop();
    }
  },60);
};

/* ---------------- signage and interaction points ---------------- */
P.signpost=function(){
  return prop('signpost',function(b){
    b.mat('planks');
    b.cylinder(0,1.2,0,0.10,0.09,2.4,8,'#8A6A48');
    b.push();b.translate(0,2.05,0.04);
    b.chamfer(0,0,0,1.5,0.62,0.09,'#C0A078',0.03);b.pop();
    b.mat('neon',0.7);
    b.push();b.translate(0,2.05,0.10);
    b.chamfer(0,0,0,1.30,0.42,0.02,'#5BE8D0',0.01,{noBand:true});b.pop();
  },120);
};

P.missionBoard=function(){
  return prop('missionBoard',function(b){
    b.mat('panel');
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*1.5,1.3,0);
      b.cylinder(0,0,0,0.12,0.10,2.6,8,'#B2BAC6');b.pop();
    }
    b.push();b.translate(0,2.1,0);
    b.chamfer(0,0,0,3.4,2.0,0.16,'#98A2B0',0.06);b.pop();
    b.mat('neon',0.9);
    b.push();b.translate(0,2.1,0.10);
    b.chamfer(0,0,0,3.0,1.66,0.03,'#3BE0C8',0.02,{noBand:true});b.pop();
    b.mat('panel');
    b.push();b.translate(0,3.24,0);
    b.chamfer(0,0,0,3.7,0.16,0.42,'#CAD2DC',0.05);b.pop();
  },20);
};

/* The gateway to a player's own world. Deliberately the most
   dramatic object in the plaza: it is the promise the game is making. */
P.portal=function(){
  return prop('portal',function(b){
    b.mat('panel');
    b.push();b.translate(0,0.35,0);
    b.loft([
      {y:0,   pts:Geo.roundRect(4.4,2.4,0.5,14)},
      {y:0.5, pts:Geo.roundRect(4.0,2.0,0.45,14)},
      {y:0.7, pts:Geo.roundRect(3.7,1.8,0.4,14)}
    ],'#98A2B0',{uvScale:1.2});
    b.pop();
    /* the arch, as a ring of tapered blocks */
    var R=2.3;
    for(var i=0;i<=18;i++){
      var a=Math.PI*(i/18);
      b.push();
      b.translate(Math.cos(a)*R,1.05+Math.sin(a)*R,0);
      b.rotate(0,0,a-Math.PI/2);
      b.mat('panel');
      b.chamfer(0,0,0,0.46,0.40,0.66,i%2?'#C4CCD8':'#AAB2BE',0.06);
      b.mat('neon',0.95);
      b.push();b.translate(0,-0.22,0.35);
      b.sphere(0,0,0,0.055,6,5,'#5BE8FF');b.pop();
      b.pop();
    }
    /* The surface.

       This used to be a stack of horizontal circles lofted up the Y
       axis — which is a barrel two metres deep, not a doorway. Fully
       emissive, one flat cyan, and sticking a metre out of the arch on
       both sides, it read as a plastic wedge jammed in a stone ring,
       and it was the first thing anybody saw in this game.

       A portal is a membrane. It lives in the plane of the arch, it is
       darkest in the middle where you are looking through it and
       brightest at the rim where it meets the frame, and it is dished
       rather than flat so the light on it moves as you walk past. */
    /* The opening is a half-circle standing on a plinth, so the
       membrane is half-rings, not discs. A full disc spends its lower
       half buried in the plinth and poking out of the front of it,
       and that stray lower half glowing under the arch is what turned
       a doorway into a dome. */
    var RG=8, R0=2.00, SEG=24;
    var COLS=['#06202F','#0A3247','#10495C','#17667A','#1F8496',
              '#2AA2B0','#37BEC6','#49D6D8'];
    function halfRing(r0,r1,depth,col,flip){
      var c=Geo.col3(col), base=b.n, i;
      var nz=flip?-1:1;
      for(i=0;i<=SEG;i++){
        var a=Math.PI*(i/SEG), ca=Math.cos(a), sa=Math.sin(a);
        b.vert(ca*r0,1.05+sa*r0,depth,0,0,nz,i/SEG,0,c);
        b.vert(ca*r1,1.05+sa*r1,depth,0,0,nz,i/SEG,1,c);
      }
      for(i=0;i<SEG;i++){
        var a0=base+i*2, b0=a0+1, c0=a0+2, d0=a0+3;
        if(flip)b.quad(a0,c0,d0,b0); else b.quad(a0,b0,d0,c0);
      }
    }
    for(var g=0;g<RG;g++){
      var t=g/(RG-1);
      /* dished: the middle sits back from the frame, so the light on
         it moves as you walk past rather than sitting still */
      var depth=-0.26+t*t*0.30;
      b.mat('neon',0.10+t*t*0.44);
      halfRing(R0*(g/RG),R0*((g+1)/RG),depth,COLS[g],false);
      halfRing(R0*(g/RG),R0*((g+1)/RG),depth-0.014,COLS[g],true);
    }
  },8);
};

LH.Props=P;
})();


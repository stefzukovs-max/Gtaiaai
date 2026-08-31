/* ============================================================
   LH.Arch — buildings.

   Generated per building from a seed and a style, then merged into
   one static mesh per district. Instancing would be wrong here: the
   whole point is that no two buildings on the waterfront are the
   same, and a street of identical copies is the fastest way to make
   a generated town look generated.

   Every building is the same four decisions — a footprint, a number
   of storeys, a roof, and a frontage — with the style choosing the
   materials and the details.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,Geo=LH.Geo,A={};

/* A waterfront is a row of people's houses, and people paint them.

   Every palette here used to sit within about fifteen per cent of a
   neutral grey — four styles of pale stone under grey-blue roofs —
   which is why the town read as a row of unfinished office blocks
   whatever the lighting did. Real harbour fronts are the opposite:
   ochre next to washed blue next to dark red, held together by the
   fact that they share a roof material and a trim colour rather than
   by all being the same colour. The trim and the base stay quiet
   precisely so the walls can be loud. */
var STYLES={
  harbour:{ wall:'planks',
            wallCol:['#C8934E','#A9583F','#6E8FA0','#D8B06A','#7C8F63','#B4643F'],
            trim:'planks', trimCol:'#4A382A',
            roof:'roof', roofCol:['#55606E','#6A5560','#48525E','#7A6250'],
            base:'stone', baseCol:'#A8A296' },
  town:{    wall:'brickpale',
            wallCol:['#C46A54','#D8A860','#8E9A6E','#7E8CA8','#B45E6E','#E0C088'],
            trim:'planks', trimCol:'#48372A',
            roof:'roof', roofCol:['#8E4A46','#6E4450','#A85E4A','#5A4A56'],
            base:'stone', baseCol:'#B0AA9E' },
  modern:{  wall:'panelw',
            wallCol:['#D6DCE0','#B8C4C8','#E4E0D4','#9EB0B6'],
            trim:'panel', trimCol:'#5E6A72',
            roof:'panel', roofCol:['#68727C','#7A848E'],
            base:'concrete', baseCol:'#9AA0A4' },
  industrial:{wall:'panel',
            wallCol:['#8E7A5E','#6E7A80','#9A6A50','#7E8474'],
            trim:'panel', trimCol:'#4E545A',
            roof:'panel', roofCol:['#5A626A','#6A7278'],
            base:'concrete', baseCol:'#8A8E90' }
};
A.STYLES=Object.keys(STYLES);

/* A window: recessed frame, glass, and a sill. The recess is what
   makes a facade read as built rather than printed on. */
function window_(b,st,w,h,lit){
  b.mat(st.trim);
  b.chamfer(0,0,0.06,w+0.16,h+0.16,0.14,st.trimCol,0.03);
  b.mat('glass');
  b.chamfer(0,0,0.13,w,h,0.04,'#9EB6C8',0.01,{noBand:true});
  if(lit){
    b.mat('neon',0.42);
    b.chamfer(0,0,0.15,w-0.04,h-0.04,0.02,'#FFD3A0',0.01,{noBand:true});
  }
  b.mat(st.trim);
  b.push();b.translate(0,-h/2-0.10,0.14);
  b.chamfer(0,0,0,w+0.30,0.09,0.22,st.trimCol,0.03);b.pop();
}

function door(b,st,w,h){
  b.mat(st.trim);
  b.chamfer(0,h/2,0.06,w+0.20,h+0.14,0.16,st.trimCol,0.04);
  b.mat('planks');
  b.chamfer(0,h/2,0.14,w,h,0.06,'#6E4E32',0.02);
  b.mat('gold');
  b.push();b.translate(w*0.32,h*0.48,0.19);
  b.sphere(0,0,0,0.055,8,6,'#D8B45E');b.pop();
}

/* Pitched, hipped or flat, plus an overhanging eave. The eave casts
   the shadow line that gives a building its weight. */
function roof(b,st,w,d,y,kind,col){
  b.mat(st.roof);
  if(kind==='flat'){
    b.push();b.translate(0,y+0.12,0);
    b.chamfer(0,0,0,w+0.5,0.24,d+0.5,col,0.06);b.pop();
    /* parapet */
    b.mat(st.trim);
    var t=0.16;
    var sides=[[0,(d+0.5)/2],[0,-(d+0.5)/2],[(w+0.5)/2,0],[-(w+0.5)/2,0]];
    for(var i=0;i<4;i++){
      var S=sides[i],horiz=i<2;
      b.push();b.translate(S[0],y+0.46,S[1]);
      b.chamfer(0,0,0,horiz?w+0.5:t,0.44,horiz?t:d+0.5,st.trimCol,0.04);
      b.pop();
    }
    return y+0.68;
  }
  var ph=kind==='steep'?d*0.52:d*0.34;
  /* two slopes as thin boxes, rotated to meet at the ridge */
  var slope=Math.atan2(ph,d/2);
  var len=Math.hypot(ph,d/2);
  for(var s=-1;s<=1;s+=2){
    b.push();
    b.translate(0,y+ph/2,s*d/4);
    b.rotate(-s*slope,0,0);
    b.chamfer(0,0,0,w+0.7,0.16,len*2*0.52,col,0.05,{uvScale:0.8});
    b.pop();
  }
  /* gable ends fill the triangles the slopes leave open */
  b.mat(st.wall);
  for(var g=-1;g<=1;g+=2){
    b.push();b.translate(g*w/2,y,0);b.rotate(0,Math.PI/2,0);
    b.extrude([[-d/2,0],[d/2,0],[0,ph]],0.14,col);
    b.pop();
  }
  b.mat(st.roof);
  b.push();b.translate(0,y+ph+0.04,0);
  b.chamfer(0,0,0,w+0.8,0.14,0.30,col,0.04);b.pop();
  return y+ph;
}

/* The main entry point. Returns useful anchors — the door position and
   the roof height — so the world can hang a sign or an NPC on it. */
A.building=function(b,o){
  var rng=M.rng(o.seed||1);
  var st=STYLES[o.style]||STYLES.town;
  var w=o.w||8, d=o.d||7, storeys=o.storeys||2;
  var sh=o.storeyH||3.1;
  var wallCol=st.wallCol[(rng()*st.wallCol.length)|0];
  var roofCol=st.roofCol[(rng()*st.roofCol.length)|0];
  var y0=o.y||0;

  b.push();
  b.translate(o.x||0,y0,o.z||0);
  b.rotate(0,o.rot||0,0);

  /* plinth — buildings that meet the ground with no base look pasted on */
  b.mat(st.base);
  b.push();b.translate(0,0.22,0);
  b.chamfer(0,0,0,w+0.44,0.44+ (o.sink||0),d+0.44,st.baseCol,0.08);
  b.pop();

  for(var s=0;s<storeys;s++){
    var yc=0.44+s*sh+sh/2;
    b.mat(st.wall);
    b.push();b.translate(0,yc,0);
    b.chamfer(0,0,0,w,sh,d,wallCol,0.10,{uvScale:0.55});
    b.pop();
    /* a string course between storeys */
    if(s<storeys-1){
      b.mat(st.trim);
      b.push();b.translate(0,0.44+(s+1)*sh,0);
      b.chamfer(0,0,0,w+0.26,0.18,d+0.26,st.trimCol,0.04);b.pop();
    }
    /* openings on the front and back faces */
    var nW=Math.max(1,Math.round(w/2.6));
    for(var i=0;i<nW;i++){
      var wx=(i-(nW-1)/2)*(w/nW);
      for(var face=0;face<2;face++){
        var fz=face?-d/2:d/2;
        if(s===0&&face===0&&Math.abs(wx)<w/nW*0.6&&o.doorway!==false){
          b.push();b.translate(wx,0.44+s*sh,fz);
          if(face)b.rotate(0,Math.PI,0);
          door(b,st,1.30,2.30);
          b.pop();
          continue;
        }
        b.push();
        b.translate(wx,yc+0.10,fz);
        if(face)b.rotate(0,Math.PI,0);
        window_(b,st,1.10,1.45,rng()<0.55);
        b.pop();
      }
    }
    /* and on the sides, fewer */
    var nS=Math.max(1,Math.round(d/3.4));
    for(var j=0;j<nS;j++){
      var wz=(j-(nS-1)/2)*(d/nS);
      for(var side=-1;side<=1;side+=2){
        b.push();
        b.translate(side*w/2,yc+0.10,wz);
        b.rotate(0,side*Math.PI/2,0);
        window_(b,st,0.90,1.30,rng()<0.4);
        b.pop();
      }
    }
  }

  var top=0.44+storeys*sh;
  var kind=o.roof||(rng()<0.28?'flat':(rng()<0.4?'steep':'pitch'));
  var rTop=roof(b,st,w,d,top,kind,roofCol);

  /* Frontage: an awning and a hanging sign turn a box into a shop. */
  if(o.shop){
    b.mat('fabric');
    b.push();b.translate(0,0.44+2.62,d/2+0.62);b.rotate(0.34,0,0);
    b.chamfer(0,0,0,w*0.86,0.08,1.40,o.awning||'#B4485E',0.03,{uvScale:2});
    b.pop();
    b.mat('planks');
    b.push();b.translate(0,0.44+2.98,d/2+0.10);
    b.chamfer(0,0,0,w*0.88,0.14,0.24,st.trimCol,0.03);b.pop();
    b.mat('neon',0.9);
    var signCol=o.signCol||'#3BE0C8';
    b.push();b.translate(0,0.44+3.42,d/2+0.16);
    b.chamfer(0,0,0,w*0.62,0.44,0.06,signCol,0.02,{noBand:true});
    b.pop();
    /* The sign lights the street it faces. Local +Z under a Y rotation
       lands at (sin, cos), which is why this is not just o.x/o.z. */
    if(LH.World&&LH.World.lights){
      var sr=o.rot||0, so=d/2+0.9, sl=Geo.col3(signCol);
      LH.World.lights.push({
        x:(o.x||0)+Math.sin(sr)*so, y:y0+0.44+3.42, z:(o.z||0)+Math.cos(sr)*so,
        r:7.5, col:[sl[0],sl[1],sl[2]], power:0.75});
    }
  }
  /* Chimneys, vents, aerials — the roofline is the part of a building
     you actually see across a town, and a bare one reads as a model. */
  if(kind!=='flat'&&rng()<0.7){
    b.mat(st.base);
    b.push();b.translate((rng()-0.5)*w*0.5,rTop+0.5,(rng()-0.5)*d*0.3);
    b.chamfer(0,0,0,0.62,1.30,0.62,st.baseCol,0.05);b.pop();
  }
  if(kind==='flat'){
    b.mat('panel');
    for(var v=0;v<2+((rng()*3)|0);v++){
      b.push();
      b.translate((rng()-0.5)*w*0.7,rTop+0.30,(rng()-0.5)*d*0.7);
      b.cylinder(0,0,0,0.24,0.24,0.55,8,'#6E7682');
      b.push();b.translate(0,0.34,0);
      b.chamfer(0,0,0,0.62,0.10,0.62,'#5A626E',0.03);b.pop();
      b.pop();
    }
  }
  b.pop();
  return {top:rTop+y0,front:d/2};
};

/* A market stall: a frame, a striped canopy and a counter of goods. */
A.stall=function(b,o){
  var rng=M.rng(o.seed||3);
  b.push();
  b.translate(o.x||0,o.y||0,o.z||0);
  b.rotate(0,o.rot||0,0);
  b.mat('planks');
  for(var i=0;i<4;i++){
    var sx=(i<2?-1:1)*1.5, sz=(i%2?-1:1)*1.1;
    b.push();b.translate(sx,1.1,sz);
    b.cylinder(0,0,0,0.09,0.08,2.2,7,'#8A6A48');b.pop();
  }
  b.push();b.translate(0,0.92,0);
  b.chamfer(0,0,0,3.2,0.12,2.0,'#B08A5E',0.03);b.pop();
  b.push();b.translate(0,0.46,-1.0);
  b.chamfer(0,0,0,3.2,0.92,0.10,'#9C7A58',0.03);b.pop();
  /* canopy: alternating stripes as separate slabs */
  b.mat('fabric');
  var c1=o.col||'#C4485E';
  for(var s=0;s<6;s++){
    b.push();
    b.translate(-1.5+s*0.6+0.3,2.30+ (s%2?0.02:0),0);
    b.rotate(0,0,0);
    b.chamfer(0,0,0,0.58,0.09,2.6,s%2?c1:'#EFE6D6',0.02,{uvScale:2});
    b.pop();
  }
  b.mat('planks');
  b.push();b.translate(0,2.44,0);
  b.chamfer(0,0,0,3.5,0.10,0.16,'#6E5236',0.02);b.pop();
  /* goods on the counter */
  b.mat('crystal',0.25);
  for(var g=0;g<5;g++){
    b.push();
    b.translate(-1.2+g*0.6,1.10,rng()*0.5-0.2);
    b.sphere(0,0,0,0.13+rng()*0.06,8,6,
      ['#5BE8D0','#F5A03C','#B269FF','#57D07A','#489BFF'][g]);
    b.pop();
  }
  b.pop();
};

LH.Arch=A;
})();


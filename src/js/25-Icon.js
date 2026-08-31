/* ============================================================
   LH.Icon — inventory icons, drawn not downloaded.

   Every icon is generated from the same row that describes the item
   in the world, so a block's icon and its surface can never drift
   apart: both read `mat` and `col`. Blocks get an isometric cube cut
   from the real material texture; tools, weapons and cosmetics get a
   drawn silhouette; fish get a body shaped by their weight class.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,D=LH.Data,Tex=LH.Tex;
var I={},cache={};
var S=72;                       /* icon side, in pixels */

function mk(){
  var cv=document.createElement('canvas');
  cv.width=cv.height=S;
  return cv;
}
function hexOf(c){return c&&c.charAt(0)==='#'?c:'#CCCCCC';}
function shade(c,amt){return LH.Geo.shade(hexOf(c),amt);}

/* Pull the item's own material out of the texture atlas so the icon is
   literally made of the surface it will have in the world. */
function matPattern(ctx,matName,tint,size){
  var idx=Tex.NAME[matName];
  var src=(idx!==undefined&&Tex.canvases)?Tex.canvases[idx]:null;
  if(!src)return null;
  var tmp=document.createElement('canvas');
  tmp.width=tmp.height=size;
  var c=tmp.getContext('2d');
  c.drawImage(src,0,0,Tex.SIZE*0.6,Tex.SIZE*0.6,0,0,size,size);
  if(tint&&tint!=='#FFFFFF'){
    c.globalCompositeOperation='multiply';
    c.fillStyle=tint;c.fillRect(0,0,size,size);
    c.globalCompositeOperation='destination-in';
    c.drawImage(tmp,0,0);
    c.globalCompositeOperation='source-over';
  }
  return tmp;
}

/* An isometric block: three faces from the same material at three
   brightnesses. Cheap, and it reads as a block instantly.

   It now reads as the *right* block. Every placeable shape used to
   come out of here as a full cube, so a wallpaper, a fence, a lamp
   post and a sapling were four identical squares with different
   tints — which on a catalogue this size is a wall of the same
   picture. The footprint and the height come from the shape, so a
   pane is thin, a slab is low, a pillar is tall and narrow, and a
   plant and a lamp get the one extra mark that names them. */
var SHAPE_BOX={
  cube:  {w:1.00,t:1.00,h:1.00},
  slab:  {w:1.00,t:1.00,h:0.42},
  pillar:{w:0.46,t:0.46,h:1.34},
  pane:  {w:1.00,t:0.16,h:1.10},
  fence: {w:0.94,t:0.22,h:0.92},
  lamp:  {w:0.42,t:0.42,h:1.10},
  plant: {w:0.60,t:0.60,h:0.30}
};
function cube(ctx,mat,col,shapeName){
  var box=SHAPE_BOX[shapeName]||SHAPE_BOX.cube;
  var w=S*0.62*box.w, h=S*0.31*box.t;
  var cx=S/2, cy=S*0.56+S*0.06*(1-box.h);
  var tex=matPattern(ctx,mat,col,64);
  var lift=S*0.31*box.h;

  function face(pts,bright){
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0],pts[0][1]);
    for(var i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);
    ctx.closePath();
    ctx.clip();
    if(tex){
      ctx.globalAlpha=1;
      ctx.drawImage(tex,cx-w,cy-h*2.2,w*2,h*4.4);
    }else{
      ctx.fillStyle=hexOf(col);ctx.fillRect(0,0,S,S);
    }
    ctx.fillStyle=bright>0?'rgba(255,255,255,'+bright+')'
                          :'rgba(0,0,0,'+(-bright)+')';
    ctx.fillRect(0,0,S,S);
    ctx.restore();
  }
  var topY=cy-lift;
  /* top */
  face([[cx,topY-h/2],[cx+w/2,topY],[cx,topY+h/2],[cx-w/2,topY]],0.16);
  /* left */
  face([[cx-w/2,topY],[cx,topY+h/2],[cx,cy+h/2],[cx-w/2,cy]],-0.10);
  /* right */
  face([[cx+w/2,topY],[cx,topY+h/2],[cx,cy+h/2],[cx+w/2,cy]],-0.28);
  /* edge highlight */
  ctx.strokeStyle='rgba(255,255,255,.20)';ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(cx-w/2,topY);ctx.lineTo(cx,topY-h/2);ctx.lineTo(cx+w/2,topY);
  ctx.stroke();

  /* One mark to name the shape, drawn over the block rather than
     modelled into it — an icon has about forty pixels to work with. */
  if(shapeName==='plant'){
    stroke(ctx,[[cx,topY],[cx,topY-S*0.20]],'#5A8A3C',3);
    ctx.fillStyle='#6FC04E';
    ctx.beginPath();ctx.ellipse(cx-S*0.07,topY-S*0.17,S*0.075,S*0.045,-0.5,0,6.3);
    ctx.fill();
    ctx.beginPath();ctx.ellipse(cx+S*0.07,topY-S*0.21,S*0.075,S*0.045,0.5,0,6.3);
    ctx.fill();
  }else if(shapeName==='lamp'){
    ctx.fillStyle='rgba(255,232,160,.92)';
    ctx.beginPath();ctx.arc(cx,topY-S*0.06,S*0.11,0,6.3);ctx.fill();
    ctx.globalAlpha=0.35;
    ctx.beginPath();ctx.arc(cx,topY-S*0.06,S*0.19,0,6.3);ctx.fill();
    ctx.globalAlpha=1;
  }else if(shapeName==='fence'){
    ctx.strokeStyle='rgba(0,0,0,.30)';ctx.lineWidth=2;
    for(var fx=-1;fx<=1;fx++){
      ctx.beginPath();
      ctx.moveTo(cx+fx*w*0.30,topY+h*0.10);
      ctx.lineTo(cx+fx*w*0.30,cy+h*0.30);
      ctx.stroke();
    }
  }
}

function stroke(ctx,pts,col,width,cap){
  ctx.strokeStyle=col;ctx.lineWidth=width;
  ctx.lineCap=cap||'round';ctx.lineJoin='round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0],pts[0][1]);
  for(var i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.stroke();
}
function poly(ctx,pts,col){
  ctx.fillStyle=col;ctx.beginPath();
  ctx.moveTo(pts[0][0],pts[0][1]);
  for(var i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.closePath();ctx.fill();
}

var DRAW={};

DRAW.pickaxe=function(ctx,c){
  stroke(ctx,[[22,58],[48,20]],'#7A5636',7);
  stroke(ctx,[[22,58],[48,20]],'#A8794E',4);
  ctx.save();ctx.translate(48,20);ctx.rotate(-0.72);
  poly(ctx,[[-24,-3],[24,-3],[20,5],[-20,5]],c);
  poly(ctx,[[-24,-3],[24,-3],[22,0],[-22,0]],shade(c,26));
  ctx.restore();
};
DRAW.axe=function(ctx,c){
  stroke(ctx,[[24,58],[46,20]],'#7A5636',7);
  stroke(ctx,[[24,58],[46,20]],'#A8794E',4);
  ctx.save();ctx.translate(46,22);ctx.rotate(-0.5);
  poly(ctx,[[-4,-14],[16,-20],[24,0],[16,20],[-4,14]],c);
  poly(ctx,[[-4,-14],[10,-17],[14,0],[10,17],[-4,14]],shade(c,22));
  ctx.restore();
};
DRAW.sword=function(ctx,c){
  poly(ctx,[[36,10],[42,18],[42,46],[36,54],[30,46],[30,18]],c);
  poly(ctx,[[36,10],[39,18],[39,46],[36,50],[33,46],[33,18]],shade(c,30));
  stroke(ctx,[[22,50],[50,50]],'#C9A24E',6);
  stroke(ctx,[[36,50],[36,62]],'#6E5236',6);
  ctx.fillStyle='#C9A24E';ctx.beginPath();ctx.arc(36,64,4,0,6.283);ctx.fill();
};
DRAW.rod=function(ctx,c){
  stroke(ctx,[[16,60],[54,14]],'#8A6A44',5);
  stroke(ctx,[[40,30],[54,14]],c,3);
  ctx.strokeStyle='rgba(232,239,250,.6)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(54,14);
  ctx.quadraticCurveTo(48,34,40,52);ctx.stroke();
  ctx.fillStyle='#E8EFFA';ctx.beginPath();ctx.arc(40,54,3.4,0,6.283);ctx.fill();
  ctx.fillStyle='#C4485E';ctx.beginPath();ctx.arc(40,54,3.4,3.14,6.283);ctx.fill();
  ctx.fillStyle='#5E6672';ctx.beginPath();ctx.arc(26,50,5,0,6.283);ctx.fill();
};
DRAW.wrench=function(ctx,c){
  ctx.save();ctx.translate(36,36);ctx.rotate(-0.7);
  stroke(ctx,[[0,18],[0,-8]],c,8);
  ctx.lineWidth=7;ctx.strokeStyle=c;
  ctx.beginPath();ctx.arc(0,-14,8,0.6,2.54,true);ctx.stroke();
  ctx.beginPath();ctx.arc(0,22,7,3.74,5.68,true);ctx.stroke();
  ctx.restore();
};
DRAW.torch=function(ctx,c){
  stroke(ctx,[[36,60],[36,32]],'#8A6A44',6);
  var g=ctx.createRadialGradient(36,24,1,36,24,16);
  g.addColorStop(0,'#FFF0C0');g.addColorStop(0.5,'#FFB13C');
  g.addColorStop(1,'rgba(255,120,40,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(36,24,16,0,6.283);ctx.fill();
};
DRAW.fish=function(ctx,c,it){
  var w=it.props&&it.props.w?it.props.w[1]:1;
  var big=M.clamp(Math.log(1+w)/Math.log(260),0,1);
  var L=20+big*14, H=8+big*9;
  ctx.save();ctx.translate(38,38);
  poly(ctx,[[-L,0],[-L*0.4,-H],[L*0.55,-H*0.8],[L,0],[L*0.55,H*0.8],[-L*0.4,H]],c);
  poly(ctx,[[-L,0],[-L*0.4,-H*0.5],[L*0.3,-H*0.3],[L*0.6,0]],shade(c,24));
  /* tail */
  poly(ctx,[[-L,0],[-L-11,-9],[-L-7,0],[-L-11,9]],shade(c,-18));
  /* fin */
  poly(ctx,[[-2,-H*0.9],[10,-H-8],[14,-H*0.7]],shade(c,-12));
  ctx.fillStyle='#0E1219';ctx.beginPath();ctx.arc(L*0.6,-2,2.6,0,6.283);ctx.fill();
  ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(L*0.6+0.9,-2.8,1,0,6.283);ctx.fill();
  ctx.restore();
};
DRAW.wings=function(ctx,c){
  for(var s=-1;s<=1;s+=2){
    ctx.save();ctx.translate(36,38);ctx.scale(s,1);
    for(var i=0;i<4;i++){
      var t=i/3;
      poly(ctx,[[2,4-t*4],[10+t*16,-6-t*14],[12+t*18,-2-t*12],[3,8-t*3]],
        i%2?c:shade(c,-14));
    }
    ctx.restore();
  }
};
DRAW.hat=function(ctx,c){
  poly(ctx,[[16,44],[56,44],[52,38],[20,38]],shade(c,-16));
  ctx.fillStyle=c;ctx.beginPath();
  ctx.ellipse(36,34,15,13,0,3.14,6.283);ctx.fill();
  ctx.fillStyle=shade(c,18);ctx.beginPath();
  ctx.ellipse(32,30,7,5,0,3.14,6.283);ctx.fill();
};
DRAW.crown=function(ctx,c){
  poly(ctx,[[16,46],[56,46],[56,38],[16,38]],shade(c,-10));
  poly(ctx,[[16,38],[24,20],[30,34],[36,16],[42,34],[48,20],[56,38]],c);
  var J=['#E8354E','#3E7BE0','#D94BC8','#4FD06A'];
  for(var i=0;i<4;i++){
    ctx.fillStyle=J[i];ctx.beginPath();
    ctx.arc(21+i*10,42,3,0,6.283);ctx.fill();
  }
};
DRAW.shirt=function(ctx,c){
  poly(ctx,[[24,20],[48,20],[56,28],[50,34],[48,56],[24,56],[22,34],[16,28]],c);
  poly(ctx,[[24,20],[36,20],[36,56],[24,56]],shade(c,10));
  poly(ctx,[[30,20],[42,20],[36,28]],shade(c,-24));
};
DRAW.hair=function(ctx,c){
  ctx.fillStyle=c;ctx.beginPath();
  ctx.ellipse(36,32,17,16,0,3.14,6.283);ctx.fill();
  ctx.fillRect(19,32,34,10);
  ctx.fillStyle=shade(c,16);ctx.beginPath();
  ctx.ellipse(30,26,8,5,-0.4,0,6.283);ctx.fill();
};
DRAW.pet=function(ctx,c){
  ctx.fillStyle=c;
  ctx.beginPath();ctx.ellipse(32,44,15,10,0,0,6.283);ctx.fill();
  ctx.beginPath();ctx.arc(48,36,9,0,6.283);ctx.fill();
  poly(ctx,[[43,29],[46,20],[50,29]],shade(c,-14));
  poly(ctx,[[50,29],[54,21],[56,30]],shade(c,-14));
  stroke(ctx,[[18,42],[10,30]],c,4);
  ctx.fillStyle='#0E1219';ctx.beginPath();ctx.arc(51,35,1.8,0,6.283);ctx.fill();
};
DRAW.aura=function(ctx,c){
  for(var i=0;i<3;i++){
    ctx.strokeStyle=c;ctx.globalAlpha=0.75-i*0.2;ctx.lineWidth=3-i*0.6;
    ctx.beginPath();ctx.ellipse(36,42,14+i*8,5+i*3,0,0,6.283);ctx.stroke();
  }
  ctx.globalAlpha=1;
  var g=ctx.createRadialGradient(36,34,1,36,34,20);
  g.addColorStop(0,c);g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.globalAlpha=0.5;ctx.fillStyle=g;
  ctx.beginPath();ctx.arc(36,34,20,0,6.283);ctx.fill();
  ctx.globalAlpha=1;
};
DRAW.cape=function(ctx,c){
  poly(ctx,[[26,18],[46,18],[54,58],[44,52],[36,58],[28,52],[18,58]],c);
  poly(ctx,[[26,18],[36,18],[36,58],[28,52]],shade(c,12));
  poly(ctx,[[26,18],[46,18],[44,24],[28,24]],shade(c,-22));
};
/* A rounded rectangle path. Canvas has roundRect now, and it is not
   in every browser this game has to open in. */
function round(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}
DRAW.pants=function(ctx,c){
  ctx.fillStyle=c;
  ctx.beginPath();
  ctx.moveTo(S*0.32,S*0.22);ctx.lineTo(S*0.68,S*0.22);
  ctx.lineTo(S*0.64,S*0.80);ctx.lineTo(S*0.54,S*0.80);
  ctx.lineTo(S*0.50,S*0.48);ctx.lineTo(S*0.46,S*0.80);
  ctx.lineTo(S*0.36,S*0.80);
  ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.22)';
  ctx.fillRect(S*0.32,S*0.22,S*0.36,S*0.06);
};
DRAW.shoes=function(ctx,c){
  ctx.fillStyle=c;
  ctx.beginPath();
  ctx.moveTo(S*0.24,S*0.68);ctx.lineTo(S*0.40,S*0.68);
  ctx.lineTo(S*0.44,S*0.48);ctx.lineTo(S*0.56,S*0.48);
  ctx.quadraticCurveTo(S*0.80,S*0.56,S*0.78,S*0.68);
  ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.34)';
  ctx.fillRect(S*0.22,S*0.68,S*0.58,S*0.07);
};
DRAW.pack=function(ctx,c){
  ctx.fillStyle=c;
  round(ctx,S*0.30,S*0.30,S*0.40,S*0.46,S*0.09);ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.26)';
  round(ctx,S*0.34,S*0.52,S*0.32,S*0.14,S*0.05);ctx.fill();
  ctx.strokeStyle=c;ctx.lineWidth=S*0.05;ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(S*0.38,S*0.30);ctx.quadraticCurveTo(S*0.50,S*0.16,S*0.62,S*0.30);
  ctx.stroke();
};
DRAW.face=function(ctx,c){
  ctx.strokeStyle=c;ctx.lineWidth=S*0.055;
  ctx.beginPath();ctx.arc(S*0.34,S*0.50,S*0.15,0,6.3);ctx.stroke();
  ctx.beginPath();ctx.arc(S*0.66,S*0.50,S*0.15,0,6.3);ctx.stroke();
  ctx.beginPath();ctx.moveTo(S*0.49,S*0.50);ctx.lineTo(S*0.51,S*0.50);
  ctx.moveTo(S*0.19,S*0.44);ctx.lineTo(S*0.10,S*0.40);
  ctx.moveTo(S*0.81,S*0.44);ctx.lineTo(S*0.90,S*0.40);
  ctx.stroke();
};
DRAW.tache=function(ctx,c){
  ctx.fillStyle=c;
  ctx.beginPath();
  ctx.moveTo(S*0.50,S*0.44);
  ctx.bezierCurveTo(S*0.30,S*0.36,S*0.14,S*0.50,S*0.20,S*0.62);
  ctx.bezierCurveTo(S*0.30,S*0.70,S*0.42,S*0.58,S*0.50,S*0.54);
  ctx.bezierCurveTo(S*0.58,S*0.58,S*0.70,S*0.70,S*0.80,S*0.62);
  ctx.bezierCurveTo(S*0.86,S*0.50,S*0.70,S*0.36,S*0.50,S*0.44);
  ctx.fill();
};
DRAW.coat=function(ctx,c){
  ctx.fillStyle=c;
  ctx.beginPath();
  ctx.moveTo(S*0.30,S*0.24);ctx.lineTo(S*0.70,S*0.24);
  ctx.lineTo(S*0.76,S*0.84);ctx.lineTo(S*0.24,S*0.84);
  ctx.closePath();ctx.fill();
  /* the lapels, which is what makes it a coat and not a sack */
  ctx.fillStyle='rgba(0,0,0,.30)';
  ctx.beginPath();
  ctx.moveTo(S*0.44,S*0.24);ctx.lineTo(S*0.50,S*0.54);
  ctx.lineTo(S*0.56,S*0.24);ctx.closePath();ctx.fill();
  ctx.fillRect(S*0.47,S*0.24,S*0.06,S*0.60);
};
DRAW.material=function(ctx,c,it){
  /* a small heap of nuggets — reads as "raw stuff" at any size */
  var pts=[[28,48,10],[44,46,9],[36,38,8],[46,54,6],[26,56,6]];
  for(var i=0;i<pts.length;i++){
    ctx.fillStyle=i%2?c:shade(c,-16);
    ctx.beginPath();ctx.arc(pts[i][0],pts[i][1],pts[i][2],0,6.283);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.22)';
    ctx.beginPath();ctx.arc(pts[i][0]-pts[i][2]*0.3,pts[i][1]-pts[i][2]*0.4,
      pts[i][2]*0.32,0,6.283);ctx.fill();
  }
};
DRAW.food=function(ctx,c){
  ctx.fillStyle=c;ctx.beginPath();
  ctx.ellipse(36,40,19,13,0,0,6.283);ctx.fill();
  ctx.fillStyle=shade(c,18);ctx.beginPath();
  ctx.ellipse(32,36,10,6,-0.3,0,6.283);ctx.fill();
  ctx.strokeStyle=shade(c,-26);ctx.lineWidth=2;
  for(var i=-1;i<=1;i++){
    ctx.beginPath();ctx.moveTo(30+i*7,32);ctx.lineTo(34+i*7,28);ctx.stroke();
  }
};
DRAW.tonic=function(ctx,c){
  ctx.fillStyle='rgba(255,255,255,.14)';
  poly(ctx,[[30,18],[42,18],[42,26],[48,36],[48,56],[24,56],[24,36],[30,26]]);
  ctx.fillStyle=c;
  poly(ctx,[[26,38],[46,38],[46,54],[26,54]],c);
  ctx.fillStyle='rgba(255,255,255,.28)';
  poly(ctx,[[28,38],[33,38],[33,54],[28,54]]);
  ctx.fillStyle='#6E5236';ctx.fillRect(29,14,14,6);
};
DRAW.quest=function(ctx,c){
  poly(ctx,[[36,14],[54,26],[48,54],[24,54],[18,26]],c);
  poly(ctx,[[36,14],[45,20],[42,50],[30,50],[27,20]],shade(c,20));
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.font='bold 20px sans-serif';
  ctx.textAlign='center';ctx.fillText('!',36,44);
};

/* Which drawer an item gets. Everything routes through `cat`, `shape`
   and `props`, never through the item's key. */
function drawerFor(it){
  if(it.props&&it.props.fish)return DRAW.fish;
  if(it.cat==='block'||it.cat==='furniture')return null;   /* cube path */
  if(it.cat==='material')return DRAW.material;
  if(it.cat==='quest')return DRAW.quest;
  if(it.cat==='consumable')
    return (it.props&&it.props.buff&&!it.props.heal)?DRAW.tonic:DRAW.food;
  var st=it.props&&it.props.style;
  if(it.cat==='cosmetic'){
    var slot=it.props.slot;
    if(slot==='wings')return DRAW.wings;
    if(slot==='hat')return st==='crown'||st==='halo'?DRAW.crown:DRAW.hat;
    if(slot==='hair')return DRAW.hair;
    if(slot==='shirt')return DRAW.shirt;
    if(slot==='cape')return DRAW.cape;
    if(slot==='pet')return DRAW.pet;
    if(slot==='aura')return DRAW.aura;
    /* Six slots used to fall through to the shirt glyph, so trousers,
       shoes, a rucksack, a pair of glasses, a moustache and a coat
       were all drawn as the same t-shirt. */
    if(slot==='pants')return DRAW.pants;
    if(slot==='shoes')return DRAW.shoes;
    if(slot==='back')return DRAW.pack;
    if(slot==='acc')return DRAW.face;
    if(slot==='facial')return DRAW.tache;
    if(slot==='over')return DRAW.coat;
    return DRAW.shirt;
  }
  if(st&&DRAW[st])return DRAW[st];
  if(it.cat==='weapon')return DRAW.sword;
  if(it.cat==='fishing')return DRAW.rod;
  return DRAW.pickaxe;
}

/* Rarity ring behind everything: the tier has to be readable from the
   hotbar at a glance, the way it was in the 2D build. */
function backdrop(ctx,it){
  var col=D.rarityCol(it.rarity);
  var g=ctx.createRadialGradient(S/2,S*0.52,2,S/2,S*0.52,S*0.56);
  g.addColorStop(0,'rgba(0,0,0,0)');
  g.addColorStop(0.68,'rgba(0,0,0,0)');
  g.addColorStop(1,col);
  ctx.globalAlpha=it.rarity>=3?0.32:0.18;
  ctx.fillStyle=g;ctx.fillRect(0,0,S,S);
  ctx.globalAlpha=1;
  if(it.rarity>=4){
    /* a couple of sparks on the good stuff */
    ctx.fillStyle=col;
    var sp=[[12,16,2],[60,22,1.6],[54,58,1.8],[16,56,1.4]];
    for(var i=0;i<sp.length;i++){
      ctx.globalAlpha=0.85;
      ctx.beginPath();ctx.arc(sp[i][0],sp[i][1],sp[i][2],0,6.283);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
}

I.of=function(key){
  var hit=cache[key];
  if(hit)return hit;
  var it=D.byKey(key);
  if(!it)return null;
  var cv=mk(),ctx=cv.getContext('2d');
  backdrop(ctx,it);
  var fn=drawerFor(it);
  if(fn)fn(ctx,hexOf(it.col),it);
  else cube(ctx,it.mat,it.col,it.shape);
  if(it.emis>0.2){
    /* emissive items get a bloom in the icon too, so a lamp looks lit
       in the inventory as well as in the world */
    ctx.globalCompositeOperation='lighter';
    var g=ctx.createRadialGradient(S/2,S*0.5,2,S/2,S*0.5,S*0.5);
    g.addColorStop(0,hexOf(it.col));g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalAlpha=0.35*it.emis;ctx.fillStyle=g;ctx.fillRect(0,0,S,S);
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  var url=cv.toDataURL();
  cache[key]=url;
  return url;
};
I.clear=function(){cache={};};

LH.Icon=I;
})();


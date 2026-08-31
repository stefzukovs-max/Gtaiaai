/* ============================================================
   LH.Tex — procedural surfaces.

   Every material in the game is painted here into a 2D canvas and
   uploaded as one layer of a texture array, so the whole world
   draws with a single texture bound. Nothing is downloaded.

   The rule each material follows: a base wash, a mid-frequency
   pattern that gives it identity (planks, courses, panel seams),
   and a high-frequency grain so it does not read as flat colour
   under a moving light.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,Geo=LH.Geo,Tex={};
var SZ=256;

function make(){
  var cv=document.createElement('canvas');
  cv.width=cv.height=SZ;
  return cv;
}
/* seamless value noise: sample on a torus so the tile wraps */
function tileNoise(x,y,freq,seed){
  var a=M.noise2(x*freq,y*freq,seed);
  var b=M.noise2((x-1)*freq,y*freq,seed);
  var c=M.noise2(x*freq,(y-1)*freq,seed);
  var d=M.noise2((x-1)*freq,(y-1)*freq,seed);
  return M.lerp(M.lerp(a,b,x),M.lerp(c,d,x),y);
}
function tileFbm(x,y,freq,seed,oct){
  oct=oct||4;
  var s=0,amp=1,norm=0,f=freq;
  for(var i=0;i<oct;i++){s+=tileNoise(x,y,f,seed+i*13)*amp;norm+=amp;amp*=0.5;f*=2;}
  return s/norm;
}

/* Paint per-pixel through a callback returning a hex colour. Slower to
   write than gradients but it is the only way to get grain that
   survives mipmapping. */
function paint(cv,fn,label){
  var ctx=cv.getContext('2d');
  var img=ctx.createImageData(SZ,SZ),d=img.data;
  var bad=0;
  for(var y=0;y<SZ;y++)for(var x=0;x<SZ;x++){
    var u=x/SZ,v=y/SZ;
    var c=fn(u,v,x,y);
    var i=(y*SZ+x)*4;
    /* A NaN anywhere in a recipe writes as zero and the material ships
       black with no error. Catch it at the source and say which one. */
    if(c[0]!==c[0]||c[1]!==c[1]||c[2]!==c[2]){
      bad++;c=[255,0,220];
    }
    d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=c.length>3?c[3]:255;
  }
  if(bad)console.warn('material "'+(label||'?')+'" produced '+bad+
    ' NaN pixels — shown in magenta');
  ctx.putImageData(img,0,0);
  return cv;
}
/* ---------------- surface relief ----------------
   Every material in this world was flat. Geometry normals only, so a
   brick wall lit from the side was a smooth plane with brick-coloured
   rectangles on it, and cloth, bark, gravel and skin were all equally
   glassy-smooth under the same highlight.

   Rather than author a second image per material, the height is taken
   from the luminance of the one that already exists. That is a guess,
   but a good one here: every recipe in this file was painted by making
   the recessed parts darker — mortar lines, plank grooves, the gaps
   between cobbles. Where the guess is wrong it is wrong in *sign*
   rather than in shape, which is why `bump` is signed: brick's mortar
   is lighter than its brick and further in, so brick's bump is
   negative.

   The blue channel carries roughness, so one texture fetch delivers
   both. Normals only need two channels — the third is reconstructed. */
function bumpMap(cv,opt,label){
  opt=opt||{};
  var src=cv.getContext('2d').getImageData(0,0,SZ,SZ).data;
  var h=new Float32Array(SZ*SZ),i;
  for(i=0;i<SZ*SZ;i++)
    h[i]=(src[i*4]*0.30+src[i*4+1]*0.59+src[i*4+2]*0.11)/255;
  /* One blur. The grain in these recipes is per-pixel noise, and a
     normal map built straight off it is a field of static that turns
     into flat grey two mip levels down — costing the fetch and
     delivering nothing. */
  var bl=new Float32Array(SZ*SZ),x,y,dx,dy,sum;
  for(y=0;y<SZ;y++)for(x=0;x<SZ;x++){
    sum=0;
    for(dy=-1;dy<=1;dy++)for(dx=-1;dx<=1;dx++)
      sum+=h[((y+dy+SZ)%SZ)*SZ+((x+dx+SZ)%SZ)];
    bl[y*SZ+x]=sum/9;
  }
  var out=make(),ctx=out.getContext('2d');
  var img=ctx.createImageData(SZ,SZ),d=img.data;
  var k=(opt.bump===undefined?0.6:opt.bump)*5.0;
  var rough=Math.round(255*M.clamp(opt.rough===undefined?0.80:opt.rough,0,1));
  for(y=0;y<SZ;y++)for(x=0;x<SZ;x++){
    var l=bl[y*SZ+((x-1+SZ)%SZ)], r=bl[y*SZ+((x+1)%SZ)];
    var up=bl[((y-1+SZ)%SZ)*SZ+x], dn=bl[((y+1)%SZ)*SZ+x];
    /* The upload flips Y, so the canvas's downward y is the texture's
       decreasing v — hence the sign on the second gradient. */
    var nx=-(r-l)*k, ny=(dn-up)*k, nz=1;
    var len=Math.sqrt(nx*nx+ny*ny+nz*nz);
    var o=(y*SZ+x)*4;
    d[o]=Math.round((nx/len*0.5+0.5)*255);
    d[o+1]=Math.round((ny/len*0.5+0.5)*255);
    d[o+2]=rough;
    d[o+3]=255;
  }
  ctx.putImageData(img,0,0);
  return out;
}

function rgb(hex){var h=hex.charAt(0)==='#'?hex.slice(1):hex;
  var n=parseInt(h,16);return [(n>>16)&255,(n>>8)&255,n&255];}
function mixv(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
function litv(c,amt){return [M.clamp(c[0]+amt,0,255),M.clamp(c[1]+amt,0,255),M.clamp(c[2]+amt,0,255)];}

/* ---------------- material recipes ---------------- */
var R={};

/* a plain speckled solid — the base every other recipe starts from */
R.solid=function(lo,hi,grain,seed,oct){
  var L=rgb(lo),H=rgb(hi);grain=grain===undefined?12:grain;
  return function(u,v){
    var n=tileFbm(u,v,6,seed||1,oct||4);
    var c=mixv(L,H,n);
    var g=(M.hash2(u*SZ|0,v*SZ|0,seed*7+3)-0.5)*grain;
    return litv(c,g);
  };
};

/* The face map is authored in the head's own cylindrical unwrap:
   u = 0 at the character's left ear, 0.25 dead centre front, 0.5 at the
   right ear, 0.75 at the back of the skull; v = 0 at the chin and 1 at
   the crown. Those are the coordinates LH.Body.head lofts with, so a
   feature painted at (0.25, 0.212) lands on the mouth. */
/* The face map in its three-mark version rather than its portrait one.
   This is declared here, above the layer table, and not down with the
   rest of the toy palette — the table calls R.face() while it is being
   built, which is before the module body has run far enough to assign
   anything below it. Declared late, this read as undefined, the
   portrait branch shipped, and every character wore a painted jaw
   shadow and cheek hollows under flat toy lighting. */
var TOYFACE=true;

R.face=function(){
  var BASE=rgb('#F1ECE8');
  function blob(u,v,cu,cv,ru,rv){
    var du=(u-cu)/ru, dv=(v-cv)/rv;
    var d=du*du+dv*dv;
    return d>=1?0:(1-d)*(1-d);
  }
  /* wrap-aware distance, so a feature near u=0 does not tear at the ear */
  function wrapU(u,cu){var d=u-cu;if(d>0.5)d-=1;if(d<-0.5)d+=1;return d;}
  function blobW(u,v,cu,cv,ru,rv){
    var du=wrapU(u,cu)/ru, dv=(v-cv)/rv;
    var d=du*du+dv*dv;
    return d>=1?0:(1-d)*(1-d);
  }
  var EYE_U=[0.185,0.315], EYE_V=0.446;
  /* Everything below this line paints a real face: sockets, a nose
     with alae, lips with a philtrum, cheek hollows, blood in the ears
     and pores over all of it. None of that belongs on a toy. The
     reference's face is three marks on a flat field, and the eyes are
     geometry here rather than paint, so what the map has to supply is
     a mouth, the hint of a nose, and enough of a socket that the eye
     balls do not look glued on. */
  if(TOYFACE)return function(u,v){
    /* The face map does more work now, because the geometry does less.
       The eye is four flat discs and the lid is one cap; everything
       that used to be a small sphere stuck on the face — the crease
       above the eye, the shadow the brow casts into the socket, the
       soft dark under the lower lash, the corner of the mouth — is a
       mark here instead. Paint costs nothing at silhouette and never
       reads as a lump. */
    var h=1-v, c=BASE.slice(), i, e;
    for(i=0;i<2;i++){
      var ex=EYE_U[i];
      /* the socket: a soft cool pool the lens sits in */
      e=blobW(u,h,ex,EYE_V-0.004,0.086,0.092);
      c=mixv(c,rgb('#E2C6BC'),e*0.50);
      /* the crease above it, tighter and darker at the outer end */
      e=blobW(u,h,ex+(i?0.010:-0.010),EYE_V+0.060,0.070,0.026);
      c=mixv(c,rgb('#C8A294'),e*0.62);
      /* the shadow the upper lash drops onto the white */
      e=blobW(u,h,ex,EYE_V+0.026,0.062,0.020);
      c=mixv(c,rgb('#A8867C'),e*0.52);
      /* and a little warmth under the eye, which is what stops the
         socket reading as a bruise */
      e=blobW(u,h,ex,EYE_V-0.058,0.060,0.024);
      c=mixv(c,rgb('#F2C8B6'),e*0.44);
      /* the outer corner, where the lids meet */
      e=blobW(u,h,ex+(i?0.052:-0.052),EYE_V-0.006,0.024,0.020);
      c=mixv(c,rgb('#B08C80'),e*0.46);
    }
    /* the bridge, lifted, so the two sockets are not one band */
    e=blob(u,h,0.25,EYE_V+0.010,0.030,0.070);
    c=mixv(c,rgb('#FBEDE4'),e*0.40);
    /* the nose: a soft shadow under the tip rather than a modelled one */
    e=blob(u,h,0.25,0.300,0.044,0.040);
    c=mixv(c,rgb('#F0CDBE'),e*0.40);
    e=blob(u,h,0.25,0.268,0.038,0.016);
    c=mixv(c,rgb('#C9A091'),e*0.44);
    /* the mouth: a line with corners, not a lozenge */
    e=blob(u,h,0.25,0.212,0.062,0.015);
    c=mixv(c,rgb('#9A4E46'),e*0.95);
    for(i=0;i<2;i++){
      e=blob(u,h,0.25+(i?0.054:-0.054),0.218,0.018,0.014);
      c=mixv(c,rgb('#8A423C'),e*0.80);
    }
    /* the lower lip catching light under it */
    e=blob(u,h,0.25,0.194,0.050,0.016);
    c=mixv(c,rgb('#F8D4C4'),e*0.52);
    /* a touch of colour on the cheeks. One mark, and it is the
       difference between a face and a mask. */
    for(i=0;i<2;i++){
      e=blobW(u,h,EYE_U[i]+(i?0.026:-0.026),0.318,0.078,0.056);
      c=mixv(c,rgb('#F0A898'),e*0.34);
    }
    return c;
  };
  return function(u,v){
    /* The paint callback's v runs down the image; the head's v runs up
       from the chin. One flip here rather than an inverted value in
       every feature below. */
    var h=1-v;
    var c=BASE.slice();
    /* low-frequency mottling: skin is never one value across a cheek */
    var mot=tileFbm(u,v,4,613,4)-0.5;
    c=litv(c,mot*9);

    var i,e;
    /* --- eye sockets: cooler and darker, deepest at the inner corner */
    for(i=0;i<2;i++){
      e=blobW(u,h,EYE_U[i],EYE_V-0.010,0.072,0.088);
      c=mixv(c,rgb('#A98C84'),e*0.86);
      /* the crease above the lid */
      e=blobW(u,h,EYE_U[i],EYE_V+0.052,0.062,0.030);
      c=mixv(c,rgb('#BE9A8D'),e*0.62);
      /* a shadow under the lower lid, which is what makes an eye sit in
         a face rather than on it */
      e=blobW(u,h,EYE_U[i],EYE_V-0.062,0.058,0.026);
      c=mixv(c,rgb('#C29A8B'),e*0.52);
      /* brow shadow. The hair-coloured strands sit on top of this; the
         shadow is what keeps them from looking stuck on. */
      e=blobW(u,h,EYE_U[i]+(i?0.012:-0.012),EYE_V+0.145,0.070,0.036);
      c=mixv(c,rgb('#8E786E'),e*0.62);
    }
    /* --- nose: warmer down the ridge, redder at the tip and alae */
    e=blob(u,h,0.25,0.38,0.028,0.115);
    c=mixv(c,rgb('#FFF2E9'),e*0.46);
    e=blob(u,h,0.25,0.312,0.050,0.045);
    c=mixv(c,rgb('#DE9880'),e*0.58);
    for(i=0;i<2;i++){
      e=blob(u,h,0.25+(i?0.030:-0.030),0.300,0.024,0.030);
      c=mixv(c,rgb('#A87C6C'),e*0.58);
    }
    /* --- lips --- */
    e=blob(u,h,0.25,0.216,0.082,0.046);
    c=mixv(c,rgb('#BE6A5D'),e*0.88);
    e=blob(u,h,0.25,0.202,0.070,0.014);
    c=mixv(c,rgb('#7A3A33'),e*0.88);          /* the mouth line itself */
    e=blob(u,h,0.25,0.246,0.030,0.014);
    c=mixv(c,rgb('#FFF2EC'),e*0.30);          /* philtrum highlight    */
    /* --- cheeks, and the hollow under the cheekbone --- */
    for(i=0;i<2;i++){
      e=blobW(u,h,EYE_U[i]+(i?0.055:-0.055),0.320,0.100,0.090);
      c=mixv(c,rgb('#E19585'),e*0.44);
      e=blobW(u,h,EYE_U[i]+(i?0.080:-0.080),0.268,0.070,0.070);
      c=mixv(c,rgb('#B08878'),e*0.42);
    }
    /* --- ears: thin, so they carry more blood than anything else --- */
    for(i=0;i<2;i++){
      e=blobW(u,h,i?0.5:0.0,0.395,0.075,0.115);
      c=mixv(c,rgb('#DE8E78'),e*0.58);
    }
    /* --- forehead and cheekbone lift --- */
    e=blob(u,h,0.25,0.760,0.130,0.150);
    c=mixv(c,rgb('#FFFCFA'),e*0.44);
    /* --- jaw: cooler, and darker toward the underside --- */
    e=blob(u,h,0.25,0.075,0.230,0.100);
    c=mixv(c,rgb('#A99387'),e*0.56);
    /* --- pores: fine, high-frequency, and only just visible --- */
    var g=(M.hash2(u*SZ|0,v*SZ|0,911)-0.5)*10;
    var pore=tileFbm(u,v,60,733,2);
    c=litv(c,g+(pore-0.5)*7);
    return c;
  };
};

/* Grass.

   The old numbers went from a saturated mid green to a near-lime and
   sat almost entirely in one hue, which over a hillside reads as
   felt. Real turf is barely saturated at all — it is olive and khaki
   and grey-green, with the bright green confined to the new growth —
   and its variation is mostly in value rather than in hue. */
R.grass=function(){
  var DEEP=rgb('#3E5E30'), MID=rgb('#5C7C40'), DRY=rgb('#8A8E52');
  return function(u,v){
    var base=mixv(DEEP,MID,tileFbm(u,v,5,11,4));
    /* blade streaks: high-frequency stretched noise reads as grass at
       distance without any actual geometry */
    var blade=tileFbm(u*1.0,v*1.0,44,23,2);
    base=mixv(base,rgb('#7EA254'),blade*0.42);
    /* patches that have gone over, and patches that have been shaded */
    var dry=tileFbm(u,v,2.2,41,3);
    if(dry>0.62)base=mixv(base,DRY,(dry-0.62)*1.9);
    var shade=tileFbm(u,v,1.6,59,3);
    if(shade<0.34)base=litv(base,-(0.34-shade)*46);
    var g=(M.hash2(u*SZ|0,v*SZ|0,77)-0.5)*20;
    return litv(base,g);
  };
};

R.dirt=function(){
  return function(u,v){
    var base=mixv(rgb('#4A3521'),rgb('#7A5836'),tileFbm(u,v,7,5,4));
    var peb=tileFbm(u,v,26,19,2);
    if(peb>0.72)base=litv(base,26);
    if(peb<0.24)base=litv(base,-18);
    return litv(base,(M.hash2(u*SZ|0,v*SZ|0,9)-0.5)*20);
  };
};

R.sand=function(){
  return function(u,v){
    var base=mixv(rgb('#C7A972'),rgb('#EBD6A4'),tileFbm(u,v,5,31,4));
    /* wind ripples — a sine banded along one axis, warped by noise */
    var warp=tileFbm(u,v,3,37,2);
    var rip=Math.sin((v*26+warp*4)*Math.PI*2)*0.5+0.5;
    base=litv(base,(rip-0.5)*14);
    return litv(base,(M.hash2(u*SZ|0,v*SZ|0,13)-0.5)*16);
  };
};

R.stone=function(lo,hi,seed){
  lo=lo||'#4B4E59';hi=hi||'#7C818F';
  /* Default the seed once, up here. Defaulting it inline at each use
     with `seed||3` reads as safe but is not: any *arithmetic* on the
     raw parameter — seed*3+7 — evaluates to NaN when it is undefined,
     litv clamps NaN to NaN, and the whole material writes out black.
     Stone and concrete both shipped black for exactly this reason. */
  seed=seed===undefined?3:seed;
  return function(u,v){
    var base=mixv(rgb(lo),rgb(hi),tileFbm(u,v,6,seed,5));
    /* fracture lines: ridged noise thresholded to thin dark seams */
    var r=1-Math.abs(tileFbm(u,v,9,seed*3+7,3)*2-1);
    if(r>0.86)base=litv(base,-40*(r-0.86)*7);
    return litv(base,(M.hash2(u*SZ|0,v*SZ|0,seed*11)-0.5)*18);
  };
};

R.cliff=function(){
  return function(u,v){
    /* strata: horizontal bands with a warped boundary */
    var warp=tileFbm(u,v,4,53,3)*0.06;
    var band=((v+warp)*9)%1;
    var tone=tileFbm(u,v,7,59,4);
    var base=mixv(rgb('#5A5044'),rgb('#8E8271'),tone);
    base=litv(base,(band<0.12?-26:(band>0.88?16:0)));
    var r=1-Math.abs(tileFbm(u,v,14,61,3)*2-1);
    if(r>0.8)base=litv(base,-30);
    return litv(base,(M.hash2(u*SZ|0,v*SZ|0,67)-0.5)*20);
  };
};

R.planks=function(lo,hi,rows,seed){
  lo=lo||'#6B4A2C';hi=hi||'#A8794A';rows=rows||6;seed=seed||71;
  return function(u,v){
    var row=Math.floor(v*rows);
    var fy=v*rows-row;
    /* each plank gets its own tone and grain phase */
    var tone=M.hash2(row,0,seed);
    var base=mixv(rgb(lo),rgb(hi),0.25+tone*0.6);
    var grain=tileFbm(u*1.0+row*0.37,v*6.0,3,seed+row,3);
    base=mixv(base,litv(base,-24),grain*0.55);
    /* long grain streaks run with the plank */
    var streak=Math.sin((grain*5+u*10)*Math.PI*2)*0.5+0.5;
    base=litv(base,(streak-0.5)*10);
    /* the seam between planks, plus a lit top lip */
    if(fy<0.055)base=litv(base,-52);
    else if(fy<0.10)base=litv(base,16);
    /* end joints, staggered per row */
    var jx=(u+tone*0.5)*3%1;
    if(jx<0.012)base=litv(base,-44);
    return litv(base,(M.hash2(u*SZ|0,v*SZ|0,seed*3)-0.5)*14);
  };
};

/* Bark.

   The old version ran a clean sine of period 22 down the u axis for
   its cracks, and a clean sine wrapped round a trunk is corduroy — a
   regular stripe you can count, which is exactly what bark is not.
   The cracks now follow warped noise, so they wander, fork and stop;
   the ridges are broader and lower contrast; and the whole thing is
   greyer, because a wood full of chocolate-brown trunks reads as a
   toy. */
R.bark=function(){
  return function(u,v){
    var warp=tileFbm(u,v,5,83,3);
    var ridge=1-Math.abs(tileFbm(u*1.4,v*0.30,6,89,4)*2-1);
    var base=mixv(rgb('#4A4038'),rgb('#7E7264'),ridge);
    base=litv(base,(warp-0.5)*16);
    /* cracks along the grain, placed by noise rather than by period */
    var seam=tileFbm(u*3.0,v*0.16,13,97,3);
    if(seam>0.70)base=litv(base,-30*(seam-0.70)/0.30);
    var lich=tileFbm(u,v,3.2,101,3);
    if(lich>0.72)base=mixv(base,rgb('#8E9480'),(lich-0.72)*1.6);
    return litv(base,(M.hash2(u*SZ|0,v*SZ|0,91)-0.5)*14);
  };
};

R.brick=function(lo,hi,mortar,cols,rows){
  lo=lo||'#6E3A32';hi=hi||'#9C5A46';mortar=mortar||'#B9AFA0';
  cols=cols||6;rows=rows||12;
  return function(u,v){
    var row=Math.floor(v*rows);
    var off=(row%2)?0.5:0;      /* running bond */
    var cu=(u*cols+off)%1, cv2=v*rows-row;
    var mw=0.05,mh=0.10;
    if(cu<mw||cu>1-mw||cv2<mh||cv2>1-mh){
      var m=rgb(mortar);
      return litv(m,(M.hash2(u*SZ|0,v*SZ|0,101)-0.5)*18-8);
    }
    var id=Math.floor(u*cols+off)*31+row*7;
    var tone=M.hash2(id,0,103);
    var base=mixv(rgb(lo),rgb(hi),0.2+tone*0.7);
    base=litv(base,(tileFbm(u,v,20,107,3)-0.5)*26);
    /* bevel the brick face so courses catch light */
    if(cv2<mh+0.05)base=litv(base,14);
    if(cv2>1-mh-0.05)base=litv(base,-14);
    return litv(base,(M.hash2(u*SZ|0,v*SZ|0,109)-0.5)*14);
  };
};

R.panel=function(lo,hi,cells,seed,rivets){
  lo=lo||'#3A4250';hi=hi||'#6E7B8E';cells=cells||4;seed=seed||113;
  return function(u,v){
    var cx=Math.floor(u*cells),cy=Math.floor(v*cells);
    var fu=u*cells-cx,fv=v*cells-cy;
    var tone=M.hash2(cx,cy,seed);
    var base=mixv(rgb(lo),rgb(hi),0.3+tone*0.5);
    /* brushed streaks along X */
    var brush=M.hash2((u*SZ*2)|0,cy,seed+5);
    base=litv(base,(brush-0.5)*16);
    base=litv(base,(tileFbm(u,v,9,seed+11,3)-0.5)*14);
    /* panel seam + highlight lip */
    var e=0.02;
    if(fu<e||fv<e)base=litv(base,-46);
    else if(fu<e*2||fv<e*2)base=litv(base,18);
    if(rivets){
      var rd=Math.hypot(fu-0.5,fv-0.5);
      var rr=Math.hypot((fu<0.5?fu:1-fu)-0.07,(fv<0.5?fv:1-fv)-0.07);
      if(rr<0.022)base=litv(base,rr<0.014?24:-24);
    }
    return base;
  };
};

/* Paving.

   The first version had a checker, a nine per cent tone jitter and a
   uniform grout line, and over a plaza it read as graph paper: every
   cell the same size, the same two colours, the same crisp black
   cross every 1.8 metres. Three things fix that, and none of them is
   more detail inside the tile.

   A slab is laid, not printed: the tone range is wide enough that
   neighbouring slabs are visibly different stones. Some of them have
   been replaced at some point, so a few are markedly darker or paler
   than the run. And the joint between them is not a drawn line — it is
   a shadow with a soft shoulder, wider where the slabs have settled. */
R.tilefloor=function(a,b,grout,cells){
  a=a||'#6A7686';b=b||'#828E9E';grout=grout||'#4A5462';cells=cells||4;
  var A=rgb(a),B=rgb(b),G=rgb(grout);
  return function(u,v){
    var cx=Math.floor(u*cells),cy=Math.floor(v*cells);
    var fu=u*cells-cx,fv=v*cells-cy;
    /* the joint, with a per-slab width so the grid is not ruled */
    var jw=0.026+M.hash2(cx,cy,911)*0.020;
    var edge=Math.min(Math.min(fu,fv),Math.min(1-fu,1-fv));
    var chk=((cx+cy)&1)?A:B;
    var tone=M.hash2(cx,cy,131);
    var base=mixv(litv(chk,-16),litv(chk,20),tone);
    /* one slab in nine has been replaced and does not match */
    var odd=M.hash2(cx,cy,577);
    if(odd>0.90)base=litv(base,-26);
    else if(odd<0.09)base=litv(base,22);
    /* a slight warm/cool drift across the slab, and the grain in it */
    base=mixv(base,litv(base,10),tileFbm(u,v,3.5,137,3));
    base=litv(base,(tileFbm(u,v,17,139,3)-0.5)*13);
    base=litv(base,(M.hash2(u*SZ|0,v*SZ|0,151)-0.5)*9);
    if(edge<jw){
      /* soft shoulder into the joint rather than a drawn line */
      var t=M.smooth(M.clamp(edge/jw,0,1));
      base=mixv(litv(G,(M.hash2(u*SZ|0,v*SZ|0,127)-0.5)*10),base,t*t);
    }
    return base;
  };
};

R.concrete=function(lo,hi,seed){
  lo=lo||'#4A5058';hi=hi||'#767E88';
  seed=seed===undefined?139:seed;
  return function(u,v){
    var base=mixv(rgb(lo),rgb(hi),tileFbm(u,v,5,seed,5));
    var pit=M.hash2(u*SZ|0,v*SZ|0,seed*3+1);
    if(pit>0.985)base=litv(base,-40);
    var stain=tileFbm(u,v,2,seed*5+2,3);
    if(stain>0.7)base=mixv(base,rgb('#3B4147'),(stain-0.7)*1.6);
    return litv(base,(M.hash2(u*SZ|0,v*SZ|0,149)-0.5)*14);
  };
};

R.foliage=function(lo,hi,seed){
  lo=lo||'#38672F';hi=hi||'#8CB85E';
  return function(u,v){
    /* clumped leaf masses, not uniform green */
    var clump=tileFbm(u,v,8,seed||151,4);
    var fine=tileFbm(u,v,30,(seed||151)+3,2);
    var base=mixv(rgb(lo),rgb(hi),clump*0.7+fine*0.3);
    if(fine>0.74)base=mixv(base,rgb('#C2D998'),(fine-0.74)*2.4);
    /* The deep shade used to go almost black, and a canopy whose dark
       half is black is a hole in the sky rather than the inside of a
       tree. */
    if(clump<0.28)base=mixv(base,rgb('#2C4A2A'),(0.28-clump)*2.0);
    return litv(base,(M.hash2(u*SZ|0,v*SZ|0,157)-0.5)*18);
  };
};

R.fabric=function(lo,hi,seed){
  lo=lo||'#C4C9D2';hi=hi||'#ECEEF2';
  return function(u,v){
    /* a woven cross-hatch: two out-of-phase high-frequency sines */
    var wu=Math.sin(u*SZ*0.5*Math.PI)*0.5+0.5;
    var wv=Math.sin(v*SZ*0.5*Math.PI)*0.5+0.5;
    var weave=(wu*0.5+wv*0.5);
    var base=mixv(rgb(lo),rgb(hi),tileFbm(u,v,4,seed||163,3));
    base=litv(base,(weave-0.5)*18);
    return litv(base,(M.hash2(u*SZ|0,v*SZ|0,167)-0.5)*10);
  };
};

/* Hair. A card is not one hair, it is a tress of thirty or so, and the
   only place those thirty exist is here: fine lanes of constant u,
   which on a ribbon are lines running the length of the strand. The
   relief derived from them tilts the normal across the card, and the
   low roughness in SURF turns that tilt into the narrow travelling
   highlight that reads, more than any amount of geometry, as hair. */
R.hair=function(){
  return function(u,v){
    var lane=Math.sin(u*Math.PI*2*5)*0.5+0.5;
    lane=lane*lane;                       /* thin bright, wide dark   */
    var fine=M.hash2((u*SZ*1.5)|0,0,911);
    var t=lane*0.62+fine*0.38;
    /* Kept dark. Hair albedo is a multiplier on the character's own
       colour, so a bright texture does not make hair shinier — it
       washes the colour out of it, which is how a head of black hair
       ends up looking like steel wool. */
    var base=mixv(rgb('#8E8E8E'),rgb('#EAEAEA'),t);
    /* a slow drift along the length, so one card is not one flat tube */
    return litv(base,(tileFbm(u*0.4,v*0.30,3,919,3)-0.5)*20);
  };
};

R.crystal=function(tint,seed){
  tint=tint||'#4FD8FF';
  return function(u,v){
    /* facets from a cheap cellular pattern: nearest of a jittered grid */
    var cells=5,best=9,best2=9,bid=0;
    var gx=Math.floor(u*cells),gy=Math.floor(v*cells);
    for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){
      var ax=gx+dx,ay=gy+dy;
      var px=(ax+M.hash2(ax,ay,seed||173))/cells;
      var py=(ay+M.hash2(ax,ay,(seed||173)+9))/cells;
      var d=Math.hypot(u-px,v-py);
      if(d<best){best2=best;best=d;bid=ax*37+ay*17;}
      else if(d<best2)best2=d;
    }
    var facet=M.hash2(bid,0,181);
    var base=mixv(rgb(tint),rgb('#0E2A44'),0.35+facet*0.4);
    base=litv(base,(best2-best)*300-30);   /* bright facet edges */
    return base;
  };
};

R.glass=function(tint){
  /* Same reasoning as the emissive material: neutral texture, tinted
     at the call site. */
  tint=tint||'#CFDCE6';
  return function(u,v){
    var base=rgb(tint);
    /* faint pane distortion and a diagonal reflection band */
    var d=tileFbm(u,v,6,191,3);
    var band=M.clamp(1-Math.abs(((u+v)*2%1)-0.5)*3.4,0,1);
    var c=litv(base,(d-0.5)*20+band*40);
    return [c[0],c[1],c[2],86];
  };
};

R.water=function(){
  return function(u,v){
    /* not used for the surface shader — this is the caustic/detail
       layer sampled underwater and on wet sand */
    var a=tileFbm(u,v,7,197,3),b=tileFbm(u+0.3,v-0.2,11,199,3);
    var r=1-Math.abs((a*0.6+b*0.4)*2-1);
    var base=mixv(rgb('#0D3A52'),rgb('#4FBCD8'),r*r);
    return base;
  };
};

R.roof=function(lo,hi,rows){
  lo=lo||'#544459';hi=hi||'#8A6A7E';rows=rows||10;
  return function(u,v){
    var row=Math.floor(v*rows),fv=v*rows-row;
    var off=(row%2)?0.5:0;
    var cols=8,cu=(u*cols+off)%1;
    var id=Math.floor(u*cols+off)*13+row*29;
    var tone=M.hash2(id,0,211);
    var base=mixv(rgb(lo),rgb(hi),0.25+tone*0.55);
    /* scalloped shingle: darken toward the tile's lower arc */
    var arc=Math.hypot((cu-0.5)*1.1,(fv-0.15)*1.0);
    if(arc>0.52)base=litv(base,-34);
    if(fv<0.10)base=litv(base,18);
    if(fv>0.92)base=litv(base,-26);
    return litv(base,(M.hash2(u*SZ|0,v*SZ|0,223)-0.5)*14);
  };
};

/* A dressed stone path rather than asphalt. Tarmac reads as a black
   scar cut across a green island, and every road on the map is
   visible from every hill. */
R.road=function(){
  return function(u,v){
    var base=mixv(rgb('#8A8375'),rgb('#B4AC9C'),tileFbm(u,v,7,227,5));
    /* irregular setts: a cellular split with a paler joint */
    var cells=9;
    var gx=Math.floor(u*cells),gy=Math.floor(v*cells);
    var jitter=M.hash2(gx,gy,231);
    base=litv(base,(jitter-0.5)*26);
    var fu=u*cells-gx,fv=v*cells-gy;
    var e=0.07+jitter*0.03;
    if(fu<e||fv<e)base=mixv(base,rgb('#6E685C'),0.55);
    var agg=M.hash2(u*SZ|0,v*SZ|0,229);
    if(agg>0.965)base=litv(base,26);
    if(agg<0.05)base=litv(base,-16);
    return base;
  };
};

R.snow=function(){
  return function(u,v){
    var base=mixv(rgb('#C6D6E6'),rgb('#FFFFFF'),tileFbm(u,v,6,239,4));
    var spark=M.hash2(u*SZ|0,v*SZ|0,241);
    if(spark>0.994)base=[255,255,255];
    return litv(base,(M.hash2(u*SZ|0,v*SZ|0,251)-0.5)*8);
  };
};

R.gold=function(lo,hi){
  lo=lo||'#8A5E12';hi=hi||'#FFDE7A';
  return function(u,v){
    var base=mixv(rgb(lo),rgb(hi),tileFbm(u,v,5,257,4));
    var brush=M.hash2((u*SZ*3)|0,(v*SZ*0.3)|0,263);
    base=litv(base,(brush-0.5)*30);
    return base;
  };
};

/* Neutral by default. An emissive material that bakes its own hue
   multiplies against whatever tint the caller passes, so a warm lamp
   drawn on a teal texture comes out mint green. Keep the texture
   near-white and let the tint carry the colour. */
R.emissive=function(tint){
  tint=tint||'#F4F8FF';
  return function(u,v){
    var c=rgb(tint);
    var pulse=tileFbm(u,v,10,269,2);
    return litv(c,(pulse-0.5)*30+30);
  };
};

/* ---------------- the layer table ----------------
   Order is the contract: LH.Data and the world builders refer to
   materials by these names, and the shader by the resulting index. */
var LAYERS=[
  ['blank',   R.solid('#FFFFFF','#FFFFFF',0,1,1)],
  ['grass',   R.grass()],
  ['dirt',    R.dirt()],
  ['sand',    R.sand()],
  ['stone',   R.stone()],
  ['cliff',   R.cliff()],
  ['gravel',  R.solid('#4E4B52','#8A8792',22,2,5)],
  ['snow',    R.snow()],
  ['planks',  R.planks()],
  ['deck',    R.planks('#5A4636','#8E7458',5,79)],
  ['bark',    R.bark()],
  ['brick',   R.brick()],
  ['brickpale',R.brick('#8A6E5A','#B79A80','#D4CCBE',5,10)],
  ['panel',   R.panel('#333B48','#69768A',4,113,true)],
  ['panelw',  R.panel('#5E6672','#9AA4B2',3,311,false)],
  ['concrete',R.concrete()],
  /* The plaza is warm stone, not blue concrete. A whole town square in
     cold grey is the difference between somewhere to arrive and a
     multi-storey car park. */
  ['tile',    R.tilefloor('#7C7466','#8E8578','#4E4840',7)],
  ['tilepale',R.tilefloor('#B4A894','#C6BAA6','#7E7364',4)],
  ['tiledark',R.tilefloor('#3A3A40','#4C4C54','#242428',4)],
  ['roof',    R.roof()],
  ['road',    R.road()],
  ['foliage', R.foliage()],
  ['foliagep',R.foliage('#5A2646','#D473A8',313)],   /* blossom */
  /* Skin is a material, not just a colour. It is near-white so the
     character's own tint carries the tone, and it exists mainly so the
     fragment shader can recognise it: skin is the one surface in this
     world that should not be cel-banded and should scatter light. */
  ['skin',    R.solid('#F0F0F0','#FFFFFF',7,401,3)],
  /* The face. Painted rather than tinted flat, because a head that is
     one colour everywhere is the single clearest tell of amateur
     character work: real faces are darker in the sockets, redder at the
     lips, nose and ears, cooler along the jaw and lighter across the
     forehead and cheekbones, and none of that comes from geometry.
     Everything here is a multiplier on the character's own skin tone,
     so it works on every complexion in the palette. */
  ['face',    R.face()],
  ['fabric',  R.fabric()],
  ['fabricw', R.fabric('#D8C0C6','#FBF2F4',317)],
  ['glass',   R.glass()],
  ['crystal', R.crystal()],
  ['gold',    R.gold()],
  ['water',   R.water()],
  ['neon',    R.emissive('#F4F8FF')],
  ['neonw',   R.emissive('#FFFFFF')],
  ['hair',    R.hair()]
];

Tex.NAME={};
Tex.SIZE=SZ;

/* Relief depth and roughness per material. `bump` is signed; `rough`
   is 0 for a mirror and 1 for chalk. These are the only two numbers
   that separate wet slate from dry bark in this renderer, so they are
   worth setting by hand rather than defaulting. */
/* Relief and gloss, in a world that has neither.

   The reference has no surface detail whatever: no normal map, no
   specular, no sheen. Roughness stays in the table because the
   ambient sky term reads it, and everything except glass, water and
   the gems is now near the top of its range — a matte moulded look,
   where what you read is the silhouette and a very soft light rather
   than the surface. The bump numbers are kept as ratios rather than
   zeroed so the material still has *some* relative relief if `bump`
   is ever dialled back up; the scene's global `bump` is what actually
   turns it off. */
/* Roughness, and why it moved twice.

   The realism pass gave every material a measured value. The toy pass
   pushed them all to matte, because the reference had no specular at
   all. Both were right for what they were aimed at, and the result of
   the second is a world where a brass fitting, a slate roof and a
   cotton shirt reflect exactly the same amount of nothing — so the
   only thing telling them apart is their colour, which is the
   definition of an untextured look.

   These are back to a spread, at a stylised amplitude rather than a
   photographic one: cloth and skin stay matte, stone and wood take a
   little, and metal, glass and crystal are allowed to be shiny,
   because a gem that does not catch the light is a coloured pebble. */
var SURF={
  blank:{bump:0,rough:0.88},
  grass:{bump:0.55,rough:0.97}, dirt:{bump:0.85,rough:0.97},
  sand:{bump:0.60,rough:0.96},  stone:{bump:1.00,rough:0.95},
  cliff:{bump:1.20,rough:0.95}, gravel:{bump:1.10,rough:0.95},
  snow:{bump:0.35,rough:0.86},  planks:{bump:0.75,rough:0.88},
  deck:{bump:0.80,rough:0.94},  bark:{bump:1.30,rough:0.96},
  brick:{bump:-0.95,rough:0.90},brickpale:{bump:-0.95,rough:0.90},
  panel:{bump:0.45,rough:0.52}, panelw:{bump:0.40,rough:0.58},
  concrete:{bump:0.55,rough:0.92},
  tile:{bump:-0.35,rough:0.74}, tilepale:{bump:-0.35,rough:0.74},
  tiledark:{bump:-0.35,rough:0.74},
  roof:{bump:0.85,rough:0.94},  road:{bump:0.65,rough:0.95},
  foliage:{bump:0.45,rough:0.90},foliagep:{bump:0.45,rough:0.90},
  skin:{bump:0.30,rough:0.92},  face:{bump:0.26,rough:0.90},
  fabric:{bump:0.60,rough:0.93},fabricw:{bump:0.60,rough:0.93},
  glass:{bump:0.05,rough:0.06}, crystal:{bump:0.30,rough:0.14},
  gold:{bump:0.20,rough:0.22},  water:{bump:0,rough:0.12},
  neon:{bump:0,rough:0.55},     neonw:{bump:0,rough:0.55},
  /* Hair is rough on purpose, and the reason is worth writing down.

     The shader adds an ambient sky reflection that is deliberately
     *not* multiplied by albedo — a dielectric reflects the colour of
     what it is looking at, not its own — scaled by (1-rough) squared
     and by a grazing Fresnel term. On a flat wall that is correct and
     barely visible. On a head of hair it is neither: a mass of thin
     round strands presents grazing normals in every direction at
     once, so the Fresnel term is near one almost everywhere, and the
     sky goes on top of the hair as a flat additive wash.

     At the 0.70 this used to inherit from `blank`, that wash was
     already strong enough to swamp the tint — which is why hair in
     this game has always come out the colour of the sky whatever the
     player picked, and why the wardrobe's ten hair colours were
     doing almost nothing. Going glossier to chase a sheen made it
     worse, not better. 0.82 cuts the wash to a third of what `blank`
     gave and hands the colour back; what sheen there is comes from
     the direct lobe and the relief, which is enough.

     0.82 was not enough. The wash falls with (1-rough) squared but
     the sky is bright and dark hair is not: at 0.82 the reflection was
     still several times the albedo, and brown hair still came out
     grey. 0.93 puts it below the albedo where it belongs. What is
     lost is the tight highlight; what is bought is that a player who
     picks black hair gets black hair, which is the trade worth
     making. The sheen that remains is the broad grazing lobe, and on
     a mass of round strands that is the band you actually want. */
  hair:{bump:0.62,rough:0.93}
};
Tex.SURF=SURF;

/* ---------------- the toy pass ----------------
   The whole world is repainted through one table.

   The reference for this look is a mobile game whose surfaces have no
   texture at all: grass is one green, stone is one grey, a shirt is
   one yellow, and what shape you read comes entirely from the
   silhouette and a very soft light. Everything this project spent
   passes building — woven cloth, brick courses, bark ridges, tile
   grain — is the exact opposite of that, and at a distance it is what
   makes a surface look photographed rather than moulded.

   Rather than rewrite twenty recipes, each one is pulled most of the
   way toward a flat target colour after it is painted. `MIX` is how
   much of the recipe survives: at 0.16 a brick wall still has the
   faintest suggestion of courses in it and a plank deck of boards,
   which stops large flat areas from going dead, but the colour and
   the value are the table's.

   Nothing here is a shader change. The textures really are flat now,
   so the icons the UI cuts from the same canvases match the world. */
var TOY={
  grass:'#7CC93A', dirt:'#A9793F', sand:'#F0DFA4', stone:'#C3C7CC',
  cliff:'#A8ADB4', gravel:'#B4B8BE', snow:'#F4F8FF',
  planks:'#C08A52', deck:'#B47F49', bark:'#8A6242',
  brick:'#D2705A', brickpale:'#E0A070',
  panel:'#BFC7D0', panelw:'#E6ECF2', concrete:'#C6CBD0',
  tile:'#C9BFA8', tilepale:'#DCD2BC', tiledark:'#8E8A84',
  roof:'#C0564E', road:'#B9B2A4',
  foliage:'#4FA83C', foliagep:'#F07CC0',
  fabric:'#E8ECF2', fabricw:'#F4F6FA',
  skin:'#FFFFFF', face:null, hair:'#F2F2F2',
  glass:'#BEE0F0', crystal:'#7FE4FF', gold:'#F2C455',
  water:null, neon:null, neonw:null, blank:null
};
/* How much of the painted texture survives the pull toward a flat
   colour. At 0.16 almost none of it did, which is why a plank, a
   brick and a sheet of steel were three flat rectangles. */
var TOY_MIX=0.46;
function toyify(cv,name){
  var target=TOY[name];
  if(!target)return cv;
  var t=[parseInt(target.slice(1,3),16),
         parseInt(target.slice(3,5),16),
         parseInt(target.slice(5,7),16)];
  var ctx=cv.getContext('2d');
  var img=ctx.getImageData(0,0,SZ,SZ),d=img.data;
  /* The recipe's own mean, so what survives is its *variation* rather
     than its variation plus its offset — otherwise a dark recipe pulls
     the whole material down and the table stops meaning anything. */
  var mr=0,mg=0,mb=0,n=SZ*SZ,i;
  for(i=0;i<d.length;i+=4){mr+=d[i];mg+=d[i+1];mb+=d[i+2];}
  mr/=n;mg/=n;mb/=n;
  for(i=0;i<d.length;i+=4){
    d[i]  =M.clamp(t[0]+(d[i]  -mr)*TOY_MIX,0,255)|0;
    d[i+1]=M.clamp(t[1]+(d[i+1]-mg)*TOY_MIX,0,255)|0;
    d[i+2]=M.clamp(t[2]+(d[i+2]-mb)*TOY_MIX,0,255)|0;
  }
  ctx.putImageData(img,0,0);
  return cv;
}
Tex.TOY=TOY;

Tex.buildAll=function(){
  var canvases=[],normals=[];
  for(var i=0;i<LAYERS.length;i++){
    var name=LAYERS[i][0];
    Tex.NAME[name]=i;
    var cv=toyify(paint(make(),LAYERS[i][1],name),name);
    canvases.push(cv);
    normals.push(bumpMap(cv,SURF[name],name));
  }
  Tex.count=LAYERS.length;
  Tex.array=LH.GL.texArrayFromCanvases(canvases,SZ);
  Tex.normals=LH.GL.texArrayFromCanvases(normals,SZ,{data:true});
  /* keep the canvases: the UI paints item icons from the same source
     so a block's tile and its inventory icon can never drift apart */
  Tex.canvases=canvases;
  return Tex.array;
};

Tex.layer=function(name){
  var i=Tex.NAME[name];
  return i===undefined?0:i;
};

LH.Tex=Tex;
})();


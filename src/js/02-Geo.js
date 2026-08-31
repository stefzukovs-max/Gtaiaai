/* ============================================================
   LH.Geo — procedural geometry.

   Everything visible in this game is built here: characters,
   buildings, boats, fish, tools, terrain. A Builder accumulates
   interleaved vertices behind a transform stack, so a complex
   prop is written the way you'd describe it out loud — "move up
   two, put a box there, rotate, put another one".

   Nothing is imported. There is no model format.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,Geo={};
var TAU=Math.PI*2;

/* colour parsing lives here because every builder takes colours as
   the same '#rrggbb' strings the 2D build used, and converting them
   at the call site would be noise. */
var _ccache={};
function col3(c){
  if(typeof c!=='string')return c||[1,1,1];
  var hit=_ccache[c];if(hit)return hit;
  var h=c.charAt(0)==='#'?c.slice(1):c;
  if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var n=parseInt(h,16);
  /* sRGB -> linear. Lighting maths that skips this always looks muddy
     in shadow and blown out in sun. */
  function lin(v){v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);}
  var out=[lin((n>>16)&255),lin((n>>8)&255),lin(n&255)];
  _ccache[c]=out;return out;
}
Geo.col3=col3;
Geo.srgb=function(c){ /* back to 0-255 sRGB, for UI that mirrors a mesh colour */
  var l=col3(c);
  function g(v){return Math.round(255*(v<=0.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-0.055));}
  return [g(l[0]),g(l[1]),g(l[2])];
};
/* mix and shade operate on the hex strings so palettes stay readable */
Geo.mix=function(a,b,t){
  var A=hexb(a),B=hexb(b);
  return hexs(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);
};
Geo.shade=function(c,amt){
  var A=hexb(c),t=amt/100;
  if(t>=0)return hexs(A[0]+(255-A[0])*t,A[1]+(255-A[1])*t,A[2]+(255-A[2])*t);
  return hexs(A[0]*(1+t),A[1]*(1+t),A[2]*(1+t));
};
function hexb(c){
  var h=c.charAt(0)==='#'?c.slice(1):c;
  if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var n=parseInt(h,16);return [(n>>16)&255,(n>>8)&255,n&255];
}
function hexs(r,g,b){
  function q(v){v=Math.round(v);return (v<0?0:v>255?255:v).toString(16).padStart(2,'0');}
  return '#'+q(r)+q(g)+q(b);
}

/* ---------------- the builder ---------------- */
function Builder(){
  this.v=[];        /* flat float list, 15 per vertex */
  this.i=[];        /* index list */
  this.n=0;         /* vertex count */
  /* Skinning, if this builder is making a body. `sk` is eight floats a
     vertex — four bone indices then four weights — and stays empty for
     the terrain, the props and everything else that is rigid. */
  this.sk=[];
  this.skinning=false;
  this.sw=[0,0,0,0,1,0,0,0];
  this.stack=[];
  this.m=M.ident(M.m4());
  this.nm=new Float32Array(9);
  this._nmDirty=true;
  /* current material: texture-array layer + emissive strength. Set it
     once and every following primitive inherits it, the way a real
     modelling session works. */
  this.layer=0;
  this.emis=0;
  this.layer2=0;   /* secondary material */
  this.blend=0;    /* 0 = all primary, 1 = all secondary */
}
Geo.Builder=Builder;
Geo.build=function(){return new Builder();};

Builder.prototype.push=function(){
  this.stack.push({m:new Float32Array(this.m),l:this.layer,e:this.emis,
    l2:this.layer2,bl:this.blend,sw:this.sw.slice()});return this;
};
Builder.prototype.pop=function(){
  var f=this.stack.pop();
  if(f){this.m.set(f.m);this.layer=f.l;this.emis=f.e;
    this.layer2=f.l2;this.blend=f.bl;this.sw=f.sw;}
  this._nmDirty=true;return this;
};

/* ---------------- skinning ----------------
   Bind the vertices that follow to bones. Two influences covers almost
   everything a limb needs — a cross-section between two joints belongs
   to those two joints and nothing else — and four exists for the
   shoulder and the hip, where the clavicle and the spine both have a
   claim on the same skin.

   Weights are normalised here rather than trusted, because a ring that
   sums to 1.02 shows up as a body that inflates slightly wherever that
   ring is, which is a maddening thing to find later. */
Builder.prototype.skin=function(b0,w0,b1,w1,b2,w2,b3,w3){
  b1=b1||0;w1=w1||0;b2=b2||0;w2=w2||0;b3=b3||0;w3=w3||0;
  var t=w0+w1+w2+w3;
  if(t<=0){w0=1;t=1;}
  var k=1/t;
  /* If anything was emitted before the first binding it has no skin
     data, and the arrays would be off by that many vertices from here
     on — every weight landing on the wrong vertex. Backfill it. */
  if(!this.skinning){
    for(var i=0;i<this.n;i++)this.sk.push(0,0,0,0,1,0,0,0);
    this.skinning=true;
  }
  this.sw[0]=b0;this.sw[1]=b1;this.sw[2]=b2;this.sw[3]=b3;
  this.sw[4]=w0*k;this.sw[5]=w1*k;this.sw[6]=w2*k;this.sw[7]=w3*k;
  return this;
};
/* Bind everything that follows rigidly to one bone. */
Builder.prototype.bone=function(b){return this.skin(b,1);};
/* Pick a material by name from LH.Tex. Emissive is 0..1 and is added
   straight to the lit result, so neon reads at night. */
Builder.prototype.mat=function(name,emis){
  this.layer=(typeof name==='number')?name:LH.Tex.layer(name);
  this.emis=emis||0;
  /* A single material means both slots agree and the blend is off. */
  this.layer2=this.layer;this.blend=0;
  return this;
};
/* Blend toward a second material. Used by the terrain for every
   surface boundary and by anything that wants a gradient. */
Builder.prototype.mat2=function(name,blend){
  this.layer2=(typeof name==='number')?name:LH.Tex.layer(name);
  this.blend=blend||0;return this;
};
var _tmpM=M.m4(),_tmpM2=M.m4(),_t=M.v3(),_s=M.v3(1,1,1);
Builder.prototype.translate=function(x,y,z){
  M.set3(_t,x,y,z);M.set3(_s,1,1,1);
  M.fromTRS(_tmpM,_t,0,0,0,_s);
  M.mul(this.m,M.copy(_tmpM2,this.m),_tmpM);this._nmDirty=true;return this;
};
Builder.prototype.rotate=function(rx,ry,rz){
  M.set3(_t,0,0,0);M.set3(_s,1,1,1);
  M.fromTRS(_tmpM,_t,rx||0,ry||0,rz||0,_s);
  M.mul(this.m,M.copy(_tmpM2,this.m),_tmpM);this._nmDirty=true;return this;
};
Builder.prototype.scale=function(x,y,z){
  if(y===undefined){y=x;z=x;}
  M.set3(_t,0,0,0);M.set3(_s,x,y,z);
  M.fromTRS(_tmpM,_t,0,0,0,_s);
  M.mul(this.m,M.copy(_tmpM2,this.m),_tmpM);this._nmDirty=true;return this;
};
Builder.prototype.setMatrix=function(m){this.m.set(m);this._nmDirty=true;return this;};

var _p=M.v3(),_nv=M.v3();
/* the one place vertices enter the buffer — everything else routes here */
Builder.prototype.vert=function(x,y,z,nx,ny,nz,u,vv,c){
  if(this._nmDirty){M.normalMat(this.nm,this.m);this._nmDirty=false;}
  var m=this.m;
  var px=m[0]*x+m[4]*y+m[8]*z+m[12];
  var py=m[1]*x+m[5]*y+m[9]*z+m[13];
  var pz=m[2]*x+m[6]*y+m[10]*z+m[14];
  var nm=this.nm;
  var tx=nm[0]*nx+nm[3]*ny+nm[6]*nz;
  var ty=nm[1]*nx+nm[4]*ny+nm[7]*nz;
  var tz=nm[2]*nx+nm[5]*ny+nm[8]*nz;
  var l=Math.sqrt(tx*tx+ty*ty+tz*tz)||1;
  this.v.push(px,py,pz,tx/l,ty/l,tz/l,u,vv,c[0],c[1],c[2],
    this.layer,this.emis,this.layer2,this.blend);
  if(this.skinning){
    var w=this.sw;
    this.sk.push(w[0],w[1],w[2],w[3],w[4],w[5],w[6],w[7]);
  }
  return this.n++;
};
Builder.prototype.tri=function(a,b,c){this.i.push(a,b,c);return this;};
Builder.prototype.quad=function(a,b,c,d){this.i.push(a,b,c,a,c,d);return this;};

/* ---------------- primitives ---------------- */
/* A box centred on (x,y,z). `uvScale` maps world units to texture
   repeats so a long wall doesn't stretch its bricks. */
Builder.prototype.box=function(x,y,z,w,h,d,c,o){
  o=o||{};
  var col=col3(c),hw=w/2,hh=h/2,hd=d/2;
  var us=o.uvScale||1;
  var skip=o.skip||0;   /* bitmask: 1+X 2-X 4+Y 8-Y 16+Z 32-Z */
  var self=this;
  function face(bit,nx,ny,nz,p0,p1,p2,p3,uw,uh){
    if(skip&bit)return;
    var a=self.vert(p0[0],p0[1],p0[2],nx,ny,nz,0,0,col);
    var b=self.vert(p1[0],p1[1],p1[2],nx,ny,nz,uw*us,0,col);
    var cc=self.vert(p2[0],p2[1],p2[2],nx,ny,nz,uw*us,uh*us,col);
    var dd=self.vert(p3[0],p3[1],p3[2],nx,ny,nz,0,uh*us,col);
    self.quad(a,b,cc,dd);
  }
  var X0=x-hw,X1=x+hw,Y0=y-hh,Y1=y+hh,Z0=z-hd,Z1=z+hd;
  face(1, 1,0,0,[X1,Y0,Z1],[X1,Y0,Z0],[X1,Y1,Z0],[X1,Y1,Z1],d,h);
  face(2,-1,0,0,[X0,Y0,Z0],[X0,Y0,Z1],[X0,Y1,Z1],[X0,Y1,Z0],d,h);
  face(4, 0,1,0,[X0,Y1,Z1],[X1,Y1,Z1],[X1,Y1,Z0],[X0,Y1,Z0],w,d);
  face(8, 0,-1,0,[X0,Y0,Z0],[X1,Y0,Z0],[X1,Y0,Z1],[X0,Y0,Z1],w,d);
  face(16,0,0,1,[X0,Y0,Z1],[X1,Y0,Z1],[X1,Y1,Z1],[X0,Y1,Z1],w,h);
  face(32,0,0,-1,[X1,Y0,Z0],[X0,Y0,Z0],[X0,Y1,Z0],[X1,Y1,Z0],w,h);
  return this;
};

/* A box with chamfered edges. Cheap, and it is most of why a
   procedural prop stops reading as programmer art: real objects do
   not have infinitely sharp corners, and the chamfer catches a
   highlight along every edge. */
Builder.prototype.chamfer=function(x,y,z,w,h,d,c,bevel,o){
  o=o||{};
  var b=Math.min(bevel,w/2.6,h/2.6,d/2.6);
  var col=col3(c);
  var hw=w/2,hh=h/2,hd=d/2;
  var self=this;
  /* six insets faces + twelve edge quads + eight corner tris.
     Built from a signed-corner table so it stays compact. */
  function V(px,py,pz,nx,ny,nz,u,vv){return self.vert(px,py,pz,nx,ny,nz,u,vv,col);}
  var us=o.uvScale||1;
  // ---- main faces (inset by bevel on their two tangent axes)
  var faces=[
    [ 1,0,0, hw,  hd-b,hh-b, 'x'],
    [-1,0,0,-hw,  hd-b,hh-b, 'x'],
    [0, 1,0, hh,  hw-b,hd-b, 'y'],
    [0,-1,0,-hh,  hw-b,hd-b, 'y'],
    [0,0, 1, hd,  hw-b,hh-b, 'z'],
    [0,0,-1,-hd,  hw-b,hh-b, 'z']
  ];
  for(var f=0;f<faces.length;f++){
    var F=faces[f],nx=F[0],ny=F[1],nz=F[2],off=F[3],e0=F[4],e1=F[5],ax=F[6];
    var pts=[];
    for(var q=0;q<4;q++){
      var s0=(q===0||q===3)?-1:1, s1=(q<2)?-1:1;
      var px,py,pz;
      if(ax==='x'){px=x+off;py=y+s1*e1;pz=z+s0*e0;}
      else if(ax==='y'){px=x+s0*e0;py=y+off;pz=z+s1*e1;}
      else {px=x+s0*e0;py=y+s1*e1;pz=z+off;}
      pts.push([px,py,pz,(s0*0.5+0.5)*e0*2*us,(s1*0.5+0.5)*e1*2*us]);
    }
    /* wind so the normal points outward */
    var flip=(nx+ny+nz)<0;
    var order=flip?[0,3,2,1]:[0,1,2,3];
    var ids=[];
    for(var k=0;k<4;k++){var P=pts[order[k]];ids.push(V(P[0],P[1],P[2],nx,ny,nz,P[3],P[4]));}
    this.quad(ids[0],ids[1],ids[2],ids[3]);
  }
  /* The bevel band itself: rather than exact geometry, ring the box
     with a slightly shrunken shell whose normals are averaged. At the
     sizes these props are drawn it is indistinguishable and costs a
     fraction of the triangles. */
  var inner=o.noBand?null:1;
  if(inner){
    var corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
    /* four vertical edge quads */
    for(var e=0;e<4;e++){
      var c0=corners[e],c1=corners[(e+1)%4];
      var sx0=c0[0],sz0=c0[1],sx1=c1[0],sz1=c1[1];
      var n0x=sx0*0.7071,n0z=sz0*0.7071,n1x=sx1*0.7071,n1z=sz1*0.7071;
      var A=V(x+sx0*hw,y-(hh-b),z+sz0*(hd-b),n0x,0,n0z,0,0);
      var B=V(x+sx1*(hw-b),y-(hh-b),z+sz1*hd,n1x,0,n1z,1,0);
      var C=V(x+sx1*(hw-b),y+(hh-b),z+sz1*hd,n1x,0,n1z,1,1);
      var D=V(x+sx0*hw,y+(hh-b),z+sz0*(hd-b),n0x,0,n0z,0,1);
      /* winding depends on which quadrant we are in */
      if((sx0*sz1-sz0*sx1)>0)this.quad(A,B,C,D);else this.quad(A,D,C,B);
    }
  }
  return this;
};

/* A subdivided plane in XZ. `fn(x,z,u,v)` may return {y,c,layer} to
   displace and recolour it, which is how terrain, riverbeds and
   plaza slopes are all built from the same call. Normals come from
   central differences on the displaced height rather than the flat
   (0,1,0), or hills would light as if they were level ground. */
Builder.prototype.plane=function(x,y,z,w,d,c,segs,uvScale,fn){
  segs=segs||1;uvScale=uvScale===undefined?1:uvScale;
  var col=col3(c),base=this.n;
  var hs=null,cols=null,lays=null;
  var stride=segs+1;
  if(fn){hs=new Float32Array(stride*stride);}
  var i,j;
  /* first pass: sample, so normals can look at their neighbours */
  if(fn){
    cols=new Array(stride*stride);lays=new Array(stride*stride);
    for(j=0;j<=segs;j++)for(i=0;i<=segs;i++){
      var px0=x+(i/segs-0.5)*w,pz0=z+(j/segs-0.5)*d;
      var r=fn(px0,pz0,i/segs,j/segs);
      var k=j*stride+i;
      hs[k]=(r&&r.y!==undefined)?r.y:y;
      cols[k]=(r&&r.c)?col3(r.c):col;
      lays[k]=(r&&r.layer!==undefined)?r.layer:null;
    }
  }
  var dx=w/segs,dz=d/segs;
  var savedLayer=this.layer;
  for(j=0;j<=segs;j++)for(i=0;i<=segs;i++){
    var fx=i/segs,fz=j/segs;
    var px=x+(fx-0.5)*w,pz=z+(fz-0.5)*d,py=y;
    var cc=col,nx=0,ny=1,nz=0;
    if(fn){
      var kk=j*stride+i;
      py=hs[kk];cc=cols[kk];
      if(lays[kk]!==null)this.layer=lays[kk];
      var hL=hs[j*stride+Math.max(0,i-1)],hR=hs[j*stride+Math.min(segs,i+1)];
      var hD=hs[Math.max(0,j-1)*stride+i],hU=hs[Math.min(segs,j+1)*stride+i];
      var spanX=(Math.min(segs,i+1)-Math.max(0,i-1))*dx;
      var spanZ=(Math.min(segs,j+1)-Math.max(0,j-1))*dz;
      nx=-(hR-hL)/(spanX||dx);
      nz=-(hU-hD)/(spanZ||dz);
      ny=1;
      var nl=Math.sqrt(nx*nx+1+nz*nz);
      nx/=nl;ny/=nl;nz/=nl;
    }
    this.vert(px,py,pz,nx,ny,nz,fx*uvScale,fz*uvScale,cc);
    if(fn)this.layer=savedLayer;
  }
  /* Wind counter-clockwise seen from above: a→(x0,z1)→(x1,z1)→(x1,z0)
     puts the face normal at +Y. The obvious ordering gives -Y and the
     whole surface vanishes into the back-face cull. */
  for(var jj=0;jj<segs;jj++)for(var ii=0;ii<segs;ii++){
    var a=base+jj*stride+ii,b=a+1,cq=a+stride,d2=cq+1;
    this.quad(a,cq,d2,b);
  }
  return this;
};

Builder.prototype.cylinder=function(x,y,z,r0,r1,h,seg,c,o){
  o=o||{};seg=seg||12;
  var col=col3(c),hh=h/2,base=this.n;
  var slope=(r0-r1)/h;
  for(var i=0;i<=seg;i++){
    var a=i/seg*TAU,ca=Math.cos(a),sa=Math.sin(a);
    var nl=Math.sqrt(1+slope*slope);
    var nx=ca/nl,ny=slope/nl,nz=sa/nl;
    this.vert(x+ca*r0,y-hh,z+sa*r0,nx,ny,nz,i/seg*(o.uvScale||1),0,col);
    this.vert(x+ca*r1,y+hh,z+sa*r1,nx,ny,nz,i/seg*(o.uvScale||1),(o.uvScale||1),col);
  }
  /* same winding rule as loft: up the wall first, then around */
  for(var k=0;k<seg;k++){
    var p=base+k*2;
    this.quad(p,p+1,p+3,p+2);
  }
  if(!o.open){
    if(r1>1e-5){
      var ct=this.vert(x,y+hh,z,0,1,0,.5,.5,col),t0=this.n;
      for(var t=0;t<=seg;t++){var aa=t/seg*TAU;
        this.vert(x+Math.cos(aa)*r1,y+hh,z+Math.sin(aa)*r1,0,1,0,
          Math.cos(aa)*.5+.5,Math.sin(aa)*.5+.5,col);}
      for(var t2=0;t2<seg;t2++)this.tri(ct,t0+t2+1,t0+t2);
    }
    if(r0>1e-5){
      var cb=this.vert(x,y-hh,z,0,-1,0,.5,.5,col),b0=this.n;
      for(var u=0;u<=seg;u++){var ab=u/seg*TAU;
        this.vert(x+Math.cos(ab)*r0,y-hh,z+Math.sin(ab)*r0,0,-1,0,
          Math.cos(ab)*.5+.5,Math.sin(ab)*.5+.5,col);}
      for(var u2=0;u2<seg;u2++)this.tri(cb,b0+u2,b0+u2+1);
    }
  }
  return this;
};

Builder.prototype.sphere=function(x,y,z,r,seg,rings,c,o){
  o=o||{};seg=seg||14;rings=rings||10;
  var col=col3(c),base=this.n;
  var sy=o.squash||1;
  for(var j=0;j<=rings;j++){
    var v=j/rings,phi=v*Math.PI,sp=Math.sin(phi),cp=Math.cos(phi);
    for(var i=0;i<=seg;i++){
      var u=i/seg,th=u*TAU,st=Math.sin(th),ct=Math.cos(th);
      var nx=sp*ct,ny=cp,nz=sp*st;
      this.vert(x+nx*r,y+ny*r*sy,z+nz*r,nx,ny/sy,nz,u,v,col);
    }
  }
  for(var jj=0;jj<rings;jj++)for(var ii=0;ii<seg;ii++){
    var a=base+jj*(seg+1)+ii,b=a+seg+1;
    this.quad(a,a+1,b+1,b);
  }
  return this;
};

/* A capsule is the character's collision shape and also, squashed and
   coloured, most of a limb. */
Builder.prototype.capsule=function(x,y,z,r,h,seg,c){
  seg=seg||10;
  var half=Math.max(0,h/2-r);
  this.cylinder(x,y,z,r,r,half*2,seg,c,{open:true});
  this.push().translate(x,y+half,z).scale(1,1,1);
  this.sphere(0,0,0,r,seg,seg/2|0,c);this.pop();
  this.push().translate(x,y-half,z);
  this.sphere(0,0,0,r,seg,seg/2|0,c);this.pop();
  return this;
};

/* Sweep a 2D outline into a solid. This is how railings, rooftops,
   boat hulls and sign frames get made without hand-listing vertices. */
Builder.prototype.extrude=function(pts,depth,c,o){
  o=o||{};
  var col=col3(c),hd=depth/2,n=pts.length,base=this.n;
  /* front + back caps via fan from the centroid — outlines here are
     always convex or near enough that a fan is safe */
  var cx=0,cy=0;
  for(var i=0;i<n;i++){cx+=pts[i][0];cy+=pts[i][1];}
  cx/=n;cy/=n;
  var fc=this.vert(cx,cy,hd,0,0,1,.5,.5,col);
  for(var a=0;a<n;a++)this.vert(pts[a][0],pts[a][1],hd,0,0,1,pts[a][0],pts[a][1],col);
  var bc=this.vert(cx,cy,-hd,0,0,-1,.5,.5,col);
  for(var b=0;b<n;b++)this.vert(pts[b][0],pts[b][1],-hd,0,0,-1,pts[b][0],pts[b][1],col);
  var f0=fc+1,b0=bc+1;
  for(var k=0;k<n;k++){
    var k2=(k+1)%n;
    this.tri(fc,f0+k,f0+k2);
    this.tri(bc,b0+k2,b0+k);
  }
  /* the side wall */
  for(var s=0;s<n;s++){
    var s2=(s+1)%n;
    var dx=pts[s2][0]-pts[s][0],dy=pts[s2][1]-pts[s][1];
    var l=Math.hypot(dx,dy)||1;
    var nx=dy/l,ny=-dx/l;
    var A=this.vert(pts[s][0],pts[s][1],hd,nx,ny,0,0,0,col);
    var B=this.vert(pts[s2][0],pts[s2][1],hd,nx,ny,0,l,0,col);
    var C=this.vert(pts[s2][0],pts[s2][1],-hd,nx,ny,0,l,depth,col);
    var D=this.vert(pts[s][0],pts[s][1],-hd,nx,ny,0,0,depth,col);
    this.quad(A,D,C,B);
  }
  return this;
};

/* ---------------- lofting ----------------
   Stitch a stack of cross-sections into a surface. This is the single
   most useful builder in the file: torsos, limbs, boat hulls, tree
   trunks, fish and rooftops are all a list of outlines at increasing
   heights. Every section needs the same point count so the rings
   correspond; the helpers below all take `n` for exactly that reason. */

/* a circle, for limbs and trunks */
Geo.circle=function(r,n,sx,sz){
  sx=sx===undefined?1:sx;sz=sz===undefined?1:sz;
  var out=[];
  for(var i=0;i<n;i++){
    var a=i/n*TAU;
    out.push([Math.cos(a)*r*sx,Math.sin(a)*r*sz]);
  }
  return out;
};
/* a rounded rectangle, for torsos and anything built rather than grown */
Geo.roundRect=function(w,d,r,n){
  var hw=Math.max(0.0001,w/2-r),hd=Math.max(0.0001,d/2-r);
  var out=[],per=Math.max(1,Math.floor(n/4));
  var corners=[[hw,hd,0],[-hw,hd,Math.PI/2],[-hw,-hd,Math.PI],[hw,-hd,-Math.PI/2]];
  for(var c=0;c<4;c++){
    var cc=corners[c];
    for(var i=0;i<per;i++){
      var a=cc[2]+(i/per)*(Math.PI/2);
      out.push([cc[0]+Math.cos(a)*r,cc[1]+Math.sin(a)*r]);
    }
  }
  /* pad to exactly n so sections always line up */
  while(out.length<n)out.push(out[out.length-1].slice());
  return out.slice(0,n);
};

/* `sections` is [{y, pts:[[x,z]...], scale?, col?, skin?}]. Normals come
   from the surface itself — the ring tangent crossed with the rise to
   the next ring — so a taper lights correctly instead of like a
   cylinder.

   `skin` is [bone,weight,...] up to four pairs, applied before the ring
   is emitted. Per ring rather than per loft is the whole point: a limb
   is one loft whose rings hand over from one bone to the next as they
   cross the joint, and that hand-over is what makes a knee bend like a
   knee instead of shearing. */
Builder.prototype.loft=function(sections,c,o){
  o=o||{};
  var col=col3(c),n=sections[0].pts.length,rings=sections.length;
  var base=this.n,i,j;
  /* Sections may be listed bottom-up (a torso) or top-down (a limb
     hanging from its pivot). Rather than make every caller remember
     which way round to write them, detect the direction and flip the
     winding to match — otherwise half the meshes in the game face
     inward and vanish into the back-face cull. */
  var up=(sections[rings-1].y>=sections[0].y);
  var uvScale=o.uvScale||1;
  /* `uvV` remaps the section height into 0..1 across the whole loft, so
     a texture can be painted to fit the thing rather than tiled along
     it. The head needs this: a face map is one image stretched from
     chin to crown, not a repeating pattern. */
  var vLo=o.uvV?o.uvV[0]:0, vHi=o.uvV?o.uvV[1]:0;
  var vK=o.uvV?1/((vHi-vLo)||1):0;
  var uOff=o.uvU||0;
  for(j=0;j<rings;j++){
    var S=sections[j],pts=S.pts,cc=S.col?col3(S.col):col;
    if(S.skin)this.skin.apply(this,S.skin);
    var sc=S.scale===undefined?1:S.scale;
    /* rise toward the neighbouring ring, used for the normal's tilt */
    var prev=sections[Math.max(0,j-1)],next=sections[Math.min(rings-1,j+1)];
    var dy=(next.y-prev.y)||1;
    for(i=0;i<n;i++){
      var px=pts[i][0]*sc,pz=pts[i][1]*sc;
      /* ring tangent */
      var a=pts[(i+1)%n],b=pts[(i-1+n)%n];
      var tx=(a[0]-b[0])*sc,tz=(a[1]-b[1])*sc;
      /* radial outward */
      var rx=px,rz=pz;
      var rl=Math.hypot(rx,rz)||1;rx/=rl;rz/=rl;
      /* how much the profile grows between neighbouring rings decides
         how far the normal tips up or down */
      var pn=next.pts[i],pp=prev.pts[i];
      var nsc=next.scale===undefined?1:next.scale,psc=prev.scale===undefined?1:prev.scale;
      var dr=Math.hypot(pn[0]*nsc,pn[1]*nsc)-Math.hypot(pp[0]*psc,pp[1]*psc);
      var ny=-dr/dy;
      var nx=rx,nz=rz;
      var nl=Math.hypot(nx,ny,nz)||1;
      var uu=i/n*uvScale+uOff;
      var vvv=o.uvV?((S.y-vLo)*vK):S.y*uvScale;
      this.vert(px,S.y,pz,nx/nl,ny/nl,nz/nl,uu,vvv,cc);
    }
  }
  /* Wind along the stack before going around the ring: sections from
     Geo.circle/roundRect run counter-clockwise in XZ, so the reverse
     order puts every face normal on the inside. */
  for(j=0;j<rings-1;j++)for(i=0;i<n;i++){
    var i2=(i+1)%n;
    var A=base+j*n+i, B=base+j*n+i2, C2=base+(j+1)*n+i2, D=base+(j+1)*n+i;
    if(up)this.quad(A,D,C2,B);else this.quad(A,B,C2,D);
  }
  /* caps, unless the loft joins something else */
  /* `openTop` means the geometrically higher cap and `openBottom` the
     lower one, regardless of which end of the list they land on. Tying
     them to list order instead makes a descending loft cap the wrong
     end, which shows up as a large flat surface facing the wrong way. */
  var ny=up?1:-1;
  var openFar=up?o.openTop:o.openBottom;
  var openNear=up?o.openBottom:o.openTop;
  if(!openFar){
    var top=sections[rings-1],tsc=top.scale===undefined?1:top.scale;
    var tcol=top.col?col3(top.col):col;
    if(top.skin)this.skin.apply(this,top.skin);
    var tc=this.vert(0,top.y,0,0,ny,0,.5,.5,tcol),t0=this.n;
    for(i=0;i<n;i++)this.vert(top.pts[i][0]*tsc,top.y,top.pts[i][1]*tsc,0,ny,0,
      top.pts[i][0]+.5,top.pts[i][1]+.5,tcol);
    for(i=0;i<n;i++){
      if(up)this.tri(tc,t0+(i+1)%n,t0+i);else this.tri(tc,t0+i,t0+(i+1)%n);
    }
  }
  if(!openNear){
    var bo=sections[0],bsc=bo.scale===undefined?1:bo.scale;
    var bcol=bo.col?col3(bo.col):col;
    if(bo.skin)this.skin.apply(this,bo.skin);
    var bc=this.vert(0,bo.y,0,0,-ny,0,.5,.5,bcol),b0=this.n;
    for(i=0;i<n;i++)this.vert(bo.pts[i][0]*bsc,bo.y,bo.pts[i][1]*bsc,0,-ny,0,
      bo.pts[i][0]+.5,bo.pts[i][1]+.5,bcol);
    for(i=0;i<n;i++){
      if(up)this.tri(bc,b0+i,b0+(i+1)%n);else this.tri(bc,b0+(i+1)%n,b0+i);
    }
  }
  return this;
};

/* A limb: a tapered loft between two radii with rounded ends, built
   downward from the bone pivot at y=0 the way the skeleton expects. */
Builder.prototype.limb=function(len,r0,r1,c,o){
  o=o||{};
  var n=o.seg||10,secs=[],steps=o.steps||7;
  for(var i=0;i<=steps;i++){
    var t=i/steps;
    var y=-len*t;
    /* ease the radius so the limb swells slightly at the top rather
       than tapering linearly like a traffic cone */
    var r=M.lerp(r0,r1,t*t*(3-2*t));
    if(o.bulge)r*=1+Math.sin(t*Math.PI)*o.bulge;
    var cap=1;
    if(i===0)cap=0.82;
    if(i===steps)cap=0.86;
    secs.push({y:y,pts:Geo.circle(r*cap,n,o.flatX||1,o.flatZ||1)});
  }
  this.loft(secs,c,{uvScale:o.uvScale||1});
  /* joint spheres hide the seam where rigid parts meet */
  if(o.joint!==false){
    this.sphere(0,0,0,r0*0.96,n,Math.max(5,n>>1),c);
    this.sphere(0,-len,0,r1*0.94,n,Math.max(5,n>>1),c);
  }
  return this;
};

/* A flat disc, and a flat ring. Both exist because a capped loft is
   the wrong shape for anything hollow: a fountain basin built as a
   capped cylinder is a solid lid over the water. */
Builder.prototype.disc=function(x,y,z,r,seg,c,down){
  seg=seg||16;
  var col=col3(c),ny=down?-1:1;
  var ctr=this.vert(x,y,z,0,ny,0,.5,.5,col),i0=this.n;
  for(var i=0;i<seg;i++){
    var a=i/seg*TAU;
    this.vert(x+Math.cos(a)*r,y,z+Math.sin(a)*r,0,ny,0,
      Math.cos(a)*.5+.5,Math.sin(a)*.5+.5,col);
  }
  for(var k=0;k<seg;k++){
    var k2=(k+1)%seg;
    if(down)this.tri(ctr,i0+k,i0+k2);
    else this.tri(ctr,i0+k2,i0+k);
  }
  return this;
};
Builder.prototype.annulus=function(x,y,z,r0,r1,seg,c,down){
  seg=seg||16;
  var col=col3(c),ny=down?-1:1,base=this.n;
  for(var i=0;i<seg;i++){
    var a=i/seg*TAU,ca=Math.cos(a),sa=Math.sin(a);
    this.vert(x+ca*r0,y,z+sa*r0,0,ny,0,ca*.5+.5,sa*.5+.5,col);
    this.vert(x+ca*r1,y,z+sa*r1,0,ny,0,ca*.5+.5,sa*.5+.5,col);
  }
  for(var k=0;k<seg;k++){
    var a0=base+k*2, b0=base+((k+1)%seg)*2;
    if(down)this.quad(a0,a0+1,b0+1,b0);
    else this.quad(a0,b0,b0+1,a0+1);
  }
  return this;
};

/* A quad billboarded in the XY plane — leaves, banners, fish fins. */
Builder.prototype.card=function(x,y,z,w,h,c,dbl){
  var col=col3(c);
  var a=this.vert(x-w/2,y-h/2,z,0,0,1,0,0,col);
  var b=this.vert(x+w/2,y-h/2,z,0,0,1,1,0,col);
  var cc=this.vert(x+w/2,y+h/2,z,0,0,1,1,1,col);
  var d=this.vert(x-w/2,y+h/2,z,0,0,1,0,1,col);
  this.quad(a,b,cc,d);
  if(dbl!==false){
    var e=this.vert(x-w/2,y-h/2,z,0,0,-1,0,0,col);
    var f=this.vert(x+w/2,y-h/2,z,0,0,-1,1,0,col);
    var g=this.vert(x+w/2,y+h/2,z,0,0,-1,1,1,col);
    var hh=this.vert(x-w/2,y+h/2,z,0,0,-1,0,1,col);
    this.quad(e,hh,g,f);
  }
  return this;
};

/* Merge another builder's output in under the current transform.
   Lets a prop be composed from named sub-builders. */
Builder.prototype.append=function(other){
  var base=this.n,ov=other.v,sl=this.layer,se=this.emis,
      sl2=this.layer2,sb=this.blend;
  for(var i=0;i<ov.length;i+=15){
    this.layer=ov[i+11];this.emis=ov[i+12];
    this.layer2=ov[i+13];this.blend=ov[i+14];
    this.vert(ov[i],ov[i+1],ov[i+2],ov[i+3],ov[i+4],ov[i+5],
      ov[i+6],ov[i+7],[ov[i+8],ov[i+9],ov[i+10]]);
  }
  this.layer=sl;this.emis=se;this.layer2=sl2;this.blend=sb;
  for(var j=0;j<other.i.length;j++)this.i.push(base+other.i[j]);
  return this;
};

/* Tint every vertex already in the buffer — used to recolour a shared
   prop builder without rebuilding it. */
Builder.prototype.tintAll=function(c){
  var col=col3(c);
  for(var i=0;i<this.v.length;i+=15){this.v[i+8]=col[0];this.v[i+9]=col[1];this.v[i+10]=col[2];}
  return this;
};

Builder.prototype.bounds=function(){
  var mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(var i=0;i<this.v.length;i+=15){
    for(var k=0;k<3;k++){
      var val=this.v[i+k];
      if(val<mn[k])mn[k]=val;
      if(val>mx[k])mx[k]=val;
    }
  }
  if(this.v.length===0){mn=[0,0,0];mx=[0,0,0];}
  return {min:mn,max:mx};
};

/* Hand the accumulated data to the GPU. Index width is chosen from the
   vertex count so small props don't pay for 32-bit indices. */
Builder.prototype.upload=function(maxInstances){
  var GL=LH.GL;
  var data=new Float32Array(this.v);
  var idx=this.n>65535?new Uint32Array(this.i):new Uint16Array(this.i);
  var skin=null;
  if(this.skinning){
    /* Belt and braces: Builder.skin backfills, so this should already
       hold. A short array here would put every weight on the wrong
       vertex from that point on, which is not a thing to discover by
       looking at it. */
    while(this.sk.length<this.n*8)this.sk.push(0,0,0,0,1,0,0,0);
    this.sk.length=this.n*8;
    skin=new Float32Array(this.sk);
  }
  var mesh=GL.mesh(data,idx,maxInstances,skin);
  var b=this.bounds();
  mesh.bmin=b.min;mesh.bmax=b.max;
  var cx=(b.min[0]+b.max[0])/2,cy=(b.min[1]+b.max[1])/2,cz=(b.min[2]+b.max[2])/2;
  mesh.center=[cx,cy,cz];
  mesh.radius=Math.hypot(b.max[0]-cx,b.max[1]-cy,b.max[2]-cz);
  mesh.verts=this.n;
  return mesh;
};

LH.Geo=Geo;
})();


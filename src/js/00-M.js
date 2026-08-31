/* ============================================================
   LH.M — math.

   Column-major mat4 to match WebGL's uniformMatrix4fv, so matrices
   go to the GPU without a transpose. Everything writes into an
   `out` argument; the hot paths in the renderer run per-object per
   frame and allocating there is what kills a JS renderer.
   ============================================================ */
var LH={};
(function(){
'use strict';
var M={};
var TAU=Math.PI*2;

M.TAU=TAU;
M.clamp=function(v,a,b){return v<a?a:(v>b?b:v);};
M.lerp=function(a,b,t){return a+(b-a)*t;};
M.smooth=function(t){return t*t*(3-2*t);};
/* frame-rate independent exponential approach. `rate` is roughly
   "fraction closed per second", so 0.9 at 30fps matches 0.9 at 144. */
M.damp=function(a,b,rate,dt){return M.lerp(a,b,1-Math.pow(1-rate,dt*60));};
M.rad=function(d){return d*Math.PI/180;};
/* shortest signed angular distance a→b, so headings never spin the long way */
M.angDelta=function(a,b){var d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;};

/* ---------------- vec3 ---------------- */
function v3(x,y,z){return new Float32Array([x||0,y||0,z||0]);}
M.v3=v3;
M.set3=function(o,x,y,z){o[0]=x;o[1]=y;o[2]=z;return o;};
M.copy3=function(o,a){o[0]=a[0];o[1]=a[1];o[2]=a[2];return o;};
M.add3=function(o,a,b){o[0]=a[0]+b[0];o[1]=a[1]+b[1];o[2]=a[2]+b[2];return o;};
M.sub3=function(o,a,b){o[0]=a[0]-b[0];o[1]=a[1]-b[1];o[2]=a[2]-b[2];return o;};
M.scale3=function(o,a,s){o[0]=a[0]*s;o[1]=a[1]*s;o[2]=a[2]*s;return o;};
M.addScaled3=function(o,a,b,s){o[0]=a[0]+b[0]*s;o[1]=a[1]+b[1]*s;o[2]=a[2]+b[2]*s;return o;};
M.dot3=function(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];};
M.len3=function(a){return Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);};
M.dist3=function(a,b){var x=a[0]-b[0],y=a[1]-b[1],z=a[2]-b[2];return Math.sqrt(x*x+y*y+z*z);};
M.dist2=function(a,b){var x=a[0]-b[0],z=a[2]-b[2];return Math.sqrt(x*x+z*z);};
M.norm3=function(o,a){
  var l=Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);
  if(l<1e-8){o[0]=0;o[1]=0;o[2]=0;return o;}
  o[0]=a[0]/l;o[1]=a[1]/l;o[2]=a[2]/l;return o;
};
M.cross3=function(o,a,b){
  var ax=a[0],ay=a[1],az=a[2],bx=b[0],by=b[1],bz=b[2];
  o[0]=ay*bz-az*by;o[1]=az*bx-ax*bz;o[2]=ax*by-ay*bx;return o;
};
M.lerp3=function(o,a,b,t){
  o[0]=a[0]+(b[0]-a[0])*t;o[1]=a[1]+(b[1]-a[1])*t;o[2]=a[2]+(b[2]-a[2])*t;return o;
};

/* ---------------- mat4 (column-major) ---------------- */
function m4(){
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}
M.m4=m4;
M.ident=function(o){
  o[0]=1;o[1]=0;o[2]=0;o[3]=0; o[4]=0;o[5]=1;o[6]=0;o[7]=0;
  o[8]=0;o[9]=0;o[10]=1;o[11]=0; o[12]=0;o[13]=0;o[14]=0;o[15]=1;return o;
};
M.copy=function(o,a){o.set(a);return o;};

M.mul=function(o,a,b){
  var a00=a[0],a01=a[1],a02=a[2],a03=a[3],
      a10=a[4],a11=a[5],a12=a[6],a13=a[7],
      a20=a[8],a21=a[9],a22=a[10],a23=a[11],
      a30=a[12],a31=a[13],a32=a[14],a33=a[15];
  for(var i=0;i<4;i++){
    var b0=b[i*4],b1=b[i*4+1],b2=b[i*4+2],b3=b[i*4+3];
    o[i*4]  =b0*a00+b1*a10+b2*a20+b3*a30;
    o[i*4+1]=b0*a01+b1*a11+b2*a21+b3*a31;
    o[i*4+2]=b0*a02+b1*a12+b2*a22+b3*a32;
    o[i*4+3]=b0*a03+b1*a13+b2*a23+b3*a33;
  }
  return o;
};

M.fromTRS=function(o,t,rx,ry,rz,s){
  /* Y-X-Z euler order: yaw first, then pitch, then roll. That order
     keeps a character's turn independent of its lean, which is what
     the rig wants. */
  var cx=Math.cos(rx),sx=Math.sin(rx),
      cy=Math.cos(ry),sy=Math.sin(ry),
      cz=Math.cos(rz),sz=Math.sin(rz);
  var sxv=s[0],syv=s[1],szv=s[2];
  var m00=cy*cz+sy*sx*sz, m01=cx*sz, m02=cy*sx*sz-sy*cz;
  var m10=sy*sx*cz-cy*sz, m11=cx*cz, m12=sy*sz+cy*sx*cz;
  var m20=cx*sy,          m21=-sx,   m22=cx*cy;
  o[0]=m00*sxv;o[1]=m01*sxv;o[2]=m02*sxv;o[3]=0;
  o[4]=m10*syv;o[5]=m11*syv;o[6]=m12*syv;o[7]=0;
  o[8]=m20*szv;o[9]=m21*szv;o[10]=m22*szv;o[11]=0;
  o[12]=t[0];o[13]=t[1];o[14]=t[2];o[15]=1;
  return o;
};

M.translate=function(o,x,y,z){M.ident(o);o[12]=x;o[13]=y;o[14]=z;return o;};
M.scaleM=function(o,x,y,z){M.ident(o);o[0]=x;o[5]=y;o[10]=z;return o;};

M.perspective=function(o,fovy,aspect,near,far){
  var f=1/Math.tan(fovy/2),nf=1/(near-far);
  o[0]=f/aspect;o[1]=0;o[2]=0;o[3]=0;
  o[4]=0;o[5]=f;o[6]=0;o[7]=0;
  o[8]=0;o[9]=0;o[10]=(far+near)*nf;o[11]=-1;
  o[12]=0;o[13]=0;o[14]=2*far*near*nf;o[15]=0;
  return o;
};

M.ortho=function(o,l,r,b,t,n,f){
  var lr=1/(l-r),bt=1/(b-t),nf=1/(n-f);
  o[0]=-2*lr;o[1]=0;o[2]=0;o[3]=0;
  o[4]=0;o[5]=-2*bt;o[6]=0;o[7]=0;
  o[8]=0;o[9]=0;o[10]=2*nf;o[11]=0;
  o[12]=(l+r)*lr;o[13]=(t+b)*bt;o[14]=(f+n)*nf;o[15]=1;
  return o;
};

var _z=v3(),_x=v3(),_y=v3();
M.lookAt=function(o,eye,center,up){
  M.norm3(_z,M.sub3(_z,eye,center));
  if(M.len3(_z)<1e-6)_z[2]=1;
  M.norm3(_x,M.cross3(_x,up,_z));
  if(M.len3(_x)<1e-6){ /* looking straight up or down — pick any tangent */
    _x[0]=1;_x[1]=0;_x[2]=0;
    M.norm3(_x,M.cross3(_x,_x,_z));
  }
  M.cross3(_y,_z,_x);
  o[0]=_x[0];o[1]=_y[0];o[2]=_z[0];o[3]=0;
  o[4]=_x[1];o[5]=_y[1];o[6]=_z[1];o[7]=0;
  o[8]=_x[2];o[9]=_y[2];o[10]=_z[2];o[11]=0;
  o[12]=-M.dot3(_x,eye);o[13]=-M.dot3(_y,eye);o[14]=-M.dot3(_z,eye);o[15]=1;
  return o;
};

M.invert=function(o,m){
  var a00=m[0],a01=m[1],a02=m[2],a03=m[3],
      a10=m[4],a11=m[5],a12=m[6],a13=m[7],
      a20=m[8],a21=m[9],a22=m[10],a23=m[11],
      a30=m[12],a31=m[13],a32=m[14],a33=m[15];
  var b00=a00*a11-a01*a10, b01=a00*a12-a02*a10, b02=a00*a13-a03*a10,
      b03=a01*a12-a02*a11, b04=a01*a13-a03*a11, b05=a02*a13-a03*a12,
      b06=a20*a31-a21*a30, b07=a20*a32-a22*a30, b08=a20*a33-a23*a30,
      b09=a21*a32-a22*a31, b10=a21*a33-a23*a31, b11=a22*a33-a23*a32;
  var det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;
  if(!det)return M.ident(o);
  det=1/det;
  o[0]=(a11*b11-a12*b10+a13*b09)*det;
  o[1]=(a02*b10-a01*b11-a03*b09)*det;
  o[2]=(a31*b05-a32*b04+a33*b03)*det;
  o[3]=(a22*b04-a21*b05-a23*b03)*det;
  o[4]=(a12*b08-a10*b11-a13*b07)*det;
  o[5]=(a00*b11-a02*b08+a03*b07)*det;
  o[6]=(a32*b02-a30*b05-a33*b01)*det;
  o[7]=(a20*b05-a22*b02+a23*b01)*det;
  o[8]=(a10*b10-a11*b08+a13*b06)*det;
  o[9]=(a01*b08-a00*b10-a03*b06)*det;
  o[10]=(a30*b04-a31*b02+a33*b00)*det;
  o[11]=(a21*b02-a20*b04-a23*b00)*det;
  o[12]=(a11*b07-a10*b09-a12*b06)*det;
  o[13]=(a00*b09-a01*b07+a02*b06)*det;
  o[14]=(a31*b01-a30*b03-a32*b00)*det;
  o[15]=(a20*b03-a21*b01+a22*b00)*det;
  return o;
};

/* upper-left 3x3 inverse-transpose, for normals under non-uniform scale */
M.normalMat=function(o,m){
  var a00=m[0],a01=m[1],a02=m[2],a10=m[4],a11=m[5],a12=m[6],
      a20=m[8],a21=m[9],a22=m[10];
  var b01=a22*a11-a12*a21, b11=-a22*a10+a12*a20, b21=a21*a10-a11*a20;
  var det=a00*b01+a01*b11+a02*b21;
  if(!det){o[0]=1;o[1]=0;o[2]=0;o[3]=0;o[4]=1;o[5]=0;o[6]=0;o[7]=0;o[8]=1;return o;}
  det=1/det;
  o[0]=b01*det;o[1]=(-a22*a01+a02*a21)*det;o[2]=(a12*a01-a02*a11)*det;
  o[3]=b11*det;o[4]=(a22*a00-a02*a20)*det; o[5]=(-a12*a00+a02*a10)*det;
  o[6]=b21*det;o[7]=(-a21*a00+a01*a20)*det;o[8]=(a11*a00-a01*a10)*det;
  return o;
};

M.xformPoint=function(o,m,p){
  var x=p[0],y=p[1],z=p[2];
  var w=m[3]*x+m[7]*y+m[11]*z+m[15];if(!w)w=1;
  o[0]=(m[0]*x+m[4]*y+m[8]*z+m[12])/w;
  o[1]=(m[1]*x+m[5]*y+m[9]*z+m[13])/w;
  o[2]=(m[2]*x+m[6]*y+m[10]*z+m[14])/w;
  return o;
};
M.xformDir=function(o,m,p){
  var x=p[0],y=p[1],z=p[2];
  o[0]=m[0]*x+m[4]*y+m[8]*z;
  o[1]=m[1]*x+m[5]*y+m[9]*z;
  o[2]=m[2]*x+m[6]*y+m[10]*z;
  return o;
};

/* ---------------- deterministic noise ----------------
   Worlds are generated from a seed and must come back identical on
   every load, so nothing here may touch Math.random(). */
M.hash2=function(x,y,s){
  var n=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;
  return n-Math.floor(n);
};
M.noise2=function(x,y,s){
  var xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
  var u=M.smooth(xf),v=M.smooth(yf);
  var a=M.hash2(xi,yi,s),b=M.hash2(xi+1,yi,s),
      c=M.hash2(xi,yi+1,s),d=M.hash2(xi+1,yi+1,s);
  return M.lerp(M.lerp(a,b,u),M.lerp(c,d,u),v);
};
M.fbm=function(x,y,s,oct,gain,lac){
  oct=oct||4;gain=gain===undefined?0.5:gain;lac=lac||2;
  var sum=0,amp=1,norm=0,f=1;
  for(var i=0;i<oct;i++){
    sum+=M.noise2(x*f,y*f,s+i*17)*amp;norm+=amp;amp*=gain;f*=lac;
  }
  return sum/norm;
};
/* ridged noise — sharp crests, for cliffs and mountain silhouettes */
M.ridge=function(x,y,s,oct){
  oct=oct||4;
  var sum=0,amp=1,norm=0,f=1;
  for(var i=0;i<oct;i++){
    var n=1-Math.abs(M.noise2(x*f,y*f,s+i*29)*2-1);
    sum+=n*n*amp;norm+=amp;amp*=0.5;f*=2;
  }
  return sum/norm;
};

/* a small seeded PRNG for world dressing — same seed, same town */
M.rng=function(seed){
  var s=seed>>>0||1;
  return function(){
    s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;
    return s/4294967296;
  };
};

LH.M=M;
})();


/* ============================================================
   LH.Render — the forward renderer.

   Passes, in order:
     1. shadow   — depth-only from the sun, into a fitted ortho box
     2. sky      — one fullscreen triangle, no geometry
     3. opaque   — world + props + characters, instanced
     4. water    — animated surface, depth-aware shoreline
     5. blend    — glass, foliage cards, particles, name tags
     6. post     — bloom on the emissive pass, tonemap, vignette

   The lighting model is deliberately not full PBR: a directional
   sun with a wrapped diffuse term, a sky/ground hemisphere ambient,
   and a Blinn specular. It costs a fraction of the instructions and,
   for a stylised world, reads better than a physically correct one.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,GL=LH.GL,R={};
var gl=null;

/* ---------------- shared shader chunks ---------------- */
var COMMON=`
const float PI=3.14159265;
float saturate(float x){return clamp(x,0.0,1.0);}
vec3 saturate3(vec3 x){return clamp(x,vec3(0.0),vec3(1.0));}
// ACES-ish filmic curve. Cheap, and it keeps the neon from clipping to
// flat white the moment bloom lands on it.
vec3 tonemap(vec3 x){
  x*=0.9;
  return saturate3((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14));
}
vec3 toSRGB(vec3 c){
  return mix(c*12.92,1.055*pow(max(c,vec3(1e-5)),vec3(1.0/2.4))-0.055,step(0.0031308,c));
}
`;

var LIGHTING=`
uniform vec3 uSunDir;      // toward the sun
uniform vec3 uSunCol;
uniform vec3 uSkyCol;
uniform vec3 uGndCol;
uniform vec3 uEye;
uniform vec3 uFogCol;
uniform vec2 uFog;         // density, height falloff
uniform float uExposure;

// Wrapped diffuse: light bleeds slightly past the terminator, which
// stands in for the bounce a stylised scene would otherwise be missing.
float wrapDiffuse(vec3 n,vec3 l,float w){
  return saturate((dot(n,l)+w)/((1.0+w)*(1.0+w)));
}
vec3 hemi(vec3 n){
  return mix(uGndCol,uSkyCol,n.y*0.5+0.5);
}

// Three light bands with soft shoulders. The shoulders matter: a hard
// step aliases badly on a curved surface, and the whole point of the
// look is that a sphere reads as two clean shapes rather than a
// gradient with a staircase in it.
uniform float uToon;      // 0 = smooth shading, 1 = fully banded
float cel(float x){
  return 0.34
       + 0.30*smoothstep(0.30,0.40,x)
       + 0.36*smoothstep(0.66,0.76,x);
}
float toonify(float x){
  return mix(x,cel(x),uToon);
}

// ---- point lights ----
// A small fixed set, chosen on the CPU each frame from the lamps and
// signs nearest the camera. Sixteen is the whole budget: it is enough
// to light a street, and a forward renderer that loops further than
// that per fragment stops being worth it.
#define MAXLIGHTS 16
uniform int uLightCount;
uniform vec4 uLightPos[MAXLIGHTS];   // xyz world position, w radius
uniform vec4 uLightCol[MAXLIGHTS];   // rgb colour premultiplied by strength

vec3 pointLights(vec3 world,vec3 n){
  vec3 acc=vec3(0.0);
  for(int i=0;i<MAXLIGHTS;i++){
    if(i>=uLightCount)break;
    vec3 d=uLightPos[i].xyz-world;
    float r=uLightPos[i].w;
    float d2=dot(d,d);
    if(d2>r*r)continue;
    float dist=sqrt(max(d2,1e-6));
    // Smooth to zero at the radius. A 1/d^2 falloff cut off at a radius
    // leaves a visible disc edge on the ground under every lamp.
    float att=1.0-dist/r; att*=att;
    // Wrapped again, and hard: a street lamp is a big soft source and
    // a plain N.L makes every wall it touches look like a spotlight.
    float ndl=saturate(dot(n,d/dist)*0.62+0.38);
    acc+=uLightCol[i].rgb*(ndl*att);
  }
  return acc;
}
// Height fog. Distance drives the bulk of it; the height term thins it
// out as you climb, so the harbour sits in haze while the cliff tops
// stay clear. Averaging the two endpoint heights is an approximation of
// the proper integral along the ray, and is stable for every view
// direction including a perfectly horizontal one.
// Aerial perspective, not one flat fog colour. Haze is lit air, so its
// colour is the sky's in that direction — bluer looking up and away,
// warmer and brighter looking toward the sun, where forward scattering
// piles up. One constant colour makes a distant hillside sit in front
// of the sky it should be dissolving into, which is the single tell
// that separates depth from a grey wash.
vec3 applyFog(vec3 col,vec3 world,vec3 eye){
  vec3 d=world-eye;
  float dist=length(d);
  vec3 vd=d/max(dist,1e-4);
  float hs=max(0.5,uFog.y);
  float hAvg=max(0.0,(world.y+eye.y)*0.5);
  float density=uFog.x*exp(-hAvg/hs);
  float t=1.0-exp(-dist*density);
  // the sky in the direction we are actually looking
  vec3 haze=mix(uFogCol,uSkyCol*1.9,saturate(vd.y*1.4)*0.55);
  // and the sun's own glow through it
  float fwd=saturate(dot(vd,uSunDir));
  haze+=uSunCol*(pow(fwd,5.0)*0.22+pow(fwd,1.6)*0.05);
  return mix(col,haze,clamp(t,0.0,1.0));
}
`;

/* ---------------- shadows ----------------
   Two cascades. One map fitted to the whole visible neighbourhood has
   to cover about ninety metres, which at 2048 leaves four centimetres
   per texel — enough for a building's shadow and nowhere near enough
   for the contact between a foot and the ground, which is the shadow
   the eye actually checks. The near cascade covers thirteen metres at
   the same resolution, six millimetres a texel, and everything inside
   it reads sharp.

   The split is a hard test against the near box rather than a blend
   band: at this ratio the two look near-identical where they meet, and
   a blend costs a second twelve-tap fetch on every pixel in the
   overlap to hide a seam that is not visible. */
var SHADOW=`
uniform sampler2DShadow uShadow;
uniform sampler2DShadow uShadowN;
uniform mat4 uLightVP;
uniform mat4 uLightVPN;
uniform vec2 uShadowTexel;   // 1/size, bias scale
uniform float uShadowSoft;   // kernel radius, in shadow texels
const vec2 POISSON12[12]=vec2[12](
  vec2(-0.326,-0.406),vec2(-0.840,-0.074),vec2(-0.696, 0.457),
  vec2(-0.203, 0.621),vec2( 0.962,-0.195),vec2( 0.473,-0.480),
  vec2( 0.519, 0.767),vec2( 0.185,-0.893),vec2( 0.507, 0.064),
  vec2( 0.896, 0.412),vec2(-0.322,-0.933),vec2(-0.792,-0.598)
);
// A rotated Poisson disc rather than a 3x3 grid. Twelve taps in a ring
// cover more of the penumbra than nine in a square for the same cost,
// and rotating the ring per pixel turns the banding a fixed kernel
// leaves into noise the eye does not read as structure.
float pcf(sampler2DShadow smp,vec3 p,float soft){
  float ang=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)*6.28318;
  float ca=cos(ang),sa=sin(ang);
  float s=0.0;
  for(int i=0;i<12;i++){
    vec2 o=POISSON12[i];
    vec2 r=vec2(o.x*ca-o.y*sa,o.x*sa+o.y*ca)*uShadowTexel.x*soft;
    s+=texture(smp,vec3(p.xy+r,p.z));
  }
  return s/12.0;
}
float shadowAt(vec3 world,vec3 n,vec3 l){
  // Slope-scaled bias: grazing light needs far more offset than a face
  // pointing straight at the sun, and a single constant bias either
  // peters or floats depending which you tune for.
  float ndl=saturate(dot(n,l));
  float bias=uShadowTexel.y*(0.6+2.6*(1.0-ndl));

  vec4 lpn=uLightVPN*vec4(world,1.0);
  vec3 pn=lpn.xyz/lpn.w*0.5+0.5;
  if(pn.x>0.015&&pn.x<0.985&&pn.y>0.015&&pn.y<0.985&&pn.z<1.0){
    // The near box is a quarter the width, so its texels are a quarter
    // the size and both the bias and the kernel scale down with them.
    pn.z-=bias*0.30;
    return pcf(uShadowN,pn,uShadowSoft*0.9);
  }
  vec4 lp=uLightVP*vec4(world,1.0);
  vec3 p=lp.xyz/lp.w*0.5+0.5;
  if(p.z>1.0||p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0)return 1.0;
  p.z-=bias;
  return pcf(uShadow,p,uShadowSoft);
}
`;

/* ---------------- standard object shader ---------------- */
/* ---------------- wind ----------------
   Leaves are found by their material rather than by a per-vertex sway
   weight: the vertex format has no spare channel, and "this vertex is
   foliage" is exactly what the layer index already says. Trunks are
   bark, so they hold still while the canopy above them moves, which
   is the difference between a tree in wind and a tree being shaken.

   The same snippet goes through the depth pass. A canopy that sways
   while its own shadow stays put is worse than no wind at all. */
var WIND=`
uniform vec3 uWind;        // direction * strength
uniform float uWindTime;
uniform vec2 uLeaf;        // the two foliage layer indices
vec3 windOffset(vec3 local,vec3 world,float layer){
  float lf=floor(layer+0.5);
  if(lf!=uLeaf.x&&lf!=uLeaf.y)return vec3(0.0);
  // Height above the piece's own origin drives the amplitude, clamped
  // because a merged static mesh hands us world height rather than
  // local height and an unclamped term would fling a treetop on a
  // ninety-metre sky island across the sky.
  // A constant term as well as a height term. Height alone gives a
  // quarter-metre tree top a quarter-millimetre of sway, so ground
  // clutter would stand perfectly still in a gale.
  float h=0.045+clamp(local.y,0.0,4.0)*0.085;
  float ph=world.x*0.33+world.z*0.27;
  float t=uWindTime;
  // Two frequencies per axis. One is a metronome; two is weather.
  vec3 o=vec3(
    sin(t+ph)*0.62+sin(t*2.31+ph*1.7)*0.24,
    sin(t*1.73+ph*1.31)*0.16,
    cos(t*0.91+ph*0.8)*0.62+cos(t*2.13+ph*2.2)*0.21);
  return o*uWind*h;
}
`;

/* ---------------- skinning ----------------
   Linear blend skinning, four influences per vertex. The palette holds
   worldBone * inverseBind, so a vertex authored in the rest pose lands
   in world space with one multiply and no per-draw CPU work beyond
   filling the palette.

   Both the colour pass and the depth pass include this, and they must
   stay identical: a body that deforms while its shadow holds the rest
   pose is a worse artefact than no shadow at all. */
var SKIN=`
layout(location=10) in vec4 aBone;
layout(location=11) in vec4 aWeight;
uniform mat4 uBones[`+LH.GL.NBONES+`];
uniform int uSkinned;
mat4 skinMatrix(){
  return aWeight.x*uBones[int(aBone.x)]
       + aWeight.y*uBones[int(aBone.y)]
       + aWeight.z*uBones[int(aBone.z)]
       + aWeight.w*uBones[int(aBone.w)];
}
`;

var STD_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec2 aUV;
layout(location=3) in vec3 aCol;
layout(location=4) in vec4 aMat;      // layer, emissive, layer2, blend
layout(location=5) in mat4 aModel;    // consumes 5,6,7,8
layout(location=9) in vec4 aTint;     // rgb tint, a = extra emissive

uniform mat4 uVP;
uniform mat4 uModel;      // used when the mesh is drawn non-instanced
uniform int  uInstanced;
uniform vec4 uTint;
// Scrolls the texture on a surface. Waterfalls, conveyors, anything
// that has to flow without moving.
uniform vec2 uUVScroll;
`+WIND+SKIN+`
out vec3 vWorld;
out vec3 vNrm;
out vec2 vUV;
out vec3 vCol;
// Flat-qualified, and this is the whole fix for the coloured zigzag
// that ran along every path edge on this island. (No backticks in
// here: this shader is a JavaScript template literal, and a stray one
// ends the string in the middle of the vertex stage.)
//
// These are indices into a texture array. The fragment shader has to
// round them, because a fractional array index is undefined rather
// than a blend — and a smooth-interpolated index between two vertices
// that disagree sweeps the rounded value through *every layer between
// them in the atlas*. At a paving-to-road edge that is brick, roof,
// foliage and cherry blossom, one metre at a time, which is exactly
// what the magenta sawtooth was.
//
// Interpolating an index was never meaningful. Flat, the whole
// triangle takes the provoking vertex's layer, and only the blend
// weight — which is meaningful to interpolate — varies across it.
flat out float vLayer;
flat out float vLayer2;
out float vBlend;
out float vEmis;

void main(){
  mat4 mdl = (uSkinned==1) ? skinMatrix()
           : ((uInstanced==1) ? aModel : uModel);
  vec4 wp = mdl*vec4(aPos,1.0);
  wp.xyz += windOffset(aPos,wp.xyz,aMat.x);
  vWorld = wp.xyz;
  // Inverse-transpose is overkill here: every instance transform in
  // this game is a rotation, a uniform-ish scale, or both, so the
  // upper 3x3 rotates normals correctly on its own.
  vNrm = normalize(mat3(mdl)*aNrm);
  vUV = aUV + uUVScroll;
  vec4 tint = (uInstanced==1) ? aTint : uTint;
  vCol = aCol*tint.rgb;
  vLayer = aMat.x;
  vLayer2 = aMat.z;
  vBlend = aMat.w;
  vEmis = aMat.y + tint.a;
  gl_Position = uVP*wp;
}
`;

var STD_FS=`#version 300 es
precision highp float;
precision highp sampler2DArray;
precision highp sampler2DShadow;
`+COMMON+LIGHTING+SHADOW+`
uniform sampler2DArray uAtlas;
// Relief and roughness. RG is the tangent-space normal, B is roughness,
// so one fetch carries both and there is no third texture to keep in
// step with the first two.
uniform sampler2DArray uNorm;
uniform float uBump;
/* 1 on the ground, 0 on everything else. See the macro block in
   main(): tinting a prop or a character by its world position would
   make it change colour as it walked. */
uniform float uMacro;
uniform float uSpec;
uniform float uRim;
uniform float uRimPow;
uniform vec3  uRimCol;
// Which texture-array layer means skin. One comparison per fragment
// buys a second lighting model without a second shader or a second
// draw call.
uniform float uSkinLayer;
uniform float uFaceLayer;
uniform float uTime;
uniform float uAlpha;
// Lit windows and neon should not blow out at noon. One global scale,
// driven by the time of day, keeps them readable in daylight and lets
// them carry the night.
uniform float uEmisScale;
// Cloud cover drifting over the ground. Cheap two-octave value noise
// in world XZ — the sky already draws clouds, and a world where they
// cast nothing on it looks painted on rather than under them.
uniform float uCloudAmt;
uniform vec2 uCloudDrift;

in vec3 vWorld;
in vec3 vNrm;
in vec2 vUV;
in vec3 vCol;
flat in float vLayer;
flat in float vLayer2;
in float vBlend;
in float vEmis;

layout(location=0) out vec4 oCol;

float cnoise2(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453);
  float b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5453);
  float c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5453);
  float d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5453);
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float cloudShadow(vec2 wxz){
  if(uCloudAmt<0.001)return 1.0;
  vec2 p=wxz*0.0085+uCloudDrift;
  float n=cnoise2(p)*0.65+cnoise2(p*2.17+7.3)*0.35;
  // Wide bright gaps, soft edges: a hard-edged blotch reads as a
  // texture bug, not as weather.
  return mix(1.0,smoothstep(0.34,0.70,n),uCloudAmt);
}

void main(){
  // Round the layer indices: they are interpolated across the triangle
  // and a fractional array index is undefined, not a blend.
  vec4 tex = texture(uAtlas, vec3(vUV, floor(vLayer+0.5)));
  if(vBlend>0.002){
    vec4 tex2 = texture(uAtlas, vec3(vUV, floor(vLayer2+0.5)));
    tex = mix(tex, tex2, clamp(vBlend,0.0,1.0));
  }
  vec3 albedo = tex.rgb*vCol;
  float alpha = tex.a*uAlpha;
  if(alpha<0.02) discard;

  // ---- macro variation ----
  // Terrain UVs run in world units at 0.14, so every ground texture in
  // this game repeats every seven metres. Over a three-hundred-metre
  // island that reads as a bathroom floor however good the tile is,
  // and no amount of detail inside the tile fixes it, because the
  // thing the eye is picking up is the period, not the content. Two
  // octaves of slow world-space noise multiplying the albedo break the
  // period for the cost of no extra texture fetch. It also gives the
  // island tonal range: patches of ground that are simply lighter or
  // darker than their neighbours, which is most of what makes real
  // ground look like ground.
  if(uMacro>0.001){
    float m1=cnoise2(vWorld.xz*0.0155);
    float m2=cnoise2(vWorld.xz*0.0630+21.3);
    float mv=clamp(m1*0.66+m2*0.34,0.0,1.0);
    albedo*=mix(1.0,mix(0.80,1.16,mv),uMacro);
  }

  vec3 gn = normalize(vNrm);
  vec3 v = normalize(uEye-vWorld);
  vec3 l = uSunDir;

  // ---- surface relief ----
  // A cotangent frame built from screen-space derivatives, rather than
  // a tangent attribute. Every mesh in this game is generated at load
  // and none of them carry tangents; deriving the frame per fragment
  // costs four derivatives and works on all of them, including the
  // skinned ones where a baked tangent would have to be skinned too.
  vec4 nmap = texture(uNorm, vec3(vUV, floor(vLayer+0.5)));
  if(vBlend>0.002){
    vec4 nm2 = texture(uNorm, vec3(vUV, floor(vLayer2+0.5)));
    nmap = mix(nmap, nm2, clamp(vBlend,0.0,1.0));
  }
  float rough = clamp(nmap.z,0.05,1.0);
  vec3 n = gn;
  if(uBump>0.001){
    vec3 nt = vec3((nmap.xy*2.0-1.0)*uBump, 0.0);
    nt.z = sqrt(max(1e-4, 1.0-dot(nt.xy,nt.xy)));
    vec3 dp1=dFdx(vWorld), dp2=dFdy(vWorld);
    vec2 du1=dFdx(vUV),   du2=dFdy(vUV);
    vec3 dp2p=cross(dp2,gn), dp1p=cross(gn,dp1);
    vec3 T=dp2p*du1.x+dp1p*du2.x;
    vec3 B=dp2p*du1.y+dp1p*du2.y;
    float sc=inversesqrt(max(dot(T,T),dot(B,B))+1e-9);
    // A degenerate frame — a face whose UVs collapse — leaves the
    // geometry normal alone rather than shipping a NaN.
    if(sc<1e6) n = normalize(T*sc*nt.x + B*sc*nt.y + gn*nt.z);
  }

  float sh = shadowAt(vWorld,n,l);
  float ndl = wrapDiffuse(n,l,0.35);
  // Skin, and everything else. A face is the one surface a viewer has
  // spent their whole life reading, and the three things that give it
  // away are all cheap: light wraps further round it than round cloth,
  // it glows warm at the terminator where light has gone in and come
  // back out, and its highlight is broad and faint rather than tight.
  float isSkin = 1.0 - step(0.5, min(abs(vLayer-uSkinLayer),
                                     abs(vLayer-uFaceLayer)));
  float skinNdl = wrapDiffuse(n,l,0.66);

  // Shadow gets banded too. Leaving the PCF gradient smooth under a
  // banded terminator puts a soft edge next to a hard one on the same
  // surface, and the eye reads that as a bug rather than a style.
  sh *= cloudShadow(vWorld.xz);
  float band = uToon*(1.0-isSkin);
  float shT = mix(sh, smoothstep(0.30,0.52,sh)*0.78+0.22, band);
  float lit = mix(mix(ndl,cel(ndl),band), skinNdl, isSkin);
  vec3 direct = uSunCol*lit*shT;
  vec3 ambient = hemi(n);

  // Blinn specular, killed in shadow so wet-looking highlights don't
  // float on surfaces the sun cannot see.
  // A GGX lobe rather than a fixed Blinn exponent, so the roughness
  // that came out of the same fetch as the normal actually does
  // something: gold and window glass get a tight hot highlight, bark
  // and cloth get almost none, and skin gets the broad faint one it
  // should. Clamped, because GGX at low roughness spikes hard enough
  // to alias on a curved surface.
  vec3 h = normalize(l+v);
  float a = max(0.045, rough*rough);
  float ndh = saturate(dot(n,h));
  float dd = ndh*ndh*(a*a-1.0)+1.0;
  float ggx = min(12.0, (a*a)/(3.14159*dd*dd));
  float fres = 0.04+0.96*pow(1.0-saturate(dot(h,v)),5.0);
  float spec = ggx*fres*uSpec*4.0*sh*step(0.0,dot(n,l));
  spec = mix(spec, min(2.2,ggx)*fres*0.55*sh*step(0.0,dot(n,l)), isSkin);

  vec3 col = albedo*(direct+ambient+pointLights(vWorld,n)) + uSunCol*spec;

  // Ambient specular: the sky, reflected in proportion to how smooth
  // the surface is. Diffuse ambient alone makes a brass fitting in
  // shadow indistinguishable from a grey plastic one — what tells you
  // a thing is metal is what it reflects when the sun is off it. The
  // reflection is not multiplied by albedo, because a dielectric's
  // reflection is the colour of what it is looking at, not its own.
  // Cut hard for the moulded look. This term is what tells you a
  // thing is metal or wet when the sun is off it, and in a world made
  // of matte plastic there is nothing for it to say — while at
  // grazing angles it puts a bright untinted rim on every silhouette,
  // which is the single most "rendered" thing left in the frame.
  vec3 refl = reflect(-v,n);
  float amb_f = 0.04+0.96*pow(1.0-saturate(dot(n,v)),5.0);
  vec3 skyRefl = mix(uGndCol,uSkyCol,refl.y*0.5+0.5)*2.4;
  col += skyRefl*amb_f*(1.0-rough)*(1.0-rough)*0.24;

  // Subsurface: a narrow warm band either side of the terminator, where
  // light entered the skin and came back out somewhere else. It is a
  // fake — the real effect needs a diffusion profile — but it is the
  // fake that matters, because it is the band an ear or a nostril or
  // the edge of a jaw lights up with when the sun is behind it.
  if(isSkin>0.5){
    float t = dot(n,l);
    // Narrow on purpose. The first pass at this used a band a third of
    // a hemisphere wide and turned every face orange: scatter shows at
    // the terminator, not across the whole lit side.
    float band2 = saturate(1.0-abs(t-0.04)*6.5);
    col += albedo*uSunCol*vec3(0.105,0.026,0.016)*band2*sh;
    // and a little through the thin parts — an ear, a nostril, the
    // edge of a jaw — seen with the sun behind them
    float trans = saturate(dot(-l,v))*saturate(0.35-t)*0.5;
    col += albedo*uSunCol*vec3(0.17,0.044,0.029)*trans*sh;
  }

  // Rim light. Not a subtle separation any more: it is the single
  // thing that stops a matte character reading as an untextured
  // primitive, because it draws the silhouette in light rather than
  // leaving it to a change of albedo. Two terms — a broad one from the
  // sky that lifts the whole edge, and a tight one from behind that
  // only fires where the sun is actually back there.
  float rim = pow(1.0-saturate(dot(n,v)), uRimPow);
  col += uRimCol*rim*uRim;
  float back = saturate(dot(-l,v))*saturate(-dot(n,l)+0.35);
  col += uSunCol*pow(1.0-saturate(dot(n,v)),3.0)*back*uRim*0.85*sh;

  col += albedo*vEmis*3.0*uEmisScale;

  col = applyFog(col,vWorld,uEye);
  oCol = vec4(col*uExposure, alpha);
}
`;

/* ---------------- depth-only shadow shader ---------------- */
var DEPTH_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=4) in vec4 aMat;
layout(location=5) in mat4 aModel;
uniform mat4 uLightVP;
uniform mat4 uModel;
uniform int uInstanced;
`+WIND+SKIN+`
void main(){
  mat4 mdl=(uSkinned==1)?skinMatrix()
          :((uInstanced==1)?aModel:uModel);
  vec4 wp=mdl*vec4(aPos,1.0);
  wp.xyz+=windOffset(aPos,wp.xyz,aMat.x);
  gl_Position=uLightVP*wp;
}
`;
var DEPTH_FS=`#version 300 es
precision highp float;
void main(){}
`;

/* ---------------- sky ---------------- */
var SKY_VS=`#version 300 es
precision highp float;
out vec2 vNDC;
void main(){
  // One oversized triangle covering the viewport. No buffers bound.
  vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2);
  vNDC = p*2.0-1.0;
  gl_Position = vec4(vNDC,1.0,1.0);
}
`;
var SKY_FS=`#version 300 es
precision highp float;
`+COMMON+`
uniform mat4 uInvVP;
uniform vec3 uEye;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform float uTime;
uniform float uExposure;
uniform float uStars;
in vec2 vNDC;
layout(location=0) out vec4 oCol;

float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p){
  float s=0.0,a=0.5;
  for(int i=0;i<5;i++){s+=noise(p)*a;p*=2.03;a*=0.5;}
  return s;
}

void main(){
  // Reconstruct the view ray by unprojecting the far plane.
  vec4 far=uInvVP*vec4(vNDC,1.0,1.0);
  vec3 dir=normalize(far.xyz/far.w-uEye);

  float h=dir.y;
  vec3 col;
  if(h>=0.0){
    // Sky gradient biased toward the horizon so the band is thin and
    // the zenith holds its colour, the way a real sky reads.
    float t=pow(saturate(h),0.42);
    col=mix(uHorizon,uZenith,t);
  }else{
    col=mix(uHorizon,uGround,saturate(-h*3.5));
  }

  // Sun disc plus two-stage glow.
  float sd=dot(dir,uSunDir);
  float disc=smoothstep(0.9994,0.99975,sd);
  float glow=pow(saturate(sd),220.0)*0.6+pow(saturate(sd),12.0)*0.14;
  col+=uSunCol*(disc*14.0+glow);

  // Stars fade in with uStars, twitching slightly so the sky is not dead.
  if(uStars>0.001&&h>-0.02){
    vec2 sp=dir.xz/max(0.08,dir.y+0.12)*3.4;
    float st=hash(floor(sp*140.0));
    float tw=0.7+0.3*sin(uTime*2.2+st*90.0);
    float star=smoothstep(0.9975,1.0,st)*tw;
    col+=vec3(0.85,0.92,1.0)*star*uStars*saturate(h*4.0);
  }

  // Two cloud sheets at different scales and drift speeds.
  if(h>0.005){
    vec2 cp=dir.xz/max(0.05,dir.y)*0.5;
    float c1=fbm(cp*0.9+vec2(uTime*0.006,uTime*0.002));
    float c2=fbm(cp*2.1-vec2(uTime*0.010,0.0));
    float cloud=saturate((c1*0.65+c2*0.35-0.44)*2.6);
    cloud*=saturate(h*5.0);
    float lit=saturate(dot(dir,uSunDir)*0.5+0.5);
    vec3 cc=mix(uHorizon*1.05,uSunCol*1.35+vec3(0.55),lit);
    col=mix(col,cc,cloud*0.82);
  }

  oCol=vec4(col*uExposure,1.0);
}
`;

/* ---------------- water ---------------- */
var WATER_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec2 aUV;
layout(location=3) in vec3 aCol;
layout(location=4) in vec2 aMat;
uniform mat4 uVP;
uniform mat4 uModel;
uniform float uTime;
out vec3 vWorld;
out vec2 vUV;
void main(){
  vec4 wp=uModel*vec4(aPos,1.0);
  // Two crossing gerstner-ish swells. Small amplitude: this is a
  // harbour, not an ocean, and big waves would fight the boats.
  float w1=sin(wp.x*0.32+uTime*1.05)*0.055;
  float w2=sin(wp.z*0.27-uTime*0.83)*0.045;
  float w3=sin((wp.x+wp.z)*0.15+uTime*0.6)*0.03;
  wp.y+=w1+w2+w3;
  vWorld=wp.xyz;
  vUV=aUV;
  gl_Position=uVP*wp;
}
`;
var WATER_FS=`#version 300 es
precision highp float;
precision highp sampler2DArray;
`+COMMON+LIGHTING+`
uniform sampler2DArray uAtlas;
uniform float uTime;
uniform float uDetailLayer;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform float uFloorY;
// The gradient the sky pass is drawing, so the water can hand back the
// sky that is actually up there rather than a single ambient colour.
uniform vec3 uZenith;
uniform vec3 uHorizonC;
in vec3 vWorld;
in vec2 vUV;
layout(location=0) out vec4 oCol;

/* The same gradient the sky shader uses, minus the clouds and stars.
   Reflecting one flat colour is what made the harbour read as painted
   tin: at dusk the sky is orange and the water stayed teal. */
vec3 skyAt(vec3 d){
  float h=max(d.y,0.0);
  vec3 c=mix(uHorizonC,uZenith,pow(h,0.42));
  float sd=dot(d,uSunDir);
  // The sun's own reflection, and the wide sheen around it that turns
  // into the glitter path once the ripples break it up.
  c+=uSunCol*(pow(saturate(sd),340.0)*4.0+pow(saturate(sd),16.0)*0.12);
  return c;
}

void main(){
  // Analytic normal from the same three swells the vertex stage used.
  float dx=cos(vWorld.x*0.32+uTime*1.05)*0.32*0.055
          +cos((vWorld.x+vWorld.z)*0.15+uTime*0.6)*0.15*0.03;
  float dz=-cos(vWorld.z*0.27-uTime*0.83)*0.27*0.045
          +cos((vWorld.x+vWorld.z)*0.15+uTime*0.6)*0.15*0.03;
  vec3 n=normalize(vec3(-dx,1.0,-dz));

  // Ripple detail from the atlas, two layers scrolling against each other.
  vec2 a=vUV*7.0+vec2(uTime*0.020,uTime*0.013);
  vec2 b=vUV*11.0-vec2(uTime*0.016,uTime*0.024);
  float r1=texture(uAtlas,vec3(a,uDetailLayer)).g;
  float r2=texture(uAtlas,vec3(b,uDetailLayer)).g;
  n=normalize(n+vec3((r1-r2)*0.32,0.0,(r2-r1)*0.32));
  // A third, much finer octave. It contributes almost nothing to the
  // shape and everything to the sparkle: glitter is small normals
  // catching the sun, and two octaves are too smooth to catch it.
  vec2 c3=vUV*31.0+vec2(uTime*-0.031,uTime*0.041);
  float r3=texture(uAtlas,vec3(c3,uDetailLayer)).g;
  vec3 nFine=normalize(n+vec3((r3-0.5)*0.55,0.0,(0.5-r3)*0.55));

  vec3 v=normalize(uEye-vWorld);
  float fres=pow(1.0-saturate(dot(n,v)),4.0);

  // Depth-tinted body colour. There is no depth prepass to sample, so
  // the harbour floor height stands in — good enough for a shoreline
  // that shallows out believably.
  float depth=saturate((vWorld.y-uFloorY)/3.2);
  vec3 body=mix(uShallow,uDeep,depth);

  // Fresnel drives how much sky the surface hands back: near-flat views
  // are almost mirror, straight down is almost pure body colour.
  vec3 refl=reflect(-v,n);
  refl.y=abs(refl.y);   // never reflect the ground half of the sphere
  vec3 col=mix(body,skyAt(refl),saturate(fres*0.92+0.05));

  vec3 h=normalize(uSunDir+v);
  float spec=pow(saturate(dot(n,h)),220.0)*1.4;
  float sheen=pow(saturate(dot(n,h)),24.0)*0.18;
  // Glitter rides the fine normal and only exists where the sun's
  // reflection already is, which is what keeps it a path across the
  // water rather than static on the whole surface.
  vec3 hf=normalize(uSunDir+v);
  float glint=pow(saturate(dot(nFine,hf)),90.0);
  col+=uSunCol*(spec+sheen+glint*0.55);

  // Foam where the water is thin — the shoreline line. Two bands: a
  // solid one right at the edge and a broken one just outside it, so
  // the shore has a wash rather than a contour.
  float foam=smoothstep(0.20,0.0,depth);
  float fw=smoothstep(0.40,0.82,r1*0.6+r2*0.4);
  float surge=0.5+0.5*sin(uTime*0.9+vWorld.x*0.18+vWorld.z*0.15);
  col=mix(col,vec3(0.95,0.99,1.0),foam*fw*(0.55+surge*0.42));
  col=mix(col,vec3(0.90,0.97,1.0),smoothstep(0.05,0.0,depth)*0.55);

  col=applyFog(col,vWorld,uEye);
  // Near-opaque away from the shore. Any real transparency out here
  // shows the edge of the terrain mesh as a square outline on the sea.
  float alpha=mix(0.88,1.0,saturate(depth*1.4+fres));
  oCol=vec4(col*uExposure,alpha);
}
`;
/* ---------------- post ---------------- */
var POST_VS=SKY_VS;
var BRIGHT_FS=`#version 300 es
precision highp float;
`+COMMON+`
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uThresh;
in vec2 vNDC;
layout(location=0) out vec4 oCol;
void main(){
  vec2 uv=vNDC*0.5+0.5;
  vec3 c=texture(uSrc,uv).rgb;
  float l=dot(c,vec3(0.2126,0.7152,0.0722));
  // Soft knee, so a surface just under threshold doesn't pop as it
  // crosses it while the camera moves.
  float k=smoothstep(uThresh,uThresh+0.6,l);
  oCol=vec4(c*k,1.0);
}
`;
var BLUR_FS=`#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uDir;      // texel-sized step along one axis
in vec2 vNDC;
layout(location=0) out vec4 oCol;
void main(){
  vec2 uv=vNDC*0.5+0.5;
  // 9-tap gaussian collapsed to 5 samples with linear-filter offsets.
  vec3 c=texture(uSrc,uv).rgb*0.227027;
  c+=texture(uSrc,uv+uDir*1.3846).rgb*0.316216;
  c+=texture(uSrc,uv-uDir*1.3846).rgb*0.316216;
  c+=texture(uSrc,uv+uDir*3.2308).rgb*0.070270;
  c+=texture(uSrc,uv-uDir*3.2308).rgb*0.070270;
  oCol=vec4(c,1.0);
}
`;
/* Radial blur outward from the sun's screen position, run on the same
   bright-pass buffer the bloom uses. Two things make it read as light
   through air rather than a smear: the sample weights fall off along
   the ray, and the whole effect is gated on the sun actually being in
   front of the camera — otherwise it blooms from a point behind you. */
var GODRAY_FS=`#version 300 es
precision highp float;
`+COMMON+`
uniform sampler2D uSrc;
uniform vec2 uSun;        // sun position in screen UV
uniform float uAmount;
uniform float uDecay;
in vec2 vNDC;
layout(location=0) out vec4 oCol;
void main(){
  vec2 uv=vNDC*0.5+0.5;
  vec2 delta=(uv-uSun)*(1.0/16.0)*0.62;
  vec3 acc=vec3(0.0);
  float w=1.0;
  vec2 p=uv;
  for(int i=0;i<16;i++){
    p-=delta;
    acc+=texture(uSrc,clamp(p,vec2(0.0),vec2(1.0))).rgb*w;
    w*=uDecay;
  }
  oCol=vec4(acc*(uAmount/16.0),1.0);
}
`;

/* ---------------- ambient occlusion ----------------
   Hemisphere SSAO reconstructed entirely from the depth texture the
   ink pass already needs: view position by unprojecting depth, and the
   normal from the derivatives of that position. No normal buffer, no
   second geometry pass.

   This is the change that makes objects sit *on* the ground rather
   than in front of it. Everything else in the frame can be right and
   a scene with no contact darkening still reads as a diorama of
   cut-outs. */
var SSAO_FS=`#version 300 es
precision highp float;
uniform sampler2D uDepth;
uniform mat4 uProj;
uniform mat4 uInvProj;
uniform vec2 uRes;
uniform float uRadius;    // metres
uniform float uBias;
uniform float uStrength;
uniform float uPower;
in vec2 vNDC;
layout(location=0) out vec4 oCol;

vec3 viewPos(vec2 uv){
  float d=texture(uDepth,uv).r*2.0-1.0;
  vec4 c=uInvProj*vec4(uv*2.0-1.0,d,1.0);
  return c.xyz/c.w;
}
/* Sixteen rotations on a 4x4 grid. Paired with a 4x4 box blur they
   cancel exactly — which is why the blur below is a box of that size
   and not a gaussian of a convenient one. */
float gridAngle(vec2 fc){
  vec2 g=mod(floor(fc),4.0);
  return (g.x+g.y*4.0)*(6.28318/16.0);
}

/* A fixed hemisphere kernel, weighted toward the origin so the near
   field — where contact shadows actually live — gets most of the
   samples. */
const vec3 KERN[12]=vec3[12](
  vec3( 0.24, 0.11, 0.30),vec3(-0.31, 0.22, 0.18),vec3( 0.08,-0.35, 0.26),
  vec3(-0.16,-0.20, 0.44),vec3( 0.44, 0.30, 0.12),vec3(-0.48, 0.06, 0.36),
  vec3( 0.20,-0.52, 0.20),vec3(-0.28,-0.44, 0.48),vec3( 0.62, 0.14, 0.42),
  vec3(-0.10, 0.66, 0.30),vec3( 0.34,-0.24, 0.72),vec3(-0.58,-0.30, 0.60)
);

void main(){
  vec2 uv=vNDC*0.5+0.5;
  vec3 P=viewPos(uv);
  // Sky and the far field get no occlusion. Without this the horizon
  // picks up a grey band where the reconstruction goes singular.
  if(-P.z>240.0){oCol=vec4(1.0);return;}
  vec3 N=normalize(cross(dFdx(P),dFdy(P)));

  float a=gridAngle(gl_FragCoord.xy);
  float ca=cos(a),sa=sin(a);
  float occ=0.0;
  for(int i=0;i<12;i++){
    vec3 k=KERN[i];
    vec3 t=vec3(k.x*ca-k.y*sa, k.x*sa+k.y*ca, k.z);
    // Flip the sample into the surface's own hemisphere rather than
    // rejecting it — half a kernel is half the quality for the same
    // cost.
    if(dot(t,N)<0.0)t=-t;
    vec3 sp=P+t*uRadius;
    vec4 cp=uProj*vec4(sp,1.0);
    if(cp.w<=0.0)continue;
    vec2 suv=cp.xy/cp.w*0.5+0.5;
    if(suv.x<0.0||suv.x>1.0||suv.y<0.0||suv.y>1.0)continue;
    float sceneZ=viewPos(suv).z;
    // View z is negative ahead of the camera, so "the surface here is
    // nearer than my sample" is a greater-than.
    float hit=(sceneZ>=sp.z+uBias)?1.0:0.0;
    // Range check, or a wall fifty metres behind a railing occludes it.
    float range=smoothstep(0.0,1.0,uRadius/max(0.0001,abs(P.z-sceneZ)));
    occ+=hit*range;
  }
  float ao=1.0-(occ/12.0)*uStrength;
  // Curve it. The raw average is a gentle slope and reads as dirt on
  // the lens; the power puts the contrast where the geometry actually
  // touches and leaves open ground alone.
  oCol=vec4(vec3(pow(clamp(ao,0.0,1.0),uPower)),1.0);
}
`;

/* Occlusion needs its own blur. Borrowing the bloom's gaussian looked
   free and was not: that kernel reaches three and a half texels at half
   resolution, which is seven full-res pixels, and averaging a
   centimetre-wide contact band over seven pixels of open floor is how
   you turn a contact shadow into a rumour. Five tight taps instead. */
var AOBLUR_FS=`#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uDir;
in vec2 vNDC;
layout(location=0) out vec4 oCol;
void main(){
  vec2 uv=vNDC*0.5+0.5;
  // Four equal taps spanning exactly four texels. Run once across and
  // once down, that is a 4x4 box — the width the rotation grid needs,
  // and no wider, so contact bands survive it.
  float c=texture(uSrc,uv-uDir*1.5).r;
  c+=texture(uSrc,uv-uDir*0.5).r;
  c+=texture(uSrc,uv+uDir*0.5).r;
  c+=texture(uSrc,uv+uDir*1.5).r;
  oCol=vec4(vec3(c*0.25),1.0);
}
`;

/* ---------------- FXAA ----------------
   The ink pass draws one-pixel lines off a depth derivative, and those
   alias harder than any geometry edge in the scene. This runs last, on
   the finished LDR image, which is the only place a luma-based filter
   can see what it is smoothing. */
var FXAA_FS=`#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uRes;
in vec2 vNDC;
layout(location=0) out vec4 oCol;
float luma(vec3 c){return dot(c,vec3(0.299,0.587,0.114));}
void main(){
  vec2 uv=vNDC*0.5+0.5;
  vec2 t=1.0/uRes;
  vec3 mC=texture(uSrc,uv).rgb;
  float lM=luma(mC);
  float lNW=luma(texture(uSrc,uv+vec2(-t.x,-t.y)).rgb);
  float lNE=luma(texture(uSrc,uv+vec2( t.x,-t.y)).rgb);
  float lSW=luma(texture(uSrc,uv+vec2(-t.x, t.y)).rgb);
  float lSE=luma(texture(uSrc,uv+vec2( t.x, t.y)).rgb);
  float lMin=min(lM,min(min(lNW,lNE),min(lSW,lSE)));
  float lMax=max(lM,max(max(lNW,lNE),max(lSW,lSE)));
  // Flat enough to leave alone. Skipping early is most of the speed.
  if(lMax-lMin<max(0.028,lMax*0.115)){oCol=vec4(mC,1.0);return;}

  vec2 dir=vec2(-((lNW+lNE)-(lSW+lSE)),((lNW+lSW)-(lNE+lSE)));
  float dirRed=max((lNW+lNE+lSW+lSE)*0.25*0.20,0.0078);
  float rcp=1.0/(min(abs(dir.x),abs(dir.y))+dirRed);
  dir=clamp(dir*rcp,vec2(-6.0),vec2(6.0))*t;

  vec3 a=0.5*(texture(uSrc,uv+dir*(1.0/3.0-0.5)).rgb+
              texture(uSrc,uv+dir*(2.0/3.0-0.5)).rgb);
  vec3 b=a*0.5+0.25*(texture(uSrc,uv+dir*-0.5).rgb+
                     texture(uSrc,uv+dir* 0.5).rgb);
  float lB=luma(b);
  oCol=vec4((lB<lMin||lB>lMax)?a:b,1.0);
}
`;

var COMPOSITE_FS=`#version 300 es
precision highp float;
`+COMMON+`
uniform sampler2D uSrc;
uniform sampler2D uBloom;
uniform sampler2D uRays;
uniform sampler2D uDepth;
uniform sampler2D uAO;
uniform float uAOAmt;
// Dev view: 1 shows the occlusion buffer on its own, 2 shows linear
// depth. Both are the only practical way to tell "the pass produced
// nothing" apart from "the pass produced something too subtle to see".
uniform float uDebug;
uniform float uBloomAmt;
uniform float uRayAmt;
uniform float uVignette;
uniform float uOutline;
uniform float uSat;
uniform vec2 uNearFar;
uniform float uTime;
uniform vec2 uRes;
in vec2 vNDC;
layout(location=0) out vec4 oCol;

float linDepth(vec2 uv){
  float d=texture(uDepth,uv).r*2.0-1.0;
  float n=uNearFar.x,f=uNearFar.y;
  return (2.0*n*f)/(f+n-d*(f-n));
}

// Silhouette finder. The trick is the *second* derivative: a floor
// seen at a grazing angle has a huge depth gradient and would outline
// itself under a plain Sobel, but its curvature is nil. A silhouette
// spikes the curvature, and that is the edge worth inking.
uniform float uInkWidth;   // in pixels
uniform vec2 uInkFade;     // metres: full strength, faded
float edgeAt(vec2 uv){
  // Tap radius in pixels, not in UV: a line that is one texel wide is
  // a hairline at 1440p and a fat marker at 640p, and the drawing has
  // to weigh the same at both.
  vec2 t=uInkWidth/uRes;
  float c=linDepth(uv);
  float l=linDepth(uv-vec2(t.x,0.0));
  float r=linDepth(uv+vec2(t.x,0.0));
  float u=linDepth(uv+vec2(0.0,t.y));
  float d=linDepth(uv-vec2(0.0,t.y));
  float dx=abs(l+r-2.0*c);
  float dy=abs(u+d-2.0*c);
  // Scaled by distance so a line does not thicken into a blot as
  // something walks away from the camera.
  float e=smoothstep(0.055,0.24,(dx+dy)/max(c,0.4));
  // Ink fades with distance. Past about sixty metres a single pixel
  // spans several separate leaves, every one of them a silhouette, and
  // a forest inked at full strength turns into a field of scribble.
  // Near work stays drawn; the far side reads as colour.
  return e*mix(1.0,0.16,smoothstep(uInkFade.x,uInkFade.y,c));
}

void main(){
  vec2 uv=vNDC*0.5+0.5;
  if(uDebug>0.5){
    if(uDebug<1.5){oCol=vec4(vec3(texture(uAO,uv).r),1.0);return;}
    float ld=linDepth(uv)/60.0;
    oCol=vec4(vec3(fract(ld),ld*0.25,1.0-ld*0.25),1.0);return;
  }
  vec3 c=texture(uSrc,uv).rgb;
  // Occlusion goes on before the tonemap and before the glow, so a
  // bloomed window is not dimmed by the eaves above it.
  if(uAOAmt>0.001){
    float ao=texture(uAO,uv).r;
    c*=mix(1.0,ao,uAOAmt);
  }
  c+=texture(uBloom,uv).rgb*uBloomAmt;
  c+=texture(uRays,uv).rgb*uRayAmt;

  c=tonemap(c);

  if(uOutline>0.001){
    // A dark version of the surface's own colour, not black: a pure
    // black line on bright grass reads as a hole, not as ink.
    c=mix(c,c*vec3(0.16,0.17,0.22),edgeAt(uv)*uOutline);
  }
  if(uSat>0.0){
    float lum=dot(c,vec3(0.2126,0.7152,0.0722));
    c=mix(vec3(lum),c,1.0+uSat);
  }

  float r=length(vNDC*vec2(1.0,0.92));
  c*=mix(1.0,smoothstep(1.45,0.35,r),uVignette);

  // A little ordered dither before the 8-bit write: without it the sky
  // gradient bands visibly on a dark display.
  float d=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
  c+=(d-0.5)/255.0;

  oCol=vec4(toSRGB(c),1.0);
}
`;

/* ---------------- state ---------------- */
R.progs={};
R.shadow=null;
R.scene={
  sunDir:M.v3(0.45,0.72,0.28),
  /* Calibrated so a mid-grey albedo comes back mid-grey. Sun plus
     ambient has to land near 1.0 combined; the first pass at this had
     them summing to ~1.7 and every surface blew out a stop and a half
     hot, which reads as "washed out" long before it reads as "bright". */
  /* High key.

     The old split was a strong warm sun against a dim cool ambient,
     which is how you light something you want to look photographed:
     deep shadow, high contrast, a clear terminator. The reference is
     the opposite — ambient does most of the work, the sun is a lift
     rather than a key, and the darkest part of a green hill is still
     obviously green. Sun down, ambient up by a factor of three, and
     the ground bounce warmed so undersides do not go to slate. */
  /* Storybook key, not a lightbox.

     The previous pass took the sun down and the ambient up threefold
     to match a flat mobile reference, and it worked: everything came
     out evenly lit matte plastic. That is also exactly what makes a
     character read as an untextured primitive — with no terminator
     there is no form, and with no form a body is a stack of tubes
     whatever shape the tubes are.

     So: a warm key strong enough to cast a real terminator, a cool
     fill that is clearly a *fill* rather than a second key, and a
     ground bounce warm enough that an underside is in shade rather
     than in slate. The key and fill are complementary on purpose —
     warm light, cool shadow is the oldest trick in illustration and
     the reason a stylised character looks lit rather than printed. */
  sunCol:M.v3(0.94,0.85,0.70),
  skyCol:M.v3(0.38,0.45,0.60),
  gndCol:M.v3(0.32,0.27,0.23),
  zenith:M.v3(0.26,0.55,0.90),
  horizon:M.v3(0.84,0.92,1.00),
  ground:M.v3(0.30,0.36,0.42),
  fogCol:M.v3(0.76,0.86,0.96),
  /* Tuned by eye against a 120m view: enough haze to give the far
     shore depth, not so much that the middle distance goes flat. */
  fogDensity:0.0009,
  fogHeight:52,
  exposure:1.0,
  stars:0,
  bloom:0.62,
  bloomThresh:1.02,
  vignette:0.55,
  emisScale:1.0,
  rays:0.34,
  rayDecay:0.955,
  lampLevel:0,
  /* The cartoon dial. `toon` bands the lighting, `outline` inks the
     silhouettes, `saturation` is a straight chroma push after the
     tonemap. All three at zero gives back the old stylized-realism
     look exactly, which is what makes this a setting and not a
     rewrite. */
  /* Off. Cel banding and an ink line around every silhouette are what
     made the characters read as a children's cartoon, and no amount of
     work on the geometry underneath survives them. What is left is
     stylised realism: saturated palette, strong key light, soft
     shadows, no drawn edges. */
  /* A touch of banding, not a cel shader. The reference is soft — it
     has a gradient across a shirt, not two flat steps — so this sits
     low enough to firm the terminator up and no further. */
  /* A firmer terminator. Low enough that a shirt still has a gradient
     across it, high enough that the gradient has a shape. */
  toon:0.24,
  /* The rim, as three numbers rather than a hard-coded constant.
     `rimCol` is deliberately not the sky colour: a violet edge on a
     warm-lit character is what makes the light read as magical rather
     than as overcast. */
  rim:0.22,
  rimPow:3.4,
  rimCol:M.v3(0.62,0.66,1.00),
  /* Occlusion strength, the sample radius in metres, and a depth bias
     that stops a surface shadowing itself. */
  /* Weather the world can feel. `wind` is a direction times a
     strength; `windTime` is its own clock so a paused game stops
     swaying; the cloud terms drift the shadow field over the ground. */
  wind:M.v3(1,0.35,0.42),
  windTime:0,
  cloudAmt:0.34,
  cloudDrift:[0,0],
  ao:1.0,
  /* Radius in metres. A metre is the right scale for the crease where a
     wall meets a floor and completely the wrong one for an eye socket:
     at 1.05 every sample on a face landed on other parts of the same
     face and the occlusion cancelled out. Faces need it at the scale of
     a nostril. */
  aoRadius:0.42,
  aoBias:0.010,
  aoStrength:2.6,
  aoPower:1.30,
  debugView:0,
  fxaa:1,
  /* Kernel radius in shadow texels. Two is a hard edge with the
     aliasing filtered off; four is a soft one that starts to leak
     under thin geometry. */
  /* Relief strength. 0 is flat-shaded; past about 1.4 the derived
     normals start fighting the geometry ones at grazing angles.

     The reference has no surface relief at all — a moulded plastic
     island has no bark ridges and no brick courses, and the derived
     normals were most of what made this world read as photographed.
     A trace is kept rather than zero so a wall is not perfectly
     lifeless under a raking sun. */
  /* Some relief back. Zero is moulded plastic; this is enough that a
     brick course and a plank seam exist without the world going
     photographic again. */
  bump:0.34,
  shadowSoft:2.0,
  outline:0.0,
  inkWidth:1.35,
  inkNear:24,
  inkFar:150,
  /* Colour, rather than the memory of it. */
  saturation:0.46
};

/* ---------------- quality tiers ----------------
   Three named settings rather than fifteen sliders, because the person
   changing this is on a bus with one thumb free.

   What comes off first is what a phone pays most for and shows least:
   the screen-space occlusion pass, which is a full-resolution depth
   gather; then the bloom and the sun shafts, which are three more
   full-screen passes for a glow; then the shadow filter drops to a
   hard edge. What never comes off is the world — no draw distance
   cut, no dropped props — because a smaller world is a different game
   and a slightly softer one is not. */
R.TIERS={
  1:{name:'Battery', quality:0.72,ao:0,   bloom:0.0, rays:0,   fxaa:1,
     shadowSoft:1.0,bump:0.0},
  2:{name:'Balanced',quality:0.88,ao:0.55,bloom:0.55,rays:0.18,fxaa:1,
     shadowSoft:1.6,bump:0.06},
  3:{name:'Full',    quality:1.0, ao:1.0, bloom:0.85,rays:0.34,fxaa:1,
     shadowSoft:2.0,bump:0.10}
};
R.tier=3;
R.applyTier=function(t){
  var T=R.TIERS[t]||R.TIERS[3];
  R.tier=t;
  R.quality=T.quality;
  R.scene.ao=T.ao;
  R.scene.bloom=T.bloom;
  R.scene.rays=T.rays;
  R.scene.fxaa=T.fxaa;
  R.scene.shadowSoft=T.shadowSoft;
  R.scene.bump=T.bump;
  if(R.resized)R.resized();
  return T.name;
};

R.vp=M.m4();R.view=M.m4();R.proj=M.m4();R.invVP=M.m4();R.invProj=M.m4();
R.lightVP=M.m4();
R.lightVPN=M.m4();
R.eye=M.v3(0,3,8);
R.time=0;
R.quality=1;      /* 1 = full, 0.75 / 0.5 scale the internal buffers */

var sceneRT=null,bloomA=null,bloomB=null,rayRT=null;
var aoRT=null,aoBlurRT=null,ldrRT=null;
var SHADOW_SIZE=2048;

R.init=function(canvas){
  gl=GL.gl;
  R.canvas=canvas;
  R.progs.std=GL.program('std',STD_VS,STD_FS);
  R.progs.depth=GL.program('depth',DEPTH_VS,DEPTH_FS);
  R.progs.sky=GL.program('sky',SKY_VS,SKY_FS);
  R.progs.water=GL.program('water',WATER_VS,WATER_FS);
  R.progs.bright=GL.program('bright',POST_VS,BRIGHT_FS);
  R.progs.blur=GL.program('blur',POST_VS,BLUR_FS);
  R.progs.rays=GL.program('rays',POST_VS,GODRAY_FS);
  R.progs.comp=GL.program('comp',POST_VS,COMPOSITE_FS);
  R.progs.ssao=GL.program('ssao',POST_VS,SSAO_FS);
  R.progs.aoblur=GL.program('aoblur',POST_VS,AOBLUR_FS);
  R.progs.fxaa=GL.program('fxaa',POST_VS,FXAA_FS);

  /* A weak GPU with a small shadow map still looks fine; a missing one
     does not, so fall back a step rather than disabling shadows. */
  R.shadow=GL.shadowTarget(SHADOW_SIZE);
  if(!R.shadow.ok){SHADOW_SIZE=1024;R.shadow=GL.shadowTarget(SHADOW_SIZE);}
  R.shadowN=GL.shadowTarget(SHADOW_SIZE);

  sceneRT=GL.colorTarget(2,2,true,true);
  bloomA=GL.colorTarget(2,2,true);
  bloomB=GL.colorTarget(2,2,true);
  rayRT=GL.colorTarget(2,2,true);
  /* Occlusion at half resolution and blurred: it is a low-frequency
     term and full-res noise costs four times as much to produce and
     then has to be blurred away anyway. */
  aoRT=GL.colorTarget(2,2,'nodepth');
  aoBlurRT=GL.colorTarget(2,2,'nodepth');
  ldrRT=GL.colorTarget(2,2,'nodepth');
  return R;
};

R.resize=function(w,h){
  var q=R.quality;
  var iw=Math.max(2,Math.round(w*q)),ih=Math.max(2,Math.round(h*q));
  GL.resizeColorTarget(sceneRT,iw,ih,true);
  GL.resizeColorTarget(bloomA,Math.max(2,iw>>1),Math.max(2,ih>>1),true);
  GL.resizeColorTarget(bloomB,Math.max(2,iw>>1),Math.max(2,ih>>1),true);
  GL.resizeColorTarget(rayRT,Math.max(2,iw>>1),Math.max(2,ih>>1),true);
  GL.resizeColorTarget(aoRT,Math.max(2,iw>>1),Math.max(2,ih>>1),'nodepth');
  GL.resizeColorTarget(aoBlurRT,Math.max(2,iw>>1),Math.max(2,ih>>1),'nodepth');
  GL.resizeColorTarget(ldrRT,iw,ih,'nodepth');
  R.iw=iw;R.ih=ih;
  R._lw=w;R._lh=h;
};
/* Re-run the last resize at the current quality, so changing tier
   takes effect without waiting for the window to change size. */
R.resized=function(){if(R._lw)R.resize(R._lw,R._lh);};

/* Fit the sun's ortho box around the camera's near region. Shadow
   resolution is finite, so covering the whole 400m island would make
   the character's own shadow a blur — instead the box tracks the
   player and only near geometry casts. */
var _lv=M.m4(),_lp=M.m4(),_ctr=M.v3(),_eye=M.v3(),_up=M.v3(0,1,0),_nf=M.v3();
function fitCascade(out,focus,radius,sunDir){
  /* Snap the focus to shadow-texel increments. Without this the whole
     shadow crawls and shimmers as the player walks. */
  var texel=(radius*2)/SHADOW_SIZE;
  var fx=Math.round(focus[0]/texel)*texel;
  var fz=Math.round(focus[2]/texel)*texel;
  M.set3(_ctr,fx,focus[1],fz);
  M.addScaled3(_eye,_ctr,sunDir,radius*2.2);
  M.lookAt(_lv,_eye,_ctr,_up);
  M.ortho(_lp,-radius,radius,-radius,radius,0.5,radius*5);
  M.mul(out,_lp,_lv);
}
R.nearRadius=13;
R.updateLight=function(focus,radius){
  radius=radius||42;
  var s=R.scene;
  fitCascade(R.lightVP,focus,radius,s.sunDir);
  /* The near cascade is centred a little ahead of the player rather
     than on them: the camera is behind, so the ground the player is
     walking on to is what needs the resolution. */
  M.set3(_nf,focus[0],focus[1],focus[2]);
  fitCascade(R.lightVPN,_nf,R.nearRadius,s.sunDir);
};

R.setCamera=function(view,proj,eye){
  M.copy(R.view,view);M.copy(R.proj,proj);M.copy3(R.eye,eye);
  M.mul(R.vp,proj,view);
  M.invert(R.invVP,R.vp);
  /* The occlusion pass works in view space, so it needs the lens on
     its own rather than the whole view-projection. */
  M.invert(R.invProj,proj);
};

function bindSceneUniforms(p){
  var s=R.scene;
  GL.u1i(p,'uLightCount',R.lightCount);
  if(R.lightCount){
    GL.u4fv(p,'uLightPos',R.lightPos);
    GL.u4fv(p,'uLightCol',R.lightCol);
  }
  GL.u3v(p,'uSunDir',s.sunDir);
  GL.u3v(p,'uSunCol',s.sunCol);
  GL.u3v(p,'uSkyCol',s.skyCol);
  GL.u3v(p,'uGndCol',s.gndCol);
  GL.u3v(p,'uFogCol',s.fogCol);
  GL.u2f(p,'uFog',s.fogDensity,s.fogHeight);
  GL.u3v(p,'uEye',R.eye);
  GL.u1f(p,'uExposure',s.exposure);
  GL.u1f(p,'uToon',s.toon);
  GL.u1f(p,'uRim',s.rim);
  GL.u1f(p,'uRimPow',s.rimPow);
  GL.u3v(p,'uRimCol',s.rimCol);
  GL.u1f(p,'uSkinLayer',LH.Tex.layer('skin'));
  GL.u1f(p,'uBump',s.bump);
  GL.u1f(p,'uMacro',0);
  GL.u1f(p,'uFaceLayer',LH.Tex.layer('face'));
  GL.u3v(p,'uWind',s.wind);
  GL.u1f(p,'uWindTime',s.windTime);
  GL.u2f(p,'uLeaf',LH.Tex.layer('foliage'),LH.Tex.layer('foliagep'));
  GL.u1f(p,'uCloudAmt',s.cloudAmt);
  GL.u2f(p,'uCloudDrift',s.cloudDrift[0],s.cloudDrift[1]);
  GL.u1f(p,'uTime',R.time);
}

/* ---------------- pass drivers ---------------- */
R.beginShadow=function(near){
  GL.bindTarget(near?R.shadowN:R.shadow);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  /* Front-face culling during the depth pass moves acne to the
     backfaces, where nobody sees it. */
  gl.cullFace(gl.FRONT);
  var p=GL.use(R.progs.depth);
  GL.uM4(p,'uLightVP',near?R.lightVPN:R.lightVP);
  var s=R.scene;
  GL.u3v(p,'uWind',s.wind);
  GL.u1f(p,'uWindTime',s.windTime);
  GL.u2f(p,'uLeaf',LH.Tex.layer('foliage'),LH.Tex.layer('foliagep'));
  return p;
};
R.endShadow=function(){gl.cullFace(gl.BACK);};

R.beginScene=function(){
  GL.bindTarget(sceneRT);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  /* Sky writes every pixel, so there is no need to clear colour. */
  var p=GL.use(R.progs.sky);
  var s=R.scene;
  gl.depthMask(false);
  GL.uM4(p,'uInvVP',R.invVP);
  GL.u3v(p,'uEye',R.eye);
  GL.u3v(p,'uSunDir',s.sunDir);
  GL.u3v(p,'uSunCol',s.sunCol);
  GL.u3v(p,'uZenith',s.zenith);
  GL.u3v(p,'uHorizon',s.horizon);
  GL.u3v(p,'uGround',s.ground);
  GL.u1f(p,'uTime',R.time);
  GL.u1f(p,'uExposure',s.exposure);
  GL.u1f(p,'uStars',s.stars);
  GL.fullscreen();
  gl.depthMask(true);
};

/* The active point-light set, refilled each frame from whatever the
   world says is nearest. Kept as two flat Float32Arrays so the upload
   is one call per program rather than sixteen. */
R.MAXLIGHTS=16;
R.lightCount=0;
R.lightPos=new Float32Array(R.MAXLIGHTS*4);
R.lightCol=new Float32Array(R.MAXLIGHTS*4);
/* list entries: {x,y,z,r,col:[r,g,b],power,always} — `level` is the
   time-of-day dimmer the sky hands down, which everything but an
   `always` light is multiplied by. */
R.setLights=function(list,level){
  var n=Math.min(list.length,R.MAXLIGHTS);
  for(var i=0;i<n;i++){
    var L=list[i],o=i*4;
    R.lightPos[o]=L.x;R.lightPos[o+1]=L.y;R.lightPos[o+2]=L.z;R.lightPos[o+3]=L.r;
    var k=(L.power===undefined?1:L.power)*(L.always?1:level);
    R.lightCol[o]=L.col[0]*k;R.lightCol[o+1]=L.col[1]*k;R.lightCol[o+2]=L.col[2]*k;
    R.lightCol[o+3]=0;
  }
  R.lightCount=n;
};

R.beginOpaque=function(){
  var p=GL.use(R.progs.std);
  bindSceneUniforms(p);
  GL.uM4(p,'uVP',R.vp);
  GL.uM4(p,'uLightVP',R.lightVP);
  GL.uM4(p,'uLightVPN',R.lightVPN);
  GL.u2f(p,'uShadowTexel',1/SHADOW_SIZE,0.0016);
  GL.u1f(p,'uShadowSoft',R.scene.shadowSoft);
  GL.bindTex(0,LH.Tex.array,gl.TEXTURE_2D_ARRAY);
  GL.u1i(p,'uAtlas',0);
  GL.bindTex(1,R.shadow.tex,gl.TEXTURE_2D);
  GL.u1i(p,'uShadow',1);
  GL.bindTex(2,LH.Tex.normals,gl.TEXTURE_2D_ARRAY);
  GL.u1i(p,'uNorm',2);
  GL.bindTex(3,R.shadowN.tex,gl.TEXTURE_2D);
  GL.u1i(p,'uShadowN',3);
  /* Matte. A moulded surface has a wide, weak sheen or none. */
  GL.u1f(p,'uSpec',0.10);
  GL.u1f(p,'uAlpha',1);
  GL.u1f(p,'uEmisScale',R.scene.emisScale);
  GL.u4f(p,'uTint',1,1,1,0);
  GL.u2f(p,'uUVScroll',0,0);
  GL.u1i(p,'uInstanced',0);
  return p;
};

R.beginWater=function(floorY){
  var p=GL.use(R.progs.water);
  bindSceneUniforms(p);
  GL.uM4(p,'uVP',R.vp);
  GL.bindTex(0,LH.Tex.array,gl.TEXTURE_2D_ARRAY);
  GL.u1i(p,'uAtlas',0);
  GL.u1f(p,'uDetailLayer',LH.Tex.layer('water'));
  GL.u3f(p,'uShallow',0.30,0.80,0.80);
  GL.u3f(p,'uDeep',0.03,0.26,0.48);
  GL.u3v(p,'uZenith',R.scene.zenith);
  GL.u3v(p,'uHorizonC',R.scene.horizon);
  GL.u1f(p,'uFloorY',floorY===undefined?-3:floorY);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  return p;
};
R.endWater=function(){gl.depthMask(true);gl.disable(gl.BLEND);};

R.beginBlend=function(){
  var p=R.beginOpaque();
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  return p;
};
R.endBlend=function(){gl.depthMask(true);gl.disable(gl.BLEND);};

/* additive pass for sparks, auras, sun shafts */
R.beginAdditive=function(){
  var p=R.beginOpaque();
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
  gl.depthMask(false);
  return p;
};

R.present=function(){
  var s=R.scene;
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);

  /* --- ambient occlusion --- */
  var aoOn=(s.ao>0.001&&sceneRT.depthTex);
  if(aoOn){
    GL.bindTarget(aoRT);
    var pa=GL.use(R.progs.ssao);
    GL.bindTex(0,sceneRT.depthTex,gl.TEXTURE_2D);GL.u1i(pa,'uDepth',0);
    GL.uM4(pa,'uProj',R.proj);
    GL.uM4(pa,'uInvProj',R.invProj);
    GL.u2f(pa,'uRes',aoRT.w,aoRT.h);
    GL.u1f(pa,'uRadius',s.aoRadius);
    GL.u1f(pa,'uBias',s.aoBias);
    GL.u1f(pa,'uStrength',s.aoStrength);
    GL.u1f(pa,'uPower',s.aoPower);
    GL.fullscreen();
    /* Two separable passes over the AO. The kernel is rotated per
       pixel, so what comes out of the pass is correct but noisy, and
       the blur is what turns the noise back into a gradient. */
    var pab=GL.use(R.progs.aoblur);
    GL.bindTarget(aoBlurRT);
    GL.bindTex(0,aoRT.tex,gl.TEXTURE_2D);GL.u1i(pab,'uSrc',0);
    GL.u2f(pab,'uDir',1/aoRT.w,0);
    GL.fullscreen();
    GL.bindTarget(aoRT);
    GL.bindTex(0,aoBlurRT.tex,gl.TEXTURE_2D);GL.u1i(pab,'uSrc',0);
    GL.u2f(pab,'uDir',0,1/aoRT.h);
    GL.fullscreen();
  }

  if(s.bloom>0.001){
    GL.bindTarget(bloomA);
    var pb=GL.use(R.progs.bright);
    GL.bindTex(0,sceneRT.tex,gl.TEXTURE_2D);GL.u1i(pb,'uSrc',0);
    GL.u1f(pb,'uThresh',s.bloomThresh);
    GL.fullscreen();

    /* Two separable passes. More would be smoother but this is a
       glow, not a lens simulation. */
    var pblur=GL.use(R.progs.blur);
    GL.bindTarget(bloomB);
    GL.bindTex(0,bloomA.tex,gl.TEXTURE_2D);GL.u1i(pblur,'uSrc',0);
    GL.u2f(pblur,'uDir',1/bloomA.w,0);
    GL.fullscreen();

    GL.bindTarget(bloomA);
    GL.bindTex(0,bloomB.tex,gl.TEXTURE_2D);GL.u1i(pblur,'uSrc',0);
    GL.u2f(pblur,'uDir',0,1/bloomA.h);
    GL.fullscreen();
  }

  /* Sun shafts. Projected here rather than passed in, so the pass
     needs nothing from the game but the sun direction it already has. */
  var rayAmt=0;
  if(s.rays>0.001){
    var sd=s.sunDir;
    var fwdX=-R.view[2],fwdY=-R.view[6],fwdZ=-R.view[10];
    var facing=fwdX*sd[0]+fwdY*sd[1]+fwdZ*sd[2];
    if(facing>0.02){
      var ex=R.eye[0]+sd[0]*900,ey=R.eye[1]+sd[1]*900,ez=R.eye[2]+sd[2]*900;
      var cx=R.vp[0]*ex+R.vp[4]*ey+R.vp[8]*ez+R.vp[12];
      var cy=R.vp[1]*ex+R.vp[5]*ey+R.vp[9]*ez+R.vp[13];
      var cw=R.vp[3]*ex+R.vp[7]*ey+R.vp[11]*ez+R.vp[15];
      if(cw>0.0001){
        var sx=cx/cw*0.5+0.5, sy=cy/cw*0.5+0.5;
        /* fade out as the sun leaves the frame, or the shafts snap off */
        var edge=Math.max(Math.abs(sx-0.5),Math.abs(sy-0.5));
        rayAmt=s.rays*Math.min(1,facing*2.4)*Math.max(0,1-Math.max(0,edge-0.5)*3.2);
        if(rayAmt>0.001){
          GL.bindTarget(rayRT);
          var pr=GL.use(R.progs.rays);
          GL.bindTex(0,bloomA.tex,gl.TEXTURE_2D);GL.u1i(pr,'uSrc',0);
          GL.u2f(pr,'uSun',sx,sy);
          GL.u1f(pr,'uAmount',1.0);
          GL.u1f(pr,'uDecay',s.rayDecay);
          GL.fullscreen();
        }
      }
    }
  }

  /* The composite lands in a buffer rather than on screen, because
     FXAA has to run on the finished image. */
  var aaOn=!!s.fxaa;
  GL.bindTarget(aaOn?ldrRT:null);
  var pc=GL.use(R.progs.comp);
  GL.bindTex(0,sceneRT.tex,gl.TEXTURE_2D);GL.u1i(pc,'uSrc',0);
  GL.bindTex(4,aoRT.tex,gl.TEXTURE_2D);GL.u1i(pc,'uAO',4);
  GL.u1f(pc,'uAOAmt',aoOn?s.ao:0);
  GL.u1f(pc,'uDebug',s.debugView||0);
  GL.bindTex(1,bloomA.tex,gl.TEXTURE_2D);GL.u1i(pc,'uBloom',1);
  GL.bindTex(2,rayRT.tex,gl.TEXTURE_2D);GL.u1i(pc,'uRays',2);
  GL.bindTex(3,sceneRT.depthTex,gl.TEXTURE_2D);GL.u1i(pc,'uDepth',3);
  /* Recovered from the projection rather than plumbed through from the
     camera: proj[14]/(proj[10]-1) is the near plane and
     proj[14]/(proj[10]+1) the far one, so the outline pass cannot go
     stale when something else changes the lens. */
  var p10=R.proj[10],p14=R.proj[14];
  GL.u2f(pc,'uNearFar',p14/(p10-1.0),p14/(p10+1.0));
  GL.u1f(pc,'uOutline',sceneRT.depthTex?s.outline:0);
  GL.u1f(pc,'uInkWidth',s.inkWidth);
  GL.u2f(pc,'uInkFade',s.inkNear,s.inkFar);
  GL.u1f(pc,'uSat',s.saturation);
  GL.u1f(pc,'uRayAmt',rayAmt);
  GL.u1f(pc,'uBloomAmt',s.bloom);
  GL.u1f(pc,'uVignette',s.vignette);
  GL.u1f(pc,'uTime',R.time);
  GL.u2f(pc,'uRes',R.iw,R.ih);
  GL.fullscreen();

  if(aaOn){
    GL.bindTarget(null);
    var pf=GL.use(R.progs.fxaa);
    GL.bindTex(0,ldrRT.tex,gl.TEXTURE_2D);GL.u1i(pf,'uSrc',0);
    GL.u2f(pf,'uRes',R.iw,R.ih);
    GL.fullscreen();
  }

  gl.enable(gl.DEPTH_TEST);
};

LH.Render=R;
})();


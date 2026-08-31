/* ============================================================
   LH.Sky — time of day and weather.

   The sun's colour, the sky gradient, the fog and the ambient are all
   driven from one clock, so evening in the harbour is a single number
   changing rather than a set of hand-tuned presets. Weather rides on
   top: overcast desaturates and thickens the fog, rain adds particles
   and drops the exposure.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,R=LH.Render,S={};

S.time=9.2;            /* hours, 0..24 */
S.rate=1/110;          /* game hours per real second — a day is ~30 min */
S.weather='clear';
S.wet=0;               /* 0..1, eased so weather changes are not a cut */

/* Keyframes around the clock. Everything between them is interpolated,
   which is why dawn actually passes through a colour rather than
   snapping from night to day. */
var KEY=[
  /* hour  sun            zenith         horizon        fog            amb sky        amb gnd       exp   stars */
  [ 0.0, [0.14,0.18,0.34],[0.02,0.03,0.12],[0.07,0.10,0.24],[0.07,0.10,0.22],[0.07,0.10,0.20],[0.04,0.04,0.06],1.10,1.0],
  [ 5.0, [0.26,0.22,0.34],[0.04,0.08,0.22],[0.22,0.18,0.32],[0.19,0.18,0.28],[0.11,0.13,0.22],[0.05,0.05,0.07],1.05,0.8],
  [ 6.6, [1.10,0.60,0.38],[0.10,0.20,0.48],[0.92,0.56,0.42],[0.72,0.54,0.50],[0.21,0.21,0.32],[0.10,0.09,0.09],1.00,0.15],
  [ 8.5, [1.16,1.00,0.84],[0.10,0.32,0.76],[0.66,0.82,0.97],[0.64,0.81,0.96],[0.23,0.30,0.42],[0.16,0.15,0.13],1.00,0.0],
  [12.5, [1.18,1.12,1.02],[0.10,0.37,0.84],[0.70,0.87,1.00],[0.69,0.86,1.00],[0.26,0.34,0.46],[0.19,0.18,0.16],0.98,0.0],
  [17.0, [1.17,1.02,0.80],[0.10,0.33,0.78],[0.72,0.84,0.96],[0.70,0.83,0.95],[0.24,0.31,0.43],[0.17,0.16,0.14],1.00,0.0],
  [19.2, [1.22,0.58,0.30],[0.11,0.18,0.46],[1.00,0.54,0.34],[0.82,0.52,0.44],[0.23,0.20,0.29],[0.11,0.09,0.08],1.02,0.2],
  [20.6, [0.50,0.32,0.36],[0.05,0.09,0.26],[0.34,0.22,0.36],[0.27,0.22,0.35],[0.13,0.14,0.24],[0.06,0.05,0.06],1.08,0.7],
  [24.0, [0.14,0.18,0.34],[0.02,0.03,0.12],[0.07,0.10,0.24],[0.07,0.10,0.22],[0.07,0.10,0.20],[0.04,0.04,0.06],1.10,1.0]
];

function sample(h){
  var i=0;
  while(i<KEY.length-2&&KEY[i+1][0]<=h)i++;
  var a=KEY[i],b=KEY[i+1];
  var t=M.smooth(M.clamp((h-a[0])/((b[0]-a[0])||1),0,1));
  var out=[];
  for(var k=1;k<=6;k++){
    out.push([M.lerp(a[k][0],b[k][0],t),M.lerp(a[k][1],b[k][1],t),
              M.lerp(a[k][2],b[k][2],t)]);
  }
  out.push(M.lerp(a[7],b[7],t));
  out.push(M.lerp(a[8],b[8],t));
  return out;
}

var WEATHER={
  clear:   {fogMul:1.00,sunMul:1.00,ambMul:1.00,exp:1.00,cloud:0.0,rain:0},
  cloudy:  {fogMul:1.55,sunMul:0.62,ambMul:1.25,exp:0.97,cloud:0.6,rain:0},
  overcast:{fogMul:2.30,sunMul:0.32,ambMul:1.45,exp:0.94,cloud:1.0,rain:0},
  rain:    {fogMul:3.10,sunMul:0.22,ambMul:1.35,exp:0.90,cloud:1.0,rain:1},
  fog:     {fogMul:5.20,sunMul:0.45,ambMul:1.30,exp:0.96,cloud:0.4,rain:0}
};
S.WEATHER=Object.keys(WEATHER);
var cur=WEATHER.clear, want=WEATHER.clear, blend=1;

S.setWeather=function(name){
  if(!WEATHER[name]||S.weather===name)return;
  cur=mixW(cur,want,blend);
  want=WEATHER[name];blend=0;S.weather=name;
};
function mixW(a,b,t){
  return {fogMul:M.lerp(a.fogMul,b.fogMul,t),sunMul:M.lerp(a.sunMul,b.sunMul,t),
    ambMul:M.lerp(a.ambMul,b.ambMul,t),exp:M.lerp(a.exp,b.exp,t),
    cloud:M.lerp(a.cloud,b.cloud,t),rain:M.lerp(a.rain,b.rain,t)};
}

S.update=function(dt){
  S.time=(S.time+dt*S.rate*(S.paused?0:1))%24;
  blend=Math.min(1,blend+dt*0.28);
  var w=mixW(cur,want,M.smooth(blend));
  S.wet=M.damp(S.wet,w.rain,0.02,dt);

  var k=sample(S.time);
  var sc=k[0],zen=k[1],hor=k[2],fog=k[3],ambS=k[4],ambG=k[5],exp=k[6],stars=k[7];
  var sd=R.scene;

  /* The sun tracks an arc tilted off true east-west, so shadows sweep
     across the island through the day instead of along one axis. */
  var ang=((S.time-6)/12)*Math.PI;
  var elev=Math.sin(ang);
  var tilt=0.34;
  M.set3(sd.sunDir,Math.cos(ang)*0.86,Math.max(0.06,elev),Math.sin(ang)*tilt+0.22);
  M.norm3(sd.sunDir,sd.sunDir);

  M.set3(sd.sunCol,sc[0]*w.sunMul,sc[1]*w.sunMul,sc[2]*w.sunMul);
  M.set3(sd.zenith,zen[0],zen[1],zen[2]);
  M.set3(sd.horizon,hor[0],hor[1],hor[2]);
  M.set3(sd.ground,hor[0]*0.20,hor[1]*0.20,hor[2]*0.24);
  M.set3(sd.fogCol,fog[0],fog[1],fog[2]);
  M.set3(sd.skyCol,ambS[0]*w.ambMul,ambS[1]*w.ambMul,ambS[2]*w.ambMul);
  M.set3(sd.gndCol,ambG[0]*w.ambMul,ambG[1]*w.ambMul,ambG[2]*w.ambMul);
  sd.fogDensity=0.0012*w.fogMul;
  sd.exposure=exp*w.exp;
  sd.stars=stars;
  /* Night and rain both want more bloom: wet surfaces and lit windows
     are most of what you can see. */
  sd.bloom=0.72+stars*0.55+S.wet*0.35;
  sd.bloomThresh=1.05-stars*0.30;
  /* Lit windows and neon are dialled right down at noon and carry the
     scene at night. Baking one value into the mesh would mean the
     harbour glows through the middle of the day. */
  sd.emisScale=0.26+stars*1.05+w.cloud*0.16;
  /* Street lamps come on as the sun drops, not on a clock edge, and
     overcast brings them on early — which is what makes an overcast
     afternoon in the harbour read as weather rather than a filter. */
  sd.lampLevel=M.clamp((0.26-elev)/0.34,0,1)*(1+w.cloud*0.25);

  /* Wind. A gust term on top of a base breeze, so the canopy is never
     doing exactly the same thing twice, and weather leans on it. */
  var gust=0.72+Math.sin(S.time*2.3)*0.16+Math.sin(S.time*7.1)*0.09;
  var force=gust*(1+w.cloud*0.55+S.wet*0.85);
  M.set3(sd.wind,0.86*force,0.30*force,0.40*force);
  sd.windTime+=dt*(1.35+w.cloud*0.5+S.wet*0.9);
  /* Overcast is not "more clouds on the ground": past a point the sky
     is a single sheet and the shadows it casts stop being separate.
     Cover peaks around broken cloud and falls away again. */
  sd.cloudAmt=M.clamp(0.30+w.cloud*0.55,0,1)*(1-S.wet*0.55)*
    M.clamp(elev*3.2,0,1);
  sd.cloudDrift[0]+=dt*0.0042*(1+w.cloud);
  sd.cloudDrift[1]+=dt*0.0026*(1+w.cloud);
  /* Shafts are a low-sun effect. Driving them off the sun's elevation
     means they arrive at dawn and dusk on their own, and a fixed amount
     does not sit over the middle of the day looking like a lens smear.
     Overcast kills them: there is no beam to break up. */
  var lowSun=1-M.clamp(Math.abs(elev)/0.55,0,1);
  sd.rays=(0.16+lowSun*0.62)*(1-w.cloud*0.85)*(1-stars*0.85);
  sd.rayDecay=0.952+lowSun*0.012;
  S.rain=w.rain;
  S.cloud=w.cloud;
};

/* Is it dark enough that street lamps and windows should be lit? */
S.isNight=function(){return S.time<6.4||S.time>19.4;};

LH.Sky=S;
})();


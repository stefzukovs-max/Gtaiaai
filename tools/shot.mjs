/* A character renderer, not a test: it puts a row of figures on the
   jetty in a fixed pose under a fixed light and takes a picture, so a
   change to a hat or a beard can be looked at rather than guessed at.
   Kept in the repo because every art pass needs it and rewriting it
   from memory each time is how details get lost.

     OUT=/tmp NODE_PATH=$(npm root -g) node tools/shot.mjs wizard \
       '[{"hat":"wizard","facial":"bushy","hair":"long"}]' 1.6 1.45 0

   args: tag, kits JSON, camera distance, look-at height, facing degrees.
   G.entered=true is what makes the camera stay put — without it the
   game's handoff resets Cam.manual and the shot drifts to the plaza. */
import path from 'path';
/* NODE_PATH does not resolve bare specifiers for ES modules, so the
   playwright install is addressed the same way tools/test/lib.mjs does. */
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
import fs from 'fs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const SCR=process.env.OUT||'/tmp';
const tag=process.argv[2]||'a';
const kits=JSON.parse(process.argv[3]);         // [{build,shirt,sleeve,leg,hair,...}]
const rad=+(process.argv[4]||3.4);              // camera distance
const ty =+(process.argv[5]||1.00);             // look-at height above feet
const face=+(process.argv[6]||18);
const GAPV=+(process.env.GAP||0.86);
const body=fs.readFileSync(path.join(ROOT,'game','lumen-harbor.html'),'utf8');
fs.writeFileSync(SCR+'/lhpreview.html','<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}</style></head><body>'+body+'</body></html>');
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1400,height:820}});
p.setDefaultTimeout(200000);
const errs=[];
p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/ERR_CONNECTION/.test(m.text()))errs.push('CONSOLE: '+m.text());});
await p.goto('file://'+SCR+'/lhpreview.html');
await p.waitForFunction(()=>window.LH&&LH.Net&&LH.Game&&LH.Game.player&&LH.Game.crowd.length,null,{timeout:120000});
await p.waitForTimeout(4000);

const apply=(kits)=>{
  const G=LH.Game;
  const cr=G.crowd.slice(0,kits.length);
  for(let i=0;i<cr.length;i++){
    const k=cr[i].kit, q=kits[i];
    k.build=q.build||'base';
    k.skin=q.skin||'#D6A882';
    k.hair.style=q.hair||'crop'; k.hair.color=q.haircol||'#3A2A20';
    k.facial.style=q.facial||'none';
    k.hat.style=q.hat||'none'; k.hat.color=q.hatcol||'#3E4C66';
    k.acc.style=q.acc||'none'; k.acc.color=q.acccol||'#2A3140';
    k.wings.style=q.wings||'none'; k.wings.color=q.wingcol||'#E8ECF2';
    k.cape.style=q.cape||'none'; k.cape.color=q.capecol||'#C4564E';
    k.back.style=q.back||'none'; k.back.color=q.backcol||'#7A5A3C';
    k.pet.style='none'; k.aura.style='none';
    k.tool.style=q.tool||'none'; k.tool.color=q.toolcol||'#C8A47E';
    k.over.style=q.over||'none'; k.over.color=q.overcol||'#4A5364';
    k.shirt.style=q.shirt||'tee'; k.shirt.sleeve=q.sleeve||'long';
    k.shirt.color=q.shirtcol||'#3E6E8E';
    k.pants.leg=q.leg||'long'; k.pants.color=q.pantcol||'#2A3140';
    k.shoes.style=q.shoes||'shoe'; k.shoes.color='#232A33';
    cr[i].scale=1;
  }
  return cr;
};

const info=await p.evaluate(([kits,rad,ty,face,applySrc,GAPV])=>{
  const G=LH.Game,C=LH.Cam;
  LH.Player.update=function(){};
  document.getElementById('front').classList.remove('on');
  document.getElementById('hud').classList.add('hidden');
  LH.Front.skipGuide(); G.entered=true;
  Object.defineProperty(LH.Front,'active',{value:()=>false,configurable:true});
  window.__apply=eval('('+applySrc+')');
  const pad=LH.Terrain.pad('jetty');
  const camA=Math.PI;
  const cr=window.__apply(kits);
  const N=kits.length, gap=GAPV;
  for(let i=0;i<N;i++){
    const a=cr[i], off=(i-(N-1)/2)*gap;
    a.pos[0]=pad.x+Math.cos(camA)*off; a.pos[2]=pad.z-Math.sin(camA)*off;
    a.pos[1]=LH.World.groundAt(a.pos[0],a.pos[2]);
    a.home=[a.pos[0],a.pos[2]]; a.wander=[a.pos[0],a.pos[2]]; a.wait=1e9;
    a.facing=camA+face*Math.PI/180; a.ik=false; a.grounded=true;
    a.anim.play('idle',true); a.lookAt=null; a.blink=0;
  }
  for(let i=N;i<G.crowd.length;i++)G.crowd[i].visible=false;
  if(G.npcs)for(const nn of G.npcs)nn.visible=false;
  G.player.visible=false;
  const y=LH.World.groundAt(pad.x,pad.z);
  C.manual=true;
  C.eye[0]=pad.x+Math.sin(camA)*rad; C.eye[1]=y+ty+0.10; C.eye[2]=pad.z+Math.cos(camA)*rad;
  C.target[0]=pad.x; C.target[1]=y+ty; C.target[2]=pad.z;
  C.dist=rad; C.fov=Math.PI/180*40; LH.Sky.time=11.2;
  return {n:N};
},[kits,rad,ty,face,apply.toString(),GAPV]);

await p.waitForTimeout(7000);
await p.evaluate(([kits,applySrc])=>{window.__apply(kits);},[kits,apply.toString()]);
await p.waitForTimeout(2500);
const stats=await p.evaluate(()=>({tris:Math.round(LH.GL.stats.tris),
  draws:LH.GL.stats.draws,fps:+(LH.App.fps||0).toFixed(1),
  check:LH.Game.crowd.slice(0,3).map(a=>a.kit.build+'/'+a.kit.shirt.style+
    '/'+a.kit.hair.style+'/'+a.kit.shirt.color)}));
await p.screenshot({path:SCR+'/fig-'+tag+'.png',timeout:200000});
console.log(JSON.stringify({...info,...stats}));
console.log(errs.length?errs.slice(0,6).join('\n'):'no errors');
await b.close();

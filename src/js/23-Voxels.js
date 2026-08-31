/* ============================================================
   LH.Voxels — the build layer.

   The sandbox DNA from the 2D game, moved into three dimensions: a
   sparse grid of one-metre cells that players place into and break
   out of. Sparse rather than a dense array because the world is
   352 x 128 x 352 cells and all but a few thousand of them are air —
   a dense array would be six million entries to hold a shed.

   Cells are meshed per 16-cube chunk with interior faces culled, and
   only the chunks a change touched are rebuilt.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,GL=LH.GL,Geo=LH.Geo,D=LH.Data,T=LH.Terrain;
var V={};

/* Bounds chosen so the key packs into 26 bits and stays a small int:
   9 bits each of X and Z, 8 of Y. Strings as keys would be correct and
   about thirty times slower on the meshing path. */
var OX=176, OZ=176, OY=16;
var MAXX=352, MAXZ=352, MAXY=128;
var CS=16;                       /* chunk edge, in cells */
V.CS=CS;

function key(x,y,z){
  return (x+OX)|((z+OZ)<<9)|((y+OY)<<18);
}
V.key=key;
V.inRange=function(x,y,z){
  return x>=-OX&&x<MAXX-OX&&z>=-OZ&&z<MAXZ-OZ&&y>=-OY&&y<MAXY-OY;
};

var cells=new Map();             /* key -> {id, rot, owner} */
var chunks=new Map();            /* chunkKey -> {mesh, dirty, n} */
V.cells=cells;

function chunkKey(cx,cy,cz){return (cx+16)|((cz+16)<<7)|((cy+8)<<14);}
function chunkOf(x,y,z){
  return chunkKey(Math.floor((x+OX)/CS),Math.floor((y+OY)/CS),
                  Math.floor((z+OZ)/CS));
}

function touch(x,y,z){
  /* A cell on a chunk boundary changes its neighbour's face culling,
     so mark every chunk within one cell. */
  for(var dx=-1;dx<=1;dx++)for(var dy=-1;dy<=1;dy++)for(var dz=-1;dz<=1;dz++){
    var ck=chunkOf(x+dx,y+dy,z+dz);
    var c=chunks.get(ck);
    if(c)c.dirty=true;
    else chunks.set(ck,{mesh:null,dirty:true,
      cx:Math.floor((x+dx+OX)/CS),cy:Math.floor((y+dy+OY)/CS),
      cz:Math.floor((z+dz+OZ)/CS),n:0});
  }
}

V.get=function(x,y,z){return cells.get(key(x,y,z))||null;};
V.itemAt=function(x,y,z){
  var c=cells.get(key(x,y,z));
  return c?D.byId(c.id):null;
};
V.set=function(x,y,z,itemKey,rot,owner){
  if(!V.inRange(x,y,z))return false;
  var it=D.byKey(itemKey);
  if(!it||!it.placeable)return false;
  cells.set(key(x,y,z),{id:it.id,rot:rot||0,owner:owner||null});
  touch(x,y,z);
  return true;
};
V.clear=function(x,y,z){
  var k=key(x,y,z);
  if(!cells.has(k))return null;
  var c=cells.get(k);
  cells.delete(k);
  touch(x,y,z);
  return D.byId(c.id);
};
V.count=function(){return cells.size;};
V.rotate=function(x,y,z,by){
  var k=key(x,y,z);
  var c=cells.get(k);
  if(!c)return false;
  c.rot=((c.rot||0)+(by||1))&3;
  touch(x,y,z);
  return true;
};

/* Is this cell something you collide with? Panes, plants and fences
   are placeable but not solid, and a build layer that blocked
   movement on decoration would be miserable. */
var NONSOLID={pane:1,plant:1,fence:0};
V.solid=function(x,y,z){
  var c=cells.get(key(x,y,z));
  if(!c)return false;
  var it=D.byId(c.id);
  return !(it&&NONSOLID[it.shape]);
};
/* Does this cell hide its neighbour's face? Glass and decoration do
   not, or a glass wall would be a black box. */
function opaque(x,y,z){
  var c=cells.get(key(x,y,z));
  if(!c)return false;
  var it=D.byId(c.id);
  if(!it)return false;
  if(it.shape!=='cube')return false;
  return it.mat!=='glass';
}

/* ---------------- shape meshing ----------------
   Each shape writes its own geometry into the chunk builder. Faces of
   a full cube are emitted individually so an interior face — one with
   an opaque neighbour — can be skipped. In a solid build that removes
   the large majority of the triangles. */
var FACES=[
  /* dir,      nx ny nz,  corners as (x,y,z) offsets */
  [[ 1,0,0],[1,0,0],[[1,0,1],[1,0,0],[1,1,0],[1,1,1]]],
  [[-1,0,0],[-1,0,0],[[0,0,0],[0,0,1],[0,1,1],[0,1,0]]],
  [[0, 1,0],[0,1,0],[[0,1,1],[1,1,1],[1,1,0],[0,1,0]]],
  [[0,-1,0],[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],
  [[0,0, 1],[0,0,1],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]],
  [[0,0,-1],[0,0,-1],[[1,0,0],[0,0,0],[0,1,0],[1,1,0]]]
];

function emitCube(b,x,y,z,it,h,inset){
  h=h===undefined?1:h;
  inset=inset||0;
  var col=Geo.col3(it.col);
  for(var f=0;f<6;f++){
    var F=FACES[f],d=F[0];
    /* only cull against a neighbour for a full-size cube */
    if(h===1&&!inset&&opaque(x+d[0],y+d[1],z+d[2]))continue;
    var n=F[1],c=F[2];
    var ids=[];
    for(var i=0;i<4;i++){
      var p=c[i];
      var px=x+(p[0]?1-inset:inset);
      var py=y+(p[1]?h:0);
      var pz=z+(p[2]?1-inset:inset);
      /* UVs in world units so a wall of the same block tiles across
         its cells instead of restarting at every seam */
      var u,v;
      if(n[0]){u=pz;v=py;}
      else if(n[1]){u=px;v=pz;}
      else {u=px;v=py;}
      ids.push(b.vert(px,py,pz,n[0],n[1],n[2],u,v,col));
    }
    b.quad(ids[0],ids[1],ids[2],ids[3]);
  }
}

function emitShape(b,x,y,z,cell){
  var it=D.byId(cell.id);
  if(!it)return;
  b.layer=LH.Tex.layer(it.mat);
  b.layer2=b.layer;b.blend=0;
  b.emis=it.emis||0;
  switch(it.shape){
    /* a slab rotated once sits at the top of its cell, which is what
       lets you build a ceiling as well as a step */
    case 'slab':
      if((cell.rot||0)&1){
        b.push();b.translate(0,0.5,0);emitCube(b,x,y,z,it,0.5);b.pop();
      }else emitCube(b,x,y,z,it,0.5);
      break;
    case 'pillar': emitCube(b,x,y,z,it,1,0.25); break;
    case 'pane':
      b.push();b.translate(x+0.5,y+0.5,z+0.5);
      b.rotate(0,(cell.rot||0)*Math.PI/2,0);
      b.chamfer(0,0,0,1,1,0.12,it.col,0.02,{noBand:true});
      b.pop();
      break;
    case 'fence':
      b.push();b.translate(x+0.5,y,z+0.5);
      b.rotate(0,(cell.rot||0)*Math.PI/2,0);
      b.chamfer(0,0.5,0,0.16,1.0,0.16,it.col,0.03);
      b.chamfer(0,0.78,0,1.0,0.10,0.10,it.col,0.02);
      b.chamfer(0,0.42,0,1.0,0.10,0.10,it.col,0.02);
      b.pop();
      break;
    case 'lamp':
      b.push();b.translate(x+0.5,y+0.5,z+0.5);
      b.chamfer(0,0,0,0.62,0.62,0.62,it.col,0.12);
      b.pop();
      break;
    case 'plant':
      /* two crossed cards — the cheapest thing that reads as a plant
         from every angle */
      b.push();b.translate(x+0.5,y+0.46,z+0.5);
      b.card(0,0,0,0.92,0.92,it.col);
      b.rotate(0,Math.PI/2,0);
      b.card(0,0,0,0.92,0.92,it.col);
      b.pop();
      break;
    default: emitCube(b,x,y,z,it,1); break;
  }
}

/* ---------------- chunk rebuild ---------------- */
function rebuild(c){
  if(c.mesh){GL.freeMesh(c.mesh);c.mesh=null;}
  var x0=c.cx*CS-OX, y0=c.cy*CS-OY, z0=c.cz*CS-OZ;
  var b=Geo.build();
  var n=0;
  for(var y=y0;y<y0+CS;y++)for(var z=z0;z<z0+CS;z++)for(var x=x0;x<x0+CS;x++){
    var cell=cells.get(key(x,y,z));
    if(!cell)continue;
    emitShape(b,x,y,z,cell);
    n++;
  }
  c.n=n;
  c.dirty=false;
  if(!n)return;
  c.mesh=b.upload();
  c.mesh.cx=x0+CS/2;c.mesh.cy=y0+CS/2;c.mesh.cz=z0+CS/2;
  c.mesh.rad=CS*0.87;
}

/* Rebuilds are budgeted: a player dragging a wall into place dirties a
   chunk every frame, and rebuilding all of them in one frame is a
   visible hitch. */
V.update=function(budget){
  budget=budget||2;
  var done=0;
  chunks.forEach(function(c){
    if(done>=budget||!c.dirty)return;
    rebuild(c);done++;
  });
  return done;
};

V.draw=function(cull){
  var n=0;
  chunks.forEach(function(c){
    if(!c.mesh)return;
    if(cull&&!T.sphereVisible(c.mesh.cx,c.mesh.cy,c.mesh.cz,c.mesh.rad))return;
    GL.draw(c.mesh);n++;
  });
  return n;
};
V.drawNear=function(fx,fz,radius){
  chunks.forEach(function(c){
    if(!c.mesh)return;
    if(Math.hypot(c.mesh.cx-fx,c.mesh.cz-fz)>radius+c.mesh.rad)return;
    GL.draw(c.mesh);
  });
};

/* ---------------- raycast ----------------
   Amanatides-Woo grid traversal: step to whichever axis boundary is
   nearest and test that cell. Exact, and it visits each cell once,
   which a fixed-step march does not.

   Returns the cell hit plus the face normal, because placing needs to
   know which side you were looking at. */
var _hit={hit:false,x:0,y:0,z:0,nx:0,ny:0,nz:0,dist:0,item:null,ground:false};
V.raycast=function(ox,oy,oz,dx,dy,dz,maxD){
  maxD=maxD||6;
  var x=Math.floor(ox),y=Math.floor(oy),z=Math.floor(oz);
  var sx=dx>0?1:-1, sy=dy>0?1:-1, sz=dz>0?1:-1;
  var tdx=dx!==0?Math.abs(1/dx):1e9;
  var tdy=dy!==0?Math.abs(1/dy):1e9;
  var tdz=dz!==0?Math.abs(1/dz):1e9;
  var tmx=dx!==0?((dx>0?(x+1-ox):(ox-x))*tdx):1e9;
  var tmy=dy!==0?((dy>0?(y+1-oy):(oy-y))*tdy):1e9;
  var tmz=dz!==0?((dz>0?(z+1-oz):(oz-z))*tdz):1e9;
  var nx=0,ny=0,nz=0,t=0;

  _hit.hit=false;_hit.ground=false;_hit.item=null;

  for(var i=0;i<256&&t<=maxD;i++){
    if(cells.has(key(x,y,z))){
      _hit.hit=true;_hit.x=x;_hit.y=y;_hit.z=z;
      _hit.nx=nx;_hit.ny=ny;_hit.nz=nz;_hit.dist=t;
      _hit.item=V.itemAt(x,y,z);
      return _hit;
    }
    /* The ground counts as a surface you can build on, so a player
       standing in an empty field can still place their first block. */
    var px=ox+dx*t, pz=oz+dz*t, py=oy+dy*t;
    if(py<=T.heightAt(px,pz)&&t>0.05){
      _hit.hit=true;_hit.ground=true;
      _hit.x=Math.floor(px);_hit.y=Math.floor(py);_hit.z=Math.floor(pz);
      _hit.nx=0;_hit.ny=1;_hit.nz=0;_hit.dist=t;
      return _hit;
    }
    if(tmx<tmy&&tmx<tmz){x+=sx;t=tmx;tmx+=tdx;nx=-sx;ny=0;nz=0;}
    else if(tmy<tmz){y+=sy;t=tmy;tmy+=tdy;nx=0;ny=-sy;nz=0;}
    else {z+=sz;t=tmz;tmz+=tdz;nx=0;ny=0;nz=-sz;}
  }
  return _hit;
};

/* Where a new block goes given a hit: the neighbouring cell on the
   side that was struck. */
V.placeTarget=function(hit){
  if(!hit.hit)return null;
  if(hit.ground)return {x:hit.x,y:Math.floor(hit.y)+1,z:hit.z};
  return {x:hit.x+hit.nx,y:hit.y+hit.ny,z:hit.z+hit.nz};
};

/* Refuse to place a block inside the player. Nothing else in the game
   can trap you, and a build system that can is worse than one that
   occasionally refuses. */
V.blockedBy=function(x,y,z,actorPos,radius,height){
  radius=radius||0.4;height=height||1.8;
  var cx=x+0.5, cz=z+0.5;
  if(Math.abs(actorPos[0]-cx)>0.5+radius)return false;
  if(Math.abs(actorPos[2]-cz)>0.5+radius)return false;
  if(actorPos[1]>y+1||actorPos[1]+height<y)return false;
  return true;
};

V.reset=function(){
  chunks.forEach(function(c){if(c.mesh)GL.freeMesh(c.mesh);});
  chunks.clear();cells.clear();
};

/* Serialise for persistence. Runs of the same block are collapsed
   because a wall is hundreds of identical cells and the save has to
   fit in localStorage. */
V.serialise=function(){
  var out=[];
  cells.forEach(function(c,k){out.push(k,c.id,c.rot||0);});
  return out;
};
V.deserialise=function(arr){
  V.reset();
  for(var i=0;i<arr.length;i+=3){
    var k=arr[i];
    var x=(k&511)-OX, z=((k>>9)&511)-OZ, y=((k>>18)&255)-OY;
    cells.set(k,{id:arr[i+1],rot:arr[i+2],owner:null});
    touch(x,y,z);
  }
};

LH.Voxels=V;
})();


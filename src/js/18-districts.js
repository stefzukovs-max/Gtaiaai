/* ============================================================
   The districts, as places rather than as pads.

   The terrain module knows nine circles on a heightmap. This is what
   they are for: what you do there, who is standing in it, and why you
   would walk across the island to reach it. A world where every area
   has a name and a reason is the difference between a map and a park,
   and it is most of what Club Penguin got right — every room did
   something, and you could tell which from the doorway.

   `state` is honest. Two of these are not finished, and the map says
   so rather than sending someone up a hill to find an empty ring of
   concrete and conclude the game is broken.
   ============================================================ */
W.DISTRICTS={
  plaza:{name:'Lumen Plaza',icon:'\u26F2',order:1,state:'open',
    blurb:'Everyone arrives here. The fountain, the notice board, and '+
          'the road out to everywhere else.',
    doing:'Start here'},
  harbour:{name:'The Harbour',icon:'\u2693',order:2,state:'open',
    who:'Mira Vance, Harbourmaster',
    blurb:'Boats, crates and cold water. Deep enough off the boards '+
          'for the things worth catching.',
    doing:'Fishing, and the first quest'},
  jetty:{name:'Long Jetty',icon:'\uD83C\uDFA3',order:3,state:'open',
    blurb:'The far end of the boards. Nothing out here but the sea and '+
          'whatever is under it.',
    doing:'The best water on the island'},
  market:{name:'Market Row',icon:'\uD83E\uDE99',order:4,state:'open',
    who:'Bao Ling, Market Trader',
    blurb:'Bao buys what you dig, catch or break, and sells what you '+
          'have not found yet.',
    doing:'Buy, sell, trade'},
  plots:{name:'The Plots',icon:'\uD83C\uDFE1',order:5,state:'open',
    who:'Rosalind Ash, Land Registry',
    blurb:'Every plot on the island is on Rosalind\u2019s ledger. The '+
          'first one is free.',
    doing:'Claim land and build'},
  quarry:{name:'Stonecut Quarry',icon:'\u26CF\uFE0F',order:6,state:'open',
    who:'Dell Okonjo, Foreman',
    blurb:'Copper near the surface, iron under that. Deeper is better '+
          'and worse.',
    doing:'Mining, and a guardian'},
  missions:{name:'Warden\u2019s Post',icon:'\uD83D\uDEE1\uFE0F',order:7,state:'open',
    who:'Ivo Karr, Warden',
    blurb:'Something walked out of the old works and has not walked '+
          'back. Ivo is the one counting.',
    doing:'Missions and the road to the fighting'},
  garage:{name:'Aurelio Garage',icon:'\uD83D\uDD27',order:8,state:'soon',
    who:'Tess Aurelio, Mechanic',
    blurb:'Tess is building the first one. There is a workshop, a lot '+
          'of parts, and nothing that runs yet.',
    doing:'Nothing to drive \u2014 yet'},
  arena:{name:'The Arena',icon:'\u2694\uFE0F',order:9,state:'soon',
    blurb:'A concrete ring on the high ground, poured and empty. '+
          'Nothing organised happens here.',
    doing:'Built, not opened'}
};
W.districtList=function(){
  var out=[];
  for(var k in W.DISTRICTS)out.push(k);
  out.sort(function(a,b){return W.DISTRICTS[a].order-W.DISTRICTS[b].order;});
  return out;
};
/* Which district a point is in, or null for the wilderness between. */
W.districtAt=function(x,z){
  var T2=LH.Terrain,best=null,bd=1e9;
  for(var i=0;i<T2.PADS.length;i++){
    var P=T2.PADS[i];
    var d=Math.hypot(x-P[1],z-P[2]);
    if(d<P[3]&&d<bd){bd=d;best=P[0];}
  }
  return best;
};

/* ---------------- the map ----------------
   Drawn from the heightmap itself rather than authored, so it cannot
   drift out of step with the island — every cove and every quarry
   terrace on it is really there. Built once and cached: it is a
   hundred thousand array reads and a hillshade, which is nothing once
   and would be silly every time the panel opens. */
var mapCv=null;
var MAPCOL={
  grass:[104,152,74],dirt:[122,88,54],sand:[224,200,140],
  stone:[142,142,149],cliff:[119,112,108],gravel:[154,150,142],
  snow:[234,240,245],planks:[165,121,78],deck:[152,112,72],
  bark:[104,78,52],brick:[162,112,92],brickpale:[178,150,124],
  panel:[110,118,132],panelw:[142,150,162],concrete:[168,169,166],
  tile:[154,166,180],tilepale:[178,186,196],tiledark:[92,102,116],
  roof:[142,84,78],road:[110,106,102],foliage:[78,140,62],
  foliagep:[186,116,158]
};
W.mapImage=function(){
  if(mapCv)return mapCv;
  var T2=LH.Terrain;
  if(!T2.heights||!T2.mats)return null;
  var N=T2.N, W2=384;
  var step=N/W2;
  var cv=document.createElement('canvas');
  cv.width=W2;cv.height=W2;
  var ctx=cv.getContext('2d');
  var img=ctx.createImageData(W2,W2),d=img.data;
  /* index the material palette once */
  var pal=[],names=LH.Tex.NAME;
  for(var nm in names)pal[names[nm]]=MAPCOL[nm]||[130,130,130];
  for(var py=0;py<W2;py++){
    for(var px=0;px<W2;px++){
      var i=Math.min(N-1,Math.round(px*step));
      var j=Math.min(N-1,Math.round(py*step));
      var h=T2.heights[j*N+i];
      var o=(py*W2+px)*4;
      if(h<=T2.SEA+0.05){
        /* Depth, not one flat blue. A map whose water is a single
           colour loses every sandbar and every deep channel, which is
           most of what a harbour map is for. */
        var dep=M.clamp((T2.SEA-h)/9,0,1);
        d[o]=Math.round(M.lerp(96,22,dep));
        d[o+1]=Math.round(M.lerp(168,64,dep));
        d[o+2]=Math.round(M.lerp(196,116,dep));
        d[o+3]=255;
        continue;
      }
      var c=pal[T2.mats[j*N+i]]||[130,130,130];
      /* Hillshade from the height gradient, lit from the north-west
         the way every printed map since about 1800 has been. */
      var i1=Math.min(N-1,i+2), j1=Math.min(N-1,j+2);
      var gx=T2.heights[j*N+i1]-h, gz=T2.heights[j1*N+i]-h;
      var sh=M.clamp(0.72+(-gx*0.9-gz*0.9)*0.22,0.42,1.35);
      d[o]=M.clamp(c[0]*sh,0,255)|0;
      d[o+1]=M.clamp(c[1]*sh,0,255)|0;
      d[o+2]=M.clamp(c[2]*sh,0,255)|0;
      d[o+3]=255;
    }
  }
  ctx.putImageData(img,0,0);
  mapCv=cv;
  return cv;
};
/* World XZ to a 0..1 position on that image. */
W.mapUV=function(x,z){
  var H=LH.Terrain.HALF;
  return [M.clamp((x+H)/(H*2),0,1),M.clamp((z+H)/(H*2),0,1)];
};
W.mapReset=function(){mapCv=null;};

/* `near` draws only the prefix of the instance buffer that W.cullProps
   packed closest to the camera. The shadow cascades want it: a tree
   eighty metres away cannot cast into a box thirteen metres across, and
   drawing it there was most of the frame. */
W.drawProps=function(prog,near){
  GL.u1i(prog,'uInstanced',1);
  for(var i=0;i<W.instanced.length;i++){
    var m=W.instanced[i];
    var n=near?(m.nearInstances||0):m.instances;
    if(n)GL.drawInstanced(m,n);
  }
  GL.u1i(prog,'uInstanced',0);
};

LH.World=W;
})();


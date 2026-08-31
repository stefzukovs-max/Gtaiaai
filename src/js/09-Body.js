/* ============================================================
   LH.Body — the character's meshes.

   One mesh per bone-part, built once and drawn instanced, so a plaza
   with forty people costs the same number of draw calls as one
   person. Colour comes from the per-instance tint, which is why the
   geometry is painted in greys: white takes the tint at full
   strength, darker vertices read as the part's own shading and
   survive any colour the player picks.

   Cosmetics are parts too. A cape is not a special case in the
   renderer — it is a mesh bound to the chest bone.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,Geo=LH.Geo,Body={};
var P=LH.Rig.P;          /* the proportions table — see LH.Rig */
var FAT=P.limbFat;

var cache={};
/* Parts are built on demand: a session that never equips wings never
   pays to generate them. */
function part(key,fn,maxInst){
  var hit=cache[key];
  if(hit)return hit;
  var b=Geo.build();
  fn(b);
  var mesh=b.upload(maxInst||64);
  mesh.key=key;
  cache[key]=mesh;
  return mesh;
}
Body.part=part;
Body.cache=cache;

/* Shading constants. Everything is a multiplier on the instance tint. */
var LIT='#FFFFFF', MID='#D2D2D2', LOW='#A8A8A8', DARK='#7C7C7C', DEEP='#585858';

/* ---------------- head ----------------
   Fourteen cross-sections from under the chin to the crown, then the
   features sculpted on top of them. A head is not a sphere with a face
   applied: the skull is widest at the parietals and narrows at the
   temples, the occiput projects further back than the forehead does
   forward, and the whole face plane sits ahead of the cranium. Those
   three facts are most of what makes a profile read as a person.

   The landmark heights are the ones the rest of the file measures
   against — chin -0.118, jaw -0.078, cheek -0.036, eyeline 0.005,
   brow 0.048, crown 0.158 — and they are held fixed on purpose, so the
   eleven hairstyles, ten hats and five face accessories that were
   authored against the old skull still land on this one.

   All of it is in the head's own space and scaled by P.headScale at
   the end. Real dimensions, for anything measured here: the head is
   0.237 tall, 0.150 across and 0.186 front to back. */
function headSect(hw,hf,hb,n,ex){
  return sect(hw,hf,hb,n,ex);
}
/* Push the surface in — or out, with a negative amount — around a
   direction. An eye socket is a dent; a brow ridge and a cheekbone are
   the same operation with the sign flipped, which is a great deal less
   work than modelling either of them. */
function dent(pts,dx,dz,amt,width){
  var l0=Math.hypot(dx,dz)||1;dx/=l0;dz/=l0;
  for(var i=0;i<pts.length;i++){
    var x=pts[i][0],z=pts[i][1],l=Math.hypot(x,z)||1;
    var d=(x/l)*dx+(z/l)*dz;
    var w=(d-(1-width))/width;
    if(w<=0)continue;
    if(w>1)w=1;
    var kf=1-amt*w*w*(3-2*w);
    pts[i][0]*=kf;pts[i][1]*=kf;
  }
  return pts;
}

/* Warm and cool shifts on the skin tint, for the sculpted features the
   face map cannot reach. Multiplied by the character's own skin colour,
   so #F6C9B8 means "this part is redder than the rest of the face"
   rather than any particular pink. */
/* Flattened for the toy style: a face whose lips are a different
   colour from its cheeks is a portrait, and this one is a moulded
   shape with a mouth on it. The values still step — a mouth has to
   be darker than a chin or it is not there — but they step by a
   twentieth rather than by a third. */
var WARM='#FFF8F4', BLUSH='#FAE6DE', LIPU='#F0D2C8', LIPL='#F4DAD1',
    LIPLINE='#B08278', NOSTRIL='#A07C70', EARC='#F8E0D6',
    LIDU='#F2DED6', LIDL='#F7E6DD', FOLD='#DFC0B4', TEAR='#F0B3A4';

Body.head=function(){
  return part('head',function(b){
    b.mat('face');
    b.push();b.scale(P.headScale,P.headScale,P.headScale);
    /* Twenty-two segments was a fine number for a head 0.20 metres
       across. At 0.44 the flats between them are visible from three
       metres, which is the distance the camera actually sits at. */
    var n=32;
    function R(y,hw,hf,hb,ex,col){
      return {y:y,pts:headSect(hw,hf,hb,n,ex),col:col||null};
    }
    var secs=[
      /* A chin, and a jaw that tapers to it. The old profile ran
         nearly straight from the cheekbone to a small rounded point,
         which on a head this wide is a face with no lower half — the
         "blank oval" read. Narrower at the jaw, fuller at the chin,
         and the cheek pulled in a little so the two of them describe a
         shape rather than a circle. */
      R(-0.120,0.040,0.062,0.042,2.5,MID),   /* chin point            */
      R(-0.102,0.052,0.074,0.058,2.5),
      R(-0.080,0.062,0.080,0.070,2.6),       /* jaw                   */
      R(-0.056,0.071,0.089,0.080,2.5),       /* mouth line            */
      R(-0.036,0.079,0.094,0.090,2.4),       /* cheek / zygomatic     */
      R(-0.014,0.085,0.098,0.098,2.4),
      R( 0.005,0.087,0.099,0.101,2.3),       /* eyeline               */
      R( 0.030,0.088,0.100,0.104,2.3),
      R( 0.048,0.089,0.103,0.106,2.3),       /* brow ridge            */
      R( 0.072,0.088,0.099,0.108,2.2),       /* forehead              */
      R( 0.100,0.085,0.090,0.108,2.2),
      R( 0.126,0.081,0.079,0.100,2.2),
      R( 0.147,0.066,0.063,0.078,2.1),
      R( 0.158,0.040,0.038,0.046,2.0)        /* crown                 */
    ];
    /* Sockets, temples and cheekbones, applied to the rings that carry
       them. The eye direction is 34 degrees off centre, which is where
       an eye actually sits on a head this wide. */
    var ex=Math.sin(0.60),ez=Math.cos(0.60);
    dent(secs[5].pts, ex,ez,0.044,0.44);dent(secs[5].pts,-ex,ez,0.044,0.44);
    dent(secs[6].pts, ex,ez,0.078,0.46);dent(secs[6].pts,-ex,ez,0.078,0.46);
    dent(secs[7].pts, ex,ez,0.038,0.44);dent(secs[7].pts,-ex,ez,0.038,0.44);
    /* temples, pulled in just above the eyeline */
    dent(secs[8].pts, 1,0.10,0.045,0.30);dent(secs[8].pts,-1,0.10,0.045,0.30);
    dent(secs[9].pts, 1,0.05,0.038,0.30);dent(secs[9].pts,-1,0.05,0.038,0.30);
    /* cheekbones out, jaw angle out — negative dents */
    dent(secs[4].pts, 0.92,0.39,-0.045,0.36);dent(secs[4].pts,-0.92,0.39,-0.045,0.36);
    dent(secs[2].pts, 0.90,0.20,-0.030,0.34);dent(secs[2].pts,-0.90,0.20,-0.030,0.34);
    /* brow ridge forward, and the glabella between the brows */
    dent(secs[8].pts, ex,ez,-0.050,0.40);dent(secs[8].pts,-ex,ez,-0.050,0.40);
    /* The face map is one image from chin to crown, so the loft has to
       stretch it over that range rather than tile it. */
    b.loft(secs,LIT,{openBottom:false,uvV:[-0.118,0.158]});
    b.mat('skin');

    /* ---- the face, as a face and not as a collection ----
       What was here was a real one: a nose with alae and nostrils and
       a septum, lips as two spheres with a vermilion border and corner
       beads, a philtrum as two ridges, eyelids as four spheres each
       with a fold and a caruncle, and an ear built from eight beads
       around a hollow. All of it correct, and all of it wrong the
       moment the head doubled in size and the lighting went flat: two
       dozen small spheres stuck on a smooth skull read as lumps, and a
       face made of lumps is a grimace whatever the lumps are of.

       So the features are three now, and each is one continuous thing.
       A nose that is a soft ridge rather than an assembly. A mouth
       that is a single swept curve. An ear that is one shape with one
       hollow in it. Everything else that used to be modelled — the
       philtrum, the vermilion border, the lid fold, the nostrils — is
       either in the face map or gone, because at the size a player
       actually sees this head none of them survived as anything but
       noise. */

    /* A curve of overlapping beads, close enough together to read as
       one swept form rather than as beads. This is how the mouth and
       the brow ridge are drawn: a chamfer gives a straight slot and a
       single sphere gives a blob, and a face needs a line that bends. */
    function sweep(x0,y0,z0,halfW,rise,r,col,n,squash){
      n=n||11;
      for(var i=0;i<n;i++){
        var t=(i/(n-1))*2-1;               /* -1..1 across the curve   */
        var y=y0+rise*(1-t*t);
        var rr=r*(0.62+0.38*(1-t*t));      /* thinner at the corners   */
        b.sphere(x0+t*halfW,y,z0-Math.abs(t)*halfW*0.34,rr,7,6,col,
                 {squash:squash===undefined?0.72:squash});
      }
    }

    /* ---- nose ----
       One ridge from the brow to the tip, and nothing else. It stands
       four millimetres proud of the face plane at 0.089 — enough to
       catch a highlight down the dorsum and to cast nothing. */
    b.push();
    b.loft([
      {y:-0.034,pts:headSect(0.021,0.0935,0.020,14,2.5),col:MID},
      {y:-0.024,pts:headSect(0.020,0.0955,0.020,14,2.5)},
      {y:-0.008,pts:headSect(0.018,0.0950,0.020,14,2.4)},
      {y: 0.012,pts:headSect(0.0155,0.0935,0.020,14,2.3)},
      {y: 0.034,pts:headSect(0.0135,0.0918,0.020,14,2.2)},
      {y: 0.052,pts:headSect(0.0130,0.0905,0.020,14,2.2),col:MID}
    ],WARM,{openTop:true,openBottom:true});
    b.pop();
    /* the underside of it, so the tip has a shape from below rather
       than ending in a point */
    b.push();b.translate(0,-0.036,0.086);
    b.scale(1.30,0.60,0.70);
    b.sphere(0,0,0,0.0125,10,8,BLUSH);b.pop();

    /* ---- mouth ----
       A closed, faintly upturned line. `rise` positive bends the ends
       down and the middle up, which is a mouth at rest on a friendly
       face; the face map paints the same curve underneath it so the
       two reinforce rather than fight. A mouth built from two spheres
       and a slot read as a wound at this scale. */
    /* One shallow crease, and the rest is paint. The swell that used
       to sit under it read as a duck bill on a face this flat. */
    sweep(0,-0.0588,0.0888,0.0216,0.0036,0.0034,LIPLINE,13,0.58);

    /* ---- eyelids ----
       Painted, not modelled. The crease above the eye and the shadow
       under it are two marks in the face map now; the only lid left as
       geometry is the one in Body.lids, which exists because it has to
       move when the character blinks. Four spheres per eye to describe
       the age of an eye, on a head where the eye is a flat disc, was
       four spheres of lumps. */

    /* ---- ears ----
       One shape with one hollow. The helix was eight beads around a
       rim, which at this scale is a cog. */
    for(var s2=-1;s2<=1;s2+=2){
      b.push();b.translate(s2*0.0745,-0.008,-0.026);
      b.rotate(0,s2*0.30,s2*0.12);
      b.scale(0.34,1.0,1.0);
      b.sphere(0,0,0,0.0288,14,11,EARC,{squash:1.26});
      /* the bowl, pressed in from the outside */
      b.push();b.translate(0.022,0.000,0.004);
      b.scale(0.55,0.72,0.70);
      b.sphere(0,0,0,0.0222,12,9,FOLD,{squash:1.14});b.pop();
      b.pop();
    }
    b.pop();
  });
};

/* ---------------- eyes ----------------
   A human eyeball is 24 mm across and the pupils sit 63 mm apart. At
   this head's scale that is a radius of 0.0145 and a separation of
   0.037 either side of centre — an order smaller than the cartoon eyes
   they replace, and the single biggest reason the old head read as a
   doll. The socket is already a dent in the skull, so the eye only
   has to fill it. */
/* The eye, and the single biggest reason this character read as a
   mannequin.

   A real eyeball is 24 mm across on a 150 mm head — a tenth of the
   face — and that is what was here, faithfully. It is also completely
   wrong for the genre. Every character in a stylised RPG that anyone
   describes as *appealing* has eyes at a fifth of the face width or
   more, because the eyes are where a face is read from, and a tenth
   of a face gives you two dark specks on a blank oval. Two dark
   specks on a blank oval is the look people mean when they say a
   character looks like an untextured primitive.

   So this is a designed eye rather than a measured one: half again as
   large, set a little wider and a little higher, and with every part
   of it — socket, sclera, lids, iris, catchlight — derived from EYE_R
   so the whole assembly stays in proportion if it is ever retuned
   again. */
/* EYE_Z is where the lens plane sits, and it is no longer where the
   centre of a ball would go. The face plane at the eyeline is at
   0.099, the socket dent takes it to about 0.091, and a lens is four
   millimetres thick — so the plane goes at 0.089 and the eye lies in
   the socket with its front a hair proud of the skin. Set at the old
   ball's centre it was thirteen millimetres inside the head, which is
   exactly where it went the first time. */
var EYE_X=0.0378, EYE_Y=0.0128, EYE_Z=0.0888, EYE_R=0.0230, EYE_TILT=-0.20;
/* The iris, as a fraction of the eyeball. Left at one: enlarging it
   sounded like the toy thing to do and turned out to read as a pair
   of goggles, because the ring around it grows with it. */
var IRISK=1.46;

Body.eyes=function(){
  return part('eyes',function(b){
    b.mat('blank');
    b.push();b.scale(P.headScale,P.headScale,P.headScale);
    for(var s=-1;s<=1;s+=2){
      /* A lens, not a ball.

         This is the third build of this eye and the first one that is
         the right *kind* of object. A sphere is what an eye is, and on
         a head with a real brow and a real socket to sink it into,
         modelling one works. This head is a stylised near-flat plane:
         a sphere set into it either disappears or — set far enough
         forward to read — sits on the face like a bead glued on, which
         is precisely the look people mean when they say a character
         looks unfinished. Every stylised game with an appealing face
         solves it the same way: the eye is a flat disc lying in the
         face plane, and the roundness is painted rather than modelled.

         So each eye is four coplanar discs — a dark rim, the sclera,
         the iris, the pupil — squashed almost flat and set into the
         socket dent, plus two catchlights. Nothing protrudes, and the
         silhouette of the head stays the silhouette of the head. */
      b.push();b.translate(s*EYE_X,EYE_Y,EYE_Z);b.rotate(0,s*EYE_TILT,0);
      /* the rim, a shade wider than the white, which is what gives the
         opening an edge without a modelled eyelid */
      b.scale(1.0,0.70,0.16);
      b.sphere(0,0,0,EYE_R*1.10,20,8,'#2A2028');
      b.pop();
      b.push();b.translate(s*EYE_X,EYE_Y,EYE_Z+EYE_R*0.030);
      b.rotate(0,s*EYE_TILT,0);
      b.scale(1.0,0.66,0.15);
      b.sphere(0,0,0,EYE_R,20,8,'#F4F0EA');
      b.pop();
      /* Catchlights. Up and out from a sky, and a small one opposite.
         They live here rather than with the iris because this part is
         tinted white and the iris part is tinted with the player's eye
         colour, and a highlight is white whatever the eye is. */
      b.push();b.translate(s*EYE_X,EYE_Y,EYE_Z);b.rotate(0,s*EYE_TILT,0);
      b.sphere(-EYE_R*0.30,EYE_R*0.28,EYE_R*0.36,EYE_R*0.145,10,8,'#FFFFFF',
               {squash:0.62});
      b.sphere( EYE_R*0.26,-EYE_R*0.30,EYE_R*0.36,EYE_R*0.075,7,6,'#DCE8F6',
               {squash:0.62});
      b.pop();
    }
    b.pop();
  });
};
/* The iris carries the player's eye colour. Three coplanar discs on
   top of the white: a dark limbal ring, the body, and a pupil. It is
   a separate part from the white because it is tinted, and separate
   from the head because it moves — this is what darts when a character
   looks at something. */
Body.iris=function(){
  return part('iris',function(b){
    b.mat('blank');
    b.push();b.scale(P.headScale,P.headScale,P.headScale);
    for(var s=-1;s<=1;s+=2){
      /* Each disc gets its own transform.

         The first build nested four spheres inside one `scale(1,1,0.13)`
         that flattened them into discs — and flattened their z offsets
         with them, by the same factor. The limbal ring is the widest
         disc, so once its half-thickness was 0.13 of its radius and the
         gaps between the discs were 0.13 of a tenth of a millimetre,
         the ring came out in front of everything inside it and every
         character in the game had solid black eyes. The stacking has
         to happen outside the flattening. */
      function disc(dz,r,squash,col,seg){
        b.push();
        b.translate(s*EYE_X,EYE_Y-EYE_R*0.05,EYE_Z+EYE_R*(0.20+dz));
        b.rotate(0,s*EYE_TILT,0);
        b.scale(1.0,1.0,squash);
        b.sphere(0,0,0,r,seg||20,8,col);
        b.pop();
      }
      /* Widest and furthest back, so it reads as a ring round the
         colour rather than as a lid over it. */
      disc(0.000,EYE_R*0.62,0.13,'#191A22');
      /* The colour the player picked. This is the disc that has to be
         seen, so it is the largest thing that is not the ring. */
      disc(0.045,EYE_R*0.52,0.11,'#FFFFFF');
      /* A brighter crescent low in the iris, where light that entered
         the top of it comes back out. Offset downward, not concentric:
         a bright disc centred on the pupil is a bullseye, and three
         concentric rings is a dartboard rather than an eye. */
      b.push();
      b.translate(s*EYE_X,EYE_Y-EYE_R*0.19,EYE_Z+EYE_R*0.29);
      b.rotate(0,s*EYE_TILT,0);
      b.scale(1.0,0.54,0.07);
      b.sphere(0,0,0,EYE_R*0.36,16,8,'#FFF6E2');
      b.pop();
      /* and the pupil on top of all of it */
      disc(0.150,EYE_R*0.235,0.07,'#0A0A10',16);
    }
    b.pop();
  });
};
Body.lids=function(){
  return part('lids',function(b){
    b.mat('skin');
    b.push();b.scale(P.headScale,P.headScale,P.headScale);
    for(var s=-1;s<=1;s+=2){
      b.push();b.translate(s*EYE_X,EYE_Y+EYE_R*0.74,EYE_Z-EYE_R*0.46);
      b.rotate(0.10,s*EYE_TILT,s*0.10);
      b.scale(1.16,0.70,0.34);
      b.sphere(0,0,0,EYE_R*1.18,16,10,LIT);
      b.pop();
    }
    b.pop();
  });
};

Body.brows=function(){
  return part('brows',function(b){
    b.mat('blank');
    b.push();b.scale(P.headScale,P.headScale,P.headScale);
    for(var s=-1;s<=1;s+=2){
      /* Eleven fine strands along an arc rather than three lobes. A
         brow is a field of hairs that starts thick and vertical at the
         inner end and turns flat and thin as it runs out over the
         temple, and three fat blobs cannot say any of that. */
      /* Seven, not eleven, and half the thickness. At this head size
         eleven dark cylinders over an eye read as a drawn-on scowl —
         the single biggest contributor to the grimace. */
      for(var i=0;i<7;i++){
        var t=i/6;
        var arc=Math.sin(t*2.2)*0.011;
        var x=EYE_X-0.026+t*0.054;
        var y=0.0560+arc-t*t*0.012;
        var z=EYE_Z+0.0180-t*0.0140-Math.abs(t-0.35)*0.004;
        var len=0.0104-t*0.0032;
        var thick=(0.0046-t*0.0016)*(1-0.32*Math.abs(t-0.25));
        b.push();
        b.translate(s*x,y,z);
        b.rotate(0.30-t*0.55,s*(EYE_TILT-t*0.34),s*(0.34-t*0.92));
        b.scale(1.0,1.0,0.55);
        b.cylinder(0,0,0,thick,thick*0.35,len,5,i%2?LIT:MID);
        b.pop();
      }
    }
    b.pop();
  });
};


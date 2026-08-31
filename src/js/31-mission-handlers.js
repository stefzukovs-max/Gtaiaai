/* ============================================================
   Mission and social handlers, inside the authority.
   ============================================================ */
(function(){
'use strict';
var M=LH.M,D=LH.Data,Net=LH.Net,Q=LH.Quests;

/* Every activity funnels through one tracker. Missions, achievements
   and the "discovered" counters all read the same event, so a new
   mission never means editing the thing it measures. */
function activeSet(srv){
  var out=[];
  var s=srv.snapshot();
  Q.todaysDailies().forEach(function(m){out.push(m);});
  Q.thisWeek().forEach(function(m){out.push(m);});
  Q.MISSIONS.forEach(function(m){
    if(m.type!=='story')return;
    var st=s.missions[m.id];
    if(st&&st.claimed)return;
    if(m.needs){
      var pre=s.missions[m.needs];
      if(!pre||!pre.claimed)return;
    }
    if(s.level<m.level)return;
    out.push(m);
  });
  return out;
}

Net.register('track',function(p,srv){
  var kind=p.kind,key=p.key,n=p.n||1;
  var s=srv.snapshot();
  var completed=[];

  /* rotate: a daily from a previous day resets rather than carrying */
  var today=Q.dayIndex(), week=Q.weekIndex();

  activeSet(srv).forEach(function(m){
    var g=m.goal;
    if(g[0]!==kind)return;
    if(g[1]&&g[1]!==key)return;
    var st=srv.mission(m.id);
    if(m.type==='daily'&&st.day!==today){st.p=0;st.done=false;st.claimed=false;st.day=today;}
    if(m.type==='weekly'&&st.week!==week){st.p=0;st.done=false;st.claimed=false;st.week=week;}
    if(st.done)return;
    st.p+=n;
    if(st.p>=g[2]){st.p=g[2];st.done=true;completed.push(m.id);}
  });

  /* achievements use the same events but never reset */
  Q.ACH.forEach(function(a){
    if(a[2]!==kind)return;
    if(a[3]&&a[3]!==key)return;
    var st=srv.achievement(a[0]);
    if(st.done)return;
    st.p+=n;
    if(st.p>=a[4]){
      st.done=true;
      var rw=a[5]||{};
      if(rw.xp)srv.xp(rw.xp);
      if(rw.items)rw.items.forEach(function(it){srv.give(it[0],it[1]);});
      if(rw.title)srv.title(rw.title);
      completed.push('ach:'+a[0]);
    }
  });

  return {ok:true,completed:completed,state:srv.snapshot()};
});

Net.register('missions',function(p,srv){
  var s=srv.snapshot();
  var today=Q.dayIndex(), week=Q.weekIndex();
  function pack(m){
    var st=s.missions[m.id]||{p:0,done:false,claimed:false};
    /* a stale daily reads as fresh rather than complete */
    if(m.type==='daily'&&st.day!==today)st={p:0,done:false,claimed:false};
    if(m.type==='weekly'&&st.week!==week)st={p:0,done:false,claimed:false};
    return {id:m.id,name:m.name,desc:m.desc,type:m.type,
      goal:m.goal[2],progress:Math.min(st.p||0,m.goal[2]),
      done:!!st.done,claimed:!!st.claimed,
      reward:m.reward,npc:m.npc};
  }
  return {ok:true,
    daily:Q.todaysDailies().map(pack),
    weekly:Q.thisWeek().map(pack),
    story:activeSet(srv).filter(function(m){return m.type==='story';}).map(pack),
    achievements:Q.ACH.map(function(a){
      var st=(s.achievements||{})[a[0]]||{p:0,done:false};
      return {id:a[0],name:a[1],goal:a[4],progress:Math.min(st.p||0,a[4]),
        done:!!st.done};
    })};
});

Net.register('claim',function(p,srv){
  var m=Q.byId(p.id);
  if(!m)return {ok:false,why:'No such mission.'};
  var st=srv.mission(m.id);
  if(!st.done)return {ok:false,why:'Not finished yet.'};
  if(st.claimed)return {ok:false,why:'Already claimed.'};
  st.claimed=true;
  var rw=m.reward||{};
  if(rw.coins)srv.coins(rw.coins);
  if(rw.xp)srv.xp(rw.xp);
  if(rw.items)rw.items.forEach(function(it){srv.give(it[0],it[1]);});
  if(rw.title)srv.title(rw.title);
  return {ok:true,reward:rw,state:srv.snapshot()};
});

Net.register('talk',function(p,srv){
  var npc=Q.NPCS[p.id];
  if(!npc)return {ok:false,why:'Nobody there.'};
  srv.meet(p.id);
  Net.request('track',{kind:'talk',key:p.id,n:1});
  var seen=srv.metCount(p.id);
  return {ok:true,name:npc.name,role:npc.role,
    line:npc.lines[Math.min(seen-1,npc.lines.length-1)],
    offer:npc.offer,state:srv.snapshot()};
});

Net.register('visit',function(p,srv){
  if(srv.visit(p.id))Net.request('track',{kind:'visit',key:p.id,n:1});
  return {ok:true,state:srv.snapshot()};
});

LH.QuestNet=true;
})();


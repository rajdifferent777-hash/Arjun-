import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const root=document.getElementById("game");
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x07101c);
scene.fog=new THREE.Fog(0x07101c,45,190);

const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,280);
camera.position.set(0,5.7,10);

const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
root.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xbfdcff,0x101923,2.1));
const sun=new THREE.DirectionalLight(0xffe6bd,2.7);
sun.position.set(-20,28,12);
scene.add(sun);

const lanes=[-3,0,3], objects=[], scenery=[];
const PLAYER_Z=0, BASE_SPEED=18;
let lane=1,targetX=0,playerY=0,vy=0,slideTime=0;
let distance=0,score=0,relics=0,chase=100,combo=0,comboTimer=0;
let running=false,last=performance.now(),nextSegment=-28,hits=0,hitCooldown=0,shake=0;
let zone=0,best=Number(localStorage.getItem("skybound_best")||0);
const ZONES=[
  {name:"THE BROKEN SKY",sub:"Ancient skyway",stone:0x263746,edge:0x536a72,accent:0xd9a94e},
  {name:"THE CRYSTAL GARDENS",sub:"The living ruins",stone:0x203b43,edge:0x4b7774,accent:0x55e7d2},
  {name:"THE HOLLOW FRONTIER",sub:"Where the city ends",stone:0x302b43,edge:0x71658e,accent:0xd879ff}
];
let currentZone=0;

const M={
 stone:new THREE.MeshStandardMaterial({color:0x263746,roughness:.9}),
 edge:new THREE.MeshStandardMaterial({color:0x536a72,roughness:.8}),
 dark:new THREE.MeshStandardMaterial({color:0x101923,roughness:.85}),
 teal:new THREE.MeshStandardMaterial({color:0x43d8c4,roughness:.55}),
 gold:new THREE.MeshStandardMaterial({color:0xd9a94e,metalness:.35,roughness:.45}),
 red:new THREE.MeshStandardMaterial({color:0xf05c59,roughness:.7}),
 amber:new THREE.MeshStandardMaterial({color:0xffc24d,roughness:.6}),
 cyan:new THREE.MeshBasicMaterial({color:0x62e8ff}),
 purple:new THREE.MeshBasicMaterial({color:0xd879ff}),
 white:new THREE.MeshBasicMaterial({color:0xeaf7ff})
};
function box(w,h,d,mat,x=0,y=0,z=0){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); return m;
}
function matFor(kind){
  const z=ZONES[kind%ZONES.length];
  return new THREE.MeshStandardMaterial({color:z.stone,roughness:.9});
}
function edgeFor(kind){
  const z=ZONES[kind%ZONES.length];
  return new THREE.MeshStandardMaterial({color:z.edge,roughness:.8});
}
function accentFor(kind){
  const z=ZONES[kind%ZONES.length];
  return new THREE.MeshStandardMaterial({color:z.accent,metalness:.25,roughness:.5});
}

function createHero(){
  const g=new THREE.Group();
  const torso=box(1.25,1.35,.78,M.teal,0,1.65,0); g.add(torso);
  const chest=box(.72,.3,.08,M.gold,0,1.82,-.43); g.add(chest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.46,10,8),new THREE.MeshStandardMaterial({color:0x617680,roughness:.8}));
  head.position.set(0,2.65,0); g.add(head);
  g.add(box(.72,.22,.08,M.dark,0,2.68,-.43));
  const scarf=box(1.05,.12,.9,M.red,0,2.25,.02); g.add(scarf);
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const arm=box(.32,1.15,.38,new THREE.MeshStandardMaterial({color:0x617680}),side*.82,1.68,0);
    g.add(arm); arms.push(arm);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.18,7,6),M.gold);
    hand.position.set(side*.82,1.08,0); g.add(hand);
    const leg=box(.42,1.15,.46,M.dark,side*.32,.55,0); g.add(leg); legs.push(leg);
    g.add(box(.5,.22,.72,M.gold,side*.32,.02,-.12));
  }
  const relic=new THREE.Mesh(new THREE.OctahedronGeometry(.22),M.cyan);
  relic.position.set(0,1.45,-.47); g.add(relic);
  g.add(box(.9,1,.28,M.dark,0,1.65,.52));
  scene.add(g);
  return {g,torso,arms,legs,relic};
}
const hero=createHero(), player=hero.g;

function addTrack(z,kind,brokenLane=-1){
  const g=new THREE.Group(), stone=matFor(kind), edge=edgeFor(kind), accent=accentFor(kind);
  const base=box(10,.5,28,stone,0,-.32,0); g.add(base);
  for(const x of [-4.85,4.85]){
    g.add(box(.28,.8,28,edge,x,.08,0));
    for(let i=-11;i<=11;i+=4)g.add(box(.38,1.05,.3,edge,x,.43,i));
  }
  for(const x of [-1.5,1.5])g.add(box(.07,.035,27,accent,x,.03,0));
  if(brokenLane>=0){
    const gx=lanes[brokenLane];
    g.add(box(2.7,.8,5,M.dark,gx,-.7,-7));
    g.add(box(2.65,.08,.1,M.red,gx,.18,-7));
  }
  g.position.z=z; scene.add(g); objects.push({mesh:g,type:"track"});
}

function addSideArchitecture(z,kind,index){
  const edge=edgeFor(kind), accent=accentFor(kind), stone=matFor(kind);
  if(index%4===0){
    const gate=new THREE.Group();
    gate.add(box(1.6,7,1.6,stone,-7,3.5,0),box(1.6,7,1.6,stone,7,3.5,0));
    gate.add(box(16,1.1,2,edge,0,7,0));
    gate.add(box(7.4,4.6,.55,M.dark,0,3.2,-.1));
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.15,.18,8,18),accent);
    ring.rotation.x=Math.PI/2; ring.position.set(0,5.2,-.5); gate.add(ring);
    gate.position.z=z-10; scene.add(gate); scenery.push(gate);
  }else{
    for(const side of [-1,1]){
      const h=4+((index*7+side+kind)%3);
      const p=new THREE.Group();
      const cyl=new THREE.Mesh(new THREE.CylinderGeometry(.62,.82,h,7),stone);
      cyl.position.y=h/2; p.add(cyl); p.add(box(1.4,.28,1.4,accent,0,h,0));
      p.position.set(side*7,0,z-(side<0?5:14)); scene.add(p); scenery.push(p);
    }
  }
  if(kind===1 && index%2===0){
    for(const x of [-6.4,6.4]){
      const c=new THREE.Mesh(new THREE.OctahedronGeometry(.72),M.cyan);
      c.position.set(x,1.2,z-7); c.rotation.z=.4; scene.add(c); scenery.push(c);
    }
  }
  if(kind===2 && index%3===0){
    for(const x of [-6.8,6.8]){
      const orb=new THREE.Mesh(new THREE.SphereGeometry(.32,8,8),M.purple);
      orb.position.set(x,4.2,z-9); scene.add(orb); scenery.push(orb);
    }
  }
}

function addRouteMarker(x,z,label,kind){
  const g=new THREE.Group();
  g.add(box(.08,1.1,.08,accentFor(kind),0,.55,0));
  g.add(box(.9,.08,.08,accentFor(kind),0,1.05,0));
  const arrow=box(.35,.08,.08,accentFor(kind),.2,.92,0);
  arrow.rotation.z=-.55; g.add(arrow);
  g.position.set(x,0,z); scene.add(g); scenery.push(g);
}

function addObstacle(x,z,kind,zoneKind){
  const g=new THREE.Group(), accent=accentFor(zoneKind);
  if(kind==="wall"){
    g.add(box(2.25,2.7,1.15,M.red,0,1.35,0),box(1.65,.22,1.3,accent,0,2.1,-.02));
    g.userData.action="JUMP";
  }else if(kind==="beam"){
    g.add(box(2.5,.62,1.15,M.amber,0,2.15,0),box(.22,2.15,.9,edgeFor(zoneKind),-1.05,1.05,0),box(.22,2.15,.9,edgeFor(zoneKind),1.05,1.05,0));
    g.userData.action="SLIDE";
  }else{
    g.add(box(2,1.25,1.3,edgeFor(zoneKind),0,.62,0),box(2.25,.18,1.45,accent,0,1.2,0));
    g.userData.action="JUMP";
  }
  g.position.set(x,0,z); g.userData.kind=kind; g.userData.hit=false;
  scene.add(g); objects.push({mesh:g,type:"obstacle"});
  addRouteMarker(x,z-.9,kind,zoneKind);
}
function addRelic(x,z,big=false){
  const m=new THREE.Mesh(big?new THREE.OctahedronGeometry(.55):new THREE.TorusGeometry(.38,.12,8,18),big?M.gold:M.cyan);
  m.position.set(x,big?1.5:1.25,z); m.rotation.x=Math.PI/2; scene.add(m);
  objects.push({mesh:m,type:"relic",big});
}
function addPower(x,z,type){
  const colors={shield:0x62e8ff,magnet:0xe56cff,boost:0xff9c42};
  const m=new THREE.Mesh(new THREE.OctahedronGeometry(.5),new THREE.MeshBasicMaterial({color:colors[type]}));
  m.position.set(x,1.5,z); m.userData.power=type; scene.add(m); objects.push({mesh:m,type:"power"});
}

function spawnSegment(z,index){
  const kind=Math.floor(index/9)%3;
  const broken=(index%10===7)?Math.floor(Math.random()*3):-1;
  addTrack(z,kind,broken);
  addSideArchitecture(z,kind,index);

  const safe=Math.floor(Math.random()*3);
  const pattern=index%6;
  if(pattern===0)addObstacle(lanes[(safe+1)%3],z-5,"wall",kind);
  else if(pattern===1)addObstacle(lanes[(safe+2)%3],z-5,"beam",kind);
  else if(pattern===2){
    addObstacle(lanes[(safe+1)%3],z-5,"wall",kind);
    addObstacle(lanes[(safe+2)%3],z-12,"low",kind);
  }else if(pattern===3){
    addObstacle(lanes[(safe+1)%3],z-5,"wall",kind);
    addObstacle(lanes[(safe+2)%3],z-5,"wall",kind);
  }else if(pattern===4){
    addObstacle(lanes[(safe+1)%3],z-5,"low",kind);
    addObstacle(lanes[(safe+2)%3],z-12,"beam",kind);
  }else{
    addObstacle(lanes[(safe+1)%3],z-5,"beam",kind);
    addObstacle(lanes[(safe+2)%3],z-12,"wall",kind);
  }
  for(let i=0;i<7;i++)addRelic(lanes[safe],z-2-i*2.25);
  if(index%7===0)addRelic(lanes[(safe+2)%3],z-14,true);
  if(index%8===4)addPower(lanes[safe],z-18,["shield","magnet","boost"][index%3]);
}

function clearWorld(){
  while(objects.length)scene.remove(objects.pop().mesh);
  while(scenery.length)scene.remove(scenery.pop());
}
function buildWorld(){
  clearWorld(); nextSegment=-28;
  for(let i=0;i<17;i++){spawnSegment(nextSegment,i);nextSegment-=28;}
}

function storyStart(){
  document.getElementById("overlay")?.remove();
  const el=document.createElement("div"); el.id="overlay";
  el.innerHTML='<div class="story"><div class="sigil">✦</div><div class="eyebrow">CHAPTER I · THE BROKEN SKY</div><h1>SKYBOUND RELIC</h1><p>The Aether Beacon has gone dark. Ancient skyways are breaking apart while a living force called <b>the Hollow</b> wakes beneath the city.</p><div class="chapter-row"><span>01</span><b>ESCAPE THE RUINS</b><small>Learn the skyway.</small></div><div class="chapter-row"><span>02</span><b>REACH THE GARDENS</b><small>Follow the living crystals.</small></div><div class="chapter-row"><span>03</span><b>FIND THE BEACON</b><small>Discover what the Hollow wants.</small></div><button id="startBtn">BEGIN THE JOURNEY</button><small>Swipe ← → to change lane · ↑ jump · ↓ slide</small></div>';
  root.appendChild(el); document.getElementById("startBtn").onclick=startGame;
}
function gameOver(){
  if(!running)return; running=false;
  best=Math.max(best,Math.floor(score)); localStorage.setItem("skybound_best",best);
  const el=document.createElement("div"); el.id="overlay";
  el.innerHTML='<div class="story"><div class="eyebrow">JOURNEY INTERRUPTED</div><h1>THE HOLLOW IS CLOSER</h1><p>Distance <b>'+Math.floor(distance)+'m</b> · Relics <b>'+relics+'</b></p><div class="result">SCORE '+Math.floor(score)+'<br>BEST '+best+'</div><button id="retryBtn">CONTINUE THE JOURNEY</button></div>';
  root.appendChild(el); document.getElementById("retryBtn").onclick=startGame;
}
function startGame(){
  document.getElementById("overlay")?.remove();
  lane=1; targetX=0; playerY=0; vy=0; slideTime=0; distance=0; score=0; relics=0; chase=100; combo=0; comboTimer=0; hits=0; hitCooldown=0; shake=0; currentZone=0; running=true; buildWorld();
}
function move(dir){if(running){lane=Math.max(0,Math.min(2,lane+dir));targetX=lanes[lane];}}
function jump(){if(running&&playerY<.05&&slideTime<=0){vy=11.5;}}
function slide(){if(running&&playerY<.05){slideTime=.85;}}
let sx=0,sy=0;
addEventListener("touchstart",e=>{sx=e.changedTouches[0].clientX;sy=e.changedTouches[0].clientY},{passive:true});
addEventListener("touchend",e=>{const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.max(Math.abs(dx),Math.abs(dy))<30)return;if(Math.abs(dx)>Math.abs(dy))move(dx>0?1:-1);else dy<0?jump():slide();},{passive:true});
addEventListener("keydown",e=>{if(e.key==="ArrowLeft"||e.key==="a")move(-1);if(e.key==="ArrowRight"||e.key==="d")move(1);if(e.key==="ArrowUp"||e.key==="w"||e.key===" ")jump();if(e.key==="ArrowDown"||e.key==="s")slide();});

function hitObstacle(o){
  if(hitCooldown>0||o.mesh.userData.hit)return;
  const kind=o.mesh.userData.kind;
  const safe=(kind==="beam"&&slideTime>0)||(kind!=="beam"&&playerY>1.05);
  if(safe){score+=90;combo=Math.min(12,combo+1);comboTimer=2;return;}
  o.mesh.userData.hit=true; hitCooldown=1.1; hits++; combo=0; chase-=50; shake=.55;
  const flash=document.createElement("div"); flash.className="hitflash"; root.appendChild(flash); setTimeout(()=>flash.remove(),180);
  if(hits>=2||chase<=0)gameOver();
}

function hud(){
  let h=document.getElementById("hud");
  if(!h){h=document.createElement("div");h.id="hud";root.appendChild(h);}
  const z=ZONES[currentZone];
  h.innerHTML='<div class="topline"><span>SCORE <b>'+Math.floor(score)+'</b></span><span>RELICS <b>'+relics+'</b></span><span>BEST <b>'+best+'</b></span></div><div class="zone"><b>'+z.name+'</b><small>'+z.sub+'</small></div><div class="bar"><i style="width:'+Math.max(0,chase)+'%"></i><span>HOLLOW</span></div><div class="combo">COMBO ×'+Math.max(1,combo)+'</div>';
}

function frame(now){
  const dt=Math.min(.033,(now-last)/1000); last=now;
  if(running){
    const speed=BASE_SPEED+Math.min(7,distance/220);
    distance+=speed*dt; score+=speed*dt*(10+combo*.7); chase=Math.min(100,chase+dt*.9);
    hitCooldown=Math.max(0,hitCooldown-dt);

    const newZone=Math.min(2,Math.floor(distance/250));
    if(newZone!==currentZone){currentZone=newZone;scene.background=new THREE.Color([0x07101c,0x092226,0x151024][currentZone]);scene.fog.color=scene.background;}
    player.position.x+=(targetX-player.position.x)*Math.min(1,dt*14);

    if(playerY>0||vy>0){vy-=27*dt;playerY=Math.max(0,playerY+vy*dt);if(playerY===0)vy=0;}
    if(slideTime>0)slideTime-=dt;

    const crouch=slideTime>0&&playerY<.1;
    hero.g.scale.y+=(crouch?.66:1-hero.g.scale.y)*Math.min(1,dt*18);
    player.position.y=playerY+(crouch?.35:0);
    hero.torso.rotation.x+=(crouch?-.18:0-hero.torso.rotation.x)*Math.min(1,dt*14);
    hero.legs.forEach((leg,i)=>{const run=Math.sin(distance*.9+i*Math.PI)*.42;leg.rotation.x=crouch?-.85:run;});
    hero.arms.forEach((arm,i)=>{arm.rotation.x=crouch?(i?-1.05:-.8):Math.sin(distance*.9+i*Math.PI)*.45;});
    hero.relic.rotation.y+=dt*6;
    if(comboTimer>0)comboTimer-=dt;else combo=0;

    for(const o of objects){
      o.mesh.position.z+=speed*dt;
      if(o.type==="relic"||o.type==="power")o.mesh.rotation.y+=dt*4;
    }
    for(const s of scenery)s.position.z+=speed*dt;

    while(nextSegment>-distance-260){spawnSegment(nextSegment,Math.floor((distance+260)/28));nextSegment-=28;}

    for(const o of objects){
      if(!o.mesh.visible)continue;
      const dz=Math.abs(o.mesh.position.z);
      const dx=Math.abs(o.mesh.position.x-player.position.x);
      if(dz<1.15&&dx<1.22){
        if(o.type==="obstacle")hitObstacle(o);
        else if(o.type==="relic"){o.mesh.visible=false;relics++;combo=Math.min(12,combo+1);comboTimer=2.2;score+=100+combo*20;}
        else if(o.type==="power"){o.mesh.visible=false;score+=250;chase=Math.min(100,chase+18);}
      }
    }
    while(objects.length&&objects[0].mesh.position.z>26)scene.remove(objects.shift().mesh);

    if(shake>0)shake-=dt;
    const jx=shake>0?(Math.random()-.5)*shake:0,jy=shake>0?(Math.random()-.5)*shake:0;
    camera.position.x+=(player.position.x-camera.position.x)*dt*5+jx;
    camera.position.y=5.7+playerY*.2+jy;
    camera.lookAt(player.position.x,1.3,-14);
    hud();
  }
  renderer.render(scene,camera); requestAnimationFrame(frame);
}
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
buildWorld(); hud(); storyStart(); requestAnimationFrame(frame);

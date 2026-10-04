import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const root=document.getElementById("game");
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x07101c);
scene.fog=new THREE.Fog(0x07101c,42,175);

const camera=new THREE.PerspectiveCamera(63,innerWidth/innerHeight,.1,260);
camera.position.set(0,5.8,10);

const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
root.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xbfdcff,0x111923,2.0));
const sun=new THREE.DirectionalLight(0xffefd2,2.4);
sun.position.set(-15,24,10);
scene.add(sun);

const lanes=[-3,0,3];
const PLAYER_Z=0;
const BASE_SPEED=19;
const objects=[];
const scenery=[];
let lane=1,targetX=0,playerY=0,vy=0,slideTime=0;
let distance=0,score=0,relics=0,chase=100,combo=0,comboTimer=0;
let running=false,started=false,last=performance.now();
let nextChunk=-30,landmarkDistance=0;
let hits=0,hitCooldown=0,shake=0;
let best=Number(localStorage.getItem("skybound_best")||0);

const MATS={
  stone:new THREE.MeshStandardMaterial({color:0x263746,roughness:.9}),
  stone2:new THREE.MeshStandardMaterial({color:0x354b57,roughness:.85}),
  edge:new THREE.MeshStandardMaterial({color:0x536a72,roughness:.8}),
  gold:new THREE.MeshStandardMaterial({color:0xd9a94e,metalness:.35,roughness:.45}),
  teal:new THREE.MeshStandardMaterial({color:0x43d8c4,roughness:.55}),
  dark:new THREE.MeshStandardMaterial({color:0x101c28,roughness:.8}),
  red:new THREE.MeshStandardMaterial({color:0xf05c59,roughness:.7}),
  amber:new THREE.MeshStandardMaterial({color:0xffc24d,roughness:.65}),
  cyan:new THREE.MeshBasicMaterial({color:0x62e8ff}),
  purple:new THREE.MeshBasicMaterial({color:0xd879ff})
};

function box(w,h,d,material,x=0,y=0,z=0){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  m.position.set(x,y,z);
  return m;
}

function createHero(){
  const g=new THREE.Group();

  const torso=box(1.25,1.35,.78,MATS.teal,0,1.65,0);
  torso.scale.set(1,.95,1);
  g.add(torso);

  const chest=box(.72,.3,.08,MATS.gold,0,1.82,-.43);
  g.add(chest);

  const head=new THREE.Mesh(new THREE.SphereGeometry(.46,10,8),MATS.stone2);
  head.position.set(0,2.65,0);
  g.add(head);

  const visor=box(.72,.22,.08,MATS.dark,0,2.68,-.43);
  g.add(visor);

  const scarf=box(1.05,.12,.9,MATS.red,0,2.25,.02);
  g.add(scarf);

  for(const side of [-1,1]){
    const arm=box(.32,1.15,.38,MATS.stone2,side*.82,1.68,0);
    arm.rotation.z=side*.08;
    g.add(arm);

    const hand=new THREE.Mesh(new THREE.SphereGeometry(.18,7,6),MATS.gold);
    hand.position.set(side*.82,1.08,0);
    g.add(hand);

    const leg=box(.42,1.15,.46,MATS.dark,side*.32,.55,0);
    g.add(leg);

    const boot=box(.5,.22,.72,MATS.gold,side*.32,.02,-.12);
    g.add(boot);
  }

  const relic=new THREE.Mesh(new THREE.OctahedronGeometry(.22),MATS.cyan);
  relic.position.set(0,1.45,-.47);
  g.add(relic);

  const backpack=box(.9,1.0,.28,MATS.dark,0,1.65,.52);
  g.add(backpack);

  scene.add(g);
  return {g,torso,legs:g.children.filter(c=>c.geometry instanceof THREE.BoxGeometry).slice(-4),relic};
}
const hero=createHero();
const player=hero.g;

function addTrack(z,broken=false){
  const g=new THREE.Group();
  const base=box(10,.5,30,MATS.stone,0,-.32,0);
  g.add(base);

  for(let x of [-4.85,4.85]){
    const rail=box(.28,.75,30,MATS.edge,x,.05,0);
    g.add(rail);
    for(let i=-12;i<=12;i+=4){
      const post=box(.38,1.1,.3,MATS.edge,x,.42,i);
      g.add(post);
    }
  }

  for(const x of [-1.5,1.5]){
    const line=box(.06,.035,29,MATS.gold,x,.02,0);
    line.material.opacity=.45;
    line.material.transparent=true;
    g.add(line);
  }

  if(broken){
    const gap=box(9.5,.7,5,MATS.dark,0,-.65,-8);
    g.add(gap);
    const warning=box(8,.08,.08,MATS.red,0,.15,-8);
    g.add(warning);
  }

  g.position.z=z;
  scene.add(g);
  objects.push({mesh:g,type:"track"});
}

function addTorch(x,z){
  const g=new THREE.Group();
  const stem=box(.14,1.7,.14,MATS.dark,0,.85,0);
  g.add(stem);
  const flame=new THREE.Mesh(new THREE.OctahedronGeometry(.28),MATS.amber);
  flame.position.y=1.85;
  g.add(flame);
  g.position.set(x,0,z);
  scene.add(g);
  scenery.push(g);
}

function addTemple(z,scale=1){
  const g=new THREE.Group();

  const left=box(1.5,7,1.5,MATS.stone2,-7,3.5,0);
  const right=box(1.5,7,1.5,MATS.stone2,7,3.5,0);
  g.add(left,right);

  const roof=box(16,1.1,2.0,MATS.edge,0,7,0);
  g.add(roof);

  const arch=box(7.5,4.8,.65,MATS.dark,0,3.3,-.1);
  g.add(arch);

  const emblem=new THREE.Mesh(new THREE.TorusGeometry(1.1,.18,8,18),MATS.gold);
  emblem.rotation.x=Math.PI/2;
  emblem.position.set(0,5.2,-.48);
  g.add(emblem);

  for(const x of [-5.5,5.5])addTorch(x,z-.8);

  g.position.z=z;
  g.scale.setScalar(scale);
  scene.add(g);
  scenery.push(g);
}

function addPillar(x,z,h=5){
  const g=new THREE.Group();
  const p=new THREE.Mesh(new THREE.CylinderGeometry(.62,.82,h,7),MATS.stone2);
  p.position.y=h/2;
  g.add(p);
  const cap=box(1.35,.28,1.35,MATS.gold,0,h,0);
  g.add(cap);
  g.position.set(x,0,z);
  scene.add(g);
  scenery.push(g);
}

function addCrystal(x,z){
  const c=new THREE.Mesh(new THREE.OctahedronGeometry(.7),MATS.cyan);
  c.position.set(x,1.15,z);
  c.rotation.z=.4;
  scene.add(c);
  scenery.push(c);
}

function addObstacle(x,z,kind){
  let g=new THREE.Group();
  if(kind==="wall"){
    g.add(box(2.25,2.7,1.15,MATS.red,0,1.35,0));
    g.add(box(1.65,.22,1.3,MATS.gold,0,2.1,-.02));
    g.userData.label="JUMP";
  }else if(kind==="beam"){
    g.add(box(2.5,.62,1.15,MATS.amber,0,2.15,0));
    g.add(box(.22,2.15,.9,MATS.stone2,-1.05,1.05,0));
    g.add(box(.22,2.15,.9,MATS.stone2,1.05,1.05,0));
    g.userData.label="SLIDE";
  }else{
    g.add(box(2.0,1.25,1.3,MATS.stone2,0,.62,0));
    g.add(box(2.25,.18,1.45,MATS.gold,0,1.2,0));
    g.userData.label="JUMP";
  }
  g.position.set(x,0,z);
  g.userData.kind=kind;
  g.userData.hit=false;
  scene.add(g);
  objects.push({mesh:g,type:"obstacle"});
}

function addRelic(x,z,big=false){
  const m=new THREE.Mesh(big?new THREE.OctahedronGeometry(.55):new THREE.TorusGeometry(.38,.12,8,18),big?MATS.gold:MATS.cyan);
  m.position.set(x,big?1.5:1.3,z);
  m.rotation.x=Math.PI/2;
  m.userData.big=big;
  scene.add(m);
  objects.push({mesh:m,type:"relic"});
}

function addPower(x,z,type){
  const colors={shield:0x62e8ff,magnet:0xe56cff,boost:0xff9c42};
  const m=new THREE.Mesh(new THREE.OctahedronGeometry(.48),new THREE.MeshBasicMaterial({color:colors[type]}));
  m.position.set(x,1.5,z);
  m.userData.power=type;
  scene.add(m);
  objects.push({mesh:m,type:"power"});
}

function spawnChunk(z,index){
  const landmark=index%8===0;
  addTrack(z,index%11===7);
  if(landmark)addTemple(z-12,1);
  else{
    addPillar(-7,z-5,4+Math.random()*3);
    addPillar(7,z-15,4+Math.random()*3);
    if(Math.random()<.65)addCrystal(Math.random()<.5?-6.2:6.2,z-9);
  }

  const safe=Math.floor(Math.random()*3);
  const pattern=Math.floor(Math.random()*5);

  if(pattern===0){
    addObstacle(lanes[(safe+1)%3],z-4,"wall");
  }else if(pattern===1){
    addObstacle(lanes[(safe+2)%3],z-4,"beam");
  }else if(pattern===2){
    addObstacle(lanes[(safe+1)%3],z-4,"wall");
    addObstacle(lanes[(safe+2)%3],z-11,"low");
  }else if(pattern===3){
    addObstacle(lanes[(safe+1)%3],z-4,"wall");
    addObstacle(lanes[(safe+2)%3],z-4,"wall");
  }else{
    addObstacle(lanes[(safe+1)%3],z-4,"low");
    addObstacle(lanes[(safe+2)%3],z-10,"beam");
  }

  for(let i=0;i<7;i++)addRelic(lanes[safe],z-2-i*2.2);
  if(Math.random()<.22)addRelic(lanes[(safe+2)%3],z-12,true);
  if(Math.random()<.16)addPower(lanes[safe],z-17,["shield","magnet","boost"][Math.floor(Math.random()*3)]);
}

function clearWorld(){
  while(objects.length)scene.remove(objects.pop().mesh);
  while(scenery.length)scene.remove(scenery.pop());
}

function buildWorld(){
  clearWorld();
  nextChunk=-30;
  for(let i=0;i<12;i++){spawnChunk(nextChunk,i);nextChunk-=30;}
}

function storyStart(){
  const old=document.getElementById("overlay");
  if(old)old.remove();
  const el=document.createElement("div");
  el.id="overlay";
  el.innerHTML='<div class="story"><div class="sigil">✦</div><div class="eyebrow">CHAPTER I · THE BROKEN SKY</div><h1>SKYBOUND RELIC</h1><p>For centuries, the Aether Beacon kept the ancient city alive. Tonight it has gone dark.</p><p>Kael carries the last living Relic across the ruined skyway. Behind him, <b>the Hollow</b> is waking.</p><div class="hero-card"><b>KAEL</b><span>Relic Runner · Keeper of the Aether</span></div><button id="startBtn">ENTER THE SKYWAY</button><small>Swipe left/right · swipe up to jump · swipe down to slide</small></div>';
  root.appendChild(el);
  document.getElementById("startBtn").onclick=startGame;
}

function gameOver(){
  if(!running)return;
  running=false;
  best=Math.max(best,Math.floor(score));
  localStorage.setItem("skybound_best",String(best));
  const el=document.createElement("div");
  el.id="overlay";
  el.innerHTML='<div class="story"><div class="eyebrow">CHAPTER I · RUN FAILED</div><h1>THE HOLLOW CATCHES YOU</h1><p>You travelled <b>'+Math.floor(distance)+'m</b> and carried <b>'+relics+' relics</b>.</p><div class="result">SCORE '+Math.floor(score)+'<br>BEST '+best+'</div><button id="retryBtn">RUN THE SKYWAY AGAIN</button></div>';
  root.appendChild(el);
  document.getElementById("retryBtn").onclick=startGame;
}

function startGame(){
  document.getElementById("overlay")?.remove();
  lane=1;targetX=0;playerY=0;vy=0;slideTime=0;
  distance=0;score=0;relics=0;chase=100;combo=0;comboTimer=0;
  hits=0;hitCooldown=0;shake=0;
  running=true;started=true;landmarkDistance=0;
  buildWorld();
}

function hud(){
  let h=document.getElementById("hud");
  if(!h){h=document.createElement("div");h.id="hud";root.appendChild(h);}
  h.innerHTML='<div class="topline"><span>SCORE <b>'+Math.floor(score)+'</b></span><span>RELICS <b>'+relics+'</b></span><span>BEST <b>'+best+'</b></span></div><div class="bar"><i style="width:'+Math.max(0,chase)+'%"></i><span>HOLLOW</span></div><div class="combo">COMBO ×'+Math.max(1,combo)+'</div>';
}

function move(dir){
  if(!running)return;
  lane=Math.max(0,Math.min(2,lane+dir));
  targetX=lanes[lane];
}

function jump(){
  if(running&&playerY<.04){vy=11.5;slideTime=0;}
}

function slide(){
  if(running&&playerY<.05)slideTime=.8;
}

let sx=0,sy=0;
addEventListener("touchstart",e=>{sx=e.changedTouches[0].clientX;sy=e.changedTouches[0].clientY},{passive:true});
addEventListener("touchend",e=>{
  const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
  if(Math.max(Math.abs(dx),Math.abs(dy))<30)return;
  if(Math.abs(dx)>Math.abs(dy))move(dx>0?1:-1);else dy<0?jump():slide();
},{passive:true});
addEventListener("keydown",e=>{
  if(e.key==="ArrowLeft"||e.key==="a")move(-1);
  if(e.key==="ArrowRight"||e.key==="d")move(1);
  if(e.key==="ArrowUp"||e.key==="w"||e.key===" ")jump();
  if(e.key==="ArrowDown"||e.key==="s")slide();
});

function hitObstacle(o){
  if(hitCooldown>0||o.mesh.userData.hit)return;
  const kind=o.mesh.userData.kind;
  const jumpSafe=kind!=="beam"&&playerY>1.05;
  const slideSafe=kind==="beam"&&slideTime>0;
  if(jumpSafe||slideSafe){
    score+=80;
    combo=Math.min(12,combo+1);
    comboTimer=2;
    return;
  }

  o.mesh.userData.hit=true;
  hitCooldown=1.1;
  hits++;
  combo=0;
  chase-=48;
  shake=.5;

  const flash=document.createElement("div");
  flash.className="hitflash";
  root.appendChild(flash);
  setTimeout(()=>flash.remove(),180);

  if(hits>=2||chase<=0){
    gameOver();
  }
}

function frame(now){
  const dt=Math.min(.033,(now-last)/1000);
  last=now;

  if(running){
    const speed=BASE_SPEED+Math.min(6,distance/250);
    distance+=speed*dt;
    score+=speed*dt*(10+combo*.7);
    chase=Math.min(100,chase+dt*1.0);
    hitCooldown=Math.max(0,hitCooldown-dt);

    player.position.x+=(targetX-player.position.x)*Math.min(1,dt*14);

    if(playerY>0||vy>0){
      vy-=27*dt;
      playerY=Math.max(0,playerY+vy*dt);
      if(playerY===0)vy=0;
    }
    player.position.y=playerY;
    if(slideTime>0)slideTime-=dt;

    hero.torso.scale.y=slideTime>0?.62:1;
    hero.relic.rotation.y+=dt*6;
    hero.legs.forEach((leg,i)=>{leg.rotation.x=Math.sin(distance*.9+i*Math.PI)*.45;});

    if(comboTimer>0)comboTimer-=dt;else combo=0;

    for(const o of objects){
      o.mesh.position.z+=speed*dt;
      if(o.type==="relic"||o.type==="power")o.mesh.rotation.y+=dt*4;
    }
    for(const s of scenery)s.position.z+=speed*dt;

    while(nextChunk>-distance-220){
      spawnChunk(nextChunk,Math.floor(distance/30)+objects.length);
      nextChunk-=30;
    }

    for(const o of objects){
      if(o.mesh.visible===false)continue;
      const dz=Math.abs(o.mesh.position.z-PLAYER_Z);
      const dx=Math.abs(o.mesh.position.x-player.position.x);

      if(dz<1.15&&dx<1.25){
        if(o.type==="obstacle")hitObstacle(o);
        else if(o.type==="relic"){
          o.mesh.visible=false;
          relics++;
          combo=Math.min(12,combo+1);
          comboTimer=2.2;
          score+=100+combo*20;
        }else if(o.type==="power"){
          o.mesh.visible=false;
          score+=250;
          chase=Math.min(100,chase+18);
        }
      }
    }

    while(objects.length&&objects[0]?.mesh.position.z>25){
      const old=objects.shift();
      scene.remove(old.mesh);
    }

    if(shake>0)shake-=dt;
    const sx=shake>0?(Math.random()-.5)*shake:0;
    const sy=shake>0?(Math.random()-.5)*shake:0;
    camera.position.x+=(player.position.x-camera.position.x)*dt*5+sx;
    camera.position.y=5.8+playerY*.2+sy;
    camera.lookAt(player.position.x,1.35,-13);

    hud();
  }

  renderer.render(scene,camera);
  requestAnimationFrame(frame);
}

addEventListener("resize",()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

buildWorld();
hud();
storyStart();
requestAnimationFrame(frame);

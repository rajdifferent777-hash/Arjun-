import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const root=document.getElementById("game");
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x07101c);
scene.fog=new THREE.Fog(0x07101c,38,155);

const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,240);
camera.position.set(0,5.4,9);

const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
root.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xbad7ff,0x172030,2.1));
const sun=new THREE.DirectionalLight(0xffffff,2.2);
sun.position.set(-10,18,12);
scene.add(sun);

const lanes=[-2.8,0,2.8];
const speedBase=18;
const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.72});
const glowMat=c=>new THREE.MeshBasicMaterial({color:c});

let lane=1,targetX=0,playerY=0,vy=0,sliding=0;
let score=0,relics=0,distance=0,chase=100,combo=0,comboTimer=0;
let running=false,started=false,last=performance.now();
let nextSpawnZ=-25,objects=[];
let activePower=null,powerTimer=0,magnetTimer=0;
let best=Number(localStorage.getItem("skybound_best")||0);

const player=new THREE.Group();
const body=new THREE.Mesh(new THREE.BoxGeometry(1.35,2.2,.9),mat(0x4de1c1));
body.position.y=1.35;
player.add(body);
const visor=new THREE.Mesh(new THREE.BoxGeometry(.8,.35,.08),mat(0x102033));
visor.position.set(0,1.65,-.47);
player.add(visor);
const core=new THREE.Mesh(new THREE.OctahedronGeometry(.25),glowMat(0x8ffff0));
core.position.set(0,1.05,-.52);
player.add(core);
scene.add(player);

const trackMat=mat(0x182b3b);
const railMat=mat(0x31546b);
const stoneMat=mat(0x253d4b);
const goldMat=mat(0xe6b95c);
const cyanMat=glowMat(0x55e6ff);

function addTrack(z){
  const g=new THREE.Group();
  const floor=new THREE.Mesh(new THREE.BoxGeometry(10,.5,30),trackMat);
  floor.position.y=-.3;
  g.add(floor);
  for(const x of [-4.8,4.8]){
    const r=new THREE.Mesh(new THREE.BoxGeometry(.18,.5,30),railMat);
    r.position.set(x,0,0); g.add(r);
  }
  for(let x=-2.8;x<=2.8;x+=2.8){
    const line=new THREE.Mesh(new THREE.BoxGeometry(.035,.02,30),glowMat(0x28495a));
    line.position.set(x,0,-.05); g.add(line);
  }
  g.position.z=z;
  scene.add(g);
  objects.push({mesh:g,type:"track"});
}

function addScenery(z){
  const g=new THREE.Group();
  const side=Math.random()<.5?-1:1;
  const pillar=new THREE.Mesh(new THREE.CylinderGeometry(.7,.95,5+Math.random()*3,7),stoneMat);
  pillar.position.set(side*(6+Math.random()*3),2.5,z);
  g.add(pillar);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.2,.16,7,16),goldMat);
  ring.rotation.x=Math.PI/2;
  ring.position.set(pillar.position.x,4.5,z);
  g.add(ring);
  if(Math.random()<.55){
    const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.7),cyanMat);
    crystal.position.set(-side*(6.2+Math.random()*2),1.1,z-5);
    crystal.rotation.z=.5;
    g.add(crystal);
  }
  scene.add(g);
  objects.push({mesh:g,type:"scenery"});
}

function addObstacle(x,z,kind){
  const m=new THREE.Mesh(
    kind==="wall"?new THREE.BoxGeometry(2.1,2.5,1):new THREE.BoxGeometry(1.7,1.1,1.2),
    mat(kind==="wall"?0xff5965:0xffc857)
  );
  m.position.set(x,kind==="wall"?1.25:.55,z);
  m.userData={kind,hit:false};
  scene.add(m);
  objects.push({mesh:m,type:"obstacle"});
}

function addRelic(x,z,big=false){
  const m=new THREE.Mesh(
    big?new THREE.OctahedronGeometry(.55):new THREE.TorusGeometry(.38,.12,8,18),
    mat(0xffe66d)
  );
  m.position.set(x,big?1.45:1.25,z);
  if(!big)m.rotation.x=Math.PI/2;
  m.userData.big=big;
  scene.add(m);
  objects.push({mesh:m,type:"relic"});
}

function addPowerup(x,z,type){
  const colors={shield:0x62d9ff,magnet:0xf06cff,boost:0xff9b42};
  const m=new THREE.Mesh(new THREE.OctahedronGeometry(.48),glowMat(colors[type]));
  m.position.set(x,1.45,z);
  m.userData.power=type;
  scene.add(m);
  objects.push({mesh:m,type:"powerup"});
}

function spawnChunk(z){
  addTrack(z);
  addScenery(z);
  const safe=Math.floor(Math.random()*3);
  const roll=Math.random();

  if(roll<.82){
    const blocked=(safe+1+Math.floor(Math.random()*2))%3;
    addObstacle(lanes[blocked],z-3,Math.random()<.34?"wall":"low");
  }
  if(roll>.42){
    const second=(safe+2)%3;
    addObstacle(lanes[second],z-10,Math.random()<.38?"wall":"low");
  }

  for(let i=0;i<6;i++) addRelic(lanes[safe],z-3-i*2.4);
  if(Math.random()<.18) addRelic(lanes[(safe+2)%3],z-11,true);
  if(Math.random()<.14) addPowerup(lanes[safe],z-15,["shield","magnet","boost"][Math.floor(Math.random()*3)]);
}

function resetWorld(){
  for(const o of objects)scene.remove(o.mesh);
  objects=[];
  nextSpawnZ=-25;
  for(let i=0;i<9;i++){spawnChunk(nextSpawnZ);nextSpawnZ-=30;}
}

function showOverlay(kind){
  let old=document.getElementById("overlay");
  if(old)old.remove();
  const el=document.createElement("div");
  el.id="overlay";
  el.innerHTML=kind==="start"
    ? '<div class="panel"><div class="eyebrow">A SKYBOUND RELIC STORY</div><h1>SKYBOUND RELIC</h1><p>The old city has awakened beneath a broken sky. Carry the Aether Relic to the Beacon before the Hollow catches you.</p><div class="hero-name">KAEL · RELIC RUNNER</div><button id="startBtn">BEGIN THE RUN</button><small>Swipe ← → to move · ↑ to jump · ↓ to slide</small></div>'
    : '<div class="panel"><div class="eyebrow">THE RUN ENDS HERE</div><h1>THE HOLLOW CAUGHT UP</h1><p>Distance '+Math.floor(distance)+'m · Relics '+relics+' · Score '+Math.floor(score)+'</p><p>Best score: '+best+'</p><button id="restartBtn">RUN AGAIN</button></div>';
  root.appendChild(el);
  if(kind==="start")document.getElementById("startBtn").onclick=startGame;
  else document.getElementById("restartBtn").onclick=startGame;
}

function startGame(){
  const overlay=document.getElementById("overlay");
  if(overlay)overlay.remove();
  lane=1;targetX=0;playerY=0;vy=0;sliding=0;
  score=0;relics=0;distance=0;chase=100;combo=0;comboTimer=0;
  activePower=null;powerTimer=0;magnetTimer=0;
  running=true;started=true;
  resetWorld();
}

function gameOver(){
  if(!running)return;
  running=false;
  best=Math.max(best,Math.floor(score));
  localStorage.setItem("skybound_best",String(best));
  showOverlay("over");
}

function hud(){
  let h=document.getElementById("hud");
  if(!h){
    h=document.createElement("div");
    h.id="hud";
    root.appendChild(h);
  }
  h.innerHTML='<div><b>SCORE</b> '+Math.floor(score)+' &nbsp; <b>RELICS</b> '+relics+'</div><div>DISTANCE '+Math.floor(distance)+'m</div><div class="chase">CHASE '+Math.max(0,Math.floor(chase))+'%</div><div>COMBO x'+Math.max(1,combo)+'</div>'+(activePower?'<div>POWER '+activePower.toUpperCase()+' '+Math.ceil(powerTimer)+'s</div>':'');
}

function move(dir){
  if(!running)return;
  lane=Math.max(0,Math.min(2,lane+dir));
  targetX=lanes[lane];
}

function jump(){
  if(!running)return;
  if(playerY<.02){vy=10.5;sliding=0;}
}

function slide(){
  if(!running)return;
  if(playerY<.05)sliding=.72;
}

let sx=0,sy=0;
addEventListener("touchstart",e=>{
  sx=e.changedTouches[0].clientX;sy=e.changedTouches[0].clientY;
},{passive:true});
addEventListener("touchend",e=>{
  const dx=e.changedTouches[0].clientX-sx;
  const dy=e.changedTouches[0].clientY-sy;
  if(Math.max(Math.abs(dx),Math.abs(dy))<28)return;
  if(Math.abs(dx)>Math.abs(dy))move(dx>0?1:-1);
  else dy<0?jump():slide();
},{passive:true});

addEventListener("keydown",e=>{
  if(e.key==="ArrowLeft"||e.key==="a")move(-1);
  if(e.key==="ArrowRight"||e.key==="d")move(1);
  if(e.key==="ArrowUp"||e.key==="w"||e.key===" ")jump();
  if(e.key==="ArrowDown"||e.key==="s")slide();
});

function collectRelic(o){
  if(o.dead)return;
  o.dead=true;o.mesh.visible=false;
  relics++;
  combo=Math.min(20,combo+1);
  comboTimer=2.2;
  score+=100+combo*15;
  if(o.mesh.userData.big)score+=350;
}

function activatePower(o){
  if(o.dead)return;
  o.dead=true;o.mesh.visible=false;
  activePower=o.mesh.userData.power;
  powerTimer=7;
  if(activePower==="magnet")magnetTimer=7;
  if(activePower==="boost")score+=250;
}

function frame(now){
  const dt=Math.min(.033,(now-last)/1000);
  last=now;

  if(running){
    const speed=speedBase+(distance/900);
    distance+=speed*dt;
    score+=speed*dt*(10+(combo>1?combo:0));
    chase+=dt*(1.05+distance/2500);

    player.position.x+=(targetX-player.position.x)*Math.min(1,dt*12);

    if(playerY>0||vy>0){
      vy-=25*dt;
      playerY=Math.max(0,playerY+vy*dt);
      if(playerY===0)vy=0;
    }
    player.position.y=playerY;

    if(sliding>0)sliding-=dt;
    body.scale.y=sliding>0?.55:1;
    core.rotation.y+=dt*4;

    if(comboTimer>0)comboTimer-=dt;
    else combo=0;

    if(powerTimer>0){
      powerTimer-=dt;
      if(powerTimer<=0){activePower=null;magnetTimer=0;}
    }
    if(magnetTimer>0)magnetTimer-=dt;

    for(const o of objects){
      if(o.type==="track"||o.type==="obstacle"||o.type==="relic"||o.type==="powerup"||o.type==="scenery"){
        o.mesh.position.z+=speed*dt;
        if(o.type==="relic"||o.type==="powerup")o.mesh.rotation.y+=dt*3;
      }
    }

    while(nextSpawnZ>-distance-180){
      spawnChunk(nextSpawnZ);
      nextSpawnZ-=30;
    }

    for(const o of objects){
      const m=o.mesh;
      if(o.dead)continue;
      if((o.type==="obstacle"||o.type==="relic"||o.type==="powerup") &&
         Math.abs(m.position.z)<1.05 &&
         Math.abs(m.position.x-player.position.x)<1.05){
        if(o.type==="relic")collectRelic(o);
        else if(o.type==="powerup")activatePower(o);
        else{
          const safe=playerY>1.0 || (sliding>0&&m.userData.kind==="low");
          if(!safe && !m.userData.hit){
            m.userData.hit=true;
            if(activePower==="shield"){
              score+=150;
              activePower=null;powerTimer=0;
            }else{
              chase-=22;
              combo=0;
              m.position.z=8;
            }
          }else if(safe){
            score+=45;
            combo=Math.min(20,combo+1);
            comboTimer=1.5;
          }
        }
      }

      if(o.type==="relic"&&magnetTimer>0&&Math.abs(m.position.z)<16&&Math.abs(m.position.x-player.position.x)<6){
        m.position.x+=(player.position.x-m.position.x)*dt*5;
      }
    }

    objects=objects.filter(o=>{
      if(o.mesh.position.z>20){scene.remove(o.mesh);return false;}
      return true;
    });

    if(activePower==="boost")score+=speed*dt*12;
    if(chase>=100)chase=100;
    if(chase<=0)gameOver();

    player.rotation.z+=(targetX-player.position.x)*-.05;
    camera.position.x+=(player.position.x-camera.position.x)*dt*5;
    camera.position.y=5.2+playerY*.18;
    camera.lookAt(player.position.x,1.25,-12);
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

resetWorld();
hud();
showOverlay("start");
requestAnimationFrame(frame);

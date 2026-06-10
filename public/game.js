import * as THREE from 'three';

// ================== SİLAH TANIMLARI ==================
// Hasar sunucuda silah bazlı: rifle 100/33, smg 60/22, shotgun 28/12 (sacma basi), sniper 150/85
const GUNS = {
  rifle: {
    name: 'AK-47', mag: 30, fireDelay: 100, reloadTime: 2.4, auto: true,
    spread: 0.011, zoom: false, pellets: 1, kick: 0.013,
    snd: { freq: 1400, dur: 0.16, vol: 0.4, thump: 0 },
    color: 0x6e4a26,
  },
  smg: {
    name: 'MP5-SD', mag: 30, fireDelay: 60, reloadTime: 1.8, auto: true,
    spread: 0.024, zoom: false, pellets: 1, kick: 0.007,
    snd: { freq: 900, dur: 0.08, vol: 0.22, thump: 0 },
    color: 0x33384a,
  },
  shotgun: {
    name: 'XM1014', mag: 7, fireDelay: 900, reloadTime: 2.6, auto: false,
    spread: 0.05, zoom: false, pellets: 8, kick: 0.05,
    snd: { freq: 700, dur: 0.28, vol: 0.55, thump: 70 },
    color: 0x4a3526,
  },
  sniper: {
    name: 'AWP', mag: 5, fireDelay: 1400, reloadTime: 3.0, auto: false,
    spread: 0.002, zoom: true, pellets: 1, kick: 0.07,
    snd: { freq: 500, dur: 0.42, vol: 0.7, thump: 55 },
    color: 0x2e5e2e,
  },
};

// ================== AVATARLAR ==================
const AVATARS = {
  komando: { body: 0x3d5c3a, legs: 0x2c3a28, skin: 0xe0ac69, gear: 'band', gearColor: 0xb02e2e },
  polis:   { body: 0x24407e, legs: 0x1a2747, skin: 0xe8b882, gear: 'cap',  gearColor: 0x16294f },
  haydut:  { body: 0x5a4632, legs: 0x33291d, skin: 0x23232a, gear: 'mask', gearColor: 0x23232a },
  hayalet: { body: 0x8f9aa8, legs: 0x5d6672, skin: 0xece2d4, gear: 'hood', gearColor: 0x454c58 },
};

const EYE_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.4;
const MOVE_SPEED = 7.5;
const JUMP_VEL = 8;
const GRAVITY = 22;
const SEND_INTERVAL = 50; // ms

// ================== SOKET + MENÜ ==================
const socket = io();
const $ = (id) => document.getElementById(id);

let myName = 'Oyuncu';
let roomCode = '';
let gameRunning = false;
let myAvatar = localStorage.getItem('cs_avatar') || 'komando';
if (!AVATARS[myAvatar]) myAvatar = 'komando';

document.querySelectorAll('.avatar-card').forEach((card) => {
  card.classList.toggle('sel', card.dataset.av === myAvatar);
  card.onclick = () => {
    myAvatar = card.dataset.av;
    localStorage.setItem('cs_avatar', myAvatar);
    document.querySelectorAll('.avatar-card').forEach((c) => c.classList.toggle('sel', c === card));
  };
});

$('btn-create').onclick = () => {
  myName = $('name-input').value.trim() || 'Oyuncu';
  socket.emit('createRoom', { name: myName, avatar: myAvatar }, (res) => {
    if (res.error) return ($('menu-err').textContent = res.error);
    roomCode = res.code;
    showWaiting(res.code);
  });
};

$('btn-join').onclick = () => {
  myName = $('name-input').value.trim() || 'Oyuncu';
  const code = $('code-input').value.trim().toUpperCase();
  if (code.length < 4) return ($('menu-err').textContent = 'Geçerli bir oda kodu gir.');
  socket.emit('joinRoom', { code, name: myName, avatar: myAvatar }, (res) => {
    if (res.error) return ($('menu-err').textContent = res.error);
    roomCode = res.code;
    showWaiting(res.code);
  });
};

$('code-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });

function showWaiting(code) {
  $('menu').style.display = 'none';
  $('waiting').style.display = 'flex';
  $('code-display').textContent = code;
  $('waiting-hint').textContent = 'Rakip bekleniyor...';
}

$('code-display').onclick = async () => {
  try {
    await navigator.clipboard.writeText(roomCode);
    $('copy-info').textContent = 'Kod kopyalandı!';
    setTimeout(() => ($('copy-info').textContent = ''), 2000);
  } catch (_) {}
};

function toast(msg, ms = 2500) {
  const t = $('toast');
  t.textContent = msg;
  t.style.opacity = 1;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.style.opacity = 0), ms);
}

// ================== THREE.JS SAHNE ==================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87a8c8);
scene.fog = new THREE.Fog(0x87a8c8, 50, 120);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 300);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Işıklar
scene.add(new THREE.HemisphereLight(0xcfe5ff, 0x4a4434, 0.85));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.4);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
sun.shadow.camera.far = 150;
scene.add(sun);

// ================== HARİTA ==================
const MAP_SIZE = 60; // -30..30
const solids = [];       // raycast için mesh listesi (duvarlar/kasalar)
const colliders = [];    // {x,z,w,d,h} AABB çarpışma kutuları

function box(x, z, w, d, h, color, rotY = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, h / 2, z);
  m.rotation.y = rotY;
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  solids.push(m);
  if (rotY === 0) colliders.push({ x, z, w, d, h });
  return m;
}

// Zemin
{
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9a8f72';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 30; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 256, Math.random() * 256);
    ctx.lineTo(Math.random() * 256, Math.random() * 256);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(15, 15);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  solids.push(floor);
}

// Çevre duvarları
const WALL_H = 5;
box(0, -MAP_SIZE / 2, MAP_SIZE, 1, WALL_H, 0x8a6f4d);
box(0, MAP_SIZE / 2, MAP_SIZE, 1, WALL_H, 0x8a6f4d);
box(-MAP_SIZE / 2, 0, 1, MAP_SIZE, WALL_H, 0x8a6f4d);
box(MAP_SIZE / 2, 0, 1, MAP_SIZE, WALL_H, 0x8a6f4d);

// Orta kule + siper düzeni
box(0, 0, 5, 5, 2.6, 0xb0a285);            // orta blok (üstünde AWP doğar)
box(8, 0, 2, 2, 1.2, 0xc2873e);            // alçak kasalar (üstüne çıkılabilir)
box(-8, 0, 2, 2, 1.2, 0xc2873e);
box(0, 8, 2, 2, 1.2, 0xc2873e);
box(0, -8, 2, 2, 1.2, 0xc2873e);
box(14, 7, 6, 1.4, 2.6, 0x7d8a99);         // siper duvarları
box(-14, -7, 6, 1.4, 2.6, 0x7d8a99);
box(7, -14, 1.4, 6, 2.6, 0x7d8a99);
box(-7, 14, 1.4, 6, 2.6, 0x7d8a99);
box(20, -18, 3, 3, 2.2, 0xc2873e);         // köşe kasaları
box(-20, 18, 3, 3, 2.2, 0xc2873e);
box(18, 18, 2.5, 2.5, 1.2, 0xa56f31);
box(-18, -18, 2.5, 2.5, 1.2, 0xa56f31);
box(24, 6, 1.4, 8, 2.8, 0x7d8a99);
box(-24, -6, 1.4, 8, 2.8, 0x7d8a99);

// ================== YEREL OYUNCU ==================
const player = {
  pos: new THREE.Vector3(0, 0, 0), // ayak pozisyonu
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  onGround: true,
  hp: 100,
  alive: true,
  gun: 'rifle',
  ammo: GUNS.rifle.mag,
  reloading: false,
  reloadEnd: 0,
  lastShot: 0,
  zoomed: false,
  kills: 0,
};

const keys = {};
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyR') tryReload();
  if (e.code === 'KeyE') tryPickupWeapon();
});
addEventListener('keyup', (e) => (keys[e.code] = false));

// Fare / pointer lock
let mouseDown = false;
document.addEventListener('mousedown', (e) => {
  if (!gameRunning || document.pointerLockElement !== document.body) return;
  if (e.button === 0) { mouseDown = true; tryShoot(); }
  if (e.button === 2) toggleZoom(true);
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) toggleZoom(false);
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- Hassasiyet (ayarlanabilir, localStorage'da saklanir) ----
const BASE_SENS = 0.002;
let sensMult = parseFloat(localStorage.getItem('cs_sens')) || 1;

function setSens(v) {
  sensMult = Math.max(0.2, Math.min(3, v));
  localStorage.setItem('cs_sens', sensMult);
  for (const [s, l] of [['sens-slider', 'sens-val'], ['sens-slider2', 'sens-val2']]) {
    $(s).value = sensMult;
    $(l).textContent = sensMult.toFixed(2);
  }
}
$('sens-slider').oninput = (e) => setSens(parseFloat(e.target.value));
$('sens-slider2').oninput = (e) => setSens(parseFloat(e.target.value));
setSens(sensMult);

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== document.body || !player.alive) return;
  // FOV'a orantılı: zoom'dayken hassasiyet otomatik düşer (tutarlı ADS hissi)
  const sens = BASE_SENS * sensMult * (camera.fov / 75);
  player.yaw -= e.movementX * sens;
  player.pitch -= e.movementY * sens;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
});

document.addEventListener('pointerlockchange', () => {
  if (gameRunning && document.pointerLockElement !== document.body) {
    $('resume-title').textContent = 'DURAKLADI';
    $('resume-sub').textContent = 'Oyuna dönmek için tıkla';
    $('resume').style.display = 'flex';
  } else {
    $('resume').style.display = 'none';
  }
});
$('btn-resume').onclick = () => document.body.requestPointerLock();

function toggleZoom(on) {
  if (!GUNS[player.gun].zoom) { player.zoomed = false; camera.fov = 75; camera.updateProjectionMatrix(); return; }
  player.zoomed = on;
  camera.fov = on ? 22 : 75;
  camera.updateProjectionMatrix();
  gunGroup.visible = !on;
  $('crosshair').style.display = on ? 'block' : 'block';
}

// ================== SİLAH GÖRSELİ (viewmodel) ==================
const gunGroup = new THREE.Group();
camera.add(gunGroup);
scene.add(camera);
let gunRecoil = 0;

// Her silaha özgü detaylı model (viewmodel + yerdeki silahlar aynı modeli kullanır)
function makeGunMesh(type) {
  const g = GUNS[type];
  const grp = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x23252c, roughness: 0.45, metalness: 0.65 });
  const body = new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.6, metalness: 0.25 });
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    grp.add(m);
    return m;
  };

  // Ortak: gövde + kabza
  add(new THREE.BoxGeometry(0.085, 0.12, 0.46), metal, 0, 0, 0);
  add(new THREE.BoxGeometry(0.07, 0.17, 0.09), metal, 0, -0.13, 0.12);

  if (type === 'rifle') {
    add(new THREE.BoxGeometry(0.078, 0.08, 0.3), body, 0, -0.005, -0.34);                       // ahşap el kundağı
    const mag = add(new THREE.BoxGeometry(0.055, 0.22, 0.1), metal, 0, -0.15, -0.03);           // muz şarjör
    mag.rotation.x = 0.4;
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), metal, 0, 0.02, -0.66, Math.PI / 2);  // namlu
    add(new THREE.BoxGeometry(0.02, 0.05, 0.02), metal, 0, 0.075, -0.86);                       // arpacık
    add(new THREE.BoxGeometry(0.07, 0.1, 0.26), body, 0, -0.02, 0.34);                          // ahşap dipçik
  } else if (type === 'smg') {
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 10), metal, 0, 0.01, -0.5, Math.PI / 2);   // susturucu
    add(new THREE.BoxGeometry(0.05, 0.24, 0.07), metal, 0, -0.17, -0.08);                       // dik şarjör
    add(new THREE.BoxGeometry(0.02, 0.06, 0.2), metal, 0, 0, 0.33);                             // teleskopik dipçik
    add(new THREE.BoxGeometry(0.03, 0.045, 0.03), metal, 0, 0.08, -0.28);                       // gez
  } else if (type === 'shotgun') {
    add(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 8), metal, 0, 0.035, -0.66, Math.PI / 2); // namlu
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), metal, 0, -0.025, -0.58, Math.PI / 2); // fişek tüpü
    add(new THREE.BoxGeometry(0.075, 0.06, 0.16), body, 0, -0.03, -0.42);                        // pompa
    add(new THREE.BoxGeometry(0.07, 0.11, 0.3), body, 0, -0.03, 0.34);                           // dipçik
  } else if (type === 'sniper') {
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 8), metal, 0, 0.01, -0.8, Math.PI / 2);     // uzun namlu
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 10), metal, 0, 0.13, -0.02, Math.PI / 2); // dürbün
    add(new THREE.CylinderGeometry(0.046, 0.046, 0.03, 10), metal, 0, 0.13, 0.11, Math.PI / 2);  // dürbün merceği
    add(new THREE.BoxGeometry(0.078, 0.09, 0.34), body, 0, -0.01, -0.33);                        // yeşil gövde
    add(new THREE.BoxGeometry(0.07, 0.12, 0.3), body, 0, -0.03, 0.36);                           // dipçik
  }
  return grp;
}

function buildGunModel(type) {
  while (gunGroup.children.length) gunGroup.remove(gunGroup.children[0]);
  gunGroup.add(makeGunMesh(type));
  gunGroup.position.set(0.28, -0.24, -0.5);
  gunGroup.rotation.set(0, 0, 0);
}
buildGunModel('rifle');

// Namlu alevi: ışık + parlayan sprite
const flash = new THREE.PointLight(0xffc966, 0, 6);
flash.position.set(0.28, -0.2, -1.1);
camera.add(flash);

function makeFlashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,240,190,1)');
  grd.addColorStop(0.35, 'rgba(255,180,70,0.9)');
  grd.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeFlashTexture(), transparent: true, opacity: 0,
  depthTest: false, blending: THREE.AdditiveBlending,
}));
flashSprite.scale.set(0.35, 0.35, 1);
flashSprite.position.set(0.28, -0.2, -1.05);
camera.add(flashSprite);

// ================== RAKİP MODELİ ==================
let enemy = null; // {id, name, group, head, body, targetPos, targetYaw, hp, kills, alive}

function makeNameSprite(name) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 34px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const w = ctx.measureText(name).width + 24;
  ctx.fillRect(128 - w / 2, 8, w, 46);
  ctx.fillStyle = '#fff';
  ctx.fillText(name, 128, 42);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.scale.set(2.2, 0.55, 1);
  sp.position.y = 2.35;
  return sp;
}

function createEnemy(info) {
  const av = AVATARS[info.avatar] || AVATARS.komando;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: av.body, roughness: 0.7 });
  const skinMat = new THREE.MeshStandardMaterial({ color: av.skin, roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.3, 0.45), bodyMat);
  body.position.y = 0.95;
  body.castShadow = true;
  body.userData.part = 'body';

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 0.18), bodyMat);
  armL.position.set(-0.5, 1.05, 0);
  armL.castShadow = true;
  armL.userData.part = 'body';
  const armR = armL.clone();
  armR.position.x = 0.5;

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.4), new THREE.MeshStandardMaterial({ color: av.legs }));
  legs.position.y = 0.3;
  legs.castShadow = true;
  legs.userData.part = 'body';

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  head.position.y = 1.82;
  head.castShadow = true;
  head.userData.part = 'head';

  // Gözler (ön yüz -z yönünde): beyaz + siyah göz bebeği
  const eyeW = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyeB = new THREE.MeshBasicMaterial({ color: 0x14161c });
  for (const sx of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.02), eyeW);
    white.position.set(sx * 0.1, 1.87, -0.215);
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.015), eyeB);
    pupil.position.set(sx * 0.1, 1.865, -0.228);
    group.add(white, pupil);
  }

  // Başlık / aksesuar
  const gearMat = new THREE.MeshStandardMaterial({ color: av.gearColor, roughness: 0.7 });
  if (av.gear === 'band') {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.46), gearMat);
    band.position.y = 1.97;
    group.add(band);
  } else if (av.gear === 'cap') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46), gearMat);
    top.position.y = 2.06;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.22), gearMat);
    brim.position.set(0, 2.0, -0.32);
    group.add(top, brim);
  } else if (av.gear === 'hood') {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.46), gearMat);
    hood.position.set(0, 1.95, 0.05);
    group.add(hood);
  }
  // 'mask' (haydut): kafa rengi zaten koyu kar maskesi, gözler beyaz parlıyor

  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.7), new THREE.MeshStandardMaterial({ color: 0x222 }));
  gun.position.set(0.3, 1.3, -0.4);

  group.add(body, armL, armR, legs, head, gun, makeNameSprite(info.name));
  group.position.set(info.pos[0], info.pos[1], info.pos[2]);
  group.rotation.y = info.yaw || 0;
  scene.add(group);

  return {
    id: info.id, name: info.name, group, head, body, legs, armL, armR,
    targetPos: new THREE.Vector3(info.pos[0], info.pos[1], info.pos[2]),
    targetYaw: info.yaw || 0,
    hp: info.hp, kills: info.kills || 0, alive: true, protUntil: 0,
  };
}

function removeEnemy() {
  if (enemy) { scene.remove(enemy.group); enemy = null; }
}

// ================== YERDEKİ NESNELER ==================
const groundWeapons = new Map(); // id -> {type, mesh, pos}
const healthPacks = new Map();   // id -> {mesh, pos}

function spawnGroundWeapon(w) {
  const grp = new THREE.Group();
  const mesh = makeGunMesh(w.type);
  mesh.scale.set(1.7, 1.7, 1.7);
  grp.add(mesh);
  // Altında dönen ışıklı halka (fark edilsin diye)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.035, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffb13d, transparent: true, opacity: 0.55 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.6;
  grp.add(ring);

  // Orta bloğun üstüne mi düz zemine mi?
  const gy = groundHeightAt(w.pos[0], w.pos[2]);
  grp.position.set(w.pos[0], gy + 0.8, w.pos[2]);
  scene.add(grp);
  groundWeapons.set(w.id, { type: w.type, mesh: grp, pos: new THREE.Vector3(w.pos[0], gy, w.pos[2]) });
}

function spawnHealthPack(id, pos) {
  const grp = new THREE.Group();
  const boxM = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.4, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4 })
  );
  const crossMat = new THREE.MeshStandardMaterial({ color: 0x21c25c, emissive: 0x21c25c, emissiveIntensity: 0.6 });
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.41), crossMat);
  c1.position.y = 0.21;
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.41), crossMat);
  c2.rotation.x = Math.PI / 2;
  c2.position.y = 0.21;
  const light = new THREE.PointLight(0x21c25c, 1.5, 5);
  light.position.y = 0.8;
  grp.add(boxM, c1, c2, light);
  const gy = groundHeightAt(pos[0], pos[2]);
  grp.position.set(pos[0], gy + 0.5, pos[2]);
  scene.add(grp);
  healthPacks.set(id, { mesh: grp, pos: new THREE.Vector3(pos[0], gy, pos[2]) });
}

// ================== ÇARPIŞMA ==================
function groundHeightAt(x, z) {
  let h = 0;
  for (const b of colliders) {
    if (b.h > 3) continue; // duvarların üstüne çıkılmaz
    if (Math.abs(x - b.x) <= b.w / 2 + PLAYER_RADIUS * 0.6 &&
        Math.abs(z - b.z) <= b.d / 2 + PLAYER_RADIUS * 0.6) {
      h = Math.max(h, b.h);
    }
  }
  return h;
}

function resolveCollisions() {
  const p = player.pos;
  for (const b of colliders) {
    // Üstündeysek yatay itme yok
    if (p.y >= b.h - 0.15) continue;
    const minX = b.x - b.w / 2 - PLAYER_RADIUS, maxX = b.x + b.w / 2 + PLAYER_RADIUS;
    const minZ = b.z - b.d / 2 - PLAYER_RADIUS, maxZ = b.z + b.d / 2 + PLAYER_RADIUS;
    if (p.x > minX && p.x < maxX && p.z > minZ && p.z < maxZ) {
      const dxl = p.x - minX, dxr = maxX - p.x;
      const dzl = p.z - minZ, dzr = maxZ - p.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) p.x = minX;
      else if (m === dxr) p.x = maxX;
      else if (m === dzl) p.z = minZ;
      else p.z = maxZ;
    }
  }
  // Harita sınırları
  const lim = MAP_SIZE / 2 - 0.6 - PLAYER_RADIUS;
  p.x = Math.max(-lim, Math.min(lim, p.x));
  p.z = Math.max(-lim, Math.min(lim, p.z));
}

// ================== SES (WebAudio) ==================
let audioCtx = null;
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playShotSound(gun = 'rifle', loud = 1) {
  try {
    const ctx = ac();
    const s = (GUNS[gun] || GUNS.rifle).snd;
    const buf = ctx.createBuffer(1, Math.max(1, (ctx.sampleRate * s.dur) | 0), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(s.freq * 2, ctx.currentTime);
    filt.frequency.exponentialRampToValueAtTime(Math.max(80, s.freq * 0.4), ctx.currentTime + s.dur);
    const gain = ctx.createGain();
    gain.gain.value = s.vol * loud;
    src.connect(filt).connect(gain).connect(ctx.destination);
    src.start();
    // Büyük silahlarda göğüs titreten alçak frekanslı patlama
    if (s.thump) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(s.thump, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.25);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.5 * loud, ctx.currentTime);
      og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(og).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
    }
  } catch (_) {}
}
function playBlip(freq, dur = 0.08, vol = 0.2) {
  try {
    const ctx = ac();
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch (_) {}
}

// ================== ATEŞ ETME + EFEKTLER ==================
const raycaster = new THREE.Raycaster();
const tracers = [];   // {mesh, life}
const particles = []; // {pts, vels, life, max, grav}
const shells = [];    // {mesh, vel, rvel, life}

function addTracer(from, to) {
  const len = from.distanceTo(to);
  if (len < 0.5) return;
  const geo = new THREE.CylinderGeometry(0.012, 0.012, len, 4, 1);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffd9a0, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(from).lerp(to, 0.5);
  m.lookAt(to);
  scene.add(m);
  tracers.push({ mesh: m, life: 0.08 });
}

function spawnParticles(pos, color, count, speed, grav, life, size = 0.05) {
  const positions = new Float32Array(count * 3);
  const vels = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = pos.x;
    positions[i * 3 + 1] = pos.y;
    positions[i * 3 + 2] = pos.z;
    vels.push(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5)
      .normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6)));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 1, depthWrite: false }));
  scene.add(pts);
  particles.push({ pts, vels, life, max: life, grav });
}

function impactEffect(point, isFlesh) {
  if (isFlesh) {
    spawnParticles(point, 0xb02020, 14, 3.5, 9, 0.45, 0.06);  // kan
  } else {
    spawnParticles(point, 0xffcf8a, 8, 4.5, 10, 0.3, 0.04);   // kıvılcım
    spawnParticles(point, 0x9a8f72, 6, 2, 4, 0.5, 0.07);      // toz
  }
}

function ejectShell() {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.05, 6),
    new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.3 })
  );
  mesh.position.copy(gunGroup.localToWorld(new THREE.Vector3(0.05, 0.05, -0.1)));
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const vel = right.multiplyScalar(1.5 + Math.random()).add(new THREE.Vector3(0, 2.2 + Math.random(), 0));
  scene.add(mesh);
  shells.push({ mesh, vel, rvel: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0), life: 1.1 });
}

function tryShoot() {
  if (!gameRunning || !player.alive || player.reloading) return;
  const g = GUNS[player.gun];
  const now = performance.now();
  if (now - player.lastShot < g.fireDelay) return;
  if (player.ammo <= 0) { playBlip(200, 0.06, 0.12); tryReload(); return; }

  player.lastShot = now;
  player.ammo--;
  updateAmmoHUD();
  playShotSound(player.gun);
  flash.intensity = 4;
  flashSprite.material.rotation = Math.random() * Math.PI * 2;
  flashSprite.material.opacity = 1;
  flashSprite.scale.setScalar(0.3 + Math.random() * 0.15 + (g.pellets > 1 ? 0.2 : 0));
  gunRecoil = 1;
  ejectShell();
  // Geri tepme: silaha göre dikey tekme + hafif rastgele yatay sapma
  player.pitch += g.kick * (0.8 + Math.random() * 0.4);
  player.yaw += (Math.random() - 0.5) * g.kick * 0.5;

  const origin = camera.getWorldPosition(new THREE.Vector3());
  const baseDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const muzzle = gunGroup.localToWorld(new THREE.Vector3(0, 0.02, -0.7));
  const enemyProtected = enemy && enemy.protUntil > Date.now();

  const targets = [...solids];
  if (enemy && enemy.alive) targets.push(enemy.head, enemy.body, enemy.legs, enemy.armL, enemy.armR);

  const tos = [];
  let hitHead = false, hitAny = false;

  // Pompalı 8 saçma atar, diğerleri tek mermi
  for (let i = 0; i < g.pellets; i++) {
    const dir = baseDir.clone();
    const sp = player.zoomed ? 0 : g.spread;
    dir.x += (Math.random() - 0.5) * sp * 2;
    dir.y += (Math.random() - 0.5) * sp * 2;
    dir.z += (Math.random() - 0.5) * sp * 2;
    dir.normalize();

    raycaster.set(origin, dir);
    raycaster.far = 200;
    const hits = raycaster.intersectObjects(targets, false);

    let endPoint = origin.clone().add(dir.clone().multiplyScalar(120));
    if (hits.length > 0) {
      endPoint = hits[0].point;
      const part = hits[0].object.userData.part;
      if (part) {
        socket.emit('hit', { part, gun: player.gun });
        if (!enemyProtected) {
          hitAny = true;
          if (part === 'head') hitHead = true;
        }
        impactEffect(endPoint, true);
      } else {
        impactEffect(endPoint, false);
      }
    }
    addTracer(muzzle, endPoint);
    tos.push(endPoint.toArray());
  }

  if (hitAny) {
    showHitmarker(hitHead);
    playBlip(hitHead ? 880 : 600, 0.07, 0.25);
  }
  socket.emit('shoot', { from: muzzle.toArray(), tos, gun: player.gun });
}

function showHitmarker(head) {
  const hm = $('hitmarker');
  hm.classList.toggle('head', head);
  hm.style.opacity = 1;
  clearTimeout(hm._timer);
  hm._timer = setTimeout(() => (hm.style.opacity = 0), 120);
}

function tryReload() {
  if (!gameRunning || !player.alive || player.reloading) return;
  const g = GUNS[player.gun];
  if (player.ammo >= g.mag) return;
  player.reloading = true;
  player.reloadEnd = performance.now() + g.reloadTime * 1000;
  $('reloadtext').textContent = 'ŞARJÖR DEĞİŞİYOR...';
  playBlip(350, 0.1, 0.15);
  socket.emit('reloading');
}

function finishReload() {
  player.reloading = false;
  player.ammo = GUNS[player.gun].mag;
  $('reloadtext').textContent = '';
  updateAmmoHUD();
  playBlip(520, 0.08, 0.15);
}

function switchGun(type) {
  player.gun = type;
  player.ammo = GUNS[type].mag;
  player.reloading = false;
  $('reloadtext').textContent = '';
  toggleZoom(false);
  buildGunModel(type);
  $('weaponname').textContent = GUNS[type].name;
  updateAmmoHUD();
}

// ================== YERDEN ALMA ==================
let nearbyWeaponId = null;

function tryPickupWeapon() {
  if (nearbyWeaponId !== null) socket.emit('pickupWeapon', nearbyWeaponId);
}

function checkPickups() {
  if (!player.alive) return;
  // Silahlar: yakındaysa ipucu göster
  nearbyWeaponId = null;
  let nearest = Infinity;
  for (const [id, w] of groundWeapons) {
    const d = player.pos.distanceTo(w.pos);
    if (d < 2.2 && d < nearest) { nearest = d; nearbyWeaponId = id; }
  }
  const hint = $('pickup-hint');
  if (nearbyWeaponId !== null) {
    hint.style.display = 'block';
    $('pickup-name').textContent = GUNS[groundWeapons.get(nearbyWeaponId).type].name;
  } else {
    hint.style.display = 'none';
  }

  // Sağlık paketleri: üzerinden geçince otomatik
  if (player.hp < 100) {
    for (const [id, p] of healthPacks) {
      if (player.pos.distanceTo(p.pos) < 1.4) {
        socket.emit('pickupHealth', id);
        break;
      }
    }
  }
}

// ================== HUD ==================
function updateHpHUD() {
  const hp = Math.max(0, player.hp);
  $('hpbar').style.width = hp + '%';
  $('hptext').textContent = hp;
  $('hpbar').style.background = hp > 60
    ? 'linear-gradient(90deg,#2ecc71,#27ae60)'
    : hp > 30
      ? 'linear-gradient(90deg,#f39c12,#e67e22)'
      : 'linear-gradient(90deg,#e74c3c,#c0392b)';
}
function updateAmmoHUD() {
  $('ammo').innerHTML = `${player.ammo} <small>/ ${GUNS[player.gun].mag}</small>`;
}
function updateScoreHUD() {
  $('score-me').textContent = player.kills;
  $('score-en').textContent = enemy ? enemy.kills : 0;
  $('score-me-name').textContent = myName;
  $('score-en-name').textContent = enemy ? enemy.name : 'Rakip';
}
function killFeed(text) {
  const div = document.createElement('div');
  div.className = 'feed-item';
  div.textContent = text;
  $('killfeed').prepend(div);
  setTimeout(() => div.remove(), 4500);
}
function damageFlash() {
  const v = $('dmg-vignette');
  v.style.opacity = 1;
  clearTimeout(v._timer);
  v._timer = setTimeout(() => (v.style.opacity = 0), 350);
}

// ================== SOKET OLAYLARI ==================
socket.on('start', ({ players, weapons }) => {
  removeEnemy();
  for (const w of [...groundWeapons.values()]) scene.remove(w.mesh);
  groundWeapons.clear();
  for (const p of [...healthPacks.values()]) scene.remove(p.mesh);
  healthPacks.clear();

  for (const info of players) {
    if (info.id === socket.id) {
      player.pos.set(info.pos[0], info.pos[1], info.pos[2]);
      player.yaw = info.yaw;
      player.pitch = 0;
      player.hp = info.hp;
      player.alive = true;
      player.kills = info.kills;
      switchGun('rifle');
    } else {
      enemy = createEnemy(info);
    }
  }
  for (const w of weapons) spawnGroundWeapon(w);

  $('waiting').style.display = 'none';
  $('menu').style.display = 'none';
  $('hud').style.display = 'block';
  $('death-overlay').style.display = 'none';
  $('roomtag-code').textContent = roomCode;
  gameRunning = true;
  updateHpHUD(); updateAmmoHUD(); updateScoreHUD();
  toast('Rakip geldi! Savaş başladı!');
  // Pointer lock yalnızca gerçek bir kullanıcı tıklamasından sonra açılabilir
  // (tarayıcı kısıtı). Otomatik açmaya çalışmak sessizce reddedilir ve oyuncu
  // donar. Bu yüzden "tıkla ve başla" ekranını gösteriyoruz; kilit btn-resume
  // tıklamasıyla açılır.
  $('resume-title').textContent = 'SAVAŞ BAŞLADI';
  $('resume-sub').textContent = 'Oyuna girmek için tıkla';
  $('resume').style.display = 'flex';
});

socket.on('enemyMove', (d) => {
  if (!enemy) return;
  enemy.targetPos.set(d.p[0], d.p[1], d.p[2]);
  enemy.targetYaw = d.y;
});

socket.on('enemyShoot', ({ from, to, tos, gun }) => {
  const f = new THREE.Vector3(...from);
  const ends = tos || (to ? [to] : []);
  for (const t of ends) {
    const e = new THREE.Vector3(...t);
    addTracer(f, e);
    impactEffect(e, false);
  }
  // Mesafeye göre ses
  const dist = player.pos.distanceTo(f);
  playShotSound(gun || 'rifle', Math.max(0.15, 1 - dist / 70));
});

socket.on('health', ({ id, hp, part }) => {
  if (id === socket.id) {
    const dropped = player.hp - hp;
    player.hp = hp;
    updateHpHUD();
    if (dropped > 0) { damageFlash(); playBlip(150, 0.12, 0.3); }
  } else if (enemy && enemy.id === id) {
    enemy.hp = hp;
  }
});

socket.on('death', ({ victim, killer, headshot, scores }) => {
  if (enemy) enemy.kills = scores[enemy.id] ?? enemy.kills;
  player.kills = scores[socket.id] ?? player.kills;
  updateScoreHUD();

  const killerName = killer === socket.id ? myName : (enemy ? enemy.name : 'Rakip');
  const victimName = victim === socket.id ? myName : (enemy ? enemy.name : 'Rakip');
  killFeed(`${killerName} ${headshot ? '🎯 (KAFADAN)' : '💀'} ${victimName}`);

  if (victim === socket.id) {
    player.alive = false;
    player.hp = 0;
    updateHpHUD();
    $('death-overlay').style.display = 'flex';
    let cnt = 3;
    $('respawn-count').textContent = cnt;
    const iv = setInterval(() => {
      cnt--;
      if (cnt <= 0) clearInterval(iv);
      else $('respawn-count').textContent = cnt;
    }, 1000);
  } else if (enemy && enemy.id === victim) {
    enemy.alive = false;
    enemy.group.rotation.x = -Math.PI / 2; // yere yat
    enemy.group.position.y = 0.3;
    toast(headshot ? 'KAFADAN TEK ATTIN! 🎯' : 'Rakibi öldürdün! 💀');
  }
});

socket.on('respawn', ({ id, pos, yaw, hp, prot }) => {
  if (id === socket.id) {
    player.pos.set(pos[0], pos[1], pos[2]);
    player.yaw = yaw || 0;
    player.pitch = 0;
    player.vel.set(0, 0, 0);
    player.hp = hp;
    player.alive = true;
    switchGun(player.gun); // şarjörü doldur
    $('death-overlay').style.display = 'none';
    updateHpHUD();
    if (prot) {
      const ph = $('prot-hint');
      ph.style.display = 'block';
      clearTimeout(ph._timer);
      ph._timer = setTimeout(() => (ph.style.display = 'none'), prot);
    }
  } else if (enemy && enemy.id === id) {
    enemy.alive = true;
    enemy.hp = hp;
    enemy.group.rotation.x = 0;
    enemy.group.position.set(pos[0], pos[1], pos[2]);
    enemy.targetPos.set(pos[0], pos[1], pos[2]);
    enemy.protUntil = Date.now() + (prot || 0); // korumalıyken model yanıp söner
  }
});

socket.on('healthSpawn', ({ id, pos }) => {
  spawnHealthPack(id, pos);
  toast('💚 Haritada sağlık paketi belirdi!');
  playBlip(700, 0.15, 0.15);
});

socket.on('healthTaken', ({ id, by, hp }) => {
  const p = healthPacks.get(id);
  if (p) { scene.remove(p.mesh); healthPacks.delete(id); }
  if (by === socket.id) {
    player.hp = hp;
    updateHpHUD();
    toast('+40 CAN 💚');
    playBlip(900, 0.12, 0.2);
  } else if (enemy) {
    enemy.hp = hp;
  }
});

socket.on('weaponTaken', ({ id, by, type }) => {
  const w = groundWeapons.get(id);
  if (w) { scene.remove(w.mesh); groundWeapons.delete(id); }
  if (by === socket.id) {
    switchGun(type);
    toast(`${GUNS[type].name} aldın!`);
    playBlip(650, 0.1, 0.2);
  }
});

socket.on('weaponSpawn', (w) => {
  spawnGroundWeapon(w);
});

socket.on('opponentLeft', ({ name }) => {
  gameRunning = false;
  removeEnemy();
  document.exitPointerLock();
  $('hud').style.display = 'none';
  $('resume').style.display = 'none';
  $('waiting').style.display = 'flex';
  $('code-display').textContent = roomCode;
  $('waiting-hint').textContent = `${name} oyundan ayrıldı. Yeni rakip bekleniyor...`;
});

socket.on('disconnect', () => {
  if (gameRunning) toast('Sunucu bağlantısı koptu!', 5000);
});

// ================== ANA DÖNGÜ ==================
let lastSend = 0;
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();

  if (gameRunning) {
    // --- Hareket ---
    if (player.alive && document.pointerLockElement === document.body) {
      const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const move = new THREE.Vector3();
      if (keys['KeyW']) move.add(fwd);
      if (keys['KeyS']) move.sub(fwd);
      if (keys['KeyD']) move.add(right);
      if (keys['KeyA']) move.sub(right);
      if (move.lengthSq() > 0) move.normalize().multiplyScalar(MOVE_SPEED);

      player.pos.x += move.x * dt;
      player.pos.z += move.z * dt;
      resolveCollisions();

      // Yerçekimi
      const ground = groundHeightAt(player.pos.x, player.pos.z);
      player.vel.y -= GRAVITY * dt;
      player.pos.y += player.vel.y * dt;
      if (player.pos.y <= ground && player.vel.y <= 0) {
        player.pos.y = ground;
        player.vel.y = 0;
        player.onGround = true;
      } else {
        player.onGround = player.pos.y - ground < 0.05;
      }
      if (keys['Space'] && player.onGround) {
        player.vel.y = JUMP_VEL;
        player.onGround = false;
      }

      // Otomatik ateş
      if (mouseDown && GUNS[player.gun].auto) tryShoot();
    }

    // Şarjör bitti mi
    if (player.reloading && now >= player.reloadEnd) finishReload();

    // Kamera
    camera.position.set(player.pos.x, player.pos.y + EYE_HEIGHT, player.pos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;

    // Silah animasyonu (geri tepme + sallanma)
    gunRecoil = Math.max(0, gunRecoil - dt * 8);
    const bob = Math.sin(now * 0.012) * 0.006 * (keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] ? 1 : 0.2);
    gunGroup.position.z = -0.5 + gunRecoil * 0.12;
    gunGroup.position.y = -0.24 + bob + (player.reloading ? -0.15 : 0);
    gunGroup.rotation.x = gunRecoil * 0.15 + (player.reloading ? 0.4 : 0);
    flash.intensity = Math.max(0, flash.intensity - dt * 30);
    flashSprite.material.opacity = Math.max(0, flashSprite.material.opacity - dt * 20);

    // Rakip yumuşatma
    if (enemy) {
      enemy.group.position.lerp(enemy.targetPos, Math.min(1, dt * 14));
      if (enemy.alive) {
        let dy = enemy.targetYaw - enemy.group.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        enemy.group.rotation.y += dy * Math.min(1, dt * 14);
      }
      // Doğum koruması: model yanıp söner
      if (enemy.protUntil > Date.now()) {
        enemy.group.visible = Math.floor(now / 90) % 2 === 0;
      } else if (!enemy.group.visible) {
        enemy.group.visible = true;
      }
    }

    // Yerdeki nesne animasyonları
    for (const w of groundWeapons.values()) {
      w.mesh.rotation.y += dt * 1.5;
      w.mesh.position.y = w.pos.y + 0.8 + Math.sin(now * 0.003) * 0.1;
    }
    for (const p of healthPacks.values()) {
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = p.pos.y + 0.5 + Math.sin(now * 0.004) * 0.12;
    }

    checkPickups();

    // Pozisyon gönder
    if (now - lastSend > SEND_INTERVAL) {
      lastSend = now;
      socket.volatile.emit('move', {
        p: [+player.pos.x.toFixed(2), +player.pos.y.toFixed(2), +player.pos.z.toFixed(2)],
        y: +player.yaw.toFixed(3),
      });
    }
  }

  // Tracer söndürme
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= dt;
    t.mesh.material.opacity = Math.max(0, t.life / 0.08) * 0.85;
    if (t.life <= 0) {
      scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
      tracers.splice(i, 1);
    }
  }

  // Parçacıklar (kıvılcım / toz / kan)
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    const arr = p.pts.geometry.attributes.position.array;
    for (let j = 0; j < p.vels.length; j++) {
      p.vels[j].y -= p.grav * dt;
      arr[j * 3] += p.vels[j].x * dt;
      arr[j * 3 + 1] += p.vels[j].y * dt;
      arr[j * 3 + 2] += p.vels[j].z * dt;
    }
    p.pts.geometry.attributes.position.needsUpdate = true;
    p.pts.material.opacity = Math.max(0, p.life / p.max);
    if (p.life <= 0) {
      scene.remove(p.pts);
      p.pts.geometry.dispose();
      p.pts.material.dispose();
      particles.splice(i, 1);
    }
  }

  // Fırlatılan kovanlar
  for (let i = shells.length - 1; i >= 0; i--) {
    const s = shells[i];
    s.life -= dt;
    s.vel.y -= GRAVITY * dt * 0.6;
    s.mesh.position.addScaledVector(s.vel, dt);
    s.mesh.rotation.x += s.rvel.x * dt;
    s.mesh.rotation.y += s.rvel.y * dt;
    if (s.mesh.position.y < 0.03) {
      s.mesh.position.y = 0.03;
      s.vel.set(0, 0, 0);
      s.rvel.set(0, 0, 0);
    }
    if (s.life <= 0) {
      scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      shells.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}
animate();

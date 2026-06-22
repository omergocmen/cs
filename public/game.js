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
  kingrifle: {
    name: 'KRAL 6 PATLAR', mag: 6, fireDelay: 950, reloadTime: 3.1, auto: false,
    spread: 0.006, zoom: false, pellets: 1, kick: 0.075,
    snd: { freq: 380, dur: 0.36, vol: 0.78, thump: 95 },
    color: 0xb02e2e,
  },
  // Kilic: yakin dovus (melee). Mermi/sarjor yok, sol tik ile savrulur.
  sword: {
    name: 'Kılıç', mag: 1, fireDelay: 480, reloadTime: 0, auto: false,
    spread: 0, zoom: false, pellets: 0, kick: 0, melee: true, range: 2.8,
    snd: { freq: 300, dur: 0.12, vol: 0.25, thump: 0 },
    color: 0xd7dde6,
  },
};

// ================== AVATARLAR ==================
const AVATARS = {
  komando: { body: 0x3d5c3a, legs: 0x2c3a28, skin: 0xe0ac69, gear: 'band', gearColor: 0xb02e2e },
  polis:   { body: 0x24407e, legs: 0x1a2747, skin: 0xe8b882, gear: 'cap',  gearColor: 0x16294f },
  haydut:  { body: 0x5a4632, legs: 0x33291d, skin: 0x23232a, gear: 'mask', gearColor: 0x23232a },
  hayalet: { body: 0x8f9aa8, legs: 0x5d6672, skin: 0xece2d4, gear: 'hood', gearColor: 0x454c58 },
  // --- Komik karakterler ---
  palyaco: { body: 0xff3b5c, legs: 0x3bc1ff, skin: 0xfff0e6, gear: 'clown',   gearColor: 0xffd23b }, // 🤡 Palyaço
  prenses: { body: 0xff7ec8, legs: 0xffffff, skin: 0xffe0c4, gear: 'bow',     gearColor: 0xff9ed6 }, // 👑 Prenses (pembe-beyaz)
  uzayli:  { body: 0x57c84d, legs: 0x2f8f2f, skin: 0x86e57f, gear: 'antenna', gearColor: 0x2f8f2f }, // 👽 Uzaylı
  robot:   { body: 0xb4bcc8, legs: 0x7a828e, skin: 0xd8dee8, gear: 'visor',   gearColor: 0x222a36 }, // 🤖 Robot
  sapsal:  { body: 0xc77b3a, legs: 0x6b4a2a, skin: 0xe8b882, gear: 'glasses', gearColor: 0x14161c }, // 🤓 Şapşal
};

const STAND_EYE_HEIGHT = 1.6;
const CROUCH_EYE_HEIGHT = 1.0;
const PLAYER_RADIUS = 0.4;
const MOVE_SPEED = 7.5;
const CROUCH_SPEED = 3.8;
const JUMP_VEL = 8;
const GRAVITY = 22;
const SEND_INTERVAL = 33; // ms (~30Hz)
const ENEMY_INTERP_DELAY = 100; // ms: gelen hareket paketlerini kisa bir gecikmeyle yumusat
const ENEMY_EXTRAP_MAX = 100;   // ms: paket gecikince son cizgide en fazla bu kadar ileri tahmin et

// ================== SOKET + MENÜ ==================
const socket = io();
const $ = (id) => document.getElementById(id);

let myName = 'Oyuncu';
let roomCode = '';
let gameRunning = false;
let gameMode = localStorage.getItem('cs_mode') || 'duel';
let arenaChoice = localStorage.getItem('cs_arena') || 'depot';
let myTeam = null;
let currentRound = 1;
let teamScores = { police: 0, bandit: 0 };
let ffaWins = {}; // kilic modu: id -> round galibiyeti
let kingWins = {}; // kral modu: id -> kral devirme sayisi
let myAvatar = localStorage.getItem('cs_avatar') || 'komando';
if (!AVATARS[myAvatar]) myAvatar = 'komando';
if (!['duel', 'arena', 'team', 'gungame', 'domination', 'kilic', 'kral', 'awp', 'futbol'].includes(gameMode)) gameMode = 'duel';
if (!['depot', 'lanes', 'fortress', 'yard', 'crossfire', 'futbol'].includes(arenaChoice)) arenaChoice = 'depot';
let footyScore = { police: 0, bandit: 0 };
let pendingFutbolKickoff = false; // maça ilk girişte "MAÇ BAŞLADI" anonsu için

// Takim tabanli modlar (takim secimi + dost atesi kapali)
const isTeamMode = () => gameMode === 'team' || gameMode === 'domination';
// Gun Game: kill basina sirayla gecilen silahlar (sunucudaki sirayla ayni olmali)
const GUN_GAME_ORDER = ['smg', 'rifle', 'shotgun', 'sniper'];
const gunForLevel = (lvl) => GUN_GAME_ORDER[Math.min(Math.max(0, lvl), GUN_GAME_ORDER.length - 1)];
// Gun Game'de oyuncunun silahini seviyesine (kills) gore ayarla
function applyGunGameWeapon() {
  switchGun(gunForLevel(player.kills));
}
// Round/oyun basinda moda gore baslangic silahini kusan
function equipForMode() {
  if (gameMode === 'gungame') applyGunGameWeapon();
  else if (gameMode === 'kilic') switchGun('sword');
  else if (gameMode === 'kral') switchGun(player.isKing ? 'kingrifle' : 'rifle');
  else if (gameMode === 'awp') switchGun('sniper');
  else if (gameMode === 'futbol') switchGun('rifle'); // silah görünmez (setFutbolMode ile gizlenir)
  else switchGun('rifle');
  setFutbolMode(gameMode === 'futbol');
}

// ---- Mod aciklamalari (baslangic ekraninda "nasil oynanir") ----
const MODE_INFO = {
  duel: {
    title: '⚔️ Duel — Birebir Düello',
    goal: 'İki oyuncu karşı karşıya. Rakibini en çok sen öldür.',
    how: [
      'Öldüğünde 3 saniye sonra yeniden doğarsın.',
      'Skor üstte: senin öldürmen — rakibin öldürmesi.',
      'Tüm silahları haritadan toplayabilirsin (E).',
    ],
    meta: '👥 2 oyuncu • Yeniden doğmalı',
  },
  arena: {
    title: '🎯 Arena — Herkes Herkese',
    goal: 'Serbest çatışma (FFA). En çok öldürme yapan lider olur.',
    how: [
      '2-8 oyuncu; oyun başladıktan sonra da katılınabilir.',
      'Öldüğünde 3 saniyede yeniden doğarsın.',
      'Haritaya saçılan silah ve can paketlerini topla.',
    ],
    meta: '👥 2-8 oyuncu • Yeniden doğmalı • Sonradan katılma',
  },
  team: {
    title: '🚔 Takım — Polis vs Haydut',
    goal: 'Round bazlı takım savaşı. Rakip takımın tamamını eleyen round kazanır.',
    how: [
      'Başta takım seçersin (Polis 🔵 / Haydut 🔴). Dost ateşi yok.',
      'Round içinde ölen bekler; round bitince herkes yeniden doğar.',
      'Üstteki skor takımların kazandığı round sayısıdır.',
      'M tuşu ile takım değiştirebilirsin.',
    ],
    meta: '👥 2-8 oyuncu • Round eleme • Takım seçimi',
  },
  gungame: {
    title: '🔫 Gun Game — Silah Yarışı',
    goal: 'Her öldürme seni sıradaki silaha geçirir. Sırayı ilk bitiren kazanır.',
    how: [
      'Silah sırası: MP5 → AK-47 → Pompalı → AWP.',
      'Her öldürmede canın tamamen dolar.',
      'Son silahla (AWP) öldürme yapan maçı kazanır.',
      'Silah toplanmaz; seviyene göre otomatik verilir.',
    ],
    meta: '👥 2-8 oyuncu • Herkes herkese • 4 öldürmede biter',
  },
  domination: {
    title: '🚩 Bölge Kapma — Domination',
    goal: 'Haritadaki 3 bölgeyi tutarak puan topla. Hedefe ilk ulaşan takım kazanır.',
    how: [
      'Takım seçersin (Polis 🔵 / Haydut 🔴). Dost ateşi yok.',
      'Bölgede yalnız senin takımın olursa bölge ele geçer — zemin halkası takım rengine döner.',
      'Tuttuğun her bölge saniye başına puan kazandırır (3 bölge = 3 kat hızlı).',
      'İki takım da bölgedeyse kapma durur (çekişme).',
      '150 puana ilk ulaşan takım kazanır.',
    ],
    meta: '👥 2-8 oyuncu • Takım • Bölgeler: Alfa / Bravo / Charlie',
  },
  kilic: {
    title: '🗡️ Kılıç — Düello (Eleme)',
    goal: 'Ateşli silah yok, sadece kılıç. Round sonunda sona kalan kazanır.',
    how: [
      'Sol tık ile yakın mesafede savurursun; isabet anında öldürür.',
      'Round içinde ölen elenir, yeniden doğmaz.',
      'Son ayakta kalan oyuncu round galibiyetini alır.',
      'Skor: kazanılan round sayısı. Yeni round otomatik başlar.',
    ],
    meta: '👥 2-8 oyuncu • Eleme • Silah yok',
  },
  kral: {
    title: 'Kral Kim - 300 Can',
    goal: 'Bir oyuncu kral olur. Kral 300 canli, daha buyuk ve ozel silahlidir.',
    how: [
      'Ilk kral rastgele secilir ve merkezdeki pit bolgesinde baslar.',
      'Kralin silahi tek isabette normal oyuncunun 100 canini bitirir.',
      'Normal oyuncular sadece krala hasar verebilir; birbirlerine ates edemez.',
      'Krali son vurusla olduren oyuncu bir sonraki roundun krali olur.',
    ],
    meta: '2-8 oyuncu - Kral avlama - Dost atesi kapali',
  },
  awp: {
    title: 'AWP 1v1 - Uzun Hat',
    goal: 'Iki oyuncu genis ve uzun bir hatta sadece AWP ile duello atar.',
    how: [
      'Oda 2 kisiliktir; herkes otomatik AWP ile baslar.',
      'Yerde silah yoktur, mod sadece nisan ve pozisyon uzerinedir.',
      'Alan uzun ve genistir; yol gibi gorunmez ama uzun hat mantigi verir.',
      'Oldugunde 3 saniye sonra kendi tarafinda yeniden dogarsin.',
    ],
    meta: '2 oyuncu - Sadece AWP - Uzun/genis hat',
  },
  futbol: {
    title: '⚽ Futbol — Saha Maçı',
    goal: 'Topu sürerek rakip kaleye götür. İlk 5 golü atan takım kazanır.',
    how: [
      'Topa yaklaşınca top önünde sürülür (WASD ile yürü, bakış yönüne sürer).',
      'SPACE ile sürdüğün topa sert vurup şut çekersin (uzağa hızlı gider).',
      'Q ile savunma yaparsın: rakibin topuna uzanıp kontrolünden çıkarırsın (tackle).',
      'İki takım: 🚔 Polis ve 🦹 Haydut. Otomatik takım atanır.',
      'Silah ve can yok; sadece top kontrolü, savunma ve gol.',
    ],
    meta: '2-8 oyuncu • İki takım • İlk 5 gol kazanır',
  },
};

function renderModeInfo() {
  const el = $('mode-info');
  if (!el) return;
  const info = MODE_INFO[gameMode] || MODE_INFO.duel;
  el.innerHTML = `
    <h4>${info.title}</h4>
    <div class="mi-goal">${info.goal}</div>
    <ul>${info.how.map((h) => `<li>${h}</li>`).join('')}</ul>
    <div class="mi-meta">${info.meta}</div>`;
}

document.querySelectorAll('[data-mode]').forEach((card) => {
  card.classList.toggle('sel', card.dataset.mode === gameMode);
  card.onclick = () => {
    gameMode = card.dataset.mode;
    localStorage.setItem('cs_mode', gameMode);
    document.querySelectorAll('[data-mode]').forEach((c) => c.classList.toggle('sel', c === card));
    // Futbol modunda saha arenasını otomatik seç
    if (gameMode === 'futbol') {
      arenaChoice = 'futbol';
      localStorage.setItem('cs_arena', arenaChoice);
      document.querySelectorAll('[data-arena]').forEach((c) => c.classList.toggle('sel', c.dataset.arena === 'futbol'));
    }
    renderModeInfo();
  };
});
renderModeInfo();

document.querySelectorAll('[data-arena]').forEach((card) => {
  card.classList.toggle('sel', card.dataset.arena === arenaChoice);
  card.onclick = () => {
    arenaChoice = card.dataset.arena;
    localStorage.setItem('cs_arena', arenaChoice);
    document.querySelectorAll('[data-arena]').forEach((c) => c.classList.toggle('sel', c === card));
  };
});

document.querySelectorAll('.avatar-card').forEach((card) => {
  card.classList.toggle('sel', card.dataset.av === myAvatar);
  card.onclick = () => {
    myAvatar = card.dataset.av;
    localStorage.setItem('cs_avatar', myAvatar);
    document.querySelectorAll('.avatar-card').forEach((c) => c.classList.toggle('sel', c === card));
  };
});

// ---- Nişangah tipi (nokta / boşluklu / tam artı) ----
let myCross = localStorage.getItem('cs_cross') || 'cross';
if (!['cross', 'gap', 'dot'].includes(myCross)) myCross = 'cross';
function applyCrosshair(type) {
  const el = $('crosshair');
  if (!el) return;
  el.classList.remove('ch-cross', 'ch-gap', 'ch-dot');
  el.classList.add('ch-' + type);
}
document.querySelectorAll('[data-cross]').forEach((card) => {
  card.classList.toggle('sel', card.dataset.cross === myCross);
  card.onclick = () => {
    myCross = card.dataset.cross;
    localStorage.setItem('cs_cross', myCross);
    document.querySelectorAll('[data-cross]').forEach((c) => c.classList.toggle('sel', c === card));
    applyCrosshair(myCross);
  };
});
applyCrosshair(myCross);

$('btn-create').onclick = () => {
  myName = $('name-input').value.trim() || 'Oyuncu';
  socket.emit('createRoom', { name: myName, avatar: myAvatar, mode: gameMode, arena: arenaChoice }, (res) => {
    if (res.error) return ($('menu-err').textContent = res.error);
    roomCode = res.code;
    gameMode = res.mode || gameMode;
    arenaChoice = res.arena || arenaChoice;
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
    gameMode = res.mode || gameMode;
    arenaChoice = res.arena || arenaChoice;
    showWaiting(res.code);
  });
};

$('code-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });

function showWaiting(code) {
  $('menu').style.display = 'none';
  $('waiting').style.display = 'flex';
  $('code-display').textContent = code;
  $('waiting-hint').textContent = 'Rakip bekleniyor...';
  teamChosen = false; // yeni macta takim secimi tekrar sorulsun
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

function centerBanner(msg, kind = '', ms = 1300) {
  const b = $('center-banner');
  if (!b) return;
  b.className = kind ? kind : '';
  b.textContent = msg;
  requestAnimationFrame(() => b.classList.add('show'));
  clearTimeout(b._timer);
  b._timer = setTimeout(() => b.classList.remove('show'), ms);
}

// ================== THREE.JS SAHNE ==================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87a8c8);
scene.fog = new THREE.Fog(0x87a8c8, 50, 120);
let floorMesh = null;

const ARENA_THEMES = {
  depot: { sky: 0x87a8c8, fog: 0x87a8c8, floor: '#9a8f72', line: 'rgba(0,0,0,0.18)', name: 'depot' },
  lanes: { sky: 0xd8b47b, fog: 0xd8b47b, floor: '#c79d57', line: 'rgba(80,45,10,0.22)', name: 'desert' },
  fortress: { sky: 0x9da8b8, fog: 0x9da8b8, floor: '#69717d', line: 'rgba(255,255,255,0.10)', name: 'fortress' },
  yard: { sky: 0x8fcf98, fog: 0x8fcf98, floor: '#4f7c47', line: 'rgba(20,55,20,0.25)', name: 'yard' },
  crossfire: { sky: 0x201d3a, fog: 0x201d3a, floor: '#25263f', line: 'rgba(90,220,255,0.22)', name: 'neon' },
  futbol: { sky: 0x8fcf98, fog: 0x8fcf98, floor: '#2e7d32', line: 'rgba(255,255,255,0.92)', name: 'pitch' },
};

// Futbol sahası zemin dokusu: çim + orta çizgi + orta daire + ceza sahaları
function makePitchTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  // Çim şeritleri
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2e7d32' : '#338a37';
    ctx.fillRect(0, i * 64, 512, 64);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 4;
  // Dış saha çizgisi
  ctx.strokeRect(24, 24, 464, 464);
  // Orta çizgi (yatay - Z ekseni boyunca kaleler ±Z'de)
  ctx.beginPath(); ctx.moveTo(24, 256); ctx.lineTo(488, 256); ctx.stroke();
  // Orta daire
  ctx.beginPath(); ctx.arc(256, 256, 60, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(256, 256, 5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
  // Ceza sahaları (üst ve alt)
  ctx.strokeRect(160, 24, 192, 70);
  ctx.strokeRect(160, 418, 192, 70);
  return new THREE.CanvasTexture(c);
}

function makeFloorTexture(theme) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = theme.floor;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 256, 256);
  ctx.strokeStyle = theme.line;
  const step = theme.name === 'neon' ? 32 : 64;
  for (let x = 0; x <= 256; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

function applyArenaTheme(arena = 'depot') {
  const theme = ARENA_THEMES[arena] || ARENA_THEMES.depot;
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.fog, arena === 'crossfire' ? 38 : 50, arena === 'crossfire' ? 95 : 120);
  if (floorMesh) {
    const oldMap = floorMesh.material.map;
    let tex;
    if (arena === 'futbol') {
      // Saha çizgileri tek karoda; tekrar yok (sahanın tamamını kaplar)
      tex = makePitchTexture();
      tex.repeat.set(1, 1);
    } else {
      tex = makeFloorTexture(theme);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(arena === 'crossfire' ? 18 : 15, arena === 'crossfire' ? 18 : 15);
    }
    floorMesh.material.map = tex;
    floorMesh.material.needsUpdate = true;
    if (oldMap) oldMap.dispose();
  }
}

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 300);
camera.rotation.order = 'YXZ'; // bir kez ayarla (her karede tekrar atamaya gerek yok)
// powerPreference: dizüstülerde ayrık GPU tercih edilir; daha akıcı kare hızı
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Gölge haritasını her karede değil, animate içinde iki karede bir yenile (~30Hz).
// Statik geometri + oyuncu gölgeleri için fark edilmez; gölge GPU maliyetini ~yarıya indirir.
renderer.shadowMap.autoUpdate = false;
document.body.appendChild(renderer.domElement);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
});

// Işıklar
scene.add(new THREE.HemisphereLight(0xcfe5ff, 0x4a4434, 0.85));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.4);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
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
  // Duvar/kasa statiktir: matrisi bir kez hesapla, her karede tekrar güncelleme
  m.updateMatrix();
  m.matrixAutoUpdate = false;
  scene.add(m);
  solids.push(m);
  if (rotY === 0) colliders.push({ x, z, w, d, h });
  return m;
}

// Zemin
{
  const tex = makeFloorTexture(ARENA_THEMES.depot);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(15, 15);
  floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  floorMesh.updateMatrix();
  floorMesh.matrixAutoUpdate = false; // statik zemin
  scene.add(floorMesh);
  solids.push(floorMesh);
}

// Çevre duvarları
const WALL_H = 5;
box(0, -MAP_SIZE / 2, MAP_SIZE, 1, WALL_H, 0x8a6f4d);
box(0, MAP_SIZE / 2, MAP_SIZE, 1, WALL_H, 0x8a6f4d);
box(-MAP_SIZE / 2, 0, 1, MAP_SIZE, WALL_H, 0x8a6f4d);
box(MAP_SIZE / 2, 0, 1, MAP_SIZE, WALL_H, 0x8a6f4d);


const baseInteriorMeshes = [];
const baseInteriorColliders = [];

function baseBox(x, z, w, d, h, color, rotY = 0) {
  const before = colliders.length;
  const mesh = box(x, z, w, d, h, color, rotY);
  baseInteriorMeshes.push(mesh);
  for (let i = before; i < colliders.length; i++) baseInteriorColliders.push(colliders[i]);
  return mesh;
}

function setBaseInteriorEnabled(enabled) {
  for (const mesh of baseInteriorMeshes) {
    mesh.visible = enabled;
    const si = solids.indexOf(mesh);
    if (enabled && si < 0) solids.push(mesh);
    else if (!enabled && si >= 0) solids.splice(si, 1);
  }
  for (const collider of baseInteriorColliders) {
    const ci = colliders.indexOf(collider);
    if (enabled && ci < 0) colliders.push(collider);
    else if (!enabled && ci >= 0) colliders.splice(ci, 1);
  }
}
// Orta kule + siper düzeni
baseBox(0, 0, 5, 5, 2.6, 0xb0a285);            // orta blok (üstünde AWP doğar)
baseBox(8, 0, 2, 2, 1.2, 0xc2873e);            // alçak kasalar (üstüne çıkılabilir)
baseBox(-8, 0, 2, 2, 1.2, 0xc2873e);
baseBox(0, 8, 2, 2, 1.2, 0xc2873e);
baseBox(0, -8, 2, 2, 1.2, 0xc2873e);
baseBox(14, 7, 6, 1.4, 2.6, 0x7d8a99);         // siper duvarları
baseBox(-14, -7, 6, 1.4, 2.6, 0x7d8a99);
baseBox(7, -14, 1.4, 6, 2.6, 0x7d8a99);
baseBox(-7, 14, 1.4, 6, 2.6, 0x7d8a99);
baseBox(20, -18, 3, 3, 2.2, 0xc2873e);         // köşe kasaları
baseBox(-20, 18, 3, 3, 2.2, 0xc2873e);
baseBox(18, 18, 2.5, 2.5, 1.2, 0xa56f31);
baseBox(-18, -18, 2.5, 2.5, 1.2, 0xa56f31);
baseBox(24, 6, 1.4, 8, 2.8, 0x7d8a99);
baseBox(-24, -6, 1.4, 8, 2.8, 0x7d8a99);

const arenaLayoutMeshes = [];
const arenaLayoutColliders = [];

function arenaBox(x, z, w, d, h, color, rotY = 0) {
  const before = colliders.length;
  const mesh = box(x, z, w, d, h, color, rotY);
  arenaLayoutMeshes.push(mesh);
  for (let i = before; i < colliders.length; i++) arenaLayoutColliders.push(colliders[i]);
  return mesh;
}

function clearArenaLayout() {
  for (const mesh of arenaLayoutMeshes.splice(0)) {
    scene.remove(mesh);
    const si = solids.indexOf(mesh);
    if (si >= 0) solids.splice(si, 1);
  }
  for (const collider of arenaLayoutColliders.splice(0)) {
    const ci = colliders.indexOf(collider);
    if (ci >= 0) colliders.splice(ci, 1);
  }
}

function sniperNest(x, z, sx, sz) {
  arenaBox(x, z, 5.5, 1.0, 1.25, 0x6f7f91);
  arenaBox(x + sx * 3.2, z, 1.0, 5.0, 1.9, 0x7d8a99);
  arenaBox(x, z + sz * 3.2, 5.0, 1.0, 1.9, 0x7d8a99);
  arenaBox(x - sx * 2.7, z - sz * 2.7, 2.0, 2.0, 1.2, 0xc2873e);
}

function applyArenaLayout(arena = 'depot') {
  applyArenaTheme(gameMode === 'awp' ? 'lanes' : gameMode === 'kral' ? 'fortress' : gameMode === 'futbol' ? 'futbol' : arena);
  clearArenaLayout();
  setBaseInteriorEnabled(gameMode !== 'awp' && gameMode !== 'kral' && gameMode !== 'futbol');
  if (gameMode === 'futbol') {
    // Saha: kaleler ±Z uçlarında (gol ağzı |x|<4). Ön direkler beyaz, arka ağ açık gri.
    const makeGoal = (sign) => {
      const z = 26 * sign;
      arenaBox(0, z + 1.6 * sign, 8.4, 0.3, 2.2, 0xeeeeee);   // arka ağ
      arenaBox(-4, z + 0.8 * sign, 0.3, 1.6, 2.2, 0xeeeeee);  // sol yan ağ
      arenaBox(4, z + 0.8 * sign, 0.3, 1.6, 2.2, 0xeeeeee);   // sağ yan ağ
      arenaBox(-4, z, 0.4, 0.4, 2.6, 0xffffff);               // sol direk
      arenaBox(4, z, 0.4, 0.4, 2.6, 0xffffff);                // sağ direk
    };
    makeGoal(1);
    makeGoal(-1);
  } else if (gameMode === 'awp') {
    arenaBox(-16, 0, 1.2, 46, 2.2, 0x6f7f91);
    arenaBox(16, 0, 1.2, 46, 2.2, 0x6f7f91);
    arenaBox(-8, 0, 2.2, 8, 1.35, 0x8b929c);
    arenaBox(8, 0, 2.2, 8, 1.35, 0x8b929c);
    arenaBox(0, 0, 5.5, 1.4, 1.15, 0xb67c39);
    arenaBox(-5, -15, 5, 1.2, 1.35, 0x4c5664);
    arenaBox(5, 15, 5, 1.2, 1.35, 0x4c5664);
    arenaBox(-7, 24, 8, 1.2, 1.55, 0x26345f);
    arenaBox(7, -24, 8, 1.2, 1.55, 0x26345f);
    arenaBox(-12, 22, 1.2, 5, 1.6, 0x26345f);
    arenaBox(12, -22, 1.2, 5, 1.6, 0x26345f);
  } else if (gameMode === 'kral') {
    arenaBox(0, 0, 10, 10, 0.8, 0x6b2630);
    arenaBox(-5.8, -5.8, 5.2, 1.1, 2.75, 0x7a3340);
    arenaBox(-5.8, -5.8, 1.1, 5.2, 2.75, 0x7a3340);
    arenaBox(5.8, -5.8, 5.2, 1.1, 2.75, 0x7a3340);
    arenaBox(5.8, -5.8, 1.1, 5.2, 2.75, 0x7a3340);
    arenaBox(-5.8, 5.8, 5.2, 1.1, 2.75, 0x7a3340);
    arenaBox(-5.8, 5.8, 1.1, 5.2, 2.75, 0x7a3340);
    arenaBox(5.8, 5.8, 5.2, 1.1, 2.75, 0x7a3340);
    arenaBox(5.8, 5.8, 1.1, 5.2, 2.75, 0x7a3340);
    arenaBox(0, -3.2, 3.4, 0.9, 1.15, 0xb67c39);
    arenaBox(0, 3.2, 3.4, 0.9, 1.15, 0xb67c39);
    arenaBox(-3.2, 0, 0.9, 3.4, 1.15, 0xb67c39);
    arenaBox(3.2, 0, 0.9, 3.4, 1.15, 0xb67c39);
    arenaBox(0, -15, 8, 1.3, 1.45, 0x4c5664);
    arenaBox(0, 15, 8, 1.3, 1.45, 0x4c5664);
    arenaBox(-15, 0, 1.3, 8, 1.45, 0x4c5664);
    arenaBox(15, 0, 1.3, 8, 1.45, 0x4c5664);
    arenaBox(-19, -19, 6, 1.2, 1.8, 0x26345f);
    arenaBox(19, 19, 6, 1.2, 1.8, 0x26345f);
    arenaBox(-19, 19, 1.2, 6, 1.8, 0x26345f);
    arenaBox(19, -19, 1.2, 6, 1.8, 0x26345f);
    arenaBox(-10, -20, 4, 2, 1.15, 0xb67c39);
    arenaBox(10, 20, 4, 2, 1.15, 0xb67c39);
    arenaBox(-20, 10, 2, 4, 1.15, 0xb67c39);
    arenaBox(20, -10, 2, 4, 1.15, 0xb67c39);
  } else if (arena === 'lanes') {
    arenaBox(0, -18, 18, 1.2, 2.4, 0xb67c39);
    arenaBox(0, 18, 18, 1.2, 2.4, 0xb67c39);
    arenaBox(-18, 0, 1.2, 18, 2.4, 0xb67c39);
    arenaBox(18, 0, 1.2, 18, 2.4, 0xb67c39);
    arenaBox(-10, -10, 3, 3, 1.4, 0x8f5d2a);
    arenaBox(10, 10, 3, 3, 1.4, 0x8f5d2a);
    sniperNest(-24, 24, 1, -1);
    sniperNest(24, -24, -1, 1);
  } else if (arena === 'yard') {
    arenaBox(0, 0, 4, 4, 1.4, 0x5d8f43);
    arenaBox(-12, 0, 4, 2, 1.5, 0x5d8f43);
    arenaBox(12, 0, 4, 2, 1.5, 0x5d8f43);
    arenaBox(0, -12, 2, 4, 1.5, 0x5d8f43);
    arenaBox(0, 12, 2, 4, 1.5, 0x5d8f43);
    arenaBox(-18, 18, 6, 1.2, 1.7, 0x3d5c3a);
    arenaBox(18, -18, 6, 1.2, 1.7, 0x3d5c3a);
    sniperNest(-24, -24, 1, 1);
    sniperNest(24, 24, -1, -1);
  } else if (arena === 'crossfire') {
    arenaBox(-11, -11, 12, 1.2, 2.2, 0x2f7fb5);
    arenaBox(11, 11, 12, 1.2, 2.2, 0x2f7fb5);
    arenaBox(-11, 11, 1.2, 12, 2.2, 0x8f3fb5);
    arenaBox(11, -11, 1.2, 12, 2.2, 0x8f3fb5);
    arenaBox(0, -18, 5, 2, 1.4, 0x26345f);
    arenaBox(0, 18, 5, 2, 1.4, 0x26345f);
    arenaBox(-18, 0, 2, 5, 1.4, 0x26345f);
    arenaBox(18, 0, 2, 5, 1.4, 0x26345f);
    sniperNest(-24, 24, 1, -1);
    sniperNest(24, -24, -1, 1);
  } else if (arena === 'fortress') {
    arenaBox(0, -12, 10, 1.4, 3.0, 0x4c5664);
    arenaBox(0, 12, 10, 1.4, 3.0, 0x4c5664);
    arenaBox(-12, 0, 1.4, 10, 3.0, 0x4c5664);
    arenaBox(12, 0, 1.4, 10, 3.0, 0x4c5664);
    arenaBox(-5, -5, 2.5, 2.5, 1.2, 0x8b929c);
    arenaBox(5, -5, 2.5, 2.5, 1.2, 0x8b929c);
    arenaBox(-5, 5, 2.5, 2.5, 1.2, 0x8b929c);
    arenaBox(5, 5, 2.5, 2.5, 1.2, 0x8b929c);
    sniperNest(-24, -24, 1, 1);
    sniperNest(24, 24, -1, -1);
  } else {
    arenaBox(-14, 14, 5, 2, 1.5, 0xc2873e);
    arenaBox(14, -14, 5, 2, 1.5, 0xc2873e);
    arenaBox(-14, 6, 2, 5, 1.5, 0xc2873e);
    arenaBox(14, -6, 2, 5, 1.5, 0xc2873e);
    sniperNest(-24, -24, 1, 1);
    sniperNest(24, 24, -1, -1);
  }
}

// ================== YEREL OYUNCU ==================
const player = {
  pos: new THREE.Vector3(0, 0, 0), // ayak pozisyonu
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  onGround: true,
  crouch: false,
  eyeHeight: STAND_EYE_HEIGHT,
  hp: 100,
  maxHp: 100,
  isKing: false,
  alive: true,
  gun: 'rifle',
  ammo: GUNS.rifle.mag,
  reloading: false,
  reloadStart: 0,
  reloadEnd: 0,
  lastShot: 0,
  rapidUntil: 0, // airdrop: hızlı ateş buff'ı bitiş zamanı (performance.now ms)
  dmgUntil: 0,   // airdrop: çift hasar buff'ı bitiş zamanı (görsel/HUD; hasarı sunucu uygular)
  zoomed: false,
  kills: 0,
  deaths: 0,
  streak: 0,
};

const keys = {};
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight',
  'KeyC', 'KeyR', 'KeyE', 'KeyQ',
]);

addEventListener('keydown', (e) => {
  if (gameRunning && GAME_KEYS.has(e.code)) e.preventDefault();
  if (e.code === 'Tab') {
    e.preventDefault();
    if (gameRunning && !scoreboardPinned) { scoreboardPinned = true; showScoreboard(true); }
    return;
  }
  if (e.code === 'KeyM') {
    // Oyun sirasinda takim degistir (yalnizca takim modunda)
    if (gameRunning && gameMode === 'team' && !selectingTeam) showTeamSelect(true);
    return;
  }
  keys[e.code] = true;
  if (e.code === 'KeyR') tryReload();
  if (e.code === 'KeyE') tryPickupWeapon();
  if (e.code === 'KeyQ') tryTackle();
});
addEventListener('keyup', (e) => {
  if (gameRunning && GAME_KEYS.has(e.code)) e.preventDefault();
  if (e.code === 'Tab') {
    e.preventDefault();
    scoreboardPinned = false;
    showScoreboard(false);
    return;
  }
  keys[e.code] = false;
});

// Fare / pointer lock
let mouseDown = false;
document.addEventListener('mousedown', (e) => {
  if (!gameRunning || document.pointerLockElement !== document.body) return;
  e.preventDefault();
  if (gameMode === 'futbol') return; // futbolda fare aksiyonu yok (sadece bakış)
  if (e.button === 0) { mouseDown = true; tryShoot(); }
  if (e.button === 2) {
    // Kilic: sag tik = hafif vurus; diger silahlar: zoom
    if (GUNS[player.gun].melee) meleeAttack('light');
    else toggleZoom(!player.zoomed);
  }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
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

let resumeVisible = false;

function showResume(title = 'DURAKLADI', sub = 'Oyuna donmek icin tikla') {
  if (resumeVisible && $('resume').style.display === 'flex') return;
  resumeVisible = true;
  $('resume-title').textContent = title;
  $('resume-sub').textContent = sub;
  $('resume').style.display = 'flex';
}

function hideResume() {
  resumeVisible = false;
  $('resume').style.display = 'none';
}

document.addEventListener('pointerlockchange', () => {
  if (gameRunning && document.pointerLockElement !== document.body) {
    if (selectingTeam) return; // takim secim ekrani aciksa devam ekranini gosterme
    showResume();
  } else {
    hideResume();
    // Futbol: maça ilk girişte kickoff anonsu
    if (pendingFutbolKickoff && document.pointerLockElement === document.body) {
      pendingFutbolKickoff = false;
      centerBanner('⚽ MAÇ BAŞLADI!', 'gold', 2600);
      setTimeout(() => toast('SPACE: şut  •  Q: top çal (savunma)  •  İlk 5 gol kazanır ⚽', 4000), 700);
    }
  }
});
$('btn-resume').onclick = () => document.body.requestPointerLock();

// ---- Takim secim ekrani (takim modunda, oyuna girince veya M ile) ----
let teamChosen = false;
let selectingTeam = false;

function teamCounts() {
  let police = 0, bandit = 0;
  if (myTeam === 'police') police++; else if (myTeam === 'bandit') bandit++;
  for (const e of enemies.values()) { if (e.team === 'police') police++; else if (e.team === 'bandit') bandit++; }
  return { police, bandit };
}

// inGame=true: oyun sirasinda M ile acildi -> "Kapat" butonu gosterilir
function showTeamSelect(inGame = false) {
  selectingTeam = true;
  if (inGame && document.pointerLockElement === document.body) document.exitPointerLock();
  hideResume();
  const ov = $('team-select');
  ov.style.display = 'flex';
  ov.querySelectorAll('.team-pick').forEach((b) => b.classList.toggle('cur', b.dataset.pick === myTeam));
  const closeBtn = $('team-close');
  if (closeBtn) closeBtn.style.display = inGame ? 'block' : 'none';
  const c = teamCounts();
  $('team-pick-info').textContent = `Şu an — 🚔 Polis: ${c.police}  •  🦹 Haydut: ${c.bandit}`;
}

function hideTeamSelect() {
  selectingTeam = false;
  $('team-select').style.display = 'none';
}

document.querySelectorAll('#team-select .team-pick').forEach((btn) => {
  btn.onclick = () => {
    const team = btn.dataset.pick;
    socket.emit('pickTeam', team, (res) => {
      if (!res || !res.ok) return;
      myTeam = res.team;
      teamChosen = true;
      hideTeamSelect();
      showResume('TAKIM SEÇİLDİ', `Takımın: ${team === 'police' ? '🚔 Polis' : '🦹 Haydut'} — oyuna girmek için tıkla`);
    });
  };
});

// Oyun sirasinda takim degistirmekten vazgec
$('team-close').onclick = () => {
  hideTeamSelect();
  showResume('DEVAM', 'Oyuna dönmek için tıkla');
};

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

// ================== FUTBOL TOPU ==================
const FUTBOL_BALL_RADIUS = 0.35;
function makeBallTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbfbfb';
  ctx.fillRect(0, 0, 256, 256);
  // Klasik futbol topu: büyük siyah beşgenler (incecik kenarlıklı)
  const pent = (x, y, r, rot = 0) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2 + rot;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#161616'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.stroke();
  };
  // merkez beşgen + çevresinde halka + kenarlardaki yarımlar (sarmal kaplama)
  pent(128, 128, 40);
  const ring = 78, rr = 30;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    pent(128 + Math.cos(a) * ring, 128 + Math.sin(a) * ring, rr, Math.PI);
  }
  // üst/alt kenar (kutup) lekeleri
  pent(128, 8, 26); pent(128, 248, 26);
  pent(8, 70, 22); pent(248, 70, 22);
  pent(8, 190, 22); pent(248, 190, 22);
  return new THREE.CanvasTexture(c);
}
const ball = {
  mesh: new THREE.Mesh(
    new THREE.SphereGeometry(FUTBOL_BALL_RADIUS, 20, 16),
    new THREE.MeshStandardMaterial({ map: makeBallTexture(), roughness: 0.6 })
  ),
  target: new THREE.Vector3(0, FUTBOL_BALL_RADIUS, 0),
};
ball.mesh.castShadow = true;
ball.mesh.visible = false;
ball.mesh.position.set(0, FUTBOL_BALL_RADIUS, 0);
scene.add(ball.mesh);
let lastKickAt = 0; // yerel şut cooldown (ms)
let lastTackleAt = 0; // yerel tackle cooldown (ms)
// Futbol istemci-tahmin sabitleri (sunucudaki sürme değerleriyle aynı olmalı) — gecikmesiz sürme için
const FB_DRIBBLE_DIST = 2.0, FB_LEAD_PER_SPD = 0.19, FB_LEAD_MAX = 1.4, FB_CONTROL_R = 4.0;
const ballPredict = new THREE.Vector3();

function tryTackle() {
  if (gameMode !== 'futbol' || !gameRunning || !player.alive) return;
  if (document.pointerLockElement !== document.body) return;
  const now = performance.now();
  if (now - lastTackleAt < 480) return;
  lastTackleAt = now;
  socket.emit('tackle', { y: +player.yaw.toFixed(3) });
  playBlip(190, 0.08, 0.22); // hamle sesi
}

function setFutbolMode(on) {
  ball.mesh.visible = on;
  gunGroup.visible = !on; // futbolda silah görünmez
}
let gunRecoil = 0;
let screenShake = 0;
let swordSwing = 0; // kilic savurma animasyonu (1 -> 0)
let swordSwingType = 'heavy'; // son savurma tipi (heavy/light)

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

  // Kilic: celik bicak + kabza (gun parcalari yok)
  if (type === 'sword') {
    const blade = new THREE.MeshStandardMaterial({ color: 0xdfe6ef, roughness: 0.2, metalness: 0.9 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.7, metalness: 0.1 });
    const guard = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.4, metalness: 0.7 });
    add(new THREE.BoxGeometry(0.05, 0.012, 1.05), blade, 0, 0.02, -0.5);   // bicak
    add(new THREE.ConeGeometry(0.028, 0.16, 4), blade, 0, 0.02, -1.06, Math.PI / 2); // uc
    add(new THREE.BoxGeometry(0.22, 0.04, 0.05), guard, 0, 0.02, 0.04);    // siper (balçak)
    add(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 8), grip, 0, 0.02, 0.16, Math.PI / 2); // sap
    add(new THREE.SphereGeometry(0.032, 8, 8), guard, 0, 0.02, 0.27);      // topuz
    return grp;
  }

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
  } else if (type === 'sniper' || type === 'kingrifle') {
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 8), metal, 0, 0.01, -0.8, Math.PI / 2);     // uzun namlu
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 10), metal, 0, 0.13, -0.02, Math.PI / 2); // dürbün
    add(new THREE.CylinderGeometry(0.046, 0.046, 0.03, 10), metal, 0, 0.13, 0.11, Math.PI / 2);  // dürbün merceği
    add(new THREE.BoxGeometry(0.078, 0.09, 0.34), body, 0, -0.01, -0.33);                        // yeşil gövde
    add(new THREE.BoxGeometry(0.07, 0.12, 0.3), body, 0, -0.03, 0.36);                           // dipçik
    if (type === 'kingrifle') {
      add(new THREE.BoxGeometry(0.12, 0.025, 0.18), new THREE.MeshStandardMaterial({ color: 0xffd36d, roughness: 0.35, metalness: 0.75 }), 0, 0.09, -0.36);
    }
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

// ---- Kilic savurma izi (slash) efekti: agir ve hafif icin farkli gorseller ----
function makeSlashTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const ctx = c.getContext('2d');
  ctx.translate(80, 80);
  ctx.lineCap = 'round';
  if (kind === 'heavy') {
    // Kalin, sicak renkli genis yay (agir vurus)
    ctx.strokeStyle = 'rgba(255,170,50,0.55)'; ctx.lineWidth = 34;
    ctx.beginPath(); ctx.arc(0, 0, 58, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,245,200,0.98)'; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.arc(0, 0, 58, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
  } else {
    // Ince, soguk renkli hizli yay (hafif vurus)
    ctx.strokeStyle = 'rgba(120,225,255,0.5)'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.arc(0, 0, 62, Math.PI * 0.02, Math.PI * 0.5); ctx.stroke();
    ctx.strokeStyle = 'rgba(235,252,255,0.98)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, 62, Math.PI * 0.02, Math.PI * 0.5); ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}
const slashTex = { heavy: makeSlashTexture('heavy'), light: makeSlashTexture('light') };
const slashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: slashTex.heavy, transparent: true, opacity: 0, depthTest: false, blending: THREE.AdditiveBlending,
}));
slashSprite.position.set(0.02, -0.05, -1.0);
camera.add(slashSprite);
const slashFx = { t: 0, dur: 0.3, type: 'heavy', rot0: 0, sweep: 1.4, base: 1.4 };
function spawnSlashFx(type) {
  slashSprite.material.map = slashTex[type];
  slashSprite.material.needsUpdate = true;
  slashFx.t = 0;
  slashFx.type = type;
  slashFx.dur = type === 'heavy' ? 0.34 : 0.16;
  slashFx.rot0 = type === 'heavy' ? Math.PI * 0.9 : -Math.PI * 0.1;
  slashFx.sweep = type === 'heavy' ? 1.7 : 1.1;
  slashFx.base = type === 'heavy' ? 1.5 : 1.05;
  slashSprite.material.rotation = slashFx.rot0;
  slashSprite.material.opacity = 1;
  slashSprite.scale.set(slashFx.base, slashFx.base, 1);
}

// ================== RAKİP MODELİ ==================
const enemies = new Map(); // id -> {id, name, group, head, body, targetPos, targetYaw, hp, kills, alive}

function makeNameSprite(name, team = null) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 34px Arial';
  ctx.textAlign = 'center';
  const accent = team === 'police' ? '#6db3ff' : team === 'bandit' ? '#ff6b6b' : '#ffffff';
  const w = ctx.measureText(name).width + 24;
  ctx.fillStyle = 'rgba(0,0,0,0.58)';
  ctx.fillRect(128 - w / 2, 8, w, 46);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(128 - w / 2, 8, w, 46);
  ctx.fillStyle = accent;
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
  body.userData.playerId = info.id;

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 0.18), bodyMat);
  armL.position.set(-0.5, 1.05, 0);
  armL.castShadow = true;
  armL.userData.part = 'body';
  armL.userData.playerId = info.id;
  const armR = armL.clone();
  armR.position.x = 0.5;
  armR.userData = { part: 'body', playerId: info.id };

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.4), new THREE.MeshStandardMaterial({ color: av.legs }));
  legs.position.y = 0.3;
  legs.castShadow = true;
  legs.userData.part = 'body';
  legs.userData.playerId = info.id;

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  head.position.y = 1.82;
  head.castShadow = true;
  head.userData.part = 'head';
  head.userData.playerId = info.id;

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
  } else if (av.gear === 'clown') {
    // Palyaço: kırmızı burun + yanlarda renkli saç tutamları + tepede ufak şapka
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0xff2b2b }));
    nose.position.set(0, 1.80, -0.235);
    const hairMat = new THREE.MeshStandardMaterial({ color: av.gearColor, roughness: 0.95 });
    for (const sx of [-1, 1]) {
      const tuft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.3), hairMat);
      tuft.position.set(sx * 0.28, 1.92, 0);
      group.add(tuft);
    }
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.2), new THREE.MeshStandardMaterial({ color: 0x3bc1ff }));
    hat.position.set(0, 2.12, 0);
    group.add(nose, hat);
  } else if (av.gear === 'bow') {
    // Prenses: pembe fiyonk + beyaz uzun saç (yanlarda)
    const bowMat = new THREE.MeshStandardMaterial({ color: av.gearColor, roughness: 0.6 });
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.11), bowMat);
    knot.position.set(0, 2.06, 0);
    group.add(knot);
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.08), bowMat);
      wing.position.set(sx * 0.16, 2.06, 0);
      group.add(wing);
    }
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    for (const sx of [-1, 1]) {
      const hair = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.44), hairMat);
      hair.position.set(sx * 0.26, 1.7, 0.02);
      group.add(hair);
    }
  } else if (av.gear === 'antenna') {
    // Uzaylı: iki anten + parlayan uçlar
    const stalkMat = new THREE.MeshStandardMaterial({ color: av.gearColor });
    const ballMat = new THREE.MeshBasicMaterial({ color: 0xc7ff4d });
    for (const sx of [-1, 1]) {
      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.03), stalkMat);
      stalk.position.set(sx * 0.12, 2.12, 0);
      const ball = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), ballMat);
      ball.position.set(sx * 0.12, 2.23, 0);
      group.add(stalk, ball);
    }
  } else if (av.gear === 'visor') {
    // Robot: gözleri örten vizör + tepede kırmızı uçlu anten
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.13, 0.04), new THREE.MeshStandardMaterial({ color: av.gearColor, metalness: 0.6, roughness: 0.3 }));
    visor.position.set(0, 1.86, -0.245);
    const ant = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), new THREE.MeshStandardMaterial({ color: av.gearColor }));
    ant.position.set(0, 2.1, 0);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xff4d4d }));
    tip.position.set(0, 2.2, 0);
    group.add(visor, ant, tip);
  } else if (av.gear === 'glasses') {
    // Şapşal: kalın çerçeveli gözlük (komik)
    const frameMat = new THREE.MeshStandardMaterial({ color: av.gearColor });
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.03), frameMat);
      lens.position.set(sx * 0.1, 1.87, -0.24);
      group.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.03), frameMat);
    bridge.position.set(0, 1.87, -0.24);
    group.add(bridge);
  }
  // 'mask' (haydut): kafa rengi zaten koyu kar maskesi, gözler beyaz parlıyor

  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.7), new THREE.MeshStandardMaterial({ color: 0x222 }));
  gun.position.set(0.3, 1.3, -0.4);

  const nameTag = makeNameSprite(info.name, info.team);
  group.add(body, armL, armR, legs, head, gun, nameTag);
  group.position.set(info.pos[0], info.pos[1], info.pos[2]);
  group.rotation.y = info.yaw || 0;
  scene.add(group);

  const enemy = {
    id: info.id, name: info.name, group, head, body, legs, armL, armR,
    targetPos: new THREE.Vector3(info.pos[0], info.pos[1], info.pos[2]),
    targetYaw: info.yaw || 0,
    interpPos: new THREE.Vector3(info.pos[0], info.pos[1], info.pos[2]),
    moveSamples: [{ t: performance.now(), p: [info.pos[0], info.pos[1], info.pos[2]], y: info.yaw || 0 }],
    hp: info.hp, maxHp: info.maxHp || 100, isKing: !!info.isKing, kills: info.kills || 0, deaths: info.deaths || 0, alive: info.hp > 0, protUntil: 0, crouch: !!info.crouch, nameTag, team: info.team || null,
  };
  setEnemyCrouch(enemy, !!info.crouch);
  enemies.set(info.id, enemy);
  nameTag.visible = nameTagVisibleFor(enemy);
  return enemy;
}

// Takim modunda isim etiketi yalnizca kendi takimindakiler icin gorunur;
// dusmanlarin etiketi gizlenir (duvar arkasindan konum sizdirmasin diye).
function nameTagVisibleFor(enemy) {
  if (!isTeamMode()) return true;
  return !!myTeam && enemy.team === myTeam;
}

// Tum rakiplerin isim etiketi gorunurlugunu (kendi takimima gore) tazele.
function refreshTeamVisibility() {
  for (const e of enemies.values()) {
    if (e.nameTag) e.nameTag.visible = nameTagVisibleFor(e);
  }
}

function canDamageEnemy(enemy) {
  if (isTeamMode() && enemy.team && enemy.team === myTeam) return false;
  if (gameMode === 'kral' && !player.isKing && !enemy.isKing) return false;
  return true;
}

function updateEnemyScale(enemy) {
  const base = enemy.isKing ? 1.5 : 1;
  enemy.group.scale.set(base, (enemy.crouch ? 0.72 : 1) * base, base);
}

function setEnemyCrouch(enemy, crouch) {
  enemy.crouch = crouch;
  updateEnemyScale(enemy);
}

function smoothYaw(current, target, factor) {
  let dy = target - current;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  return current + dy * factor;
}

function updateEnemyInterpolation(enemy, now, dt) {
  const samples = enemy.moveSamples;
  const renderAt = now - ENEMY_INTERP_DELAY;
  // Render zamanindan eski örnekleri at ama bracket/extrapolasyon icin en az 2 örnek birak.
  while (samples.length > 2 && samples[1].t <= renderAt) samples.shift();

  let targetYaw = enemy.targetYaw;
  if (samples.length >= 2 && samples[0].t <= renderAt) {
    const a = samples[0], b = samples[1];
    const span = Math.max(1, b.t - a.t);
    // renderAt iki örnek arasindaysa interpolasyon; ilerisindeyse SINIRLI extrapolasyon.
    // Boylece paket gecikince model donup sonra ziplamaz; ayni cizgide devam edip
    // yeni paket gelince kucuk bir duzeltmeyle suruyor (gorunur teleportu azaltir).
    const kMax = 1 + ENEMY_EXTRAP_MAX / span;
    const k = Math.min(Math.max((renderAt - a.t) / span, 0), kMax);
    enemy.interpPos.set(
      a.p[0] + (b.p[0] - a.p[0]) * k,
      a.p[1] + (b.p[1] - a.p[1]) * k,
      a.p[2] + (b.p[2] - a.p[2]) * k,
    );
    enemy.group.position.copy(enemy.interpPos);
    // Yaw'i en kisa yaydan interpole et (±π sinirinda ters donmesin)
    let dyaw = b.y - a.y;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    targetYaw = a.y + dyaw * Math.min(k, 1);
  } else {
    // Henuz iki örnek yok (yeni dogan rakip): son hedefe yumusak yaklas.
    enemy.group.position.lerp(enemy.targetPos, Math.min(1, dt * 12));
    enemy.interpPos.copy(enemy.group.position);
  }

  if (enemy.alive) {
    enemy.group.rotation.y = smoothYaw(enemy.group.rotation.y, targetYaw, Math.min(1, dt * 12));
  }
}

function resetEnemyMotion(enemy, pos, yaw = enemy.targetYaw) {
  enemy.group.position.set(pos[0], pos[1] || 0, pos[2]);
  enemy.targetPos.set(pos[0], pos[1] || 0, pos[2]);
  enemy.interpPos.copy(enemy.targetPos);
  enemy.targetYaw = yaw;
  enemy.moveSamples = [{ t: performance.now(), p: [enemy.targetPos.x, enemy.targetPos.y, enemy.targetPos.z], y: yaw }];
}

// Bir Object3D ağacındaki tüm geometri/materyal/dokuları serbest bırak (GPU bellek sızıntısını önler).
// Rakip modelleri ve isim etiketleri her doğuşta yeniden üretildiğinden uzun oturumlarda kritik.
function disposeObject3D(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
}

// Rakibin takimini degistir (isim etiketi rengini de gunceller)
function setEnemyTeam(enemy, team) {
  enemy.team = team;
  if (enemy.nameTag) {
    enemy.group.remove(enemy.nameTag);
    disposeObject3D(enemy.nameTag); // eski etiketin CanvasTexture'ını bırak
  }
  const tag = makeNameSprite(enemy.name, team);
  enemy.group.add(tag);
  enemy.nameTag = tag;
  tag.visible = nameTagVisibleFor(enemy);
}

function removeEnemy(id) {
  const enemy = enemies.get(id);
  if (!enemy) return;
  scene.remove(enemy.group);
  disposeObject3D(enemy.group);
  enemies.delete(id);
}

function removeAllEnemies() {
  for (const id of [...enemies.keys()]) removeEnemy(id);
}

function enemyById(id) {
  return enemies.get(id) || null;
}

function nameById(id) {
  if (id === socket.id) return myName;
  return enemyById(id)?.name || 'Rakip';
}

// ================== YERDEKİ NESNELER ==================
const groundWeapons = new Map(); // id -> {type, mesh, pos}
const healthPacks = new Map();   // id -> {mesh, pos}
const airdrops = new Map();      // id -> {mesh, beam, pos, y, landed}

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

function spawnAirdrop(id, pos) {
  const gy = groundHeightAt(pos[0], pos[2]);
  const grp = new THREE.Group();
  // Parlak kasa (altın/turuncu, fark edilsin)
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.85, 0.85),
    new THREE.MeshStandardMaterial({ color: 0xffb13d, emissive: 0xff7a00, emissiveIntensity: 0.5, roughness: 0.5, metalness: 0.3 })
  );
  box.castShadow = true;
  // Kasa kayışları (koyu çizgiler)
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x3a2a10, roughness: 0.7 });
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.9), beltMat);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.18), beltMat);
  const light = new THREE.PointLight(0xffae42, 1.8, 7);
  light.position.y = 1;
  grp.add(box, b1, b2, light);
  // Yukarıdan inen ışık huzmesi
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 40, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc451, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  beam.position.set(pos[0], gy + 20, pos[2]);
  scene.add(beam);

  const startY = gy + 26; // gökten iner
  grp.position.set(pos[0], startY, pos[2]);
  scene.add(grp);
  airdrops.set(id, { mesh: grp, beam, pos: new THREE.Vector3(pos[0], gy, pos[2]), y: startY, landed: false });
}

function removeAirdrop(id) {
  const a = airdrops.get(id);
  if (!a) return;
  scene.remove(a.mesh);
  scene.remove(a.beam);
  airdrops.delete(id);
}

// ================== DOMINATION BÖLGELERİ ==================
// Sunucudaki DOM_ZONES ile ayni konum/yaricap olmali.
const DOM_ZONE_DEFS = [
  { pos: [-14, 0, -14], name: 'ALFA' },
  { pos: [0, 0, 0], name: 'BRAVO' },
  { pos: [14, 0, 14], name: 'CHARLIE' },
];
const DOM_RADIUS_C = 4.2;
const domZones = []; // {grp, disc, ring, beam, pos}

function makeZoneLabel(name) {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 34px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 12, 160, 40);
  ctx.fillStyle = '#fff';
  ctx.fillText(name, 80, 44);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  sp.scale.set(2.4, 0.96, 1);
  sp.position.y = 3.4;
  return sp;
}

function buildDomZones() {
  clearDomZones();
  stopTeamSpectate();
  for (const z of DOM_ZONE_DEFS) {
    const grp = new THREE.Group();
    const gy = groundHeightAt(z.pos[0], z.pos[2]);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(DOM_RADIUS_C, 36),
      new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.22, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.05;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(DOM_RADIUS_C, 0.08, 8, 44),
      new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.07;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 6, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })
    );
    beam.position.y = 3;
    grp.add(disc, ring, beam, makeZoneLabel(z.name));
    grp.position.set(z.pos[0], gy, z.pos[2]);
    scene.add(grp);
    domZones.push({ grp, disc, ring, beam, pos: new THREE.Vector3(z.pos[0], gy, z.pos[2]) });
  }
}

function clearDomZones() {
  for (const z of domZones.splice(0)) scene.remove(z.grp);
}

// cap: -100 (haydut/kirmizi) .. 0 (notr) .. +100 (polis/mavi)
const _domColPolice = new THREE.Color(0x6db3ff);
const _domColBandit = new THREE.Color(0xff6b6b);
const _domColNeutral = new THREE.Color(0x888888);
function updateDomZones(caps) {
  if (!caps) return;
  for (let i = 0; i < domZones.length && i < caps.length; i++) {
    const c = caps[i];
    const t = Math.min(1, Math.abs(c) / 100);
    const col = c > 0 ? _domColPolice : c < 0 ? _domColBandit : _domColNeutral;
    const z = domZones[i];
    z.disc.material.color.copy(col); z.disc.material.opacity = 0.16 + t * 0.34;
    z.ring.material.color.copy(col); z.ring.material.opacity = 0.5 + t * 0.5;
    z.beam.material.color.copy(col); z.beam.material.opacity = 0.08 + t * 0.34;
  }
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

function resolveCollisions(axis = null) {
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
      if (axis === 'x') p.x = dxl < dxr ? minX : maxX;
      else if (axis === 'z') p.z = dzl < dzr ? minZ : maxZ;
      else if (m === dxl) p.x = minX;
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

// Bir (x,z) noktasi bir duvar/obje icinde mi? (dogum kontrolu icin)
function isBlockedAt(x, z) {
  for (const b of colliders) {
    if (b.h <= 0.2) continue; // ustune basilabilen cok alcak nesneleri yok say
    if (x > b.x - b.w / 2 - PLAYER_RADIUS && x < b.x + b.w / 2 + PLAYER_RADIUS &&
        z > b.z - b.d / 2 - PLAYER_RADIUS && z < b.z + b.d / 2 + PLAYER_RADIUS) return true;
  }
  const lim = MAP_SIZE / 2 - 0.6 - PLAYER_RADIUS;
  return x < -lim || x > lim || z < -lim || z > lim;
}

// Dogum noktasi bir engelin icine denk geldiyse en yakin bos noktaya kaydir.
// (Spawn'da duvara/objeye sikisma hatasini engeller.)
function safeSpawnPos(x, z) {
  if (!isBlockedAt(x, z)) return [x, z];
  for (let r = 0.6; r <= 12; r += 0.6) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
      if (!isBlockedAt(nx, nz)) return [nx, nz];
    }
  }
  return [x, z]; // cok nadir: tamamen kapali, orijinali birak
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
const particles = []; // {pts, vels, positions, count, life, max, grav}
const shells = [];    // {mesh, vel, rvel, life}

// --- Nesne havuzlari ---
// Catismada her mermi/isabette geometri olusturup yok etmek (GPU buffer churn + GC)
// ani FPS dususlerine ("60 -> 54 takilma") yol aciyordu. Asagidaki havuzlar efekt
// nesnelerini yeniden kullanir: create/dispose tekrar etmez, sadece reset edilir.
const TRACER_POOL = [];
const tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 4, 1);
tracerGeo.rotateX(Math.PI / 2); // uzun eksen -> local Z (lookAt ile hizalanir, scale.z ile uzar)

const PARTICLE_CAP = 24; // tek efektteki azami nokta sayisi (havuzlanan tampon boyutu)
const PARTICLE_POOL = [];

const SHELL_POOL = [];
const shellGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.05, 6);
const shellMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.3 });

// Ates yolu icin scratch vektorler (saçma basina new Vector3 / clone cöpünü onler)
const _shotOrigin = new THREE.Vector3();
const _shotBaseDir = new THREE.Vector3();
const _shotMuzzle = new THREE.Vector3();
const _shotDir = new THREE.Vector3();
const _shotEnd = new THREE.Vector3();
const _shellA = new THREE.Vector3();
const _shellB = new THREE.Vector3();

function addTracer(from, to) {
  const len = from.distanceTo(to);
  if (len < 0.5) return;
  let t = TRACER_POOL.pop();
  if (!t) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    t = { mesh: new THREE.Mesh(tracerGeo, mat), life: 0 }; // paylasilan geometri, kendi materyali
  }
  const m = t.mesh;
  m.material.opacity = 0.85;
  m.position.copy(from).lerp(to, 0.5);
  m.lookAt(to);
  m.scale.set(1, 1, len); // tek birimlik silindiri gereken uzunluga ölcekle
  m.visible = true;
  scene.add(m);
  t.life = 0.08;
  tracers.push(t);
}

function spawnParticles(pos, color, count, speed, grav, life, size = 0.05) {
  count = Math.min(count, PARTICLE_CAP);
  let p = PARTICLE_POOL.pop();
  if (!p) {
    const positions = new Float32Array(PARTICLE_CAP * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const vels = [];
    for (let i = 0; i < PARTICLE_CAP; i++) vels.push(new THREE.Vector3());
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, transparent: true, opacity: 1, depthWrite: false }));
    p = { pts, vels, positions, count, life, max: life, grav };
  }
  const positions = p.positions;
  for (let i = 0; i < count; i++) {
    positions[i * 3] = pos.x;
    positions[i * 3 + 1] = pos.y;
    positions[i * 3 + 2] = pos.z;
    p.vels[i].set(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5)
      .normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
  }
  p.count = count; p.life = life; p.max = life; p.grav = grav;
  const geo = p.pts.geometry;
  geo.setDrawRange(0, count);
  geo.attributes.position.needsUpdate = true;
  p.pts.material.color.set(color);
  p.pts.material.size = size;
  p.pts.material.opacity = 1;
  p.pts.visible = true;
  scene.add(p.pts);
  particles.push(p);
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
  let s = SHELL_POOL.pop();
  if (!s) {
    s = { mesh: new THREE.Mesh(shellGeo, shellMat), vel: new THREE.Vector3(), rvel: new THREE.Vector3(), life: 0 };
  }
  const mesh = s.mesh;
  mesh.position.copy(gunGroup.localToWorld(_shellA.set(0.05, 0.05, -0.1)));
  mesh.rotation.set(0, 0, 0);
  const right = _shellB.set(1, 0, 0).applyQuaternion(camera.quaternion);
  s.vel.copy(right).multiplyScalar(1.5 + Math.random());
  s.vel.y += 2.2 + Math.random();
  s.rvel.set(Math.random() * 8, Math.random() * 8, 0);
  s.life = 1.1;
  mesh.visible = true;
  scene.add(mesh);
  shells.push(s);
}

function tryShoot() {
  if (gameMode === 'futbol') return; // futbolda silah yok
  if (!gameRunning || !player.alive || player.reloading) return;
  const g = GUNS[player.gun];
  if (g.melee) { meleeAttack('heavy'); return; } // sol tik = agir vurus (kendi beklemesi var)
  const now = performance.now();
  // Airdrop "hızlı ateş" buff'ı aktifse atış aralığını kısalt (kılıç hariç)
  // ve mermi sınırsız olsun (şarjör tükenmez, reload gerekmez)
  const rapid = now < player.rapidUntil;
  const fireDelay = rapid ? g.fireDelay * 0.45 : g.fireDelay;
  if (now - player.lastShot < fireDelay) return;
  if (!rapid && player.ammo <= 0) { playBlip(200, 0.06, 0.12); tryReload(); return; }

  player.lastShot = now;
  if (!rapid) {
    player.ammo--;
    updateAmmoHUD();
    if (player.ammo === 0) setTimeout(() => tryReload(), 120);
  }
  playShotSound(player.gun);
  flash.intensity = 4;
  flashSprite.material.rotation = Math.random() * Math.PI * 2;
  flashSprite.material.opacity = 1;
  flashSprite.scale.setScalar(0.3 + Math.random() * 0.15 + (g.pellets > 1 ? 0.2 : 0));
  gunRecoil = 1;
  screenShake = Math.max(screenShake, player.gun === 'sniper' ? 1.1 : player.gun === 'shotgun' ? 0.8 : 0.35);
  ejectShell();
  // Geri tepme: silaha göre dikey tekme + hafif rastgele yatay sapma
  player.pitch += g.kick * (0.8 + Math.random() * 0.4);
  player.yaw += (Math.random() - 0.5) * g.kick * 0.5;

  const origin = camera.getWorldPosition(_shotOrigin);
  const baseDir = _shotBaseDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const muzzle = gunGroup.localToWorld(_shotMuzzle.set(0, 0.02, -0.7));

  const targets = [...solids];
  for (const e of enemies.values()) {
    if (!canDamageEnemy(e)) continue;
    if (e.alive) targets.push(e.head, e.body, e.legs, e.armL, e.armR);
  }

  const tos = [];
  let hitHead = false, hitAny = false;

  // Pompalı 8 saçma atar, diğerleri tek mermi
  for (let i = 0; i < g.pellets; i++) {
    const dir = _shotDir.copy(baseDir);
    const sp = player.zoomed ? 0 : g.spread;
    dir.x += (Math.random() - 0.5) * sp * 2;
    dir.y += (Math.random() - 0.5) * sp * 2;
    dir.z += (Math.random() - 0.5) * sp * 2;
    dir.normalize();

    raycaster.set(origin, dir);
    raycaster.far = 200;
    const hits = raycaster.intersectObjects(targets, false);

    let endPoint = _shotEnd.copy(origin).addScaledVector(dir, 120);
    if (hits.length > 0) {
      endPoint = hits[0].point;
      const part = hits[0].object.userData.part;
      if (part) {
        const targetId = hits[0].object.userData.playerId;
        const target = enemyById(targetId);
        socket.emit('hit', { part, gun: player.gun, targetId });
        if (!target || target.protUntil <= Date.now()) {
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

// Kilic vurus tipleri:
//  heavy (SOL TIK) -> 50 hasar, yavas (uzun bekleme + agir savurma) = dezavantaj
//  light (SAG TIK) -> 33 hasar, hizli (kisa bekleme + cevik savurma)
const MELEE = {
  heavy: { dmg: 50, cd: 720, range: 3.0, snd: [150, 0.2, 0.34] },
  light: { dmg: 33, cd: 320, range: 2.5, snd: [340, 0.07, 0.2] },
};

function meleeAttack(type = 'heavy') {
  if (!gameRunning || !player.alive) return;
  const m = MELEE[type] || MELEE.heavy;
  const now = performance.now();
  if (now - player.lastShot < m.cd) return; // her tipin kendi beklemesi
  player.lastShot = now;
  swordSwing = 1;
  swordSwingType = type;
  spawnSlashFx(type);
  playBlip(m.snd[0], m.snd[1], m.snd[2]); // savurma sesi (tipe gore)
  if (type === 'heavy') screenShake = Math.max(screenShake, 0.35);

  const origin = camera.getWorldPosition(new THREE.Vector3());
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

  const targets = [...solids]; // duvarlar dahil: kilic duvardan gecmesin
  for (const e of enemies.values()) {
    if (!canDamageEnemy(e)) continue;
    if (e.alive) targets.push(e.head, e.body, e.legs, e.armL, e.armR);
  }
  raycaster.set(origin, dir);
  raycaster.far = m.range;
  const hits = raycaster.intersectObjects(targets, false);

  let hitAny = false, hitHead = false;
  if (hits.length > 0 && hits[0].distance <= m.range) {
    const part = hits[0].object.userData.part;
    if (part) {
      const targetId = hits[0].object.userData.playerId;
      const target = enemyById(targetId);
      socket.emit('hit', { part, gun: 'sword', melee: type, targetId });
      if (!target || target.protUntil <= Date.now()) {
        hitAny = true;
        if (part === 'head') hitHead = true;
        meleeHitEffect(hits[0].point, type);
      }
    } else {
      impactEffect(hits[0].point, false); // duvara/zemine carpti
    }
  }
  if (hitAny) {
    showHitmarker(hitHead);
    if (type === 'heavy') { playBlip(720, 0.1, 0.32); screenShake = Math.max(screenShake, 0.7); }
    else playBlip(560, 0.05, 0.2);
  }
  // Diger oyunculara savurmayi bildir (ses + iz yok)
  socket.emit('shoot', { from: origin.toArray(), tos: [], gun: 'sword', melee: type });
}

// Kilic isabet patlamasi - agir ve hafif farkli
function meleeHitEffect(point, type) {
  if (type === 'heavy') {
    spawnParticles(point, 0xff2e2e, 24, 5.5, 11, 0.5, 0.08);  // buyuk kan patlamasi
    spawnParticles(point, 0xfff0a0, 12, 6.5, 8, 0.35, 0.06);  // altin kivilcim
  } else {
    spawnParticles(point, 0x9fe8ff, 14, 6, 9, 0.32, 0.06);    // hizli mavi
    spawnParticles(point, 0xffffff, 7, 4.5, 7, 0.24, 0.045);  // beyaz
  }
}

function showHitmarker(head) {
  const hm = $('hitmarker');
  hm.classList.toggle('head', head);
  hm.style.opacity = 1;
  if (head) centerBanner('KAFADAN!', 'red', 700);
  clearTimeout(hm._timer);
  hm._timer = setTimeout(() => (hm.style.opacity = 0), 120);
}

function tryReload() {
  if (gameMode === 'futbol') return;
  if (!gameRunning || !player.alive || player.reloading) return;
  const g = GUNS[player.gun];
  if (player.ammo >= g.mag) return;
  player.reloading = true;
  player.reloadStart = performance.now();
  player.reloadEnd = player.reloadStart + g.reloadTime * 1000;
  $('reloadtext').textContent = 'ŞARJÖR DEĞİŞİYOR...';
  $('reloadtext').textContent = 'SARJOR DEGISTIRILIYOR';
  $('reloadbar-bg').style.display = 'block';
  $('reloadbar').style.width = '0%';
  centerBanner('RELOAD', 'gold', 650);
  playBlip(350, 0.1, 0.15);
  socket.emit('reloading');
}

function finishReload() {
  player.reloading = false;
  player.ammo = GUNS[player.gun].mag;
  $('reloadtext').textContent = '';
  $('reloadbar-bg').style.display = 'none';
  $('reloadbar').style.width = '0%';
  updateAmmoHUD();
  playBlip(520, 0.08, 0.15);
  centerBanner('HAZIR', 'blue', 650);
}

function switchGun(type) {
  player.gun = type;
  player.ammo = GUNS[type].mag;
  player.reloading = false;
  $('reloadtext').textContent = '';
  $('reloadbar-bg').style.display = 'none';
  $('reloadbar').style.width = '0%';
  toggleZoom(false);
  buildGunModel(type);
  $('weaponname').textContent = GUNS[type].name;
  updateAmmoHUD();
}

// ================== YERDEN ALMA ==================
let nearbyWeaponId = null;
let nextPickupCheckAt = 0;

function tryPickupWeapon() {
  if (nearbyWeaponId !== null) socket.emit('pickupWeapon', nearbyWeaponId);
}

function checkPickups(now = performance.now()) {
  if (!player.alive) {
    nearbyWeaponId = null;
    $('pickup-hint').style.display = 'none';
    return;
  }
  if (now < nextPickupCheckAt) return;
  nextPickupCheckAt = now + 100;
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
  if (player.hp < (player.maxHp || 100)) {
    for (const [id, p] of healthPacks) {
      if (player.pos.distanceTo(p.pos) < 1.4) {
        socket.emit('pickupHealth', id);
        break;
      }
    }
  }

  // Airdrop kasaları: yere indikten sonra üzerinden geçince otomatik alınır
  for (const [id, a] of airdrops) {
    if (a.landed && player.pos.distanceTo(a.pos) < 1.6) {
      socket.emit('pickupDrop', id);
      break;
    }
  }
}

// ================== HUD ==================
function updateHpHUD() {
  const hp = Math.max(0, player.hp);
  const maxHp = Math.max(1, player.maxHp || 100);
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  $('hpbar').style.width = pct + '%';
  $('hptext').textContent = maxHp > 100 ? `${hp}/${maxHp}` : hp;
  $('hpbar').style.background = pct > 60
    ? 'linear-gradient(90deg,#2ecc71,#27ae60)'
    : pct > 30
      ? 'linear-gradient(90deg,#f39c12,#e67e22)'
      : 'linear-gradient(90deg,#e74c3c,#c0392b)';
}
function updateAmmoHUD() {
  if (GUNS[player.gun].melee) { $('ammo').innerHTML = `🗡️ <small>∞</small>`; return; }
  if (player.alive && performance.now() < player.rapidUntil) { $('ammo').innerHTML = `∞ <small>🔥</small>`; return; }
  $('ammo').innerHTML = `${player.ammo} <small>/ ${GUNS[player.gun].mag}</small>`;
}
// Aktif airdrop buff'larını sol-altta sayaçla göster
function updateBuffHUD(now) {
  const el = $('buff-indicator');
  if (!el) return;
  let html = '';
  if (player.alive && now < player.rapidUntil) html += `<div class="buff">🔥 Hızlı Ateş <b>${Math.ceil((player.rapidUntil - now) / 1000)}s</b></div>`;
  if (player.alive && now < player.dmgUntil) html += `<div class="buff">💥 Çift Hasar <b>${Math.ceil((player.dmgUntil - now) / 1000)}s</b></div>`;
  if (player.alive && player.maxHp > 100) html += `<div class="buff">❤️ Overheal <b>${Math.max(0, player.hp)}</b></div>`;
  el.innerHTML = html;
  // Hızlı ateş bitince ammo HUD'ını gerçek mermi sayısına döndür (tek seferlik)
  const rapidNow = player.alive && now < player.rapidUntil;
  if (_rapidHudActive && !rapidNow) updateAmmoHUD();
  _rapidHudActive = rapidNow;
}
let _rapidHudActive = false;
function updateScoreHUD() {
  // Futbol skor tabelası (büyük, ortada) — diğer modlarda gizli
  const fs = $('futbol-score');
  if (fs) {
    if (gameMode === 'futbol') {
      fs.style.display = 'flex';
      $('score').style.display = 'none';
      $('fs-pol').textContent = footyScore.police || 0;
      $('fs-ban').textContent = footyScore.bandit || 0;
      return;
    } else {
      fs.style.display = 'none';
      $('score').style.display = '';
    }
  }
  if (gameMode === 'team') {
    $('score-me').textContent = teamScores.police || 0;
    $('score-en').textContent = teamScores.bandit || 0;
    $('score-me-name').textContent = `Polis R${currentRound}`;
    $('score-en-name').textContent = 'Haydut';
    return;
  }
  if (gameMode === 'domination') {
    $('score-me').textContent = teamScores.police || 0;
    $('score-en').textContent = teamScores.bandit || 0;
    $('score-me-name').textContent = '🚔 Polis';
    $('score-en-name').textContent = 'Haydut 🦹';
    return;
  }
  if (gameMode === 'kilic') {
    const myWins = ffaWins[socket.id] || 0;
    const others = [...enemies.values()].map((e) => ({ name: e.name, wins: ffaWins[e.id] || 0 })).sort((a, b) => b.wins - a.wins);
    const leader = others[0] || null;
    $('score-me').textContent = `${myWins} 🏆`;
    $('score-en').textContent = leader ? `${leader.wins} 🏆` : '0';
    $('score-me-name').textContent = `${myName} R${currentRound}`;
    $('score-en-name').textContent = leader ? leader.name : 'Rakip';
    return;
  }
  if (gameMode === 'gungame') {
    const n = GUN_GAME_ORDER.length;
    const others = [...enemies.values()].sort((a, b) => b.kills - a.kills);
    const leader = others[0] || null;
    $('score-me').textContent = `Sv ${Math.min(player.kills, n)}/${n}`;
    $('score-en').textContent = leader ? `Sv ${Math.min(leader.kills, n)}/${n}` : '0';
    $('score-me-name').textContent = myName;
    $('score-en-name').textContent = leader ? leader.name : 'Rakip';
    return;
  }
  if (gameMode === 'kral') {
    const king = player.isKing ? { name: myName } : [...enemies.values()].find((e) => e.isKing);
    $('score-me').textContent = kingWins[socket.id] || 0;
    $('score-en').textContent = king ? '300 HP' : '-';
    $('score-me-name').textContent = `${myName} R${currentRound}`;
    $('score-en-name').textContent = king ? `Kral: ${king.name}` : 'Kral';
    return;
  }
  $('score-me').textContent = player.kills;
  const others = [...enemies.values()].sort((a, b) => b.kills - a.kills);
  const leader = others[0] || null;
  $('score-en').textContent = leader ? leader.kills : 0;
  $('score-me-name').textContent = myName;
  $('score-en-name').textContent = leader ? leader.name : 'Rakip';
}
// Sunucudan gelen skor haritasini ({id: {k, d, team}}) oyuncu+dusmanlara uygula
function applyScores(scores) {
  if (!scores) return;
  const me = scores[socket.id];
  if (me) { player.kills = me.k; player.deaths = me.d; }
  for (const enemy of enemies.values()) {
    const s = scores[enemy.id];
    if (s) { enemy.kills = s.k; enemy.deaths = s.d; if (s.team) enemy.team = s.team; }
  }
}

// TAB skor tablosu: kim kac kisi vurdu / kac kez oldu
function renderScoreboard() {
  const board = $('scoreboard');
  if (!board) return;
  const rows = [
    { id: socket.id, name: myName + ' (sen)', kills: player.kills, deaths: player.deaths, team: myTeam, me: true },
    ...[...enemies.values()].map((e) => ({ id: e.id, name: e.name, kills: e.kills, deaths: e.deaths, team: e.team, me: false })),
  ];

  const rowHtml = (r) => `
    <tr class="${r.me ? 'me' : ''}">
      <td class="sb-name">${escapeHtml(r.name)}</td>
      <td class="sb-k">${r.kills || 0}</td>
      <td class="sb-d">${r.deaths || 0}</td>
    </tr>`;
  const tableHead = `<tr><th>Oyuncu</th><th>Vurus</th><th>Olum</th></tr>`;

  if (isTeamMode()) {
    const scoreLabel = gameMode === 'domination' ? 'Puan' : 'Round';
    const make = (team, label, cls) => {
      const list = rows.filter((r) => r.team === team).sort((a, b) => b.kills - a.kills);
      const total = list.reduce((s, r) => s + (r.kills || 0), 0);
      return `
        <div class="sb-team ${cls}">
          <div class="sb-team-head"><span>${label}</span><span>${scoreLabel}: ${teamScores[team] || 0} • Vurus: ${total}</span></div>
          <table>${tableHead}${list.map(rowHtml).join('') || '<tr><td colspan="3" class="sb-empty">—</td></tr>'}</table>
        </div>`;
    };
    board.innerHTML = `<h3>SKOR TABLOSU</h3>${make('police', '🚔 Polis', 'sb-police')}${make('bandit', '🦹 Haydut', 'sb-bandit')}`;
  } else {
    rows.sort((a, b) => b.kills - a.kills);
    board.innerHTML = `<h3>SKOR TABLOSU</h3><table>${tableHead}${rows.map(rowHtml).join('')}</table>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let scoreboardPinned = false;
function showScoreboard(on) {
  const board = $('scoreboard');
  if (!board) return;
  if (on) renderScoreboard();
  board.style.display = on ? 'block' : 'none';
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

let spectateTargetId = null;

function livingTeamMates() {
  if (gameMode !== 'team' || !myTeam) return [];
  return [...enemies.values()].filter((e) => e.team === myTeam && e.alive);
}

function stopTeamSpectate() {
  spectateTargetId = null;
  const hint = $('spectate-hint');
  if (hint) hint.style.display = 'none';
  if (!player.zoomed) gunGroup.visible = true;
}

function startTeamSpectate() {
  if (gameMode !== 'team') return false;
  const mates = livingTeamMates();
  if (!mates.length) return false;
  spectateTargetId = mates[0].id;
  const hint = $('spectate-hint');
  if (hint) hint.style.display = 'block';
  gunGroup.visible = false;
  return true;
}

function updateTeamSpectateCamera() {
  if (!spectateTargetId || gameMode !== 'team' || player.alive) return false;
  let target = enemyById(spectateTargetId);
  if (!target || !target.alive) {
    target = livingTeamMates()[0] || null;
    spectateTargetId = target ? target.id : null;
  }
  if (!target) {
    const hint = $('spectate-hint');
    if (hint) hint.style.display = 'none';
    return false;
  }

  const yaw = target.targetYaw || target.group.rotation.y || 0;
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const targetPos = target.group.position.clone();
  const camPos = targetPos.clone().addScaledVector(fwd, -4.8);
  camPos.y += 2.35;
  camera.position.lerp(camPos, 0.22);
  camera.lookAt(targetPos.x, targetPos.y + 1.45, targetPos.z);
  gunGroup.visible = false;
  const hint = $('spectate-hint');
  if (hint) {
    hint.textContent = `TAKIM ARKADASINI IZLIYORSUN: ${target.name}`;
    hint.style.display = 'block';
  }
  return true;
}

// ================== SOKET OLAYLARI ==================
socket.on('start', ({ players, weapons, arena, mode, round, teamScores: scores, kingProtectMs, footyScore: fScore }) => {
  gameMode = mode || gameMode;
  currentRound = round || currentRound;
  teamScores = scores || teamScores;
  footyScore = fScore || { police: 0, bandit: 0 };
  ball.target.set(0, FUTBOL_BALL_RADIUS, 0);
  ball.mesh.position.set(0, FUTBOL_BALL_RADIUS, 0);
  arenaChoice = arena || arenaChoice;
  applyArenaLayout(arenaChoice);
  removeAllEnemies();
  for (const w of [...groundWeapons.values()]) scene.remove(w.mesh);
  groundWeapons.clear();
  for (const p of [...healthPacks.values()]) scene.remove(p.mesh);
  healthPacks.clear();
  for (const id of [...airdrops.keys()]) removeAirdrop(id);
  clearDomZones();

  for (const info of players) {
    if (info.id === socket.id) {
      const [sx, sz] = safeSpawnPos(info.pos[0], info.pos[2]);
      player.pos.set(sx, info.pos[1], sz);
      player.yaw = info.yaw;
      player.pitch = 0;
      player.hp = info.hp;
      player.maxHp = info.maxHp || 100;
      player.isKing = !!info.isKing;
      player.protUntil = player.isKing && kingProtectMs ? Date.now() + kingProtectMs : 0;
      player.alive = info.hp > 0;
      player.kills = info.kills;
      player.rapidUntil = 0; // yeni maçta airdrop buff'ları temiz
      player.dmgUntil = 0;
      myTeam = info.team || null;
      player.crouch = false;
      player.eyeHeight = STAND_EYE_HEIGHT;
      equipForMode();
    } else {
      const enemy = createEnemy(info);
      if (enemy.isKing && kingProtectMs) enemy.protUntil = Date.now() + kingProtectMs;
    }
  }
  refreshTeamVisibility(); // myTeam belli oldu -> dusman etiketlerini gizle
  if (gameMode === 'kilic') { ffaWins = {}; for (const info of players) ffaWins[info.id] = info.wins || 0; }
  if (gameMode === 'kral') { kingWins = {}; for (const info of players) kingWins[info.id] = info.wins || 0; }
  if (gameMode !== 'awp') for (const w of weapons) spawnGroundWeapon(w);
  if (gameMode === 'domination') buildDomZones();

  $('waiting').style.display = 'none';
  $('menu').style.display = 'none';
  $('hud').style.display = 'block';
  $('death-overlay').style.display = 'none';
  scoreboardPinned = false;
  showScoreboard(false);
  $('roomtag-code').textContent = roomCode;
  gameRunning = true;
  updateHpHUD(); updateAmmoHUD(); updateScoreHUD();
  const startMsg = gameMode === 'team' ? `Round ${currentRound}: Polis vs Haydut`
    : gameMode === 'domination' ? 'Bölgeleri ele geçir! 🚩'
    : gameMode === 'gungame' ? 'Gun Game! Her kill yeni silah 🔫'
    : gameMode === 'kilic' ? 'Kılıç düellosu! Sona kalan kazanır 🗡️'
    : gameMode === 'kral' ? (player.isKing ? 'Kral sensin! 300 canla dayan.' : 'Krali indir, siradaki kral ol!')
    : gameMode === 'awp' ? 'AWP 1v1 basladi. Uzun hatti tut!'
    : gameMode === 'futbol' ? 'Futbol! Topu sür, SPACE ile şut çek ⚽'
    : gameMode === 'arena' ? 'Arena basladi!' : 'Rakip geldi! Savas basladi!';
  toast(startMsg);
  if (gameMode === 'kral' && player.isKing && kingProtectMs) {
    const ph = $('prot-hint');
    ph.textContent = 'KRAL KORUMASI';
    ph.style.display = 'block';
    clearTimeout(ph._timer);
    ph._timer = setTimeout(() => {
      ph.style.display = 'none';
      ph.textContent = 'DOGUM KORUMASI';
    }, kingProtectMs);
  }
  if (gameMode === 'kilic') {
    setTimeout(() => toast('SOL TIK: ağır vuruş 50 (yavaş) ⚔️  •  SAĞ TIK: hızlı vuruş 33 🗡️', 4000), 2700);
  }
  // Pointer lock yalnızca gerçek bir kullanıcı tıklamasından sonra açılabilir
  // (tarayıcı kısıtı). Otomatik açmaya çalışmak sessizce reddedilir ve oyuncu
  // donar. Bu yüzden "tıkla ve başla" ekranını gösteriyoruz; kilit btn-resume
  // tıklamasıyla açılır.
  // Takim modunda once takim secim ekrani, ardindan sensitivity/baslat ekrani.
  // Polis/Haydut takim secim ekrani YALNIZCA takim modunda gosterilir.
  if (gameMode === 'team' && !teamChosen) {
    showTeamSelect();
  } else if (gameMode === 'futbol') {
    pendingFutbolKickoff = true;
    const help = $('help');
    if (help) help.innerHTML = 'WASD: hareket &nbsp;•&nbsp; FARE: yön &nbsp;•&nbsp; SPACE: şut &nbsp;•&nbsp; Q: top çal (savunma) &nbsp;•&nbsp; TAB: skor &nbsp;•&nbsp; ESC: duraklat';
    showResume('⚽ FUTBOL MAÇI', `${myTeam === 'bandit' ? '🦹 Haydut' : '🚔 Polis'} takımındasın — maça girmek için tıkla`);
  } else {
    showResume('SAVAS BASLADI', 'Oyuna girmek icin tikla');
  }
});

socket.on('enemyMove', (d) => {
  const enemy = enemyById(d.id);
  if (!enemy) return;
  if (!Array.isArray(d.p) || d.p.length < 3) return;
  enemy.targetPos.set(d.p[0], d.p[1], d.p[2]);
  enemy.targetYaw = d.y;
  enemy.moveSamples.push({
    t: performance.now(),
    p: [d.p[0], d.p[1], d.p[2]],
    y: Number.isFinite(d.y) ? d.y : enemy.targetYaw,
  });
  while (enemy.moveSamples.length > 8) enemy.moveSamples.shift();
  setEnemyCrouch(enemy, !!d.c);
});

// ---- Futbol: top durumu, şut efekti, gol ----
socket.on('ballState', ({ p }) => {
  if (!p) return;
  ball.target.set(p[0], p[1], p[2]);
});

socket.on('kickFx', ({ pos }) => {
  if (!pos) return;
  const here = new THREE.Vector3(pos[0], pos[1], pos[2]);
  const dist = player.pos.distanceTo(here);
  playBlip(320, 0.1, Math.max(0.05, 0.5 * (1 - dist / 40)));
});

socket.on('tackleFx', ({ pos, reached }) => {
  if (!pos) return;
  const here = new THREE.Vector3(pos[0], 0.3, pos[2]);
  const dist = player.pos.distanceTo(here);
  playBlip(reached ? 280 : 150, 0.09, Math.max(0.05, 0.4 * (1 - dist / 40)));
  if (reached) spawnParticles(here, 0xdfeee0, 8, 3, 8, 0.4, 0.06); // küçük çim/toz
});

socket.on('goal', ({ team, score }) => {
  footyScore = score || footyScore;
  const mine = myTeam && team === myTeam;
  centerBanner(mine ? 'GOOOL! ⚽' : 'Gol yedin…', mine ? 'gold' : '', 1800);
  toast(`${score.police} - ${score.bandit} (Polis - Haydut)`);
  updateScoreHUD();
});

socket.on('enemyShoot', ({ from, to, tos, gun, melee }) => {
  const f = new THREE.Vector3(...from);
  const dist = player.pos.distanceTo(f);
  if (melee) {
    // Kilic savurmasi: iz/namlu yok, sadece yakinsa hafif savurma sesi
    if (dist < 8) playBlip(200, 0.12, Math.max(0.05, 0.2 * (1 - dist / 8)));
    return;
  }
  const ends = tos || (to ? [to] : []);
  for (const t of ends) {
    const e = new THREE.Vector3(...t);
    addTracer(f, e);
    impactEffect(e, false);
  }
  // Mesafeye göre ses
  playShotSound(gun || 'rifle', Math.max(0.15, 1 - dist / 70));
});

socket.on('health', ({ id, hp, part }) => {
  if (id === socket.id) {
    const dropped = player.hp - hp;
    player.hp = hp;
    updateHpHUD();
    if (dropped > 0) { damageFlash(); playBlip(150, 0.12, 0.3); }
  } else {
    const enemy = enemyById(id);
    if (enemy) enemy.hp = hp;
  }
});

socket.on('death', ({ victim, killer, headshot, scores }) => {
  applyScores(scores);
  updateScoreHUD();
  if ($('scoreboard').style.display === 'block') renderScoreboard();
  if (killer === socket.id && victim !== socket.id) {
    player.streak++;
    if (player.streak >= 3) centerBanner(`${player.streak} SERI!`, 'gold', 1100);
    // Gun Game: kill yapinca cana doy + siradaki silaha gec (banner ile)
    if (gameMode === 'gungame') {
      player.hp = 100;
      updateHpHUD();
      const n = GUN_GAME_ORDER.length;
      if (player.kills < n) {
        applyGunGameWeapon();
        centerBanner(`SEVİYE ${player.kills + 1} — ${GUNS[gunForLevel(player.kills)].name}`, 'gold', 1100);
      }
    }
  }

  const killerName = nameById(killer);
  const victimName = nameById(victim);
  killFeed(`${killerName} ${headshot ? '🎯 (KAFADAN)' : '💀'} ${victimName}`);

  if (victim === socket.id) {
    player.streak = 0;
    player.alive = false;
    player.hp = 0;
    player.rapidUntil = 0; // ölünce süreli airdrop buff'ları biter
    player.dmgUntil = 0;
    updateHpHUD();
    if (gameMode === 'team' && startTeamSpectate()) {
      $('death-overlay').style.display = 'none';
      if (!scoreboardPinned) showScoreboard(false);
      toast('Takim arkadasini izliyorsun.');
      return;
    }
    $('death-overlay').style.display = 'flex';
    if (scoreboardPinned) renderScoreboard();
    else showScoreboard(false);
    if (gameMode === 'team' || gameMode === 'kilic') {
      $('respawn-count').textContent = '';
      $('death-overlay').querySelector('p').textContent = 'Round bitene kadar bekliyorsun...';
      return;
    }
    let cnt = 3;
    $('respawn-count').textContent = cnt;
    const iv = setInterval(() => {
      cnt--;
      if (cnt <= 0) clearInterval(iv);
      else $('respawn-count').textContent = cnt;
    }, 1000);
  } else {
    const enemy = enemyById(victim);
    if (!enemy) return;
    enemy.alive = false;
    enemy.group.rotation.x = -Math.PI / 2; // yere yat
    enemy.group.position.y = 0.3;
    toast(headshot ? 'KAFADAN TEK ATTIN! 🎯' : 'Rakibi öldürdün! 💀');
  }
});

socket.on('respawn', ({ id, pos, yaw, hp, maxHp, isKing, prot }) => {
  if (id === socket.id) {
    const [sx, sz] = safeSpawnPos(pos[0], pos[2]);
    player.pos.set(sx, pos[1], sz);
    player.yaw = yaw || 0;
    player.pitch = 0;
    player.vel.set(0, 0, 0);
    player.crouch = false;
    player.eyeHeight = STAND_EYE_HEIGHT;
    player.hp = hp;
    player.maxHp = maxHp || 100;
    player.isKing = !!isKing;
    player.alive = true;
    stopTeamSpectate();
    if (gameMode === 'gungame') applyGunGameWeapon(); else equipForMode();
    $('death-overlay').style.display = 'none';
    if (!scoreboardPinned) showScoreboard(false);
    updateHpHUD();
    if (prot) {
      const ph = $('prot-hint');
      ph.style.display = 'block';
      clearTimeout(ph._timer);
      ph._timer = setTimeout(() => (ph.style.display = 'none'), prot);
    }
  } else {
    const enemy = enemyById(id);
    if (!enemy) return;
    enemy.alive = true;
    enemy.hp = hp;
    enemy.maxHp = maxHp || 100;
    enemy.isKing = !!isKing;
    enemy.group.rotation.x = 0;
    resetEnemyMotion(enemy, pos, yaw || enemy.targetYaw);
    enemy.protUntil = Date.now() + (prot || 0); // korumalıyken model yanıp söner
    setEnemyCrouch(enemy, false);
  }
});

socket.on('teamChanged', ({ id, team, pos, yaw, hp, prot }) => {
  if (id === socket.id) {
    myTeam = team;
    refreshTeamVisibility(); // takimim degisti -> tum etiket gorunurlugu yeniden
    if (pos) { const [sx, sz] = safeSpawnPos(pos[0], pos[2]); player.pos.set(sx, pos[1] || 0, sz); }
    if (typeof yaw === 'number') player.yaw = yaw;
    if (typeof hp === 'number') { player.hp = hp; player.alive = hp > 0; }
    updateHpHUD(); updateScoreHUD();
    if (prot) {
      const ph = $('prot-hint');
      ph.style.display = 'block';
      clearTimeout(ph._timer);
      ph._timer = setTimeout(() => (ph.style.display = 'none'), prot);
    }
  } else {
    const enemy = enemyById(id);
    if (enemy) {
      setEnemyTeam(enemy, team);
      if (pos) resetEnemyMotion(enemy, pos, typeof yaw === 'number' ? yaw : enemy.targetYaw);
      else if (typeof yaw === 'number') enemy.targetYaw = yaw;
      if (typeof hp === 'number') { enemy.hp = hp; enemy.alive = hp > 0; }
    }
  }
  if ($('scoreboard').style.display === 'block') renderScoreboard();
});

socket.on('roundEnd', ({ winner, winnerId, winnerName, ffa, king, wins, teamScores: scores, nextRoundIn }) => {
  showScoreboard(true); // round sonu skor tablosunu goster
  if (king) {
    if (wins) kingWins = wins;
    updateScoreHUD();
    const won = winnerId === socket.id;
    centerBanner(won ? 'SIRADAKI KRAL SENSIN' : `${winnerName || 'Bir oyuncu'} KRAL OLDU`, won ? 'gold' : 'red', nextRoundIn || 3500);
    toast(`${winnerName || 'Bir oyuncu'} krali devirdi. Yeni round basliyor...`, nextRoundIn || 3500);
    return;
  }
  if (ffa) {
    // Kilic (FFA): son kalan oyuncu round'u kazanir
    if (wins) ffaWins = wins;
    updateScoreHUD();
    if (winnerId) {
      const won = winnerId === socket.id;
      const nm = won ? 'SEN' : (winnerName || 'Bir oyuncu');
      centerBanner(`${nm} KAZANDI 🗡️`, won ? 'gold' : 'red', nextRoundIn || 3500);
      toast(`${won ? 'Sen' : winnerName} round'u kazandin!`, nextRoundIn || 3500);
    } else {
      centerBanner('BERABERE', 'blue', nextRoundIn || 3500);
    }
    return;
  }
  teamScores = scores || teamScores;
  updateScoreHUD();
  const name = winner === 'police' ? 'Polis' : 'Haydut';
  centerBanner(`${name.toUpperCase()} KAZANDI`, winner === 'police' ? 'blue' : 'red', nextRoundIn || 3500);
  toast(`${name} round kazandi!`, nextRoundIn || 3500);
});

// Domination: bolge durumu (1 sn'de bir gelir) - skor + ele gecirme yuzdeleri
socket.on('domState', ({ caps, scores }) => {
  if (scores) { teamScores = scores; updateScoreHUD(); }
  updateDomZones(caps);
  if ($('scoreboard').style.display === 'block') renderScoreboard();
});

// Mac sonu: Gun Game galibi veya Domination hedefi. 5 sn sonra yeni mac baslar.
socket.on('gameOver', ({ winner, winnerName, winnerTeam, scores }) => {
  if (scores) applyScores(scores);
  showScoreboard(true);
  document.exitPointerLock();
  let label, kind;
  if (winnerTeam) {
    label = `${winnerTeam === 'police' ? '🚔 POLİS' : '🦹 HAYDUT'} KAZANDI`;
    kind = winnerTeam === 'police' ? 'blue' : 'red';
  } else {
    const me = winner === socket.id;
    label = me ? '🏆 KAZANDIN!' : `${winnerName || nameById(winner)} KAZANDI`;
    kind = 'gold';
  }
  centerBanner(label, kind, 4800);
  toast('Yeni maç 5 saniye içinde başlıyor...', 4800);
});

socket.on('roundStart', ({ players, weapons, round, teamScores: scores, kingProtectMs }) => {
  currentRound = round || currentRound + 1;
  teamScores = scores || teamScores;
  for (const w of [...groundWeapons.values()]) scene.remove(w.mesh);
  groundWeapons.clear();
  for (const p of [...healthPacks.values()]) scene.remove(p.mesh);
  healthPacks.clear();
  for (const id of [...airdrops.keys()]) removeAirdrop(id);
  removeAllEnemies();
  for (const info of players) {
    if (info.id === socket.id) {
      const [sx, sz] = safeSpawnPos(info.pos[0], info.pos[2]);
      player.pos.set(sx, info.pos[1], sz);
      player.yaw = info.yaw || 0;
      player.pitch = 0;
      player.vel.set(0, 0, 0);
      player.hp = info.hp;
      player.maxHp = info.maxHp || 100;
      player.isKing = !!info.isKing;
      player.protUntil = player.isKing && kingProtectMs ? Date.now() + kingProtectMs : 0;
      player.alive = info.hp > 0;
      player.crouch = false;
      player.eyeHeight = STAND_EYE_HEIGHT;
      myTeam = info.team || myTeam;
      stopTeamSpectate();
      equipForMode();
      $('death-overlay').style.display = 'none';
      if (!scoreboardPinned) showScoreboard(false);
      $('death-overlay').querySelector('p').innerHTML = '<span id="respawn-count">3</span> saniye sonra yeniden dogacaksin...';
      updateHpHUD();
    } else {
      const enemy = createEnemy(info);
      if (enemy.isKing && kingProtectMs) enemy.protUntil = Date.now() + kingProtectMs;
    }
  }
  refreshTeamVisibility(); // dusman etiketlerini gizle
  if (gameMode === 'kral') { kingWins = {}; for (const info of players) kingWins[info.id] = info.wins || 0; }
  if (gameMode !== 'awp') for (const w of weapons) spawnGroundWeapon(w);
  updateAmmoHUD();
  updateScoreHUD();
  centerBanner(gameMode === 'kral' && player.isKing ? `ROUND ${currentRound}: KRAL SENSIN` : `ROUND ${currentRound}`, 'gold', 1000);
  toast(gameMode === 'kral' ? (player.isKing ? '300 canla hayatta kal.' : 'Krali avla.') : `Round ${currentRound} basladi!`);
  if (gameMode === 'kral' && player.isKing && kingProtectMs) {
    const ph = $('prot-hint');
    ph.textContent = 'KRAL KORUMASI';
    ph.style.display = 'block';
    clearTimeout(ph._timer);
    ph._timer = setTimeout(() => {
      ph.style.display = 'none';
      ph.textContent = 'DOGUM KORUMASI';
    }, kingProtectMs);
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
  } else {
    const enemy = enemyById(by);
    if (enemy) enemy.hp = hp;
  }
});

socket.on('weaponTaken', ({ id, by, type }) => {
  const w = groundWeapons.get(id);
  if (w) { scene.remove(w.mesh); groundWeapons.delete(id); }
  if (by === socket.id) {
    switchGun(type);
    centerBanner(type === 'sniper' ? 'AWP ALINDI' : GUNS[type].name, type === 'sniper' ? 'gold' : 'blue', 1000);
    toast(`${GUNS[type].name} aldın!`);
    playBlip(650, 0.1, 0.2);
  }
});

socket.on('weaponSpawn', (w) => {
  spawnGroundWeapon(w);
});

socket.on('airdropSpawn', ({ id, pos }) => {
  spawnAirdrop(id, pos);
  toast('📦 Airdrop geliyor! Kasayı kapan buff alır.');
  centerBanner('📦 AIRDROP!', 'gold', 1100);
  playBlip(520, 0.18, 0.18);
});

socket.on('airdropTaken', ({ id, by, buff, hp, maxHp, weapon, duration }) => {
  removeAirdrop(id);
  const mine = by === socket.id;
  const dur = duration || 10000;
  if (buff === 'overheal') {
    if (mine) {
      player.maxHp = maxHp || 150;
      player.hp = hp || player.maxHp;
      updateHpHUD();
      centerBanner('❤️ OVERHEAL!', 'blue', 1200);
    } else {
      const e = enemyById(by);
      if (e) { e.maxHp = maxHp || 150; e.hp = hp || e.maxHp; }
    }
  } else if (buff === 'weapon') {
    if (mine) {
      const wtype = weapon || 'sniper';
      switchGun(wtype);
      centerBanner(`🔫 ${GUNS[wtype].name}!`, 'gold', 1200);
    }
  } else if (buff === 'rapid') {
    if (mine) { player.rapidUntil = performance.now() + dur; updateAmmoHUD(); centerBanner('🔥 HIZLI ATEŞ!', 'gold', 1200); }
  } else if (buff === 'doubledmg') {
    if (mine) { player.dmgUntil = performance.now() + dur; centerBanner('💥 ÇİFT HASAR!', 'red', 1200); }
  }
  if (mine) { toast('Buff aktif!'); playBlip(900, 0.14, 0.22); }
});

socket.on('playerJoined', (info) => {
  if (info.id !== socket.id && !enemyById(info.id)) createEnemy(info);
  toast(`${info.name} arenaya katildi.`);
  updateScoreHUD();
  if ($('scoreboard').style.display === 'block') renderScoreboard();
});

socket.on('playerLeft', ({ id, name }) => {
  removeEnemy(id);
  toast(`${name} oyundan ayrildi.`);
  updateScoreHUD();
  if ($('scoreboard').style.display === 'block') renderScoreboard(); // listeden sil
});

socket.on('opponentLeft', ({ name }) => {
  gameRunning = false;
  removeAllEnemies();
  document.exitPointerLock();
  $('hud').style.display = 'none';
  hideResume();
  $('waiting').style.display = 'flex';
  $('code-display').textContent = roomCode;
  $('waiting-hint').textContent = `${name} oyundan ayrıldı. Yeni rakip bekleniyor...`;
});

socket.on('disconnect', () => {
  if (gameRunning) toast('Sunucu bağlantısı koptu!', 5000);
});

// ================== ANA DÖNGÜ ==================
let lastSend = 0;
let fpsFrames = 0;
let fpsLast = performance.now();
let lastPingCheck = 0;
const clock = new THREE.Clock();

function updateNetStats(now) {
  fpsFrames++;
  if (now - fpsLast >= 1000) {
    $('fps-val').textContent = Math.round((fpsFrames * 1000) / (now - fpsLast));
    fpsFrames = 0;
    fpsLast = now;
  }
  if (socket.connected && now - lastPingCheck >= 2000) {
    lastPingCheck = now;
    const sent = performance.now();
    socket.timeout(1500).emit('pingCheck', () => {
      $('ping-val').textContent = Math.round(performance.now() - sent);
    });
  }
}

// Hareket hesaplarında her karede yeniden ayırma yapmamak için geçici vektörler
const _mvFwd = new THREE.Vector3();
const _mvRight = new THREE.Vector3();
const _mvMove = new THREE.Vector3();
let lastMenuRender = 0;
let shadowTick = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  const wallNow = Date.now();
  updateNetStats(now);

  if (gameRunning) {
    // --- Hareket ---
    if (player.alive && document.pointerLockElement === document.body) {
      const fwd = _mvFwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      const right = _mvRight.set(-fwd.z, 0, fwd.x);
      const move = _mvMove.set(0, 0, 0);
      if (keys['KeyW']) move.add(fwd);
      if (keys['KeyS']) move.sub(fwd);
      if (keys['KeyD']) move.add(right);
      if (keys['KeyA']) move.sub(right);
      player.crouch = !!(keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyC']);
      const speed = player.crouch ? CROUCH_SPEED : MOVE_SPEED;
      if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);
      player.planarSpeed = move.length(); // futbol top tahmini için (lokal hız)

      player.pos.x += move.x * dt;
      resolveCollisions('x');
      player.pos.z += move.z * dt;
      resolveCollisions('z');

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
      if (gameMode === 'futbol') {
        // Space = topa şut çek (zıplama yok)
        if (keys['Space'] && now - lastKickAt > 250) {
          lastKickAt = now;
          socket.emit('kick', { y: +player.yaw.toFixed(3) });
        }
      } else if (keys['Space'] && player.onGround && !player.crouch) {
        player.vel.y = JUMP_VEL;
        player.onGround = false;
      }

      // Otomatik ateş (futbolda silah yok)
      if (gameMode !== 'futbol' && mouseDown && GUNS[player.gun].auto) tryShoot();
    }

    // Şarjör bitti mi
    if (player.reloading) {
      const total = Math.max(1, player.reloadEnd - player.reloadStart);
      const prog = Math.max(0, Math.min(1, (now - player.reloadStart) / total));
      $('reloadbar').style.width = `${Math.round(prog * 100)}%`;
      if (now >= player.reloadEnd) finishReload();
    }

    // Kamera
    const targetEye = player.crouch ? CROUCH_EYE_HEIGHT : STAND_EYE_HEIGHT;
    player.eyeHeight += (targetEye - player.eyeHeight) * Math.min(1, dt * 14);
    camera.position.set(player.pos.x, player.pos.y + player.eyeHeight, player.pos.z);
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
    if (screenShake > 0) {
      const s = screenShake * 0.004;
      camera.rotation.z = (Math.random() - 0.5) * s;
      camera.rotation.x += (Math.random() - 0.5) * s;
      screenShake = Math.max(0, screenShake - dt * 7);
    } else {
      camera.rotation.z = 0;
    }

    // Silah animasyonu (geri tepme + sallanma)
    gunRecoil = Math.max(0, gunRecoil - dt * 8);
    const bob = Math.sin(now * 0.012) * 0.006 * (keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] ? 1 : 0.2);
    const reloadProg = player.reloading
      ? Math.max(0, Math.min(1, (now - player.reloadStart) / Math.max(1, player.reloadEnd - player.reloadStart)))
      : 0;
    const reloadDip = player.reloading ? Math.sin(reloadProg * Math.PI) : 0;
    gunGroup.position.z = -0.5 + gunRecoil * 0.12 + reloadDip * 0.08;
    gunGroup.position.y = -0.24 + bob - reloadDip * 0.22;
    gunGroup.rotation.x = gunRecoil * 0.15 + reloadDip * 0.65;
    gunGroup.rotation.z = player.reloading ? Math.sin(reloadProg * Math.PI * 2) * 0.18 : 0;
    // Kilic: viewmodel savurma (tipe gore farkli) - gun anim'ini ezer
    if (GUNS[player.gun].melee) {
      const decay = swordSwingType === 'light' ? 4.8 : 2.3; // hafif hizli, agir yavas
      swordSwing = Math.max(0, swordSwing - dt * decay);
      const s = Math.sin(swordSwing * Math.PI); // 0->1->0 yumusak yay
      if (swordSwingType === 'light') {
        // Cevik yatay savurma (saga dogru flick)
        gunGroup.position.set(0.26 - s * 0.10, -0.22 + bob, -0.5 + s * 0.06);
        gunGroup.rotation.set(-s * 0.5, s * 1.25, 0.35 - s * 0.6);
      } else {
        // Agir tepeden asagi savurma (genis + guclu)
        gunGroup.position.set(0.26 + s * 0.05, -0.22 + bob + s * 0.17, -0.5 + s * 0.2);
        gunGroup.rotation.set(-s * 1.95, 0, 0.35 - s * 1.05);
      }
    }
    // Kilic savurma izi (slash sprite) sonumlemesi
    if (slashSprite.material.opacity > 0) {
      slashFx.t += dt;
      const k = Math.min(1, slashFx.t / slashFx.dur);
      slashSprite.material.opacity = 1 - k;
      const grow = slashFx.base + k * (slashFx.type === 'heavy' ? 1.0 : 0.7);
      slashSprite.scale.set(grow, grow, 1);
      slashSprite.material.rotation = slashFx.rot0 - k * slashFx.sweep; // yay supurmesi
    }
    flash.intensity = Math.max(0, flash.intensity - dt * 30);
    flashSprite.material.opacity = Math.max(0, flashSprite.material.opacity - dt * 20);

    // Futbol topu: lokal oyuncu topu sürerken İSTEMCİ TAHMİNİ (ağ gecikmesi olmadan önümde
    // dururum), aksi halde sunucudan gelen pozisyona lerp. Bu, "sürerken topu göremiyorum"
    // sorununu çözer (sunucu pozisyonu hareket halinde geride kalıyordu).
    if (gameMode === 'futbol' && ball.mesh.visible) {
      const px = ball.mesh.position.x, pz = ball.mesh.position.z;
      const dToBall = Math.hypot(player.pos.x - ball.target.x, player.pos.z - ball.target.z);
      const justActed = (now - lastKickAt < 320) || (now - lastTackleAt < 320);
      const owning = player.alive && !justActed && dToBall < FB_CONTROL_R;
      let aim, rate;
      if (owning) {
        const spd = player.planarSpeed || 0;
        const lead = FB_DRIBBLE_DIST + Math.min(FB_LEAD_MAX, FB_LEAD_PER_SPD * spd);
        const dirx = -Math.sin(player.yaw), dirz = -Math.cos(player.yaw);
        ballPredict.set(player.pos.x + dirx * lead, FUTBOL_BALL_RADIUS, player.pos.z + dirz * lead);
        aim = ballPredict; rate = 20; // tahmine hızlı yapış (gecikmesiz his)
      } else {
        aim = ball.target; rate = 16;
      }
      ball.mesh.position.lerp(aim, Math.min(1, dt * rate));
      const ddx = ball.mesh.position.x - px, ddz = ball.mesh.position.z - pz;
      // hareket yönüne dik eksende yuvarla (mesafe / yarıçap = açı)
      ball.mesh.rotation.x += ddz / FUTBOL_BALL_RADIUS;
      ball.mesh.rotation.z -= ddx / FUTBOL_BALL_RADIUS;
    }

    // Rakip yumuşatma
    for (const enemy of enemies.values()) {
      updateEnemyInterpolation(enemy, now, dt);
      // Doğum koruması: model yanıp söner
      if (enemy.protUntil > wallNow) {
        enemy.group.visible = Math.floor(now / 90) % 2 === 0;
      } else if (!enemy.group.visible) {
        enemy.group.visible = true;
      }
    }
    updateTeamSpectateCamera();

    // Yerdeki nesne animasyonları
    for (const w of groundWeapons.values()) {
      w.mesh.rotation.y += dt * 1.5;
      w.mesh.position.y = w.pos.y + 0.8 + Math.sin(now * 0.003) * 0.1;
    }
    for (const p of healthPacks.values()) {
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = p.pos.y + 0.5 + Math.sin(now * 0.004) * 0.12;
    }
    // Airdrop kasaları: gökten iner, sonra hafifçe süzülür; ışık huzmesi nabız atar
    for (const a of airdrops.values()) {
      a.mesh.rotation.y += dt * 1.2;
      const restY = a.pos.y + 0.55;
      if (!a.landed) {
        a.y = Math.max(restY, a.y - dt * 9); // ~9 birim/sn iniş
        if (a.y <= restY + 0.01) a.landed = true;
        a.mesh.position.y = a.y;
      } else {
        a.mesh.position.y = restY + Math.sin(now * 0.004) * 0.12;
      }
      a.beam.material.opacity = 0.12 + Math.sin(now * 0.005) * 0.06;
    }
    // Domination bölge halkaları yavaşça döner (hafif)
    for (const z of domZones) z.ring.rotation.z += dt * 0.6;

    checkPickups(now);
    updateBuffHUD(now);

    // Pozisyon gönder
    if (player.alive && now - lastSend > SEND_INTERVAL) {
      lastSend = now;
      socket.volatile.emit('move', {
        p: [+player.pos.x.toFixed(2), +player.pos.y.toFixed(2), +player.pos.z.toFixed(2)],
        y: +player.yaw.toFixed(3),
        c: player.crouch,
      });
    }
  }

  // Tracer söndürme (havuza iade — geometri/materyal yeniden kullanilir)
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= dt;
    t.mesh.material.opacity = Math.max(0, t.life / 0.08) * 0.85;
    if (t.life <= 0) {
      scene.remove(t.mesh);
      t.mesh.visible = false;
      TRACER_POOL.push(t);
      tracers.splice(i, 1);
    }
  }

  // Parçacıklar (kıvılcım / toz / kan)
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    const arr = p.pts.geometry.attributes.position.array;
    for (let j = 0; j < p.count; j++) {
      p.vels[j].y -= p.grav * dt;
      arr[j * 3] += p.vels[j].x * dt;
      arr[j * 3 + 1] += p.vels[j].y * dt;
      arr[j * 3 + 2] += p.vels[j].z * dt;
    }
    p.pts.geometry.attributes.position.needsUpdate = true;
    p.pts.material.opacity = Math.max(0, p.life / p.max);
    if (p.life <= 0) {
      scene.remove(p.pts);
      p.pts.visible = false;
      PARTICLE_POOL.push(p);
      particles.splice(i, 1);
    }
  }

  // Fırlatılan kovanlar (havuza iade)
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
      s.mesh.visible = false;
      SHELL_POOL.push(s);
      shells.splice(i, 1);
    }
  }

  // Oyun çalışırken tam hız; menü/lobi gibi durumlarda sahne neredeyse opak panel
  // arkasında kaldığından GPU yükünü düşürmek için ~10fps render etmek yeterli.
  // Gölge haritası (autoUpdate kapalı) oyun içinde iki karede bir, menüde her render'da yenilenir.
  if (gameRunning) {
    if ((shadowTick++ & 1) === 0) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
  } else if (now - lastMenuRender > 100) {
    lastMenuRender = now;
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
  }
}
animate();

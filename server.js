const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'),
}));

const PORT = process.env.PORT || 3000;

// ---- Oyun sabitleri ----
const MODES = {
  duel: { label: 'Duel', maxPlayers: 2 },
  arena: { label: 'Arena', maxPlayers: 8 },
  team: { label: 'Takim', maxPlayers: 8 },
  gungame: { label: 'Gun Game', maxPlayers: 8 },
  domination: { label: 'Bolge Kapma', maxPlayers: 8 },
  kilic: { label: 'Kilic', maxPlayers: 8 },
  kral: { label: 'Kral Kim', maxPlayers: 8 },
  awp: { label: 'AWP 1v1', maxPlayers: 2 },
};
// Eleme (round) modlari: olunce round bitene kadar beklenir, son kalan kazanir
const ELIM_MODES = new Set(['team', 'kilic']);
// Silahsiz modlar: yerde silah olusturma
const NO_WEAPON_MODES = new Set(['gungame', 'kilic', 'kral', 'awp']);
const NO_HEALTH_MODES = new Set(['awp']);
// Takim tabanli modlar (takim secimi, dost atesi kapali, takim dogumlari)
const TEAM_MODES = new Set(['team', 'domination']);
const ARENAS = new Set(['depot', 'lanes', 'fortress', 'yard', 'crossfire']);
const SPAWNS = [
  { pos: [-22, 0, -10], yaw: Math.PI * 0.6 },
  { pos: [22, 0, 10], yaw: -Math.PI * 0.4 },
  { pos: [-22, 0, 10], yaw: Math.PI * 0.4 },
  { pos: [22, 0, -10], yaw: -Math.PI * 0.6 },
  { pos: [-10, 0, -22], yaw: 0 },
  { pos: [10, 0, 22], yaw: Math.PI },
  { pos: [-10, 0, 22], yaw: Math.PI },
  { pos: [10, 0, -22], yaw: 0 },
];

const AWP_SPAWNS = [
  { pos: [0, 0, 24], yaw: Math.PI },
  { pos: [0, 0, -24], yaw: 0 },
];

// Saglik paketi cikabilecek noktalar (haritadaki bos alanlar)
const HEALTH_POINTS = [
  [0, 0, 14], [0, 0, -14], [14, 0, 0], [-14, 0, 0],
  [20, 0, -20], [-20, 0, 20], [10, 0, 10], [-10, 0, -10],
];

// Yerdeki silahlar (sabit dogma noktalari)
const WEAPON_SPAWNS = [
  { id: 'w1', type: 'sniper', pos: [0, 0, -22] },
  { id: 'w2', type: 'smg', pos: [-22, 0, 4] },
  { id: 'w3', type: 'smg', pos: [22, 0, -4] },
  { id: 'w4', type: 'shotgun', pos: [-4, 0, 22] },
  { id: 'w5', type: 'shotgun', pos: [4, 0, -22] },
];

// Silah bazli hasar (shotgun degerleri sacma basinadir, 8 sacma atar)
const DAMAGE = {
  rifle:   { head: 100, body: 33 },
  smg:     { head: 60,  body: 22 },
  shotgun: { head: 28,  body: 12 },
  sniper:  { head: 150, body: 85 },
  sword:   { head: 100, body: 55 },
  kingrifle: { head: 100, body: 100 },
};
const KING_HP = 300;
const KING_SPAWN = { pos: [0, 0, 0], yaw: 0 };
const KING_FIRE_DELAY_MS = 950;
const KING_START_PROTECT_MS = 3000;
const HEALTH_AMOUNT = 40;
const RESPAWN_MS = 3000;
const WEAPON_RESPAWN_MS = 25000;
const SPAWN_PROTECT_MS = 1000;
const ROUND_RESTART_MS = 4000;
const TEAMS = ['police', 'bandit'];

// ---- Gun Game: kill basina sirayla gecilen silahlar (bicak yok) ----
const GUN_GAME_ORDER = ['smg', 'rifle', 'shotgun', 'sniper'];

// ---- Domination (Bolge Kapma) ----
const DOM_ZONES = [
  { pos: [-14, 0, -14], name: 'Alfa' },
  { pos: [0, 0, 0], name: 'Bravo' },
  { pos: [14, 0, 14], name: 'Charlie' },
];
const DOM_RADIUS = 4.2;       // bolge yaricapi
const DOM_CAP_RATE = 34;      // tick basina ele gecirme hizi (~3 sn'de kapanir)
const DOM_TARGET = 150;       // kazanmak icin gereken puan
const DOM_TICK_MS = 1000;     // bolge dongusu periyodu

const TEAM_SPAWNS = {
  police: [
    { pos: [-22, 0, -10], yaw: Math.PI * 0.6 },
    { pos: [-22, 0, 10], yaw: Math.PI * 0.4 },
    { pos: [-10, 0, -22], yaw: 0 },
    { pos: [-10, 0, 22], yaw: Math.PI },
  ],
  bandit: [
    { pos: [22, 0, 10], yaw: -Math.PI * 0.4 },
    { pos: [22, 0, -10], yaw: -Math.PI * 0.6 },
    { pos: [10, 0, 22], yaw: Math.PI },
    { pos: [10, 0, -22], yaw: 0 },
  ],
};

const ROOMS = new Map();

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return ROOMS.has(code) ? genCode() : code;
}

function getRoom(socket) {
  return ROOMS.get(socket.data.code);
}

function clearRoomTimers(room) {
  if (room.healthTimer) { clearTimeout(room.healthTimer); room.healthTimer = null; }
  if (room.domTimer) { clearInterval(room.domTimer); room.domTimer = null; }
  for (const t of room.timers) clearTimeout(t);
  room.timers.clear();
}

function scheduleHealthPack(room) {
  if (room.healthTimer) clearTimeout(room.healthTimer);
  const delay = 30000 + Math.random() * 30000; // 30-60 sn arasi rastgele
  room.healthTimer = setTimeout(() => {
    if (!ROOMS.has(room.code) || !room.started) return;
    const id = ++room.packSeq;
    const pos = HEALTH_POINTS[Math.floor(Math.random() * HEALTH_POINTS.length)];
    room.packs.set(id, pos);
    io.to(room.code).emit('healthSpawn', { id, pos });
    scheduleHealthPack(room);
  }, delay);
}

function startGame(room) {
  room.started = true;
  room.round = 1;
  room.roundActive = true;
  room.teamScores = room.teamScores || { police: 0, bandit: 0 };
  room.packs.clear();
  clearRoomTimers(room);

  // Silahlari yere koy (Gun Game ve Kilic'te yerde silah yok)
  room.weapons.clear();
  if (!NO_WEAPON_MODES.has(room.mode)) {
    for (const w of WEAPON_SPAWNS) room.weapons.set(w.id, { ...w });
  }

  resetRoundPlayers(room);

  const players = [...room.players.values()].map(playerInfo);
  const weapons = [...room.weapons.values()];

  io.to(room.code).emit('start', { players, weapons, arena: room.arena, mode: room.mode, round: room.round, teamScores: room.teamScores, kingProtectMs: room.mode === 'kral' ? KING_START_PROTECT_MS : 0 });
  if (!NO_HEALTH_MODES.has(room.mode)) scheduleHealthPack(room);
  if (room.mode === 'domination') startDomination(room);
}

// ---- Domination dongusu ----
function startDomination(room) {
  room.dom = { caps: [0, 0, 0], scores: { police: 0, bandit: 0 } };
  room.roundActive = true; // domination'da round eleme yok, dost atesi hep kapali
  if (room.domTimer) clearInterval(room.domTimer);
  room.domTimer = setInterval(() => domTick(room), DOM_TICK_MS);
}

function domTick(room) {
  if (!ROOMS.has(room.code) || !room.started || room.mode !== 'domination' || !room.dom) return;
  const caps = room.dom.caps;
  const owned = { police: 0, bandit: 0 };
  for (let i = 0; i < DOM_ZONES.length; i++) {
    const z = DOM_ZONES[i];
    let pol = 0, ban = 0;
    for (const p of room.players.values()) {
      if (p.hp <= 0 || !p.team) continue;
      const dx = p.pos[0] - z.pos[0], dz = p.pos[2] - z.pos[2];
      if (dx * dx + dz * dz <= DOM_RADIUS * DOM_RADIUS) {
        if (p.team === 'police') pol++; else ban++;
      }
    }
    let c = caps[i];
    // Yalniz bir takim varsa bolge o tarafa kayar; iki taraf da varsa donar (cekisme)
    if (pol > 0 && ban === 0) c = Math.min(100, c + DOM_CAP_RATE);
    else if (ban > 0 && pol === 0) c = Math.max(-100, c - DOM_CAP_RATE);
    caps[i] = c;
    if (c >= 100) owned.police++; else if (c <= -100) owned.bandit++;
  }
  room.dom.scores.police += owned.police;
  room.dom.scores.bandit += owned.bandit;
  io.to(room.code).emit('domState', { caps: caps.slice(), scores: room.dom.scores });
  if (room.dom.scores.police >= DOM_TARGET) endMatch(room, { winnerTeam: 'police', scores: room.dom.scores });
  else if (room.dom.scores.bandit >= DOM_TARGET) endMatch(room, { winnerTeam: 'bandit', scores: room.dom.scores });
}

// Mac sonu (Gun Game galibi veya Domination hedefi). Bir sure sonra yeni mac baslar.
function endMatch(room, payload) {
  room.roundActive = false;
  if (room.domTimer) { clearInterval(room.domTimer); room.domTimer = null; }
  io.to(room.code).emit('gameOver', payload);
  const t = setTimeout(() => {
    room.timers.delete(t);
    if (!ROOMS.has(room.code) || !room.started) return;
    for (const p of room.players.values()) { p.kills = 0; p.deaths = 0; }
    room.teamScores = { police: 0, bandit: 0 };
    startGame(room);
  }, 5000);
  room.timers.add(t);
}

function resetRoundPlayers(room) {
  let i = 0;
  const teamIndex = { police: 0, bandit: 0 };
  if (room.mode === 'kral') ensureKing(room);
  for (const p of room.players.values()) {
    const teamMode = TEAM_MODES.has(room.mode);
    const isKing = room.mode === 'kral' && p.id === room.kingId;
    const spawnList = room.mode === 'awp' ? AWP_SPAWNS : teamMode ? TEAM_SPAWNS[p.team] : SPAWNS;
    const idx = teamMode ? teamIndex[p.team]++ : i;
    const s = isKing ? KING_SPAWN : spawnList[idx % spawnList.length];
    p.isKing = isKing;
    p.maxHp = isKing ? KING_HP : 100;
    p.hp = p.maxHp;
    p.pos = s.pos.slice();
    p.yaw = s.yaw;
    p.crouch = false;
    p.protUntil = isKing ? Date.now() + KING_START_PROTECT_MS : 0;
    i++;
  }
}

function playerInfo(p) {
  return {
    id: p.id, name: p.name, avatar: p.avatar, pos: p.pos, yaw: p.yaw, hp: p.hp, kills: p.kills, deaths: p.deaths,
    crouch: !!p.crouch, team: p.team || null, wins: p.wins || 0, isKing: !!p.isKing, maxHp: p.maxHp || 100,
  };
}

function scoreMap(room) {
  const scores = {};
  for (const p of room.players.values()) scores[p.id] = { k: p.kills, d: p.deaths, team: p.team || null };
  return scores;
}

function spawnPlayer(room, p) {
  if (room.mode === 'awp') {
    let idx = 0;
    for (const other of room.players.values()) {
      if (other.id === p.id) break;
      idx++;
    }
    const s = AWP_SPAWNS[idx % AWP_SPAWNS.length];
    p.isKing = false;
    p.maxHp = 100;
    p.hp = 100;
    p.pos = s.pos.slice();
    p.yaw = s.yaw;
    p.crouch = false;
    p.protUntil = Date.now() + SPAWN_PROTECT_MS;
    return s;
  }
  let best = SPAWNS[room.players.size % SPAWNS.length];
  let bestDist = -1;
  for (const s of SPAWNS) {
    let nearest = Infinity;
    for (const other of room.players.values()) {
      if (other.id === p.id || other.hp <= 0) continue;
      const dx = s.pos[0] - other.pos[0], dz = s.pos[2] - other.pos[2];
      nearest = Math.min(nearest, dx * dx + dz * dz);
    }
    if (nearest > bestDist) { bestDist = nearest; best = s; }
  }
  p.isKing = room.mode === 'kral' && p.id === room.kingId;
  p.maxHp = p.isKing ? KING_HP : 100;
  p.hp = p.maxHp;
  p.pos = best.pos.slice();
  p.yaw = best.yaw;
  p.crouch = false;
  p.protUntil = Date.now() + SPAWN_PROTECT_MS;
  return best;
}

function ensureKing(room) {
  if (room.mode !== 'kral') return null;
  if (room.kingId && room.players.has(room.kingId)) return room.players.get(room.kingId);
  const list = [...room.players.values()];
  const king = list[Math.floor(Math.random() * list.length)] || null;
  room.kingId = king ? king.id : null;
  return king;
}

function assignTeam(room) {
  const counts = { police: 0, bandit: 0 };
  for (const p of room.players.values()) if (p.team) counts[p.team]++;
  return counts.police <= counts.bandit ? 'police' : 'bandit';
}

function startNextRound(room) {
  if (!ROOMS.has(room.code) || !room.started) return;
  room.round = (room.round || 1) + 1;
  room.roundActive = true;
  room.packs.clear();
  room.weapons.clear();
  if (!NO_WEAPON_MODES.has(room.mode)) {
    for (const w of WEAPON_SPAWNS) room.weapons.set(w.id, { ...w });
  }
  resetRoundPlayers(room);
  io.to(room.code).emit('roundStart', {
    round: room.round,
    players: [...room.players.values()].map(playerInfo),
    weapons: [...room.weapons.values()],
    teamScores: room.teamScores,
    kingProtectMs: room.mode === 'kral' ? KING_START_PROTECT_MS : 0,
  });
}

function checkRoundEnd(room) {
  if (room.mode !== 'team' || !room.roundActive) return;
  const alive = { police: 0, bandit: 0 };
  const total = { police: 0, bandit: 0 };
  for (const p of room.players.values()) {
    if (!p.team) continue;
    total[p.team]++;
    if (p.hp > 0) alive[p.team]++;
  }
  if (!total.police || !total.bandit) return;
  let winner = null;
  if (alive.police > 0 && alive.bandit === 0) winner = 'police';
  if (alive.bandit > 0 && alive.police === 0) winner = 'bandit';
  if (!winner) return;
  room.roundActive = false;
  room.teamScores[winner]++;
  io.to(room.code).emit('roundEnd', { winner, teamScores: room.teamScores, nextRoundIn: ROUND_RESTART_MS });
  const t = setTimeout(() => {
    room.timers.delete(t);
    startNextRound(room);
  }, ROUND_RESTART_MS);
  room.timers.add(t);
}

// Kilic (FFA eleme): son kalan oyuncu round'u kazanir
function checkRoundEndFFA(room) {
  if (room.mode !== 'kilic' || !room.roundActive) return;
  if (room.players.size < 2) return; // tek oyuncu, round baslatma/bitirme
  const alive = [...room.players.values()].filter((p) => p.hp > 0);
  if (alive.length > 1) return;
  room.roundActive = false;
  const winner = alive[0] || null;
  if (winner) winner.wins = (winner.wins || 0) + 1;
  const wins = {};
  for (const p of room.players.values()) wins[p.id] = p.wins || 0;
  io.to(room.code).emit('roundEnd', {
    ffa: true,
    winnerId: winner ? winner.id : null,
    winnerName: winner ? winner.name : null,
    wins,
    nextRoundIn: ROUND_RESTART_MS,
  });
  const t = setTimeout(() => {
    room.timers.delete(t);
    startNextRound(room);
  }, ROUND_RESTART_MS);
  room.timers.add(t);
}

function endKingRound(room, killer, victim) {
  if (room.mode !== 'kral' || !room.roundActive) return;
  room.roundActive = false;
  room.kingId = killer.id;
  killer.wins = (killer.wins || 0) + 1;
  const wins = {};
  for (const p of room.players.values()) wins[p.id] = p.wins || 0;
  io.to(room.code).emit('roundEnd', {
    king: true,
    winnerId: killer.id,
    winnerName: killer.name,
    oldKingId: victim.id,
    oldKingName: victim.name,
    wins,
    nextRoundIn: ROUND_RESTART_MS,
  });
  const t = setTimeout(() => {
    room.timers.delete(t);
    startNextRound(room);
  }, ROUND_RESTART_MS);
  room.timers.add(t);
}

function resolveTeam(room, requestedTeam) {
  if (!TEAM_MODES.has(room.mode)) return null;
  // Oyuncu gecerli bir takim sectiyse ona uy; aksi halde dengeli ata.
  return TEAMS.includes(requestedTeam) ? requestedTeam : assignTeam(room);
}

function joinPlayer(room, socket, name, avatar, team) {
  socket.join(room.code);
  socket.data.code = room.code;
  room.players.set(socket.id, {
    id: socket.id,
    name: (name || 'Oyuncu').slice(0, 16),
    avatar: typeof avatar === 'string' ? avatar.slice(0, 20) : 'komando',
    hp: 100, kills: 0, deaths: 0, wins: 0, protUntil: 0,
    maxHp: 100, isKing: false,
    pos: [0, 0, 0], yaw: 0, crouch: false,
    team: resolveTeam(room, team),
  });
}

io.on('connection', (socket) => {
  socket.on('createRoom', (data, cb) => {
    if (typeof cb !== 'function') return;
    // Eski istemciler duz string (isim) gonderiyordu, yenisi {name, avatar}
    const name = typeof data === 'string' ? data : data && data.name;
    const avatar = data && typeof data === 'object' ? data.avatar : undefined;
    const requestedMode = data && typeof data === 'object' ? data.mode : 'duel';
    const mode = MODES[requestedMode] ? requestedMode : 'duel';
    const requestedArena = data && typeof data === 'object' ? data.arena : 'depot';
    const arena = ARENAS.has(requestedArena) ? requestedArena : 'depot';
    const code = genCode();
    const room = {
      code,
      mode,
      arena,
      maxPlayers: MODES[mode].maxPlayers,
      players: new Map(),
      packs: new Map(),
      packSeq: 0,
      weapons: new Map(),
      timers: new Set(),
      healthTimer: null,
      started: false,
      round: 1,
      roundActive: false,
      teamScores: { police: 0, bandit: 0 },
      kingId: null,
    };
    ROOMS.set(code, room);
    const team = data && typeof data === 'object' ? data.team : undefined;
    joinPlayer(room, socket, name, avatar, team);
    cb({ ok: true, code, mode, arena, maxPlayers: room.maxPlayers });
  });

  socket.on('joinRoom', ({ code, name, avatar, team }, cb) => {
    if (typeof cb !== 'function') return;
    code = String(code || '').toUpperCase().trim();
    const room = ROOMS.get(code);
    if (!room) return cb({ error: 'Oda bulunamadı. Kodu kontrol et.' });
    if (room.players.size >= room.maxPlayers) return cb({ error: `Oda dolu (${room.maxPlayers}/${room.maxPlayers}).` });
    joinPlayer(room, socket, name, avatar, team);
    cb({ ok: true, code, mode: room.mode, arena: room.arena, maxPlayers: room.maxPlayers });
    if (!room.started && room.players.size >= 2) {
      startGame(room);
    } else if (room.started) {
      const p = room.players.get(socket.id);
      if (ELIM_MODES.has(room.mode)) {
        p.hp = 0; // eleme modunda sonraki round'u bekle
      } else {
        spawnPlayer(room, p);
      }
      socket.emit('start', {
        players: [...room.players.values()].map(playerInfo),
        weapons: [...room.weapons.values()],
        arena: room.arena,
        mode: room.mode,
        round: room.round,
        teamScores: room.teamScores,
        kingProtectMs: room.mode === 'kral' ? Math.max(0, KING_START_PROTECT_MS) : 0,
      });
      for (const [id, pos] of room.packs) socket.emit('healthSpawn', { id, pos });
      socket.to(room.code).emit('playerJoined', playerInfo(p));
      // Kilic: yeni katilanla birlikte mevcut round cozulebilir hale geldiyse bitir
      checkRoundEndFFA(room);
    }
  });

  // Oyuncu takim secimi (oyuna girince, takim modunda)
  socket.on('pickTeam', (team, cb) => {
    const room = getRoom(socket);
    if (!room || !TEAM_MODES.has(room.mode)) { if (typeof cb === 'function') cb({ error: 'Takim modu degil.' }); return; }
    if (!TEAMS.includes(team)) { if (typeof cb === 'function') cb({ error: 'Gecersiz takim.' }); return; }
    const p = room.players.get(socket.id);
    if (!p) { if (typeof cb === 'function') cb({ error: 'Oyuncu yok.' }); return; }
    p.team = team;
    // Secilen takimin dogum noktalarindan birine yerlestir
    let idx = 0;
    for (const o of room.players.values()) { if (o.id === socket.id) continue; if (o.team === team) idx++; }
    const list = TEAM_SPAWNS[team];
    const s = list[idx % list.length];
    p.pos = s.pos.slice();
    p.yaw = s.yaw;
    const prot = room.roundActive ? SPAWN_PROTECT_MS : 0;
    if (room.roundActive) { p.hp = 100; p.protUntil = Date.now() + SPAWN_PROTECT_MS; }
    io.to(room.code).emit('teamChanged', { id: socket.id, team, pos: p.pos, yaw: p.yaw, hp: p.hp, prot });
    if (typeof cb === 'function') cb({ ok: true, team, pos: p.pos, yaw: p.yaw, hp: p.hp });
  });

  // Pozisyon guncellemesi - rakibe aktar
  socket.on('move', (data) => {
    const room = getRoom(socket);
    if (!room || !room.started) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    if (Array.isArray(data && data.p)) p.pos = data.p;
    if (Number.isFinite(data && data.y)) p.yaw = data.y;
    p.crouch = !!(data && data.c);
    socket.volatile.to(room.code).emit('enemyMove', { ...data, id: socket.id });
  });

  // Ates efekti (izleyici tarafinda tracer + ses icin)
  socket.on('shoot', (data) => {
    const room = getRoom(socket);
    if (!room || !room.started) return;
    socket.volatile.to(room.code).emit('enemyShoot', data);
  });

  socket.on('reloading', () => {
    const room = getRoom(socket);
    if (room) socket.to(room.code).emit('enemyReloading');
  });

  socket.on('pingCheck', (cb) => {
    if (typeof cb === 'function') cb();
  });

  // Isabet bildirimi - hasari sunucu uygular
  socket.on('hit', (data) => {
    const part = data && data.part;
    let gun = data && data.gun;
    const targetId = data && data.targetId;
    const room = getRoom(socket);
    if (!room || !room.started) return;
    if (ELIM_MODES.has(room.mode) && !room.roundActive) return;
    if (room.mode === 'kral' && !room.roundActive) return;
    const attacker = room.players.get(socket.id);
    const victim = targetId ? room.players.get(targetId) : null;
    if (!attacker || !victim) return;
    if (victim.id === attacker.id) return;
    if (TEAM_MODES.has(room.mode) && attacker.team && attacker.team === victim.team) return;
    if (room.mode === 'kral') {
      const attackerIsKing = attacker.id === room.kingId;
      const victimIsKing = victim.id === room.kingId;
      if (!attackerIsKing && !victimIsKing) return; // normaller birbirine hasar veremez
      gun = attackerIsKing ? 'kingrifle' : 'rifle';
    }
    if (attacker.hp <= 0 || victim.hp <= 0) return;
    if (victim.protUntil && Date.now() < victim.protUntil) return; // dogum korumasi
    if (room.mode === 'kral' && attacker.id === room.kingId) {
      const now = Date.now();
      if (attacker.lastKingHitAt && now - attacker.lastKingHitAt < KING_FIRE_DELAY_MS) return;
      attacker.lastKingHitAt = now;
    }

    let dmg;
    if (gun === 'sword') {
      // Kilic: sol tik (agir) 50, sag tik (hafif) 33 - sabit hasar (kafa/govde farki yok)
      dmg = (data && data.melee === 'light') ? 33 : 50;
    } else {
      const d = DAMAGE[gun] || DAMAGE.rifle;
      dmg = part === 'head' ? d.head : d.body;
    }
    victim.hp = Math.max(0, victim.hp - dmg);
    io.to(room.code).emit('health', { id: victim.id, hp: victim.hp, part, by: attacker.id });

    if (victim.hp === 0) {
      attacker.kills++;
      victim.deaths++;
      // Gun Game: her kill'de can dolar (sira sonraki silaha gecer)
      if (room.mode === 'gungame') {
        attacker.hp = 100;
        io.to(room.code).emit('health', { id: attacker.id, hp: 100, part: null, by: attacker.id });
      }
      io.to(room.code).emit('death', {
        victim: victim.id,
        killer: attacker.id,
        headshot: part === 'head',
        scores: scoreMap(room),
      });
      if (room.mode === 'team') {
        checkRoundEnd(room);
        return;
      }
      if (room.mode === 'kilic') {
        checkRoundEndFFA(room);
        return;
      }
      if (room.mode === 'kral' && victim.id === room.kingId) {
        endKingRound(room, attacker, victim);
        return;
      }
      // Gun Game: son silahla (sniper) kill yapan maci kazanir
      if (room.mode === 'gungame' && attacker.kills >= GUN_GAME_ORDER.length) {
        endMatch(room, { winner: attacker.id, winnerName: attacker.name, mode: 'gungame', scores: scoreMap(room) });
        return;
      }
      const t = setTimeout(() => {
        room.timers.delete(t);
        if (!ROOMS.has(room.code) || !room.started) return;
        if (!room.players.has(victim.id)) return;
        const best = spawnPlayer(room, victim);
        io.to(room.code).emit('respawn', { id: victim.id, pos: best.pos, yaw: best.yaw, hp: victim.hp, maxHp: victim.maxHp || 100, isKing: !!victim.isKing, prot: SPAWN_PROTECT_MS });
      }, RESPAWN_MS);
      room.timers.add(t);
    }
  });

  // Saglik paketi alma
  socket.on('pickupHealth', (id) => {
    const room = getRoom(socket);
    if (!room || !room.started) return;
    if (NO_HEALTH_MODES.has(room.mode)) return;
    const p = room.players.get(socket.id);
    if (!p || p.hp <= 0 || p.hp >= (p.maxHp || 100)) return;
    if (!room.packs.has(id)) return;
    room.packs.delete(id);
    p.hp = Math.min(p.maxHp || 100, p.hp + HEALTH_AMOUNT);
    io.to(room.code).emit('healthTaken', { id, by: socket.id, hp: p.hp });
  });

  // Yerden silah alma
  socket.on('pickupWeapon', (id) => {
    const room = getRoom(socket);
    if (!room || !room.started) return;
    const p = room.players.get(socket.id);
    if (!p || p.hp <= 0) return;
    const w = room.weapons.get(id);
    if (!w) return;
    room.weapons.delete(id);
    io.to(room.code).emit('weaponTaken', { id, by: socket.id, type: w.type });
    const t = setTimeout(() => {
      room.timers.delete(t);
      if (!ROOMS.has(room.code) || !room.started) return;
      const spawn = WEAPON_SPAWNS.find(s => s.id === id);
      if (!spawn) return;
      room.weapons.set(id, { ...spawn });
      io.to(room.code).emit('weaponSpawn', { ...spawn });
    }, WEAPON_RESPAWN_MS);
    room.timers.add(t);
  });

  socket.on('disconnect', () => {
    const room = getRoom(socket);
    if (!room) return;
    const p = room.players.get(socket.id);
    room.players.delete(socket.id);
    if (room.players.size === 0) {
      clearRoomTimers(room);
      ROOMS.delete(room.code);
    } else if (room.mode === 'duel') {
      room.started = false;
      clearRoomTimers(room);
      io.to(room.code).emit('opponentLeft', { name: p ? p.name : 'Rakip' });
    } else {
      io.to(room.code).emit('playerLeft', { id: socket.id, name: p ? p.name : 'Oyuncu' });
      if (room.mode === 'kral' && p && p.id === room.kingId) {
        room.kingId = null;
        ensureKing(room);
        if (room.roundActive) startNextRound(room);
      }
      checkRoundEnd(room);
      checkRoundEndFFA(room);
    }
  });
});

server.listen(PORT, () => {
  console.log(`CS Duel sunucusu calisiyor: http://localhost:${PORT}`);
});

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// ---- Oyun sabitleri ----
const MODES = {
  duel: { label: 'Duel', maxPlayers: 2 },
  arena: { label: 'Arena', maxPlayers: 8 },
  team: { label: 'Takim', maxPlayers: 8 },
};
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
};
const HEALTH_AMOUNT = 40;
const RESPAWN_MS = 3000;
const WEAPON_RESPAWN_MS = 25000;
const SPAWN_PROTECT_MS = 1000;
const ROUND_RESTART_MS = 4000;
const TEAMS = ['police', 'bandit'];

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

  // Silahlari yere koy
  room.weapons.clear();
  for (const w of WEAPON_SPAWNS) room.weapons.set(w.id, { ...w });

  resetRoundPlayers(room);

  const players = [...room.players.values()].map(playerInfo);
  const weapons = [...room.weapons.values()];

  io.to(room.code).emit('start', { players, weapons, arena: room.arena, mode: room.mode, round: room.round, teamScores: room.teamScores });
  scheduleHealthPack(room);
}

function resetRoundPlayers(room) {
  let i = 0;
  const teamIndex = { police: 0, bandit: 0 };
  for (const p of room.players.values()) {
    const spawnList = room.mode === 'team' ? TEAM_SPAWNS[p.team] : SPAWNS;
    const idx = room.mode === 'team' ? teamIndex[p.team]++ : i;
    const s = spawnList[idx % spawnList.length];
    p.hp = 100;
    p.pos = s.pos.slice();
    p.yaw = s.yaw;
    p.crouch = false;
    p.protUntil = 0;
    i++;
  }
}

function playerInfo(p) {
  return {
    id: p.id, name: p.name, avatar: p.avatar, pos: p.pos, yaw: p.yaw, hp: p.hp, kills: p.kills, deaths: p.deaths,
    crouch: !!p.crouch, team: p.team || null,
  };
}

function scoreMap(room) {
  const scores = {};
  for (const p of room.players.values()) scores[p.id] = p.kills;
  return scores;
}

function spawnPlayer(room, p) {
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
  p.hp = 100;
  p.pos = best.pos.slice();
  p.yaw = best.yaw;
  p.crouch = false;
  p.protUntil = Date.now() + SPAWN_PROTECT_MS;
  return best;
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
  for (const w of WEAPON_SPAWNS) room.weapons.set(w.id, { ...w });
  resetRoundPlayers(room);
  io.to(room.code).emit('roundStart', {
    round: room.round,
    players: [...room.players.values()].map(playerInfo),
    weapons: [...room.weapons.values()],
    teamScores: room.teamScores,
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

function joinPlayer(room, socket, name, avatar) {
  socket.join(room.code);
  socket.data.code = room.code;
  room.players.set(socket.id, {
    id: socket.id,
    name: (name || 'Oyuncu').slice(0, 16),
    avatar: typeof avatar === 'string' ? avatar.slice(0, 20) : 'komando',
    hp: 100, kills: 0, deaths: 0, protUntil: 0,
    pos: [0, 0, 0], yaw: 0, crouch: false,
    team: room.mode === 'team' ? assignTeam(room) : null,
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
    };
    ROOMS.set(code, room);
    joinPlayer(room, socket, name, avatar);
    cb({ ok: true, code, mode, arena, maxPlayers: room.maxPlayers });
  });

  socket.on('joinRoom', ({ code, name, avatar }, cb) => {
    if (typeof cb !== 'function') return;
    code = String(code || '').toUpperCase().trim();
    const room = ROOMS.get(code);
    if (!room) return cb({ error: 'Oda bulunamadı. Kodu kontrol et.' });
    if (room.players.size >= room.maxPlayers) return cb({ error: `Oda dolu (${room.maxPlayers}/${room.maxPlayers}).` });
    joinPlayer(room, socket, name, avatar);
    cb({ ok: true, code, mode: room.mode, arena: room.arena, maxPlayers: room.maxPlayers });
    if (!room.started && room.players.size >= 2) {
      startGame(room);
    } else if (room.started) {
      const p = room.players.get(socket.id);
      if (room.mode === 'team') {
        p.hp = 0;
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
      });
      for (const [id, pos] of room.packs) socket.emit('healthSpawn', { id, pos });
      socket.to(room.code).emit('playerJoined', playerInfo(p));
    }
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
    const gun = data && data.gun;
    const targetId = data && data.targetId;
    const room = getRoom(socket);
    if (!room || !room.started) return;
    if (room.mode === 'team' && !room.roundActive) return;
    const attacker = room.players.get(socket.id);
    const victim = targetId ? room.players.get(targetId) : null;
    if (!attacker || !victim) return;
    if (victim.id === attacker.id) return;
    if (room.mode === 'team' && attacker.team && attacker.team === victim.team) return;
    if (attacker.hp <= 0 || victim.hp <= 0) return;
    if (victim.protUntil && Date.now() < victim.protUntil) return; // dogum korumasi

    const d = DAMAGE[gun] || DAMAGE.rifle;
    const dmg = part === 'head' ? d.head : d.body;
    victim.hp = Math.max(0, victim.hp - dmg);
    io.to(room.code).emit('health', { id: victim.id, hp: victim.hp, part, by: attacker.id });

    if (victim.hp === 0) {
      attacker.kills++;
      victim.deaths++;
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
      const t = setTimeout(() => {
        room.timers.delete(t);
        if (!ROOMS.has(room.code) || !room.started) return;
        if (!room.players.has(victim.id)) return;
        const best = spawnPlayer(room, victim);
        io.to(room.code).emit('respawn', { id: victim.id, pos: best.pos, yaw: best.yaw, hp: 100, prot: SPAWN_PROTECT_MS });
      }, RESPAWN_MS);
      room.timers.add(t);
    }
  });

  // Saglik paketi alma
  socket.on('pickupHealth', (id) => {
    const room = getRoom(socket);
    if (!room || !room.started) return;
    const p = room.players.get(socket.id);
    if (!p || p.hp <= 0 || p.hp >= 100) return;
    if (!room.packs.has(id)) return;
    room.packs.delete(id);
    p.hp = Math.min(100, p.hp + HEALTH_AMOUNT);
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
      checkRoundEnd(room);
    }
  });
});

server.listen(PORT, () => {
  console.log(`CS Duel sunucusu calisiyor: http://localhost:${PORT}`);
});

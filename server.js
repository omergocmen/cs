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
const SPAWNS = [
  { pos: [-24, 0, -24], yaw: Math.PI * 0.75 },
  { pos: [24, 0, 24], yaw: -Math.PI * 0.25 },
];

// Saglik paketi cikabilecek noktalar (haritadaki bos alanlar)
const HEALTH_POINTS = [
  [0, 0, 14], [0, 0, -14], [14, 0, 0], [-14, 0, 0],
  [20, 0, -20], [-20, 0, 20], [10, 0, 10], [-10, 0, -10],
];

// Yerdeki silahlar (sabit dogma noktalari)
const WEAPON_SPAWNS = [
  { id: 'w1', type: 'sniper', pos: [0, 0, 0] },
  { id: 'w2', type: 'smg', pos: [-18, 0, 0] },
  { id: 'w3', type: 'smg', pos: [18, 0, 0] },
  { id: 'w4', type: 'shotgun', pos: [0, 0, 18] },
  { id: 'w5', type: 'shotgun', pos: [0, 0, -18] },
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

function opponentOf(room, id) {
  for (const [pid, p] of room.players) if (pid !== id) return p;
  return null;
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
  room.packs.clear();
  clearRoomTimers(room);

  // Silahlari yere koy
  room.weapons.clear();
  for (const w of WEAPON_SPAWNS) room.weapons.set(w.id, { ...w });

  let i = 0;
  for (const p of room.players.values()) {
    p.hp = 100;
    p.pos = SPAWNS[i].pos.slice();
    p.yaw = SPAWNS[i].yaw;
    p.protUntil = 0;
    i++;
  }

  const players = [...room.players.values()].map(p => ({
    id: p.id, name: p.name, avatar: p.avatar, pos: p.pos, yaw: p.yaw, hp: p.hp, kills: p.kills, deaths: p.deaths,
  }));
  const weapons = [...room.weapons.values()];

  io.to(room.code).emit('start', { players, weapons });
  scheduleHealthPack(room);
}

function joinPlayer(room, socket, name, avatar) {
  socket.join(room.code);
  socket.data.code = room.code;
  room.players.set(socket.id, {
    id: socket.id,
    name: (name || 'Oyuncu').slice(0, 16),
    avatar: typeof avatar === 'string' ? avatar.slice(0, 20) : 'komando',
    hp: 100, kills: 0, deaths: 0, protUntil: 0,
    pos: [0, 0, 0], yaw: 0,
  });
}

io.on('connection', (socket) => {
  socket.on('createRoom', (data, cb) => {
    if (typeof cb !== 'function') return;
    // Eski istemciler duz string (isim) gonderiyordu, yenisi {name, avatar}
    const name = typeof data === 'string' ? data : data && data.name;
    const avatar = data && typeof data === 'object' ? data.avatar : undefined;
    const code = genCode();
    const room = {
      code,
      players: new Map(),
      packs: new Map(),
      packSeq: 0,
      weapons: new Map(),
      timers: new Set(),
      healthTimer: null,
      started: false,
    };
    ROOMS.set(code, room);
    joinPlayer(room, socket, name, avatar);
    cb({ ok: true, code });
  });

  socket.on('joinRoom', ({ code, name, avatar }, cb) => {
    if (typeof cb !== 'function') return;
    code = String(code || '').toUpperCase().trim();
    const room = ROOMS.get(code);
    if (!room) return cb({ error: 'Oda bulunamadı. Kodu kontrol et.' });
    if (room.players.size >= 2) return cb({ error: 'Oda dolu (2/2).' });
    joinPlayer(room, socket, name, avatar);
    cb({ ok: true, code });
    if (room.players.size === 2) startGame(room);
  });

  // Pozisyon guncellemesi - rakibe aktar
  socket.on('move', (data) => {
    const room = getRoom(socket);
    if (!room || !room.started) return;
    socket.volatile.to(room.code).emit('enemyMove', data);
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

  // Isabet bildirimi - hasari sunucu uygular
  socket.on('hit', (data) => {
    const part = data && data.part;
    const gun = data && data.gun;
    const room = getRoom(socket);
    if (!room || !room.started) return;
    const attacker = room.players.get(socket.id);
    const victim = opponentOf(room, socket.id);
    if (!attacker || !victim) return;
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
        scores: { [attacker.id]: attacker.kills, [victim.id]: victim.kills },
      });
      const t = setTimeout(() => {
        room.timers.delete(t);
        if (!ROOMS.has(room.code) || !room.started) return;
        if (!room.players.has(victim.id)) return;
        // Saldirgandan uzak olan spawn noktasina dogur
        const att = room.players.get(attacker.id);
        let best = SPAWNS[0];
        if (att) {
          let bestDist = -1;
          for (const s of SPAWNS) {
            const dx = s.pos[0] - att.pos[0], dz = s.pos[2] - att.pos[2];
            const d = dx * dx + dz * dz;
            if (d > bestDist) { bestDist = d; best = s; }
          }
        }
        victim.hp = 100;
        victim.pos = best.pos.slice();
        victim.protUntil = Date.now() + SPAWN_PROTECT_MS;
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
    } else {
      room.started = false;
      clearRoomTimers(room);
      io.to(room.code).emit('opponentLeft', { name: p ? p.name : 'Rakip' });
    }
  });
});

server.listen(PORT, () => {
  console.log(`CS Duel sunucusu calisiyor: http://localhost:${PORT}`);
});

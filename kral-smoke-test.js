const { spawn } = require('child_process');
const http = require('http');
const { io } = require('socket.io-client');

const PORT = 3021;
const URL = `http://localhost:${PORT}`;

let failed = false;
function assert(cond, msg) {
  console.log(`${cond ? 'OK' : 'FAIL'}: ${msg}`);
  if (!cond) failed = true;
}

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

function waitHealth(socket, id, ms = 1000) {
  return new Promise((resolve) => {
    const onHealth = (payload) => {
      if (payload.id !== id) return;
      clearTimeout(timer);
      socket.off('health', onHealth);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off('health', onHealth);
      resolve(null);
    }, ms);
    socket.on('health', onHealth);
  });
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      http.get(`${URL}/socket.io/?EIO=4&transport=polling`, (res) => {
        res.resume();
        resolve();
      }).on('error', () => {
        if (Date.now() - started > 8000) reject(new Error('server did not start'));
        else setTimeout(tick, 200);
      });
    };
    tick();
  });
}

(async () => {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
    windowsHide: true,
  });

  try {
    await waitForServer();

    const a = io(URL);
    const b = io(URL);
    const c = io(URL);
    await Promise.all([once(a, 'connect'), once(b, 'connect'), once(c, 'connect')]);

    const code = await new Promise((resolve) => {
      a.emit('createRoom', { name: 'A', mode: 'kral' }, (res) => resolve(res.code));
    });

    const startA = once(a, 'start');
    const startB = once(b, 'start');
    await new Promise((resolve) => b.emit('joinRoom', { code, name: 'B' }, resolve));
    await Promise.all([startA, startB]);

    const startC = once(c, 'start');
    await new Promise((resolve) => c.emit('joinRoom', { code, name: 'C' }, resolve));
    const state = await startC;

    assert(state.players.length === 3, 'uc oyuncu kral odasinda');
    assert(state.weapons.length === 0, 'kral modunda yerde silah yok');

    const kings = state.players.filter((p) => p.isKing);
    assert(kings.length === 1, 'tek kral var');
    assert(kings[0].hp === 300 && kings[0].maxHp === 300, 'kral 300 canla baslar');
    assert(state.players.filter((p) => !p.isKing).every((p) => p.hp === 100 && p.maxHp === 100), 'normaller 100 canla baslar');
    assert(state.kingProtectMs === 3000, 'kral baslangicta 3 sn korunur');

    const sockets = { [a.id]: a, [b.id]: b, [c.id]: c };
    const kingId = kings[0].id;
    const [normalA, normalB] = state.players.filter((p) => !p.isKing).map((p) => p.id);

    const protectedHit = waitHealth(sockets[kingId], kingId, 300);
    sockets[normalB].emit('hit', { part: 'head', targetId: kingId, gun: 'rifle' });
    assert(!(await protectedHit), 'koruma suresinde kral hasar almaz');

    const friendlyHit = waitHealth(sockets[normalB], normalB, 300);
    sockets[normalA].emit('hit', { part: 'head', targetId: normalB, gun: 'rifle' });
    assert(!(await friendlyHit), 'normal oyuncu normale hasar veremez');

    const kingHit = waitHealth(sockets[normalA], normalA, 1000);
    sockets[kingId].emit('hit', { part: 'body', targetId: normalA, gun: 'kingrifle' });
    const firstHit = await kingHit;
    assert(firstHit && firstHit.hp === 0, 'kral tek isabette normal oyuncuyu dusurur');

    const fastSecondHit = waitHealth(sockets[normalB], normalB, 300);
    sockets[kingId].emit('hit', { part: 'body', targetId: normalB, gun: 'kingrifle' });
    assert(!(await fastSecondHit), 'kral 950ms altinda ikinci hasar yazamaz');

    const roundEnd = once(sockets[kingId], 'roundEnd');
    await new Promise((resolve) => setTimeout(resolve, 2900));
    sockets[normalB].emit('hit', { part: 'head', targetId: kingId, gun: 'rifle' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    sockets[normalB].emit('hit', { part: 'head', targetId: kingId, gun: 'rifle' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    sockets[normalB].emit('hit', { part: 'head', targetId: kingId, gun: 'rifle' });
    const end = await Promise.race([roundEnd, new Promise((resolve) => setTimeout(() => resolve(null), 1500))]);
    assert(end && end.king && end.winnerId === normalB, 'krali son vuran sonraki kral olur');

    a.disconnect();
    b.disconnect();
    c.disconnect();
  } finally {
    server.kill();
  }

  console.log(failed ? '\nSONUC: HATALI' : '\nSONUC: TUM TESTLER GECTI');
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('Test hatasi:', err);
  process.exit(1);
});

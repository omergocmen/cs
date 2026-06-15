// Hizli duman testi: oda kur, katil, vurus/olum/saglik akislarini dogrula
const { io } = require('socket.io-client');
const URL = 'http://localhost:3000';

const log = (...a) => console.log(...a);
let failed = false;
function assert(cond, msg) {
  if (cond) log('  OK:', msg);
  else { failed = true; log('  FAIL:', msg); }
}

(async () => {
  const a = io(URL);
  const b = io(URL);

  const code = await new Promise((res) =>
    a.emit('createRoom', 'Ali', (r) => res(r.code))
  );
  assert(code && code.length === 5, `oda kuruldu, kod: ${code}`);

  const startA = new Promise((res) => a.once('start', res));
  const startB = new Promise((res) => b.once('start', res));
  const joinRes = await new Promise((res) =>
    b.emit('joinRoom', { code, name: 'Veli' }, res)
  );
  assert(joinRes.ok, 'odaya katilim basarili');

  const [sA, sB] = await Promise.all([startA, startB]);
  assert(sA.players.length === 2, 'start: 2 oyuncu geldi');
  assert(sA.weapons.length === 5, 'start: 5 yer silahi geldi');
  assert(sA.arena === 'depot', 'varsayilan arena depot geldi');

  // Govde vurusu: 100 -> 67
  const h1 = new Promise((res) => b.once('health', res));
  a.emit('hit', { part: 'body', targetId: b.id });
  const hr1 = await h1;
  assert(hr1.hp === 67, `govde vurusu 33 hasar (hp=${hr1.hp})`);

  // Kafa vurusu: 67 -> 0, olum + respawn
  const death = new Promise((res) => b.once('death', res));
  const respawn = new Promise((res) => b.once('respawn', res));
  a.emit('hit', { part: 'head', targetId: b.id });
  const d = await death;
  assert(d.victim === b.id && d.headshot, 'kafadan vurus oldurdu');
  assert((d.scores[a.id]?.k ?? d.scores[a.id]) === 1, 'skor islendi');

  const r = await Promise.race([respawn, new Promise((res) => setTimeout(() => res(null), 5000))]);
  assert(r && r.hp === 100, 'olen oyuncu 3 sn sonra 100 can ile dogdu');

  // Silah alma
  const wt = new Promise((res) => a.once('weaponTaken', res));
  a.emit('pickupWeapon', 'w1');
  const w = await wt;
  assert(w.type === 'sniper' && w.by === a.id, 'yerden AWP alindi');

  // Tam canken saglik alinamaz (paket de yokken)
  // Hasarli oyuncuya dusuk hp verip dogrudan paket akisini test edemeyiz
  // (paketler 30-60 sn'de dogar) - zamanlayici mantigi ayni kodda, atla.

  // Kopma: kalan oyuncuya bildirim
  const left = new Promise((res) => a.once('opponentLeft', res));
  b.disconnect();
  const l = await left;
  assert(l.name === 'Veli', 'rakip ayrildi bildirimi geldi');

  a.disconnect();
  log(failed ? '\nSONUC: HATALI' : '\nSONUC: TUM TESTLER GECTI');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('Test hatasi:', e); process.exit(1); });

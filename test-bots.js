// เทสบอท: จำลองเกมที่มีแต่บอท (2–8 คน) ให้เล่นจนจบ — ตรวจว่าไม่ค้าง/ไม่ crash
//   node test-bots.js [จำนวนเกมต่อขนาดห้อง]
const { Room, addBotToRoom, botSockets } = require('./server');
const { BotBrain, DELAYS } = require('./bot');

DELAYS.think = [1, 3];
DELAYS.reply = [1, 3];
BotBrain.prototype.paused = function () { return this.dead; };   // ไม่มีคนจริง → ไม่ต้องพัก

const GAMES = Number(process.argv[2]) || 3;
const TIMEOUT_MS = 60000;

function runGame(n, level = 'normal') {
  return new Promise((resolve) => {
    const room = new Room('HOST', { roomName: 't', playerLimit: n, turnTimer: 60, botLevel: level });
    for (let i = 0; i < n; i++) addBotToRoom(room);
    room.hostId = room.players[0].id;
    room.startDraft();
    // ข้ามอนิเมชั่นเปิดโรล
    clearTimeout(room.rollTimer);
    room.state = 'selecting';
    room.players.forEach(p => botSockets.get(p.socketId).emit('roomUpdate', {}));

    const started = Date.now();
    const iv = setInterval(() => {
      if (room.state === 'ended') {
        clearInterval(iv);
        const g = room.game;
        const winLine = g.log.slice(-1)[0];
        cleanup();
        resolve({ ok: true, turns: g.turn, ms: Date.now() - started, msg: winLine && winLine.msg });
      } else if (Date.now() - started > TIMEOUT_MS) {
        clearInterval(iv);
        const g = room.game;
        const snap = g ? {
          state: room.state, turn: g.turn, phase: g.phase, cur: room.players[g.currentPlayer]?.username,
          pending: g.pending && { type: g.pending.type, responder: g.pending.responderId },
          dying: g.dyingPlayerId, harvest: !!g.harvest, discard: g.awaitingDiscard, draw: g.awaitingDraw,
          cardPick: !!g.cardPick, ganglie: !!g.ganglie, rockAxe: !!g.rockAxe, halb: !!g.halberPending,
          guanxing: !!g.guanxing, yiji: !!g.yiji, fanjian: !!g.fanjian, guicai: !!g.guicai,
          lordAssist: !!g.lordAssist, xiaoguo: !!g.xiaoguo, groupQueue: g.groupQueue,
          log: g.log.slice(-8).map(l => `${l.who}: ${l.msg}`),
        } : { state: room.state, draft: room.draft && room.draft.stage };
        cleanup();
        resolve({ ok: false, snap });
      }
    }, 50);

    function cleanup() {
      room.players.forEach(p => { const b = botSockets.get(p.socketId); if (b) b.brain.destroy(); botSockets.delete(p.socketId); });
      if (room.game) room.game.destroy();
    }
  });
}

(async () => {
  let fail = 0, total = 0;
  for (const level of ['easy', 'normal', 'hard']) {
    for (const n of [2, 3, 4, 5, 6, 8]) {
      for (let i = 0; i < GAMES; i++) {
        total++;
        const r = await runGame(n, level);
        if (r.ok) console.log(`✅ [${level}] ${n} บอท — จบใน ${r.turns} ตา (${r.ms}ms) — ${r.msg}`);
        else { fail++; console.log(`❌ [${level}] ${n} บอท — ค้าง`, JSON.stringify(r.snap, null, 1)); }
      }
    }
  }
  console.log(`\n${total - fail}/${total} เกมจบสมบูรณ์`);
  process.exit(fail ? 1 : 0);
})();

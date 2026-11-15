// ─── AI Bot (ผู้เล่นบอท) ─────────────────────────────────────────────────────────
// บอทเชื่อมกับเกมผ่าน "ซ็อกเก็ตเสมือน" (BotSocket): ทุกครั้งที่เซิร์ฟเวอร์ emit ถึงบอท
// (roomUpdate / awaitResponse / askPeach / askDiscard ฯลฯ) บอทจะคิดแล้วเรียกเมธอดของ Game
// โดยตรงหลังหน่วงเวลาสั้นๆ (ให้ผู้เล่นจริงมองทันว่าเกิดอะไรขึ้น)
//
// ความฉลาดแบบง่าย: บอทเดาฝ่ายของผู้เล่นอื่นจาก "ใครทำร้ายใคร" (game.harmLog)
//   - ใครทำร้ายจักรพรรดิ → น่าจะเป็นกบฏ   - ใครทำร้ายคนที่ทำร้ายจักรพรรดิ → น่าจะฝ่ายจักรพรรดิ

const BOT_NAMES = ['บอท·มังกร', 'บอท·พยัคฆ์', 'บอท·หงส์', 'บอท·กิเลน', 'บอท·เต่าดำ',
  'บอท·อินทรี', 'บอท·หมาป่า', 'บอท·คชสาร', 'บอท·จิ้งจอก', 'บอท·วานร'];

const DELAYS = { think: [700, 1300], reply: [600, 1200] };  // หน่วงก่อนตัดสินใจ (ms) — เทสปรับให้เร็วได้

const rand = (a, b) => a + Math.floor(Math.random() * (b - a));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// มูลค่าการ์ด (ใช้เลือกทิ้ง/เลือกเก็บ) — ยิ่งสูงยิ่งอยากเก็บไว้
const CARD_VALUE = {
  Peach: 10, Dodge: 7, Negation: 6.5, Attack: 6, 'Something Out of Nothing': 6,
  Duel: 5, Steal: 5.5, 'Burning Bridges': 5, 'Barbarian Invasion': 4.5, 'Raining Arrows': 4.5,
  Overindulgence: 4.5, 'Bumper Harvest': 3.5, 'Borrowed Sword': 3, 'Oath of the Peach Garden': 3,
  Lightning: 1,
};
function cardValue(c) {
  if (CARD_VALUE[c.name] != null) return CARD_VALUE[c.name];
  if (c.type === 'armor') return 5;
  if (c.type === 'weapon') return 3 + (c.range || 1) * 0.3;
  if (c.type === 'mount') return 4;
  return 3;
}

class BotSocket {
  constructor(brain) { this.brain = brain; this.id = 'bot:' + brain.playerId; }
  emit(event, data) { this.brain.onEvent(event, data); }
  join() {} leave() {}
}

class BotBrain {
  constructor(room, playerId, deps) {
    this.room = room;
    this.playerId = playerId;
    this.deps = deps;                 // { CHAR_PASSIVES, broadcastRoom }
    this.thinkTimer = null;
    this.replyTimers = new Set();
    this.tried = new Set();           // การ์ดที่ลองเล่นแล้วไม่สำเร็จในตานี้
    this.turnKey = null;
    this.actions = 0;
    this.dead = false;
  }

  get me() { return this.room.findPlayer(this.playerId); }
  // ความเก่งของบอท (ตั้งตอนสร้างห้อง): 'easy' | 'normal' | 'hard'
  get level() { const l = this.room.settings?.botLevel; return ['easy', 'hard'].includes(l) ? l : 'normal'; }
  get game() { return this.room.game; }

  destroy() {
    this.dead = true;
    clearTimeout(this.thinkTimer);
    this.replyTimers.forEach(t => clearTimeout(t));
    this.replyTimers.clear();
  }

  // บอทหยุดคิดเมื่อไม่มีผู้เล่นจริงเชื่อมต่ออยู่ในห้อง (ไม่เปลือง CPU)
  paused() {
    return this.dead || !this.room.players.some(p => !p.isAI && p.connected);
  }

  later(fn, range = DELAYS.reply) {
    const t = setTimeout(() => {
      this.replyTimers.delete(t);
      if (this.paused()) return;
      try { fn(); } catch (e) { console.error('[bot]', e); }
    }, rand(range[0], range[1]));
    this.replyTimers.add(t);
  }

  scheduleThink(range = DELAYS.think) {
    if (this.dead) return;
    clearTimeout(this.thinkTimer);
    this.thinkTimer = setTimeout(() => {
      if (this.paused()) return;
      try { this.think(); } catch (e) { console.error('[bot]', e); }
    }, rand(range[0], range[1]));
  }

  // ─── รับ event จากเซิร์ฟเวอร์ ─────────────────────────────────────────────
  onEvent(event, data) {
    if (this.dead) return;
    switch (event) {
      case 'roomUpdate': case 'gameStarted': return this.scheduleThink();
      case 'awaitResponse': return this.later(() => this.respond(data));
      case 'askPeach': return this.later(() => this.peachDecision(data));
      case 'askDiscard': return this.later(() => this.doDiscard());
      case 'askHarvest': return this.later(() => this.harvestPick());
      case 'askTakeCard': return this.later(() => this.takeCardPick(data));
      case 'askGanglie': return this.later(() => {
        const me = this.me;
        this.game?.resolveGanglie(this.playerId, (me.hand.length >= 3 || me.hp <= 1) ? 'discard' : 'damage');
      });
      case 'askRockAxe': return this.later(() => {
        const me = this.me;
        const total = me.hand.length + Object.values(me.equipment || {}).filter(Boolean).length;
        this.game?.resolveRockAxe(this.playerId, total >= 4 ? 'use' : 'skip');
      });
      case 'askHalberd': return this.later(() => {
        const ids = (data.extra || []).filter(x => this.isEnemy(this.room.findPlayer(x.id))).map(x => x.id);
        this.game?.resolveHalberd(this.playerId, ids);
      });
      case 'askGuanxing': return this.later(() => {
        // เก็บไพ่ดีไว้บนสุด ไพ่แย่ไว้ล่าง
        const cards = [...(data.cards || [])].sort((a, b) => cardValue(b) - cardValue(a));
        const top = cards.filter(c => cardValue(c) >= 4.5).map(c => c.id);
        const bottom = cards.filter(c => cardValue(c) < 4.5).map(c => c.id);
        this.game?.resolveGuanxing(this.playerId, { top, bottom });
      });
      case 'askShenzhi': return this.later(() => {
        // ให้เพื่อนที่ไพ่น้อยสุดจั่ว (มือว่าง = ได้ 2) — ไม่มีเพื่อนก็ให้คนที่ไม่ใช่ศัตรู
        const ps = (data.players || []).map(x => this.room.findPlayer(x.id)).filter(Boolean);
        const pool = ps.filter(p => this.isFriend(p)).length ? ps.filter(p => this.isFriend(p))
          : (ps.filter(p => !this.isEnemy(p)).length ? ps.filter(p => !this.isEnemy(p)) : ps);
        const t = [...pool].sort((a, b) => a.hand.length - b.hand.length)[0];
        this.game?.resolveShenzhi(this.playerId, t ? t.id : null);
      });
      case 'askYiji': return this.later(() => this.game?.resolveYiji(this.playerId, null));
      case 'askFanjian': return this.later(() => this.game?.resolveFanjian(this.playerId, pick(['♠', '♥', '♣', '♦'])));
      case 'askGuicai': return this.later(() => this.game?.resolveGuicai(this.playerId, null));
      case 'askXiaoguo': return this.later(() => this.game?.useXiaoguo(this.playerId, null));
      case 'askXiaoguoRespond': return this.later(() => {
        const eq = this.me.equipment || {};
        const slot = ['defMount', 'atkMount', 'weapon', 'armor'].find(s => eq[s]);
        this.game?.respondXiaoguo(this.playerId, this.me.hp <= 2 && slot ? slot : null);
      });
      case 'askLordAssist': return this.later(() => {
        const me = this.me;
        const lord = this.room.players.find(p => p.role === 'Lord');
        const card = this.isFriend(lord) ? me.hand.find(c => c.name === data.need) : null;
        this.game?.resolveLordAssist(this.playerId, card ? card.id : null);
      });
      default: return;
    }
  }

  // ─── การเดาฝ่าย ───────────────────────────────────────────────────────────
  // คะแนน "ต่อต้านจักรพรรดิ": > 0 น่าจะกบฏ, < 0 น่าจะฝ่ายจักรพรรดิ
  rebelScore(pid) {
    const g = this.game;
    const log = (g && g.harmLog) || [];
    const lord = this.room.players.find(p => p.role === 'Lord');
    if (!lord) return 0;
    if (pid === lord.id) return -99;
    const harmOf = {};       // ทำร้ายจักรพรรดิไปเท่าไร
    for (const h of log) if (h.to === lord.id) harmOf[h.from] = (harmOf[h.from] || 0) + h.amount;
    let s = 0;
    for (const h of log) {
      if (h.from !== pid) continue;
      if (h.to === lord.id) s += 2 * h.amount;
      else if ((harmOf[h.to] || 0) > 0) s -= 1.5 * h.amount;   // ตีคนที่ตีจักรพรรดิ = ช่วยจักรพรรดิ
    }
    return s;
  }

  aliveOthers() {
    return this.room.players.filter(p => p.hp > 0 && p.id !== this.playerId);
  }

  // จำนวนรอบที่ผ่านไป (เทิร์นรวม / จำนวนคนที่ยังอยู่)
  rounds() {
    const alive = this.room.players.filter(x => x.hp > 0).length || 1;
    return (this.game?.turn || 0) / alive;
  }

  isFriend(p) {
    if (!p) return false;
    const me = this.me;
    if (p.id === me.id) return true;
    // เกมยืดเยื้อ (>12 รอบ) → เลิกเชื่อพันธมิตรที่ "เดาเอา" เหลือแค่ที่แน่นอน (กันเกมตันไม่มีใครตีใคร)
    if (this.rounds() > 12) {
      if (me.role === 'Loyalist') return p.role === 'Lord';
      if (me.role === 'Spy') return p.role === 'Lord' && this.aliveOthers().some(x => x.role !== 'Lord');
      return false;
    }
    const sc = this.rebelScore(p.id);
    switch (me.role) {
      case 'Lord': return sc < 0;
      case 'Loyalist': return p.role === 'Lord' || sc < 0;
      case 'Rebel': return p.role !== 'Lord' && sc > 0;
      case 'Spy': {
        // ทรยศ: ช่วยจักรพรรดิไว้ก่อน จนกว่าจะเหลือกันแค่ 2 คน
        const others = this.aliveOthers().filter(x => x.role !== 'Lord');
        return p.role === 'Lord' && others.length > 0;
      }
      default: return false;
    }
  }

  isEnemy(p) {
    if (!p || p.hp <= 0 || p.id === this.playerId) return false;
    const me = this.me;
    const others = this.aliveOthers();
    if (others.length === 1) return true;     // เหลือ 2 คน = ศัตรูแน่นอน
    const sc = this.rebelScore(p.id);
    switch (me.role) {
      case 'Lord': return sc > 0;
      case 'Loyalist': return p.role !== 'Lord' && sc > 0;
      case 'Rebel': return p.role === 'Lord' || sc < 0;
      case 'Spy': {
        const nonLord = others.filter(x => x.role !== 'Lord');
        if (p.role === 'Lord') return nonLord.length === 0;
        return sc > 0;
      }
      default: return false;
    }
  }

  // ศัตรูแบบ "เดาเอา" — ใช้เมื่อไม่มีศัตรูที่ชัดเจนให้เล่นด้วย (กันเกมตัน ไม่มีใครตีใคร)
  //   - จักรพรรดิ: หลังผ่านไป 1 รอบ ยอมตีคนที่ยังไม่แสดงตัว
  //   - ทุกบทบาท: ผ่านไป ~6 รอบแล้วยังตัน → ตีใครก็ได้ที่ไม่ใช่พวก (ยิ่งนานยิ่งดุ)
  isSoftEnemy(p) {
    if (this.isEnemy(p)) return true;
    const me = this.me;
    if (!p || p.hp <= 0 || p.id === me.id || this.isFriend(p)) return false;
    const alive = this.room.players.filter(x => x.hp > 0).length || 1;
    const rounds = (this.game?.turn || 0) / alive;
    if (me.role === 'Lord' && rounds > 1 && this.rebelScore(p.id) >= 0) return true;
    if (me.role === 'Loyalist' && p.role === 'Lord') return false;
    if (me.role === 'Spy' && p.role === 'Lord' && this.aliveOthers().some(x => x.role !== 'Lord')) return false;
    return rounds > (this.level === 'hard' ? 3 : 6);
  }

  // เรียงศัตรูตามความน่าโจมตี (เลือดน้อย/จักรพรรดิก่อน)
  rankTargets(list) {
    const me = this.me;
    if (this.level === 'easy') return [...list].sort(() => Math.random() - 0.5);   // ง่าย: เลือกมั่วๆ
    return [...list].sort((a, b) => {
      const pa = (me.role === 'Rebel' && a.role === 'Lord' ? -10 : 0) + a.hp + a.hand.length * 0.2;
      const pb = (me.role === 'Rebel' && b.role === 'Lord' ? -10 : 0) + b.hp + b.hand.length * 0.2;
      return pa - pb;
    });
  }

  // ─── ตาของตัวเอง / ขั้นตอนเลือกตัวละคร ─────────────────────────────────────
  think() {
    const room = this.room;
    const me = this.me;
    if (!me) return;

    if (room.state === 'selecting' && room.draft) {
      const d = room.draft;
      const cands = d.candidates[me.id];
      if (cands && cands.length && !d.picks[me.id]) {
        const charId = this.chooseCharacter(cands);
        const res = room.draftPick(me.id, charId);
        if (res.ok && room.state === 'selecting') this.deps.broadcastRoom(room);
      }
      return;
    }

    const g = this.game;
    if (room.state !== 'playing' || !g || me.hp <= 0) return;
    const cur = room.players[g.currentPlayer];
    if (!cur || cur.id !== me.id) return;

    const tk = `${g.turn}`;
    if (this.turnKey !== tk) { this.turnKey = tk; this.tried.clear(); this.actions = 0; this.skillTried = false; }

    // ระหว่างรอหน้าต่างอื่น (ตอบโต้/ใกล้ตาย/เลือกไพ่ ฯลฯ) — ยังไม่ทำอะไร
    if (g.pending || g.harvest || g.dyingPlayerId || g.awaitingDiscard || g.cardPick || g.ganglie
        || g.rockAxe || g.halberPending || g.guanxing || g.yiji || g.fanjian || g.guicai
        || g.lordAssist || g.xiaoguo || g.groupQueue) return;

    if (g.phase === 'draw' && g.awaitingDraw) {
      g.playerDraw(me.id, false, this.level === 'hard' ? this.drawOptions() : {});
      return;
    }
    if (g.phase !== 'play') return;

    // กันลูปไม่รู้จบ
    if (this.actions > 25) { g.endTurn(me.id); return; }
    // ง่าย: บางทีก็จบตาเฉยๆ ทั้งที่ยังเล่นได้
    if (this.level === 'easy' && this.actions > 0 && Math.random() < 0.3) { g.endTurn(me.id); return; }
    // ยาก: ใช้ทักษะสั่งใช้ของตัวละคร (ครั้งละ 1 ต่อการคิด)
    if (this.level === 'hard' && this.trySkill()) { this.actions++; this.scheduleThink(); return; }

    const move = this.chooseMove();
    if (!move) { g.endTurn(me.id); return; }
    this.actions++;
    const res = g.playCard(me.id, move.card.id, move.targetId || null, null, move.extra || {});
    if (!res.ok) this.tried.add(move.card.id);
    // คิดต่อ (เผื่อไม่มี broadcast — เช่นเล่นไม่สำเร็จ)
    this.scheduleThink();
  }

  chooseCharacter(cands) {
    const { CHARACTERS } = this.deps;
    const me = this.me;
    // จักรพรรดิชอบตัวที่มีทักษะจักรพรรดิ; คนอื่นสุ่มโดยถ่วงพลังชีวิต
    const scored = cands.map(id => {
      const c = CHARACTERS.find(x => x.id === id) || {};
      let s = (c.hp || 3) + Math.random() * 2;
      if (me.role === 'Lord' && ['caocao', 'liubei', 'sunquan'].includes(id)) s += 1.5;
      return { id, s };
    });
    scored.sort((a, b) => b.s - a.s);
    return scored[0].id;
  }

  chooseMove() {
    const g = this.game;
    const me = this.me;
    const P = this.deps.CHAR_PASSIVES[me.character] || {};
    const hand = me.hand.filter(c => !this.tried.has(c.id));
    const has = (name) => hand.filter(c => c.name === name);
    const others = this.aliveOthers();
    const hardEnemies = others.filter(p => this.isEnemy(p));
    // ไม่มีศัตรูชัดเจนในระยะ → ใช้ศัตรูแบบเดา (กันเกมตัน)
    const enemies = hardEnemies.some(p => g.inAttackRange(me, p)) ? hardEnemies : others.filter(p => this.isSoftEnemy(p));
    const friends = others.filter(p => this.isFriend(p));

    // 1) อุปกรณ์
    for (const c of hand) {
      if (c.type === 'weapon') {
        const curW = me.equipment.weapon;
        if (!curW || (c.range || 1) > (curW.range || 1) || (c.name === 'Zhuge Crossbow' && has('Attack').length >= 2))
          if (!curW || curW.name !== c.name) return { card: c };
      } else if (c.type === 'armor' && !me.equipment.armor) return { card: c };
      else if (c.type === 'mount') {
        const slot = (c.effect || '').includes('atk') ? 'atkMount' : 'defMount';
        if (!me.equipment[slot]) return { card: c };
      }
    }

    // 1.5) (ยาก) ถอด [เสพสุข] ที่ติดเพื่อนออกด้วย [ขโมย]/[เผาสะพาน]
    if (this.level === 'hard') {
      const cleaner = has('Steal')[0] || has('Burning Bridges')[0];
      if (cleaner) {
        const f = friends.find(f => (f.judgments || []).some(j => j.name === 'Overindulgence')
          && (P.unlimitedTrickRange || g.distance(me, f) <= 1));
        if (f) return { card: cleaner, targetId: f.id };
      }
    }

    // 2) รักษา
    if (me.hp < me.maxHp) {
      const peach = has('Peach')[0];
      if (peach && (me.hp <= 2 || me.hand.length > me.hp)) return { card: peach };
    }

    // 3) จั่วเพิ่ม / เก็บเกี่ยว
    // กองไพ่ + กองทิ้งเหลือน้อยมาก → อย่าเล่นการ์ดจั่ว (กันวนจั่วการ์ดใบเดิมกลับมาเรื่อยๆ)
    const cardsLeft = g.deck.length + g.discardPile.length;
    const sooN = has('Something Out of Nothing')[0];
    if (sooN && cardsLeft >= 4) return { card: sooN };
    const harvest = has('Bumper Harvest')[0];
    if (harvest && cardsLeft >= 6 && friends.length >= enemies.length) return { card: harvest };
    const oath = has('Oath of the Peach Garden')[0];
    if (oath && me.hp < me.maxHp) {
      const hurtF = friends.filter(p => p.hp < p.maxHp).length + 1;
      const hurtE = enemies.filter(p => p.hp < p.maxHp).length;
      if (hurtF >= hurtE) return { card: oath };
    }

    const inTrickRange = (t) => P.unlimitedTrickRange || g.distance(me, t) <= 1;
    const hasStuff = (t) => t.hand.length > 0 || Object.values(t.equipment || {}).some(Boolean)
      || (t.judgments || []).length > 0;

    // 4) เสพสุขใส่ศัตรู
    const over = has('Overindulgence')[0];
    if (over) {
      const t = this.rankTargets(enemies).find(t =>
        !this.deps.CHAR_PASSIVES[t.character]?.immuneToOverindulgence
        && !(t.judgments || []).some(j => j.name === 'Overindulgence'));
      if (t) return { card: over, targetId: t.id };
    }

    // 5) ขโมย / เผาสะพาน (ศัตรูก่อน — หรือเพื่อนที่โดนไพ่ตัดสินอยู่)
    for (const name of ['Steal', 'Burning Bridges']) {
      const c = has(name)[0];
      if (!c) continue;
      const t = this.rankTargets(enemies).find(t => inTrickRange(t) && hasStuff(t)
        && !(name === 'Steal' && this.deps.CHAR_PASSIVES[t.character]?.immuneToSteal));
      if (t) return { card: c, targetId: t.id };
    }

    // 6) โจมตีหมู่
    for (const name of ['Barbarian Invasion', 'Raining Arrows']) {
      const c = has(name)[0];
      if (c && enemies.length > 0 && enemies.length >= friends.length) return { card: c };
    }

    // 7) ประลอง
    const duel = has('Duel')[0];
    if (duel) {
      const myAtk = me.hand.filter(c => c.name === 'Attack').length;
      const t = this.rankTargets(enemies).find(t => !g.kongChengProtected(t)
        && (this.level === 'hard' ? (myAtk >= Math.ceil(t.hand.length / 2) || t.hp <= 1) : (myAtk >= 1 || t.hand.length <= 1)));
      if (t) return { card: duel, targetId: t.id };
    }

    // 8) ยืมดาบ
    const borrow = has('Borrowed Sword')[0];
    if (borrow) {
      for (const holder of others.filter(p => p.equipment?.weapon)) {
        const victim = this.rankTargets(enemies).find(v => v.id !== holder.id && g.inAttackRange(holder, v)
          && !g.kongChengProtected(v));
        if (victim && !this.isFriend(holder)) {
          return { card: borrow, targetId: holder.id, extra: { victimId: victim.id } };
        }
      }
    }

    // 9) โจมตี
    const unlimited = me.equipment?.weapon?.name === 'Zhuge Crossbow' || !!P.unlimitedAttacks;
    if (me.attacksThisTurn < 1 || unlimited) {
      const atk = has('Attack')[0];
      if (atk) {
        const pool = enemies;
        const t = this.rankTargets(pool).find(t => g.inAttackRange(me, t) && !g.kongChengProtected(t));
        if (t) return { card: atk, targetId: t.id };
      }
    }

    // 10) สายฟ้า — ทิ้งได้ถ้าไพ่ล้นมือ
    const light = has('Lightning')[0];
    if (light && me.hand.length > me.hp && !(me.judgments || []).some(j => j.name === 'Lightning'))
      return { card: light };

    return null;
  }

  // ─── ตอบโต้ (หลบ/โจมตีตอบ/ขัดขวาง) ────────────────────────────────────────
  respond(data) {
    const g = this.game;
    const me = this.me;
    if (!g || !g.pending || g.pending.responderId !== me.id) return;
    const { type, payload } = g.pending;
    const source = this.room.findPlayer(g.pending.sourceId);
    const P = this.deps.CHAR_PASSIVES[me.character] || {};
    // ง่าย: ไม่เคยใช้ [ขัดขวาง]
    const negation = this.level === 'easy' ? null : me.hand.find(c => c.name === 'Negation');

    if (type === 'negate') {
      const use = negation && !this.isFriend(source);
      return g.resolveResponse(me.id, use ? negation.id : null);
    }

    let card = null;
    if (type === 'dodge') {
      card = me.hand.find(c => c.name === 'Dodge')
        || (P.attackAsDodge && me.hand.find(c => c.name === 'Attack'))
        || (P.blackAsDodge && [...me.hand].filter(c => c.color === 'black').sort((a, b) => cardValue(a) - cardValue(b))[0]);
    } else {
      card = me.hand.find(c => c.name === 'Attack')
        || (P.dodgeAsAttack && me.hand.find(c => c.name === 'Dodge'));
    }

    if (type === 'borrow') {
      const victim = this.room.findPlayer(payload.victimId) || source;
      if (this.isFriend(victim)) card = null;         // ไม่ยอมตีเพื่อน (ยอมเสียอาวุธ)
    }
    if (type === 'duel' && this.isFriend(source) && me.hp > 1) card = null;

    // ง่าย: บางครั้งลืมหลบ/ลืมตอบโต้
    if (this.level === 'easy' && Math.random() < 0.25) card = null;

    // การ์ดกลแบบหมู่ที่ขัดขวางได้: ไม่มีการ์ดตอบ → ใช้ขัดขวางแทน
    if (!card && payload.negatable && negation && !this.isFriend(source)) card = negation;

    g.resolveResponse(me.id, card ? card.id : null);
  }

  peachDecision(data) {
    const g = this.game;
    const me = this.me;
    if (!g || !g.dying) return;
    const dying = this.room.findPlayer(data.forId);
    const P = this.deps.CHAR_PASSIVES[me.character] || {};
    let save = dying && (dying.id === me.id || this.isFriend(dying));
    // ทรยศไม่อยากให้จักรพรรดิตายก่อนเวลา
    if (dying?.role === 'Lord' && me.role !== 'Rebel') save = true;
    if (this.level === 'easy' && dying?.id !== me.id) save = false;   // ง่าย: ช่วยแต่ตัวเอง
    if (!save) return g.declinePeach(me.id);
    const notMyTurn = this.room.players[g.currentPlayer]?.id !== me.id;
    const card = me.hand.find(c => c.name === 'Peach')
      || (P.redAsPeach && notMyTurn && me.hand.find(c => c.color === 'red'));
    if (!card) return g.declinePeach(me.id);
    const r = g.usePeachToSave(me.id, card.id);
    if (r && !r.ok) g.declinePeach(me.id);
  }

  // ─── (ยาก) ทางเลือกเฟสจั่ว: ซวีจู้ 裸衣 / จางเหลียว 突袭 ──────────────────
  drawOptions() {
    const me = this.me;
    const g = this.game;
    const P = this.deps.CHAR_PASSIVES[me.character] || {};
    const others = this.aliveOthers();
    if (P.tuxi) {
      const ts = this.rankTargets(others.filter(p => this.isEnemy(p) && p.hand.length > 0)).slice(0, 2);
      if (ts.length >= 1) return { tuxiTargets: ts.map(t => t.id) };
    }
    if (P.luoyi) {
      const atk = me.hand.filter(c => c.name === 'Attack' || c.name === 'Duel').length;
      if (atk >= 2 && others.some(p => this.isEnemy(p) && g.inAttackRange(me, p))) return { useLuoyi: true };
    }
    return {};
  }

  // ─── (ยาก) ใช้ทักษะสั่งใช้ของตัวละคร — คืน true ถ้าใช้สำเร็จ ─────────────────
  trySkill() {
    const g = this.game;
    const me = this.me;
    const meta = g.getActiveSkill(me);
    if (!meta || !meta.usable) return false;
    if (this.skillTried === meta.key + this.actions) return false;
    this.skillTried = meta.key + this.actions;
    const others = this.aliveOthers();
    const friends = others.filter(p => this.isFriend(p));
    const enemies = others.filter(p => this.isEnemy(p));
    const byValue = [...me.hand].sort((a, b) => cardValue(a) - cardValue(b));
    const male = (p) => !['zhenji', 'ladygan', 'huangyy', 'sunss', 'daqiao', 'diaochan'].includes(p.character);
    let payload = null;
    switch (meta.key) {
      case 'zhiheng': {   // ทิ้งไพ่ห่วยแล้วจั่วใหม่
        const junk = byValue.filter(c => cardValue(c) < 4);
        if (junk.length) payload = { cardIds: junk.map(c => c.id) };
        break;
      }
      case 'kurou': {     // เสีย HP จั่ว 2 — เมื่อเลือดยังเหลือ หรือมีเพอชสำรอง
        const peaches = me.hand.filter(c => c.name === 'Peach').length;
        if (me.hp >= 3 || (me.hp >= 2 && peaches > 0) || (me.hp === 1 && peaches > 0)) payload = {};
        break;
      }
      case 'qingnang': {  // รักษาเพื่อน/ตัวเองที่บาดเจ็บ
        const hurt = [me, ...friends].filter(p => p.hp < p.maxHp).sort((a, b) => a.hp - b.hp)[0];
        if (hurt && byValue[0]) payload = { cardId: byValue[0].id, targetId: hurt.id };
        break;
      }
      case 'rende': {     // มอบไพ่ส่วนเกินให้เพื่อน
        const f = friends.sort((a, b) => a.hand.length - b.hand.length)[0];
        const extra = me.hand.length - me.hp;
        if (f && extra > 0) payload = { cardIds: byValue.slice(0, Math.max(extra, me.hp < me.maxHp && !me.skillUsed?.rendeHeal ? 2 : 1)).map(c => c.id), targetId: f.id };
        break;
      }
      case 'shushen': {   // ทิ้งทั้งมือเมื่อไพ่น้อยค่าและได้ฟื้น
        const total = me.hand.reduce((s, c) => s + cardValue(c), 0);
        if (me.hp < me.maxHp && me.hand.length > me.hp && total / me.hand.length < 4.5) payload = {};
        break;
      }
      case 'jieyin': {
        const t = [...friends, ...others.filter(p => !this.isEnemy(p))].find(p => male(p) && p.hp < p.maxHp);
        if (t && me.hand.length >= 2 && (me.hp < me.maxHp || t.hp < t.maxHp)) payload = { cardIds: byValue.slice(0, 2).map(c => c.id), targetId: t.id };
        break;
      }
      case 'lijian': {    // ให้ศัตรูชาย 2 คนประลองกัน (หรือศัตรู+คนที่ไม่ใช่พวก)
        const pool = this.rankTargets(others.filter(p => male(p) && !this.isFriend(p)));
        const e = pool.filter(p => this.isEnemy(p));
        const t1 = e[0] || pool[0];
        const t2 = pool.find(p => p !== t1);
        if (t1 && t2 && byValue[0] && (e.length > 0)) payload = { cardId: byValue[0].id, targetIds: [t2.id, t1.id] };
        break;
      }
      case 'fanjian': {
        const t = this.rankTargets(enemies)[0];
        if (t && me.hand.length > 0) payload = { targetId: t.id };
        break;
      }
      default: return false;
    }
    if (!payload) return false;
    const res = g.useSkill(me.id, payload);
    return !!(res && res.ok);
  }

  doDiscard() {
    const g = this.game;
    const me = this.me;
    if (!g || !g.awaitingDiscard || g.awaitingDiscard.playerId !== me.id) return;
    const need = g.awaitingDiscard.need;
    const order = this.level === 'easy' ? [...me.hand].sort(() => Math.random() - 0.5)
      : [...me.hand].sort((a, b) => cardValue(a) - cardValue(b));
    const ids = order.slice(0, need).map(c => c.id);
    const r = g.discardCards(me.id, ids);
    if (r && !r.ok) g.autoDiscard();
  }

  harvestPick() {
    const g = this.game;
    if (!g || !g.harvest) return;
    const best = [...g.harvest.revealed].sort((a, b) => cardValue(b) - cardValue(a))[0];
    if (best) g.harvestPick(this.playerId, best.id);
  }

  takeCardPick(data) {
    const g = this.game;
    if (!g || !g.cardPick) return;
    const target = this.room.findPlayer(g.cardPick.targetId);
    const opts = data.options || [];
    let choice;
    if (target && this.isFriend(target)) {
      // เพื่อน: เอาไพ่ตัดสินออก — [เสพสุข] ก่อน แล้วค่อย [สายฟ้า]
      const js = (target.judgments || []);
      const want = js.find(j => j.name === 'Overindulgence') || js.find(j => j.name === 'Lightning');
      choice = (want && opts.find(o => o.value === 'judge:' + want.id)) || opts.find(o => o.value.startsWith('judge:'));
    } else {
      const order = ['equip:armor', 'equip:defMount', 'equip:weapon', 'hand', 'equip:atkMount'];
      choice = order.map(v => opts.find(o => o.value === v)).find(Boolean);
    }
    g.resolveTakeCard(this.playerId, (choice || opts[0])?.value);
  }
}

module.exports = { BotBrain, BotSocket, BOT_NAMES, DELAYS };

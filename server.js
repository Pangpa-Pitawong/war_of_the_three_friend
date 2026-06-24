const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/GeneralCard', express.static(path.join(__dirname, 'GeneralCard')));
app.use('/GameCard', express.static(path.join(__dirname, 'GameCard')));
app.use('/BackCard', express.static(path.join(__dirname, 'BackCard')));
app.use('/Roll', express.static(path.join(__dirname, 'Roll')));

// ─── In-Memory State ──────────────────────────────────────────────────────────
const rooms = new Map();   // roomCode → Room
const sockets = new Map(); // socketId → { playerId, roomCode, username }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function genRoomCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'WTK-';
  for (let i = 0; i < 6; i++) code += c[Math.floor(Math.random() * c.length)];
  return rooms.has(code) ? genRoomCode() : code;
}

function genPlayerId() { return uuidv4().slice(0, 8).toUpperCase(); }

// ─── Card Deck ────────────────────────────────────────────────────────────────
// ─── องค์ประกอบสำรับการ์ด (100 ใบ — ฉบับ War of the Three Friend) ────────────────
// การ์ดพื้นฐาน + การ์ดกล + อุปกรณ์
//  พื้นฐาน 46 (โจมตี30/หลบหลีก15/ลูกท้อ1) | กล 35 | อุปกรณ์ 19 (อาวุธ10/เกราะ3/ม้า6)
const CARD_TEMPLATES = [
  // ── การ์ดพื้นฐาน (Basic) 53 ใบ ──
  { name: 'Attack',  type: 'basic', count: 30 },              // โจมตี 杀
  { name: 'Dodge',   type: 'basic', count: 15 },              // หลบหลีก 闪
  { name: 'Peach',   type: 'basic', count: 8,  redOnly: true },// เพอช 桃 (ไพ่แดงเสมอ)
  // ── การ์ดกล (Stratagem/Trick) ──
  { name: 'Something Out of Nothing', type: 'stratagem', count: 4 },  // 无中生有
  { name: 'Duel',                     type: 'stratagem', count: 3 },  // 决斗
  { name: 'Burning Bridges',          type: 'stratagem', count: 6 },  // 过河拆桥
  { name: 'Steal',                    type: 'stratagem', count: 5 },  // 顺手牵羊
  { name: 'Borrowed Sword',           type: 'stratagem', count: 2 },  // 借刀杀人
  { name: 'Negation',                 type: 'stratagem', count: 3 },  // 无懈可击
  { name: 'Barbarian Invasion',       type: 'stratagem', count: 3 },  // 南蛮入侵
  { name: 'Raining Arrows',           type: 'stratagem', count: 1 },  // 万箭齐发
  { name: 'Oath of the Peach Garden', type: 'stratagem', count: 1 },  // 桃园结义
  { name: 'Bumper Harvest',           type: 'stratagem', count: 2 },  // 五谷丰登
  { name: 'Lightning',                type: 'stratagem', count: 2, fixed: { suit: '♠' } }, // 闪电 (โพดำ)
  { name: 'Overindulgence',           type: 'stratagem', count: 3 },  // 乐不思蜀
  // ── อุปกรณ์: อาวุธ (Weapons) 9 ใบ — ใบละ 1 ──
  { name: 'Zhuge Crossbow',     type: 'weapon', count: 2, range: 1 },
  { name: 'Yin-Yang Swords',    type: 'weapon', count: 1, range: 2 },
  { name: 'Blue Steel Sword',   type: 'weapon', count: 1, range: 2 },
  { name: 'Frost Sword',        type: 'weapon', count: 1, range: 2 },
  { name: 'Green Dragon Blade', type: 'weapon', count: 1, range: 3 },
  { name: 'Serpent Spear',      type: 'weapon', count: 1, range: 3 },
  { name: 'Rock Cleaving Axe',  type: 'weapon', count: 1, range: 3 },
  { name: 'Sky Piercing Halberd', type: 'weapon', count: 1, range: 4 },
  { name: 'Kirin Bow',          type: 'weapon', count: 1, range: 5 },
  // ── อุปกรณ์: เกราะ (Armor) 2 ใบ — ใบละ 1 ──
  { name: 'Eight Trigrams Formation', type: 'armor', count: 2 },
  { name: 'Nio Shield',               type: 'armor', count: 1 },
  // ── อุปกรณ์: ม้า (Mounts) ──
  { name: 'Fergana Steed', type: 'mount', count: 3, effect: '+1def' }, // ม้าป้องกัน -1 (คนอื่นโจมตียากขึ้น)
  { name: 'Shadowrunner',  type: 'mount', count: 3, effect: '-1atk' }, // ม้าโจมตี +1 (ขยายระยะโจมตีของผู้ถือ)
];

const SUITS = ['♠', '♥', '♣', '♦'];      // โพดำ โพแดง ดอกจิก ข้าวหลามตัด
const RED_SUITS = ['♥', '♦'];
// แปลงเลข 1-13 → A,2-10,J,Q,K
function rankLabel(v) {
  return { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[v] || String(v);
}

// สร้างสำรับ 108 ใบ พร้อมสุ่มดอก (♠♥♣♦) และเลข (A-K) ที่มุมการ์ดทุกใบ
function buildFullDeck() {
  const deck = [];
  let uid = 0;
  for (const t of CARD_TEMPLATES) {
    for (let i = 0; i < t.count; i++) {
      let suit;
      if (t.fixed?.suit) suit = t.fixed.suit;                       // ดอกตายตัว (เช่น สายฟ้า=โพดำ)
      else if (t.redOnly) suit = RED_SUITS[Math.floor(Math.random() * 2)]; // เพอช=ไพ่แดง
      else suit = SUITS[Math.floor(Math.random() * 4)];             // สุ่มดอก
      const value = 1 + Math.floor(Math.random() * 13);             // สุ่มเลข 1-13
      const card = {
        id: `c${uid++}`,
        name: t.name,
        type: t.type,
        suit,
        value,
        rank: rankLabel(value),
        color: RED_SUITS.includes(suit) ? 'red' : 'black',
      };
      if (t.range) card.range = t.range;
      if (t.effect) card.effect = t.effect;
      deck.push(card);
    }
  }
  return deck; // 108 ใบ
}

function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ─── Characters ───────────────────────────────────────────────────────────────
const CHARACTERS = [
  { id: 'caocao',    name: 'Cao Cao',      kingdom: 'WEI', hp: 4, image: '/GeneralCard/WEI/Cao Cao.png' },
  { id: 'simayi',    name: 'Sima Yi',      kingdom: 'WEI', hp: 3, image: '/GeneralCard/WEI/Sima Yi.png' },
  { id: 'zhangliao', name: 'Zhang Liao',   kingdom: 'WEI', hp: 4, image: '/GeneralCard/WEI/Zhang Liao.png' },
  { id: 'xiahou',    name: 'Xiahou Dun',   kingdom: 'WEI', hp: 4, image: '/GeneralCard/WEI/Xiahou Dun.png' },
  { id: 'xuzhu',     name: 'Xu Zhu',       kingdom: 'WEI', hp: 4, image: '/GeneralCard/WEI/Xu Zhu.png' },
  { id: 'zhenji',    name: 'Zhen Ji',      kingdom: 'WEI', hp: 3, image: '/GeneralCard/WEI/Zhen Ji.png' },
  { id: 'guojia',    name: 'Guo Jia',      kingdom: 'WEI', hp: 3, image: '/GeneralCard/WEI/Guo Jia.png' },
  { id: 'yuejin',    name: 'Yue Jin',      kingdom: 'WEI', hp: 4, image: '/GeneralCard/WEI/Yue Jin.png' },
  { id: 'liubei',    name: 'Liu Bei',      kingdom: 'SHU', hp: 4, image: '/GeneralCard/SHU/Liu Bei.png' },
  { id: 'guanyu',    name: 'Guan Yu',      kingdom: 'SHU', hp: 4, image: '/GeneralCard/SHU/Guan Yu.png' },
  { id: 'zhangfei',  name: 'Zhang Fei',    kingdom: 'SHU', hp: 4, image: '/GeneralCard/SHU/Zhang Fei.png' },
  { id: 'zhaoyun',   name: 'Zhao Yun',     kingdom: 'SHU', hp: 4, image: '/GeneralCard/SHU/Zhao Yun.png' },
  { id: 'zhuge',     name: 'Zhuge Liang',  kingdom: 'SHU', hp: 3, image: '/GeneralCard/SHU/Zhuge Liang.png' },
  { id: 'machao',    name: 'Ma Chao',      kingdom: 'SHU', hp: 4, image: '/GeneralCard/SHU/Ma Chao.png' },
  { id: 'huangyy',   name: 'Huang Yueying',kingdom: 'SHU', hp: 3, image: '/GeneralCard/SHU/Huang Yueying.png' },
  { id: 'ladygan',   name: 'Lady Gan',     kingdom: 'SHU', hp: 3, image: '/GeneralCard/SHU/Lady Gan.png' },
  { id: 'sunquan',   name: 'Sun Quan',     kingdom: 'WU',  hp: 4, image: '/GeneralCard/WU/Sun Quan.png' },
  { id: 'zhouyu',    name: 'Zhou Yu',      kingdom: 'WU',  hp: 3, image: '/GeneralCard/WU/Zhou Yu.png' },
  { id: 'huanggai',  name: 'Huang Gai',    kingdom: 'WU',  hp: 4, image: '/GeneralCard/WU/Huang Gai.png' },
  { id: 'luxun',     name: 'Lu Xun',       kingdom: 'WU',  hp: 3, image: '/GeneralCard/WU/Lu Xun.png' },
  { id: 'sunss',     name: 'Sun Shangxiang',kingdom:'WU',  hp: 3, image: '/GeneralCard/WU/Sun Shangxiang.png' },
  { id: 'lvmeng',    name: 'Lv Meng',      kingdom: 'WU',  hp: 4, image: '/GeneralCard/WU/Lv Meng.png' },
  { id: 'ganning',   name: 'Gan Ning',     kingdom: 'WU',  hp: 4, image: '/GeneralCard/WU/Gan Ning.png' },
  { id: 'daqiao',    name: 'Da Qiao',      kingdom: 'WU',  hp: 3, image: '/GeneralCard/WU/Da Qiao.png' },
  { id: 'lvbu',      name: 'Lv Bu',        kingdom: 'QUN', hp: 4, image: '/GeneralCard/QUH/Lv Bu.png' },
  { id: 'diaochan',  name: 'Diao Chan',    kingdom: 'QUN', hp: 3, image: '/GeneralCard/QUH/Diao Chan.png' },
  { id: 'huatuo',    name: 'Hua Tuo',      kingdom: 'QUN', hp: 3, image: '/GeneralCard/QUH/Hua Tuo.png' },
  { id: 'huaxiong',  name: 'Hua Xiong',    kingdom: 'QUN', hp: 4, image: '/GeneralCard/QUH/Hua Xiong.png' },
  { id: 'gongsuanzan',name:'Gongsun Zan',  kingdom: 'QUN', hp: 4, image: '/GeneralCard/QUH/Gongsun Zan.png' },
  { id: 'panfeng',   name: 'Pan Feng',     kingdom: 'QUN', hp: 4, image: '/GeneralCard/QUH/Pan Feng.png' },
];

// ตัวละครที่มี "เอฟเฟคจักรพรรดิ" (เจ้าผู้ครองแคว้น) — ฟิกให้อยู่ในมือจักรพรรดิทุกรอบ
const LORD_CHARACTERS = ['caocao', 'liubei', 'sunquan'];

// ─── ทักษะที่ "สั่งใช้เองได้" (Active Skills) ────────────────────────────────────
// ใช้ได้เฉพาะเฟสเล่นการ์ดของเจ้าของตัวละครเท่านั้น (ตรวจเงื่อนไขใน canUseSkill)
//   needs: 'cards'(เลือกไพ่หลายใบ) | 'card+target'(ไพ่ 1 ใบ + เป้าหมาย) | 'confirm'(กดยืนยัน)
const ACTIVE_SKILLS = {
  sunquan:  { key: 'zhiheng',  name: 'ความสมดุล (制衡)', needs: 'cards',       oncePerTurn: true,
              desc: 'จำกัด 1 ครั้งต่อช่วงเล่นการ์ด ทิ้งการ์ดจำนวนเท่าใดก็ได้ แล้วจั่วการ์ดจำนวนเท่ากันมาแทน' },
  huanggai: { key: 'kurou',    name: 'เสียสละตน (苦肉)',  needs: 'confirm',     oncePerTurn: false,
              desc: 'เสีย HP 1 หน่วยเพื่อจั่วการ์ด 2 ใบ' },
  huatuo:   { key: 'qingnang', name: 'หมอผู้เมตตา (青囊)',   needs: 'card+target', oncePerTurn: true,
              desc: 'จำกัด 1 ครั้งต่อช่วงเล่นการ์ด ทิ้งการ์ด 1 ใบจากมือเพื่อให้ตัวละครที่บาดเจ็บฟื้น HP 1 หน่วย' },
};

// การ์ดที่ใช้ "ตอบโต้" เท่านั้น — ห้ามเล่นเชิงรุกในเฟสเล่นการ์ด
const RESPONSE_ONLY_CARDS = ['Dodge', 'Negation'];
// การ์ดกลหน่วงเวลา (ต้องมีเฟสตัดสิน) — ยังไม่รองรับการเล่น
const UNSUPPORTED_PLAY_CARDS = ['Lightning', 'Overindulgence'];

// ─── ทักษะ Passive ของตัวละคร (ตรวจที่เซิร์ฟเวอร์) ──────────────────────────────────
const CHAR_PASSIVES = {
  guanyu:   { redAsAttack: true },          // Wu Sheng (武圣): ไพ่แดงใช้เป็นโจมตีได้
  zhaoyun:  { attackAsDodge: true,          // Long Dan (龙胆): โจมตีใช้เป็นหลบได้
               dodgeAsAttack: true },        //                   หลบใช้เป็นโจมตีได้
  zhangfei: { unlimitedAttacks: true },     // Pao Xiao (咆哮): โจมตีได้ไม่จำกัด
  zhenji:   { blackAsDodge: true },         // Qing Guo (倾国): ไพ่ดำใช้เป็นหลบได้
  machao:   { distanceMinus1: true },       // Ma Shu (马术): ระยะ -1 จากตนเองถึงคนอื่น
  lvbu:     { needsTwoDodge: true },        // Wu Shuang (无双): เป้าต้องหลบ 2 ใบ
  luxun:    { immuneToSteal: true,          // Qian Xun (谦逊): ขโมย/เบี่ยงเบนไม่ได้
               immuneToOverindulgence: true },
  huangyy:  { unlimitedTrickRange: true,    // Qi Cai (奇才): การ์ดยุทธวิธีของคุณมีระยะไม่จำกัด
               jizhi: true },               // Ji Zhi (集智): จั่ว 1 ใบหลังใช้การ์ดยุทธวิธี
};

// ─── Roles by player count (ตรงตามตารางในคู่มือ — สามก๊กฉบับมาตรฐาน) ──────────────
// คอลัมน์: จักรพรรดิ(Lord) / ภักดี(Loyalist) / กบฎ(Rebel) / ทรยศ(Spy)
//  4 คน: 1 / 1 / 1 / 1
//  5 คน: 1 / 1 / 2 / 1
//  6 คน: 1 / 1 / 3 / 1
//  7 คน: 1 / 2 / 3 / 1
//  8 คน: 1 / 2 / 4 / 1
//  9 คน: 1 / 3 / 4 / 1
// 10 คน: 1 / 3 / 4 / 2
function buildRoleSet(lord, loyal, rebel, spy) {
  return [
    ...Array(lord).fill('Lord'),
    ...Array(loyal).fill('Loyalist'),
    ...Array(rebel).fill('Rebel'),
    ...Array(spy).fill('Spy'),
  ];
}
const ROLE_SETS = {
  2: buildRoleSet(1, 0, 1, 0),   // โหมดย่อ: จักรพรรดิ ปะทะ กบฎ
  3: buildRoleSet(1, 0, 1, 1),   // โหมดย่อ: จักรพรรดิ / กบฎ / ทรยศ
  4: buildRoleSet(1, 1, 1, 1),
  5: buildRoleSet(1, 1, 2, 1),
  6: buildRoleSet(1, 1, 3, 1),
  7: buildRoleSet(1, 2, 3, 1),
  8: buildRoleSet(1, 2, 4, 1),
  9: buildRoleSet(1, 3, 4, 1),
  10:buildRoleSet(1, 3, 4, 2),
};

// ─── Room ─────────────────────────────────────────────────────────────────────
class Room {
  constructor(hostId, settings) {
    this.code = genRoomCode();
    this.hostId = hostId;
    this.settings = settings;
    this.players = [];      // { id, socketId, username, ready, character, role, hp, maxHp, hand, equipment, status, connected }
    this.spectators = [];
    this.state = 'lobby';   // lobby | selecting | playing | ended
    this.game = null;
    this.draft = null;      // ขั้นตอนสุ่มโรล + เลือกตัวละคร (ดู startDraft)
    this.createdAt = Date.now();
  }

  addPlayer(id, socketId, username) {
    if (this.players.length >= this.settings.playerLimit) return false;
    this.players.push({
      id, socketId, username,
      ready: false, character: null, role: null,
      hp: 0, maxHp: 0, hand: [], equipment: {},
      status: [], connected: true, isAI: false,
    });
    return true;
  }

  removePlayer(id) {
    this.players = this.players.filter(p => p.id !== id);
  }

  findPlayer(id) { return this.players.find(p => p.id === id); }

  publicState(forPlayerId) {
    const me = this.findPlayer(forPlayerId);
    const g = this.game;
    const d = this.draft;
    const lord = this.players.find(p => p.role === 'Lord');
    // ระหว่างเลือกตัวละคร: เปิดเผยเฉพาะตัวที่จักรพรรดิเลือกแล้ว + ตัวของเราเอง
    const revealChar = (p) => {
      if (this.state === 'playing' || this.state === 'ended') return p.character;
      if (p.id === forPlayerId) return p.character;
      if (this.state === 'selecting' && d && d.revealed.includes(p.id)) return p.character;
      return null;
    };
    return {
      code: this.code,
      hostId: this.hostId,
      settings: this.settings,
      state: this.state,
      players: this.players.map(p => {
        const shownChar = revealChar(p);
        return {
        id: p.id,
        username: p.username,
        ready: p.ready,
        character: shownChar,
        kingdom: shownChar ? CHARACTERS.find(c => c.id === shownChar)?.kingdom : null,
        hp: p.hp,
        maxHp: p.maxHp,
        handCount: p.hand.length,
        hand: p.id === forPlayerId ? p.hand : [],
        equipment: p.equipment,
        status: p.status,
        connected: p.connected,
        isAI: p.isAI,
        // ระยะจากผู้เล่นที่กำลังดู และอยู่ในระยะโจมตีหรือไม่
        distance: g && me && me.hp > 0 && p.hp > 0 && p.id !== forPlayerId ? g.distance(me, p) : null,
        inAttackRange: g && me && me.hp > 0 && p.hp > 0 && p.id !== forPlayerId ? g.inAttackRange(me, p) : false,
        role: p.id === forPlayerId || this.state === 'ended' ? p.role : (p.role === 'Lord' ? 'Lord' : '?'),
      };
      }),
      spectators: this.spectators.length,
      myAttackRange: g && me ? g.attackRange(me) : 1,
      // ทักษะที่ผู้เล่นนี้สั่งใช้ได้ (ปุ่มใช้ทักษะ) — null ถ้าตัวละครไม่มีทักษะแบบสั่งใช้
      mySkill: g && me ? g.getActiveSkill(me) : null,
      // ── ขั้นตอนเลือกตัวละคร (สุ่มโรลแล้ว จักรพรรดิเลือกก่อน) ──
      draft: this.state === 'selecting' && d ? {
        stage: d.stage,                              // 'lord' | 'others'
        myCandidates: d.candidates[forPlayerId] || null,  // การ์ดตัวละครในมือเรา
        myPick: d.picks[forPlayerId] || null,        // ตัวที่เราเลือกแล้ว
        lordId: lord ? lord.id : null,
        lordName: lord ? lord.username : null,
        lordPick: lord && d.revealed.includes(lord.id) ? d.picks[lord.id] : null,
        // ผู้เล่นที่ยังเลือกไม่เสร็จ (เพื่อแสดงสถานะ "กำลังรอ...")
        waiting: (d.stage === 'lord'
          ? (lord ? [lord] : [])
          : this.players.filter(p => p.role !== 'Lord' && !d.picks[p.id])
        ).map(p => p.username),
      } : null,
      game: g ? {
        turn: g.turn,
        currentPlayer: g.currentPlayer,
        phase: g.phase,
        awaitingDraw: !!g.awaitingDraw,
        awaitingDiscard: g.awaitingDiscard ? { playerId: g.awaitingDiscard.playerId, need: g.awaitingDiscard.need } : null,
        harvest: g.harvest ? {
          picker: g.harvest.order[g.harvest.idx] || null,
          revealed: g.harvest.revealed.map(c => ({ id: c.id, name: c.name, type: c.type, suit: c.suit, rank: c.rank, color: c.color })),
          remaining: g.harvest.order.length - g.harvest.idx,
        } : null,
        deckSize: g.deck.length,
        discardTop: g.discardPile.slice(-1)[0] || null,
        discardCount: g.discardPile.length,
        // กองทิ้งทั้งหมด — ให้ผู้เล่นเปิดดูได้ว่ามีใบไหนบ้าง (ล่าสุดอยู่ท้ายสุด)
        discard: g.discardPile.map(c => ({ id: c.id, name: c.name, type: c.type, suit: c.suit, rank: c.rank })),
        log: g.log.slice(-30),
        timer: g.timer,
        // สถานะรอตอบโต้/ใกล้ตาย เฉพาะที่เกี่ยวข้องกับผู้เล่นนี้
        pending: g.pending ? { responderId: g.pending.responderId, type: g.pending.type, cardName: g.pending.cardName, sourceId: g.pending.sourceId } : null,
        dyingPlayerId: g.dyingPlayerId || null,
      } : null,
    };
  }

  // ─── สุ่มโรล + เริ่มขั้นตอนเลือกตัวละคร ──────────────────────────────────────────
  // 1) สุ่มบทบาทตามจำนวนผู้เล่น  2) หมุนลำดับให้จักรพรรดิเป็นคนแรก
  // 3) จักรพรรดิได้การ์ด 7 ใบ = 3 ใบฟิก (เอฟเฟคจักรพรรดิ) + สุ่ม 4 ใบ
  startDraft() {
    const n = this.players.length;
    const roles = shuffleDeck([...(ROLE_SETS[n] || ROLE_SETS[2])]);
    this.players.forEach((p, i) => {
      p.role = roles[i];
      p.character = null;
    });
    // หมุนลำดับที่นั่งให้จักรพรรดิอยู่หน้าสุด (เริ่มเล่นก่อน)
    const lordIdx = this.players.findIndex(p => p.role === 'Lord');
    if (lordIdx > 0) {
      this.players = this.players.slice(lordIdx).concat(this.players.slice(0, lordIdx));
    }
    const lord = this.players[0];

    // กองการ์ดตัวละคร = ทุกตัวยกเว้น 3 ใบฟิกของจักรพรรดิ แล้วสับ
    const pool = shuffleDeck(CHARACTERS.map(c => c.id).filter(id => !LORD_CHARACTERS.includes(id)));
    // มือจักรพรรดิ: 3 ใบฟิก + สุ่มอีก 4 ใบจากกอง
    const lordCandidates = shuffleDeck([...LORD_CHARACTERS, ...pool.splice(0, 4)]);

    this.draft = {
      stage: 'lord',
      pool,                       // การ์ดตัวละครที่เหลือในกอง
      candidates: { [lord.id]: lordCandidates },
      picks: {},                  // playerId -> charId
      revealed: [],               // ผู้เล่นที่เปิดเผยตัวละครแล้ว (จักรพรรดิ)
    };
    // เปิดการ์ดบทบาท (Roll) ให้ทุกคนก่อน ~4.5 วิ แล้วจึงไปหน้าเลือกตัวละคร
    this.state = 'rolling';
    clearTimeout(this.rollTimer);
    this.rollTimer = setTimeout(() => {
      if (this.state === 'rolling') {
        this.state = 'selecting';
        broadcastRoom(this);
      }
    }, 4500);
  }

  // จักรพรรดิ / ผู้เล่นเลือกตัวละครจากการ์ดในมือ
  draftPick(playerId, charId) {
    const d = this.draft;
    if (!d || this.state !== 'selecting') return { ok: false, msg: 'ยังไม่ถึงขั้นตอนเลือกตัวละคร' };
    const player = this.findPlayer(playerId);
    if (!player) return { ok: false, msg: 'ไม่พบผู้เล่น' };
    if (d.picks[playerId]) return { ok: false, msg: 'คุณเลือกตัวละครไปแล้ว' };
    const cands = d.candidates[playerId];
    if (!cands) return { ok: false, msg: 'ยังไม่ถึงตาเลือกของคุณ' };
    if (!cands.includes(charId)) return { ok: false, msg: 'ตัวละครนี้ไม่ได้อยู่ในมือคุณ' };

    if (d.stage === 'lord') {
      if (player.role !== 'Lord') return { ok: false, msg: 'รอจักรพรรดิเลือกก่อน' };
      d.picks[playerId] = charId;
      d.revealed.push(playerId);
      // เอาการ์ดที่จักรพรรดิไม่เลือก (6 ใบ) กลับเข้ากองแล้วสับ
      d.pool.push(...cands.filter(id => id !== charId));
      d.pool = shuffleDeck(d.pool);
      // แจกผู้เล่นที่เหลือคนละ 5 ใบ (ปรับลดถ้ากองไม่พอ)
      const others = this.players.filter(p => p.role !== 'Lord');
      const per = Math.min(5, Math.max(1, Math.floor(d.pool.length / Math.max(1, others.length))));
      others.forEach(p => { d.candidates[p.id] = d.pool.splice(0, per); });
      d.stage = 'others';
      if (others.length === 0) this.finishDraft();
      return { ok: true };
    }

    // stage 'others' — ทุกคนเลือกพร้อมกัน คนละ 1 ใบ
    d.picks[playerId] = charId;
    const others = this.players.filter(p => p.role !== 'Lord');
    if (others.every(p => d.picks[p.id])) this.finishDraft();
    return { ok: true };
  }

  // ทุกคนเลือกครบ — กำหนดตัวละคร เก็บการ์ดที่เหลือกลับเข้ากอง แล้วเริ่มเกม
  finishDraft() {
    const d = this.draft;
    this.players.forEach(p => { p.character = d.picks[p.id]; });
    this.draft = null;
    this.state = 'playing';
    this.game = new Game(this);
    this.game.start();
    this.players.forEach(p => {
      const sock = io.sockets.sockets.get(p.socketId);
      if (sock) sock.emit('gameStarted', this.publicState(p.id));
    });
    this.spectators.forEach(sid => {
      const sock = io.sockets.sockets.get(sid);
      if (sock) sock.emit('gameStarted', this.publicState(null));
    });
  }
}

// ─── Game Logic ───────────────────────────────────────────────────────────────
class Game {
  constructor(room) {
    this.room = room;
    this.deck = shuffleDeck(buildFullDeck());
    this.discardPile = [];
    this.turn = 0;
    this.currentPlayer = 0;
    this.phase = 'start';
    this.awaitingDraw = false;
    this.awaitingDiscard = null;   // { playerId, need } — รอผู้เล่นเลือกการ์ดทิ้งตอนจบตา
    this.harvest = null;           // { revealed:[], order:[playerId], idx } — เก็บเกี่ยวอุดมสมบูรณ์
    this.harvestTimer = null;
    this.log = [];
    this.timer = null;
    this.timerInterval = null;
  }

  start() {
    const players = this.room.players;
    const n = players.length;

    // บทบาท+ตัวละคร ถูกกำหนดในขั้นตอนเลือกตัวละคร (startDraft) แล้ว
    players.forEach((p) => {
      const char = CHARACTERS.find(c => c.id === p.character);
      // จักรพรรดิได้พลังชีวิตเพิ่ม 1 หน่วย ยกเว้นเล่น 2 คน (ตามคู่มือ)
      p.maxHp = (char?.hp || 4) + (p.role === 'Lord' && n > 2 ? 1 : 0);
      p.hp = p.maxHp;
      p.hand = this.drawCards(4);  // แจกการ์ดเริ่มต้น คนละ 4 ใบ
      p.equipment = { weapon: null, armor: null, atkMount: null, defMount: null };
      p.attacksThisTurn = 0;
    });

    this.currentPlayer = 0;  // จักรพรรดิเริ่มก่อน
    this.pending = null;     // ระบบตอบโต้ (หลบหลีก/ลงดาบ)
    const lord = players[0];
    this.addLog('ระบบ', '🎴 เกมเริ่มต้นแล้ว! แจกการ์ดคนละ 4 ใบ');
    this.addLog('ระบบ', `👑 จักรพรรดิคือ ${lord.username} (${lord.maxHp} พลังชีวิต) เริ่มก่อน`);
    this.runTurn();
  }

  broadcast() {
    this.room.players.forEach(p => {
      const sock = io.sockets.sockets.get(p.socketId);
      if (sock) sock.emit('roomUpdate', this.room.publicState(p.id));
    });
    // ผู้ชม
    this.room.spectators.forEach(sid => {
      const sock = io.sockets.sockets.get(sid);
      if (sock) sock.emit('roomUpdate', this.room.publicState(null));
    });
  }

  // ─── ระยะทาง (Distance) — ระยะที่สั้นที่สุดบนวงกลม + ตัวปรับจากม้า ──────────────
  seatDistance(fromIdx, toIdx) {
    const alive = this.room.players.filter(p => p.hp > 0);
    const aliveIdx = this.room.players.map((p, i) => (p.hp > 0 ? i : -1)).filter(i => i >= 0);
    const fa = aliveIdx.indexOf(fromIdx);
    const ta = aliveIdx.indexOf(toIdx);
    if (fa < 0 || ta < 0) return 99;
    const diff = Math.abs(fa - ta);
    return Math.min(diff, alive.length - diff);
  }

  distance(from, to) {
    const fromIdx = this.room.players.indexOf(from);
    const toIdx = this.room.players.indexOf(to);
    let d = this.seatDistance(fromIdx, toIdx);
    if (from.equipment?.atkMount) d -= 1;
    if (to.equipment?.defMount) d += 1;
    // Ma Chao (Ma Shu): ระยะจากตัวเองไปทุกคนลด 1
    if (CHAR_PASSIVES[from.character]?.distanceMinus1) d -= 1;
    return Math.max(1, d);
  }

  attackRange(player) {
    // ระยะโจมตีพื้นฐาน = 1 ปรับตามอาวุธ
    return player.equipment?.weapon?.range || 1;
  }

  // ตรวจว่าโจมตีเป้าหมายได้ในระยะหรือไม่
  inAttackRange(from, to) {
    return this.distance(from, to) <= this.attackRange(from);
  }

  drawCards(count) {
    const cards = [];
    for (let i = 0; i < count; i++) {
      if (this.deck.length === 0) {
        if (this.discardPile.length === 0) break;
        this.deck = shuffleDeck([...this.discardPile]);
        this.discardPile = [];
        this.addLog('ระบบ', `♻️ กองไพ่หมด — สับกองทิ้ง ${this.deck.length} ใบกลับเข้ากองเล่น`);
      }
      cards.push(this.deck.pop());
    }
    return cards;
  }

  addLog(who, msg) {
    this.log.push({ who, msg, time: Date.now() });
    if (this.log.length > 200) this.log.shift();
  }

  // ─── ทักษะสั่งใช้ของตัวละคร ──────────────────────────────────────────────────
  // คืนข้อมูลทักษะ + บอกว่ากดใช้ตอนนี้ได้ไหม (usable) เพื่อให้ client แสดง/ปิดปุ่ม
  getActiveSkill(player) {
    if (!player || !player.character) return null;
    const sk = ACTIVE_SKILLS[player.character];
    if (!sk) return null;
    const cur = this.room.players[this.currentPlayer];
    const isMyTurn = cur && cur.id === player.id;
    let usable = true, reason = '';
    if (player.hp <= 0) { usable = false; reason = 'ถูกกำจัดแล้ว'; }
    else if (!isMyTurn) { usable = false; reason = 'ใช้ได้เฉพาะตาของคุณ'; }
    else if (this.phase !== 'play') { usable = false; reason = 'ใช้ได้เฉพาะเฟสเล่นการ์ด'; }
    else if (this.pending) { usable = false; reason = 'กำลังรอการตอบโต้'; }
    else if (sk.oncePerTurn && player.skillUsed?.[sk.key]) { usable = false; reason = 'ใช้ไปแล้วในตานี้'; }
    else if ((sk.needs === 'cards' || sk.needs === 'card+target') && player.hand.length === 0) {
      usable = false; reason = 'ไม่มีไพ่ในมือ';
    }
    return { key: sk.key, name: sk.name, desc: sk.desc, needs: sk.needs, usable, reason };
  }

  useSkill(playerId, payload = {}) {
    const player = this.room.players.find(p => p.id === playerId);
    if (!player) return { ok: false, msg: 'ไม่พบผู้เล่น' };
    const meta = this.getActiveSkill(player);
    if (!meta) return { ok: false, msg: 'ตัวละครนี้ไม่มีทักษะแบบสั่งใช้' };
    if (!meta.usable) return { ok: false, msg: meta.reason || 'ใช้ทักษะตอนนี้ไม่ได้' };
    player.skillUsed = player.skillUsed || {};

    switch (player.character) {
      case 'sunquan': {  // ถ่วงดุลอำนาจ (制衡)
        const ids = Array.isArray(payload.cardIds) ? payload.cardIds : [];
        const toDiscard = player.hand.filter(c => ids.includes(c.id));
        if (toDiscard.length === 0) return { ok: false, msg: 'เลือกไพ่ที่จะทิ้งอย่างน้อย 1 ใบ' };
        player.hand = player.hand.filter(c => !ids.includes(c.id));
        toDiscard.forEach(c => this.discardPile.push(c));
        player.hand.push(...this.drawCards(toDiscard.length));
        player.skillUsed.zhiheng = true;
        this.addLog(player.username, `🌊 ถ่วงดุลอำนาจ — ทิ้ง ${toDiscard.length} ใบ จั่วใหม่ ${toDiscard.length} ใบ`);
        break;
      }
      case 'huanggai': {  // ทรมานตัวเอง (苦肉)
        this.addLog(player.username, '🩸 ทรมานตัวเอง — เสีย 1 พลังชีวิต จั่ว 2 ใบ');
        player.hand.push(...this.drawCards(2));
        this.dealDamage(player, 1, null);  // อาจเข้าสภาวะใกล้ตาย (dealDamage broadcast ให้แล้ว)
        return { ok: true };
      }
      case 'huatuo': {  // ถุงยาเขียว (青囊)
        const card = player.hand.find(c => c.id === payload.cardId);
        if (!card) return { ok: false, msg: 'เลือกไพ่ที่จะทิ้ง 1 ใบ' };
        const target = this.room.players.find(p => p.id === payload.targetId && p.hp > 0);
        if (!target) return { ok: false, msg: 'เลือกเป้าหมายที่จะรักษา' };
        if (target.hp >= target.maxHp) return { ok: false, msg: 'เป้าหมายพลังชีวิตเต็มแล้ว' };
        player.hand = player.hand.filter(c => c.id !== card.id);
        this.discardPile.push(card);
        target.hp = Math.min(target.maxHp, target.hp + 1);
        player.skillUsed.qingnang = true;
        this.addLog(player.username, `💚 ถุงยาเขียว — รักษา ${target.username} +1 พลังชีวิต`);
        break;
      }
      default: return { ok: false, msg: 'ยังไม่รองรับทักษะนี้' };
    }
    this.broadcast();
    return { ok: true };
  }

  // ─── เริ่มรอบของผู้เล่นปัจจุบัน (6 เฟสตามคู่มือ) ──────────────────────────────
  runTurn() {
    const players = this.room.players;
    const cur = players[this.currentPlayer];
    cur.attacksThisTurn = 0;
    cur.wined = false;
    cur.skillUsed = {};   // รีเซ็ตการใช้ทักษะ (แบบครั้งเดียวต่อตา) ของผู้เล่นคนนี้
    this.turn++;

    // 1) เตรียมรบ
    this.phase = 'start';
    // 2) เปิดการ์ดตัดสิน (Judgment) — เคราะห์สายฟ้า/เสพสุข (ฉบับย่อ: ข้าม)
    this.phase = 'judge';
    // 3) จั่วการ์ด — รอผู้เล่นกดจั่วเอง (ไฮไลท์ที่กองไพ่)
    this.phase = 'draw';
    this.awaitingDraw = true;
    this.addLog(cur.username, '🎴 ถึงเฟสจั่วการ์ด — กดที่กองไพ่เพื่อจั่ว 2 ใบ');
    this.startTimer();
    this.broadcast();
  }

  // ผู้เล่นกดจั่วการ์ดเอง (เฟสจั่ว) — auto=true เมื่อหมดเวลาแล้วจั่วให้อัตโนมัติ
  playerDraw(playerId, auto = false) {
    const players = this.room.players;
    const cur = players[this.currentPlayer];
    if (!auto) {
      if (cur.id !== playerId) return { ok: false, msg: 'ไม่ใช่ตาของคุณ' };
      if (this.phase !== 'draw' || !this.awaitingDraw) return { ok: false, msg: 'ยังไม่ถึงเฟสจั่วการ์ด' };
    }
    if (!this.awaitingDraw) return { ok: false, msg: 'จั่วการ์ดไปแล้ว' };
    this.awaitingDraw = false;
    const drawn = this.drawCards(2);
    cur.hand.push(...drawn);
    this.addLog(cur.username, `จั่วการ์ด 2 ใบ${auto ? ' (อัตโนมัติ)' : ''} (มือ ${cur.hand.length} ใบ)`);
    // 4) เล่นการ์ด — รอผู้เล่น (เริ่มจับเวลาใหม่สำหรับเฟสเล่น)
    this.phase = 'play';
    this.startTimer();
    this.broadcast();
    return { ok: true };
  }

  startTimer() {
    const limit = this.room.settings.turnTimer;
    if (!limit) { this.timer = null; return; }
    this.timer = limit;
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timer--;
      if (this.timer <= 0) {
        clearInterval(this.timerInterval);
        // ถ้ามีการตอบโต้ค้างอยู่ ให้ปล่อยผ่าน (ไม่หลบ);
        // ถ้ายังไม่จั่ว ให้จั่วอัตโนมัติแล้วเข้าเฟสเล่น; ไม่งั้นจบตา
        if (this.pending) this.resolveResponse(this.pending.responderId, null);
        else if (this.awaitingDraw) this.playerDraw(this.room.players[this.currentPlayer].id, true);
        else if (this.awaitingDiscard) this.autoDiscard();
        else this.endTurn(this.room.players[this.currentPlayer].id);
      }
      io.to(this.room.code).emit('timerTick', this.timer);
    }, 1000);
  }

  // ─── เล่นการ์ดในเฟสเล่นการ์ด ─────────────────────────────────────────────────
  playCard(playerId, cardId, targetId) {
    const players = this.room.players;
    const cur = players[this.currentPlayer];
    if (this.pending) return { ok: false, msg: 'กำลังรอการตอบโต้อยู่' };
    if (this.harvest) return { ok: false, msg: 'กำลังเก็บเกี่ยว — รอเลือกไพ่ให้ครบก่อน' };
    if (cur.id !== playerId) return { ok: false, msg: 'ไม่ใช่ตาของคุณ' };
    if (this.phase !== 'play') return { ok: false, msg: 'ยังไม่ถึงเฟสเล่นการ์ด' };

    const cardIdx = cur.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return { ok: false, msg: 'ไม่พบการ์ดในมือ' };

    const card = cur.hand[cardIdx];

    // ── ตรวจเงื่อนไขการเล่นการ์ด ──
    // Guan Yu passive: red cards bypass response-only restriction (will be treated as Attack)
    const isGuanyuRedPlay = CHAR_PASSIVES[cur.character]?.redAsAttack && card.color === 'red' && !!targetId;
    if (RESPONSE_ONLY_CARDS.includes(card.name) && !isGuanyuRedPlay)
      return { ok: false, msg: `การ์ด${card.name} ใช้สำหรับตอบโต้เท่านั้น เล่นเชิงรุกไม่ได้` };
    if (UNSUPPORTED_PLAY_CARDS.includes(card.name))
      return { ok: false, msg: `การ์ด${card.name} เป็นการ์ดหน่วงเวลา (ต้องมีเฟสตัดสิน) — ฉบับนี้ยังไม่รองรับ` };
    const target = players.find(p => p.id === targetId);

    const result = this.applyCard(cur, card, target);
    if (!result.ok) return result;

    // นำการ์ดออกจากมือ (อุปกรณ์เข้าช่อง, อื่นๆ เข้ากองทิ้ง)
    cur.hand.splice(cardIdx, 1);
    if (!['weapon','armor','mount'].includes(card.type)) {
      this.discardPile.push(card);
    }
    if (result.logMsg) this.addLog(cur.username, result.logMsg);
    // ─── Huang Yueying (黄月英) — Ji Zhi (集智): จั่ว 1 ใบหลังใช้การ์ดยุทธวิธี ───
    if (CHAR_PASSIVES[cur.character]?.jizhi && card.type === 'stratagem') {
      const drawn = this.drawCards(1);
      if (drawn.length) {
        cur.hand.push(...drawn);
        this.addLog(cur.username, `📘 [บ่มเพาะปัญญา/集智] ใช้การ์ดยุทธวิธี — จั่ว 1 ใบ`);
      }
    }
    this.broadcast();
    return { ok: true };
  }

  applyCard(from, card, target) {
    // ─── Guan Yu (关羽) passive: any red card = Attack ────────────────────────────
    if (CHAR_PASSIVES[from.character]?.redAsAttack && card.color === 'red' && target && card.name !== 'Attack') {
      if (target.id === from.id) return { ok: false, msg: 'โจมตีตัวเองไม่ได้' };
      if (target.hp <= 0) return { ok: false, msg: 'เป้าหมายถูกกำจัดแล้ว' };
      const _hasCrossbow = from.equipment?.weapon?.name === 'Zhuge Crossbow';
      const _unlimited = _hasCrossbow || !!CHAR_PASSIVES[from.character]?.unlimitedAttacks;
      if (from.attacksThisTurn >= 1 && !_unlimited) return { ok: false, msg: 'โจมตีได้เพียง 1 ครั้งต่อตา' };
      if (!this.inAttackRange(from, target)) return { ok: false, msg: `เป้าหมายอยู่นอกระยะโจมตี` };
      from.attacksThisTurn++;
      const _dmg = from.wined ? 2 : 1; from.wined = false;
      this.addLog(from.username, `⚔️ [กวนอู] ${card.name}(♥♦) → โจมตี ${target.username}${_dmg > 1 ? ' 🍶+1' : ''}`);
      this.requestResponse('dodge', target, from, 'Attack', { damage: _dmg, attackCardColor: card.color, dodgesNeeded: 1 });
      return { ok: true, logMsg: null };
    }

    switch (card.name) {
      case 'Attack': {
        if (!target) return { ok: false, msg: 'ต้องเลือกเป้าหมาย' };
        if (target.id === from.id) return { ok: false, msg: 'โจมตีตัวเองไม่ได้' };
        if (target.hp <= 0) return { ok: false, msg: 'เป้าหมายถูกกำจัดแล้ว' };
        const hasCrossbow = from.equipment?.weapon?.name === 'Zhuge Crossbow';
        const hasUnlimitedAttacks = hasCrossbow || !!CHAR_PASSIVES[from.character]?.unlimitedAttacks;
        if (from.attacksThisTurn >= 1 && !hasUnlimitedAttacks)
          return { ok: false, msg: 'โจมตีได้เพียง 1 ครั้งต่อตา' };
        if (!this.inAttackRange(from, target))
          return { ok: false, msg: `เป้าหมายอยู่นอกระยะโจมตี (ระยะ ${this.distance(from,target)} > ${this.attackRange(from)})` };
        from.attacksThisTurn++;
        const dmg = from.wined ? 2 : 1; from.wined = false;
        const dodgesNeeded = CHAR_PASSIVES[from.character]?.needsTwoDodge ? 2 : 1;
        this.addLog(from.username, `⚔️ โจมตี ${target.username}${dmg > 1 ? ' 🍶+1' : ''}${dodgesNeeded > 1 ? ' (ต้องหลบ 2 ครั้ง!)' : ''}`);
        this.requestResponse('dodge', target, from, 'Attack', { damage: dmg, attackCardColor: card.color, dodgesNeeded });
        return { ok: true, logMsg: null };
      }

      case 'Peach': {
        if (from.hp >= from.maxHp) return { ok: false, msg: 'พลังชีวิตเต็มแล้ว' };
        from.hp = Math.min(from.maxHp, from.hp + 1);
        return { ok: true, logMsg: `🍑 ใช้เพอชรักษาตัวเอง (+1 พลังชีวิต)` };
      }

      case 'Wine': {
        if (from.wined) return { ok: false, msg: 'ดื่มสุราไปแล้วในเทิร์นนี้' };
        from.wined = true;
        return { ok: true, logMsg: `🍶 ดื่มสุรา — การโจมตีครั้งถัดไปแรงขึ้น (+1 ความเสียหาย)` };
      }

      case 'Duel': {
        if (!target) return { ok: false, msg: 'ต้องเลือกเป้าหมาย' };
        if (target.id === from.id) return { ok: false, msg: 'ท้าดวลตัวเองไม่ได้' };
        // ฉบับย่อ: เป้าหมายต้องตอบด้วยการ์ดโจมตี มิฉะนั้นเสีย 1 พลังชีวิต
        this.addLog(from.username, `⚔️ ท้าดวล ${target.username}`);
        this.requestResponse('duel', target, from, 'Duel', { damage: 1 });
        return { ok: true, logMsg: null };
      }

      case 'Steal': {
        if (!target) return { ok: false, msg: 'ต้องเลือกเป้าหมาย' };
        if (target.id === from.id) return { ok: false, msg: 'เลือกตัวเองไม่ได้' };
        if (CHAR_PASSIVES[target.character]?.immuneToSteal)
          return { ok: false, msg: `${target.username} ไม่สามารถถูกขโมยได้ (ลู่ซุ่น: ศักดิ์ศรีแห่งน้ำ)` };
        if (!CHAR_PASSIVES[from.character]?.unlimitedTrickRange && this.distance(from, target) > 1)
          return { ok: false, msg: 'เป้าหมายต้องอยู่ในระยะ 1' };
        const loot = this.takeOneCard(target);
        if (!loot) return { ok: false, msg: 'เป้าหมายไม่มีการ์ด/อุปกรณ์' };
        from.hand.push(loot);
        return { ok: true, logMsg: `🃏 ขโมยการ์ดจาก ${target.username}` };
      }

      case 'Burning Bridges': {
        if (!target) return { ok: false, msg: 'ต้องเลือกเป้าหมาย' };
        if (target.id === from.id) return { ok: false, msg: 'เลือกตัวเองไม่ได้' };
        if (!CHAR_PASSIVES[from.character]?.unlimitedTrickRange && this.distance(from, target) > 1)
          return { ok: false, msg: 'เป้าหมายต้องอยู่ในระยะ 1' };
        const removed = this.takeOneCard(target);
        if (!removed) return { ok: false, msg: 'เป้าหมายไม่มีการ์ด/อุปกรณ์' };
        this.discardPile.push(removed);
        return { ok: true, logMsg: `🔥 ทำลายการ์ดของ ${target.username}` };
      }

      case 'Borrowed Sword': {
        if (!target) return { ok: false, msg: 'ต้องเลือกเป้าหมาย' };
        // ฉบับย่อ: ทำความเสียหาย 1 (ยืมดาบสังหาร)
        this.addLog(from.username, `🗡️ ยืมดาบโจมตี ${target.username}`);
        this.requestResponse('dodge', target, from, 'Borrowed Sword', { damage: 1 });
        return { ok: true, logMsg: null };
      }

      case 'Raining Arrows':
      case 'Barbarian Invasion': {
        // การ์ดกลแบบกระทบทุกคน — แต่ละคนต้องตอบโต้
        const need = card.name === 'Raining Arrows' ? 'dodge' : 'attack-resp';
        const victims = this.room.players.filter(p => p.id !== from.id && p.hp > 0);
        const label = card.name === 'Raining Arrows' ? '🏹 ฝนลูกธนูถล่มทุกคน' : '⚔️ บุกทะลวงอนารยชน';
        this.addLog(from.username, label);
        this.requestGroupResponse(need, victims, from, card.name, { damage: 1 });
        return { ok: true, logMsg: null };
      }

      case 'Bumper Harvest': {
        // เปิดไพ่จากกองตามจำนวนผู้เล่นที่ยังมีชีวิต แล้วผลัดกันเลือกเก็บคนละ 1 ใบ
        // เริ่มจากผู้ใช้ แล้วไล่ตามลำดับที่นั่ง
        const startIdx = this.room.players.indexOf(from);
        const order = [];
        for (let i = 0; i < this.room.players.length; i++) {
          const p = this.room.players[(startIdx + i) % this.room.players.length];
          if (p.hp > 0) order.push(p.id);
        }
        const revealed = this.drawCards(order.length);
        if (revealed.length === 0) {
          return { ok: true, logMsg: `🌾 เก็บเกี่ยวอุดมสมบูรณ์ — แต่กองไพ่หมด ไม่มีอะไรให้เก็บ` };
        }
        this.harvest = { revealed, order, idx: 0 };
        this.addLog(from.username, `🌾 เก็บเกี่ยวอุดมสมบูรณ์ — เปิดไพ่ ${revealed.length} ใบ ผลัดกันเลือกเก็บ`);
        this.promptHarvest();
        return { ok: true, logMsg: null };
      }

      case 'Oath of the Peach Garden': {
        this.room.players.filter(p => p.hp > 0 && p.hp < p.maxHp).forEach(p => {
          p.hp = Math.min(p.maxHp, p.hp + 1);
        });
        return { ok: true, logMsg: `🍑🌸 สาบานในสวนลูกพีช — ทุกคนรักษา 1 พลังชีวิต` };
      }

      case 'Something Out of Nothing': {
        from.hand.push(...this.drawCards(2));
        return { ok: true, logMsg: `✨ สร้างจากความว่างเปล่า — จั่ว 2 ใบ` };
      }

      default: {
        if (['weapon','armor','mount'].includes(card.type)) {
          const slot = card.type === 'mount'
            ? (card.effect?.includes('atk') ? 'atkMount' : 'defMount')
            : card.type;
          if (from.equipment[slot]) this.discardPile.push(from.equipment[slot]);
          from.equipment[slot] = card;
          const slotName = { weapon:'อาวุธ', armor:'เกราะ', atkMount:'ม้าโจมตี', defMount:'ม้าป้องกัน' }[slot];
          return { ok: true, logMsg: `⚙️ ติดตั้ง${slotName}: ${card.name}` };
        }
        return { ok: true, logMsg: `ใช้การ์ด ${card.name}` };
      }
    }
  }

  // หยิบ 1 ใบจากมือ (สุ่ม) หรืออุปกรณ์ของเป้าหมาย
  takeOneCard(target) {
    if (target.hand.length > 0) {
      return target.hand.splice(Math.floor(Math.random() * target.hand.length), 1)[0];
    }
    for (const slot of ['weapon','armor','atkMount','defMount']) {
      if (target.equipment[slot]) {
        const c = target.equipment[slot];
        target.equipment[slot] = null;
        return c;
      }
    }
    return null;
  }

  // ─── เก็บเกี่ยวอุดมสมบูรณ์ (五谷丰登) — ผลัดกันเลือกเก็บไพ่ที่เปิด ──────────────
  promptHarvest() {
    if (!this.harvest) return;
    clearInterval(this.harvestTimer);
    // ข้ามผู้เล่นที่ตายไปแล้ว / จบเมื่อไม่มีไพ่เหลือหรือเลือกครบทุกคน
    while (this.harvest.idx < this.harvest.order.length && this.harvest.revealed.length > 0) {
      const pid = this.harvest.order[this.harvest.idx];
      const player = this.room.players.find(p => p.id === pid);
      if (!player || player.hp <= 0) { this.harvest.idx++; continue; }
      // ถามผู้เล่นคนนี้ให้เลือกเก็บ 1 ใบ
      this.timer = 20;
      this.harvestTimer = setInterval(() => {
        this.timer--;
        io.to(this.room.code).emit('timerTick', this.timer);
        if (this.timer <= 0) { clearInterval(this.harvestTimer); this.autoHarvestPick(); }
      }, 1000);
      const sock = io.sockets.sockets.get(player.socketId);
      if (sock) sock.emit('askHarvest', {});
      this.broadcast();
      return;
    }
    this.finishHarvest();
  }

  harvestPick(playerId, cardId) {
    if (!this.harvest) return { ok: false, msg: 'ตอนนี้ไม่มีการเก็บเกี่ยว' };
    if (this.harvest.order[this.harvest.idx] !== playerId) return { ok: false, msg: 'ยังไม่ถึงตาคุณเลือก' };
    const ci = this.harvest.revealed.findIndex(c => c.id === cardId);
    if (ci < 0) return { ok: false, msg: 'การ์ดนั้นถูกเลือกไปแล้ว' };
    const player = this.room.players.find(p => p.id === playerId);
    const picked = this.harvest.revealed.splice(ci, 1)[0];
    player.hand.push(picked);
    this.addLog(player.username, `🌾 เลือกเก็บ ${picked.name}`);
    clearInterval(this.harvestTimer);
    this.harvest.idx++;
    this.promptHarvest();
    return { ok: true };
  }

  // หมดเวลา → เลือกใบแรกที่เหลืออัตโนมัติ
  autoHarvestPick() {
    if (!this.harvest || this.harvest.revealed.length === 0) return this.finishHarvest();
    const pid = this.harvest.order[this.harvest.idx];
    const player = this.room.players.find(p => p.id === pid);
    if (player && player.hp > 0) {
      const picked = this.harvest.revealed.shift();
      player.hand.push(picked);
      this.addLog(player.username, `🌾 เลือกเก็บ ${picked.name} (อัตโนมัติ — หมดเวลา)`);
    }
    this.harvest.idx++;
    this.promptHarvest();
  }

  finishHarvest() {
    clearInterval(this.harvestTimer);
    if (this.harvest && this.harvest.revealed.length > 0) {
      this.harvest.revealed.forEach(c => this.discardPile.push(c));
    }
    this.harvest = null;
    // กลับสู่เฟสเล่นของผู้เล่นปัจจุบัน — เริ่มจับเวลาเล่นใหม่
    if (this.phase === 'play') this.startTimer();
    this.broadcast();
  }

  // ─── ระบบตอบโต้ (หลบหลีก / โต้ดวล) ──────────────────────────────────────────
  requestResponse(type, responder, source, cardName, payload = {}) {
    this.pending = { type, responderId: responder.id, sourceId: source.id, cardName, payload };
    clearInterval(this.timerInterval);
    this.timer = 20;
    this.respTimer = setInterval(() => {
      this.timer--;
      io.to(this.room.code).emit('timerTick', this.timer);
      if (this.timer <= 0) {
        clearInterval(this.respTimer);
        this.resolveResponse(responder.id, null);
      }
    }, 1000);

    // ── เช็คเกราะ passive ก่อนถามผู้เล่น ──
    if (type === 'dodge') {
      // Nio Shield (仁王盾): บล็อกการโจมตีสีดำอัตโนมัติ
      if (responder.equipment?.armor?.name === 'Nio Shield' && payload.attackCardColor === 'black') {
        this.addLog(responder.username, '🛡️ [ยันต์สวรรค์/仁王盾] บล็อกโจมตีสีดำอัตโนมัติ!');
        return this.resolveResponse(responder.id, null, true);
      }
      // Eight Trigrams Formation (八卦阵): เปิดไพ่หน้าดาดฟ้า
      if (responder.equipment?.armor?.name === 'Eight Trigrams Formation') {
        const topCard = this.drawCards(1)[0];
        if (topCard) {
          this.discardPile.push(topCard);
          if (topCard.color === 'red') {
            this.addLog(responder.username, `🔮 [八卦阵] กลับ ${topCard.name}(แดง) — หลบอัตโนมัติ!`);
            return this.resolveResponse(responder.id, null, true);
          }
          this.addLog(responder.username, `🔮 [八卦阵] กลับ ${topCard.name}(ดำ) — ต้องเล่นการ์ดหลบเอง`);
        }
      }
    }

    // บอก client ว่าการ์ดประเภทไหนอีกที่ใช้ตอบโต้ได้ (passive ตัวละคร)
    const alsoAccept = [];
    if (type === 'dodge') {
      if (CHAR_PASSIVES[responder.character]?.attackAsDodge) alsoAccept.push('Attack');
      if (CHAR_PASSIVES[responder.character]?.blackAsDodge) alsoAccept.push('_black');
    } else if (type === 'duel') {
      if (CHAR_PASSIVES[responder.character]?.dodgeAsAttack) alsoAccept.push('Dodge');
    }

    const need = type === 'duel' ? 'Attack' : 'Dodge';
    const sock = io.sockets.sockets.get(responder.socketId);
    if (sock) sock.emit('awaitResponse', {
      type, need, cardName, alsoAccept,
      dodgesNeeded: payload.dodgesNeeded || 1,
      from: source.username,
      msg: type === 'duel'
        ? `${source.username} ท้าดวลคุณ! เล่นการ์ดโจมตี หรือเสีย 1 พลังชีวิต`
        : `${source.username} ใช้ ${cardName} ใส่คุณ! เล่นการ์ดหลบหลีก หรือรับความเสียหาย`,
    });
    this.broadcast();
  }

  // เวอร์ชันกระทบหลายคน — เก็บคิวแล้วถามทีละคน
  requestGroupResponse(type, victims, source, cardName, payload) {
    this.groupQueue = victims.map(v => v.id);
    this.groupType = type === 'attack-resp' ? 'duel' : 'dodge';
    this.groupSource = source.id;
    this.groupCard = cardName;
    this.groupPayload = payload;
    this.nextGroupResponse();
  }

  nextGroupResponse() {
    if (!this.groupQueue || this.groupQueue.length === 0) {
      this.groupQueue = null;
      this.groupSource = null;
      this.groupCard = null;
      this.groupPayload = null;
      if (this.room.state !== 'ended') {
        this.phase = 'play';
        this.startTimer();
        this.broadcast();
      }
      return;
    }
    const vid = this.groupQueue.shift();
    const victim = this.room.players.find(p => p.id === vid);
    const source = this.room.players.find(p => p.id === this.groupSource);
    if (!victim || victim.hp <= 0) return this.nextGroupResponse();
    this.requestResponse(this.groupType, victim, source, this.groupCard, this.groupPayload);
  }

  resolveResponse(responderId, cardId, autoDefend = false) {
    if (!this.pending || this.pending.responderId !== responderId) return { ok: false, msg: 'ไม่มีการตอบโต้ที่รออยู่' };
    clearInterval(this.respTimer);

    const responder = this.room.players.find(p => p.id === responderId);
    const source = this.room.players.find(p => p.id === this.pending.sourceId);
    const { type, payload, cardName } = this.pending;
    const dodgesNeeded = payload.dodgesNeeded || 1;

    let defended = autoDefend;
    if (!autoDefend && cardId) {
      const idx = responder.hand.findIndex(c => c.id === cardId);
      if (idx >= 0) {
        const card = responder.hand[idx];
        let cardCounts = false;
        if (type === 'dodge') {
          cardCounts = card.name === 'Dodge'
            || (CHAR_PASSIVES[responder.character]?.attackAsDodge && card.name === 'Attack')
            || (CHAR_PASSIVES[responder.character]?.blackAsDodge && card.color === 'black');
        } else if (type === 'duel') {
          cardCounts = card.name === 'Attack'
            || (CHAR_PASSIVES[responder.character]?.dodgeAsAttack && card.name === 'Dodge');
        }
        if (cardCounts) {
          const used = responder.hand.splice(idx, 1)[0];
          this.discardPile.push(used);
          defended = true;
          this.addLog(responder.username, type === 'duel' ? `⚔️ โต้ดวล (${used.name})` : `🛡️ หลบหลีกสำเร็จ (${used.name})`);
        }
      }
    }

    this.pending = null;

    if (type === 'duel') {
      if (defended) {
        // สลับตัว: source ต้องเล่นโจมตีตอบกลับ — โดยไม่จำกัดรอบ
        this.addLog(source.username, `↩️ ${responder.username} โต้! ตอนนี้ ${source.username} ต้องโจมตี`);
        this.requestResponse('duel', source, responder, 'Duel', { damage: payload.damage });
        return { ok: true };
      }
      this.dealDamage(responder, payload.damage, source);
    } else {
      if (!defended) {
        this.addLog(responder.username, '💢 ไม่ได้หลบ — รับความเสียหาย');
        // Kirin Bow (麒麟弓): เมื่อโจมตีโดน ทำลายม้าของเป้าหมาย
        if (source?.equipment?.weapon?.name === 'Kirin Bow') {
          const mountSlot = responder.equipment?.atkMount ? 'atkMount' : (responder.equipment?.defMount ? 'defMount' : null);
          if (mountSlot) {
            const mount = responder.equipment[mountSlot];
            responder.equipment[mountSlot] = null;
            this.discardPile.push(mount);
            this.addLog(source.username, `🏹 [Kirin Bow] ทำลายม้าของ ${responder.username}: ${mount.name}`);
          }
        }
        this.dealDamage(responder, payload.damage, source);
      } else if (dodgesNeeded > 1) {
        // Lv Bu (吕布): ต้องหลบ 2 ครั้ง
        this.addLog(responder.username, `🛡️ หลบ 1/${dodgesNeeded} — ต้องหลบอีก ${dodgesNeeded - 1} ครั้ง`);
        this.requestResponse('dodge', responder, source, cardName, { ...payload, dodgesNeeded: dodgesNeeded - 1 });
        return { ok: true };
      }
    }

    // ดำเนินเกมต่อ
    if (this.groupQueue) {
      this.nextGroupResponse();
    } else if (this.room.state !== 'ended') {
      this.phase = 'play';
      this.startTimer();
      this.broadcast();
    }
    return { ok: true };
  }

  // ─── ทำความเสียหาย + ตรวจการตาย ─────────────────────────────────────────────
  dealDamage(player, amount, source) {
    player.hp -= amount;
    this.addLog('ระบบ', `💔 ${player.username} เสีย ${amount} พลังชีวิต (เหลือ ${Math.max(0,player.hp)})`);
    if (player.hp <= 0) this.enterDying(player, source);
    this.broadcast();
  }

  // เข้าสู่สภาวะใกล้ตาย — เปิดให้ใช้เพอชช่วย
  enterDying(player, source) {
    player.hp = 0;
    this.addLog('ระบบ', `⚠️ ${player.username} ใกล้ตาย! ใครก็ได้ใช้เพอชช่วยได้`);
    // ฉบับย่อแบบเรียลไทม์: ตรวจอัตโนมัติว่ามีใครอยากใช้เพอชไหม ผ่านหน้าต่างคำขอ
    // เพื่อความเรียบง่ายและไม่ค้างเกม: ผู้เล่นที่ใกล้ตายใช้เพอชเองอัตโนมัติถ้ามี
    const peachIdx = player.hand.findIndex(c => c.name === 'Peach');
    if (peachIdx >= 0) {
      const sock = io.sockets.sockets.get(player.socketId);
      if (sock) sock.emit('askPeach', { msg: 'คุณใกล้ตาย! ใช้เพอชเพื่อรอดหรือไม่?' });
      // ตั้งสถานะ dying ให้ client เลือก
      this.dyingPlayerId = player.id;
      return;
    }
    this.killPlayer(player, source);
  }

  usePeachToSave(playerId, cardId) {
    const player = this.room.players.find(p => p.id === playerId);
    if (!player || this.dyingPlayerId !== playerId) return { ok: false };
    const idx = player.hand.findIndex(c => c.id === cardId && c.name === 'Peach');
    if (idx < 0) return { ok: false, msg: 'ไม่มีเพอช' };
    player.hand.splice(idx, 1).forEach(c => this.discardPile.push(c));
    player.hp = 1;
    this.dyingPlayerId = null;
    this.addLog(player.username, '🍑 ใช้เพอชรอดตายอย่างหวุดหวิด!');
    this.broadcast();
    return { ok: true };
  }

  declinePeach(playerId) {
    const player = this.room.players.find(p => p.id === playerId);
    if (!player || this.dyingPlayerId !== playerId) return;
    this.dyingPlayerId = null;
    this.killPlayer(player, null);
    this.broadcast();
  }

  killPlayer(player, source) {
    player.hp = 0;
    player.dead = true;
    this.addLog('ระบบ', `💀 ${player.username} (${this.revealRole(player)}) ถูกกำจัด!`);
    // ทิ้งการ์ดทั้งหมด
    player.hand.forEach(c => this.discardPile.push(c));
    player.hand = [];
    Object.keys(player.equipment).forEach(s => {
      if (player.equipment[s]) { this.discardPile.push(player.equipment[s]); player.equipment[s] = null; }
    });
    // รางวัล/บทลงโทษผู้สังหารกบฎ (ตามคู่มือ)
    if (source && player.role === 'Rebel') {
      source.hand.push(...this.drawCards(3));
      this.addLog(source.username, '🎁 สังหารกบฎ — จั่วเพิ่ม 3 ใบ');
    }
    if (source && player.role === 'Loyalist' && source.role === 'Lord') {
      // จักรพรรดิสังหารผู้ภักดี — ทิ้งการ์ดทั้งหมด
      source.hand.forEach(c => this.discardPile.push(c));
      source.hand = [];
      Object.keys(source.equipment).forEach(s => {
        if (source.equipment[s]) { this.discardPile.push(source.equipment[s]); source.equipment[s] = null; }
      });
      this.addLog(source.username, '⚖️ จักรพรรดิสังหารผู้ภักดี — ถูกริบการ์ดทั้งหมด');
    }
    this.checkWinCondition();
  }

  revealRole(player) {
    return { Lord:'จักรพรรดิ', Loyalist:'ผู้ภักดี', Rebel:'กบฎ', Spy:'ทรยศ' }[player.role] || player.role;
  }

  // ─── เงื่อนไขชนะ (ตามคู่มือ) ──────────────────────────────────────────────────
  //  จักรพรรดิ+ภักดี: กำจัดกบฎและทรยศทั้งหมด
  //  กบฎ: สังหารจักรพรรดิ
  //  ทรยศ: เป็นผู้รอดชีวิตคนสุดท้ายเพียงคนเดียว
  checkWinCondition() {
    const players = this.room.players;
    const alive = players.filter(p => p.hp > 0);
    const lord = players.find(p => p.role === 'Lord');
    const rebelsAlive = alive.filter(p => p.role === 'Rebel');
    const spyAlive = alive.filter(p => p.role === 'Spy');

    // จักรพรรดิตาย
    if (lord && lord.hp <= 0) {
      const survivorsExclLord = alive.filter(p => p.role !== 'Lord');
      // ทรยศชนะถ้าเหลือทรยศคนเดียวรอด
      if (survivorsExclLord.length === 1 && survivorsExclLord[0].role === 'Spy') {
        this.endGame('Spy', `🕵️ ${survivorsExclLord[0].username} (ทรยศ) เป็นผู้รอดคนสุดท้าย — ชนะ!`);
      } else {
        this.endGame('Rebel', '⚔️ กบฎชนะ! จักรพรรดิถูกโค่นล้ม!');
      }
      return;
    }
    // กบฎและทรยศถูกกำจัดหมด → จักรพรรดิและผู้ภักดีชนะ
    if (rebelsAlive.length === 0 && spyAlive.length === 0) {
      this.endGame('Lord', '👑 จักรพรรดิและเหล่าผู้ภักดีชนะ! แผ่นดินสงบสุข!');
    }
  }

  endGame(winner, msg) {
    clearInterval(this.timerInterval);
    this.phase = 'ended';
    this.room.state = 'ended';
    this.addLog('ระบบ', msg);
    io.to(this.room.code).emit('gameEnded', { winner, msg });
  }

  endTurn(playerId) {
    const players = this.room.players;
    const cur = players[this.currentPlayer];
    if (cur.id !== playerId && playerId !== '__timeout__') return;
    if (this.pending || this.dyingPlayerId) return; // ห้ามจบตาระหว่างรอตอบโต้
    if (this.harvest) return; // กำลังเก็บเกี่ยวอยู่
    if (this.awaitingDraw) return; // ต้องจั่วการ์ดก่อนจึงจบตาได้
    if (this.awaitingDiscard) return; // กำลังรอเลือกทิ้งการ์ดอยู่
    clearInterval(this.timerInterval);

    // 5) เฟสทิ้งการ์ด — เก็บการ์ดได้ไม่เกินพลังชีวิตปัจจุบัน (ตามคู่มือ)
    const handLimit = Math.max(0, cur.hp);
    const need = cur.hand.length - handLimit;
    if (need > 0) {
      // ให้ผู้เล่นเลือกการ์ดที่จะทิ้งเอง (ไม่สุ่ม) — รอการตอบกลับก่อนจบตา
      this.phase = 'discard';
      this.awaitingDiscard = { playerId: cur.id, need };
      this.addLog(cur.username, `ต้องทิ้งการ์ด ${need} ใบ (เก็บได้ ${handLimit} = พลังชีวิต) — เลือกใบที่จะทิ้ง`);
      const sock = io.sockets.sockets.get(cur.socketId);
      if (sock) sock.emit('askDiscard', { need, handLimit });
      this.startTimer();
      this.broadcast();
      return;
    }
    this.finishTurn();
  }

  // ผู้เล่นเลือกการ์ดที่จะทิ้งเองตอนจบตา
  discardCards(playerId, cardIds) {
    if (!this.awaitingDiscard || this.awaitingDiscard.playerId !== playerId) {
      return { ok: false, msg: 'ตอนนี้ไม่ต้องทิ้งการ์ด' };
    }
    const player = this.room.players.find(p => p.id === playerId);
    if (!player) return { ok: false, msg: 'ไม่พบผู้เล่น' };
    const need = this.awaitingDiscard.need;
    const ids = [...new Set(cardIds || [])];
    if (ids.length !== need) return { ok: false, msg: `ต้องเลือกทิ้งให้ครบ ${need} ใบ` };
    const toDiscard = ids.map(id => player.hand.find(c => c.id === id)).filter(Boolean);
    if (toDiscard.length !== need) return { ok: false, msg: 'มีการ์ดที่ไม่ได้อยู่ในมือ' };
    toDiscard.forEach(c => {
      player.hand.splice(player.hand.indexOf(c), 1);
      this.discardPile.push(c);
    });
    this.addLog(player.username, `ทิ้งการ์ด ${need} ใบ`);
    this.awaitingDiscard = null;
    this.finishTurn();
    return { ok: true };
  }

  // ทิ้งให้อัตโนมัติเมื่อหมดเวลา (สุ่มจากท้ายมือ) — ใช้เฉพาะกรณีไม่ตอบในเวลา
  autoDiscard() {
    if (!this.awaitingDiscard) return;
    const player = this.room.players.find(p => p.id === this.awaitingDiscard.playerId);
    if (!player) { this.awaitingDiscard = null; return this.finishTurn(); }
    const need = this.awaitingDiscard.need;
    let discarded = 0;
    while (discarded < need && player.hand.length > 0) {
      this.discardPile.push(player.hand.pop());
      discarded++;
    }
    if (discarded > 0) this.addLog(player.username, `ทิ้งการ์ด ${discarded} ใบ (อัตโนมัติ — หมดเวลา)`);
    this.awaitingDiscard = null;
    this.finishTurn();
  }

  // เฟสสิ้นสุด + ส่งตาให้ผู้เล่นคนถัดไปที่ยังมีชีวิต
  finishTurn() {
    const players = this.room.players;
    const cur = players[this.currentPlayer];
    this.phase = 'end';
    this.addLog(cur.username, `จบตา (เหลือไพ่ ${cur.hand.length} ใบ)`);

    let next = (this.currentPlayer + 1) % players.length;
    let tries = 0;
    while (players[next].hp <= 0 && tries < players.length) {
      next = (next + 1) % players.length;
      tries++;
    }
    this.currentPlayer = next;
    if (this.room.state !== 'ended') this.runTurn();
  }
}

// ─── ส่งสถานะห้องให้ผู้เล่นทุกคน (เฉพาะตัว) + ผู้ชม ─────────────────────────────
function broadcastRoom(room) {
  room.players.forEach(p => {
    const sock = io.sockets.sockets.get(p.socketId);
    if (sock) sock.emit('roomUpdate', room.publicState(p.id));
  });
  room.spectators.forEach(sid => {
    const sock = io.sockets.sockets.get(sid);
    if (sock) sock.emit('roomUpdate', room.publicState(null));
  });
}

// ─── ออกจากห้อง (ลบผู้เล่น + โอน Host + ลบห้องว่าง) ──────────────────────────────
function leaveRoom(roomCode, playerId) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const leaving = room.findPlayer(playerId);
  if (!leaving) return;
  const wasHost = room.hostId === playerId;

  // ระหว่างเล่นอยู่: ทำเครื่องหมายตัดการเชื่อมต่อ (เก็บไว้เพื่อ reconnect) ไม่ลบทิ้ง
  if (room.state === 'playing') {
    leaving.connected = false;
    io.to(roomCode).emit('playerDisconnected', { username: leaving.username });
    broadcastRoom(room);
    return;
  }

  // อยู่ในล็อบบี้: ลบออกจริง
  room.removePlayer(playerId);

  if (room.players.length === 0) {
    rooms.delete(roomCode);   // ห้องว่าง → ลบทิ้ง
    return;
  }
  // โอน Host ให้ผู้เล่นคนแรกที่เหลือ
  if (wasHost) {
    room.hostId = room.players[0].id;
    io.to(roomCode).emit('chatMessage', {
      from: 'ระบบ',
      message: `👑 ${room.players[0].username} กลายเป็น Host คนใหม่`,
      time: Date.now(),
    });
  }
  broadcastRoom(room);
}

// เคลียร์สมาชิกเดิมก่อนเข้าห้องใหม่ (กันผู้เล่นค้าง/ghost)
function detachSocket(socketId) {
  const info = sockets.get(socketId);
  if (info) {
    const sock = io.sockets.sockets.get(socketId);
    if (sock) sock.leave(info.roomCode);
    leaveRoom(info.roomCode, info.playerId);
    sockets.delete(socketId);
  }
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} connected`);

  socket.on('createRoom', ({ username, settings }) => {
    detachSocket(socket.id);  // ออกจากห้องเดิมก่อน (กัน ghost)
    if (!username || !username.trim()) return socket.emit('error', 'กรุณาใส่ชื่อผู้เล่น');
    const playerId = genPlayerId();
    const room = new Room(playerId, {
      roomName: settings.roomName || 'ห้องของ ' + username,
      password: settings.password || '',
      playerLimit: Math.min(10, Math.max(2, settings.playerLimit || 4)),
      turnTimer: settings.turnTimer != null ? Number(settings.turnTimer) : 60,
      allowSpectators: settings.allowSpectators !== false,
      privateRoom: !!settings.privateRoom,
      voiceChat: !!settings.voiceChat,
      textChat: settings.textChat !== false,
    });
    room.addPlayer(playerId, socket.id, username);
    rooms.set(room.code, room);
    sockets.set(socket.id, { playerId, roomCode: room.code, username });

    socket.join(room.code);
    socket.emit('roomCreated', { roomCode: room.code, playerId });
    socket.emit('roomUpdate', room.publicState(playerId));
  });

  socket.on('joinRoom', ({ roomCode, username, password, playerId: existingId }) => {
    if (!roomCode) return socket.emit('error', 'กรุณาใส่รหัสห้อง');
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return socket.emit('error', 'ไม่พบห้องนี้');

    // Reconnect — เข้าก่อนตรวจรหัสผ่าน/ห้องเต็ม
    const existing = existingId && room.findPlayer(existingId);
    if (existing) {
      existing.socketId = socket.id;
      existing.connected = true;
      sockets.set(socket.id, { playerId: existing.id, roomCode: room.code, username: existing.username });
      socket.join(room.code);
      socket.emit('joinedRoom', { playerId: existing.id });
      broadcastRoom(room);
      io.to(room.code).emit('playerReconnected', { username: existing.username });
      return;
    }

    if (!username || !username.trim()) return socket.emit('error', 'กรุณาใส่ชื่อผู้เล่น');
    if (room.settings.password && room.settings.password !== password)
      return socket.emit('error', 'รหัสผ่านไม่ถูกต้อง');
    if (room.state !== 'lobby') return socket.emit('error', 'เกมเริ่มไปแล้ว ไม่สามารถเข้าร่วมได้');
    if (room.players.length >= room.settings.playerLimit) return socket.emit('error', 'ห้องเต็มแล้ว');

    detachSocket(socket.id);  // ออกจากห้องเดิมก่อน (กัน ghost)
    const playerId = genPlayerId();
    room.addPlayer(playerId, socket.id, username.trim());
    sockets.set(socket.id, { playerId, roomCode: room.code, username: username.trim() });

    socket.join(room.code);
    socket.emit('joinedRoom', { playerId });
    io.to(room.code).emit('playerJoined', { username: username.trim() });
    broadcastRoom(room);
  });

  socket.on('leaveRoom', () => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const sock = io.sockets.sockets.get(socket.id);
    if (sock) sock.leave(info.roomCode);
    leaveRoom(info.roomCode, info.playerId);
    sockets.delete(socket.id);
  });

  socket.on('spectateRoom', ({ roomCode }) => {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return socket.emit('error', 'ไม่พบห้อง');
    if (!room.settings.allowSpectators) return socket.emit('error', 'ห้องนี้ไม่อนุญาตผู้ชม');
    room.spectators.push(socket.id);
    socket.join(roomCode);
    socket.emit('spectating', { roomCode });
    socket.emit('roomUpdate', room.publicState(null));
  });

  socket.on('setReady', ({ ready }) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room) return;
    const player = room.findPlayer(info.playerId);
    if (!player) return;
    player.ready = ready;
    broadcastRoom(room);
  });

  socket.on('selectCharacter', ({ characterId }) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || room.state !== 'selecting') return;
    const result = room.draftPick(info.playerId, characterId);
    if (!result.ok) return socket.emit('error', result.msg);
    // ถ้าเลือกครบแล้ว finishDraft จะ emit gameStarted ให้เอง
    if (room.state === 'selecting') broadcastRoom(room);
  });

  socket.on('startGame', () => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room) return;
    if (room.hostId !== info.playerId) return socket.emit('error', 'เฉพาะ Host เท่านั้น');
    if (room.state !== 'lobby') return socket.emit('error', 'เกมเริ่มไปแล้ว');
    if (room.players.length < 2) return socket.emit('error', 'ต้องมีผู้เล่นอย่างน้อย 2 คน');
    if (!room.players.every(p => p.ready)) return socket.emit('error', 'ผู้เล่นบางคนยังไม่พร้อม');

    // สุ่มโรลก่อน แล้วเข้าสู่ขั้นตอนเลือกตัวละคร (จักรพรรดิเลือกก่อน)
    room.startDraft();
    broadcastRoom(room);
  });

  socket.on('playCard', ({ cardId, targetId }) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    const result = room.game.playCard(info.playerId, cardId, targetId);
    if (!result.ok) return socket.emit('error', result.msg);
    // Game.playCard เรียก broadcast() ให้แล้ว
  });

  // ใช้ทักษะสั่งใช้ของตัวละคร
  socket.on('useSkill', ({ payload }) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    const result = room.game.useSkill(info.playerId, payload || {});
    if (!result.ok) return socket.emit('error', result.msg);
  });

  // ตอบโต้: เล่นการ์ดหลบหลีก/โจมตี เพื่อตอบสนอง (หรือไม่ตอบโต้ถ้า cardId = null)
  socket.on('respondCard', ({ cardId }) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    const result = room.game.resolveResponse(info.playerId, cardId);
    if (result && !result.ok && result.msg) socket.emit('error', result.msg);
  });

  // ใช้เพอชช่วยตัวเองตอนใกล้ตาย
  socket.on('usePeach', ({ cardId }) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    const result = room.game.usePeachToSave(info.playerId, cardId);
    if (result && !result.ok && result.msg) socket.emit('error', result.msg);
  });

  // ปฏิเสธการใช้เพอช (ยอมตาย)
  socket.on('declinePeach', () => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    room.game.declinePeach(info.playerId);
  });

  // ผู้เล่นกดจั่วการ์ดเอง (เฟสจั่ว)
  socket.on('drawCards', () => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    const result = room.game.playerDraw(info.playerId);
    if (result && !result.ok && result.msg) socket.emit('error', result.msg);
  });

  socket.on('endTurn', () => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    room.game.endTurn(info.playerId);
  });

  // ผู้เล่นเลือกการ์ดที่จะทิ้งเองตอนจบตา (เกินลิมิตมือ)
  socket.on('discardCards', ({ cardIds }) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    const result = room.game.discardCards(info.playerId, cardIds || []);
    if (result && !result.ok && result.msg) socket.emit('error', result.msg);
  });

  // เก็บเกี่ยวอุดมสมบูรณ์: เลือกเก็บไพ่ที่เปิด 1 ใบ
  socket.on('harvestPick', ({ cardId }) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    const result = room.game.harvestPick(info.playerId, cardId);
    if (result && !result.ok && result.msg) socket.emit('error', result.msg);
  });

  socket.on('sendChat', ({ message }) => {
    const info = sockets.get(socket.id);
    if (!info || !message?.trim()) return;
    io.to(info.roomCode).emit('chatMessage', {
      from: info.username,
      message: message.trim().slice(0, 200),
      time: Date.now(),
    });
  });

  socket.on('kickPlayer', ({ targetId }) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || room.hostId !== info.playerId) return;
    const target = room.findPlayer(targetId);
    if (!target) return;
    const targetSock = io.sockets.sockets.get(target.socketId);
    if (targetSock) {
      targetSock.emit('kicked', { reason: 'ถูก Host เตะออกจากห้อง' });
      targetSock.leave(info.roomCode);
      sockets.delete(target.socketId);
    }
    room.removePlayer(targetId);
    broadcastRoom(room);
  });

  socket.on('disconnect', () => {
    const info = sockets.get(socket.id);
    sockets.delete(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room) return;
    const player = room.findPlayer(info.playerId);
    if (!player) return;
    player.connected = false;

    if (room.state === 'lobby') {
      // ในล็อบบี้: ให้เวลา reconnect 25 วินาที แล้วค่อยลบ + โอน Host
      setTimeout(() => {
        const r = rooms.get(info.roomCode);
        if (!r) return;
        const p = r.findPlayer(info.playerId);
        if (p && !p.connected) leaveRoom(info.roomCode, info.playerId);
      }, 25000);
    } else {
      // ระหว่างเล่น: คงผู้เล่นไว้เพื่อ reconnect, แจ้งคนอื่น
      io.to(info.roomCode).emit('playerDisconnected', { username: player.username });
      broadcastRoom(room);
    }
    console.log(`[-] ${socket.id} disconnected`);
  });
});

// ─── Public Room List ─────────────────────────────────────────────────────────
app.get('/api/rooms', (_, res) => {
  const list = [];
  rooms.forEach(room => {
    if (!room.settings.privateRoom && room.state === 'lobby') {
      list.push({
        code: room.code,
        name: room.settings.roomName,
        players: room.players.length,
        limit: room.settings.playerLimit,
        hasPassword: !!room.settings.password,
        state: room.state,
      });
    }
  });
  res.json(list);
});

const PORT = process.env.PORT || 3000;
// bind 0.0.0.0 เพื่อให้เข้าถึงได้จากภายนอก (คลาวด์/LAN)
// รันเฉพาะเมื่อเรียกไฟล์นี้ตรงๆ — ถ้าถูก require (เช่น เทส) จะไม่เปิดพอร์ต
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎮 War of the Three Friend Server`);
    console.log(`🌐 http://localhost:${PORT}\n`);
  });
}

module.exports = { Room, Game, CARD_TEMPLATES, CHARACTERS, CHAR_PASSIVES, ACTIVE_SKILLS };

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Static files
// ไม่แคชไฟล์โค้ด/หน้าเว็บ (html/js/css) — ให้เบราว์เซอร์ดึงไฟล์ใหม่ทุกครั้งที่รีโหลด
// กันปัญหา game.js เวอร์ชันเก่าค้างในแคช (เช่น จำนวนการ์ดในคลังข้อมูลไม่อัปเดต)
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  setHeaders: (res, filePath) => {
    if (/\.(html|js|css)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
  },
}));
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

// เพศของตัวละคร — ใช้กับเอฟเฟค "ดาบหยินหยาง" (โจมตีเพศตรงข้าม) และทักษะที่ระบุเพศ
const FEMALE_CHARACTERS = ['zhenji', 'ladygan', 'huangyy', 'sunss', 'daqiao', 'diaochan'];
function genderOf(charId) { return FEMALE_CHARACTERS.includes(charId) ? 'F' : 'M'; }
function kingdomOf(charId) { return (CHARACTERS.find(c => c.id === charId) || {}).kingdom || null; }

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
  liubei:   { key: 'rende',    name: 'เมตตาธรรม (仁德)',  needs: 'cards+target', oncePerTurn: false,
              desc: 'มอบการ์ดในมือจำนวนเท่าใดก็ได้ให้ตัวละครอื่น — ฟื้น HP 1 หน่วยถ้ามอบรวม 2 ใบขึ้นไปในตานี้ (ครั้งเดียว)' },
  ladygan:  { key: 'shushen',  name: 'ปัญญาประเสริฐ (淑慎)', needs: 'confirm', oncePerTurn: true,
              desc: 'ทิ้งการ์ดในมือทั้งหมด — ฟื้น HP 1 หน่วยถ้าจำนวนที่ทิ้งมากกว่า HP ปัจจุบัน' },
  sunss:    { key: 'jieyin',   name: 'การสมรส (结姻)',   needs: 'cards+target', oncePerTurn: true,
              desc: 'ทิ้งการ์ด 2 ใบจากมือ เลือกตัวละครชายที่บาดเจ็บ — ทั้งคุณและเขาฟื้น HP 1 หน่วย' },
  diaochan: { key: 'lijian',   name: 'เสน่ห์มารยา (离间)',  needs: 'card+target2', oncePerTurn: true,
              desc: 'ทิ้งการ์ด 1 ใบ เลือกตัวละครชาย 2 คนให้ประลองกัน (ยกเลิกด้วย [ขัดขวาง] ไม่ได้)' },
  zhouyu:   { key: 'fanjian',  name: 'หว่านเมล็ดหวาดระแวง (反间)', needs: 'target', oncePerTurn: true,
              desc: 'เลือกตัวละคร ให้เขาทายชนิดไพ่ (suit) แล้วจั่วไพ่ 1 ใบจากมือคุณเปิดเผย — ถ้าชนิดไม่ตรงรับ 1 ดาเมจ (เก็บไพ่ไว้เสมอ)' },
};

// การ์ดที่ใช้ "ตอบโต้" เท่านั้น — ห้ามเล่นเชิงรุกในเฟสเล่นการ์ด
const RESPONSE_ONLY_CARDS = ['Dodge', 'Negation'];
// การ์ดกลหน่วงเวลา (วางในช่องตัดสิน — รองรับแล้วผ่านเฟสตัดสิน) — ไม่มีการ์ดที่เล่นไม่ได้แล้ว
const UNSUPPORTED_PLAY_CARDS = [];
// การ์ดกลหน่วงเวลา (placed ในช่องตัดสินของเป้าหมาย/ตนเอง)
const DELAYED_TRICKS = ['Lightning', 'Overindulgence'];
// การ์ดกลที่ "ขัดขวาง (Negation)" ยกเลิกผลได้ — ใช้เปิดหน้าต่างให้เล่นขัดขวาง
const NEGATABLE_TRICKS = ['Duel', 'Borrowed Sword', 'Steal', 'Burning Bridges',
  'Barbarian Invasion', 'Raining Arrows', 'Lightning', 'Overindulgence'];

// ─── ทักษะ Passive ของตัวละคร (ตรวจที่เซิร์ฟเวอร์) ──────────────────────────────────
const CHAR_PASSIVES = {
  guanyu:   { redAsAttack: true },          // Wu Sheng (武圣): ไพ่แดงใช้เป็นโจมตีได้
  zhaoyun:  { attackAsDodge: true,          // Long Dan (龙胆): โจมตีใช้เป็นหลบได้
               dodgeAsAttack: true },        //                   หลบใช้เป็นโจมตีได้
  zhangfei: { unlimitedAttacks: true },     // Pao Xiao (咆哮): โจมตีได้ไม่จำกัด
  zhenji:   { blackAsDodge: true,           // Qing Guo (倾国): ไพ่ดำใช้เป็นหลบได้
               luoshen: true },             // Luo Shen (洛神): เฟสเตรียม — ตัดสินไพ่ดำริบไว้
  machao:   { distanceMinus1: true,         // Ma Shu (马术): ระยะ -1 จากตนเองถึงคนอื่น
               tieji: true },               // Tie Ji (铁骑): โจมตีโดน → ตัดสินแดง = หลบไม่ได้
  lvbu:     { needsTwoDodge: true,          // Wu Shuang (无双): เป้าต้องหลบ 2 ใบ
               duelTwoAttacks: true },       //                  คู่ประลองต้องเล่นโจมตี 2 ใบ
  luxun:    { immuneToSteal: true,          // Qian Xun (谦逊): ขโมย/เบี่ยงเบนไม่ได้
               immuneToOverindulgence: true,
               lianying: true },            // Lian Ying (连营): เสียไพ่ใบสุดท้าย → จั่ว 1
  huangyy:  { unlimitedTrickRange: true,    // Qi Cai (奇才): การ์ดยุทธวิธีของคุณมีระยะไม่จำกัด
               jizhi: true },               // Ji Zhi (集智): จั่ว 1 ใบหลังใช้การ์ดยุทธวิธี
  // ── ตัวละครเพิ่มเติม ──
  zhuge:    { kongcheng: true },            // Kong Cheng (空城): ไม่มีไพ่ในมือ → เป็นเป้าโจมตี/ประลองไม่ได้
  gongsuanzan:{ yicong: true },             // Yi Cong (义从): ระยะปรับตาม HP
  xuzhu:    { luoyi: true },                // Luo Yi (裸衣): เฟสจั่ว เลือกจั่วน้อยลง 1 → โจมตี/ประลอง +1 ดาเมจ
  zhangliao:{ tuxi: true },                 // Tu Xi (突袭): เฟสจั่ว ไม่จั่วจากกอง → ริบไพ่จากสูงสุด 2 คน
  yuejin:   { xiaoguo: true },              // Xiao Guo (骁果): ท้ายเทิร์นคนอื่น บีบทิ้งอุปกรณ์/รับ 1 ดาเมจ
  ganning:  { blackAsBurn: true },          // Qi Xi (奇袭): ไพ่ดำใช้เป็น [เผาสะพาน]
  daqiao:   { diamondAsOverindulge: true,   // Guo Se (国色): ไพ่ ♦ ใช้เป็น [มัวเมา]
               liuli: true },               // Liu Li (流离): โดนโจมตี → ทิ้งไพ่โยกเป้าหมาย
  huatuo:   { redAsPeach: true },           // Jiu Ji (急救): ไพ่แดงใช้เป็น [ลูกท้อ] ในตาคนอื่น
  zhouyu:   { yingzi: true },               // Ying Zi (英姿): เฟสจั่ว จั่วเพิ่ม 1 ใบ
  diaochan: { biyue: true },                // Bi Yue (闭月): เฟสท้าย จั่ว 1 ใบ
  sunss:    { xiaoji: true },               // Xiao Ji (枭姬): เสียอุปกรณ์ → จั่ว 2 ใบ
  lvmeng:   { keji: true },                 // Ke Ji (克己): ไม่ได้โจมตีในตา → ข้ามเฟสทิ้งไพ่ได้
  caocao:   { jianxiong: true },            // Jian Xiong (奸雄): โดนดาเมจ → ริบไพ่ที่ก่อความเสียหาย
  simayi:   { fankui: true,                 // Fan Kui (反馈): โดนดาเมจ → ริบไพ่ 1 ใบจากผู้ก่อ
               guicai: true },              // Gui Cai (鬼才): หลังเปิดไพ่ตัดสิน → ทิ้งไพ่แทนเป็นไพ่ตัดสินใหม่
  guojia:   { tiandu: true,                 // Tian Du (天妒): ไพ่ตัดสินของตนมีผล → ริบไพ่นั้น
               yiji: true },                // Yi Ji (遗计): โดนดาเมจ 1 หน่วย → ดูไพ่ 2 ใบบนสุด มอบให้ใครก็ได้
  xiahou:   { ganglie: true },              // Gang Lie (刚烈): โดนดาเมจ → ตัดสิน ไม่ใช่ ♥ → ผู้ก่อทิ้ง 2 ใบ/รับ 1 ดาเมจ
  huaxiong: { conqueror: true },            // Conqueror: โดน [โจมตี] สีแดง → ผู้ก่ออาจฟื้น/จั่ว
  panfeng:  { kuangfu: true },              // Kuang Fu (狂斧): [โจมตี] โดน → เทียบ HP จั่ว 2 หรือเสีย 1
  ladygan:  { shenzhi: true },              // Shen Zhi (神智): เมื่อฟื้น HP → ให้ตัวละครอื่นจั่ว 1 (2 ถ้ามือว่าง)
  sunquan:  { jiuyuan: true },              // Jiu Yuan (救援): ฝ่ายง่อก๊กใช้ [ลูกท้อ] กับซุนฉวน → ฟื้นเพิ่ม 1
  liubei:   { },                            // Ren De เป็น active skill (ดู ACTIVE_SKILLS)
};

// ─── ทักษะแบบ "หน้าต่างขัดจังหวะ/มอบหมายข้ามผู้เล่น" (เปิดใช้ครบแล้ว) ────────────────────
//   simayi  — Gui Cai (鬼才):  _stepJudgment/_promptGuicai/resolveGuicai
//   yuejin  — Xiao Guo (骁果): _promptXiaoguo/useXiaoguo/respondXiaoguo
//   caocao  — Hu Jia (护驾):   _lordAssistFor/_promptLordAssist/resolveLordAssist (kingdom WEI)
//   liubei  — Ji Jiang (激将): _lordAssistFor/_promptLordAssist/resolveLordAssist (kingdom SHU)

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
        judgments: (p.judgments || []).map(c => ({ id: c.id, name: c.name, type: c.type, suit: c.suit, rank: c.rank })),
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
      p.judgments = [];            // ช่องตัดสิน (การ์ดหน่วงเวลา: สายฟ้า/เสพสุข)
      p.attacksThisTurn = 0;
      p.skipPlay = false;
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
    // กงซุนจ้าน (公孙瓒) — Yi Cong (义从): HP>2 ระยะจากตน -1; HP≤2 ระยะของคนอื่นถึงตน +1
    if (CHAR_PASSIVES[from.character]?.yicong && from.hp > 2) d -= 1;
    if (CHAR_PASSIVES[to.character]?.yicong && to.hp <= 2) d += 1;
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

  // ─── ฟื้นพลังชีวิต + ทริกเกอร์ที่เกี่ยวข้อง ────────────────────────────────────────
  //   healer = ผู้ที่ทำให้ฟื้น (อาจเป็น null) — ใช้กับ Jiu Yuan ของซุนฉวน
  heal(player, amount, healer = null) {
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + amount);
    const gained = player.hp - before;
    if (gained <= 0) return 0;
    // นางกาน (甘夫人) — Shen Zhi (神智): เมื่อฟื้น HP → ให้ตัวละครอื่นจั่ว 1 (2 ถ้ามือว่าง)
    if (CHAR_PASSIVES[player.character]?.shenzhi) {
      const other = this.nextAlivePlayer(player);
      if (other) {
        const n = other.hand.length === 0 ? 2 : 1;
        other.hand.push(...this.drawCards(n));
        this.addLog(player.username, `🧠 [ความรอบคอบ/神智] ฟื้นพลังชีวิต — ${other.username} จั่ว ${n} ใบ`);
      }
    }
    return gained;
  }

  // เรียกหลังผู้เล่นเสียการ์ดในมือ — หลู่ซวิน: Lian Ying (连营) เสียไพ่ใบสุดท้าย → จั่ว 1
  afterHandLoss(player, handBefore) {
    if (handBefore > 0 && player.hand.length === 0 && player.hp > 0
        && CHAR_PASSIVES[player.character]?.lianying) {
      player.hand.push(...this.drawCards(1));
      this.addLog(player.username, `🏕️ [ลมหายใจครั้งที่สอง/连营] เสียไพ่ใบสุดท้าย — จั่ว 1 ใบ`);
    }
  }

  // เรียกหลังผู้เล่นเสียอุปกรณ์ — ซุนซ่างเซียง: Xiao Ji (枭姬) → จั่ว 2 ใบต่ออุปกรณ์ที่เสีย
  afterLoseEquip(player, count = 1) {
    if (count > 0 && player.hp > 0 && CHAR_PASSIVES[player.character]?.xiaoji) {
      player.hand.push(...this.drawCards(2 * count));
      this.addLog(player.username, `🐦 [ความบ้าบิ่น/枭姬] เสียอุปกรณ์ — จั่ว ${2 * count} ใบ`);
    }
  }

  // จูกัดเหลียง — Kong Cheng (空城): ไม่มีไพ่ในมือ → เป็นเป้า [โจมตี]/[ประลอง] ไม่ได้
  kongChengProtected(target) {
    return CHAR_PASSIVES[target?.character]?.kongcheng && target.hand.length === 0;
  }

  // ─── ตรวจการใช้ไพ่ "แทน" การ์ดอื่น (ทักษะแปลงการ์ด) ──────────────────────────────
  //   คืน { as } เมื่อแปลงได้, { error } เมื่อแปลงไม่ได้, {} เมื่อไม่ได้ขอแปลง
  resolveSubstitution(from, card, asName) {
    if (!asName || asName === card.name) return {};
    const p = CHAR_PASSIVES[from.character] || {};
    if (asName === 'Attack' && p.redAsAttack && card.color === 'red') return { as: 'Attack' };
    if (asName === 'Burning Bridges' && p.blackAsBurn && card.color === 'black') return { as: 'Burning Bridges' };
    if (asName === 'Overindulgence' && p.diamondAsOverindulge && card.suit === '♦') return { as: 'Overindulgence' };
    if (asName === 'Peach' && p.redAsPeach && card.color === 'red') return { as: 'Peach' };
    return { error: { ok: false, msg: 'ตัวละครนี้ใช้การ์ดนี้แทนการ์ดนั้นไม่ได้' } };
  }

  // ─── ทริกเกอร์หลังรับความเสียหาย (ยังไม่ตาย) ───────────────────────────────────
  //   ctx = { card, isAttack, color } — บริบทของแหล่งความเสียหาย
  afterDamage(victim, amount, source, ctx = {}) {
    // เฉาเชา (曹操) — Jian Xiong (奸雄): ริบการ์ดที่ก่อความเสียหาย
    if (CHAR_PASSIVES[victim.character]?.jianxiong && ctx.card) {
      const di = this.discardPile.findIndex(c => c.id === ctx.card.id);
      const taken = di >= 0 ? this.discardPile.splice(di, 1)[0] : ctx.card;
      if (taken) {
        victim.hand.push(taken);
        this.addLog(victim.username, `🦅 [เล่ห์กล/奸雄] ริบการ์ด "${taken.name}" ที่ก่อความเสียหาย`);
      }
    }
    // ซือหม่าอี้ (司马懿) — Fan Kui (反馈): ริบการ์ด 1 ใบจากผู้ก่อความเสียหาย
    if (CHAR_PASSIVES[victim.character]?.fankui && source && source.id !== victim.id) {
      const loot = this.takeOneCard(source, true);
      if (loot) {
        victim.hand.push(loot);
        this.addLog(victim.username, `🔄 [การโต้กลับ/反馈] ริบ "${loot.name}" จาก ${source.username}`);
      }
    }
    // กัวเจีย (郭嘉) — Yi Ji (遗计): โดนดาเมจ → ดูไพ่ 2 ใบบนสุด/หน่วย (auto: เก็บเอง)
    if (CHAR_PASSIVES[victim.character]?.yiji) {
      const drawn = this.drawCards(2 * amount);
      if (drawn.length) {
        victim.hand.push(...drawn);
        this.addLog(victim.username, `📜 [มรดกตกทอด/遗计] โดน ${amount} ดาเมจ — ดูและเก็บไพ่ ${drawn.length} ใบ`);
      }
    }
    // เซี่ยโหวตุน (夏侯惇) — Gang Lie (刚烈): ตัดสิน ไม่ใช่ ♥ → ผู้ก่อทิ้ง 2 ใบ/รับ 1 ดาเมจ
    if (CHAR_PASSIVES[victim.character]?.ganglie && source && source.id !== victim.id && source.hp > 0) {
      const flip = this.drawCards(1)[0];
      this.emitJudgment(victim, flip, '🔥 ตัดสินความแน่วแน่');
      if (flip) this.discardPile.push(flip);
      const tag = flip ? `${flip.rank}${flip.suit}` : '—';
      if (flip && flip.suit !== '♥') {
        if (source.hand.length >= 2) {
          const handBefore = source.hand.length;
          const lost = [source.hand.pop(), source.hand.pop()];
          lost.forEach(c => this.discardPile.push(c));
          this.addLog(victim.username, `🔥 [ความแน่วแน่/刚烈] เปิด ${tag} — ${source.username} ทิ้งการ์ด 2 ใบ`);
          this.afterHandLoss(source, handBefore);
        } else {
          this.addLog(victim.username, `🔥 [ความแน่วแน่/刚烈] เปิด ${tag} — ${source.username} รับ 1 ดาเมจ`);
          this.dealDamage(source, 1, victim);
        }
      } else if (flip) {
        this.addLog(victim.username, `🔥 [ความแน่วแน่/刚烈] เปิด ${tag}(♥) — ผู้ก่อไม่ได้รับผล`);
      }
    }
    // หัวสยง (华雄) — Conqueror: โดน [โจมตี] สีแดง → ผู้ก่อจั่ว 1 ใบ (auto)
    if (CHAR_PASSIVES[victim.character]?.conqueror && ctx.isAttack && ctx.color === 'red' && source && source.hp > 0) {
      source.hand.push(...this.drawCards(1));
      this.addLog(victim.username, `👹 [ผู้พิชิต] ${source.username} โจมตีสีแดง — จั่ว 1 ใบ`);
    }
    // พันเฝิง (潘凤) — Kuang Fu (狂斧): [โจมตี] ของตนสร้างความเสียหาย → เทียบ HP
    if (source && CHAR_PASSIVES[source.character]?.kuangfu && ctx.isAttack && !source.skillUsed?.kuangfu && source.hp > 0) {
      source.skillUsed = source.skillUsed || {};
      source.skillUsed.kuangfu = true;
      if (victim.hp < source.hp) {
        source.hand.push(...this.drawCards(2));
        this.addLog(source.username, `🪓 [ขวานแห่งความบ้าคลั่ง/狂斧] HP เป้าหมายน้อยกว่า — จั่ว 2 ใบ`);
      } else {
        this.addLog(source.username, `🪓 [ขวานแห่งความบ้าคลั่ง/狂斧] HP เป้าหมาย ≥ ตน — เสีย 1 พลังชีวิต`);
        this.dealDamage(source, 1, null);
      }
    }
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
    else if (['cards','card+target','cards+target','card+target2','target'].includes(sk.needs) && player.hand.length === 0) {
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
        // ตายทันที (ไม่มีใครมีเพอช) ระหว่างตาตัวเอง → ส่งตาต่อ
        if (!this.dyingPlayerId && player.hp <= 0 && this.room.state !== 'ended'
            && this.room.players[this.currentPlayer]?.id === player.id) this.finishTurn();
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
        this.heal(target, 1, player);
        player.skillUsed.qingnang = true;
        this.addLog(player.username, `💚 ถุงยาเขียว — รักษา ${target.username} +1 พลังชีวิต`);
        break;
      }
      case 'liubei': {  // เมตตาธรรม (仁德) — มอบการ์ดให้คนอื่น, ฟื้นเมื่อมอบรวม ≥2
        const ids = Array.isArray(payload.cardIds) ? payload.cardIds : [];
        const give = player.hand.filter(c => ids.includes(c.id));
        if (give.length === 0) return { ok: false, msg: 'เลือกการ์ดที่จะมอบอย่างน้อย 1 ใบ' };
        const target = this.room.players.find(p => p.id === payload.targetId && p.hp > 0 && p.id !== player.id);
        if (!target) return { ok: false, msg: 'เลือกตัวละครอื่นที่จะมอบให้' };
        player.hand = player.hand.filter(c => !ids.includes(c.id));
        target.hand.push(...give);
        player.rendeGiven = (player.rendeGiven || 0) + give.length;
        this.addLog(player.username, `🤝 เมตตาธรรม — มอบการ์ด ${give.length} ใบให้ ${target.username}`);
        if (player.rendeGiven >= 2 && !player.skillUsed.rendeHeal && player.hp < player.maxHp) {
          player.skillUsed.rendeHeal = true;
          this.heal(player, 1, player);
          this.addLog(player.username, `🤝 มอบครบ 2 ใบ — ฟื้น HP 1 หน่วย`);
        }
        this.afterHandLoss(player, player.hand.length + give.length);
        break;
      }
      case 'ladygan': {  // ปัญญาประเสริฐ (淑慎) — ทิ้งมือทั้งหมด, ฟื้นถ้าทิ้ง > HP
        if (player.hand.length === 0) return { ok: false, msg: 'ไม่มีการ์ดในมือ' };
        const n = player.hand.length;
        player.hand.forEach(c => this.discardPile.push(c));
        player.hand = [];
        this.addLog(player.username, `🌸 ปัญญาประเสริฐ — ทิ้งการ์ดทั้งหมด ${n} ใบ`);
        if (n > player.hp && player.hp < player.maxHp) {
          this.heal(player, 1, player);
          this.addLog(player.username, `🌸 ทิ้ง ${n} > HP ${player.hp - 1} — ฟื้น HP 1 หน่วย`);
        }
        player.skillUsed.shushen = true;
        this.afterHandLoss(player, n);
        break;
      }
      case 'sunss': {  // การสมรส (结姻) — ทิ้ง 2 ใบ, ตัวเอง+ชายบาดเจ็บฟื้น 1
        const ids = Array.isArray(payload.cardIds) ? payload.cardIds : [];
        if (ids.length !== 2) return { ok: false, msg: 'ต้องทิ้งการ์ด 2 ใบ' };
        const give = player.hand.filter(c => ids.includes(c.id));
        if (give.length !== 2) return { ok: false, msg: 'การ์ดไม่อยู่ในมือ' };
        const target = this.room.players.find(p => p.id === payload.targetId && p.hp > 0 && p.id !== player.id);
        if (!target) return { ok: false, msg: 'เลือกตัวละครชายที่บาดเจ็บ' };
        if (genderOf(target.character) !== 'M') return { ok: false, msg: 'เป้าหมายต้องเป็นตัวละครชาย' };
        if (target.hp >= target.maxHp && player.hp >= player.maxHp) return { ok: false, msg: 'ไม่มีใครบาดเจ็บให้รักษา' };
        player.hand = player.hand.filter(c => !ids.includes(c.id));
        give.forEach(c => this.discardPile.push(c));
        this.heal(player, 1, player);
        this.heal(target, 1, player);
        player.skillUsed.jieyin = true;
        this.addLog(player.username, `💍 การสมรส — ${player.username} และ ${target.username} ฟื้น HP คนละ 1`);
        this.afterHandLoss(player, player.hand.length + 2);
        break;
      }
      case 'diaochan': {  // เสน่ห์มารยา (离间) — ทิ้ง 1 ใบ ให้ชาย 2 คนประลอง
        const card = player.hand.find(c => c.id === payload.cardId);
        if (!card) return { ok: false, msg: 'เลือกการ์ดที่จะทิ้ง 1 ใบ' };
        const ids = Array.isArray(payload.targetIds) ? payload.targetIds : [];
        if (ids.length !== 2 || ids[0] === ids[1]) return { ok: false, msg: 'เลือกตัวละครชาย 2 คน' };
        const t1 = this.room.players.find(p => p.id === ids[0] && p.hp > 0);
        const t2 = this.room.players.find(p => p.id === ids[1] && p.hp > 0);
        if (!t1 || !t2) return { ok: false, msg: 'เป้าหมายไม่ถูกต้อง' };
        if (genderOf(t1.character) !== 'M' || genderOf(t2.character) !== 'M')
          return { ok: false, msg: 'เป้าหมายต้องเป็นตัวละครชายทั้งคู่' };
        const handBefore = player.hand.length;
        player.hand = player.hand.filter(c => c.id !== card.id);
        this.discardPile.push(card);
        player.skillUsed.lijian = true;
        this.afterHandLoss(player, handBefore);
        // t1 ถูกบังคับให้ประลอง t2 (t1 เล่นโจมตีก่อน) — ยกเลิกด้วยขัดขวางไม่ได้
        const atkNeeded = CHAR_PASSIVES[t2.character]?.duelTwoAttacks ? 2 : 1;
        this.addLog(player.username, `💃 เสน่ห์มารยา — บังคับ ${t1.username} ประลองกับ ${t2.username}!`);
        this.broadcast();
        this.requestResponse('duel', t1, t2, 'Duel', { damage: 1, negatable: false, attacksNeeded: atkNeeded });
        return { ok: true };
      }
      case 'zhouyu': {  // หว่านเมล็ดหวาดระแวง (反间)
        const target = this.room.players.find(p => p.id === payload.targetId && p.hp > 0 && p.id !== player.id);
        if (!target) return { ok: false, msg: 'เลือกตัวละครเป้าหมาย' };
        if (player.hand.length === 0) return { ok: false, msg: 'ไม่มีการ์ดในมือ' };
        player.skillUsed.fanjian = true;
        // เปิดหน้าต่างให้เป้าหมายทายชนิดไพ่ (suit)
        this.fanjian = { sourceId: player.id, targetId: target.id };
        this.addLog(player.username, `🎭 หว่านเมล็ดหวาดระแวง — ${target.username} ต้องทายชนิดไพ่`);
        const sock = io.sockets.sockets.get(target.socketId);
        if (sock) sock.emit('askFanjian', { sourceName: player.username });
        this.broadcast();
        return { ok: true };
      }
      default: return { ok: false, msg: 'ยังไม่รองรับทักษะนี้' };
    }
    this.broadcast();
    return { ok: true };
  }

  // เป้าหมายของ Fan Jian (反间) ทายชนิดไพ่ → จั่วไพ่จากมือโจวอี๋เปิดเผย → ถ้าไม่ตรงรับ 1 ดาเมจ
  resolveFanjian(targetId, suit) {
    const f = this.fanjian;
    if (!f || f.targetId !== targetId) return { ok: false, msg: 'ไม่มีการหว่านเมล็ดที่รออยู่' };
    const source = this.room.players.find(p => p.id === f.sourceId);
    const target = this.room.players.find(p => p.id === f.targetId);
    this.fanjian = null;
    if (!source || !target) return { ok: false };
    if (source.hand.length === 0) { this.addLog(source.username, '🎭 หว่านเมล็ด — แต่ไม่มีการ์ดในมือแล้ว'); this.broadcast(); return { ok: true }; }
    const idx = Math.floor(Math.random() * source.hand.length);
    const card = source.hand.splice(idx, 1)[0];
    target.hand.push(card);
    const guessed = ['♠','♥','♦','♣'].includes(suit) ? suit : '♥';
    this.addLog(target.username, `🎭 ทาย "${guessed}" — เปิดได้ ${card.rank}${card.suit}`);
    this.afterHandLoss(source, source.hand.length + 1);
    if (card.suit !== guessed) {
      this.addLog(target.username, `🎭 ชนิดไม่ตรง — ${target.username} รับ 1 ดาเมจ (เก็บการ์ดไว้)`);
      this.dealDamage(target, 1, source);
    } else {
      this.addLog(target.username, `🎭 ทายถูก — ไม่รับความเสียหาย (เก็บการ์ดไว้)`);
    }
    this.broadcast();
    return { ok: true };
  }

  // ─── ทักษะเจ้านาย: Hu Jia (护驾) / Ji Jiang (激将) — ฝ่ายเดียวกันเล่นการ์ดแทน ──────────
  _lordAssistFor(responder, type) {
    let need = null, kingdom = null;
    if (responder.character === 'caocao' && type === 'dodge') { need = 'Dodge'; kingdom = 'WEI'; }
    else if (responder.character === 'liubei' && (type === 'duel' || type === 'avoidatk' || type === 'borrow')) { need = 'Attack'; kingdom = 'SHU'; }
    else return null;
    const queue = this.room.players.filter(p => p.hp > 0 && p.id !== responder.id
      && kingdomOf(p.character) === kingdom && p.hand.some(c => c.name === need)).map(p => p.id);
    if (!queue.length) return null;
    return { need, kingdom, queue };
  }

  _promptLordAssist() {
    const la = this.lordAssist;
    if (!la) return;
    const lord = this.room.players.find(p => p.id === la.lordId);
    while (la.idx < la.queue.length) {
      const ally = this.room.players.find(p => p.id === la.queue[la.idx]);
      if (ally && ally.hp > 0 && ally.hand.some(c => c.name === la.need)) {
        clearInterval(this.lordTimer);
        this.timer = 20;
        this.lordTimer = setInterval(() => {
          this.timer--;
          io.to(this.room.code).emit('timerTick', this.timer);
          if (this.timer <= 0) { clearInterval(this.lordTimer); this.resolveLordAssist(ally.id, null); }
        }, 1000);
        const sock = io.sockets.sockets.get(ally.socketId);
        if (sock) sock.emit('askLordAssist', { need: la.need, lordName: lord?.username, skill: la.need === 'Dodge' ? '护驾' : '激将' });
        this.broadcast();
        return;
      }
      la.idx++;
    }
    this._concludeLordAssist(null, null);   // ไม่มีใครช่วย
  }

  resolveLordAssist(allyId, cardId) {
    const la = this.lordAssist;
    if (!la || la.queue[la.idx] !== allyId) return { ok: false, msg: 'ไม่มีคำขอช่วยเหลือที่รออยู่' };
    clearInterval(this.lordTimer);
    const ally = this.room.players.find(p => p.id === allyId);
    if (cardId && ally) {
      const idx = ally.hand.findIndex(c => c.id === cardId && c.name === la.need);
      if (idx >= 0) {
        const handBefore = ally.hand.length;
        const card = ally.hand.splice(idx, 1)[0];
        this.addLog(ally.username, `🤝 [${la.need === 'Dodge' ? 'ผู้ติดตาม/护驾' : 'อิทธิพล/激将'}] เล่น ${card.name} แทนเจ้านาย`);
        this.afterHandLoss(ally, handBefore);
        this._concludeLordAssist(ally, card);
        return { ok: true };
      }
    }
    la.idx++;
    this._promptLordAssist();
    return { ok: true };
  }

  _concludeLordAssist(ally, card) {
    const la = this.lordAssist;
    this.lordAssist = null;
    clearInterval(this.lordTimer);
    if (!la) return;
    const lord = this.room.players.find(p => p.id === la.lordId);
    if (!lord) { this.pending = null; return this._continueAfterResponse(); }
    this._lordAssistDone = true;   // กันเปิดหน้าต่างซ้ำตอน resolveResponse รอบสอง
    if (ally && card) {
      lord.hand.push(card);                       // ใส่การ์ดเข้ามือเจ้านายชั่วคราว
      this.resolveResponse(lord.id, card.id);     // ให้ระบบจัดการตามปกติ (นับว่าเจ้านายป้องกัน)
    } else {
      this.resolveResponse(lord.id, null);        // ไม่มีใครช่วย → ตอบโต้ล้มเหลว
    }
  }

  // ─── เริ่มรอบของผู้เล่นปัจจุบัน (6 เฟสตามคู่มือ) ──────────────────────────────
  runTurn() {
    const players = this.room.players;
    const cur = players[this.currentPlayer];
    cur.attacksThisTurn = 0;
    cur.wined = false;
    cur.skillUsed = {};   // รีเซ็ตการใช้ทักษะ (แบบครั้งเดียวต่อตา) ของผู้เล่นคนนี้
    cur.skipPlay = false;
    cur.luoyiBoost = false;   // ซวีจู้ (裸衣): โบนัสดาเมจจากการจั่วน้อยลง
    cur.rendeGiven = 0;       // หลิวเป้ย (仁德): จำนวนการ์ดที่มอบในตานี้
    this.turn++;

    // 1) เตรียมรบ
    this.phase = 'start';
    this.prepareSkills(cur);    // ทักษะช่วงเตรียม (เจินจี: Luo Shen)
    // 2) เปิดการ์ดตัดสิน (Judgment) — ตัดสินการ์ดหน่วงเวลา (สายฟ้า/เสพสุข)
    this.phase = 'judge';
    this.runJudgments(cur);
  }

  // ─── ทักษะช่วงเตรียมรบ (Prepare phase) ────────────────────────────────────────
  prepareSkills(cur) {
    // เจินจี (甄姬) — Luo Shen (洛神): ตัดสินไพ่ ถ้าดำริบไว้ แล้วตัดสินต่อได้ (auto)
    if (CHAR_PASSIVES[cur.character]?.luoshen && cur.hp > 0) {
      let taken = 0;
      while (taken < 8) {  // กันลูปไม่รู้จบ
        const flip = this.drawCards(1)[0];
        if (!flip) break;
        this.emitJudgment(cur, flip, '🌊 ตัดสินเทพีแม่น้ำลั่ว');
        const tag = `${flip.rank}${flip.suit}`;
        if (flip.color === 'black') {
          cur.hand.push(flip);
          taken++;
          this.addLog(cur.username, `🌊 [เทพีแห่งแม่น้ำลั่ว/洛神] ตัดสิน ${tag}(ดำ) — ริบไว้ (ตัดสินต่อ)`);
        } else {
          this.discardPile.push(flip);
          this.addLog(cur.username, `🌊 [เทพีแห่งแม่น้ำลั่ว/洛神] ตัดสิน ${tag}(แดง) — หยุด${taken ? ` (ได้ ${taken} ใบ)` : ''}`);
          break;
        }
      }
    }
  }

  // ─── เฟสตัดสิน — ประมวลผลการ์ดหน่วงเวลาในช่องตัดสินทีละใบ (รองรับ Gui Cai) ──────────
  runJudgments(cur) {
    this._stepJudgment(cur);
  }

  _stepJudgment(cur) {
    while (cur.judgments && cur.judgments.length) {
      if (cur.hp <= 0 || this.dyingPlayerId) break;
      const flip = this.drawCards(1)[0];
      const jcard = cur.judgments.shift();
      // ── หน้าต่าง Gui Cai (鬼才) ของซือหม่าอี้: เปลี่ยนไพ่ตัดสินก่อนมีผล ──
      const queue = this._guicaiQueue();
      if (queue.length && flip) {
        this.guicai = { judgePlayerId: cur.id, jcard, flip, queue, idx: 0 };
        this._promptGuicai();
        return;   // พัก — resolveGuicai จะเดินต่อ
      }
      this.applyJudgmentResult(cur, jcard, flip);
      if (this.dyingPlayerId) break;
    }
    // ถ้ายังรอเพอชจากการตัดสิน (สายฟ้า) ให้หยุดไว้ แล้วต่อเมื่อเคลียร์สภาวะใกล้ตาย
    if (this.dyingPlayerId === cur.id) { this._resumeTurn = true; return; }
    this.afterJudgment(cur);
  }

  // ซือหม่าอี้ที่ยังมีชีวิต + มีไพ่ในมือ (ตามลำดับที่นั่ง) — มีสิทธิ์ใช้ Gui Cai
  _guicaiQueue() {
    return this.room.players
      .filter(p => p.hp > 0 && CHAR_PASSIVES[p.character]?.guicai && p.hand.length > 0)
      .map(p => p.id);
  }

  _promptGuicai() {
    const gc = this.guicai;
    if (!gc) return;
    while (gc.idx < gc.queue.length) {
      const simayi = this.room.players.find(p => p.id === gc.queue[gc.idx]);
      if (simayi && simayi.hp > 0 && simayi.hand.length > 0) {
        clearInterval(this.guicaiTimer);
        this.timer = 20;
        this.guicaiTimer = setInterval(() => {
          this.timer--;
          io.to(this.room.code).emit('timerTick', this.timer);
          if (this.timer <= 0) { clearInterval(this.guicaiTimer); this.resolveGuicai(simayi.id, null); }
        }, 1000);
        const judgeP = this.room.players.find(p => p.id === gc.judgePlayerId);
        const sock = io.sockets.sockets.get(simayi.socketId);
        if (sock) sock.emit('askGuicai', {
          flip: { rank: gc.flip.rank, suit: gc.flip.suit },
          judgeName: judgeP?.username, jcardName: gc.jcard.name,
        });
        this.broadcast();
        return;
      }
      gc.idx++;
    }
    this._finishGuicai();
  }

  // ซือหม่าอี้เลือกทิ้งไพ่ 1 ใบเปลี่ยนไพ่ตัดสิน (cardId=null = ไม่เปลี่ยน)
  resolveGuicai(playerId, cardId) {
    const gc = this.guicai;
    if (!gc || gc.queue[gc.idx] !== playerId) return { ok: false, msg: 'ไม่มีหน้าต่างกุ้ยไฉที่รออยู่' };
    clearInterval(this.guicaiTimer);
    const simayi = this.room.players.find(p => p.id === playerId);
    if (cardId && simayi) {
      const idx = simayi.hand.findIndex(c => c.id === cardId);
      if (idx >= 0) {
        const handBefore = simayi.hand.length;
        const newCard = simayi.hand.splice(idx, 1)[0];
        this.discardPile.push(gc.flip);   // ไพ่ตัดสินเดิม → กองทิ้ง
        gc.flip = newCard;                 // การ์ดใหม่กลายเป็นไพ่ตัดสิน
        this.addLog(simayi.username, `🃏 [เนโครแมนซี/鬼才] เปลี่ยนไพ่ตัดสินเป็น ${newCard.rank}${newCard.suit}`);
        this.afterHandLoss(simayi, handBefore);
      }
    }
    gc.idx++;
    this._promptGuicai();
    return { ok: true };
  }

  _finishGuicai() {
    clearInterval(this.guicaiTimer);
    const gc = this.guicai;
    this.guicai = null;
    if (!gc) return;
    const cur = this.room.players.find(p => p.id === gc.judgePlayerId);
    if (!cur) return;
    this.applyJudgmentResult(cur, gc.jcard, gc.flip);
    this._stepJudgment(cur);   // เดินการ์ดตัดสินใบถัดไป
  }

  // ─── แจ้งไคลเอนต์ให้เล่นอนิเมชั่น "เปิดไพ่ตัดสิน" ที่กองไพ่กลางกระดาน ──────────────
  emitJudgment(player, flip, label) {
    if (!flip) return;
    io.to(this.room.code).emit('judgmentFlip', {
      playerId: player?.id || null,
      playerName: player?.username || '',
      label: label || '🎴 ตัดสิน',
      card: { name: flip.name, suit: flip.suit, rank: flip.rank, color: flip.color },
    });
  }

  // ประมวลผลไพ่ตัดสินที่เปิดแล้ว (flip) — บังคับใช้ผลของการ์ดหน่วงเวลา
  applyJudgmentResult(cur, jcard, flip) {
    const jLabel = jcard.name === 'Lightning' ? '⚡ ตัดสินสายฟ้า'
      : jcard.name === 'Overindulgence' ? '🍵 ตัดสินเสพสุข' : '🎴 ตัดสิน';
    this.emitJudgment(cur, flip, jLabel);
    if (flip) this.discardPile.push(flip);
    const tag = flip ? `${flip.rank}${flip.suit}` : '—';

    if (jcard.name === 'Lightning') {
      const struck = flip && flip.suit === '♠' && flip.value >= 2 && flip.value <= 9;
      if (struck) {
        this.addLog('ระบบ', `⚡ [สายฟ้า] ${cur.username} เปิด ${tag} — ฟ้าผ่า! รับ 3 ความเสียหาย`);
        this.discardPile.push(jcard);
        this.dealDamage(cur, 3, null);
      } else {
        const nextP = this.nextAlivePlayer(cur);
        if (nextP && nextP.id !== cur.id) {
          nextP.judgments = nextP.judgments || [];
          nextP.judgments.push(jcard);
          this.addLog('ระบบ', `⚡ [สายฟ้า] ${cur.username} เปิด ${tag} — รอด! สายฟ้าเคลื่อนไปหา ${nextP.username}`);
        } else {
          this.discardPile.push(jcard);
          this.addLog('ระบบ', `⚡ [สายฟ้า] ${cur.username} เปิด ${tag} — รอด! (ไม่มีผู้เล่นถัดไป สายฟ้าสลายตัว)`);
        }
      }
    } else if (jcard.name === 'Overindulgence') {
      this.discardPile.push(jcard);
      const escaped = flip && flip.suit === '♥';
      if (escaped) {
        this.addLog('ระบบ', `🍵 [เสพสุข] ${cur.username} เปิด ${tag}(♥) — หลุดพ้น เล่นได้ตามปกติ`);
      } else {
        cur.skipPlay = true;
        this.addLog('ระบบ', `🍵 [เสพสุข] ${cur.username} เปิด ${tag} — ติดมัวเมา! ข้ามเฟสเล่นการ์ดในตานี้`);
      }
    } else {
      // การ์ดอื่นในช่องตัดสิน (ไม่ควรเกิด) — ทิ้งทันที
      this.discardPile.push(jcard);
    }
    // กัวเจีย (郭嘉) — Tian Du (天妒): หลังการ์ดตัดสินมีผล → ริบไพ่ตัดสินนั้น (auto)
    if (flip && CHAR_PASSIVES[cur.character]?.tiandu) {
      const di = this.discardPile.lastIndexOf(flip);
      if (di >= 0) {
        this.discardPile.splice(di, 1);
        cur.hand.push(flip);
        this.addLog(cur.username, `🌌 [ความหึงหวงของสวรรค์/天妒] ริบไพ่ตัดสิน ${tag} มาเป็นของตน`);
      }
    }
  }

  // ผู้เล่นคนถัดไปที่ยังมีชีวิต (ตามลำดับที่นั่ง) — ใช้กับการเคลื่อนสายฟ้า
  nextAlivePlayer(from) {
    const players = this.room.players;
    const start = players.indexOf(from);
    for (let i = 1; i <= players.length; i++) {
      const p = players[(start + i) % players.length];
      if (p && p.hp > 0 && p.id !== from.id) return p;
    }
    return null;
  }

  // หลังจบเฟสตัดสิน → เข้าเฟสจั่ว (หรือจบตาถ้าตายระหว่างตัดสิน)
  afterJudgment(cur) {
    this._resumeTurn = false;
    if (this.room.state === 'ended') return;
    if (cur.hp <= 0) return this.finishTurn();   // ตายจากสายฟ้า → ส่งตาต่อ
    // 3) จั่วการ์ด — รอผู้เล่นกดจั่วเอง (ไฮไลท์ที่กองไพ่)
    this.phase = 'draw';
    this.awaitingDraw = true;
    this.addLog(cur.username, '🎴 ถึงเฟสจั่วการ์ด — กดที่กองไพ่เพื่อจั่ว 2 ใบ');
    this.startTimer();
    this.broadcast();
  }

  // ผู้เล่นกดจั่วการ์ดเอง (เฟสจั่ว) — auto=true เมื่อหมดเวลาแล้วจั่วให้อัตโนมัติ
  //   opts.useLuoyi → ซวีจู้ (裸衣): จั่วน้อยลง 1 ใบ แลกกับ [โจมตี]/[ประลอง] +1 ดาเมจในตานี้
  //   opts.tuxiTargets → จางเหลียว (突袭): ไม่จั่วจากกอง แต่ริบไพ่ 1 ใบจากเป้าหมายสูงสุด 2 คน
  playerDraw(playerId, auto = false, opts = false) {
    if (opts === true || opts === false) opts = { useLuoyi: !!opts };  // รองรับ signature เดิม
    const useLuoyi = !!opts.useLuoyi;
    const players = this.room.players;
    const cur = players[this.currentPlayer];
    if (!auto) {
      if (cur.id !== playerId) return { ok: false, msg: 'ไม่ใช่ตาของคุณ' };
      if (this.phase !== 'draw' || !this.awaitingDraw) return { ok: false, msg: 'ยังไม่ถึงเฟสจั่วการ์ด' };
    }
    if (!this.awaitingDraw) return { ok: false, msg: 'จั่วการ์ดไปแล้ว' };

    // จางเหลียว (张辽) — Tu Xi (突袭): ไม่จั่วจากกอง → ริบไพ่ 1 ใบจากเป้าหมายสูงสุด 2 คน
    const tuxiTargets = Array.isArray(opts.tuxiTargets) ? opts.tuxiTargets.slice(0, 2) : [];
    if (tuxiTargets.length && CHAR_PASSIVES[cur.character]?.tuxi) {
      this.awaitingDraw = false;
      let got = 0;
      for (const tid of tuxiTargets) {
        const t = players.find(p => p.id === tid && p.hp > 0 && p.id !== cur.id && p.hand.length > 0);
        if (!t) continue;
        const loot = this.takeOneCard(t, true);
        if (loot) { cur.hand.push(loot); got++; this.addLog(cur.username, `🥷 [การโจมตีฉับพลัน/突袭] ริบไพ่จาก ${t.username}`); }
      }
      if (got === 0) cur.hand.push(...this.drawCards(2));   // ไม่มีอะไรให้ริบ → จั่วปกติ
      this.phase = 'play';
      this.startTimer();
      this.broadcast();
      return { ok: true };
    }

    this.awaitingDraw = false;
    let drawCount = 2;
    // โจวอี๋ (周瑜) — Ying Zi (英姿): จั่วเพิ่ม 1 ใบ
    if (CHAR_PASSIVES[cur.character]?.yingzi) drawCount += 1;
    // ซวีจู้ (许褚) — Luo Yi (裸衣): เลือกจั่วน้อยลง 1 → โจมตี/ประลอง +1 ดาเมจในตานี้
    if (useLuoyi && CHAR_PASSIVES[cur.character]?.luoyi) {
      drawCount -= 1;
      cur.luoyiBoost = true;
      this.addLog(cur.username, `💪 [เปลือยกายอุกอาจ/裸衣] จั่วน้อยลง 1 ใบ — [โจมตี]/[ประลอง] +1 ดาเมจในตานี้`);
    }
    const drawn = this.drawCards(drawCount);
    cur.hand.push(...drawn);
    this.addLog(cur.username, `จั่วการ์ด ${drawCount} ใบ${auto ? ' (อัตโนมัติ)' : ''} (มือ ${cur.hand.length} ใบ)`);
    // เสพสุข (乐不思蜀): ติดมัวเมา → ข้ามเฟสเล่นการ์ด ไปเฟสทิ้ง/จบตาเลย
    if (cur.skipPlay) {
      cur.skipPlay = false;
      this.phase = 'play';
      this.addLog(cur.username, '🍵 ข้ามเฟสเล่นการ์ด (ติดมัวเมา) — ไปเฟสทิ้งการ์ด');
      this.broadcast();
      return this.endTurn(cur.id), { ok: true };
    }
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
  //   asName = ชื่อการ์ดที่ต้องการ "ใช้แทน" (ทักษะแปลงการ์ด เช่น กานหนิง/ต้าเฉียว)
  playCard(playerId, cardId, targetId, asName = null) {
    const players = this.room.players;
    const cur = players[this.currentPlayer];
    if (this.pending) return { ok: false, msg: 'กำลังรอการตอบโต้อยู่' };
    if (this.harvest) return { ok: false, msg: 'กำลังเก็บเกี่ยว — รอเลือกไพ่ให้ครบก่อน' };
    if (cur.id !== playerId) return { ok: false, msg: 'ไม่ใช่ตาของคุณ' };
    if (this.phase !== 'play') return { ok: false, msg: 'ยังไม่ถึงเฟสเล่นการ์ด' };

    const cardIdx = cur.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return { ok: false, msg: 'ไม่พบการ์ดในมือ' };

    const card = cur.hand[cardIdx];

    // ── ทักษะแปลงการ์ด (กานหนิง: ดำ→เผาสะพาน, ต้าเฉียว: ♦→มัวเมา, หัวถัว: แดง→ลูกท้อ ฯลฯ) ──
    const sub = this.resolveSubstitution(cur, card, asName);
    if (sub.error) return sub.error;
    const effCard = sub.as ? { ...card, name: sub.as, _origName: card.name } : card;

    // ── ตรวจเงื่อนไขการเล่นการ์ด ──
    // Guan Yu passive: red cards bypass response-only restriction (will be treated as Attack)
    const isGuanyuRedPlay = CHAR_PASSIVES[cur.character]?.redAsAttack && card.color === 'red' && !!targetId;
    if (RESPONSE_ONLY_CARDS.includes(effCard.name) && !isGuanyuRedPlay && !sub.as)
      return { ok: false, msg: `การ์ด${card.name} ใช้สำหรับตอบโต้เท่านั้น เล่นเชิงรุกไม่ได้` };
    if (UNSUPPORTED_PLAY_CARDS.includes(effCard.name))
      return { ok: false, msg: `การ์ด${card.name} เป็นการ์ดหน่วงเวลา (ต้องมีเฟสตัดสิน) — ฉบับนี้ยังไม่รองรับ` };
    const target = players.find(p => p.id === targetId);

    const result = this.applyCard(cur, effCard, target);
    if (!result.ok) return result;

    // ── ป้ายบอกเป้าหมายชั่วคราว (แสดงบนหัวเป้าหมาย) — บุกทะลวง/ฝนลูกธนู ไม่รวมตัวเอง ──
    let _targetIds = [];
    if (target) _targetIds = [target.id];
    else if (['Raining Arrows', 'Barbarian Invasion'].includes(effCard.name))
      _targetIds = players.filter(p => p.id !== cur.id && p.hp > 0).map(p => p.id);
    if (_targetIds.length) {
      io.to(this.room.code).emit('cardTargeted', {
        sourceId: cur.id, sourceName: cur.username,
        cardName: effCard.name, targetIds: _targetIds,
      });
    }

    // นำการ์ดออกจากมือ (อุปกรณ์เข้าช่อง, การ์ดหน่วงเวลาเข้าช่องตัดสิน, อื่นๆ เข้ากองทิ้ง)
    cur.hand.splice(cardIdx, 1);
    if (!['weapon','armor','mount'].includes(card.type) && !result.noDiscard) {
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

  // ─── ออกการ์ดโจมตี + เอฟเฟคอาวุธที่ทำงานตอนโจมตี (ดาบหยินหยาง/ง้าวฟ้า) ───────────
  issueAttack(from, target, opts = {}) {
    const color = opts.color || 'black';
    const dmg = opts.dmg != null ? opts.dmg : (from.wined ? 2 : 1);
    from.wined = false;
    const srcCard = opts.card || null;   // การ์ดต้นทาง (ใช้กับ Jian Xiong ของเฉาเชา)
    const dodgesNeeded = opts.dodgesNeeded != null ? opts.dodgesNeeded
      : (CHAR_PASSIVES[from.character]?.needsTwoDodge ? 2 : 1);
    // ดาบหยินหยาง (阴阳双股剑): โจมตีเพศตรงข้าม → จั่ว 1 ใบ
    if (from.equipment?.weapon?.name === 'Yin-Yang Swords' && target
        && genderOf(from.character) !== genderOf(target.character)) {
      from.hand.push(...this.drawCards(1));
      this.addLog(from.username, `☯️ [ดาบหยินหยาง/阴阳双股剑] โจมตีเพศตรงข้าม — จั่ว 1 ใบ`);
    }
    // หม่าเฉา (马超) — Tie Ji (铁骑): โจมตีโดน → ตัดสิน ถ้าแดง เป้าหมายหลบไม่ได้ (เป้าหมายเดียว)
    if (CHAR_PASSIVES[from.character]?.tieji && target) {
      const flip = this.drawCards(1)[0];
      this.emitJudgment(from, flip, '🐎 ตัดสินทแกล้วทหารม้า');
      if (flip) this.discardPile.push(flip);
      const tag = flip ? `${flip.rank}${flip.suit}` : '—';
      if (flip && flip.color === 'red') {
        this.addLog(from.username, `🐎 [ทแกล้วทหารม้า/铁骑] เปิด ${tag}(แดง) — ${target.username} หลบไม่ได้!`);
        this.dealDamage(target, dmg, from, { card: srcCard, isAttack: true, color });
        return;
      } else if (flip) {
        this.addLog(from.username, `🐎 [ทแกล้วทหารม้า/铁骑] เปิด ${tag}(ดำ) — หลบได้ตามปกติ`);
      }
    }
    // ง้าวฟ้า (方天画戟): โจมตีเป็นไพ่ใบสุดท้ายในมือ → กระทบเป้าหมายอื่นในระยะเพิ่มได้ถึง 2
    if (from.equipment?.weapon?.name === 'Sky Piercing Halberd' && from.hand.length <= 1) {
      const extra = this.room.players.filter(p => p.hp > 0 && p.id !== from.id
        && p.id !== target.id && this.inAttackRange(from, p)).slice(0, 2);
      if (extra.length) {
        this.addLog(from.username, `🩸 [ง้าวฟ้า/方天画戟] โจมตีไพ่ใบสุดท้าย — กระทบ ${extra.length + 1} เป้าหมาย!`);
        this.requestGroupResponse('dodge', [target, ...extra], from, 'Attack',
          { damage: dmg, attackCardColor: color, dodgesNeeded, card: srcCard });
        return;
      }
    }
    this.requestResponse('dodge', target, from, 'Attack', { damage: dmg, attackCardColor: color, dodgesNeeded, card: srcCard });
  }

  // เปิดหน้าต่าง [ขัดขวาง] ถ้าเป้าหมายมีการ์ดขัดขวาง — ไม่งั้นใช้เอฟเฟคทันที
  maybeNegate(from, target, cardName, effectFn) {
    if (target.hand.some(c => c.name === 'Negation')) {
      this.addLog(from.username, `🎯 ใช้ ${cardName} ใส่ ${target.username}`);
      this.requestResponse('negate', target, from, cardName, { negatable: true, onApply: effectFn });
      return { ok: true, logMsg: null };
    }
    effectFn();
    return { ok: true, logMsg: null };
  }

  applyCard(from, card, target) {
    // ─── Guan Yu (关羽) passive: any red card = Attack ────────────────────────────
    if (CHAR_PASSIVES[from.character]?.redAsAttack && card.color === 'red' && target && card.name !== 'Attack') {
      if (target.id === from.id) return { ok: false, msg: 'โจมตีตัวเองไม่ได้' };
      if (target.hp <= 0) return { ok: false, msg: 'เป้าหมายถูกกำจัดแล้ว' };
      if (this.kongChengProtected(target)) return { ok: false, msg: `${target.username} ใช้กลป้อมปราการเปล่า — เป็นเป้าหมายไม่ได้ขณะไม่มีไพ่` };
      const _hasCrossbow = from.equipment?.weapon?.name === 'Zhuge Crossbow';
      const _unlimited = _hasCrossbow || !!CHAR_PASSIVES[from.character]?.unlimitedAttacks;
      if (from.attacksThisTurn >= 1 && !_unlimited) return { ok: false, msg: 'โจมตีได้เพียง 1 ครั้งต่อตา' };
      if (!this.inAttackRange(from, target)) return { ok: false, msg: `เป้าหมายอยู่นอกระยะโจมตี` };
      from.attacksThisTurn++;
      const _dmg = (from.wined ? 2 : 1) + (from.luoyiBoost ? 1 : 0);
      this.addLog(from.username, `⚔️ [กวนอู] ${card.name}(♥♦) → โจมตี ${target.username}${_dmg > 1 ? ' 🍶+1' : ''}`);
      this.issueAttack(from, target, { color: card.color, dmg: _dmg, dodgesNeeded: 1, card });
      return { ok: true, logMsg: null };
    }

    switch (card.name) {
      case 'Attack': {
        if (!target) return { ok: false, msg: 'ต้องเลือกเป้าหมาย' };
        if (target.id === from.id) return { ok: false, msg: 'โจมตีตัวเองไม่ได้' };
        if (target.hp <= 0) return { ok: false, msg: 'เป้าหมายถูกกำจัดแล้ว' };
        if (this.kongChengProtected(target)) return { ok: false, msg: `${target.username} ใช้กลป้อมปราการเปล่า — เป็นเป้าหมายไม่ได้ขณะไม่มีไพ่` };
        const hasCrossbow = from.equipment?.weapon?.name === 'Zhuge Crossbow';
        const hasUnlimitedAttacks = hasCrossbow || !!CHAR_PASSIVES[from.character]?.unlimitedAttacks;
        if (from.attacksThisTurn >= 1 && !hasUnlimitedAttacks)
          return { ok: false, msg: 'โจมตีได้เพียง 1 ครั้งต่อตา' };
        if (!this.inAttackRange(from, target))
          return { ok: false, msg: `เป้าหมายอยู่นอกระยะโจมตี (ระยะ ${this.distance(from,target)} > ${this.attackRange(from)})` };
        from.attacksThisTurn++;
        const dmg = (from.wined ? 2 : 1) + (from.luoyiBoost ? 1 : 0);
        const dodgesNeeded = CHAR_PASSIVES[from.character]?.needsTwoDodge ? 2 : 1;
        this.addLog(from.username, `⚔️ โจมตี ${target.username}${dmg > 1 ? ' 🍶+1' : ''}${dodgesNeeded > 1 ? ' (ต้องหลบ 2 ครั้ง!)' : ''}`);
        this.issueAttack(from, target, { color: card.color, dmg, dodgesNeeded, card });
        return { ok: true, logMsg: null };
      }

      case 'Peach': {
        if (from.hp >= from.maxHp) return { ok: false, msg: 'พลังชีวิตเต็มแล้ว' };
        this.heal(from, 1, from);
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
        if (target.hp <= 0) return { ok: false, msg: 'เป้าหมายถูกกำจัดแล้ว' };
        if (this.kongChengProtected(target)) return { ok: false, msg: `${target.username} ใช้กลป้อมปราการเปล่า — เป็นเป้าหมายไม่ได้ขณะไม่มีไพ่` };
        // เป้าหมายผลัดกันเล่นโจมตีกับผู้ใช้ ใครเล่นไม่ได้ก่อนเสีย 1 พลังชีวิต
        // หลู่ปู้ (无双): คู่ประลองที่เผชิญหน้าหลู่ปู้ต้องเล่น [โจมตี] 2 ใบทุกครั้ง
        const atkNeeded = CHAR_PASSIVES[from.character]?.duelTwoAttacks ? 2 : 1;
        this.addLog(from.username, `⚔️ ท้าดวล ${target.username}${atkNeeded > 1 ? ' (ต้องเล่นโจมตี 2 ใบ!)' : ''}`);
        this.requestResponse('duel', target, from, 'Duel', { damage: 1, negatable: true, attacksNeeded: atkNeeded });
        return { ok: true, logMsg: null };
      }

      case 'Steal': {
        if (!target) return { ok: false, msg: 'ต้องเลือกเป้าหมาย' };
        if (target.id === from.id) return { ok: false, msg: 'เลือกตัวเองไม่ได้' };
        if (CHAR_PASSIVES[target.character]?.immuneToSteal)
          return { ok: false, msg: `${target.username} ไม่สามารถถูกขโมยได้ (ลู่ซุ่น: ศักดิ์ศรีแห่งน้ำ)` };
        if (!CHAR_PASSIVES[from.character]?.unlimitedTrickRange && this.distance(from, target) > 1)
          return { ok: false, msg: 'เป้าหมายต้องอยู่ในระยะ 1' };
        if (target.hand.length === 0 && !Object.values(target.equipment).some(Boolean))
          return { ok: false, msg: 'เป้าหมายไม่มีการ์ด/อุปกรณ์' };
        const doSteal = () => {
          const loot = this.takeOneCard(target, true);
          if (loot) { from.hand.push(loot); this.addLog(from.username, `🃏 ขโมยการ์ดจาก ${target.username}`); }
          else this.addLog(from.username, `🃏 ขโมย ${target.username} — แต่ไม่มีการ์ดให้ริบแล้ว`);
        };
        return this.maybeNegate(from, target, 'Steal', doSteal);
      }

      case 'Burning Bridges': {
        if (!target) return { ok: false, msg: 'ต้องเลือกเป้าหมาย' };
        if (target.id === from.id) return { ok: false, msg: 'เลือกตัวเองไม่ได้' };
        if (!CHAR_PASSIVES[from.character]?.unlimitedTrickRange && this.distance(from, target) > 1)
          return { ok: false, msg: 'เป้าหมายต้องอยู่ในระยะ 1' };
        if (target.hand.length === 0 && !Object.values(target.equipment).some(Boolean))
          return { ok: false, msg: 'เป้าหมายไม่มีการ์ด/อุปกรณ์' };
        const doBurn = () => {
          const removed = this.takeOneCard(target, true);
          if (removed) { this.discardPile.push(removed); this.addLog(from.username, `🔥 ทำลายการ์ดของ ${target.username}`); }
          else this.addLog(from.username, `🔥 ทำลายสะพาน ${target.username} — แต่ไม่มีการ์ดแล้ว`);
        };
        return this.maybeNegate(from, target, 'Burning Bridges', doBurn);
      }

      case 'Borrowed Sword': {
        // ยืมดาบสังหาร (借刀杀人): บังคับเป้าหมายที่ "มีอาวุธ" ให้โจมตีผู้ใช้
        // ถ้าไม่ยอมโจมตี (เล่นโจมตีไม่ได้/ไม่เล่น) → ผู้ใช้ริบอาวุธของเป้าหมาย
        if (!target) return { ok: false, msg: 'ต้องเลือกเป้าหมาย' };
        if (target.id === from.id) return { ok: false, msg: 'เลือกตัวเองไม่ได้' };
        if (!target.equipment?.weapon)
          return { ok: false, msg: 'เป้าหมายต้องมีอาวุธจึงจะ "ยืมดาบ" ได้' };
        this.addLog(from.username, `🗡️ ยืมดาบ — บังคับ ${target.username} โจมตี ${from.username} มิฉะนั้นเสียอาวุธ`);
        this.requestResponse('borrow', target, from, 'Borrowed Sword', { damage: 1, negatable: true });
        return { ok: true, logMsg: null };
      }

      case 'Raining Arrows':
      case 'Barbarian Invasion': {
        // การ์ดกลแบบกระทบทุกคน — แต่ละคนต้องตอบโต้
        const need = card.name === 'Raining Arrows' ? 'dodge' : 'attack-resp';
        const victims = this.room.players.filter(p => p.id !== from.id && p.hp > 0);
        const label = card.name === 'Raining Arrows' ? '🏹 ฝนลูกธนูถล่มทุกคน' : '⚔️ บุกทะลวงอนารยชน';
        this.addLog(from.username, label);
        this.requestGroupResponse(need, victims, from, card.name, { damage: 1, negatable: true });
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
          this.heal(p, 1, from);
        });
        return { ok: true, logMsg: `🍑🌸 สาบานในสวนลูกพีช — ทุกคนรักษา 1 พลังชีวิต` };
      }

      case 'Something Out of Nothing': {
        from.hand.push(...this.drawCards(2));
        return { ok: true, logMsg: `✨ สร้างจากความว่างเปล่า — จั่ว 2 ใบ` };
      }

      case 'Lightning': {
        // วางในช่องตัดสินของตน — มีได้ครั้งละ 1 ใบ
        from.judgments = from.judgments || [];
        if (from.judgments.some(c => c.name === 'Lightning'))
          return { ok: false, msg: 'มีสายฟ้าวางอยู่หน้าคุณแล้ว' };
        from.judgments.push(card);
        return { ok: true, noDiscard: true, logMsg: `⚡ วางสายฟ้าหน้าตน — จะตัดสินช่วงต้นตาถัดไป (♠2-9 = ฟ้าผ่า 3 ดาเมจ)` };
      }

      case 'Overindulgence': {
        if (!target) return { ok: false, msg: 'ต้องเลือกเป้าหมาย' };
        if (target.id === from.id) return { ok: false, msg: 'ใช้เสพสุขกับตัวเองไม่ได้' };
        if (CHAR_PASSIVES[target.character]?.immuneToOverindulgence)
          return { ok: false, msg: `${target.username} ไม่ติดมัวเมาได้ (ลู่ซุ่น: ความถ่อมตน)` };
        target.judgments = target.judgments || [];
        if (target.judgments.some(c => c.name === 'Overindulgence'))
          return { ok: false, msg: 'เป้าหมายติดมัวเมาอยู่แล้ว' };
        target.judgments.push(card);
        return { ok: true, noDiscard: true, logMsg: `🍵 ใช้เสพสุขใส่ ${target.username} — เขาจะตัดสินช่วงต้นตา (ไม่ใช่ ♥ = ข้ามเฟสเล่น)` };
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
  //   fireTriggers=true → เรียกทักษะเสียไพ่/เสียอุปกรณ์ (Lian Ying / Xiao Ji)
  takeOneCard(target, fireTriggers = false) {
    if (target.hand.length > 0) {
      const handBefore = target.hand.length;
      const c = target.hand.splice(Math.floor(Math.random() * target.hand.length), 1)[0];
      if (fireTriggers) this.afterHandLoss(target, handBefore);
      return c;
    }
    for (const slot of ['weapon','armor','atkMount','defMount']) {
      if (target.equipment[slot]) {
        const c = target.equipment[slot];
        target.equipment[slot] = null;
        if (fireTriggers) this.afterLoseEquip(target, 1);
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

  // ─── ระบบตอบโต้ (หลบหลีก / โต้ดวล / โจมตีกลับ / ขัดขวาง) ─────────────────────
  //   type: dodge=หลบโจมตี · duel=ท้าดวล(สลับกัน) · borrow=ยืมดาบ · avoidatk=เล่นโจมตีกันดาเมจ · negate=ขัดขวางล้วน
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

    // ── เช็คเกราะ passive ก่อนถามผู้เล่น (เฉพาะการหลบโจมตีจริง) ──
    // ดาบฟ้า (青钢剑) ของผู้โจมตี = ไม่สนเกราะของเป้าหมาย
    const ignoreArmor = source?.equipment?.weapon?.name === 'Blue Steel Sword';
    if (type === 'dodge' && !ignoreArmor) {
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
    } else if (type === 'dodge' && ignoreArmor && responder.equipment?.armor) {
      this.addLog(source.username, `🗡️ [ดาบฟ้า/青钢剑] โจมตีทะลุเกราะของ ${responder.username}`);
    }

    // บอก client ว่าการ์ดประเภทไหนอีกที่ใช้ตอบโต้ได้ (passive ตัวละคร)
    const alsoAccept = [];
    if (type === 'dodge') {
      if (CHAR_PASSIVES[responder.character]?.attackAsDodge) alsoAccept.push('Attack');
      if (CHAR_PASSIVES[responder.character]?.blackAsDodge) alsoAccept.push('_black');
    } else if (type === 'duel' || type === 'borrow' || type === 'avoidatk') {
      if (CHAR_PASSIVES[responder.character]?.dodgeAsAttack) alsoAccept.push('Dodge');
    }
    // ขัดขวาง (无懈可击): การ์ดกล negatable + มี [ขัดขวาง] ในมือ → เล่นยกเลิกผลได้
    const canNegate = !!payload.negatable && responder.hand.some(c => c.name === 'Negation');
    if (canNegate) alsoAccept.push('Negation');

    const need = (type === 'duel' || type === 'borrow' || type === 'avoidatk') ? 'Attack'
      : (type === 'negate') ? 'Negation' : 'Dodge';
    const msg = type === 'duel'   ? `${source.username} ท้าดวลคุณ! เล่นการ์ดโจมตี หรือเสีย 1 พลังชีวิต`
      : type === 'borrow'   ? `${source.username} ใช้ "ยืมดาบ" — เล่นการ์ดโจมตีใส่ ${source.username} มิฉะนั้นเสียอาวุธของคุณ`
      : type === 'avoidatk' ? `${source.username} ใช้ ${cardName} — เล่นการ์ดโจมตี มิฉะนั้นรับความเสียหาย`
      : type === 'negate'   ? `${source.username} ใช้ ${cardName} ใส่คุณ! เล่น [ขัดขวาง] เพื่อยกเลิก หรือปล่อยผ่าน`
      : `${source.username} ใช้ ${cardName} ใส่คุณ! เล่นการ์ดหลบหลีก หรือรับความเสียหาย`;

    const sock = io.sockets.sockets.get(responder.socketId);
    if (sock) sock.emit('awaitResponse', {
      type, need, cardName, alsoAccept, canNegate,
      dodgesNeeded: payload.dodgesNeeded || 1,
      from: source.username, msg,
    });
    this.broadcast();
  }

  // ดำเนินเกมต่อหลังจบการตอบโต้ 1 ครั้ง (มีคิวกลุ่ม → คนต่อไป, ไม่งั้นกลับสู่เฟสเล่น)
  _continueAfterResponse() {
    if (this.dyingPlayerId) return;            // รอเพอชอยู่ — อย่าเพิ่งเดินต่อ
    if (this.groupQueue) { this.nextGroupResponse(); return; }
    if (this.room.state === 'ended') return;
    const cur = this.room.players[this.currentPlayer];
    if (!cur || cur.hp <= 0) return this.finishTurn();  // ผู้เล่นปัจจุบันตาย → ส่งตาต่อ
    this.phase = 'play';
    this.startTimer();
    this.broadcast();
  }

  // เวอร์ชันกระทบหลายคน — เก็บคิวแล้วถามทีละคน
  requestGroupResponse(type, victims, source, cardName, payload) {
    this.groupQueue = victims.map(v => v.id);
    // attack-resp = เล่นโจมตีกันดาเมจ (ไม่ใช่ดวลแบบสลับกัน)
    this.groupType = type === 'attack-resp' ? 'avoidatk' : 'dodge';
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

    // ── ขัดขวาง (无懈可击): การ์ดกล negatable → ยกเลิกผลทั้งหมด ──
    if (!autoDefend && cardId && payload.negatable) {
      const ni = responder.hand.findIndex(c => c.id === cardId && c.name === 'Negation');
      if (ni >= 0) {
        const used = responder.hand.splice(ni, 1)[0];
        this.discardPile.push(used);
        this.addLog(responder.username, `🚫 ขัดขวาง (无懈可击) — ยกเลิกผลของ ${cardName}!`);
        this.pending = null;
        return this._continueAfterResponse(), { ok: true };
      }
    }

    // ── หน้าต่างขัดขวางล้วน (ขโมย/ทำลายสะพาน) — เล่นขัดขวาง หรือปล่อยให้เอฟเฟคทำงาน ──
    if (type === 'negate') {
      let negated = false;
      if (!autoDefend && cardId) {
        const ni = responder.hand.findIndex(c => c.id === cardId && c.name === 'Negation');
        if (ni >= 0) {
          const u = responder.hand.splice(ni, 1)[0];
          this.discardPile.push(u);
          negated = true;
          this.addLog(responder.username, `🚫 ขัดขวาง — ยกเลิกผลของ ${cardName}!`);
        }
      }
      this.pending = null;
      if (!negated && typeof payload.onApply === 'function') payload.onApply();
      return this._continueAfterResponse(), { ok: true };
    }

    // ── ตอบโต้ด้วยการ์ด (หลบหลีก / โจมตี) ──
    let defended = autoDefend;
    let usedCard = null;
    if (!autoDefend && cardId) {
      const idx = responder.hand.findIndex(c => c.id === cardId);
      if (idx >= 0) {
        const card = responder.hand[idx];
        let cardCounts = false;
        if (type === 'dodge') {
          cardCounts = card.name === 'Dodge'
            || (CHAR_PASSIVES[responder.character]?.attackAsDodge && card.name === 'Attack')
            || (CHAR_PASSIVES[responder.character]?.blackAsDodge && card.color === 'black');
        } else if (type === 'duel' || type === 'borrow' || type === 'avoidatk') {
          cardCounts = card.name === 'Attack'
            || (CHAR_PASSIVES[responder.character]?.dodgeAsAttack && card.name === 'Dodge');
        }
        if (cardCounts) {
          usedCard = responder.hand.splice(idx, 1)[0];
          this.discardPile.push(usedCard);
          defended = true;
          this.addLog(responder.username, type === 'dodge' ? `🛡️ หลบหลีกสำเร็จ (${usedCard.name})` : `⚔️ เล่น ${usedCard.name}`);
        }
      }
    }

    // ── ทักษะเจ้านาย (护驾/激将): เจ้านายไม่ป้องกันเอง → ขอให้ฝ่ายเดียวกันเล่นแทน ──
    if (!defended && !this._lordAssistDone) {
      const la = this._lordAssistFor(responder, type);
      if (la) {
        this.lordAssist = { lordId: responder.id, type, sourceId: source?.id, cardName, need: la.need, queue: la.queue, idx: 0 };
        this._promptLordAssist();   // pending ยังอยู่ — เมื่อจบจะเรียก resolveResponse ซ้ำ
        return { ok: true };
      }
    }
    this._lordAssistDone = false;

    this.pending = null;

    // ── ยืมดาบ (借刀杀人) ──
    if (type === 'borrow') {
      if (defended) {
        // เป้าหมายยอมใช้ดาบโจมตีผู้ใช้ → ผู้ใช้ต้องหลบ
        this.addLog(responder.username, `🗡️ ${responder.username} ใช้ดาบโจมตี ${source.username}!`);
        const dn = CHAR_PASSIVES[responder.character]?.needsTwoDodge ? 2 : 1;
        this.requestResponse('dodge', source, responder, 'Attack',
          { damage: payload.damage, attackCardColor: usedCard?.color || 'black', dodgesNeeded: dn });
        return { ok: true };
      }
      const wp = responder.equipment?.weapon;
      if (wp) {
        responder.equipment.weapon = null;
        source.hand.push(wp);
        this.addLog(source.username, `🗡️ ยืมดาบสำเร็จ — ริบอาวุธ "${wp.name}" จาก ${responder.username}`);
        this.afterLoseEquip(responder, 1);
      } else {
        this.addLog(source.username, `🗡️ ยืมดาบ — ${responder.username} ไม่มีอาวุธให้ริบแล้ว`);
      }
      return this._continueAfterResponse(), { ok: true };
    }

    // ── ท้าดวล (决斗): สลับกันโจมตีจนมีฝ่ายเล่นไม่ได้ ──
    if (type === 'duel') {
      const need = payload.attacksNeeded || 1;
      if (defended) {
        // หลู่ปู้ (无双): ฝ่ายที่เผชิญหน้าต้องเล่นโจมตีให้ครบก่อน จึงนับว่าโต้สำเร็จ
        if (need > 1) {
          this.addLog(responder.username, `⚔️ ต้องเล่นโจมตีอีก ${need - 1} ใบ (无双)`);
          this.requestResponse('duel', responder, source, 'Duel', { ...payload, negatable: false, attacksNeeded: need - 1 });
          return { ok: true };
        }
        const swapNeed = CHAR_PASSIVES[responder.character]?.duelTwoAttacks ? 2 : 1;
        this.addLog(source.username, `↩️ ${responder.username} โต้! ตอนนี้ ${source.username} ต้องโจมตี${swapNeed > 1 ? ' 2 ใบ' : ''}`);
        this.requestResponse('duel', source, responder, 'Duel', { damage: payload.damage, attacksNeeded: swapNeed });
        return { ok: true };
      }
      this.dealDamage(responder, payload.damage, source);
      if (!this.dyingPlayerId) this._continueAfterResponse();
      return { ok: true };
    }

    // ── เล่นโจมตีเพื่อกันดาเมจ (南蛮入侵) — ไม่มีการสลับ ──
    if (type === 'avoidatk') {
      if (!defended) this.dealDamage(responder, payload.damage, source);
      else this.addLog(responder.username, `⚔️ เล่นโจมตีกันได้ — ไม่รับความเสียหาย`);
      if (!this.dyingPlayerId) this._continueAfterResponse();
      return { ok: true };
    }

    // ── หลบโจมตี (dodge) ──
    if (!defended) {
      this.addLog(responder.username, '💢 ไม่ได้หลบ — รับความเสียหาย');
      const atkCtx = { card: payload.card, isAttack: true, color: payload.attackCardColor };
      // Frost Sword (冰封剑): แทนการทำดาเมจ → ให้เป้าหมายทิ้งการ์ด 2 ใบ
      if (source?.equipment?.weapon?.name === 'Frost Sword' && responder.hand.length >= 2 && responder.hp > 1) {
        const handBefore = responder.hand.length;
        const lost = [responder.hand.pop(), responder.hand.pop()];
        lost.forEach(c => this.discardPile.push(c));
        this.addLog(source.username, `❄️ [ดาบน้ำแข็ง/冰封剑] ยกเลิกดาเมจ — ${responder.username} ทิ้งการ์ด 2 ใบแทน`);
        this.afterHandLoss(responder, handBefore);
        if (!this.dyingPlayerId) this._continueAfterResponse();
        return { ok: true };
      }
      // Kirin Bow (麒麟弓): เมื่อโจมตีโดน ทำลายม้าของเป้าหมาย
      if (source?.equipment?.weapon?.name === 'Kirin Bow') {
        const mountSlot = responder.equipment?.atkMount ? 'atkMount' : (responder.equipment?.defMount ? 'defMount' : null);
        if (mountSlot) {
          const mount = responder.equipment[mountSlot];
          responder.equipment[mountSlot] = null;
          this.discardPile.push(mount);
          this.addLog(source.username, `🏹 [ธนูกิเลน/麒麟弓] ทำลายม้าของ ${responder.username}: ${mount.name}`);
          this.afterLoseEquip(responder, 1);
        }
      }
      this.dealDamage(responder, payload.damage, source, atkCtx);
      if (!this.dyingPlayerId) this._continueAfterResponse();
      return { ok: true };
    }

    // หลบสำเร็จ — แต่ Lv Bu (无双) บังคับหลบ 2 ครั้ง
    if (dodgesNeeded > 1) {
      this.addLog(responder.username, `🛡️ หลบ 1/${dodgesNeeded} — ต้องหลบอีก ${dodgesNeeded - 1} ครั้ง`);
      this.requestResponse('dodge', responder, source, cardName, { ...payload, dodgesNeeded: dodgesNeeded - 1 });
      return { ok: true };
    }
    // Green Dragon Blade (青龙偃月刀): โจมตีถูกหลบ → ใช้โจมตีอีกใบโจมตีซ้ำอัตโนมัติ
    if (source?.equipment?.weapon?.name === 'Green Dragon Blade' && !payload.gdbDone) {
      const ai = source.hand.findIndex(c => c.name === 'Attack');
      if (ai >= 0) {
        const atk = source.hand.splice(ai, 1)[0];
        this.discardPile.push(atk);
        this.addLog(source.username, `🐉 [ง้าวมังกรเขียว/青龙偃月刀] ${responder.username} หลบได้ — โจมตีซ้ำอีกครั้ง!`);
        const dn = CHAR_PASSIVES[source.character]?.needsTwoDodge ? 2 : 1;
        this.requestResponse('dodge', responder, source, 'Attack',
          { damage: payload.damage, attackCardColor: atk.color, dodgesNeeded: dn, gdbDone: true });
        return { ok: true };
      }
    }
    // Rock Cleaving Axe (贯石斧): โจมตีถูกหลบ → ทิ้ง 2 ใบบังคับดาเมจ (อัตโนมัติเมื่อเป้าหมายใกล้ตาย)
    if (source?.equipment?.weapon?.name === 'Rock Cleaving Axe' && responder.hp <= 2 && source.hand.length >= 2) {
      const lost = [source.hand.pop(), source.hand.pop()];
      lost.forEach(c => this.discardPile.push(c));
      this.addLog(source.username, `🪓 [ขวานผ่าหิน/贯石斧] ทิ้งการ์ด 2 ใบ — บังคับดาเมจทะลุการหลบ!`);
      this.dealDamage(responder, payload.damage, source);
    }
    if (!this.dyingPlayerId) this._continueAfterResponse();
    return { ok: true };
  }

  // ─── ทำความเสียหาย + ตรวจการตาย ── คืน true ถ้าเข้าสภาวะใกล้ตาย ─────────────────
  //   ctx = { card, isAttack, color } — บริบทแหล่งที่มา (ใช้กับทักษะ trigger ตอนรับดาเมจ)
  dealDamage(player, amount, source, ctx = {}) {
    player.hp -= amount;
    this.addLog('ระบบ', `💔 ${player.username} เสีย ${amount} พลังชีวิต (เหลือ ${Math.max(0,player.hp)})`);
    if (player.hp <= 0) { this.enterDying(player, source); return true; }
    this.afterDamage(player, amount, source, ctx);   // ทริกเกอร์ทักษะหลังรับดาเมจ
    this.broadcast();
    return false;
  }

  // เข้าสู่สภาวะใกล้ตาย — ขอ [เพอช] จากทุกคนตามลำดับ (ตัวเองก่อน แล้วไล่ตามที่นั่ง)
  enterDying(player, source) {
    if (player.hp > 0) player.hp = 0;
    this.addLog('ระบบ', `⚠️ ${player.username} ใกล้ตาย! ใครก็ได้ที่มี [เพอช] ใช้ช่วยได้`);
    const players = this.room.players;
    const order = [player.id];
    const startIdx = players.indexOf(player);
    for (let i = 1; i <= players.length; i++) {
      const p = players[(startIdx + i) % players.length];
      if (p && p.hp > 0 && p.id !== player.id) order.push(p.id);
    }
    this.dying = { playerId: player.id, sourceId: source?.id || null, order, idx: 0 };
    this.dyingPlayerId = player.id;
    this._dyingAsync = false;   // true เมื่อมีการเปิดหน้าต่างถามเพอช (รอ async)
    this.promptDyingSave();
  }

  // ถามผู้ช่วยคนถัดไปที่มี [เพอช] — รอดเมื่อ hp>0, ตายเมื่อหมดคิว
  promptDyingSave() {
    const d = this.dying;
    if (!d) return;
    const dying = this.room.players.find(p => p.id === d.playerId);
    if (!dying) { this.dying = null; this.dyingPlayerId = null; return; }
    if (dying.hp > 0) return this.finishDying(true);
    while (d.idx < d.order.length) {
      const saver = this.room.players.find(p => p.id === d.order[d.idx]);
      // หัวถัว (急救): ในตาคนอื่นใช้ไพ่แดงแทน [ลูกท้อ] → ถือว่ามี [เพอช]
      const huatuoRed = saver && CHAR_PASSIVES[saver.character]?.redAsPeach
        && this.room.players[this.currentPlayer]?.id !== saver.id
        && saver.hand.some(c => c.color === 'red');
      if (saver && saver.hp > 0 && (saver.hand.some(c => c.name === 'Peach') || huatuoRed)) {
        clearInterval(this.dyingTimer);
        this._dyingAsync = true;
        this.timer = 20;
        this.dyingTimer = setInterval(() => {
          this.timer--;
          io.to(this.room.code).emit('timerTick', this.timer);
          if (this.timer <= 0) { clearInterval(this.dyingTimer); this.declinePeach(saver.id); }
        }, 1000);
        const sock = io.sockets.sockets.get(saver.socketId);
        if (sock) sock.emit('askPeach', {
          forId: d.playerId,
          msg: saver.id === d.playerId
            ? 'คุณใกล้ตาย! ใช้ [เพอช] เพื่อรอดหรือไม่?'
            : `${dying.username} ใกล้ตาย! ใช้ [เพอช] ช่วยหรือไม่?`,
        });
        this.broadcast();
        return;
      }
      d.idx++;
    }
    this.finishDying(false);
  }

  // ผู้ช่วย (ตัวเองหรือคนอื่น) ใช้ [เพอช] กับผู้ใกล้ตาย
  usePeachToSave(saverId, cardId) {
    const d = this.dying;
    if (!d) return { ok: false, msg: 'ตอนนี้ไม่มีใครใกล้ตาย' };
    if (d.order[d.idx] !== saverId) return { ok: false, msg: 'ยังไม่ถึงตาคุณใช้เพอช' };
    const saver = this.room.players.find(p => p.id === saverId);
    if (!saver) return { ok: false };
    // หัวถัว (急救): ในตาคนอื่นใช้ไพ่แดงแทน [ลูกท้อ] ได้
    const huatuoRed = CHAR_PASSIVES[saver.character]?.redAsPeach
      && this.room.players[this.currentPlayer]?.id !== saver.id;
    const idx = saver.hand.findIndex(c => c.id === cardId
      && (c.name === 'Peach' || (huatuoRed && c.color === 'red')));
    if (idx < 0) return { ok: false, msg: 'ไม่มีเพอช' };
    const used = saver.hand.splice(idx, 1)[0];
    this.discardPile.push(used);
    const dying = this.room.players.find(p => p.id === d.playerId);
    // ซุนฉวน (孙权) — Jiu Yuan (救援): ฝ่ายง่อก๊กใช้ [เพอช] กับซุนฉวน → ฟื้นเพิ่ม 1
    let amt = 1;
    if (CHAR_PASSIVES[dying.character]?.jiuyuan && saver.id !== dying.id && kingdomOf(saver.character) === 'WU') amt = 2;
    this.heal(dying, amt, saver);
    if (used.name !== 'Peach') this.addLog(saver.username, `💊 [ปฐมพยาบาล/急救] ใช้ไพ่แดงแทน [ลูกท้อ]`);
    this.addLog(saver.username, saver.id === dying.id
      ? `🍑 ใช้เพอชช่วยตัวเองรอดตายอย่างหวุดหวิด!${amt > 1 ? ' (+1 救援)' : ''}`
      : `🍑 ใช้เพอชช่วย ${dying.username} ให้รอดตาย!${amt > 1 ? ' (+1 救援)' : ''}`);
    clearInterval(this.dyingTimer);
    this.promptDyingSave();
    return { ok: true };
  }

  // ผู้ช่วยคนปัจจุบันปฏิเสธ → ถามคนถัดไป
  declinePeach(saverId) {
    const d = this.dying;
    if (!d || d.order[d.idx] !== saverId) return;
    d.idx++;
    clearInterval(this.dyingTimer);
    this.promptDyingSave();
  }

  // จบสภาวะใกล้ตาย — รอด (survived) หรือ ตาย
  //   wasAsync=true → เปิดหน้าต่างถามเพอชไปแล้ว ต้องขับเคลื่อนเดินเกมต่อเอง
  //   wasAsync=false → ตายทันที(ไม่มีใครมีเพอช) ปล่อยให้ผู้เรียก (resolveResponse/runJudgments) เดินต่อ
  finishDying(survived) {
    clearInterval(this.dyingTimer);
    const d = this.dying;
    const wasAsync = this._dyingAsync;
    this.dying = null;
    this.dyingPlayerId = null;
    this._dyingAsync = false;
    if (!d) return;
    const player = this.room.players.find(p => p.id === d.playerId);
    if (!survived && player) {
      const source = d.sourceId ? this.room.players.find(p => p.id === d.sourceId) : null;
      this.killPlayer(player, source);
    }
    if (!wasAsync) { this.broadcast(); return; }   // โหมด sync — ผู้เรียกจะเดินเกมต่อเอง
    if (this.room.state === 'ended') { this.broadcast(); return; }
    const cur = this.room.players[this.currentPlayer];
    // ใกล้ตายจาก Xiao Guo (骁果) ช่วงท้ายตา → เดินคิว Xiao Guo / ส่งตาต่อ
    if (this._xiaoguoAdvance) {
      this._xiaoguoAdvance = false;
      if (this.xiaoguo) { this.xiaoguo.idx++; this.xiaoguo.phase = 'ask'; return this._promptXiaoguo(); }
      return this._advanceTurn();
    }
    // ใกล้ตายระหว่างเฟสตัดสิน (สายฟ้า) ของผู้เล่นปัจจุบัน → ต่อด้วยเฟสจั่ว/จบตา
    if (this._resumeTurn && cur && cur.id === d.playerId) return this.afterJudgment(player);
    this._continueAfterResponse();
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

    // หลู่เมิ่ง (吕蒙) — Ke Ji (克己): ไม่ได้ใช้ [โจมตี] ในตานี้ → ข้ามเฟสทิ้งการ์ดได้ (auto)
    if (CHAR_PASSIVES[cur.character]?.keji && (cur.attacksThisTurn || 0) === 0 && cur.hand.length > cur.hp) {
      this.addLog(cur.username, `🧘 [ความสงบนิ่ง/克己] ไม่ได้โจมตีในตานี้ — ข้ามเฟสทิ้งการ์ด`);
      return this.finishTurn();
    }

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
    // เตียวเสี้ยน (貂蝉) — Bi Yue (闭月): ช่วงท้ายเทิร์น จั่ว 1 ใบ (auto)
    if (CHAR_PASSIVES[cur.character]?.biyue && cur.hp > 0) {
      cur.hand.push(...this.drawCards(1));
      this.addLog(cur.username, `🌙 [ความงามบังจันทร์/闭月] ช่วงท้ายเทิร์น — จั่ว 1 ใบ`);
    }
    this.addLog(cur.username, `จบตา (เหลือไพ่ ${cur.hand.length} ใบ)`);

    // เยว่จิน (乐进) — Xiao Guo (骁果): ช่วงท้ายเทิร์นของคนอื่น เปิดหน้าต่างให้เยว่จิน
    const xq = this._xiaoguoQueue(cur);
    if (xq.length && cur.hp > 0) {
      this.xiaoguo = { turnPlayerId: cur.id, queue: xq, idx: 0, phase: 'ask', yuejinId: null };
      this._promptXiaoguo();
      return;   // พัก — จะ _advanceTurn เมื่อจบ Xiao Guo
    }
    this._advanceTurn();
  }

  // ส่งตาให้ผู้เล่นคนถัดไปที่ยังมีชีวิต
  _advanceTurn() {
    const players = this.room.players;
    let next = (this.currentPlayer + 1) % players.length;
    let tries = 0;
    while (players[next].hp <= 0 && tries < players.length) {
      next = (next + 1) % players.length;
      tries++;
    }
    this.currentPlayer = next;
    if (this.room.state !== 'ended') this.runTurn();
  }

  // ─── Xiao Guo (骁果) ของเยว่จิน — ช่วงท้ายเทิร์นคนอื่น ─────────────────────────────
  _xiaoguoQueue(cur) {
    return this.room.players.filter(p => p.hp > 0 && p.id !== cur.id
      && CHAR_PASSIVES[p.character]?.xiaoguo && p.hand.some(c => c.type === 'basic')).map(p => p.id);
  }

  _promptXiaoguo() {
    const xg = this.xiaoguo;
    if (!xg) return;
    while (xg.idx < xg.queue.length) {
      const yuejin = this.room.players.find(p => p.id === xg.queue[xg.idx]);
      const target = this.room.players.find(p => p.id === xg.turnPlayerId);
      if (yuejin && yuejin.hp > 0 && target && target.hp > 0 && yuejin.hand.some(c => c.type === 'basic')) {
        xg.phase = 'ask'; xg.yuejinId = yuejin.id;
        clearInterval(this.xiaoguoTimer);
        this.timer = 20;
        this.xiaoguoTimer = setInterval(() => {
          this.timer--;
          io.to(this.room.code).emit('timerTick', this.timer);
          if (this.timer <= 0) { clearInterval(this.xiaoguoTimer); this.useXiaoguo(yuejin.id, null); }
        }, 1000);
        const sock = io.sockets.sockets.get(yuejin.socketId);
        if (sock) sock.emit('askXiaoguo', { targetName: target.username });
        this.broadcast();
        return;
      }
      xg.idx++;
    }
    this._finishXiaoguo();
  }

  _finishXiaoguo() {
    clearInterval(this.xiaoguoTimer);
    this.xiaoguo = null;
    this._advanceTurn();
  }

  // เยว่จินตัดสินใจใช้ Xiao Guo (cardId = การ์ดพื้นฐานที่ทิ้ง, null = ไม่ใช้)
  useXiaoguo(yuejinId, cardId) {
    const xg = this.xiaoguo;
    if (!xg || xg.phase !== 'ask' || xg.yuejinId !== yuejinId) return { ok: false, msg: 'ไม่มีหน้าต่าง Xiao Guo' };
    clearInterval(this.xiaoguoTimer);
    const yuejin = this.room.players.find(p => p.id === yuejinId);
    const target = this.room.players.find(p => p.id === xg.turnPlayerId);
    if (!cardId || !yuejin || !target) { xg.idx++; this._promptXiaoguo(); return { ok: true }; }
    const idx = yuejin.hand.findIndex(c => c.id === cardId && c.type === 'basic');
    if (idx < 0) return { ok: false, msg: 'ต้องทิ้งการ์ดพื้นฐาน 1 ใบ' };
    const handBefore = yuejin.hand.length;
    const disc = yuejin.hand.splice(idx, 1)[0];
    this.discardPile.push(disc);
    this.addLog(yuejin.username, `🎯 [ไม่หวั่นเกรง/骁果] ทิ้ง ${disc.name} — บีบ ${target.username}`);
    this.afterHandLoss(yuejin, handBefore);
    const hasEquip = Object.values(target.equipment).some(Boolean);
    if (!hasEquip) {
      // ไม่มีอุปกรณ์ให้ทิ้ง → รับ 1 ดาเมจทันที
      this.addLog(target.username, `🎯 ไม่มีอุปกรณ์ — รับ 1 ดาเมจ (骁果)`);
      this._xiaoguoAdvance = true;
      this.dealDamage(target, 1, yuejin);
      if (this.dyingPlayerId) return { ok: true };   // รอเพอช → finishDying เดินต่อ
      this._xiaoguoAdvance = false;
      xg.idx++; xg.phase = 'ask'; this._promptXiaoguo();
      return { ok: true };
    }
    // มีอุปกรณ์ → ถามเป้าหมายให้เลือกทิ้งอุปกรณ์ หรือ รับดาเมจ
    xg.phase = 'respond';
    this.timer = 20;
    this.xiaoguoTimer = setInterval(() => {
      this.timer--;
      io.to(this.room.code).emit('timerTick', this.timer);
      if (this.timer <= 0) { clearInterval(this.xiaoguoTimer); this.respondXiaoguo(target.id, null); }
    }, 1000);
    const sock = io.sockets.sockets.get(target.socketId);
    if (sock) sock.emit('askXiaoguoRespond', { yuejinName: yuejin.username });
    this.broadcast();
    return { ok: true };
  }

  // เป้าหมายตอบ Xiao Guo (equipSlot = ทิ้งอุปกรณ์ช่องนั้น, null = ยอมรับ 1 ดาเมจ)
  respondXiaoguo(targetId, equipSlot) {
    const xg = this.xiaoguo;
    if (!xg || xg.phase !== 'respond' || xg.turnPlayerId !== targetId) return { ok: false, msg: 'ไม่มีหน้าต่าง Xiao Guo' };
    clearInterval(this.xiaoguoTimer);
    const target = this.room.players.find(p => p.id === targetId);
    const yuejin = this.room.players.find(p => p.id === xg.yuejinId);
    if (equipSlot && target.equipment[equipSlot]) {
      const eq = target.equipment[equipSlot];
      target.equipment[equipSlot] = null;
      this.discardPile.push(eq);
      this.addLog(target.username, `⚙️ ทิ้งอุปกรณ์ "${eq.name}" (骁果)`);
      this.afterLoseEquip(target, 1);
      xg.idx++; xg.phase = 'ask'; this._promptXiaoguo();
      return { ok: true };
    }
    this.addLog(target.username, `🎯 ไม่ทิ้งอุปกรณ์ — รับ 1 ดาเมจ (骁果)`);
    this._xiaoguoAdvance = true;
    this.dealDamage(target, 1, yuejin);
    if (this.dyingPlayerId) return { ok: true };
    this._xiaoguoAdvance = false;
    xg.idx++; xg.phase = 'ask'; this._promptXiaoguo();
    return { ok: true };
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

  socket.on('playCard', ({ cardId, targetId, asName }) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    const result = room.game.playCard(info.playerId, cardId, targetId, asName || null);
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
  socket.on('drawCards', (opts = {}) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    const result = room.game.playerDraw(info.playerId, false, opts || {});
    if (result && !result.ok && result.msg) socket.emit('error', result.msg);
  });

  // เป้าหมายของ Fan Jian (反间) ทายชนิดไพ่
  socket.on('fanjianGuess', ({ suit }) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    const result = room.game.resolveFanjian(info.playerId, suit);
    if (result && !result.ok && result.msg) socket.emit('error', result.msg);
  });

  // ซือหม่าอี้ใช้ Gui Cai (鬼才) เปลี่ยนไพ่ตัดสิน (cardId=null = ไม่เปลี่ยน)
  socket.on('guicaiReplace', ({ cardId }) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    room.game.resolveGuicai(info.playerId, cardId || null);
  });

  // เยว่จิน/ผู้เล่นตอบ Xiao Guo (骁果) — discardId(ผู้ใช้) หรือ targetEquipSlot/รับดาเมจ
  socket.on('xiaoguoUse', ({ cardId }) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    const result = room.game.useXiaoguo(info.playerId, cardId || null);
    if (result && !result.ok && result.msg) socket.emit('error', result.msg);
  });

  socket.on('xiaoguoRespond', ({ equipSlot }) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    room.game.respondXiaoguo(info.playerId, equipSlot || null);
  });

  // ทักษะเจ้านาย: ฝ่ายเดียวกันเสนอเล่นการ์ดแทน (Hu Jia / Ji Jiang)
  socket.on('lordAssist', ({ cardId }) => {
    const info = sockets.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room || !room.game) return;
    room.game.resolveLordAssist(info.playerId, cardId || null);
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

/* ─── WTK Frontend Game Client ───────────────────────────────────────── */

const socket = io();
let STATE = {
  playerId: localStorage.getItem('wtk_pid') || null,
  username: localStorage.getItem('wtk_name') || '',
  roomCode: localStorage.getItem('wtk_room') || null,
  room: null,
  selectedCard: null,
  selectedTarget: null,
  selectingTarget: false,
  currentScreen: 'menu',
  charFilter: 'WEI',
  selectedChar: null,
  draftSelected: null,   // ตัวละครที่กำลังเลือกในขั้นตอนดราฟต์
};

// ─── Screen Manager ────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');
  STATE.currentScreen = name;
}

// ─── Notifications ─────────────────────────────────────────────────────
function notify(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('notif-container');
  const el = document.createElement('div');
  el.className = `notif ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ─── จำนวนการ์ดแต่ละใบในสำรับ (รวม 108 ใบ) ───────────────────────────────────
window.CARD_COUNTS = {
  'Attack': 30, 'Dodge': 15, 'Peach': 8,
  'Something Out of Nothing': 4, 'Duel': 3, 'Burning Bridges': 6, 'Steal': 5,
  'Borrowed Sword': 2, 'Negation': 3, 'Barbarian Invasion': 3, 'Raining Arrows': 1,
  'Oath of the Peach Garden': 1, 'Bumper Harvest': 2, 'Lightning': 2, 'Overindulgence': 3,
  'Zhuge Crossbow': 2, 'Yin-Yang Swords': 1, 'Blue Steel Sword': 1, 'Frost Sword': 1,
  'Green Dragon Blade': 1, 'Serpent Spear': 1, 'Rock Cleaving Axe': 1,
  'Sky Piercing Halberd': 1, 'Kirin Bow': 1,
  'Eight Trigrams Formation': 2, 'Nio Shield': 1,
  'Fergana Steed': 3, 'Shadowrunner': 3,
};

// ─── Tooltip System ────────────────────────────────────────────────────
const tooltip = document.getElementById('tooltip');
let tooltipTimer = null;

function showTooltip(html, x, y) {
  clearTimeout(tooltipTimer);
  tooltip.innerHTML = html;
  positionTooltip(x, y);
  tooltipTimer = setTimeout(() => tooltip.classList.add('visible'), 100);
}

function hideTooltip() {
  clearTimeout(tooltipTimer);
  tooltip.classList.remove('visible');
}

function positionTooltip(x, y) {
  const tw = 280, th = 400;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = x + 16, top = y - 20;
  if (left + tw > vw - 10) left = x - tw - 16;
  if (top + th > vh - 10) top = vh - th - 10;
  if (top < 10) top = 10;
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

document.addEventListener('mousemove', e => {
  if (tooltip.classList.contains('visible')) positionTooltip(e.clientX, e.clientY);
});

// ─── Character Tooltip HTML ─────────────────────────────────────────────
function charTooltipHTML(charId) {
  const c = window.CHAR_DATA[charId];
  if (!c) return '';
  const kname = { WEI: 'เว่ย', SHU: 'สู่', WU: 'อู๋', QUN: 'ไม่สังกัด' }[c.kingdom] || c.kingdom;
  const hearts = Array.from({length: c.hp}, () => '❤️').join('');
  const diff = Array.from({length: 5}, (_, i) => i < c.difficulty ? '⭐' : '☆').join('');
  const skillsHTML = c.skills.map(s => `
    <div class="tooltip-skill">
      <div class="tooltip-skill-name">【${s.name}】<span style="color:var(--text-dim);font-weight:400;font-size:0.72rem"> ${s.nameEn}</span></div>
      <div class="tooltip-skill-desc">${s.desc}</div>
    </div>
  `).join('');
  return `
    <div class="tooltip-header">
      <img class="tooltip-img" src="${c.image}" alt="${c.nameTh}" onerror="this.style.display='none'">
      <div class="tooltip-title-area">
        <div class="tooltip-name">${c.nameTh}</div>
        <div class="tooltip-sub">${c.nameEn} · ${c.nameZh}</div>
        <div class="tooltip-hp">❤️ ${c.hp} HP${c.role === 'Lord' ? ' (+1 Lord)' : ''}</div>
        <span class="kingdom-badge kb-${c.kingdom}">${kname}</span>
      </div>
    </div>
    <div class="tooltip-body">
      <div class="tooltip-section-title">ประวัติ</div>
      <div class="tooltip-desc">${c.lore}</div>
      <div class="tooltip-section-title">ทักษะ</div>
      ${skillsHTML}
      <div style="font-size:0.75rem;color:var(--text-dim)">ความยาก: ${diff}</div>
    </div>
  `;
}

// ─── Card Tooltip HTML ─────────────────────────────────────────────────
function cardTooltipHTML(cardName) {
  const c = window.CARD_DATA[cardName];
  if (!c) return `<div class="tooltip-body"><div class="tooltip-name">${cardName}</div></div>`;
  const typeLabel = { basic: 'การ์ดพื้นฐาน', stratagem: 'การ์ดกล', weapon: 'อาวุธ', armor: 'เกราะ', mount: 'ม้า' }[c.type] || c.type;
  const typeBg = { basic: '#c0392b', stratagem: '#8e44ad', weapon: '#f39c12', armor: '#2980b9', mount: '#27ae60' }[c.type] || '#666';
  const rangeInfo = c.range ? `<div style="font-size:0.75rem;color:var(--text-dim)">📏 ระยะ: ${c.range}</div>` : '';
  const cnt = window.CARD_COUNTS[cardName];
  const countInfo = cnt ? `<div style="font-size:0.72rem;color:var(--gold)">🎴 มีในสำรับ: ${cnt} ใบ</div>` : '';
  const usageHTML = c.usage ? `<div class="tooltip-usage">📖 วิธีใช้: ${c.usage}</div>` : '';
  const tipsHTML = c.tips ? `<div class="tooltip-tips">${c.tips}</div>` : '';
  return `
    <div class="tooltip-header">
      <img class="tooltip-img" src="${c.image}" alt="${c.nameTh}" onerror="this.style.display='none'" style="width:46px;height:64px">
      <div class="tooltip-title-area">
        <div class="tooltip-name">${c.nameTh}</div>
        <div class="tooltip-sub">${c.nameEn}</div>
        <span class="tooltip-type-badge" style="background:${typeBg}22;color:${typeBg};border:1px solid ${typeBg}66">${typeLabel}</span>
        ${rangeInfo}
        ${countInfo}
      </div>
    </div>
    <div class="tooltip-body">
      <div class="tooltip-section-title">คำอธิบาย</div>
      <div class="tooltip-desc">${c.desc}</div>
      ${usageHTML}
      ${tipsHTML}
    </div>
  `;
}

// ─── Role Tooltip HTML ─────────────────────────────────────────────────
function roleTooltipHTML(roleName) {
  const r = window.ROLE_DATA[roleName];
  if (!r) return '';
  return `
    <div class="tooltip-header">
      <img class="tooltip-img" src="${r.image}" alt="${r.nameTh}" style="width:46px;height:64px">
      <div class="tooltip-title-area">
        <div class="tooltip-name">${r.nameTh}</div>
        <div class="tooltip-sub">${r.nameEn}</div>
        <span class="tooltip-type-badge" style="background:${r.color}22;color:${r.color};border:1px solid ${r.color}66">${r.nameTh}</span>
      </div>
    </div>
    <div class="tooltip-body">
      <div class="tooltip-desc">${r.desc}</div>
      <div class="tooltip-skill">
        <div class="tooltip-skill-name">🎯 เป้าหมาย</div>
        <div class="tooltip-skill-desc">${r.goal}</div>
      </div>
      <div class="tooltip-tips">${r.tips}</div>
    </div>
  `;
}

// ─── Hover Handlers ────────────────────────────────────────────────────
function addTooltipHover(el, getHTML) {
  el.addEventListener('mouseenter', e => showTooltip(getHTML(), e.clientX, e.clientY));
  el.addEventListener('mouseleave', hideTooltip);
}

// ─── Socket Events ──────────────────────────────────────────────────────
socket.on('connect', () => {
  console.log('[WTK] Connected to server');
  // Try to reconnect to previous room
  if (STATE.playerId && STATE.roomCode && STATE.username) {
    socket.emit('joinRoom', {
      roomCode: STATE.roomCode,
      username: STATE.username,
      playerId: STATE.playerId
    });
  }
});

socket.on('roomCreated', ({ roomCode, playerId }) => {
  STATE.playerId = playerId;
  STATE.roomCode = roomCode;
  localStorage.setItem('wtk_pid', playerId);
  localStorage.setItem('wtk_room', roomCode);
  showScreen('lobby');
  notify('สร้างห้องสำเร็จ! รหัส: ' + roomCode, 'success');
});

socket.on('joinedRoom', ({ playerId }) => {
  STATE.playerId = playerId;
  localStorage.setItem('wtk_pid', playerId);
  showScreen('lobby');
});

socket.on('roomUpdate', (room) => {
  STATE.room = room;
  // เปิดการ์ดบทบาท (Roll) ก่อนเข้าสู่การเลือกตัวละคร
  if (room.state === 'rolling') {
    if (STATE.currentScreen !== 'roll') showScreen('roll');
    renderRoll();
    return;
  }
  // เข้าสู่ขั้นตอนเลือกตัวละคร (สุ่มโรลแล้ว) → แสดงหน้าดราฟต์
  if (room.state === 'selecting') {
    if (STATE.currentScreen !== 'draft') {
      STATE.draftSelected = null;
      showScreen('draft');
    }
    renderDraft();
    return;
  }
  if (STATE.currentScreen === 'lobby') renderLobby();
  if (STATE.currentScreen === 'game') renderGame();
  if (STATE.currentScreen === 'charselect') renderCharSelect();
});

socket.on('gameStarted', (room) => {
  STATE.room = room;
  STATE._handIds = null; // รีเซ็ตตัวติดตามไพ่ในมือสำหรับเกมใหม่ (ไม่บินไพ่เปิดเกม)
  showScreen('game');
  renderGame();
  notify('⚔️ เกมเริ่มต้นแล้ว!', 'success');
});

socket.on('gameEnded', ({ winner, msg }) => {
  notify(msg, 'success', 8000);
  document.getElementById('win-msg').textContent = msg;
  document.getElementById('win-winner').textContent = winner;
  showScreen('win');
});

socket.on('playerJoined', ({ username }) => {
  notify(`${username} เข้าร่วมห้อง`, 'info');
});

socket.on('playerDisconnected', ({ username }) => {
  notify(`${username} หลุดการเชื่อมต่อ...`, 'warning');
});

socket.on('playerReconnected', ({ username }) => {
  notify(`${username} กลับมาแล้ว!`, 'success');
});

socket.on('chatMessage', ({ from, message }) => {
  addChatMessage(from, message, false);
});

socket.on('timerTick', (t) => {
  const el = document.getElementById('timer-display');
  if (el) {
    el.textContent = t;
    el.parentElement?.classList.toggle('warning', t <= 10);
  }
});

// ─── ป้ายบอกเป้าหมายการ์ด (ใครใช้การ์ดอะไรใส่ใคร) — แสดงบนหัวชั่วคราว ──────────────
socket.on('cardTargeted', ({ sourceId, sourceName, cardName, targetIds }) => {
  STATE.cardTargets = { sourceId, sourceName, cardName, targetIds: targetIds || [] };
  clearTimeout(STATE._cardTargetTimer);
  STATE._cardTargetTimer = setTimeout(() => {
    STATE.cardTargets = null;
    if (STATE.currentScreen === 'game') renderGame();
  }, 2600);
  if (STATE.currentScreen === 'game') renderGame();
});

// ─── อนิเมชั่นเปิดไพ่ตัดสินที่กองไพ่กลางกระดาน (สายฟ้า/เสพสุข/ทักษะตัดสินต่างๆ) ──────
socket.on('judgmentFlip', (data) => {
  if (STATE.currentScreen !== 'game' || !data?.card) return;
  enqueueJudgment(data);
});

// ─── ระบบตอบโต้ (หลบหลีก / โต้ดวล) ───────────────────────────────────────────
socket.on('awaitResponse', ({ type, need, cardName, from, msg, alsoAccept, dodgesNeeded, canNegate, liuliTargets }) => {
  STATE.responseNeed = need;
  STATE.responseAlsoAccept = alsoAccept || [];
  STATE._lastAwait = { type, need, cardName, from, msg, alsoAccept: alsoAccept || [], dodgesNeeded: dodgesNeeded || 1, canNegate: !!canNegate, liuliTargets: liuliTargets || [] };
  openResponseModal(type, need, cardName, from, msg, alsoAccept || [], dodgesNeeded || 1, !!canNegate, liuliTargets || []);
});

socket.on('askPeach', ({ msg, forId }) => {
  openPeachModal(msg, forId);
});

// ตอนจบตา: มือเกินลิมิต → เลือกการ์ดที่จะทิ้งเอง (ไม่สุ่ม)
socket.on('askDiscard', ({ need }) => {
  openDiscardModal(need);
});

// เก็บเกี่ยวอุดมสมบูรณ์: ถึงตาเราเลือกเก็บไพ่ที่เปิด
socket.on('askHarvest', () => {
  notify('🌾 ถึงตาคุณเลือกเก็บไพ่ — เลือก 1 ใบ', 'info', 3000);
  openHarvestModal();
});

// หว่านเมล็ดหวาดระแวง (反间): เป็นเป้าหมาย → ทายชนิดไพ่
socket.on('askFanjian', ({ sourceName }) => {
  openFanjianModal(sourceName);
});

// เนโครแมนซี (鬼才): ซือหม่าอี้เปลี่ยนไพ่ตัดสิน
socket.on('askGuicai', ({ flip, judgeName, jcardName }) => {
  openGuicaiModal(flip, judgeName, jcardName);
});

// ความแน่วแน่ (刚烈): ผู้ก่อความเสียหายต่อเซี่ยโหวตุนเลือกผล — ทิ้ง 2 ใบ หรือ รับ 1 ดาเมจ
socket.on('askGanglie', ({ victimName, tag }) => {
  openGanglieModal(victimName, tag);
});

// ขวานผ่าหิน (贯石斧): โจมตีถูกหลบ → ผู้โจมตีเลือกทิ้ง 2 ใบบังคับดาเมจ หรือ ปล่อยผ่าน
socket.on('askRockAxe', ({ targetName }) => {
  openRockAxeModal(targetName);
});

// ขโมย (顺手牵羊) / ทำลายสะพาน (过河拆桥): เลือกการ์ดของเป้าหมายที่จะริบ/ทำลาย
socket.on('askTakeCard', ({ mode, targetName, options }) => {
  openTakeCardModal(mode, targetName, options);
});

// ไม่หวั่นเกรง (骁果): เยว่จินเลือกทิ้งการ์ดพื้นฐานเพื่อใช้ทักษะ
socket.on('askXiaoguo', ({ targetName }) => {
  openXiaoguoModal(targetName);
});
// เป้าหมายของ Xiao Guo เลือกทิ้งอุปกรณ์ หรือ รับดาเมจ
socket.on('askXiaoguoRespond', ({ yuejinName }) => {
  openXiaoguoRespondModal(yuejinName);
});

// ทักษะเจ้านาย (护驾/激将): ฝ่ายเดียวกันเสนอเล่นการ์ดแทนเจ้านาย
socket.on('askLordAssist', ({ need, lordName, skill }) => {
  openLordAssistModal(need, lordName, skill);
});

// ดูดาว (观星): จูกัดเหลียงดูไพ่บนสุดแล้วจัดลำดับ บน/ก้นกอง
socket.on('askGuanxing', ({ cards }) => {
  openGuanxingModal(cards || []);
});

// มรดกตกทอด (遗计): กัวเจียดูไพ่ 2 ใบ แล้วมอบให้ผู้เล่นคนใดก็ได้
socket.on('askYiji', ({ cards, players }) => {
  openYijiModal(cards || [], players || []);
});

socket.on('error', (msg) => notify(msg, 'error'));
socket.on('kicked', ({ reason }) => {
  notify(reason, 'error', 5000);
  showScreen('menu');
});

socket.on('spectating', ({ roomCode }) => {
  notify(`กำลังรับชมห้อง ${roomCode}`, 'info');
  showScreen('game');
});

// ─── Lobby Render ───────────────────────────────────────────────────────
function renderLobby() {
  const room = STATE.room;
  if (!room) return;

  document.getElementById('lobby-room-name').textContent = room.settings.roomName;
  const codeEl = document.getElementById('lobby-room-code');
  codeEl.textContent = room.code;

  const pcEl = document.getElementById('player-count');
  if (pcEl) pcEl.textContent = `${room.players.length}/${room.settings.playerLimit} คน`;

  const grid = document.getElementById('player-grid');
  grid.innerHTML = '';

  const limit = room.settings.playerLimit;
  for (let i = 0; i < limit; i++) {
    const p = room.players[i];
    const slot = document.createElement('div');
    slot.className = `player-slot gold-frame ${!p ? 'empty' : ''} ${p && p.id === STATE.playerId ? 'self' : ''}`;

    if (!p) {
      slot.innerHTML = `<div style="color:var(--text-dim);font-size:0.85rem">— ที่ว่าง —</div>`;
    } else {
      const char = p.character ? window.CHAR_DATA[p.character] : null;
      const charImg = char ? `<img src="${char.image}" style="width:40px;height:56px;object-fit:cover;border-radius:4px;border:1px solid var(--border)">` : `<div class="player-avatar"><div style="font-size:1.2rem;line-height:44px;text-align:center">⚔️</div></div>`;
      const kingdomBadge = char ? `<span class="kingdom-badge kb-${char.kingdom}" style="font-size:0.65rem">${{ WEI:'เว่ย', SHU:'สู่', WU:'อู๋', QUN:'ไม่สังกัด' }[char.kingdom]}</span>` : '';
      const hostBadge = p.id === room.hostId ? '<span style="color:var(--gold);font-size:0.7rem">👑 HOST</span>' : '';
      const dcBadge = !p.connected ? '<span class="ping-badge dc-badge">หลุดการเชื่อมต่อ</span>' : '';
      slot.innerHTML = `
        ${charImg}
        <div class="player-info">
          <div class="player-name">${p.username} ${hostBadge}</div>
          <div class="player-meta">${char ? char.nameTh : 'เลือกตัวละครหลังเริ่มเกม'} ${kingdomBadge} ${dcBadge}</div>
        </div>
        <div class="player-status">
          <span class="ready-badge ${p.ready ? 'ready' : 'waiting'}">${p.ready ? '✓ พร้อม' : '⏳ รอ'}</span>
        </div>
      `;

      if (char) {
        addTooltipHover(slot, () => charTooltipHTML(p.character));
      }

      // Host can kick others
      if (room.hostId === STATE.playerId && p.id !== STATE.playerId) {
        slot.title = 'คลิกเพื่อดูตัวเลือก';
      }
    }
    grid.appendChild(slot);
  }

  // Buttons
  const myPlayer = room.players.find(p => p.id === STATE.playerId);
  if (!myPlayer) return;

  document.getElementById('btn-ready').textContent = myPlayer.ready ? '✗ ยกเลิกพร้อม' : '✓ พร้อมแล้ว';
  const btnStart = document.getElementById('btn-start');
  if (btnStart) {
    btnStart.style.display = room.hostId === STATE.playerId ? 'flex' : 'none';
  }
}

// ─── Character Selection Render ────────────────────────────────────────
function renderCharSelect() {
  const room = STATE.room;

  // Render char grid
  const grid = document.getElementById('char-grid');
  const allChars = Object.entries(window.CHAR_DATA).filter(([, c]) => c.kingdom === STATE.charFilter);
  const takenIds = room ? room.players.filter(p => p.id !== STATE.playerId).map(p => p.character) : [];
  const myChar = room?.players.find(p => p.id === STATE.playerId)?.character;

  grid.innerHTML = '';
  allChars.forEach(([id, c]) => {
    const taken = takenIds.includes(id);
    const selected = myChar === id || STATE.selectedChar === id;
    const div = document.createElement('div');
    div.className = `char-card ${taken ? 'taken' : ''} ${selected ? 'selected' : ''}`;
    div.dataset.charid = id;
    div.innerHTML = `
      <img src="${c.image}" alt="${c.nameTh}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg/>'">
      <div class="char-card-kingdom kingdom-${c.kingdom}">${c.kingdom[0]}</div>
      <div class="char-card-hp">❤️${c.hp}</div>
      <div class="char-card-name">${c.nameTh}</div>
    `;
    if (!taken) {
      div.addEventListener('click', () => selectChar(id));
      addTooltipHover(div, () => charTooltipHTML(id));
    }
    grid.appendChild(div);
  });

  // Preview panel
  const previewId = STATE.selectedChar || myChar;
  if (previewId) {
    const c = window.CHAR_DATA[previewId];
    if (c) {
      document.getElementById('preview-img').src = c.image;
      document.getElementById('preview-name').textContent = c.nameTh;
      document.getElementById('preview-zh').textContent = `${c.nameEn} · ${c.nameZh}`;
      const kname = { WEI: 'เว่ย', SHU: 'สู่', WU: 'อู๋', QUN: 'ไม่สังกัด' }[c.kingdom];
      document.getElementById('preview-hp').innerHTML = `❤️ ${c.hp} HP <span>(แคว้น${kname})</span>`;
      document.getElementById('preview-lore').textContent = c.lore;
      const skillList = document.getElementById('skill-list');
      skillList.innerHTML = c.skills.map(s => `
        <div class="skill-item">
          <div class="skill-name">【${s.name}】</div>
          <div class="skill-en">${s.nameEn}</div>
          <div class="skill-desc">${s.desc}</div>
        </div>
      `).join('');
    }
  }
}

function selectChar(id) {
  STATE.selectedChar = id;
  socket.emit('selectCharacter', { characterId: id });
  renderCharSelect();
}

// ─── Draft Render (สุ่มโรล → เลือกตัวละคร · จักรพรรดิเลือกก่อน) ────────────────────
const LORD_CHARS = ['caocao', 'liubei', 'sunquan'];

function renderDraft() {
  const room = STATE.room;
  const d = room?.draft;
  if (!d) return;
  const me = room.players.find(p => p.id === STATE.playerId);
  const myRole = me?.role;
  const iAmLord = myRole === 'Lord';
  const isLordStage = d.stage === 'lord';
  const candidates = d.myCandidates;
  const alreadyPicked = !!d.myPick;

  // แบนเนอร์บทบาท
  const roleData = window.ROLE_DATA[myRole];
  const roleImg = document.getElementById('draft-role-img');
  roleImg.src = roleData?.image || '';
  roleImg.style.display = roleData ? '' : 'none';

  // เปิดเผยตัวที่จักรพรรดิเลือก
  const lordRevealEl = document.getElementById('draft-lord-reveal');
  const lordPanel = document.getElementById('draft-lord-panel');
  if (d.lordPick) {
    lordRevealEl.style.display = '';
    const lc = window.CHAR_DATA[d.lordPick];
    document.getElementById('draft-lord-img').src = lc?.image || '';
    document.getElementById('draft-lord-name').textContent = lc?.nameTh || '';
    fillLordPickPanel(d.lordPick);
    lordPanel.style.display = '';
  } else {
    lordRevealEl.style.display = 'none';
    lordPanel.style.display = 'none';
  }

  const grid = document.getElementById('draft-grid');
  const confirmBtn = document.getElementById('btn-confirm-draft');
  const hint = document.getElementById('draft-grid-hint');

  if (!candidates) {
    grid.innerHTML = `<div style="color:var(--text-dim);padding:24px;grid-column:1/-1;text-align:center">${isLordStage ? '👑 รอจักรพรรดิเลือกตัวละคร...' : 'กำลังแจกการ์ดตัวละคร...'}</div>`;
    confirmBtn.style.display = 'none';
    hint.textContent = '';
  } else if (alreadyPicked) {
    STATE.draftSelected = d.myPick;
    grid.innerHTML = '';
    renderDraftCard(grid, d.myPick, true);
    confirmBtn.style.display = 'none';
    hint.textContent = '✓ คุณเลือกตัวละครแล้ว — กำลังรอผู้เล่นคนอื่น';
  } else {
    if (!candidates.includes(STATE.draftSelected)) STATE.draftSelected = candidates[0];
    grid.innerHTML = '';
    candidates.forEach(id => renderDraftCard(grid, id, false));
    confirmBtn.style.display = '';
    hint.textContent = iAmLord
      ? 'การ์ดจักรพรรดิ 7 ใบ (มี 👑 3 ใบเอฟเฟคจักรพรรดิเสมอ) — เลือก 1 ใบ'
      : `การ์ดตัวละครในมือคุณ ${candidates.length} ใบ — เลือก 1 ใบ`;
  }

  // หัวข้อ + สถานะ
  let title, status;
  if (iAmLord) {
    title = '👑 จักรพรรดิ — เลือกตัวละคร';
    status = (isLordStage && !alreadyPicked) ? 'คุณได้เลือกก่อน! เลือกจากการ์ด 7 ใบ' : 'รอผู้เล่นคนอื่นเลือก...';
  } else {
    title = `${roleData?.nameTh || 'ผู้เล่น'} — เลือกตัวละคร`;
    if (isLordStage) status = `รอ ${d.lordName || 'จักรพรรดิ'} เลือกตัวละครก่อน...`;
    else status = alreadyPicked ? 'รอผู้เล่นคนอื่น...' : 'ถึงตาคุณเลือกตัวละครแล้ว!';
  }
  if (d.waiting?.length) status += ` · กำลังรอ: ${d.waiting.join(', ')}`;
  document.getElementById('draft-title').textContent = title;
  document.getElementById('draft-status').textContent = status;

  if (STATE.draftSelected) fillDraftPreview(STATE.draftSelected);
}

function renderDraftCard(grid, id, locked) {
  const c = window.CHAR_DATA[id];
  if (!c) return;
  const sel = STATE.draftSelected === id;
  const isLordChar = LORD_CHARS.includes(id);
  const div = document.createElement('div');
  div.className = `char-card ${sel ? 'selected' : ''}`;
  div.innerHTML = `
    <img src="${c.image}" alt="${c.nameTh}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg/>'">
    <div class="char-card-kingdom kingdom-${c.kingdom}">${c.kingdom[0]}</div>
    <div class="char-card-hp">❤️${c.hp}</div>
    <div class="char-card-name">${c.nameTh}</div>
    ${isLordChar ? '<div style="position:absolute;top:4px;left:4px;background:var(--gold);color:#000;font-size:0.6rem;font-weight:700;padding:1px 5px;border-radius:8px;z-index:3">👑</div>' : ''}
  `;
  addTooltipHover(div, () => charTooltipHTML(id));
  if (!locked) div.addEventListener('click', () => { STATE.draftSelected = id; renderDraft(); });
  grid.appendChild(div);
}

function fillDraftPreview(id) {
  const c = window.CHAR_DATA[id];
  if (!c) return;
  const img = document.getElementById('draft-preview-img');
  img.src = c.image; img.style.display = '';
  document.getElementById('draft-preview-name').textContent = c.nameTh;
  document.getElementById('draft-preview-zh').textContent = `${c.nameEn} · ${c.nameZh}`;
  const kname = { WEI: 'เว่ย', SHU: 'สู่', WU: 'อู๋', QUN: 'ไม่สังกัด' }[c.kingdom];
  document.getElementById('draft-preview-hp').innerHTML = `❤️ ${c.hp} HP <span>(แคว้น${kname})</span>`;
  document.getElementById('draft-preview-lore').textContent = c.lore;
  document.getElementById('draft-skill-list').innerHTML = c.skills.map(s => `
    <div class="skill-item">
      <div class="skill-name">【${s.name}】</div>
      <div class="skill-en">${s.nameEn}</div>
      <div class="skill-desc">${s.desc}</div>
    </div>
  `).join('');
}

function fillLordPickPanel(id) {
  const c = window.CHAR_DATA[id];
  if (!c) return;
  const img = document.getElementById('draft-lordpick-img');
  img.src = c.image; img.style.display = '';
  document.getElementById('draft-lordpick-name').textContent = c.nameTh;
  document.getElementById('draft-lordpick-zh').textContent = `${c.nameEn} · ${c.nameZh}`;
  const kname = { WEI: 'เว่ย', SHU: 'สู่', WU: 'อู๋', QUN: 'ไม่สังกัด' }[c.kingdom];
  document.getElementById('draft-lordpick-hp').innerHTML = `❤️ ${c.hp} HP <span>(แคว้น${kname})</span>`;
  document.getElementById('draft-lordpick-skills').innerHTML = c.skills.map(s => `
    <div class="skill-item">
      <div class="skill-name">【${s.name}】</div>
      <div class="skill-en">${s.nameEn}</div>
      <div class="skill-desc">${s.desc}</div>
    </div>
  `).join('');
}

// ─── Roll Reveal (สุ่มบทบาท) ─────────────────────────────────────────────
const CARD_BACK = '/BackCard/Screenshot 2026-06-23 011011.png';

// คืน URL การ์ดบทบาท: รู้บทบาท → รูป Roll, ไม่รู้ → หลังการ์ด
function roleCardImage(role) {
  if (role && role !== '?') return window.ROLE_DATA[role]?.image || CARD_BACK;
  return CARD_BACK;
}

function renderRoll() {
  const room = STATE.room;
  if (!room) return;
  const lordId = room.players.find(p => p.role === 'Lord')?.id;
  const iAmLord = room.players.find(p => p.id === STATE.playerId)?.role === 'Lord';
  document.getElementById('roll-subtitle').textContent = iAmLord
    ? '👑 คุณคือจักรพรรดิ! เตรียมเลือกตัวละครก่อนใคร'
    : 'เปิดการ์ดบทบาท — เห็นเฉพาะของตัวเอง (จักรพรรดิเปิดให้ทุกคนเห็น)';

  const grid = document.getElementById('roll-grid');
  grid.innerHTML = room.players.map(p => {
    const isSelf = p.id === STATE.playerId;
    const isLord = p.id === lordId;
    const known = (p.role && p.role !== '?');   // ของตัวเอง หรือจักรพรรดิ
    const rd = known ? window.ROLE_DATA[p.role] : null;
    const label = known ? rd.nameTh : '???';
    const color = rd?.color || 'var(--text-dim)';
    const tag = isLord ? '👑 จักรพรรดิ' : (isSelf ? '(คุณ)' : '');
    return `<div class="roll-player">
      <div class="roll-card ${known ? 'revealed' : 'hidden-card'}">
        <img src="${roleCardImage(p.role)}" alt="${label}" onerror="this.style.display='none'">
      </div>
      <div class="roll-name">${p.username} ${tag}</div>
      <div class="roll-role" style="color:${color}">${label}</div>
    </div>`;
  }).join('');

  document.getElementById('roll-countdown').textContent = 'กำลังเข้าสู่การเลือกตัวละคร...';
}

// ─── การ์ดอุปกรณ์ที่ติดตั้งหน้าผู้เล่น (ทุกคนมองเห็น) ─────────────────────────────
function equipCardsHTML(p) {
  const slots = [
    ['weapon', '⚔ อาวุธ'],
    ['armor', '🛡 เกราะ'],
    ['atkMount', '🐴 ม้าบุก'],
    ['defMount', '🐎 ม้าหนี'],
  ];
  return slots.filter(([k]) => p.equipment?.[k]).map(([k, label]) => {
    const card = p.equipment[k];
    const cd = window.CARD_DATA[card.name];
    const img = cd?.image
      ? `<img src="${cd.image}" alt="${card.name}" onerror="this.style.display='none'">`
      : '';
    const nm = (cd?.nameTh || card.name).split('(')[0].trim();
    return `<div class="equip-card equip-${k}" data-equip="${card.name}" title="${label}: ${nm}">
      ${img}
      ${suitPip(card)}
      <div class="equip-card-name">${nm}</div>
    </div>`;
  }).join('');
}

// ─── การ์ดหน่วงเวลาในช่องตัดสิน (สายฟ้า/เสพสุข) — แสดงเป็นการ์ดในโซนอุปกรณ์ ────────
// บอกให้เห็นว่าใครโดนการ์ดตัดสินอะไรอยู่ (สายฟ้าที่เปิดแล้วไม่โดนจะถูกย้ายไปคนถัดไป
// โดยเซิร์ฟเวอร์ — ที่นี่แค่แสดงตามช่องตัดสินปัจจุบันของผู้เล่นแต่ละคน)
function judgmentCardsHTML(p) {
  const js = p.judgments || [];
  if (!js.length) return '';
  return js.map(c => {
    const cd = window.CARD_DATA[c.name];
    const icon = c.name === 'Lightning' ? '⚡' : c.name === 'Overindulgence' ? '🍵' : '🎴';
    const nm = (cd?.nameTh || c.name).split('(')[0].trim();
    const img = cd?.image ? `<img src="${cd.image}" alt="${nm}" onerror="this.style.display='none'">` : '';
    return `<div class="equip-card judgment-card" data-equip="${c.name}" title="ช่องตัดสิน: ${nm}">
      ${img}
      ${suitPip(c)}
      <div class="judgment-icon">${icon}</div>
      <div class="equip-card-name">${nm}</div>
    </div>`;
  }).join('');
}

// ─── Game Board Render ─────────────────────────────────────────────────
function renderGame() {
  const room = STATE.room;
  if (!room) return;

  const players = room.players;
  const game = room.game;
  const me = players.find(p => p.id === STATE.playerId);

  // Position players around center
  const ring = document.getElementById('players-ring');
  const cx = ring.clientWidth / 2 || 500;
  const cy = ring.clientHeight / 2 || 300;
  // ลบเฉพาะการ์ดผู้เล่นเดิม (คงไว้ซึ่ง board-center)
  ring.querySelectorAll('.player-node').forEach(n => n.remove());

  const myIdx = players.findIndex(p => p.id === STATE.playerId);
  const placed = [];   // เก็บ {node, angle} ไว้คำนวณรัศมีหลังวัดขนาด node จริง
  players.forEach((p, i) => {
    // +π/2 = วางตัวเอง (i === myIdx) ไว้ข้างล่างสุดของวง คนอื่นไล่ตามลำดับที่นั่ง
    const angle = ((i - myIdx) / players.length) * Math.PI * 2 + Math.PI / 2;

    const isCurrent = game?.currentPlayer === i;
    const dead = p.hp <= 0;
    const isSelf = p.id === STATE.playerId;
    const char = window.CHAR_DATA[p.character] || {};

    const hpPct = p.maxHp > 0 ? (p.hp / p.maxHp) * 100 : 0;
    const hpClass = hpPct <= 25 ? 'low' : hpPct <= 50 ? 'medium' : '';

    const hearts = Array.from({length: p.maxHp}, (_, hi) => `
      <span class="hp-heart ${hi < p.hp ? 'full' : 'empty'}">${hi < p.hp ? '❤' : '♡'}</span>
    `).join('');

    const equips = equipCardsHTML(p);
    const judg = judgmentCardsHTML(p);

    // โรลต่อท้ายชื่อตัวละคร — เปิดเผยเฉพาะของตัวเอง / จักรพรรดิ / ตอนจบเกม
    const rd = (p.role && p.role !== '?') ? window.ROLE_DATA[p.role] : null;
    const roleLabel = rd ? ` · <span style="color:${rd.color};font-weight:600">${rd.nameTh}</span>` : '';

    // ป้ายบอกเป้าหมายการ์ดชั่วคราว (ลอยบนหัว) — ใครถูกใช้การ์ดอะไรจากใคร
    const ct = STATE.cardTargets;
    const targetBanner = (ct && ct.targetIds.includes(p.id) && !dead)
      ? `<div class="target-banner">🎯 ${(window.CARD_DATA[ct.cardName]?.nameTh||ct.cardName).split('(')[0].trim()}<span class="tb-src">↪ จาก ${ct.sourceName}</span></div>`
      : '';

    const targetable = STATE.selectingTarget && !isSelf && !dead && isTargetable(STATE.selectedCard, p);

    const node = document.createElement('div');
    node.className = `player-node ${isCurrent ? 'current-turn' : ''} ${dead ? 'dead' : ''} ${isSelf ? 'self' : ''}`;
    if (targetable) node.classList.add('targetable');
    if (STATE.selectingTarget && !isSelf && !dead && !targetable) node.style.opacity = '0.4';
    node.dataset.playerid = p.id;
    // ป้ายระยะทาง (เมื่อเลือกเป้าหมาย)
    const distBadge = (STATE.selectingTarget && !isSelf && !dead && p.distance != null)
      ? `<div style="position:absolute;top:-8px;left:-8px;background:${p.inAttackRange?'#27ae60':'#e74c3c'};color:#fff;border-radius:10px;padding:1px 6px;font-size:0.6rem;font-weight:700;z-index:3">📏${p.distance}</div>`
      : '';
    node.innerHTML = `
      <div class="player-target-ring"></div>
      ${targetBanner}
      ${distBadge}
      <div style="position:relative">
        <img class="player-portrait ${isCurrent?'current-turn':''} ${isSelf?'self':''}"
          src="${char.image || ''}" alt="${p.username}"
          onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'80\\' height=\\'110\\'><rect fill=\\'%23333\\' width=\\'80\\' height=\\'110\\'/></svg>'"
        >
        <img class="role-card-mini" src="${roleCardImage(p.role)}"
          title="${(p.role && p.role!=='?') ? (window.ROLE_DATA[p.role]?.nameTh||'') : 'บทบาทซ่อนอยู่'}"
          onerror="this.style.display='none'">
        <div class="player-hand-count">${p.handCount}</div>
      </div>
      <div class="player-hp-bar"><div class="player-hp-fill ${hpClass}" style="width:${hpPct}%"></div></div>
      <div class="hp-hearts">${hearts}</div>
      <div class="player-node-name">${p.username}${isSelf?' (คุณ)':''}</div>
      <div class="player-hp-text">${p.hp}/${p.maxHp} HP · ${char.nameTh||''}${roleLabel}</div>
      ${isCurrent ? `<div style="font-size:0.65rem;color:var(--gold);text-align:center">⟵ ตานี้</div>` : ''}
      <div class="player-equip">${equips}${judg}</div>
    `;

    // Target selection
    if (targetable) {
      node.addEventListener('click', () => confirmPlayCard(p.id));
      node.style.cursor = 'crosshair';
    }

    // Hover for char info
    if (p.character) {
      addTooltipHover(node, () => charTooltipHTML(p.character));
    }

    // Hover รายละเอียดการ์ดอุปกรณ์ (แยกจาก tooltip ตัวละคร)
    node.querySelectorAll('[data-equip]').forEach(el => {
      el.addEventListener('mouseenter', e => { e.stopPropagation(); showTooltip(cardTooltipHTML(el.dataset.equip), e.clientX, e.clientY); });
      el.addEventListener('mouseleave', e => { e.stopPropagation(); hideTooltip(); });
    });

    ring.appendChild(node);
    placed.push({ node, angle });
  });

  // ── วัดขนาด node จริงหลัง render แล้วคำนวณรัศมีให้ขอบบนของ node บนสุดชิดขอบวง
  //    (ดันออกให้ไกลกองไพ่กลางโต๊ะมากสุด) และไม่ล้นขอบซ้าย/ขวา ───────────────────
  let maxW = 0, maxH = 0;
  placed.forEach(({ node }) => { maxW = Math.max(maxW, node.offsetWidth); maxH = Math.max(maxH, node.offsetHeight); });
  const radius = Math.max(110, Math.min(cx - maxW / 2 - 8, cy - maxH / 2 - 6));
  placed.forEach(({ node, angle }) => {
    node.style.left = (cx + radius * Math.cos(angle)) + 'px';
    node.style.top  = (cy + radius * Math.sin(angle)) + 'px';
  });

  // Update turn info
  if (game) {
    const cur = players[game.currentPlayer];
    const phaseNames = { start:'เตรียมรบ', judge:'เปิดการ์ดตัดสิน', draw:'จั่วการ์ด', play:'เล่นการ์ด', discard:'ทิ้งการ์ด', end:'สิ้นสุดรอบ', ended:'จบเกม' };
    document.getElementById('turn-player').textContent = cur ? cur.username : '';
    document.getElementById('turn-phase').textContent = phaseNames[game.phase] || game.phase;
    document.getElementById('deck-count').textContent = game.deckSize;
    const discardCountEl = document.getElementById('discard-count');
    if (discardCountEl) discardCountEl.textContent = game.discardCount ?? 0;
    const discardTopImg = document.getElementById('discard-top');
    if (game.discardTop) {
      const cd = window.CARD_DATA[game.discardTop.name];
      if (cd) { discardTopImg.src = cd.image; discardTopImg.style.display = ''; }
    } else if (discardTopImg) {
      discardTopImg.style.display = 'none';
    }
    // อัปเดตหน้าต่างกองทิ้งถ้ากำลังเปิดดูอยู่
    if (document.getElementById('modal-discard')?.classList.contains('active')) openDiscardPileModal();
    if (game.timer !== null) {
      document.getElementById('timer-display').textContent = game.timer;
    }

    // Combat log
    const logEl = document.getElementById('combat-log');
    logEl.innerHTML = (game.log || []).map(l => `
      <div class="log-entry ${l.who === 'ระบบ' ? 'system' : 'combat'}">
        <span class="log-who">${l.who}:</span>${l.msg}
      </div>
    `).join('');
    logEl.scrollTop = logEl.scrollHeight;
  }

  // My hand
  if (me) renderHand(me);

  // End turn button visibility
  const isMyTurn = game && players[game.currentPlayer]?.id === STATE.playerId && game.phase === 'play' && !game.pending && !game.harvest;
  document.getElementById('btn-end-turn').style.display = isMyTurn ? 'block' : 'none';
  document.getElementById('btn-cancel-target').style.display = STATE.selectingTarget ? 'block' : 'none';

  // ── ไฮไลท์กองไพ่ให้กดจั่วเอง (เฟสจั่วของผู้เล่นปัจจุบัน) ──
  const myDrawTurn = !!(game && players[game.currentPlayer]?.id === STATE.playerId
    && game.phase === 'draw' && game.awaitingDraw);
  const deckPile = document.getElementById('deck-pile');
  const deckLabel = document.getElementById('deck-pile-label');
  if (deckPile) {
    deckPile.classList.toggle('draw-ready', myDrawTurn);
    deckPile.style.cursor = myDrawTurn ? 'pointer' : 'default';
  }
  if (deckLabel) deckLabel.textContent = myDrawTurn ? '👆 กดเพื่อจั่ว!' : 'กองไพ่';
  // แจ้งเตือนครั้งเดียวเมื่อถึงตาจั่วของเรา
  if (myDrawTurn && !STATE._drawPrompted) {
    notify('🎴 ถึงตาคุณ — กดที่กองไพ่กลางกระดานเพื่อจั่วการ์ด 2 ใบ', 'info', 4500);
    STATE._drawPrompted = true;
  }
  if (!myDrawTurn) STATE._drawPrompted = false;

  // ปุ่มใช้ทักษะตัวละคร (เฉพาะตัวละครที่มีทักษะแบบสั่งใช้)
  const skillBtn = document.getElementById('btn-use-skill');
  const sk = room.mySkill;
  if (sk) {
    skillBtn.style.display = 'block';
    skillBtn.textContent = `✨ ${sk.name}`;
    skillBtn.style.opacity = sk.usable ? '1' : '0.45';
    skillBtn.style.cursor = sk.usable ? 'pointer' : 'not-allowed';
    skillBtn.title = sk.usable ? sk.desc : (sk.reason || 'ใช้ทักษะตอนนี้ไม่ได้');
    skillBtn.classList.toggle('ready', !!sk.usable);
    // แจ้งเตือนเมื่อทักษะ "เพิ่งจะใช้ได้" (เปลี่ยนสถานะเป็นใช้ได้)
    if (sk.usable && !STATE._skillWasUsable) {
      notify(`✨ ใช้ทักษะ「${sk.name}」ได้แล้ว — กดปุ่ม "ใช้ทักษะ" เพื่อเลือกใช้`, 'success', 4500);
    }
    STATE._skillWasUsable = !!sk.usable;
  } else {
    skillBtn.style.display = 'none';
    STATE._skillWasUsable = false;
  }

  // ปิดหน้าต่างตอบโต้/เพอช เมื่อไม่เกี่ยวข้องแล้ว
  const respOverlay = document.getElementById('modal-response');
  const pendingForMe = game?.pending && game.pending.responderId === STATE.playerId;
  const dyingMe = game?.dyingPlayerId === STATE.playerId;
  const discardForMe = game?.awaitingDiscard && game.awaitingDiscard.playerId === STATE.playerId;
  const harvestForMe = game?.harvest && game.harvest.picker === STATE.playerId;
  // STATE._peachOpen: ถูกถามให้ใช้เพอช (ช่วยตัวเอง/เพื่อน) — อย่าเพิ่งปิดหน้าต่าง
  if (!pendingForMe && !dyingMe && !discardForMe && !harvestForMe && !STATE._peachOpen && respOverlay.classList.contains('active')) {
    respOverlay.classList.remove('active');
  }
  // เปิดหน้าต่างเลือกทิ้งการ์ดถ้ายังค้างอยู่ (ครอบคลุมกรณี reconnect)
  if (discardForMe && !STATE._discardOpen) openDiscardModal(game.awaitingDiscard.need);
  if (!discardForMe) STATE._discardOpen = false;
  // เปิด/อัปเดตหน้าต่างเก็บเกี่ยวเมื่อถึงตาเราเลือก (รวมถึงอัปเดตไพ่ที่เหลือ)
  if (harvestForMe) openHarvestModal();
  else STATE._harvestOpen = false;
}

// เป้าหมายที่เลือกได้ตามชนิดการ์ด + ระยะ
function isTargetable(card, p) {
  if (!card) return false;
  // การ์ดระยะ 1 (ขโมย/ทำลายสะพาน)
  if (['Steal','Burning Bridges'].includes(card.name)) {
    // หวงเยว่อิง (黄月英) — Qi Cai (奇才): การ์ดยุทธวิธีมีระยะไม่จำกัด
    const me = STATE.room?.players.find(pl => pl.id === STATE.playerId);
    if (me?.character === 'huangyy') return true;
    return p.distance != null && p.distance <= 1;
  }
  // โจมตี (หรือ กวนอู ใช้ไพ่แดงเป็นโจมตี) — ต้องอยู่ในระยะโจมตี
  const me = STATE.room?.players.find(pl => pl.id === STATE.playerId);
  if (card.name === 'Attack' || (me?.character === 'guanyu' && card.color === 'red')) {
    return !!p.inAttackRange;
  }
  // ยืมดาบ — เป้าหมายต้องมีอาวุธ
  if (card.name === 'Borrowed Sword') return !!(p.equipment && p.equipment.weapon);
  // ท้าดวล / เสพสุข — ไม่จำกัดระยะ (เป้าหมายใดก็ได้ที่ยังมีชีวิต)
  return true;
}

// ─── เงื่อนไขการเล่นการ์ด (mirror ฝั่งเซิร์ฟเวอร์) ────────────────────────────
const RESPONSE_ONLY_CARDS = ['Dodge', 'Negation'];
const UNSUPPORTED_PLAY_CARDS = [];   // ไม่มีการ์ดที่เล่นไม่ได้แล้ว (สายฟ้า/เสพสุข รองรับแล้ว)

// คืนข้อความปัญหาถ้าเล่นการ์ดนี้ตอนนี้ไม่ได้ (null = เล่นได้)
function cardPlayIssue(card) {
  const me = STATE.room?.players.find(p => p.id === STATE.playerId);
  // Guan Yu: ไพ่แดงทุกใบเล่นเป็นโจมตีได้ (ข้ามการตรวจ response-only)
  const isGuanyuRed = me?.character === 'guanyu' && card.color === 'red';
  // ทักษะแปลงการ์ด (กานหนิง/ต้าเฉียว): การ์ดตอบโต้อาจใช้แทนการ์ดอื่นได้
  const hasSub = getSubstitutions(me, card).length > 0;
  if (RESPONSE_ONLY_CARDS.includes(card.name) && !isGuanyuRed && !hasSub) return 'การ์ดนี้ใช้ตอบโต้เท่านั้น เล่นเองไม่ได้';
  if (card.name === 'Peach') {
    if (me && me.hp >= me.maxHp) return 'พลังชีวิตเต็มแล้ว ใช้เพอชไม่ได้';
  }
  if (card.name === 'Lightning' && (me?.judgments || []).some(c => c.name === 'Lightning'))
    return 'มีสายฟ้าวางอยู่หน้าคุณแล้ว';
  return null;
}

function renderHand(me) {
  const hand = me.hand || [];
  const container = document.getElementById('my-hand');
  container.innerHTML = '';

  const game = STATE.room?.game;
  const players = STATE.room?.players || [];
  const myTurn = game && players[game.currentPlayer]?.id === STATE.playerId && game.phase === 'play' && !game.pending && !game.harvest;

  // ติดตามไพ่ในมือชุดก่อนหน้า เพื่อรู้ว่าใบไหน "เพิ่งจั่วมาใหม่"
  const prevIds = STATE._handIds;
  const newDivs = [];

  hand.forEach(card => {
    const cd = window.CARD_DATA[card.name];
    const unplayable = myTurn && cardPlayIssue(card);
    const div = document.createElement('div');
    div.className = `hand-card ${STATE.selectedCard?.id === card.id ? 'selected' : ''} ${unplayable ? 'unplayable' : ''}`;
    div.dataset.cardid = card.id;
    const inner = cd?.image
      ? `<img src="${cd.image}" alt="${card.name}" onerror="this.src=''">`
      : `<div style="padding:8px;font-size:0.7rem;text-align:center;color:var(--text)">${cd?.nameTh || card.name}</div>`;
    div.innerHTML = `${inner}${suitPip(card)}<div class="hand-card-type type-${card.type}">${(cd?.nameTh||card.name).split('(')[0].trim()}</div>`;
    div.addEventListener('click', () => onCardClick(card));
    addTooltipHover(div, () => cardTooltipHTML(card.name));
    container.appendChild(div);
    // ใบใหม่ที่ไม่เคยมีในมือรอบก่อน = เพิ่งจั่ว → เก็บไว้เล่นอนิเมชั่น
    if (prevIds && !prevIds.has(card.id)) newDivs.push(div);
  });

  // อัปเดตชุด id ปัจจุบัน
  STATE._handIds = new Set(hand.map(c => c.id));

  // เล่นอนิเมชั่นจั่วไพ่จากกองมาที่มือ (เฉพาะใบที่เพิ่งได้มา, ไล่ทีละใบ)
  if (newDivs.length) {
    newDivs.forEach((div, i) => animateDrawToHand(div, i * 110));
  }
}

// อนิเมชั่น: การ์ดหลังไพ่บินจากกองไพ่กลางกระดานมาลงตำแหน่งในมือ
const BACK_CARD_SRC = '/BackCard/Screenshot 2026-06-23 011011.png';
function animateDrawToHand(targetEl, delay = 0) {
  const deck = document.getElementById('deck-pile');
  if (!deck || !targetEl) return;
  const from = deck.getBoundingClientRect();
  const to = targetEl.getBoundingClientRect();
  if (!to.width || !from.width) return;

  // ซ่อนการ์ดจริงไว้ก่อน จนกว่าตัวบินจะลงถึงที่
  targetEl.style.visibility = 'hidden';

  const fly = document.createElement('div');
  fly.className = 'draw-fly';
  fly.innerHTML = `<img src="${BACK_CARD_SRC}" alt="">`;
  fly.style.left = from.left + 'px';
  fly.style.top = from.top + 'px';
  fly.style.width = from.width + 'px';
  fly.style.height = from.height + 'px';
  fly.style.transitionDelay = delay + 'ms';
  document.body.appendChild(fly);

  // บังคับ reflow แล้วค่อยตั้งค่าปลายทาง เพื่อให้ transition ทำงาน
  void fly.offsetWidth;
  requestAnimationFrame(() => {
    fly.style.left = to.left + 'px';
    fly.style.top = to.top + 'px';
    fly.style.width = to.width + 'px';
    fly.style.height = to.height + 'px';
  });

  const FLIGHT = 420;
  setTimeout(() => {
    fly.remove();
    targetEl.style.visibility = '';
    targetEl.classList.add('just-drawn');
    setTimeout(() => targetEl.classList.remove('just-drawn'), 450);
  }, delay + FLIGHT);
}

// ─── อนิเมชั่นเปิดไพ่ตัดสิน: เข้าคิวเล่นทีละใบ (กันซ้อนกันตอนตัดสินหลายใบ เช่น 洛神) ──
function enqueueJudgment(data) {
  STATE._judgQueue = STATE._judgQueue || [];
  STATE._judgQueue.push(data);
  if (!STATE._judgPlaying) playNextJudgment();
}
function playNextJudgment() {
  const q = STATE._judgQueue || [];
  if (!q.length) { STATE._judgPlaying = false; return; }
  STATE._judgPlaying = true;
  animateJudgmentFlip(q.shift(), () => setTimeout(playNextJudgment, 140));
}

// การ์ดเปิดหงายขึ้นจากกองไพ่กลางกระดาน → ค้างโชว์ผล → บินเข้ากองทิ้ง
function animateJudgmentFlip({ card, label }, done) {
  const finish = () => { if (done) { done(); done = null; } };
  const deck = document.getElementById('deck-pile');
  if (!deck || !card) { finish(); return; }
  const from = deck.getBoundingClientRect();
  if (!from.width) { finish(); return; }
  const cd = window.CARD_DATA?.[card.name] || {};
  const isRed = card.suit === '♥' || card.suit === '♦';

  const wrap = document.createElement('div');
  wrap.className = 'judg-fly';
  wrap.style.left = (from.left + from.width / 2) + 'px';
  wrap.style.top = (from.top + from.height / 2) + 'px';
  wrap.style.width = from.width + 'px';
  wrap.style.height = from.height + 'px';
  wrap.style.marginLeft = (-from.width / 2) + 'px';
  wrap.style.marginTop = (-from.height / 2) + 'px';
  const face = cd.image
    ? `<img src="${cd.image}" alt="" onerror="this.remove()">`
    : `<div class="judg-fly-text">${cd.nameTh || card.name}</div>`;
  // การ์ดสองหน้า: หลังไพ่ขึ้นก่อน (ลุ้น) → พลิกเปิดหน้าเฉลยผล
  wrap.innerHTML = `
    <div class="judg-flip-inner">
      <div class="judg-face judg-back"><img src="${BACK_CARD_SRC}" alt="" onerror="this.remove()"></div>
      <div class="judg-face judg-front ${isRed ? 'red' : 'black'}">
        ${face}
        <div class="judg-fly-pip">${card.rank || ''}${card.suit || ''}</div>
      </div>
    </div>
    <div class="judg-fly-label">${label || '🎴 ตัดสิน'}</div>`;
  document.body.appendChild(wrap);

  const inner = wrap.querySelector('.judg-flip-inner');
  let flewOut = false;
  const flyToDiscard = () => {
    if (flewOut) return; flewOut = true;
    const disc = document.getElementById('discard-pile');
    if (disc) {
      const to = disc.getBoundingClientRect();
      wrap.style.transition = 'left 0.4s ease-in, top 0.4s ease-in, transform 0.4s ease-in, opacity 0.4s ease-in';
      wrap.style.left = (to.left + to.width / 2) + 'px';
      wrap.style.top = (to.top + to.height / 2) + 'px';
      wrap.style.transform = 'scale(0.45)';
      wrap.style.opacity = '0';
    }
    setTimeout(() => { wrap.remove(); finish(); }, 430);
  };
  inner.addEventListener('animationend', flyToDiscard, { once: true });
  // กันค้าง: ถ้า animationend ไม่ยิง (เช่นแท็บถูกซ่อน) → บังคับเดินต่อ
  setTimeout(flyToDiscard, 2100);
}

// มุมการ์ด: เลข + ดอก (สีแดง=โพแดง/ข้าวหลามตัด, ดำ=โพดำ/ดอกจิก)
function suitPip(card) {
  if (!card.suit) return '';
  const isRed = card.suit === '♥' || card.suit === '♦';
  return `<div class="suit-pip ${isRed ? 'red' : 'black'}">
    <span class="pip-rank">${card.rank || card.value}</span>
    <span class="pip-suit">${card.suit}</span>
  </div>`;
}

// ─── Card Play Logic ────────────────────────────────────────────────────
function onCardClick(card) {
  const room = STATE.room;
  const game = room?.game;
  const players = room?.players || [];
  const isMyTurn = game && players[game.currentPlayer]?.id === STATE.playerId && game.phase === 'play';
  if (!isMyTurn) { notify('ยังไม่ใช่ตาของคุณ', 'error'); return; }
  if (game.harvest) { notify('กำลังเก็บเกี่ยว — รอเลือกไพ่ให้ครบก่อน', 'error'); return; }

  // ตรวจเงื่อนไขการเล่นการ์ดก่อน
  const issue = cardPlayIssue(card);
  if (issue) { notify(issue, 'error'); return; }

  if (STATE.selectedCard?.id === card.id) {
    // Deselect
    STATE.selectedCard = null;
    STATE.selectingTarget = false;
    renderGame();
    return;
  }

  STATE.selectedCard = card;
  STATE.playAs = null;
  const me2 = players.find(p => p.id === STATE.playerId);

  // ── ทักษะแปลงการ์ด (กานหนิง: ดำ→เผาสะพาน, ต้าเฉียว: ♦→มัวเมา) ──
  const subs = getSubstitutions(me2, card);
  if (subs.length) { openSubChooser(card, subs); return; }

  beginCardPlay(card, me2, null);
}

// ทักษะแปลงการ์ดของผู้เล่น (เทียบกับ CHAR_PASSIVES ฝั่งเซิร์ฟเวอร์)
function getSubstitutions(me, card) {
  if (!me) return [];
  const out = [];
  if (me.character === 'ganning' && card.color === 'black' && card.name !== 'Burning Bridges')
    out.push({ as: 'Burning Bridges', label: '🔥 เผาสะพาน (奇袭)', needsTarget: true });
  if (me.character === 'daqiao' && card.suit === '♦' && card.name !== 'Overindulgence')
    out.push({ as: 'Overindulgence', label: '🍵 มัวเมา (国色)', needsTarget: true });
  return out;
}

// เมนูเลือกว่าจะเล่นการ์ดปกติ หรือใช้เป็นการ์ดอื่น (ทักษะแปลง)
function openSubChooser(card, subs) {
  const overlay = document.getElementById('modal-skill');
  const me = STATE.room.players.find(p => p.id === STATE.playerId);
  const cd = window.CARD_DATA[card.name];
  const opts = [{ as: null, label: `เล่นปกติ (${cd?.nameTh || card.name})`, needsTarget: ['Attack','Steal','Burning Bridges','Borrowed Sword','Duel','Overindulgence'].includes(card.name) }, ...subs];
  overlay.innerHTML = `<div class="modal gold-frame" style="width:360px;max-width:92vw;text-align:center">
    <h2 style="margin:0 0 12px;font-size:1.05rem;color:#d2a8e8">ใช้การ์ดนี้อย่างไร?</h2>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${opts.map((o, i) => `<button class="btn btn-confirm sub-opt" data-i="${i}" style="width:100%">${o.label}</button>`).join('')}
    </div>
    <button class="btn btn-cancel" id="sub-cancel" style="width:100%;margin-top:10px">ยกเลิก</button></div>`;
  overlay.classList.add('active');
  overlay.querySelectorAll('.sub-opt').forEach(el => {
    el.addEventListener('click', () => {
      overlay.classList.remove('active');
      const o = opts[+el.dataset.i];
      STATE.playAs = o.as;
      beginCardPlay(card, me, o.as, o.needsTarget);
    });
  });
  document.getElementById('sub-cancel').addEventListener('click', () => {
    overlay.classList.remove('active');
    STATE.selectedCard = null; STATE.playAs = null; renderGame();
  });
}

function beginCardPlay(card, me2, asName, forceTarget) {
  const isGuanyuRedCard = me2?.character === 'guanyu' && card.color === 'red' && card.name !== 'Attack';
  const needsTarget = forceTarget != null ? forceTarget
    : (['Attack','Steal','Burning Bridges','Borrowed Sword','Duel','Overindulgence'].includes(card.name) || isGuanyuRedCard);
  STATE.playAs = asName || null;
  if (needsTarget) {
    STATE.selectingTarget = true;
    notify(isGuanyuRedCard ? `[กวนอู] เลือกเป้าหมายโจมตี (${card.name})` : 'เลือกเป้าหมาย...', 'info', 2000);
    renderGame();
  } else {
    STATE.selectingTarget = false;
    socket.emit('playCard', { cardId: card.id, targetId: null, asName: STATE.playAs });
    STATE.selectedCard = null; STATE.playAs = null;
    renderGame();
  }
}

function confirmPlayCard(targetId) {
  if (!STATE.selectedCard) return;
  const card = STATE.selectedCard;
  // ยืมดาบ: เลือกผู้ถืออาวุธก่อน แล้วเปิดหน้าต่างเลือก "เหยื่อ" ที่จะให้โจมตี
  if (card.name === 'Borrowed Sword') {
    STATE.selectingTarget = false;
    openBorrowVictimModal(card, targetId);
    renderGame();
    return;
  }
  socket.emit('playCard', { cardId: card.id, targetId, asName: STATE.playAs || null });
  STATE.selectedCard = null;
  STATE.playAs = null;
  STATE.selectingTarget = false;
  renderGame();
}

// ─── Response Modal (ตอบโต้) ─────────────────────────────────────────────────
function openResponseModal(type, need, cardName, from, msg, alsoAccept = [], dodgesNeeded = 1, canNegate = false, liuliTargets = []) {
  const me = STATE.room?.players.find(p => p.id === STATE.playerId);
  // รวมการ์ดที่ใช้ตอบโต้ได้: ตรงชนิด + ที่ passive อนุญาตเพิ่ม (รวม [ขัดขวาง])
  const matching = (me?.hand || []).filter(c => {
    if (c.name === need) return true;
    if (alsoAccept.includes(c.name)) return true;
    if (alsoAccept.includes('_black') && c.color === 'black') return true;
    return false;
  });
  const needThMap = { Dodge: 'หลบหลีก', Attack: 'โจมตี', Negation: 'ขัดขวาง' };
  const needTh = needThMap[need] || need;
  const cardThNeed = window.CARD_DATA[need]?.nameTh || needTh;
  const hints = [];
  if (alsoAccept.includes('Attack')) hints.push('การ์ดโจมตีใช้หลบได้');
  if (alsoAccept.includes('Dodge')) hints.push('การ์ดหลบใช้โจมตีได้');
  if (alsoAccept.includes('_black')) hints.push('การ์ดสีดำใช้หลบได้');
  if (canNegate || alsoAccept.includes('Negation')) hints.push('เล่น [ขัดขวาง] ยกเลิกการ์ดกลนี้ได้');
  const extraHint = hints.length
    ? `<div style="color:#f39c12;font-size:0.75rem;text-align:center;margin-bottom:4px">✨ ${hints.join(' · ')}</div>` : '';
  const dodgesHint = dodgesNeeded > 1
    ? `<div style="color:#e74c3c;font-size:0.8rem;text-align:center;margin-bottom:4px">⚠️ ต้องหลบ ${dodgesNeeded} ครั้ง (ลู่ปู้: ศักดิ์ศรีนักรบ)</div>` : '';

  const cardsHTML = matching.length
    ? matching.map(c => {
        const cd = window.CARD_DATA[c.name];
        const isExtra = c.name !== need;
        return `<div class="resp-card ${isExtra ? 'resp-card-alt' : ''}" data-cardid="${c.id}" title="${isExtra ? '✨ ใช้แทนได้' : ''}">
          <img src="${cd?.image||''}" onerror="this.style.display='none'">
          ${suitPip(c)}
        </div>`;
      }).join('')
    : `<div style="color:var(--text-dim);font-size:0.85rem;padding:12px">คุณไม่มีการ์ด${cardThNeed} 😢</div>`;

  // ข้อความปุ่ม "ไม่ตอบโต้" ตามชนิดการ์ดที่กำลังตอบ
  const declineLabel = type === 'negate'   ? '➡️ ปล่อยผ่าน (ไม่ขัดขวาง)'
    : type === 'borrow'   ? '🚫 ไม่โจมตี — เสียอาวุธของคุณ'
    : type === 'duel'     ? '💢 ยอมแพ้ — เสียพลังชีวิต'
    : type === 'avoidatk' ? '💢 ไม่เล่นโจมตี — รับความเสียหาย'
    : '💢 ไม่หลบ — รับความเสียหาย';
  const promptLabel = type === 'negate' ? 'เล่น [ขัดขวาง] เพื่อยกเลิก:' : `เลือกการ์ด${cardThNeed}เพื่อตอบโต้:`;

  const html = `
    <div class="modal gold-frame" style="width:440px">
      <h2 style="color:#e74c3c">⚠️ ต้องตอบโต้!</h2>
      <div style="text-align:center;color:var(--text);margin-bottom:16px;line-height:1.6">${msg}</div>
      ${dodgesHint}${extraHint}
      <div style="color:var(--text-dim);font-size:0.8rem;text-align:center;margin-bottom:8px">${promptLabel}</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px" id="resp-cards">${cardsHTML}</div>
      ${liuliTargets.length ? `<button class="btn" id="resp-liuli" style="width:100%;margin-bottom:8px;background:#6b3fa0;color:#fff">🌀 เบี่ยงเบน (流离) — ทิ้งไพ่โยกการโจมตี</button>` : ''}
      <button class="btn btn-cancel" id="resp-decline" style="width:100%">${declineLabel}</button>
    </div>`;

  const overlay = document.getElementById('modal-response');
  overlay.innerHTML = html;
  overlay.classList.add('active');

  overlay.querySelectorAll('.resp-card').forEach(el => {
    const c = matching.find(c => c.id === el.dataset.cardid);
    if (c) addTooltipHover(el, () => cardTooltipHTML(c.name));
    el.addEventListener('click', () => {
      socket.emit('respondCard', { cardId: el.dataset.cardid });
      overlay.classList.remove('active');
    });
  });
  const liuliBtn = document.getElementById('resp-liuli');
  if (liuliBtn) liuliBtn.addEventListener('click', () => {
    overlay.classList.remove('active');
    openLiuliModal(liuliTargets);
  });
  document.getElementById('resp-decline').addEventListener('click', () => {
    socket.emit('respondCard', { cardId: null });
    overlay.classList.remove('active');
  });
}

// ─── Liu Li (流离) — ต้าเฉียวทิ้งไพ่ 1 ใบ เลือกเป้าหมายโยกการโจมตี ───────────────────
function openLiuliModal(targets) {
  const overlay = document.getElementById('modal-skill');
  if (!overlay) return;
  const me = STATE.room?.players.find(p => p.id === STATE.playerId);
  const hand = me?.hand || [];
  let pickedTarget = null;
  const render = () => {
    overlay.innerHTML = `<div class="modal gold-frame" style="width:420px;max-width:92vw;text-align:center">
      <h2 style="margin:0 0 8px;font-size:1.05rem;color:#b388e0">🌀 เบี่ยงเบน (流离)</h2>
      <div style="color:var(--text-dim);font-size:0.82rem;margin-bottom:10px">${pickedTarget ? 'เลือกการ์ด 1 ใบที่จะทิ้งเพื่อโยกการโจมตี' : 'เลือกเป้าหมายที่จะโยกการโจมตีไปให้'}</div>
      ${pickedTarget
        ? `<div class="skill-card-row">${hand.map(skillPickCardHTML).join('') || '<div style="color:var(--text-dim)">ไม่มีไพ่</div>'}</div>`
        : `<div style="display:flex;flex-direction:column;gap:8px">${(targets || []).map(t => `<button class="btn btn-confirm ll-target" data-id="${t.id}" style="width:100%">🎯 ${t.name}</button>`).join('')}</div>`}
      <button class="btn btn-cancel" id="ll-cancel" style="width:100%;margin-top:10px">↩️ ยกเลิก (กลับไปหลบ)</button>
    </div>`;
    overlay.classList.add('active');
    if (!pickedTarget) {
      overlay.querySelectorAll('.ll-target').forEach(el => el.addEventListener('click', () => { pickedTarget = el.dataset.id; render(); }));
    } else {
      overlay.querySelectorAll('.skill-pick').forEach(el => el.addEventListener('click', () => {
        socket.emit('useLiuli', { cardId: el.dataset.cardid, targetId: pickedTarget });
        overlay.classList.remove('active');
      }));
    }
    document.getElementById('ll-cancel').addEventListener('click', () => {
      overlay.classList.remove('active');
      const a = STATE._lastAwait;   // กลับไปหน้าต่างหลบเดิม
      if (a) openResponseModal(a.type, a.need, a.cardName, a.from, a.msg, a.alsoAccept, a.dodgesNeeded, a.canNegate, a.liuliTargets);
    });
  };
  render();
}

// ─── Peach Modal (ใกล้ตาย — ช่วยตัวเองหรือช่วยเพื่อน) ─────────────────────────
function openPeachModal(msg, forId) {
  STATE._peachOpen = true;
  const me = STATE.room?.players.find(p => p.id === STATE.playerId);
  const dyingId = forId || STATE.room?.game?.dyingPlayerId;
  const savingSelf = dyingId === STATE.playerId;
  const peaches = (me?.hand || []).filter(c => c.name === 'Peach');
  const cardsHTML = peaches.map(c => {
    const cd = window.CARD_DATA['Peach'];
    return `<div class="resp-card" data-cardid="${c.id}">
      <img src="${cd?.image||''}" onerror="this.style.display='none'">
      ${suitPip(c)}
    </div>`;
  }).join('') || `<div style="color:var(--text-dim);font-size:0.85rem;padding:12px">คุณไม่มี [เพอช] 😢</div>`;

  const html = `
    <div class="modal gold-frame" style="width:420px">
      <h2 style="color:#e91e8c">🍑 ${savingSelf ? 'คุณใกล้ตาย!' : 'ช่วยเพื่อน!'}</h2>
      <div style="text-align:center;color:var(--text);margin-bottom:16px;line-height:1.6">${msg}</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px">${cardsHTML}</div>
      <button class="btn btn-cancel" id="peach-decline" style="width:100%">${savingSelf ? '☠️ ยอมตาย' : '🙅 ไม่ช่วย'}</button>
    </div>`;

  const overlay = document.getElementById('modal-response');
  overlay.innerHTML = html;
  overlay.classList.add('active');

  overlay.querySelectorAll('.resp-card').forEach(el => {
    el.addEventListener('click', () => {
      STATE._peachOpen = false;
      socket.emit('usePeach', { cardId: el.dataset.cardid });
      overlay.classList.remove('active');
    });
  });
  document.getElementById('peach-decline').addEventListener('click', () => {
    STATE._peachOpen = false;
    socket.emit('declinePeach', {});
    overlay.classList.remove('active');
  });
}

// ─── Discard Modal (จบตา: เลือกการ์ดที่จะทิ้งเอง ไม่สุ่ม) ──────────────────────
function openDiscardModal(need) {
  STATE._discardOpen = true;
  STATE.discardSelected = [];
  const overlay = document.getElementById('modal-response');

  function render() {
    const me = STATE.room?.players.find(p => p.id === STATE.playerId);
    const hand = me?.hand || [];
    const sel = STATE.discardSelected;
    const cardsHTML = hand.map(c => {
      const cd = window.CARD_DATA[c.name];
      const isSel = sel.includes(c.id);
      return `<div class="resp-card ${isSel ? 'discard-sel' : ''}" data-cardid="${c.id}">
        <img src="${cd?.image||''}" onerror="this.style.display='none'">
        ${suitPip(c)}
      </div>`;
    }).join('');
    const enough = sel.length === need;
    overlay.innerHTML = `
      <div class="modal gold-frame" style="width:min(520px,92vw)">
        <h2 style="color:#f39c12">🗑️ ทิ้งการ์ดตอนจบตา</h2>
        <div style="text-align:center;color:var(--text);margin-bottom:8px;line-height:1.6">
          มือเกินลิมิต — เลือกการ์ดที่จะทิ้ง <b>${need}</b> ใบ (เก็บได้เท่าพลังชีวิต)
        </div>
        <div style="color:var(--text-dim);font-size:0.85rem;text-align:center;margin-bottom:10px">เลือกแล้ว ${sel.length}/${need}</div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px" id="discard-cards">${cardsHTML}</div>
        <button class="btn btn-confirm" id="discard-confirm" style="width:100%;opacity:${enough?'1':'0.5'};cursor:${enough?'pointer':'not-allowed'}">
          🗑️ ทิ้งการ์ด ${sel.length}/${need} ใบ
        </button>
      </div>`;
    overlay.classList.add('active');

    overlay.querySelectorAll('.resp-card').forEach(el => {
      const c = hand.find(h => h.id === el.dataset.cardid);
      if (c) addTooltipHover(el, () => cardTooltipHTML(c.name));
      el.addEventListener('click', () => {
        const id = el.dataset.cardid;
        const i = sel.indexOf(id);
        if (i >= 0) sel.splice(i, 1);
        else if (sel.length >= need) { notify(`เลือกทิ้งได้แค่ ${need} ใบ`, 'error'); return; }
        else sel.push(id);
        render();
      });
    });
    document.getElementById('discard-confirm').addEventListener('click', () => {
      if (sel.length !== need) { notify(`เลือกการ์ดให้ครบ ${need} ใบก่อน`, 'error'); return; }
      socket.emit('discardCards', { cardIds: [...sel] });
      overlay.classList.remove('active');
      STATE._discardOpen = false;
    });
  }
  render();
}

// ─── Harvest Modal (เก็บเกี่ยวอุดมสมบูรณ์: เลือกเก็บไพ่ที่เปิด 1 ใบ) ────────────
function openHarvestModal() {
  STATE._harvestOpen = true;
  const overlay = document.getElementById('modal-response');
  const g = STATE.room?.game;
  const revealed = g?.harvest?.revealed || [];
  const cardsHTML = revealed.map(c => {
    const cd = window.CARD_DATA[c.name];
    return `<div class="resp-card" data-cardid="${c.id}">
      <img src="${cd?.image||''}" onerror="this.style.display='none'">
      ${suitPip(c)}
    </div>`;
  }).join('') || `<div style="color:var(--text-dim);font-size:0.85rem;padding:12px">ไม่มีไพ่เหลือให้เลือก</div>`;

  overlay.innerHTML = `
    <div class="modal gold-frame" style="width:min(560px,92vw)">
      <h2 style="color:#27ae60">🌾 เก็บเกี่ยวอุดมสมบูรณ์</h2>
      <div style="text-align:center;color:var(--text);margin-bottom:8px;line-height:1.6">
        ถึงตาคุณ — เลือกเก็บการ์ด <b>1</b> ใบจากไพ่ที่เปิด
      </div>
      <div style="color:var(--text-dim);font-size:0.8rem;text-align:center;margin-bottom:10px">เหลือ ${revealed.length} ใบ</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:6px" id="harvest-cards">${cardsHTML}</div>
    </div>`;
  overlay.classList.add('active');

  overlay.querySelectorAll('.resp-card').forEach(el => {
    const c = revealed.find(r => r.id === el.dataset.cardid);
    if (c) addTooltipHover(el, () => cardTooltipHTML(c.name));
    el.addEventListener('click', () => {
      socket.emit('harvestPick', { cardId: el.dataset.cardid });
      overlay.classList.remove('active');
      STATE._harvestOpen = false;
    });
  });
}

// ─── Discard Pile Viewer (กองทิ้ง) ───────────────────────────────────────────
function openDiscardPileModal() {
  const g = STATE.room?.game;
  const list = (g?.discard) || [];
  const cont = document.getElementById('discard-modal-list');
  document.getElementById('discard-modal-count').textContent = `(${list.length} ใบ)`;
  if (!list.length) {
    cont.innerHTML = '<div style="color:var(--text-dim);padding:24px;grid-column:1/-1;text-align:center">กองทิ้งยังว่างเปล่า</div>';
  } else {
    // ล่าสุดอยู่บนสุด
    cont.innerHTML = list.slice().reverse().map(c => {
      const cd = window.CARD_DATA[c.name];
      return `<div class="hand-card" data-card="${c.name}" style="width:100%;aspect-ratio:0.71;cursor:help">
        <img src="${cd?.image || ''}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">
        ${suitPip(c)}
        <div class="hand-card-type type-${c.type}">${(cd?.nameTh || c.name).split('(')[0].trim()}</div>
      </div>`;
    }).join('');
    cont.querySelectorAll('[data-card]').forEach(el =>
      addTooltipHover(el, () => cardTooltipHTML(el.dataset.card)));
  }
  document.getElementById('modal-discard').classList.add('active');
}

// ─── Fan Jian (反间) — ทายชนิดไพ่ ───────────────────────────────────────────
function openFanjianModal(sourceName) {
  const overlay = document.getElementById('modal-skill');
  if (!overlay) return;
  const suits = [['♠','#222'],['♥','#c0392b'],['♦','#c0392b'],['♣','#222']];
  overlay.innerHTML = `<div class="modal gold-frame" style="width:380px;max-width:92vw;text-align:center">
    <h2 style="margin:0 0 8px;font-size:1.05rem;color:#d2a8e8">🎭 หว่านเมล็ดหวาดระแวง</h2>
    <div style="color:var(--text-dim);font-size:0.82rem;margin-bottom:14px">${sourceName} บังคับให้คุณทายชนิดไพ่ — ถ้าทายผิดจะรับ 1 ดาเมจ</div>
    <div style="display:flex;gap:10px;justify-content:center">
      ${suits.map(([s,c]) => `<button class="btn fanjian-suit" data-suit="${s}" style="font-size:1.6rem;width:60px;height:60px;color:${c};background:#f4e9d0">${s}</button>`).join('')}
    </div></div>`;
  overlay.classList.add('active');
  overlay.querySelectorAll('.fanjian-suit').forEach(el => {
    el.addEventListener('click', () => {
      socket.emit('fanjianGuess', { suit: el.dataset.suit });
      overlay.classList.remove('active');
    });
  });
}

// ─── Gui Cai (鬼才) — เลือกไพ่ในมือเปลี่ยนไพ่ตัดสิน ───────────────────────────────
function openGuicaiModal(flip, judgeName, jcardName) {
  const overlay = document.getElementById('modal-skill');
  const me = STATE.room.players.find(p => p.id === STATE.playerId);
  const hand = me?.hand || [];
  const red = (flip.suit === '♥' || flip.suit === '♦');
  overlay.innerHTML = `<div class="modal gold-frame" style="width:460px;max-width:94vw">
    <h2 style="margin:0 0 8px;font-size:1.05rem;color:#d2a8e8">🃏 เนโครแมนซี (鬼才)</h2>
    <div style="color:var(--text-dim);font-size:0.82rem;margin-bottom:10px">ไพ่ตัดสินของ ${judgeName || ''} (${jcardName || ''}) คือ <b style="color:${red?'#c0392b':'#222'}">${flip.rank}${flip.suit}</b> — ทิ้งไพ่ในมือ 1 ใบเพื่อเปลี่ยนเป็นไพ่ตัดสินใหม่ หรือปล่อยผ่าน</div>
    <div class="skill-card-row" id="gc-cards">${hand.map(skillPickCardHTML).join('') || '<div style="color:var(--text-dim)">ไม่มีไพ่</div>'}</div>
    <button class="btn btn-confirm" id="gc-confirm" style="width:100%;margin-top:12px">เปลี่ยนไพ่ตัดสิน</button>
    <button class="btn btn-cancel" id="gc-skip" style="width:100%;margin-top:8px">ปล่อยผ่าน</button></div>`;
  overlay.classList.add('active');
  let picked = null;
  overlay.querySelectorAll('.skill-pick').forEach(el => el.addEventListener('click', () => {
    picked = el.dataset.cardid;
    overlay.querySelectorAll('.skill-pick').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
  }));
  document.getElementById('gc-confirm').addEventListener('click', () => {
    if (!picked) return notify('เลือกไพ่ที่จะใช้เปลี่ยน', 'error');
    socket.emit('guicaiReplace', { cardId: picked }); overlay.classList.remove('active');
  });
  document.getElementById('gc-skip').addEventListener('click', () => {
    socket.emit('guicaiReplace', { cardId: null }); overlay.classList.remove('active');
  });
}

// ─── Gang Lie (刚烈) — ผู้ก่อความเสียหายเลือก: ทิ้งการ์ด 2 ใบ หรือ รับ 1 ดาเมจ ──────
function openGanglieModal(victimName, tag) {
  const overlay = document.getElementById('modal-skill');
  if (!overlay) return;
  const me = STATE.room.players.find(p => p.id === STATE.playerId);
  const handCount = me?.hand?.length ?? 0;
  overlay.innerHTML = `<div class="modal gold-frame" style="width:420px;max-width:92vw;text-align:center">
    <h2 style="margin:0 0 8px;font-size:1.05rem;color:#e8a85c">🔥 ความแน่วแน่ (刚烈)</h2>
    <div style="color:var(--text-dim);font-size:0.82rem;margin-bottom:14px">${victimName || ''} เปิดไพ่ตัดสิน <b style="color:#e8a85c">${tag || ''}</b> (ไม่ใช่ ♥) — คุณต้องเลือกรับผล</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-confirm" id="gl-discard" style="width:100%">🗂️ ทิ้งการ์ดในมือ 2 ใบ (มีอยู่ ${handCount} ใบ)</button>
      <button class="btn btn-cancel" id="gl-damage" style="width:100%">💢 รับความเสียหาย 1 หน่วย</button>
    </div></div>`;
  overlay.classList.add('active');
  document.getElementById('gl-discard').addEventListener('click', () => {
    socket.emit('ganglieChoice', { choice: 'discard' }); overlay.classList.remove('active');
  });
  document.getElementById('gl-damage').addEventListener('click', () => {
    socket.emit('ganglieChoice', { choice: 'damage' }); overlay.classList.remove('active');
  });
}

// ─── ขวานผ่าหิน (贯石斧) — โจมตีถูกหลบ: ทิ้งการ์ดในมือ 2 ใบ บังคับดาเมจ หรือ ปล่อยผ่าน ──────
function openRockAxeModal(targetName) {
  const overlay = document.getElementById('modal-skill');
  if (!overlay) return;
  const me = STATE.room.players.find(p => p.id === STATE.playerId);
  const handCount = me?.hand?.length ?? 0;
  overlay.innerHTML = `<div class="modal gold-frame" style="width:420px;max-width:92vw;text-align:center">
    <h2 style="margin:0 0 8px;font-size:1.05rem;color:#e8a85c">🪓 ขวานผ่าหิน (贯石斧)</h2>
    <div style="color:var(--text-dim);font-size:0.82rem;margin-bottom:14px">${targetName || ''} หลบการโจมตีได้ — คุณสามารถทิ้งการ์ดในมือ 2 ใบ เพื่อบังคับให้การโจมตีเข้าทะลุการหลบ</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-confirm" id="ra-use" style="width:100%">🪓 ทิ้งการ์ดในมือ 2 ใบ — บังคับดาเมจ (มีอยู่ ${handCount} ใบ)</button>
      <button class="btn btn-cancel" id="ra-skip" style="width:100%">✋ ปล่อยผ่าน</button>
    </div></div>`;
  overlay.classList.add('active');
  document.getElementById('ra-use').addEventListener('click', () => {
    socket.emit('rockAxeChoice', { choice: 'use' }); overlay.classList.remove('active');
  });
  document.getElementById('ra-skip').addEventListener('click', () => {
    socket.emit('rockAxeChoice', { choice: 'skip' }); overlay.classList.remove('active');
  });
}

// ─── ขโมย/ทำลายสะพาน — เลือกการ์ดของเป้าหมาย (มือ/อุปกรณ์/ช่องตัดสิน) ──────────────
function openTakeCardModal(mode, targetName, options) {
  const overlay = document.getElementById('modal-skill');
  if (!overlay) return;
  const isSteal = mode === 'steal';
  const title = isSteal ? '🃏 ขโมย (顺手牵羊)' : '🔥 ทำลายสะพาน (过河拆桥)';
  const verb = isSteal ? 'ขโมย' : 'ทำลาย';
  const accent = isSteal ? '#5cc8e8' : '#e8a85c';
  overlay.innerHTML = `<div class="modal gold-frame" style="width:440px;max-width:92vw;text-align:center">
    <h2 style="margin:0 0 8px;font-size:1.05rem;color:${accent}">${title}</h2>
    <div style="color:var(--text-dim);font-size:0.82rem;margin-bottom:14px">เลือกการ์ด 1 ใบของ ${targetName || ''} ที่จะ${verb}</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${(options || []).map(o => `<button class="btn btn-confirm tc-opt" data-value="${o.value}" style="width:100%">${o.label}</button>`).join('')}
    </div></div>`;
  overlay.classList.add('active');
  overlay.querySelectorAll('.tc-opt').forEach(el => el.addEventListener('click', () => {
    socket.emit('takeCardPick', { value: el.dataset.value });
    overlay.classList.remove('active');
  }));
}

// การ์ดย่อ (ใช้ในหน้าต่างมรดก) — แสดงชื่อ + เลข/ดอก
function miniCardLabel(c) {
  const red = c.color === 'red' || c.suit === '♥' || c.suit === '♦';
  const cd = window.CARD_DATA[c.name];
  return `${cd?.nameTh || c.name} <b style="color:${red ? '#c0392b' : '#cdd6e0'}">${c.rank || ''}${c.suit || ''}</b>`;
}

// ─── ดูดาว (观星) — UI แบบเก็บเกี่ยวอุดมสมบูรณ์ แต่ติ๊กเลือกไพ่เป็นลำดับ ─────────────
// ติ๊กไพ่ตามลำดับที่จะวาง "บนกอง" (ใบแรกที่ติ๊ก = จั่วก่อน) · ไพ่ที่ไม่ติ๊กจะลงก้นกอง
function openGuanxingModal(cards) {
  const overlay = document.getElementById('modal-skill');
  if (!overlay) return;
  let order = [];   // ids ที่ติ๊กแล้ว ตามลำดับ — บนกอง: order[0] = จั่วใบแรก
  const byId = Object.fromEntries(cards.map(c => [c.id, c]));

  function cardHTML(c) {
    const cd = window.CARD_DATA[c.name];
    const pos = order.indexOf(c.id);
    const selected = pos >= 0;
    const badge = selected
      ? `<div style="position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#27ae60;color:#fff;font-size:0.82rem;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:3;box-shadow:0 0 6px rgba(0,0,0,0.7)">${pos + 1}</div>`
      : `<div style="position:absolute;top:3px;left:3px;font-size:0.6rem;color:#e0a0a0;background:rgba(0,0,0,0.65);padding:1px 4px;border-radius:4px;z-index:3">ก้นกอง</div>`;
    const sel = selected ? 'border-color:#27ae60;box-shadow:0 0 12px rgba(39,174,96,0.7);transform:translateY(-6px)' : '';
    return `<div class="resp-card" data-cardid="${c.id}" style="${sel}">
      <img src="${cd?.image || ''}" onerror="this.style.display='none'">
      ${suitPip(c)}
      ${badge}
    </div>`;
  }

  function render() {
    overlay.innerHTML = `
      <div class="modal gold-frame" style="width:min(560px,94vw)">
        <h2 style="color:#d2a8e8">🔭 ดูดาว (观星)</h2>
        <div style="text-align:center;color:var(--text);margin-bottom:6px;line-height:1.6">
          ติ๊กเลือกไพ่ <b>ตามลำดับที่จะวางบนกอง</b> (ใบแรก = จั่วก่อน)<br>
          ไพ่ที่ไม่เลือกจะถูกวางไว้ <b>ก้นกอง</b>
        </div>
        <div style="color:var(--text-dim);font-size:0.78rem;text-align:center;margin-bottom:10px">คลิกซ้ำเพื่อยกเลิกการเลือก · บนกอง ${order.length} ใบ · ก้นกอง ${cards.length - order.length} ใบ</div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:12px" id="gx-cards">${cards.map(cardHTML).join('')}</div>
        <button class="btn btn-confirm" id="gx-confirm" style="width:100%">ยืนยันการจัดเรียง</button>
      </div>`;
    overlay.classList.add('active');
    overlay.querySelectorAll('.resp-card').forEach(el => {
      const c = byId[el.dataset.cardid];
      if (c) addTooltipHover(el, () => cardTooltipHTML(c.name));
      el.addEventListener('click', () => {
        const id = el.dataset.cardid;
        const i = order.indexOf(id);
        if (i >= 0) order.splice(i, 1); else order.push(id);
        render();
      });
    });
    document.getElementById('gx-confirm').addEventListener('click', () => {
      const bottom = cards.map(c => c.id).filter(id => !order.includes(id));
      socket.emit('guanxingArrange', { top: order.slice(), bottom });
      overlay.classList.remove('active');
    });
  }
  render();
}

// ─── มรดกตกทอด (遗计) — มอบไพ่ที่ดูให้ผู้เล่นคนใดก็ได้ (ต่อใบ) ─────────────────────
function openYijiModal(cards, players) {
  const overlay = document.getElementById('modal-skill');
  if (!overlay) return;
  const myId = STATE.playerId;
  overlay.innerHTML = `<div class="modal gold-frame" style="width:480px;max-width:94vw">
    <h2 style="margin:0 0 6px;font-size:1.05rem;color:#d2a8e8">📜 มรดกตกทอด (遗计)</h2>
    <div style="color:var(--text-dim);font-size:0.8rem;margin-bottom:10px">เลือกว่าจะมอบไพ่แต่ละใบให้ใคร (ค่าเริ่มต้น = ตัวคุณเอง)</div>
    ${cards.map(c => `
      <div style="display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.25);border:1px solid rgba(210,168,232,0.25);border-radius:8px;padding:6px 8px;margin-bottom:6px">
        <span style="flex:1;font-size:0.85rem">${miniCardLabel(c)}</span>
        <select class="yj-sel" data-id="${c.id}" style="padding:4px 6px;border-radius:6px;background:#1a1530;color:#e8e0f0;border:1px solid rgba(210,168,232,0.4)">
          ${players.map(p => `<option value="${p.id}" ${p.id === myId ? 'selected' : ''}>${p.id === myId ? 'ตัวเอง' : p.name}</option>`).join('')}
        </select>
      </div>`).join('')}
    <button class="btn btn-confirm" id="yj-confirm" style="width:100%;margin-top:10px">ยืนยันการมอบไพ่</button></div>`;
  overlay.classList.add('active');
  document.getElementById('yj-confirm').addEventListener('click', () => {
    const assigns = Array.from(overlay.querySelectorAll('.yj-sel')).map(s => ({ cardId: s.dataset.id, toId: s.value }));
    socket.emit('yijiAssign', { assigns });
    overlay.classList.remove('active');
  });
}

// ─── ยืมดาบ (借刀杀人) — เลือกเป้าหมายที่จะให้ผู้ถืออาวุธโจมตี ────────────────────────
function openBorrowVictimModal(card, holderId) {
  const overlay = document.getElementById('modal-skill');
  if (!overlay) return;
  const holder = STATE.room.players.find(p => p.id === holderId);
  const candidates = STATE.room.players.filter(p => p.hp > 0 && p.id !== holderId);
  overlay.innerHTML = `<div class="modal gold-frame" style="width:420px;max-width:92vw;text-align:center">
    <h2 style="margin:0 0 8px;font-size:1.05rem;color:#5fd6c0">🗡️ ยืมดาบ (借刀杀人)</h2>
    <div style="color:var(--text-dim);font-size:0.82rem;margin-bottom:14px">เลือกเป้าหมายที่จะบังคับให้ <b>${holder?.username || ''}</b> โจมตี (ต้องอยู่ในระยะโจมตีของผู้ถืออาวุธ)</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${candidates.map(p => `<button class="btn btn-confirm bv-opt" data-id="${p.id}" style="width:100%">${p.id === STATE.playerId ? 'ตัวคุณเอง' : p.username} ❤️${p.hp}</button>`).join('')}
    </div>
    <button class="btn btn-cancel" id="bv-cancel" style="width:100%;margin-top:10px">ยกเลิก</button></div>`;
  overlay.classList.add('active');
  overlay.querySelectorAll('.bv-opt').forEach(el => el.addEventListener('click', () => {
    socket.emit('playCard', { cardId: card.id, targetId: holderId, asName: null, victimId: el.dataset.id });
    overlay.classList.remove('active');
    STATE.selectedCard = null; STATE.playAs = null; STATE.selectingTarget = false; renderGame();
  }));
  document.getElementById('bv-cancel').addEventListener('click', () => {
    overlay.classList.remove('active');
    STATE.selectedCard = null; STATE.playAs = null; STATE.selectingTarget = false; renderGame();
  });
}

// ─── Xiao Guo (骁果) — เยว่จินเลือกทิ้งการ์ดพื้นฐาน ───────────────────────────────
function openXiaoguoModal(targetName) {
  const overlay = document.getElementById('modal-skill');
  const me = STATE.room.players.find(p => p.id === STATE.playerId);
  const basics = (me?.hand || []).filter(c => window.CARD_DATA[c.name]?.type === 'basic' || c.type === 'basic');
  overlay.innerHTML = `<div class="modal gold-frame" style="width:460px;max-width:94vw">
    <h2 style="margin:0 0 8px;font-size:1.05rem;color:#d2a8e8">🎯 ไม่หวั่นเกรง (骁果)</h2>
    <div style="color:var(--text-dim);font-size:0.82rem;margin-bottom:10px">ทิ้งการ์ดพื้นฐาน 1 ใบ → บีบ ${targetName || ''} ให้ทิ้งอุปกรณ์ 1 ชิ้น มิฉะนั้นรับ 1 ดาเมจ</div>
    <div class="skill-card-row" id="xg-cards">${basics.map(skillPickCardHTML).join('') || '<div style="color:var(--text-dim)">ไม่มีการ์ดพื้นฐาน</div>'}</div>
    <button class="btn btn-confirm" id="xg-confirm" style="width:100%;margin-top:12px">🎯 ใช้ทักษะ</button>
    <button class="btn btn-cancel" id="xg-skip" style="width:100%;margin-top:8px">ไม่ใช้</button></div>`;
  overlay.classList.add('active');
  let picked = null;
  overlay.querySelectorAll('.skill-pick').forEach(el => el.addEventListener('click', () => {
    picked = el.dataset.cardid;
    overlay.querySelectorAll('.skill-pick').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
  }));
  document.getElementById('xg-confirm').addEventListener('click', () => {
    if (!picked) return notify('เลือกการ์ดพื้นฐานที่จะทิ้ง', 'error');
    socket.emit('xiaoguoUse', { cardId: picked }); overlay.classList.remove('active');
  });
  document.getElementById('xg-skip').addEventListener('click', () => {
    socket.emit('xiaoguoUse', { cardId: null }); overlay.classList.remove('active');
  });
}

function openXiaoguoRespondModal(yuejinName) {
  const overlay = document.getElementById('modal-skill');
  const me = STATE.room.players.find(p => p.id === STATE.playerId);
  const eq = me?.equipment || {};
  const slots = [['weapon','🗡️ อาวุธ'],['armor','🛡️ เกราะ'],['atkMount','🐎 ม้าโจมตี'],['defMount','🐴 ม้าป้องกัน']]
    .filter(([s]) => eq[s]);
  overlay.innerHTML = `<div class="modal gold-frame" style="width:420px;max-width:92vw">
    <h2 style="margin:0 0 8px;font-size:1.05rem;color:#d2a8e8">🎯 ${yuejinName || ''} ใช้ 骁果 ใส่คุณ</h2>
    <div style="color:var(--text-dim);font-size:0.82rem;margin-bottom:10px">ทิ้งอุปกรณ์ 1 ชิ้น หรือ รับ 1 ดาเมจ</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${slots.map(([s,l]) => `<button class="btn btn-confirm xg-eq" data-slot="${s}" style="width:100%">${l}: ${eq[s].name}</button>`).join('')}
    </div>
    <button class="btn btn-cancel" id="xg-take" style="width:100%;margin-top:10px">💢 รับ 1 ดาเมจ</button></div>`;
  overlay.classList.add('active');
  overlay.querySelectorAll('.xg-eq').forEach(el => el.addEventListener('click', () => {
    socket.emit('xiaoguoRespond', { equipSlot: el.dataset.slot }); overlay.classList.remove('active');
  }));
  document.getElementById('xg-take').addEventListener('click', () => {
    socket.emit('xiaoguoRespond', { equipSlot: null }); overlay.classList.remove('active');
  });
}

// ─── ทักษะเจ้านาย (护驾/激将) — ฝ่ายเดียวกันเสนอเล่นการ์ดแทน ──────────────────────
function openLordAssistModal(need, lordName, skill) {
  const overlay = document.getElementById('modal-skill');
  const me = STATE.room.players.find(p => p.id === STATE.playerId);
  const cards = (me?.hand || []).filter(c => c.name === need);
  const needTh = need === 'Dodge' ? 'หลบหลีก' : 'โจมตี';
  overlay.innerHTML = `<div class="modal gold-frame" style="width:460px;max-width:94vw">
    <h2 style="margin:0 0 8px;font-size:1.05rem;color:#d2a8e8">🤝 ${skill === '护驾' ? 'ผู้ติดตาม (护驾)' : 'อิทธิพล (激将)'}</h2>
    <div style="color:var(--text-dim);font-size:0.82rem;margin-bottom:10px">เจ้านาย ${lordName || ''} ขอให้คุณเล่น [${needTh}] แทน — เลือกการ์ดเพื่อช่วย หรือปฏิเสธ</div>
    <div class="skill-card-row" id="la-cards">${cards.map(skillPickCardHTML).join('') || `<div style="color:var(--text-dim)">ไม่มี [${needTh}]</div>`}</div>
    <button class="btn btn-confirm" id="la-confirm" style="width:100%;margin-top:12px">🤝 เล่นแทนเจ้านาย</button>
    <button class="btn btn-cancel" id="la-skip" style="width:100%;margin-top:8px">ปฏิเสธ</button></div>`;
  overlay.classList.add('active');
  let picked = null;
  overlay.querySelectorAll('.skill-pick').forEach(el => el.addEventListener('click', () => {
    picked = el.dataset.cardid;
    overlay.querySelectorAll('.skill-pick').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
  }));
  document.getElementById('la-confirm').addEventListener('click', () => {
    if (!picked) return notify('เลือกการ์ดก่อน', 'error');
    socket.emit('lordAssist', { cardId: picked }); overlay.classList.remove('active');
  });
  document.getElementById('la-skip').addEventListener('click', () => {
    socket.emit('lordAssist', { cardId: null }); overlay.classList.remove('active');
  });
}

// ─── Skill Modal (ใช้ทักษะตัวละคร) ───────────────────────────────────────────
function skillPickCardHTML(c) {
  const cd = window.CARD_DATA[c.name];
  return `<div class="hand-card skill-pick" data-cardid="${c.id}" style="width:54px;height:76px;flex-shrink:0">
    <img src="${cd?.image || ''}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">
    ${suitPip(c)}
  </div>`;
}

function openSkillModal() {
  const sk = STATE.room?.mySkill;
  if (!sk) return;
  if (!sk.usable) { notify(sk.reason || 'ใช้ทักษะตอนนี้ไม่ได้', 'error'); return; }
  const me = STATE.room.players.find(p => p.id === STATE.playerId);
  const hand = me?.hand || [];
  const overlay = document.getElementById('modal-skill');

  // ประเภททักษะ: confirm | cards | card+target | cards+target | card+target2 | target
  const multiCard = (sk.needs === 'cards' || sk.needs === 'cards+target');
  const needsCard = ['cards','card+target','cards+target','card+target2'].includes(sk.needs);
  const needsTarget = ['card+target','cards+target','card+target2','target'].includes(sk.needs);
  const multiTarget = (sk.needs === 'card+target2');
  // เป้าหมายที่เลือกได้ (lijian/jieyin = ตัวละครอื่น; rende = อื่น; huatuo = ทุกคน)
  const targetPool = STATE.room.players.filter(p => p.hp > 0 &&
    (sk.key === 'qingnang' ? true : p.id !== STATE.playerId));

  let body = `<div style="color:var(--text-dim);font-size:0.8rem;margin-bottom:8px">${sk.desc}</div>`;
  if (sk.needs === 'confirm') {
    body += `<button class="btn btn-confirm" id="skill-confirm" style="width:100%;margin-top:8px">✨ ยืนยันใช้ทักษะ</button>`;
  } else {
    if (needsCard) {
      const label = multiCard ? 'เลือกไพ่ (เลือกได้หลายใบ):' : 'เลือกไพ่ 1 ใบ:';
      body += `<div style="color:var(--text-dim);font-size:0.78rem;margin-bottom:6px">${label}</div>
        <div class="skill-card-row" id="skill-cards">${hand.map(skillPickCardHTML).join('') || '<div style="color:var(--text-dim)">ไม่มีไพ่ในมือ</div>'}</div>`;
    }
    if (needsTarget) {
      const tlabel = multiTarget ? 'เลือกเป้าหมาย 2 คน:' : 'เลือกเป้าหมาย:';
      const targets = targetPool.map(p =>
        `<div class="skill-target" data-target="${p.id}">${p.username}<br><span style="font-size:0.7rem;color:var(--text-dim)">${p.hp}/${p.maxHp}❤</span></div>`
      ).join('');
      body += `<div style="color:var(--text-dim);font-size:0.78rem;margin:12px 0 6px">${tlabel}</div>
        <div class="skill-target-row" id="skill-targets">${targets}</div>`;
    }
    body += `<button class="btn btn-confirm" id="skill-confirm" style="width:100%;margin-top:14px">✨ ใช้ทักษะ</button>`;
  }

  overlay.innerHTML = `<div class="modal gold-frame" style="width:460px;max-width:94vw">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h2 style="margin:0;font-size:1.1rem;color:#d2a8e8">✨ ${sk.name}</h2>
      <button class="btn btn-cancel" id="skill-close" style="width:auto;padding:6px 12px">✕</button>
    </div>${body}</div>`;
  overlay.classList.add('active');

  const sel = { cards: new Set(), targets: new Set() };
  overlay.querySelectorAll('.skill-pick').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.cardid;
      if (multiCard) {
        if (sel.cards.has(id)) { sel.cards.delete(id); el.classList.remove('selected'); }
        else { sel.cards.add(id); el.classList.add('selected'); }
      } else {
        sel.cards.clear();
        overlay.querySelectorAll('.skill-pick').forEach(x => x.classList.remove('selected'));
        sel.cards.add(id); el.classList.add('selected');
      }
    });
  });
  overlay.querySelectorAll('.skill-target').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.target;
      if (multiTarget) {
        if (sel.targets.has(id)) { sel.targets.delete(id); el.classList.remove('selected'); }
        else {
          if (sel.targets.size >= 2) return notify('เลือกได้สูงสุด 2 คน', 'error');
          sel.targets.add(id); el.classList.add('selected');
        }
      } else {
        sel.targets.clear();
        overlay.querySelectorAll('.skill-target').forEach(x => x.classList.remove('selected'));
        sel.targets.add(id); el.classList.add('selected');
      }
    });
  });
  document.getElementById('skill-close').addEventListener('click', () => overlay.classList.remove('active'));
  document.getElementById('skill-confirm').addEventListener('click', () => {
    const payload = {};
    if (needsCard && !sel.cards.size) return notify('เลือกไพ่ก่อน', 'error');
    if (needsTarget && !sel.targets.size) return notify('เลือกเป้าหมายก่อน', 'error');
    if (multiTarget && sel.targets.size !== 2) return notify('ต้องเลือก 2 คน', 'error');
    if (multiCard) payload.cardIds = [...sel.cards];
    else if (needsCard) payload.cardId = [...sel.cards][0];
    if (multiTarget) payload.targetIds = [...sel.targets];
    else if (needsTarget) payload.targetId = [...sel.targets][0];
    socket.emit('useSkill', { payload });
    overlay.classList.remove('active');
  });
}

// ─── Chat ────────────────────────────────────────────────────────────────
function addChatMessage(from, message, isSystem) {
  const selectors = ['#chat-messages-lobby', '#chat-messages-game'];
  selectors.forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    const div = document.createElement('div');
    div.className = `chat-msg ${isSystem ? 'system' : ''}`;
    div.innerHTML = `<span class="from">${from}:</span><span class="text">${escHtml(message)}</span>`;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function sendChat(inputId) {
  const input = document.getElementById(inputId);
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit('sendChat', { message: msg });
  addChatMessage(STATE.username, msg, false);
  input.value = '';
}

// ─── Sidebar Tabs ────────────────────────────────────────────────────────
function switchSidebarTab(tab) {
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sidebar-section').forEach(s => s.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById('sidebar-' + tab).classList.add('active');
}

// ─── Main Menu ────────────────────────────────────────────────────────────
document.getElementById('btn-play-online').addEventListener('click', () => {
  document.getElementById('modal-join').classList.add('active');
  loadRoomList();
});

document.getElementById('btn-create-room').addEventListener('click', () => {
  document.getElementById('modal-create').classList.add('active');
});

document.getElementById('btn-encyclopedia').addEventListener('click', () => {
  document.getElementById('modal-encyclopedia').classList.add('active');
  renderEncyclopedia('chars');
});

// ─── Create Room ────────────────────────────────────────────────────────
document.getElementById('form-create').addEventListener('submit', (e) => {
  e.preventDefault();
  const username = document.getElementById('create-username').value.trim();
  if (!username) { notify('กรุณาใส่ชื่อผู้ใช้', 'error'); return; }
  STATE.username = username;
  localStorage.setItem('wtk_name', username);

  socket.emit('createRoom', {
    username,
    settings: {
      roomName: document.getElementById('room-name').value.trim() || `ห้องของ ${username}`,
      password: document.getElementById('room-pw').value.trim(),
      playerLimit: parseInt(document.getElementById('player-limit').value),
      turnTimer: parseInt(document.getElementById('turn-timer').value),
      allowSpectators: document.getElementById('allow-spectators').checked,
      privateRoom: document.getElementById('private-room').checked,
      textChat: document.getElementById('text-chat').checked,
    }
  });
  document.getElementById('modal-create').classList.remove('active');
});

// ─── Join Room ────────────────────────────────────────────────────────────
document.getElementById('form-join').addEventListener('submit', (e) => {
  e.preventDefault();
  const username = document.getElementById('join-username').value.trim();
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const pw = document.getElementById('join-pw').value.trim();
  if (!username) { notify('กรุณาใส่ชื่อผู้ใช้', 'error'); return; }
  if (!code) { notify('กรุณาใส่รหัสห้อง', 'error'); return; }
  STATE.username = username;
  localStorage.setItem('wtk_name', username);
  socket.emit('joinRoom', { roomCode: code, username, password: pw });
  document.getElementById('modal-join').classList.remove('active');
});

async function loadRoomList() {
  const list = document.getElementById('public-room-list');
  list.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;padding:8px">กำลังโหลด...</div>';
  try {
    const res = await fetch('/api/rooms');
    const rooms = await res.json();
    if (!rooms.length) {
      list.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;padding:8px">ไม่มีห้องที่เปิดอยู่</div>';
      return;
    }
    list.innerHTML = '';
    rooms.forEach(r => {
      const div = document.createElement('div');
      div.className = 'room-list-item';
      div.innerHTML = `
        <span class="room-list-code">${r.code}</span>
        <span class="room-list-name">${escHtml(r.name)}</span>
        <span class="room-list-count">${r.players}/${r.limit}👤</span>
        ${r.hasPassword ? '<span>🔒</span>' : ''}
      `;
      div.addEventListener('click', () => {
        document.getElementById('join-code').value = r.code;
      });
      list.appendChild(div);
    });
  } catch {
    list.innerHTML = '<div style="color:#e74c3c;font-size:0.85rem;padding:8px">โหลดไม่ได้</div>';
  }
}

// ─── Lobby Actions ────────────────────────────────────────────────────────
document.getElementById('btn-ready').addEventListener('click', () => {
  const me = STATE.room?.players.find(p => p.id === STATE.playerId);
  socket.emit('setReady', { ready: !me?.ready });
});

document.getElementById('btn-start')?.addEventListener('click', () => {
  socket.emit('startGame');
});

// ─── Draft: ยืนยันเลือกตัวละคร ─────────────────────────────────────────────
document.getElementById('btn-confirm-draft')?.addEventListener('click', () => {
  if (!STATE.draftSelected) { notify('เลือกตัวละครก่อน', 'error'); return; }
  socket.emit('selectCharacter', { characterId: STATE.draftSelected });
});

// ─── เปิดดูกองทิ้ง ─────────────────────────────────────────────────────────
document.getElementById('discard-pile')?.addEventListener('click', openDiscardPileModal);

// ─── กดกองไพ่เพื่อจั่วการ์ดเอง (เฟสจั่ว) ────────────────────────────────────────
document.getElementById('deck-pile')?.addEventListener('click', () => {
  const game = STATE.room?.game;
  const players = STATE.room?.players || [];
  const me = players.find(p => p.id === STATE.playerId);
  const myDrawTurn = game && players[game.currentPlayer]?.id === STATE.playerId
    && game.phase === 'draw' && game.awaitingDraw;
  if (!myDrawTurn) return;
  // ซวีจู้ (裸衣) / จางเหลียว (突袭): เปิดเมนูทางเลือกเฟสจั่ว
  if (me?.character === 'xuzhu' || me?.character === 'zhangliao') { openDrawChoiceModal(me); return; }
  socket.emit('drawCards');
});

// เมนูทางเลือกเฟสจั่ว (Luo Yi / Tu Xi)
function openDrawChoiceModal(me) {
  const overlay = document.getElementById('modal-skill');
  if (!overlay) return;
  let body = `<button class="btn btn-confirm" id="draw-normal" style="width:100%;margin-bottom:8px">🎴 จั่วการ์ดปกติ</button>`;
  if (me.character === 'xuzhu')
    body += `<button class="btn btn-confirm" id="draw-luoyi" style="width:100%">💪 เปลือยกายอุกอาจ (裸衣) — จั่วน้อยลง 1 ใบ, โจมตี/ประลอง +1 ดาเมจ</button>`;
  if (me.character === 'zhangliao') {
    const targets = STATE.room.players.filter(p => p.hp > 0 && p.id !== me.id && (p.hand?.length || p.handCount));
    body += `<div style="color:var(--text-dim);font-size:0.78rem;margin:8px 0 6px">🥷 การโจมตีฉับพลัน (突袭) — เลือกสูงสุด 2 คนเพื่อริบไพ่แทนการจั่ว:</div>
      <div class="skill-target-row" id="tuxi-targets">${STATE.room.players.filter(p => p.hp > 0 && p.id !== me.id).map(p =>
        `<div class="skill-target" data-target="${p.id}">${p.username}</div>`).join('')}</div>
      <button class="btn btn-confirm" id="draw-tuxi" style="width:100%;margin-top:8px">🥷 ริบไพ่ (突袭)</button>`;
  }
  overlay.innerHTML = `<div class="modal gold-frame" style="width:420px;max-width:92vw;text-align:center">
    <h2 style="margin:0 0 12px;font-size:1.05rem;color:#d2a8e8">เฟสจั่วการ์ด</h2>${body}
    <button class="btn btn-cancel" id="draw-cancel" style="width:100%;margin-top:10px">ยกเลิก</button></div>`;
  overlay.classList.add('active');
  const close = () => overlay.classList.remove('active');
  document.getElementById('draw-normal').addEventListener('click', () => { socket.emit('drawCards'); close(); });
  document.getElementById('draw-luoyi')?.addEventListener('click', () => { socket.emit('drawCards', { useLuoyi: true }); close(); });
  const tsel = new Set();
  overlay.querySelectorAll('#tuxi-targets .skill-target').forEach(el => el.addEventListener('click', () => {
    const id = el.dataset.target;
    if (tsel.has(id)) { tsel.delete(id); el.classList.remove('selected'); }
    else { if (tsel.size >= 2) return notify('เลือกได้สูงสุด 2 คน', 'error'); tsel.add(id); el.classList.add('selected'); }
  }));
  document.getElementById('draw-tuxi')?.addEventListener('click', () => {
    if (!tsel.size) return notify('เลือกอย่างน้อย 1 คน', 'error');
    socket.emit('drawCards', { tuxiTargets: [...tsel] }); close();
  });
  document.getElementById('draw-cancel').addEventListener('click', close);
}

document.getElementById('btn-leave-lobby').addEventListener('click', () => {
  socket.emit('leaveRoom');
  STATE.playerId = null; STATE.roomCode = null; STATE.room = null;
  localStorage.removeItem('wtk_pid'); localStorage.removeItem('wtk_room');
  showScreen('menu');
});

// ─── Char Select Actions ────────────────────────────────────────────────
document.getElementById('btn-back-charselect').addEventListener('click', () => showScreen('lobby'));
document.getElementById('btn-confirm-char').addEventListener('click', () => {
  if (STATE.selectedChar) {
    socket.emit('selectCharacter', { characterId: STATE.selectedChar });
    socket.emit('setReady', { ready: true });
  }
  showScreen('lobby');
});

document.querySelectorAll('.char-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.char-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    STATE.charFilter = tab.dataset.kingdom;
    renderCharSelect();
  });
});

// ─── Game Actions ─────────────────────────────────────────────────────────
document.getElementById('btn-end-turn').addEventListener('click', () => {
  socket.emit('endTurn');
  STATE.selectedCard = null;
  STATE.selectingTarget = false;
});

document.getElementById('btn-cancel-target').addEventListener('click', () => {
  STATE.selectedCard = null;
  STATE.selectingTarget = false;
  renderGame();
});

document.getElementById('btn-use-skill')?.addEventListener('click', openSkillModal);

// Sidebar tabs
document.querySelectorAll('.sidebar-tab').forEach(tab => {
  tab.addEventListener('click', () => switchSidebarTab(tab.dataset.tab));
});

// Chat
document.getElementById('chat-input-lobby')?.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat('chat-input-lobby'); });
document.getElementById('chat-send-lobby')?.addEventListener('click', () => sendChat('chat-input-lobby'));
document.getElementById('chat-input-game')?.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat('chat-input-game'); });
document.getElementById('chat-send-game')?.addEventListener('click', () => sendChat('chat-input-game'));

// Copy room code
document.getElementById('lobby-room-code')?.addEventListener('click', () => {
  navigator.clipboard.writeText(STATE.room?.code || '').then(() => notify('คัดลอกรหัสห้องแล้ว!', 'success'));
});

// ─── Encyclopedia ──────────────────────────────────────────────────────────
function renderEncyclopedia(tab) {
  const content = document.getElementById('encyc-content');
  document.querySelectorAll('.encyc-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-encyc="${tab}"]`)?.classList.add('active');

  if (tab === 'chars') {
    const groups = { WEI: [], SHU: [], WU: [], QUN: [] };
    Object.entries(window.CHAR_DATA).forEach(([id, c]) => groups[c.kingdom]?.push({ id, ...c }));
    const knames = { WEI: '🔵 แคว้นเว่ย', SHU: '🟢 แคว้นสู่', WU: '🟠 แคว้นอู๋', QUN: '🟣 ไม่สังกัด' };

    content.innerHTML = Object.entries(groups).map(([k, chars]) => `
      <div style="margin-bottom:20px">
        <div style="color:var(--gold);font-weight:700;margin-bottom:10px;font-size:0.9rem;letter-spacing:2px">${knames[k]}</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
          ${chars.map(c => `
            <div class="char-card" data-charid="${c.id}" style="aspect-ratio:0.7;cursor:pointer">
              <img src="${c.image}" style="width:100%;height:100%;object-fit:cover">
              <div class="char-card-hp">❤️${c.hp}</div>
              <div class="char-card-name">${c.nameTh}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    content.querySelectorAll('.char-card').forEach(el => {
      addTooltipHover(el, () => charTooltipHTML(el.dataset.charid));
    });

  } else if (tab === 'cards') {
    const types = ['basic', 'stratagem', 'weapon', 'armor', 'mount'];
    const typeNames = { basic: '⚔️ การ์ดพื้นฐาน', stratagem: '🃏 การ์ดกล', weapon: '🗡️ อาวุธ', armor: '🛡️ เกราะ', mount: '🐴 ม้า' };
    content.innerHTML = types.map(type => {
      const cards = Object.entries(window.CARD_DATA).filter(([, c]) => c.type === type);
      if (!cards.length) return '';
      return `
        <div style="margin-bottom:20px">
          <div style="color:var(--gold);font-weight:700;margin-bottom:10px;font-size:0.9rem;letter-spacing:2px">${typeNames[type]}</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
            ${cards.map(([name, c]) => `
              <div class="hand-card" data-card="${name}" style="width:70px;height:98px;cursor:pointer;flex-shrink:0">
                <img src="${c.image}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">
                <div class="card-count-badge">×${window.CARD_COUNTS[name]||1}</div>
                <div class="hand-card-type type-${c.type}">${c.nameTh.split('(')[0].trim()}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    content.querySelectorAll('[data-card]').forEach(el => {
      addTooltipHover(el, () => cardTooltipHTML(el.dataset.card));
    });

  } else if (tab === 'roles') {
    content.innerHTML = Object.entries(window.ROLE_DATA).map(([role, r]) => `
      <div class="skill-item" style="display:flex;gap:12px;align-items:center;cursor:pointer;margin-bottom:10px" data-role="${role}">
        <img src="${r.image}" style="width:52px;height:73px;object-fit:cover;border-radius:4px;border:1px solid var(--border)">
        <div>
          <div style="color:${r.color};font-weight:700;font-size:1rem">${r.nameTh}</div>
          <div style="color:var(--text-dim);font-size:0.8rem">${r.nameEn}</div>
          <div style="color:var(--text);font-size:0.8rem;margin-top:4px">${r.desc}</div>
        </div>
      </div>
    `).join('');

    content.querySelectorAll('[data-role]').forEach(el => {
      addTooltipHover(el, () => roleTooltipHTML(el.dataset.role));
    });
  }
}

document.querySelectorAll('.encyc-tab').forEach(tab => {
  tab.addEventListener('click', () => renderEncyclopedia(tab.dataset.encyc));
});

// ─── Guide / Rulebook (คู่มือการเล่นและกฎกติกา) ────────────────────────────
function openGuide(tab = 'start') {
  document.getElementById('modal-guide').classList.add('active');
  renderGuide(tab);
}
['btn-guide', 'btn-guide-lobby', 'btn-guide-game'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => openGuide('start'));
});
document.querySelectorAll('.guide-tab').forEach(tab => {
  tab.addEventListener('click', () => renderGuide(tab.dataset.guide));
});

function renderGuide(tab) {
  const content = document.getElementById('guide-content');
  document.querySelectorAll('.guide-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-guide="${tab}"]`)?.classList.add('active');
  content.scrollTop = 0;

  const cardImg = (key, fallback) =>
    (window.CARD_DATA && window.CARD_DATA[key] && window.CARD_DATA[key].image) || fallback;

  if (tab === 'start') {
    content.innerHTML = `
      <h3>🚀 เริ่มเล่นใน 5 ขั้นตอน</h3>
      <p class="dim">สงครามสามก๊กเพื่อนซี้ เป็นเกมไพ่สวมบทบาท เล่น 2–10 คน ทุกคนได้รับ
      <b>บทบาทลับ</b> และ <b>ขุนพล</b> 1 คน เป้าหมายขึ้นกับบทบาทที่จับได้ —
      เอาชนะด้วยการเล่นไพ่โจมตี ป้องกัน และวางแผนให้ฝ่ายตัวเองชนะ</p>

      <div class="guide-steps">
        <div class="guide-step"><div class="num">1</div><div class="body"><b>เข้าห้อง</b> — กด <b>⚔️ เล่นออนไลน์</b> ใส่รหัสห้องจากเพื่อน หรือ <b>🏠 สร้างห้อง</b> เองแล้วแชร์รหัส (เช่น <b>WTK-A1B2C3</b>) ให้เพื่อน</div></div>
        <div class="guide-step"><div class="num">2</div><div class="body"><b>กดพร้อม</b> — ในหน้า Lobby กด <b>✓ พร้อมแล้ว</b> เมื่อทุกคนพร้อม เจ้าของห้องกด <b>▶ เริ่มเกม</b></div></div>
        <div class="guide-step"><div class="num">3</div><div class="body"><b>รับบทบาท</b> — เปิดการ์ดบทบาทลับ (จักรพรรดิ/ผู้ภักดี/กบฎ/ทรยศ) เฉพาะ <b>จักรพรรดิ</b> เปิดเผยตัว คนอื่นปิดไว้</div></div>
        <div class="guide-step"><div class="num">4</div><div class="body"><b>เลือกขุนพล</b> — เลือกตัวละครจากการ์ดในมือ แต่ละคนมี <b>ทักษะพิเศษ</b> และพลังชีวิต (❤️) ต่างกัน</div></div>
        <div class="guide-step"><div class="num">5</div><div class="body"><b>ลงสนาม</b> — ผลัดกันเล่นทีละตา จั่วไพ่ → ใช้ไพ่โจมตี/ป้องกัน/อุปกรณ์ → จบตา จนกว่าจะมีฝ่ายชนะ</div></div>
      </div>

      <h4>🗺️ หน้าตากระดานเกม</h4>
      <div class="mini-board">
        <div class="mb-tag" style="top:8px;left:50%;transform:translateX(-50%)">🔺 ผู้เล่นคนอื่นเรียงรอบวง</div>
        <div class="mb-tag" style="top:50%;left:50%;transform:translate(-50%,-50%)">🂠 กองไพ่ · ♻️ กองทิ้ง · ⏱️ ตัวจับเวลา</div>
        <div class="mb-tag" style="bottom:8px;left:14px">🃏 ไพ่ในมือคุณ</div>
        <div class="mb-tag" style="bottom:8px;right:14px">📋 บันทึก / แชท / ผู้เล่น</div>
        <div class="mb-tag" style="top:8px;right:14px">📘 ปุ่มคู่มือ</div>
      </div>
      <div class="guide-note">💡 อ่านรายละเอียดแต่ละแท็บด้านบน: <b>บทบาท</b> เพื่อรู้เป้าหมายชนะ · <b>ลำดับเทิร์น</b> เพื่อรู้ว่าแต่ละตาทำอะไร · <b>ปุ่มในเกม</b> เพื่อรู้ว่าปุ่มไหนทำอะไร</div>
    `;

  } else if (tab === 'roles') {
    const roles = window.ROLE_DATA || {};
    const order = ['Lord', 'Loyalist', 'Rebel', 'Spy'];
    content.innerHTML = `
      <h3>🎭 บทบาทและเงื่อนไขชนะ</h3>
      <p class="dim">ตอนเริ่มเกมทุกคนจับ <b>บทบาทลับ</b> 1 ใบ บทบาทกำหนดว่า "คุณชนะเมื่อไหร่"
      มีเฉพาะ <b>จักรพรรดิ</b> ที่เปิดเผยตัวตั้งแต่ต้น ที่เหลือต้องเดากันเอาเองจากการเล่น</p>
      <div class="guide-grid">
        ${order.filter(k => roles[k]).map(k => {
          const r = roles[k];
          return `
          <div class="guide-card" style="border-color:${r.color}66">
            <div class="gc-title"><img src="${r.image}" onerror="this.style.display='none'" style="width:30px;height:42px;object-fit:cover;border-radius:4px;border:1px solid ${r.color}"> <span style="color:${r.color}">${r.nameTh}</span></div>
            <div class="gc-body">${r.desc}</div>
            <div class="gc-goal">🎯 <b>เป้าหมาย:</b> ${r.goal}</div>
            <div class="gc-goal">💡 ${r.tips}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="guide-note warn">⚔️ <b>ระวัง:</b> นอกจากจักรพรรดิแล้ว ไม่มีใครรู้บทบาทของคนอื่น — โจมตีผิดคนอาจช่วยศัตรูได้! สังเกตจากการกระทำว่าใครน่าจะอยู่ฝ่ายไหน</div>
    `;

  } else if (tab === 'turn') {
    content.innerHTML = `
      <h3>🔄 ลำดับขั้นในหนึ่งเทิร์น</h3>
      <p class="dim">เมื่อถึงตาคุณ จะไล่ผ่าน 6 ช่วงตามลำดับ ระบบจะพาคุณไปทีละช่วงอัตโนมัติ
      ช่วงที่คุณต้องลงมือเองคือ <b>จั่วการ์ด</b> และ <b>เล่นการ์ด</b></p>
      <div class="phase-flow">
        <div class="phase-box"><div class="pn">🛡️</div><div class="pt">1. เตรียมรบ</div><div class="pd">ทักษะ/เอฟเฟกต์ช่วงต้นเทิร์นทำงาน</div></div>
        <div class="phase-arrow">→</div>
        <div class="phase-box"><div class="pn">⚖️</div><div class="pt">2. ตัดสิน</div><div class="pd">เปิดการ์ดตัดสินถ้ามีเอฟเฟกต์ค้าง</div></div>
        <div class="phase-arrow">→</div>
        <div class="phase-box"><div class="pn">🎴</div><div class="pt">3. จั่วการ์ด</div><div class="pd">กดที่กองไพ่กลางจอ จั่ว 2 ใบ</div></div>
      </div>
      <div class="phase-flow">
        <div class="phase-box"><div class="pn">🃏</div><div class="pt">4. เล่นการ์ด</div><div class="pd">เล่นโจมตี/อุปกรณ์/กลได้ไม่จำกัด (ตามกฎการ์ด)</div></div>
        <div class="phase-arrow">→</div>
        <div class="phase-box"><div class="pn">🗑️</div><div class="pt">5. ทิ้งการ์ด</div><div class="pd">ถ้าไพ่ในมือ &gt; HP ต้องทิ้งส่วนเกิน</div></div>
        <div class="phase-arrow">→</div>
        <div class="phase-box"><div class="pn">🏁</div><div class="pt">6. สิ้นสุดรอบ</div><div class="pd">เอฟเฟกต์ช่วงท้ายทำงาน แล้วส่งตาให้คนถัดไป</div></div>
      </div>
      <div class="guide-note">🎴 <b>ช่วงจั่ว:</b> เมื่อถึงตาคุณ กองไพ่กลางจอจะเรืองแสง — กดเพื่อจั่ว 2 ใบ</div>
      <div class="guide-note">🃏 <b>ช่วงเล่น:</b> คลิกไพ่ในมือเพื่อเล่น ปกติเล่น <b>[โจมตี] ได้ 1 ครั้ง/ตา</b> ส่วนอุปกรณ์และการ์ดกลเล่นได้ตามเงื่อนไข เมื่อพอใจแล้วกด <b>⏭ จบตา</b></div>
      <div class="guide-note warn">🗑️ <b>กฎมือ:</b> จบตาแล้วถ้าไพ่ในมือมากกว่าค่า HP ปัจจุบัน ต้องทิ้งให้เหลือเท่ากับ HP</div>
    `;

  } else if (tab === 'cards') {
    const basics = [
      { k: 'Attack', emoji: '⚔️' },
      { k: 'Dodge', emoji: '🛡️' },
      { k: 'Peach', emoji: '🍑' },
    ];
    const D = window.CARD_DATA || {};
    content.innerHTML = `
      <h3>🃏 การ์ดพื้นฐาน 3 ใบที่ต้องรู้</h3>
      <p class="dim">นี่คือหัวใจของเกม — ไพ่โจมตี ป้องกัน และฟื้นพลัง คุ้นกับ 3 ใบนี้ก่อน
      ส่วนการ์ดกล/อาวุธ/ม้า ดูเพิ่มได้ที่หน้า <b>📖 คลังข้อมูล</b></p>
      <div class="guide-grid">
        ${basics.map(b => {
          const c = D[b.k] || {};
          return `
          <div class="guide-card">
            <div class="gc-title">
              <img src="${cardImg(b.k, '')}" onerror="this.style.display='none'" style="width:34px;height:48px;object-fit:cover;border-radius:4px;border:1px solid var(--border)">
              <span>${b.emoji} ${c.nameTh || b.k}</span>
            </div>
            <div class="gc-body">${c.desc || ''}</div>
            <div class="gc-goal">▶️ ${c.usage || ''}</div>
            ${c.tips ? `<div class="gc-goal">💡 ${c.tips}</div>` : ''}
          </div>`;
        }).join('')}
        <div class="guide-card">
          <div class="gc-title">🧠 การ์ดกล · 🗡️ อุปกรณ์</div>
          <div class="gc-body">การ์ดกล (เช่น ท้าดวล ขโมย ฝนลูกธนู) สร้างผลพิเศษ ส่วนอุปกรณ์ (อาวุธ/เกราะ/ม้า) วางหน้าตัวเพื่อเพิ่มพลังถาวร</div>
          <div class="gc-goal">📖 รายละเอียดครบทุกใบอยู่ที่หน้า "คลังข้อมูล"</div>
        </div>
      </div>
      <h4>🎯 แนวคิดสำคัญ</h4>
      <div class="guide-note"><b>ระยะโจมตี:</b> โจมตีได้เฉพาะคนที่อยู่ "ในระยะ" — ม้าและอาวุธเปลี่ยนระยะได้</div>
      <div class="guide-note"><b>ตอบโต้:</b> เมื่อถูกโจมตี/การ์ดกลใส่ ระบบจะเด้งหน้าต่างให้เลือกเล่น [หลบหลีก] หรือไพ่ตอบโต้</div>
      <div class="guide-note warn"><b>ใกล้ตาย:</b> เมื่อ HP เหลือ 0 จะเข้าภาวะใกล้ตาย — คุณหรือใครก็ได้เล่น [เพอช์] ช่วยได้ก่อนตายจริง</div>
    `;

  } else if (tab === 'buttons') {
    content.innerHTML = `
      <h3>🎮 ปุ่มและสัญลักษณ์ในเกม</h3>
      <p class="dim">รวมปุ่มที่จะเจอระหว่างเล่น ปุ่มบางปุ่มจะโผล่เฉพาะตอนที่ใช้ได้เท่านั้น</p>
      <div class="btn-ref">
        <div class="btn-ref-row"><div class="btn-ref-chip" style="border-color:var(--gold);color:var(--gold-light)">🎴 กองไพ่</div><div class="btn-ref-desc">กองกลางจอ — เมื่อถึง <b>ช่วงจั่วของคุณ</b> จะเรืองแสงพร้อมข้อความ "👆 กดเพื่อจั่ว!" กดเพื่อจั่ว 2 ใบ</div></div>
        <div class="btn-ref-row"><div class="btn-ref-chip">♻️ กองทิ้ง</div><div class="btn-ref-desc">ไพ่ที่ถูกใช้/ทิ้งไปแล้ว <b>คลิกเพื่อดูทั้งกอง</b> ย้อนได้ว่ามีอะไรออกไปบ้าง</div></div>
        <div class="btn-ref-row"><div class="btn-ref-chip">🃏 ไพ่ในมือ</div><div class="btn-ref-desc">แถวล่างสุด — <b>คลิกไพ่</b> เพื่อเล่น ใบที่เล่นได้ตอนนี้จะสว่าง ใบที่เล่นไม่ได้จะหรี่</div></div>
        <div class="btn-ref-row"><div class="btn-ref-chip" style="border-color:#9b59b6;color:#d2a8e8">✨ ใช้ทักษะ</div><div class="btn-ref-desc">โผล่เมื่อขุนพลของคุณมี <b>ทักษะที่สั่งใช้เองได้</b> ในจังหวะนั้น</div></div>
        <div class="btn-ref-row"><div class="btn-ref-chip" style="border-color:#3498db;color:#3498db">✕ ยกเลิก</div><div class="btn-ref-desc">ยกเลิกการเลือกเป้าหมาย/การเล่นไพ่ที่กำลังทำค้างอยู่</div></div>
        <div class="btn-ref-row"><div class="btn-ref-chip" style="border-color:var(--gold);color:var(--gold-light)">⏭ จบตา</div><div class="btn-ref-desc">จบ <b>ช่วงเล่นการ์ด</b> ของคุณ ส่งตาให้คนถัดไป (อาจต้องทิ้งไพ่เกินมือก่อน)</div></div>
        <div class="btn-ref-row"><div class="btn-ref-chip">⏱️ ตัวจับเวลา</div><div class="btn-ref-desc">วงกลมกลางจอ นับเวลาที่เหลือในตา/การตอบโต้ หมดเวลาจะข้ามให้อัตโนมัติ</div></div>
        <div class="btn-ref-row"><div class="btn-ref-chip">❤️ HP</div><div class="btn-ref-desc">หัวใจใต้ชื่อผู้เล่น = พลังชีวิตปัจจุบัน เหลือ 0 = ใกล้ตาย</div></div>
        <div class="btn-ref-row"><div class="btn-ref-chip">📋 แถบข้าง</div><div class="btn-ref-desc">สลับดู <b>บันทึกการรบ · แชท · รายชื่อผู้เล่น</b> ได้จากแท็บด้านขวา</div></div>
        <div class="btn-ref-row"><div class="btn-ref-chip" style="border-color:var(--gold);color:var(--gold-light)">📘 คู่มือ</div><div class="btn-ref-desc">ปุ่มมุมขวาบน — เปิดคู่มือนี้ได้ตลอดเวลาแม้กำลังเล่นอยู่</div></div>
      </div>
      <div class="guide-note">🎯 <b>การเลือกเป้าหมาย:</b> หลังคลิกไพ่ที่ต้องเลือกเป้า ให้ <b>คลิกที่ตัวผู้เล่น</b> รอบวง เป้าที่เลือกได้จะถูกไฮไลต์</div>
    `;

  } else if (tab === 'rulebook') {
    content.innerHTML = `
      <h3>📜 กฎกติกาฉบับเต็ม</h3>
      <p class="dim">เรียบเรียงใหม่จากคู่มือต้นฉบับให้อ่านง่ายและตรงกับเกมจริง — ครอบคลุมตั้งแต่ส่วนประกอบ การเริ่มเกม จนถึงประเภทการ์ดทั้งหมด</p>

      <div class="rule-sec">
        <h4>1️⃣ ส่วนประกอบของเกม</h4>
        <ul class="rule-list">
          <li><b>การ์ดเล่น 108 ใบ</b> — แบ่งเป็น การ์ดพื้นฐาน (โจมตี/หลบหลีก/เพอช์), การ์ดกล, อาวุธ, เกราะ และม้า</li>
          <li><b>การ์ดขุนพล 30 ใบ</b> — แต่ละใบมีแคว้น (เว่ย/สู่/อู๋/ไม่สังกัด), ค่าพลังชีวิต และทักษะเฉพาะตัว</li>
          <li><b>การ์ดบทบาท</b> — จักรพรรดิ · ผู้ภักดี · กบฎ · ทรยศ</li>
          <li><b>เครื่องหมายพลังชีวิต (❤️)</b> และกองไพ่/กองทิ้งกลางโต๊ะ</li>
        </ul>
      </div>

      <div class="rule-sec">
        <h4>2️⃣ การเริ่มเกม</h4>
        <ul class="rule-list">
          <li>แจก <b>การ์ดบทบาทลับ</b> ให้ทุกคน 1 ใบ ตามจำนวนผู้เล่น (ดูตารางด้านล่าง) — มีเฉพาะ <b>จักรพรรดิ</b> ที่เปิดเผยตัว</li>
          <li>จักรพรรดิเลือกขุนพลก่อน จากนั้นผู้เล่นอื่นเลือกขุนพลของตน</li>
          <li>ตั้งค่าพลังชีวิตเริ่มต้นตามขุนพล — <b>จักรพรรดิได้ ❤️ พิเศษ +1</b> (ในเกม 3 คนขึ้นไป)</li>
          <li>ทุกคนจั่วการ์ดขึ้นมือ <b>4 ใบ</b> แล้วเริ่มเล่นโดยจักรพรรดิเป็นคนแรก วนตามเข็มนาฬิกา</li>
        </ul>
        <p class="dim" style="margin-top:6px">📊 ตารางแบ่งบทบาทตามจำนวนผู้เล่น (ตรงตามระบบเกม)</p>
        <table class="rule-table">
          <tr><th>ผู้เล่น</th><th>👑 จักรพรรดิ</th><th>🛡️ ผู้ภักดี</th><th>⚔️ กบฎ</th><th>🕵️ ทรยศ</th></tr>
          <tr><td>2 คน</td><td>1</td><td>0</td><td>1</td><td>0</td></tr>
          <tr><td>3 คน</td><td>1</td><td>0</td><td>1</td><td>1</td></tr>
          <tr><td>4 คน</td><td>1</td><td>1</td><td>1</td><td>1</td></tr>
          <tr><td>5 คน</td><td>1</td><td>1</td><td>2</td><td>1</td></tr>
          <tr><td>6 คน</td><td>1</td><td>1</td><td>3</td><td>1</td></tr>
          <tr><td>7 คน</td><td>1</td><td>2</td><td>3</td><td>1</td></tr>
          <tr><td>8 คน</td><td>1</td><td>2</td><td>4</td><td>1</td></tr>
          <tr><td>9 คน</td><td>1</td><td>3</td><td>4</td><td>1</td></tr>
          <tr><td>10 คน</td><td>1</td><td>3</td><td>4</td><td>2</td></tr>
        </table>
      </div>

      <div class="rule-sec">
        <h4>3️⃣ เป้าหมายของแต่ละบทบาท (เงื่อนไขชนะ)</h4>
        <ul class="rule-list">
          <li><b>👑 จักรพรรดิ + 🛡️ ผู้ภักดี</b> — ชนะเมื่อกำจัด <b>กบฎและทรยศทั้งหมด</b></li>
          <li><b>⚔️ กบฎ</b> — ชนะเมื่อ <b>สังหารจักรพรรดิ</b> (ตราบใดที่ยังไม่เข้าเงื่อนไขชนะของทรยศ)</li>
          <li><b>🕵️ ทรยศ</b> — ชนะเมื่อกำจัดทุกคนจน <b>เหลือรอดเพียงคนเดียว</b> คู่กับจักรพรรดิที่ตายไปแล้ว</li>
        </ul>
        <div class="guide-note">💀 เมื่อ <b>ผู้ภักดี</b> ถูกจักรพรรดิสังหาร จักรพรรดิจะถูกลงโทษ (ทิ้งการ์ดในมือและอุปกรณ์ทั้งหมด) — จงระวังการโจมตีพวกเดียวกัน</div>
      </div>

      <div class="rule-sec">
        <h4>4️⃣ ขั้นตอนในหนึ่งเทิร์น</h4>
        <p>เมื่อถึงตาคุณ จะไล่ผ่าน 6 ช่วงตามลำดับ:</p>
        <ul class="rule-list">
          <li><b>① เตรียมรบ</b> — ทักษะ/เอฟเฟกต์ช่วงต้นเทิร์นทำงาน</li>
          <li><b>② เปิดการ์ดตัดสิน</b> — หากมีเอฟเฟกต์ค้าง (เช่น คำสาป) ให้เปิดการ์ดตัดสินเพื่อหาผล</li>
          <li><b>③ จั่วการ์ด</b> — จั่ว <b>2 ใบ</b> จากกองกลาง (กดที่กองไพ่)</li>
          <li><b>④ เล่นการ์ด</b> — เล่นการ์ดได้ตามต้องการ แต่ <b>[โจมตี] เล่นได้ 1 ครั้งต่อตา</b> (ยกเว้นมีอาวุธ/ทักษะพิเศษ)</li>
          <li><b>⑤ ทิ้งการ์ด</b> — ถ้าจำนวนไพ่ในมือ <b>มากกว่าค่า HP ปัจจุบัน</b> ต้องทิ้งส่วนเกินจนเท่ากับ HP</li>
          <li><b>⑥ สิ้นสุดรอบ</b> — เอฟเฟกต์ช่วงท้ายทำงาน แล้วส่งตาให้คนถัดไป</li>
        </ul>
      </div>

      <div class="rule-sec">
        <h4>5️⃣ การต่อสู้และระยะโจมตี</h4>
        <ul class="rule-list">
          <li><b>[โจมตี] (杀)</b> สร้างความเสียหาย 1 หน่วยให้เป้าหมายที่อยู่ <b>ในระยะ</b> — เป้าหมายเล่น <b>[หลบหลีก] (闪)</b> เพื่อหักล้างได้</li>
          <li><b>ระยะ</b> คำนวณจากตำแหน่งที่นั่งรอบวง — <b>ม้าโจมตี (-1)</b> ทำให้คุณเข้าถึงคนอื่นง่ายขึ้น, <b>ม้าป้องกัน (+1)</b> ทำให้คนอื่นเข้าถึงคุณยากขึ้น</li>
          <li><b>อาวุธ</b> เพิ่มระยะโจมตีและอาจมีผลพิเศษ — ปกติระยะโจมตีพื้นฐานคือ 1</li>
          <li>เมื่อถูกโจมตีหรือการ์ดกลใส่ ระบบจะเปิดหน้าต่างให้คุณ <b>เลือกตอบโต้</b> ด้วยการ์ดที่เหมาะสม</li>
        </ul>
      </div>

      <div class="rule-sec">
        <h4>6️⃣ การบาดเจ็บ ความตาย และสภาพใกล้ตาย</h4>
        <ul class="rule-list">
          <li>ความเสียหายแต่ละหน่วยลด ❤️ ลง 1 — เมื่อ <b>HP เหลือ 0</b> จะเข้าสู่ <b>สภาพใกล้ตาย</b></li>
          <li>ในสภาพใกล้ตาย ผู้เล่นคนนั้นหรือใครก็ได้สามารถเล่น <b>[เพอช์] (桃)</b> เพื่อกู้ HP ให้กลับเป็น 1 ก่อนจะตายจริง</li>
          <li>ถ้าไม่มีใครช่วย ผู้เล่นนั้น <b>เสียชีวิต</b> และเปิดเผยบทบาท — การ์ดในมือและอุปกรณ์ทั้งหมดเข้ากองทิ้ง</li>
          <li><b>รางวัล/บทลงโทษ:</b> ผู้สังหารกบฎจะได้ <b>จั่วการ์ด 3 ใบ</b> · ถ้าจักรพรรดิสังหารผู้ภักดี จักรพรรดิต้องทิ้งการ์ดทั้งหมด</li>
        </ul>
      </div>

      <div class="rule-sec">
        <h4>7️⃣ ประเภทการ์ด</h4>
        <ul class="rule-list">
          <li><b>การ์ดพื้นฐาน</b> — โจมตี, หลบหลีก, เพอช์ (ใช้บ่อยที่สุด)</li>
          <li><b>การ์ดกล</b> — มีผลพิเศษ เช่น ท้าดวล, ขโมย, ทำลายสะพาน, ฝนลูกธนู, ยืมดาบ ฯลฯ</li>
          <li><b>อุปกรณ์: อาวุธ / เกราะ / ม้า</b> — วางหน้าตัวเองเพื่อเพิ่มพลังถาวรจนกว่าจะถูกทำลายหรือเปลี่ยน</li>
        </ul>
        <div class="guide-note">📖 รายละเอียดครบทุกใบ (รูป + คำอธิบาย + เคล็ดลับ) ดูได้ที่หน้า <b>คลังข้อมูล</b> หรือแท็บ <b>🃏 การ์ดพื้นฐาน</b> ด้านบน</div>
      </div>
    `;
  }
}

// ─── Win Screen ────────────────────────────────────────────────────────────
document.getElementById('btn-back-menu').addEventListener('click', () => {
  socket.emit('leaveRoom');
  STATE.playerId = null; STATE.roomCode = null; STATE.room = null;
  localStorage.removeItem('wtk_pid'); localStorage.removeItem('wtk_room');
  showScreen('menu');
});

// ─── Modal Close Helpers ────────────────────────────────────────────────
document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.closeModal)?.classList.remove('active');
  });
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('active');
  });
});

// ─── Init ──────────────────────────────────────────────────────────────────
showScreen('menu');
// Prefill username if stored
if (STATE.username) {
  document.getElementById('create-username').value = STATE.username;
  document.getElementById('join-username').value = STATE.username;
}

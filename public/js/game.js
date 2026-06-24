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
  'Attack': 30, 'Dodge': 15, 'Peach': 1,
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

// ─── ระบบตอบโต้ (หลบหลีก / โต้ดวล) ───────────────────────────────────────────
socket.on('awaitResponse', ({ type, need, cardName, from, msg, alsoAccept, dodgesNeeded, canNegate }) => {
  STATE.responseNeed = need;
  STATE.responseAlsoAccept = alsoAccept || [];
  openResponseModal(type, need, cardName, from, msg, alsoAccept || [], dodgesNeeded || 1, !!canNegate);
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

// ─── การ์ดหน่วงเวลาในช่องตัดสิน (สายฟ้า/เสพสุข) ที่แสดงหน้าผู้เล่น ────────────────
function judgmentBadgesHTML(p) {
  const js = p.judgments || [];
  if (!js.length) return '';
  return `<div class="player-judgments" style="display:flex;gap:3px;justify-content:center;margin-top:2px;flex-wrap:wrap">` +
    js.map(c => {
      const icon = c.name === 'Lightning' ? '⚡' : c.name === 'Overindulgence' ? '🍵' : '🎴';
      const nm = (window.CARD_DATA[c.name]?.nameTh || c.name).split('(')[0].trim();
      return `<span title="ช่องตัดสิน: ${nm}" style="font-size:0.78rem;background:#0008;border:1px solid var(--border);border-radius:6px;padding:0 4px">${icon}</span>`;
    }).join('') + `</div>`;
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
    const angle = ((i - myIdx) / players.length) * Math.PI * 2 - Math.PI / 2;

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
      <div class="player-hp-text">${p.hp}/${p.maxHp} HP · ${char.nameTh||''}</div>
      ${isCurrent ? `<div style="font-size:0.65rem;color:var(--gold);text-align:center">⟵ ตานี้</div>` : ''}
      <div class="player-equip">${equips}</div>
      ${judgmentBadgesHTML(p)}
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
  });
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
  socket.emit('playCard', { cardId: STATE.selectedCard.id, targetId, asName: STATE.playAs || null });
  STATE.selectedCard = null;
  STATE.playAs = null;
  STATE.selectingTarget = false;
  renderGame();
}

// ─── Response Modal (ตอบโต้) ─────────────────────────────────────────────────
function openResponseModal(type, need, cardName, from, msg, alsoAccept = [], dodgesNeeded = 1, canNegate = false) {
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
  document.getElementById('resp-decline').addEventListener('click', () => {
    socket.emit('respondCard', { cardId: null });
    overlay.classList.remove('active');
  });
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

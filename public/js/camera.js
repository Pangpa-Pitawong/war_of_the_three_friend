/* ─── กล้องหน้าผู้เล่น (WebRTC แบบ peer-to-peer) ─────────────────────────────
   - ขออนุญาตผู้เล่นก่อนเสมอ (หน้าต่างยืนยันของเกม → แล้วเบราว์เซอร์จะถามสิทธิ์กล้องอีกชั้น)
   - ภาพวิ่งตรงระหว่างเบราว์เซอร์ของผู้เล่นในห้องเดียวกัน — เซิร์ฟเวอร์แค่ส่งต่อสัญญาณ (rtcSignal)
   - ใช้รูปแบบ "perfect negotiation" กันการเสนอสัญญาณชนกันเมื่อทั้งสองฝั่งเปิดกล้องพร้อมกัน
   ต้องโหลดหลัง game.js (ใช้ตัวแปร socket / STATE / notify ร่วมกัน) */
(function () {
  const Cam = {
    localStream: null,
    withMic: false,
    peers: new Map(),      // playerId → { pc, makingOffer, ignoreOffer, polite }
    remote: new Map(),     // playerId → MediaStream
    camOn: new Set(),      // playerId ที่ประกาศว่าเปิดกล้องอยู่
    videos: new Map(),     // playerId → <video> (คงไว้ข้ามการ render ใหม่)
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
  };
  window.WTFCam = Cam;

  fetch('/api/ice').then(r => r.json()).then(list => {
    if (Array.isArray(list) && list.length) Cam.iceServers = list;
  }).catch(() => {});

  const myId = () => STATE.playerId;
  const room = () => STATE.room;

  // ─── หน้าต่างขออนุญาต ───────────────────────────────────────────────────
  function askConsent() {
    return new Promise((resolve) => {
      let ov = document.getElementById('modal-cam-consent');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'modal-cam-consent';
        ov.className = 'modal-overlay';
        document.body.appendChild(ov);
      }
      ov.innerHTML = `<div class="modal gold-frame" style="width:440px;max-width:92vw">
        <h2 style="margin-bottom:10px">📷 เปิดกล้องให้เพื่อนเห็นหน้า?</h2>
        <div style="color:var(--text);font-size:0.88rem;line-height:1.65">
          เกมจะขอสิทธิ์ใช้ <b>กล้อง</b> ของคุณ (เบราว์เซอร์จะถามยืนยันอีกครั้ง)<br>
          • ภาพจะส่ง <b>ตรงถึงผู้เล่นในห้องนี้เท่านั้น</b> ไม่ถูกบันทึกบนเซิร์ฟเวอร์<br>
          • ปิดกล้องได้ทุกเมื่อด้วยปุ่ม 📷 เดิม<br>
          • ออกจากห้องแล้วกล้องจะปิดเองอัตโนมัติ
        </div>
        <label style="display:flex;gap:8px;align-items:center;margin:14px 0 4px;font-size:0.86rem;cursor:pointer">
          <input type="checkbox" id="cam-consent-mic"> 🎤 เปิดไมโครโฟนด้วย (คุยเสียงได้)
        </label>
        <div class="btn-row" style="margin-top:14px">
          <button type="button" class="btn btn-cancel" id="cam-consent-no">ไม่อนุญาต</button>
          <button type="button" class="btn btn-confirm" id="cam-consent-yes">✓ อนุญาต เปิดกล้อง</button>
        </div>
      </div>`;
      ov.classList.add('active');
      const done = (v) => { ov.classList.remove('active'); resolve(v); };
      ov.querySelector('#cam-consent-yes').onclick = () => done({ mic: ov.querySelector('#cam-consent-mic').checked });
      ov.querySelector('#cam-consent-no').onclick = () => done(null);
    });
  }

  // ─── เปิด/ปิดกล้องของเรา ────────────────────────────────────────────────
  Cam.toggle = async function () {
    if (Cam.localStream) return Cam.stop(true);
    if (!room() || !room().players.some(p => p.id === myId())) return notify('เข้าห้องก่อนจึงจะเปิดกล้องได้', 'error');
    if (!navigator.mediaDevices?.getUserMedia) {
      return notify('เบราว์เซอร์นี้ใช้กล้องไม่ได้ — ต้องเปิดเว็บผ่าน https:// หรือ localhost', 'error', 6000);
    }
    const consent = await askConsent();
    if (!consent) return;
    try {
      Cam.localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 }, facingMode: 'user' },
        audio: consent.mic,
      });
    } catch (err) {
      Cam.localStream = null;
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      notify(denied
        ? '🚫 ไม่ได้รับสิทธิ์ใช้กล้อง — กดไอคอนกล้อง/แม่กุญแจที่แถบที่อยู่เพื่ออนุญาต แล้วลองใหม่'
        : `เปิดกล้องไม่สำเร็จ (${err && err.name || 'error'}) — ตรวจว่ามีกล้องและไม่ได้ถูกแอปอื่นใช้อยู่`, 'error', 7000);
      return;
    }
    Cam.withMic = consent.mic;
    Cam.camOn.add(myId());
    socket.emit('camState', { on: true });
    // ส่งภาพให้ทุกคนที่อยู่ในห้องตอนนี้ (คนที่เข้าทีหลังจะเชื่อมใน sync())
    Cam.peers.forEach((peer) => addLocalTracks(peer.pc));
    sync();
    refreshButtons();
    Cam.attach();
    notify('📷 เปิดกล้องแล้ว — เพื่อนในห้องจะเห็นหน้าคุณ', 'success');
  };

  Cam.stop = function (announce) {
    const wasOn = !!Cam.localStream;
    if (Cam.localStream) {
      Cam.localStream.getTracks().forEach(t => t.stop());
      Cam.localStream = null;
    }
    Cam.camOn.delete(myId());
    // ปิดทุกการเชื่อมต่อ — คนที่ยังเปิดกล้องอยู่จะเชื่อมมาใหม่เองหลังได้รับ camState off
    [...Cam.peers.keys()].forEach(pid => closePeer(pid));
    if (announce === false) Cam.camOn.clear();
    else if (wasOn) socket.emit('camState', { on: false });
    removeVideo(myId());
    refreshButtons();
    Cam.attach();
  };

  function addLocalTracks(pc) {
    if (!Cam.localStream) return;
    const have = new Set(pc.getSenders().map(s => s.track).filter(Boolean));
    Cam.localStream.getTracks().forEach(t => { if (!have.has(t)) pc.addTrack(t, Cam.localStream); });
  }

  // ─── การเชื่อมต่อกับผู้เล่นแต่ละคน ──────────────────────────────────────
  function ensurePeer(pid) {
    let peer = Cam.peers.get(pid);
    if (peer) return peer;
    const pc = new RTCPeerConnection({ iceServers: Cam.iceServers });
    peer = { pc, makingOffer: false, ignoreOffer: false, polite: String(myId()) < String(pid) };
    Cam.peers.set(pid, peer);

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        socket.emit('rtcSignal', { to: pid, data: { description: pc.localDescription } });
      } catch (e) { console.warn('[cam] offer', e); }
      finally { peer.makingOffer = false; }
    };
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('rtcSignal', { to: pid, data: { candidate } });
    };
    pc.ontrack = ({ track, streams }) => {
      const stream = streams[0] || new MediaStream([track]);
      Cam.remote.set(pid, stream);
      track.onended = () => Cam.attach();
      Cam.attach();
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) closePeer(pid);
    };
    addLocalTracks(pc);
    return peer;
  }

  function closePeer(pid) {
    const peer = Cam.peers.get(pid);
    if (peer) { try { peer.pc.close(); } catch {} }
    Cam.peers.delete(pid);
    Cam.remote.delete(pid);
    removeVideo(pid);
  }

  socket.on('rtcSignal', async ({ from, data }) => {
    if (!from || !data) return;
    const peer = ensurePeer(from);
    const pc = peer.pc;
    try {
      if (data.description) {
        const d = data.description;
        const collision = d.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
        peer.ignoreOffer = !peer.polite && collision;
        if (peer.ignoreOffer) return;
        await pc.setRemoteDescription(d);
        if (d.type === 'offer') {
          await pc.setLocalDescription();
          socket.emit('rtcSignal', { to: from, data: { description: pc.localDescription } });
        }
      } else if (data.candidate) {
        try { await pc.addIceCandidate(data.candidate); }
        catch (e) { if (!peer.ignoreOffer) console.warn('[cam] ice', e); }
      }
    } catch (e) { console.warn('[cam] signal', e); }
  });

  socket.on('camState', ({ playerId, on }) => {
    if (!playerId || playerId === myId()) return;
    if (on) Cam.camOn.add(playerId);
    else {
      Cam.camOn.delete(playerId);
      // ปิดการเชื่อมต่อคู่นี้ (อีกฝั่งอาจหลุด/รีโหลดหน้า) — ถ้าเรายังเปิดกล้อง sync() จะเชื่อมใหม่ให้
      closePeer(playerId);
      sync();
    }
    Cam.attach();
  });

  socket.on('kicked', () => Cam.stop(false));
  socket.on('roomUpdate', () => sync());
  socket.on('gameStarted', () => setTimeout(() => Cam.attach(), 0));

  // เชื่อมไปหาผู้เล่นจริงทุกคนในห้อง (เมื่อเราเปิดกล้อง) + ปิดการเชื่อมต่อกับคนที่ออกไปแล้ว
  function sync() {
    const r = room();
    if (!r) return;
    const humans = new Map(r.players.filter(p => !p.isAI && p.id !== myId()).map(p => [p.id, p]));
    Cam.peers.forEach((_, pid) => {
      const p = humans.get(pid);
      if (!p || !p.connected) closePeer(pid);
    });
    if (Cam.localStream) humans.forEach((p, pid) => { if (p.connected) ensurePeer(pid); });
    refreshButtons();
  }

  // ─── แสดงวิดีโอ ─────────────────────────────────────────────────────────
  function streamFor(pid) {
    if (pid === myId()) return Cam.localStream;
    const s = Cam.remote.get(pid);
    if (!s) return null;
    return s.getVideoTracks().some(t => t.readyState === 'live') ? s : null;
  }

  function videoFor(pid, stream) {
    let v = Cam.videos.get(pid);
    if (!v) {
      v = document.createElement('video');
      v.autoplay = true; v.playsInline = true;
      v.className = 'cam-video';
      v.title = 'คลิกเพื่อขยาย/ย่อ';
      // ใช้ pointerdown (ไม่ใช่ click) — กระดานถูก render ใหม่บ่อยระหว่างกดค้าง ทำให้ click หาย
      v.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); openViewer(pid); });
      v.addEventListener('click', (e) => e.stopPropagation());
      Cam.videos.set(pid, v);
    }
    const self = pid === myId();
    v.muted = self;                          // ไม่เล่นเสียงตัวเอง (กันเสียงหอน)
    v.classList.toggle('mirror', self);
    if (v.srcObject !== stream) v.srcObject = stream;
    return v;
  }

  // ขยายดูภาพใหญ่ (หน้าต่างลอยกลางจอ) — คลิกที่ใดก็ได้เพื่อปิด
  function openViewer(pid) {
    const stream = streamFor(pid);
    if (!stream) return;
    document.getElementById('cam-viewer')?.remove();
    if (typeof hideTooltip === 'function') hideTooltip();
    const p = room()?.players.find(x => x.id === pid);
    const ov = document.createElement('div');
    ov.id = 'cam-viewer';
    ov.className = 'cam-viewer';
    ov.innerHTML = `<div class="cam-viewer-box"><video autoplay playsinline muted class="${pid === myId() ? 'mirror' : ''}"></video>
      <div class="cam-viewer-name">📷 ${p ? escHtml(p.username) : ''} · คลิกเพื่อปิด</div></div>`;
    const v = ov.querySelector('video');
    v.srcObject = stream;   // เสียงเล่นจากวิดีโอเล็กอยู่แล้ว → อันนี้ปิดเสียงไว้
    ov.addEventListener('click', () => ov.remove());
    document.body.appendChild(ov);
    v.play().catch(() => {});
  }

  function removeVideo(pid) {
    const v = Cam.videos.get(pid);
    if (v) { v.srcObject = null; v.remove(); }
    Cam.videos.delete(pid);
  }

  // เรียกหลัง render ล็อบบี้/เกม — ย้ายวิดีโอเข้าไปไว้ในช่อง [data-cam-slot] ของผู้เล่นแต่ละคน
  Cam.attach = function () {
    document.querySelectorAll('[data-cam-slot]').forEach(slot => {
      const pid = slot.dataset.camSlot;
      const stream = streamFor(pid);
      if (!stream) { slot.classList.remove('has-video'); slot.replaceChildren(); return; }
      const v = videoFor(pid, stream);
      if (v.parentElement !== slot) { slot.replaceChildren(v); }
      slot.classList.add('has-video');
      if (v.paused) v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    });
  };

  function refreshButtons() {
    const on = !!Cam.localStream;
    document.querySelectorAll('.btn-cam-toggle').forEach(b => {
      b.classList.toggle('cam-active', on);
      b.textContent = b.dataset.compact ? '📷' : (on ? '📷 ปิดกล้อง' : '📷 เปิดกล้อง');
      b.title = on ? 'ปิดกล้อง' : 'เปิดกล้องให้เพื่อนในห้องเห็นหน้า (ขออนุญาตก่อน)';
    });
  }

  document.querySelectorAll('.btn-cam-toggle').forEach(b => b.addEventListener('click', () => Cam.toggle()));
  refreshButtons();
})();

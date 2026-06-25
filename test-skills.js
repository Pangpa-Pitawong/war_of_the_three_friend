// ─── Test harness for CHARACTER SKILLS — drive Game directly (no sockets) ───
const { Game } = require('./server.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}
let uid = 0;
function card(name, type, suit = '♣', value = 5, extra = {}) {
  const color = (suit === '♥' || suit === '♦') ? 'red' : 'black';
  return { id: `t${uid++}`, name, type, suit, value, rank: String(value), color, ...extra };
}
function makePlayer(i, charId, opts = {}) {
  return {
    id: `P${i}`, socketId: `S${i}`, username: `P${i}`,
    character: charId, role: opts.role || (i === 0 ? 'Lord' : 'Rebel'),
    hp: opts.hp ?? 4, maxHp: opts.maxHp ?? 4,
    hand: opts.hand || [], equipment: opts.equipment || { weapon: null, armor: null, atkMount: null, defMount: null },
    judgments: opts.judgments || [], status: [], connected: true, isAI: false,
    attacksThisTurn: 0, skillUsed: {}, wined: false, skipPlay: false,
  };
}
function makeGame(players, deck = []) {
  const room = { code: 'TEST', state: 'playing', players, spectators: [], settings: { turnTimer: 0 } };
  const g = new Game(room);
  g.deck = deck; g.discardPile = []; g.currentPlayer = 0; g.phase = 'play'; g.pending = null;
  return g;
}
// deck.pop() takes from END → last element drawn first

// ─── Cao Cao — Jian Xiong (奸雄): take the damaging card ───
console.log('\n[CaoCao] Jian Xiong — take damaging Attack card');
{
  const atk = card('Attack', 'basic', '♠', 7);
  const p = [makePlayer(0, 'zhangfei', { hand: [atk] }), makePlayer(1, 'caocao')];
  const g = makeGame(p);
  g.playCard('P0', atk.id, 'P1');     // attack caocao
  g.resolveResponse('P1', null);       // no dodge → take damage
  check('caocao hp 3', p[1].hp === 3);
  check('caocao took the Attack card into hand', p[1].hand.some(c => c.id === atk.id));
  check('attack not left in discard', !g.discardPile.some(c => c.id === atk.id));
}

// ─── Sima Yi — Fan Kui (反馈): steal a card from damage source ───
console.log('\n[SimaYi] Fan Kui — steal a card from attacker');
{
  const atk = card('Attack', 'basic', '♠', 7);
  const p = [makePlayer(0, 'zhangfei', { hand: [atk, card('Peach','basic','♥',3)] }), makePlayer(1, 'simayi')];
  const g = makeGame(p);
  g.playCard('P0', atk.id, 'P1');
  g.resolveResponse('P1', null);
  check('simayi hp 3', p[1].hp === 3);
  check('simayi stole a card from attacker', p[1].hand.length === 1);
}

// ─── Guo Jia — Yi Ji (遗计): view top 2 per damage, distribute ───
console.log('\n[GuoJia] Yi Ji — view 2 on taking 1 damage, give to anyone');
{
  const atk = card('Attack', 'basic', '♠', 7);
  const d1 = card('Dodge','basic'), d2 = card('Dodge','basic');
  const p = [makePlayer(0, 'zhangfei', { hand: [atk] }), makePlayer(1, 'guojia')];
  const g = makeGame(p, [d2, d1]);   // d1 drawn first (top), then d2
  g.playCard('P0', atk.id, 'P1');
  g.resolveResponse('P1', null);
  check('yiji window opened (cards held, not yet in hand)', g.yiji && g.yiji.cards.length === 2 && p[1].hand.length === 0);
  // guojia keeps one, gives the other to attacker P0
  g.resolveYiji('P1', [{ cardId: d1.id, toId: 'P1' }, { cardId: d2.id, toId: 'P0' }]);
  check('guojia kept 1 card', p[1].hand.some(c => c.id === d1.id) && p[1].hand.length === 1);
  check('attacker received 1 card', p[0].hand.some(c => c.id === d2.id));
  check('yiji window cleared', !g.yiji);
}
// Yi Ji default/timeout → keep all
{
  const atk = card('Attack', 'basic', '♠', 7);
  const p = [makePlayer(0, 'zhangfei', { hand: [atk] }), makePlayer(1, 'guojia')];
  const g = makeGame(p, [card('Dodge','basic'), card('Dodge','basic')]);
  g.playCard('P0', atk.id, 'P1');
  g.resolveResponse('P1', null);
  g.resolveYiji('P1', null);   // timeout → keep all
  check('guojia kept both on timeout', p[1].hand.length === 2);
}

// ─── Xiahou Dun — Gang Lie (刚烈): non-♥ judgement → source CHOOSES discard 2 / take 1 ───
console.log('\n[Xiahou] Gang Lie — attacker chooses discard 2 on non-♥');
{
  const atk = card('Attack', 'basic', '♠', 7);
  const p = [makePlayer(0, 'zhangfei', { hand: [atk, card('Peach','basic','♥',3), card('Wine','basic','♣',2)] }), makePlayer(1, 'xiahou')];
  const g = makeGame(p, [card('Attack','basic','♠',9)]); // judgement flip = ♠ (non-♥)
  g.playCard('P0', atk.id, 'P1');
  g.resolveResponse('P1', null);   // xiahou takes damage → gang lie window opens for attacker
  check('xiahou hp 3', p[1].hp === 3);
  check('gang lie window opened for attacker', !!g.ganglie && g.ganglie.sourceId === 'P0');
  g.resolveGanglie('P0', 'discard');  // attacker picks "discard 2"
  check('window cleared', !g.ganglie);
  check('attacker discarded 2 cards (0 left)', p[0].hand.length === 0);
  check('attacker took no damage', p[0].hp === 4);
}

// ─── Xiahou Dun — Gang Lie: attacker chooses to TAKE 1 damage instead ───
console.log('\n[Xiahou] Gang Lie — attacker chooses to take 1 damage');
{
  const atk = card('Attack', 'basic', '♠', 7);
  const p = [makePlayer(0, 'zhangfei', { hand: [atk, card('Peach','basic','♥',3), card('Wine','basic','♣',2)] }), makePlayer(1, 'xiahou')];
  const g = makeGame(p, [card('Attack','basic','♠',9)]);
  g.playCard('P0', atk.id, 'P1');
  g.resolveResponse('P1', null);
  g.resolveGanglie('P0', 'damage');   // attacker picks "take 1 damage"
  check('attacker took 1 damage (hp 3)', p[0].hp === 3);
  check('attacker kept both remaining cards', p[0].hand.length === 2);
}

// ─── Xiahou Dun — Gang Lie: attacker with <2 cards is forced to take damage (no window) ───
console.log('\n[Xiahou] Gang Lie — attacker with 0 hand cards auto-takes damage');
{
  const atk = card('Attack', 'basic', '♠', 7);
  const p = [makePlayer(0, 'zhangfei', { hand: [atk] }), makePlayer(1, 'xiahou')];
  const g = makeGame(p, [card('Attack','basic','♠',9)]);
  g.playCard('P0', atk.id, 'P1');     // attacker's only card is the Attack → 0 left after
  g.resolveResponse('P1', null);
  check('no choice window (hand <2)', !g.ganglie);
  check('attacker auto-took 1 damage (hp 3)', p[0].hp === 3);
}

// ─── Hua Xiong — Conqueror: red Attack damage → attacker draws ───
console.log('\n[HuaXiong] Conqueror — red Attack → attacker draws 1');
{
  const atk = card('Attack', 'basic', '♥', 7);
  const p = [makePlayer(0, 'zhangfei', { hand: [atk] }), makePlayer(1, 'huaxiong')];
  const g = makeGame(p, [card('Dodge','basic')]);
  g.playCard('P0', atk.id, 'P1');
  g.resolveResponse('P1', null);
  check('huaxiong hp 3', p[1].hp === 3);
  check('attacker drew 1 (Conqueror)', p[0].hand.length === 1);
}

// ─── Pan Feng — Kuang Fu (狂斧): attack hits lower-hp → draw 2 ───
console.log('\n[PanFeng] Kuang Fu — hit lower-hp target → draw 2');
{
  const atk = card('Attack', 'basic', '♠', 7);
  const p = [makePlayer(0, 'panfeng', { hand: [atk], hp: 4 }), makePlayer(1, 'zhangfei', { hp: 2 })];
  const g = makeGame(p, [card('Dodge','basic'), card('Dodge','basic')]);
  g.playCard('P0', atk.id, 'P1');
  g.resolveResponse('P1', null);
  check('target hp 1', p[1].hp === 1);
  check('panfeng drew 2 (Kuang Fu)', p[0].hand.length === 2);
}

// ─── Zhuge Liang — Kong Cheng (空城): no hand → cannot be Attack target ───
console.log('\n[Zhuge] Kong Cheng — untargetable with empty hand');
{
  const atk = card('Attack', 'basic', '♠', 7);
  const p = [makePlayer(0, 'zhangfei', { hand: [atk] }), makePlayer(1, 'zhuge', { hand: [] })];
  const g = makeGame(p);
  const res = g.playCard('P0', atk.id, 'P1');
  check('attack rejected (kong cheng)', res.ok === false);
  check('zhuge unharmed', p[1].hp === 4);
}
{
  // with a card in hand → targetable
  const atk = card('Attack', 'basic', '♠', 7);
  const p = [makePlayer(0, 'zhangfei', { hand: [atk] }), makePlayer(1, 'zhuge', { hand: [card('Dodge','basic')] })];
  const g = makeGame(p);
  const res = g.playCard('P0', atk.id, 'P1');
  check('attack allowed when zhuge holds a card', res.ok === true && g.pending && g.pending.responderId === 'P1');
}

// ─── Ganning — Qi Xi (奇袭): black card as Burning Bridges ───
console.log('\n[GanNing] Qi Xi — black card used as Burning Bridges');
{
  const blackCard = card('Dodge', 'basic', '♠', 5);
  const p = [makePlayer(0, 'ganning', { hand: [blackCard] }), makePlayer(1, 'zhangfei', { hand: [card('Peach','basic','♥',3)] })];
  const g = makeGame(p);
  const res = g.playCard('P0', blackCard.id, 'P1', 'Burning Bridges');
  check('qi xi accepted', res.ok === true);
  check('target lost a card (burned)', p[1].hand.length === 0);
}

// ─── Da Qiao — Guo Se (国色): diamond card as Overindulgence ───
console.log('\n[DaQiao] Guo Se — ♦ card as Overindulgence');
{
  const diamond = card('Attack', 'basic', '♦', 5);
  const p = [makePlayer(0, 'daqiao', { hand: [diamond] }), makePlayer(1, 'zhangfei')];
  const g = makeGame(p);
  const res = g.playCard('P0', diamond.id, 'P1', 'Overindulgence');
  check('guo se accepted', res.ok === true);
  check('overindulgence placed on target', p[1].judgments.some(c => c.name === 'Overindulgence'));
}

// ─── Da Qiao — Liu Li (流离): redirect an Attack to another in range by discarding ───
console.log('\n[DaQiao] Liu Li — discard to redirect an Attack');
{
  const atk = card('Attack', 'basic', '♠', 7);
  const junk = card('Dodge', 'basic', '♣', 2);
  const p = [
    makePlayer(0, 'zhangfei', { hand: [atk] }),
    makePlayer(1, 'daqiao', { hand: [junk] }),
    makePlayer(2, 'huangzhong'),
  ];
  const g = makeGame(p);
  g.playCard('P0', atk.id, 'P1');                 // attack daqiao
  check('dodge pending on daqiao', g.pending && g.pending.responderId === 'P1');
  const r = g.resolveLiuli('P1', junk.id, 'P2');  // discard junk → redirect to P2
  check('liuli accepted', r.ok === true);
  check('daqiao discarded the card', p[1].hand.length === 0);
  check('attack redirected — pending now on P2', g.pending && g.pending.responderId === 'P2');
  g.resolveResponse('P2', null);                  // P2 can't dodge → takes damage
  check('daqiao unharmed (hp 4)', p[1].hp === 4);
  check('P2 took the redirected damage (hp 3)', p[2].hp === 3);
}

// ─── Hua Tuo — Jiu Ji (急救): red card saves dying in others' turn ───
console.log('\n[HuaTuo] Jiu Ji — red card as Peach to save dying');
{
  const redCard = card('Attack', 'basic', '♥', 5);
  const p = [makePlayer(0, 'zhangfei', { hp: 1 }), makePlayer(1, 'huatuo', { hand: [redCard] })];
  const g = makeGame(p);
  g.currentPlayer = 0;
  g.dealDamage(p[0], 1, p[1]);   // p0 dying; current turn = p0, so huatuo (p1) is "others' turn"
  check('p0 dying', g.dyingPlayerId === 'P0');
  // save order: p0(no peach) then p1(huatuo, red card)
  check('save queue reached huatuo', g.dying && g.dying.order[g.dying.idx] === 'P1');
  g.usePeachToSave('P1', redCard.id);
  check('p0 saved via red card', p[0].hp === 1 && g.dyingPlayerId === null);
}

// ─── Zhou Yu — Ying Zi (英姿): draw +1 in draw phase ───
console.log('\n[ZhouYu] Ying Zi — draw 3 instead of 2');
{
  const p = [makePlayer(0, 'zhouyu'), makePlayer(1, 'zhangfei')];
  const g = makeGame(p, [card('a','basic'),card('b','basic'),card('c','basic'),card('d','basic')]);
  g.phase = 'draw'; g.awaitingDraw = true;
  g.playerDraw('P0');
  check('zhouyu drew 3', p[0].hand.length === 3);
}

// ─── Xu Zhu — Luo Yi (裸衣): draw 1 less, +1 attack damage ───
console.log('\n[XuZhu] Luo Yi — draw 1 less, attack deals +1');
{
  const p = [makePlayer(0, 'xuzhu'), makePlayer(1, 'zhangfei')];
  const g = makeGame(p, [card('a','basic'),card('b','basic'),card('Attack','basic','♠',7)]);
  g.phase = 'draw'; g.awaitingDraw = true;
  g.playerDraw('P0', false, { useLuoyi: true });
  check('xuzhu drew only 1', p[0].hand.length === 1);
  check('luoyiBoost set', p[0].luoyiBoost === true);
  const atk = p[0].hand.find(c => c.name === 'Attack') || card('Attack','basic','♠',7);
  if (!p[0].hand.includes(atk)) p[0].hand.push(atk);
  g.playCard('P0', atk.id, 'P1');
  g.resolveResponse('P1', null);
  check('target took 2 damage (hp 2)', p[1].hp === 2);
}

// ─── Zhang Liao — Tu Xi (突袭): take cards instead of drawing ───
console.log('\n[ZhangLiao] Tu Xi — steal from 2 players instead of drawing');
{
  const p = [makePlayer(0, 'zhangliao'),
             makePlayer(1, 'zhangfei', { hand: [card('Peach','basic','♥',3)] }),
             makePlayer(2, 'guanyu', { hand: [card('Dodge','basic')] })];
  const g = makeGame(p, []);
  g.phase = 'draw'; g.awaitingDraw = true;
  g.playerDraw('P0', false, { tuxiTargets: ['P1','P2'] });
  check('zhangliao took 2 cards', p[0].hand.length === 2);
  check('p1 lost their card', p[1].hand.length === 0);
  check('p2 lost their card', p[2].hand.length === 0);
}

// ─── Diao Chan — Bi Yue (闭月): draw 1 at end of turn ───
console.log('\n[DiaoChan] Bi Yue — draw 1 at end phase');
{
  const p = [makePlayer(0, 'diaochan'), makePlayer(1, 'zhangfei')];
  const g = makeGame(p, [card('a','basic')]);
  const before = p[0].hand.length;
  g.finishTurn();
  check('diaochan drew 1 at end', p[0].hand.length === before + 1);
}

// ─── Lv Meng — Ke Ji (克己): skip discard if no attack ───
console.log('\n[LvMeng] Ke Ji — skip discard when no attack played');
{
  const p = [makePlayer(0, 'lvmeng', { hp: 2, hand: [card('a','basic'),card('b','basic'),card('c','basic'),card('d','basic')] }),
             makePlayer(1, 'zhangfei')];
  const g = makeGame(p, [card('x','basic')]);
  g.currentPlayer = 0; g.phase = 'play';
  p[0].attacksThisTurn = 0;
  g.endTurn('P0');
  check('no discard required (turn advanced)', g.currentPlayer === 1);
  check('lvmeng kept all 4 cards', p[0].hand.length === 4);
}

// ─── Lu Xun — Lian Ying (连营): draw 1 when losing last card ───
console.log('\n[LuXun] Lian Ying — draw on losing last card');
{
  const p = [makePlayer(0, 'zhangfei', { hand: [card('Steal','stratagem')] }),
             makePlayer(1, 'luxun', { hand: [card('Dodge','basic')] })];
  // luxun is immune to steal — use burning bridges instead via zhangfei? Steal blocked. Use a forced loss path:
  const g = makeGame(p, [card('z','basic')]);
  // Directly test takeOneCard trigger
  g.takeOneCard(p[1], true);
  check('luxun drew after losing last card', p[1].hand.length === 1);
}

// ─── Sun Shangxiang — Xiao Ji (枭姬): draw 2 on losing equipment ───
console.log('\n[SunSS] Xiao Ji — draw 2 on losing equipment');
{
  const p = [makePlayer(0, 'sunss', { equipment: { weapon: card('Green Dragon Blade','weapon','♠',5,{range:3}), armor:null, atkMount:null, defMount:null } }),
             makePlayer(1, 'zhangfei')];
  const g = makeGame(p, [card('a','basic'),card('b','basic')]);
  g.afterLoseEquip(p[0], 1);
  check('sunss drew 2', p[0].hand.length === 2);
}

// ─── Lady Gan — Shen Zhi (神智): heal → another draws ───
console.log('\n[LadyGan] Shen Zhi — on heal, another draws');
{
  const p = [makePlayer(0, 'ladygan', { hp: 2 }), makePlayer(1, 'zhangfei')];
  const g = makeGame(p, [card('a','basic')]);
  g.heal(p[0], 1, p[0]);
  check('ladygan healed to 3', p[0].hp === 3);
  check('other player drew (shen zhi)', p[1].hand.length === 1);
}

// ─── Gong Sun Zan — Yi Cong (义从): distance modifier by hp ───
console.log('\n[GongSunZan] Yi Cong — distance reduced at high hp');
{
  const p = [makePlayer(0, 'gongsuanzan', { hp: 4 }), makePlayer(1, 'zhangfei'), makePlayer(2, 'guanyu'), makePlayer(3, 'luxun')];
  const g = makeGame(p);
  const dBase = g.seatDistance(0, 2);
  const dReal = g.distance(p[0], p[2]);
  check('distance reduced by 1 (hp>2)', dReal === Math.max(1, dBase - 1));
}

// ─── Liu Bei — Ren De (仁德): give cards, heal at 2+ ───
console.log('\n[LiuBei] Ren De — give 2 cards → heal');
{
  const p = [makePlayer(0, 'liubei', { hp: 3, hand: [card('a','basic'),card('b','basic'),card('c','basic')] }),
             makePlayer(1, 'zhangfei')];
  const g = makeGame(p);
  g.useSkill('P0', { cardIds: [p[0].hand[0].id, p[0].hand[1].id], targetId: 'P1' });
  check('zhangfei received 2 cards', p[1].hand.length === 2);
  check('liubei healed to 4 (gave 2)', p[0].hp === 4);
}

// ─── Sun Shangxiang — Jie Yin (结姻): discard 2, both heal ───
console.log('\n[SunSS] Jie Yin — discard 2 → both heal');
{
  const p = [makePlayer(0, 'sunss', { hp: 2, hand: [card('a','basic'),card('b','basic')] }),
             makePlayer(1, 'zhangfei', { hp: 2 })]; // zhangfei male, wounded
  const g = makeGame(p);
  g.useSkill('P0', { cardIds: [p[0].hand[0].id, p[0].hand[1].id], targetId: 'P1' });
  check('sunss healed to 3', p[0].hp === 3);
  check('target healed to 3', p[1].hp === 3);
}

// ─── Lady Gan — Shu Shen (淑慎): discard all → heal if > hp ───
console.log('\n[LadyGan] Shu Shen — discard all hand, heal');
{
  const p = [makePlayer(0, 'ladygan', { hp: 2, hand: [card('a','basic'),card('b','basic'),card('c','basic')] }),
             makePlayer(1, 'zhangfei')];
  const g = makeGame(p, [card('x','basic')]);
  g.useSkill('P0', {});
  check('ladygan discarded all', p[0].hand.length >= 0 && !p[0].hand.some(c => ['a','b','c'].includes(c.name)));
  check('ladygan healed to 3 (3 > hp 2)', p[0].hp === 3);
}

// ─── Diao Chan — Li Jian (离间): force 2 males to duel ───
console.log('\n[DiaoChan] Li Jian — two males duel');
{
  const p = [makePlayer(0, 'diaochan', { hand: [card('a','basic')] }),
             makePlayer(1, 'zhangfei', { hand: [] }),
             makePlayer(2, 'guanyu', { hand: [] })];
  const g = makeGame(p);
  g.useSkill('P0', { cardId: p[0].hand[0].id, targetIds: ['P1','P2'] });
  check('duel pending between males', g.pending && g.pending.type === 'duel');
  check('lijian not negatable', g.pending && g.pending.payload.negatable === false);
}

// ─── Zhou Yu — Fan Jian (反间): wrong-suit guess → damage ───
console.log('\n[ZhouYu] Fan Jian — wrong guess → target takes damage');
{
  const spade = card('Attack','basic','♠',5);
  const p = [makePlayer(0, 'zhouyu', { hand: [spade] }), makePlayer(1, 'zhangfei')];
  const g = makeGame(p);
  g.useSkill('P0', { targetId: 'P1' });
  check('fanjian window open', g.fanjian && g.fanjian.targetId === 'P1');
  g.resolveFanjian('P1', '♥');   // guess heart but card is spade → wrong
  check('target took 1 damage', p[1].hp === 3);
  check('target kept the card', p[1].hand.some(c => c.id === spade.id));
}

// ─── Lv Bu — Wu Shuang (无双) in duel: opponent needs 2 attacks ───
console.log('\n[LvBu] Wu Shuang — duel opponent must play 2 attacks');
{
  const p = [makePlayer(0, 'lvbu', { hand: [card('Duel','stratagem')] }),
             makePlayer(1, 'zhangfei', { hand: [card('Attack','basic'), card('Attack','basic')] })];
  const g = makeGame(p);
  g.playCard('P0', p[0].hand[0].id, 'P1');
  check('duel needs 2 attacks', g.pending && g.pending.payload.attacksNeeded === 2);
  g.resolveResponse('P1', p[1].hand[0].id); // play 1st attack
  check('still needs 1 more attack', g.pending && g.pending.type === 'duel' && g.pending.payload.attacksNeeded === 1);
}

// ─── Ma Chao — Tie Ji (铁骑): red judgement → target cannot dodge ───
console.log('\n[MaChao] Tie Ji — red judgement bypasses dodge');
{
  const atk = card('Attack','basic','♠',7);
  const p = [makePlayer(0, 'machao', { hand: [atk] }), makePlayer(1, 'zhangfei', { hand: [card('Dodge','basic')] })];
  const g = makeGame(p, [card('Peach','basic','♥',5)]); // judgement flip red → cannot dodge
  g.playCard('P0', atk.id, 'P1');
  check('no dodge pending (tie ji)', g.pending === null);
  check('target took damage (hp 3)', p[1].hp === 3);
}

// ─── Zhen Ji — Luo Shen (洛神): prepare phase collects black cards ───
console.log('\n[ZhenJi] Luo Shen — collect black judgement cards at prepare');
{
  const p = [makePlayer(0, 'zhenji'), makePlayer(1, 'zhangfei')];
  // deck.pop from end: first flip = ♣ (black, keep), then ♠ (black, keep), then ♥ (red, stop)
  const g = makeGame(p, [card('Dodge','basic','♥',5), card('b','basic','♠',6), card('a','basic','♣',7)]);
  g.currentPlayer = 0;
  g.prepareSkills(p[0]);
  check('zhenji collected 2 black cards', p[0].hand.length === 2);
}

// ─── Sun Quan — Jiu Yuan (救援): WU ally Peach heals +1 ───
console.log('\n[SunQuan] Jiu Yuan — WU ally Peach heals 2');
{
  const p = [makePlayer(0, 'sunquan', { hp: 1, maxHp: 4 }),
             makePlayer(1, 'zhouyu', { hand: [card('Peach','basic','♥',5)] })]; // zhouyu = WU
  const g = makeGame(p);
  g.currentPlayer = 0;
  g.dealDamage(p[0], 1, null); // sunquan dying
  check('sunquan dying', g.dyingPlayerId === 'P0');
  // queue: P0(no peach), P1(zhouyu has peach)
  check('save queue reached zhouyu', g.dying && g.dying.order[g.dying.idx] === 'P1');
  g.usePeachToSave('P1', p[1].hand[0].id);
  check('sunquan healed +2 (Jiu Yuan)', p[0].hp === 2);  // from 0 → +2
}

// ─── Sima Yi — Gui Cai (鬼才): replace a judgement card ───
console.log('\n[SimaYi] Gui Cai — replace Lightning judgement to safe');
{
  const lightning = card('Lightning', 'stratagem', '♠', 5);
  // current player has lightning; simayi (other) will replace the ♠ flip with a red card to save them
  const redReplace = card('Dodge', 'basic', '♥', 6);
  const p = [makePlayer(0, 'zhaoyun', { judgments: [lightning], hp: 4 }),
             makePlayer(1, 'simayi', { hand: [redReplace] })];
  const g = makeGame(p, [card('Attack', 'basic', '♠', 5)]);  // flip would strike (♠5)
  g.runJudgments(p[0]);
  check('guicai window opened (paused)', !!g.guicai && g.guicai.queue[0] === 'P1');
  g.resolveGuicai('P1', redReplace.id);  // replace ♠ with ♥ → lightning safe
  check('simayi used the replacement card', p[1].hand.length === 0);
  check('p0 NOT struck (hp 4)', p[0].hp === 4);
}
{
  // decline → original flip stands (strikes)
  const lightning = card('Lightning', 'stratagem', '♠', 5);
  const p = [makePlayer(0, 'zhaoyun', { judgments: [lightning], hp: 4 }),
             makePlayer(1, 'simayi', { hand: [card('Dodge','basic','♣',6)] })];
  const g = makeGame(p, [card('Attack', 'basic', '♠', 5)]);
  g.runJudgments(p[0]);
  g.resolveGuicai('P1', null);  // decline
  check('p0 struck for 3 (hp 1)', p[0].hp === 1);
}

// ─── Yue Jin — Xiao Guo (骁果): force equip discard or deal damage ───
console.log('\n[YueJin] Xiao Guo — target with no equip takes 1 damage');
{
  const p = [makePlayer(0, 'zhaoyun', { hp: 4, hand: [] }),
             makePlayer(1, 'yuejin', { hand: [card('Dodge','basic','♣',5)] })];
  const g = makeGame(p, []);
  g.currentPlayer = 0; g.phase = 'play';
  g.finishTurn();   // end p0's turn → xiao guo window for yuejin
  check('xiaoguo window opened', !!g.xiaoguo && g.xiaoguo.yuejinId === 'P1');
  g.useXiaoguo('P1', p[1].hand[0].id);  // discard basic; target has no equip → 1 damage
  check('target took 1 damage (hp 3)', p[0].hp === 3);
  check('turn advanced to p1', g.currentPlayer === 1);
}
{
  // target chooses to discard equipment instead
  const p = [makePlayer(0, 'zhaoyun', { hp: 4, hand: [], equipment: { weapon: card('Green Dragon Blade','weapon','♠',5,{range:3}), armor:null, atkMount:null, defMount:null } }),
             makePlayer(1, 'yuejin', { hand: [card('Dodge','basic','♣',5)] })];
  const g = makeGame(p, []);
  g.currentPlayer = 0; g.phase = 'play';
  g.finishTurn();
  g.useXiaoguo('P1', p[1].hand[0].id);  // → target prompted to discard equip
  check('respond phase pending', g.xiaoguo && g.xiaoguo.phase === 'respond');
  g.respondXiaoguo('P0', 'weapon');
  check('target discarded weapon (no damage)', p[0].equipment.weapon === null && p[0].hp === 4);
  check('turn advanced', g.currentPlayer === 1);
}

// ─── Cao Cao — Hu Jia (护驾): WEI ally provides Dodge ───
console.log('\n[CaoCao] Hu Jia — WEI ally plays Dodge for lord');
{
  const atk = card('Attack','basic','♠',7);
  const p = [makePlayer(0, 'caocao', { hand: [], role: 'Lord' }),
             makePlayer(1, 'zhangfei', { hand: [atk], role: 'Rebel' }),       // attacker (SHU, irrelevant)
             makePlayer(2, 'simayi', { hand: [card('Dodge','basic','♣',5)], role: 'Loyalist' })]; // WEI ally
  const g = makeGame(p);
  g.currentPlayer = 1; g.phase = 'play';
  g.playCard('P1', atk.id, 'P0');   // attack caocao
  check('dodge pending on caocao', g.pending && g.pending.responderId === 'P0');
  g.resolveResponse('P0', null);    // caocao declines own dodge → hu jia window
  check('hu jia window opened for WEI ally', !!g.lordAssist && g.lordAssist.queue.includes('P2'));
  g.resolveLordAssist('P2', p[2].hand[0].id);  // simayi provides Dodge
  check('caocao unharmed via Hu Jia (hp 4)', p[0].hp === 4);
  check('ally consumed the Dodge', p[2].hand.length === 0);
}

// ─── Liu Bei — Ji Jiang (激将): SHU ally provides Attack in duel ───
console.log('\n[LiuBei] Ji Jiang — SHU ally plays Attack in duel');
{
  const p = [makePlayer(0, 'liubei', { hand: [], role: 'Lord' }),
             makePlayer(1, 'caocao', { hand: [card('Duel','stratagem')], role: 'Rebel' }),
             makePlayer(2, 'guanyu', { hand: [card('Attack','basic','♣',5)], role: 'Loyalist' })]; // SHU ally
  const g = makeGame(p);
  g.currentPlayer = 1; g.phase = 'play';
  g.playCard('P1', p[1].hand[0].id, 'P0');   // caocao duels liubei
  check('duel pending on liubei', g.pending && g.pending.responderId === 'P0' && g.pending.type === 'duel');
  g.resolveResponse('P0', null);   // liubei has no Attack → ji jiang window
  check('ji jiang window opened for SHU ally', !!g.lordAssist && g.lordAssist.queue.includes('P2'));
  g.resolveLordAssist('P2', p[2].hand[0].id);  // guanyu provides Attack
  // duel swaps → caocao must now attack; he has no attack → caocao takes damage
  check('duel swapped to caocao', g.pending && g.pending.responderId === 'P1' && g.pending.type === 'duel');
  g.resolveResponse('P1', null);
  check('caocao took duel damage (hp 3)', p[1].hp === 3);
  check('liubei unharmed (hp 4)', p[0].hp === 4);
}

// ─── Zhuge Liang — Guan Xing (观星): peek top X, reorder top/bottom ───
console.log('\n[Zhuge] Guan Xing — peek & reorder deck at prepare');
{
  const a = card('Attack','basic','♠',3), b = card('Peach','basic','♥',4), c = card('Dodge','basic','♣',5);
  // deck top (pop end) order: c drawn first, then b, then a
  const p = [makePlayer(0, 'zhuge', { hp: 3, maxHp: 3 })];
  const g = makeGame(p, [a, b, c]);
  g.turn = 0;
  g.runTurn();   // prepare phase → guanxing window
  check('guanxing window opened, paused before judge', !!g.guanxing && g.phase === 'start');
  check('guanxing peeked 1 card (1 alive player)', g.guanxing.cards.length === 1);
  const peeked = g.guanxing.cards[0];
  // send it to the bottom
  g.resolveGuanxing('P0', { top: [], bottom: [peeked.id] });
  check('guanxing resolved, advanced past prepare', !g.guanxing && g.phase !== 'start');
  check('card moved to bottom of deck (drawn last)', g.deck[0].id === peeked.id);
}
{
  // multi-card ordering: 3 players alive → peek 3, reorder top
  const a = card('Attack','basic','♠',3), b = card('Peach','basic','♥',4), c = card('Dodge','basic','♣',5);
  const p = [makePlayer(0, 'zhuge', { hp: 3, maxHp: 3 }), makePlayer(1,'caocao'), makePlayer(2,'liubei')];
  const g = makeGame(p, [a, b, c]);   // top→ c,b,a
  g.turn = 0;
  g.runTurn();
  check('peeked 3 cards', g.guanxing.cards.length === 3);
  const ids = g.guanxing.cards.map(x => x.id);
  // put all back on top with explicit order: want `a` drawn first
  g.resolveGuanxing('P0', { top: [a.id, b.id, c.id], bottom: [] });
  check('top[0] (a) is next drawn', g.deck[g.deck.length - 1].id === a.id);
}

// ─── Borrowed Sword — choose which target the wielder must attack ───
console.log('\n[BorrowedSword] caster picks the victim the wielder attacks');
{
  const weapon = card('Green Dragon Blade', 'weapon', '♠', 5, { range: 3 });
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Borrowed Sword', 'stratagem')] }),
    makePlayer(1, 'zhangfei', { equipment: { weapon, armor: null, atkMount: null, defMount: null }, hand: [card('Attack','basic')] }),
    makePlayer(2, 'liubei', { hp: 4, maxHp: 4 }),
  ];
  const g = makeGame(p);
  const bs = p[0].hand[0];
  // force wielder P1 to attack P2 (not the caster)
  g.playCard('P0', bs.id, 'P1', null, { victimId: 'P2' });
  check('borrow pending on wielder P1', g.pending && g.pending.type === 'borrow' && g.pending.responderId === 'P1');
  g.resolveResponse('P1', p[1].hand[0].id);   // wielder complies → attacks chosen victim
  check('chosen victim P2 must now dodge (not caster)', g.pending && g.pending.type === 'dodge' && g.pending.responderId === 'P2');
  g.resolveResponse('P2', null);
  check('victim P2 took 1 damage (hp 3)', p[2].hp === 3);
  check('caster P0 unharmed (hp 4)', p[0].hp === 4);
}

console.log(`\n──────── ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);

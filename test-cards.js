// ─── Test harness: drive Game directly (no sockets) to validate card effects ───
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
    character: charId, role: i === 0 ? 'Lord' : 'Rebel',
    hp: opts.hp ?? 4, maxHp: opts.maxHp ?? 4,
    hand: opts.hand || [], equipment: opts.equipment || { weapon: null, armor: null, atkMount: null, defMount: null },
    judgments: opts.judgments || [], status: [], connected: true, isAI: false,
    attacksThisTurn: 0, skillUsed: {}, wined: false, skipPlay: false,
  };
}

function makeGame(players, deck = []) {
  const room = { code: 'TEST', state: 'playing', players, spectators: [], settings: { turnTimer: 0 } };
  const g = new Game(room);
  g.deck = deck;          // rigged: pop() takes from end
  g.discardPile = [];
  g.currentPlayer = 0;
  g.phase = 'play';
  g.pending = null;
  return g;
}

// ─── Test 1: Lightning judgment (♠5 → 3 damage) ───
console.log('\n[1] Lightning — ♠5 strikes for 3 damage');
{
  const lightning = card('Lightning', 'stratagem', '♠', 5);
  const p = [makePlayer(0, 'caocao', { judgments: [lightning] }), makePlayer(1, 'zhangfei')];
  // deck top (last) = ♠5 flip
  const g = makeGame(p, [card('Attack', 'basic', '♠', 5)]);
  g.runJudgments(p[0]);
  check('p0 took 3 damage (hp 1)', p[0].hp === 1);
  check('lightning discarded (no judgment left)', p[0].judgments.length === 0);
  check('proceeded to draw phase', g.phase === 'draw' && g.awaitingDraw === true);
}

// ─── Test 2: Lightning chain (♦ → moves to next player) ───
console.log('\n[2] Lightning — ♦ safe, chains to next player');
{
  const lightning = card('Lightning', 'stratagem', '♠', 5);
  const p = [makePlayer(0, 'caocao', { judgments: [lightning] }), makePlayer(1, 'zhangfei')];
  const g = makeGame(p, [card('Dodge', 'basic', '♦', 5)]); // red flip → safe
  g.runJudgments(p[0]);
  check('p0 unharmed (hp 4)', p[0].hp === 4);
  check('lightning moved to p1 judgment zone', p[1].judgments.some(c => c.name === 'Lightning'));
}

// ─── Test 3: Overindulgence (non-♥ → skip play phase) ───
console.log('\n[3] Overindulgence — non-♥ skips play phase');
{
  const over = card('Overindulgence', 'stratagem', '♣', 5);
  const p = [makePlayer(0, 'caocao', { judgments: [over] }), makePlayer(1, 'zhangfei')];
  const g = makeGame(p, [card('Attack', 'basic', '♣', 5)]); // black flip → not ♥
  g.runJudgments(p[0]);
  check('skipPlay flag set', p[0].skipPlay === true);
  // simulate draw → should skip straight to end
  g.awaitingDraw = true; g.deck = [card('Dodge','basic'), card('Dodge','basic')];
  g.playerDraw('P0');
  check('turn passed to p1 after skip (currentPlayer=1)', g.currentPlayer === 1);
}

// ─── Test 4: Overindulgence escape (♥ → play normally) ───
console.log('\n[4] Overindulgence — ♥ escapes');
{
  const over = card('Overindulgence', 'stratagem', '♣', 5);
  const p = [makePlayer(0, 'caocao', { judgments: [over] }), makePlayer(1, 'zhangfei')];
  const g = makeGame(p, [card('Peach', 'basic', '♥', 5)]);
  g.runJudgments(p[0]);
  check('not skipped (♥ escape)', p[0].skipPlay === false);
}

// ─── Test 5: Borrowed Sword — target with weapon declines → loses weapon ───
console.log('\n[5] Borrowed Sword — decline → caster takes weapon');
{
  const weapon = card('Green Dragon Blade', 'weapon', '♠', 5, { range: 3 });
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Borrowed Sword', 'stratagem')] }),
    makePlayer(1, 'zhangfei', { equipment: { weapon, armor: null, atkMount: null, defMount: null } }),
  ];
  const g = makeGame(p);
  const bs = p[0].hand[0];
  g.playCard('P0', bs.id, 'P1');
  check('borrow response pending on p1', g.pending && g.pending.type === 'borrow' && g.pending.responderId === 'P1');
  g.resolveResponse('P1', null); // decline (no attack)
  check('p1 lost weapon', p[1].equipment.weapon === null);
  check('p0 took the weapon into hand', p[0].hand.some(c => c.name === 'Green Dragon Blade'));
}

// ─── Test 6: Borrowed Sword — target attacks caster ───
console.log('\n[6] Borrowed Sword — comply → wielder attacks caster');
{
  const weapon = card('Serpent Spear', 'weapon', '♠', 5, { range: 3 });
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Borrowed Sword', 'stratagem')] }),
    makePlayer(1, 'zhangfei', { equipment: { weapon, armor: null, atkMount: null, defMount: null }, hand: [card('Attack', 'basic')] }),
  ];
  const g = makeGame(p);
  g.playCard('P0', p[0].hand[0].id, 'P1');
  g.resolveResponse('P1', p[1].hand[0].id); // wielder plays Attack at caster
  check('now p0 (caster) must dodge', g.pending && g.pending.type === 'dodge' && g.pending.responderId === 'P0');
  g.resolveResponse('P0', null); // caster does not dodge
  check('p0 took 1 damage (hp 3)', p[0].hp === 3);
}

// ─── Test 7: Negation cancels a Duel ───
console.log('\n[7] Negation — cancels Duel');
{
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Duel', 'stratagem')] }),
    makePlayer(1, 'zhangfei', { hand: [card('Negation', 'stratagem')] }),
  ];
  const g = makeGame(p);
  g.playCard('P0', p[0].hand[0].id, 'P1');
  check('duel pending, canNegate', g.pending && g.pending.type === 'duel');
  g.resolveResponse('P1', p[1].hand[0].id); // play Negation
  check('p1 unharmed (hp 4)', p[1].hp === 4);
  check('p0 unharmed (hp 4)', p[0].hp === 4);
  check('no pending left', g.pending === null);
}

// ─── Test 8: Negation window for Steal ───
console.log('\n[8] Negation — cancels Steal (negate window)');
{
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Steal', 'stratagem')] }),
    makePlayer(1, 'zhangfei', { hand: [card('Negation', 'stratagem'), card('Dodge', 'basic')] }),
  ];
  const g = makeGame(p);
  g.playCard('P0', p[0].hand[0].id, 'P1');
  check('negate window pending', g.pending && g.pending.type === 'negate');
  const before = p[1].hand.length;
  g.resolveResponse('P1', p[1].hand.find(c => c.name === 'Negation').id);
  check('steal cancelled — p1 keeps Dodge', p[1].hand.some(c => c.name === 'Dodge'));
  check('p0 stole nothing', !p[0].hand.some(c => c.name === 'Dodge'));
}

// ─── Test 9: Steal with no Negation applies immediately ───
console.log('\n[9] Steal — no Negation → immediate');
{
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Steal', 'stratagem')] }),
    makePlayer(1, 'zhangfei', { hand: [card('Dodge', 'basic')] }),
  ];
  const g = makeGame(p);
  g.playCard('P0', p[0].hand[0].id, 'P1');
  check('no pending (applied at once)', g.pending === null);
  check('p0 stole the Dodge', p[0].hand.some(c => c.name === 'Dodge'));
  check('p1 has no cards', p[1].hand.length === 0);
}

// ─── Test 9b: Steal/Burning Bridges — player CHOOSES which card (multi-zone) ───
console.log('\n[9b] Steal — choose card zone (hand vs equipment)');
{
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Steal', 'stratagem')] }),
    makePlayer(1, 'zhangfei', {
      hand: [card('Dodge', 'basic')],
      equipment: { weapon: card('Green Dragon Blade','weapon','♠',5,{range:3}), armor: null, atkMount: null, defMount: null },
    }),
  ];
  const g = makeGame(p);
  g.playCard('P0', p[0].hand[0].id, 'P1');
  check('pick window opened (2 zones)', !!g.cardPick && g.cardPick.fromId === 'P0');
  check('options include hand + weapon', g.cardPick.options.length === 2);
  g.resolveTakeCard('P0', 'equip:weapon');     // choose the weapon, not the hand card
  check('window cleared', !g.cardPick);
  check('p0 stole the weapon', p[0].hand.some(c => c.name === 'Green Dragon Blade'));
  check('p1 keeps the Dodge in hand', p[1].hand.some(c => c.name === 'Dodge'));
  check('p1 weapon gone', !p[1].equipment.weapon);
}

console.log('\n[9c] Burning Bridges — choose to destroy equipment');
{
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Burning Bridges', 'stratagem')] }),
    makePlayer(1, 'zhangfei', {
      hand: [card('Peach', 'basic', '♥', 3)],
      equipment: { weapon: null, armor: card('Nio Shield','armor','♣',2), atkMount: null, defMount: null },
    }),
  ];
  const g = makeGame(p);
  g.playCard('P0', p[0].hand[0].id, 'P1');
  check('pick window opened', !!g.cardPick && g.cardPick.mode === 'burn');
  g.resolveTakeCard('P0', 'equip:armor');
  check('armor destroyed (to discard)', g.discardPile.some(c => c.name === 'Nio Shield'));
  check('p1 keeps Peach', p[1].hand.some(c => c.name === 'Peach'));
  check('p0 did not gain it (burned)', !p[0].hand.some(c => c.name === 'Nio Shield'));
}

// ─── Test 10: Blue Steel Sword ignores Eight Trigrams armor ───
console.log('\n[10] Blue Steel Sword — ignores armor auto-dodge');
{
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Attack', 'basic', '♠', 5)], equipment: { weapon: card('Blue Steel Sword', 'weapon', '♠', 5, { range: 2 }), armor: null, atkMount: null, defMount: null } }),
    makePlayer(1, 'zhangfei', { equipment: { weapon: null, armor: card('Eight Trigrams Formation', 'armor'), atkMount: null, defMount: null } }),
  ];
  const g = makeGame(p, [card('Peach', 'basic', '♥', 5)]); // would be red → auto-dodge if not ignored
  g.playCard('P0', p[0].hand[0].id, 'P1');
  check('armor bypassed → p1 must respond (pending dodge)', g.pending && g.pending.type === 'dodge' && g.pending.responderId === 'P1');
}

// ─── Test 11: Sky Piercing Halberd multi-target on last card ───
console.log('\n[11] Sky Piercing Halberd — last card hits multiple');
{
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Attack', 'basic')], equipment: { weapon: card('Sky Piercing Halberd', 'weapon', '♠', 5, { range: 4 }), armor: null, atkMount: null, defMount: null } }),
    makePlayer(1, 'zhangfei'), makePlayer(2, 'guanyu'),
  ];
  const g = makeGame(p);
  g.playCard('P0', p[0].hand[0].id, 'P1');
  check('group response started (groupQueue exists)', Array.isArray(g.groupQueue));
  check('first victim pending', g.pending && g.pending.type === 'dodge');
}

// ─── Test 12: Green Dragon Blade re-attacks after a dodge ───
console.log('\n[12] Green Dragon Blade — re-attack after dodge');
{
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Attack', 'basic', '♠', 5), card('Attack', 'basic', '♠', 6)], equipment: { weapon: card('Green Dragon Blade', 'weapon', '♠', 5, { range: 3 }), armor: null, atkMount: null, defMount: null } }),
    makePlayer(1, 'zhangfei', { hand: [card('Dodge', 'basic'), card('Dodge', 'basic')] }),
  ];
  const g = makeGame(p);
  // play first attack
  g.playCard('P0', p[0].hand.find(c => c.name === 'Attack').id, 'P1');
  g.resolveResponse('P1', p[1].hand[0].id); // p1 dodges
  check('GDB auto re-attack → new dodge pending', g.pending && g.pending.type === 'dodge' && g.pending.responderId === 'P1');
  check('p0 consumed the extra Attack card', p[0].hand.filter(c => c.name === 'Attack').length === 0);
}

// ─── Test 13: Peach saves ANOTHER dying player ───
console.log('\n[13] Peach — ally saves a dying player');
{
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Peach', 'basic', '♥', 5)] }),
    makePlayer(1, 'zhangfei', { hp: 1 }),
  ];
  const g = makeGame(p);
  g.dealDamage(p[1], 1, p[0]); // p1 → dying
  check('p1 is dying', g.dyingPlayerId === 'P1');
  // order: dying first (P1, no peach) then P0 (has peach)
  check('save queue reached P0', g.dying && g.dying.order[g.dying.idx] === 'P0');
  g.usePeachToSave('P0', p[0].hand[0].id);
  check('p1 survived (hp 1)', p[1].hp === 1 && p[1].hp > 0);
  check('dying cleared', g.dyingPlayerId === null);
}

// ─── Test 14: Yin-Yang Swords draws a card on opposite-gender attack ───
console.log('\n[14] Yin-Yang Swords — draw on opposite-gender attack');
{
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Attack', 'basic')], equipment: { weapon: card('Yin-Yang Swords', 'weapon', '♠', 5, { range: 2 }), armor: null, atkMount: null, defMount: null } }),
    makePlayer(1, 'zhenji'), // female
  ];
  const g = makeGame(p, [card('Dodge', 'basic')]);
  g.playCard('P0', p[0].hand[0].id, 'P1');
  check('p0 drew 1 card from Yin-Yang', p[0].hand.length === 1); // played 1, drew 1
}

// ─── Test 15: Barbarian Invasion — victim plays Attack, NO counter on caster ───
console.log('\n[15] Barbarian Invasion — play Attack avoids damage, no duel chain');
{
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Barbarian Invasion', 'stratagem')] }),
    makePlayer(1, 'zhangfei', { hand: [card('Attack', 'basic')] }),
    makePlayer(2, 'guanyu', { hand: [] }),
  ];
  const g = makeGame(p);
  g.playCard('P0', p[0].hand.find(c => c.name === 'Barbarian Invasion').id, null);
  // p1 is first victim
  check('p1 prompted with avoidatk', g.pending && g.pending.type === 'avoidatk' && g.pending.responderId === 'P1');
  g.resolveResponse('P1', p[1].hand[0].id); // play Attack
  check('p1 unharmed (hp 4)', p[1].hp === 4);
  check('caster p0 NOT asked to counter (next victim p2 pending)', g.pending && g.pending.responderId === 'P2');
  g.resolveResponse('P2', null); // p2 has no attack → takes damage
  check('p2 took 1 damage (hp 3)', p[2].hp === 3);
  check('p0 (caster) unharmed (hp 4)', p[0].hp === 4);
}

// ─── Test 16: Lightning kills (no peach) → turn advances (non-lethal-to-game) ───
console.log('\n[16] Lightning lethal with no Peach → turn advances');
{
  const lightning = card('Lightning', 'stratagem', '♠', 5);
  // 3 players: P0 current Rebel dies, P2 still Rebel alive → game continues
  const p = [makePlayer(0, 'zhaoyun', { hp: 2, judgments: [lightning] }), makePlayer(1, 'caocao'), makePlayer(2, 'zhangfei')];
  p[0].role = 'Rebel'; p[1].role = 'Lord'; p[2].role = 'Rebel';
  const g = makeGame(p, [card('Attack', 'basic', '♠', 5)]); // ♠5 → strike 3 → p0 dies
  g.runJudgments(p[0]);
  check('p0 dead (hp <= 0)', p[0].hp <= 0);
  check('game not ended', g.room.state !== 'ended');
  check('turn advanced to p1 (Lord)', g.currentPlayer === 1);
}

// ─── Test 17: Negation cancels a Barbarian hit on one victim ───
console.log('\n[17] Negation — one victim negates Barbarian');
{
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Barbarian Invasion', 'stratagem')] }),
    makePlayer(1, 'zhangfei', { hand: [card('Negation', 'stratagem')] }),
  ];
  const g = makeGame(p);
  g.playCard('P0', p[0].hand.find(c => c.name === 'Barbarian Invasion').id, null);
  g.resolveResponse('P1', p[1].hand[0].id); // Negation
  check('p1 unharmed via Negation (hp 4)', p[1].hp === 4);
  check('p1 used the Negation', !p[1].hand.some(c => c.name === 'Negation'));
}

// ─── Test 18: Full turn — play Overindulgence on opponent, processed next turn ───
console.log('\n[18] Overindulgence cast onto opponent, judged on their turn');
{
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Overindulgence', 'stratagem')] }),
    makePlayer(1, 'zhangfei'),
  ];
  const g = makeGame(p);
  g.playCard('P0', p[0].hand[0].id, 'P1');
  check('overindulgence placed on p1 judgment zone', p[1].judgments.some(c => c.name === 'Overindulgence'));
  check('not discarded (noDiscard)', !g.discardPile.some(c => c.name === 'Overindulgence'));
}

// ─── Test 19: Lu Xun immune to Overindulgence ───
console.log('\n[19] Lu Xun — immune to Overindulgence');
{
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Overindulgence', 'stratagem')] }),
    makePlayer(1, 'luxun'),
  ];
  const g = makeGame(p);
  const res = g.playCard('P0', p[0].hand[0].id, 'P1');
  check('rejected (immune)', res.ok === false);
  check('overindulgence still in p0 hand', p[0].hand.some(c => c.name === 'Overindulgence'));
}

// ─── Test 20: Nio Shield blocks black attack automatically ───
console.log('\n[20] Nio Shield — auto-block black Attack');
{
  const p = [
    makePlayer(0, 'caocao', { hand: [card('Attack', 'basic', '♠', 5)] }),
    makePlayer(1, 'zhangfei', { equipment: { weapon: null, armor: card('Nio Shield', 'armor'), atkMount: null, defMount: null } }),
  ];
  const g = makeGame(p);
  g.playCard('P0', p[0].hand[0].id, 'P1');
  check('no damage (auto-blocked), no pending', g.pending === null && p[1].hp === 4);
}

console.log(`\n──────── ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);

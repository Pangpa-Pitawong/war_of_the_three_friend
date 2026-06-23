# Graph Report - .  (2026-06-23)

## Corpus Check
- Large corpus: 79 files · ~1,549,153 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 255 nodes · 327 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.82)
- Token cost: 123,041 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Basic, Stratagem & Mount Cards|Basic, Stratagem & Mount Cards]]
- [[_COMMUNITY_Roles, Turn Phases & Core Mechanics|Roles, Turn Phases & Core Mechanics]]
- [[_COMMUNITY_Client UI Engine (game.js)|Client UI Engine (game.js)]]
- [[_COMMUNITY_Server Core & Room Setup|Server Core & Room Setup]]
- [[_COMMUNITY_Server Game Engine|Server Game Engine]]
- [[_COMMUNITY_Weapon Cards|Weapon Cards]]
- [[_COMMUNITY_Wei Kingdom Generals|Wei Kingdom Generals]]
- [[_COMMUNITY_Wu Kingdom Generals|Wu Kingdom Generals]]
- [[_COMMUNITY_Shu Kingdom Generals|Shu Kingdom Generals]]
- [[_COMMUNITY_Project Dependencies|Project Dependencies]]
- [[_COMMUNITY_Qun Warlord Generals|Qun Warlord Generals]]

## God Nodes (most connected - your core abstractions)
1. `Game` - 28 edges
2. `Stratagem Card` - 12 edges
3. `Weapon` - 9 edges
4. `WEI (Kingdom of Wei)` - 8 edges
5. `SHU (Kingdom of Shu)` - 8 edges
6. `WU (Kingdom of Wu)` - 8 edges
7. `Response System (dodge/duel reaction)` - 8 edges
8. `Turn Flow (6-phase turn)` - 7 edges
9. `Server (server.js)` - 7 edges
10. `Room` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Peach` --conceptually_related_to--> `Dying State & Peach Rescue`  [INFERRED]
  public/js/data.js → server.js
- `Overindulgence` --conceptually_related_to--> `Judgement Phase`  [INFERRED]
  public/js/data.js → server.js
- `Lightning` --conceptually_related_to--> `Judgement Phase`  [INFERRED]
  public/js/data.js → server.js
- `Loyalist` --conceptually_related_to--> `Win Conditions (by role)`  [INFERRED]
  public/js/data.js → server.js
- `Rebel` --conceptually_related_to--> `Win Conditions (by role)`  [INFERRED]
  public/js/data.js → server.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **WEI Kingdom Generals** — gen_caocao, gen_simayi, gen_zhangliao, gen_xiahou, gen_xuzhu, gen_zhenji, gen_guojia, gen_yuejin, kingdom_wei [INFERRED 0.85]
- **Turn Flow Phases** — phase_start, phase_judge, phase_draw, phase_play, phase_discard, phase_end, mech_turn_flow [INFERRED 0.85]
- **Basic Card Set** — card_attack, card_dodge, card_peach, type_basic [INFERRED 0.85]

## Communities (12 total, 1 thin omitted)

### Community 0 - "Basic, Stratagem & Mount Cards"
Cohesion: 0.06
Nodes (23): Attack, Barbarian Invasion, Borrowed Sword, Bumper Harvest, Burning Bridges, Dodge, Duel, Fergana Steed (+15 more)

### Community 1 - "Roles, Turn Phases & Core Mechanics"
Cohesion: 0.07
Nodes (24): Eight Trigrams Formation, Nio Shield, Zhuge Crossbow, 108-Card Deck (suit/rank), Dying State & Peach Rescue, HP & Damage, Multiplayer Server (Socket.IO rooms), Socket Event Communication (+16 more)

### Community 2 - "Client UI Engine (game.js)"
Cohesion: 0.09
Nodes (16): addChatMessage(), addTooltipHover(), confirmPlayCard(), notify(), onCardClick(), positionTooltip(), renderCharSelect(), renderGame() (+8 more)

### Community 3 - "Server Core & Room Setup"
Cohesion: 0.09
Nodes (21): app, broadcastRoom(), buildFullDeck(), CARD_TEMPLATES, CHARACTERS, detachSocket(), express, genRoomCode() (+13 more)

### Community 5 - "Weapon Cards"
Cohesion: 0.12
Nodes (9): Blue Steel Sword, Frost Sword, Green Dragon Blade, Kirin Bow, Rock Cleaving Axe, Serpent Spear, Sky Piercing Halberd, Yin-Yang Swords (+1 more)

### Community 6 - "Wei Kingdom Generals"
Cohesion: 0.12
Nodes (9): Cao Cao (WEI, hp4, diff4; Jian Xiong, Hu Jia), Guo Jia (WEI, hp3, diff4; Tian Du, Yi Ji), Sima Yi (WEI, hp3, diff4; Gui Cai, Fan Kui), Xiahou Dun (WEI, hp4, diff2; Gang Lie), Xu Zhu (WEI, hp4, diff2; Luo Yi), Yue Jin (WEI, hp4, diff2; Yong Wang), Zhang Liao (WEI, hp4, diff2; Tu Xi), Zhen Ji (WEI, hp3, diff3; Luo Shen, Qing Guo) (+1 more)

### Community 7 - "Wu Kingdom Generals"
Cohesion: 0.12
Nodes (9): Da Qiao (WU, hp3, diff3; Guo Se, Liu Li), Gan Ning (WU, hp4, diff2; Qi Xi, Li Chi), Huang Gai (WU, hp4, diff2; Ku Rou), Lu Xun (WU, hp3, diff4; Qian Xun, Lian Ying), Lv Meng (WU, hp4, diff3; Ke Ji, Gong Xin), Sun Quan (WU, hp4, diff3; Zhi Heng, Jiu Yuan), Sun Shangxiang (WU, hp3, diff3; Jie Yin, Xiao Ji), Zhou Yu (WU, hp3, diff4; Ying Zi, Fan Jian) (+1 more)

### Community 8 - "Shu Kingdom Generals"
Cohesion: 0.12
Nodes (9): Guan Yu (SHU, hp4, diff2; Wu Sheng, Yi Jue), Huang Yueying (SHU, hp3, diff3; Ji Zhi, Qi Cai), Lady Gan (SHU, hp3, diff3; Shu Shen, Meng Yan), Liu Bei (SHU, hp4, diff3; Ren De, Ji Jiang), Ma Chao (SHU, hp4, diff2; Ma Shu, Tie Ji), Zhang Fei (SHU, hp4, diff2; Pao Xiao, Yi Shi), Zhao Yun (SHU, hp4, diff1; Long Dan), Zhuge Liang (SHU, hp3, diff5; Guan Xing, Kong Cheng) (+1 more)

### Community 9 - "Project Dependencies"
Cohesion: 0.14
Nodes (13): dependencies, express, socket.io, uuid, description, devDependencies, nodemon, main (+5 more)

### Community 10 - "Qun Warlord Generals"
Cohesion: 0.15
Nodes (7): Diao Chan (QUN, hp3, diff4; Li Jian, Bi Yue), Gongsun Zan (QUN, hp4, diff2; Yi Cong), Hua Tuo (QUN, hp3, diff2; Jiu Ji, Qing Nang), Hua Xiong (QUN, hp4, diff2; Hu Wei), Lv Bu (QUN, hp4, diff3; Wu Shuang, Xian Zhen), Pan Feng (QUN, hp4, diff1; Normal/no skill), QUN (Unaligned / Warlords)

## Knowledge Gaps
- **34 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+29 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Server (server.js)` connect `Roles, Turn Phases & Core Mechanics` to `Basic, Stratagem & Mount Cards`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _34 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Basic, Stratagem & Mount Cards` be split into smaller, more focused modules?**
  _Cohesion score 0.05897435897435897 - nodes in this community are weakly interconnected._
- **Should `Roles, Turn Phases & Core Mechanics` be split into smaller, more focused modules?**
  _Cohesion score 0.07311827956989247 - nodes in this community are weakly interconnected._
- **Should `Client UI Engine (game.js)` be split into smaller, more focused modules?**
  _Cohesion score 0.08505747126436781 - nodes in this community are weakly interconnected._
- **Should `Server Core & Room Setup` be split into smaller, more focused modules?**
  _Cohesion score 0.08620689655172414 - nodes in this community are weakly interconnected._
- **Should `Weapon Cards` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
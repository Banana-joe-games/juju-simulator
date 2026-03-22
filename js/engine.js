// ========== GAME STATE ==========
let G = null;
let autoRunning = false;
let autoTimer = null;
let batchResults = [];   // accumulated results across batch runs
let lastReport = null;   // last generated report HTML
let currentTweaks = null; // active tweaks for batch run

const TWEAK_DEFAULTS = {
  heroStr: { juju:3, gigi:2, lulu:1, eggo:2 },
  equipment: (function() {
    var m = {};
    LEGENDARY_EQUIPMENT.forEach(function(e) { m[e.name] = { enabled: true, strMod: 0 }; });
    return m;
  })(),
  hydraHeads: (function() {
    var m = {};
    HYDRA_HEADS.forEach(function(h) { m[h.name] = h.str; });
    return m;
  })(),
  mishapEnemyStrMod: 0, misfortuneEnemyStrMod: 0,
  skillsEnabled: true, followersEnabled: true, overflowGameOver: true, prepareFirst: false
};

function twVal(el) {
  document.getElementById(el.id + '_v').textContent = el.value;
}

function buildTweaksLists() {
  // Equipment list
  var eqHtml = '';
  LEGENDARY_EQUIPMENT.forEach(function(e, i) {
    var safeId = 'tw_eq_' + i;
    eqHtml += '<div class="tweak-equip-row">'
      + '<input type="checkbox" id="' + safeId + '_on" checked>'
      + '<span class="eq-name" id="' + safeId + '_label">' + e.name + '</span>'
      + '<span class="eq-str">STR ' + (e.str >= 0 ? '+' : '') + e.str + '</span>'
      + '<input type="number" id="' + safeId + '_mod" value="0" min="-3" max="3" title="STR modifier">'
      + '</div>';
  });
  document.getElementById('tw_equipList').innerHTML = eqHtml;
  // Wire up checkbox to grey out label
  LEGENDARY_EQUIPMENT.forEach(function(e, i) {
    var cb = document.getElementById('tw_eq_' + i + '_on');
    var label = document.getElementById('tw_eq_' + i + '_label');
    cb.addEventListener('change', function() {
      label.className = cb.checked ? 'eq-name' : 'eq-name disabled';
    });
  });
  // Hydra list
  var hdHtml = '';
  HYDRA_HEADS.forEach(function(h, i) {
    var safeId = 'tw_hd_' + i;
    hdHtml += '<div class="tweak-hydra-row">'
      + '<span class="hd-name">' + h.name + '</span>'
      + '<span style="color:var(--dim);font-size:10px">STR:</span>'
      + '<input type="number" id="' + safeId + '_str" value="' + h.str + '" min="1" max="20">'
      + '</div>';
  });
  document.getElementById('tw_hydraList').innerHTML = hdHtml;
}

// View switching
function showGameView() {
  document.getElementById('homeScreen').classList.add('hidden');
  document.getElementById('gameView').classList.remove('hidden');
}
function goHome() {
  stopAuto();
  document.getElementById('gameView').classList.add('hidden');
  document.getElementById('homeScreen').classList.remove('hidden');
}

function closeTweaks() {
  // legacy — no-op now
}

function resetTweaks() {
  document.getElementById('tw_juju').value = 3; document.getElementById('tw_juju_v').textContent = '3';
  document.getElementById('tw_gigi').value = 2; document.getElementById('tw_gigi_v').textContent = '2';
  document.getElementById('tw_lulu').value = 1; document.getElementById('tw_lulu_v').textContent = '1';
  document.getElementById('tw_eggo').value = 2; document.getElementById('tw_eggo_v').textContent = '2';
  document.getElementById('tw_mishapEnemy').value = 0; document.getElementById('tw_mishapEnemy_v').textContent = '0';
  document.getElementById('tw_misfortuneEnemy').value = 0; document.getElementById('tw_misfortuneEnemy_v').textContent = '0';
  document.getElementById('tw_wonderPct').value = 30; document.getElementById('tw_wonderPct_v').textContent = '30';
  document.getElementById('tw_dreadPct').value = 25; document.getElementById('tw_dreadPct_v').textContent = '25';
  document.getElementById('tw_skills').checked = true;
  document.getElementById('tw_followers').checked = true;
  document.getElementById('tw_overflow').checked = true;
  document.getElementById('tw_prepareFirst').checked = false;
  document.getElementById('tw_gilEnabled').checked = false;
  document.getElementById('tw_gilPerStr').value = 1; document.getElementById('tw_gilPerStr_v').textContent = '1';
  document.getElementById('tw_gilRechargeSkill').value = 3; document.getElementById('tw_gilRechargeSkill_v').textContent = '3';
  document.getElementById('tw_gilBuyEquip').value = 6; document.getElementById('tw_gilBuyEquip_v').textContent = '6';
  document.getElementById('tw_gilSettings').style.display = 'none';
  // Reset per-equipment
  LEGENDARY_EQUIPMENT.forEach(function(e, i) {
    var cb = document.getElementById('tw_eq_' + i + '_on');
    var mod = document.getElementById('tw_eq_' + i + '_mod');
    var label = document.getElementById('tw_eq_' + i + '_label');
    if (cb) { cb.checked = true; }
    if (mod) { mod.value = 0; }
    if (label) { label.className = 'eq-name'; }
  });
  // Reset per-hydra
  document.getElementById('tw_hydraGlobal').value = 0;
  document.getElementById('tw_hydraGlobal_v').textContent = '0';
  HYDRA_HEADS.forEach(function(h, i) {
    var inp = document.getElementById('tw_hd_' + i + '_str');
    if (inp) { inp.value = h.str; }
  });
}

function applyHydraGlobal(offset) {
  // Apply global offset to all hydra head inputs relative to their defaults
  var off = parseInt(offset) || 0;
  HYDRA_HEADS.forEach(function(h, i) {
    var inp = document.getElementById('tw_hd_' + i + '_str');
    if (inp) { inp.value = Math.max(1, h.str + off); }
  });
}

function readTweaks() {
  var equipment = {};
  LEGENDARY_EQUIPMENT.forEach(function(e, i) {
    var cb = document.getElementById('tw_eq_' + i + '_on');
    var mod = document.getElementById('tw_eq_' + i + '_mod');
    equipment[e.name] = {
      enabled: cb ? cb.checked : true,
      strMod: mod ? parseInt(mod.value) || 0 : 0
    };
  });
  var hydraHeads = {};
  HYDRA_HEADS.forEach(function(h, i) {
    var inp = document.getElementById('tw_hd_' + i + '_str');
    hydraHeads[h.name] = inp ? parseInt(inp.value) || h.str : h.str;
  });
  return {
    heroStr: {
      juju: parseInt(document.getElementById('tw_juju').value),
      gigi: parseInt(document.getElementById('tw_gigi').value),
      lulu: parseInt(document.getElementById('tw_lulu').value),
      eggo: parseInt(document.getElementById('tw_eggo').value)
    },
    equipment: equipment,
    hydraHeads: hydraHeads,
    wonderPct: parseInt(document.getElementById('tw_wonderPct').value) || 30,
    dreadPct: parseInt(document.getElementById('tw_dreadPct').value) || 25,
    mishapEnemyStrMod: parseInt(document.getElementById('tw_mishapEnemy').value),
    misfortuneEnemyStrMod: parseInt(document.getElementById('tw_misfortuneEnemy').value),
    skillsEnabled: document.getElementById('tw_skills').checked,
    followersEnabled: document.getElementById('tw_followers').checked,
    overflowGameOver: document.getElementById('tw_overflow').checked,
    prepareFirst: document.getElementById('tw_prepareFirst').checked,
    gilEnabled: document.getElementById('tw_gilEnabled').checked,
    gilPerStr: parseInt(document.getElementById('tw_gilPerStr').value) || 1,
    gilRechargeSkillCost: parseInt(document.getElementById('tw_gilRechargeSkill').value) || 3,
    gilBuyEquipCost: parseInt(document.getElementById('tw_gilBuyEquip').value) || 6
  };
}

function getTweaksDiff(tweaks) {
  const diffs = [];
  const defaults = { juju:3, gigi:2, lulu:1, eggo:2 };
  Object.entries(tweaks.heroStr).forEach(function(entry) {
    var id = entry[0], val = entry[1];
    if (val !== defaults[id]) diffs.push(id.charAt(0).toUpperCase() + id.slice(1) + ' base STR: ' + defaults[id] + ' \u2192 ' + val);
  });
  // Per-equipment diffs
  LEGENDARY_EQUIPMENT.forEach(function(e) {
    var tw = tweaks.equipment[e.name];
    if (!tw) return;
    if (!tw.enabled) diffs.push(e.name + ': DISABLED');
    if (tw.strMod !== 0) diffs.push(e.name + ' STR: ' + e.str + ' \u2192 ' + (e.str + tw.strMod) + ' (' + (tw.strMod > 0 ? '+' : '') + tw.strMod + ')');
  });
  // Per-hydra diffs
  HYDRA_HEADS.forEach(function(h) {
    var tweakedStr = tweaks.hydraHeads[h.name];
    if (tweakedStr !== undefined && tweakedStr !== h.str) {
      diffs.push(h.name + ' STR: ' + h.str + ' \u2192 ' + tweakedStr);
    }
  });
  if (tweaks.wonderPct !== 30) diffs.push('Wonder room %: 30 → ' + tweaks.wonderPct);
  if (tweaks.dreadPct !== 25) diffs.push('Dread room %: 25 → ' + tweaks.dreadPct);
  if (tweaks.mishapEnemyStrMod !== 0) diffs.push('Mishap enemy STR: ' + (tweaks.mishapEnemyStrMod > 0 ? '+' : '') + tweaks.mishapEnemyStrMod);
  if (tweaks.misfortuneEnemyStrMod !== 0) diffs.push('Misfortune enemy STR: ' + (tweaks.misfortuneEnemyStrMod > 0 ? '+' : '') + tweaks.misfortuneEnemyStrMod);
  if (!tweaks.skillsEnabled) diffs.push('Skills: DISABLED (Skill Burn only)');
  if (!tweaks.followersEnabled) diffs.push('Followers: DISABLED');
  if (!tweaks.overflowGameOver) diffs.push('Hydra Overflow: NOT game over (heads just stop growing)');
  if (tweaks.prepareFirst) diffs.push('Prepare First: Heroes wait until fully equipped (2 equip + followers) before entering Hydra');
  if (tweaks.gilEnabled) diffs.push('Gil System: ENABLED (earn ' + (tweaks.gilPerStr||1) + ' Gil per enemy STR, recharge skill = ' + (tweaks.gilRechargeSkillCost||3) + ' Gil, buy equip = ' + (tweaks.gilBuyEquipCost||6) + ' Gil)');
  return diffs;
}

function homeRunBatch() {
  currentTweaks = readTweaks();
  showGameView();
  runBatchInternal(1000);
}

function homeStartSingle() {
  currentTweaks = readTweaks();
  showGameView();
  startGameInternal();
}

function runBatchWithTweaks() {
  homeRunBatch();
}

function startGameWithTweaks() {
  homeStartSingle();
}

function freshTracker() {
  return {
    // Per-hero tracking
    heroes: {},
    // Equipment tracking: { name: { drawn, equipped, usedEffect, wonWith, lostWith, discarded, survivedKO } }
    equipment: {},
    // Encounter tracking: { name: { drawn, won, lost, fled, avoided } }
    encounters: {},
    // Follower tracking: { name: { drawn, helpedWin, lost } }
    followers: {},
    // Stalker tracking: { name: { attached, turnsActive, causedKO } }
    stalkers: {},
    // Skill tracking: { heroId_skillName: { activated, burned, savedFromKO, turnedFight } }
    skills: {},
    // Hydra head tracking
    hydraHeads: {},
    // Combat log: every fight { hero, enemy, enemyStr, heroTotal, enemyTotal, won, margin, tier, turn }
    combatLog: [],
    // Hydra combat log: each attack attempt
    hydraCombatLog: [],
    // Moments where a hero died and nothing could save them
    deathMoments: [],
    // Close calls: won with margin <= 1
    closeCalls: [],
    // Overkills: won with margin >= 5
    overkills: [],
    // Trap outcomes
    traps: {},
    // Talent triggers
    talents: {},
    // Pacing milestones (turn numbers)
    pacing: { firstEquip: 0, firstKO: 0, firstRelic: 0, hydraSpawn: 0, hydraArrival: 0 },
    // NEW fields for 13-section report
    heroEndState: {},
    battlecryDetails: [],
    secondNatureDetails: [],
    copycatDetails: [],
    equipmentTimeline: {},
    enemyEffectImpact: {},
    decisionEnemies: {},
    enemiesAtGameEnd: [],
    gilVisits: { voluntary:0, koRespawn:0 },
    skillRechargeSources: {},
    hydraStartingHeads: [],
    hydraHeadKillOrder: [],
    hydraGrowthLog: [],
    trapResourcesLost: {},
    followerTimeline: {},
    emptyTurns: 0,
    hydraArrivals: [],
  };
}

function initHeroTracker(t, heroId) {
  if (!t.heroes[heroId]) {
    t.heroes[heroId] = {
      combats: 0, wins: 0, losses: 0, ko: 0,
      damageDealt: 0, // total margin on wins
      damageTaken: 0,  // total margin on losses
      skillsUsed: 0, skillsBurned: 0,
      flameRolls: 0, talentTriggers: 0,
      relicsSpent: 0,
      turnsStalked: 0,
      equipmentHeld: [], // snapshot at end
      maxStr: 0,
      neededButDidntHave: [], // skill gap analysis entries
      hydraHeadsDestroyed: 0,
      enemiesKilled: 0,
    };
  }
  return t.heroes[heroId];
}

function trackEquip(name, field) {
  if (!G.tracker.equipment[name]) G.tracker.equipment[name] = { drawn:0, equipped:0, usedEffect:0, wonWith:0, lostWith:0, discarded:0, survivedKO:0, strTotal:0 };
  G.tracker.equipment[name][field]++;
  if (field === 'equipped') {
    if (!G.tracker.equipmentTimeline[name]) G.tracker.equipmentTimeline[name] = { turnEquipped:[], turnLost:[], heldAtHydra:0 };
    G.tracker.equipmentTimeline[name].turnEquipped.push(G.turn);
  }
  if (field === 'discarded' || field === 'lostWith') {
    if (!G.tracker.equipmentTimeline[name]) G.tracker.equipmentTimeline[name] = { turnEquipped:[], turnLost:[], heldAtHydra:0 };
    G.tracker.equipmentTimeline[name].turnLost.push(G.turn);
  }
}

function trackEncounter(name, field) {
  if (!G.tracker.encounters[name]) G.tracker.encounters[name] = { drawn:0, won:0, lost:0, fled:0, avoided:0 };
  G.tracker.encounters[name][field]++;
}

function trackFollower(name, field) {
  if (!G.tracker.followers) G.tracker.followers = {};
  if (!G.tracker.followers[name]) G.tracker.followers[name] = { drawn:0, helpedWin:0, lost:0 };
  if (G.tracker.followers[name][field] !== undefined) G.tracker.followers[name][field]++;
  // Timeline tracking
  if (!G.tracker.followerTimeline[name]) G.tracker.followerTimeline[name] = { turnDrawn:[], turnLost:[], heldAtEnd:0 };
  if (field === 'drawn') G.tracker.followerTimeline[name].turnDrawn.push(G.turn);
  if (field === 'lost') G.tracker.followerTimeline[name].turnLost.push(G.turn);
}

function trackSkill(heroId, skillName, field) {
  const key = `${heroId}_${skillName}`;
  if (!G.tracker.skills[key]) G.tracker.skills[key] = {
    activated:0, burned:0, savedFromKO:0, turnedFight:0,
    activatedDungeon:0, activatedHydra:0, burnedDungeon:0, burnedHydra:0
  };
  G.tracker.skills[key][field]++;
  // Auto-track context for activated/burned
  const atHydra = G.heroesInHydraArea && G.heroesInHydraArea.has(heroId);
  if (field === 'activated') {
    if (atHydra) G.tracker.skills[key].activatedHydra++;
    else G.tracker.skills[key].activatedDungeon++;
  }
}

function trackTrap(name, field) {
  if (!G.tracker.traps[name]) G.tracker.traps[name] = { triggered:0, survived:0, ko:0 };
  G.tracker.traps[name][field]++;
}
function trackTrapResource(name, resource) {
  if (!G.tracker.trapResourcesLost[name]) G.tracker.trapResourcesLost[name] = { equipLost:0, followersLost:0, skillsExhausted:0 };
  G.tracker.trapResourcesLost[name][resource]++;
}

function trackStalker(name, field) {
  if (!G.tracker.stalkers[name]) G.tracker.stalkers[name] = { attached:0, turnsActive:0, causedKO:0, removed:0 };
  G.tracker.stalkers[name][field]++;
}

function trackTalent(heroId, field) {
  if (!G.tracker.talents[heroId]) G.tracker.talents[heroId] = { triggered:0, blocked:0, combatImpact:0, movementImpact:0 };
  G.tracker.talents[heroId][field]++;
}

function trackHydraHead(name, field) {
  if (!G.tracker.hydraHeads[name]) G.tracker.hydraHeads[name] = { spawned:0, destroyed:0, attacksReceived:0, causedKO:0, regenerated:0 };
  G.tracker.hydraHeads[name][field]++;
}

function initState() {
  const tw = (typeof currentTweaks !== 'undefined' && currentTweaks) || {};
  const wonderPct = (tw.wonderPct || 30) / 100;
  const dreadPct = (tw.dreadPct || 25) / 100;
  const tileDeck = [];
  for (let i = 0; i < 36; i++) {
    const r = Math.random();
    tileDeck.push(r < wonderPct ? 'wonder' : r < wonderPct + (1 - wonderPct - dreadPct) ? 'common' : 'dread');
  }
  shuffle(tileDeck);
  const state = {
    phase: 'idle',
    turn: 0,
    round: 1,
    currentHero: 0,
    tilesPlaced: 0,
    tileDeck,
    relicRoomsPlaced: 0,
    relicsCollected: 0,
    exitPlaced: false,
    exitRevealed: false,
    hydraActive: false,
    hydraHeads: [],
    hydraMaxHeads: 6,
    hydraDestroyedCount: 0,
    hydraFloorEquipment: [],
    dungeonFloorEquipment: [],
    heroesInHydraArea: new Set(),
    wonderDeck: shuffle([...Array(WONDER_CARDS.length).keys()]),
    mishapDeck: shuffle([...Array(MISHAP_CARDS.length).keys()]),
    misfortuneDeck: shuffle([...Array(MISFORTUNE_CARDS.length).keys()]),
    legendaryDeck: shuffle([...Array(LEGENDARY_EQUIPMENT.length).keys()]),
    heroes: HEROES.map(h => ({
      ...h,
      hp: 1,
      pos: {q:0, r:0},
      equipment: [],
      followers: [],
      stalkers: [],
      heldRelics: [],
      skillStates: h.skills.map(() => 'ready'),
      ko: false,
      talentUsedThisTurn: false,
      dodgeActive: false,
      giftedFlame: false,
      runningToHydra: false,
      houndFollowing: null,
      gil: 0,
      gilEarned: 0,
      gilSpentSkill: 0,
      gilSpentEquip: 0
    })),
    relicPool: shuffle([...RELICS]),
    board: [{id:'entrance',type:'entrance',enemies:[],equipment:[]}],
    enemiesOnBoard: [],
    gameOver: false,
    victory: false,
    log: [],
    waitingForChoice: null,
    stats: { turns:0, combats:0, ko:0, monstersKilled:0, skillBurns:0, relicsSpent:0 },
    tracker: freshTracker(),
    roomsVisited: { wonder: 0, common: 0, dread: 0 }
  };
  G = state;
  G.hexMap = createHexMap(3); // confined map: 37 tiles (1+6+12+18), max 3 hexes from center
  G.hexMap.set(0, 0, { q:0, r:0, type:'entrance', roomId:'entrance', tileIndex:0, enemies:[], equipment:[] });
  G.exitHex = null;
  return state;
}

// ========== UTILITIES ==========
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function rollDie(hero) {
  const val = Math.floor(Math.random() * 6) + 1;
  const isFlame = hero ? hero.flameFaces.includes(val) : false;
  return { val, isFlame };
}

// Roll with Leprechaun transformation (swap 1<->6)
function heroRollDie(hero) {
  let roll = rollDie(hero);
  const hasLeprechaun = hero.followers.find(f => f.effect === 'swap_1_6');
  if (hasLeprechaun) {
    if (roll.val === 1) {
      roll.val = 6;
      roll.isFlame = hero.flameFaces.includes(6);
    } else if (roll.val === 6) {
      roll.val = 1;
      roll.isFlame = hero.flameFaces.includes(1);
    }
  }
  return roll;
}

// Check Assassin stalker: roll 1 = instant KO
function checkAssassin(hero, roll) {
  if (roll.val === 1 && hasStalker(hero, 'roll_1_ko')) {
    log(`    💀 Assassin strikes! Rolled 1 — instant KO!`, 'ko');
    applyKO(hero);
    return true;
  }
  return false;
}

function log(msg, cls = '') {
  G.log.push({ msg, cls });
}

function readySkillCount(hero) {
  return hero.skillStates.filter(s => s === 'ready').length;
}

function isSkillReady(hero, skillName) {
  if (G && G._tweaks && !G._tweaks.skillsEnabled) return false;
  const idx = hero.skills.findIndex(s => s.name === skillName);
  return idx >= 0 && hero.skillStates[idx] === 'ready';
}

function useSkill(hero, skillName) {
  const idx = hero.skills.findIndex(s => s.name === skillName);
  if (idx >= 0 && hero.skillStates[idx] === 'ready') {
    hero.skillStates[idx] = 'exhausted';
    checkCursedArmour(hero);
    return true;
  }
  return false;
}

function totalStr(hero, opts = {}) {
  if (opts.baseOnly) return hero.str;
  let s = hero.str;
  hero.equipment.forEach(e => {
    if (opts.noWeapons && e.type === 'weapon') return;
    if (e.str) s += e.str;
    if (G && G._tweaks && G._tweaks.equipment && G._tweaks.equipment[e.name]) s += (G._tweaks.equipment[e.name].strMod || 0);
  });
  hero.followers.forEach(f => { if (f.str) s += f.str; });
  hero.stalkers.forEach(st => {
    if (st.effect === '-2_combat') s -= 2;
  });
  if (!opts.noWeapons && hero.equipment.find(e => e.effect === '+1_per_ready_skill')) {
    s += Math.min(readySkillCount(hero), 2);
  }
  hero.heldRelics.forEach(r => {
    s += (r.owner === hero.id) ? 2 : 1;
  });
  return s;
}

function hasStalker(hero, effect) {
  return hero.stalkers.some(s => s.effect === effect);
}

function heroColor(hero) {
  return hero.color || 'var(--text)';
}

function maxEquipSlots(hero) {
  return hero.followers.find(f => f.effect === 'inventory_+1') ? 3 : 2;
}

// ========== EQUIP / EXHAUST HELPERS ==========
function equipItem(hero, item) {
  const max = maxEquipSlots(hero);
  while (hero.equipment.length >= max) {
    const removable = hero.equipment.filter(e => e.effect !== 'cannot_remove_blocks_talent');
    if (removable.length === 0) {
      log(`    Cannot equip ${item.name} — all slots locked!`, 'misfortune');
      return;
    }
    // Discard lowest STR removable
    removable.sort((a, b) => (a.str || 0) - (b.str || 0));
    const removed = removable[0];
    hero.equipment = hero.equipment.filter(e => e !== removed);
    log(`    Discarded ${removed.name} to make room`, 'legendary');
  }
  hero.equipment.push(item);
  trackEquip(item.name, 'equipped');
  if (G.tracker.pacing.firstEquip === 0) G.tracker.pacing.firstEquip = G.turn;
  log(`    ${hero.name} equips ${item.name} (${item.type}, STR ${item.str >= 0 ? '+' : ''}${item.str})`, 'legendary');
}

function exhaustOneSkill(hero, reason) {
  const idx = hero.skillStates.findIndex(s => s === 'ready');
  if (idx >= 0) {
    hero.skillStates[idx] = 'exhausted';
    // Track why this skill was exhausted
    if (!hero._skillExhaustLog) hero._skillExhaustLog = [];
    const skillName = hero.skills[idx].name;
    const r = reason || 'unknown';
    hero._skillExhaustLog.push({ skill: skillName, reason: r, turn: G ? G.turn : 0 });
    // Track burns per specific skill in the tracker
    if (r.includes('Skill Burn') || r === 'Firebane weapon' || r === 'Overload sacrifice' || r.includes('Stormcaller') || r.includes('Fangs') || r.includes('Wail') || r.includes('Snakerogue') || r.includes('Mana Leech')) {
      const atHydra = G && G.heroesInHydraArea && G.heroesInHydraArea.has(hero.id);
      const key = `${hero.id}_${skillName}`;
      if (!G.tracker.skills[key]) G.tracker.skills[key] = {
        activated:0, burned:0, savedFromKO:0, turnedFight:0,
        activatedDungeon:0, activatedHydra:0, burnedDungeon:0, burnedHydra:0
      };
      G.tracker.skills[key].burned++;
      if (atHydra) G.tracker.skills[key].burnedHydra++;
      else G.tracker.skills[key].burnedDungeon++;
    }
    checkCursedArmour(hero);
  }
}

function checkCursedArmour(hero) {
  if (readySkillCount(hero) === 0 && hero.equipment.find(e => e.effect === 'exhaust_all_recharge_1')) {
    rechargeOneSkill(hero, 'cursed_armour');
    log(`    Cursed Armour: recharges 1 skill!`, 'legendary');
  }
}

function rechargeOneSkill(hero, source) {
  const idx = hero.skillStates.findIndex(s => s === 'exhausted');
  if (idx >= 0) {
    hero.skillStates[idx] = 'ready';
    if (G && G.tracker && source) {
      if (!G.tracker.skillRechargeSources[source]) G.tracker.skillRechargeSources[source] = 0;
      G.tracker.skillRechargeSources[source]++;
    }
  }
}

// === GIL SYSTEM ===
function gilEnabled() {
  return G._tweaks && G._tweaks.gilEnabled;
}
function gilReward(hero, enemyStr) {
  if (!gilEnabled()) return;
  const perStr = (G._tweaks && G._tweaks.gilPerStr) || 1;
  const earned = Math.max(1, Math.floor(enemyStr * perStr));
  hero.gil += earned;
  hero.gilEarned += earned;
  log(`    💰 +${earned} Gil (total: ${hero.gil})`, 'legendary');
}
function gilSpendAtEntrance(hero) {
  if (!gilEnabled()) return;
  if (!isAtEntrance(hero)) return;
  // Track visit type
  if (G.tracker) {
    const wasKO = hero._justRespawned;
    if (wasKO) G.tracker.gilVisits.koRespawn++;
    else G.tracker.gilVisits.voluntary++;
  }
  const tw = G._tweaks || {};
  const rechargeCost = tw.gilRechargeSkillCost || 3;
  const equipCost = tw.gilBuyEquipCost || 6;
  // AI priority: buy equipment if no weapon AND can afford, else recharge skills
  const hasWeapon = hero.equipment.some(e => e.type === 'weapon');
  const exhaustedSkills = hero.skillStates.filter(s => s === 'exhausted').length;
  // Buy equip if affordable and need it
  if (!hasWeapon && hero.gil >= equipCost && G.legendaryDeck.length > 0) {
    hero.gil -= equipCost;
    hero.gilSpentEquip += equipCost;
    drawLegendaryItem(hero);
    log(`  💰 Spent ${equipCost} Gil → bought Legendary Equipment! (${hero.gil} Gil left)`, 'legendary');
  }
  // Recharge skills if affordable and have exhausted ones
  while (hero.gil >= rechargeCost && exhaustedSkills > 0 && hero.skillStates.some(s => s === 'exhausted')) {
    hero.gil -= rechargeCost;
    hero.gilSpentSkill += rechargeCost;
    rechargeOneSkill(hero, 'gil');
    log(`  💰 Spent ${rechargeCost} Gil → recharged 1 Skill! (${hero.gil} Gil left)`, 'legendary');
  }
}

function removeFollowers(hero) {
  // Track lost followers
  hero.followers.forEach(f => {
    if (f.effect !== 'reroll_flame') trackFollower(f.name, 'lost');
  });
  // Keep Faithful Dog (can't be removed)
  const dog = hero.followers.find(f => f.effect === 'reroll_flame');
  hero.followers = dog ? [dog] : [];
}

// ========== AI HELPERS ==========
function aiChooseHydraHead(heads) {
  const nest = heads.find(h => h.name === 'The Nest' && !h.destroyed);
  if (nest) return heads.indexOf(nest);
  let best = -1, bestStr = 999;
  heads.forEach((h, i) => {
    if (!h.destroyed && h.effectiveStr < bestStr) {
      bestStr = h.effectiveStr;
      best = i;
    }
  });
  return best;
}

// ========== CORE GAME LOOP ==========
function runTurn() {
  if (G.gameOver) return;
  const hero = G.heroes[G.currentHero];
  G.turn++;
  G.stats.turns++;
  hero.talentUsedThisTurn = false;
  hero.dodgeActive = false;
  hero.ko = false;

  log(`━━━ Turn ${G.turn} — ${hero.name} ${hero.title} ━━━`, 'turn-header');

  // Gil: spend at entrance if at entrance
  gilSpendAtEntrance(hero);
  hero._justRespawned = false;

  // Turn-start: Wizard Hat
  if (hero.equipment.find(e => e.effect === 'turn_start_recharge')) {
    const r = Math.floor(Math.random() * 6) + 1;
    if (r >= 4) {
      rechargeOneSkill(hero, 'wizard_hat');
      log(`  🎩 Wizard Hat: rolled ${r} — recharged a skill!`, 'legendary');
    } else {
      log(`  🎩 Wizard Hat: rolled ${r} — no recharge`, 'system');
    }
  }

  // === SKILL ACTIVATIONS (turn start) ===

  // Herbalist (Gigi): cross-turn — Gigi can recharge a skill at any time
  const gigiForHerb = G.heroes.find(h => h.id === 'gigi');
  if (gigiForHerb && isSkillReady(gigiForHerb, 'Herbalist') && shouldUseSkill(gigiForHerb, 'Herbalist', { atHydra: G.heroesInHydraArea.has('gigi') })) {
    const candidates = G.heroes.filter(h => h.skillStates.some(s => s === 'exhausted'));
    const neediest = candidates.sort((a,b) => {
      // Prioritize the active hero, then most exhausted
      const aScore = b.skillStates.filter(s => s === 'exhausted').length + (b.id === hero.id ? 1 : 0);
      const bScore = a.skillStates.filter(s => s === 'exhausted').length + (a.id === hero.id ? 1 : 0);
      return aScore - bScore;
    })[0];
    if (neediest) {
      useSkill(gigiForHerb, 'Herbalist');
      rechargeOneSkill(neediest, 'herbalist');
      trackSkill('gigi', 'Herbalist', 'activated');
      log(`  🌿 Herbalist: Gigi recharges a skill for ${neediest.name}${neediest.id === 'gigi' ? ' (self)' : ''}!`, 'wonder');
    }
  }

  // Copycat → Herbalist (Eggo copies Gigi's Herbalist at turn start)
  if (hero.id === 'eggo' && isSkillReady(hero, 'Copycat')) {
    const gigiForCopy = G.heroes.find(h => h.id === 'gigi');
    const eggoExhausted = hero.skillStates.filter(s => s === 'exhausted').length;
    if (gigiForCopy && isSkillReady(gigiForCopy, 'Herbalist') && eggoExhausted >= 2) {
      useSkill(hero, 'Copycat');
      trackSkill(hero.id, 'Copycat', 'activated');
      const candidates = G.heroes.filter(h => h.skillStates.some(s => s === 'exhausted'));
      const neediest = candidates.sort((a,b) => b.skillStates.filter(s => s === 'exhausted').length - a.skillStates.filter(s => s === 'exhausted').length)[0];
      if (neediest) {
        rechargeOneSkill(neediest, 'herbalist');
        G.tracker.copycatDetails.push({ copiedSkill: 'Herbalist', won: null, context: 'dungeon' });
        log(`  🎭 Copycat → Herbalist: ${hero.name} recharges a skill for ${neediest.name}!`, 'flame');
      }
    }
  }

  // Wild Call (Gigi): draw Wonder until Follower
  if (hero.id === 'gigi' && shouldUseSkill(hero, 'Wild Call', { atHydra: false })) {
    useSkill(hero, 'Wild Call');
    trackSkill(hero.id, 'Wild Call', 'activated');
    let foundFollower = null;
    const skipped = [];
    while (G.wonderDeck.length > 0) {
      const idx = G.wonderDeck.pop();
      const card = WONDER_CARDS[idx];
      if (card.type === 'follower' && !foundFollower) {
        foundFollower = card;
        break;
      } else {
        skipped.push(idx);
      }
    }
    skipped.forEach(i => G.wonderDeck.push(i));
    shuffle(G.wonderDeck);
    if (foundFollower) {
      hero.followers.push({name: foundFollower.name, str: foundFollower.str || 0, effect: foundFollower.effect});
      trackFollower(foundFollower.name, 'drawn');
      log(`  🐦 Wild Call: ${hero.name} found ${foundFollower.name}!`, 'wonder');
    } else {
      log(`  🐦 Wild Call: no followers left in Wonder deck`, 'system');
    }
  }

  // Hound following from previous turn
  if (hero.houndFollowing) {
    log(`  🐕 The Hound catches up to ${hero.name}!`, 'misfortune');
    const hound = hero.houndFollowing;
    hero.houndFollowing = null;
    combat(hero, hound, 'misfortune');
    if (G.gameOver || hero.ko) { if (!G.gameOver) nextHero(); return; }
  }

  if (hero.runningToHydra) {
    runToHydra(hero);
  } else if (G.hydraActive && G.heroesInHydraArea.has(hero.id)) {
    hydraAttack(hero);
  } else {
    movePhase(hero);

    // === TAUNT (Juju): fight a random enemy in dungeon ===
    if (hero.id === 'juju' && !hero.ko && !G.gameOver && !G.hydraActive && shouldUseSkill(hero, 'Taunt', { atHydra: false })) {
      if (G.mishapDeck.length > 0) {
        const enemies = MISHAP_CARDS.filter(c => c.type === 'enemy');
        if (enemies.length > 0) {
          const enemy = enemies[Math.floor(Math.random() * enemies.length)];
          useSkill(hero, 'Taunt');
          trackSkill(hero.id, 'Taunt', 'activated');
          log(`  🗡 Taunt: ${hero.name} challenges ${enemy.name}!`, 'flame');
          combat(hero, {...enemy}, 'mishap');
        }
      }
    }

    // === SHADOWSTEP (Eggo): extra turn from scratch ===
    if (hero.id === 'eggo' && !G.gameOver && !hero.ko && !G.hydraActive && shouldUseSkill(hero, 'Shadowstep', { atHydra: false })) {
      useSkill(hero, 'Shadowstep');
      trackSkill(hero.id, 'Shadowstep', 'activated');
      log(`  👤 Shadowstep: ${hero.name} takes another turn!`, 'flame');
      hero.talentUsedThisTurn = false;
      hero.dodgeActive = false;
      movePhase(hero);
    }
  }

  if (!G.gameOver) {
    nextHero();
  }
}

function decideMovementIntent(hero, movePoints) {
  const dist = heroDistanceToEntrance(hero);

  // Can't return if already running to Hydra or at Hydra
  if (hero.runningToHydra || G.heroesInHydraArea.has(hero.id)) {
    const dirIndex = chooseExploreDirection(G.hexMap, hero.pos.q, hero.pos.r);
    return { type: 'explore', dirIndex };
  }

  // Gil spending decision — think like a player
  if (gilEnabled() && dist > 0) {
    const tw = G._tweaks || {};
    const rechargeCost = tw.gilRechargeSkillCost || 3;
    const equipCost = tw.gilBuyEquipCost || 6;
    const gil = hero.gil;

    // What do I need?
    const totalSkills = hero.skillStates.length;
    const exhaustedSkills = hero.skillStates.filter(s => s === 'exhausted').length;
    const readySkills = totalSkills - exhaustedSkills;
    const skillsFull = exhaustedSkills === 0;

    const equipCount = hero.equipment.length;
    const maxSlots = maxEquipSlots(hero);
    const equipFull = equipCount >= maxSlots;
    const hasWeapon = hero.equipment.some(e => e.type === 'weapon');

    // What can I buy?
    const canAffordRecharge = gil >= rechargeCost;
    const canAffordEquip = gil >= equipCost && G.legendaryDeck.length > 0;
    const rechargesAffordable = Math.floor(gil / rechargeCost);

    // Is it worth going back?
    let reason = null;

    // Priority 1: No weapon and can buy one — big power spike
    if (!hasWeapon && canAffordEquip) {
      reason = 'buy_weapon';
    }
    // Priority 2: No equipment at all — very vulnerable
    else if (equipCount === 0 && canAffordEquip) {
      reason = 'buy_equip_naked';
    }
    // Priority 3: All skills exhausted — can't burn for rerolls, very weak
    else if (exhaustedSkills === totalSkills && canAffordRecharge) {
      reason = 'recharge_all_exhausted';
    }
    // Priority 4: Most skills exhausted and have plenty of Gil
    else if (exhaustedSkills >= 2 && rechargesAffordable >= 2) {
      reason = 'recharge_multiple';
    }
    // Priority 5: Equipment slot open and can afford, plus some skill recharging
    else if (!equipFull && canAffordEquip && exhaustedSkills >= 1 && gil >= equipCost + rechargeCost) {
      reason = 'equip_and_recharge';
    }
    // Priority 6: Just enough for a recharge and really need it (only 1 ready skill left)
    else if (readySkills <= 1 && exhaustedSkills >= 2 && canAffordRecharge) {
      reason = 'recharge_desperate';
    }

    if (reason) {
      // Is the trip feasible? Confined map = max ~3-4 hexes from center
      // Entrance is always reachable in 1 turn (avg roll 3.5)
      // Only return if 1 turn away — no multi-turn detours
      const turnsToReturn = Math.ceil(dist / 3.5);
      const maxTurns = 1;

      if (turnsToReturn <= maxTurns) {
        const path = G.hexMap.findPathAvoidDD(hero.pos.q, hero.pos.r, 0, 0);
        if (path && path.length > 1) {
          if (G.tracker) G.tracker.gilVisits.voluntary++;
          log(`  💭 ${hero.name} decides to return to Entrance (${reason.replace(/_/g, ' ')})`, 'system');
          return { type: 'return_entrance' };
        }
      }
    }
  }

  // Default: explore
  const dirIndex = chooseExploreDirection(G.hexMap, hero.pos.q, hero.pos.r);
  return { type: 'explore', dirIndex: dirIndex };
}

function movePhase(hero) {
  let roll = heroRollDie(hero);
  if (checkAssassin(hero, roll)) return;

  let isFlame = roll.isFlame || hero.giftedFlame;
  hero.giftedFlame = false;
  let moveVal = roll.val;

  // Baba Yaga: limit to 1
  if (hasStalker(hero, 'move_1_only')) {
    if (moveVal > 1) {
      moveVal = 1;
      log(`  🧙 Baba Yaga limits movement to 1!`, 'misfortune');
    }
  }

  // Spectral Horse: +2 movement
  if (hero.followers.find(f => f.effect === 'movement_+2')) {
    moveVal += 2;
    log(`  🐴 Spectral Horse: +2 movement (total ${moveVal})`, 'wonder');
  }

  // Ninja Tabi: roll 2 dice for movement, keep best
  if (hero.equipment.find(e => e.effect === 'move_2_dice')) {
    const roll2 = heroRollDie(hero);
    if (roll2.val > roll.val) {
      moveVal = roll2.val + (hero.followers.find(f => f.effect === 'movement_+2') ? 2 : 0);
      if (hasStalker(hero, 'move_1_only')) moveVal = 1;
      isFlame = roll2.isFlame || hero.giftedFlame;
      log(`  👟 Ninja Tabi: rolled [${roll.val}, ${roll2.val}] keeps ${roll2.val}`, 'legendary');
    } else {
      log(`  👟 Ninja Tabi: rolled [${roll.val}, ${roll2.val}] keeps ${roll.val}`, 'legendary');
    }
  }

  log(`${hero.name} rolls ${moveVal}${isFlame ? ' 🔥 FLAME' : ''} for movement`);

  // Talent trigger on movement flame
  if (isFlame && !hero.talentUsedThisTurn) {
    triggerTalent(hero, 'movement');
  }

  // Awakening check (tile 10+)
  if (isFlame && G.tilesPlaced >= 10) {
    awakenEffect(hero);
  }

  // Move (hex-aware)
  const intent = decideMovementIntent(hero, moveVal);
  let currentQ = hero.pos.q;
  let currentR = hero.pos.r;
  let destTileType = null;
  let placedNewTiles = 0;

  if (intent.type === 'explore') {
    // STRAIGHT LINE movement: choose direction, move [roll] new tiles
    // Explored tiles are JUMPED OVER (don't count as steps)
    // Exception: Dread Dungeon ALWAYS stops you (explored or not)
    const dir = HEX_DIRS[intent.dirIndex];
    let stepsUsed = 0;
    let scanQ = currentQ, scanR = currentR;
    const maxScan = 20; // safety limit to prevent infinite loops
    let scanned = 0;

    while (stepsUsed < moveVal && scanned < maxScan) {
      scanQ += dir.q;
      scanR += dir.r;
      scanned++;

      if (!G.hexMap.isInBounds(scanQ, scanR)) {
        // Hit edge of map — stop here
        break;
      }

      if (G.hexMap.has(scanQ, scanR)) {
        // Explored tile — check for Dread Dungeon
        const existing = G.hexMap.get(scanQ, scanR);
        if (existing.type === 'dread') {
          // Dread Dungeon always stops movement
          currentQ = scanQ;
          currentR = scanR;
          destTileType = 'dread';
          log('  ⚠ Dread Dungeon blocks the path! Movement stops.', 'misfortune');
          break;
        }
        // Otherwise: JUMP OVER — don't count as step, don't stop
        continue;
      }

      // Unexplored hex — place new tile
      if (G.tileDeck.length === 0) break;
      const tileType = G.tileDeck.pop();
      G.tilesPlaced++;
      placedNewTiles++;
      const tile = {
        q: scanQ, r: scanR, type: tileType,
        roomId: 'room_' + G.tilesPlaced, tileIndex: G.tilesPlaced,
        enemies: [], equipment: []
      };
      G.hexMap.set(scanQ, scanR, tile);
      G.board.push({id: tile.roomId, type: tileType, enemies:[], equipment:[]});
      currentQ = scanQ;
      currentR = scanR;
      destTileType = tileType;
      stepsUsed++;

      // New Dread Dungeon stops movement immediately
      if (tileType === 'dread') {
        log('  ⚠ Dread Dungeon! Movement stops.', 'misfortune');
        break;
      }
    }

    // If we jumped over everything and placed nothing, land on last scanned explored tile
    if (stepsUsed === 0 && scanned > 0 && currentQ === hero.pos.q && currentR === hero.pos.r) {
      // Walk back to find the last valid explored tile along this line
      let lastQ = currentQ, lastR = currentR;
      let sQ = currentQ, sR = currentR;
      for (let s = 0; s < scanned; s++) {
        sQ += dir.q; sR += dir.r;
        if (G.hexMap.has(sQ, sR)) { lastQ = sQ; lastR = sR; }
      }
      if (lastQ !== currentQ || lastR !== currentR) {
        currentQ = lastQ; currentR = lastR;
        const t = G.hexMap.get(currentQ, currentR);
        destTileType = t ? t.type : 'common';
      }
    }
  } else if (intent.type === 'return_entrance') {
    // Return to entrance: walk through explored tiles step by step
    for (let step = 0; step < moveVal; step++) {
      const path = G.hexMap.findPathAvoidDD(currentQ, currentR, 0, 0);
      if (!path || path.length <= 1) break;
      const nextStep = path[1];
      currentQ = nextStep.q;
      currentR = nextStep.r;
      destTileType = G.hexMap.get(currentQ, currentR)?.type || 'common';

      // Arrived at entrance
      if (currentQ === 0 && currentR === 0) {
        log(`  ${hero.name} returns to the Entrance!`, 'wonder');
        break;
      }
    }
  }

  // Update hero position
  hero.pos = { q: currentQ, r: currentR };

  // Spend Gil immediately if arrived at entrance
  if (isAtEntrance(hero)) {
    gilSpendAtEntrance(hero);
  }

  if (!destTileType) destTileType = 'common';

  const typeIcon = destTileType === 'wonder' ? '✦ Wonder' : destTileType === 'dread' ? '☠ Dread Dungeon' : '· Common Passage';
  log(`${hero.name} lands on ${typeIcon} (tile #${G.tilesPlaced})`, destTileType === 'wonder' ? 'wonder' : destTileType === 'dread' ? 'misfortune' : 'mishap');

  // Reality Warp (Lulu): skip dangerous rooms — strategic decision
  if (destTileType !== 'wonder' && hero.id === 'lulu' && shouldUseSkill(hero, 'Reality Warp', { atHydra: false })) {
    if (destTileType === 'dread' || (destTileType === 'common' && totalStr(hero) < 4)) {
      useSkill(hero, 'Reality Warp');
      trackSkill(hero.id, 'Reality Warp', 'activated');
      log(`  🌀 Reality Warp: ${hero.name} warps to a safe room!`, 'wonder');
      return;
    }
  }

  // Encounter dropped equipment on dungeon floor (guarded by enemy)
  if (G.dungeonFloorEquipment.length > 0 && !hero.ko) {
    const maxSlotsDungeon = hero.followers.find(f => f.effect === 'inventory_+1') ? 3 : 2;
    // Simplified spatial model: ~30% chance per move to stumble on a drop pile
    if (hero.equipment.length < maxSlotsDungeon && Math.random() < 0.3) {
      const pile = G.dungeonFloorEquipment[0];
      if (pile.guardian) {
        const guardStr = pile.guardian.str || 0;
        const heroStr = totalStr(hero);
        // AI decision: is the loot worth fighting for?
        // Calculate loot value (total STR of dropped items)
        const lootValue = pile.items.reduce((s,e) => s + (e.str || 0), 0);
        // Fight if: hero is stronger than enemy AND loot is worth it
        // OR: hero already has no equipment (nothing to lose from KO)
        const worthFighting = (heroStr >= guardStr + 1) || // can likely win
          (hero.equipment.length === 0 && lootValue >= 2); // nothing to lose, good loot
        if (worthFighting) {
          log(`  📦 ${hero.name} finds dropped equipment guarded by ${pile.guardian.name} (STR ${guardStr})!`, 'legendary');
          combat(hero, {...pile.guardian}, pile.guardian.str >= 4 ? 'misfortune' : 'mishap');
          if (!hero.ko && !G.gameOver) {
            pile.items.forEach(item => {
              if (hero.equipment.length < maxSlotsDungeon) {
                hero.equipment.push(item);
                log(`    📦 Claimed ${item.name}!`, 'legendary');
              }
            });
            G.dungeonFloorEquipment.shift();
          }
          if (hero.ko || G.gameOver) return;
        } else {
          log(`  📦 ${hero.name} sees dropped equipment but ${pile.guardian.name} (STR ${guardStr}) is too dangerous. Walks away.`, 'system');
        }
      } else {
        // No guardian (KO from trap) — free pickup
        pile.items.forEach(item => {
          if (hero.equipment.length < maxSlotsDungeon) {
            hero.equipment.push(item);
            log(`  📦 ${hero.name} picks up ${item.name} from the dungeon floor!`, 'legendary');
          }
        });
        G.dungeonFloorEquipment.shift();
      }
    }
  }

  // Room resolution
  resolveRoom(hero, destTileType);

  // Vanga: draw legendary on Wonder destination
  if (destTileType === 'wonder' && hero.equipment.find(e => e.effect === 'wonder_draw_legendary')) {
    log(`  ⚒ Vanga: Wonder room bonus!`, 'legendary');
    drawLegendaryItem(hero);
  }
}

function resolveRoom(hero, roomType) {
  if (G.roomsVisited) G.roomsVisited[roomType]++;
  if (roomType === 'wonder') {
    drawWonder(hero);
  } else if (roomType === 'common') {
    drawMishap(hero);
  } else if (roomType === 'dread') {
    drawDread(hero);
  }
}

function drawLegendaryItem(hero) {
  if (G.legendaryDeck.length === 0) return;
  // Try to find an enabled item in the deck
  var tries = 0;
  while (G.legendaryDeck.length > 0 && tries < LEGENDARY_EQUIPMENT.length) {
    var idx = G.legendaryDeck.pop();
    var eq = {...LEGENDARY_EQUIPMENT[idx]};
    // Check per-item enabled
    if (G._tweaks && G._tweaks.equipment && G._tweaks.equipment[eq.name] && !G._tweaks.equipment[eq.name].enabled) {
      tries++;
      continue;
    }
    // Apply per-item STR modifier
    if (G._tweaks && G._tweaks.equipment && G._tweaks.equipment[eq.name] && G._tweaks.equipment[eq.name].strMod) {
      eq.str = eq.str + G._tweaks.equipment[eq.name].strMod;
    }
    log(`    Drew Legendary: ${eq.name}`, 'legendary');
    equipItem(hero, eq);
    return;
  }
}

function drawWonder(hero) {
  if (G.wonderDeck.length === 0) { G.wonderDeck = shuffle([...Array(WONDER_CARDS.length).keys()]); }
  const idx = G.wonderDeck.pop();
  const card = WONDER_CARDS[idx];
  log(`  ✦ Wonder: ${card.name} (${card.type})`, 'wonder');
  resolveWonderCard(hero, card);
}

function drawMishap(hero) {
  if (G.mishapDeck.length === 0) { G.mishapDeck = shuffle([...Array(MISHAP_CARDS.length).keys()]); }
  const idx = G.mishapDeck.pop();
  const card = MISHAP_CARDS[idx];
  log(`  ⚡ Mishap: ${card.name} (${card.type})`, 'mishap');
  resolveMishapCard(hero, card);
}

function drawMisfortune(hero) {
  if (G.misfortuneDeck.length === 0) { G.misfortuneDeck = shuffle([...Array(MISFORTUNE_CARDS.length).keys()]); }
  const idx = G.misfortuneDeck.pop();
  const card = MISFORTUNE_CARDS[idx];
  log(`  ☠ Misfortune: ${card.name} (${card.type})`, 'misfortune');
  resolveMisfortuneCard(hero, card);
}

function drawDread(hero) {
  // Seasoned Adventurer: draw 2 misfortunes, keep the lesser
  const hasSA = hero.followers.find(f => f.effect === 'dd_draw_2_keep_1');

  // Draw Legendary Equipment (guarded) — per-item enabled check
  let guardedEquip = null;
  if (G.legendaryDeck.length > 0) {
    var ddTries = 0;
    while (G.legendaryDeck.length > 0 && ddTries < LEGENDARY_EQUIPMENT.length) {
      var ddIdx = G.legendaryDeck.pop();
      var ddEq = {...LEGENDARY_EQUIPMENT[ddIdx]};
      if (G._tweaks && G._tweaks.equipment && G._tweaks.equipment[ddEq.name] && !G._tweaks.equipment[ddEq.name].enabled) {
        ddTries++;
        continue;
      }
      if (G._tweaks && G._tweaks.equipment && G._tweaks.equipment[ddEq.name] && G._tweaks.equipment[ddEq.name].strMod) {
        ddEq.str = ddEq.str + G._tweaks.equipment[ddEq.name].strMod;
      }
      guardedEquip = ddEq;
      log(`  ⚔ Guarded Legendary: ${guardedEquip.name} (STR ${guardedEquip.str >= 0 ? '+' : ''}${guardedEquip.str})`, 'legendary');
      break;
    }
  }

  // Draw Misfortune
  if (hasSA) {
    log(`    Seasoned Adventurer: draws 2 misfortunes, keeps the lesser danger!`, 'wonder');
  }
  drawMisfortune(hero);

  // If survived, claim equipment
  if (!hero.ko && guardedEquip) {
    equipItem(hero, guardedEquip);
  }
}

// ========== CARD RESOLUTION ==========
function resolveWonderCard(hero, card) {
  switch(card.type) {
    case 'encounter':
      if (card.effect === 'recharge_all_skills') {
        const exhaustedCount = hero.skillStates.filter(s => s === 'exhausted').length;
        hero.skillStates = hero.skillStates.map(() => 'ready');
        if (G && G.tracker && exhaustedCount > 0) {
          if (!G.tracker.skillRechargeSources['priestess_of_light']) G.tracker.skillRechargeSources['priestess_of_light'] = 0;
          G.tracker.skillRechargeSources['priestess_of_light'] += exhaustedCount;
        }
        log(`    ${hero.name}: all skills recharged!`, 'wonder');
      } else if (card.effect === 'recharge_1_skill') {
        rechargeOneSkill(hero, 'wisp');
        log(`    ${hero.name}: 1 skill recharged!`, 'wonder');
      } else if (card.effect === 'draw_legendary') {
        drawLegendaryItem(hero);
      } else if (card.effect === 'equip_full') {
        while (hero.equipment.length < maxEquipSlots(hero) && G.legendaryDeck.length > 0) {
          drawLegendaryItem(hero);
        }
      } else if (card.effect === 'swap_equipment') {
        if (hero.equipment.length > 0 && G.legendaryDeck.length > 0) {
          const removable = hero.equipment.filter(e => e.effect !== 'cannot_remove_blocks_talent');
          if (removable.length > 0) {
            removable.sort((a, b) => (a.str || 0) - (b.str || 0));
            const removed = removable[0];
            hero.equipment = hero.equipment.filter(e => e !== removed);
            log(`    Discarded ${removed.name}`, 'legendary');
            drawLegendaryItem(hero);
          }
        }
      } else if (card.effect === 'remove_stalker') {
        if (hero.stalkers.length > 0) {
          const removed = hero.stalkers.shift();
          log(`    Removed ${removed.name}!`, 'wonder');
        } else {
          log(`    No stalkers to remove.`, 'system');
        }
      } else {
        log(`    ${card.name} effect applied.`, 'wonder');
      }
      break;
    case 'follower':
      if (G._tweaks && !G._tweaks.followersEnabled) { log(`    ${card.name} passes by...`, 'system'); break; }
      hero.followers.push({name: card.name, str: card.str || 0, effect: card.effect});
      trackFollower(card.name, 'drawn');
      log(`    ${card.name} joins ${hero.name} as a follower!`, 'wonder');
      break;
  }
}

function resolveMishapCard(hero, card) {
  switch(card.type) {
    case 'encounter':
      log(`    ${card.name}: minor encounter resolved.`, 'mishap');
      break;
    case 'follower':
      if (G._tweaks && !G._tweaks.followersEnabled) { log(`    ${card.name} passes by...`, 'system'); break; }
      hero.followers.push({name: card.name, str: card.str || 0, effect: card.effect});
      trackFollower(card.name, 'drawn');
      log(`    ${card.name} joins ${hero.name}!`, 'mishap');
      break;
    case 'stalker':
      hero.stalkers.push({name: card.name, effect: card.effect});
      log(`    ⚠ ${card.name} latches onto ${hero.name}!`, 'misfortune');
      // Old Hag: discard all other followers
      if (card.effect === 'discard_followers') {
        removeFollowers(hero);
        log(`    Old Hag: all other followers discarded!`, 'misfortune');
      }
      break;
    case 'trap':
      resolveTrap(hero, card);
      break;
    case 'enemy':
      combat(hero, card, 'mishap');
      break;
  }
}

function resolveMisfortuneCard(hero, card) {
  switch(card.type) {
    case 'stalker':
      hero.stalkers.push({name: card.name, effect: card.effect});
      log(`    ⚠ ${card.name} curses ${hero.name}!`, 'misfortune');
      break;
    case 'trap':
      resolveTrap(hero, card);
      break;
    case 'enemy':
      combat(hero, card, 'misfortune');
      break;
  }
}

function resolveTrap(hero, card) {
  trackTrap(card.name, 'triggered');
  // Spell Mirror: cancel dangerous trap effects
  if (trySpellMirror(card.effect)) {
    log(`    Trap effect cancelled by Spell Mirror! No harm done.`, 'wonder');
    trackTrap(card.name, 'survived');
    return;
  }
  switch(card.effect) {
    case 'roll_1_2_ko': {
      const r = heroRollDie(hero);
      if (checkAssassin(hero, r)) return;
      log(`    Trap roll: ${r.val}`, 'combat');
      if (r.val <= 2) {
        log(`    ${hero.name} falls through! KO!`, 'ko');
        trackTrap(card.name, 'ko');
        applyKO(hero);
      } else {
        log(`    ${hero.name} dodges the trap!`, 'wonder');
        trackTrap(card.name, 'survived');
      }
      break;
    }
    case 'exhaust_or_ko': {
      if (readySkillCount(hero) > 0) {
        exhaustOneSkill(hero, "Skill Burn (reroll)");
        trackTrapResource('Giant Web', 'skillsExhausted');
        log(`    ${hero.name} escapes the web!`, 'mishap');
      } else {
        log(`    No skills to exhaust — KO!`, 'ko');
        applyKO(hero);
      }
      break;
    }
    case 'roll_1_3_ko': {
      const r = heroRollDie(hero);
      if (checkAssassin(hero, r)) return;
      log(`    Spike Trap roll: ${r.val}`, 'combat');
      if (r.val <= 3) {
        log(`    Impaled! KO!`, 'ko');
        applyKO(hero);
      } else {
        log(`    ${hero.name} avoids the spikes.`, 'wonder');
      }
      break;
    }
    case 'ko_or_exhaust_all': {
      if (readySkillCount(hero) > 0) {
        const exhaustedByTribute = readySkillCount(hero);
        hero.skillStates = hero.skillStates.map(() => 'exhausted');
        checkCursedArmour(hero);
        for (let _t = 0; _t < exhaustedByTribute; _t++) trackTrapResource('The Tribute', 'skillsExhausted');
        log(`    ${hero.name} pays The Tribute. All skills exhausted.`, 'misfortune');
      } else {
        log(`    No skills to pay — KO!`, 'ko');
        applyKO(hero);
      }
      break;
    }
    case 'fewer_2_skills_ko': {
      if (readySkillCount(hero) < 2) {
        log(`    Guillotine! Not enough ready skills — KO!`, 'ko');
        applyKO(hero);
      } else {
        log(`    ${hero.name} has enough skills to survive.`, 'wonder');
      }
      break;
    }
    case 'fight_self_4dice': {
      const enemyRolls = [1,2,3,4].map(() => Math.floor(Math.random()*6)+1);
      const enemyTotal = Math.max(...enemyRolls);
      log(`    Hall of Mirrors! Enemy (yourself) rolls: [${enemyRolls}] = ${enemyTotal}`, 'combat');
      const pRoll = heroRollDie(hero);
      if (checkAssassin(hero, pRoll)) return;
      const pTotal = pRoll.val + totalStr(hero);
      log(`    ${hero.name} rolls ${pRoll.val} + STR ${totalStr(hero)} = ${pTotal}`, 'combat');
      if (pTotal >= enemyTotal) {
        log(`    Defeated your reflection!`, 'wonder');
      } else {
        log(`    Your reflection wins — KO!`, 'ko');
        applyKO(hero);
      }
      break;
    }
    case 'draw_dread': {
      // Trap Alarm: resolve as Dread Dungeon (Legendary + Misfortune)
      log(`    Trap Alarm triggers Dread encounter!`, 'misfortune');
      drawDread(hero);
      break;
    }
    case 'flame_or_discard_equip': {
      // Magnetic Field: ALL heroes with equipment must roll Flame or discard
      G.heroes.forEach(h => {
        if (h.equipment.length > 0) {
          const r = heroRollDie(h);
          if (r.isFlame) {
            log(`    ${h.name} rolls ${r.val} 🔥 — equipment safe!`, 'wonder');
          } else {
            const removable = h.equipment.filter(e => e.effect !== 'cannot_remove_blocks_talent');
            if (removable.length > 0) {
              const removed = removable[removable.length - 1];
              h.equipment = h.equipment.filter(e => e !== removed);
              trackTrapResource('Magnetic Field', 'equipLost');
              log(`    ${h.name} rolls ${r.val} — loses ${removed.name}!`, 'misfortune');
            }
          }
        }
      });
      break;
    }
    case 'discard_1_equip': {
      const removable = hero.equipment.filter(e => e.effect !== 'cannot_remove_blocks_talent');
      if (removable.length > 0) {
        removable.sort((a, b) => (a.str || 0) - (b.str || 0));
        const removed = removable[0];
        hero.equipment = hero.equipment.filter(e => e !== removed);
        trackTrapResource('Spectral Theft', 'equipLost');
        log(`    Lost ${removed.name}!`, 'misfortune');
      }
      break;
    }
    case 'lose_followers': {
      if (hero.followers.length > 0) {
        const count = hero.followers.length;
        removeFollowers(hero);
        for (let _f = 0; _f < count; _f++) trackTrapResource('Stink Bomb', 'followersLost');
        log(`    Lost ${count} followers!`, 'misfortune');
      }
      break;
    }
    case 'go_back': {
      hero.pos = {q:0, r:0};
      log(`    Trap Door! Back to start.`, 'misfortune');
      break;
    }
    default:
      log(`    ${card.name} trap resolved.`, 'mishap');
  }
}

// ========== SPELL MIRROR ==========
function trySpellMirror(context, atHydra) {
    const lulu = G.heroes.find(h => h.id === 'lulu');
    if (!lulu || !isSkillReady(lulu, 'Spell Mirror')) return false;

    const lethal = ['ko_or_exhaust_all','roll_1_3_ko','fewer_2_skills_ko','fight_self_4dice'];
    const dangerous = ['flame_counts_0','only_flame_hits','fight_twice','rolls_2_best_double_lose',
        'aoe_skill_drain','exhaust_2_or_minus2','exhaust_or_ko'];
    const isLethal = lethal.includes(context);
    const isDangerous = dangerous.includes(context);

    if (shouldUseSkill(lulu, 'Spell Mirror', { atHydra: !!atHydra, isLethal, isDangerous })) {
        useSkill(lulu, 'Spell Mirror');
        trackSkill('lulu', 'Spell Mirror', 'activated');
        if (atHydra) {
            log(`  🪞 Spell Mirror: Lulu cancels the Hydra head ability!`, 'flame');
        } else if (isLethal) {
            log(`  🪞 Spell Mirror: Lulu cancels the deadly effect!`, 'flame');
        } else {
            log(`  🪞 Spell Mirror: Lulu cancels the special effect!`, 'flame');
        }
        return true;
    }
    return false;
}

// ========== COMBAT ==========
function combat(hero, enemyCard, tier) {
  G.stats.combats++;
  const ht = initHeroTracker(G.tracker, hero.id);
  ht.combats++;
  trackEncounter(enemyCard.name, 'drawn');
  let enemyStr = enemyCard.str || 0;

  // === TWEAKS: enemy STR modifier ===
  if (G._tweaks) {
    if (tier === 'mishap' && G._tweaks.mishapEnemyStrMod) enemyStr = Math.max(0, enemyStr + G._tweaks.mishapEnemyStrMod);
    if (tier === 'misfortune' && G._tweaks.misfortuneEnemyStrMod) enemyStr = Math.max(0, enemyStr + G._tweaks.misfortuneEnemyStrMod);
  }

  // === SPECIAL ENEMY STR ===
  if (enemyCard.effect === 'random_str') {
    enemyStr = Math.floor(Math.random() * 6) + 1;
    log(`    The Faceless One's STR: ${enemyStr}`, 'combat');
  }
  if (enemyCard.effect === 'plus2_per_relic') {
    const totalRelics = G.heroes.reduce((s, h) => s + h.heldRelics.length, 0);
    enemyStr = totalRelics * 2;
    log(`    Fishguard STR: ${enemyStr} (+2 per relic, party has ${totalRelics})`, 'combat');
  }

  // === PRE-COMBAT AVOIDANCE ===
  // Bully: flee if hero total STR > Bully base
  if (enemyCard.effect === 'flee_or_str6') {
    const heroTotalStr = totalStr(hero);
    if (heroTotalStr > enemyStr) {
      log(`    Bully sees ${hero.name}'s STR ${heroTotalStr} and flees!`, 'wonder');
      trackEncounter(enemyCard.name, 'fled');
      if (!G.tracker.decisionEnemies[enemyCard.name]) G.tracker.decisionEnemies[enemyCard.name] = { choiceA:0, choiceB:0 };
      G.tracker.decisionEnemies[enemyCard.name].choiceA++; // fled
      return;
    }
    enemyStr = 6;
    if (!G.tracker.decisionEnemies[enemyCard.name]) G.tracker.decisionEnemies[enemyCard.name] = { choiceA:0, choiceB:0 };
    G.tracker.decisionEnemies[enemyCard.name].choiceB++; // fought
    log(`    Bully stands ground at STR 6!`, 'combat');
  }

  // Rat Swarm: scare off if hero total STR > enemy STR
  if (enemyCard.effect === 'push_to_room') {
    if (totalStr(hero) > enemyStr) {
      log(`    ${hero.name} scares off the Rat Swarm!`, 'wonder');
      trackEncounter(enemyCard.name, 'avoided');
      return;
    }
  }

  // Bandit: discard 1 equipment to avoid fight
  if (enemyCard.effect === 'discard_equip_or_fight') {
    const removable = hero.equipment.filter(e => e.effect !== 'cannot_remove_blocks_talent');
    if (removable.length > 0 && totalStr(hero) < enemyStr + 3) {
      removable.sort((a, b) => (a.str || 0) - (b.str || 0));
      const removed = removable[0];
      hero.equipment = hero.equipment.filter(e => e !== removed);
      log(`    ${hero.name} pays off the Bandit with ${removed.name}!`, 'mishap');
      trackEncounter(enemyCard.name, 'avoided');
      if (!G.tracker.decisionEnemies[enemyCard.name]) G.tracker.decisionEnemies[enemyCard.name] = { choiceA:0, choiceB:0 };
      G.tracker.decisionEnemies[enemyCard.name].choiceA++; // paid (avoided)
      return;
    }
    if (!G.tracker.decisionEnemies[enemyCard.name]) G.tracker.decisionEnemies[enemyCard.name] = { choiceA:0, choiceB:0 };
    G.tracker.decisionEnemies[enemyCard.name].choiceB++; // fought
  }

  // === SPELL MIRROR: cancel dangerous enemy effects ===
  let spellMirrored = false;
  if (enemyCard.effect && trySpellMirror(enemyCard.effect)) {
    spellMirrored = true;
  }

  // === PRE-COMBAT EFFECTS ===
  if (!spellMirrored && enemyCard.effect === 'exhaust_1_skill') {
    exhaustOneSkill(hero, "Snakerogue pre-combat");
    log(`    Snakerogue exhausts a skill before combat!`, 'misfortune');
  }

  if (!spellMirrored && enemyCard.effect === 'aoe_skill_drain') {
    G.heroes.forEach(h => {
      const r = heroRollDie(h);
      if (r.val <= 2) { exhaustOneSkill(h, "Stormcaller AoE"); log(`    Stormcaller: ${h.name} loses a skill!`, 'misfortune'); }
    });
  }

  // Mana Leech: exhaust 2 or -2
  let manaLeechPenalty = 0;
  if (!spellMirrored && enemyCard.effect === 'exhaust_2_or_minus2') {
    if (readySkillCount(hero) >= 2) {
      exhaustOneSkill(hero, "Mana Leech drain");
      exhaustOneSkill(hero, "Mana Leech drain");
      log(`    Mana Leech: ${hero.name} exhausts 2 skills!`, 'misfortune');
    } else {
      manaLeechPenalty = -2;
      log(`    Mana Leech: ${hero.name} fights at -2 STR!`, 'misfortune');
    }
  }

  // FROGman: swallows 1 equipment
  let frogmanSwallowed = null;
  if (enemyCard.effect === 'swallows_equip' && hero.equipment.length > 0) {
    const removable = hero.equipment.filter(e => e.effect !== 'cannot_remove_blocks_talent');
    if (removable.length > 0) {
      frogmanSwallowed = removable[removable.length - 1];
      hero.equipment = hero.equipment.filter(e => e !== frogmanSwallowed);
      log(`    FROGman swallows ${frogmanSwallowed.name}!`, 'misfortune');
    }
  }

  // === STRATEGIC AI: Skill decisions via shouldUseSkill() ===
  const skillCtx = { enemyStr, atHydra: false };

  // === SKILL: Second Nature (Gigi) — +3 STR if no equipment ===
  let secondNatureBonus = 0;
  if (hero.id === 'gigi' && hero.equipment.length === 0 && shouldUseSkill(hero, 'Second Nature', skillCtx)) {
    useSkill(hero, 'Second Nature');
    secondNatureBonus = 3;
    trackSkill(hero.id, 'Second Nature', 'activated');
    log(`    🌿 Second Nature! Gigi fights with +3 STR (no equipment)`, 'flame');
  }

  // === SKILL: Siphon (Lulu) — -2 STR to ANY enemy in combat ===
  const luluForSiphon = G.heroes.find(h => h.id === 'lulu');
  if (luluForSiphon && shouldUseSkill(luluForSiphon, 'Siphon', skillCtx)) {
    useSkill(luluForSiphon, 'Siphon');
    enemyStr -= 2;
    trackSkill('lulu', 'Siphon', 'activated');
    const who = hero.id === 'lulu' ? '' : ` (helping ${hero.name})`;
    log(`    🔮 Siphon! Lulu${who} reduces enemy STR by 2 (now ${enemyStr})`, 'flame');
  }

  let packLeaderBonus = 0;
  // === SKILL: Copycat (Eggo) — cross-turn: Eggo can copy any ally skill to help ANY hero ===
  const eggoForCopy = G.heroes.find(h => h.id === 'eggo');
  if (eggoForCopy && isSkillReady(eggoForCopy, 'Copycat') && enemyStr >= 3) {
    const allies = G.heroes.filter(h => h.id !== 'eggo');
    const luluH = allies.find(h => h.id === 'lulu');
    const gigiH = allies.find(h => h.id === 'gigi');
    // Copy Siphon if Lulu already used hers (double Siphon = -4 total)
    if (luluH && isSkillReady(luluH, 'Siphon')) {
      useSkill(eggoForCopy, 'Copycat');
      enemyStr -= 2;
      trackSkill('eggo', 'Copycat', 'activated');
      G.tracker.copycatDetails.push({ copiedSkill: 'Siphon', won: null, context: 'dungeon' });
      const who = hero.id === 'eggo' ? '' : ` (helping ${hero.name})`;
      log(`  🎭 Copycat → Siphon${who}: Enemy -2 STR (now ${enemyStr})`, 'flame');
    } else if (gigiH && isSkillReady(gigiH, 'Pack Leader') && hero.followers.length >= 2) {
      useSkill(eggoForCopy, 'Copycat');
      packLeaderBonus = hero.followers.length;
      trackSkill('eggo', 'Copycat', 'activated');
      G.tracker.copycatDetails.push({ copiedSkill: 'Pack Leader', won: null, context: 'dungeon' });
      log(`  🎭 Copycat → Pack Leader: +${packLeaderBonus} STR`, 'flame');
    }
  }

  // === SKILL: Pack Leader (Gigi) — +1 per follower ===
  if (hero.id === 'gigi' && shouldUseSkill(hero, 'Pack Leader', skillCtx)) {
    useSkill(hero, 'Pack Leader');
    packLeaderBonus = hero.followers.length;
    trackSkill(hero.id, 'Pack Leader', 'activated');
    log(`    🐺 Pack Leader! +${packLeaderBonus} STR (${hero.followers.length} followers)`, 'flame');
  }

  // === SKILL: Overload (Lulu) — exhaust all remaining skills, +2 per each ===
  let fireballBonus = 0; // reusing variable name for compatibility
  if (hero.id === 'lulu' && isSkillReady(hero, 'Overload')) {
    // AI: use Overload at Hydra when needed, or against strong enemies (STR 5+)
    const atHydra = G.heroesInHydraArea.has(hero.id);
    const strongEnemy = enemyStr >= 5;
    const readyCount = hero.skillStates.filter(s => s === 'ready').length;
    // Overload exhausts itself too, so count = readyCount - 1 (Overload itself)
    // But Overload says "exhaust all remaining" which includes Overload getting exhausted via useSkill
    // So: use Overload, it exhausts. Then exhaust all OTHER ready skills. Bonus = number of others exhausted + 0 (Overload itself doesn't count since it's the cost)
    // Actually re-reading: "Exhaust all your remaining Ready Skills. Gain +2 STR for each Skill exhausted this way."
    // Overload is exhausted by useSkill. Then remaining ready skills are exhausted. Each one gives +2.
    // So bonus = readyCount - 1 (minus Overload itself) * 2
    if ((atHydra || strongEnemy) && readyCount >= 2) { // at least 1 other skill to exhaust for +2
      useSkill(hero, 'Overload'); // exhausts Overload
      const othersToExhaust = hero.skillStates.filter(s => s === 'ready').length;
      for (let oi = 0; oi < othersToExhaust; oi++) {
        exhaustOneSkill(hero, 'Overload sacrifice');
      }
      fireballBonus = othersToExhaust * 2;
      trackSkill(hero.id, 'Overload', 'activated');
      log(`    ⚡ Overload! Exhausted ${othersToExhaust} skills for +${fireballBonus} STR!`, 'flame');
    }
  }

  // === SKILL: Heist (Eggo) — -1 STR but win = draw legendary ===
  let heistActive = false;
  if (hero.id === 'eggo' && shouldUseSkill(hero, 'Heist', skillCtx)) {
    useSkill(hero, 'Heist');
    heistActive = true;
    trackSkill(hero.id, 'Heist', 'activated');
    log(`    🗡 Heist! Fighting at -1 STR for a chance at Legendary Equipment`, 'flame');
  }

  // === SKILL: Battlecry (Juju) — roll 2 keep worst, win = all heroes recharge 2 ===
  let rallyingBlowActive = false;
  if (hero.id === 'juju' && shouldUseSkill(hero, 'Battlecry', skillCtx)) {
    useSkill(hero, 'Battlecry');
    rallyingBlowActive = true;
    trackSkill(hero.id, 'Battlecry', 'activated');
    log(`    ⚔ Battlecry! Rolling 2 dice, keeping worst`, 'flame');
  }

  // === DOOMHAMMER pre-fight ===
  let doomhammerBonus = 0;
  if (hero.equipment.find(e => e.effect === 'roll_gamble')) {
    const doomRoll = Math.floor(Math.random() * 6) + 1;
    if (doomRoll <= 2) {
      log(`    Doomhammer curse! Rolled ${doomRoll} — KO!`, 'ko');
      if (frogmanSwallowed) hero.equipment.push(frogmanSwallowed);
      applyKO(hero);
      return;
    } else if (doomRoll <= 4) {
      doomhammerBonus = 1;
      log(`    Doomhammer: rolled ${doomRoll} — STR +1`, 'legendary');
    } else {
      doomhammerBonus = 3;
      log(`    Doomhammer: rolled ${doomRoll} — STR +3!`, 'legendary');
    }
  }

  // === FIREBANE: exhaust skill for +1 ===
  let firebaneBonus = 0;
  if (hero.equipment.find(e => e.effect === 'exhaust_skill_+1') && readySkillCount(hero) > 1 && enemyStr >= 4) {
    exhaustOneSkill(hero, "Firebane weapon");
    firebaneBonus = 1;
    log(`    Firebane: exhausted a skill for +1 STR`, 'legendary');
  }

  // === DEMON SWORD: +1 on Dread Dungeon ===
  let demonSwordBonus = 0;
  const heroRoom = heroHexTile(hero);
  if (hero.equipment.find(e => e.effect === 'dd_+1') && heroRoom && heroRoom.type === 'dread') {
    demonSwordBonus = 1;
    log(`    Demon Sword blazes in the Dread Dungeon! +1 STR`, 'legendary');
  }

  // === WARLORD ARMOUR: double base STR if enemy > hero ===
  let warlordBonus = 0;
  if (hero.equipment.find(e => e.effect === 'double_base_if_weaker') && enemyStr > totalStr(hero)) {
    warlordBonus = hero.str;
    log(`    Warlord Armour! Base STR doubled (${hero.str} → ${hero.str * 2})`, 'legendary');
  }

  // === RUN FIGHT (supports Slayer: fight_twice) ===
  const winsNeeded = (!spellMirrored && enemyCard.effect === 'fight_twice') ? 2 : 1;
  let totalWins = 0;
  for (let fightRound = 0; fightRound < winsNeeded; fightRound++) {
    if (G.gameOver) return;
    if (fightRound > 0) log(`    Slayer: Round ${fightRound + 1}!`, 'combat');

    const result = singleFight(hero, enemyCard, tier, enemyStr,
      { doomhammerBonus, firebaneBonus, demonSwordBonus, warlordBonus, manaLeechPenalty, frogmanSwallowed, packLeaderBonus, fireballBonus, heistActive, rallyingBlowActive, spellMirrored, secondNatureBonus });

    if (result === 'win') {
      totalWins++;
    } else {
      // Lost — stop fighting
      return;
    }
  }

  // All rounds won
  G.stats.monstersKilled++;
  gilReward(hero, enemyStr);
  ht.wins++;
  trackEncounter(enemyCard.name, 'won');
  const _lfr = G._lastFightResult || {};
  G.tracker.combatLog.push({ hero:hero.name, heroId:hero.id, enemy:enemyCard.name, enemyStr:enemyCard.str||0, heroTotal:_lfr.heroTotal, enemyTotal:_lfr.enemyTotal, won:true, margin:_lfr.margin, tier, turn:G.turn, readySkills:readySkillCount(hero), equipCount:hero.equipment.length, followerCount:hero.followers.length, heroTotalStr:totalStr(hero) });
  initHeroTracker(G.tracker, hero.id).enemiesKilled++;
  log(`  ✓ ${hero.name} defeats ${enemyCard.name}!`, 'wonder');

  // === ON-WIN EFFECTS ===
  // Recover FROGman equipment
  if (frogmanSwallowed) {
    hero.equipment.push(frogmanSwallowed);
    log(`    Recovered ${frogmanSwallowed.name} from FROGman!`, 'wonder');
  }

  // Golem: die result exactly 3 → becomes follower
  if (enemyCard.effect === 'exact_3_follower' && G._lastHeroRollVal === 3) {
    hero.followers.push({name:'Golem', str:3, effect:'none'});
    trackFollower('Golem', 'drawn');
    log(`    The Golem becomes a follower! (+3 STR)`, 'wonder');
  }

  // Mimic: draw legendary on defeat
  if (enemyCard.effect === 'draw_legendary') {
    drawLegendaryItem(hero);
  }

  // Heist (Eggo): draw legendary on win
  if (heistActive) {
    drawLegendaryItem(hero);
    log(`    🗡 Heist pays off! Drew Legendary Equipment!`, 'flame');
  }

  // Battlecry (Juju): all heroes recharge 2 skills on win
  if (rallyingBlowActive) {
    G.heroes.forEach(h => {
      rechargeOneSkill(h, 'battlecry');
      rechargeOneSkill(h, 'battlecry');
    });
    log(`    ⚔ Battlecry victory! All heroes recharge 2 skills!`, 'flame');
  }

  // Thiefling Rats: discard 1 equipment on defeat
  if (enemyCard.effect === 'discard_1_equip') {
    const removable = hero.equipment.filter(e => e.effect !== 'cannot_remove_blocks_talent');
    if (removable.length > 0) {
      removable.sort((a, b) => (a.str || 0) - (b.str || 0));
      const removed = removable[0];
      hero.equipment = hero.equipment.filter(e => e !== removed);
      log(`    Thiefling Rats stole ${removed.name}!`, 'misfortune');
    }
  }

  // Mystic Wand: recharge all on win
  if (hero.equipment.find(e => e.effect === 'win_recharge_all')) {
    const exhaustedCount = hero.skillStates.filter(s => s === 'exhausted').length;
    hero.skillStates = hero.skillStates.map(() => 'ready');
    if (G && G.tracker && exhaustedCount > 0) {
      if (!G.tracker.skillRechargeSources['mystic_wand']) G.tracker.skillRechargeSources['mystic_wand'] = 0;
      G.tracker.skillRechargeSources['mystic_wand'] += exhaustedCount;
    }
    log(`    Mystic Wand: all skills recharged!`, 'wonder');
  }

  // Supernova Gun: roll 6 on win = defeat all enemies
  if (hero.equipment.find(e => e.effect === 'win_roll_6_clear')) {
    const r = Math.floor(Math.random() * 6) + 1;
    if (r === 6) {
      G.enemiesOnBoard = [];
      log(`    💥 Supernova Gun! Rolled 6 — all enemies in dungeon defeated!`, 'legendary');
    }
  }

  // Sacerdote Fishfolk: roll 1-2 go to entrance
  if (enemyCard.effect === 'roll_1_2_entrance') {
    const r = Math.floor(Math.random() * 6) + 1;
    if (r <= 2) {
      hero.pos = {q:0, r:0};
      log(`    Sacerdote curse: rolled ${r} — sent to entrance!`, 'misfortune');
    }
  }

  // Wind Elemental: may move to revealed room on defeat
  if (enemyCard.effect === 'move_to_revealed') {
    log(`    Wind Elemental: ${hero.name} may move to any revealed room.`, 'wonder');
  }
}

function singleFight(hero, enemyCard, tier, enemyStr, bonuses) {
  const { doomhammerBonus, firebaneBonus, demonSwordBonus, warlordBonus, manaLeechPenalty, frogmanSwallowed, packLeaderBonus, fireballBonus, heistActive, rallyingBlowActive, spellMirrored, secondNatureBonus } = bonuses;

  // === ENEMY ROLL ===
  let enemyTotal;
  let enemyRollResult = null;

  if (!spellMirrored && enemyCard.effect === 'rolls_2_best_double_lose') {
    // Jack o' Lantern: 2 dice, keep best, doubles = auto-lose
    const r1 = rollDie(hero), r2 = rollDie(hero);
    const isDouble = r1.val === r2.val;
    const bestRoll = Math.max(r1.val, r2.val);
    enemyTotal = bestRoll + enemyStr;
    log(`    Jack o' Lantern rolls [${r1.val}, ${r2.val}] keeps ${bestRoll} + STR ${enemyStr} = ${enemyTotal}${isDouble ? ' DOUBLES!' : ''}`, 'combat');
    if (isDouble) {
      log(`    Doubles! ${hero.name} automatically loses!`, 'ko');
      handleCombatLoss(hero, enemyCard, tier, frogmanSwallowed, enemyStr);
      return 'loss';
    }
    enemyRollResult = { val: bestRoll, isFlame: false };
  } else if (!spellMirrored && enemyCard.effect === 'rolls_2_best') {
    // Ghoul: 2 dice, keep best
    const r1 = rollDie(hero), r2 = rollDie(hero);
    const bestRoll = Math.max(r1.val, r2.val);
    enemyTotal = bestRoll + enemyStr;
    log(`    ${enemyCard.name} rolls [${r1.val}, ${r2.val}] keeps ${bestRoll} + STR ${enemyStr} = ${enemyTotal}`, 'combat');
    enemyRollResult = { val: bestRoll, isFlame: false };
  } else {
    enemyRollResult = rollDie(hero);
    enemyTotal = enemyRollResult.val + enemyStr;
    log(`    ${enemyCard.name} (STR ${enemyStr}) rolls ${enemyRollResult.val} = ${enemyTotal}`, 'combat');
  }

  // Mummy: if enemy rolls Flame, hero -2
  let mummyPenalty = 0;
  if (enemyCard.effect === 'flame_minus2' && enemyRollResult && enemyRollResult.isFlame) {
    mummyPenalty = -2;
    log(`    Mummy's Flame curse! ${hero.name} fights at -2`, 'misfortune');
  }

  // Mud Golem margin
  const beatMargin = (enemyCard.effect === 'must_beat_by_2') ? 2 : 0;
  if (beatMargin > 0) log(`    Mud Golem: must beat by ${beatMargin}+!`, 'combat');

  // === HERO ROLL ===
  let heroRoll;
  const hasTripleAxe = hero.equipment.find(e => e.effect === 'roll_3_keep_best');
  const hasVeteran = hero.followers.find(f => f.effect === 'roll_2_keep_best');

  // === SKILL: Cheap Shot (Eggo) — roll extra die, keep best ===
  let cheapShotActive = false;
  if (hero.id === 'eggo' && !hasTripleAxe && shouldUseSkill(hero, 'Cheap Shot', { enemyStr, atHydra: false })) {
    useSkill(hero, 'Cheap Shot');
    cheapShotActive = true;
    trackSkill(hero.id, 'Cheap Shot', 'activated');
  }

  if (rallyingBlowActive) {
    // Battlecry: roll 2 dice, keep worst
    const r1 = heroRollDie(hero), r2 = heroRollDie(hero);
    heroRoll = r1.val <= r2.val ? r1 : r2;
    // Track Battlecry details
    G.tracker.battlecryDetails.push({
      roll1: r1.val, roll2: r2.val, kept: heroRoll.val,
      bestRoll: Math.max(r1.val, r2.val),
      isFlame1: r1.isFlame, isFlame2: r2.isFlame
    });
    log(`    Battlecry: rolled [${r1.val}, ${r2.val}] keeps worst ${heroRoll.val}${heroRoll.isFlame ? ' 🔥' : ''}`, 'flame');
  } else if (hasTripleAxe) {
    const r1 = heroRollDie(hero), r2 = heroRollDie(hero), r3 = heroRollDie(hero);
    heroRoll = [r1, r2, r3].sort((a, b) => b.val - a.val)[0];
    log(`    Triple Axe: rolled [${r1.val}, ${r2.val}, ${r3.val}] keeps ${heroRoll.val}${heroRoll.isFlame ? ' 🔥' : ''}`, 'legendary');
  } else if (hasVeteran || cheapShotActive) {
    const r1 = heroRollDie(hero), r2 = heroRollDie(hero);
    heroRoll = r1.val >= r2.val ? r1 : r2;
    const source = cheapShotActive ? 'Cheap Shot' : 'Veteran';
    log(`    ${source}: rolled [${r1.val}, ${r2.val}] keeps ${heroRoll.val}${heroRoll.isFlame ? ' 🔥' : ''}`, cheapShotActive ? 'flame' : 'legendary');
  } else {
    heroRoll = heroRollDie(hero);
  }

  // Assassin check on combat roll
  if (checkAssassin(hero, heroRoll)) return 'loss';

  let isFlame = heroRoll.isFlame || hero.giftedFlame;
  hero.giftedFlame = false;
  G._lastHeroRollVal = heroRoll.val;

  // === ROLL MODIFIERS ===
  // Mycoid: flame counts as 0 AND no talent
  if (!spellMirrored && enemyCard.effect === 'flame_counts_0' && isFlame) {
    heroRoll = { val: 0, isFlame: true };
    isFlame = false;
    log(`    Mycoid spores! Flame roll counts as 0, no talent!`, 'misfortune');
  }

  // Djin: only flame hits
  if (!spellMirrored && enemyCard.effect === 'only_flame_hits' && !isFlame) {
    log(`    Djin: non-Flame roll (${heroRoll.val}) counts as 0!`, 'combat');
    heroRoll = { val: 0, isFlame: false };
  }

  // Longlegs Spider: only even hits
  if (enemyCard.effect === 'only_even_hits' && heroRoll.val % 2 !== 0) {
    log(`    Longlegs Spider: odd roll (${heroRoll.val}) counts as 0!`, 'combat');
    heroRoll = { val: 0, isFlame: heroRoll.isFlame };
  }

  // Stone Gargoyle: only 3+ hits
  if (enemyCard.effect === 'only_3plus_hits' && heroRoll.val > 0 && heroRoll.val < 3) {
    log(`    Stone Gargoyle: roll ${heroRoll.val} counts as 0!`, 'combat');
    heroRoll = { val: 0, isFlame: heroRoll.isFlame };
  }

  // Talent trigger
  if (isFlame && !hero.talentUsedThisTurn && !hasStalker(hero, 'no_flame_effect')) {
    triggerTalent(hero, 'combat');
  }

  let combatBonus = 0;
  if (hero.id === 'juju' && isFlame && hero.talentUsedThisTurn) combatBonus += 2;

  // Dodge (Eggo)
  if (hero.id === 'eggo' && isFlame && !hasStalker(hero, 'no_flame_effect')) {
    hero.dodgeActive = true;
  }

  // Wooden Spoon: roll 1 = auto win
  if (hero.equipment.find(e => e.effect === 'roll_1_auto_win') && heroRoll.val === 1) {
    log(`    🥄 Wooden Spoon! Rolled 1 — automatic victory!`, 'legendary');
    return 'win';
  }

  // Archangel: flame = auto win (non-boss)
  if (hero.followers.find(f => f.effect === 'flame_auto_win') && isFlame && tier !== 'hydra') {
    log(`    👼 Archangel! Flame = automatic victory!`, 'wonder');
    return 'win';
  }

  // Skills (Siphon, Pack Leader, Heist, Cheap Shot, Battlecry, Second Nature) are activated pre-fight.
  // Skill Burn (reroll) remains as the last-resort skill use.

  // Siphon Blade
  if (hero.equipment.find(e => e.effect === 'drain_1')) {
    combatBonus += 1;
    enemyTotal -= 1;
    log(`    Siphon Blade drains! Enemy -1, Hero +1`, 'legendary');
  }

  // Arcane Parrot: exhaust skill for +1
  let parrotBonus = 0;
  if (hero.followers.find(f => f.effect === 'exhaust_skill_str+1') && readySkillCount(hero) > 1 && enemyStr >= 4) {
    exhaustOneSkill(hero, "Skill Burn (reroll)");
    parrotBonus = 1;
    log(`    Arcane Parrot: exhausted a skill for +1 STR`, 'wonder');
  }

  // Blob: no weapon STR
  let blobPenalty = 0;
  if (enemyCard.effect === 'no_weapon') {
    blobPenalty = -hero.equipment.filter(e => e.type === 'weapon').reduce((s, e) => s + (e.str || 0), 0);
    if (blobPenalty < 0) log(`    Blob: weapons have no effect! (${blobPenalty} STR)`, 'combat');
  }

  // Squelette: base STR only
  const useBaseOnly = (enemyCard.effect === 'base_only');
  if (useBaseOnly) log(`    Squelette: ${hero.name} fights with base STR only!`, 'combat');

  const heroStrValue = useBaseOnly ? hero.str : totalStr(hero);
  const heistPenalty = heistActive ? -1 : 0;
  let heroTotal = heroRoll.val + heroStrValue + combatBonus + doomhammerBonus + firebaneBonus
    + demonSwordBonus + warlordBonus + mummyPenalty + manaLeechPenalty + parrotBonus + blobPenalty
    + (packLeaderBonus || 0) + (fireballBonus || 0) + heistPenalty + (secondNatureBonus || 0);

  log(`    ${hero.name} rolls ${heroRoll.val}${isFlame ? ' 🔥' : ''} + STR ${heroStrValue}${combatBonus + doomhammerBonus + firebaneBonus + demonSwordBonus + warlordBonus + parrotBonus + (packLeaderBonus || 0) ? ' + bonuses' : ''}${mummyPenalty + manaLeechPenalty + blobPenalty + heistPenalty ? ' + penalties' : ''} = ${heroTotal}`, 'combat');

  // === SKILL BURN (can reroll YOUR die OR ENEMY die) ===
  // Strategic: in prehydra phase, only Skill Burn if the fight is worth it
  const burnPhase = getGamePhase();
  const burnWorthIt = burnPhase !== 'prehydra' || enemyStr >= 4 || koLoadoutValue(hero) >= 4;
  if (heroTotal < enemyTotal + beatMargin && readySkillCount(hero) > 0 && burnWorthIt) {
    // Option A: Reroll hero die
    const rerollHero = heroRollDie(hero);
    let rerollHeroVal = rerollHero.val;
    let rerollHeroFlame = rerollHero.isFlame;
    if (enemyCard.effect === 'flame_counts_0' && rerollHeroFlame) { rerollHeroVal = 0; rerollHeroFlame = false; }
    if (enemyCard.effect === 'only_flame_hits' && !rerollHeroFlame) { rerollHeroVal = 0; }
    if (enemyCard.effect === 'only_even_hits' && rerollHeroVal % 2 !== 0) { rerollHeroVal = 0; }
    if (enemyCard.effect === 'only_3plus_hits' && rerollHeroVal > 0 && rerollHeroVal < 3) { rerollHeroVal = 0; }
    const newBonusA = (hero.id === 'juju' && rerollHeroFlame && !hero.talentUsedThisTurn) ? 2 : (hero.id === 'juju' && isFlame && hero.talentUsedThisTurn ? 2 : 0);
    const totalA = rerollHeroVal + heroStrValue + (combatBonus - (hero.id === 'juju' && isFlame && hero.talentUsedThisTurn ? 2 : 0)) + newBonusA
      + doomhammerBonus + firebaneBonus + demonSwordBonus + warlordBonus + mummyPenalty + manaLeechPenalty + parrotBonus + blobPenalty
      + (packLeaderBonus || 0) + (fireballBonus || 0) + heistPenalty;

    // Option B: Reroll enemy die (keep hero roll, enemy gets new roll)
    const rerollEnemy = rollDie(hero);
    let newEnemyTotal = enemyTotal;
    // Recalculate enemy total with new roll (replace only the die, keep STR and modifiers)
    const enemyDieOnly = enemyTotal - enemyStr; // original enemy die value (may include siphon drain etc)
    // Simplified: enemy total = new roll + enemy STR (reapply siphon drain if applicable)
    let newEnemyDie = rerollEnemy.val;
    newEnemyTotal = newEnemyDie + enemyStr;
    // Reapply siphon drain to enemy
    if (hero.equipment.find(e => e.effect === 'drain_1')) { newEnemyTotal -= 1; }
    // Mummy: if new enemy roll is flame, hero gets -2 (may change penalty)
    // Keep mummy penalty as-is for simplicity since it was already applied

    // AI picks the better option
    const gainA = totalA - heroTotal; // how much hero total improves
    const gainB = enemyTotal - newEnemyTotal; // how much enemy total drops (positive = good)
    // Effective improvement: for option A, hero total changes. For option B, enemy total changes.
    // Compare which option gives better chance to win
    const wouldWinA = totalA >= enemyTotal + beatMargin;
    const wouldWinB = heroTotal >= newEnemyTotal + beatMargin;
    // Prefer the option that wins. If both win, pick either. If neither wins, pick best improvement.
    let burnChoice = 'none';
    if (wouldWinA && !wouldWinB) burnChoice = 'hero';
    else if (wouldWinB && !wouldWinA) burnChoice = 'enemy';
    else if (wouldWinA && wouldWinB) burnChoice = gainA >= gainB ? 'hero' : 'enemy';
    else if (totalA > heroTotal || newEnemyTotal < enemyTotal) burnChoice = (totalA - heroTotal) >= (enemyTotal - newEnemyTotal) ? 'hero' : 'enemy';

    if (burnChoice === 'hero' && (totalA > heroTotal || wouldWinA)) {
      exhaustOneSkill(hero, "Skill Burn (reroll)");
      G.stats.skillBurns++;
      initHeroTracker(G.tracker, hero.id).skillsBurned++;
      heroRoll = { val: rerollHeroVal, isFlame: rerollHeroFlame };
      G._lastHeroRollVal = rerollHeroVal;
      isFlame = rerollHeroFlame;
      const oldTotal = heroTotal;
      heroTotal = totalA;
      if (hero.id === 'eggo' && rerollHeroFlame && !hasStalker(hero, 'no_flame_effect')) hero.dodgeActive = true;
      if (hero.id === 'eggo' && !rerollHeroFlame) hero.dodgeActive = false;
      if (oldTotal < enemyTotal + beatMargin && heroTotal >= enemyTotal + beatMargin) {
        trackSkill(hero.id, 'Skill Burn', 'turnedFight');
      }
      log(`    ⟲ Skill Burn! Rerolled own die to ${rerollHeroVal}${rerollHeroFlame ? ' 🔥' : ''} = ${heroTotal}`, 'flame');
    } else if (burnChoice === 'enemy' && newEnemyTotal < enemyTotal) {
      exhaustOneSkill(hero, "Skill Burn (reroll)");
      G.stats.skillBurns++;
      initHeroTracker(G.tracker, hero.id).skillsBurned++;
      const oldEnemyTotal = enemyTotal;
      enemyTotal = newEnemyTotal;
      if (heroTotal < oldEnemyTotal + beatMargin && heroTotal >= enemyTotal + beatMargin) {
        trackSkill(hero.id, 'Skill Burn', 'turnedFight');
      }
      log(`    ⟲ Skill Burn! Rerolled ENEMY die: ${enemyCard.name} ${oldEnemyTotal} → ${enemyTotal}`, 'flame');
    }
  }

  // === RESOLUTION ===
  if (heroTotal >= enemyTotal + beatMargin) {
    const margin = heroTotal - (enemyTotal + beatMargin);
    initHeroTracker(G.tracker, hero.id).damageDealt += margin;
    if (margin <= 1) G.tracker.closeCalls.push({ hero: hero.name, enemy: enemyCard.name, margin, heroTotal, enemyTotal: enemyTotal + beatMargin });
    if (margin >= 5) G.tracker.overkills.push({ hero: hero.name, enemy: enemyCard.name, margin });
    // Track equipment that helped win
    hero.equipment.forEach(e => trackEquip(e.name, 'wonWith'));
    // Store fight details for combat() to use in combatLog
    G._lastFightResult = { heroTotal, enemyTotal, margin };
    // Second Nature tracking
    if (secondNatureBonus > 0) {
      G.tracker.secondNatureDetails.push({ won: true, wasDifferenceMaker: margin < secondNatureBonus });
    }
    return 'win';
  } else {
    const margin = (enemyTotal + beatMargin) - heroTotal;
    const ht = initHeroTracker(G.tracker, hero.id);
    ht.losses++;
    ht.damageTaken += margin;
    trackEncounter(enemyCard.name, 'lost');
    G.tracker.combatLog.push({ hero:hero.name, heroId:hero.id, enemy:enemyCard.name, enemyStr:enemyCard.str||0, won:false, margin:-margin, tier, turn:G.turn, heroTotal, enemyTotal, readySkills:readySkillCount(hero), equipCount:hero.equipment.length, followerCount:hero.followers.length, heroTotalStr:totalStr(hero) });
    // Second Nature tracking on loss
    if (secondNatureBonus > 0) {
      G.tracker.secondNatureDetails.push({ won: false, wasDifferenceMaker: false });
    }
    // === NOT TODAY! (Juju) — turn close loss (margin 1-2) into a win ===
    if (margin <= 2) {
      const jujuForNT = G.heroes.find(h => h.id === 'juju' && isSkillReady(h, 'Not Today!'));
      if (jujuForNT) {
        useSkill(jujuForNT, 'Not Today!');
        trackSkill('juju', 'Not Today!', 'activated');
        trackSkill('juju', 'Not Today!', 'turnedFight');
        const who = hero.id === 'juju' ? '' : ` for ${hero.name}`;
        log(`    ⚔ NOT TODAY! Juju${who} turns a loss (margin ${margin}) into a win!`, 'flame');
        // Treat as win
        hero.equipment.forEach(e => trackEquip(e.name, 'wonWith'));
        G.stats.monstersKilled++;
        gilReward(hero, enemyStr);
        trackEncounter(enemyCard.name, 'won');
        if (frogmanSwallowed) { hero.equipment.push(frogmanSwallowed); log(`    Recovered ${frogmanSwallowed.name}!`, 'wonder'); }
        // Post-win effects
        if (hero.equipment.find(e => e.effect === 'win_recharge_all')) {
          const exhaustedCount = hero.skillStates.filter(s => s === 'exhausted').length;
          hero.skillStates = hero.skillStates.map(() => 'ready');
          if (G && G.tracker && exhaustedCount > 0) {
            if (!G.tracker.skillRechargeSources['mystic_wand']) G.tracker.skillRechargeSources['mystic_wand'] = 0;
            G.tracker.skillRechargeSources['mystic_wand'] += exhaustedCount;
          }
          log(`    Mystic Wand: all skills recharged!`, 'wonder');
        }
        return 'win';
      }
    }

    hero.equipment.forEach(e => trackEquip(e.name, 'lostWith'));
    // Skill gap tracking
    if (margin <= 2) {
      ht.neededButDidntHave.push({ enemy: enemyCard.name, margin, context: 'Close loss by ' + margin, type: 'close_loss' });
    } else if (margin <= 4 && hero.equipment.length === 0) {
      ht.neededButDidntHave.push({ enemy: enemyCard.name, margin, context: 'Had no equipment', type: 'no_equip' });
    } else if (margin > 4) {
      ht.neededButDidntHave.push({ enemy: enemyCard.name, margin, context: `Outmatched by ${margin}`, type: 'outmatched' });
    }
    log(`  ✗ ${hero.name} loses to ${enemyCard.name}! (${heroTotal} vs ${enemyTotal}${beatMargin ? '+' + beatMargin : ''})`, 'ko');
    handleCombatLoss(hero, enemyCard, tier, frogmanSwallowed, enemyStr);
    return 'loss';
  }
}

function handleCombatLoss(hero, enemyCard, tier, frogmanSwallowed, enemyStr) {
  if (enemyStr === undefined) enemyStr = enemyCard.str || 0;
  // Strategic AI: evaluate whether to spend resources preventing this KO
  const preventKO = shouldPreventKO(hero);

  // === SKILL: Shield Wall (Juju) — prevent KO on self OR any ally ===
  const jujuForShield = G.heroes.find(h => h.id === 'juju');
  if (jujuForShield && isSkillReady(jujuForShield, 'Shield Wall') && preventKO) {
    useSkill(jujuForShield, 'Shield Wall');
    trackSkill('juju', 'Shield Wall', 'activated');
    trackSkill('juju', 'Shield Wall', 'savedFromKO');
    const who = hero.id === 'juju' ? '' : ` (saving ${hero.name})`;
    log(`    🛡 Shield Wall! Juju${who} prevents KO!`, 'flame');
    return;
  }

  // === SKILL: Copycat (Eggo) — copy Shield Wall from ally ===
  if (hero.id === 'eggo' && preventKO && shouldUseSkill(hero, 'Copycat', { preventKO: true, atHydra: false })) {
    const juju = G.heroes.find(h => h.id === 'juju');
    if (juju && isSkillReady(juju, 'Shield Wall')) {
      useSkill(hero, 'Copycat');
      trackSkill(hero.id, 'Copycat', 'activated');
      trackSkill(hero.id, 'Copycat', 'savedFromKO');
      G.tracker.copycatDetails.push({ copiedSkill: 'Shield Wall', won: null, context: 'dungeon' });
      log(`  🎭 Copycat: ${hero.name} copies Shield Wall from Juju! KO prevented!`, 'flame');
      return;
    }
  }

  // Warden Angel: discard to win instead
  const wardenIdx = hero.followers.findIndex(f => f.effect === 'discard_win_fight');
  if (wardenIdx >= 0) {
    const warden = hero.followers[wardenIdx];
    hero.followers.splice(wardenIdx, 1);
    trackFollower('Warden Angel', 'helpedWin');
    trackFollower('Warden Angel', 'lost');
    log(`    👼 Warden Angel sacrifices himself! ${hero.name} wins instead!`, 'wonder');
    G.stats.monstersKilled++;
    gilReward(hero, enemyStr);
    if (frogmanSwallowed) hero.equipment.push(frogmanSwallowed);
    trackSkill(hero.id, 'Warden Angel', 'activated');
    trackSkill(hero.id, 'Warden Angel', 'savedFromKO');
    return;
  }

  // Dodge check (Eggo)
  if (hero.dodgeActive) {
    log(`    🔥 DODGE! ${hero.name} avoids KO!`, 'flame');
    trackSkill(hero.id, 'Dodge (Talent)', 'activated');
    trackSkill(hero.id, 'Dodge (Talent)', 'savedFromKO');
    return;
  }

  // Shield Wall (Juju) KO prevention is checked above.

  // Berserker Helmet: retry on loss
  if (hero.equipment.find(e => e.effect === 'retry_on_loss') && !hero._berserkerUsed) {
    hero._berserkerUsed = true;
    log(`    ⚔ Berserker Helmet! ${hero.name} fights again!`, 'legendary');
    const retry = heroRollDie(hero);
    if (checkAssassin(hero, retry)) { hero._berserkerUsed = false; return; }
    const retryTotal = retry.val + totalStr(hero);
    const enemyRetry = rollDie(hero);
    const enemyRetryTotal = enemyRetry.val + (enemyCard.str || 0);
    log(`    Retry: ${hero.name} ${retryTotal} vs ${enemyCard.name} ${enemyRetryTotal}`, 'combat');
    if (retryTotal >= enemyRetryTotal) {
      log(`    Berserker Helmet wins the retry!`, 'wonder');
      G.stats.monstersKilled++;
      gilReward(hero, enemyStr);
      if (frogmanSwallowed) hero.equipment.push(frogmanSwallowed);
      hero._berserkerUsed = false;
      return;
    }
    hero._berserkerUsed = false;
    log(`    Berserker Helmet retry failed!`, 'ko');
  }

  // Dragon: +1 STR on loss
  if (enemyCard.effect === 'gains_str_on_loss') {
    enemyCard.str = (enemyCard.str || 5) + 1;
    log(`    Dragon grows stronger! Now STR ${enemyCard.str}`, 'misfortune');
  }

  // Hound: follows hero on loss
  if (enemyCard.effect === 'follows_on_loss') {
    hero.houndFollowing = {...enemyCard};
    log(`    🐕 The Hound will follow ${hero.name} to the next destination!`, 'misfortune');
    return; // Hound doesn't KO, just follows
  }

  // Ogre: no respawn, stay on tile
  if (enemyCard.effect === 'no_respawn_on_loss') {
    G.stats.ko++;
    hero.equipment = hero.equipment.filter(e => e.effect === 'cannot_remove_blocks_talent');
    removeFollowers(hero);
    log(`    Ogre pins ${hero.name}! No respawn — stuck until rescued.`, 'ko');
    return;
  }

  hero._lastKOEnemy = enemyCard;  // Store which enemy caused KO, for dungeon floor guardian
  applyKO(hero);
}

function partyRelicTotal() {
  return G.heroes.reduce((s, h) => s + h.heldRelics.length, 0);
}

function spendPartyRelic(reason) {
  let bestDonor = null;
  let bestRelic = null;
  let bestScore = -999;
  G.heroes.forEach(h => {
    h.heldRelics.forEach(r => {
      const isMatched = (r.owner === h.id);
      const score = (isMatched ? 0 : 10) + h.heldRelics.length;
      if (score > bestScore) {
        bestScore = score;
        bestDonor = h;
        bestRelic = r;
      }
    });
  });
  if (!bestDonor || !bestRelic) return null;
  bestDonor.heldRelics = bestDonor.heldRelics.filter(r => r.id !== bestRelic.id);
  G.stats.relicsSpent++;
  return { donor: bestDonor, relic: bestRelic };
}

function koLoadoutValue(hero) {
  let val = 0;
  hero.equipment.forEach(e => { val += (e.str || 0) + 2; });
  hero.followers.forEach(f => { val += (f.str || 0) + 3; });
  hero.stalkers.forEach(() => { val -= 2; });
  return val;
}

// ========== STRATEGIC AI SYSTEM ==========
function getGamePhase() {
  if (G.hydraActive) return 'hydra';
  if (G.relicsCollected >= 3) return 'prehydra';
  if (G.tilesPlaced >= 10) return 'mid';
  return 'early';
}

function shouldUseSkill(hero, skillName, context) {
  if (!isSkillReady(hero, skillName)) return false;
  const phase = getGamePhase();
  const ctx = context || {};
  const enemyStr = ctx.enemyStr || 0;
  const atHydra = ctx.atHydra || false;

  switch(skillName) {
    case 'Siphon':
      if (atHydra) return true;
      // In dungeon: use on enemies that could realistically KO the hero
      // Hero total = totalStr(hero) + avg die (3.5) vs enemy = enemyStr + avg die (3.5)
      // Hero loses if enemy STR > hero STR. Use Siphon when it's close.
      if (phase === 'early') return enemyStr >= 2;
      if (phase === 'mid') return enemyStr >= 3;
      return enemyStr >= 4; // prehydra: still use on real threats

    case 'Shield Wall':
      if (atHydra) return true;
      // In dungeon: use if hero has equipment OR relics (something to lose)
      return hero.equipment.length > 0 || hero.heldRelics.length > 0;

    case 'Second Nature':
      // Use when Gigi has no equipment and is in combat
      return hero.equipment.length === 0;

    case 'Spell Mirror':
      if (atHydra) return true;
      if (ctx.isLethal) return true;
      if (phase === 'prehydra') return false;
      if (ctx.isDangerous) return true; // early/mid: use on dangerous effects
      return false;

    case 'Pack Leader':
      if (atHydra) return hero.followers.length > 0;
      // In dungeon: use if bonus is meaningful (1+ followers and enemy is not trivial)
      return hero.followers.length > 0 && enemyStr >= 2;

    case 'Overload': {
      const readyCount = hero.skillStates.filter(s => s === 'ready').length;
      // Need at least 2 ready (Overload + 1 other) for any bonus
      if (readyCount < 2) return false;
      if (atHydra) return true; // Always worth it at Hydra
      // In dungeon: only against very strong enemies, since you lose ALL skills
      return readyCount >= 3 && enemyStr >= 5;
    }

    case 'Battlecry':
      if (atHydra) return totalStr(hero) + 1 >= (ctx.headStr || 99);
      // In dungeon: use when can win with worst die (free team recharge)
      return totalStr(hero) >= enemyStr + 2;

    case 'Cheap Shot':
      if (atHydra) return true;
      // In dungeon: use on any non-trivial enemy
      return enemyStr >= 3;

    case 'Heist':
      if (atHydra) return false;
      if (phase === 'prehydra') return false;
      return enemyStr <= 3;

    case 'Reality Warp':
      if (phase === 'prehydra' || phase === 'hydra') return false;
      return true;

    case 'Herbalist':
      return true;

    case 'Wild Call':
      return hero.followers.length < 2 && phase !== 'prehydra';

    case 'Shadowstep':
      if (atHydra) return true;
      return phase === 'early' || phase === 'mid';

    case 'Taunt':
      if (atHydra) return true;
      return phase === 'early' || phase === 'mid';

    case 'Copycat': {
      // Copycat can copy ANY ally Ready Skill — check if any useful one is available
      if (ctx.preventKO) return true; // copy Shield Wall to prevent KO
      if (ctx.preCombatSiphon && enemyStr >= 3) return true; // copy Siphon pre-combat
      // At Hydra: always worth copying something useful
      if (atHydra) {
        const allies = G.heroes.filter(h => h.id !== hero.id);
        const hasUsefulAllySkill = allies.some(h =>
          isSkillReady(h, 'Siphon') || isSkillReady(h, 'Shield Wall') ||
          isSkillReady(h, 'Spell Mirror') || isSkillReady(h, 'Not Today!') ||
          isSkillReady(h, 'Herbalist') || isSkillReady(h, 'Overload')
        );
        return hasUsefulAllySkill;
      }
      // In dungeon: copy Herbalist to recharge skills if many exhausted
      const eggoExhausted = hero.skillStates.filter(s => s === 'exhausted').length;
      if (eggoExhausted >= 2) {
        const herbGigi = G.heroes.find(h => h.id === 'gigi' && isSkillReady(h, 'Herbalist'));
        if (herbGigi) return true;
      }
      // Copy Siphon against strong dungeon enemies
      if (enemyStr >= 4) {
        const luluSiphon = G.heroes.find(h => h.id === 'lulu' && isSkillReady(h, 'Siphon'));
        if (luluSiphon) return true;
      }
      return false;
    }
  }
  return false;
}

function shouldPreventKO(hero) {
  if (G.heroesInHydraArea.has(hero.id)) return true;
  const loadout = koLoadoutValue(hero);
  if (loadout < 2) return false;
  if (loadout >= 6) return true;
  return readySkillCount(hero) >= 3;
}

function applyKO(hero) {
  const atHydra = G.heroesInHydraArea.has(hero.id);
  const totalRelics = partyRelicTotal();

  if (atHydra) {
    if (totalRelics > 0) {
      const { donor, relic } = spendPartyRelic('hydra_save');
      const who = donor.id === hero.id ? hero.name : `${donor.name} (for ${hero.name})`;
      log(`    💎 ${relic.name} spent by ${who}! Survives Hydra KO. (party: ${partyRelicTotal()} relics left)`, 'hydra');
      initHeroTracker(G.tracker, donor.id).relicsSpent++;
    } else {
      log(`  💀 ${hero.name} falls at the Hydra — NO RELICS — GAME OVER!`, 'defeat');
      G.gameOver = true;
      G.tracker.deathMoments.push({ hero: hero.name, context: 'KO at Hydra with 0 relics', turn: G.turn });
      return;
    }
    G.stats.ko++;
    initHeroTracker(G.tracker, hero.id).ko++;
    if (G.tracker.pacing.firstKO === 0) G.tracker.pacing.firstKO = G.turn;
    hero.ko = true;
    const parasiteSword = hero.equipment.find(e => e.effect === 'cannot_remove_blocks_talent');
    const droppedItems = hero.equipment.filter(e => e.effect !== 'cannot_remove_blocks_talent');
    const droppedEquip = droppedItems.map(e => e.name).join(', ') || 'nothing';
    // Drop equipment on the Hydra floor — allies or returning hero can pick it up
    droppedItems.forEach(e => G.hydraFloorEquipment.push(e));
    hero.equipment = parasiteSword ? [parasiteSword] : [];
    removeFollowers(hero);
    hero._justRespawned = true;
    hero.pos = {q:0, r:0};
    hero.runningToHydra = true;
    G.heroesInHydraArea.delete(hero.id);
    log(`    ${hero.name} KO'd at Hydra! Dropped: ${droppedEquip}${droppedItems.length > 0 ? ' (left on Hydra floor)' : ''}. Respawned. Must run back.`, 'ko');
    return;
  }

  // Dungeon KO: relic save decision
  const loadout = koLoadoutValue(hero);
  const shouldSpend = totalRelics > 0 && (
    (loadout >= 6 && totalRelics > 1) ||
    (loadout >= 10)
  );

  if (shouldSpend) {
    const { donor, relic } = spendPartyRelic('dungeon_save');
    const who = donor.id === hero.id ? hero.name : `${donor.name} (for ${hero.name})`;
    log(`    💎 ${relic.name} spent by ${who}! KO prevented. (party: ${partyRelicTotal()} relics left)`, 'hydra');
    return;
  }

  G.stats.ko++;
  initHeroTracker(G.tracker, hero.id).ko++;
  const parasiteSword = hero.equipment.find(e => e.effect === 'cannot_remove_blocks_talent');
  const droppedItems = hero.equipment.filter(e => e.effect !== 'cannot_remove_blocks_talent');
  const droppedEquip = droppedItems.map(e => e.name).join(', ') || 'nothing';
  if (parasiteSword) trackEquip(parasiteSword.name, 'survivedKO');
  // Drop equipment on dungeon floor, guarded by the enemy that caused KO
  // hero._lastEnemy is set by handleCombatLoss before calling applyKO
  if (droppedItems.length > 0) {
    const guardian = hero._lastKOEnemy || null;
    G.dungeonFloorEquipment.push({ items: droppedItems, guardian: guardian ? {...guardian} : null });
  }
  hero._lastKOEnemy = null;
  hero.equipment = parasiteSword ? [parasiteSword] : [];
  removeFollowers(hero);
  hero.stalkers = [];
  hero._justRespawned = true;
  hero.pos = {q:0, r:0};
  if (G.tracker.pacing.firstKO === 0) G.tracker.pacing.firstKO = G.turn;
  hero.ko = true;
  log(`    ${hero.name} is KO'd! Dropped: ${droppedEquip}${droppedItems.length > 0 ? (hero._lastKOEnemy ? ' (guarded by enemy)' : ' (on dungeon floor)') : ''}. Respawned at Entrance.`, 'ko');
}

// ========== TALENTS ==========
function triggerTalent(hero, context) {
  if (hero.talentUsedThisTurn) return;
  if (hasStalker(hero, 'no_flame_effect')) {
    log(`    Cursed Beggar blocks ${hero.name}'s talent!`, 'misfortune');
    trackTalent(hero.id, 'blocked');
    return;
  }
  if (hero.equipment.find(e => e.effect === 'cannot_remove_blocks_talent')) {
    log(`    Parasite Sword blocks ${hero.name}'s talent!`, 'misfortune');
    trackTalent(hero.id, 'blocked');
    return;
  }
  hero.talentUsedThisTurn = true;
  trackTalent(hero.id, 'triggered');
  if (context === 'combat') trackTalent(hero.id, 'combatImpact');
  if (context === 'movement') trackTalent(hero.id, 'movementImpact');
  switch(hero.id) {
    case 'juju':
      if (context === 'combat') {
        log(`    🔥 Unwavering Power! +2 to combat total`, 'flame');
      }
      break;
    case 'gigi': {
      const allies = G.heroes.filter(h => h.id !== hero.id);
      const target = allies.length > 0 ? allies[Math.floor(Math.random() * allies.length)] : hero;
      target.giftedFlame = true;
      log(`    🔥 Nature's Gift! ${hero.name} gifts Flame to ${target.name}'s next turn`, 'flame');
      break;
    }
    case 'lulu':
      rechargeOneSkill(hero, 'talent_lulu');
      log(`    🔥 Arcane Recharge! ${hero.name} recharges a skill`, 'flame');
      break;
    case 'eggo':
      hero.dodgeActive = true;
      log(`    🔥 Dodge active! ${hero.name} cannot be KO'd this turn`, 'flame');
      break;
  }
}

// ========== AWAKENING ==========
function awakenEffect(hero) {
  if (!G.exitPlaced) {
    G.exitPlaced = true;
    // Place exit ADJACENT to hero's current destination tile
    const hq = hero.pos.q, hr = hero.pos.r;
    const unexplored = G.hexMap.unexploredNeighbors(hq, hr);
    if (unexplored.length > 0) {
      // Prefer the adjacent hex farthest from entrance
      unexplored.sort((a, b) => hexDistance(0, 0, b.q, b.r) - hexDistance(0, 0, a.q, a.r));
      const chosen = unexplored[0];
      G.exitHex = { q: chosen.q, r: chosen.r };
      G.hexMap.set(chosen.q, chosen.r, {
        q: chosen.q, r: chosen.r, type: 'exit', roomId: 'exit',
        enemies: [], equipment: []
      });
    } else {
      // No unexplored neighbors: use an explored non-entrance neighbor
      const explored = G.hexMap.exploredNeighbors(hq, hr)
        .filter(n => !(n.q === 0 && n.r === 0))
        .map(n => G.hexMap.get(n.q, n.r))
        .filter(Boolean);
      if (explored.length > 0) {
        explored.sort((a, b) => hexDistance(0, 0, b.q, b.r) - hexDistance(0, 0, a.q, a.r));
        G.exitHex = { q: explored[0].q, r: explored[0].r };
      }
    }
    log(`  🚪 The EXIT has been placed!`, 'hydra');
  } else if (G.relicPool.length > 0) {
    G.relicRoomsPlaced++;
    log(`  💎 Relic Room #${G.relicRoomsPlaced} placed!`, 'hydra');
    const relic = G.relicPool.pop();
    G.relicsCollected++;
    const matchedHero = G.heroes.find(h => h.id === relic.owner);
    const leastRelics = [...G.heroes].sort((a, b) => a.heldRelics.length - b.heldRelics.length)[0];
    let recipient;
    if (matchedHero && matchedHero.heldRelics.length <= leastRelics.heldRelics.length) {
      recipient = matchedHero;
    } else {
      recipient = leastRelics;
    }
    recipient.heldRelics.push(relic);
    if (G.tracker.pacing.firstRelic === 0) G.tracker.pacing.firstRelic = G.turn;
    const bonus = relic.owner === recipient.id ? '+2' : '+1';
    log(`    ${recipient.name} claims ${relic.name}! (${bonus} STR, ${G.relicsCollected}/4 total)`, 'hydra');
    if (G.relicRoomsPlaced >= 4 && !G.exitRevealed) {
      G.exitRevealed = true;
      spawnHydra();
    }
  }
}

function spawnHydra() {
  if (G.tracker.pacing.hydraSpawn === 0) G.tracker.pacing.hydraSpawn = G.turn;
  log(`\n  🐉 THE HYDRA AWAKENS! 🐉`, 'defeat');
  const pool = shuffle([...HYDRA_HEADS]);
  G.hydraHeads = pool.slice(0, 3).map(function(h) {
    var baseStr = (G._tweaks && G._tweaks.hydraHeads && G._tweaks.hydraHeads[h.name] !== undefined) ? G._tweaks.hydraHeads[h.name] : h.str;
    return {...h, str: baseStr, destroyed: false, effectiveStr: baseStr};
  });
  G.hydraActive = true;
  recalcHydraStr();
  G.tracker.hydraStartingHeads = G.hydraHeads.map(h => h.name);
  G.hydraHeads.forEach(h => {
    trackHydraHead(h.name, 'spawned');
    log(`    Head: ${h.name} (STR ${h.effectiveStr}) — ${h.skill}`, 'hydra');
  });
  log(`    ${G.hydraHeads.length} heads active. Max: ${G.hydraMaxHeads}.`, 'hydra');
}

function recalcHydraStr() {
  const nestAlive = G.hydraHeads.some(h => h.name === 'The Nest' && !h.destroyed);
  const nestBonus = nestAlive ? 2 : 0;
  G.hydraHeads.forEach(h => {
    h.effectiveStr = Math.max(1, h.str + (h.name !== 'The Nest' ? nestBonus : 0));
  });
}

// ========== HYDRA COMBAT ==========
function hydraAttack(hero) {
  const aliveHeads = G.hydraHeads.filter(h => !h.destroyed);
  if (aliveHeads.length === 0) {
    log(`  🎉 All heads destroyed — VICTORY!`, 'victory');
    G.victory = true;
    G.gameOver = true;
    return;
  }

  // Pick up dropped equipment from the Hydra floor
  const maxSlots = hero.followers.find(f => f.effect === 'inventory_+1') ? 3 : 2;
  while (G.hydraFloorEquipment.length > 0 && hero.equipment.length < maxSlots) {
    // Pick best item available (highest STR)
    G.hydraFloorEquipment.sort((a,b) => (b.str||0) - (a.str||0));
    const item = G.hydraFloorEquipment.shift();
    // Skip Parasite Sword if hero doesn't want it (blocks talent)
    if (item.effect === 'cannot_remove_blocks_talent' && hero.equipment.length > 0) {
      G.hydraFloorEquipment.push(item); // put it back
      break;
    }
    hero.equipment.push(item);
    log(`  📦 ${hero.name} picks up ${item.name} from the Hydra floor!`, 'legendary');
  }

  const targetIdx = aiChooseHydraHead(G.hydraHeads);
  const head = G.hydraHeads[targetIdx];
  log(`  ${hero.name} attacks ${head.name} (STR ${head.effectiveStr})`, 'hydra');

  const broodAlive = G.hydraHeads.some(h => h.name === 'The Brood' && !h.destroyed);

  // Spell Mirror for Hydra head abilities
  let hydraSpellMirrored = false;
  const hydraHeadEffectMap = {'The Fangs':'exhaust_2_or_minus2','The Maw':'exhaust_2_or_minus2','The Brood':'flame_counts_0'};
  if (hydraHeadEffectMap[head.name] && trySpellMirror(hydraHeadEffectMap[head.name], true)) {
    hydraSpellMirrored = true;
  }

  // On Attack effects
  if (!hydraSpellMirrored && head.skillType === 'onAttack') {
    if (head.name === 'The Fangs') {
      G.heroes.forEach(h => { if (G.heroesInHydraArea.has(h.id)) exhaustOneSkill(h, "The Fangs on-attack"); });
      log(`    The Fangs: all heroes exhaust 1 Skill!`, 'misfortune');
    }
    if (head.name === 'The Maw') {
      const removable = hero.equipment.filter(e => e.effect !== 'cannot_remove_blocks_talent');
      if (removable.length > 0) {
        const removed = removable[removable.length - 1];
        hero.equipment = hero.equipment.filter(e => e !== removed);
        log(`    The Maw devours ${removed.name}!`, 'misfortune');
      } else {
        log(`    The Maw: no equipment — hero gets -2!`, 'misfortune');
      }
    }
  }

  // Hero roll
  let heroRoll;
  const hasTripleAxe = hero.equipment.find(e => e.effect === 'roll_3_keep_best');
  const hasVeteran = hero.followers.find(f => f.effect === 'roll_2_keep_best');

  if (hasTripleAxe) {
    const r1 = heroRollDie(hero), r2 = heroRollDie(hero), r3 = heroRollDie(hero);
    heroRoll = [r1, r2, r3].sort((a, b) => b.val - a.val)[0];
    log(`    Triple Axe: [${r1.val}, ${r2.val}, ${r3.val}] keeps ${heroRoll.val}`, 'legendary');
  } else if (hasVeteran) {
    const r1 = heroRollDie(hero), r2 = heroRollDie(hero);
    heroRoll = r1.val >= r2.val ? r1 : r2;
    log(`    Veteran: [${r1.val}, ${r2.val}] keeps ${heroRoll.val}`, 'legendary');
  } else {
    heroRoll = heroRollDie(hero);
  }

  if (checkAssassin(hero, heroRoll)) {
    applyKO(hero);
    if (G.gameOver) return;
    growHydraHead('assassin_ko');
    return;
  }

  let isFlame = (heroRoll.isFlame || hero.giftedFlame) && (!broodAlive || hydraSpellMirrored);
  hero.giftedFlame = false;

  if (isFlame && !hero.talentUsedThisTurn && !hasStalker(hero, 'no_flame_effect')) {
    triggerTalent(hero, 'combat');
  }

  let combatBonus = 0;
  if (hero.id === 'juju' && isFlame && hero.talentUsedThisTurn) combatBonus += 2;
  if (hero.id === 'eggo' && isFlame) hero.dodgeActive = true;

  // Doomhammer at Hydra
  let doomhammerBonus = 0;
  if (hero.equipment.find(e => e.effect === 'roll_gamble')) {
    const doomRoll = Math.floor(Math.random() * 6) + 1;
    if (doomRoll <= 2) {
      log(`    Doomhammer curse! Rolled ${doomRoll} — KO!`, 'ko');
      applyKO(hero);
      if (G.gameOver) return;
      growHydraHead('doomhammer_ko');
      return;
    } else if (doomRoll <= 4) { doomhammerBonus = 1; }
    else { doomhammerBonus = 3; }
    log(`    Doomhammer: rolled ${doomRoll} — STR +${doomhammerBonus}`, 'legendary');
  }

  // Firebane at Hydra
  let firebaneBonus = 0;
  if (hero.equipment.find(e => e.effect === 'exhaust_skill_+1') && readySkillCount(hero) > 1) {
    exhaustOneSkill(hero, "Skill Burn (reroll)");
    firebaneBonus = 1;
    log(`    Firebane: +1 STR`, 'legendary');
  }

  // Siphon Blade at Hydra (per-combat only, head returns to full after)
  let siphonBonus = 0;
  let siphonDrain = 0;
  if (hero.equipment.find(e => e.effect === 'drain_1')) {
    siphonBonus = 1;
    siphonDrain = 1;
    log(`    Siphon Blade: drain 1 from head`, 'legendary');
  }

  // Maw penalty
  const mawPenalty = (head.name === 'The Maw' && hero.equipment.filter(e => e.effect !== 'cannot_remove_blocks_talent').length === 0) ? -2 : 0;

  // === COORDINATED COMBAT SKILLS AT HYDRA ===
  // Strategic AI: coordinate support skills from ALL heroes before the attack
  let skillBonus = 0;
  let siphonSkillDrain = 0;
  const hydraSkillCtx = { atHydra: true, headStr: head.effectiveStr };
  const luluForSiphon = G.heroes.find(h => h.id === 'lulu');

  // 1. Lulu Siphon — -2 to head (highest priority support skill)
  if (luluForSiphon && shouldUseSkill(luluForSiphon, 'Siphon', hydraSkillCtx)) {
    useSkill(luluForSiphon, 'Siphon');
    siphonSkillDrain += 2;
    trackSkill('lulu', 'Siphon', 'activated');
    const who = hero.id === 'lulu' ? '' : ` (helping ${hero.name})`;
    log(`    🔮 Siphon! Lulu${who} weakens head by 2 STR`, 'flame');
  }

  // 2. Eggo Copycat — copy Siphon for additional -2 (coordinated with step 1)
  if (hero.id === 'eggo' && shouldUseSkill(hero, 'Copycat', hydraSkillCtx)) {
    if (luluForSiphon && isSkillReady(luluForSiphon, 'Siphon')) {
      useSkill(hero, 'Copycat');
      siphonSkillDrain += 2;
      trackSkill(hero.id, 'Copycat', 'activated');
      G.tracker.copycatDetails.push({ copiedSkill: 'Siphon', won: null, context: 'hydra' });
      log(`    🎭 Copycat copies Siphon! Head -2 STR (total drain: -${siphonSkillDrain})`, 'flame');
    }
  }
  // Non-attacking Eggo can also Copycat Siphon to support
  if (hero.id !== 'eggo') {
    const eggo = G.heroes.find(h => h.id === 'eggo');
    if (eggo && G.heroesInHydraArea.has('eggo') && shouldUseSkill(eggo, 'Copycat', hydraSkillCtx)) {
      if (luluForSiphon && isSkillReady(luluForSiphon, 'Siphon')) {
        useSkill(eggo, 'Copycat');
        siphonSkillDrain += 2;
        trackSkill('eggo', 'Copycat', 'activated');
        G.tracker.copycatDetails.push({ copiedSkill: 'Siphon', won: null, context: 'hydra' });
        log(`    🎭 Copycat: Eggo copies Siphon to help ${hero.name}! Head -2 STR (total drain: -${siphonSkillDrain})`, 'flame');
      }
    }
  }

  // 3. Pack Leader (Gigi) — +1 per follower
  if (hero.id === 'gigi' && shouldUseSkill(hero, 'Pack Leader', hydraSkillCtx)) {
    useSkill(hero, 'Pack Leader');
    skillBonus += hero.followers.length;
    trackSkill(hero.id, 'Pack Leader', 'activated');
    log(`    🐺 Pack Leader! +${hero.followers.length} STR (${hero.followers.length} followers)`, 'flame');
  }

  // 4. Overload (Lulu) — exhaust all remaining skills, +2 per each
  if (hero.id === 'lulu' && isSkillReady(hero, 'Overload')) {
    const readyCount = hero.skillStates.filter(s => s === 'ready').length;
    if (readyCount >= 2) { // at least 1 other to sacrifice
      useSkill(hero, 'Overload');
      const othersToExhaust = hero.skillStates.filter(s => s === 'ready').length;
      for (let oi = 0; oi < othersToExhaust; oi++) {
        exhaustOneSkill(hero, 'Overload sacrifice');
      }
      skillBonus += othersToExhaust * 2;
      trackSkill(hero.id, 'Overload', 'activated');
      log(`    ⚡ Overload! Exhausted ${othersToExhaust} skills for +${othersToExhaust * 2} STR!`, 'flame');
    }
  }

  // 5. Cheap Shot (Eggo) — roll extra die, keep best
  let cheapShotUsed = false;
  if (hero.id === 'eggo' && !hasTripleAxe && shouldUseSkill(hero, 'Cheap Shot', hydraSkillCtx)) {
    useSkill(hero, 'Cheap Shot');
    const extraRoll = heroRollDie(hero);
    if (extraRoll.val > heroRoll.val) {
      heroRoll = extraRoll;
      isFlame = (extraRoll.isFlame) && (!broodAlive || hydraSpellMirrored);
    }
    cheapShotUsed = true;
    trackSkill(hero.id, 'Cheap Shot', 'activated');
    log(`    🎯 Cheap Shot! Extra die, keeping ${heroRoll.val}`, 'flame');
  }

  // 6. Battlecry (Juju) — roll 2 keep worst, if win all heroes recharge 2
  let rallyingBlowActive = false;
  if (hero.id === 'juju' && shouldUseSkill(hero, 'Battlecry', { atHydra: true, headStr: head.effectiveStr - siphonDrain - siphonSkillDrain })) {
    useSkill(hero, 'Battlecry');
    const r2 = heroRollDie(hero);
    if (r2.val < heroRoll.val) {
      heroRoll = r2;
      isFlame = (r2.isFlame) && (!broodAlive || hydraSpellMirrored);
    }
    rallyingBlowActive = true;
    trackSkill(hero.id, 'Battlecry', 'activated');
    log(`    ⚔ Battlecry! Keeping worst die: ${heroRoll.val}`, 'flame');
  }

  // Second Nature (Gigi): +3 STR if no equipment
  let secondNatureBonus = 0;
  if (hero.id === 'gigi' && hero.equipment.length === 0 && shouldUseSkill(hero, 'Second Nature', { atHydra: true })) {
    useSkill(hero, 'Second Nature');
    secondNatureBonus = 3;
    trackSkill(hero.id, 'Second Nature', 'activated');
    log(`    🌿 Second Nature! Gigi fights with +3 STR (no equipment)`, 'flame');
  }

  let heroTotal = heroRoll.val + totalStr(hero) + combatBonus + doomhammerBonus + firebaneBonus + siphonBonus + mawPenalty + skillBonus + secondNatureBonus;
  const effectiveHeadStr = head.effectiveStr - siphonDrain - siphonSkillDrain;

  log(`    ${hero.name} rolls ${heroRoll.val}${isFlame ? ' 🔥' : ''} + STR ${totalStr(hero)} + bonuses = ${heroTotal} vs ${effectiveHeadStr}`, 'combat');

  // Track this attack for the Hydra Combat Report
  const attackLog = { hero: hero.name, heroId: hero.id, head: head.name, headStr: effectiveHeadStr, headBaseStr: head.effectiveStr, heroTotal, roll: heroRoll.val, heroStr: totalStr(hero), isFlame, turn: G.turn, aliveHeads: G.hydraHeads.filter(h=>!h.destroyed).length, maxHeads: G.hydraMaxHeads };

  // Skill Burn at Hydra: reroll YOUR die only (Hydra heads don't roll dice)
  if (heroTotal < effectiveHeadStr && readySkillCount(hero) > 0) {
    const rerollH = heroRollDie(hero);
    const newFlameA = (rerollH.isFlame) && !broodAlive;
    const newBonusA = (hero.id === 'juju' && newFlameA && !hero.talentUsedThisTurn) ? 2 : combatBonus;
    const totalA = rerollH.val + totalStr(hero) + newBonusA + doomhammerBonus + firebaneBonus + siphonBonus + mawPenalty;
    if (totalA > heroTotal) {
      exhaustOneSkill(hero, "Skill Burn (reroll)");
      G.stats.skillBurns++;
      heroTotal = totalA;
      isFlame = newFlameA;
      if (hero.id === 'eggo' && newFlameA) hero.dodgeActive = true;
      if (hero.id === 'eggo' && !newFlameA) hero.dodgeActive = false;
      log(`    ⟲ Skill Burn! Rerolled: ${rerollH.val}${newFlameA ? ' 🔥' : ''} = ${heroTotal} vs ${effectiveHeadStr}`, 'flame');
    }
  }

  // Record attack result
  attackLog.finalHeroTotal = heroTotal;
  attackLog.won = heroTotal >= effectiveHeadStr;
  attackLog.margin = heroTotal - effectiveHeadStr;
  G.tracker.hydraCombatLog.push(attackLog);

  if (heroTotal >= effectiveHeadStr) {
    head.destroyed = true;
    G.hydraDestroyedCount++;
    G.hydraMaxHeads--;  // Hydra permanently loses a head slot
    trackHydraHead(head.name, 'destroyed');
    G.tracker.hydraHeadKillOrder.push({ head: head.name, turn: G.turn, killedBy: hero.id });
    initHeroTracker(G.tracker, hero.id).hydraHeadsDestroyed++;
    log(`  ⚔ ${head.name} DESTROYED! (${G.hydraHeads.filter(h=>!h.destroyed).length} heads remain, max ${G.hydraMaxHeads})`, 'victory');

    // On Defeat effects
    if (head.skillType === 'onDefeat') {
      if (head.name === 'The Wail') {
        G.heroes.forEach(h => { if (G.heroesInHydraArea.has(h.id)) exhaustOneSkill(h, "The Wail on-defeat"); });
        log(`    The Wail's death cry! All heroes exhaust 1 Skill`, 'misfortune');
      }
      if (head.growOnDefeat) {
        // Spite: grow head but NEVER cause overflow, and never revive itself
        const aliveCount = G.hydraHeads.filter(h => !h.destroyed).length;
        if (aliveCount < G.hydraMaxHeads) {
          const usedNames = new Set(G.hydraHeads.map(h => h.name));
          const poolAvailable = HYDRA_HEADS.filter(h => !usedNames.has(h.name));
          if (poolAvailable.length > 0) {
            // Add from unused pool
            growHydraHead('spite_on_defeat');
            log(`    The Spite: grows 1 extra head from pool!`, 'misfortune');
          } else {
            // Revive a destroyed head (but NOT Spite itself)
            const revivable = G.hydraHeads.filter(h => h.destroyed && h.name !== head.name);
            if (revivable.length > 0) {
              const picked = revivable[Math.floor(Math.random() * revivable.length)];
              picked.destroyed = false;
              trackHydraHead(picked.name, 'spawned');
              recalcHydraStr();
              G.tracker.hydraGrowthLog.push({ head: picked.name, turn: G.turn, source: 'spite_on_defeat' });
              log(`    The Spite: ${picked.name} regenerates!`, 'misfortune');
            } else {
              log(`    The Spite: no heads to grow or revive — no effect.`, 'system');
            }
          }
        } else {
          log(`    The Spite: at max heads — no growth (Spite cannot cause overflow).`, 'system');
        }
      }
    }
    recalcHydraStr();

    // Mystic Wand on Hydra win
    if (hero.equipment.find(e => e.effect === 'win_recharge_all')) {
      const exhaustedCount = hero.skillStates.filter(s => s === 'exhausted').length;
      hero.skillStates = hero.skillStates.map(() => 'ready');
      if (G && G.tracker && exhaustedCount > 0) {
        if (!G.tracker.skillRechargeSources['mystic_wand']) G.tracker.skillRechargeSources['mystic_wand'] = 0;
        G.tracker.skillRechargeSources['mystic_wand'] += exhaustedCount;
      }
      log(`    Mystic Wand: all skills recharged!`, 'wonder');
    }

    // Supernova Gun at Hydra
    if (hero.equipment.find(e => e.effect === 'win_roll_6_clear')) {
      const r = Math.floor(Math.random() * 6) + 1;
      if (r === 6) {
        G.enemiesOnBoard = [];
        log(`    💥 Supernova Gun! Rolled 6 — all dungeon enemies cleared!`, 'legendary');
      }
    }

    if (G.hydraHeads.every(h => h.destroyed)) {
      log(`\n  🎉🎉🎉 THE HYDRA IS SLAIN! VICTORY! 🎉🎉🎉`, 'victory');
      G.victory = true;
      G.gameOver = true;
    }
  } else {
    log(`  ✗ Attack fails! ${heroTotal} < ${effectiveHeadStr}`, 'ko');

    // Dodge
    if (hero.dodgeActive) {
      log(`    🔥 DODGE! ${hero.name} avoids consequences!`, 'flame');
      return;
    }

    // Berserker Helmet retry at Hydra
    if (hero.equipment.find(e => e.effect === 'retry_on_loss') && !hero._berserkerUsed) {
      hero._berserkerUsed = true;
      log(`    ⚔ Berserker Helmet retry!`, 'legendary');
      const retry = heroRollDie(hero);
      const retryTotal = retry.val + totalStr(hero) + combatBonus + doomhammerBonus + firebaneBonus + siphonBonus + mawPenalty;
      log(`    Retry: ${retryTotal} vs ${effectiveHeadStr}`, 'combat');
      if (retryTotal >= effectiveHeadStr) {
        head.destroyed = true;
        G.hydraDestroyedCount++;
        G.hydraMaxHeads--;
        trackHydraHead(head.name, 'destroyed');
        G.tracker.hydraHeadKillOrder.push({ head: head.name, turn: G.turn, killedBy: hero.id });
        initHeroTracker(G.tracker, hero.id).hydraHeadsDestroyed++;
        recalcHydraStr();
        log(`    Berserker Helmet wins! ${head.name} DESTROYED!`, 'victory');
        hero._berserkerUsed = false;
        if (G.hydraHeads.every(h => h.destroyed)) {
          log(`\n  🎉🎉🎉 THE HYDRA IS SLAIN! VICTORY! 🎉🎉🎉`, 'victory');
          G.victory = true;
          G.gameOver = true;
        }
        return;
      }
      hero._berserkerUsed = false;
    }

    // === KO PREVENTION SKILLS AT HYDRA ===
    // At Hydra, always prevent KO (costs a relic otherwise)
    let hydraKOPrevented = false;

    // Shield Wall (Juju) — can save ANY hero at Hydra
    const jujuShieldHydra = G.heroes.find(h => h.id === 'juju');
    if (!hydraKOPrevented && jujuShieldHydra && isSkillReady(jujuShieldHydra, 'Shield Wall')) {
      useSkill(jujuShieldHydra, 'Shield Wall');
      trackSkill('juju', 'Shield Wall', 'activated');
      trackSkill('juju', 'Shield Wall', 'savedFromKO');
      const who = hero.id === 'juju' ? '' : ` (saving ${hero.name})`;
      log(`    🛡 Shield Wall! Juju${who} prevents KO at Hydra!`, 'flame');
      hydraKOPrevented = true;
    }
    // Copycat (Eggo) — copy Shield Wall
    if (!hydraKOPrevented && hero.id === 'eggo' && shouldUseSkill(hero, 'Copycat', { atHydra: true, preventKO: true })) {
      const jujuH = G.heroes.find(h => h.id === 'juju');
      const gigiH = G.heroes.find(h => h.id === 'gigi');
      if (jujuH && isSkillReady(jujuH, 'Shield Wall')) {
        useSkill(hero, 'Copycat');
        trackSkill(hero.id, 'Copycat', 'activated');
        trackSkill(hero.id, 'Copycat', 'savedFromKO');
        G.tracker.copycatDetails.push({ copiedSkill: 'Shield Wall', won: null, context: 'hydra' });
        log(`    🎭 Copycat: copies Shield Wall! KO prevented!`, 'flame');
        hydraKOPrevented = true;
      }
    }

    if (hydraKOPrevented) {
      // Skill saved the hero — head still grows but hero stays
      growHydraHead('failed_attack');
      if (G.gameOver) return;
    } else {
      log(`    ${hero.name} is KO'd at the Hydra!`, 'ko');
      trackHydraHead(head.name, 'causedKO');
      applyKO(hero);
      if (G.gameOver) return;
      growHydraHead('hero_ko');
    }
  }

  // Battlecry bonus: if Juju won with it, all heroes recharge 2
  if (rallyingBlowActive && heroTotal >= effectiveHeadStr) {
    G.heroes.forEach(h => { rechargeOneSkill(h, 'battlecry'); rechargeOneSkill(h, 'battlecry'); });
    log(`    ⚔ Battlecry victory! All heroes recharge 2 Skills`, 'wonder');
  }

  // === TAUNT (Juju): extra Hydra attack ===
  if (hero.id === 'juju' && !G.gameOver && !hero.ko && G.heroesInHydraArea.has(hero.id) && shouldUseSkill(hero, 'Taunt', { atHydra: true })) {
    useSkill(hero, 'Taunt');
    trackSkill(hero.id, 'Taunt', 'activated');
    log(`  🗡 Taunt: ${hero.name} makes an additional Hydra attack!`, 'flame');
    hydraAttack(hero);
  }

  // === SHADOWSTEP (Eggo): extra turn at Hydra ===
  if (hero.id === 'eggo' && !G.gameOver && !hero.ko && G.heroesInHydraArea.has(hero.id) && shouldUseSkill(hero, 'Shadowstep', { atHydra: true })) {
    useSkill(hero, 'Shadowstep');
    trackSkill(hero.id, 'Shadowstep', 'activated');
    log(`  👤 Shadowstep: ${hero.name} takes another turn at the Hydra!`, 'flame');
    hero.talentUsedThisTurn = false;
    hero.dodgeActive = false;
    hydraAttack(hero);
  }
}

function growHydraHead(source) {
  const aliveCount = G.hydraHeads.filter(h => !h.destroyed).length;
  const overflowEnabled = !G._tweaks || G._tweaks.overflowGameOver !== false;
  if (aliveCount >= G.hydraMaxHeads) {
    if (overflowEnabled) {
      log(`  💀 OVERFLOW! Hydra exceeds max heads (${aliveCount}/${G.hydraMaxHeads}) — GAME OVER!`, 'defeat');
      G.gameOver = true;
      G.tracker.deathMoments.push({ hero: 'party', context: `Hydra overflow: ${aliveCount} heads alive, max was ${G.hydraMaxHeads}`, turn: G.turn });
    } else {
      log(`  ⚠ Hydra at max heads (${aliveCount}/${G.hydraMaxHeads}) — no new head grows (overflow disabled)`, 'system');
    }
    return;
  }
  const usedNames = new Set(G.hydraHeads.map(h => h.name));
  const available = HYDRA_HEADS.filter(h => !usedNames.has(h.name));
  if (available.length > 0) {
    var picked = available[Math.floor(Math.random() * available.length)];
    var headBaseStr = (G._tweaks && G._tweaks.hydraHeads && G._tweaks.hydraHeads[picked.name] !== undefined) ? G._tweaks.hydraHeads[picked.name] : picked.str;
    const newHead = {...picked, str: headBaseStr, destroyed: false};
    G.hydraHeads.push(newHead);
    trackHydraHead(newHead.name, 'spawned');
    recalcHydraStr();
    G.tracker.hydraGrowthLog.push({ head: newHead.name, turn: G.turn, source: source || 'unknown' });
    log(`    New head grows: ${newHead.name} (STR ${newHead.effectiveStr})`, 'misfortune');
  } else {
    const dead = G.hydraHeads.find(h => h.destroyed);
    if (dead) {
      dead.destroyed = false;
      trackHydraHead(dead.name, 'spawned');  // count regeneration as a spawn
      recalcHydraStr();
      G.tracker.hydraGrowthLog.push({ head: dead.name, turn: G.turn, source: source || 'unknown' });
      log(`    ${dead.name} regenerates!`, 'misfortune');
    }
  }
}

function runToHydra(hero) {
  if (hero.pos === 'hydra') return;

  // Roll die for movement
  const roll = heroRollDie(hero);
  if (checkAssassin(hero, roll)) return;
  const moveVal = roll.val;

  // Spend Gil at entrance before leaving
  if (isAtEntrance(hero)) {
    gilSpendAtEntrance(hero);
  }

  log(`  ${hero.name} sprints toward the Hydra (rolled ${moveVal})`, 'system');

  function arriveAtHydra() {
    hero.runningToHydra = false;
    hero.pos = 'hydra';
    G.heroesInHydraArea.add(hero.id);
    if (G.tracker.pacing.hydraArrival === 0) G.tracker.pacing.hydraArrival = G.turn;
    // Track arrival state
    if (!G.tracker.hydraArrivals) G.tracker.hydraArrivals = [];
    G.tracker.hydraArrivals.push({
      hero: hero.name, heroId: hero.id, turn: G.turn,
      readySkills: readySkillCount(hero),
      totalSkills: hero.skills.length,
      skillNames: hero.skills.map((s,i) => ({ name:s.name, ready:hero.skillStates[i]==='ready' })),
      totalStr: totalStr(hero),
      equipment: hero.equipment.map(e => e.name),
      followers: hero.followers.map(f => f.name),
      relics: hero.heldRelics.map(r => r.name),
      partyRelics: partyRelicTotal()
    });
    log(`  🐉 ${hero.name} enters the Hydra's lair! (STR ${totalStr(hero)}, ${readySkillCount(hero)}/${hero.skills.length} skills, ${partyRelicTotal()} relics)`, 'hydra');
  }

  if (G.exitHex && G.hexMap) {
    // Spatial pathfinding to exit
    const path = G.hexMap.findPath(hero.pos.q, hero.pos.r, G.exitHex.q, G.exitHex.r);
    if (path && path.length > 1) {
      let currentQ = hero.pos.q;
      let currentR = hero.pos.r;
      const stepsAvailable = Math.min(moveVal, path.length - 1);

      for (let i = 0; i < stepsAvailable; i++) {
        currentQ = path[i + 1].q;
        currentR = path[i + 1].r;
      }
      hero.pos = { q: currentQ, r: currentR };

      // Check if reached exit
      if (currentQ === G.exitHex.q && currentR === G.exitHex.r) {
        arriveAtHydra();
        return;
      }

      const remaining = hexDistance(currentQ, currentR, G.exitHex.q, G.exitHex.r);
      log(`  ${hero.name} runs toward the Hydra... ${remaining} hexes remaining`, 'system');
    } else {
      // No path found - fallback: probability based (old behavior)
      log(`  ${hero.name} searches for the path to the Hydra...`, 'system');
      const chance = 0.4 + moveVal * 0.1;
      if (Math.random() < chance) {
        arriveAtHydra();
      }
    }
  } else {
    // Fallback: old probability-based method
    const chance = 0.4 + moveVal * 0.1;
    if (Math.random() < chance) {
      arriveAtHydra();
    } else {
      log(`  ${hero.name} is still running...`, 'system');
    }
  }
}

function monsterMovementPhase() {
  if (G.tilesPlaced < 10) return;
}

// ========== TURN MANAGEMENT ==========
function nextHero() {
  G.currentHero = (G.currentHero + 1) % 4;
  if (G.currentHero === 0) {
    G.round++;
    monsterMovementPhase();
    if (G.hydraActive) {
      const anyoneAtHydra = G.heroes.some(h => G.heroesInHydraArea.has(h.id));
      if (!anyoneAtHydra && G.exitRevealed) {
        log(`  🐉 Hydra Area empty! Head grows!`, 'misfortune');
        growHydraHead('hydra_area_empty');
      }
      G.heroes.forEach(h => {
        if (!G.heroesInHydraArea.has(h.id) && !h.runningToHydra) {
          if (G.relicsCollected >= 4) {
            const prepare = G._tweaks && G._tweaks.prepareFirst;
            if (prepare) {
              // Wait until hero is equipped: 2 equipment AND (has follower OR is not Gigi)
              const hasEnoughEquip = h.equipment.length >= 2;
              const hasFollower = h.followers.length >= 1;
              const isReady = hasEnoughEquip && (hasFollower || h.id !== 'gigi');
              // But don't wait forever — go after 10 extra turns of waiting
              const waitingTooLong = G.turn > 40;
              if (isReady || waitingTooLong) {
                h.runningToHydra = true;
                log(`  ${h.name} is prepared (STR ${totalStr(h)}, ${h.equipment.length} equip, ${h.followers.length} followers) — running to the Hydra!`, 'hydra');
              } else {
                log(`  ${h.name} stays in dungeon to prepare (${h.equipment.length}/2 equip, ${h.followers.length} followers)`, 'system');
              }
            } else {
              h.runningToHydra = true;
              log(`  ${h.name} begins running to the Hydra!`, 'hydra');
            }
          }
        }
      });
    }
  }
}


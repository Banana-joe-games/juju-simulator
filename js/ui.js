// ========== UI RENDERING ==========
function renderHeroes() {
  const panel = document.getElementById('heroPanel');
  panel.innerHTML = `<div class="section-title">Heroes</div>`;
  G.heroes.forEach((h, i) => {
    const isActive = i === G.currentHero && !G.gameOver;
    const skills = h.skills.map((s, si) =>
      `<span class="skill-tag ${h.skillStates[si]}">${s.name}</span>`
    ).join('');
    const equip = h.equipment.map(e =>
      `<span class="equip-tag">${e.name} ${e.str >= 0 ? '+' : ''}${e.str}</span>`
    ).join('') || '<span style="color:var(--dim);font-size:10px">empty</span>';
    const followers = h.followers.map(f =>
      `<span style="font-size:10px;color:var(--wonder)">${f.name}</span>`
    ).join(', ');
    const stalkers = h.stalkers.map(s =>
      `<span style="font-size:10px;color:var(--ko)">${s.name}</span>`
    ).join(', ');
    const relics = h.heldRelics.map(r => {
      const matched = r.owner === h.id;
      return `<span class="relic-tag" style="${matched ? 'background:#1a2a3a;color:#55aaff;border-color:#2a4a6a' : ''}">${r.name}${matched ? ' ★+2' : ' +1'}</span>`;
    }).join('') || '<span style="color:var(--dim);font-size:10px">none</span>';
    panel.innerHTML += `
      <div class="hero-card ${isActive ? 'active' : ''}" style="border-left: 3px solid ${h.color}">
        <div class="name" style="color:${h.color}">${h.name} ${h.title}</div>
        <div class="stat">STR <b>${totalStr(h)}</b> (base ${h.str}) · 🔥 ${h.flameFaces.join(',')}</div>
        <div class="stat">Talent: <b>${h.talent}</b></div>
        <div class="stat">${h.dodgeActive ? '🛡Dodge ' : ''}${h.runningToHydra ? '🏃Running' : ''}${gilEnabled() ? ' 💰 ' + h.gil + ' Gil' : ''}</div>
        <div style="margin-top:3px">Relics: ${relics}</div>
        <div style="margin-top:4px">${skills}</div>
        <div style="margin-top:3px">Equip: ${equip}</div>
        ${followers ? `<div style="margin-top:2px">👥 ${followers}</div>` : ''}
        ${stalkers ? `<div style="margin-top:2px">👁 ${stalkers}</div>` : ''}
      </div>`;
  });
}

function renderHexMap() {
  if (!G || !G.hexMap) return '';
  const size = 16;
  const sqrt3 = Math.sqrt(3);
  const explored = G.hexMap.allExplored();
  if (explored.length === 0) return '';

  // Flat-top hex: x = size * 3/2 * q, y = size * (sqrt3/2 * q + sqrt3 * r)
  function hexToPixel(q, r) {
    return { x: size * 1.5 * q, y: size * (sqrt3 * 0.5 * q + sqrt3 * r) };
  }

  // Flat-top hex corner points
  function hexPoints(cx, cy) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 180 * (60 * i);
      pts.push(`${(cx + size * Math.cos(angle)).toFixed(1)},${(cy + size * Math.sin(angle)).toFixed(1)}`);
    }
    return pts.join(' ');
  }

  const tileColors = {
    entrance: '#d4a843',
    wonder: '#1a4a2a',
    common: '#1e1e2e',
    dread: '#4a1520'
  };
  const tileBorders = {
    entrance: '#d4a843',
    wonder: '#2d8a4e',
    common: '#2a2a3a',
    dread: '#b02030'
  };
  const heroColors = { juju:'#cc4444', gigi:'#44aa44', lulu:'#6644cc', eggo:'#cc8833' };
  const heroInitials = { juju:'J', gigi:'G', lulu:'L', eggo:'E' };

  // Compute pixel bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const frontier = new Set();
  explored.forEach(tile => {
    const p = hexToPixel(tile.q, tile.r);
    minX = Math.min(minX, p.x - size); maxX = Math.max(maxX, p.x + size);
    minY = Math.min(minY, p.y - size); maxY = Math.max(maxY, p.y + size);
    // Collect frontier hexes
    hexNeighborCoords(tile.q, tile.r).forEach(n => {
      if (!G.hexMap.has(n.q, n.r) && G.hexMap.isInBounds(n.q, n.r)) {
        frontier.add(hexKey(n.q, n.r) + '|' + n.q + '|' + n.r);
      }
    });
  });

  // Add frontier to bounds
  frontier.forEach(f => {
    const [, q, r] = f.split('|');
    const p = hexToPixel(parseInt(q), parseInt(r));
    minX = Math.min(minX, p.x - size); maxX = Math.max(maxX, p.x + size);
    minY = Math.min(minY, p.y - size); maxY = Math.max(maxY, p.y + size);
  });

  const pad = 4;
  const vw = maxX - minX + pad * 2;
  const vh = maxY - minY + pad * 2;
  const ox = -minX + pad;
  const oy = -minY + pad;

  let svg = `<svg viewBox="0 0 ${vw.toFixed(0)} ${vh.toFixed(0)}" style="width:100%;height:auto;display:block;margin-bottom:8px" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="100%" height="100%" fill="#08080e" rx="4"/>`;

  // Draw frontier hexes (unexplored neighbors)
  frontier.forEach(f => {
    const [, qs, rs] = f.split('|');
    const q = parseInt(qs), r = parseInt(rs);
    const p = hexToPixel(q, r);
    svg += `<polygon points="${hexPoints(p.x + ox, p.y + oy)}" fill="none" stroke="#1a1a2a" stroke-width="0.5" stroke-dasharray="2,2"/>`;
  });

  // Draw explored tiles
  explored.forEach(tile => {
    const p = hexToPixel(tile.q, tile.r);
    const cx = p.x + ox, cy = p.y + oy;
    const fill = tileColors[tile.type] || tileColors.common;
    const stroke = tileBorders[tile.type] || tileBorders.common;
    svg += `<polygon points="${hexPoints(cx, cy)}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;

    // Tile type initial
    if (tile.type !== 'entrance') {
      const label = tile.type === 'wonder' ? 'W' : tile.type === 'dread' ? 'D' : '';
      if (label) {
        svg += `<text x="${cx}" y="${cy + 3}" text-anchor="middle" fill="${stroke}" font-size="7" font-family="monospace" opacity="0.5">${label}</text>`;
      }
    } else {
      svg += `<text x="${cx}" y="${cy + 3}" text-anchor="middle" fill="${tileColors.entrance}" font-size="7" font-family="monospace" font-weight="bold">E</text>`;
    }

    // Enemies on tile
    if (tile.enemies && tile.enemies.length > 0) {
      svg += `<circle cx="${cx + size * 0.5}" cy="${cy - size * 0.4}" r="2.5" fill="#b02030" opacity="0.8"/>`;
    }
  });

  // Draw exit hex highlight
  if (G.exitHex) {
    const ep = hexToPixel(G.exitHex.q, G.exitHex.r);
    svg += `<polygon points="${hexPoints(ep.x + ox, ep.y + oy)}" fill="none" stroke="#7b2d8e" stroke-width="2" stroke-dasharray="3,2"/>`;
    svg += `<text x="${ep.x + ox}" y="${ep.y + oy + 3}" text-anchor="middle" fill="#7b2d8e" font-size="8" font-family="monospace" font-weight="bold">⚔</text>`;
  }

  // Draw hero positions
  const heroPositions = {};
  G.heroes.forEach(h => {
    if (h.pos !== 'hydra') {
      const key = hexKey(h.pos.q, h.pos.r);
      if (!heroPositions[key]) heroPositions[key] = [];
      heroPositions[key].push(h);
    }
  });

  Object.entries(heroPositions).forEach(([key, heroes]) => {
    const [q, r] = key.split(',').map(Number);
    const p = hexToPixel(q, r);
    const cx = p.x + ox, cy = p.y + oy;

    heroes.forEach((h, i) => {
      // Offset multiple heroes on same hex
      const angle = heroes.length === 1 ? 0 : (Math.PI * 2 * i / heroes.length) - Math.PI / 2;
      const spread = heroes.length === 1 ? 0 : size * 0.35;
      const hx = cx + Math.cos(angle) * spread;
      const hy = cy + Math.sin(angle) * spread;
      const color = heroColors[h.id];
      const isActive = G.heroes.indexOf(h) === G.currentHero && !G.gameOver;

      // Active hero ring
      if (isActive) {
        svg += `<circle cx="${hx}" cy="${hy}" r="6" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.6">`;
        svg += `<animate attributeName="r" values="5;7;5" dur="1.5s" repeatCount="indefinite"/></circle>`;
      }

      svg += `<circle cx="${hx}" cy="${hy}" r="4.5" fill="${color}" stroke="#000" stroke-width="0.5"/>`;
      svg += `<text x="${hx}" y="${hy + 2.5}" text-anchor="middle" fill="#fff" font-size="5.5" font-family="monospace" font-weight="bold">${heroInitials[h.id]}</text>`;
    });
  });

  svg += `</svg>`;
  return svg;
}

function renderInfo() {
  const panel = document.getElementById('infoPanel');
  let html = renderHexMap();
  html += `<div class="section-title">Game State</div>`;
  html += `
    <div class="info-row"><span class="label">Turn</span><span class="value">${G.turn}</span></div>
    <div class="info-row"><span class="label">Round</span><span class="value">${G.round}</span></div>
    <div class="info-row"><span class="label">Tiles Placed</span><span class="value">${G.tilesPlaced}/36 ${G.tilesPlaced >= 10 ? '🔥 AWAKE' : ''}</span></div>
    <div class="info-row"><span class="label">Relic Rooms</span><span class="value">${G.relicRoomsPlaced}/4 placed · ${G.relicsCollected}/4 collected</span></div>
    <div class="info-row"><span class="label">Exit</span><span class="value">${G.exitPlaced ? (G.exitRevealed ? '🐉 HYDRA' : '🚪 Locked') : 'Not placed'}</span></div>
  `;
  if (G.hydraActive) {
    html += `<div class="section-title" style="margin-top:12px">Hydra</div>`;
    html += `<div class="info-row"><span class="label">Max Heads</span><span class="value">${G.hydraMaxHeads}</span></div>`;
    html += `<div class="hydra-heads">`;
    G.hydraHeads.forEach(h => {
      html += `<div class="head-tag ${h.destroyed ? 'dead' : ''}">${h.name} ${h.effectiveStr}</div>`;
    });
    html += `</div>`;
    html += `<div class="info-row" style="margin-top:6px"><span class="label">Heroes at Hydra</span><span class="value">${[...G.heroesInHydraArea].join(', ') || 'none'}</span></div>`;
  }
  html += `<div class="section-title" style="margin-top:12px">Statistics</div>`;
  const relicDetail = G.heroes.map(h => `${h.name}:${h.heldRelics.length}`).join(' · ');
  const relicTotal = partyRelicTotal();
  html += `
    <div class="info-row"><span class="label">Party Relics</span><span class="value">${relicTotal}/4 (${relicDetail})</span></div>
    <div class="info-row"><span class="label">Total Turns</span><span class="value">${G.stats.turns}</span></div>
    <div class="info-row"><span class="label">Combats</span><span class="value">${G.stats.combats}</span></div>
    <div class="info-row"><span class="label">Monsters Killed</span><span class="value">${G.stats.monstersKilled}</span></div>
    <div class="info-row"><span class="label">KO Events</span><span class="value">${G.stats.ko}</span></div>
    <div class="info-row"><span class="label">Skill Burns</span><span class="value">${G.stats.skillBurns}</span></div>
    <div class="info-row"><span class="label">Relics Spent</span><span class="value">${G.stats.relicsSpent}</span></div>
  `;
  html += `<div class="section-title" style="margin-top:12px">Decks</div>`;
  html += `
    <div class="info-row"><span class="label">Wonders</span><span class="value">${G.wonderDeck.length}/${WONDER_CARDS.length}</span></div>
    <div class="info-row"><span class="label">Mishaps</span><span class="value">${G.mishapDeck.length}/${MISHAP_CARDS.length}</span></div>
    <div class="info-row"><span class="label">Misfortunes</span><span class="value">${G.misfortuneDeck.length}/${MISFORTUNE_CARDS.length}</span></div>
    <div class="info-row"><span class="label">Legendary</span><span class="value">${G.legendaryDeck.length}/${LEGENDARY_EQUIPMENT.length}</span></div>
    <div class="info-row"><span class="label">Tiles</span><span class="value">${G.tileDeck.length}/36</span></div>
  `;
  panel.innerHTML = html;
}

function renderLog() {
  const panel = document.getElementById('logPanel');
  const startIdx = panel.children.length;
  for (let i = startIdx; i < G.log.length; i++) {
    const entry = G.log[i];
    const div = document.createElement('div');
    div.className = `log-entry ${entry.cls}`;
    div.textContent = entry.msg;
    panel.appendChild(div);
  }
  panel.scrollTop = panel.scrollHeight;
}

function render() {
  if (!G) return;
  renderHeroes();
  renderInfo();
  renderLog();
  const status = G.gameOver
    ? (G.victory ? `🎉 VICTORY in ${G.turn} turns!` : `💀 GAME OVER at turn ${G.turn}`)
    : `Turn ${G.turn} · Round ${G.round} · ${G.heroes[G.currentHero].name}'s turn`;
  document.getElementById('statusBar').textContent = status;
  const dlBtn = document.getElementById('downloadLogBtn');
  if (dlBtn) dlBtn.style.display = G.gameOver ? 'inline-block' : 'none';
}

// ========== ANALYSIS ENGINE ==========
function generateReport(results) {
  const n = results.length;
  const wins = results.filter(r => r.victory);
  const losses = results.filter(r => !r.victory);
  const winRate = (wins.length / n * 100).toFixed(1);
  const heroIds = ['juju','gigi','lulu','eggo'];
  const heroNames = {juju:'Juju',gigi:'Gigi',lulu:'Lulu',eggo:'Eggo'};
  const avg = (arr, fn) => arr.length ? (arr.reduce((s,r) => s + fn(r), 0) / arr.length) : 0;
  const pct = (a, b) => b ? (a / b * 100).toFixed(1) : '0.0';
  const fix1 = v => Number(v).toFixed(1);
  const std = (arr, fn) => { const m = avg(arr, fn); return arr.length > 1 ? Math.sqrt(arr.reduce((s,r) => s + Math.pow(fn(r) - m, 2), 0) / (arr.length - 1)) : 0; };

  // Collect all flags for gap analysis
  const allFlags = [];
  function flag(category, severity, msg) { allFlags.push({category, severity, msg}); }

  // Helper: bar chart
  function bar(val, max, color) {
    const w = max > 0 ? Math.min(100, val / max * 100) : 0;
    return `<div style="display:flex;align-items:center;gap:6px"><div style="width:120px;height:8px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:${w.toFixed(0)}%;height:100%;background:${color||'var(--accent)'}"></div></div><span style="font-size:10px">${typeof val==='number'?fix1(val):val}</span></div>`;
  }
  function statRow(label, value) { return `<div class="report-stat"><span class="rl">${label}</span><span class="rv">${value}</span></div>`; }

  let html = '<h2>PLAYTEST REPORT — ' + n + ' GAMES</h2>';

  // Tweaks section
  if (currentTweaks) {
    const tweakDiffs = getTweaksDiff(currentTweaks);
    if (tweakDiffs.length > 0) {
      html += '<div class="report-section"><h3>Tweaks Applied</h3><div class="report-card insight">';
      tweakDiffs.forEach(d => html += `<div style="font-size:11px;padding:1px 0">- ${d}</div>`);
      html += '</div></div>';
    }
  }

  // TAB NAVIGATION
  html += `<div class="report-tabs">
    <div class="report-tab active" onclick="switchReportTab(this,'tab-overview')">Overview</div>
    <div class="report-tab" onclick="switchReportTab(this,'tab-heroes')">Heroes</div>
    <div class="report-tab" onclick="switchReportTab(this,'tab-skills-equip')">Skills & Equip</div>
    <div class="report-tab" onclick="switchReportTab(this,'tab-enemies')">Enemies & Creatures</div>
    <div class="report-tab" onclick="switchReportTab(this,'tab-hydra-econ')">Hydra & Economy</div>
    <div class="report-tab" onclick="switchReportTab(this,'tab-analysis')">📝 Analysis</div>
  </div>`;

  // ===================== SECTION 1: OVERVIEW =====================
  html += `<div class="report-section"><h3>Overview</h3>`;
  const avgTurns = fix1(avg(results, r => r.turn));
  const avgCombats = fix1(avg(results, r => r.stats.combats));
  const avgKO = fix1(avg(results, r => r.stats.ko));
  const avgBurns = fix1(avg(results, r => r.stats.skillBurns));
  const avgRelics = fix1(avg(results, r => r.stats.relicsSpent));
  const avgWinTurn = wins.length ? fix1(avg(wins, r => r.turn)) : '-';
  const avgLossTurn = losses.length ? fix1(avg(losses, r => r.turn)) : '-';

  html += `<div class="report-card">`;
  html += statRow('Total Games', n);
  html += statRow('Win Rate', `${winRate}% (${wins.length}W / ${losses.length}L)`);
  html += statRow('Avg Game Length', `${avgTurns} turns`);
  html += statRow('Avg Combats / Game', avgCombats);
  html += statRow('Avg KOs / Game', avgKO);
  html += statRow('Avg Skill Burns / Game', avgBurns);
  html += statRow('Avg Relics Spent / Game', avgRelics);
  html += statRow('Avg Victory Turn', avgWinTurn);
  html += statRow('Avg Defeat Turn', avgLossTurn);
  html += `</div>`;

  // Defeat breakdown
  if (losses.length > 0) {
    const defeatCauses = {};
    losses.forEach(r => { const c = r.defeatCause ? r.defeatCause.cause : 'unknown'; defeatCauses[c] = (defeatCauses[c]||0) + 1; });
    html += `<div class="report-card"><b>Defeat Causes</b>`;
    Object.entries(defeatCauses).sort((a,b) => b[1]-a[1]).forEach(([cause, count]) => {
      html += statRow(cause.replace(/_/g,' '), `${count} (${pct(count, losses.length)}%)`);
    });
    html += `</div>`;
  }

  if (parseFloat(winRate) < 40) flag('balance', 'high', `Win rate ${winRate}% is very low — game may be too hard`);
  if (parseFloat(winRate) > 85) flag('balance', 'high', `Win rate ${winRate}% is very high — game may be too easy`);
  html += `</div>`;

  // ===================== SECTION 2: HERO PERFORMANCE =====================
  html += `<div class="report-section"><h3>Hero Performance</h3>`;

  heroIds.forEach(id => {
    const name = heroNames[id];
    // 2a: Combat stats
    const combats = results.reduce((s,r) => { const h = r.tracker.heroes[id]; return s + (h ? h.combats : 0); }, 0);
    const heroWins = results.reduce((s,r) => { const h = r.tracker.heroes[id]; return s + (h ? h.wins : 0); }, 0);
    const heroKO = results.reduce((s,r) => { const h = r.tracker.heroes[id]; return s + (h ? h.ko : 0); }, 0);
    const heroRelics = results.reduce((s,r) => { const h = r.tracker.heroes[id]; return s + (h ? h.relicsSpent : 0); }, 0);
    const heroBurns = results.reduce((s,r) => { const h = r.tracker.heroes[id]; return s + (h ? h.skillsBurned : 0); }, 0);
    const heroEnemiesKilled = results.reduce((s,r) => { const h = r.tracker.heroes[id]; return s + (h ? (h.enemiesKilled||0) : 0); }, 0);
    const heroHeadsDestroyed = results.reduce((s,r) => { const h = r.tracker.heroes[id]; return s + (h ? (h.hydraHeadsDestroyed||0) : 0); }, 0);

    html += `<div class="report-card" style="border-left:3px solid var(--${id})"><b style="color:var(--${id})">${name}</b>`;
    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:4px;font-size:11px">`;
    html += statRow('Combats', combats);
    html += statRow('Win Rate', combats ? pct(heroWins, combats) + '%' : '-');
    html += statRow('KOs (total / per game)', `${heroKO} / ${fix1(heroKO/n)}`);
    html += statRow('Relics Spent', `${heroRelics} / ${fix1(heroRelics/n)}`);
    html += statRow('Skill Burns', heroBurns);
    html += statRow('Enemies Killed', heroEnemiesKilled);
    html += statRow('Hydra Heads Destroyed', `${heroHeadsDestroyed} (${fix1(heroHeadsDestroyed/n)}/game)`);
    html += `</div>`;

    // 2c: State at combat distribution
    const heroCombatLogs = [];
    results.forEach(r => r.tracker.combatLog.forEach(c => { if (c.heroId === id) heroCombatLogs.push(c); }));
    if (heroCombatLogs.length > 0) {
      const equipDist = [0,0,0]; // 0,1,2 items
      const skillDist = [0,0,0,0,0]; // 0-4 ready skills
      heroCombatLogs.forEach(c => {
        const eq = Math.min(c.equipCount||0, 2);
        equipDist[eq]++;
        const sk = Math.min(c.readySkills||0, 4);
        skillDist[sk]++;
      });
      const total = heroCombatLogs.length;
      html += `<div style="font-size:10px;margin-top:6px;color:var(--dim)">State at Combat (${total} fights):</div>`;
      html += `<div style="font-size:10px">Equipment: 0 items ${pct(equipDist[0],total)}% | 1 item ${pct(equipDist[1],total)}% | 2 items ${pct(equipDist[2],total)}%</div>`;
      html += `<div style="font-size:10px">Ready Skills: `;
      for (let i=0;i<=4;i++) html += `${i}sk ${pct(skillDist[i],total)}% `;
      html += `</div>`;
      if (equipDist[0] / total > 0.35) flag('equipment', 'medium', `${name} fights with 0 equipment ${pct(equipDist[0],total)}% of the time`);
    }
    html += `</div>`;
  });

  // 2d: State at game end (winners vs losers)
  html += `<div class="report-card"><b>State at Game End: Winners vs Losers</b>`;
  html += `<table style="width:100%;font-size:10px;margin-top:6px;border-collapse:collapse">`;
  html += `<tr style="border-bottom:1px solid var(--border)"><th></th>`;
  heroIds.forEach(id => html += `<th colspan="2" style="color:var(--${id})">${heroNames[id]}</th>`);
  html += `</tr><tr><td></td>`;
  heroIds.forEach(() => html += `<td style="color:var(--heal);font-size:9px">Win</td><td style="color:var(--ko);font-size:9px">Loss</td>`);
  html += `</tr>`;

  const endStateMetrics = ['totalStr','equipCount','followerCount','readySkills','relics','gil'];
  const endStateLabels = ['Total STR','Equipment','Followers','Ready Skills','Relics','Gil'];
  endStateMetrics.forEach((metric, mi) => {
    html += `<tr><td style="color:var(--dim)">${endStateLabels[mi]}</td>`;
    heroIds.forEach(id => {
      const wVals = wins.map(r => r.tracker.heroEndState[id] ? r.tracker.heroEndState[id][metric]||0 : 0);
      const lVals = losses.map(r => r.tracker.heroEndState[id] ? r.tracker.heroEndState[id][metric]||0 : 0);
      const wAvg = wVals.length ? fix1(wVals.reduce((a,b)=>a+b,0)/wVals.length) : '-';
      const lAvg = lVals.length ? fix1(lVals.reduce((a,b)=>a+b,0)/lVals.length) : '-';
      html += `<td style="text-align:center">${wAvg}</td><td style="text-align:center">${lAvg}</td>`;
    });
    html += `</tr>`;
  });
  html += `</table></div>`;
  html += `</div>`;

  // ===================== SECTION 3: HERO × ENEMY MATCHUP MATRIX =====================
  html += `<div class="report-section"><h3>Hero × Enemy Matchup Matrix</h3>`;

  const allCombatLogs = results.flatMap(r => r.tracker.combatLog);
  const enemyNames = [...new Set(allCombatLogs.map(c => c.enemy))].sort();
  const matchups = {};
  allCombatLogs.forEach(c => {
    const key = `${c.heroId}|${c.enemy}`;
    if (!matchups[key]) matchups[key] = { fights:0, wins:0, totalMargin:0, totalHeroStr:0 };
    matchups[key].fights++;
    if (c.won) matchups[key].wins++;
    matchups[key].totalMargin += c.margin || 0;
    matchups[key].totalHeroStr += c.heroTotalStr || 0;
  });

  html += `<div style="overflow-x:auto"><table style="font-size:9px;border-collapse:collapse;width:100%">`;
  html += `<tr><th style="position:sticky;left:0;background:var(--panel);min-width:120px">Enemy</th>`;
  heroIds.forEach(id => html += `<th style="color:var(--${id});min-width:70px">${heroNames[id]}</th>`);
  html += `<th style="min-width:60px">Overall</th></tr>`;

  enemyNames.forEach(enemy => {
    html += `<tr><td style="position:sticky;left:0;background:var(--panel);white-space:nowrap">${enemy}</td>`;
    let totalFights = 0, totalWins = 0;
    heroIds.forEach(id => {
      const m = matchups[`${id}|${enemy}`];
      if (m && m.fights >= 5) {
        const wr = m.wins / m.fights * 100;
        const color = wr < 20 ? 'var(--ko)' : wr > 95 ? 'var(--heal)' : 'var(--text)';
        const bg = wr < 20 ? '#2a1a1a' : wr > 95 ? '#1a2a1a' : 'transparent';
        html += `<td style="text-align:center;color:${color};background:${bg}">${wr.toFixed(0)}%<br><span style="font-size:8px;color:var(--dim)">${m.fights}f</span></td>`;
        if (wr < 20 && m.fights >= 20) flag('matchup', 'high', `${heroNames[id]} vs ${enemy}: ${wr.toFixed(0)}% win rate (${m.fights} fights) — hero gets destroyed`);
        if (wr > 95 && m.fights >= 20) flag('matchup', 'low', `${heroNames[id]} vs ${enemy}: ${wr.toFixed(0)}% win rate — no tension`);
      } else if (m) {
        html += `<td style="text-align:center;color:var(--dim)">${(m.wins/m.fights*100).toFixed(0)}%<br><span style="font-size:8px">${m.fights}f</span></td>`;
      } else {
        html += `<td style="text-align:center;color:var(--dim)">-</td>`;
      }
      if (m) { totalFights += m.fights; totalWins += m.wins; }
    });
    const overallWR = totalFights ? (totalWins/totalFights*100).toFixed(0) : '-';
    html += `<td style="text-align:center;font-weight:600">${overallWR}%</td></tr>`;
  });
  html += `</table></div></div>`;

  // ===================== SECTION 4: HERO × HYDRA HEAD MATCHUP =====================
  html += `<div class="report-section"><h3>Hero × Hydra Head Matchup</h3>`;

  const allHydraLogs = results.flatMap(r => r.tracker.hydraCombatLog);
  const headNames = [...new Set(allHydraLogs.map(c => c.head))].sort();
  const hydraMatchups = {};
  allHydraLogs.forEach(c => {
    const key = `${c.heroId}|${c.head}`;
    if (!hydraMatchups[key]) hydraMatchups[key] = { attacks:0, wins:0, kos:0, totalHeroStr:0 };
    hydraMatchups[key].attacks++;
    if (c.won) hydraMatchups[key].wins++;
    hydraMatchups[key].totalHeroStr += c.finalHeroTotal || c.heroTotal || 0;
  });

  html += `<div style="overflow-x:auto"><table style="font-size:9px;border-collapse:collapse;width:100%">`;
  html += `<tr><th style="min-width:100px">Head</th>`;
  heroIds.forEach(id => html += `<th style="color:var(--${id});min-width:70px">${heroNames[id]}</th>`);
  html += `<th>Overall</th></tr>`;

  headNames.forEach(head => {
    html += `<tr><td>${head}</td>`;
    let tA = 0, tW = 0;
    heroIds.forEach(id => {
      const m = hydraMatchups[`${id}|${head}`];
      if (m && m.attacks > 0) {
        const wr = m.wins / m.attacks * 100;
        const color = wr < 30 ? 'var(--ko)' : wr > 95 ? 'var(--heal)' : 'var(--text)';
        html += `<td style="text-align:center;color:${color}">${wr.toFixed(0)}%<br><span style="font-size:8px;color:var(--dim)">${m.attacks}atk</span></td>`;
        if (wr < 30) flag('hydra', 'medium', `${heroNames[id]} vs ${head}: ${wr.toFixed(0)}% win — WALL`);
        tA += m.attacks; tW += m.wins;
      } else {
        html += `<td style="text-align:center;color:var(--dim)">-</td>`;
      }
    });
    html += `<td style="text-align:center;font-weight:600">${tA?pct(tW,tA)+'%':'-'}</td></tr>`;
  });
  html += `</table></div>`;

  // Per-head stats
  headNames.forEach(head => {
    const headData = {};
    results.forEach(r => { if (r.tracker.hydraHeads[head]) { Object.entries(r.tracker.hydraHeads[head]).forEach(([k,v]) => { headData[k] = (headData[k]||0) + v; }); }});
    const killOrders = results.filter(r=>r.victory).map(r => { const ko = r.tracker.hydraHeadKillOrder || []; const idx = ko.findIndex(k => k.head === head); return idx; }).filter(i => i >= 0);
    const lastKilled = killOrders.filter(i => { const r = results.find(rr => rr.victory); return r && i === (r.tracker.hydraHeadKillOrder||[]).length - 1; }).length;
    if (headData.spawned) {
      html += `<div style="font-size:10px;color:var(--dim);margin:2px 0">${head}: spawned ${headData.spawned||0}x, destroyed ${headData.destroyed||0}x (${pct(headData.destroyed||0, headData.spawned||0)}%), KOs caused: ${headData.causedKO||0}</div>`;
    }
  });
  html += `</div>`;

  // ===================== SECTION 5: SKILL ANALYSIS =====================
  html += `<div class="report-section"><h3>Skill Analysis</h3>`;

  const allSkills = {};
  results.forEach(r => {
    Object.entries(r.tracker.skills).forEach(([key, data]) => {
      if (!allSkills[key]) allSkills[key] = { activated:0, burned:0, savedFromKO:0, turnedFight:0, activatedDungeon:0, activatedHydra:0, burnedDungeon:0, burnedHydra:0 };
      Object.entries(data).forEach(([f,v]) => { allSkills[key][f] = (allSkills[key][f]||0) + v; });
    });
  });

  html += `<table style="width:100%;font-size:10px;border-collapse:collapse">`;
  html += `<tr style="border-bottom:1px solid var(--border)"><th>Skill</th><th>Activated</th><th>Burned</th><th>Use/Burn</th><th>Dungeon</th><th>Hydra</th><th>KO Saved</th><th>Fight Changed</th></tr>`;

  Object.entries(allSkills).sort((a,b)=>b[1].activated-a[1].activated).forEach(([key, s]) => {
    const [heroId, ...nameParts] = key.split('_');
    const skillName = nameParts.join('_');
    const total = s.activated + s.burned;
    const useRatio = total > 0 ? pct(s.activated, total) : '-';
    const heroColor = `var(--${heroId})`;
    html += `<tr><td style="color:${heroColor}">${heroNames[heroId]}: ${skillName}</td>`;
    html += `<td style="text-align:center">${s.activated}</td>`;
    html += `<td style="text-align:center">${s.burned}</td>`;
    html += `<td style="text-align:center">${useRatio}%</td>`;
    html += `<td style="text-align:center;font-size:9px">${s.activatedDungeon}/${s.activatedHydra}</td>`;
    html += `<td style="text-align:center;font-size:9px">${s.burnedDungeon}/${s.burnedHydra}</td>`;
    html += `<td style="text-align:center">${s.savedFromKO}</td>`;
    html += `<td style="text-align:center">${s.turnedFight}</td></tr>`;
    if (s.burned > 0 && total > 0 && s.burned / total > 0.75) flag('skill', 'medium', `${heroNames[heroId]}'s ${skillName}: burned ${pct(s.burned,total)}% of the time — effect may need rework`);
  });
  html += `</table>`;

  // 5c: Battlecry deep dive
  const battlecryData = results.flatMap(r => r.tracker.battlecryDetails || []);
  if (battlecryData.length > 0) {
    const bcWins = battlecryData.filter(b => b.won);
    html += `<div class="report-card" style="margin-top:8px;border-left:3px solid var(--juju)"><b>Battlecry Deep Dive</b> (${battlecryData.length} uses)`;
    html += statRow('Won with worst-of-2', `${bcWins.length} (${pct(bcWins.length, battlecryData.length)}%)`);
    const avgKept = fix1(battlecryData.reduce((s,b) => s+b.kept, 0) / battlecryData.length);
    const avgBest = fix1(battlecryData.reduce((s,b) => s+b.bestRoll, 0) / battlecryData.length);
    html += statRow('Avg kept (worst) roll', avgKept);
    html += statRow('Avg best roll (would have kept normally)', avgBest);
    html += `</div>`;
  }

  // Second Nature deep dive
  const snData = results.flatMap(r => r.tracker.secondNatureDetails || []);
  if (snData.length > 0) {
    const snWins = snData.filter(s => s.won);
    const snDiff = snData.filter(s => s.wasDifferenceMaker);
    html += `<div class="report-card" style="border-left:3px solid var(--gigi)"><b>Second Nature Deep Dive</b> (${snData.length} uses)`;
    html += statRow('Win rate when active', `${pct(snWins.length, snData.length)}%`);
    html += statRow('+3 was the difference maker', `${snDiff.length} times (${pct(snDiff.length, snData.length)}%)`);
    html += `</div>`;
  }

  // Copycat deep dive
  const ccData = results.flatMap(r => r.tracker.copycatDetails || []);
  if (ccData.length > 0) {
    const ccBySkill = {};
    ccData.forEach(c => { if (!ccBySkill[c.copiedSkill]) ccBySkill[c.copiedSkill] = {count:0, wins:0}; ccBySkill[c.copiedSkill].count++; if(c.won) ccBySkill[c.copiedSkill].wins++; });
    html += `<div class="report-card" style="border-left:3px solid var(--eggo)"><b>Copycat Deep Dive</b> (${ccData.length} uses)`;
    Object.entries(ccBySkill).sort((a,b) => b[1].count - a[1].count).forEach(([skill, d]) => {
      html += statRow(`→ ${skill}`, `${d.count}x (win ${pct(d.wins, d.count)}%)`);
    });
    html += `</div>`;
  }

  // Skill recharge sources
  const rechargeSources = {};
  results.forEach(r => { Object.entries(r.tracker.skillRechargeSources||{}).forEach(([src, cnt]) => { rechargeSources[src] = (rechargeSources[src]||0) + cnt; }); });
  if (Object.keys(rechargeSources).length > 0) {
    html += `<div class="report-card"><b>Skill Recharge Sources</b>`;
    const totalRecharges = Object.values(rechargeSources).reduce((a,b) => a+b, 0);
    Object.entries(rechargeSources).sort((a,b) => b[1]-a[1]).forEach(([src, cnt]) => {
      html += statRow(src.replace(/_/g, ' '), `${cnt} (${pct(cnt, totalRecharges)}%)`);
    });
    html += `</div>`;
  }
  html += `</div>`;

  // ===================== SECTION 6: EQUIPMENT ANALYSIS =====================
  html += `<div class="report-section"><h3>Equipment Analysis</h3>`;

  // 6a: Equipment at combat
  const equipAtCombat = [0,0,0];
  allCombatLogs.forEach(c => { const eq = Math.min(c.equipCount||0, 2); equipAtCombat[eq]++; });
  const totalCombatLogs = allCombatLogs.length;
  html += `<div class="report-card"><b>Equipment at Combat</b>`;
  html += statRow('0 items', `${pct(equipAtCombat[0], totalCombatLogs)}%`);
  html += statRow('1 item', `${pct(equipAtCombat[1], totalCombatLogs)}%`);
  html += statRow('2 items', `${pct(equipAtCombat[2], totalCombatLogs)}%`);
  if (equipAtCombat[0] / totalCombatLogs > 0.3) flag('equipment', 'medium', `Heroes fight with 0 equipment ${pct(equipAtCombat[0], totalCombatLogs)}% of the time — need more equipment sources`);
  html += `</div>`;

  // 6c: Per equipment stats
  const allEquip = {};
  results.forEach(r => {
    Object.entries(r.tracker.equipment).forEach(([name, data]) => {
      if (!allEquip[name]) allEquip[name] = { equipped:0, wonWith:0, lostWith:0, discarded:0 };
      Object.entries(data).forEach(([f,v]) => { if (typeof v === 'number') allEquip[name][f] = (allEquip[name][f]||0) + v; });
    });
  });

  html += `<table style="width:100%;font-size:10px;border-collapse:collapse;margin-top:8px">`;
  html += `<tr style="border-bottom:1px solid var(--border)"><th>Equipment</th><th>Equipped</th><th>Win Rate</th><th>Discarded</th></tr>`;
  Object.entries(allEquip).sort((a,b) => b[1].equipped - a[1].equipped).forEach(([name, data]) => {
    const total = (data.wonWith||0) + (data.lostWith||0);
    const wr = total > 0 ? pct(data.wonWith, total) : '-';
    html += `<tr><td>${name}</td><td style="text-align:center">${data.equipped||0}</td><td style="text-align:center">${wr}%</td><td style="text-align:center">${data.discarded||0}</td></tr>`;
  });
  html += `</table>`;

  // 6d: Equipment combos at Hydra (from end state of winners)
  const comboPairs = {};
  wins.forEach(r => {
    heroIds.forEach(id => {
      const es = r.tracker.heroEndState[id];
      if (es && es.equipNames && es.equipNames.length >= 2) {
        const sorted = [...es.equipNames].sort();
        for (let i = 0; i < sorted.length; i++) {
          for (let j = i+1; j < sorted.length; j++) {
            const pair = sorted[i] + ' + ' + sorted[j];
            comboPairs[pair] = (comboPairs[pair]||0) + 1;
          }
        }
      }
    });
  });
  if (Object.keys(comboPairs).length > 0) {
    html += `<div class="report-card" style="margin-top:8px"><b>Top Equipment Combos (Winners)</b>`;
    Object.entries(comboPairs).sort((a,b) => b[1]-a[1]).slice(0, 10).forEach(([pair, count]) => {
      html += statRow(pair, `${count}x`);
    });
    html += `</div>`;
  }
  html += `</div>`;

  // ===================== SECTION 7: ENEMY DESIGN ANALYSIS =====================
  html += `<div class="report-section"><h3>Enemy Design Analysis</h3>`;

  // 7b: Decision enemies
  const allDecisions = {};
  results.forEach(r => { Object.entries(r.tracker.decisionEnemies||{}).forEach(([name, data]) => {
    if (!allDecisions[name]) allDecisions[name] = {choiceA:0, choiceB:0};
    allDecisions[name].choiceA += data.choiceA||0;
    allDecisions[name].choiceB += data.choiceB||0;
  }); });
  if (Object.keys(allDecisions).length > 0) {
    html += `<div class="report-card"><b>Decision Enemies</b>`;
    Object.entries(allDecisions).forEach(([name, d]) => {
      const total = d.choiceA + d.choiceB;
      const labelA = name === 'Bully' ? 'Fled' : 'Paid/Avoided';
      const labelB = 'Fought';
      html += statRow(name, `${labelA}: ${d.choiceA} (${pct(d.choiceA,total)}%) | ${labelB}: ${d.choiceB} (${pct(d.choiceB,total)}%)`);
      if (total > 20 && (d.choiceA / total > 0.95 || d.choiceB / total > 0.95)) flag('enemy', 'medium', `${name}: one option chosen ${Math.max(d.choiceA,d.choiceB)}/${total} times — no real decision`);
    });
    html += `</div>`;
  }

  // 7d: Enemy tier validation
  const mishapEnemies = MISHAP_CARDS.filter(c => c.type === 'enemy');
  const misfortuneEnemies = MISFORTUNE_CARDS.filter(c => c.type === 'enemy');

  html += `<div class="report-card"><b>Tier Validation</b>`;
  html += `<div style="font-size:9px;color:var(--dim);margin-bottom:4px">Mishap target: 75-95% hero win rate | Misfortune target: 35-70%</div>`;
  const allEncounters = {};
  results.forEach(r => { Object.entries(r.tracker.encounters).forEach(([name, data]) => {
    if (!allEncounters[name]) allEncounters[name] = {drawn:0,won:0,lost:0,fled:0,avoided:0};
    Object.entries(data).forEach(([f,v]) => { allEncounters[name][f] = (allEncounters[name][f]||0) + v; });
  }); });

  mishapEnemies.forEach(e => {
    const d = allEncounters[e.name];
    if (d && d.won + d.lost >= 20) {
      const wr = d.won / (d.won + d.lost) * 100;
      const ok = wr >= 75 && wr <= 95;
      if (!ok) {
        const tag = wr < 75 ? 'TOO HARD' : 'TOO EASY';
        html += `<div style="font-size:10px;color:${wr<75?'var(--ko)':'var(--heal)'}">${e.name} (Mishap STR ${e.str}): ${wr.toFixed(0)}% — ${tag}</div>`;
        flag('enemy', 'medium', `${e.name} (Mishap): ${wr.toFixed(0)}% hero win rate — ${tag}`);
      }
    }
  });
  misfortuneEnemies.forEach(e => {
    const d = allEncounters[e.name];
    if (d && d.won + d.lost >= 20) {
      const wr = d.won / (d.won + d.lost) * 100;
      const ok = wr >= 35 && wr <= 70;
      if (!ok) {
        const tag = wr < 35 ? 'TOO HARD' : 'TOO EASY';
        html += `<div style="font-size:10px;color:${wr<35?'var(--ko)':'var(--heal)'}">${e.name} (Misfortune STR ${e.str}): ${wr.toFixed(0)}% — ${tag}</div>`;
        flag('enemy', 'medium', `${e.name} (Misfortune): ${wr.toFixed(0)}% hero win rate — ${tag}`);
      }
    }
  });
  html += `</div>`;

  // 7e: Enemies never fought
  const enemiesNeverFought = {};
  results.forEach(r => { (r.tracker.enemiesAtGameEnd||[]).forEach(name => { enemiesNeverFought[name] = (enemiesNeverFought[name]||0) + 1; }); });
  if (Object.keys(enemiesNeverFought).length > 0) {
    html += `<div class="report-card"><b>Enemies Alive at Game End</b>`;
    Object.entries(enemiesNeverFought).sort((a,b) => b[1]-a[1]).slice(0, 15).forEach(([name, count]) => {
      html += statRow(name, `${count} games`);
    });
    html += `</div>`;
  }
  html += `</div>`;

  // ===================== SECTION 8: GIL ECONOMY =====================
  html += `<div class="report-section"><h3>Gil Economy</h3>`;
  const gilGames = results.filter(r => r.heroes.some(h => (h.gilEarned||0) > 0));
  if (gilGames.length > 0) {
    html += `<div class="report-card">`;
    heroIds.forEach(id => {
      const earned = avg(gilGames, r => { const h = r.heroes.find(x => x.id === id); return h ? h.gilEarned||0 : 0; });
      const spentSkill = avg(gilGames, r => { const h = r.heroes.find(x => x.id === id); return h ? h.gilSpentSkill||0 : 0; });
      const spentEquip = avg(gilGames, r => { const h = r.heroes.find(x => x.id === id); return h ? h.gilSpentEquip||0 : 0; });
      const unspent = avg(gilGames, r => { const h = r.heroes.find(x => x.id === id); return h ? h.gil||0 : 0; });
      const unspentPct = earned > 0 ? pct(unspent, earned) : '-';
      html += `<div style="margin-bottom:6px"><b style="color:var(--${id})">${heroNames[id]}</b>`;
      html += statRow('Avg Earned / game', fix1(earned));
      html += statRow('Avg Spent on Skills', fix1(spentSkill));
      html += statRow('Avg Spent on Equipment', fix1(spentEquip));
      html += statRow('Avg Unspent', `${fix1(unspent)} (${unspentPct}%)`);
      if (earned > 0 && unspent / earned > 0.6) flag('gil', 'medium', `${heroNames[id]} leaves ${unspentPct}% of Gil unspent — Gil not useful enough or prices too high`);
      html += `</div>`;
    });
    html += `</div>`;

    // Gil visits
    const totalVoluntary = results.reduce((s,r) => s + (r.tracker.gilVisits ? r.tracker.gilVisits.voluntary : 0), 0);
    const totalKOVisits = results.reduce((s,r) => s + (r.tracker.gilVisits ? r.tracker.gilVisits.koRespawn : 0), 0);
    html += `<div class="report-card"><b>Entrance Visits</b>`;
    html += statRow('Voluntary (to spend Gil)', totalVoluntary);
    html += statRow('KO Respawn', totalKOVisits);
    if (totalVoluntary === 0 && totalKOVisits > 0) flag('gil', 'medium', 'No voluntary Gil spending visits — heroes only spend when KO respawning');
    html += `</div>`;
  } else {
    html += `<div class="report-card" style="color:var(--dim)">Gil system not enabled in this batch.</div>`;
  }
  html += `</div>`;

  // ===================== SECTION 9: GAME PACING =====================
  html += `<div class="report-section"><h3>Game Pacing</h3>`;

  // 9a: Milestone turns
  const milestones = [
    {label: 'First Equipment', fn: r => r.tracker.pacing.firstEquip || 0},
    {label: 'First KO', fn: r => r.tracker.pacing.firstKO || 0},
    {label: 'First Relic', fn: r => r.tracker.pacing.firstRelic || 0},
    {label: 'Hydra Spawns', fn: r => r.tracker.pacing.hydraSpawn || 0},
    {label: 'First Hero at Hydra', fn: r => r.tracker.pacing.hydraArrival || 0},
    {label: 'Game Ends', fn: r => r.turn},
  ];

  html += `<div class="report-card"><b>Milestone Turns</b>`;
  milestones.forEach(m => {
    const vals = results.map(m.fn).filter(v => v > 0);
    if (vals.length > 0) {
      const mean = fix1(vals.reduce((a,b)=>a+b,0) / vals.length);
      const sd = fix1(Math.sqrt(vals.reduce((s,v) => s + Math.pow(v - parseFloat(mean), 2), 0) / vals.length));
      html += statRow(m.label, `Turn ${mean} (±${sd})`);
    }
  });
  html += `</div>`;

  // 9b: Phase durations
  const phaseDurations = results.map(r => {
    const hydraReveal = r.tracker.pacing.hydraSpawn || r.turn;
    const hydraArrival = r.tracker.pacing.hydraArrival || hydraReveal;
    return {
      exploration: hydraReveal,
      preparation: hydraArrival - hydraReveal,
      boss: r.turn - hydraArrival,
      total: r.turn
    };
  });
  const avgExplore = fix1(avg(phaseDurations, p => p.exploration));
  const avgPrep = fix1(avg(phaseDurations, p => p.preparation));
  const avgBoss = fix1(avg(phaseDurations, p => p.boss));
  const avgTotal = parseFloat(avgTurns);
  html += `<div class="report-card"><b>Phase Duration</b>`;
  html += statRow('Exploration', `${avgExplore} turns (${pct(parseFloat(avgExplore), avgTotal)}%)`);
  html += statRow('Preparation', `${avgPrep} turns (${pct(parseFloat(avgPrep), avgTotal)}%)`);
  html += statRow('Boss Fight', `${avgBoss} turns (${pct(parseFloat(avgBoss), avgTotal)}%)`);
  const bossPct = parseFloat(pct(parseFloat(avgBoss), avgTotal));
  if (bossPct < 20) flag('pacing', 'medium', `Boss phase is only ${bossPct}% of game — Hydra dies too fast or appears too late`);
  if (bossPct > 40) flag('pacing', 'medium', `Boss phase is ${bossPct}% of game — Hydra fight may be too long`);
  html += `</div>`;

  // 9c: Turn activity
  const emptyTurns = results.reduce((s,r) => s + (r.tracker.emptyTurns||0), 0);
  const totalTurns = results.reduce((s,r) => s + r.turn, 0);
  const emptyPct = pct(emptyTurns, totalTurns);
  html += `<div class="report-card"><b>Turn Activity</b>`;
  html += statRow('Total turns', totalTurns);
  html += statRow('Empty turns (no event)', `${emptyTurns} (${emptyPct}%)`);
  if (parseFloat(emptyPct) > 15) flag('pacing', 'medium', `${emptyPct}% empty turns — dungeon feels dead`);
  html += `</div>`;
  html += `</div>`;

  // ===================== SECTION 10: HYDRA FIGHT DEEP DIVE =====================
  html += `<div class="report-section"><h3>Hydra Fight Deep Dive</h3>`;

  // 10a: Setup
  const startCombos = {};
  results.forEach(r => {
    const key = [...(r.tracker.hydraStartingHeads||[])].sort().join(' + ');
    if (key) startCombos[key] = (startCombos[key]||0) + 1;
  });
  html += `<div class="report-card"><b>Starting Head Combinations</b>`;
  Object.entries(startCombos).sort((a,b) => b[1]-a[1]).slice(0, 5).forEach(([combo, count]) => {
    const comboWins = results.filter(r => [...(r.tracker.hydraStartingHeads||[])].sort().join(' + ') === combo && r.victory).length;
    const comboTotal = count;
    html += statRow(combo, `${count}x (win ${pct(comboWins, comboTotal)}%)`);
  });
  html += `</div>`;

  // 10b: Combat flow
  const hydraAttacksPerWin = wins.length ? fix1(allHydraLogs.filter(c => wins.some(w => w === results[results.indexOf(w)])).length / wins.length) : '-';
  const hydraKOs = results.reduce((s,r) => { let ko=0; Object.values(r.tracker.hydraHeads).forEach(h => ko += h.causedKO||0); return s+ko; }, 0);
  html += `<div class="report-card"><b>Hydra Combat Flow</b>`;
  html += statRow('Avg attacks per game', fix1(allHydraLogs.length / n));
  html += statRow('Avg KOs during Hydra fight', fix1(hydraKOs / n));
  html += `</div>`;

  // 10c: Head kill order
  const killOrderFirst = {}, killOrderLast = {};
  wins.forEach(r => {
    const ko = r.tracker.hydraHeadKillOrder || [];
    if (ko.length > 0) { const f = ko[0].head; killOrderFirst[f] = (killOrderFirst[f]||0) + 1; }
    if (ko.length > 0) { const l = ko[ko.length-1].head; killOrderLast[l] = (killOrderLast[l]||0) + 1; }
  });
  if (Object.keys(killOrderFirst).length > 0) {
    html += `<div class="report-card"><b>Head Kill Order (Wins)</b>`;
    html += `<div style="font-size:10px"><b>Killed First:</b> `;
    Object.entries(killOrderFirst).sort((a,b) => b[1]-a[1]).forEach(([head, count]) => {
      html += `${head} ${pct(count, wins.length)}% | `;
    });
    html += `</div><div style="font-size:10px"><b>Killed Last:</b> `;
    Object.entries(killOrderLast).sort((a,b) => b[1]-a[1]).forEach(([head, count]) => {
      html += `${head} ${pct(count, wins.length)}% | `;
    });
    html += `</div></div>`;
  }

  // 10d: Head growth
  const growthSources = {};
  results.forEach(r => { (r.tracker.hydraGrowthLog||[]).forEach(g => { growthSources[g.source] = (growthSources[g.source]||0) + 1; }); });
  const totalGrowths = results.reduce((s,r) => s + (r.tracker.hydraGrowthLog||[]).length, 0);
  html += `<div class="report-card"><b>Head Growth</b>`;
  html += statRow('Avg heads grown / game', fix1(totalGrowths / n));
  Object.entries(growthSources).sort((a,b) => b[1]-a[1]).forEach(([src, cnt]) => {
    html += statRow(src.replace(/_/g, ' '), `${cnt} (${pct(cnt, totalGrowths)}%)`);
  });
  html += `</div>`;

  // 10e: Overflow analysis
  const overflowGames = losses.filter(r => r.defeatCause && r.defeatCause.cause === 'hydra_overflow');
  if (overflowGames.length > 0) {
    const avgHeadsDestroyedBefore = fix1(avg(overflowGames, r => (r.tracker.hydraHeadKillOrder||[]).length));
    html += `<div class="report-card" style="border-left:3px solid var(--ko)"><b>Overflow Analysis</b> (${overflowGames.length} games)`;
    html += statRow('Heads destroyed before overflow', avgHeadsDestroyedBefore);
    html += `</div>`;
  }
  html += `</div>`;

  // ===================== SECTION 11: TRAP ANALYSIS =====================
  html += `<div class="report-section"><h3>Trap Analysis</h3>`;

  const allTraps = {};
  results.forEach(r => { Object.entries(r.tracker.traps||{}).forEach(([name, data]) => {
    if (!allTraps[name]) allTraps[name] = {triggered:0, survived:0, ko:0};
    Object.entries(data).forEach(([f,v]) => { allTraps[name][f] = (allTraps[name][f]||0) + v; });
  }); });

  const allTrapResources = {};
  results.forEach(r => { Object.entries(r.tracker.trapResourcesLost||{}).forEach(([name, data]) => {
    if (!allTrapResources[name]) allTrapResources[name] = {equipLost:0, followersLost:0, skillsExhausted:0};
    Object.entries(data).forEach(([f,v]) => { allTrapResources[name][f] = (allTrapResources[name][f]||0) + v; });
  }); });

  html += `<table style="width:100%;font-size:10px;border-collapse:collapse">`;
  html += `<tr style="border-bottom:1px solid var(--border)"><th>Trap</th><th>Triggered</th><th>KOs</th><th>Equip Lost</th><th>Followers Lost</th><th>Skills Exhausted</th><th>Flag</th></tr>`;

  Object.entries(allTraps).sort((a,b) => b[1].triggered - a[1].triggered).forEach(([name, data]) => {
    const res = allTrapResources[name] || {equipLost:0, followersLost:0, skillsExhausted:0};
    const totalDamage = data.ko + res.equipLost + res.followersLost + res.skillsExhausted;
    let trapFlag = '';
    if (totalDamage === 0) { trapFlag = '<span style="color:var(--dim)">USELESS</span>'; flag('trap', 'low', `${name}: no impact in ${data.triggered} triggers`); }
    else if (data.ko > data.triggered * 0.3) { trapFlag = '<span style="color:var(--ko)">LETHAL</span>'; }
    else if (res.equipLost + res.followersLost > 0 && data.ko === 0) { trapFlag = '<span style="color:var(--mishap)">TAXING</span>'; }
    html += `<tr><td>${name}</td><td style="text-align:center">${data.triggered}</td><td style="text-align:center">${data.ko}</td>`;
    html += `<td style="text-align:center">${res.equipLost}</td><td style="text-align:center">${res.followersLost}</td><td style="text-align:center">${res.skillsExhausted}</td>`;
    html += `<td style="text-align:center">${trapFlag}</td></tr>`;
  });
  html += `</table></div>`;

  // ===================== SECTION 12: FOLLOWER/STALKER ANALYSIS =====================
  html += `<div class="report-section"><h3>Follower & Stalker Analysis</h3>`;

  // Followers at game end
  const followersAtEnd = {};
  results.forEach(r => {
    heroIds.forEach(id => {
      const es = r.tracker.heroEndState[id];
      if (es) {
        (es.followerNames||[]).forEach(fname => { followersAtEnd[fname] = (followersAtEnd[fname]||0) + 1; });
      }
    });
  });

  const avgFollowersAtEnd = fix1(results.reduce((s,r) => {
    return s + heroIds.reduce((ss,id) => ss + (r.tracker.heroEndState[id] ? r.tracker.heroEndState[id].followerCount||0 : 0), 0);
  }, 0) / n / 4);

  html += `<div class="report-card"><b>Followers</b>`;
  html += statRow('Avg followers per hero at game end', avgFollowersAtEnd);

  // Follower draw stats
  const allFollowers = {};
  results.forEach(r => { Object.entries(r.tracker.followers||{}).forEach(([name, data]) => {
    if (!allFollowers[name]) allFollowers[name] = {drawn:0, helpedWin:0, lost:0};
    Object.entries(data).forEach(([f,v]) => { allFollowers[name][f] = (allFollowers[name][f]||0) + v; });
  }); });

  html += `<table style="width:100%;font-size:10px;border-collapse:collapse;margin-top:6px">`;
  html += `<tr style="border-bottom:1px solid var(--border)"><th>Follower</th><th>Drawn</th><th>Lost</th><th>Held at End</th></tr>`;
  Object.entries(allFollowers).sort((a,b) => b[1].drawn - a[1].drawn).forEach(([name, data]) => {
    html += `<tr><td>${name}</td><td style="text-align:center">${data.drawn}</td><td style="text-align:center">${data.lost}</td><td style="text-align:center">${followersAtEnd[name]||0}</td></tr>`;
  });
  html += `</table></div>`;

  // Stalker stats
  const allStalkers = {};
  results.forEach(r => { Object.entries(r.tracker.stalkers||{}).forEach(([name, data]) => {
    if (!allStalkers[name]) allStalkers[name] = {attached:0, turnsActive:0, causedKO:0, removed:0};
    Object.entries(data).forEach(([f,v]) => { allStalkers[name][f] = (allStalkers[name][f]||0) + v; });
  }); });

  if (Object.keys(allStalkers).length > 0) {
    html += `<div class="report-card"><b>Stalkers</b>`;
    html += `<table style="width:100%;font-size:10px;border-collapse:collapse">`;
    html += `<tr style="border-bottom:1px solid var(--border)"><th>Stalker</th><th>Attached</th><th>KOs Caused</th><th>Removed</th></tr>`;
    Object.entries(allStalkers).forEach(([name, data]) => {
      html += `<tr><td>${name}</td><td style="text-align:center">${data.attached}</td><td style="text-align:center">${data.causedKO}</td><td style="text-align:center">${data.removed}</td></tr>`;
    });
    html += `</table></div>`;
  }
  html += `</div>`;

  // ===================== SECTION 13: GAP ANALYSIS =====================
  html += `<div class="report-section"><h3>Gap Analysis</h3>`;

  // Auto-generated pacing gaps
  if (parseFloat(emptyPct) > 15) flag('pacing', 'medium', `${emptyPct}% empty turns — dungeon needs more events`);

  // Equipment gaps check
  heroIds.forEach(id => {
    const heroCLs = allCombatLogs.filter(c => c.heroId === id);
    const noEquip = heroCLs.filter(c => (c.equipCount||0) === 0).length;
    if (heroCLs.length > 0 && noEquip / heroCLs.length > 0.35) {
      flag('equipment', 'medium', `${heroNames[id]} fights with 0 equipment ${pct(noEquip, heroCLs.length)}% — needs more equipment sources`);
    }
  });

  // Skill gaps: any skill burned > 75%
  Object.entries(allSkills).forEach(([key, s]) => {
    const total = s.activated + s.burned;
    if (total > 50 && s.burned / total > 0.75) {
      const [heroId, ...nameParts] = key.split('_');
      flag('skill', 'medium', `${heroNames[heroId]}'s ${nameParts.join('_')}: burned ${pct(s.burned, total)}% — skill effect rarely used`);
    }
  });

  if (allFlags.length === 0) {
    html += `<div class="report-card insight"><span class="tag insight-tag">OK</span>No significant balance issues detected.</div>`;
  } else {
    // Group by category
    const byCategory = {};
    allFlags.forEach(f => {
      if (!byCategory[f.category]) byCategory[f.category] = [];
      // Deduplicate
      if (!byCategory[f.category].some(x => x.msg === f.msg)) byCategory[f.category].push(f);
    });
    Object.entries(byCategory).forEach(([cat, flags]) => {
      html += `<div class="report-card ${flags[0].severity === 'high' ? 'op' : 'insight'}"><b>${cat.charAt(0).toUpperCase() + cat.slice(1)}</b>`;
      flags.forEach(f => {
        const color = f.severity === 'high' ? 'var(--ko)' : f.severity === 'medium' ? 'var(--mishap)' : 'var(--dim)';
        html += `<div style="font-size:10px;color:${color};padding:1px 0">- ${f.msg}</div>`;
      });
      html += `</div>`;
    });
  }
  html += `</div>`;

  // ===================== SECTION 14: TEXTUAL ANALYSIS =====================
  html += `<div class="report-section"><h3>Textual Analysis</h3>`;
  html += generateTextualAnalysis(results, wins, losses, n, winRate, heroIds, heroNames, avg, pct, fix1, allFlags, allCombatLogs, allHydraLogs, allSkills, allEquip, allEncounters);
  html += `</div>`;

  return html;
}

function generateTextualAnalysis(results, wins, losses, n, winRate, heroIds, heroNames, avg, pct, fix1, allFlags, allCombatLogs, allHydraLogs, allSkills, allEquip, allEncounters) {
  let t = '';
  const wr = parseFloat(winRate);
  const avgTurns = fix1(avg(results, r => r.turn));
  const avgKO = fix1(avg(results, r => r.stats.ko));
  const avgBurns = fix1(avg(results, r => r.stats.skillBurns));

  // ---- OVERALL VERDICT ----
  t += `<div class="report-card" style="border-left:3px solid var(--accent);line-height:1.7;font-size:12px">`;
  t += `<b style="font-size:14px">Overall Assessment</b><br><br>`;

  if (wr >= 80) {
    t += `With a <b>${winRate}% win rate</b>, the game is currently too forgiving. Players will win most games without needing to optimize their strategy. `;
    t += `This is fine for a family-friendly introductory mode, but experienced players will feel little tension. `;
  } else if (wr >= 65) {
    t += `The <b>${winRate}% win rate</b> sits in a healthy zone. Players who make good decisions will usually win, but bad luck or poor planning can still sink a run. `;
    t += `This balance rewards skill while keeping the outcome uncertain. `;
  } else if (wr >= 45) {
    t += `At <b>${winRate}% win rate</b>, the game is challenging. Players need to play well and get some luck to pull through. `;
    t += `This is the sweet spot for experienced groups who want meaningful decisions and real consequences. `;
  } else if (wr >= 25) {
    t += `The <b>${winRate}% win rate</b> is punishing. Wins feel earned, but many players will find the difficulty frustrating. `;
    t += `Consider whether the losses feel fair or if players are being punished by factors outside their control. `;
  } else {
    t += `At <b>${winRate}% win rate</b>, the game is brutally hard. Most runs end in defeat regardless of player skill. `;
    t += `This level of difficulty typically drives players away unless the run-to-run variety is exceptionally high. `;
  }

  t += `Games last an average of <b>${avgTurns} turns</b> with <b>${avgKO} KOs per game</b>. `;

  // Defeat cause analysis
  const defeatCauses = {};
  losses.forEach(r => { const c = r.defeatCause ? r.defeatCause.cause : 'unknown'; defeatCauses[c] = (defeatCauses[c]||0) + 1; });
  if (losses.length > 0) {
    const mainCause = Object.entries(defeatCauses).sort((a,b) => b[1]-a[1])[0];
    if (mainCause) {
      const causePct = (mainCause[1] / losses.length * 100).toFixed(0);
      if (mainCause[0] === 'hydra_overflow') {
        t += `<b>${causePct}% of losses</b> come from Hydra overflow, meaning heroes can't kill heads fast enough. `;
        t += `If this number is above 70%, the Hydra fight is the primary bottleneck and dungeon preparation matters less than boss damage output. `;
      } else if (mainCause[0] === 'no_relics') {
        t += `<b>${causePct}% of losses</b> happen when a hero gets KO'd at the Hydra with no relics left. `;
        t += `This means heroes are arriving underpowered or the Hydra heads are hitting too hard relative to hero STR at that point. `;
      }
    }
  }
  t += `</div>`;

  // ---- HERO ANALYSIS ----
  t += `<div class="report-card" style="line-height:1.7;font-size:12px">`;
  t += `<b style="font-size:14px">Hero Breakdown</b><br><br>`;

  heroIds.forEach(id => {
    const name = heroNames[id];
    const heroCombats = allCombatLogs.filter(c => c.heroId === id);
    const heroWins = heroCombats.filter(c => c.won).length;
    const heroWR = heroCombats.length > 0 ? (heroWins / heroCombats.length * 100).toFixed(0) : 0;
    const heroKO = results.reduce((s,r) => s + (r.tracker.heroes[id] ? r.tracker.heroes[id].ko : 0), 0);
    const koPerGame = fix1(heroKO / n);
    const headsDestroyed = results.reduce((s,r) => s + (r.tracker.heroes[id] ? (r.tracker.heroes[id].hydraHeadsDestroyed||0) : 0), 0);
    const headsPerGame = fix1(headsDestroyed / n);

    // Equipment at combat
    const noEquipFights = heroCombats.filter(c => (c.equipCount||0) === 0).length;
    const noEquipPct = heroCombats.length > 0 ? (noEquipFights / heroCombats.length * 100).toFixed(0) : 0;

    t += `<b style="color:var(--${id})">${name}</b>: `;
    t += `${heroWR}% combat win rate, ${koPerGame} KOs/game, ${headsPerGame} Hydra heads destroyed/game. `;

    if (parseInt(heroWR) >= 80) {
      t += `${name} dominates combat and rarely loses fights. `;
    } else if (parseInt(heroWR) >= 60) {
      t += `${name} holds their own in most fights. `;
    } else if (parseInt(heroWR) >= 40) {
      t += `${name} struggles in combat and needs support from equipment or skills to win consistently. `;
    } else {
      t += `${name} loses most fights and is a liability without heavy support. `;
    }

    if (parseInt(noEquipPct) > 40) {
      t += `Fights without any equipment <b>${noEquipPct}%</b> of the time, which is high. `;
    }

    if (parseFloat(headsPerGame) < 0.3 && parseFloat(headsPerGame) >= 0) {
      t += `Contributes very little to the Hydra fight. `;
    } else if (parseFloat(headsPerGame) >= 1) {
      t += `Carries a significant share of the Hydra fight. `;
    }
    t += `<br>`;
  });
  t += `</div>`;

  // ---- WINNERS VS LOSERS ----
  t += `<div class="report-card" style="line-height:1.7;font-size:12px">`;
  t += `<b style="font-size:14px">What Separates Winners from Losers</b><br><br>`;

  if (wins.length > 0 && losses.length > 0) {
    const winStrAvg = avg(wins, r => heroIds.reduce((s,id) => s + (r.tracker.heroEndState[id] ? r.tracker.heroEndState[id].totalStr||0 : 0), 0) / 4);
    const lossStrAvg = avg(losses, r => heroIds.reduce((s,id) => s + (r.tracker.heroEndState[id] ? r.tracker.heroEndState[id].totalStr||0 : 0), 0) / 4);
    const winEquipAvg = avg(wins, r => heroIds.reduce((s,id) => s + (r.tracker.heroEndState[id] ? r.tracker.heroEndState[id].equipCount||0 : 0), 0) / 4);
    const lossEquipAvg = avg(losses, r => heroIds.reduce((s,id) => s + (r.tracker.heroEndState[id] ? r.tracker.heroEndState[id].equipCount||0 : 0), 0) / 4);
    const winSkillAvg = avg(wins, r => heroIds.reduce((s,id) => s + (r.tracker.heroEndState[id] ? r.tracker.heroEndState[id].readySkills||0 : 0), 0) / 4);
    const lossSkillAvg = avg(losses, r => heroIds.reduce((s,id) => s + (r.tracker.heroEndState[id] ? r.tracker.heroEndState[id].readySkills||0 : 0), 0) / 4);

    const strDiff = winStrAvg - lossStrAvg;
    const equipDiff = winEquipAvg - lossEquipAvg;
    const skillDiff = winSkillAvg - lossSkillAvg;

    t += `At game end, winning heroes average <b>${fix1(winStrAvg)} total STR</b> vs <b>${fix1(lossStrAvg)}</b> for losers `;
    t += `(a gap of ${fix1(strDiff)}). `;

    if (strDiff > 2) {
      t += `This gap is significant — STR is the biggest predictor of victory. Equipment and follower accumulation matter a lot. `;
    } else if (strDiff > 0.5) {
      t += `The STR difference is moderate, meaning other factors (skill timing, luck) also play a role. `;
    } else {
      t += `STR barely differs between winners and losers, suggesting the outcome depends more on tactical decisions or dice luck than raw power. `;
    }

    t += `<br>Winners carry <b>${fix1(winEquipAvg)}</b> equipment vs <b>${fix1(lossEquipAvg)}</b> for losers. `;
    if (equipDiff > 0.5) {
      t += `Equipment matters. Heroes who gear up before the Hydra fight have a clear advantage. `;
    }

    t += `Winners have <b>${fix1(winSkillAvg)}</b> ready skills vs <b>${fix1(lossSkillAvg)}</b>. `;
    if (skillDiff > 0.5) {
      t += `Skill conservation is important. Burning skills in the dungeon leaves heroes weaker at the Hydra. `;
    }
  } else {
    t += `Not enough data to compare winners and losers (need both wins and losses). `;
  }
  t += `</div>`;

  // ---- HYDRA FIGHT ----
  t += `<div class="report-card" style="line-height:1.7;font-size:12px">`;
  t += `<b style="font-size:14px">Hydra Fight</b><br><br>`;

  const totalGrowths = results.reduce((s,r) => s + (r.tracker.hydraGrowthLog||[]).length, 0);
  const avgGrowth = fix1(totalGrowths / n);
  const hydraKOs = results.reduce((s,r) => { let ko=0; Object.values(r.tracker.hydraHeads).forEach(h => ko += h.causedKO||0); return s+ko; }, 0);

  t += `The Hydra grows an average of <b>${avgGrowth} extra heads per game</b> and causes <b>${fix1(hydraKOs/n)} KOs per game</b>. `;

  if (parseFloat(avgGrowth) > 3) {
    t += `Head growth is very high, putting heavy pressure on the party. Each failed attack snowballs the fight. `;
  } else if (parseFloat(avgGrowth) > 1.5) {
    t += `Head growth is moderate. There's room for a few mistakes, but too many failed attacks will overwhelm the party. `;
  } else {
    t += `Head growth is low. Heroes are killing heads efficiently and rarely letting the situation spiral. `;
  }

  // Growth sources
  const growthSources = {};
  results.forEach(r => { (r.tracker.hydraGrowthLog||[]).forEach(g => { growthSources[g.source] = (growthSources[g.source]||0) + 1; }); });
  const topGrowthSource = Object.entries(growthSources).sort((a,b) => b[1]-a[1])[0];
  if (topGrowthSource && totalGrowths > 0) {
    t += `The primary source of growth is <b>${topGrowthSource[0].replace(/_/g,' ')}</b> (${pct(topGrowthSource[1], totalGrowths)}% of all growth). `;
    if (topGrowthSource[0] === 'hero_ko') {
      t += `Heroes getting knocked out feeds the Hydra. Reducing KOs (through better equipment or skills) would slow the boss down. `;
    } else if (topGrowthSource[0] === 'hydra_area_empty') {
      t += `The Hydra grows when no heroes are present to attack it. Getting heroes to the Hydra faster would help. `;
    } else if (topGrowthSource[0] === 'failed_attack') {
      t += `Failed attacks cause the most growth. Boosting hero STR or reducing head STR would directly reduce this. `;
    }
  }

  // Kill order insight
  const killOrderFirst = {};
  wins.forEach(r => { const ko = r.tracker.hydraHeadKillOrder || []; if (ko.length > 0) killOrderFirst[ko[0].head] = (killOrderFirst[ko[0].head]||0) + 1; });
  const topFirst = Object.entries(killOrderFirst).sort((a,b) => b[1]-a[1])[0];
  if (topFirst && wins.length > 0) {
    const firstPct = (topFirst[1] / wins.length * 100).toFixed(0);
    t += `In winning games, <b>${topFirst[0]}</b> is killed first ${firstPct}% of the time. `;
    if (parseInt(firstPct) > 60) {
      t += `This strong pattern suggests the AI has found an optimal kill order. In the physical game, players would probably discover this too. `;
    }
  }
  t += `</div>`;

  // ---- SKILL ECONOMY ----
  t += `<div class="report-card" style="line-height:1.7;font-size:12px">`;
  t += `<b style="font-size:14px">Skill Economy</b><br><br>`;

  t += `Heroes burn an average of <b>${avgBurns} skills per game</b> as emergency rerolls. `;

  // Find most burned skill
  const burnRanking = Object.entries(allSkills)
    .map(([key, s]) => ({ key, total: s.activated + s.burned, burned: s.burned, activated: s.activated }))
    .filter(s => s.total > 0)
    .sort((a,b) => (b.burned / b.total) - (a.burned / a.total));

  const mostBurned = burnRanking[0];
  if (mostBurned && mostBurned.total > 50) {
    const [hId, ...parts] = mostBurned.key.split('_');
    const burnPct = (mostBurned.burned / mostBurned.total * 100).toFixed(0);
    if (parseInt(burnPct) > 60) {
      t += `<b>${heroNames[hId]}'s ${parts.join(' ')}</b> is burned ${burnPct}% of the time instead of being used for its actual effect. `;
      t += `This means either the skill effect isn't worth using, or combat pressure forces constant emergency rerolls. `;
    }
  }

  // Most impactful skill
  const impactRanking = Object.entries(allSkills)
    .map(([key, s]) => ({ key, activated: s.activated, turnedFight: s.turnedFight, savedKO: s.savedFromKO }))
    .filter(s => s.activated > 10)
    .sort((a,b) => (b.turnedFight + b.savedKO) - (a.turnedFight + a.savedKO));

  const mostImpact = impactRanking[0];
  if (mostImpact) {
    const [hId, ...parts] = mostImpact.key.split('_');
    t += `The most impactful skill is <b>${heroNames[hId]}'s ${parts.join(' ')}</b>, which turned ${mostImpact.turnedFight} fights and saved ${mostImpact.savedKO} KOs. `;
  }

  // Recharge sources
  const rechargeSources = {};
  results.forEach(r => { Object.entries(r.tracker.skillRechargeSources||{}).forEach(([src, cnt]) => { rechargeSources[src] = (rechargeSources[src]||0) + cnt; }); });
  const totalRecharges = Object.values(rechargeSources).reduce((a,b) => a+b, 0);
  if (totalRecharges > 0) {
    const topSource = Object.entries(rechargeSources).sort((a,b) => b[1]-a[1])[0];
    t += `Skills are recharged <b>${totalRecharges} times total</b> across all games, primarily through <b>${topSource[0].replace(/_/g,' ')}</b> (${pct(topSource[1], totalRecharges)}%). `;
  }
  t += `</div>`;

  // ---- GIL ECONOMY ----
  const gilGames = results.filter(r => r.heroes.some(h => (h.gilEarned||0) > 0));
  if (gilGames.length > 0) {
    t += `<div class="report-card" style="line-height:1.7;font-size:12px">`;
    t += `<b style="font-size:14px">Gil Economy</b><br><br>`;

    const totalEarned = gilGames.reduce((s,r) => s + r.heroes.reduce((ss,h) => ss + (h.gilEarned||0), 0), 0);
    const totalSpent = gilGames.reduce((s,r) => s + r.heroes.reduce((ss,h) => ss + (h.gilSpentSkill||0) + (h.gilSpentEquip||0), 0), 0);
    const totalUnspent = gilGames.reduce((s,r) => s + r.heroes.reduce((ss,h) => ss + (h.gil||0), 0), 0);
    const unspentPct = totalEarned > 0 ? (totalUnspent / totalEarned * 100).toFixed(0) : 0;

    t += `Heroes earn <b>${fix1(totalEarned / gilGames.length)} Gil per game</b> across the whole party and leave <b>${unspentPct}% unspent</b>. `;

    if (parseInt(unspentPct) > 70) {
      t += `Most Gil goes to waste. Heroes either can't reach the Entrance to spend it, or the prices are too high relative to earnings. `;
      t += `Consider: lowering recharge/equipment costs, allowing Gil spending at the Hydra, or giving heroes more reasons to visit the Entrance. `;
    } else if (parseInt(unspentPct) > 40) {
      t += `About half the Gil is being used. There's room to make Gil more impactful, but it's contributing to the economy. `;
    } else {
      t += `Gil is being spent efficiently. Heroes are finding opportunities to convert Gil into skills and equipment. `;
    }

    const totalVoluntary = results.reduce((s,r) => s + (r.tracker.gilVisits ? r.tracker.gilVisits.voluntary : 0), 0);
    const totalKOVisits = results.reduce((s,r) => s + (r.tracker.gilVisits ? r.tracker.gilVisits.koRespawn : 0), 0);
    if (totalVoluntary + totalKOVisits > 0) {
      t += `Heroes visit the Entrance <b>${totalVoluntary} times voluntarily</b> and <b>${totalKOVisits} times from KO respawn</b>. `;
      if (totalVoluntary === 0) {
        t += `No one ever goes back on purpose, meaning Gil is only spent by accident when heroes respawn. `;
      }
    }
    t += `</div>`;
  }

  // ---- PACING ----
  t += `<div class="report-card" style="line-height:1.7;font-size:12px">`;
  t += `<b style="font-size:14px">Game Pacing</b><br><br>`;

  const hydraSpawnTurn = fix1(avg(results, r => r.tracker.pacing.hydraSpawn || r.turn));
  const hydraArrival = fix1(avg(results, r => r.tracker.pacing.hydraArrival || r.turn));
  const avgWinTurn = wins.length ? fix1(avg(wins, r => r.turn)) : null;
  const avgLossTurn = losses.length ? fix1(avg(losses, r => r.turn)) : null;

  t += `The Hydra typically spawns on <b>turn ${hydraSpawnTurn}</b> and the first hero arrives at <b>turn ${hydraArrival}</b>. `;

  const explorationPct = parseFloat(hydraSpawnTurn) / parseFloat(avgTurns) * 100;
  const bossPct = (parseFloat(avgTurns) - parseFloat(hydraArrival)) / parseFloat(avgTurns) * 100;

  t += `The exploration phase takes about <b>${explorationPct.toFixed(0)}%</b> of the game, and the boss fight takes about <b>${bossPct.toFixed(0)}%</b>. `;

  if (bossPct < 20) {
    t += `The boss phase is very short. The Hydra either dies quickly or kills the party fast. Consider making the fight last longer for more drama. `;
  } else if (bossPct > 45) {
    t += `The boss fight takes up almost half the game. If it feels like a grind, consider reducing Hydra head STR or starting with fewer heads. `;
  } else {
    t += `This pacing feels balanced — enough time to explore and prepare, with a substantial boss fight at the end. `;
  }

  if (avgWinTurn && avgLossTurn) {
    const turnDiff = parseFloat(avgLossTurn) - parseFloat(avgWinTurn);
    if (turnDiff > 3) {
      t += `Losses take <b>${fix1(turnDiff)} turns longer</b> than wins, meaning losing games drag on. Players are slowly dying rather than getting a quick defeat. `;
    } else if (turnDiff < -2) {
      t += `Losses happen <b>${fix1(Math.abs(turnDiff))} turns earlier</b> than wins. Early misfortune snowballs into defeat. `;
    } else {
      t += `Wins and losses end around the same turn, which means games stay competitive until the end. `;
    }
  }
  t += `</div>`;

  // ---- ACTION ITEMS ----
  if (allFlags.length > 0) {
    t += `<div class="report-card" style="border-left:3px solid var(--ko);line-height:1.7;font-size:12px">`;
    t += `<b style="font-size:14px">Top Issues to Address</b><br><br>`;

    const highFlags = allFlags.filter(f => f.severity === 'high');
    const medFlags = allFlags.filter(f => f.severity === 'medium');
    const uniqueFlags = [];
    const seen = new Set();
    [...highFlags, ...medFlags].forEach(f => { if (!seen.has(f.msg)) { seen.add(f.msg); uniqueFlags.push(f); }});

    uniqueFlags.slice(0, 8).forEach((f, i) => {
      const color = f.severity === 'high' ? 'var(--ko)' : 'var(--mishap)';
      t += `<span style="color:${color};font-weight:600">${i+1}.</span> ${f.msg}<br>`;
    });

    if (uniqueFlags.length === 0) {
      t += `No significant issues found. The game looks well balanced at these settings.`;
    }
    t += `</div>`;
  }

  return t;
}

// ========== BATCH RUN ==========
function runSilentGame() {
  G = initState();
  G._tweaks = currentTweaks || null;
  if (G._tweaks) {
    G.heroes.forEach(function(h) {
      if (G._tweaks.heroStr[h.id] !== undefined) h.str = G._tweaks.heroStr[h.id];
    });
  }
  HEROES.forEach(h => initHeroTracker(G.tracker, h.id));
  let safety = 0;
  while (!G.gameOver && safety < 2000) {
    const hero = G.heroes[G.currentHero];
    G.turn++;
    G.stats.turns++;
    hero.talentUsedThisTurn = false;
    hero.dodgeActive = false;

    // Gil: spend at entrance
    gilSpendAtEntrance(hero);
    hero._justRespawned = false;

    // Turn-start effects
    if (hero.equipment.find(e => e.effect === 'turn_start_recharge')) {
      if (Math.floor(Math.random() * 6) + 1 >= 4) rechargeOneSkill(hero, 'wizard_hat');
    }
    // Herbalist (Gigi): recharge any hero's skill including self (batch sim)
    if (hero.id === 'gigi' && shouldUseSkill(hero, 'Herbalist', { atHydra: G.heroesInHydraArea.has(hero.id) })) {
      const candidates = G.heroes.filter(h => h.skillStates.some(s => s === 'exhausted'));
      const neediest = candidates.sort((a,b) => {
        const aScore = b.skillStates.filter(s => s === 'exhausted').length + (b.id === hero.id ? 0.5 : 0);
        const bScore = a.skillStates.filter(s => s === 'exhausted').length + (a.id === hero.id ? 0.5 : 0);
        return aScore - bScore;
      })[0];
      if (neediest) {
        useSkill(hero, 'Herbalist');
        rechargeOneSkill(neediest, 'herbalist');
        trackSkill(hero.id, 'Herbalist', 'activated');
      }
    }
    // Wild Call (Gigi): draw Wonder until Follower (batch sim)
    if (hero.id === 'gigi' && shouldUseSkill(hero, 'Wild Call', { atHydra: false }) && (!G._tweaks || G._tweaks.followersEnabled)) {
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
      }
    }

    // Hound
    if (hero.houndFollowing) {
      combat(hero, hero.houndFollowing, 'misfortune');
      hero.houndFollowing = null;
      if (G.gameOver) break;
    }

    if (hero.runningToHydra) {
      runToHydra(hero);
    } else if (G.hydraActive && G.heroesInHydraArea.has(hero.id)) {
      hydraAttack(hero);
    } else {
      movePhase(hero);
      // Taunt (Juju): fight random enemy in dungeon (batch sim)
      if (hero.id === 'juju' && !hero.ko && !G.gameOver && !G.hydraActive && shouldUseSkill(hero, 'Taunt', { atHydra: false })) {
        if (G.mishapDeck.length > 0) {
          const enemies = MISHAP_CARDS.filter(c => c.type === 'enemy');
          if (enemies.length > 0) {
            const enemy = enemies[Math.floor(Math.random() * enemies.length)];
            useSkill(hero, 'Taunt');
            trackSkill(hero.id, 'Taunt', 'activated');
            combat(hero, {...enemy}, 'mishap');
          }
        }
      }
      // Shadowstep (Eggo): extra turn in dungeon (batch sim)
      if (hero.id === 'eggo' && !G.gameOver && !hero.ko && !G.hydraActive && shouldUseSkill(hero, 'Shadowstep', { atHydra: false })) {
        useSkill(hero, 'Shadowstep');
        trackSkill(hero.id, 'Shadowstep', 'activated');
        hero.talentUsedThisTurn = false;
        hero.dodgeActive = false;
        movePhase(hero);
      }
    }

    if (!G.gameOver) nextHero();
    safety++;
  }

  // Track stalker turns at end
  G.heroes.forEach(h => {
    h.stalkers.forEach(s => trackStalker(s.name, 'turnsActive'));
  });

  // Capture hero end state
  G.heroes.forEach(h => {
    G.tracker.heroEndState[h.id] = {
      totalStr: totalStr(h),
      equipCount: h.equipment.length,
      equipNames: h.equipment.map(e => e.name),
      followerCount: h.followers.length,
      followerNames: h.followers.map(f => f.name),
      readySkills: readySkillCount(h),
      relics: h.heldRelics.length,
      gil: h.gil || 0,
      stalkerCount: h.stalkers.length,
      ko: initHeroTracker(G.tracker, h.id).ko
    };
  });
  // Enemies still alive at game end
  G.tracker.enemiesAtGameEnd = (G.enemiesOnBoard || []).map(e => e.name || (e.card && e.card.name) || 'unknown');

  return {
    victory: G.victory,
    turn: G.turn,
    stats: {...G.stats},
    tracker: G.tracker,
    heroes: G.heroes.map(h => ({
      id:h.id,
      equipment:h.equipment.map(e=>({name:e.name, str:e.str||0})),
      followers:h.followers.map(f=>f.name),
      relics:h.heldRelics.length,
      relicNames:h.heldRelics.map(r=>r.name),
      stalkers:h.stalkers.map(s=>s.name),
      followerCount: h.followers.length,
      followerNames: h.followers.map(f => f.name),
      equipCount: h.equipment.length,
      totalStr:totalStr(h),
      readySkills:readySkillCount(h),
      ko:initHeroTracker(G.tracker,h.id).ko,
      gil:h.gil||0,
      gilEarned:h.gilEarned||0,
      gilSpentSkill:h.gilSpentSkill||0,
      gilSpentEquip:h.gilSpentEquip||0
    })),
    defeatCause: !G.victory ? classifyDefeat(G) : null,
    roomsVisited: G.roomsVisited
  };
}

function classifyDefeat(state) {
  const dm = state.tracker.deathMoments;
  if (dm.length === 0) return { cause:'unknown', detail:'No death moment recorded' };
  const last = dm[dm.length - 1];
  if (last.context.includes('overflow')) {
    return { cause:'hydra_overflow', detail:last.context, turn:last.turn };
  }
  if (last.context.includes('0 relics')) {
    return { cause:'no_relics', detail:`${last.hero} KO at Hydra with no relics left`, turn:last.turn, hero:last.hero };
  }
  return { cause:'other', detail:last.context, turn:last.turn };
}

function runBatch() {
  homeRunBatch();
}

function runBatchInternal(count) {
  document.getElementById('batchBtn').disabled = true;
  document.getElementById('statusBar').textContent = 'Running batch: 0/' + count + '...';

  batchResults = [];

  let i = 0;
  function batchStep() {
    const batchSize = Math.min(5, count - i);
    for (let j = 0; j < batchSize; j++) {
      batchResults.push(runSilentGame());
      i++;
    }
    document.getElementById('statusBar').textContent = 'Running batch: ' + i + '/' + count + '...';
    if (i < count) {
      setTimeout(batchStep, 0);
    } else {
      lastReport = generateReport(batchResults);
      document.getElementById('batchBtn').disabled = false;
      document.getElementById('reportBtn').disabled = false;
      document.getElementById('statusBar').textContent = 'Batch complete: ' + count + ' games. Click Report to view analysis.';
      showLastReport();
    }
  }
  setTimeout(batchStep, 10);
}

function showLastReport() {
  if (!lastReport) return;
  document.getElementById('reportContent').innerHTML = lastReport;
  document.getElementById('reportOverlay').style.display = 'flex';
  organizeReportTabs();
}

function organizeReportTabs() {
  const container = document.getElementById('reportContent');
  const tabs = container.querySelector('.report-tabs');
  if (!tabs) return; // single game report, no tabs

  // Map section titles to tabs
  const tabMap = {
    'tab-overview': ['Overview','Game Pacing','Gap Analysis'],
    'tab-heroes': ['Hero Performance','Hero × Enemy','Hero × Hydra'],
    'tab-skills-equip': ['Skill Analysis','Equipment Analysis'],
    'tab-enemies': ['Enemy Design','Trap Analysis','Follower'],
    'tab-hydra-econ': ['Gil Economy','Hydra Fight'],
    'tab-analysis': ['Textual Analysis']
  };
  const tabOrder = ['tab-overview','tab-heroes','tab-skills-equip','tab-enemies','tab-hydra-econ','tab-analysis'];

  // Create tab content containers
  const tabDivs = {};
  tabOrder.forEach(id => {
    const div = document.createElement('div');
    div.id = id;
    div.className = 'report-tab-content' + (id === 'tab-overview' ? ' active' : '');
    tabDivs[id] = div;
  });

  // Sort sections into tabs
  const sections = container.querySelectorAll('.report-section');
  sections.forEach(section => {
    const h3 = section.querySelector('h3');
    if (!h3) return;
    const title = h3.textContent.replace(/\s*\(.*\)/, '').trim();
    let placed = false;
    Object.entries(tabMap).forEach(([tabId, titles]) => {
      if (titles.some(t => title.startsWith(t))) {
        tabDivs[tabId].appendChild(section);
        placed = true;
      }
    });
    if (!placed) {
      tabDivs['tab-overview'].appendChild(section);
    }
  });

  // Insert tab divs in order after the tabs bar
  const parent = tabs.parentNode;
  tabOrder.forEach(id => {
    parent.insertBefore(tabDivs[id], tabs.nextSibling);
  });
  // Re-insert in correct order
  let anchor = tabs.nextSibling;
  tabOrder.forEach(id => {
    parent.insertBefore(tabDivs[id], anchor);
    anchor = tabDivs[id].nextSibling;
  });
}

function switchReportTab(el, tabId) {
  // Update tab buttons
  el.parentNode.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  // Update content
  document.querySelectorAll('.report-tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
}

function closeReport() {
  document.getElementById('reportOverlay').style.display = 'none';
  goHome();
}

function htmlToMarkdown(html) {
  let md = html;
  // Headers
  md = md.replace(/<h2>(.*?)<\/h2>/g, '# $1\n\n');
  md = md.replace(/<h3>(.*?)<\/h3>/g, '## $1\n\n');
  // Bold
  md = md.replace(/<b[^>]*>(.*?)<\/b>/g, '**$1**');
  md = md.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
  // Italic
  md = md.replace(/<i[^>]*>(.*?)<\/i>/g, '*$1*');
  md = md.replace(/<em>(.*?)<\/em>/g, '*$1*');
  // Tags/badges
  md = md.replace(/<span class="tag op-tag">(.*?)<\/span>/g, '[$1]');
  md = md.replace(/<span class="tag weak-tag">(.*?)<\/span>/g, '[$1]');
  md = md.replace(/<span class="tag need-tag">(.*?)<\/span>/g, '[$1]');
  md = md.replace(/<span class="tag insight-tag">(.*?)<\/span>/g, '[$1]');
  // List items
  md = md.replace(/<li[^>]*>(.*?)<\/li>/g, '- $1\n');
  md = md.replace(/<ul[^>]*>/g, '\n');
  md = md.replace(/<\/ul>/g, '\n');
  // Line breaks
  md = md.replace(/<br\s*\/?>/g, '\n');
  // Paragraphs
  md = md.replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n\n');
  // Divs with report-stat (key-value rows)
  md = md.replace(/<div class="report-stat"><span class="rl">(.*?)<\/span><span class="rv"[^>]*>(.*?)<\/span><\/div>/g, '- **$1**: $2\n');
  // Remaining divs — extract content
  md = md.replace(/<div[^>]*>/g, '\n');
  md = md.replace(/<\/div>/g, '\n');
  // Remove remaining spans
  md = md.replace(/<span[^>]*>(.*?)<\/span>/g, '$1');
  // Remove remaining tags
  md = md.replace(/<[^>]+>/g, '');
  // Decode HTML entities
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&times;/g, 'x');
  // Clean up excessive newlines
  md = md.replace(/\n{4,}/g, '\n\n\n');
  md = md.replace(/[ \t]+\n/g, '\n');
  return md.trim();
}

function downloadReportMD() {
  const reportEl = document.getElementById('reportContent');
  if (!reportEl || !reportEl.innerHTML) return;
  var mdPrefix = '';
  if (currentTweaks) {
    var tweakDiffs = getTweaksDiff(currentTweaks);
    if (tweakDiffs.length > 0) {
      mdPrefix = '# Balance Changes Applied\nThese changes were applied to the base game for this playtest run:\n';
      tweakDiffs.forEach(function(d) { mdPrefix += '- ' + d + '\n'; });
      mdPrefix += '\n---\n\n';
    }
  }
  const md = mdPrefix + htmlToMarkdown(reportEl.innerHTML);
  const date = new Date().toISOString().slice(0,16).replace('T','_').replace(':','-');
  const filename = 'JUJU_Playtest_Report_' + date + '.md';
  const blob = new Blob([md], {type: 'text/markdown'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadGameLogMD() {
  if (!G) return;
  let md = '# JUJU Castle — Game Log\n\n';
  md += `**Result:** ${G.victory ? 'VICTORY' : 'DEFEAT'} in ${G.turn} turns\n\n`;
  md += `## Stats\n`;
  md += `- Combats: ${G.stats.combats}\n`;
  md += `- KOs: ${G.stats.ko}\n`;
  md += `- Monsters Killed: ${G.stats.monstersKilled}\n`;
  md += `- Skill Burns: ${G.stats.skillBurns}\n`;
  md += `- Relics Spent: ${G.stats.relicsSpent}\n\n`;
  md += `## Heroes (end state)\n`;
  G.heroes.forEach(h => {
    md += `### ${h.name} ${h.title} (STR ${totalStr(h)})\n`;
    md += `- Equipment: ${h.equipment.map(e => e.name).join(', ') || 'none'}\n`;
    md += `- Followers: ${h.followers.map(f => f.name).join(', ') || 'none'}\n`;
    md += `- Relics: ${h.heldRelics.map(r => r.name).join(', ') || 'none'}\n`;
    md += `- Skills: ${h.skills.map((s,i) => s.name + ' (' + h.skillStates[i] + ')').join(', ')}\n\n`;
  });
  md += `## Full Log\n\n`;
  G.log.forEach(entry => {
    md += entry.msg + '\n';
  });
  const date = new Date().toISOString().slice(0,16).replace('T','_').replace(':','-');
  const filename = `JUJU_GameLog_${date}.md`;
  const blob = new Blob([md], {type: 'text/markdown'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Also generate single-game report on game end
function onGameEnd() {
  if (!G) return;
  G.heroes.forEach(h => {
    h.stalkers.forEach(s => trackStalker(s.name, 'turnsActive'));
  });
  lastReport = generateSingleGameReport();
  document.getElementById('reportBtn').disabled = false;
  showLastReport();
}

function generateSingleGameReport() {
  const heroNames = {juju:'Juju',gigi:'Gigi',lulu:'Lulu',eggo:'Eggo'};
  const heroIds = ['juju','gigi','lulu','eggo'];
  let html = `<h2>SINGLE GAME REPORT</h2>`;

  // Result banner
  if (G.victory) {
    html += `<div class="report-card" style="border-left:3px solid var(--heal);font-size:14px"><b style="color:var(--heal)">🎉 VICTORY</b> in ${G.turn} turns (${G.round} rounds)</div>`;
  } else {
    const cause = G.tracker.deathMoments.length > 0 ? G.tracker.deathMoments[G.tracker.deathMoments.length-1] : null;
    let causeText = 'Unknown';
    if (cause) {
      if (cause.context.includes('overflow')) causeText = 'Hydra Overflow (heads exceeded max)';
      else if (cause.context.includes('0 relics')) causeText = `${cause.hero} KO at Hydra with no relics left`;
      else causeText = cause.context;
    }
    html += `<div class="report-card" style="border-left:3px solid var(--ko);font-size:14px"><b style="color:var(--ko)">💀 DEFEAT</b> at turn ${G.turn}<br><span style="color:var(--dim)">Cause: ${causeText}</span></div>`;
  }

  // Game stats
  html += `<div class="report-section"><h3>Game Stats</h3><div class="report-card">`;
  html += `<div class="report-stat"><span class="rl">Turns</span><span class="rv">${G.turn}</span></div>`;
  html += `<div class="report-stat"><span class="rl">Combats</span><span class="rv">${G.stats.combats}</span></div>`;
  html += `<div class="report-stat"><span class="rl">Monsters Killed</span><span class="rv">${G.stats.monstersKilled}</span></div>`;
  html += `<div class="report-stat"><span class="rl">Total KOs</span><span class="rv">${G.stats.ko}</span></div>`;
  html += `<div class="report-stat"><span class="rl">Skill Burns</span><span class="rv">${G.stats.skillBurns}</span></div>`;
  html += `<div class="report-stat"><span class="rl">Relics Spent</span><span class="rv">${G.stats.relicsSpent}</span></div>`;
  html += `<div class="report-stat"><span class="rl">Tiles Explored</span><span class="rv">${G.tilesPlaced}/36</span></div>`;
  html += `<div class="report-stat"><span class="rl">Hydra Heads Destroyed</span><span class="rv">${G.hydraDestroyedCount}</span></div>`;
  html += `</div></div>`;

  // Per-hero breakdown
  html += `<div class="report-section"><h3>Hero Breakdown</h3>`;
  heroIds.forEach(hid => {
    const hero = G.heroes.find(h => h.id === hid);
    const ht = initHeroTracker(G.tracker, hid);
    if (!hero) return;

    html += `<div class="report-card" style="border-left:3px solid var(--${hid})">`;
    html += `<b style="color:var(--${hid});font-size:13px">${hero.name} ${hero.title}</b><br>`;

    // Final state
    html += `<div style="margin:6px 0;padding:4px 6px;background:#0e0e16;border-radius:3px;font-size:11px">`;
    html += `<b>Final State:</b> Total STR <b>${totalStr(hero)}</b> (base ${hero.str})`;
    html += `<br>Equipment: ${hero.equipment.length > 0 ? hero.equipment.map(e => e.name + ' (+' + e.str + ')').join(', ') : 'none'}`;
    html += `<br>Followers: ${hero.followers.length > 0 ? hero.followers.map(f => f.name).join(', ') : 'none'}`;
    html += `<br>Relics: ${hero.heldRelics.length > 0 ? hero.heldRelics.map(r => r.name + (r.owner === hid ? ' ★' : '')).join(', ') : 'none'}`;
    html += `<br>Stalkers: ${hero.stalkers.length > 0 ? hero.stalkers.map(s => s.name).join(', ') : 'none'}`;
    const exhaustLog = hero._skillExhaustLog || [];
    html += `<br>Skills at end: `;
    hero.skills.forEach(function(s, i) {
      const ready = hero.skillStates[i] === 'ready';
      const bg = ready ? '#1a3a2a' : '#2a1a1a';
      const color = ready ? 'var(--heal)' : '#884444';
      let label = s.name;
      if (ready) {
        label += ' ✓';
      } else {
        // Find why exhausted: activated as skill, or burned/drained?
        const skillKey = hid + '_' + s.name;
        const used = G.tracker.skills[skillKey];
        const wasActivated = used && (used.activated > 0 || used.savedFromKO > 0);
        if (wasActivated) {
          label += ' ✗ used';
        } else {
          // Check exhaust log for reason
          const entry = exhaustLog.filter(e => e.skill === s.name);
          if (entry.length > 0) {
            label += ' ✗ ' + entry[entry.length-1].reason;
          } else {
            label += ' ✗ burned';
          }
        }
      }
      html += '<span style="padding:1px 4px;border-radius:2px;margin:1px;display:inline-block;background:' + bg + ';color:' + color + '">' + label + '</span>';
    });
    html += `</div>`;

    // Combat record
    html += `<div style="margin:4px 0;font-size:11px">`;
    html += `⚔ Combats: <b>${ht.combats}</b> (${ht.wins}W/${ht.losses}L, ${ht.combats > 0 ? ((ht.wins/ht.combats)*100).toFixed(0) : 0}% win rate)`;
    html += ` | 💀 KOs: <b>${ht.ko}</b>`;
    html += ` | 🔄 Skill Burns: <b>${ht.skillsBurned || 0}</b>`;
    html += ` | 💎 Relics Spent: <b>${ht.relicsSpent || 0}</b>`;
    if (gilEnabled()) {
      html += `<br>💰 Gil: earned <b>${hero.gilEarned}</b>, spent on skills <b>${hero.gilSpentSkill}</b>, spent on equip <b>${hero.gilSpentEquip}</b>, remaining <b>${hero.gil}</b>`;
    }
    html += `</div>`;

    // Skills used — detailed breakdown
    const heroSkillDefs = HEROES.find(h => h.id === hid).skills;
    const exhausLog = hero._skillExhaustLog || [];
    html += `<div style="margin:4px 0;font-size:11px"><b>Skill Breakdown:</b>`;
    html += `<table style="width:100%;margin-top:4px;font-size:10px;border-collapse:collapse">`;
    html += `<tr style="color:var(--dim);border-bottom:1px solid var(--border)"><th style="text-align:left;padding:2px">Skill</th><th style="text-align:center;padding:2px">Used</th><th style="text-align:center;padding:2px">Where</th><th style="text-align:center;padding:2px">Burned</th><th style="text-align:center;padding:2px">By What</th><th style="text-align:center;padding:2px">Impact</th></tr>`;
    heroSkillDefs.forEach(sd => {
      const key = hid + '_' + sd.name;
      const d = G.tracker.skills[key] || { activated:0, burned:0, savedFromKO:0, turnedFight:0, activatedDungeon:0, activatedHydra:0, burnedDungeon:0, burnedHydra:0 };
      // Burn reasons from exhaust log
      const burnReasons = exhausLog.filter(e => e.skill === sd.name && e.reason !== 'unknown')
        .map(e => e.reason).filter((v,i,a) => a.indexOf(v) === i);
      const burnBy = burnReasons.length > 0 ? burnReasons.join(', ') : (d.burned > 0 ? 'Skill Burn' : '-');
      const where = d.activated > 0 ? (d.activatedDungeon > 0 && d.activatedHydra > 0 ? `${d.activatedDungeon}D/${d.activatedHydra}H` : d.activatedHydra > 0 ? 'Hydra' : 'Dungeon') : '-';
      let impact = [];
      if (d.savedFromKO > 0) impact.push(`saved ${d.savedFromKO} KO`);
      if (d.turnedFight > 0) impact.push(`turned ${d.turnedFight} fight`);
      const impactStr = impact.length > 0 ? impact.join(', ') : '-';
      const usedColor = d.activated > 0 ? 'var(--heal)' : 'var(--dim)';
      const burnColor = d.burned > 0 ? '#cc8833' : 'var(--dim)';
      html += `<tr style="border-bottom:1px solid #1a1a2a"><td style="padding:2px 4px">${sd.name}</td>`;
      html += `<td style="text-align:center;padding:2px;color:${usedColor}">${d.activated || 0}x</td>`;
      html += `<td style="text-align:center;padding:2px;color:var(--dim)">${where}</td>`;
      html += `<td style="text-align:center;padding:2px;color:${burnColor}">${d.burned || 0}x</td>`;
      html += `<td style="text-align:center;padding:2px;color:var(--dim);font-size:9px">${burnBy}</td>`;
      html += `<td style="text-align:center;padding:2px;color:${impact.length>0?'var(--heal)':'var(--dim)'};font-size:9px">${impactStr}</td></tr>`;
    });
    // Skill Burn total
    const sb = Object.entries(G.tracker.skills).find(([k]) => k === hid + '_Skill Burn');
    if (sb && sb[1].activated > 0) {
      html += `<tr style="border-top:1px solid var(--border);background:#1a1015"><td style="padding:2px 4px;color:#cc8833">Skill Burn (reroll)</td>`;
      html += `<td style="text-align:center;padding:2px;color:#cc8833">${sb[1].activated}x</td>`;
      const sbWhere = (sb[1].activatedDungeon||0) > 0 && (sb[1].activatedHydra||0) > 0 ? `${sb[1].activatedDungeon}D/${sb[1].activatedHydra}H` : (sb[1].activatedHydra||0) > 0 ? 'Hydra' : 'Dungeon';
      html += `<td style="text-align:center;padding:2px;color:var(--dim)">${sbWhere}</td>`;
      html += `<td colspan="2" style="padding:2px"></td>`;
      html += `<td style="text-align:center;padding:2px;color:${sb[1].turnedFight>0?'var(--heal)':'var(--dim)'}">turned ${sb[1].turnedFight||0} fight</td></tr>`;
    }
    html += `</table></div>`;

    // Talent info
    const talent = G.tracker.talents[hid];
    if (talent) {
      html += `<div style="margin:4px 0;font-size:11px">`;
      html += `🔥 Talent (${hero.talent}): triggered <b>${talent.triggered || 0}x</b>`;
      if (talent.blocked > 0) html += `, blocked ${talent.blocked}x`;
      html += ` (combat: ${talent.combatImpact || 0}, movement: ${talent.movementImpact || 0})`;
      html += `</div>`;
    }

    // Combat margin analysis
    if (ht.combats > 0) {
      html += `<div style="margin:4px 0;font-size:11px">`;
      html += `📊 Avg win margin: <b>+${ht.damageDealt > 0 && ht.wins > 0 ? (ht.damageDealt / ht.wins).toFixed(1) : '?'}</b>`;
      html += `</div>`;
    }

    html += `</div>`;
  });
  html += `</div>`;

  // Dungeon combat log
  const combatLog = G.tracker.combatLog || [];
  if (combatLog.length > 0) {
    html += `<div class="report-section"><h3>Dungeon Combat Log</h3>`;
    html += `<p style="color:var(--dim);font-size:10px;margin-bottom:6px">Every enemy fight in the dungeon, in order. Shows who fought whom and the result.</p>`;

    // Per-hero combat table
    heroIds.forEach(hid => {
      const heroCombats = combatLog.filter(c => c.heroId === hid);
      if (heroCombats.length === 0) return;
      const wins = heroCombats.filter(c => c.won);
      const losses = heroCombats.filter(c => !c.won);
      html += `<div class="report-card" style="border-left:3px solid var(--${hid})">`;
      html += `<b style="color:var(--${hid})">${heroNames[hid]}</b> — ${heroCombats.length} fights (${wins.length}W/${losses.length}L)<br>`;
      if (wins.length > 0) {
        html += `<div style="margin:4px 0"><span style="color:var(--heal)">Victories:</span> `;
        html += wins.map(c => `${c.enemy}${c.skill ? ' ('+c.skill+')' : ''}`).join(', ');
        html += `</div>`;
      }
      if (losses.length > 0) {
        html += `<div style="margin:4px 0"><span style="color:var(--ko)">Defeats:</span> `;
        html += losses.map(c => `<b>${c.enemy}</b> (STR ${c.enemyStr}, lost by ${-c.margin})`).join(', ');
        html += `</div>`;
      }
      html += `</div>`;
    });

    // Full timeline
    html += `<div class="report-card" style="font-size:11px;max-height:200px;overflow-y:auto">`;
    html += `<b>Full Timeline</b><br>`;
    combatLog.forEach(c => {
      const icon = c.won ? '✓' : '✗';
      const color = c.won ? 'var(--heal)' : 'var(--ko)';
      html += `<div style="padding:1px 0;color:${color}">${icon} T${c.turn} <b style="color:var(--${c.heroId})">${c.hero}</b> vs ${c.enemy} (STR ${c.enemyStr}) [${c.tier}]${c.skill ? ' — ' + c.skill : ''}</div>`;
    });
    html += `</div></div>`;
  }

  // Hydra arrival state
  const arrivals = G.tracker.hydraArrivals || [];
  if (arrivals.length > 0) {
    html += `<div class="report-section"><h3>Hydra Arrival</h3>`;
    html += `<p style="color:var(--dim);font-size:10px;margin-bottom:6px">What each hero had when they reached the Hydra. Multiple entries = hero was KO'd and had to run back.</p>`;
    // Track how many times each hero arrived
    const arrivalCount = {};
    arrivals.forEach(a => {
      arrivalCount[a.heroId] = (arrivalCount[a.heroId] || 0) + 1;
      const visitNum = arrivalCount[a.heroId];
      const isReturn = visitNum > 1;
      const skillList = a.skillNames.map(s => `<span style="color:${s.ready?'var(--heal)':'#884444'}">${s.name}</span>`).join(', ');
      const equipList = a.equipment.length > 0 ? a.equipment.join(', ') : 'none';
      const followerList = a.followers.length > 0 ? a.followers.join(', ') : 'none';
      const relicList = a.relics.length > 0 ? a.relics.join(', ') : 'none';
      const label = isReturn ? ` <span style="color:var(--ko)">(return #${visitNum} after KO)</span>` : ' <span style="color:var(--wonder)">(first arrival)</span>';
      const borderStyle = isReturn ? 'border-left:3px dashed var(--ko)' : 'border-left:3px solid var(--' + a.heroId + ')';
      html += `<div class="report-card" style="${borderStyle}">`;
      html += `<b style="color:var(--${a.heroId})">${a.hero}</b> turn <b>${a.turn}</b>${label} — Total STR: <b>${a.totalStr}</b><br>`;
      html += `<div style="font-size:11px;margin-top:3px">`;
      html += `Skills: ${a.readySkills}/${a.totalSkills} ready → ${skillList}<br>`;
      html += `Equipment: ${equipList}<br>`;
      html += `Followers: ${followerList}<br>`;
      html += `Relics held: ${relicList} (party total: ${a.partyRelics})`;
      html += `</div></div>`;
    });
    html += `</div>`;
  }

  // Hydra combat timeline
  const hydraLog = G.tracker.hydraCombatLog || [];
  if (hydraLog.length > 0) {
    html += `<div class="report-section"><h3>Hydra Fight Timeline</h3>`;
    html += `<p style="color:var(--dim);font-size:10px;margin-bottom:6px">Every attack at the Hydra, in order.</p>`;
    html += `<div class="report-card" style="font-size:11px;max-height:300px;overflow-y:auto">`;
    hydraLog.forEach((a, i) => {
      const won = a.won;
      const icon = won ? '✓' : '✗';
      const color = won ? 'var(--heal)' : 'var(--ko)';
      const margin = a.margin >= 0 ? '+' + a.margin : a.margin;
      html += `<div style="padding:2px 0;border-bottom:1px solid #1a1a2a;color:${color}">`;
      html += `${icon} T${a.turn} <b style="color:var(--${a.heroId})">${a.hero}</b> → ${a.head} (STR ${a.headStr}): rolled ${a.roll}, total <b>${a.finalHeroTotal}</b> vs ${a.headStr} = <b>${margin}</b>`;
      html += ` [${a.aliveHeads} heads alive, max ${a.maxHeads}]`;
      html += `</div>`;
    });
    html += `</div>`;

    // Hydra summary
    const hydraWins = hydraLog.filter(a => a.won).length;
    const hydraLosses = hydraLog.filter(a => !a.won).length;
    html += `<div class="report-card">`;
    html += `<b>Summary:</b> ${hydraLog.length} attacks, ${hydraWins} won (${((hydraWins/hydraLog.length)*100).toFixed(0)}%), ${hydraLosses} lost`;
    const avgHT = (hydraLog.reduce((s,a) => s + a.finalHeroTotal, 0) / hydraLog.length).toFixed(1);
    const avgHS = (hydraLog.reduce((s,a) => s + a.headStr, 0) / hydraLog.length).toFixed(1);
    html += `<br>Avg hero total: <b>${avgHT}</b> vs avg head STR: <b>${avgHS}</b> (gap: ${(avgHT - avgHS).toFixed(1)})`;
    // Per-hero at hydra
    heroIds.forEach(hid => {
      const ha = hydraLog.filter(a => a.heroId === hid);
      if (ha.length === 0) return;
      const hw = ha.filter(a => a.won).length;
      html += `<br><span style="color:var(--${hid})">${heroNames[hid]}</span>: ${ha.length} attacks, ${hw}W/${ha.length-hw}L`;
    });
    html += `</div>`;
    html += `</div>`;
  }

  // Key moments (from tracker)
  const deaths = G.tracker.deathMoments;
  const closes = G.tracker.closeCalls;
  if (deaths.length > 0 || closes.length > 0) {
    html += `<div class="report-section"><h3>Key Moments</h3>`;
    if (closes.length > 0) {
      html += `<div class="report-card"><b>Close Calls (won by 0-1):</b><br>`;
      closes.forEach(c => {
        html += `<div style="font-size:11px;padding:1px 0">⚡ ${c.hero} vs ${c.enemy}: ${c.heroTotal} vs ${c.enemyTotal} (margin +${c.margin})</div>`;
      });
      html += `</div>`;
    }
    if (deaths.length > 0) {
      html += `<div class="report-card" style="border-left:3px solid var(--ko)"><b>Death Moments:</b><br>`;
      deaths.forEach(d => {
        html += `<div style="font-size:11px;padding:1px 0">💀 Turn ${d.turn}: ${d.hero} — ${d.context}</div>`;
      });
      html += `</div>`;
    }
    html += `</div>`;
  }

  // Skill gap section removed — skills are finalized

  // === AI GAME ANALYSIS ===
  html += `<div class="report-section"><h3>Game Analysis</h3>`;
  html += generateGameAnalysis();
  html += `</div>`;

  return html;
}

function generateGameAnalysis() {
  const heroNames = {juju:'Juju',gigi:'Gigi',lulu:'Lulu',eggo:'Eggo'};
  const arrivals = G.tracker.hydraArrivals || [];
  const hydraLog = G.tracker.hydraCombatLog || [];
  const combatLog = G.tracker.combatLog || [];
  const deaths = G.tracker.deathMoments || [];
  let paragraphs = [];

  // 1. Overall narrative
  if (G.victory) {
    const avgHydraWR = hydraLog.length > 0 ? (hydraLog.filter(a=>a.won).length / hydraLog.length * 100).toFixed(0) : 0;
    paragraphs.push(`The party won in ${G.turn} turns. ${hydraLog.length > 0 ? `They attacked the Hydra ${hydraLog.length} times with a ${avgHydraWR}% success rate.` : ''} ${G.stats.ko === 0 ? 'Remarkably, no hero was KO\'d the entire game.' : `The party suffered ${G.stats.ko} KO${G.stats.ko>1?'s':''} along the way, but recovered.`}`);
  } else {
    const cause = deaths.length > 0 ? deaths[deaths.length-1] : null;
    if (cause && cause.context.includes('overflow')) {
      const aliveHeads = G.hydraHeads ? G.hydraHeads.filter(h=>!h.destroyed).length : '?';
      paragraphs.push(`The party lost at turn ${G.turn} due to Hydra overflow. Despite destroying ${G.hydraDestroyedCount} heads, new heads kept growing after failed attacks. The max head limit shrank to ${G.hydraMaxHeads} and ${aliveHeads} heads were alive when overflow triggered.`);
    } else if (cause && cause.context.includes('relics')) {
      paragraphs.push(`The party lost at turn ${G.turn} because all relics were spent. ${cause.hero} was KO\'d at the Hydra with no relics left to save them. The party burned through ${G.stats.relicsSpent} relics during the Hydra fight.`);
    } else {
      paragraphs.push(`The party lost at turn ${G.turn}.`);
    }
  }

  // 2. Dungeon phase analysis
  const dungeonKOs = G.stats.ko;
  const dungeonCombats = combatLog.length;
  const dungeonLosses = combatLog.filter(c => !c.won).length;
  if (dungeonCombats > 0) {
    let dungeonNote = `During the dungeon phase, the party fought ${dungeonCombats} enemies and lost ${dungeonLosses} fights.`;
    if (dungeonLosses === 0) {
      dungeonNote += ` A clean dungeon run — all enemies defeated without any combat losses.`;
    } else {
      const lostTo = combatLog.filter(c => !c.won).map(c => `${c.enemy} (STR ${c.enemyStr})`);
      dungeonNote += ` Lost to: ${lostTo.join(', ')}.`;
    }
    // Equipment status
    const heroesWithEquip = G.heroes.filter(h => h.equipment.length > 0).length;
    if (heroesWithEquip <= 1) {
      dungeonNote += ` Only ${heroesWithEquip} hero had equipment by the time the Hydra fight started — the party was underequipped.`;
    }
    paragraphs.push(dungeonNote);
  }

  // 3. Hydra arrival analysis
  if (arrivals.length > 0) {
    const firstArrivals = {};
    arrivals.forEach(a => { if (!firstArrivals[a.heroId]) firstArrivals[a.heroId] = a; });
    const avgReadySkills = Object.values(firstArrivals).reduce((s,a) => s + a.readySkills, 0) / Object.keys(firstArrivals).length;
    const avgStr = Object.values(firstArrivals).reduce((s,a) => s + a.totalStr, 0) / Object.keys(firstArrivals).length;
    const firstRelics = Object.values(firstArrivals)[0]?.partyRelics || 0;

    let arrivalNote = `Heroes arrived at the Hydra with an average of ${avgReadySkills.toFixed(1)} ready skills and ${avgStr.toFixed(0)} total STR.`;
    if (avgReadySkills < 1.5) {
      arrivalNote += ` This is low — most skills were already exhausted from the dungeon. The party entered the boss fight without their key abilities.`;
    } else if (avgReadySkills >= 3) {
      arrivalNote += ` Well-prepared, with most skills available for the Hydra fight.`;
    }

    // Who arrived weakest
    const weakest = Object.values(firstArrivals).sort((a,b) => a.totalStr - b.totalStr)[0];
    if (weakest && weakest.totalStr <= 2) {
      arrivalNote += ` ${weakest.hero} arrived particularly weak (STR ${weakest.totalStr}) — essentially dead weight at the Hydra.`;
    }

    // Returns after KO
    const returns = arrivals.filter((a,i) => {
      const prevCount = arrivals.slice(0,i).filter(p => p.heroId === a.heroId).length;
      return prevCount > 0;
    });
    if (returns.length > 0) {
      const returnHeroes = [...new Set(returns.map(r => r.hero))];
      arrivalNote += ` ${returnHeroes.join(' and ')} ${returnHeroes.length > 1 ? 'were' : 'was'} KO'd and had to run back — arriving stripped of equipment and skills.`;
    }
    paragraphs.push(arrivalNote);
  }

  // 4. Hydra fight analysis
  if (hydraLog.length > 0) {
    const hydraWins = hydraLog.filter(a => a.won).length;
    const hydraLosses = hydraLog.filter(a => !a.won).length;
    const avgGap = (hydraLog.reduce((s,a) => s + a.finalHeroTotal - a.headStr, 0) / hydraLog.length).toFixed(1);

    let hydraNote = `The Hydra fight lasted ${hydraLog.length} attacks (${hydraWins}W/${hydraLosses}L).`;
    if (Number(avgGap) < 0) {
      hydraNote += ` On average, heroes were ${Math.abs(avgGap)} points BELOW the heads — they needed lucky rolls to win any attack. The STR gap was the core problem.`;
    } else if (Number(avgGap) < 2) {
      hydraNote += ` The margin was razor-thin (avg ${avgGap} above heads). Every roll mattered and a bad streak was enough to cascade into defeat.`;
    } else {
      hydraNote += ` Heroes had a comfortable ${avgGap}-point average advantage over the heads.`;
    }

    // Per-hero performance at Hydra
    const heroPerf = {};
    hydraLog.forEach(a => {
      if (!heroPerf[a.heroId]) heroPerf[a.heroId] = {w:0,l:0,total:0};
      heroPerf[a.heroId].total++;
      if (a.won) heroPerf[a.heroId].w++; else heroPerf[a.heroId].l++;
    });
    const mvp = Object.entries(heroPerf).sort((a,b) => b[1].w - a[1].w)[0];
    const weakLink = Object.entries(heroPerf).sort((a,b) => (a[1].w/a[1].total) - (b[1].w/b[1].total))[0];
    if (mvp) hydraNote += ` ${heroNames[mvp[0]]} was the MVP with ${mvp[1].w} wins.`;
    if (weakLink && weakLink[1].total >= 3 && (weakLink[1].w/weakLink[1].total) < 0.4) {
      hydraNote += ` ${heroNames[weakLink[0]]} struggled, winning only ${((weakLink[1].w/weakLink[1].total)*100).toFixed(0)}% of attacks.`;
    }

    // Hardest head
    const headStats = {};
    hydraLog.forEach(a => {
      if (!headStats[a.head]) headStats[a.head] = {w:0,l:0,str:a.headStr};
      if (a.won) headStats[a.head].w++; else headStats[a.head].l++;
    });
    const hardestHead = Object.entries(headStats).sort((a,b) => (a[1].w/(a[1].w+a[1].l)) - (b[1].w/(b[1].w+b[1].l)))[0];
    if (hardestHead && hardestHead[1].l > 0) {
      hydraNote += ` ${hardestHead[0]} (STR ${hardestHead[1].str}) was the toughest matchup (${hardestHead[1].w}W/${hardestHead[1].l}L).`;
    }
    paragraphs.push(hydraNote);
  }

  // 5. Key insight / what to change
  let insight = '';
  if (!G.victory) {
    // Diagnose the root cause
    const firstArrivals = {};
    (arrivals || []).forEach(a => { if (!firstArrivals[a.heroId]) firstArrivals[a.heroId] = a; });
    const avgArrivalStr = Object.values(firstArrivals).length > 0
      ? Object.values(firstArrivals).reduce((s,a) => s + a.totalStr, 0) / Object.values(firstArrivals).length : 0;
    const avgArrivalSkills = Object.values(firstArrivals).length > 0
      ? Object.values(firstArrivals).reduce((s,a) => s + a.readySkills, 0) / Object.values(firstArrivals).length : 0;
    const hydraWinRate = hydraLog.length > 0 ? (hydraLog.filter(a=>a.won).length / hydraLog.length * 100) : 0;

    if (avgArrivalStr < 4) {
      insight += `Root cause: heroes arrived at the Hydra too weak (avg STR ${avgArrivalStr.toFixed(0)}). They need more equipment from the dungeon. `;
      insight += `Fix options: add more Dread Dungeons (more legendary draws), reduce KOs in dungeon (so they keep their gear), or increase base hero STR.`;
    } else if (avgArrivalSkills < 1) {
      insight += `Root cause: heroes arrived with almost no ready skills (avg ${avgArrivalSkills.toFixed(1)}/4). All their key abilities were exhausted. `;
      insight += `Fix options: add more skill recharge opportunities (Wonder encounters), make Lulu\'s Arcane Recharge more reliable, or reduce skill costs during dungeon phase.`;
    } else if (hydraWinRate < 50) {
      insight += `Root cause: even with skills and equipment, heroes couldn\'t consistently beat the Hydra heads (${hydraWinRate.toFixed(0)}% attack win rate). `;
      insight += `Fix options: lower Hydra head STR by 1-2, add a skill that gives a bigger combat bonus at the Hydra, or increase the overflow max head limit.`;
    } else {
      insight += `The party was close to winning (${hydraWinRate.toFixed(0)}% Hydra attack win rate) but the overflow/relic mechanic punished the failed attacks too harshly. `;
      insight += `Fix options: increase max heads from 6 to 7, give heroes 5 relics instead of 4, or add a way to prevent head growth after KO.`;
    }
  } else {
    const hydraWinRate = hydraLog.length > 0 ? (hydraLog.filter(a=>a.won).length / hydraLog.length * 100) : 0;
    if (hydraWinRate > 80) {
      insight += `The party dominated. They may have been overpowered for this run — good equipment draws and skill management made the Hydra fight easy.`;
    } else if (hydraWinRate > 60) {
      insight += `A solid, balanced win. The party was well-prepared and fought efficiently. This feels like the intended experience.`;
    } else {
      insight += `A hard-fought victory. The party barely scraped through with ${hydraWinRate.toFixed(0)}% Hydra attack success. This is the kind of tense win that makes the game exciting.`;
    }
    if (G.stats.relicsSpent > 0) {
      insight += ` ${G.stats.relicsSpent} relic${G.stats.relicsSpent>1?'s were':' was'} spent to survive — the margin of victory was thin.`;
    }
  }
  paragraphs.push(insight);

  // Format as styled card
  let html = `<div class="report-card" style="border-left:3px solid var(--accent);background:#14141e">`;
  html += `<b style="color:var(--accent)">🤖 Game Analysis</b><br><br>`;
  paragraphs.forEach(p => {
    html += `<p style="margin:6px 0;line-height:1.6">${p}</p>`;
  });
  html += `</div>`;
  return html;
}

// ========== CONTROLS ==========
function startGame() {
  homeStartSingle();
}

function startGameInternal() {
  stopAuto();
  G = initState();
  // Apply tweaks to single game
  G._tweaks = currentTweaks;
  if (currentTweaks) {
    const defaults = {juju:3, gigi:2, lulu:1, eggo:2};
    G.heroes.forEach(h => {
      if (currentTweaks.heroStr && currentTweaks.heroStr[h.id] !== undefined) {
        h.str = currentTweaks.heroStr[h.id];
      }
    });
  }
  const diffs = currentTweaks ? getTweaksDiff(currentTweaks) : [];
  log('═══════════════════════════════════════', 'system');
  log('  JUJU\'S CASTLE — NEW GAME', 'turn-header');
  log('═══════════════════════════════════════', 'system');
  log(`Party: ${G.heroes.map(h => h.name + ' (STR ' + h.str + ')').join(', ')}`, 'system');
  log('All heroes start at the Entrance. 36 rooms to explore.', 'system');
  if (diffs.length > 0) {
    log('⚙ Tweaks: ' + diffs.join(' | '), 'system');
  }
  log('', 'system');
  document.getElementById('logPanel').innerHTML = '';
  document.getElementById('stepBtn').disabled = false;
  document.getElementById('autoBtn').disabled = false;
  render();
  if (document.getElementById('modeSelect').value === 'auto') {
    toggleAuto();
  }
}

function stepGame() {
  if (!G || G.gameOver) return;
  runTurn();
  if (G.gameOver) onGameEnd();
  render();
}

function toggleAuto() {
  if (autoRunning) {
    stopAuto();
  } else {
    autoRunning = true;
    document.getElementById('autoBtn').textContent = '⏸ Pause';
    document.getElementById('autoBtn').classList.add('primary');
    autoStep();
  }
}

function autoStep() {
  if (!autoRunning || !G || G.gameOver) {
    stopAuto();
    if (G && G.gameOver) onGameEnd();
    render();
    return;
  }
  runTurn();
  render();
  const speed = document.getElementById('speedSlider').value;
  const delay = Math.max(10, 1000 - speed * 10);
  autoTimer = setTimeout(autoStep, delay);
}

function stopAuto() {
  autoRunning = false;
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
  document.getElementById('autoBtn').textContent = '▶ Auto';
  document.getElementById('autoBtn').classList.remove('primary');
}

function resetGame() {
  stopAuto();
  G = null;
  document.getElementById('logPanel').innerHTML = '';
  document.getElementById('heroPanel').innerHTML = '';
  document.getElementById('infoPanel').innerHTML = '';
  document.getElementById('statusBar').textContent = 'Ready. Press New Game.';
  document.getElementById('stepBtn').disabled = true;
  document.getElementById('autoBtn').disabled = true;
}

document.getElementById('statusBar').textContent = 'Ready.';
// Gil toggle visibility
document.getElementById('tw_gilEnabled').addEventListener('change', function() {
  document.getElementById('tw_gilSettings').style.display = this.checked ? 'block' : 'none';
});
// Build equipment and hydra lists on home screen
buildTweaksLists();

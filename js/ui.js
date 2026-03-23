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
        <div class="stat">${h.dodgeActive ? '🛡Dodge ' : ''}${h.runningToHydra ? '🏃Running' : ''}${bpEnabled() ? ' ⭐ ' + h.bp + ' BP' : ''}</div>
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
    shelter: '#d4a843',
    wonder: '#1a4a2a',
    common: '#1e1e2e',
    dread: '#4a1520',
    exit: '#2a1a3a'
  };
  const tileBorders = {
    shelter: '#d4a843',
    wonder: '#2d8a4e',
    common: '#2a2a3a',
    dread: '#b02030',
    exit: '#7b2d8e'
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
    if (tile.type !== 'shelter') {
      const label = tile.type === 'wonder' ? 'W' : tile.type === 'dread' ? 'D' : '';
      if (label) {
        svg += `<text x="${cx}" y="${cy + 3}" text-anchor="middle" fill="${stroke}" font-size="7" font-family="monospace" opacity="0.5">${label}</text>`;
      }
    } else {
      svg += `<text x="${cx}" y="${cy + 3}" text-anchor="middle" fill="${tileColors.shelter}" font-size="7" font-family="monospace" font-weight="bold">S</text>`;
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
    if (h.pos === 'hydra') {
      // Heroes at Hydra: show them on the Exit hex
      if (G.exitHex) {
        const key = hexKey(G.exitHex.q, G.exitHex.r);
        if (!heroPositions[key]) heroPositions[key] = [];
        heroPositions[key].push(h);
      }
    } else {
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

  const endStateMetrics = ['totalStr','equipCount','followerCount','readySkills','relics','bp'];
  const endStateLabels = ['Total STR','Equipment','Followers','Ready Skills','Relics','BP'];
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

  // === HERO STATE AT HYDRA AWAKENING ===
  html += `<div class="report-section"><h3>Hero State at Hydra Awakening</h3>`;
  html += `<table style="width:100%;font-size:10px;border-collapse:collapse">`;
  html += `<tr style="border-bottom:1px solid var(--border)"><th></th>`;
  heroIds.forEach(id => html += `<th style="color:var(--${id})">${heroNames[id]}</th>`);
  html += `</tr>`;

  const awakeMetrics = [
    {label: 'Distance to Hydra', key: 'distanceToHydra'},
    {label: 'Equipment', key: 'equipCount'},
    {label: 'Ready Skills', key: 'readySkills'},
    {label: 'Followers', key: 'followerCount'},
    {label: 'Relics', key: 'relics'},
    {label: 'BP', key: 'bp'},
    {label: 'Total STR', key: 'totalStr'}
  ];

  awakeMetrics.forEach(m => {
    html += `<tr><td style="color:var(--dim)">${m.label}</td>`;
    heroIds.forEach(id => {
      const vals = results.map(r => {
        const s = r.tracker.heroStateAtAwakening && r.tracker.heroStateAtAwakening[id];
        return s ? (s[m.key] || 0) : 0;
      }).filter(v => v !== undefined);
      const avg = vals.length ? fix1(vals.reduce((a,b)=>a+b,0)/vals.length) : '-';
      html += `<td style="text-align:center">${avg}</td>`;
    });
    html += `</tr>`;
  });
  html += `</table></div>`;

  // === HYDRA ARRIVAL SNAPSHOT ===
  html += `<div class="report-section"><h3>Hero Arrival Snapshot</h3>`;
  const arrivalData = {};
  results.forEach(r => {
    (r.tracker.hydraArrivals || []).forEach(a => {
      if (!arrivalData[a.heroId]) arrivalData[a.heroId] = [];
      arrivalData[a.heroId].push(a);
    });
  });

  html += `<table style="width:100%;font-size:10px;border-collapse:collapse">`;
  html += `<tr style="border-bottom:1px solid var(--border)"><th></th>`;
  heroIds.forEach(id => html += `<th style="color:var(--${id})">${heroNames[id]}</th>`);
  html += `</tr>`;

  const arrivalMetrics = [
    {label: 'Avg Arrival Turn', fn: a => a.turn},
    {label: 'Avg Total STR', fn: a => a.totalStr},
    {label: 'Avg Equipment', fn: a => a.equipment ? a.equipment.length : 0},
    {label: 'Avg Ready Skills', fn: a => a.readySkills},
    {label: 'Avg Followers', fn: a => a.followers ? a.followers.length : 0},
  ];

  arrivalMetrics.forEach(m => {
    html += `<tr><td style="color:var(--dim)">${m.label}</td>`;
    heroIds.forEach(id => {
      const arrivals = arrivalData[id] || [];
      if (arrivals.length > 0) {
        const avg = fix1(arrivals.reduce((s, a) => s + m.fn(a), 0) / arrivals.length);
        html += `<td style="text-align:center">${avg}</td>`;
      } else {
        html += `<td style="text-align:center;color:var(--dim)">-</td>`;
      }
    });
    html += `</tr>`;
  });
  html += `</table></div>`;

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

  // ===================== TALENT ACTIVATIONS =====================
  html += `<div class="report-section"><h3>Talent Activations</h3>`;
  // Juju
  {
    const jt = { triggered:0, combatsWithFlame:0, winsWithFlame:0, combatsWithoutFlame:0, winsWithoutFlame:0 };
    results.forEach(r => { const d = r.tracker.talentDetails && r.tracker.talentDetails.juju; if (d) { Object.keys(jt).forEach(k => jt[k] += (d[k]||0)); }});
    const wrFlame = jt.combatsWithFlame ? pct(jt.winsWithFlame, jt.combatsWithFlame) : '-';
    const wrNoFlame = jt.combatsWithoutFlame ? pct(jt.winsWithoutFlame, jt.combatsWithoutFlame) : '-';
    html += `<div class="report-card" style="border-left:3px solid var(--juju)"><b style="color:var(--juju)">Juju — Unwavering Power (+2 STR)</b>`;
    html += statRow('Triggered', `${jt.triggered} (${fix1(jt.triggered/n)}/game)`);
    html += statRow('Combats with Flame +2', jt.combatsWithFlame);
    html += statRow('Win Rate with Flame', `${wrFlame}%`);
    html += statRow('Combats without Flame', jt.combatsWithoutFlame);
    html += statRow('Win Rate without Flame', `${wrNoFlame}%`);
    html += `</div>`;
  }
  // Gigi
  {
    const gt = { triggered:0, giftTargets:{}, giftUsedFor:{combat:0,movement:0,awakening:0,nothing:0}, giftValueByTarget:{} };
    results.forEach(r => { const d = r.tracker.talentDetails && r.tracker.talentDetails.gigi; if (d) { gt.triggered += (d.triggered||0); Object.entries(d.giftTargets||{}).forEach(([k,v]) => { gt.giftTargets[k] = (gt.giftTargets[k]||0) + v; }); Object.keys(gt.giftUsedFor).forEach(k => gt.giftUsedFor[k] += (d.giftUsedFor && d.giftUsedFor[k])||0); Object.entries(d.giftValueByTarget||{}).forEach(([k,v]) => { gt.giftValueByTarget[k] = (gt.giftValueByTarget[k]||0) + v; }); }});
    html += `<div class="report-card" style="border-left:3px solid var(--gigi)"><b style="color:var(--gigi)">Gigi — Nature's Gift</b>`;
    html += statRow('Triggered', `${gt.triggered} (${fix1(gt.triggered/n)}/game)`);
    const targetEntries = Object.entries(gt.giftTargets).sort((a,b) => b[1]-a[1]);
    targetEntries.forEach(([id, count]) => {
      const used = gt.giftValueByTarget[id] || 0;
      html += statRow(`Gifted to ${heroNames[id]||id}`, `${count} (${pct(count, gt.triggered)}%) · used ${used}x`);
    });
    const totalUsed = gt.giftUsedFor.combat + gt.giftUsedFor.movement + gt.giftUsedFor.awakening + gt.giftUsedFor.nothing;
    html += statRow('Used in Combat', `${gt.giftUsedFor.combat} (${pct(gt.giftUsedFor.combat, totalUsed)}%)`);
    html += statRow('Used in Movement', `${gt.giftUsedFor.movement} (${pct(gt.giftUsedFor.movement, totalUsed)}%)`);
    html += statRow('Used for Awakening', `${gt.giftUsedFor.awakening} (${pct(gt.giftUsedFor.awakening, totalUsed)}%)`);
    if (gt.giftUsedFor.nothing > 0) html += statRow('Wasted (no effect)', `${gt.giftUsedFor.nothing} (${pct(gt.giftUsedFor.nothing, totalUsed)}%)`);
    html += `</div>`;
  }
  // Lulu
  {
    const lt = { triggered:0 };
    results.forEach(r => { const d = r.tracker.talentDetails && r.tracker.talentDetails.lulu; if (d) lt.triggered += (d.triggered||0); });
    const luluRecharges = results.reduce((s,r) => s + ((r.tracker.skillRechargeSources && r.tracker.skillRechargeSources['talent_lulu'])||0), 0);
    html += `<div class="report-card" style="border-left:3px solid var(--lulu)"><b style="color:var(--lulu)">Lulu — Arcane Recharge</b>`;
    html += statRow('Triggered', `${lt.triggered} (${fix1(lt.triggered/n)}/game)`);
    html += statRow('Total Skill Recharges', luluRecharges);
    html += `</div>`;
  }
  // Eggo
  {
    const et = { triggered:0, koPrevented:0 };
    results.forEach(r => { const d = r.tracker.talentDetails && r.tracker.talentDetails.eggo; if (d) { et.triggered += (d.triggered||0); et.koPrevented += (d.koPrevented||0); }});
    html += `<div class="report-card" style="border-left:3px solid var(--eggo)"><b style="color:var(--eggo)">Eggo — Dodge</b>`;
    html += statRow('Triggered', `${et.triggered} (${fix1(et.triggered/n)}/game)`);
    html += statRow('KOs Prevented', `${et.koPrevented} (${fix1(et.koPrevented/n)}/game)`);
    html += `</div>`;
  }
  html += `</div>`;

  // ===================== RELIC EFFECTS =====================
  html += `<div class="report-section"><h3>Relic Effects</h3>`;
  {
    const cr = { bodyguardCount:0, protected:{}, outcomes:{won:0,lost:0} };
    const am = { pactPrevented:0, bonusDraws:0 };
    const gr = { failsafeCount:0, doubleRechargeCount:0 };
    const cl = { safekeepCount:0, thirdSlotUsed:0 };
    results.forEach(r => {
      const re = r.tracker.relicEffects;
      if (!re) return;
      cr.bodyguardCount += (re.crown && re.crown.bodyguardCount)||0;
      if (re.crown && re.crown.protected) Object.entries(re.crown.protected).forEach(([k,v]) => cr.protected[k] = (cr.protected[k]||0)+v);
      if (re.crown && re.crown.outcomes) { cr.outcomes.won += re.crown.outcomes.won||0; cr.outcomes.lost += re.crown.outcomes.lost||0; }
      am.pactPrevented += (re.amulet && re.amulet.pactPrevented)||0;
      am.bonusDraws += (re.amulet && re.amulet.bonusDraws)||0;
      gr.failsafeCount += (re.grimoire && re.grimoire.failsafeCount)||0;
      gr.doubleRechargeCount += (re.grimoire && re.grimoire.doubleRechargeCount)||0;
      cl.safekeepCount += (re.cloak && re.cloak.safekeepCount)||0;
      cl.thirdSlotUsed += (re.cloak && re.cloak.thirdSlotUsed)||0;
    });
    html += `<div class="report-card"><b>Crown of Courage (Bodyguard)</b>`;
    html += statRow('Activations', `${cr.bodyguardCount} (${fix1(cr.bodyguardCount/n)}/game)`);
    const protEntries = Object.entries(cr.protected).sort((a,b) => b[1]-a[1]);
    protEntries.forEach(([id, count]) => html += statRow(`Protected ${heroNames[id]||id}`, count));
    html += statRow('Outcomes', `Won ${cr.outcomes.won} / Lost ${cr.outcomes.lost}`);
    html += `</div>`;

    html += `<div class="report-card"><b>Forest Amulet (Pact)</b>`;
    html += statRow('Follower Loss Prevented', `${am.pactPrevented} (${fix1(am.pactPrevented/n)}/game)`);
    html += statRow('Bonus Draws', `${am.bonusDraws} (${fix1(am.bonusDraws/n)}/game)`);
    html += `</div>`;

    html += `<div class="report-card"><b>Ancestral Grimoire</b>`;
    html += statRow('Failsafe Recharges (0 skills)', `${gr.failsafeCount} (${fix1(gr.failsafeCount/n)}/game)`);
    html += statRow('Double Recharges (Lulu talent)', `${gr.doubleRechargeCount} (${fix1(gr.doubleRechargeCount/n)}/game)`);
    html += `</div>`;

    html += `<div class="report-card"><b>Shadow Cloak</b>`;
    html += statRow('Safekeep (kept equip on KO)', `${cl.safekeepCount} (${fix1(cl.safekeepCount/n)}/game)`);
    html += statRow('3rd Slot Used', `${cl.thirdSlotUsed} (${fix1(cl.thirdSlotUsed/n)}/game)`);
    html += `</div>`;
  }

  // Relic Spend Breakdown
  const relicSpends = results.flatMap(r => r.tracker.relicSpendLog || []);
  if (relicSpends.length > 0) {
    const dungeonSpends = relicSpends.filter(s => s.phase === 'dungeon');
    const hydraSpends = relicSpends.filter(s => s.phase === 'hydra');
    html += `<div class="report-card"><b>Relic Spend Breakdown</b> (${relicSpends.length} total)`;
    html += statRow('Dungeon', `${dungeonSpends.length} (${pct(dungeonSpends.length, relicSpends.length)}%)`);
    html += statRow('Hydra', `${hydraSpends.length} (${pct(hydraSpends.length, relicSpends.length)}%)`);
    if (dungeonSpends.length > 0) html += statRow('Avg dungeon spend turn', fix1(dungeonSpends.reduce((s,d) => s + d.turn, 0) / dungeonSpends.length));
    if (hydraSpends.length > 0) html += statRow('Avg Hydra spend turn', fix1(hydraSpends.reduce((s,d) => s + d.turn, 0) / hydraSpends.length));
    html += `</div>`;

    // Per hero
    html += `<div class="report-card"><b>Relic Spends Per Hero</b>`;
    heroIds.forEach(id => {
      const heroS = relicSpends.filter(s => s.heroId === id);
      if (heroS.length > 0) {
        const hd = heroS.filter(s => s.phase === 'dungeon').length;
        const hh = heroS.filter(s => s.phase === 'hydra').length;
        html += statRow(`${heroNames[id]}`, `${heroS.length} (${hd}D/${hh}H)`);
      }
    });
    html += `</div>`;

    // Enemies/heads consuming most relics
    const enemyRelicCost = {};
    relicSpends.forEach(s => { const e = s.enemy || 'unknown'; enemyRelicCost[e] = (enemyRelicCost[e]||0) + 1; });
    html += `<div class="report-card"><b>Biggest Relic Consumers</b>`;
    Object.entries(enemyRelicCost).sort((a,b) => b[1]-a[1]).slice(0, 10).forEach(([enemy, count]) => {
      html += statRow(enemy, `${count} relics`);
    });
    html += `</div>`;

    // Relics at Hydra entry
    const arrivals = results.flatMap(r => r.tracker.hydraArrivals || []);
    if (arrivals.length > 0) {
      html += `<div class="report-card"><b>Relics at First Hydra Entry</b>`;
      heroIds.forEach(id => {
        const firstArrivals = [];
        results.forEach(r => {
          const ha = (r.tracker.hydraArrivals || []).find(a => a.heroId === id);
          if (ha) firstArrivals.push(ha.partyRelics || 0);
        });
        if (firstArrivals.length > 0) html += statRow(heroNames[id], fix1(firstArrivals.reduce((a,b)=>a+b,0)/firstArrivals.length) + ' avg party relics');
      });
      html += `</div>`;
    }
  }

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
    const baseStr = e._originalStr || e.str;
    const d = allEncounters[e.name];
    if (d && d.won + d.lost >= 20) {
      const wr = d.won / (d.won + d.lost) * 100;
      const ok = wr >= 75 && wr <= 95;
      if (!ok) {
        const tag = wr < 75 ? 'TOO HARD' : 'TOO EASY';
        html += `<div style="font-size:10px;color:${wr<75?'var(--ko)':'var(--heal)'}">${e.name} (Mishap STR ${baseStr}): ${wr.toFixed(0)}% — ${tag}</div>`;
        flag('enemy', 'medium', `${e.name} (Mishap): ${wr.toFixed(0)}% hero win rate — ${tag}`);
      }
    }
  });
  misfortuneEnemies.forEach(e => {
    const baseStr = e._originalStr || e.str;
    const d = allEncounters[e.name];
    if (d && d.won + d.lost >= 20) {
      const wr = d.won / (d.won + d.lost) * 100;
      const ok = wr >= 35 && wr <= 70;
      if (!ok) {
        const tag = wr < 35 ? 'TOO HARD' : 'TOO EASY';
        html += `<div style="font-size:10px;color:${wr<35?'var(--ko)':'var(--heal)'}">${e.name} (Misfortune STR ${baseStr}): ${wr.toFixed(0)}% — ${tag}</div>`;
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

  // ===================== ENEMY SIDE EFFECTS =====================
  html += `<div class="report-section"><h3>Enemy Side Effects</h3>`;
  const allSideEffects = {};
  results.forEach(r => {
    Object.entries(r.tracker.enemySideEffects || {}).forEach(([name, data]) => {
      if (!allSideEffects[name]) allSideEffects[name] = { skillsExhausted:0, equipLost:0, followersLost:0, strDebuff:0, teleported:0, triggers:0 };
      Object.entries(data).forEach(([k, v]) => { allSideEffects[name][k] = (allSideEffects[name][k]||0) + v; });
    });
  });
  if (Object.keys(allSideEffects).length > 0) {
    html += `<table style="width:100%;font-size:10px;border-collapse:collapse">`;
    html += `<tr style="border-bottom:1px solid var(--border)"><th>Enemy</th><th>Triggers</th><th>Skills Exhausted</th><th>Equip Lost</th><th>Followers Lost</th><th>STR Debuff</th><th>Other</th></tr>`;
    Object.entries(allSideEffects).sort((a,b) => b[1].triggers - a[1].triggers).forEach(([name, data]) => {
      html += `<tr><td>${name}</td><td style="text-align:center">${data.triggers}</td>`;
      html += `<td style="text-align:center">${data.skillsExhausted}</td>`;
      html += `<td style="text-align:center">${data.equipLost}</td>`;
      html += `<td style="text-align:center">${data.followersLost}</td>`;
      html += `<td style="text-align:center">${data.strDebuff}</td>`;
      html += `<td style="text-align:center">${data.teleported + (data.otherEffects||0)}</td></tr>`;
    });
    html += `</table>`;
  } else {
    html += `<div class="report-card"><span style="color:var(--dim)">No enemy side effects recorded</span></div>`;
  }
  html += `</div>`;

  // ===================== SECTION 8: GIL ECONOMY =====================
  html += `<div class="report-section"><h3>BP Economy</h3>`;
  const bpGames = results.filter(r => r.heroes.some(h => (h.bpEarned||0) > 0));
  if (bpGames.length > 0) {
    html += `<div class="report-card">`;
    heroIds.forEach(id => {
      const earned = avg(bpGames, r => { const h = r.heroes.find(x => x.id === id); return h ? h.bpEarned||0 : 0; });
      const spentSkill = avg(bpGames, r => { const h = r.heroes.find(x => x.id === id); return h ? h.bpSpentSkill||0 : 0; });
      const spentEquip = avg(bpGames, r => { const h = r.heroes.find(x => x.id === id); return h ? h.bpSpentEquip||0 : 0; });
      const unspent = avg(bpGames, r => { const h = r.heroes.find(x => x.id === id); return h ? h.bp||0 : 0; });
      const unspentPct = earned > 0 ? pct(unspent, earned) : '-';
      html += `<div style="margin-bottom:6px"><b style="color:var(--${id})">${heroNames[id]}</b>`;
      html += statRow('Avg Earned / game', fix1(earned));
      html += statRow('Avg Spent on Skills', fix1(spentSkill));
      html += statRow('Avg Spent on Equipment', fix1(spentEquip));
      html += statRow('Avg Unspent', `${fix1(unspent)} (${unspentPct}%)`);
      if (earned > 0 && unspent / earned > 0.6) flag('bp', 'medium', `${heroNames[id]} leaves ${unspentPct}% of BP unspent — BP not useful enough or prices too high`);
      html += `</div>`;
    });
    html += `</div>`;

    // BP visits
    const totalVoluntary = results.reduce((s,r) => s + (r.tracker.bpVisits ? r.tracker.bpVisits.voluntary : 0), 0);
    const totalKOVisits = results.reduce((s,r) => s + (r.tracker.bpVisits ? r.tracker.bpVisits.koRespawn : 0), 0);
    html += `<div class="report-card"><b>Shelter Visits</b>`;
    html += statRow('Voluntary (to spend BP)', totalVoluntary);
    html += statRow('KO Respawn', totalKOVisits);
    if (totalVoluntary === 0 && totalKOVisits > 0) flag('bp', 'medium', 'No voluntary BP spending visits — heroes only spend when KO respawning');
    html += `</div>`;
  } else {
    html += `<div class="report-card" style="color:var(--dim)">BP system not enabled in this batch.</div>`;
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
  // Exit placement milestone
  const exitTurns = results.map(r => r.tracker.pacing.exitPlaced || 0).filter(v => v > 0);
  if (exitTurns.length > 0) {
    const exitMean = fix1(exitTurns.reduce((a,b)=>a+b,0) / exitTurns.length);
    const exitSd = fix1(Math.sqrt(exitTurns.reduce((s,v) => s + Math.pow(v - parseFloat(exitMean), 2), 0) / exitTurns.length));
    html += statRow('Exit Placed', `Turn ${exitMean} (±${exitSd})`);
  }
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

  // ===================== HYDRA COMBAT DETAIL (new trackers A-G) =====================
  html += `<div class="report-section"><h3>Hydra Combat Detail</h3>`;

  // B: Attack snapshots - averages per hero per head
  const snapshots = results.flatMap(r => r.tracker.hydraAttackSnapshots || []);
  if (snapshots.length > 0) {
    html += `<div class="report-card"><b>Avg STR at Hydra Attack</b>`;
    const byHeroHead = {};
    snapshots.forEach(s => {
      const key = s.heroId + '|' + s.head;
      if (!byHeroHead[key]) byHeroHead[key] = { attacks: 0, wins: 0, totalStr: 0, readySkills: 0 };
      byHeroHead[key].attacks++;
      if (s.won) byHeroHead[key].wins++;
      byHeroHead[key].totalStr += s.totalStr;
      byHeroHead[key].readySkills += s.readySkills;
    });
    html += `<table style="width:100%;font-size:10px;border-collapse:collapse">`;
    html += `<tr><th>Hero</th><th>Head</th><th>Attacks</th><th>Win%</th><th>Avg STR</th><th>Avg Skills</th></tr>`;
    Object.entries(byHeroHead).sort((a,b) => b[1].attacks - a[1].attacks).forEach(([key, d]) => {
      const [hid, head] = key.split('|');
      html += `<tr><td style="color:var(--${hid})">${heroNames[hid]||hid}</td><td>${head}</td><td>${d.attacks}</td><td>${pct(d.wins,d.attacks)}%</td><td>${fix1(d.totalStr/d.attacks)}</td><td>${fix1(d.readySkills/d.attacks)}</td></tr>`;
    });
    html += `</table></div>`;
  }

  // C: Shelter return trips
  const trips = results.flatMap(r => r.tracker.shelterReturnTrips || []);
  if (trips.length > 0) {
    html += `<div class="report-card"><b>Shelter Return Trips</b> (${trips.length} total)`;
    const avgTurns = fix1(trips.reduce((s,t) => s + t.turnsAway, 0) / trips.length);
    const avgHeadsGrown = fix1(trips.reduce((s,t) => s + t.headsGrown, 0) / trips.length);
    html += statRow('Avg turns away', avgTurns);
    html += statRow('Avg heads grown while away', avgHeadsGrown);
    heroIds.forEach(id => {
      const ht = trips.filter(t => t.heroId === id);
      if (ht.length > 0) html += statRow(heroNames[id], `${ht.length} trips, avg ${fix1(ht.reduce((s,t)=>s+t.turnsAway,0)/ht.length)} turns`);
    });
    html += `</div>`;
  }

  // G: Distance at KO
  const koDist = results.flatMap(r => r.tracker.hydraKODistance || []);
  if (koDist.length > 0) {
    html += `<div class="report-card"><b>Hydra KO Distance</b>`;
    const avgBfs = fix1(koDist.reduce((s,d) => s + d.bfsDistance, 0) / koDist.length);
    const avgReturn = fix1(koDist.reduce((s,d) => s + d.turnsToReturn, 0) / koDist.length);
    html += statRow('Avg BFS distance Shelter\u2192Hydra', avgBfs);
    html += statRow('Avg turns to return', avgReturn);
    html += `</div>`;
  }

  // F: Siphon impact
  const siphon = results.flatMap(r => r.tracker.siphonImpact || []);
  if (siphon.length > 0) {
    const siphonWins = siphon.filter(s => s.won).length;
    const wouldntWinWithout = siphon.filter(s => s.won && !s.wouldWinWithout).length;
    html += `<div class="report-card"><b>Siphon Difference Maker</b> (${siphon.length} uses)`;
    html += statRow('Win rate with Siphon', pct(siphonWins, siphon.length) + '%');
    html += statRow('Wins that needed Siphon', `${wouldntWinWithout} (${pct(wouldntWinWithout, siphon.length)}%)`);
    html += `</div>`;
  }

  // D: Overload
  const overloads = results.flatMap(r => r.tracker.overloadUses || []);
  if (overloads.length > 0) {
    const olWins = overloads.filter(o => o.won).length;
    const avgExhausted = fix1(overloads.reduce((s,o) => s + o.skillsExhausted, 0) / overloads.length);
    html += `<div class="report-card"><b>Overload Deep Dive</b> (${overloads.length} uses)`;
    html += statRow('Win rate', pct(olWins, overloads.length) + '%');
    html += statRow('Avg skills exhausted', avgExhausted);
    html += `</div>`;
  }

  // E: Reality Warp
  const warps = results.flatMap(r => r.tracker.realityWarpUses || []);
  if (warps.length > 0) {
    const selfWarps = warps.filter(w => w.selfTarget).length;
    const avgDist = fix1(warps.reduce((s,w) => s + (w.distanceSaved||0), 0) / warps.length);
    html += `<div class="report-card"><b>Reality Warp Usage</b> (${warps.length} uses)`;
    html += statRow('Self-target', `${selfWarps} (${pct(selfWarps, warps.length)}%)`);
    html += statRow('Ally-target', `${warps.length - selfWarps}`);
    html += statRow('Avg distance saved', `${avgDist} tiles`);
    // Purpose breakdown
    const purposes = {};
    warps.forEach(w => { const p = w.purpose || 'unknown'; purposes[p] = (purposes[p]||0) + 1; });
    Object.entries(purposes).sort((a,b) => b[1]-a[1]).forEach(([p, count]) => {
      html += statRow(p.replace(/_/g, ' '), `${count} (${pct(count, warps.length)}%)`);
    });
    html += `</div>`;
  }

  html += `</div>`;

  // ===================== SHELTER RESPAWN BEHAVIOR =====================
  const respawnData = results.flatMap(r => r.tracker.shelterRespawnDetails || []);
  if (respawnData.length > 0) {
    html += `<div class="report-section"><h3>Shelter Respawn Behavior</h3>`;
    html += `<div class="report-card"><b>Respawn Overview</b> (${respawnData.length} respawns across ${n} games)`;
    const avgBpAtRespawn = fix1(respawnData.reduce((s,d) => s + d.bpAtRespawn, 0) / respawnData.length);
    const avgTurnsAway = fix1(respawnData.reduce((s,d) => s + d.turnsAway, 0) / respawnData.length);
    const avgSkillsLeave = fix1(respawnData.reduce((s,d) => s + d.skillsReadyAtLeave, 0) / respawnData.length);
    const avgSkillsArrive = fix1(respawnData.reduce((s,d) => s + d.skillsReadyAtArrival, 0) / respawnData.length);
    html += statRow('Avg BP at respawn', avgBpAtRespawn);
    html += statRow('Avg turns away', avgTurnsAway);
    html += statRow('Avg skills ready leaving Shelter', avgSkillsLeave);
    html += statRow('Avg skills ready arriving Hydra', avgSkillsArrive);
    html += `</div>`;

    // BP spent breakdown
    const totalRecharge = respawnData.reduce((s,d) => s + (d.bpSpentBreakdown ? d.bpSpentBreakdown.recharge : 0), 0);
    const totalEquip = respawnData.reduce((s,d) => s + (d.bpSpentBreakdown ? d.bpSpentBreakdown.equip : 0), 0);
    const totalPurify = respawnData.reduce((s,d) => s + (d.bpSpentBreakdown ? d.bpSpentBreakdown.purify : 0), 0);
    const spentAny = respawnData.filter(d => d.bpSpentBreakdown && (d.bpSpentBreakdown.recharge + d.bpSpentBreakdown.equip + d.bpSpentBreakdown.purify) > 0).length;
    html += `<div class="report-card"><b>BP Spent at Shelter During Respawn</b>`;
    html += statRow('Respawns with BP spending', `${spentAny} (${pct(spentAny, respawnData.length)}%)`);
    html += statRow('Total BP on Recharge', totalRecharge);
    html += statRow('Total BP on Equipment', totalEquip);
    html += statRow('Total BP on Purify', totalPurify);
    html += `</div>`;

    // Skills recharged breakdown
    const rechargedSkills = {};
    respawnData.forEach(d => (d.skillsRechargedNames||[]).forEach(s => { rechargedSkills[s] = (rechargedSkills[s]||0) + 1; }));
    if (Object.keys(rechargedSkills).length > 0) {
      html += `<div class="report-card"><b>Skills Recharged at Shelter</b>`;
      Object.entries(rechargedSkills).sort((a,b) => b[1]-a[1]).forEach(([skill, count]) => {
        html += statRow(skill, `${count}x`);
      });
      html += `</div>`;
    }

    // Per hero
    const heroRespawns = {};
    respawnData.forEach(d => { if (!heroRespawns[d.heroId]) heroRespawns[d.heroId] = []; heroRespawns[d.heroId].push(d); });
    Object.entries(heroRespawns).forEach(([id, trips]) => {
      html += `<div class="report-card" style="border-left:3px solid var(--${id})"><b>${heroNames[id]}</b> (${trips.length} respawns)`;
      html += statRow('Avg BP at respawn', fix1(trips.reduce((s,t) => s + t.bpAtRespawn, 0) / trips.length));
      html += statRow('Avg turns to return', fix1(trips.reduce((s,t) => s + t.turnsAway, 0) / trips.length));
      html += statRow('Avg skills ready at Shelter', fix1(trips.reduce((s,t) => s + t.skillsReadyAtLeave, 0) / trips.length));
      html += statRow('Avg skills ready at Hydra', fix1(trips.reduce((s,t) => s + t.skillsReadyAtArrival, 0) / trips.length));
      html += `</div>`;
    });
    html += `</div>`;
  }

  // ===================== SHELTER PURCHASE DECISIONS =====================
  const purchases = results.flatMap(r => r.tracker.shelterPurchases || []);
  if (purchases.length > 0) {
    html += `<div class="report-section"><h3>Shelter Purchase Decisions</h3>`;

    // A: Purchase priority sequence
    const seqCounts = {};
    purchases.filter(p => p.sequence.length > 0).forEach(p => {
      const key = p.sequence.join(' → ');
      seqCounts[key] = (seqCounts[key]||0) + 1;
    });
    html += `<div class="report-card"><b>Top Purchase Sequences</b>`;
    Object.entries(seqCounts).sort((a,b) => b[1]-a[1]).slice(0, 10).forEach(([seq, count]) => {
      html += statRow(seq, `${count}x`);
    });
    html += `</div>`;

    // C: BP not spent
    const noSpend = purchases.filter(p => p.sequence.length === 0 && p.bpBefore > 0);
    if (noSpend.length > 0) {
      const reasons = {};
      noSpend.forEach(p => { const r = p.notSpentReason || 'unknown'; reasons[r] = (reasons[r]||0) + 1; });
      const avgUnspent = fix1(noSpend.reduce((s,p) => s + p.bpBefore, 0) / noSpend.length);
      html += `<div class="report-card"><b>BP Not Spent</b> (${noSpend.length} visits with BP but no purchase)`;
      html += statRow('Avg BP left unspent', avgUnspent);
      Object.entries(reasons).sort((a,b) => b[1]-a[1]).forEach(([reason, count]) => {
        const label = reason === 'not_enough' ? 'Not enough for any purchase' : reason === 'fully_ready' ? 'Already fully equipped/recharged' : reason === 'ai_skip' ? 'AI chose not to spend' : reason;
        html += statRow(label, `${count} (${pct(count, noSpend.length)}%)`);
      });
      html += `</div>`;
    }

    // D: Recharge vs Equipment decision (8+ BP)
    const bigBP = purchases.filter(p => p.hadEnoughForBoth && p.sequence.length > 0);
    if (bigBP.length > 0) {
      const firstChoices = {};
      bigBP.forEach(p => { const c = p.firstChoice || 'unknown'; firstChoices[c] = (firstChoices[c]||0) + 1; });
      html += `<div class="report-card"><b>With 8+ BP: First Purchase Choice</b> (${bigBP.length} decisions)`;
      Object.entries(firstChoices).sort((a,b) => b[1]-a[1]).forEach(([choice, count]) => {
        html += statRow(choice, `${count} (${pct(count, bigBP.length)}%)`);
      });
      html += `</div>`;
    }

    // Per hero
    heroIds.forEach(id => {
      const hp = purchases.filter(p => p.heroId === id);
      if (hp.length > 0) {
        const spent = hp.filter(p => p.sequence.length > 0);
        const avgBpSpent = spent.length > 0 ? fix1(spent.reduce((s,p) => s + (p.bpBefore - p.bpAfter), 0) / spent.length) : '0';
        html += `<div style="font-size:10px;color:var(--${id});margin:2px 0"><b>${heroNames[id]}</b>: ${hp.length} visits, ${spent.length} with purchases, avg ${avgBpSpent} BP spent/visit</div>`;
      }
    });

    // B: Equipment Purchase Outcomes
    const equipOutcomes = results.flatMap(r => r.tracker.bpEquipOutcomes || []);
    if (equipOutcomes.length > 0) {
      const held = equipOutcomes.filter(e => e.heldAtEnd);
      const heldHydra = equipOutcomes.filter(e => e.heldAtHydra);
      const lost = equipOutcomes.filter(e => !e.heldAtEnd && e.lostTurn);
      const avgTurnsHeld = lost.length > 0 ? fix1(lost.reduce((s,e) => s + (e.lostTurn - e.purchaseTurn), 0) / lost.length) : '-';
      html += `<div class="report-card"><b>Equipment Purchase Outcomes</b> (${equipOutcomes.length} purchases)`;
      html += statRow('Held at Hydra', `${heldHydra.length} (${pct(heldHydra.length, equipOutcomes.length)}%)`);
      html += statRow('Held at game end', `${held.length} (${pct(held.length, equipOutcomes.length)}%)`);
      html += statRow('Lost (avg turns held)', `${lost.length} lost, avg ${avgTurnsHeld} turns`);
      html += `</div>`;
    }

    html += `</div>`;
  }

  // ===================== SHELTER RETURN BREAKDOWN =====================
  html += `<div class="report-section"><h3>Shelter Return Breakdown</h3>`;

  const allReturns = results.flatMap(r => r.tracker.returnTurnBreakdown || []);
  if (allReturns.length > 0) {
    const avgTrip = fix1(allReturns.reduce((s, r) => s + r.totalTurns, 0) / allReturns.length);
    html += `<div class="report-card"><b>Return Trip Analysis</b> (${allReturns.length} trips)`;
    html += statRow('Avg turns per return trip', avgTrip);

    const turnActivities = {};
    allReturns.forEach(trip => {
      trip.turns.forEach((t, i) => {
        if (!turnActivities[i]) turnActivities[i] = { shelter: 0, moving: 0, stuck: 0, fighting: 0, arrived: 0, total: 0 };
        turnActivities[i].total++;
        if (t.activity === 'shelter_bp') turnActivities[i].shelter++;
        else if (t.activity === 'stuck_dd') turnActivities[i].stuck++;
        else if (t.activity === 'arrived') turnActivities[i].arrived++;
        else turnActivities[i].moving++;
        if (t.foughtEnemy) turnActivities[i].fighting++;
      });
    });

    html += `<table style="width:100%;font-size:10px;border-collapse:collapse;margin-top:6px">`;
    html += `<tr style="border-bottom:1px solid var(--border)"><th>Turn #</th><th>At Shelter</th><th>Moving</th><th>Stuck (DD)</th><th>Fighting Enemy</th><th>Arrived</th></tr>`;

    Object.entries(turnActivities).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).slice(0, 8).forEach(([turnNum, data]) => {
      const t = data.total;
      html += `<tr>`;
      html += `<td style="text-align:center">Turn ${parseInt(turnNum) + 1}</td>`;
      html += `<td style="text-align:center">${pct(data.shelter, t)}%</td>`;
      html += `<td style="text-align:center">${pct(data.moving, t)}%</td>`;
      html += `<td style="text-align:center">${pct(data.stuck, t)}%</td>`;
      html += `<td style="text-align:center">${pct(data.fighting, t)}%</td>`;
      html += `<td style="text-align:center">${pct(data.arrived, t)}%</td>`;
      html += `</tr>`;
    });
    html += `</table>`;

    html += `<div style="font-size:10px;margin-top:6px;color:var(--dim)">Avg distance to Hydra: `;
    Object.entries(turnActivities).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).slice(0, 6).forEach(([turnNum, data]) => {
      const avgDist = allReturns.reduce((s, trip) => {
        const t = trip.turns[parseInt(turnNum)];
        return s + (t ? t.distToHydra || 0 : 0);
      }, 0) / data.total;
      html += `T${parseInt(turnNum)+1}: ${fix1(avgDist)} | `;
    });
    html += `</div>`;

    html += `</div>`;
  } else {
    html += `<div class="report-card" style="color:var(--dim)">No Hydra KO return trips recorded.</div>`;
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

  // ===================== EQUIPMENT POWER COMBOS =====================
  html += `<div class="report-section"><h3>Equipment Power Combos</h3>`;
  {
    // Compare equipment pair presence in wins vs losses
    const comboWins = {};
    const comboLosses = {};
    const extractCombos = (gameResults, target) => {
      gameResults.forEach(r => {
        heroIds.forEach(id => {
          const es = r.tracker.heroEndState[id];
          if (es && es.equipNames && es.equipNames.length >= 2) {
            const sorted = [...es.equipNames].sort();
            for (let i = 0; i < sorted.length; i++) {
              for (let j = i+1; j < sorted.length; j++) {
                const pair = sorted[i] + ' + ' + sorted[j];
                target[pair] = (target[pair]||0) + 1;
              }
            }
          }
        });
      });
    };
    extractCombos(wins, comboWins);
    extractCombos(losses, comboLosses);

    const allComboKeys = [...new Set([...Object.keys(comboWins), ...Object.keys(comboLosses)])];
    const comboStats = allComboKeys.map(pair => {
      const w = comboWins[pair] || 0;
      const l = comboLosses[pair] || 0;
      return { pair, wins: w, losses: l, total: w + l, winRate: (w + l) > 0 ? w / (w + l) * 100 : 0 };
    }).filter(c => c.total >= 10);

    if (comboStats.length > 0) {
      comboStats.sort((a, b) => b.winRate - a.winRate);
      const topCombos = comboStats.slice(0, 10);
      const bottomCombos = comboStats.slice(-5).reverse();

      html += `<div class="report-card"><b>Highest Win Rate Pairs (10+ occurrences)</b>`;
      html += `<table style="width:100%;font-size:10px;border-collapse:collapse">`;
      html += `<tr style="border-bottom:1px solid var(--border)"><th>Pair</th><th>Games</th><th>Win%</th></tr>`;
      topCombos.forEach(c => {
        const color = c.winRate >= 70 ? 'var(--wonder)' : c.winRate <= 40 ? 'var(--ko)' : 'inherit';
        html += `<tr><td>${c.pair}</td><td style="text-align:center">${c.total}</td><td style="text-align:center;color:${color}">${c.winRate.toFixed(1)}%</td></tr>`;
      });
      html += `</table></div>`;

      if (bottomCombos.length > 0 && bottomCombos[0].winRate < topCombos[topCombos.length - 1].winRate) {
        html += `<div class="report-card"><b>Lowest Win Rate Pairs</b>`;
        html += `<table style="width:100%;font-size:10px;border-collapse:collapse">`;
        html += `<tr style="border-bottom:1px solid var(--border)"><th>Pair</th><th>Games</th><th>Win%</th></tr>`;
        bottomCombos.forEach(c => {
          html += `<tr><td>${c.pair}</td><td style="text-align:center">${c.total}</td><td style="text-align:center;color:var(--ko)">${c.winRate.toFixed(1)}%</td></tr>`;
        });
        html += `</table></div>`;
      }
    } else {
      html += `<div class="report-card"><span style="color:var(--dim)">Not enough data (need 10+ fights per pair)</span></div>`;
    }

    // Doomhammer self-KO tracking
    const doomhammerEquipped = allEquip['Doomhammer'] ? allEquip['Doomhammer'].equipped || 0 : 0;
    if (doomhammerEquipped > 0) {
      // Count Doomhammer KOs from combat logs: fights where hero had Doomhammer but didn't actually fight (pre-combat KO)
      // We can approximate from hydraGrowthLog and the KO source
      let doomhammerKOs = 0;
      results.forEach(r => {
        (r.tracker.hydraGrowthLog || []).forEach(g => {
          if (g.source === 'hero_ko') {
            // Check if any hero had Doomhammer equipped at that point — approximation
          }
        });
      });
      // Better approach: count from combat log entries where margin data suggests pre-combat KO
      // Since engine doesn't log Doomhammer KOs separately, count from the log messages is not possible here.
      // Instead, show equipment win/loss data for Doomhammer
      const dh = allEquip['Doomhammer'];
      const dhWins = dh.wonWith || 0;
      const dhLosses = dh.lostWith || 0;
      const dhTotal = dhWins + dhLosses;
      html += `<div class="report-card"><b>Doomhammer Risk Profile</b>`;
      html += statRow('Times Equipped', doomhammerEquipped);
      html += statRow('Combat Win Rate', dhTotal > 0 ? `${pct(dhWins, dhTotal)}%` : '-');
      html += statRow('Discarded', dh.discarded || 0);
      html += `</div>`;
    }
  }
  html += `</div>`;

  // ===================== ARCANE FAMILIAR ANALYSIS =====================
  html += `<div class="report-section"><h3>Arcane Familiar Analysis</h3>`;
  {
    const sm = { total: 0, cancelled: {}, atHydra: 0, atDungeon: 0 };
    results.forEach(r => {
      const d = r.tracker.spellMirrorDetails;
      if (d) {
        sm.total += (d.total || 0);
        sm.atHydra += (d.atHydra || 0);
        sm.atDungeon += (d.atDungeon || 0);
        Object.entries(d.cancelled || {}).forEach(([k, v]) => {
          sm.cancelled[k] = (sm.cancelled[k] || 0) + v;
        });
      }
    });

    html += `<div class="report-card"><b>Arcane Familiar Cancellations</b>`;
    html += statRow('Total Cancellations', `${sm.total} (${fix1(sm.total/n)}/game)`);
    html += statRow('At Dungeon', `${sm.atDungeon} (${pct(sm.atDungeon, sm.total)}%)`);
    html += statRow('At Hydra', `${sm.atHydra} (${pct(sm.atHydra, sm.total)}%)`);

    const cancelledEntries = Object.entries(sm.cancelled).sort((a, b) => b[1] - a[1]);
    if (cancelledEntries.length > 0) {
      html += `<div style="margin-top:6px"><b style="font-size:10px">Effects Cancelled</b></div>`;
      cancelledEntries.forEach(([effect, count]) => {
        html += statRow(effect.replace(/_/g, ' '), `${count} (${pct(count, sm.total)}%)`);
      });
    }
    html += `</div>`;
  }
  html += `</div>`;

  // ===================== ENEMY ENGAGEMENT DEPTH =====================
  html += `<div class="report-section"><h3>Enemy Engagement Patterns</h3>`;
  {
    const enemyEngagement = {};
    allCombatLogs.forEach(c => {
      if (!enemyEngagement[c.enemy]) enemyEngagement[c.enemy] = {
        fights: 0, wins: 0,
        skillUsed: 0,
        skillBurned: 0,
        crossHeroHelp: 0,
        preSkills: 0, preEquip: 0
      };
      const e = enemyEngagement[c.enemy];
      e.fights++;
      if (c.won) e.wins++;
      e.preSkills += c.readySkills || 0;
      e.preEquip += c.equipCount || 0;
    });

    // Enrich with skill burn data from enemySideEffects
    results.forEach(r => {
      Object.entries(r.tracker.enemySideEffects || {}).forEach(([enemy, effects]) => {
        if (enemyEngagement[enemy]) {
          enemyEngagement[enemy].skillBurned += (effects.skillsExhausted || 0);
        }
      });
    });

    // Enrich with skill activation data from skill tracker (per enemy is not available, approximate from combatLog)
    // Approximate skill usage: fights where readySkills > 0 (hero had skills available)
    allCombatLogs.forEach(c => {
      if (enemyEngagement[c.enemy] && (c.readySkills || 0) > 0) {
        enemyEngagement[c.enemy].skillUsed++;
      }
    });

    // Aggregate cross-hero help per enemy from the new tracker
    const allCrossHelp = {};
    results.forEach(r => {
      Object.entries(r.tracker.enemyCrossHeroHelp || {}).forEach(([enemy, count]) => {
        allCrossHelp[enemy] = (allCrossHelp[enemy] || 0) + count;
      });
    });

    const engagementRows = Object.entries(enemyEngagement)
      .filter(([, e]) => e.fights >= 5)
      .map(([name, e]) => {
        const winPct = e.fights > 0 ? e.wins / e.fights * 100 : 0;
        const skillUsePct = e.fights > 0 ? e.skillUsed / e.fights * 100 : 0;
        const burnPct = e.fights > 0 ? e.skillBurned / e.fights * 100 : 0;
        const crossCount = allCrossHelp[name] || 0;
        const crossHeroPct = e.fights > 0 ? crossCount / e.fights * 100 : 0;
        const depth = (skillUsePct + burnPct + crossHeroPct) / 3;
        return { name, fights: e.fights, winPct, skillUsePct, burnPct, crossHeroPct, depth };
      })
      .sort((a, b) => b.depth - a.depth);

    if (engagementRows.length > 0) {
      html += `<table style="width:100%;font-size:9px;border-collapse:collapse">`;
      html += `<tr style="border-bottom:1px solid var(--border)"><th>Enemy</th><th>Fights</th><th>Win%</th><th>Skill Use%</th><th>Burn%</th><th>Cross-Hero%</th><th>Depth</th></tr>`;
      engagementRows.forEach(r => {
        const depthColor = r.depth >= 50 ? 'var(--flame)' : r.depth >= 25 ? 'var(--mishap)' : 'var(--dim)';
        html += `<tr><td>${r.name}</td><td style="text-align:center">${r.fights}</td><td style="text-align:center">${r.winPct.toFixed(1)}%</td><td style="text-align:center">${r.skillUsePct.toFixed(1)}%</td><td style="text-align:center">${r.burnPct.toFixed(1)}%</td><td style="text-align:center">${r.crossHeroPct.toFixed(1)}%</td><td style="text-align:center;color:${depthColor}">${r.depth.toFixed(1)}</td></tr>`;
      });
      html += `</table>`;
    } else {
      html += `<div class="report-card"><span style="color:var(--dim)">Not enough data (need 5+ fights per enemy)</span></div>`;
    }
  }
  html += `</div>`;

  // ===================== COST OF VICTORY =====================
  html += `<div class="report-section"><h3>Cost of Victory</h3>`;
  {
    const covAgg = {};
    results.forEach(r => {
      Object.entries(r.tracker.costOfVictory || {}).forEach(([enemy, data]) => {
        if (!covAgg[enemy]) covAgg[enemy] = { fights:0, preReadySkills:0, postReadySkills:0, totalDrain:0, equipLost:0 };
        const a = covAgg[enemy];
        a.fights += data.fights;
        a.preReadySkills += data.preReadySkills;
        a.postReadySkills += data.postReadySkills;
        a.totalDrain += data.totalDrain;
        a.equipLost += data.equipLost;
      });
    });

    const covRows = Object.entries(covAgg)
      .filter(([, d]) => d.fights >= 3)
      .map(([name, d]) => ({
        name,
        fights: d.fights,
        avgDrain: d.fights > 0 ? d.totalDrain / d.fights : 0,
        avgPre: d.fights > 0 ? d.preReadySkills / d.fights : 0,
        avgPost: d.fights > 0 ? d.postReadySkills / d.fights : 0,
        avgEquipLost: d.fights > 0 ? d.equipLost / d.fights : 0
      }))
      .sort((a, b) => b.avgDrain - a.avgDrain);

    if (covRows.length > 0) {
      html += `<div class="report-card insight" style="font-size:10px;margin-bottom:6px">Per-enemy resource drain when hero wins. Higher drain = more expensive victory.</div>`;
      html += `<table style="width:100%;font-size:9px;border-collapse:collapse">`;
      html += `<tr style="border-bottom:1px solid var(--border)"><th>Enemy</th><th>Wins</th><th>Avg Drain</th><th>Pre Skills</th><th>Post Skills</th><th>Equip Lost</th></tr>`;
      covRows.slice(0, 15).forEach(r => {
        const drainColor = r.avgDrain >= 2 ? 'var(--flame)' : r.avgDrain >= 1 ? 'var(--mishap)' : 'var(--dim)';
        html += `<tr><td>${r.name}</td><td style="text-align:center">${r.fights}</td><td style="text-align:center;color:${drainColor}">${r.avgDrain.toFixed(2)}</td><td style="text-align:center">${r.avgPre.toFixed(1)}</td><td style="text-align:center">${r.avgPost.toFixed(1)}</td><td style="text-align:center">${r.avgEquipLost.toFixed(2)}</td></tr>`;
      });
      html += `</table>`;
    } else {
      html += `<div class="report-card"><span style="color:var(--dim)">Not enough data (need 3+ wins per enemy)</span></div>`;
    }
  }
  html += `</div>`;

  // ===================== CASCADING IMPACT =====================
  html += `<div class="report-section"><h3>Cascading Impact</h3>`;
  {
    const cascadeAgg = {};
    results.forEach(r => {
      (r.tracker.cascadingImpact || []).forEach(c => {
        if (!cascadeAgg[c.enemy1]) cascadeAgg[c.enemy1] = { pairs: 0, secondWins: 0, secondLosses: 0 };
        const a = cascadeAgg[c.enemy1];
        a.pairs++;
        if (c.won2) a.secondWins++;
        else a.secondLosses++;
      });
    });

    const cascadeRows = Object.entries(cascadeAgg)
      .filter(([, d]) => d.pairs >= 3)
      .map(([name, d]) => ({
        name,
        pairs: d.pairs,
        secondWinRate: d.pairs > 0 ? d.secondWins / d.pairs * 100 : 0,
        secondLosses: d.secondLosses
      }))
      .sort((a, b) => a.secondWinRate - b.secondWinRate);

    if (cascadeRows.length > 0) {
      html += `<div class="report-card insight" style="font-size:10px;margin-bottom:6px">When hero fights a second enemy within 3 turns of the first. Lower 2nd win rate = first fight leaves hero more vulnerable.</div>`;
      html += `<table style="width:100%;font-size:9px;border-collapse:collapse">`;
      html += `<tr style="border-bottom:1px solid var(--border)"><th>First Enemy</th><th>Sequences</th><th>2nd Fight Win%</th><th>2nd Losses</th></tr>`;
      cascadeRows.slice(0, 10).forEach(r => {
        const winColor = r.secondWinRate < 50 ? 'var(--flame)' : r.secondWinRate < 70 ? 'var(--mishap)' : 'var(--dim)';
        html += `<tr><td>${r.name}</td><td style="text-align:center">${r.pairs}</td><td style="text-align:center;color:${winColor}">${r.secondWinRate.toFixed(1)}%</td><td style="text-align:center">${r.secondLosses}</td></tr>`;
      });
      html += `</table>`;
    } else {
      html += `<div class="report-card"><span style="color:var(--dim)">Not enough data (need 3+ cascading sequences per enemy)</span></div>`;
    }
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
  const bpGames = results.filter(r => r.heroes.some(h => (h.bpEarned||0) > 0));
  if (bpGames.length > 0) {
    t += `<div class="report-card" style="line-height:1.7;font-size:12px">`;
    t += `<b style="font-size:14px">BP Economy</b><br><br>`;

    const totalEarned = bpGames.reduce((s,r) => s + r.heroes.reduce((ss,h) => ss + (h.bpEarned||0), 0), 0);
    const totalSpent = bpGames.reduce((s,r) => s + r.heroes.reduce((ss,h) => ss + (h.bpSpentSkill||0) + (h.bpSpentEquip||0), 0), 0);
    const totalUnspent = bpGames.reduce((s,r) => s + r.heroes.reduce((ss,h) => ss + (h.bp||0), 0), 0);
    const unspentPct = totalEarned > 0 ? (totalUnspent / totalEarned * 100).toFixed(0) : 0;

    t += `Heroes earn <b>${fix1(totalEarned / bpGames.length)} BP per game</b> across the whole party and leave <b>${unspentPct}% unspent</b>. `;

    if (parseInt(unspentPct) > 70) {
      t += `Most BP goes to waste. Heroes either can't reach the Shelter to spend it, or the prices are too high relative to earnings. `;
      t += `Consider: lowering recharge/equipment costs, allowing BP spending at the Hydra, or giving heroes more reasons to visit the Shelter. `;
    } else if (parseInt(unspentPct) > 40) {
      t += `About half the BP is being used. There's room to make BP more impactful, but it's contributing to the economy. `;
    } else {
      t += `BP is being spent efficiently. Heroes are finding opportunities to convert BP into skills and equipment. `;
    }

    const totalVoluntary = results.reduce((s,r) => s + (r.tracker.bpVisits ? r.tracker.bpVisits.voluntary : 0), 0);
    const totalKOVisits = results.reduce((s,r) => s + (r.tracker.bpVisits ? r.tracker.bpVisits.koRespawn : 0), 0);
    if (totalVoluntary + totalKOVisits > 0) {
      t += `Heroes visit the Shelter <b>${totalVoluntary} times voluntarily</b> and <b>${totalKOVisits} times from KO respawn</b>. `;
      if (totalVoluntary === 0) {
        t += `No one ever goes back on purpose, meaning BP is only spent by accident when heroes respawn. `;
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

    // BP: spend at shelter
    bpSpendAtShelter(hero);
    hero._justRespawned = false;

    // Track stalker turnsActive for all stalkers on this hero
    hero.stalkers.forEach(s => trackStalker(s.name, 'turnsActive'));

    // Turn-start effects
    if (hero.equipment.find(e => e.effect === 'turn_start_recharge')) {
      if (Math.floor(Math.random() * 6) + 1 >= 4) rechargeOneSkill(hero, 'wizard_hat');
    }
    // Corrupted Squire: exhaust 1 skill per equipment at turn start
    if (hasStalker(hero, 'exhaust_per_equip')) {
      const equipCount = hero.equipment.length;
      for (let i = 0; i < equipCount; i++) {
        exhaustOneSkill(hero, 'Corrupted Squire');
      }
    }
    // Herbalist (Gigi): cross-turn — fires at start of EVERY hero's turn, not just Gigi's
    const gigiForHerb = G.heroes.find(h => h.id === 'gigi');
    if (gigiForHerb && isSkillReady(gigiForHerb, 'Herbalist') && shouldUseSkill(gigiForHerb, 'Herbalist', { atHydra: G.heroesInHydraArea.has('gigi') })) {
      const candidates = G.heroes.filter(h => h.skillStates.some(s => s === 'exhausted'));
      const neediest = candidates.sort((a,b) => {
        const aScore = b.skillStates.filter(s => s === 'exhausted').length + (b.id === hero.id ? 1 : 0);
        const bScore = a.skillStates.filter(s => s === 'exhausted').length + (a.id === hero.id ? 1 : 0);
        return aScore - bScore;
      })[0];
      if (neediest) {
        useSkill(gigiForHerb, 'Herbalist');
        rechargeOneSkill(neediest, 'herbalist');
        trackSkill('gigi', 'Herbalist', 'activated');
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
      bp: h.bp || 0,
      stalkerCount: h.stalkers.length,
      ko: initHeroTracker(G.tracker, h.id).ko
    };
  });
  // Track BP-purchased equipment outcomes
  G.heroes.forEach(h => {
    h.equipment.forEach(eq => {
      if (eq._bpPurchaseTurn) {
        G.tracker.bpEquipOutcomes.push({ heroId: h.id, equipName: eq.name, purchaseTurn: eq._bpPurchaseTurn, lostTurn: null, heldAtHydra: G.heroesInHydraArea.has(h.id), heldAtEnd: true });
      }
    });
  });
  // Check Hydra floor for BP-purchased equipment that was lost
  (G.hydraFloorEquipment || []).forEach(eq => {
    if (eq._bpPurchaseTurn) {
      G.tracker.bpEquipOutcomes.push({ heroId: eq._bpPurchaseHero, equipName: eq.name, purchaseTurn: eq._bpPurchaseTurn, lostTurn: G.turn, heldAtHydra: false, heldAtEnd: false });
    }
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
      bp:h.bp||0,
      bpEarned:h.bpEarned||0,
      bpSpentSkill:h.bpSpentSkill||0,
      bpSpentEquip:h.bpSpentEquip||0
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

function generateGameSummary(gameIndex) {
  if (!G.debugMode) return null;
  return {
    game: gameIndex,
    victory: G.victory,
    turns: G.turn,
    rounds: G.round,
    tilesPlaced: G.tilesPlaced,
    relicTurns: G.trace.filter(e => e.type === 'awakening' && e.details.type === 'relic_room').map(e => e.turn),
    hydraSpawnTurn: G.tracker.pacing.hydraSpawn,
    hydraHeads: G.tracker.hydraStartingHeads,
    killOrder: G.tracker.hydraHeadKillOrder,
    headsGrown: G.tracker.hydraGrowthLog.length,
    heroSummaries: G.heroes.map(h => ({
      id: h.id,
      combats: (initHeroTracker(G.tracker, h.id) || {}).combats || 0,
      wins: (initHeroTracker(G.tracker, h.id) || {}).wins || 0,
      ko: (initHeroTracker(G.tracker, h.id) || {}).ko || 0,
      bpEarned: h.bpEarned || 0,
      bpSpent: (h.bpSpentSkill||0) + (h.bpSpentEquip||0),
      totalStr: totalStr(h),
      readySkills: readySkillCount(h),
      equipment: h.equipment.map(e => e.name)
    })),
    keyMoments: G.trace.filter(e =>
      (e.type === 'burn' && e.details.outcomeChanged) ||
      e.type === 'passive' ||
      (e.type === 'attack' && e.details.daredevilAutoWin) ||
      e.type === 'applied'
    ).slice(0, 20),
    defeatCause: !G.victory ? classifyDefeat(G) : null
  };
}

// ========== TRACE RENDERING ==========

function formatTrace(traceData) {
  let output = '';
  let currentTurn = -1;
  let currentRound = -1;

  traceData.forEach(function(event) {
    if (event.round !== currentRound) {
      currentRound = event.round;
      output += '\n=== ROUND ' + currentRound + ' ===\n';
    }
    if (event.turn !== currentTurn) {
      currentTurn = event.turn;
      var heroNames = {juju:'Juju (Hero)', gigi:'Gigi (Elf)', lulu:'Lulu (Mage)', eggo:'Eggo (Rogue)'};
      output += '\n--- TURN ' + currentTurn + ': ' + (heroNames[event.hero] || event.hero || 'System') + ' ---\n';
    }
    output += formatTraceEvent(event);
  });

  return output;
}

function formatTraceEvent(e) {
  var d = e.details;
  switch(e.type) {
    case 'hero_state':
      var s = '  POSITION: ' + (typeof d.position === 'string' ? d.position : '(' + d.position.q + ', ' + d.position.r + ')') + '\n';
      s += '  SKILLS: ' + d.skills.map(function(sk) { return '[' + sk.name + ':' + sk.state.toUpperCase() + ']'; }).join(' ') + '\n';
      s += '  EQUIPMENT: ' + (d.equipment.length ? d.equipment.map(function(eq) { return '[' + eq.name + ' ' + (eq.str >= 0 ? '+' : '') + eq.str + ']'; }).join(' ') : '(none)') + '\n';
      s += '  RELICS: ' + (d.relics.length ? d.relics.map(function(r) { return '[' + r.name + (r.owner === e.hero ? ' (owner)' : '') + ']'; }).join(' ') : '(none)') + '\n';
      s += '  FOLLOWERS: ' + (d.followers.length ? d.followers.map(function(f) { return '[' + f.name + ' +' + f.str + ']'; }).join(' ') : '(none)') + '\n';
      s += '  BP: ' + d.bp + ' | STR TOTAL: ' + d.totalStr + ' | READY SKILLS: ' + d.readySkills + '\n';
      return s;
    case 'grimoire_failsafe':
      return '  GRIMOIRE FAILSAFE: ' + d.hero + ' had 0 ready skills - recharged ' + d.recharged + '\n';
    case 'wizard_hat':
      return '  WIZARD HAT: roll ' + d.roll + ' - ' + (d.recharged ? 'recharged a skill' : 'no effect (< 4)') + '\n';
    case 'herbalist':
      return '  HERBALIST (' + d.source + ' cross-turn): recharged ' + d.target + "'s skill\n";
    case 'roll':
      return '  MOVEMENT ROLL: ' + d.value + (d.isFlame ? ' [FLAME]' : '') + ' (raw: ' + d.raw + (d.modifiers.length ? ', mods: ' + d.modifiers.join(', ') : '') + ')\n';
    case 'intent':
      return '  INTENT: ' + d.type + (d.reason ? ' (' + d.reason + ')' : '') + '\n';
    case 'awakening':
      return '  AWAKENING: placed ' + d.type + ' at (' + (d.position ? d.position.q + ', ' + d.position.r : '?') + ')\n';
    case 'step':
      return '    Step: (' + d.from.q + ',' + d.from.r + ') -> (' + d.to.q + ',' + d.to.r + ') [' + (d.isNew ? 'NEW ' : '') + d.tileType + ']' + (d.stopped ? ' <- STOPPED' : '') + '\n';
    case 'resolve':
      return '  ROOM: ' + d.tileType + ' at (' + (d.position && typeof d.position === 'object' ? d.position.q + ', ' + d.position.r : d.position) + ')\n';
    case 'start':
      return '  COMBAT vs ' + d.enemy + ' (STR ' + d.enemyStr + ', ' + d.tier + ')' + (d.enemyEffect ? ' [' + d.enemyEffect + ']' : '') + ':\n    Hero STR: ' + d.heroTotalStr + '\n';
    case 'rolls':
      return '    Hero roll: ' + d.heroRoll + (d.heroIsFlame ? ' [FLAME]' : '') + ' -> total ' + d.heroTotal + '\n    Enemy roll: ' + d.enemyRoll + (d.enemyIsFlame ? ' [FLAME]' : '') + ' -> total ' + d.enemyTotal + '\n';
    case 'activate':
      return '    SKILL: ' + d.hero + ' activates ' + d.skill + ' (' + d.context + ')' + (d.reason ? ': ' + d.reason : '') + '\n';
    case 'burn':
      return '    SKILL BURN: ' + d.hero + ' burns ' + d.skill + ', reroll ' + d.rerollType + ' die: ' + d.oldRoll + ' -> ' + d.newRoll + (d.outcomeChanged ? ' [CHANGED OUTCOME]' : '') + '\n';
    case 'talent':
      return '    TALENT: ' + d.hero + ' -> ' + d.talent + (d.blocked ? ' [BLOCKED]' : '') + ': ' + d.effect + '\n';
    case 'result':
      return '    RESULT: ' + (d.won ? 'WIN' : 'LOSS') + ' (margin ' + d.margin + ')' + (d.bpEarned ? '. BP +' + d.bpEarned : '') + '\n';
    case 'applied':
      return '  KO: ' + d.hero + ' knocked out by ' + d.cause + (d.relicUsed ? ', relic saved' : '') + (d.shieldWall ? ', Shield Wall used' : '') + (d.dodge ? ', Dodge triggered' : '') + '\n    Equipment dropped: ' + ((d.equipmentDropped || []).join(', ') || 'none') + '. Followers lost: ' + ((d.followersLost || []).join(', ') || 'none') + '\n';
    case 'passive':
      return '  RELIC PASSIVE: ' + d.type + ' (' + d.hero + '): ' + JSON.stringify(d.details || {}) + '\n';
    case 'attack':
      return '  HYDRA ATTACK: ' + d.hero + ' vs ' + d.head + ' (STR ' + d.headStr + ')\n    Hero total: ' + d.heroTotal + ' -> ' + (d.won ? 'WIN' + (d.headDestroyed ? ' -- HEAD DESTROYED' : '') : 'LOSS') + (d.daredevilAutoWin ? ' [DAREDEVIL AUTO-WIN]' : '') + '\n';
    case 'grow':
      return '  HEAD GROWTH: ' + d.newHead + ' (source: ' + d.source + '). Alive: ' + d.aliveCount + '/' + d.maxHeads + '\n';
    case 'monster_move':
      return '  MONSTER: ' + d.enemy + ' moves (' + d.from.q + ',' + d.from.r + ') -> (' + d.to.q + ',' + d.to.r + ') toward ' + d.targetHero + (d.reachedHero ? ' <- ARRIVED ON HERO TILE' : '') + '\n';
    case 'end':
      return '\n=== GAME ' + (d.victory ? 'VICTORY' : 'DEFEAT') + ' at turn ' + d.turn + ' ===\n' + (d.cause ? '  Cause: ' + (typeof d.cause === 'object' ? d.cause.detail : d.cause) : '') + '\n';
    default:
      return '  ' + e.phase + '/' + e.type + ': ' + JSON.stringify(d) + '\n';
  }
}

function formatBatchSummary(summary) {
  if (!summary) return '';
  var s = 'GAME #' + summary.game + ': ' + (summary.victory ? 'VICTORY' : 'DEFEAT') + ' in ' + summary.turns + ' turns\n';
  s += '  Hydra: ' + (summary.hydraHeads || []).join(', ') + ' (spawned turn ' + summary.hydraSpawnTurn + ')\n';
  if (summary.killOrder && summary.killOrder.length) {
    s += '  Kill order: ' + summary.killOrder.map(function(k) { return k.head + ' (' + k.killedBy + ', T' + k.turn + ')'; }).join(' -> ') + '\n';
  }
  s += '  Heads grown: ' + summary.headsGrown + '\n';
  summary.heroSummaries.forEach(function(h) {
    s += '  ' + h.id + ': ' + h.combats + ' fights (' + h.wins + 'W), ' + h.ko + ' KOs, ' + h.bpEarned + ' BP earned, ' + h.bpSpent + ' spent\n';
  });
  if (summary.keyMoments && summary.keyMoments.length) {
    s += '  KEY MOMENTS:\n';
    summary.keyMoments.forEach(function(m) {
      s += '    T' + m.turn + ': ' + formatTraceEvent(m).trim() + '\n';
    });
  }
  if (summary.defeatCause) s += '  Defeat: ' + summary.defeatCause.detail + '\n';
  return s;
}

function downloadTrace() {
  if (!G || !G.trace || G.trace.length === 0) return;
  var text = formatTrace(G.trace);
  var blob = new Blob([text], {type: 'text/plain'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'juju_trace_' + new Date().toISOString().slice(0,10) + '.txt';
  a.click();
}

var batchSummaries = [];
function downloadBatchDebug() {
  if (batchSummaries.length === 0) return;
  var text = 'JUJU SIMULATOR -- BATCH DEBUG LOG (' + batchSummaries.length + ' games)\n' + '='.repeat(60) + '\n\n';
  batchSummaries.forEach(function(s) { text += formatBatchSummary(s) + '\n'; });
  var blob = new Blob([text], {type: 'text/plain'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'juju_batch_debug_' + new Date().toISOString().slice(0,10) + '.txt';
  a.click();
}

function runBatch() {
  homeRunBatch();
}

function runBatchInternal(count) {
  document.getElementById('batchBtn').disabled = true;
  document.getElementById('statusBar').textContent = 'Running batch: 0/' + count + '...';

  batchResults = [];
  batchSummaries = [];
  var isDebug = currentTweaks && currentTweaks.debugMode;

  let i = 0;
  function batchStep() {
    const batchSize = Math.min(5, count - i);
    for (let j = 0; j < batchSize; j++) {
      batchResults.push(runSilentGame());
      if (isDebug) {
        var summary = generateGameSummary(i);
        if (summary) batchSummaries.push(summary);
      }
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
      if (batchSummaries.length > 0) {
        var batchDbgBtn = document.getElementById('batchDebugBtn');
        if (batchDbgBtn) batchDbgBtn.style.display = '';
      }
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
    'tab-heroes': ['Hero Performance','Hero State','Hero Arrival','Hero × Enemy','Hero × Hydra','Talent Activations','Relic Effects'],
    'tab-skills-equip': ['Skill Analysis','Equipment Analysis','Equipment Power Combos','Arcane Familiar'],
    'tab-enemies': ['Enemy Design','Enemy Side Effects','Trap Analysis','Follower','Enemy Engagement','Cost of Victory','Cascading Impact'],
    'tab-hydra-econ': ['BP Economy','Hydra Fight','Hydra Combat Detail','Shelter Respawn','Shelter Purchase','Shelter Return'],
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
  const activeHeroes = currentTweaks && currentTweaks.activeHeroes || {};
  const heroNames = ['juju','gigi','lulu','eggo'].filter(id => activeHeroes[id] !== false);
  const heroTag = heroNames.length === 4 ? '4P' : heroNames.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join('+');
  const filename = heroTag + '_JUJU_Report_' + date + '.md';
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
  if (G.debugMode) {
    var traceBtn = document.getElementById('traceBtn');
    if (traceBtn) traceBtn.style.display = '';
  }
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

  // Final hex map
  const finalMap = renderHexMap();
  if (finalMap) {
    html += `<div class="report-section"><h3>Final Map</h3><div class="report-card" style="padding:8px">${finalMap}</div></div>`;
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
    if (bpEnabled()) {
      html += `<br>⭐ BP: earned <b>${hero.bpEarned}</b>, spent on skills <b>${hero.bpSpentSkill}</b>, spent on equip <b>${hero.bpSpentEquip}</b>, remaining <b>${hero.bp}</b>`;
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
  log('All heroes start at the Shelter. 36 rooms to explore.', 'system');
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
// BP toggle visibility
document.getElementById('tw_bpEnabled').addEventListener('change', function() {
  document.getElementById('tw_gilSettings').style.display = this.checked ? 'block' : 'none';
});

// Build equipment and hydra lists on home screen
buildTweaksLists();

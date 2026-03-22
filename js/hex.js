// ========== HEX GRID MODEL ==========
// Axial coordinate system (q, r) with entrance at (0, 0)

const HEX_DIRS = [
  { q: 1, r: 0 },   // 0: East
  { q: 1, r: -1 },  // 1: NE
  { q: 0, r: -1 },  // 2: NW
  { q: -1, r: 0 },  // 3: West
  { q: -1, r: 1 },  // 4: SW
  { q: 0, r: 1 },   // 5: SE
];

function hexKey(q, r) { return `${q},${r}`; }

function hexDistance(q1, r1, q2, r2) {
  const dq = q1 - q2;
  const dr = r1 - r2;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function hexNeighborCoords(q, r) {
  return HEX_DIRS.map(d => ({ q: q + d.q, r: r + d.r }));
}

// Create a new hex map
function createHexMap(maxRadius) {
  const tiles = {};
  const radius = maxRadius || 7;

  function get(q, r) { return tiles[hexKey(q, r)] || null; }
  function set(q, r, tile) { tiles[hexKey(q, r)] = tile; }
  function has(q, r) { return hexKey(q, r) in tiles; }

  function isInBounds(q, r) {
    return hexDistance(0, 0, q, r) <= radius;
  }

  function neighbors(q, r) {
    return hexNeighborCoords(q, r);
  }

  function exploredNeighbors(q, r) {
    return hexNeighborCoords(q, r).filter(n => has(n.q, n.r));
  }

  function unexploredNeighbors(q, r) {
    return hexNeighborCoords(q, r).filter(n => !has(n.q, n.r) && isInBounds(n.q, n.r));
  }

  // BFS shortest path through explored tiles only
  // Returns array of {q, r} from start to end (inclusive), or null if no path
  function findPath(fromQ, fromR, toQ, toR) {
    if (!has(fromQ, fromR) || !has(toQ, toR)) return null;
    const startKey = hexKey(fromQ, fromR);
    const endKey = hexKey(toQ, toR);
    if (startKey === endKey) return [{ q: fromQ, r: fromR }];

    const visited = new Set([startKey]);
    const queue = [{ q: fromQ, r: fromR, path: [{ q: fromQ, r: fromR }] }];

    while (queue.length > 0) {
      const current = queue.shift();
      const nbrs = hexNeighborCoords(current.q, current.r);

      for (const n of nbrs) {
        const nKey = hexKey(n.q, n.r);
        if (visited.has(nKey)) continue;
        if (!has(n.q, n.r)) continue;

        const newPath = [...current.path, { q: n.q, r: n.r }];
        if (nKey === endKey) return newPath;

        visited.add(nKey);
        queue.push({ q: n.q, r: n.r, path: newPath });
      }
    }
    return null; // no path found
  }

  // Find path avoiding Dread Dungeon tiles (except start and end)
  function findPathAvoidDD(fromQ, fromR, toQ, toR) {
    if (!has(fromQ, fromR) || !has(toQ, toR)) return null;
    const startKey = hexKey(fromQ, fromR);
    const endKey = hexKey(toQ, toR);
    if (startKey === endKey) return [{ q: fromQ, r: fromR }];

    const visited = new Set([startKey]);
    const queue = [{ q: fromQ, r: fromR, path: [{ q: fromQ, r: fromR }] }];

    while (queue.length > 0) {
      const current = queue.shift();
      const nbrs = hexNeighborCoords(current.q, current.r);

      for (const n of nbrs) {
        const nKey = hexKey(n.q, n.r);
        if (visited.has(nKey)) continue;
        if (!has(n.q, n.r)) continue;

        const newPath = [...current.path, { q: n.q, r: n.r }];
        if (nKey === endKey) return newPath;

        // Skip Dread Dungeon tiles as intermediate steps (hero must stop there)
        const tile = get(n.q, n.r);
        if (tile && tile.type === 'dread') continue;

        visited.add(nKey);
        queue.push({ q: n.q, r: n.r, path: newPath });
      }
    }
    // Fallback: try regular path (will stop at DD)
    return findPath(fromQ, fromR, toQ, toR);
  }

  function allExplored() {
    return Object.values(tiles);
  }

  function exploredCount() {
    return Object.keys(tiles).length;
  }

  return {
    tiles, get, set, has,
    isInBounds, neighbors, exploredNeighbors, unexploredNeighbors,
    findPath, findPathAvoidDD, allExplored, exploredCount,
    maxRadius: radius
  };
}

// Choose the best direction for exploration
// Prefers directions with unexplored hexes, biased away from entrance
function chooseExploreDirection(hexMap, q, r) {
  const candidates = [];

  for (let i = 0; i < 6; i++) {
    const dir = HEX_DIRS[i];
    const nq = q + dir.q;
    const nr = r + dir.r;

    if (!hexMap.isInBounds(nq, nr)) continue;

    // Score: prefer unexplored, prefer moving away from center
    let score = 0;
    if (!hexMap.has(nq, nr)) score += 10; // unexplored = strong preference
    const distFromCenter = hexDistance(0, 0, nq, nr);
    score += distFromCenter; // bias outward

    // Look ahead: how many unexplored hexes does this direction open up?
    const secondStepUnexplored = hexNeighborCoords(nq, nr)
      .filter(n2 => !hexMap.has(n2.q, n2.r) && hexMap.isInBounds(n2.q, n2.r)).length;
    score += secondStepUnexplored;

    candidates.push({ dirIndex: i, score });
  }

  if (candidates.length === 0) return 0; // shouldn't happen

  // Sort by score descending, pick from top candidates with some randomness
  candidates.sort((a, b) => b.score - a.score);
  const topScore = candidates[0].score;
  const topCandidates = candidates.filter(c => c.score >= topScore - 2);
  return topCandidates[Math.floor(Math.random() * topCandidates.length)].dirIndex;
}

// Find the best step for exploration in a given direction
// If primary direction is blocked (out of bounds or explored), try adjacent directions
function findExploreStep(hexMap, q, r, dirIndex) {
  // Try primary direction
  const primary = HEX_DIRS[dirIndex];
  const pq = q + primary.q;
  const pr = r + primary.r;

  if (hexMap.isInBounds(pq, pr) && !hexMap.has(pq, pr)) {
    return { q: pq, r: pr, explored: false };
  }

  // If primary is already explored, can still walk through it
  if (hexMap.has(pq, pr)) {
    return { q: pq, r: pr, explored: true };
  }

  // Primary out of bounds: try clockwise then counter-clockwise
  for (let offset = 1; offset <= 2; offset++) {
    for (const sign of [1, -1]) {
      const altIdx = ((dirIndex + sign * offset) % 6 + 6) % 6;
      const alt = HEX_DIRS[altIdx];
      const aq = q + alt.q;
      const ar = r + alt.r;
      if (hexMap.isInBounds(aq, ar) && !hexMap.has(aq, ar)) {
        return { q: aq, r: ar, explored: false };
      }
      if (hexMap.has(aq, ar)) {
        return { q: aq, r: ar, explored: true };
      }
    }
  }

  return null; // completely stuck (very rare)
}

// Helper to check if a hero is at the entrance
function isAtEntrance(hero) {
  if (hero.pos === 'hydra') return false;
  return hero.pos.q === 0 && hero.pos.r === 0;
}

// Get the hex tile a hero is standing on
function heroHexTile(hero) {
  if (hero.pos === 'hydra') return null;
  return G.hexMap ? G.hexMap.get(hero.pos.q, hero.pos.r) : null;
}

// Get distance from hero to entrance
function heroDistanceToEntrance(hero) {
  if (hero.pos === 'hydra') return Infinity;
  return hexDistance(hero.pos.q, hero.pos.r, 0, 0);
}

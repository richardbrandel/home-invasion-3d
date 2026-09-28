// sim.js — pure simulation for Home Invasion 3D. Deliberately imports NOTHING,
// so it can be driven headlessly under Node and unit-tested without a browser or
// a WebGL context. All logic is in the XZ plane; Y is height and is handled by
// the renderer only.
//
// Units are metres. The player is ~1.7 tall, walls 3, the van 2.4.

// ------------------------------------------------------------------ world
export const WORLD = {
  bounds: { minX: -28, maxX: 28, minZ: -23, maxZ: 23 },
  house:  { minX: -12, maxX: 12, minZ: -20, maxZ: -6 },
  wallHeight: 3,
  wallThickness: 0.3,
  doorGap: { minX: -2, maxX: 2 },
};

// Solids are axis-aligned boxes in XZ: { x1, z1, x2, z2 }. Used for movement
// collision, for line-of-sight, and (extruded) as geometry by the renderer.
const T = WORLD.wallThickness;
const H = WORLD.house;

export const WALLS = [
  { x1: H.minX,      z1: H.minZ,      x2: H.maxX,      z2: H.minZ + T },   // north
  { x1: H.minX,      z1: H.maxZ - T,  x2: WORLD.doorGap.minX, z2: H.maxZ },// south-west
  { x1: WORLD.doorGap.maxX, z1: H.maxZ - T, x2: H.maxX, z2: H.maxZ },      // south-east
  { x1: H.minX,      z1: H.minZ,      x2: H.minX + T,  z2: H.maxZ },       // west
  { x1: H.maxX - T,  z1: H.minZ,      x2: H.maxX,      z2: H.maxZ },       // east
];

export const FURNITURE = [
  { x1: -10.25, z1: -7.95, x2: -7.75, z2: -7.05, kind: 'sofa',  h: 0.85 },
  { x1:   6.00, z1: -9.50, x2:  8.00, z2: -8.50, kind: 'table', h: 0.75 },
  { x1:  -2.50, z1: -18.9, x2:  0.50, z2: -18.1, kind: 'shelf', h: 1.80 },
];

export const SOLIDS = WALLS.concat(FURNITURE);

export const VAN = { x1: -2.75, z1: 7.0, x2: 2.75, z2: 9.4, h: 2.4 };
export const DROP = { x: 0, z: 4.5 };

export const LOOT_SPOTS = [
  { x: -8.0, z: -17.0, label: 'TV',     node: 'tv',   value: 1 },
  { x:  8.0, z: -17.0, label: 'Laptop', node: 'pc',   value: 1 },
  { x: -8.0, z:  -9.5, label: 'Safe',   node: 'safe', value: 1 },
];

// Navigation graph. Every edge is a straight line through open floor — checked
// by test/sim.test.js, which asserts no edge crosses a solid.
export const NODES = {
  van:     { x: 0,    z: 4.5,   edges: ['doorOut'] },
  doorOut: { x: 0,    z: 2.5,   edges: ['van', 'doorIn'] },
  // NOTE: doorIn deliberately has no direct edge to `safe`. The straight line
  // clips the south wall's corner at the door jamb, which wedged the thief.
  // Everything routes hub-first instead. test/sim.test.js guards this.
  doorIn:  { x: 0,    z: -4.5,  edges: ['doorOut', 'hub'] },
  hub:     { x: 0,    z: -12,   edges: ['doorIn', 'tv', 'pc', 'safe'] },
  tv:      { x: -6.5, z: -14.5, edges: ['hub'] },
  pc:      { x: 6.5,  z: -14.5, edges: ['hub'] },
  safe:    { x: -6.5, z: -9.5,  edges: ['hub'] },
};

// ------------------------------------------------------------------ weapons
export const WEAPONS = {
  pistol:  { name: 'Pistol',  dmg: 26, cd: 0.24, mag: 12, reload: 1.15, pellets: 1, spread: 0.02,  auto: false },
  shotgun: { name: 'Shotgun', dmg: 13, cd: 0.85, mag: 6,  reload: 1.60, pellets: 9, spread: 0.15,  auto: false },
};

export const TUNING = {
  playerSpeed: 4.6,
  playerRadius: 0.45,
  thiefSpeed: 2.6,
  thiefRadius: 0.45,
  thiefHealth: 100,
  thiefDamage: 9,
  thiefSight: 26,
  thiefFireRate: { hunting: 0.95, carrying: 1.5 },
  thiefMag: 8,
  thiefReload: 1.5,
  grabRange: 1.4,
  dropRange: 1.6,
};

// ------------------------------------------------------------------ geometry
export function segRect(x1, z1, x2, z2, r) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dz = z2 - z1;
  const p = [-dx, dx, -dz, dz];
  const q = [x1 - r.x1, r.x2 - x1, z1 - r.z1, r.z2 - z1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else          { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}

export function segCircle(x1, z1, x2, z2, cx, cz, r) {
  const dx = x2 - x1, dz = z2 - z1;
  const len2 = dx * dx + dz * dz;
  let t = len2 ? ((cx - x1) * dx + (cz - z1) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx, pz = z1 + t * dz;
  return (px - cx) ** 2 + (pz - cz) ** 2 <= r * r;
}

export function losBlocked(x1, z1, x2, z2) {
  for (const s of SOLIDS) if (segRect(x1, z1, x2, z2, s)) return true;
  return false;
}

// ------------------------------------------------------------------ visibility
// Ray from (px,pz) along the unit direction (dx,dz). Returns the parametric
// distance to the first solid, or maxT when nothing is in the way.
export function rayCast(px, pz, dx, dz, maxT = 60, solids = SOLIDS) {
  let best = maxT;
  for (const s of solids) {
    let tmin = 0, tmax = maxT, ok = true;
    for (const [p, d, lo, hi] of [[px, dx, s.x1, s.x2], [pz, dz, s.z1, s.z2]]) {
      if (Math.abs(d) < 1e-9) {
        if (p < lo || p > hi) { ok = false; break; }
      } else {
        let t1 = (lo - p) / d, t2 = (hi - p) / d;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { ok = false; break; }
      }
    }
    if (ok && tmin < best) best = tmin;
  }
  return best;
}

// True only when b is both in range of a AND has unobstructed line of sight to
// it. This is what keeps the intruder off the minimap when a wall is in the way.
export function canSee(ax, az, bx, bz, maxRange = 28) {
  if (Math.hypot(bx - ax, bz - az) > maxRange) return false;
  return !losBlocked(ax, az, bx, bz);
}

// Visibility polygon from a point: cast a ray at every wall corner (with a small
// epsilon either side so corners come out crisp) plus a coarse ring so open
// ground is covered. Returns world-space XZ points in angular order.
export function visibilityPolygon(px, pz, maxRange = 28, solids = SOLIDS) {
  const angles = [];
  for (const s of solids) {
    for (const [cx, cz] of [[s.x1, s.z1], [s.x2, s.z1], [s.x2, s.z2], [s.x1, s.z2]]) {
      const a = Math.atan2(cz - pz, cx - px);
      angles.push(a - 1e-4, a, a + 1e-4);
    }
  }
  for (let i = 0; i < 64; i++) angles.push((i / 64) * Math.PI * 2);
  angles.sort((a, b) => a - b);

  const pts = [];
  for (const a of angles) {
    const dx = Math.cos(a), dz = Math.sin(a);
    const t = rayCast(px, pz, dx, dz, maxRange, solids);
    pts.push({ x: px + dx * t, z: pz + dz * t });
  }
  return pts;
}

// Circle-vs-AABB resolution in XZ. Handles a centre that ends up inside a solid.
export function resolveCircle(e, solids = SOLIDS) {
  const R = e.r;
  for (const s of solids) {
    const cx = Math.max(s.x1, Math.min(e.x, s.x2));
    const cz = Math.max(s.z1, Math.min(e.z, s.z2));
    const dx = e.x - cx, dz = e.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= R * R) continue;
    if (d2 < 1e-9) {
      const left = e.x - s.x1, right = s.x2 - e.x;
      const near = e.z - s.z1, far = s.z2 - e.z;
      const m = Math.min(left, right, near, far);
      if (m === left) e.x = s.x1 - R;
      else if (m === right) e.x = s.x2 + R;
      else if (m === near) e.z = s.z1 - R;
      else e.z = s.z2 + R;
      continue;
    }
    const d = Math.sqrt(d2);
    const push = (R - d) / d;
    e.x += dx * push; e.z += dz * push;
  }
  return e;
}

export function clampToWorld(e) {
  const b = WORLD.bounds;
  e.x = Math.max(b.minX + e.r, Math.min(b.maxX - e.r, e.x));
  e.z = Math.max(b.minZ + e.r, Math.min(b.maxZ - e.r, e.z));
  return e;
}

// ------------------------------------------------------------------ pathing
export function nearestNode(x, z) {
  let best = 'hub', bd = Infinity;
  for (const [k, n] of Object.entries(NODES)) {
    const d = (x - n.x) ** 2 + (z - n.z) ** 2;
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

export function pathNodes(fromKey, toKey) {
  if (fromKey === toKey) return [];
  const prev = { [fromKey]: null };
  const q = [fromKey];
  while (q.length) {
    const cur = q.shift();
    for (const nxt of NODES[cur].edges) {
      if (nxt in prev) continue;
      prev[nxt] = cur;
      if (nxt === toKey) {
        const out = [];
        let k = toKey;
        while (k && k !== fromKey) { out.unshift(k); k = prev[k]; }
        return out;
      }
      q.push(nxt);
    }
  }
  return [];
}

export function routeTo(fromKey, toKey) {
  return pathNodes(fromKey, toKey).map(k => ({ x: NODES[k].x, z: NODES[k].z }));
}

// ------------------------------------------------------------------ entities
export function createPlayer() {
  return {
    x: 0, z: -13, r: TUNING.playerRadius, yaw: 0, pitch: 0,
    hp: 100, alive: true, weapon: 'pistol',
    mag: WEAPONS.pistol.mag, cd: 0, reloading: 0,
  };
}

export function createThief() {
  return {
    x: DROP.x, z: DROP.z + 0.5, px: DROP.x, pz: DROP.z + 0.5,
    r: TUNING.thiefRadius, yaw: Math.PI,
    hp: TUNING.thiefHealth, alive: true,
    mag: TUNING.thiefMag, cd: 1.2, reloading: 0,
    carry: null, target: null, route: [], mode: 'hunt',
    stuckT: 0, repathT: 0,
  };
}

export function createLoot() {
  return LOOT_SPOTS.map(s => ({ ...s, taken: false, delivered: false }));
}

export function remaining(loot) {
  return loot.filter(l => !l.delivered).length;
}

// ------------------------------------------------------------------ thief AI
// ctx: { player, loot, events }  — events is an array the caller drains for
// sound/UI hooks, so this module stays free of presentation concerns.
export function stepThief(thief, ctx, dt, tuning = TUNING) {
  const { player, loot, events } = ctx;
  if (!thief.alive) return;

  thief.cd -= dt;
  if (thief.reloading > 0) thief.reloading -= dt;
  if (thief.repathT > 0) thief.repathT -= dt;

  const seePlayer = player.alive &&
    Math.hypot(thief.x - player.x, thief.z - player.z) < tuning.thiefSight &&
    !losBlocked(thief.x, thief.z, player.x, player.z);

  // ---- decide
  if (thief.carry) {
    thief.mode = 'carry';
    if (thief.route.length === 0) thief.route = routeTo(nearestNode(thief.x, thief.z), 'van');
    if (Math.hypot(thief.x - DROP.x, thief.z - DROP.z) < tuning.dropRange) {
      const item = loot.find(l => l.label === thief.carry);
      if (item) item.delivered = true;
      events.push({ type: 'delivered', label: thief.carry });
      thief.carry = null;
      thief.route = [];
      if (remaining(loot) === 0) events.push({ type: 'allStolen' });
    }
  } else {
    const avail = loot.filter(l => !l.delivered && !l.taken);
    if (avail.length === 0) {
      thief.mode = 'idle';
    } else {
      thief.mode = 'hunt';
      const targetGone = !thief.target || thief.target.delivered || thief.target.taken;
      if (targetGone) {
        // choose the nearest remaining item, but re-evaluate periodically rather
        // than every frame so the thief commits to a plan like a person would
        thief.target = avail.reduce((a, b) =>
          Math.hypot(thief.x - a.x, thief.z - a.z) < Math.hypot(thief.x - b.x, thief.z - b.z) ? a : b);
        thief.route = routeTo(nearestNode(thief.x, thief.z), thief.target.node);
        thief.route.push({ x: thief.target.x, z: thief.target.z });
      }
      if (Math.hypot(thief.x - thief.target.x, thief.z - thief.target.z) < tuning.grabRange) {
        thief.target.taken = true;
        thief.carry = thief.target.label;
        events.push({ type: 'grabbed', label: thief.target.label });
        thief.route = [];
        thief.target = null;
      }
    }
  }

  // ---- move
  if (thief.route.length) {
    const wp = thief.route[0];
    const d = Math.hypot(thief.x - wp.x, thief.z - wp.z);
    if (d < 0.6) thief.route.shift();
    else {
      const a = Math.atan2(wp.z - thief.z, wp.x - thief.x);
      const step = thief.speedScale === undefined ? 1 : thief.speedScale;
      thief.x += Math.cos(a) * tuning.thiefSpeed * step * dt;
      thief.z += Math.sin(a) * tuning.thiefSpeed * step * dt;
      resolveCircle(thief);
      clampToWorld(thief);
      thief.yaw = a;
    }
  }

  // ---- stuck detection: re-route rather than stand still forever
  const moved = Math.hypot(thief.x - thief.px, thief.z - thief.pz);
  if (moved < tuning.thiefSpeed * dt * 0.25) thief.stuckT += dt; else thief.stuckT = 0;
  thief.px = thief.x; thief.pz = thief.z;

  if (thief.stuckT > 1.2) {
    thief.stuckT = 0;
    const back = thief.carry ? 'van' : (thief.target ? thief.target.node : 'hub');
    thief.route = routeTo(nearestNode(thief.x, thief.z), back);
    events.push({ type: 'reroute' });
  }

  // ---- shoot. Sight is recomputed AFTER moving: the thief can step behind
  // cover during this same step, and firing through a wall would be a bug.
  const canSee = player.alive &&
    Math.hypot(thief.x - player.x, thief.z - player.z) < tuning.thiefSight &&
    !losBlocked(thief.x, thief.z, player.x, player.z);
  if (canSee && thief.reloading <= 0 && thief.cd <= 0) {
    if (thief.mag <= 0) { thief.reloading = tuning.thiefReload; thief.mag = tuning.thiefMag; }
    else {
      thief.mag--;
      thief.cd = thief.carry ? tuning.thiefFireRate.carrying : tuning.thiefFireRate.hunting;
      events.push({ type: 'thiefShot', spread: 0.10, dmg: tuning.thiefDamage });
    }
  }
  return canSee;
}

// ------------------------------------------------------------------ damage
export function damageThief(thief, dmg, events) {
  if (!thief.alive) return false;
  thief.hp -= dmg;
  if (thief.hp <= 0) {
    thief.hp = 0; thief.alive = false;
    events.push({ type: 'thiefDown' });
    return true;
  }
  events.push({ type: 'thiefHit' });
  return false;
}

export function damagePlayer(player, dmg, events) {
  if (!player.alive) return false;
  player.hp -= dmg;
  if (player.hp <= 0) {
    player.hp = 0; player.alive = false;
    events.push({ type: 'playerDown' });
    return true;
  }
  events.push({ type: 'playerHit' });
  return false;
}

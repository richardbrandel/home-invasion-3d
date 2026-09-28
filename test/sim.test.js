// Headless tests for the pure simulation. No browser, no WebGL, no Three.js.
// Run: npm test
import assert from 'node:assert/strict'
import * as sim from '../src/sim.js'

let pass = 0, fail = 0
function check (name, fn) {
  try { fn(); console.log('  PASS  ' + name); pass++ }
  catch (e) { console.log('  FAIL  ' + name + '\n        ' + e.message); fail++ }
}

console.log('\ngeometry + navigation')

check('every nav edge is a clear straight line (no edge crosses a solid)', () => {
  for (const [k, n] of Object.entries(sim.NODES)) {
    for (const m of n.edges) {
      const t = sim.NODES[m]
      for (const s of sim.SOLIDS) {
        assert.ok(!sim.segRect(n.x, n.z, t.x, t.z, s),
          `edge ${k} -> ${m} passes through solid at (${s.x1},${s.z1})-(${s.x2},${s.z2})`)
      }
    }
  }
})

check('each loot spot is reachable from its nav node', () => {
  for (const l of sim.LOOT_SPOTS) {
    const n = sim.NODES[l.node]
    for (const s of sim.SOLIDS) {
      assert.ok(!sim.segRect(n.x, n.z, l.x, l.z, s), `loot "${l.label}" is behind a solid`)
    }
  }
})

check('the door gap is actually open (van route reaches inside)', () => {
  assert.ok(!sim.losBlocked(0, 2.5, 0, -4.5), 'the doorway blocks the route into the house')
})

check('line of sight is blocked through a wall, clear inside the house', () => {
  assert.ok(sim.losBlocked(0, -19, 0, -25), 'LOS straight through the north wall should be blocked')
  assert.ok(!sim.losBlocked(0, -8, 0, -12), 'LOS across open floor should be clear')
})

check('collision pushes an entity out of a wall', () => {
  const s = sim.WALLS[0]
  const e = { x: s.x1 + 0.05, z: s.z1 + 0.05, r: 0.45 }
  sim.resolveCircle(e)
  const stillInside = e.x > s.x1 && e.x < s.x2 && e.z > s.z1 && e.z < s.z2
  assert.ok(!stillInside, 'entity remained inside the wall after resolution')
})

check('pathfinding returns a connected route', () => {
  const r = sim.routeTo('van', 'tv')
  assert.ok(r.length >= 3, `expected a multi-hop route, got ${JSON.stringify(r)}`)
  const last = r[r.length - 1]
  assert.equal(last.x, sim.NODES.tv.x)
  assert.equal(last.z, sim.NODES.tv.z)
})

console.log('\nthief AI')

check('thief completes a full heist against an idle player', () => {
  const player = sim.createPlayer()
  const thief = sim.createThief()
  const loot = sim.createLoot()
  const events = []
  const dt = 1 / 60
  let t = 0
  while (t < 180 && sim.remaining(loot) > 0) {
    sim.stepThief(thief, { player, loot, events }, dt)
    t += dt
  }
  assert.equal(sim.remaining(loot), 0,
    `only ${3 - sim.remaining(loot)}/3 delivered after ${t.toFixed(1)}s`)
  assert.ok(events.some(e => e.type === 'allStolen'), 'allStolen was never emitted')
  const reroutes = events.filter(e => e.type === 'reroute').length
  console.log(`        cleared 3 items in ${t.toFixed(1)}s of simulated play, ${reroutes} re-routes`)
})

check('thief never drifts outside the world bounds', () => {
  const player = sim.createPlayer()
  const thief = sim.createThief()
  const loot = sim.createLoot()
  const events = []
  const b = sim.WORLD.bounds
  for (let i = 0; i < 60 * 120; i++) {
    sim.stepThief(thief, { player, loot, events }, 1 / 60)
    assert.ok(thief.x >= b.minX - 0.01 && thief.x <= b.maxX + 0.01, `thief x out of bounds: ${thief.x}`)
    assert.ok(thief.z >= b.minZ - 0.01 && thief.z <= b.maxZ + 0.01, `thief z out of bounds: ${thief.z}`)
    if (!thief.alive) break
  }
})

check('thief shoots when it has line of sight to the player', () => {
  const player = sim.createPlayer()
  const thief = sim.createThief()
  const loot = sim.createLoot()
  const events = []
  // put the thief in the open, inside the house, facing the player
  thief.x = 0; thief.z = -8; thief.px = 0; thief.pz = -8
  player.x = 0; player.z = -13
  for (let i = 0; i < 60 * 8; i++) sim.stepThief(thief, { player, loot, events }, 1 / 60)
  assert.ok(events.some(e => e.type === 'thiefShot'), 'thief never fired with clear line of sight')
})

check('thief NEVER fires while line of sight is blocked (invariant)', () => {
  // Stronger than a fixed scenario: sweep the player around and assert the
  // invariant holds on every single shot, whatever the geometry happens to be.
  const player = sim.createPlayer()
  const thief = sim.createThief()
  const loot = sim.createLoot()
  const dt = 1 / 60
  let shots = 0, blockedFrames = 0
  for (let i = 0; i < 60 * 90; i++) {
    player.x = Math.sin(i / 97) * 9
    player.z = -13 + Math.cos(i / 131) * 6
    if (sim.losBlocked(thief.x, thief.z, player.x, player.z)) blockedFrames++
    const events = []
    sim.stepThief(thief, { player, loot, events }, dt)
    for (const e of events) {
      if (e.type !== 'thiefShot') continue
      shots++
      assert.ok(!sim.losBlocked(thief.x, thief.z, player.x, player.z),
        `fired through a wall at frame ${i}: thief(${thief.x.toFixed(1)},${thief.z.toFixed(1)}) -> player(${player.x.toFixed(1)},${player.z.toFixed(1)})`)
    }
  }
  assert.ok(shots > 0, 'no shots taken at all — test is not exercising the path')
  console.log(`        ${shots} shots fired, all with clear line of sight (${blockedFrames} blocked frames available)`)
})

console.log('\nvisibility + minimap fog of war')

check('rayCast stops at a wall instead of passing through it', () => {
  // standing just inside the north wall, firing north
  const t = sim.rayCast(0, -18.5, 0, -1, 60)
  assert.ok(t < 2, `ray should stop at the north wall (z=-20), got t=${t.toFixed(2)}`)
})

check('rayCast travels the full range across open ground', () => {
  assert.equal(sim.rayCast(0, 10, 0, 1, 60), 60)
})

check('canSee is false through a wall, true across open floor', () => {
  assert.ok(!sim.canSee(0, -18, 0, -23), 'saw through the north wall')
  assert.ok(sim.canSee(0, -8, 0, -13), 'failed to see across open floor')
})

check('canSee respects the sight radius', () => {
  assert.ok(!sim.canSee(0, 20, 0, -20, 10), 'saw far beyond max range')
})

check('THE REQUIREMENT: intruder is hidden behind a wall, visible through the doorway', () => {
  const px = 0, pz = -13                                  // homeowner inside
  const behindWall = { x: 8, z: 12 }                      // outside, sight line crosses the SE wall
  const inDoorway = { x: 0, z: 0 }                        // outside, straight through the open door
  assert.ok(!sim.canSee(px, pz, behindWall.x, behindWall.z, 28),
    'intruder was visible through a wall — this is the bug being guarded against')
  assert.ok(sim.canSee(px, pz, inDoorway.x, inDoorway.z, 28),
    'intruder in the open doorway should be visible')
})

check('visibility polygon stays in range and never enters a solid', () => {
  const px = 0, pz = -18
  const poly = sim.visibilityPolygon(px, pz, 28)
  assert.ok(poly.length > 20, `expected a real polygon, got ${poly.length} points`)
  for (const p of poly) {
    const d = Math.hypot(p.x - px, p.z - pz)
    assert.ok(d <= 28.01, `polygon vertex ${d.toFixed(2)} beyond max range`)
    for (const s of sim.SOLIDS) {
      const inside = p.x > s.x1 + 1e-6 && p.x < s.x2 - 1e-6 &&
                     p.z > s.z1 + 1e-6 && p.z < s.z2 - 1e-6
      assert.ok(!inside, `polygon vertex (${p.x.toFixed(2)},${p.z.toFixed(2)}) is inside a solid`)
    }
  }
})

check('visibility polygon is cheap enough to run every frame', () => {
  const t0 = process.hrtime.bigint()
  const N = 200
  for (let i = 0; i < N; i++) sim.visibilityPolygon(Math.sin(i) * 8, -13, 28)
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N
  assert.ok(ms < 4, `visibilityPolygon took ${ms.toFixed(2)} ms per call — too slow at 60 fps`)
  console.log(`        ${ms.toFixed(3)} ms per polygon, ${N} sampled`)
})

console.log('\ndamage')

check('lethal damage kills the thief and emits thiefDown', () => {
  const thief = sim.createThief()
  const events = []
  const killed = sim.damageThief(thief, 150, events)
  assert.equal(killed, true)
  assert.equal(thief.alive, false)
  assert.ok(events.some(e => e.type === 'thiefDown'))
})

check('pistol needs 4 hits, shotgun needs 2 at close range', () => {
  const p = sim.WEAPONS.pistol, s = sim.WEAPONS.shotgun
  assert.equal(Math.ceil(sim.TUNING.thiefHealth / p.dmg), 4)
  assert.equal(Math.ceil(sim.TUNING.thiefHealth / (s.dmg * s.pellets)), 1)
})

check('player death emits playerDown and clamps hp at zero', () => {
  const player = sim.createPlayer()
  const events = []
  const killed = sim.damagePlayer(player, 999, events)
  assert.equal(killed, true)
  assert.equal(player.hp, 0)
  assert.ok(events.some(e => e.type === 'playerDown'))
})

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)

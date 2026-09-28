// game.js — rendering, input and presentation for Home Invasion 3D.
// All simulation lives in sim.js so it can be tested without a GPU.
import * as THREE from 'three'
import * as sim from './sim.js'
import { createHumanoid } from './humanoid.js'
import { createMinimap } from './minimap.js'

// ------------------------------------------------------------------ renderer
const canvas = document.getElementById('view')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x8fb8d8)
scene.fog = new THREE.Fog(0x8fb8d8, 55, 130)

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400)

function resize () {
  renderer.setSize(innerWidth, innerHeight, false)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize); resize()

// ------------------------------------------------------------------ lighting
scene.add(new THREE.HemisphereLight(0xbcd8f0, 0x3d5a3a, 1.6))
const sun = new THREE.DirectionalLight(0xfff2d8, 2.6)
sun.position.set(22, 34, 18)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.left = -45; sun.shadow.camera.right = 45
sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45
sun.shadow.camera.far = 120
sun.shadow.bias = -0.0006
scene.add(sun)

// ------------------------------------------------------------------ materials
const M = {
  grass: new THREE.MeshStandardMaterial({ color: 0x3f6b3f, roughness: 1 }),
  drive: new THREE.MeshStandardMaterial({ color: 0x54544f, roughness: 1 }),
  wall:  new THREE.MeshStandardMaterial({ color: 0xdad6cf, roughness: 0.9 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.95 }),
  sofa:  new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.95 }),
  table: new THREE.MeshStandardMaterial({ color: 0x9a6b42, roughness: 0.8 }),
  shelf: new THREE.MeshStandardMaterial({ color: 0x6f5136, roughness: 0.9 }),
  van:   new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55, metalness: 0.25 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.15, metalness: 0.6 }),
  tyre:  new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 1 }),
  loot:  new THREE.MeshStandardMaterial({ color: 0xf5b02a, emissive: 0x8a5a00, emissiveIntensity: 0.9, roughness: 0.4 }),
  held:  new THREE.MeshStandardMaterial({ color: 0xa78bfa, emissive: 0x4c1d95, emissiveIntensity: 0.9, roughness: 0.4 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x5b3f28, roughness: 1 }),
  leaf:  new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 1 }),
}

const collidables = []
const worldGroup = new THREE.Group(); scene.add(worldGroup)
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)

function addBox (x1, z1, x2, z2, h, mat, yBase = 0, opts = {}) {
  const m = box(x2 - x1, h, z2 - z1, mat)
  m.position.set((x1 + x2) / 2, yBase + h / 2, (z1 + z2) / 2)
  m.castShadow = opts.cast !== false
  m.receiveShadow = true
  worldGroup.add(m)
  if (opts.solid !== false) collidables.push(m)
  return m
}

// ------------------------------------------------------------------ world
const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), M.grass)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
worldGroup.add(ground)

const drive = new THREE.Mesh(new THREE.PlaneGeometry(18, 22), M.drive)
drive.rotation.x = -Math.PI / 2
drive.position.set(0, 0.01, 8)
drive.receiveShadow = true
worldGroup.add(drive)

addBox(sim.WORLD.house.minX, sim.WORLD.house.minZ, sim.WORLD.house.maxX, sim.WORLD.house.maxZ,
  0.12, M.floor, 0, { cast: false, solid: false })

for (const w of sim.WALLS) addBox(w.x1, w.z1, w.x2, w.z2, sim.WORLD.wallHeight, M.wall)
for (const w of sim.WALLS) {
  const m = box((w.x2 - w.x1) + 0.18, 0.22, (w.z2 - w.z1) + 0.18, M.wall)
  m.position.set((w.x1 + w.x2) / 2, sim.WORLD.wallHeight + 0.11, (w.z1 + w.z2) / 2)
  m.castShadow = true
  worldGroup.add(m)
}
for (const f of sim.FURNITURE) addBox(f.x1, f.z1, f.x2, f.z2, f.h, M[f.kind] || M.table)

{ // van
  const v = sim.VAN
  const van = new THREE.Group()
  const body = box(v.x2 - v.x1, 1.5, v.z2 - v.z1, M.van)
  body.position.y = 0.95; body.castShadow = true; body.receiveShadow = true
  van.add(body)
  const cab = box((v.x2 - v.x1) * 0.9, 0.75, 1.6, M.van)
  cab.position.set(0, 1.95, -0.2); cab.castShadow = true
  van.add(cab)
  const windscreen = box((v.x2 - v.x1) * 0.82, 0.5, 0.12, M.glass)
  windscreen.position.set(0, 1.95, 0.62)
  van.add(windscreen)
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16), M.tyre)
    t.rotation.z = Math.PI / 2
    t.position.set(dx * ((v.x2 - v.x1) / 2 - 0.25), 0.42, dz * ((v.z2 - v.z1) / 2 - 0.3))
    t.castShadow = true
    van.add(t)
  }
  van.position.set((v.x1 + v.x2) / 2, 0, (v.z1 + v.z2) / 2)
  worldGroup.add(van)
  collidables.push(body)
}

for (const [tx, tz] of [[-20, -14], [19, -16], [-22, 6], [21, 4], [-16, 18], [17, 19]]) {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 3.2, 10), M.trunk)
  trunk.position.y = 1.6; trunk.castShadow = true
  const crown = new THREE.Mesh(new THREE.ConeGeometry(2.1, 4.2, 12), M.leaf)
  crown.position.y = 4.6; crown.castShadow = true
  g.add(trunk, crown)
  g.position.set(tx, 0, tz)
  worldGroup.add(g)
  collidables.push(trunk)
}

// ------------------------------------------------------------------ actors
const playerActor = createHumanoid({ tone: 'light', shirt: 0x2f5fd0, pants: 0x2b3242, hair: 0x4a3524 })
scene.add(playerActor.group)
playerActor.setGun(true)

// the homeowner's body, used as the shot target for the thief-side of things
const playerHit = playerActor.group

const thiefActor = createHumanoid({ tone: 'medium', shirt: 0x1b2430, pants: 0x151a21, hair: 0x120e0a, beanie: true })
scene.add(thiefActor.group)
const thiefHit = thiefActor.group

const lootMeshes = new Map()
for (const l of sim.LOOT_SPOTS) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.7, 0.55), M.loot)
  m.position.set(l.x, 0.55, l.z)
  m.castShadow = true
  scene.add(m)
  lootMeshes.set(l.label, m)
}

// ------------------------------------------------------------------ minimap
const minimap = createMinimap(document.getElementById('minimap'))

// ------------------------------------------------------------------ tracers
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8 })
const tracers = []
function tracer (from, to) {
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), tracerMat)
  scene.add(line)
  tracers.push({ line, t: 0.06 })
}

// ------------------------------------------------------------------ state
let player, thief, loot, events, state, msg, msgT
let keys = {}, mouseDown = false, yaw = 0, pitch = 0.22

const hud = {
  hp: document.getElementById('hp'),
  hpbar: document.getElementById('hpbar'),
  weapon: document.getElementById('weapon'),
  ammo: document.getElementById('ammo'),
  stolen: document.getElementById('stolen'),
  thiefhp: document.getElementById('thiefhp'),
  banner: document.getElementById('banner'),
  overlay: document.getElementById('overlay'),
  otitle: document.getElementById('otitle'),
  osub: document.getElementById('osub'),
  crosshair: document.getElementById('crosshair'),
}

function reset () {
  player = sim.createPlayer()
  thief = sim.createThief()
  loot = sim.createLoot()
  events = []
  state = 'play'; msg = 'DEFEND YOUR HOME'; msgT = 2.4
  yaw = 0; pitch = 0.22; mouseDown = false
  thiefActor.group.rotation.set(0, 0, 0)
  for (const m of lootMeshes.values()) m.visible = true
  hud.overlay.style.display = 'none'
  updateHud()
}

// ------------------------------------------------------------------ input
addEventListener('keydown', e => {
  const k = e.key.toLowerCase()
  keys[k] = true
  if (k === ' ') e.preventDefault()
  if (k === 'escape') { document.exitPointerLock?.(); return }
  if (state !== 'play') { if (k === 'enter') reset(); return }
  if (k === '1') { player.weapon = 'pistol'; player.mag = sim.WEAPONS.pistol.mag; player.reloading = 0 }
  if (k === '2') { player.weapon = 'shotgun'; player.mag = sim.WEAPONS.shotgun.mag; player.reloading = 0 }
  if (k === 'r' && player.reloading <= 0 && player.mag < sim.WEAPONS[player.weapon].mag) {
    player.reloading = sim.WEAPONS[player.weapon].reload
  }
})
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false })

canvas.addEventListener('click', () => {
  if (state !== 'play') { reset(); return }
  canvas.requestPointerLock?.()
})
addEventListener('mousedown', e => { if (e.button === 0) mouseDown = true })
addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false })
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return
  yaw -= e.movementX * 0.0022
  pitch = Math.max(-0.35, Math.min(0.95, pitch + e.movementY * 0.0018))
})

// ------------------------------------------------------------------ combat
const ray = new THREE.Raycaster()

function playerShoot () {
  const spec = sim.WEAPONS[player.weapon]
  player.mag--
  player.cd = spec.cd

  const origin = new THREE.Vector3(player.x, 1.35, player.z)
  const dir = new THREE.Vector3(Math.sin(yaw), Math.sin(-pitch), Math.cos(yaw)).normalize()

  for (let p = 0; p < spec.pellets; p++) {
    const d = dir.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * spec.spread,
      (Math.random() - 0.5) * spec.spread,
      (Math.random() - 0.5) * spec.spread)).normalize()
    ray.set(origin, d)
    ray.far = 120
    // use the thief's torso as the hit target, not the whole group
    const hits = ray.intersectObjects(collidables.concat([thiefHit]), true)
    const point = hits.length ? hits[0].point.clone() : origin.clone().addScaledVector(d, 90)
    tracer(origin.clone(), point)
    if (hits.length && thief.alive && isPartOf(hits[0].object, thiefActor.group)) {
      sim.damageThief(thief, spec.dmg, events)
    }
  }
  if (player.mag <= 0) player.reloading = spec.reload
}

function isPartOf (obj, root) {
  let o = obj
  while (o) { if (o === root) return true; o = o.parent }
  return false
}

// ------------------------------------------------------------------ hud
function updateHud () {
  const spec = sim.WEAPONS[player.weapon]
  hud.hp.textContent = String(Math.max(0, Math.ceil(player.hp)))
  hud.hpbar.style.width = Math.max(0, player.hp) + '%'
  hud.hpbar.style.background = player.hp > 50 ? '#22c55e' : player.hp > 25 ? '#f59e0b' : '#ef4444'
  hud.weapon.textContent = spec.name
  hud.ammo.textContent = player.reloading > 0 ? 'reloading' : `${player.mag} / ${spec.mag}`
  hud.stolen.textContent = `${3 - sim.remaining(loot)} / 3`
  hud.thiefhp.textContent = thief.alive ? `${Math.max(0, Math.ceil(thief.hp))} hp` : 'down'
}

function showOverlay (win) {
  hud.overlay.style.display = 'flex'
  hud.otitle.textContent = win ? 'HOME DEFENDED' : 'FAILURE'
  hud.otitle.style.color = win ? '#22c55e' : '#ef4444'
  hud.osub.textContent = win
    ? `Thief neutralised — ${sim.remaining(loot)}/3 valuables still in the house.`
    : (player.alive ? 'The van drove off with everything.' : 'You were killed defending the house.')
}

// the model faces +z at rotation 0, sim measures angles from +x toward +z
const faceDir = (simYaw) => Math.atan2(Math.cos(simYaw), Math.sin(simYaw))

// ------------------------------------------------------------------ update
function update (dt) {
  const playing = state === 'play'
  let playerMoving = false

  if (playing) {
    // ---- movement, camera-relative
    let mx = 0, mz = 0
    if (keys['w'] || keys['arrowup']) mz -= 1
    if (keys['s'] || keys['arrowdown']) mz += 1
    if (keys['a'] || keys['arrowleft']) mx -= 1
    if (keys['d'] || keys['arrowright']) mx += 1
    if (mx || mz) {
      playerMoving = true
      const len = Math.hypot(mx, mz)
      const fx = Math.sin(yaw), fz = Math.cos(yaw)
      const rx = Math.cos(yaw), rz = -Math.sin(yaw)
      player.x += ((fx * -mz + rx * mx) / len) * sim.TUNING.playerSpeed * dt
      player.z += ((fz * -mz + rz * mx) / len) * sim.TUNING.playerSpeed * dt
      sim.resolveCircle(player)
      sim.clampToWorld(player)
    }

    // ---- weapon timers
    if (player.reloading > 0) {
      player.reloading -= dt
      if (player.reloading <= 0) player.mag = sim.WEAPONS[player.weapon].mag
    }
    player.cd -= dt
    if (mouseDown && player.cd <= 0 && player.reloading <= 0 && player.mag > 0) playerShoot()

    // ---- thief
    sim.stepThief(thief, { player, loot, events }, dt)

    for (const ev of events) {
      if (ev.type === 'thiefShot') {
        tracer(new THREE.Vector3(thief.x, 1.35, thief.z), new THREE.Vector3(player.x, 1.35, player.z))
        sim.damagePlayer(player, sim.TUNING.thiefDamage, events)
      } else if (ev.type === 'grabbed') { msg = `They grabbed the ${ev.label}!`; msgT = 1.8 }
      else if (ev.type === 'delivered') { msg = `They got the ${ev.label}!`; msgT = 2.0 }
      else if (ev.type === 'allStolen') { state = 'lose'; showOverlay(false) }
      else if (ev.type === 'thiefDown') { state = 'win'; showOverlay(true) }
      else if (ev.type === 'playerDown') { state = 'lose'; showOverlay(false) }
    }
    events.length = 0
  }

  // ---- actor poses
  playerActor.group.position.set(player.x, 0, player.z)
  playerActor.group.rotation.y = yaw
  playerActor.group.visible = player.alive
  playerActor.animate({ moving: playerMoving, aiming: true, dt })

  const thiefMoving = playing && thief.route.length > 0
  const thiefSees = playing && sim.canSee(thief.x, thief.z, player.x, player.z, sim.TUNING.thiefSight)
  thiefActor.group.position.set(thief.x, 0, thief.z)
  thiefActor.group.rotation.y = faceDir(thief.yaw)
  thiefActor.group.visible = true
  thiefActor.group.rotation.z = thief.alive ? 0 : Math.PI / 2   // topple on death
  thiefActor.setGun(thief.alive && !thief.carry)
  thiefActor.animate({
    moving: thiefMoving,
    speed: thief.carry ? 0.8 : 1,
    carrying: !!thief.carry,
    aiming: thiefSees && !thief.carry,
    dt,
  })

  // ---- carried loot rides in the thief's arms
  for (const [label, m] of lootMeshes) {
    const l = loot.find(x => x.label === label)
    const held = thief.carry === label
    m.material = held ? M.held : M.loot
    if (held) {
      m.visible = thief.alive
      m.position.set(thief.x, 1.15, thief.z)
    } else {
      m.visible = playing ? !(l.taken || l.delivered) : false
      m.position.set(l.x, 0.55, l.z)
    }
  }

  // ---- third-person camera
  const dist = 6.2, height = 2.9
  camera.position.set(
    player.x - Math.sin(yaw) * dist * Math.cos(pitch),
    height + Math.sin(pitch) * dist,
    player.z - Math.cos(yaw) * dist * Math.cos(pitch))
  camera.lookAt(
    player.x + Math.sin(yaw) * 6,
    1.5 + Math.sin(-pitch) * 8,
    player.z + Math.cos(yaw) * 6)

  for (const s of sim.SOLIDS) {
    if (camera.position.x > s.x1 - 0.3 && camera.position.x < s.x2 + 0.3 &&
        camera.position.z > s.z1 - 0.3 && camera.position.z < s.z2 + 0.3) {
      camera.position.y = Math.max(camera.position.y, sim.WORLD.wallHeight + 0.6)
    }
  }

  // ---- tracers fade
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].t -= dt
    if (tracers[i].t <= 0) { scene.remove(tracers[i].line); tracers.splice(i, 1) }
  }

  if (msgT > 0) msgT -= dt
  hud.banner.textContent = msgT > 0 ? msg : ''
  hud.crosshair.style.opacity = document.pointerLockElement === canvas ? '1' : '0.35'

  minimap.draw({ x: player.x, z: player.z, yaw }, thief, loot)
  updateHud()
}

let last = performance.now()
function frame (now) {
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  update(dt)
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}

reset()
requestAnimationFrame(frame)

// game.js — rendering, input and presentation for Home Invasion 3D.
// All simulation lives in sim.js so it can be tested without a GPU.
import * as THREE from 'three'
import * as sim from './sim.js'
import { createHumanoid } from './humanoid.js'
import { createMinimap } from './minimap.js'
import { buildAll as buildTextures } from './textures.js'

// ------------------------------------------------------------------ renderer
const canvas = document.getElementById('view')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x9dc4e0)
scene.fog = new THREE.Fog(0x9dc4e0, 60, 165)

const camera = new THREE.PerspectiveCamera(64, 1, 0.08, 400)
function resize () {
  renderer.setSize(innerWidth, innerHeight, false)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize); resize()

// ------------------------------------------------------------------ lighting
scene.add(new THREE.HemisphereLight(0xcfe4f5, 0x40552f, 1.15))

const sun = new THREE.DirectionalLight(0xfff1d6, 2.4)
sun.position.set(26, 38, 20)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40
sun.shadow.camera.far = 130
sun.shadow.bias = -0.0005
sun.shadow.normalBias = 0.02
scene.add(sun)

const lampLight = new THREE.PointLight(0xffd9a0, 0, 7, 2)
scene.add(lampLight)

// ------------------------------------------------------------------ textures
const TEX = buildTextures()

// ------------------------------------------------------------------ materials
const mat = (o) => new THREE.MeshStandardMaterial(o)
const M = {
  grass:   mat({ map: TEX.grass, roughness: 1 }),
  drive:   mat({ map: TEX.drive, roughness: 1 }),
  floor:   mat({ map: TEX.floor, roughness: 0.72 }),
  wall:    mat({ map: TEX.wallIn, roughness: 0.94 }),
  rug:     mat({ map: TEX.rug, roughness: 1 }),
  roof:    mat({ map: TEX.roof, roughness: 0.95 }),
  trim:    mat({ color: 0xf2efe9, roughness: 0.7 }),
  darkWood: mat({ color: 0x5a4128, roughness: 0.75 }),
  wood:    mat({ color: 0x8b6540, roughness: 0.8 }),
  paleWood: mat({ color: 0xb08c5e, roughness: 0.78 }),
  fabric:  mat({ color: 0x4a5b73, roughness: 0.98 }),
  fabric2: mat({ color: 0x8a5a4a, roughness: 0.98 }),
  cushion: mat({ color: 0x5d7192, roughness: 0.98 }),
  bedding: mat({ color: 0xd8d2c6, roughness: 0.95 }),
  pillow:  mat({ color: 0xf0ece2, roughness: 0.95 }),
  metal:   mat({ color: 0x9aa1a8, roughness: 0.34, metalness: 0.75 }),
  steel:   mat({ color: 0xc3c8cd, roughness: 0.28, metalness: 0.8 }),
  white:   mat({ color: 0xf4f4f2, roughness: 0.5 }),
  screen:  mat({ color: 0x0d1117, emissive: 0x16324a, emissiveIntensity: 0.85, roughness: 0.28 }),
  glass:   mat({ color: 0x9fc6e8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.32 }),
  van:     mat({ color: 0xb45309, roughness: 0.5, metalness: 0.28 }),
  tyre:    mat({ color: 0x141416, roughness: 1 }),
  loot:    mat({ color: 0xf5b02a, emissive: 0x9a5f00, emissiveIntensity: 1.0, roughness: 0.4 }),
  held:    mat({ color: 0xa78bfa, emissive: 0x5b21b6, emissiveIntensity: 1.0, roughness: 0.4 }),
  trunk:   mat({ color: 0x5b3f28, roughness: 1 }),
  leaf:    mat({ color: 0x35703a, roughness: 1 }),
  lampShade: mat({ color: 0xf6e3b4, emissive: 0xffca70, emissiveIntensity: 0.55, roughness: 0.9 }),
}

const collidables = []
const world = new THREE.Group(); scene.add(world)
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
const cyl = (rt, rb, h, m, s = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), m)

function place (mesh, x, y, z, rx = 0, ry = 0, rz = 0) {
  mesh.position.set(x, y, z)
  if (rx) mesh.rotation.x = rx
  if (ry) mesh.rotation.y = ry
  if (rz) mesh.rotation.z = rz
  mesh.castShadow = true
  mesh.receiveShadow = true
  world.add(mesh)
  return mesh
}

// ------------------------------------------------------------------ ground
const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), M.grass)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
ground.name = 'ground'
world.add(ground)

const drive = new THREE.Mesh(new THREE.PlaneGeometry(19, 24), M.drive)
drive.rotation.x = -Math.PI / 2
drive.position.set(0, 0.012, 8)
drive.receiveShadow = true
world.add(drive)

// ------------------------------------------------------------------ shell
const H = sim.WORLD.house
const WH = sim.WORLD.wallHeight

// floors, one per room, so the wood grain runs differently and rooms read apart
for (const r of [
  { x1: H.minX, z1: sim.WORLD.interiorZ, x2: 0, z2: H.maxZ },              // living
  { x1: 0, z1: sim.WORLD.interiorZ, x2: H.maxX, z2: H.maxZ },              // kitchen
  { x1: H.minX, z1: H.minZ, x2: 0, z2: sim.WORLD.interiorZ },              // bedroom
  { x1: 0, z1: H.minZ, x2: H.maxX, z2: sim.WORLD.interiorZ },              // study
]) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(r.x2 - r.x1, r.z2 - r.z1), M.floor)
  f.rotation.x = -Math.PI / 2
  f.position.set((r.x1 + r.x2) / 2, 0.02, (r.z1 + r.z2) / 2)
  f.receiveShadow = true
  world.add(f)
}

// foundation slab
{
  const slab = box(H.maxX - H.minX + 0.6, 0.16, H.maxZ - H.minZ + 0.6, M.darkWood)
  slab.position.set((H.minX + H.maxX) / 2, 0.08, (H.minZ + H.maxZ) / 2)
  slab.receiveShadow = true
  world.add(slab)
}

// walls + roof cap
for (const w of sim.WALLS) {
  const m = box(w.x2 - w.x1, WH, w.z2 - w.z1, M.wall)
  place(m, (w.x1 + w.x2) / 2, WH / 2, (w.z1 + w.z2) / 2)
  collidables.push(m)
}
for (const w of sim.WALLS) {
  const cap = box(w.x2 - w.x1 + 0.16, 0.20, w.z2 - w.z1 + 0.16, M.trim)
  place(cap, (w.x1 + w.x2) / 2, WH + 0.10, (w.z1 + w.z2) / 2)
}

// baseboards
for (const w of sim.WALLS) {
  const along = (w.x2 - w.x1) > (w.z2 - w.z1)
  const bb = box(along ? (w.x2 - w.x1) : 0.06, 0.13, along ? 0.06 : (w.z2 - w.z1), M.trim)
  place(bb, (w.x1 + w.x2) / 2, 0.145, (w.z1 + w.z2) / 2)
}

// windows: frames and glass set into the wall faces
for (const win of sim.WINDOWS) {
  const w = win.width, sill = 0.95, top = 2.15, hgt = top - sill, cy = (sill + top) / 2
  const alongX = win.wall === 'north' || win.wall === 'south'
  const zAt = win.wall === 'north' ? H.minZ + 0.13 : win.wall === 'south' ? H.maxZ - 0.13
    : null
  const xAt = win.wall === 'west' ? H.minX + 0.13 : win.wall === 'east' ? H.maxX - 0.13 : null

  const glass = box(alongX ? w : 0.06, hgt, alongX ? 0.06 : w, M.glass)
  place(glass, alongX ? win.at : xAt, cy, alongX ? zAt : win.at)

  const mkFrame = (fw, fh, fd, ox, oy, oz) =>
    place(box(fw, fh, fd, M.trim), (alongX ? win.at : xAt) + ox, cy + oy, (alongX ? zAt : win.at) + oz)
  const T = 0.09
  if (alongX) {
    mkFrame(w + T * 2, T, 0.14, 0, hgt / 2, 0)
    mkFrame(w + T * 2, T, 0.14, 0, -hgt / 2, 0)
    mkFrame(T, hgt, 0.14, -w / 2, 0, 0)
    mkFrame(T, hgt, 0.14, w / 2, 0, 0)
    mkFrame(w, 0.05, 0.12, 0, 0, 0)   // mullion
  } else {
    mkFrame(0.14, T, w + T * 2, 0, hgt / 2, 0)
    mkFrame(0.14, T, w + T * 2, 0, -hgt / 2, 0)
    mkFrame(0.14, hgt, T, 0, 0, -w / 2)
    mkFrame(0.14, hgt, T, 0, 0, w / 2)
    mkFrame(0.12, 0.05, w, 0, 0, 0)
  }
}

// front door, standing open
{
  const dx = sim.WORLD.doorGap
  const door = box(0.06, 2.1, dx.maxX - dx.minX, M.darkWood)
  door.position.set(dx.maxX + 0.03, 1.05, H.maxZ - 0.35)
  door.rotation.y = -1.15
  door.castShadow = true
  world.add(door)
  place(box(0.10, 0.10, 2.4, M.trim), dx.minX - 0.05, 2.20, H.maxZ - 0.05)
  place(box(0.10, 0.10, 2.4, M.trim), dx.maxX + 0.05, 2.20, H.maxZ - 0.05)
}

// ------------------------------------------------------------------ furniture
function buildFurniture (f) {
  const w = f.x2 - f.x1, d = f.z2 - f.z1
  const cx = (f.x1 + f.x2) / 2, cz = (f.z1 + f.z2) / 2
  const g = new THREE.Group()
  g.position.set(cx, 0, cz)
  const add = (m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m }

  const legs = (h, inset = 0.07, m = M.darkWood) => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = add(box(0.06, h, 0.06, m))
      leg.position.set(sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset))
    }
  }

  switch (f.kind) {
    case 'sofa': {
      add(box(w, 0.32, d, M.fabric)).position.y = 0.20
      const back = add(box(w, 0.52, 0.22, M.fabric)); back.position.set(0, 0.52, -d / 2 + 0.11)
      for (const s of [-1, 1]) {
        const arm = add(box(0.2, 0.24, d, M.fabric)); arm.position.set(s * (w / 2 - 0.1), 0.48, 0)
      }
      for (let i = -1; i <= 1; i++) {
        const cu = add(box(w / 3.2, 0.12, d - 0.34, M.cushion))
        cu.position.set(i * (w / 3.1), 0.42, 0.06)
      }
      break
    }
    case 'coffeeTable': {
      add(box(w, 0.06, d, M.wood)).position.y = 0.40
      legs(0.40, 0.08)
      break
    }
    case 'sideTable': {
      add(box(w, 0.05, d, M.wood)).position.y = 0.42
      legs(0.42, 0.06)
      break
    }
    case 'tvStand': {
      add(box(w, 0.44, d, M.darkWood)).position.y = 0.22
      const tv = add(box(w * 0.86, 0.62, 0.06, M.screen))
      tv.position.set(0, 0.80, 0)
      const stand = add(box(0.16, 0.10, 0.14, M.darkWood)); stand.position.y = 0.49
      break
    }
    case 'rug': {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.rug)
      r.rotation.x = -Math.PI / 2
      r.position.y = 0.035
      r.receiveShadow = true
      g.add(r)
      break
    }
    case 'lamp': {
      add(cyl(0.13, 0.16, 0.04, M.metal)).position.y = 0.02
      add(cyl(0.022, 0.022, 1.28, M.metal)).position.y = 0.66
      const shade = add(cyl(0.10, 0.19, 0.26, M.lampShade, 18))
      shade.position.y = 1.40
      break
    }
    case 'counter': {
      add(box(w, 0.86, d, M.paleWood)).position.y = 0.43
      add(box(w + 0.04, 0.06, d + 0.04, M.trim)).position.y = 0.89
      const splash = add(box(0.03, 0.44, d, M.trim)); splash.position.set(w / 2 - 0.015, 1.14, 0)
      for (let i = 0; i < 3; i++) {
        const h = add(box(0.02, 0.15, 0.30, M.metal))
        h.position.set(-w / 2 + 0.01, 0.62, -d / 2 + 0.55 + i * (d - 1.1) / 2)
      }
      break
    }
    case 'fridge': {
      add(box(w, f.h, d, M.steel)).position.y = f.h / 2
      add(box(0.02, 0.7, 0.03, M.metal)).position.set(-w / 2 + 0.01, 1.05, d / 2 - 0.06)
      break
    }
    case 'diningTable': {
      add(box(w, 0.07, d, M.wood)).position.y = f.h
      legs(f.h, 0.10)
      break
    }
    case 'chair': {
      add(box(w, 0.06, d, M.wood)).position.y = 0.45
      const back = add(box(w, 0.48, 0.05, M.wood)); back.position.set(0, 0.69, -d / 2 + 0.03)
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const leg = add(box(0.045, 0.45, 0.045, M.darkWood))
        leg.position.set(sx * (w / 2 - 0.05), 0.225, sz * (d / 2 - 0.05))
      }
      break
    }
    case 'bed': {
      add(box(w, 0.30, d, M.darkWood)).position.y = 0.15
      add(box(w - 0.08, 0.22, d - 0.08, M.bedding)).position.y = 0.40
      const head = add(box(w, 0.62, 0.10, M.darkWood)); head.position.set(0, 0.46, -d / 2 + 0.05)
      const p1 = add(box(w * 0.42, 0.12, 0.34, M.pillow)); p1.position.set(-w * 0.22, 0.55, -d / 2 + 0.32)
      const p2 = add(box(w * 0.42, 0.12, 0.34, M.pillow)); p2.position.set(w * 0.22, 0.55, -d / 2 + 0.32)
      const quilt = add(box(w - 0.1, 0.10, d * 0.55, M.fabric2))
      quilt.position.set(0, 0.51, d * 0.20)
      break
    }
    case 'nightstand': {
      add(box(w, f.h, d, M.wood)).position.y = f.h / 2
      add(box(w * 0.7, 0.02, d * 0.6, M.metal)).position.set(0, f.h * 0.62, d / 2 - 0.01)
      break
    }
    case 'wardrobe': {
      add(box(w, f.h, d, M.darkWood)).position.y = f.h / 2
      for (const s of [-1, 1]) {
        const dd = add(box(w / 2 - 0.02, f.h - 0.10, 0.03, M.wood))
        dd.position.set(s * w / 4, f.h / 2, d / 2 + 0.01)
        add(box(0.02, 0.18, 0.02, M.metal)).position.set(s * 0.035, f.h / 2, d / 2 + 0.03)
      }
      break
    }
    case 'desk': {
      add(box(w, 0.06, d, M.wood)).position.y = f.h
      legs(f.h, 0.08)
      const mon = add(box(0.68, 0.42, 0.04, M.screen)); mon.position.set(-w * 0.18, f.h + 0.34, -d / 2 + 0.14)
      const stem = add(box(0.05, 0.16, 0.05, M.metal)); stem.position.set(-w * 0.18, f.h + 0.11, -d / 2 + 0.14)
      const kb = add(box(0.42, 0.02, 0.15, M.white)); kb.position.set(-w * 0.18, f.h + 0.04, 0.02)
      break
    }
    case 'deskChair': {
      add(box(w, 0.06, d, M.fabric)).position.y = 0.48
      const back = add(box(w, 0.44, 0.06, M.fabric)); back.position.set(0, 0.72, -d / 2 + 0.03)
      add(cyl(0.04, 0.04, 0.45, M.metal)).position.y = 0.24
      add(cyl(0.22, 0.24, 0.04, M.metal)).position.y = 0.03
      break
    }
    case 'bookshelf': {
      add(box(w, f.h, d, M.darkWood)).position.y = f.h / 2
      for (let s = 0; s < 4; s++) {
        const shelf = add(box(w - 0.06, 0.03, d - 0.10, M.wood))
        shelf.position.set(0, 0.34 + s * 0.46, 0.02)
        let bx = -w / 2 + 0.08
        while (bx < w / 2 - 0.10) {
          const bw = 0.025 + Math.random() * 0.03
          const bh = 0.20 + Math.random() * 0.14
          const bk = add(box(bw, bh, 0.16, new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.45, 0.38), roughness: 0.85 })))
          bk.position.set(bx, 0.36 + s * 0.46 + bh / 2, 0.02)
          bx += bw + 0.006
        }
      }
      break
    }
    case 'cabinet': {
      add(box(w, f.h, d, M.darkWood)).position.y = f.h / 2
      for (let i = 0; i < 3; i++) {
        add(box(w * 0.8, 0.30, 0.02, M.wood)).position.set(0, 0.24 + i * 0.36, d / 2 + 0.01)
        add(box(0.10, 0.02, 0.02, M.metal)).position.set(0, 0.24 + i * 0.36, d / 2 + 0.03)
      }
      break
    }
    default: {
      add(box(w, f.h, d, M.wood)).position.y = f.h / 2
    }
  }
  world.add(g)
  if (!f.flat) {
    // One invisible hit volume per item. Raycasting every decorative detail mesh
    // (handles, books, cushions) would be wasteful, and a bullet ought to stop
    // at the sofa, not thread between two cushions.
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(w, f.h, d),
      new THREE.MeshBasicMaterial({ visible: false }))
    hit.position.y = f.h / 2
    g.add(hit)
    collidables.push(hit)
  }
  return g
}

for (const f of sim.FURNITURE) buildFurniture(f)

// ------------------------------------------------------------------ van
{
  const v = sim.VAN
  const van = new THREE.Group()
  van.position.set((v.x1 + v.x2) / 2, 0, (v.z1 + v.z2) / 2)
  const w = v.x2 - v.x1, d = v.z2 - v.z1
  const body = box(w, 1.6, d, M.van); body.position.y = 1.05
  const roof = box(w * 0.96, 0.35, d * 0.5, M.van); roof.position.set(0, 1.98, -d * 0.18)
  const screen = box(w * 0.86, 0.62, 0.08, M.glass); screen.position.set(0, 1.72, d / 2 - 0.42)
  screen.rotation.x = 0.18
  const side = box(0.06, 0.5, 1.5, M.glass); side.position.set(w / 2 - 0.02, 1.7, d / 2 - 1.0)
  for (const m of [body, roof, screen, side]) { m.castShadow = true; m.receiveShadow = true; van.add(m) }
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.32, 18), M.tyre)
    t.rotation.z = Math.PI / 2
    t.position.set(dx * (w / 2 - 0.28), 0.44, dz * (d / 2 - 0.32))
    t.castShadow = true
    van.add(t)
  }
  world.add(van)
  collidables.push(body)
}

// ------------------------------------------------------------------ trees
for (const [tx, tz, s] of [[-21, -15, 1], [20, -17, 0.9], [-23, 5, 1.1], [22, 3, 1], [-17, 19, 0.95], [18, 20, 1.05]]) {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.38, 3.4, 10), M.trunk)
  trunk.position.y = 1.7; trunk.castShadow = true
  const crown = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.6, 12), M.leaf)
  crown.position.y = 4.9; crown.castShadow = true
  const crown2 = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.2, 12), M.leaf)
  crown2.position.y = 6.4; crown2.castShadow = true
  g.add(trunk, crown, crown2)
  g.position.set(tx, 0, tz)
  g.scale.setScalar(s)
  world.add(g)
  collidables.push(trunk)
}
// shrubs against the house
for (const [sx, sz] of [[-6, -7.3], [-2.6, -7.3], [3.2, -7.3], [6.4, -7.3], [-8.7, -12], [8.7, -16]]) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 10), M.leaf)
  b.position.set(sx, 0.42, sz)
  b.scale.set(1, 0.8, 1)
  b.castShadow = true
  world.add(b)
}

// ------------------------------------------------------------------ actors
const playerActor = createHumanoid({
  tone: 'light', shirt: 0x2f5fd0, pants: 0x2b3242, shoe: 0x16181c,
  vest: 0x24344d, hair: 0x4a3524, hairStyle: 'short', sleeves: 'long',
})
scene.add(playerActor.group)
playerActor.setWeapon('pistol')

const thiefActor = createHumanoid({
  tone: 'medium', shirt: 0x1b2430, pants: 0x151a21, shoe: 0x101014,
  vest: 0x121821, hair: 0x120e0a, hairStyle: 'beanie', sleeves: 'long',
})
scene.add(thiefActor.group)

const lootMeshes = new Map()
for (const l of sim.LOOT_SPOTS) {
  const g = new THREE.Group()
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.46, 0.40), M.loot)
  b.castShadow = true
  b.position.y = 0.28
  g.add(b)
  g.position.set(l.x, 0, l.z)
  scene.add(g)
  lootMeshes.set(l.label, g)
}

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
let keys = {}, mouseDown = false, yaw = 0, pitch = 0.24

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
  stance: document.getElementById('stance'),
}

function reset () {
  player = sim.createPlayer()
  thief = sim.createThief()
  loot = sim.createLoot()
  events = []
  state = 'play'; msg = 'DEFEND YOUR HOME'; msgT = 2.4
  yaw = 0; pitch = 0.24; mouseDown = false
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
  if (k === '1') { player.weapon = 'pistol'; player.mag = sim.WEAPONS.pistol.mag; player.reloading = 0; playerActor.setWeapon('pistol') }
  if (k === '2') { player.weapon = 'shotgun'; player.mag = sim.WEAPONS.shotgun.mag; player.reloading = 0; playerActor.setWeapon('shotgun') }
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
  pitch = Math.max(-0.30, Math.min(0.85, pitch + e.movementY * 0.0018))
})

// ------------------------------------------------------------------ combat
const ray = new THREE.Raycaster()
const isPartOf = (obj, root) => { let o = obj; while (o) { if (o === root) return true; o = o.parent } return false }

function playerShoot () {
  const spec = sim.WEAPONS[player.weapon]
  player.mag--
  player.cd = spec.cd
  const eye = player.crouching ? sim.TUNING.crouchEyeHeight : sim.TUNING.eyeHeight
  const origin = new THREE.Vector3(player.x, eye, player.z)
  const dir = new THREE.Vector3(Math.sin(yaw), Math.sin(-pitch), Math.cos(yaw)).normalize()

  for (let p = 0; p < spec.pellets; p++) {
    const d = dir.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * spec.spread,
      (Math.random() - 0.5) * spec.spread,
      (Math.random() - 0.5) * spec.spread)).normalize()
    ray.set(origin, d)
    ray.far = 140
    const targets = collidables.concat(thiefActor.group)
    const hits = ray.intersectObjects(targets, true)
    const point = hits.length ? hits[0].point.clone() : origin.clone().addScaledVector(d, 90)
    tracer(origin.clone(), point)
    if (hits.length && thief.alive && isPartOf(hits[0].object, thiefActor.group)) {
      sim.damageThief(thief, spec.dmg, events)
    }
  }
  if (player.mag <= 0) player.reloading = spec.reload
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
  hud.stance.textContent = player.crouching ? 'CROUCHING' : (player.sprinting ? 'SPRINTING' : 'STANDING')
}

function showOverlay (win) {
  hud.overlay.style.display = 'flex'
  hud.otitle.textContent = win ? 'HOME DEFENDED' : 'FAILURE'
  hud.otitle.style.color = win ? '#22c55e' : '#ef4444'
  hud.osub.textContent = win
    ? `Thief neutralised — ${sim.remaining(loot)}/3 valuables still in the house.`
    : (player.alive ? 'The van drove off with everything.' : 'You were killed defending the house.')
}

// the model faces +z at rotation 0; sim measures angles from +x toward +z
const faceDir = (simYaw) => Math.atan2(Math.cos(simYaw), Math.sin(simYaw))

// ------------------------------------------------------------------ update
function update (dt) {
  const playing = state === 'play'
  let playerMoving = false

  if (playing) {
    let mx = 0, mz = 0
    if (keys['w'] || keys['arrowup']) mz -= 1
    if (keys['s'] || keys['arrowdown']) mz += 1
    if (keys['a'] || keys['arrowleft']) mx -= 1
    if (keys['d'] || keys['arrowright']) mx += 1

    player.crouching = !!(keys['c'] || keys['control'])
    player.sprinting = !!(keys['shift'] && !player.crouching && (mx || mz))
    const speed = player.crouching ? sim.TUNING.playerCrouchSpeed
      : player.sprinting ? sim.TUNING.playerSprintSpeed
        : sim.TUNING.playerSpeed

    if (mx || mz) {
      playerMoving = true
      const len = Math.hypot(mx, mz)
      const fx = Math.sin(yaw), fz = Math.cos(yaw)
      const rx = Math.cos(yaw), rz = -Math.sin(yaw)
      player.x += ((fx * -mz + rx * mx) / len) * speed * dt
      player.z += ((fz * -mz + rz * mx) / len) * speed * dt
      sim.resolveCircle(player)
      sim.clampToWorld(player)
    }

    if (player.reloading > 0) {
      player.reloading -= dt
      if (player.reloading <= 0) player.mag = sim.WEAPONS[player.weapon].mag
    }
    player.cd -= dt
    if (mouseDown && player.cd <= 0 && player.reloading <= 0 && player.mag > 0) playerShoot()

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
  playerActor.animate({
    moving: playerMoving,
    speed: player.sprinting ? 1.5 : player.crouching ? 0.4 : 1,
    aiming: true,
    crouching: player.crouching,
    dt,
  })

  const thiefMoving = playing && thief.route.length > 0
  const thiefSees = playing && sim.canSee(thief.x, thief.z, player.x, player.z, sim.TUNING.thiefSight)
  thiefActor.group.position.set(thief.x, 0, thief.z)
  thiefActor.group.rotation.y = faceDir(thief.yaw)
  thiefActor.group.visible = true
  thiefActor.group.rotation.z = thief.alive ? 0 : Math.PI / 2
  if (thief.alive && !thief.carry) thiefActor.setWeapon('pistol'); else thiefActor.hideWeapon()
  thiefActor.animate({
    moving: thiefMoving,
    speed: thief.carry ? 0.75 : 1,
    carrying: !!thief.carry,
    aiming: thiefSees && !thief.carry,
    dt,
  })

  // ---- carried loot
  for (const [label, g] of lootMeshes) {
    const l = loot.find(x => x.label === label)
    const held = thief.carry === label
    g.children[0].material = held ? M.held : M.loot
    if (held) {
      g.visible = thief.alive
      g.position.set(thief.x, 0.95, thief.z)
    } else {
      g.visible = playing ? !(l.taken || l.delivered) : false
      g.position.set(l.x, 0, l.z)
    }
  }

  // the living-room lamp lights up once it is dark enough to matter
  lampLight.position.set(-6.95, 1.45, -9.65)
  lampLight.intensity = 2.6

  // ---- third-person camera, eye height follows the stance
  const eye = player.crouching ? sim.TUNING.crouchEyeHeight : sim.TUNING.eyeHeight
  const dist = 5.6, height = eye + 0.75
  camera.position.set(
    player.x - Math.sin(yaw) * dist * Math.cos(pitch),
    height + Math.sin(pitch) * dist,
    player.z - Math.cos(yaw) * dist * Math.cos(pitch))
  camera.lookAt(
    player.x + Math.sin(yaw) * 6,
    eye + Math.sin(-pitch) * 8,
    player.z + Math.cos(yaw) * 6)

  for (const s of sim.SOLIDS) {
    if (camera.position.x > s.x1 - 0.25 && camera.position.x < s.x2 + 0.25 &&
        camera.position.z > s.z1 - 0.25 && camera.position.z < s.z2 + 0.25) {
      camera.position.y = Math.max(camera.position.y, sim.WORLD.wallHeight + 0.5)
    }
  }

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

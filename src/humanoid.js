// humanoid.js — procedural human figures built from primitives.
//
// No external model files, so there is nothing to license and nothing to ship
// beyond code. Roughly 1.8 m tall, articulated at hips, shoulders and neck so it
// can walk, carry and aim.
import * as THREE from 'three'

const SKIN_TONES = {
  light:  { skin: 0xe0b48c, hair: 0x3a2a1c },
  medium: { skin: 0xc98d63, hair: 0x2b1d13 },
  deep:   { skin: 0x8a5a3b, hair: 0x1a120c },
}

export function createHumanoid (opts = {}) {
  const tone = SKIN_TONES[opts.tone] || SKIN_TONES.medium
  const mat = {
    skin:  new THREE.MeshStandardMaterial({ color: tone.skin, roughness: 0.72 }),
    shirt: new THREE.MeshStandardMaterial({ color: opts.shirt ?? 0x3b6fd4, roughness: 0.85 }),
    pants: new THREE.MeshStandardMaterial({ color: opts.pants ?? 0x2c3542, roughness: 0.92 }),
    hair:  new THREE.MeshStandardMaterial({ color: opts.hair ?? tone.hair, roughness: 0.95 }),
    eye:   new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.25 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.45, metalness: 0.65 }),
  }

  const group = new THREE.Group()
  const shadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m }

  // ---- legs: pivot groups at the hip so they can swing
  const HIP_Y = 0.90
  const makeLeg = (side) => {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.105, HIP_Y, 0)
    const thigh = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.60, 4, 10), mat.pants))
    thigh.position.y = -0.37
    pivot.add(thigh)
    const foot = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.26), mat.pants))
    foot.position.set(0, -0.86, 0.05)
    pivot.add(foot)
    group.add(pivot)
    return pivot
  }
  const legL = makeLeg(-1), legR = makeLeg(1)

  // ---- torso: a tapered cylinder reads as shoulders-to-waist better than a box
  const torso = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.165, 0.62, 16), mat.shirt))
  torso.position.y = HIP_Y + 0.31
  group.add(torso)

  const hips = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.155, 0.18, 14), mat.pants))
  hips.position.y = HIP_Y - 0.02
  group.add(hips)

  // ---- arms: pivot at the shoulder
  const SHOULDER_Y = HIP_Y + 0.56
  const makeArm = (side) => {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.225, SHOULDER_Y, 0)
    const upper = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.42, 4, 10), mat.shirt))
    upper.position.y = -0.27
    pivot.add(upper)
    const hand = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 8), mat.skin))
    hand.position.y = -0.52
    pivot.add(hand)
    group.add(pivot)
    return pivot
  }
  const armL = makeArm(-1), armR = makeArm(1)

  // ---- neck + head
  const neck = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.072, 0.10, 10), mat.skin))
  neck.position.y = SHOULDER_Y + 0.06
  group.add(neck)

  const head = new THREE.Group()
  head.position.y = SHOULDER_Y + 0.26
  const skull = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 16), mat.skin))
  skull.scale.set(0.92, 1.06, 0.96)
  head.add(skull)

  // hair as a spherical cap, pushed back a little
  const cap = shadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.145, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), mat.hair))
  cap.position.set(0, 0.008, -0.012)
  head.add(cap)

  // eyes give the figure a facing direction
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), mat.eye)
    eye.position.set(s * 0.05, 0.018, 0.118)
    head.add(eye)
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.05, 8), mat.skin)
  nose.rotation.x = Math.PI / 2
  nose.position.set(0, -0.012, 0.132)
  head.add(nose)

  if (opts.beanie) {
    const beanie = shadow(new THREE.Mesh(
      new THREE.SphereGeometry(0.152, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), mat.pants))
    beanie.position.set(0, 0.012, -0.005)
    head.add(beanie)
  }
  group.add(head)

  // ---- a weapon held in the right hand, hidden unless aiming
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.085, 0.30), mat.metal)
  gun.position.set(0, -0.545, -0.13)
  gun.castShadow = true
  gun.visible = false
  armR.add(gun)

  // ---- animation
  let phase = 0
  function animate ({ moving = false, speed = 1, carrying = false, aiming = false, dt = 1 / 60 } = {}) {
    if (moving) phase += dt * speed * 7.4
    const swing = moving ? Math.min(1, speed) : 0
    const s = Math.sin(phase)

    if (carrying) {
      armL.rotation.x = -1.25; armR.rotation.x = -1.25
      armL.rotation.z = 0.16;  armR.rotation.z = -0.16
      legL.rotation.x = s * 0.42 * swing
      legR.rotation.x = -s * 0.42 * swing
    } else if (aiming) {
      // both arms forward, weapon levelled
      armL.rotation.x = -1.45; armR.rotation.x = -1.52
      armL.rotation.z = 0.12;  armR.rotation.z = -0.02
      legL.rotation.x = s * 0.55 * swing
      legR.rotation.x = -s * 0.55 * swing
    } else {
      armL.rotation.x = -s * 0.50 * swing; armR.rotation.x = s * 0.50 * swing
      armL.rotation.z = 0.06; armR.rotation.z = -0.06
      legL.rotation.x = s * 0.58 * swing; legR.rotation.x = -s * 0.58 * swing
    }

    // subtle bob and torso counter-rotation so walking reads as weight shift
    group.position.y = moving ? Math.abs(Math.sin(phase)) * 0.035 * swing : 0
    torso.rotation.y = -s * 0.10 * swing
    head.rotation.y = s * 0.05 * swing
  }

  return { group, mat, animate, setGun: (v) => { gun.visible = v } }
}

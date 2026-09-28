// humanoid.js — procedural human figures built from primitives.
//
// No model files: nothing to license, nothing to ship. Two-segment limbs with
// real knee and elbow joints, so the walk cycle bends rather than swinging rigid
// sticks. Roughly 1.82 m tall.
//
// Local convention: the figure faces +z. Rotating -x swings a limb forward,
// +x swings it back, and a knee/elbow bends with the opposite sign to its parent.
import * as THREE from 'three'

const SKIN = {
  light:  { skin: 0xe3b98f, hair: 0x4a3524 },
  medium: { skin: 0xc98d63, hair: 0x2b1d13 },
  deep:   { skin: 0x8a5a3b, hair: 0x1a120c },
  olive:  { skin: 0xd8a878, hair: 0x241a12 },
}

export function createHumanoid (opts = {}) {
  const tone = SKIN[opts.tone] || SKIN.medium
  const M = {
    skin:  new THREE.MeshStandardMaterial({ color: tone.skin, roughness: 0.68 }),
    shirt: new THREE.MeshStandardMaterial({ color: opts.shirt ?? 0x3b6fd4, roughness: 0.88 }),
    pants: new THREE.MeshStandardMaterial({ color: opts.pants ?? 0x2c3542, roughness: 0.93 }),
    shoe:  new THREE.MeshStandardMaterial({ color: opts.shoe ?? 0x1a1a1e, roughness: 0.6 }),
    hair:  new THREE.MeshStandardMaterial({ color: opts.hair ?? tone.hair, roughness: 0.96 }),
    eye:   new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.22 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x7a4038, roughness: 0.7 }),
    cloth: new THREE.MeshStandardMaterial({ color: opts.vest ?? 0x2b3242, roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.42, metalness: 0.7 }),
  }

  const root = new THREE.Group()
  const cast = (m) => { m.castShadow = true; m.receiveShadow = true; return m }
  const box = (w, h, d, mat) => cast(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat))
  const cyl = (rt, rb, h, mat, seg = 14) => cast(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat))
  const cap = (r, len, mat) => cast(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 5, 12), mat))
  const ball = (r, mat, w = 16, h = 12) => cast(new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat))

  const HIP_Y = 0.92, KNEE_Y = 0.48, ANKLE_Y = 0.10
  const SHOULDER_Y = 1.42, ELBOW_Y = 1.02

  // ---------------------------------------------------------------- legs
  function makeLeg (side) {
    const hip = new THREE.Group()
    hip.position.set(side * 0.105, HIP_Y, 0)
    hip.add(cap(0.086, 0.27, M.pants).translateY(-0.22))            // thigh

    const knee = new THREE.Group()
    knee.position.y = -(HIP_Y - KNEE_Y)
    knee.add(cap(0.072, 0.24, M.pants).translateY(-0.19))           // shin
    const shoe = box(0.115, 0.095, 0.27, M.shoe)
    shoe.position.set(0, -0.435, 0.055)
    knee.add(shoe)
    const toe = box(0.10, 0.06, 0.09, M.shoe)
    toe.position.set(0, -0.45, 0.20)
    knee.add(toe)
    hip.add(knee)
    root.add(hip)
    return { hip, knee }
  }
  const legL = makeLeg(-1), legR = makeLeg(1)

  // ---------------------------------------------------------------- torso
  const pelvis = cyl(0.175, 0.155, 0.22, M.pants)
  pelvis.position.y = HIP_Y - 0.06
  root.add(pelvis)
  const belt = cyl(0.178, 0.178, 0.045, M.shoe, 16)
  belt.position.y = HIP_Y + 0.05
  root.add(belt)

  const chest = cyl(0.205, 0.172, 0.46, M.shirt, 18)
  chest.position.y = HIP_Y + 0.29
  root.add(chest)
  const collar = cyl(0.115, 0.155, 0.09, M.shirt, 16)
  collar.position.y = HIP_Y + 0.545
  root.add(collar)

  // shoulders soften the joint where the arms meet the chest
  for (const s of [-1, 1]) {
    const sh = ball(0.098, M.shirt, 14, 10)
    sh.position.set(s * 0.195, SHOULDER_Y, 0)
    root.add(sh)
  }

  if (opts.vest) {
    const vest = cyl(0.212, 0.182, 0.42, M.cloth, 18)
    vest.position.y = HIP_Y + 0.30
    root.add(vest)
  }

  // ---------------------------------------------------------------- arms
  function makeArm (side) {
    const sh = new THREE.Group()
    sh.position.set(side * 0.235, SHOULDER_Y, 0)
    const sleeve = opts.sleeves === 'short' ? 0.13 : 0.28
    sh.add(cap(0.064, sleeve, M.shirt).translateY(-0.19))            // upper arm
    if (opts.sleeves === 'short') sh.add(cap(0.056, 0.14, M.skin).translateY(-0.33))

    const elbow = new THREE.Group()
    elbow.position.y = -(SHOULDER_Y - ELBOW_Y)
    elbow.add(cap(0.055, 0.25, M.skin).translateY(-0.18))            // forearm
    const hand = box(0.085, 0.135, 0.055, M.skin)
    hand.position.y = -0.39
    elbow.add(hand)
    const thumb = box(0.03, 0.06, 0.045, M.skin)
    thumb.position.set(side * -0.05, -0.365, 0.015)
    elbow.add(thumb)
    sh.add(elbow)
    root.add(sh)
    return { sh, elbow }
  }
  const armL = makeArm(-1), armR = makeArm(1)

  // ---------------------------------------------------------------- head
  const head = new THREE.Group()
  head.position.y = 1.50
  const neck = cyl(0.055, 0.062, 0.11, M.skin, 10)
  neck.position.y = 0.03
  head.add(neck)

  const skull = ball(0.137, M.skin, 22, 18)
  skull.position.y = 0.145
  skull.scale.set(0.94, 1.06, 0.99)
  head.add(skull)

  const jaw = ball(0.098, M.skin, 16, 12)
  jaw.position.set(0, 0.075, 0.035)
  jaw.scale.set(1.0, 0.82, 0.95)
  head.add(jaw)

  for (const s of [-1, 1]) {
    const ear = ball(0.031, M.skin, 10, 8)
    ear.position.set(s * 0.128, 0.150, -0.005)
    ear.scale.set(0.5, 1, 0.85)
    head.add(ear)

    const eye = ball(0.023, M.eye, 12, 10)
    eye.position.set(s * 0.050, 0.163, 0.112)
    eye.scale.set(1, 0.85, 0.6)
    head.add(eye)
  }

  const brow = box(0.135, 0.020, 0.045, M.hair)
  brow.position.set(0, 0.198, 0.104)
  head.add(brow)

  const nose = box(0.034, 0.062, 0.045, M.skin)
  nose.position.set(0, 0.132, 0.126)
  head.add(nose)

  const mouth = box(0.052, 0.014, 0.020, M.mouth)
  mouth.position.set(0, 0.078, 0.120)
  head.add(mouth)

  const chin = box(0.055, 0.030, 0.035, M.skin)
  chin.position.set(0, 0.045, 0.108)
  head.add(chin)

  // ---- hair
  const style = opts.hairStyle ?? 'short'
  if (style === 'bald') {
    // nothing
  } else if (style === 'cap') {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.148, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), M.cloth)
    dome.position.y = 0.155
    head.add(cast(dome))
    const brim = box(0.20, 0.022, 0.13, M.cloth)
    brim.position.set(0, 0.152, 0.135)
    head.add(brim)
  } else if (style === 'beanie') {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.152, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), M.cloth)
    dome.position.y = 0.152
    head.add(cast(dome))
    const rim = cyl(0.152, 0.152, 0.05, M.cloth, 22)
    rim.position.y = 0.160
    head.add(rim)
  } else {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.145, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), M.hair)
    dome.position.y = 0.150
    head.add(cast(dome))
    if (style === 'tied') {
      const bun = ball(0.062, M.hair, 14, 12)
      bun.position.set(0, 0.115, -0.135)
      head.add(bun)
    }
    if (style === 'long') {
      const back = box(0.20, 0.22, 0.09, M.hair)
      back.position.set(0, 0.055, -0.110)
      head.add(back)
    }
  }
  root.add(head)

  // ---------------------------------------------------------------- weapons
  const pistol = new THREE.Group()
  {
    const slide = box(0.045, 0.055, 0.19, M.metal); slide.position.z = 0.06
    const grip = box(0.040, 0.10, 0.05, M.metal); grip.position.set(0, -0.07, -0.015)
    grip.rotation.x = 0.28
    pistol.add(slide, grip)
  }
  const shotgun = new THREE.Group()
  {
    const barrel = cyl(0.022, 0.022, 0.52, M.metal, 10)
    barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.16
    const stock = box(0.055, 0.075, 0.24, M.cloth); stock.position.set(0, -0.025, -0.16)
    const pump = box(0.05, 0.05, 0.11, M.cloth); pump.position.z = 0.06
    shotgun.add(barrel, stock, pump)
  }
  for (const g of [pistol, shotgun]) {
    g.position.set(0, -0.40, 0.09)
    g.visible = false
    armR.elbow.add(g)
  }

  // ---------------------------------------------------------------- poses
  let phase = 0
  let breath = 0

  function animate (o = {}) {
    const { moving = false, speed = 1, carrying = false, aiming = false,
            crouching = false, dt = 1 / 60 } = o

    if (moving) phase += dt * (5.6 + speed * 2.2)
    breath += dt * 1.6
    const swing = moving ? Math.min(1, 0.35 + speed * 0.65) : 0
    const s = Math.sin(phase)

    // ---- walk: opposite arm and leg, knees bend on the swing leg
    legL.hip.rotation.x = -s * 0.62 * swing
    legR.hip.rotation.x = s * 0.62 * swing
    legL.knee.rotation.x = (0.10 + Math.max(0, Math.sin(phase + 2.3)) * 0.95) * swing + 0.06
    legR.knee.rotation.x = (0.10 + Math.max(0, Math.sin(phase + 2.3 + Math.PI)) * 0.95) * swing + 0.06

    if (carrying) {
      armL.sh.rotation.x = -0.95; armR.sh.rotation.x = -0.95
      armL.sh.rotation.z = 0.18;  armR.sh.rotation.z = -0.18
      armL.elbow.rotation.x = -1.15; armR.elbow.rotation.x = -1.15
    } else if (aiming) {
      armL.sh.rotation.x = -1.38; armR.sh.rotation.x = -1.46
      armL.sh.rotation.z = 0.16;  armR.sh.rotation.z = -0.06
      armL.elbow.rotation.x = -0.22; armR.elbow.rotation.x = -0.10
    } else {
      armL.sh.rotation.x = s * 0.55 * swing
      armR.sh.rotation.x = -s * 0.55 * swing
      armL.sh.rotation.z = 0.07; armR.sh.rotation.z = -0.07
      armL.elbow.rotation.x = -(0.24 + Math.max(0, s) * 0.35 * swing)
      armR.elbow.rotation.x = -(0.24 + Math.max(0, -s) * 0.35 * swing)
    }

    // ---- crouch lowers the whole body and deepens the knees
    const crouch = crouching ? 1 : 0
    root.position.y = crouch * -0.34 + (moving ? Math.abs(s) * 0.032 * swing : 0)
    if (crouching) {
      legL.hip.rotation.x = -0.55; legR.hip.rotation.x = -0.55
      legL.knee.rotation.x = 1.15;  legR.knee.rotation.x = 1.15
      pelvis.rotation.x = 0.18
      chest.rotation.x = 0.12
    } else {
      pelvis.rotation.x = 0
      chest.rotation.x = 0.04 + Math.sin(breath) * 0.012
    }

    chest.rotation.y = -s * 0.10 * swing
    head.rotation.y = s * 0.05 * swing
    head.rotation.x = -0.04 + (crouching ? 0.16 : 0)
  }

  return {
    group: root,
    animate,
    setWeapon (w) {
      pistol.visible = w === 'pistol'
      shotgun.visible = w === 'shotgun'
    },
    hideWeapon () { pistol.visible = false; shotgun.visible = false },
  }
}

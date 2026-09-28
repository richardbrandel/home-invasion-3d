// Headless tests for the procedural human figures.
//
// Three.js geometry does not need a GPU or a DOM — only WebGLRenderer does — so
// the figures can be built and measured for real under Node.
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createHumanoid } from '../src/humanoid.js'

let pass = 0, fail = 0
function check (name, fn) {
  try { fn(); console.log('  PASS  ' + name); pass++ }
  catch (e) { console.log('  FAIL  ' + name + '\n        ' + e.message); fail++ }
}

const bounds = (h) => { h.group.updateMatrixWorld(true); return new THREE.Box3().setFromObject(h.group) }

console.log('\nhumanoid construction')

check('every hair, sleeve and skin variant builds', () => {
  let n = 0
  for (const hairStyle of ['short', 'tied', 'long', 'cap', 'beanie', 'bald']) {
    for (const sleeves of ['long', 'short']) {
      for (const tone of ['light', 'medium', 'deep', 'olive']) {
        const h = createHumanoid({ hairStyle, sleeves, tone })
        assert.ok(h.group.children.length >= 6, `${hairStyle}/${sleeves}/${tone} produced too few parts`)
        n++
      }
    }
  }
  assert.equal(n, 48)
})

console.log('\nproportions')

check('the figure is human sized', () => {
  const h = createHumanoid({})
  const b = bounds(h)
  const height = b.max.y - b.min.y
  const width = b.max.x - b.min.x
  assert.ok(height > 1.65 && height < 2.0, `height ${height.toFixed(3)} m is not human`)
  assert.ok(width > 0.40 && width < 1.00, `width ${width.toFixed(3)} m is not human`)
  console.log(`        ${height.toFixed(2)} m tall, ${width.toFixed(2)} m wide at the shoulders`)
})

check('the feet rest on the ground, not floating or sunk', () => {
  const h = createHumanoid({})
  h.animate({ dt: 1 / 60 })
  const b = bounds(h)
  assert.ok(Math.abs(b.min.y) < 0.06, `lowest point is y=${b.min.y.toFixed(3)}, expected ~0`)
})

check('the head is above the shoulders', () => {
  const h = createHumanoid({})
  const b = bounds(h)
  assert.ok(b.max.y > 1.6, 'nothing reaches head height')
})

console.log('\nanimation')

check('crouching visibly lowers the whole figure', () => {
  const h = createHumanoid({})
  h.animate({ crouching: false, dt: 1 / 60 })
  const standing = bounds(h).max.y
  h.animate({ crouching: true, dt: 1 / 60 })
  const crouched = bounds(h).max.y
  const drop = standing - crouched
  assert.ok(drop > 0.20, `crouch only dropped ${drop.toFixed(3)} m`)
  console.log(`        crouch drops the silhouette ${drop.toFixed(2)} m`)
})

check('the walk cycle actually swings the legs', () => {
  const h = createHumanoid({})
  h.animate({ moving: false, dt: 1 / 60 })
  const still = bounds(h)
  const stillDepth = still.max.z - still.min.z
  for (let i = 0; i < 10; i++) h.animate({ moving: true, speed: 1, dt: 1 / 60 })
  const walking = bounds(h)
  const walkDepth = walking.max.z - walking.min.z
  assert.ok(walkDepth > stillDepth + 0.10,
    `legs barely moved: depth ${stillDepth.toFixed(2)} -> ${walkDepth.toFixed(2)}`)
  console.log(`        stride opens the profile ${stillDepth.toFixed(2)} -> ${walkDepth.toFixed(2)} m`)
})

check('the knee bends during the cycle rather than staying rigid', () => {
  const h = createHumanoid({})
  const knees = []
  const collect = () => {
    const found = []
    h.group.traverse(o => { if (o.isGroup) found.push(o) })
    return found
  }
  for (let i = 0; i < 12; i++) {
    h.animate({ moving: true, speed: 1, dt: 1 / 60 })
    let minKnee = 99
    for (const g of collect()) minKnee = Math.min(minKnee, g.rotation.x)
    knees.push(minKnee)
  }
  const spread = Math.max(...knees) - Math.min(...knees)
  assert.ok(spread > 0.3, `knee rotation barely varies (spread ${spread.toFixed(3)})`)
})

check('every pose combination runs without throwing', () => {
  const h = createHumanoid({})
  for (const moving of [false, true]) {
    for (const aiming of [false, true]) {
      for (const carrying of [false, true]) {
        for (const crouching of [false, true]) {
          for (let i = 0; i < 3; i++) {
            h.animate({ moving, aiming, carrying, crouching, speed: 1.4, dt: 1 / 60 })
          }
        }
      }
    }
  }
})

check('weapon swap toggles without error', () => {
  const h = createHumanoid({})
  for (const w of ['pistol', 'shotgun', 'pistol']) h.setWeapon(w)
  h.hideWeapon()
  h.setWeapon('pistol')
})

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)

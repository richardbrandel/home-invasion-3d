// textures.js — procedural surface textures drawn on a canvas at load time.
//
// Generated rather than loaded: no image files to ship, nothing to license, and
// they tile seamlessly because the noise wraps at the canvas edge. This is a
// better fit for game surfaces than a generated photo, which never tiles.
import * as THREE from 'three'

function surface (size = 512) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')]
}

function finish (canvas, repeatX, repeatY) {
  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  t.anisotropy = 8
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// value noise that wraps, so edges match when tiled
function noiseLoop (ctx, size, cells, alpha, tint) {
  const rnd = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return n - Math.floor(n)
  }
  const step = size / cells
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const v = rnd(x, y)
      ctx.fillStyle = tint(v)
      ctx.globalAlpha = alpha
      ctx.fillRect(x * step, y * step, step + 1, step + 1)
    }
  }
  ctx.globalAlpha = 1
}

export function woodFloor () {
  const [c, g] = surface(512)
  g.fillStyle = '#7d5a3a'; g.fillRect(0, 0, 512, 512)
  const plank = 64
  for (let row = 0; row < 512 / plank; row++) {
    const y = row * plank
    const shift = (row % 2) * 96
    for (let x = -192; x < 512; x += 192) {
      const px = x + shift
      const shade = 0.86 + ((row * 37 + x * 13) % 100) / 380
      g.fillStyle = `rgb(${Math.round(138 * shade)},${Math.round(102 * shade)},${Math.round(68 * shade)})`
      g.fillRect(px + 1, y + 1, 190, plank - 2)
    }
    g.strokeStyle = 'rgba(40,26,14,.55)'
    g.lineWidth = 2
    g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke()
  }
  // grain
  g.globalAlpha = 0.16
  for (let i = 0; i < 900; i++) {
    const y = Math.random() * 512
    const len = 20 + Math.random() * 90
    g.strokeStyle = Math.random() > 0.5 ? '#3b2716' : '#a07a52'
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(Math.random() * 512, y)
    g.bezierCurveTo(0, y + 1, len, y - 1, len * 2, y)
    g.stroke()
  }
  g.globalAlpha = 1
  return finish(c, 6, 6)
}

export function wallPaint (hex = '#ded8cf') {
  const [c, g] = surface(256)
  g.fillStyle = hex; g.fillRect(0, 0, 256, 256)
  noiseLoop(g, 256, 96, 0.05, v => v > 0.5 ? '#ffffff' : '#000000')
  return finish(c, 3, 2)
}

export function brick () {
  const [c, g] = surface(512)
  g.fillStyle = '#8d6a56'; g.fillRect(0, 0, 512, 512)
  const bh = 40, bw = 88
  for (let row = 0; row * bh < 512; row++) {
    const y = row * bh
    const off = (row % 2) * (bw / 2)
    for (let x = -bw; x < 512 + bw; x += bw) {
      const s = 0.82 + Math.random() * 0.3
      g.fillStyle = `rgb(${Math.round(150 * s)},${Math.round(96 * s)},${Math.round(74 * s)})`
      g.fillRect(x + off + 2, y + 2, bw - 4, bh - 4)
    }
  }
  return finish(c, 5, 3)
}

export function grass () {
  const [c, g] = surface(512)
  g.fillStyle = '#3d6b39'; g.fillRect(0, 0, 512, 512)
  noiseLoop(g, 512, 128, 0.16, v => v > 0.55 ? '#5d9147' : '#2c4f2a')
  g.globalAlpha = 0.5
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512
    g.strokeStyle = Math.random() > 0.5 ? '#6fae55' : '#315a2c'
    g.lineWidth = 1
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 4); g.stroke()
  }
  g.globalAlpha = 1
  return finish(c, 40, 40)
}

export function asphalt () {
  const [c, g] = surface(256)
  g.fillStyle = '#4b4b4e'; g.fillRect(0, 0, 256, 256)
  noiseLoop(g, 256, 128, 0.22, v => v > 0.5 ? '#5e5e62' : '#3a3a3d')
  return finish(c, 6, 8)
}

export function rug (hex = '#7a3b3b') {
  const [c, g] = surface(256)
  g.fillStyle = hex; g.fillRect(0, 0, 256, 256)
  g.strokeStyle = 'rgba(255,235,190,.35)'; g.lineWidth = 3
  g.strokeRect(14, 14, 228, 228)
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2
  g.strokeRect(28, 28, 200, 200)
  for (let i = 0; i < 12; i++) {
    g.fillStyle = `rgba(${180 + i * 4},${150 - i * 6},${90},.22)`
    g.fillRect(40 + i * 3, 40 + i * 3, 176 - i * 6, 176 - i * 6)
  }
  return finish(c, 1, 1)
}

export function shingle () {
  const [c, g] = surface(256)
  g.fillStyle = '#4a4f55'; g.fillRect(0, 0, 256, 256)
  const rh = 26
  for (let row = 0; row * rh < 256; row++) {
    const y = row * rh, off = (row % 2) * 20
    for (let x = -40; x < 256 + 40; x += 40) {
      const s = 0.85 + Math.random() * 0.3
      g.fillStyle = `rgb(${Math.round(74 * s)},${Math.round(80 * s)},${Math.round(88 * s)})`
      g.fillRect(x + off + 1, y + 1, 38, rh - 2)
    }
  }
  return finish(c, 8, 4)
}

export function buildAll () {
  return {
    floor: woodFloor(),
    wallIn: wallPaint('#ded8cf'),
    wallOut: brick(),
    grass: grass(),
    drive: asphalt(),
    rug: rug(),
    roof: shingle(),
  }
}

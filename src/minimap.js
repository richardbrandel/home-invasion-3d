// minimap.js — fog-of-war minimap drawn on a 2D canvas.
//
// The house and furniture are the homeowner's own property, so the layout is
// always shown. The INTRUDER is drawn only when the homeowner actually has line
// of sight (sim.canSee) — no seeing through walls. The lit region is the real
// visibility polygon cast from the player's position.
import * as sim from './sim.js'

const VIEW = { minX: -22, maxX: 22, minZ: -24, maxZ: 16 }

const C = {
  bg: '#0c1013',
  floorDim: '#1b1f24',
  wallDim: '#343a41',
  floorLit: '#3a4550',
  wallLit: '#c9d2dc',
  furniture: '#7b6144',
  van: '#b45309',
  loot: '#f5b02a',
  lootGone: '#4b5563',
  player: '#4d8bf5',
  thief: '#ef4444',
  frame: 'rgba(255,255,255,.16)',
}

export function createMinimap (canvas) {
  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height
  const spanX = VIEW.maxX - VIEW.minX, spanZ = VIEW.maxZ - VIEW.minZ
  const s = Math.min(W / spanX, H / spanZ)
  const ox = (W - spanX * s) / 2
  const oz = (H - spanZ * s) / 2
  const mx = (x) => ox + (x - VIEW.minX) * s
  const mz = (z) => oz + (z - VIEW.minZ) * s

  function rect (r, fill) {
    ctx.fillStyle = fill
    ctx.fillRect(mx(r.x1), mz(r.z1), (r.x2 - r.x1) * s, (r.z2 - r.z1) * s)
  }

  function draw (player, thief, loot) {
    const px = player.x, pz = player.z

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, W, H)

    // ---- dim layer: the layout as known, unlit
    rect(sim.WORLD.house, C.floorDim)
    for (const f of sim.FURNITURE) rect(f, C.furniture)
    for (const w of sim.WALLS) rect(w, C.wallDim)

    // ---- lit layer, clipped to what the player can actually see
    const poly = sim.visibilityPolygon(px, pz, 30)
    ctx.save()
    ctx.beginPath()
    poly.forEach((p, i) => {
      const X = mx(p.x), Z = mz(p.z)
      if (i === 0) ctx.moveTo(X, Z); else ctx.lineTo(X, Z)
    })
    ctx.closePath()
    ctx.clip()

    rect(sim.WORLD.house, C.floorLit)
    for (const f of sim.FURNITURE) rect(f, C.furniture)
    for (const w of sim.WALLS) rect(w, C.wallLit)
    rect(sim.VAN, C.van)

    for (const l of loot) {
      if (l.delivered) continue
      ctx.fillStyle = l.taken ? C.lootGone : C.loot
      const size = 4
      ctx.fillRect(mx(l.x) - size / 2, mz(l.z) - size / 2, size, size)
    }
    ctx.restore()

    // lit-area edge for readability
    ctx.save()
    ctx.beginPath()
    poly.forEach((p, i) => {
      const X = mx(p.x), Z = mz(p.z)
      if (i === 0) ctx.moveTo(X, Z); else ctx.lineTo(X, Z)
    })
    ctx.closePath()
    ctx.strokeStyle = 'rgba(200,225,255,.20)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()

    // ---- the intruder: ONLY with line of sight. This is the requirement.
    if (thief.alive && sim.canSee(px, pz, thief.x, thief.z, 30)) {
      ctx.fillStyle = C.thief
      ctx.beginPath()
      ctx.arc(mx(thief.x), mz(thief.z), 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,.75)'
      ctx.lineWidth = 1.2
      ctx.stroke()
    }

    // ---- the homeowner, always, with a facing wedge
    const X = mx(px), Z = mz(pz)
    ctx.fillStyle = C.player
    ctx.beginPath()
    ctx.arc(X, Z, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.9)'
    ctx.lineWidth = 1.4
    ctx.stroke()

    const fx = Math.sin(player.yaw ?? 0), fz = Math.cos(player.yaw ?? 0)
    ctx.strokeStyle = 'rgba(255,255,255,.55)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(X, Z)
    ctx.lineTo(mx(px + fx * 6), mz(pz + fz * 6))
    ctx.stroke()

    // ---- frame + a tiny north marker
    ctx.strokeStyle = C.frame
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1)
    ctx.fillStyle = 'rgba(255,255,255,.35)'
    ctx.font = '9px ui-monospace, monospace'
    ctx.fillText('N', 6, 12)
  }

  return { draw }
}

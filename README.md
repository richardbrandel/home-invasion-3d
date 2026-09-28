# Home Invasion 3D

A third-person home-defence game. You are the homeowner. A van pulls up, a thief
gets out, and starts carrying your valuables to the van. You have a pistol and a
shotgun. Stop him.

This is the 3D successor to the 2D `home-invasion` game — same premise, rebuilt
with a real 3D world, a third-person camera and mouse look.

## Run it

Double-click `index.html`.

It loads `dist/bundle.js`, a single classic script built by esbuild. That matters:
ES modules are blocked by CORS when a page is opened from `file://`, so a
`type="module"` build would not run on a double-click or in an offline Steam
build. The build step exists to solve that.

Click once to grab the mouse. `Esc` releases it.

## Controls

| Key | Action |
|---|---|
| W A S D | move (camera-relative) |
| Shift | sprint — to chase |
| C | crouch — to hide, and lowers your sight line |
| mouse | look |
| left click | fire |
| 1 / 2 | pistol / shotgun |
| R | reload |
| F11 | fullscreen (in the desktop build) |
| Enter | restart after a round ends |

## The house

Four rooms — living room, kitchen, bedroom, study — divided by an interior wall
with a central opening, furnished with a sofa, coffee table, TV, dining set,
counter and fridge, bed, wardrobe, desk, bookshelf and cabinets. Windows and the
front door are set into the walls, and light comes from one shadow-casting sun
plus a lamp in the living room.

Surfaces are **procedurally generated**, not loaded: wood planks, plaster, an
area rug, asphalt and grass are drawn to a canvas at load time with noise that
wraps at the edge, so they tile without seams. No image files, nothing to
license.

The one piece of generated art is `assets/title.png`, made locally with the FLUX
model. That is the right use of image generation here — it is a flat picture.

## Rules

- Three valuables: **TV**, **Laptop**, **Safe**.
- The thief routes van → door → loot → van. Three round trips clears the house.
- **You win** by killing the thief (100 hp). The pistol takes 4 hits.
- **You lose** if all three valuables reach the van, or if you are killed.

## Project structure

```
index.html          page shell: HUD, crosshair, minimap, overlay, styles
src/sim.js          ALL gameplay logic + visibility. Imports nothing — testable headlessly
src/game.js         Three.js rendering, input, camera, shooting
src/humanoid.js     procedural human figures (torso, limbs, head, walk/carry/aim poses)
src/minimap.js      fog-of-war minimap, drawn on a 2D canvas
test/sim.test.js    headless simulation tests (npm test)
dist/bundle.js      build output (generated)
electron/main.cjs   desktop wrapper so Steam has an executable to launch
steam/              SteamPipe build scripts and publishing guide
```

The split matters. `sim.js` has no Three.js or DOM dependency, so the AI,
pathfinding, collision, damage and visibility can all be driven from Node
without a GPU. That is how the three bugs below were caught before anything
was rendered.

## The minimap

Lower right. It shows the house and furniture — your own property, so the
layout is always visible — but the **intruder only appears when you actually
have line of sight.** Walk behind a wall and he vanishes from the map, because
the lit region is a real visibility polygon cast from your position, not a
circle drawn around it. 20 tests cover this, including one that asserts the
exact requirement: hidden behind a wall, visible through the open doorway.
The polygon costs 0.076 ms, so it is recomputed every frame.

## Commands

```sh
npm test              # 13 headless simulation tests
npm run build         # bundle src/game.js -> dist/bundle.js
npm run build:release # same, minified
npm run dist          # native .app via electron-builder (needs Electron installed)
```

## Three bugs the tests caught

Worth recording, because none of them are visible by reading the code:

1. **A navigation edge clipped a wall corner.** The `doorIn → safe` shortcut
   passed through the south wall at the door jamb, wedging the thief.
2. **The stuck-detector amplified bug 1.** Re-routing sent the thief back down
   the same blocked path, so it looped forever and delivered **0 of 3 items in
   180 seconds**. Removing the bad edge fixed both: the heist now completes in
   **52.8 s with zero re-routes**.
3. **The thief could shoot through walls.** `stepThief` checked line of sight,
   *then* moved, *then* fired using the stale result — so it could step behind
   cover and shoot through it. Sight is now recomputed after movement, and an
   invariant test asserts no shot is ever fired without line of sight.

## What is deliberately not built

- Multiple thieves, waves, or a second human player
- Rigged character models — the figures are built from primitives with
  hand-written walk, carry and aim poses, so they have no facial animation and
  no skeletal deformation
- Audio of any kind
- Textures, normal maps, or an art pipeline
- Menus, options, or persistent scores

## Honest note on scope

This is a 3D home-defence game, not an open world. Anything resembling *Grand
Theft Auto* — a city, drivable vehicles, animated crowds, physics — is a
different order of project, not a bigger version of this one.

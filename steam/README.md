# Publishing Home Invasion 3D on Steam

Everything here is ready except the parts that require **your identity**. This
document is explicit about where that line is, so nothing is a surprise later.

## What is already done

- The game, bundled into a single offline `dist/bundle.js`
- An Electron wrapper (`electron/main.cjs`) so Steam has a native executable
- `package.sh` — builds the app and stages it into `steam/content/`
- `app_build.vdf` and `depot_build.vdf` — SteamPipe build scripts

## What only you can do

| Step | Why it can't be automated |
|---|---|
| Steamworks partner account | Requires your legal identity and government ID verification |
| Tax forms (W-9 / W-8BEN) | Your tax identity |
| Banking details | Payouts must land in a human's account |
| **$100 Steam Direct fee, per game** | Recoupable at $1,000 adjusted gross revenue, but paid up front |
| App ID and Depot ID | Issued to your account; they are not guessable |
| `steamcmd` login | Your Steam credentials, with 2FA — interactive by design |
| **AI content disclosure** | Filed in your name, on your store page |

## Costs and timing to expect

- **$100** per game, non-refundable, recoupable at $1,000 revenue
- **30-day minimum** between paying the fee and releasing
- **Store page live ≥ 2 weeks** before launch
- **Apple Developer account (~$99/yr)** if you ship a macOS build that opens
  without a Gatekeeper warning — unsigned apps are quarantined on other people's
  Macs. This is easy to overlook and it blocks the build for users, not you.
- Store art: capsule images, screenshots, and a trailer are required and are
  *not* optional polish

## The pipeline

```sh
cd ..                          # project root
npm install --save-dev electron electron-builder    # ~300 MB, one time
npm test                       # 13 tests must pass
./steam/package.sh             # bundle -> .app -> steam/content/
```

If Electron is missing, `package.sh` stops and tells you rather than producing a
half-built depot.

## Filling in the IDs

Both VDF files contain placeholders. Replace them once Steamworks issues yours:

- `steam/app_build.vdf` — `YOUR_APP_ID`, `YOUR_DEPOT_ID`
- `steam/depot_build.vdf` — `YOUR_DEPOT_ID`

`setlive` is deliberately **empty**, which stages a build without pushing it
live. Change it to a branch name (e.g. `"beta"`) when you want to test in the
Steam client.

## Uploading

```sh
# install steamcmd (Valve's CLI): https://developer.valvesoftware.com/wiki/SteamCMD
cd steam
steamcmd +login <your_steam_login> +run_app_build "$PWD/app_build.vdf" +quit
```

It prompts for your password and 2FA. That interactivity is intentional and
cannot be scripted away — which is precisely why this step is yours.

## Testing before you upload

The game runs without any of the Steam machinery: double-click `index.html`.
Ship-blocking problems will show up there first, not in the depot.

## Verification status

- 13 headless simulation tests pass (AI, pathing, collision, damage, line of sight)
- `dist/bundle.js` builds and parses cleanly
- The Electron wrapper is **unbuilt** — it requires the ~300 MB install above
- A real browser has **not** run this. No WebGL rendering has been observed, so
  camera behaviour, lighting and framerate are unverified. The simulation behind
  them is tested; the picture is not.

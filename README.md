# padm0nk — Mouse and keyboard for Xbox Cloud Gaming

padm0nk lets desktop Chromium players use mouse and keyboard on Xbox Cloud Gaming by presenting a virtual Xbox controller to the page. No driver install, no native helper app, no account, no telemetry. Open the extension, lock your mouse, tune aim, queue up.

This repo is for players, tinkerers, and contributors who want xCloud controls to feel less like menu wrestling and more like a proper loadout.

## What it does

- Maps WASD to left stick movement.
- Maps mouse movement to right stick aim through Pointer Lock.
- Maps keyboard, mouse buttons, and wheel input to Xbox controls.
- Runs entirely in browser page context through Gamepad API injection.
- Keeps settings local with live updates to open xCloud and tester tabs.
- Ships advanced remapping, sensitivity, smoothing, aim curve, invert-Y, profile import/export, and reset.

## Install from source

padm0nk is now a bundled extension — it builds from TypeScript/Svelte sources into a `dist/` folder, and that built folder is what you load.

1. Install dependencies: `npm install`
2. Build the extension: `npm run build`
3. Open Chrome or Edge.
4. Go to `chrome://extensions` or `edge://extensions`.
5. Enable Developer mode.
6. Click Load unpacked.
7. Select the `dist/` folder (the build output — **not** the repo root).
8. Visit <https://www.xbox.com/play> or a gamepad tester.

For development with hot reload, run `npm run dev` and load the `dist/` folder it produces; edits to UI and content scripts rebuild live.

Desktop Chromium required. Safari/WebKit ignores this page-level virtual pad path. Android Chromium lacks needed Pointer Lock behavior for this use case.

## Test before dropping into xCloud

1. Open <https://hardwaretester.com/gamepad> or <https://gamepad-tester.com>.
2. Press mapped input such as `Space`.
3. Confirm `padm0nk Virtual Xbox 360 Controller` appears.
4. Press WASD and confirm left stick moves.
5. Click page, move mouse, and confirm right stick moves.
6. Press `Esc` to release mouse.

If tester sees pad and inputs move, xCloud should see same controller layer.

## Use on Xbox Cloud Gaming

1. Go to <https://www.xbox.com/play>.
2. Start a game.
3. Click game video to lock mouse for aim.
4. Press your toggle combo (default `F8`) to toggle padm0nk if you need real-controller control back.
5. Press your show-binds combo (default `F9`) while the game page has focus to show the visual controller binds overlay.
6. Tune settings from the extension popup.

The toggle and show-binds shortcuts are configurable combos (defaults `F8` / `F9`). Change them in Advanced remapping.

## Settings

Tune these from the extension popup (or Advanced remapping). All values are clamped to the ranges below.

| Setting | Default | Range | What it does |
| --- | --- | --- | --- |
| **Sensitivity** | `0.018` | `0.002–0.05` | How much mouse movement maps to right-stick deflection. Higher = the stick reaches full throw (max in-game turn rate) with less hand motion. This is the main "how fast do I aim" dial. |
| **Smoothing** | `0.25` | `0–0.95` | Response time-constant for aim. `0` ≈ 25 ms (instant, snappiest, can feel twitchy on a cheap mouse); higher values lengthen it (`0.25` ≈ 85 ms, up to ~250 ms) for buttery-smooth-but-laggier motion. It damps the per-frame jitter from mouse polling — it does **not** add a turn-speed cap. |
| **Aim min** | `0.12` | `0–0.5` | Minimum non-zero stick output. Many games swallow tiny stick deflections inside a hidden deadzone, so slow mouse movement would do nothing. This floor lifts any real motion above that deadzone so fine aim registers. Raise it if slow aim feels dead; lower it if the crosshair creeps on its own. |
| **Aim curve** | `0.75` | `0.25–2` | Response curve exponent. `< 1` boosts fine/low-speed motion (precise tracking) while still reaching full throw on big moves; `1` is linear; `> 1` softens the start for a slower, more deliberate feel. |
| **Invert Y** | `off` | on/off | Flips vertical aim (mouse up → look down). |
| **Lock pointer on click** | `on` | on/off | Auto-locks the mouse pointer when you click the game so aim works; `Esc` releases. Turn off if you prefer to lock manually. |

Aim is **framerate-independent** — it's driven by mouse velocity (px/s), so the same Sensitivity/Smoothing feel identical on a 60 Hz, 120 Hz, or 240 Hz display.

> Reminder: a virtual thumbstick has a maximum deflection, and at full throw the **game** sets the turn rate. Sensitivity/Smoothing change how fast you reach and leave that ceiling, but no setting (and no KBM-on-cloud tool) can exceed it — instant mouse-style 180° flicks aren't physically possible through the Gamepad API.

**Shooter starter settings:**

- Sensitivity: `0.018–0.030`
- Smoothing: `0.10–0.25`
- Aim min: `0.10–0.18`
- Aim curve: `0.60–0.85`

In-game, raise look sensitivity and disable aim deadzone when the game allows it. Hidden deadzones are the final boss here.

## Default bindings

| Input | Xbox control |
| --- | --- |
| W/A/S/D | Left stick |
| Mouse move | Right stick |
| Left click | RT |
| Right click | LT |
| Space | A |
| Ctrl | B |
| R | X |
| F | Y |
| Q / E | LB / RB |
| Shift / C | L3 / R3 |
| Tab | View |
| Enter | Menu |
| Backquote | Guide |
| Arrows or 1-4 | D-pad |
| Toggle combo (default F8) | Toggle padm0nk |
| Show-binds combo (default F9) | Show/hide keybind overlay |

Open the extension popup, then Advanced remapping, to change bindings or the toggle/show-binds combos. Multiple inputs per Xbox control are supported, and remapping warns when an input is already bound elsewhere.

## Why browser-only

padm0nk patches `navigator.getGamepads()` in the page MAIN world at `document_start`. xCloud asks the browser for gamepads, the browser answers with the padm0nk virtual Xbox pad, and input state comes from keyboard and mouse events.

A second content script runs in the isolated world as an extension-side relay. The popup and options pages write config to `chrome.storage.local`; the relay forwards updates into the page through `postMessage` so active games adapt without reinstalling the extension or restarting the browser. The MAIN-world side has no `chrome.*` access — asset URLs and config arrive only through that bridge.

This keeps install surface small:

- No ViGEmBus.
- No DriverKit.
- No kernel extensions.
- No helper daemon.
- No server.

## Architecture

padm0nk is TypeScript end to end, built with Vite + [`@crxjs/vite-plugin`](https://crxjs.dev) (handles MV3 manifest, MAIN-world content-script bundling, and HMR). The UI is Svelte 5; styling is Tailwind v4 with a shared theme palette (no inline hex). The source is modular:

- `src/core/` — pure, framework-free logic (gamepad state, mapper math, config, combos, labels) driven by a single control **registry** (`controller-actions.ts`) that is the source of truth for default bindings, the options page, the overlay, and the table above. Fully unit-tested.
- `src/content/` — `bridge.ts` (isolated world: storage → `postMessage`, asset URLs) and `inject.ts` (MAIN world: thin coordinator) plus `input-capture.ts` (keyboard/mouse/wheel/pointer-lock wiring).
- `src/ui/` — Svelte popup, options, and a shadow-DOM HUD + binds overlay so injected styles never leak into or collide with the host page.

64 Vitest unit tests cover the pure core, and GitHub Actions CI runs format-check → typecheck → test → build on every push.

## Project status

Current build is hackable, playable, and intentionally small. Expect xCloud changes to occasionally break injection or input assumptions. If that happens, open an issue with browser, OS, game, tester result, console errors, and whether your toggle/show-binds combos respond.

Recent quality-of-life work: corrected diagonal left-stick speed (radial clamp so diagonals are no longer ~41% faster than cardinals), a self-hosted bundled UI font (no CDN hotlink — see [`assets/fonts/README.md`](assets/fonts/README.md)), profile import/export to file, and remap conflict warnings.

`pi-coding-agent` helped develop current application state and this repo refresh on behalf of esskayesss: icon rollout, README cleanup, keybind overlay investigation, the TypeScript/Svelte rebuild, and ongoing maintenance support. Blame humans for taste. Credit robots for tireless grep.

## Contributing

Good contributions:

- Fix broken xCloud detection or injection timing.
- Improve aim feel without adding native dependencies.
- Make remapping clearer.
- Keep privacy local-only.
- Keep install instructions honest.
- Keep Xbox vibe loud but usable.

Before sending changes, run `npm run typecheck`, `npm run test`, and `npm run build`, then test in a gamepad tester and on xCloud if possible.

## Packaging

```bash
npm run zip
```

This builds the extension and zips the `dist/` output to `padm0nk-<version>.zip` (version from `package.json`), ready to upload to a store dashboard. Privacy policy source lives at [`docs/privacy.html`](docs/privacy.html). Store dashboards may ask for a public privacy URL; host that file however you prefer.

## Limitations

- xCloud only sees padm0nk on allow-listed pages.
- Pointer Lock is required for mouse aim.
- Native mouse-and-keyboard mode in xCloud bypasses controller emulation. Use controller input mode.
- Some games have heavy deadzones or aim curves that need tuning.
- Browser and xCloud updates can break behavior.

## Disclaimer

padm0nk is independent software. It is not affiliated with, endorsed by, or sponsored by Microsoft. Xbox is a trademark of Microsoft Corporation. padm0nk does not collect or transmit user data; see [`docs/privacy.html`](docs/privacy.html).

## Controller diss, requested by esskayesss

Controllers had good run. Respect to couch warriors, claw-grip elders, stick-drift survivors, and everyone who learned to aim by gently bullying two tiny mushrooms. But some of us want crosshair control, not thumb-based astrology. Some of us want reload on `R`, not whatever plastic rune decided today. Some of us looked at right stick acceleration and said: absolutely not, send mouse.

So padm0nk walks into xCloud wearing green LEDs, drops WASD on left stick, bolts mouse aim to right stick, and tells controllers to hold this L in party chat. Is this a little cringe? Yes. Is it still cleaner than pretending stick drift is personality? Also yes.

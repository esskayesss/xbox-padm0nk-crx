# padm0nk — Mouse and keyboard for Xbox Cloud Gaming

padm0nk lets desktop Chromium players use mouse and keyboard on Xbox Cloud Gaming by presenting a virtual Xbox controller to the page. No driver install, no native helper app, no account, no telemetry. Open the extension, lock your mouse, tune aim, queue up.

This repo is for players, tinkerers, and contributors who want xCloud controls to feel less like menu wrestling and more like a proper loadout.

## What it does

- Maps WASD to left stick movement.
- Maps mouse movement to right stick aim through Pointer Lock.
- Maps keyboard, mouse buttons, and wheel input to Xbox controls.
- Runs entirely in browser page context through Gamepad API injection.
- Keeps settings local with live updates to open xCloud and tester tabs.
- Ships advanced remapping, sensitivity, smoothing, aim curve, invert-Y, import/export, and reset.

## Install from source

1. Open Chrome or Edge.
2. Go to `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select this repo folder.
6. Visit <https://www.xbox.com/play> or a gamepad tester.

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
4. Press `F8` to toggle padm0nk if you need real-controller control back.
5. Press `F9` while game page has focus to show the visual controller binds overlay.
6. Tune settings from extension popup.

Shooter starter settings:

- Sensitivity: `0.018–0.030`
- Smoothing: `0.10–0.25`
- Aim min: `0.10–0.18`
- Aim curve: `0.60–0.85`

In-game, raise look sensitivity and disable aim deadzone when game allows it. Hidden deadzones are final boss here.

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
| F8 | Toggle padm0nk |
| F9 | Show/hide keybind overlay |

Open extension popup, then Advanced remapping, to change bindings. Multiple inputs per Xbox control are supported.

## Why browser-only

padm0nk patches `navigator.getGamepads()` from `src/inject.js` in page MAIN world at `document_start`. xCloud asks browser for gamepads, browser answers with padm0nk virtual Xbox pad, and input state comes from keyboard and mouse events.

`src/bridge.js` runs as extension-side relay. Popup and options write config to `chrome.storage.local`; bridge forwards updates into page so active games can adapt without reinstalling extension or restarting browser.

This keeps install surface small:

- No ViGEmBus.
- No DriverKit.
- No kernel extensions.
- No helper daemon.
- No server.

## Project status

Current build is hackable, playable, and intentionally small. Expect xCloud changes to occasionally break injection or input assumptions. If that happens, open an issue with browser, OS, game, tester result, console errors, and whether `F8`/`F9` respond.

`pi-coding-agent` helped develop current application state and this repo refresh on behalf of esskayesss: icon rollout, README cleanup, keybind overlay investigation, and ongoing maintenance support. Blame humans for taste. Credit robots for tireless grep.

## Contributing

Good contributions:

- Fix broken xCloud detection or injection timing.
- Improve aim feel without adding native dependencies.
- Make remapping clearer.
- Keep privacy local-only.
- Keep install instructions honest.
- Keep Xbox vibe loud but usable.

Before sending changes, test in a gamepad tester and on xCloud if possible.

## Packaging

```bash
./scripts/pack.sh
```

Script writes `dist/padm0nk-<version>.zip` with runtime files only. Privacy policy source lives at [`docs/privacy.html`](docs/privacy.html). Store dashboards may ask for a public privacy URL; host that file however you prefer.

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

# 🎮 PadKey — Keyboard & Mouse for Xbox Cloud Gaming

Play **Xbox Cloud Gaming (xCloud)** with a mouse and keyboard. PadKey emulates an
Xbox controller **inside the browser** by overriding the Gamepad API on the xCloud
page — so it works **on macOS and Windows identically**, with:

- ❌ no ViGEmBus / virtual driver (Windows)
- ❌ no DriverKit / entitlements / disabling SIP (macOS)
- ❌ no native app, no extra latency
- ✅ just a Chrome/Edge extension

Mouse → right stick (aim), WASD → left stick, keys/clicks → buttons.

## Install (Load unpacked)

1. Open **Chrome** or **Edge** → `chrome://extensions` (or `edge://extensions`).
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** and select this `padkey-web/` folder.
4. Done. The extension activates on `xbox.com/play` and gamepad-tester sites.

> Works in any Chromium browser. **Not** Safari (WebKit reads gamepads via
> GameController.framework and ignores page-level pads — use Chrome/Edge for xCloud).

## Test it FIRST (before xCloud)

1. Open <https://hardwaretester.com/gamepad> (or gamepad-tester.com).
2. Press **any mapped key** (e.g. `Space`) — a controller should appear:
   *"PadKey Virtual Xbox 360 Controller ... STANDARD GAMEPAD"*.
3. Press WASD → left stick moves. Click the page → mouse locks → move mouse →
   right stick moves. `Esc` releases the mouse. `F8` toggles PadKey on/off.
   `F9` shows/hides the in-game keybind overlay.

If the pad shows up and sticks/buttons respond, you're good for xCloud.

## Use on xCloud

1. Go to <https://www.xbox.com/play> and start a game.
2. Click the video to **lock the mouse** (enables aim).
3. Play. Press `F8` to switch back to a real controller anytime.
4. Tune **mouse sensitivity / smoothing / aim minimum / aim curve** in the toolbar popup. In-game, turn the
   look/aim sensitivity up and **disable aim deadzone** if the game has one.

Aim tuning starting point for shooters:

- Sensitivity: `0.018–0.030`
- Smoothing: `0.10–0.25`
- Aim min: `0.10–0.18` (raises tiny mouse movements above hidden game deadzones)
- Aim curve: `0.60–0.85` (`<1` boosts fine movements; `1` is linear)

## Configure / remap

Open the extension popup → **Advanced remapping…**. The options page supports:

- click-to-capture remaps for every Xbox button and left-stick direction
- multiple inputs per Xbox control
- keyboard, mouse button, and mouse wheel bindings
- toggle key-combo remap
- show-keybinds overlay combo remap
- sensitivity, smoothing, invert-Y, pointer-lock behaviour
- import/export profile JSON
- full reset to defaults

Config changes apply live to open xCloud/tester tabs. If a tab somehow misses an update, hard-refresh it.

## Default bindings

| Input | Xbox |
|---|---|
| W/A/S/D | Left stick (move) |
| Mouse move | Right stick (aim) |
| Left click | RT (fire) |
| Right click | LT (aim) |
| Space | A |
| Ctrl | B |
| R | X |
| F | Y |
| Q / E | LB / RB |
| Shift / C | L3 / R3 |
| Tab / Enter / Backquote | View / Menu / Guide |
| Arrows or 1-4 | D-pad |
| F8 | Toggle PadKey (configurable combo) |
| F9 | Show/hide keybind overlay (configurable combo) |

## How it works

`inject.js` runs in the page's **MAIN world** at `document_start`, before xCloud's
code, and replaces `navigator.getGamepads()` with a virtual Xbox pad whose axes and
buttons are driven by keyboard + mouse events. `bridge.js` (isolated world) relays
your popup/settings config from `chrome.storage.local` into the page for live updates,
with `chrome.storage.sync` kept as a debounced backup.

## Limitations

- Only runs on the allow-listed sites (xCloud + gamepad testers) by design.
- Mouse aim uses pointer lock; some games still need their in-game sensitivity raised.
- **Desktop Chromium only.** Pointer Lock is required for aim, so Safari/WebKit and
  Chromium on Android cannot work. Use Chrome or Edge on Windows/macOS/Linux.
- xCloud occasionally changes its input handling; an update can temporarily break
  injection until the extension is updated.
- If xCloud is set to its built-in **Native Mouse & Keyboard** mode, it bypasses the
  gamepad layer — keep the controller input mode selected for PadKey to work.

## Packaging & publishing

```sh
./scripts/pack.sh   # writes dist/padkey-<version>.zip (runtime files only)
```

Upload the zip to the Chrome Web Store / Edge Add-ons. The privacy policy lives in
`docs/privacy.html` and is meant to be served via GitHub Pages (Settings → Pages →
source: `/docs`), giving a public URL to paste into the store dashboard.

## Disclaimer

PadKey is an independent tool. It is **not affiliated with, endorsed by, or sponsored
by Microsoft**. Xbox is a trademark of Microsoft Corporation. No data is collected or
transmitted — see [`docs/privacy.html`](docs/privacy.html).

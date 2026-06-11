# padm0nk — Rebuild & Modernization Spec

> Authoritative execution doc. Survives compaction. Read this FIRST in any fresh
> context, then `PLAN.md` (original phase design) and `CTX.md` (history) as
> background only. This file overrides the "no framework / no TS / no bundler"
> non-goals in PLAN.md — the user explicitly approved a full modernization.

## Decision (locked by user)

Full modernization. User wants: TypeScript everywhere, modern tooling, improved
HTML, **TailwindCSS**, **Svelte allowed** (use it for UI), assets pulled out of
inline JS strings into real files/components, neat modular separation, pretty
code, comments where useful, a structure the user can edit by hand. Current CSS
has colors inline everywhere → move to Tailwind theme + CSS palette variables.

Scope approved: Tier 1 tooling + Tier 2 refactor + Tier 3 bug fixes + Tier 4/5
features & hygiene (all tiers; see TODOs at bottom).

## Repo layout

- Live structure: `src/`, `manifest.config.ts`, `vite.config.ts`, etc. (this doc).
- Legacy runtime retired to `.local/legacy/` (gitignored) for reference only:
  `inject.js`, `bridge.js`, `manifest.json`, `pack.sh`, `popup/`, `options/`. Junk
  (screenshots, notes) lives elsewhere under `.local/`. **Nothing in `.local/`
  may be referenced by build config or committed code.**

## Working style (user directive)

- Orchestrate via subagents; keep MY context lean. I lead/iterate, agents do bulk.
- Persist state to files often (this doc + todos) so compaction is safe.
- Use the `todo` tool religiously; one task in_progress at a time.

## Chosen stack

- **Build:** Vite + `@crxjs/vite-plugin` (MV3 manifest handling, content-script
  bundling incl. `world: "MAIN"`, HMR for popup/options).
- **Language:** TypeScript (strict). `tsc --noEmit` typecheck in CI.
- **UI framework:** Svelte (compiles to tiny vanilla — ideal for an extension).
  Use for popup, options, HUD, and binds-overlay.
- **Styling:** TailwindCSS v4 (`@tailwindcss/vite`, no postcss file). Palette as
  Tailwind `@theme` tokens + CSS variables. NO inline hex in components.
- **Tests:** Vitest (Vite-native, TS) for pure `core/` modules.
- **Format/lint:** Prettier + `prettier-plugin-svelte` + `prettier-plugin-tailwindcss`;
  `svelte-check` for Svelte typing. (Biome optional for TS-only; Prettier is the
  source of truth because Biome's Svelte support is weak.)
- **CI:** GitHub Actions — install → typecheck → svelte-check → test → build → zip artifact.

### MAIN-world caveat (why a bundler is mandatory)
MV3 `content_scripts` cannot be ES modules and dynamic `import()` at
`document_start` is racy. CRXJS bundles each content script into one IIFE, so the
modular TS source compiles down to single files. This is the whole reason we
adopt a bundler instead of PLAN.md's fragile `window.__padm0nk` ordered-scripts.

### Style isolation for injected UI
HUD + binds overlay inject into arbitrary pages (xbox.com, testers). Mount Svelte
components into a **Shadow DOM** root and inject the compiled Tailwind CSS as a
string into that shadow root (`import css from './x.css?inline'`). This isolates
our styles from the page and dodges page CSP for inline `<style>` (shadow style
is not subject to page style-src the same way; still verify on xbox.com).

## Target structure

```
package.json
tsconfig.json
vite.config.ts
manifest.config.ts            # crxjs defineManifest (typed)
tailwind via @tailwindcss/vite (theme tokens in src/ui/styles/theme.css)
.prettierrc / prettier plugins
.github/workflows/ci.yml

src/
  core/                       # pure TS, framework-free, 100% unit-tested
    constants.ts              # BUTTON_COUNT=17, AXIS_COUNT=4, button index map
    types.ts                  # Config, Binding, Action, Combo, GamepadState
    controller-actions.ts     # SINGLE registry: {id,label,group,action,icon,defaults}
    config.ts                 # DEFAULT_CONFIG (derived from registry) + normalizeConfig
    combos.ts                 # combo match/label/fromEvent
    labels.ts                 # prettyInput (single source; fixes Mouse3/4 drift)
    gamepad-state.ts          # state factory, reset, snapshot
    gamepad-api.ts            # native getGamepads capture + override + connect/disconnect
    mapper.ts                 # pure step({config,held,mouseDelta,state,now}) -> state
  content/
    bridge.ts                 # ISOLATED world: storage -> postMessage; asset URLs
    inject.ts                 # MAIN world THIN coordinator (<200 LOC target)
    input-capture.ts          # keyboard/mouse/wheel/pointerlock/scroll-suppress/cleanup
  ui/
    styles/theme.css          # @theme palette tokens + CSS vars (the ONLY color source)
    shadow.ts                 # helper: create shadow host + inject inline css
    hud/Hud.svelte
    binds-overlay/BindsOverlay.svelte
  shared/
    storage.ts                # local-first read, sync fallback, sync->local migrate, debounced sync backup
  popup/   { Popup.svelte, main.ts, index.html }
  options/ { Options.svelte, main.ts, index.html }

assets/
  bind-icons/*.svg            # already exist (a,b,x,y,dpad-*,*-bumper,*-trigger,*-stick*,view,menu,guide)
  xbox-controller.svg         # already exists
  fonts/bahnschrift.woff      # NEW: bundle locally, stop hotlinking xbox CDN
icons/ icon-{16,32,48,128}.png, padm0nk.png

tests/  *.test.ts             # vitest: config, combos, mapper, labels
dist/                         # build output (gitignored) -> zip from here
```

## Behavioral invariants — MUST be preserved byte-faithfully

### Gamepad layout (W3C "standard")
- BUTTON_COUNT = 17, AXIS_COUNT = 4.
- buttons: 0 A,1 B,2 X,3 Y,4 LB,5 RB,6 LT,7 RT,8 View,9 Menu,10 L3,11 R3,
  12 DpadUp,13 DpadDown,14 DpadLeft,15 DpadRight,16 Guide.
- axes: 0 LX,1 LY,2 RX,3 RY. Y: up = -1, down = +1.
- snapshot id string: `padm0nk Virtual Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)`, mapping `"standard"`, vibrationActuator stub (dual-rumble, playEffect/reset resolve).

### DEFAULT_CONFIG
```
enabled:true, sensitivity:0.018, smoothing:0.25, aimMin:0.12, aimCurve:0.75,
invertY:false, lockPointerOnClick:true, toggleKey:"F8" (legacy, keep for old profiles),
toggleCombo:{code:"F8",ctrl:false,alt:false,shift:false,meta:false},
helpCombo:{code:"F9",...false}
```

### Default bindings (input id -> action)
```
KeyW {a,1,-1}  KeyS {a,1,+1}  KeyA {a,0,-1}  KeyD {a,0,+1}
Space {b,0}A   ControlLeft {b,1}B  KeyR {b,2}X  KeyF {b,3}Y
KeyQ {b,4}LB   KeyE {b,5}RB
Mouse2 {b,6}LT Mouse0 {b,7}RT
ShiftLeft {b,10}L3  KeyC {b,11}R3
Tab {b,8}View  Enter {b,9}Menu  Backquote {b,16}Guide
ArrowUp {b,12} ArrowDown {b,13} ArrowLeft {b,14} ArrowRight {b,15}
Digit1 {b,12}  Digit2 {b,13}  Digit3 {b,14}  Digit4 {b,15}
```
Action shapes: button `{t:"b", i}`; axis `{t:"a", a, v:-1|+1}`.
Input ids: `KeyboardEvent.code`, or `Mouse0/1/2/3/4` (L/M/R/4/5), `WheelUp`/`WheelDown`.

### Mapping math (mapper.step), per animation frame
```
buttons.fill(0); ax = Float64Array(4)
for id in held: b=bindings[id]; if b.t=="b" buttons[b.i]=1 elif b.t=="a" ax[b.a]+=b.v
ax[0]=clamp(ax[0],-1,1); ax[1]=clamp(ax[1],-1,1)        // <-- Tier3 bug: replace w/ radial clamp
rxTarget = aimResponse(mouseDX*sensitivity)
ryTarget = aimResponse(mouseDY*sensitivity*(invertY?-1:1))
mouseDX=mouseDY=0
s = clamp(smoothing,0,0.95)
ax[2] = axes[2]*s + rxTarget*(1-s)
ax[3] = axes[3]*s + ryTarget*(1-s)
if |ax[2]|<0.005 ax[2]=0; if |ax[3]|<0.005 ax[3]=0
state.axes=ax; state.timestamp=performance.now()
```
`aimResponse(raw)`: `val=clamp(raw,-1,1); mag=|val|; if mag==0 return 0;
min=clamp(aimMin,0,0.5); curve=clamp(aimCurve,0.25,2); shaped=mag**curve;
return sign(val)*clamp(min+(1-min)*shaped,0,1)`.

### Scroll suppression (`swallow`)
`blockScrollUntil = now+250ms`; preventDefault + stopPropagation +
stopImmediatePropagation; schedule `restoreScroll` via queueMicrotask + rAF +
setTimeout(0). `restoreScroll`: if `now <= blockScrollUntil` → `scrollTo(lastAllowedX,Y)`.
A window scroll listener stores lastAllowed when not currently blocking.

### Keyboard capture
Bind keydown/keypress/keyup in CAPTURE phase on window, doc, documentElement,
body (and DOMContentLoaded for body). help combo & toggle combo handled on
keydown (swallow). Escape closes overlay. Mapped keys always swallowed (incl.
repeat) to kill page scroll; `apply()` only on non-repeat.

### Mouse / pointer lock
onMouseButton: if `composedPath` includes hudEl or overlayEl → RETURN (click-safe:
no bind, no pointer lock). If lockPointerOnClick && down && !locked →
`documentElement.requestPointerLock()`. apply("Mouse"+button); swallow if bound.
onMouseMove: only when pointerLocked; accumulate movementX/Y into mouseDX/DY.
onWheel: id=deltaY<0?WheelUp:WheelDown; if bound apply(true) then setTimeout 60ms apply(false) (pulse); swallow.
contextmenu: preventDefault only when enabled && pointerLocked.
HUD element also stopPropagation on pointerdown/mousedown/mouseup/click.

### Lifecycle
- `__padm0nkInstalled` guard (double-install).
- First mapped `down` input fires `fireConnect()` (dispatch gamepadconnected).
- toggle() flips enabled; on enable clear stale state; on disable clearInputs +
  fireDisconnect + exitPointerLock.
- blur + visibilitychange(hidden) → clearInputs (held.clear, mouseDX/DY=0).
- getGamepadsOverride: real=native(); if !enabled||!connected return real; else
  put snapshot in first null slot (else append), report that index.

### Bridge protocol (isolated -> MAIN)
postMessage `{__padm0nk:"config", config, controllerUrl, iconUrl, bindIconBase, fontUrl(NEW)}`.
Storage: read local.config first; else sync.config (and migrate to local);
`chrome.storage.onChanged` (local|sync) relays new config. MAIN world has NO
chrome.* — all asset URLs MUST come through the bridge message.

## Palette (extract to theme tokens — currently inline everywhere)
- xbox-green deep: `#107c10`
- accent green (text/keys): `#9fef7f`
- bright lime border: `rgba(135,255,93,.x)`
- text primary: `#fff` / `#f4fff2` / `#e8f1ea` / `#e6e6e6`
- muted: `#9ba7b4` / `#8a8a93` / `#aeb6be`
- bg dark: `#0f0f14` `#14141a` `#16161c` `#16161d` and gradient panels rgba(15,19,22,.94) etc.
- danger red: `#ff7b7b` `#ff9b9b`
- chip/border greys: `#23232d` `#34343f` `#3a3f46`
Define as `--pad-green`, `--pad-accent`, `--pad-bg`, `--pad-muted`, `--pad-danger`, etc.
Map to Tailwind theme colors so components use `text-pad-accent` not hex.

## Bugs to fix (Tier 3)
1. **Diagonal speed**: left stick per-axis clamp → vector magnitude up to 1.41 on
   diagonals. Add radial clamp (normalize so |(ax0,ax1)| ≤ 1) in mapper. Keep an
   option/flag if behavior-change is risky, but default to corrected.
2. **prettyInput drift**: inject lacks Mouse3/Mouse4 that options has. Single
   `labels.ts` fixes it.
3. **Dead code**: options `commitCapture` toggle branch is unreachable (toggle/help
   route through `commitCombo`). Remove on port.
4. **Legacy `toggleKey`**: keep for backward-compat read, but derive from combo;
   document once, don't duplicate everywhere.
5. **Perf**: `snapshot()` allocates arrays every getGamepads call (per frame).
   Reuse buffers where safe.
6. **Font**: stop hotlinking `assets.play.xbox.com/.../Bahnschrift.woff`. Bundle
   `assets/fonts/bahnschrift.woff` as web-accessible; bridge passes `fontUrl`.
7. **CSS/CSP**: inject styles via shadow DOM inline css (and/or web-accessible
   `<link>`), not page-level inline `<style>` strings.

## Features (Tier 4) — implement after core port is green
- Per-game/site profiles (config currently global). Keyed by host; default profile fallback.
- Separate X/Y mouse sensitivity (sensitivityX / sensitivityY; migrate from single).
- HUD position picker (corner select) and/or draggable; persist.
- Remap conflict warning in options (input already bound elsewhere).
- Live aim-test pad inside options (visualize stick output while tuning).
- Import/export profile to file (currently textarea only).
- (Low) analog trigger option.

## Hygiene (Tier 5)
- `Screenshot 2026-06-12 000432.png` untracked in root — move to dist/ or gitignore.
- README: F8/F9 are now configurable combos — update wording + bindings table sourced from registry.
- Add CHANGELOG.md (Keep a Changelog).
- Review docs/index.html + docs/privacy.html still accurate.
- pack.sh (now `.local/legacy/pack.sh`, retired): replaced by `vite build` +
  `scripts/zip.mjs` (npm scripts `build` / `zip`). Legacy script kept for reference only.

## Smoke matrix (run before/after each phase — manual, load unpacked)
hardwaretester.com/gamepad and/or gamepad-tester.com:
1. loads, no console errors. 2. Space → pad appears, A lights. 3. WASD → left stick.
4. Mouse0→RT, Mouse2→LT. 5. click game → pointer lock (NOT when clicking HUD/overlay).
6. mouse move locked → right stick. 7. F8 toggles ON/OFF. 8. F9 opens/closes overlay.
9. Esc closes overlay / releases lock. 10. popup change live-updates page.
11. options remap persists + live-updates. 12. sync-only install migrates to local.

## Orchestration plan (subagents; I orchestrate, verify each before next)
- **P0 Scaffold** (1 agent): package.json, vite, crxjs, ts(strict), svelte, tailwind v4,
  vitest, prettier(+svelte+tailwind), manifest.config.ts, .github CI, dir skeleton.
  Verify: `npm i`, `npm run build` produces loadable dist, typecheck passes.
- **P1 Core** (1 agent): port core/ to TS + controller-actions registry + config from
  registry + combos + labels + types. Vitest for config/combos/labels. Verify tests green.
- **P2 Mapper+state+api** (1 agent): gamepad-state, gamepad-api, mapper (pure) + radial
  clamp fix. Vitest mapper cases (WASD axes, opposing cancel, diagonal magnitude≤1,
  aimResponse, smoothing). Verify green.
- **P3 Storage+bridge** (1 agent): shared/storage.ts + content/bridge.ts (+ fontUrl).
- **P4 UI popup/options** (1 agent): Svelte + Tailwind, rows generated from registry,
  theme tokens, combo capture, import/export, conflict warn (Tier4). Verify build + manual.
- **P5 Injected UI** (1 agent): Hud.svelte + BindsOverlay.svelte in shadow DOM, theme css
  inline-injected, click-safety preserved, assets via bridge.
- **P6 Coordinator+capture** (1 agent, HIGHEST RISK, do last): content/inject.ts thin
  coordinator + input-capture.ts. Full smoke matrix. Keep inject <200 LOC.
- **P7 Features**: profiles, X/Y sens, HUD position, live aim pad.
- **P8 Hygiene+docs+CI green+zip**: README/CHANGELOG, screenshot, pack via vite, verify CI.

Each phase: agent writes code, I diff-verify actual changes (not just summary),
run build/tests, update todos + this file's "Progress log".

## Progress log
- 2026-06-12: Spec authored. Stack decided. No code yet. Next: P0 scaffold.
- 2026-06-12: **P0 scaffold COMPLETE — all 5 gates green.** Finished interrupted
  `npm install` and verified the toolchain end-to-end.
  - Installed versions (clean `npm install`, no `--force`/`--legacy-peer-deps`):
    vite 6.4.3, @crxjs/vite-plugin 2.6.1, svelte 5.56.3, tailwindcss 4.3.0,
    @tailwindcss/vite 4.3.0, @sveltejs/vite-plugin-svelte 5.1.1, vitest 3.2.6,
    prettier 3.8.4, prettier-plugin-svelte 4.1.0, prettier-plugin-tailwindcss 0.8.0,
    svelte-check 4.6.0, typescript 5.9.x, @types/chrome 0.0.328.
  - **Peer-dep / tooling issue + fix:** `npm run format:check` crashed on the two
    Svelte stubs with `TypeError: getVisitorKeys is not a function` (inside
    `printEmbeddedLanguages`). Root cause: prettier 3.7+ changed an internal API;
    the scaffold pinned `prettier-plugin-tailwindcss@^0.6.14` (and
    `prettier-plugin-svelte@^3.4.0`), both pre-fix. Resolution: bumped
    `prettier-plugin-tailwindcss` → `^0.8.0` (tailwindlabs PR #418, Prettier v3.7+
    compat) and `prettier-plugin-svelte` → `^4.1.0`. No `npm install` peer conflicts;
    install is clean.
  - npm scripts: `dev`, `build` (vite build), `typecheck` (svelte-check + tsc
    --noEmit), `test` (vitest run), `format` / `format:check` (prettier), `zip`.
  - Build output verified: `dist/manifest.json` present; bridge content script +
    MAIN-world inject (`"world": "MAIN"`) both bundled to IIFE `assets/*.js`;
    popup + options `index.html` emitted; WAR mirrors legacy + adds `assets/fonts/*.woff`.
  - Gate evidence: install `found 0 vulnerabilities`; typecheck `svelte-check found
    0 errors and 0 warnings` + tsc clean; test `Tests 1 passed (1)`; build
    `dist/manifest.json 2.39 kB ... ✓ built`; format `All matched files use Prettier
    code style!`. Verified reproducibly via `npm ci`.
  - Human double-check: `assets/fonts/` is empty (no `bahnschrift.woff` bundled
    yet — Tier3/P3 item); WAR glob currently matches nothing there but does not
    break the build. src/ files remain stubs with `// TODO(Pn)` markers. Next: P1 core.

- 2026-06-12: **P1 core COMPLETE — all gates green.** Ported pure framework-free
  core to TS from `.local/legacy/{inject.js,options/options.js}`.
  - **Files implemented** (replaced stubs): `types.ts` (Action/ButtonAction/
    AxisAction/Bindings/Combo/Config/GamepadState/ControllerAction/ControllerGroup),
    `constants.ts` (BUTTON_COUNT=17, AXIS_COUNT=4, `BUTTON`/`AXIS` index maps,
    `GAMEPAD_ID`, `GAMEPAD_MAPPING`), `controller-actions.ts` (registry + helpers),
    `config.ts` (DEFAULT_CONFIG + normalizeConfig), `combos.ts`
    (comboFromEvent/comboLabel/comboMatches), `labels.ts` (prettyInput).
    `gamepad-state.ts`, `gamepad-api.ts`, `mapper.ts` left as P2 stubs.
  - **Registry shape** (`ControllerAction`): `{ id, label, group, action, icon?,
    defaultInputs[] }`. Group titles in `GROUP_TITLES` match legacy options GROUPS
    byte-for-byte. `INFO_GROUPS` carries the mouse-driven "Aim — Right Stick" info
    group (no items). 21 actions. Icons map to real `assets/bind-icons/*.svg`
    filenames (verified present). `buildDefaultBindings()` flattens
    `defaultInputs -> action`; `groupsForOptions()` rebuilds the options sections
    (info groups interleaved by declared order).
  - **DEFAULT_CONFIG derivation**: scalar defaults inline from spec;
    `bindings: buildDefaultBindings()` — single source of truth, no hand-typed map.
    Test asserts it equals the legacy bindings exactly.
  - **normalizeConfig**: clamps sensitivity 0.002–0.05, smoothing 0–0.95,
    aimMin 0–0.5, aimCurve 0.25–2; coerces booleans; drops malformed binding
    entries; recovers empty/missing bindings to defaults; derives toggleCombo from
    a legacy toggleKey-only profile but prefers an explicit toggleCombo (bug item 4).
  - **prettyInput drift fix (bug item 2)**: union of both legacy versions —
    Mouse3="Mouse 4", Mouse4="Mouse 5" now present (inject.js lacked them).
  - **Tests**: 4 new files (config, combos, labels, registry), **29 tests total**
    (incl. legacy smoke). Notable: documented the legacy comboMatches quirk that a
    modifier-key-alone combo never self-matches (event always carries the modifier
    flag) — ported faithfully rather than "fixed".
  - **Gate evidence**: `npm run typecheck` → svelte-check 0 errors/0 warnings + tsc
    clean. `npm run test` → `Test Files 5 passed (5) / Tests 29 passed (29)`.
    `npm run format` + `npm run format:check` → "All matched files use Prettier code
    style!". Avoided adding `@types/node` (no build-config change) by enumerating
    bind-icons via Vite `import.meta.glob` in the registry test.
  - Human double-check: confirm group titles render acceptably in P4 options;
    "Aim — Right Stick" em-dash preserved from legacy. Next: P2 mapper+state+api.

- 2026-06-12: **P2 mapper+state+api COMPLETE — all gates green.** Ported the three
  pure runtime modules from `.local/legacy/inject.js`.
  - **Files implemented** (replaced stubs): `gamepad-state.ts`
    (createGamepadState / clearInputs / resetGamepadState / snapshot),
    `gamepad-api.ts` (createGetGamepadsOverride + makeGamepadEvent/Connected/
    Disconnected builders), `mapper.ts` (step + aimResponse). Extended
    `types.ts` GamepadState with input accumulators (held / mouseDX / mouseDY).
  - **State shape**: input accumulators live on GamepadState itself (NOT a
    separate InputState) so the mapper signature stays minimal —
    `step(config, state, now)`. Capture layer writes held/mouse; mapper reads
    held and consumes (zeroes) mouse deltas each tick. Documented on the type.
  - **Bug 1 — radial clamp (INTENTIONAL DIVERGENCE from legacy)**: legacy did
    per-axis `clamp(ax0,-1,1); clamp(ax1,-1,1)`, so diagonals (e.g. W+D = (1,1))
    reached magnitude √2 ≈ 1.41 → ~41% faster diagonal movement. Replaced with a
    radial clamp on the (ax0,ax1) vector: `mag = hypot(ax0,ax1); if mag>1 scale
    both by 1/mag`. Cardinal inputs unchanged; diagonals now ~0.707 each, |v| ≤ 1.
    Default ON (no flag — corrected behaviour is the only behaviour). Test asserts
    `hypot(ax0,ax1) ≈ 1` and each component `≈ Math.SQRT1_2`.
  - **Bug 5 — snapshot alloc reuse**: legacy allocated a fresh Gamepad, 17 fresh
    button wrappers, a fresh axes array, and a fresh vibrationActuator on EVERY
    getGamepads() call (per polled frame). Now: one SnapshotCache per GamepadState
    held in a module-level WeakMap (keeps the type pure, GC'd with its state).
    snapshot() mutates the cached Gamepad's index/connected/timestamp, the reused
    button wrappers' pressed/touched/value, and the reused axes array in place,
    returning the same object each call. Reflects current state at call time
    (callers poll synchronously). Test asserts identity reuse across calls.
  - **Override slot logic**: `real = native ? Array.from(native()) : []`; pass
    through untouched when `!isEnabled() || !state.connected`; else clone,
    `findIndex(g==null)` for first empty slot (append at `length` if none),
    place `snapshot(state, slot)`, report that slot as the index. Mirrors legacy.
  - **Tests**: 3 new files — `mapper.test.ts` (15), `gamepad-state.test.ts` (8),
    `gamepad-api.test.ts` (6). **58 tests total** (was 29). Notable mapper cases:
    KeyW→LY≈-1, W+S→0, W+D radial-clamp magnitude≤1, invertY sign flip, smoothing
    monotonic convergence, deadzone snap (<0.005→0); aimResponse monotonic /
    sign-preserving / aimMin floor / curve<1 boost / raw clamp.
  - **Gate evidence**: `npm run typecheck` → svelte-check 0 errors/0 warnings + tsc
    clean. `npm run test` → `Test Files 8 passed (8) / Tests 58 passed (58)`.
    `npm run format` + `format:check` → "All matched files use Prettier code style!".
  - Human double-check: snapshot reuse returns the SAME object reference each call
    — verify no P6 consumer caches a getGamepads() result across frames expecting
    an immutable copy (standard gamepad polling re-reads each frame, so this is
    fine, but worth confirming when wiring the coordinator). Next: P3 storage+bridge.

- 2026-06-12: **P3 storage+bridge COMPLETE — all gates green.** Implemented the
  framework-free storage helper and the isolated-world bridge content script.
  - **src/shared/storage.ts public API**:
    - `readConfig(): Promise<Config>` — local-first; on miss, falls back to sync
      and MIGRATES it into local; everything passes through `normalizeConfig`, so
      callers always get a complete Config. Empty store → normalized DEFAULT_CONFIG.
    - `writeConfig(config): Promise<void>` — writes `chrome.storage.local`
      immediately (instant live-update path to content scripts) and debounces a
      `chrome.storage.sync` backup (module-level 400ms timer, shared so
      popup/options don't reinvent it). Returns the local-write promise.
    - `onConfigChanged(cb): () => void` — subscribes to `chrome.storage.onChanged`
      for `local|sync`, normalizes `newValue`, invokes cb; returns unsubscribe.
    - All callback chrome.* APIs wrapped in Promises; try/catch guards so a
      missing chrome.* degrades gracefully.
  - **Migration**: first read with no local but a sync value normalizes the sync
    payload and `chrome.storage.local.set`s it, so every later read is fast/live.
  - **Debounce**: rapid `writeConfig` calls each reset the single module timer;
    only the last value is flushed to sync after 400ms quiet (coalesced). Test
    asserts local instant + single coalesced sync backup.
  - **src/content/bridge.ts** (isolated world): reuses storage.ts `readConfig` +
    `onConfigChanged` (single source; no DOM/UI imports). Posts via
    `window.postMessage(payload, "*")` with payload shape:
    `{ __padm0nk:"config", config, controllerUrl, iconUrl, bindIconBase, fontUrl }`.
    URLs via `chrome.runtime.getURL`: controllerUrl=`assets/xbox-controller.svg`,
    iconUrl=`icons/padm0nk.png`, bindIconBase=`assets/bind-icons/` (trailing
    slash), **fontUrl=`assets/fonts/bahnschrift.woff` (NEW, Bug 6)**. On config
    change, re-posts the FULL payload (keeps MAIN's asset URLs fresh). getURL
    guarded; initial read posts `{}` config on failure so MAIN still gets URLs.
  - **Font decision (Bug 6)**: NO CDN hotlink. `fontUrl` wired end-to-end
    (bridge → MAIN payload). `assets/fonts/*.woff` already globbed into WAR by
    manifest.config.ts (verified). The actual binary is NOT committed (licensing);
    `assets/fonts/.gitkeep` retained and `assets/fonts/README.md` added documenting
    that a self-hosted Bahnschrift-equivalent must be dropped as
    `assets/fonts/bahnschrift.woff`. **P5/P6 MUST register the font via @font-face
    against `fontUrl` AND always use the fallback stack:**
    `"Bahnschrift", "Segoe UI", system-ui, sans-serif` (handles empty/failed font).
  - **Tests**: added `tests/storage.test.ts` (6 tests) with an in-memory
    `globalThis.chrome` mock (local/sync stores + onChanged dispatcher, fake
    timers). Asserts local-first read, sync→local migration, defaults fallback,
    instant-local + debounced-sync write, coalesced backup, and onChanged
    normalization + unsubscribe.
  - **Gate evidence**: `npm run typecheck` → `svelte-check found 0 errors and 0
    warnings` + tsc clean. `npm run test` → `Test Files 9 passed (9) / Tests 64
    passed (64)`. `npm run format:check` → "All matched files use Prettier code
    style!". `npm run build` → bridge bundled to `dist/assets/bridge.ts-*.js`
    (5.44 kB, IIFE, includes storage+config+registry); `✓ built in 789ms`.
  - Human double-check: confirm P5/P6 consume `fontUrl` + apply the fallback
    stack, and that the real `bahnschrift.woff` lands in `assets/fonts/` before
    release. Next: P4 UI popup/options.

- 2026-06-12: **P5 injected UI COMPLETE — all gates green.** Built the HUD dock +
  binds overlay as Svelte 5 components mounted into Shadow DOM with Tailwind v4
  theme tokens. No core/storage/bridge/inject/capture/popup/options/build-config
  touched.
  - **Files:** `src/ui/shadow.ts` (mount helper + P6 contract),
    `src/ui/reactive-props.svelte.ts` (rune-backed `$state` props box — runes need
    a `.svelte.ts` module, keeps the public contract in plain `shadow.ts`),
    `src/ui/hud/Hud.svelte`, `src/ui/binds-overlay/BindsOverlay.svelte`.
  - **shadow.ts public API (P6 contract):**
    `mountHud(opts: HudProps & {fontUrl?})` and
    `mountOverlay(opts: OverlayProps & {fontUrl?})` → `MountHandle<P>` =
    `{ host: HTMLElement; root: ShadowRoot; update(patch: Partial<P>): void;
    destroy(): void }`. `HudProps={iconUrl,toggleCombo,helpCombo,enabled}`;
    `OverlayProps={open,bindings,bindIconBase,toggleCombo,helpCombo,onClose}`.
    `update()` pushes live config/state reactively (via the `$state` box);
    `destroy()` unmounts + removes the host. Each call creates its own fixed,
    full-viewport, `pointer-events:none` (click-through) host with an open shadow
    root; compiled Tailwind injected as a `<style>` from
    `import css from './styles/theme.css?inline'` (CSP-safe, NOT page-level
    `<style>` — Bug 7).
  - **Click-safety hooks:** hosts carry `data-padm0nk="hud"|"overlay"`. Exported
    `HOST_ATTR`, `HUD_HOST_VALUE`, `OVERLAY_HOST_VALUE`, `HUD_HOST_SELECTOR`,
    `OVERLAY_HOST_SELECTOR`, and `isPadm0nkUiEvent(e)` (matches the hosts in
    `event.composedPath()`). P6 calls `isPadm0nkUiEvent` (or matches the handle
    `host` elements) to SKIP pointer-lock / game-bind. Second line of defense: the
    HUD dock and overlay panel `stopPropagation` on pointerdown/mousedown/mouseup/
    click in the CAPTURE phase (`on*capture`), so panel clicks never bubble to the
    page. P6 must STILL do the composedPath check for its own capture-phase
    listeners + pointer-lock suppression (documented at the top of shadow.ts).
  - **Overlay rows from the registry:** `BindsOverlay` iterates `groupsForOptions()`
    from `core/controller-actions`. Item groups render one row per
    `ControllerAction` (bind-icon `bindIconBase+entry.icon` with a `•` fallback,
    label, bound inputs); info groups (e.g. mouse-driven right stick) render their
    `info` text. Bound inputs come from a local `actionEq` (button by index, axis
    by axis+direction) filtering `bindings`, mapped through `prettyInput`, joined
    ` / `, else `UNMAPPED`. HUD uses `comboLabel` for hints, dims (grayscale icon +
    muted state) when `!enabled`.
  - **Font fallback (per P3 note):** shadow.ts injects `@font-face` named
    `"Padm0nk Bahnschrift"` from the bridge `fontUrl` ONLY when present
    (`font-display:swap`); root `.padm0nk-ui` font-family stack is
    `"Padm0nk Bahnschrift","Bahnschrift","Segoe UI",system-ui,sans-serif` — absent/
    failed font degrades gracefully.
  - **Styling:** all colors via theme tokens (`text-pad-*`/`bg-pad-*` or
    `var(--color-pad-*)` in the few inline gradients/borders); no inline hex. No
    `@apply`/`@import "tailwindcss"` in `.svelte` `<style>` (none used). Verified
    the utilities used (incl. arbitrary values `grid-cols-[48px_auto]`,
    `tracking-[0.14em]`→`letter-spacing:.14em`, `max-h-[calc(…)]`) are generated
    into the same compiled `theme.css` shadow.ts injects via `?inline` — so they
    render in the shadow root.
  - **Gate evidence:** `npm run typecheck` → `svelte-check found 0 errors and 0
    warnings` + tsc clean. `npm run test` → `Test Files 9 passed (9) / Tests 64
    passed (64)` (no new tests — relied on build + svelte-check; visual check is
    P6). `npm run build` → `✓ built in 815ms` (`dist/manifest.json` emitted).
    `npm run format:check` → "All matched files use Prettier code style!".
  - Human double-check: components aren't mounted yet — P6 wires `mountHud`/
    `mountOverlay` into `content/inject.ts`, passing `iconUrl`/`bindIconBase`/
    `fontUrl` from the bridge message and driving `update({open})` for F9 +
    `update({enabled})`/config for F8. Next: P4 popup/options or P6 coordinator.

- 2026-06-12: **P4 UI popup/options COMPLETE — all gates green.** Rebuilt both
  extension pages as Svelte 5 (runes) + Tailwind v4, registry-driven, persisting
  exclusively through `src/shared/storage.ts` (readConfig / writeConfig /
  onConfigChanged — no direct chrome.storage).
  - **Popup** (`src/popup/Popup.svelte`, ~280px): Enabled toggle; sensitivity /
    smoothing / aimMin / aimCurve sliders with live readouts (legacy min/max/step);
    Invert Y + Lock-pointer toggles; "Advanced remapping…" →
    `chrome.runtime.openOptionsPage()`; "Reset sliders to defaults" resets ONLY
    slider/toggle fields while preserving bindings + toggleKey + toggleCombo +
    helpCombo. Footer hint shows current combos via
    `comboLabel(config.toggleCombo/helpCombo)` (not hardcoded F8/F9). Loads via
    readConfig, saves on input via writeConfig, live-refreshes via onConfigChanged.
  - **Options** (`src/options/Options.svelte`): remapping sections rendered from
    `groupsForOptions()` — each row = registry label + bound-input chips
    (`prettyInput`) each with ×-unbind + a ＋Add capture button. The mouse-driven
    "Aim — Right Stick" INFO group renders its text with no items. Multiple inputs
    per action supported.
  - **Capture flow**: ＋Add → `startCapture({kind:'binding',action,id})`; global
    capture-phase keydown (by `e.code`) / mousedown (`Mouse0-4`) / wheel
    (`WheelUp`/`WheelDown`) bind the next input; Esc cancels. The **dead
    `commitCapture` toggle branch was OMITTED** (bug 3) — toggle/help captured as
    combos only via `comboFromEvent`, shown with `comboLabel`. Toggle capture keeps
    legacy `toggleKey` in sync (`toggleKey=combo.code` + `toggleCombo=combo`); combo
    is source of truth.
  - **Tier-4 conflict warning**: binding an input already bound to a DIFFERENT
    action surfaces a non-blocking inline notice "Reassigned <input> from <group ·
    control>" (auto-clears ~4s); the input still moves (legacy behavior) but the
    move is now visible. No new deps.
  - **Tier-4 file import/export**: kept the JSON textarea (Copy current → box /
    Apply from box with `normalizeConfig` + alert on bad JSON) AND added "Download
    profile (.json)" (Blob) + "Upload profile" (`<input type=file>` → FileReader →
    normalize → apply).
  - **Settings**: sensitivity/smoothing/aimMin/aimCurve sliders + invertY +
    lockPointerOnClick (legacy ranges). "Reset everything to defaults" behind a
    confirm() → normalized DEFAULT_CONFIG. "saved ✓" flash on every save. Live
    external edits (e.g. popup) reflect via onConfigChanged.
  - **Styling**: legacy dark look via Tailwind utilities + existing `--color-pad-*`
    tokens (bg-pad-bg/-2/-3, text-pad-accent/-muted/-danger, bg-pad-chip,
    border-pad-border); capture state uses amber-* + animate-pulse. NO inline hex,
    no `@apply`/`@import` and no `<style>` blocks. index.html shells got
    `color-scheme: dark`. **No new theme.css tokens appended** — existing palette
    sufficed.
  - **Gate evidence**: `npm run typecheck` → `svelte-check found 0 errors and 0
    warnings` + tsc clean. `npm run test` → `Test Files 9 passed (9) / Tests 64
    passed (64)`. `npm run build` → `✓ built in 972ms`, both pages emitted
    (`dist/src/popup/index.html`, `dist/src/options/index.html`).
    `npm run format:check` → "All matched files use Prettier code style!". Did NOT
    touch core/, storage.ts, content/, build config, or P5's src/ui/hud |
    binds-overlay | shadow.ts. Next: P6 coordinator.

- 2026-06-12: P6 coordinator+capture COMPLETE — all gates green. Decomposed the
  752-line legacy inject.js monolith into the MAIN-world coordinator + DOM capture
  layer, consuming the P1–P5 pure modules + shadow UI. No other phase's files
  touched (manifest still MAIN-world inject + isolated bridge, verified).
  - src/content/inject.ts — thin coordinator, 180 code LOC (216 w/ comments, under
    the <200 LOC target). Responsibilities: (1) __padm0nkInstalled install guard;
    (2) createGamepadState() + config=normalizeConfig(undefined) defaults until the
    bridge posts; asset URLs (iconUrl/bindIconBase/fontUrl) default ""; (3) captures
    navigator.getGamepads?.bind(navigator) then Object.defineProperty's getGamepads
    AND webkitGetGamepads to createGetGamepadsOverride({native,state,isEnabled:()=>
    config.enabled}) (legacy parity, try/catch); (4) rAF loop calls step(config,
    state,now) EVERY frame (smoothing decays to center with no input); (5) mounts
    HUD + overlay via mountHud/mountOverlay (shadow DOM), holding the MountHandles,
    with a one-time remount if a real fontUrl arrives after mount (props otherwise
    update reactively); (6) message bridge listener (e.source===window +
    __padm0nk==="config") re-normalizes config and refreshes URLs guarded so an
    empty payload never wipes them; (7) lifecycle: fireConnect (once-guard, dispatch
    via makeGamepadConnectedEvent(snapshot(state,0))), fireDisconnect, apply (held
    mutate + first-down fireConnect), toggle (flip enabled → resetGamepadState on
    enable; clearInputs+fireDisconnect+exitPointerLock on disable),
    onHelpCombo/closeOverlay driving overlayOpen.
  - src/content/input-capture.ts — all DOM wiring, 261 lines. Exports
    installInputCapture(ctrl): () => void (attach + teardown). Ported 1:1: keyboard
    guards bound in CAPTURE phase on window/document/documentElement/body (+
    DOMContentLoaded for late body), tracked in a Set for clean teardown; keydown
    routes help→toggle→Escape combos BEFORE the enabled gate (so toggle re-enables a
    disabled pad), swallows mapped keys incl. autorepeat, applies only on non-repeat;
    keypress swallow for bound codes. Mouse buttons: isUiEvent short-circuit FIRST
    (click-safety), then enabled gate, then pointer-lock request on any non-UI down
    (!pointerLocked), then bound→apply+swallow. Mouse move accumulates movementX/Y
    only while pointer-locked. Wheel pulses WheelUp/WheelDown (apply true → setTimeout
    60ms apply false) + swallow. contextmenu preventDefault only when enabled &&
    pointerLocked. pointerlockchange tracks pointerLocked locally. blur +
    visibilitychange(hidden) → clearInputs.
  - ctrl interface (coordinator↔capture seam): getConfig(), isBound(id),
    apply(id,down), onToggleCombo(), onHelpCombo(), onEscape(), isUiEvent(e),
    requestPointerLockIfEnabled(), addMouseDelta(dx,dy), clearInputs(). Coordinator
    owns state/config/UI/lifecycle; capture owns pointerLocked + scroll-suppression
    locals.
  - Click-safety preserved: capture calls isPadm0nkUiEvent(e) (composedPath match on
    the shadow hosts' data-padm0nk attr) FIRST in mouse-button handling, so clicking
    the HUD/overlay never binds or pointer-locks — runs before the components' own
    capture-phase stopPropagation (second line of defense).
  - Scroll-suppression dance preserved verbatim: swallow(e) sets blockScrollUntil=
    now+250, preventDefault + stop(Immediate)Propagation, re-pins scroll across
    queueMicrotask + rAF + setTimeout(0); a capture-phase window scroll listener
    records lastAllowedScrollX/Y when not blocking and re-pins while blocking.
    Commented inline so a human can follow it.
  - jsdom test: SKIPPED — jsdom not installed; adding it + flipping vitest's
    environment is a build-config change outside P6's remit. Relied on typecheck +
    build + the manual smoke matrix below.
  - Gate evidence: typecheck → svelte-check 0 errors/0 warnings + tsc clean. test →
    Test Files 9 passed (9) / Tests 64 passed (64). build → ✓ built in 1.05s;
    dist/manifest.json content_scripts confirmed: isolated bridge + "world":"MAIN"
    inject (both run_at:"document_start", all_frames:true); inject bundle
    dist/assets/inject.ts-*.js 34.44 kB (non-trivial — includes shadow UI). format +
    format:check → "All matched files use Prettier code style!".
  - Manual smoke matrix (run after load unpacked on hardwaretester.com/gamepad or
    gamepad-tester.com): 1. loads, no console errors (expect [padm0nk] installed).
    2. Space → pad appears, A lights. 3. WASD → left stick (diagonals radial-clamped
    |v|≤1). 4. Mouse0→RT, Mouse2→LT. 5. click game → pointer lock (NOT on HUD/overlay).
    6. mouse move locked → right stick. 7. F8 toggles ON/OFF (HUD dims off). 8. F9
    opens/closes overlay. 9. Esc closes overlay / releases lock. 10. popup change
    live-updates page. 11. options remap persists + live-updates overlay binds.
  - Human double-check in a real browser: (a) @font-face remount path when a real
    bahnschrift.woff is present (file still not committed — fallback stack in use);
    (b) Escape when overlay closed (onEscape called without swallow so page keeps
    Escape); (c) pointer-lock + contextmenu suppression on xbox.com specifically
    (CSP/composedPath across the play iframe). Next: P7 features / P8 hygiene.

- 2026-06-12: **P8 docs + repo hygiene COMPLETE — gates green.** Docs/hygiene
  polish only; no runtime/build-behavior/src code changed.
  - **README.md** rewritten for the new architecture (playful voice kept;
    "Controller diss" + Disclaimer preserved verbatim). Install from source now
    documents `npm install` → `npm run build` → Load unpacked the **`dist/`**
    folder (not repo root), plus `npm run dev` for HMR. Bindings table verified
    against `controller-actions.ts` defaultInputs (Right click→LT/Mouse2, Left
    click→RT/Mouse0, etc.); toggle/show-binds rows reworded to "configurable
    combo (default F8/F9)". Added a concise Architecture section (TS + Vite/CRXJS
    + Svelte 5 + Tailwind v4, modular core/content/ui, 64 unit tests + CI).
    Packaging switched to `npm run zip`. QoL note added (radial diagonal clamp,
    bundled font, profile import/export, remap conflict warning). No unimplemented
    features documented (per-game profiles / X-Y sensitivity / HUD reposition /
    live aim pad deliberately omitted — not yet implemented).
  - **CHANGELOG.md** created (Keep a Changelog). `[Unreleased]` summarizes the
    rewrite under Added/Changed/Fixed sourced from this Progress log; `[1.0.0]`
    referenced as the prior release.
  - **CI** (`.github/workflows/ci.yml`): reviewed — coherent and correct
    (checkout@v4, setup-node@v4 node 22 + npm cache, `npm ci`, format:check,
    typecheck, test, build, upload-artifact@v4 of dist/). All referenced scripts
    exist in package.json. No change needed.
  - **Packaging**: `scripts/zip.mjs` already zipped `dist/` (not source) but
    emitted a fixed `padm0nk.zip`. Fixed to version the name from package.json →
    `padm0nk-<version>.zip`. `npm run zip` produces `padm0nk-1.0.0.zip`; `unzip -l`
    top level = `manifest.json`, `assets/` (compiled JS + bind-icons SVGs),
    `icons/`, built `src/{popup,options}/index.html` shells — **zero `.ts`/`.svelte`
    source**. Verified via `unzip -l | grep '\.ts$'` → none.
  - **docs/** reviewed: `index.html` + `privacy.html` are general marketing /
    privacy copy with no build/install steps — accurate, left untouched.
  - **Hygiene**: `.gitignore` covers `dist/`, `node_modules/`, `*.zip`, `.local/`;
    `.prettierignore` covers `*.md` + `docs/` (README/CHANGELOG prettier-ignored,
    gate satisfied; ci.yml is not ignored and stays prettier-clean). `git
    status --short` = ` M README.md`, ` M scripts/zip.mjs`, `?? CHANGELOG.md` —
    no stray junk; zip gitignored. Nothing committed (left for human).
  - **Gate evidence**: `npm run format` then `npm run format:check` → "All matched
    files use Prettier code style!". `npm run build` → `✓ built in 1.06s`. Did not
    touch code, so typecheck/test untouched (still 64 green from P6).
```

## Progress log — 2026-06-12 (P6-fix: UI regressions + pointer-lock)

- **controllerUrl wiring (bug 1)**: `OverlayProps` in `src/ui/shadow.ts` extended
  with `controllerUrl`, `iconUrl`, `enabled`. `inject.ts` now captures
  `controllerUrl` from the bridge message and `overlayProps()` passes
  `controllerUrl`, `iconUrl`, `enabled: config.enabled`. The recolored Xbox
  controller art now renders in the overlay center pad-map.
- **Overlay layout rebuild (bug 1)**: `BindsOverlay.svelte` rebuilt to legacy
  3-column fidelity — header (brand orb + title/subtitle + Toggle/Close legends +
  × close), LEFT rail (LT/LB/Left stick/L3/D-pad×4), CENTER pad-map (controller
  art + absolute View/Guide/Menu system-chip row + aim bar), RIGHT rail
  (RT/RB/Right stick info/R3/A/B/X/Y). Rows resolve bound inputs via
  `boundInputs()` → prettyInput join " / " else "UNMAPPED". Tailwind + theme
  tokens (var(--color-pad-*)/rgba for glows/gradients/aspect-744:500/absolute
  positioning). Stacks to 1-col under 900px, center order-first.
- **Pointer-lock fix (bug 3)**: `onHelpCombo()` calls `document.exitPointerLock()`
  (try/catch) when the overlay transitions to OPEN, so the cursor returns and the
  modal is clickable even after the lock-retarget edge case. `requestPointerLock-
  IfEnabled` returns early while `overlayOpen` so clicks inside the modal never
  (re)lock. `isPadm0nkUiEvent` composedPath check remains primary click-safety.
- **HUD icon (bug 2)**: verified — `Hud.svelte` already renders
  `<img src={iconUrl}>` reactively (post-mount bridge update) with the green
  gradient orb bg + grayscale/dim when disabled; fallback "p" only when iconUrl
  is empty. Brand orb also restored in the overlay header. No code bug found.
- **Gates**: typecheck 0 errors/0 warnings · test 64 passed (9 files) ·
  build ✓ in 1.60s · format:check clean. core/storage/mapper/tests untouched.

## Progress log — P6-fix2 (assets + modal UX)
- Root-caused missing assets: CRXJS loads both content scripts via async
  dynamic import, so the bridge's one-shot config postMessage raced the MAIN
  inject listener and was dropped → all asset URLs empty (P/·/blank fallbacks).
  Fix: bidirectional handshake — inject pings `hello` on load + retries
  (0/50/150/400/900ms) until first config; bridge replies on demand AND posts
  immediately (URLs don't depend on storage). Added one-time bridge console
  log of resolved asset URLs for human verification.
- Fixed × dismiss: panel used capture-phase stopPropagation, halting the click
  before it reached the close button. Now backdrop closes only when its own
  element is the target; panel keeps capture-phase mousedown/pointerdown swallow
  for click-safety; × button onclick works.
- Fixed page scroll behind modal: coordinator locks <html>/<body> overflow
  while overlay open (saves/restores prior inline value) + backdrop wheel guard.
- Gates: typecheck 0/0, 64 tests, build ✓.

## Progress log — 2026-06-12 (CSS hygiene + popup polish)
- **Tokens consumed** (added prior in theme.css): colors pad-surface/-2/-hairline/
  -strip, text-2xs, aspect-controller, grid-cols-binds/-field, shadow-pad-*,
  drop-shadow-pad-*, and component classes pad-orb(/-hud), pad-surface,
  pad-hud-bg, pad-panel-bg, pad-card-bg, pad-padmap-bg, pad-strip-bg, pad-aim-bg,
  pad-art-glow, pad-icon-glow.
- **Hud.svelte**: dock grid-cols-[48px_auto]→flex; bg/shadow inline→pad-hud-bg
  (border toggles kept); orb inline gradient→pad-orb-hud; hint rows
  grid-cols-[auto_1fr]→flex+min-w-0; text-[10px]/tracking-[0.14em]→
  text-2xs/tracking-widest; min-width:218px→min-w-56.
- **BindsOverlay.svelte**: panel rounded-3xl/p-[22px]→rounded-lg/p-5, inline
  gradient+shadow→pad-panel-bg, border→border-pad-accent/40; brand orb→pad-orb;
  art/icon drop-shadows→pad-art-glow/pad-icon-glow; rail+chip rows
  grid-cols-[34px_1fr]/[24px_auto]→flex (size-9/shrink-0 icon, pad-surface);
  body grid→grid-cols-binds; aspect-[744/500]→aspect-controller; center→
  pad-card-bg, pad-map→pad-padmap-bg, strip→pad-strip-bg, aim→pad-aim-bg;
  rounded/text/tracking/leading/spacing all mapped to the scale.
- **Options.svelte**: max-w-[760px]→max-w-3xl, px-[22px]→px-5, grid-cols-[140px_1fr]
  →grid-cols-field, tracking-[0.08em]→tracking-widest, text-[13px]→text-sm,
  max-w-[420px]→max-w-md, h-[150px]→h-36, mt-[18px]→mt-4. Zero brackets remain.
- **Popup enhanced**: added branded orb header (pad-orb + icon via getURL +
  ON/OFF echo), prominent enable toggle, slider/behaviour groups on bg-pad-surface
  cards with live values, footer (Advanced…/Reset) + combo hints. w-[280px]→w-70,
  text-[13px]→text-sm, w-[42px]→w-10. Config/registry-driven; no new config keys.
- **Sweep proof**: only whitelisted viewport brackets remain — Hud
  max-w-[min(320px,calc(100vw-24px))]; BindsOverlay max-h-[calc(100vh-32px)] +
  w-[min(1040px,calc(100vw-32px))]. Options + Popup: zero.
- **Gates**: typecheck 0/0 · 64 tests pass · build ✓ (1.41s) · format:check clean.
  core/storage/mapper/tests untouched.

## Space/UI "select" regression — ROOT CAUSE (2026-06-12)

**Symptom:** In the xCloud UI/dashboard/guide, pressing a bound key (e.g. Space→A)
did not "select"; instead People opened and the page scrolled. In-game it worked.
Existed in refactor only — legacy worked on Chrome.

**Not** the keyboard: console diag proved Space is `SUPPRESS+apply` (our capture
runs and swallows). **Not** xbox-specific: reproduced with Better-xCloud removed
(logs are xbox.com's own `[GamepadNavigation]`). Live pad dump showed only correct
single button indices flip; axes 2/3 (right stick) swing from mouse = dashboard
scroll (expected — right stick scrolls the dashboard).

**Cause:** `snapshot()` in `src/core/gamepad-state.ts` reused/mutated ONE cached
Gamepad + buttons + button objects across every `getGamepads()` call (an earlier
"Bug 5 perf" optimization). xCloud's `GamepadNavigation` edge-detects a press by
caching the previous poll's button objects and comparing
`cur.buttons[i].pressed && !prev.buttons[i].pressed`. With reuse, `cur` and `prev`
alias the same objects → `x && !x` → edge never fires → A/select silently dead in
the UI. Legacy allocated fresh objects per call (W3C contract), so it worked.

**Fix:** `snapshot()` now allocates a fresh Gamepad/buttons/button-wrappers/axes
graph every call (matches legacy + real browsers). Per-frame GC of a few small
objects is negligible vs correct edge detection. Tests flipped: the old
`expect(a).toBe(b)` reuse assertions replaced with fresh-snapshot + press-edge
regression guards (gamepad-state + gamepad-api). Temp keydown diag removed.

// padm0nk inject.js — runs in the page's MAIN world at document_start.
// Overrides the Gamepad API so xCloud (and gamepad testers) see a virtual
// Xbox controller driven by keyboard + mouse. No drivers, no native code.
(() => {
	if (window.__padm0nkInstalled) return;
	window.__padm0nkInstalled = true;

	// ---- Standard gamepad layout (W3C "standard" mapping) ----
	// buttons: 0 A,1 B,2 X,3 Y,4 LB,5 RB,6 LT,7 RT,8 View,9 Menu,
	//          10 L3,11 R3,12 DpadUp,13 DpadDown,14 DpadLeft,15 DpadRight,16 Guide
	// axes:    0 LX,1 LY,2 RX,3 RY   (Y: up = -1, down = +1)
	const BUTTON_COUNT = 17;
	const AXIS_COUNT = 4;

	// ---- Default configuration ----
	// A binding maps an input id to an action.
	//   button action: { t: "b", i: <buttonIndex> }
	//   axis action:   { t: "a", a: <axisIndex>, v: <-1|+1> }
	// Input ids: KeyboardEvent.code, or "Mouse0/1/2" (L/M/R), "WheelUp/WheelDown".
	const DEFAULT_CONFIG = {
		enabled: true,
		sensitivity: 0.018, // mouse pixels -> right-stick deflection
		smoothing: 0.25, // 0 = instant/jittery, ->1 = smooth/laggy
		aimMin: 0.12, // minimum non-zero stick output; clears game deadzones
		aimCurve: 0.75, // <1 boosts fine motion, 1 linear, >1 slower start
		invertY: false,
		lockPointerOnClick: true,
		toggleKey: "F8", // legacy single-key toggle; kept for old profiles
		toggleCombo: {
			code: "F8",
			ctrl: false,
			alt: false,
			shift: false,
			meta: false,
		},
		helpCombo: {
			code: "F9",
			ctrl: false,
			alt: false,
			shift: false,
			meta: false,
		},
		bindings: {
			// left stick (movement)
			KeyW: { t: "a", a: 1, v: -1 },
			KeyS: { t: "a", a: 1, v: 1 },
			KeyA: { t: "a", a: 0, v: -1 },
			KeyD: { t: "a", a: 0, v: 1 },
			// face buttons
			Space: { t: "b", i: 0 }, // A — jump
			ControlLeft: { t: "b", i: 1 }, // B — crouch
			KeyR: { t: "b", i: 2 }, // X — reload
			KeyF: { t: "b", i: 3 }, // Y — use/melee
			// bumpers
			KeyQ: { t: "b", i: 4 }, // LB
			KeyE: { t: "b", i: 5 }, // RB
			// triggers (mouse)
			Mouse2: { t: "b", i: 6 }, // LT — aim (right click)
			Mouse0: { t: "b", i: 7 }, // RT — fire (left click)
			// sticks click
			ShiftLeft: { t: "b", i: 10 }, // L3 — sprint
			KeyC: { t: "b", i: 11 }, // R3 — melee/crouch toggle
			// menu
			Tab: { t: "b", i: 8 }, // View
			Enter: { t: "b", i: 9 }, // Menu
			Backquote: { t: "b", i: 16 }, // Guide
			// dpad
			ArrowUp: { t: "b", i: 12 },
			ArrowDown: { t: "b", i: 13 },
			ArrowLeft: { t: "b", i: 14 },
			ArrowRight: { t: "b", i: 15 },
			Digit1: { t: "b", i: 12 },
			Digit2: { t: "b", i: 13 },
			Digit3: { t: "b", i: 14 },
			Digit4: { t: "b", i: 15 },
		},
	};

	let config = structuredClone(DEFAULT_CONFIG);

	// ---- Live virtual-pad state ----
	const state = {
		connected: false,
		buttons: new Array(BUTTON_COUNT).fill(0), // analog 0..1
		axes: new Float64Array(AXIS_COUNT), // -1..1
		timestamp: 0,
	};
	const held = new Set(); // input ids currently pressed
	let mouseDX = 0,
		mouseDY = 0;
	let pointerLocked = false;
	let blockScrollUntil = 0;
	let lastAllowedScrollX = window.scrollX;
	let lastAllowedScrollY = window.scrollY;

	const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

	function aimResponse(raw) {
		const value = clamp(raw, -1, 1);
		const magnitude = Math.abs(value);
		if (magnitude === 0) return 0;
		const min = clamp(config.aimMin ?? 0.12, 0, 0.5);
		const curve = clamp(config.aimCurve ?? 0.75, 0.25, 2);
		const shaped = magnitude ** curve;
		return Math.sign(value) * clamp(min + (1 - min) * shaped, 0, 1);
	}

	function restoreScroll() {
		if (performance.now() <= blockScrollUntil) {
			window.scrollTo(lastAllowedScrollX, lastAllowedScrollY);
		}
	}

	function swallow(e) {
		blockScrollUntil = performance.now() + 250;
		e.preventDefault();
		e.stopPropagation();
		if (e.stopImmediatePropagation) e.stopImmediatePropagation();
		queueMicrotask(restoreScroll);
		requestAnimationFrame(restoreScroll);
		setTimeout(restoreScroll, 0);
	}

	function currentToggleCombo() {
		return (
			config.toggleCombo || {
				code: config.toggleKey || "F8",
				ctrl: false,
				alt: false,
				shift: false,
				meta: false,
			}
		);
	}

	function currentHelpCombo() {
		return (
			config.helpCombo || {
				code: "F9",
				ctrl: false,
				alt: false,
				shift: false,
				meta: false,
			}
		);
	}

	function comboMatches(e, combo) {
		return (
			e.code === combo.code &&
			Boolean(e.ctrlKey) === Boolean(combo.ctrl) &&
			Boolean(e.altKey) === Boolean(combo.alt) &&
			Boolean(e.shiftKey) === Boolean(combo.shift) &&
			Boolean(e.metaKey) === Boolean(combo.meta)
		);
	}

	function comboLabel(combo) {
		const parts = [];
		if (combo.ctrl) parts.push("Ctrl");
		if (combo.alt) parts.push("Alt");
		if (combo.shift) parts.push("Shift");
		if (combo.meta) parts.push("Meta");
		parts.push(combo.code.replace(/^Key/, "").replace(/^Digit/, ""));
		return parts.join("+");
	}

	// ---- Build a spec-shaped Gamepad snapshot on demand ----
	function snapshot(index = 0) {
		return {
			id: "padm0nk Virtual Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)",
			index,
			connected: state.connected,
			mapping: "standard",
			timestamp: state.timestamp,
			axes: Array.from(state.axes),
			buttons: state.buttons.map((v) => ({
				pressed: v > 0.5,
				touched: v > 0.0,
				value: v,
			})),
			vibrationActuator: {
				type: "dual-rumble",
				playEffect: () => Promise.resolve("complete"),
				reset: () => Promise.resolve("complete"),
			},
		};
	}

	// ---- Gamepad API override ----
	const nativeGetGamepads =
		(navigator.getGamepads && navigator.getGamepads.bind(navigator)) || null;

	function getGamepadsOverride() {
		const real = nativeGetGamepads ? Array.from(nativeGetGamepads()) : [];
		if (!config.enabled || !state.connected) {
			// pass through real controllers untouched
			return real;
		}
		// place our virtual pad in the first empty slot so a real controller at
		// index 0 is not clobbered; report that slot as the pad's index.
		const out = real.slice();
		let slot = out.findIndex((g) => g == null);
		if (slot === -1) slot = out.length;
		out[slot] = snapshot(slot);
		return out;
	}

	try {
		Object.defineProperty(navigator, "getGamepads", {
			configurable: true,
			enumerable: true,
			value: getGamepadsOverride,
		});
		// some engines reference webkitGetGamepads
		Object.defineProperty(navigator, "webkitGetGamepads", {
			configurable: true,
			enumerable: true,
			value: getGamepadsOverride,
		});
	} catch (e) {
		console.warn("[padm0nk] failed to override getGamepads", e);
	}

	function fireConnect() {
		if (state.connected) return;
		state.connected = true;
		state.timestamp = performance.now();
		try {
			window.dispatchEvent(
				new GamepadEvent("gamepadconnected", { gamepad: snapshot() }),
			);
		} catch {
			const ev = new Event("gamepadconnected");
			ev.gamepad = snapshot();
			window.dispatchEvent(ev);
		}
		hud();
		renderHelp();
	}

	function fireDisconnect() {
		if (!state.connected) return;
		const gp = snapshot();
		state.connected = false;
		try {
			window.dispatchEvent(
				new GamepadEvent("gamepaddisconnected", { gamepad: gp }),
			);
		} catch {
			const ev = new Event("gamepaddisconnected");
			ev.gamepad = gp;
			window.dispatchEvent(ev);
		}
		hud();
	}

	// ---- Input capture ----
	function apply(id, down) {
		const b = config.bindings[id];
		if (!b) return false;
		if (down) held.add(id);
		else held.delete(id);
		// first real input connects the pad so the page registers it
		if (down) fireConnect();
		return true;
	}

	function onKey(e, down) {
		if (down && !e.repeat && comboMatches(e, currentHelpCombo())) {
			toggleHelp();
			swallow(e);
			return;
		}
		if (down && !e.repeat && comboMatches(e, currentToggleCombo())) {
			toggle();
			swallow(e);
			return;
		}
		if (down && e.code === "Escape" && helpEl) {
			closeHelp();
			swallow(e);
			return;
		}
		if (!config.enabled) return;
		const mapped = !!config.bindings[e.code];
		if (mapped) {
			// Always swallow mapped keys, including repeat keydowns. This prevents
			// Space from scrolling / PageDown-ing while also acting as Xbox A.
			swallow(e);
		}
		if (e.repeat) return;
		if (mapped) apply(e.code, down);
	}

	function onMouseButton(e, down) {
		if (!config.enabled) return;
		const path = typeof e.composedPath === "function" ? e.composedPath() : [];
		if (path.includes(hudEl) || path.includes(helpEl)) return;
		const id = "Mouse" + e.button;
		if (config.lockPointerOnClick && down && !pointerLocked) {
			const el = document.documentElement;
			if (el && el.requestPointerLock) {
				try {
					el.requestPointerLock();
				} catch {}
			}
		}
		if (apply(id, down)) {
			swallow(e);
		}
	}

	function onMouseMove(e) {
		if (!config.enabled) return;
		// only steer when pointer is locked, otherwise the OS cursor is in charge
		if (!pointerLocked) return;
		mouseDX += e.movementX || 0;
		mouseDY += e.movementY || 0;
	}

	function onWheel(e) {
		if (!config.enabled) return;
		const id = e.deltaY < 0 ? "WheelUp" : "WheelDown";
		if (config.bindings[id]) {
			apply(id, true);
			setTimeout(() => apply(id, false), 60); // pulse
			swallow(e);
		}
	}

	function onPointerLockChange() {
		pointerLocked = document.pointerLockElement != null;
		hud();
	}

	function onKeyPress(e) {
		if (!config.enabled) return;
		const code = e.code || (e.key === " " ? "Space" : "");
		if (code && config.bindings[code]) {
			// Some browsers/pages scroll on keypress instead of keydown.
			swallow(e);
		}
	}

	function bindKeyboardGuards(target) {
		if (!target || target.__padm0nkKeyboardGuards) return;
		target.__padm0nkKeyboardGuards = true;
		target.addEventListener("keydown", (e) => onKey(e, true), true);
		target.addEventListener("keypress", onKeyPress, true);
		target.addEventListener("keyup", (e) => onKey(e, false), true);
	}

	function bindBodyKeyboardGuards() {
		bindKeyboardGuards(document.documentElement);
		bindKeyboardGuards(document.body);
	}

	// capture phase so we beat the page's own handlers. Bind at multiple DOM
	// levels because Space scroll can be attached to body/document by sites.
	bindKeyboardGuards(window);
	bindKeyboardGuards(document);
	bindBodyKeyboardGuards();
	if (!document.body) {
		document.addEventListener("DOMContentLoaded", bindBodyKeyboardGuards, {
			once: true,
		});
	}
	window.addEventListener(
		"scroll",
		() => {
			if (performance.now() <= blockScrollUntil) {
				restoreScroll();
				return;
			}
			lastAllowedScrollX = window.scrollX;
			lastAllowedScrollY = window.scrollY;
		},
		true,
	);
	window.addEventListener("mousedown", (e) => onMouseButton(e, true), true);
	window.addEventListener("mouseup", (e) => onMouseButton(e, false), true);
	window.addEventListener("mousemove", onMouseMove, true);
	window.addEventListener("wheel", onWheel, { capture: true, passive: false });
	window.addEventListener(
		"contextmenu",
		(e) => {
			if (config.enabled && pointerLocked) e.preventDefault();
		},
		true,
	);
	document.addEventListener("pointerlockchange", onPointerLockChange, true);

	// Clear held inputs + mouse delta when focus/visibility is lost, so keys/sticks
	// don't get stuck (e.g. Alt-Tab while holding W or a mouse button — the keyup
	// fires outside the page and never reaches us).
	function clearInputs() {
		held.clear();
		mouseDX = 0;
		mouseDY = 0;
	}
	window.addEventListener("blur", clearInputs, true);
	document.addEventListener(
		"visibilitychange",
		() => {
			if (document.visibilityState === "hidden") clearInputs();
		},
		true,
	);

	// ---- Mapping tick: resolve held inputs + mouse delta into pad state ----
	function tick() {
		if (config.enabled) {
			// reset
			state.buttons.fill(0);
			const ax = new Float64Array(AXIS_COUNT);

			for (const id of held) {
				const b = config.bindings[id];
				if (!b) continue;
				if (b.t === "b") state.buttons[b.i] = 1;
				else if (b.t === "a") ax[b.a] += b.v;
			}
			// left stick from keys (clamp diagonal)
			ax[0] = clamp(ax[0], -1, 1);
			ax[1] = clamp(ax[1], -1, 1);

			// right stick from mouse delta. aimResponse lifts tiny deltas above
			// in-game stick deadzones so slow mouse movement still moves crosshair.
			const rxTarget = aimResponse(mouseDX * config.sensitivity);
			const ryTarget = aimResponse(
				mouseDY * config.sensitivity * (config.invertY ? -1 : 1),
			);
			mouseDX = 0;
			mouseDY = 0;
			const s = clamp(config.smoothing, 0, 0.95);
			ax[2] = ax[2] * 0 + (state.axes[2] * s + rxTarget * (1 - s));
			ax[3] = ax[3] * 0 + (state.axes[3] * s + ryTarget * (1 - s));
			// snap tiny residue to zero so the stick truly recenters
			if (Math.abs(ax[2]) < 0.005) ax[2] = 0;
			if (Math.abs(ax[3]) < 0.005) ax[3] = 0;

			state.axes = ax;
			state.timestamp = performance.now();
		}
		requestAnimationFrame(tick);
	}
	requestAnimationFrame(tick);

	// ---- HUD + help overlay ----
	let hudEl = null;
	let helpEl = null;
	let controllerUrl = "";
	let iconUrl = "";
	let bindIconBase = "";
	function hud() {
		if (!document.body) return;
		injectHelpFont();
		if (!hudEl) {
			hudEl = document.createElement("div");
			hudEl.style.cssText =
				"position:fixed;left:12px;bottom:12px;z-index:2147483647;" +
				"pointer-events:auto;user-select:none;" +
				"font:600 13px/1.25 'Padm0nk Bahnschrift','Bahnschrift Semibold',Bahnschrift,'Segoe UI',SegoeUI,'Helvetica Neue',Helvetica,Arial,sans-serif;";
			hudEl.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
			hudEl.addEventListener("mousedown", (e) => e.stopPropagation(), true);
			hudEl.addEventListener("mouseup", (e) => e.stopPropagation(), true);
			hudEl.addEventListener("click", (e) => e.stopPropagation(), true);
			document.body.appendChild(hudEl);
		}
		const stateClass = config.enabled ? "is-on" : "is-off";
		const lockText = pointerLocked ? "Aim locked" : "Click game to lock aim";
		hudEl.className = `padm0nk-hud ${stateClass}`;
		hudEl.innerHTML = `
			<div class="padm0nk-hud-status">
				${brandIcon("padm0nk-hud-icon")}
				<div class="padm0nk-hud-state">${config.enabled ? "ON" : "OFF"}</div>
			</div>
			<div class="padm0nk-hud-copy">
				<div class="padm0nk-hud-line"><b>${comboLabel(currentToggleCombo())}</b><span>toggle</span></div>
				<div class="padm0nk-hud-line"><b>${comboLabel(currentHelpCombo())}</b><span>binds</span></div>
				<div class="padm0nk-hud-line muted"><b>Esc</b><span>${lockText}</span></div>
			</div>`;
	}


	function prettyInput(id) {
		if (id === "Mouse0") return "Left Click";
		if (id === "Mouse1") return "Middle Click";
		if (id === "Mouse2") return "Right Click";
		if (id === "WheelUp") return "Wheel ↑";
		if (id === "WheelDown") return "Wheel ↓";
		if (id.startsWith("Key")) return id.slice(3);
		if (id.startsWith("Digit")) return id.slice(5);
		if (id.startsWith("Arrow")) return id.slice(5) + " Arrow";
		return id
			.replace("ControlLeft", "L-Ctrl")
			.replace("ControlRight", "R-Ctrl")
			.replace("ShiftLeft", "L-Shift")
			.replace("ShiftRight", "R-Shift")
			.replace("AltLeft", "L-Alt")
			.replace("AltRight", "R-Alt")
			.replace("Backquote", "` (tilde)");
	}

	function inputsForAction(action) {
		return (
			Object.keys(config.bindings || {})
				.filter((id) => {
					const b = config.bindings[id];
					return (
						b &&
						b.t === action.t &&
						(action.t === "b"
							? b.i === action.i
							: b.a === action.a && b.v === action.v)
					);
				})
				.map(prettyInput)
				.join(" / ") || "—"
		);
	}

	function bindingText(action) {
		const text = inputsForAction(action);
		return text === "—" ? "UNMAPPED" : text;
	}

	function injectHelpFont() {
		if (document.getElementById("padm0nk-help-font")) return;
		const style = document.createElement("style");
		style.id = "padm0nk-help-font";
		style.textContent = `
@font-face {
	font-family: "Padm0nk Bahnschrift";
	font-style: normal;
	font-weight: 600;
	font-stretch: normal;
	src: url("https://assets.play.xbox.com/playxbox/static/media/Bahnschrift.30b0e116.woff") format("woff");
}
.padm0nk-help,.padm0nk-help *,.padm0nk-hud,.padm0nk-hud *{box-sizing:border-box}
.padm0nk-help-header{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px}.padm0nk-help-brand{display:flex;align-items:center;gap:14px}.padm0nk-help-orb{display:grid;place-items:center;width:48px;height:48px;border-radius:16px;background:linear-gradient(145deg,rgba(16,124,16,.88),rgba(5,36,12,.9));box-shadow:0 0 24px rgba(16,124,16,.56),inset 0 0 18px rgba(255,255,255,.12);overflow:hidden}.padm0nk-help-orb-img{width:38px;height:38px;object-fit:contain;display:block;filter:drop-shadow(0 1px 1px rgba(0,0,0,.6))}.is-off .padm0nk-help-orb-img{filter:grayscale(1);opacity:.58}.padm0nk-help-title{font-size:28px;letter-spacing:.02em;text-transform:uppercase}.padm0nk-help-subtitle{margin-top:3px;color:#9fef7f;font-size:13px;text-transform:uppercase}.is-off .padm0nk-help-subtitle{color:#aeb6be}.padm0nk-help-controls{display:grid;grid-template-columns:1fr 1fr;gap:10px;min-width:260px}.padm0nk-help-legend{padding:9px 11px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.045)}.padm0nk-help-legend-label{display:block;color:#9ba7b4;font-size:11px;text-transform:uppercase}.padm0nk-help-legend-value{display:block;color:#fff;font-size:14px}
.padm0nk-help-body{display:grid;grid-template-columns:minmax(180px,.75fr) minmax(410px,1.5fr) minmax(180px,.75fr);gap:18px;align-items:stretch}.padm0nk-help-rail{display:grid;align-content:start;gap:9px}.padm0nk-help-rail-title{color:#9fef7f;font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin:1px 0 3px}.padm0nk-help-row{display:grid;grid-template-columns:34px 1fr;gap:10px;align-items:center;min-height:44px;padding:7px 9px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:rgba(255,255,255,.045)}.padm0nk-help-row-icon{display:grid;place-items:center;width:34px;height:34px}.padm0nk-help-row-icon img{max-width:30px;max-height:30px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))}.padm0nk-help-row-label{display:block;color:#9ba7b4;font-size:10px;letter-spacing:.09em;text-transform:uppercase}.padm0nk-help-row-key{display:block;color:#fff;font-size:14px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.padm0nk-help-row.dpad-row .padm0nk-help-row-key{font-size:13px}.padm0nk-help-center{min-width:0;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:22px;background:radial-gradient(circle at 50% 18%,rgba(16,124,16,.22),transparent 42%),rgba(255,255,255,.035)}.padm0nk-help-pad-map{position:relative;aspect-ratio:744/500;width:100%;border-radius:18px;overflow:hidden;background:radial-gradient(circle at 50% 42%,rgba(16,124,16,.25),transparent 48%)}.padm0nk-help-system-row{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:flex;gap:8px;padding:7px;border:1px solid rgba(159,239,127,.18);border-radius:16px;background:rgba(5,9,12,.72);backdrop-filter:blur(10px);box-shadow:0 12px 28px rgba(0,0,0,.34)}.padm0nk-help-system-chip{display:grid;grid-template-columns:24px auto;align-items:center;gap:7px;min-width:94px;padding:5px 8px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:rgba(255,255,255,.045)}.padm0nk-help-system-chip img{width:22px;height:22px;object-fit:contain}.padm0nk-help-system-chip span{display:block;color:#9ba7b4;font-size:9px;letter-spacing:.09em;text-transform:uppercase}.padm0nk-help-system-chip b{display:block;color:#fff;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.padm0nk-help-controller-art{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 18px 28px rgba(0,0,0,.55)) drop-shadow(0 0 18px rgba(16,124,16,.24))}.padm0nk-help-aim{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:10px 12px;border-radius:14px;background:rgba(16,124,16,.18);border:1px solid rgba(135,255,93,.19)}.padm0nk-help-aim-label{color:#9fef7f;text-transform:uppercase;font-size:12px}.padm0nk-help-aim-value{color:#fff;text-align:right}
.padm0nk-hud{display:inline-grid;grid-template-columns:48px auto;align-items:center;column-gap:9px;min-width:218px;max-width:min(320px,calc(100vw - 24px));padding:7px 11px 7px 8px;border:1px solid rgba(135,255,93,.34);border-radius:20px;background:linear-gradient(135deg,rgba(15,19,22,.94),rgba(5,8,10,.94));box-shadow:0 14px 40px rgba(0,0,0,.45),0 0 26px rgba(16,124,16,.16);backdrop-filter:blur(14px);color:#fff}.padm0nk-hud-status{display:grid;justify-items:center;gap:2px;min-width:48px}.padm0nk-hud-icon{width:34px;height:34px;border-radius:12px;object-fit:contain;padding:4px;background:linear-gradient(145deg,rgba(16,124,16,.78),rgba(4,34,10,.88));box-shadow:0 0 18px rgba(16,124,16,.55),inset 0 0 12px rgba(255,255,255,.11);filter:drop-shadow(0 1px 1px rgba(0,0,0,.7))}.padm0nk-hud-state{font-size:10px;letter-spacing:.14em;color:#9fef7f}.padm0nk-hud-copy{display:grid;gap:2px;min-width:0}.padm0nk-hud-line{display:grid;grid-template-columns:28px 1fr;gap:5px;align-items:center}.padm0nk-hud-line b{justify-self:start;width:28px;color:#9fef7f;font-size:12px;text-align:left}.padm0nk-hud-line span{color:#e8f1ea;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.padm0nk-hud-line.muted span,.padm0nk-hud-line.muted b{color:#9ba7b4}.padm0nk-hud.is-off{border-color:rgba(160,170,180,.28);box-shadow:0 14px 40px rgba(0,0,0,.45)}.padm0nk-hud.is-off .padm0nk-hud-icon{background:#3a3f46;box-shadow:inset 0 0 12px rgba(255,255,255,.08);filter:grayscale(1);opacity:.58}.padm0nk-hud.is-off .padm0nk-hud-state{color:#aeb6be}
@media (max-width:900px){.padm0nk-help-header{align-items:flex-start;flex-direction:column}.padm0nk-help-controls{width:100%;grid-template-columns:1fr}.padm0nk-help-body{grid-template-columns:1fr}.padm0nk-help-center{order:-1}.padm0nk-help-rail{grid-template-columns:1fr 1fr}.padm0nk-help-rail-title{grid-column:1/-1}}
`;
		(document.head || document.documentElement).appendChild(style);
	}

	function makeEl(tag, className, text) {
		const el = document.createElement(tag);
		if (className) el.className = className;
		if (text != null) el.textContent = text;
		return el;
	}

	function addLegend(parent, label, value) {
		const item = makeEl("div", "padm0nk-help-legend");
		item.append(makeEl("span", "padm0nk-help-legend-label", label));
		item.append(makeEl("span", "padm0nk-help-legend-value", value));
		parent.appendChild(item);
	}

	function htmlEscape(value) {
		return String(value)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	function htmlBind(action) {
		return htmlEscape(bindingText(action));
	}

	function brandIcon(className) {
		const src = iconUrl ? htmlEscape(iconUrl) : "";
		return src
			? `<img class="${className}" src="${src}" alt="padm0nk" />`
			: `<span class="${className} is-empty" aria-label="padm0nk"></span>`;
	}

	function bindIcon(file, label) {
		const src = bindIconBase ? htmlEscape(bindIconBase + file) : "";
		return src ? `<img src="${src}" alt="${htmlEscape(label)}" />` : htmlEscape(label);
	}

	function bindRow(icon, label, action, className = "") {
		return `
			<div class="padm0nk-help-row ${className}">
				<div class="padm0nk-help-row-icon">${bindIcon(icon, label)}</div>
				<div>
					<span class="padm0nk-help-row-label">${htmlEscape(label)}</span>
					<span class="padm0nk-help-row-key">${htmlBind(action)}</span>
				</div>
			</div>`;
	}

	function bindInfoRow(icon, label, value, className = "") {
		return `
			<div class="padm0nk-help-row ${className}">
				<div class="padm0nk-help-row-icon">${bindIcon(icon, label)}</div>
				<div>
					<span class="padm0nk-help-row-label">${htmlEscape(label)}</span>
					<span class="padm0nk-help-row-key">${htmlEscape(value)}</span>
				</div>
			</div>`;
	}

	function systemChip(icon, label, action) {
		return `
			<div class="padm0nk-help-system-chip">
				${bindIcon(icon, label)}
				<div><span>${htmlEscape(label)}</span><b>${htmlBind(action)}</b></div>
			</div>`;
	}

	function controllerArt() {
		const art = htmlEscape(
			controllerUrl ||
				"https://upload.wikimedia.org/wikipedia/commons/1/1b/Xbox_Controller.svg",
		);
		return `
			<div class="padm0nk-help-pad-map" aria-label="Xbox controller">
				<img class="padm0nk-help-controller-art" src="${art}" alt="Xbox controller" />
				<div class="padm0nk-help-system-row">
					${systemChip("view.svg", "View", { t: "b", i: 8 })}
					${systemChip("guide.svg", "Guide", { t: "b", i: 16 })}
					${systemChip("menu.svg", "Menu", { t: "b", i: 9 })}
				</div>
			</div>`;
	}

	function renderHelp() {
		if (!helpEl) return;
		helpEl.replaceChildren();
		helpEl.className = `padm0nk-help ${config.enabled ? "is-on" : "is-off"}`;

		const header = makeEl("div", "padm0nk-help-header");
		const brand = makeEl("div", "padm0nk-help-brand");
		const orb = makeEl("span", "padm0nk-help-orb");
		orb.innerHTML = brandIcon("padm0nk-help-orb-img");
		const copy = makeEl("div");
		copy.append(makeEl("div", "padm0nk-help-title", "padm0nk binds"));
		copy.append(makeEl("div", "padm0nk-help-subtitle", config.enabled ? "Virtual Xbox pad online" : "padm0nk disabled"));
		brand.append(orb, copy);
		header.append(brand);

		const controls = makeEl("div", "padm0nk-help-controls");
		addLegend(controls, "Toggle", comboLabel(currentToggleCombo()));
		addLegend(controls, "Close", `${comboLabel(currentHelpCombo())} / Esc`);
		header.append(controls);
		helpEl.appendChild(header);

		const body = makeEl("div", "padm0nk-help-body");
		const left = makeEl("div", "padm0nk-help-rail");
		left.innerHTML = `
			<div class="padm0nk-help-rail-title">Left side</div>
			${bindRow("left-trigger.svg", "LT", { t: "b", i: 6 })}
			${bindRow("left-bumper.svg", "LB", { t: "b", i: 4 })}
			${bindRow("left-stick.svg", "Left stick", { t: "a", a: 1, v: -1 })}
			${bindRow("left-stick-press.svg", "L3", { t: "b", i: 10 })}
			${bindRow("dpad-up.svg", "D-pad up", { t: "b", i: 12 }, "dpad-row")}
			${bindRow("dpad-down.svg", "D-pad down", { t: "b", i: 13 }, "dpad-row")}
			${bindRow("dpad-left.svg", "D-pad left", { t: "b", i: 14 }, "dpad-row")}
			${bindRow("dpad-right.svg", "D-pad right", { t: "b", i: 15 }, "dpad-row")}`;

		const center = makeEl("div", "padm0nk-help-center");
		center.innerHTML = controllerArt();
		const aim = makeEl("div", "padm0nk-help-aim");
		aim.append(makeEl("span", "padm0nk-help-aim-label", "Right stick aim"));
		aim.append(makeEl("span", "padm0nk-help-aim-value", "Mouse movement while pointer locked"));
		center.appendChild(aim);

		const right = makeEl("div", "padm0nk-help-rail");
		right.innerHTML = `
			<div class="padm0nk-help-rail-title">Right side</div>
			${bindRow("right-trigger.svg", "RT", { t: "b", i: 7 })}
			${bindRow("right-bumper.svg", "RB", { t: "b", i: 5 })}
			${bindInfoRow("right-stick.svg", "Right stick", "Mouse move")}
			${bindRow("right-stick-press.svg", "R3", { t: "b", i: 11 })}
			${bindRow("a.svg", "A", { t: "b", i: 0 })}
			${bindRow("b.svg", "B", { t: "b", i: 1 })}
			${bindRow("x.svg", "X", { t: "b", i: 2 })}
			${bindRow("y.svg", "Y", { t: "b", i: 3 })}`;

		body.append(left, center, right);
		helpEl.appendChild(body);
	}

	function closeHelp() {
		if (!helpEl) return;
		helpEl.remove();
		helpEl = null;
	}

	function toggleHelp() {
		if (helpEl) {
			closeHelp();
			return;
		}
		if (!document.body) return;
		injectHelpFont();
		helpEl = document.createElement("div");
		helpEl.style.cssText =
			"position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;" +
			"width:min(1040px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;" +
			"box-sizing:border-box;color:#f4fff2;background:linear-gradient(145deg,rgba(16,20,22,.96),rgba(8,10,13,.96));" +
			"border:1px solid rgba(135,255,93,.38);border-radius:24px;padding:22px;box-shadow:0 28px 90px rgba(0,0,0,.62),0 0 42px rgba(16,124,16,.18);" +
			"backdrop-filter:blur(18px);pointer-events:none;font:600 15px/1.35 'Padm0nk Bahnschrift','Bahnschrift Semibold',Bahnschrift,'Segoe UI',SegoeUI,'Helvetica Neue',Helvetica,Arial,sans-serif;" +
			"letter-spacing:.01em";

		document.body.appendChild(helpEl);
		renderHelp();
	}

	function toggle() {
		config.enabled = !config.enabled;
		if (config.enabled) {
			// clear any stale deflection so re-enable doesn't emit one stale frame
			state.buttons.fill(0);
			state.axes = new Float64Array(AXIS_COUNT);
			clearInputs();
		} else {
			clearInputs();
			fireDisconnect();
			if (document.pointerLockElement) document.exitPointerLock();
		}
		hud();
		renderHelp();
	}

	// ---- Config bridge (from isolated content script / popup) ----
	window.addEventListener("message", (e) => {
		if (e.source !== window) return;
		const d = e.data;
		if (!d || d.__padm0nk !== "config") return;
		if (d.controllerUrl) controllerUrl = d.controllerUrl;
		if (d.iconUrl) iconUrl = d.iconUrl;
		if (d.bindIconBase) bindIconBase = d.bindIconBase;
		config = Object.assign(structuredClone(DEFAULT_CONFIG), d.config || {});
		if (d.config && d.config.bindings) config.bindings = d.config.bindings;
		hud();
		renderHelp();
	});

	// build HUD once DOM exists
	if (document.body) hud();
	else document.addEventListener("DOMContentLoaded", hud, { once: true });

	console.log("[padm0nk] installed — keyboard+mouse → virtual Xbox controller");
})();

// PadKey inject.js — runs in the page's MAIN world at document_start.
// Overrides the Gamepad API so xCloud (and gamepad testers) see a virtual
// Xbox controller driven by keyboard + mouse. No drivers, no native code.
(() => {
	if (window.__padkeyInstalled) return;
	window.__padkeyInstalled = true;

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
	function snapshot() {
		return {
			id: "PadKey Virtual Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)",
			index: 0,
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
		// place our virtual pad at index 0, keep any real pads after it
		const out = real.slice();
		out[0] = snapshot();
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
		console.warn("[PadKey] failed to override getGamepads", e);
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
		if (!target || target.__padkeyKeyboardGuards) return;
		target.__padkeyKeyboardGuards = true;
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
	const helpEl = null;
	function hud() {
		if (!document.body) return;
		if (!hudEl) {
			hudEl = document.createElement("div");
			hudEl.style.cssText =
				"position:fixed;left:10px;bottom:10px;z-index:2147483647;font:12px/1.4 ui-monospace,monospace;" +
				"background:rgba(16,16,20,.82);color:#9fef7f;padding:6px 9px;border-radius:7px;" +
				"pointer-events:none;white-space:pre;backdrop-filter:blur(4px);border:1px solid rgba(159,239,127,.25)";
			document.body.appendChild(hudEl);
		}
		hudEl.style.color = config.enabled ? "#9fef7f" : "#888";
		hudEl.textContent =
			`PadKey ${config.enabled ? "ON" : "OFF"}  ·  aim ${pointerLocked ? "LOCKED" : "click to lock"}\n` +
			`${comboLabel(currentToggleCombo())} toggle · ${comboLabel(currentHelpCombo())} binds · Esc release mouse`;
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

	function helpLine(label, icon, action) {
		return `${icon}  ${label.padEnd(13)} ${inputsForAction(action)}`;
	}

	function helpText() {
		return [
			"🎮 PadKey bindings",
			"────────────────────────────────",
			`🕹️  Move          ${inputsForAction({ t: "a", a: 1, v: -1 })}/${inputsForAction({ t: "a", a: 0, v: -1 })}/${inputsForAction({ t: "a", a: 1, v: 1 })}/${inputsForAction({ t: "a", a: 0, v: 1 })}  (W/A/S/D style)`,
			"🎯  Aim           Mouse movement (pointer locked)",
			helpLine("A", "🟢", { t: "b", i: 0 }),
			helpLine("B", "🔴", { t: "b", i: 1 }),
			helpLine("X", "🔵", { t: "b", i: 2 }),
			helpLine("Y", "🟡", { t: "b", i: 3 }),
			helpLine("LB", "◀️", { t: "b", i: 4 }),
			helpLine("RB", "▶️", { t: "b", i: 5 }),
			helpLine("LT", "↙️", { t: "b", i: 6 }),
			helpLine("RT", "↘️", { t: "b", i: 7 }),
			helpLine("L3", "🕹️", { t: "b", i: 10 }),
			helpLine("R3", "🕹️", { t: "b", i: 11 }),
			helpLine("View", "⧉", { t: "b", i: 8 }),
			helpLine("Menu", "☰", { t: "b", i: 9 }),
			helpLine("Guide", "✕", { t: "b", i: 16 }),
			helpLine("D-pad ↑", "⬆️", { t: "b", i: 12 }),
			helpLine("D-pad ↓", "⬇️", { t: "b", i: 13 }),
			helpLine("D-pad ←", "⬅️", { t: "b", i: 14 }),
			helpLine("D-pad →", "➡️", { t: "b", i: 15 }),
			"────────────────────────────────",
			`${comboLabel(currentToggleCombo())} toggle PadKey`,
			`${comboLabel(currentHelpCombo())} show/hide this · Esc close`,
		].join("\n");
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
		helpEl = document.createElement("div");
		helpEl.style.cssText =
			"position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;" +
			"max-width:min(720px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;" +
			"white-space:pre;font:14px/1.45 ui-monospace,monospace;color:#f2f7ff;background:rgba(12,14,22,.94);" +
			"border:1px solid rgba(159,239,127,.35);border-radius:14px;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.45);" +
			"backdrop-filter:blur(10px);pointer-events:none";
		helpEl.textContent = helpText();
		document.body.appendChild(helpEl);
	}

	function toggle() {
		config.enabled = !config.enabled;
		if (config.enabled) {
			// reconnect on next input
		} else {
			held.clear();
			fireDisconnect();
			if (document.pointerLockElement) document.exitPointerLock();
		}
		hud();
	}

	// ---- Config bridge (from isolated content script / popup) ----
	window.addEventListener("message", (e) => {
		if (e.source !== window) return;
		const d = e.data;
		if (!d || d.__padkey !== "config") return;
		config = Object.assign(structuredClone(DEFAULT_CONFIG), d.config || {});
		if (d.config && d.config.bindings) config.bindings = d.config.bindings;
		hud();
	});

	// build HUD once DOM exists
	if (document.body) hud();
	else document.addEventListener("DOMContentLoaded", hud, { once: true });

	console.log("[PadKey] installed — keyboard+mouse → virtual Xbox controller");
})();

// PadKey options.js — full remapping UI backed by chrome.storage.sync.

// Must mirror DEFAULT_CONFIG in src/inject.js.
const DEFAULTS = {
	enabled: true,
	sensitivity: 0.018,
	smoothing: 0.25,
	aimMin: 0.12,
	aimCurve: 0.75,
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
		KeyW: { t: "a", a: 1, v: -1 },
		KeyS: { t: "a", a: 1, v: 1 },
		KeyA: { t: "a", a: 0, v: -1 },
		KeyD: { t: "a", a: 0, v: 1 },
		Space: { t: "b", i: 0 },
		ControlLeft: { t: "b", i: 1 },
		KeyR: { t: "b", i: 2 },
		KeyF: { t: "b", i: 3 },
		KeyQ: { t: "b", i: 4 },
		KeyE: { t: "b", i: 5 },
		Mouse2: { t: "b", i: 6 },
		Mouse0: { t: "b", i: 7 },
		ShiftLeft: { t: "b", i: 10 },
		KeyC: { t: "b", i: 11 },
		Tab: { t: "b", i: 8 },
		Enter: { t: "b", i: 9 },
		Backquote: { t: "b", i: 16 },
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

// Remappable targets (right stick is mouse-driven, shown as info).
const GROUPS = [
	{
		title: "Movement — Left Stick",
		items: [
			{ label: "Up", action: { t: "a", a: 1, v: -1 } },
			{ label: "Down", action: { t: "a", a: 1, v: 1 } },
			{ label: "Left", action: { t: "a", a: 0, v: -1 } },
			{ label: "Right", action: { t: "a", a: 0, v: 1 } },
		],
	},
	{
		title: "Aim — Right Stick",
		info: "Driven by mouse movement. Tune sensitivity / smoothing below.",
		items: [],
	},
	{
		title: "Face Buttons",
		items: [
			{ label: "A", action: { t: "b", i: 0 } },
			{ label: "B", action: { t: "b", i: 1 } },
			{ label: "X", action: { t: "b", i: 2 } },
			{ label: "Y", action: { t: "b", i: 3 } },
		],
	},
	{
		title: "Bumpers & Triggers",
		items: [
			{ label: "LB", action: { t: "b", i: 4 } },
			{ label: "RB", action: { t: "b", i: 5 } },
			{ label: "LT", action: { t: "b", i: 6 } },
			{ label: "RT", action: { t: "b", i: 7 } },
		],
	},
	{
		title: "Stick Clicks",
		items: [
			{ label: "L3 (left stick)", action: { t: "b", i: 10 } },
			{ label: "R3 (right stick)", action: { t: "b", i: 11 } },
		],
	},
	{
		title: "Menu",
		items: [
			{ label: "View / Back", action: { t: "b", i: 8 } },
			{ label: "Menu / Start", action: { t: "b", i: 9 } },
			{ label: "Guide / Xbox", action: { t: "b", i: 16 } },
		],
	},
	{
		title: "D-Pad",
		items: [
			{ label: "Up", action: { t: "b", i: 12 } },
			{ label: "Down", action: { t: "b", i: 13 } },
			{ label: "Left", action: { t: "b", i: 14 } },
			{ label: "Right", action: { t: "b", i: 15 } },
		],
	},
];

let config = structuredClone(DEFAULTS);
let capturing = null; // { kind: "binding"|"toggle", action?, btnEl }

const $ = (id) => document.getElementById(id);
const actionEq = (a, b) =>
	a &&
	b &&
	a.t === b.t &&
	(a.t === "b" ? a.i === b.i : a.a === b.a && a.v === b.v);

// ---- pretty names ----
function prettyInput(id) {
	if (id === "Mouse0") return "Left Click";
	if (id === "Mouse1") return "Middle Click";
	if (id === "Mouse2") return "Right Click";
	if (id === "Mouse3") return "Mouse 4";
	if (id === "Mouse4") return "Mouse 5";
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

function inputsFor(action) {
	return Object.keys(config.bindings).filter((id) =>
		actionEq(config.bindings[id], action),
	);
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

function comboFromEvent(e) {
	return {
		code: e.code,
		ctrl: e.ctrlKey && e.code !== "ControlLeft" && e.code !== "ControlRight",
		alt: e.altKey && e.code !== "AltLeft" && e.code !== "AltRight",
		shift: e.shiftKey && e.code !== "ShiftLeft" && e.code !== "ShiftRight",
		meta: e.metaKey && e.code !== "MetaLeft" && e.code !== "MetaRight",
	};
}

function comboLabel(combo) {
	const parts = [];
	if (combo.ctrl) parts.push("Ctrl");
	if (combo.alt) parts.push("Alt");
	if (combo.shift) parts.push("Shift");
	if (combo.meta) parts.push("Meta");
	parts.push(prettyInput(combo.code));
	return parts.join("+");
}

// ---- render ----
function render() {
	const root = $("targets");
	root.replaceChildren();
	for (const g of GROUPS) {
		const h = document.createElement("h2");
		h.textContent = g.title;
		root.appendChild(h);

		if (g.info) {
			const p = document.createElement("div");
			p.className = "info";
			p.textContent = g.info;
			root.appendChild(p);
		}
		if (!g.items.length) continue;

		const grid = document.createElement("div");
		grid.className = "grid";
		for (const item of g.items) {
			const lab = document.createElement("div");
			lab.className = "label";
			lab.textContent = item.label;
			grid.appendChild(lab);

			const chips = document.createElement("div");
			chips.className = "chips";
			for (const id of inputsFor(item.action)) {
				const chip = document.createElement("span");
				chip.className = "chip";
				const name = document.createElement("b");
				name.textContent = prettyInput(id);
				chip.appendChild(name);
				const x = document.createElement("span");
				x.className = "x";
				x.textContent = "×";
				x.title = "Unbind";
				x.onclick = () => {
					delete config.bindings[id];
					save();
					render();
				};
				chip.appendChild(x);
				chips.appendChild(chip);
			}
			const add = document.createElement("button");
			add.className = "add";
			add.textContent = "＋ Add";
			add.onclick = () => startCapture("binding", item.action, add);
			chips.appendChild(add);
			grid.appendChild(chips);
		}
		root.appendChild(grid);
	}

	$("sensitivity").value = config.sensitivity;
	$("smoothing").value = config.smoothing;
	$("aimMin").value = config.aimMin;
	$("aimCurve").value = config.aimCurve;
	$("sensitivityVal").textContent = Number(config.sensitivity).toFixed(3);
	$("smoothingVal").textContent = Number(config.smoothing).toFixed(2);
	$("aimMinVal").textContent = Number(config.aimMin).toFixed(2);
	$("aimCurveVal").textContent = Number(config.aimCurve).toFixed(2);
	$("invertY").checked = config.invertY;
	$("lockPointerOnClick").checked = config.lockPointerOnClick;
	$("toggleKeyBtn").textContent = comboLabel(currentToggleCombo());
	$("helpKeyBtn").textContent = comboLabel(currentHelpCombo());
}

// ---- capture next input ----
function startCapture(kind, action, btnEl) {
	cancelCapture();
	capturing = { kind, action, btnEl };
	btnEl.classList.add("capturing");
	btnEl.textContent = "press input… (Esc cancels)";
}
function cancelCapture() {
	if (capturing) {
		capturing.btnEl.classList.remove("capturing");
		capturing = null;
		render();
	}
}
function commitCapture(inputId) {
	if (!capturing) return;
	if (capturing.kind === "toggle") {
		config.toggleKey = inputId;
		config.toggleCombo = {
			code: inputId,
			ctrl: false,
			alt: false,
			shift: false,
			meta: false,
		};
	} else {
		// rebind: an input id maps to exactly one action
		config.bindings[inputId] = structuredClone(capturing.action);
	}
	capturing = null;
	save();
	render();
}

function commitCombo(combo) {
	if (!capturing) return;
	if (capturing.kind === "toggle") {
		config.toggleKey = combo.code;
		config.toggleCombo = combo;
	} else if (capturing.kind === "help") {
		config.helpCombo = combo;
	}
	capturing = null;
	save();
	render();
}

window.addEventListener(
	"keydown",
	(e) => {
		if (!capturing) return;
		e.preventDefault();
		e.stopPropagation();
		if (e.code === "Escape") {
			cancelCapture();
			return;
		}
		if (capturing.kind === "toggle" || capturing.kind === "help") {
			commitCombo(comboFromEvent(e));
			return;
		}
		commitCapture(e.code);
	},
	true,
);

window.addEventListener(
	"mousedown",
	(e) => {
		if (!capturing || capturing.kind !== "binding") return; // combos must be keys
		// ignore clicks on the capturing button itself / UI chrome handled by buttons
		if (e.target.closest("button, .x")) return;
		e.preventDefault();
		commitCapture("Mouse" + e.button);
	},
	true,
);

window.addEventListener(
	"wheel",
	(e) => {
		if (!capturing || capturing.kind !== "binding") return;
		e.preventDefault();
		commitCapture(e.deltaY < 0 ? "WheelUp" : "WheelDown");
	},
	{ capture: true, passive: false },
);

// ---- settings inputs ----
$("sensitivity").addEventListener("input", (e) => {
	config.sensitivity = parseFloat(e.target.value);
	save();
	render();
});
$("smoothing").addEventListener("input", (e) => {
	config.smoothing = parseFloat(e.target.value);
	save();
	render();
});
$("aimMin").addEventListener("input", (e) => {
	config.aimMin = parseFloat(e.target.value);
	save();
	render();
});
$("aimCurve").addEventListener("input", (e) => {
	config.aimCurve = parseFloat(e.target.value);
	save();
	render();
});
$("invertY").addEventListener("change", (e) => {
	config.invertY = e.target.checked;
	save();
});
$("lockPointerOnClick").addEventListener("change", (e) => {
	config.lockPointerOnClick = e.target.checked;
	save();
});
$("toggleKeyBtn").addEventListener("click", () =>
	startCapture("toggle", null, $("toggleKeyBtn")),
);
$("helpKeyBtn").addEventListener("click", () =>
	startCapture("help", null, $("helpKeyBtn")),
);

// ---- import / export ----
$("export").addEventListener("click", () => {
	$("json").value = JSON.stringify(config, null, 2);
});
$("import").addEventListener("click", () => {
	try {
		const parsed = JSON.parse($("json").value);
		config = Object.assign(structuredClone(DEFAULTS), parsed);
		save();
		render();
		flash();
	} catch (err) {
		alert("Invalid JSON: " + err.message);
	}
});

$("resetAll").addEventListener("click", () => {
	if (!confirm("Reset ALL bindings and settings to defaults?")) return;
	config = structuredClone(DEFAULTS);
	save();
	render();
});

// ---- persistence ----
let flashTimer = null;
let syncTimer = null;
function flash() {
	const el = $("saved");
	el.classList.add("show");
	clearTimeout(flashTimer);
	flashTimer = setTimeout(() => el.classList.remove("show"), 900);
}
function save() {
	// local = instant live update path to content scripts; sync = debounced backup
	chrome.storage.local.set({ config }, flash);
	clearTimeout(syncTimer);
	syncTimer = setTimeout(() => chrome.storage.sync.set({ config }), 400);
}

function loadConfig(raw) {
	config = Object.assign(structuredClone(DEFAULTS), raw || {});
	if (!config.bindings || !Object.keys(config.bindings).length) {
		config.bindings = structuredClone(DEFAULTS.bindings);
	}
	render();
}

chrome.storage.local.get("config", (localRes) => {
	if (localRes && localRes.config) {
		loadConfig(localRes.config);
		return;
	}
	chrome.storage.sync.get("config", (syncRes) => {
		loadConfig(syncRes && syncRes.config ? syncRes.config : {});
		if (syncRes && syncRes.config) chrome.storage.local.set({ config });
	});
});

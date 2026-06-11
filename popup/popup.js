// PadKey popup.js — reads/writes the config in chrome.storage.sync.

const DEFAULTS = {
	enabled: true,
	sensitivity: 0.018,
	smoothing: 0.25,
	aimMin: 0.12,
	aimCurve: 0.75,
	invertY: false,
	lockPointerOnClick: true,
	toggleKey: "F8",
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
};

const fields = [
	"enabled",
	"sensitivity",
	"smoothing",
	"aimMin",
	"aimCurve",
	"invertY",
	"lockPointerOnClick",
];
let config = { ...DEFAULTS };
let syncTimer = null;

function render() {
	document.getElementById("enabled").checked = config.enabled;
	document.getElementById("invertY").checked = config.invertY;
	document.getElementById("lockPointerOnClick").checked =
		config.lockPointerOnClick;
	document.getElementById("sensitivity").value = config.sensitivity;
	document.getElementById("smoothing").value = config.smoothing;
	document.getElementById("aimMin").value = config.aimMin;
	document.getElementById("aimCurve").value = config.aimCurve;
	document.getElementById("sensitivityVal").textContent = Number(
		config.sensitivity,
	).toFixed(3);
	document.getElementById("smoothingVal").textContent = Number(
		config.smoothing,
	).toFixed(2);
	document.getElementById("aimMinVal").textContent = Number(
		config.aimMin,
	).toFixed(2);
	document.getElementById("aimCurveVal").textContent = Number(
		config.aimCurve,
	).toFixed(2);
}

function save() {
	// local = instant live update path to content scripts; sync = debounced backup
	chrome.storage.local.set({ config });
	clearTimeout(syncTimer);
	syncTimer = setTimeout(() => chrome.storage.sync.set({ config }), 400);
}

function bind(id, prop, type) {
	document.getElementById(id).addEventListener("input", (e) => {
		config[prop] =
			type === "bool" ? e.target.checked : parseFloat(e.target.value);
		render();
		save();
	});
}

bind("enabled", "enabled", "bool");
bind("invertY", "invertY", "bool");
bind("lockPointerOnClick", "lockPointerOnClick", "bool");
bind("sensitivity", "sensitivity", "num");
bind("smoothing", "smoothing", "num");
bind("aimMin", "aimMin", "num");
bind("aimCurve", "aimCurve", "num");

document.getElementById("reset").addEventListener("click", () => {
	// preserve remapped bindings + toggle key; only reset the slider/toggle fields
	config = Object.assign(
		{ ...DEFAULTS },
		{
			bindings: config.bindings,
			toggleKey: config.toggleKey,
			toggleCombo: config.toggleCombo,
			helpCombo: config.helpCombo,
		},
	);
	render();
	save();
});

document.getElementById("advanced").addEventListener("click", () => {
	chrome.runtime.openOptionsPage();
});

chrome.storage.local.get("config", (localRes) => {
	if (localRes && localRes.config) {
		config = Object.assign({ ...DEFAULTS }, localRes.config);
		render();
		return;
	}
	chrome.storage.sync.get("config", (syncRes) => {
		config = Object.assign(
			{ ...DEFAULTS },
			syncRes && syncRes.config ? syncRes.config : {},
		);
		render();
		if (syncRes && syncRes.config) chrome.storage.local.set({ config });
	});
});

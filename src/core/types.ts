// Shared, framework-free types for the padm0nk core.
//
// An input id is a string key identifying a physical input:
//   - KeyboardEvent.code (e.g. "KeyW", "Space", "ArrowUp", "Backquote")
//   - "Mouse0".."Mouse4" (Left / Middle / Right / 4 / 5)
//   - "WheelUp" / "WheelDown"

/** Press a virtual gamepad button by index. */
export interface ButtonAction {
	t: 'b';
	/** Button index into the W3C "standard" layout (0..16). */
	i: number;
}

/** Deflect a virtual gamepad axis to a fixed direction while held. */
export interface AxisAction {
	t: 'a';
	/** Axis index: 0 = LX, 1 = LY (2/3 are mouse-driven, never bound). */
	a: 0 | 1;
	/** Deflection direction: -1 or +1. */
	v: -1 | 1;
}

export type Action = ButtonAction | AxisAction;

/** input id -> action. */
export type Bindings = Record<string, Action>;

/** A keyboard chord used for toggle / help shortcuts. */
export interface Combo {
	/** KeyboardEvent.code of the non-modifier key. */
	code: string;
	ctrl: boolean;
	alt: boolean;
	shift: boolean;
	meta: boolean;
}

/** Full persisted configuration. */
export interface Config {
	enabled: boolean;
	/** Mouse pixels -> right-stick deflection. */
	sensitivity: number;
	/** Right-stick smoothing: 0 = instant/jittery, ->1 = smooth/laggy. */
	smoothing: number;
	/** Minimum non-zero stick output; clears in-game deadzones. */
	aimMin: number;
	/** Aim response curve: <1 boosts fine motion, 1 linear, >1 slower start. */
	aimCurve: number;
	invertY: boolean;
	lockPointerOnClick: boolean;
	/** Legacy single-key toggle; kept readable for old profiles. */
	toggleKey: string;
	toggleCombo: Combo;
	helpCombo: Combo;
	bindings: Bindings;
}

/**
 * Live virtual-pad state (mutated each animation frame by the mapper).
 *
 * Design choice: the input accumulators (`held`, `mouseDX`, `mouseDY`) live on
 * the SAME struct as the pad outputs rather than a separate `InputState`. The
 * legacy runtime kept them as sibling closures and the per-frame tick read/wrote
 * both, so a single mutable object keeps the mapper signature minimal —
 * `step(config, state, now)` — and avoids threading two objects through every
 * call. The input fields are write-only from the capture layer; the mapper
 * consumes + zeroes mouse deltas and reads `held` each frame.
 */
export interface GamepadState {
	connected: boolean;
	/** Analog button values 0..1, length BUTTON_COUNT. */
	buttons: number[];
	/** Axis values -1..1, length AXIS_COUNT. */
	axes: Float64Array;
	timestamp: number;
	/** Input accumulator: input ids currently pressed (filled by capture layer). */
	held: Set<string>;
	/** Input accumulator: pending horizontal mouse delta (pixels) since last tick. */
	mouseDX: number;
	/** Input accumulator: pending vertical mouse delta (pixels) since last tick. */
	mouseDY: number;
}

/** A single remappable control in the controller-actions registry. */
export interface ControllerAction {
	/** Stable key, e.g. "btn.a", "stick.left.up". */
	id: string;
	/** Human label, e.g. "A", "Up". */
	label: string;
	/** Group title; matches the legacy options GROUPS titles. */
	group: string;
	/** The action produced when a bound input is held. */
	action: Action;
	/** bind-icon filename (no path), resolved against assets/bind-icons/. */
	icon?: string;
	/** Default input ids bound to this action. */
	defaultInputs: string[];
}

/** An options-page group: a titled section of controller actions. */
export interface ControllerGroup {
	title: string;
	/** Optional descriptive text (e.g. the mouse-driven right stick). */
	info?: string;
	items: ControllerAction[];
}

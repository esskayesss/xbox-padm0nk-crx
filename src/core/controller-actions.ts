// Single source of truth for every remappable control.
//
// The registry below drives:
//   - DEFAULT_CONFIG.bindings (via buildDefaultBindings)
//   - the options-page GROUPS (via groupsForOptions)
//   - the binds overlay
//   - the README bindings table
//
// Group titles match the legacy options.js GROUPS titles byte-for-byte so the
// options UI renders identically. Icon filenames map to assets/bind-icons/.

import { BUTTON } from './constants';
import type { Action, Bindings, ControllerAction, ControllerGroup } from './types';

/** Group titles, in render order. The Aim group is mouse-driven (no items). */
export const GROUP_TITLES = {
	leftStick: 'Movement — Left Stick',
	rightStick: 'Aim — Right Stick',
	face: 'Face Buttons',
	bumpersTriggers: 'Bumpers & Triggers',
	stickClicks: 'Stick Clicks',
	menu: 'Menu',
	dpad: 'D-Pad',
} as const;

/** Info groups that carry descriptive text but no remappable items. */
export const INFO_GROUPS: ReadonlyArray<{ title: string; info: string }> = [
	{
		title: GROUP_TITLES.rightStick,
		info: 'Driven by mouse movement. Tune sensitivity / smoothing below.',
	},
];

/**
 * The registry. Flattening defaultInputs -> action reproduces the legacy
 * DEFAULT_CONFIG.bindings exactly (see tests/registry.test.ts).
 */
export const CONTROLLER_ACTIONS: readonly ControllerAction[] = [
	// Movement — Left Stick
	{
		id: 'stick.left.up',
		label: 'Up',
		group: GROUP_TITLES.leftStick,
		action: { t: 'a', a: 1, v: -1 },
		icon: 'left-stick-up.svg',
		defaultInputs: ['KeyW'],
	},
	{
		id: 'stick.left.down',
		label: 'Down',
		group: GROUP_TITLES.leftStick,
		action: { t: 'a', a: 1, v: 1 },
		icon: 'left-stick-down.svg',
		defaultInputs: ['KeyS'],
	},
	{
		id: 'stick.left.left',
		label: 'Left',
		group: GROUP_TITLES.leftStick,
		action: { t: 'a', a: 0, v: -1 },
		icon: 'left-stick-left.svg',
		defaultInputs: ['KeyA'],
	},
	{
		id: 'stick.left.right',
		label: 'Right',
		group: GROUP_TITLES.leftStick,
		action: { t: 'a', a: 0, v: 1 },
		icon: 'left-stick-right.svg',
		defaultInputs: ['KeyD'],
	},

	// Face Buttons
	{
		id: 'btn.a',
		label: 'A',
		group: GROUP_TITLES.face,
		action: { t: 'b', i: BUTTON.A },
		icon: 'a.svg',
		defaultInputs: ['Space'],
	},
	{
		id: 'btn.b',
		label: 'B',
		group: GROUP_TITLES.face,
		action: { t: 'b', i: BUTTON.B },
		icon: 'b.svg',
		defaultInputs: ['ControlLeft'],
	},
	{
		id: 'btn.x',
		label: 'X',
		group: GROUP_TITLES.face,
		action: { t: 'b', i: BUTTON.X },
		icon: 'x.svg',
		defaultInputs: ['KeyR'],
	},
	{
		id: 'btn.y',
		label: 'Y',
		group: GROUP_TITLES.face,
		action: { t: 'b', i: BUTTON.Y },
		icon: 'y.svg',
		defaultInputs: ['KeyF'],
	},

	// Bumpers & Triggers
	{
		id: 'btn.lb',
		label: 'LB',
		group: GROUP_TITLES.bumpersTriggers,
		action: { t: 'b', i: BUTTON.LB },
		icon: 'left-bumper.svg',
		defaultInputs: ['KeyQ'],
	},
	{
		id: 'btn.rb',
		label: 'RB',
		group: GROUP_TITLES.bumpersTriggers,
		action: { t: 'b', i: BUTTON.RB },
		icon: 'right-bumper.svg',
		defaultInputs: ['KeyE'],
	},
	{
		id: 'btn.lt',
		label: 'LT',
		group: GROUP_TITLES.bumpersTriggers,
		action: { t: 'b', i: BUTTON.LT },
		icon: 'left-trigger.svg',
		defaultInputs: ['Mouse2'],
	},
	{
		id: 'btn.rt',
		label: 'RT',
		group: GROUP_TITLES.bumpersTriggers,
		action: { t: 'b', i: BUTTON.RT },
		icon: 'right-trigger.svg',
		defaultInputs: ['Mouse0'],
	},

	// Stick Clicks
	{
		id: 'btn.l3',
		label: 'L3 (left stick)',
		group: GROUP_TITLES.stickClicks,
		action: { t: 'b', i: BUTTON.L3 },
		icon: 'left-stick-press.svg',
		defaultInputs: ['ShiftLeft'],
	},
	{
		id: 'btn.r3',
		label: 'R3 (right stick)',
		group: GROUP_TITLES.stickClicks,
		action: { t: 'b', i: BUTTON.R3 },
		icon: 'right-stick-press.svg',
		defaultInputs: ['KeyC'],
	},

	// Menu
	{
		id: 'btn.view',
		label: 'View / Back',
		group: GROUP_TITLES.menu,
		action: { t: 'b', i: BUTTON.View },
		icon: 'view.svg',
		defaultInputs: ['Tab'],
	},
	{
		id: 'btn.menu',
		label: 'Menu / Start',
		group: GROUP_TITLES.menu,
		action: { t: 'b', i: BUTTON.Menu },
		icon: 'menu.svg',
		defaultInputs: ['Enter'],
	},
	{
		id: 'btn.guide',
		label: 'Guide / Xbox',
		group: GROUP_TITLES.menu,
		action: { t: 'b', i: BUTTON.Guide },
		icon: 'guide.svg',
		defaultInputs: ['Backquote'],
	},

	// D-Pad
	{
		id: 'dpad.up',
		label: 'Up',
		group: GROUP_TITLES.dpad,
		action: { t: 'b', i: BUTTON.DpadUp },
		icon: 'dpad-up.svg',
		defaultInputs: ['ArrowUp', 'Digit1'],
	},
	{
		id: 'dpad.down',
		label: 'Down',
		group: GROUP_TITLES.dpad,
		action: { t: 'b', i: BUTTON.DpadDown },
		icon: 'dpad-down.svg',
		defaultInputs: ['ArrowDown', 'Digit2'],
	},
	{
		id: 'dpad.left',
		label: 'Left',
		group: GROUP_TITLES.dpad,
		action: { t: 'b', i: BUTTON.DpadLeft },
		icon: 'dpad-left.svg',
		defaultInputs: ['ArrowLeft', 'Digit3'],
	},
	{
		id: 'dpad.right',
		label: 'Right',
		group: GROUP_TITLES.dpad,
		action: { t: 'b', i: BUTTON.DpadRight },
		icon: 'dpad-right.svg',
		defaultInputs: ['ArrowRight', 'Digit4'],
	},
];

/**
 * True when every remappable controller action has at least one bound input.
 * Stick/aim info rows are mouse/keyboard-driven and not part of this check
 * (only registry actions with defaultInputs are remappable).
 */
export function allBindsConfigured(bindings: Bindings): boolean {
	const bound = new Set<string>();
	for (const id of Object.keys(bindings)) {
		const a = bindings[id];
		if (a == null) continue;
		bound.add(a.t === 'b' ? `b:${a.i}` : `a:${a.a}:${a.v}`);
	}
	return CONTROLLER_ACTIONS.every((entry) => {
		const a = entry.action;
		const key = a.t === 'b' ? `b:${a.i}` : `a:${a.a}:${a.v}`;
		return bound.has(key);
	});
}

/** Flatten the registry's defaultInputs -> action into a Bindings map. */
export function buildDefaultBindings(): Bindings {
	const bindings: Bindings = {};
	for (const entry of CONTROLLER_ACTIONS) {
		for (const input of entry.defaultInputs) {
			// each input id maps to exactly one action; clone to avoid shared refs
			bindings[input] = { ...entry.action } as Action;
		}
	}
	return bindings;
}

/**
 * Build the options-page groups: titled sections in render order, info groups
 * interleaved at their declared position. Items come from the registry.
 */
export function groupsForOptions(): ControllerGroup[] {
	const infoByTitle = new Map(INFO_GROUPS.map((g) => [g.title, g.info]));
	const order = Object.values(GROUP_TITLES);
	const groups: ControllerGroup[] = [];
	for (const title of order) {
		const items = CONTROLLER_ACTIONS.filter((a) => a.group === title);
		const info = infoByTitle.get(title);
		if (items.length === 0 && info === undefined) continue;
		groups.push(info === undefined ? { title, items } : { title, info, items });
	}
	return groups;
}

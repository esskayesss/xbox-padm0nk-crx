// Virtual-pad state: factory, reset, and the W3C Gamepad snapshot builder.

import { AXIS_COUNT, BUTTON_COUNT, GAMEPAD_ID, GAMEPAD_MAPPING } from './constants';
import type { GamepadState } from './types';

/** Create a fresh, disconnected virtual-pad state with zeroed inputs/outputs. */
export function createGamepadState(): GamepadState {
	return {
		connected: false,
		buttons: new Array<number>(BUTTON_COUNT).fill(0),
		axes: new Float64Array(AXIS_COUNT),
		timestamp: 0,
		held: new Set<string>(),
		mouseDX: 0,
		mouseDY: 0,
		velX: 0,
		velY: 0,
		lastAimT: 0,
		lastMoveT: 0,
	};
}

/**
 * Clear transient input accumulators (legacy `clearInputs` semantics): drops all
 * held inputs and zeroes the pending mouse delta. Used on toggle-off, window
 * blur, and visibilitychange→hidden so keys/sticks don't get stuck when a keyup
 * fires outside the page. Does NOT touch `connected`.
 */
export function clearInputs(state: GamepadState): void {
	state.held.clear();
	state.mouseDX = 0;
	state.mouseDY = 0;
	// drop the aim integrator too, so a stuck/decaying stick can't survive a
	// blur/toggle-off and bleed into the next session.
	state.velX = 0;
	state.velY = 0;
	state.lastMoveT = 0;
}

/**
 * Fully reset the pad: clears inputs AND zeroes all button/axis outputs. Used on
 * (re)enable to ensure no stale deflection bleeds into the first emitted frame.
 */
export function resetGamepadState(state: GamepadState): void {
	clearInputs(state);
	state.buttons.fill(0);
	state.axes.fill(0);
}

function vibrationActuatorStub(): GamepadHapticActuator {
	return {
		type: 'dual-rumble',
		playEffect: () => Promise.resolve('complete'),
		reset: () => Promise.resolve('complete'),
	} as unknown as GamepadHapticActuator;
}

/**
 * Build the W3C Gamepad object the page sees, reflecting current `state`.
 *
 * IMPORTANT — fresh objects every call (do NOT reuse/cache):
 * Real browsers return an immutable, point-in-time SNAPSHOT from each
 * `getGamepads()` call. Consumers (notably xCloud's own `GamepadNavigation`)
 * edge-detect a button press by caching the previous poll's button objects and
 * comparing `current.buttons[i].pressed && !prev.buttons[i].pressed`. If we hand
 * back the SAME object instances and mutate them in place, `current` and `prev`
 * alias the same objects, the comparison collapses to `x && !x === false`, and
 * the press edge never fires — i.e. A/select silently stops working in the UI
 * even though the value is correct. An earlier "perf" optimization reused a
 * cached object per state and caused exactly that regression. Allocating fresh
 * here matches legacy behaviour and the W3C contract; per-frame GC of a handful
 * of small objects is negligible next to correct edge detection.
 */
export function snapshot(state: GamepadState, index = 0): Gamepad {
	const buttons: GamepadButton[] = new Array(state.buttons.length);
	for (let i = 0; i < state.buttons.length; i++) {
		const v = state.buttons[i] ?? 0;
		buttons[i] = { pressed: v > 0.5, touched: v > 0, value: v };
	}
	const axes = new Array<number>(state.axes.length);
	for (let i = 0; i < state.axes.length; i++) {
		axes[i] = state.axes[i] ?? 0;
	}
	return {
		id: GAMEPAD_ID,
		index,
		connected: state.connected,
		mapping: GAMEPAD_MAPPING,
		timestamp: state.timestamp,
		axes,
		buttons,
		vibrationActuator: vibrationActuatorStub(),
		hapticActuators: [],
	} as unknown as Gamepad;
}

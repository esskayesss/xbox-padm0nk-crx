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

/**
 * Per-state snapshot cache for the W3C Gamepad object the page sees.
 *
 * Bug 5 (perf): legacy allocated a fresh Gamepad object, a fresh buttons array of
 * 17 fresh `{pressed,touched,value}` objects, a fresh axes array, AND a fresh
 * vibrationActuator on EVERY getGamepads() call — i.e. every animation frame the
 * page polls. That thrashes GC under steady polling.
 *
 * Reuse strategy: one cache per GamepadState, kept in a WeakMap (so the
 * GamepadState type stays pure and caches are GC'd with their state). The cache
 * holds a single Gamepad object, a persistent buttons array of 17 reused button
 * wrappers, a persistent axes array, and a single vibrationActuator stub.
 * `snapshot()` mutates these in place and returns the same object each call. The
 * returned object always reflects current state at call time (callers read it
 * synchronously inside their poll), matching legacy observable behaviour with
 * near-zero per-frame allocation.
 */
interface SnapshotCache {
	gamepad: Gamepad;
	buttons: GamepadButton[];
	axes: number[];
}

const snapshotCaches = new WeakMap<GamepadState, SnapshotCache>();

function vibrationActuatorStub(): GamepadHapticActuator {
	return {
		type: 'dual-rumble',
		playEffect: () => Promise.resolve('complete'),
		reset: () => Promise.resolve('complete'),
	} as unknown as GamepadHapticActuator;
}

function makeCache(state: GamepadState): SnapshotCache {
	const buttons: GamepadButton[] = [];
	for (let i = 0; i < state.buttons.length; i++) {
		buttons.push({ pressed: false, touched: false, value: 0 });
	}
	const axes = new Array<number>(state.axes.length).fill(0);
	const gamepad = {
		id: GAMEPAD_ID,
		index: 0,
		connected: state.connected,
		mapping: GAMEPAD_MAPPING,
		timestamp: state.timestamp,
		axes,
		buttons,
		vibrationActuator: vibrationActuatorStub(),
		hapticActuators: [],
	} as unknown as Gamepad;
	return { gamepad, buttons, axes };
}

/**
 * Build the W3C Gamepad object the page sees, reflecting current `state`.
 * Reuses persistent buffers (see SnapshotCache) — mutated in place each call.
 */
export function snapshot(state: GamepadState, index = 0): Gamepad {
	let cache = snapshotCaches.get(state);
	if (!cache) {
		cache = makeCache(state);
		snapshotCaches.set(state, cache);
	}

	// Button wrappers: mutate the reused {pressed,touched,value} objects in place.
	for (let i = 0; i < state.buttons.length; i++) {
		const v = state.buttons[i] ?? 0;
		const b = cache.buttons[i] as { pressed: boolean; touched: boolean; value: number };
		b.pressed = v > 0.5;
		b.touched = v > 0;
		b.value = v;
	}
	// Axes: copy current values into the reused array.
	for (let i = 0; i < state.axes.length; i++) {
		cache.axes[i] = state.axes[i] ?? 0;
	}

	const g = cache.gamepad as unknown as {
		index: number;
		connected: boolean;
		timestamp: number;
	};
	g.index = index;
	g.connected = state.connected;
	g.timestamp = state.timestamp;
	return cache.gamepad;
}

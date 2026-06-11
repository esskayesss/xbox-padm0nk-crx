// Pure factory for the navigator.getGamepads override + connect/disconnect event
// builders. No global patching here — the content-world coordinator assigns
// `navigator.getGamepads = createGetGamepadsOverride(...)` in a later phase.

import { snapshot } from './gamepad-state';
import type { GamepadState } from './types';

/** Native getGamepads, bound to navigator (or null when unavailable). */
export type NativeGetGamepads = (() => (Gamepad | null)[]) | null;

export interface GetGamepadsOverrideOptions {
	/** The captured native getGamepads (already bound), or null. */
	native: NativeGetGamepads;
	/** The live virtual-pad state to snapshot. */
	state: GamepadState;
	/** Whether the virtual pad is currently enabled. */
	isEnabled: () => boolean;
}

/**
 * Build a function matching `navigator.getGamepads`. When disabled or the pad is
 * not connected, it passes the real controller list through untouched. Otherwise
 * it clones the real list and places our snapshot in the FIRST null slot (so a
 * real controller at index 0 is never clobbered), appending if no slot is free,
 * and reports that slot as the pad's index. Mirrors legacy getGamepadsOverride.
 */
export function createGetGamepadsOverride(
	opts: GetGamepadsOverrideOptions,
): () => (Gamepad | null)[] {
	const { native, state, isEnabled } = opts;
	return function getGamepadsOverride(): (Gamepad | null)[] {
		const real = native ? Array.from(native()) : [];
		if (!isEnabled() || !state.connected) {
			// pass through real controllers untouched
			return real;
		}
		const out = real.slice();
		let slot = out.findIndex((g) => g == null);
		if (slot === -1) slot = out.length;
		out[slot] = snapshot(state, slot);
		return out;
	};
}

/**
 * Build a gamepad lifecycle event. Prefers the standard `GamepadEvent`
 * constructor; falls back to a plain `Event` with the gamepad attached (mirrors
 * legacy fireConnect/fireDisconnect, which guarded against engines lacking the
 * GamepadEvent constructor). Pure aside from reading the DOM globals — the
 * coordinator dispatches the returned event.
 */
export function makeGamepadEvent(
	type: 'gamepadconnected' | 'gamepaddisconnected',
	gamepad: Gamepad,
): Event {
	try {
		return new GamepadEvent(type, { gamepad });
	} catch {
		const ev = new Event(type);
		(ev as unknown as { gamepad: Gamepad }).gamepad = gamepad;
		return ev;
	}
}

/** Convenience: gamepadconnected event for the given snapshot. */
export function makeGamepadConnectedEvent(gamepad: Gamepad): Event {
	return makeGamepadEvent('gamepadconnected', gamepad);
}

/** Convenience: gamepaddisconnected event for the given snapshot. */
export function makeGamepadDisconnectedEvent(gamepad: Gamepad): Event {
	return makeGamepadEvent('gamepaddisconnected', gamepad);
}

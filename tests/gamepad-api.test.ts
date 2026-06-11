import { describe, expect, it } from 'vitest';
import { createGetGamepadsOverride } from '../src/core/gamepad-api';
import { createGamepadState, snapshot } from '../src/core/gamepad-state';
import { GAMEPAD_ID } from '../src/core/constants';

function fakeReal(slots: (Gamepad | null)[]): () => (Gamepad | null)[] {
	return () => slots.slice();
}

describe('createGetGamepadsOverride', () => {
	it('returns native list untouched when disabled', () => {
		const state = createGamepadState();
		state.connected = true;
		const real: (Gamepad | null)[] = [null, null];
		const fn = createGetGamepadsOverride({
			native: fakeReal(real),
			state,
			isEnabled: () => false,
		});
		const out = fn();
		expect(out).toEqual(real);
		expect(out.some((g) => g != null)).toBe(false);
	});

	it('returns native list untouched when not connected', () => {
		const state = createGamepadState();
		state.connected = false;
		const fn = createGetGamepadsOverride({
			native: fakeReal([null, null]),
			state,
			isEnabled: () => true,
		});
		expect(fn().some((g) => g != null)).toBe(false);
	});

	it('places snapshot in the first null slot, reporting that index', () => {
		const state = createGamepadState();
		state.connected = true;
		const realPad = { id: 'real', index: 0 } as unknown as Gamepad;
		const fn = createGetGamepadsOverride({
			native: fakeReal([realPad, null, null]),
			state,
			isEnabled: () => true,
		});
		const out = fn();
		// real pad at 0 not clobbered; ours lands in slot 1
		expect(out[0]).toBe(realPad);
		expect(out[1]).not.toBeNull();
		expect(out[1]!.id).toBe(GAMEPAD_ID);
		expect(out[1]!.index).toBe(1);
		expect(out[2]).toBeNull();
	});

	it('appends when there is no null slot, reporting the appended index', () => {
		const state = createGamepadState();
		state.connected = true;
		const p0 = { id: 'real0' } as unknown as Gamepad;
		const p1 = { id: 'real1' } as unknown as Gamepad;
		const fn = createGetGamepadsOverride({
			native: fakeReal([p0, p1]),
			state,
			isEnabled: () => true,
		});
		const out = fn();
		expect(out).toHaveLength(3);
		expect(out[2]!.id).toBe(GAMEPAD_ID);
		expect(out[2]!.index).toBe(2);
	});

	it('handles a null native getGamepads (empty list)', () => {
		const state = createGamepadState();
		state.connected = true;
		const fn = createGetGamepadsOverride({
			native: null,
			state,
			isEnabled: () => true,
		});
		const out = fn();
		expect(out).toHaveLength(1);
		expect(out[0]!.id).toBe(GAMEPAD_ID);
		expect(out[0]!.index).toBe(0);
	});

	it('snapshot in the override reflects live state', () => {
		const state = createGamepadState();
		state.connected = true;
		state.buttons[0] = 1;
		const fn = createGetGamepadsOverride({
			native: fakeReal([null]),
			state,
			isEnabled: () => true,
		});
		const out = fn();
		// fresh snapshot per call (not the same instance), but reflects live state
		const ref = snapshot(state, 0);
		expect(out[0]).not.toBe(ref);
		expect(out[0]!.id).toBe(ref.id);
		expect(out[0]!.index).toBe(0);
		expect(out[0]!.connected).toBe(true);
		expect(out[0]!.buttons[0].pressed).toBe(true);
	});
});

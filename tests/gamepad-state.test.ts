import { describe, expect, it } from 'vitest';
import { AXIS_COUNT, BUTTON_COUNT, GAMEPAD_ID } from '../src/core/constants';
import {
	clearInputs,
	createGamepadState,
	resetGamepadState,
	snapshot,
} from '../src/core/gamepad-state';

describe('createGamepadState', () => {
	it('starts disconnected with zeroed inputs/outputs', () => {
		const s = createGamepadState();
		expect(s.connected).toBe(false);
		expect(s.buttons).toHaveLength(BUTTON_COUNT);
		expect(s.buttons.every((v) => v === 0)).toBe(true);
		expect(s.axes).toHaveLength(AXIS_COUNT);
		expect(Array.from(s.axes)).toEqual([0, 0, 0, 0]);
		expect(s.held.size).toBe(0);
		expect(s.mouseDX).toBe(0);
		expect(s.mouseDY).toBe(0);
		expect(s.timestamp).toBe(0);
	});
});

describe('clearInputs / resetGamepadState', () => {
	it('clearInputs zeroes held + mouse but keeps outputs/connected', () => {
		const s = createGamepadState();
		s.connected = true;
		s.held.add('KeyW');
		s.mouseDX = 10;
		s.mouseDY = -10;
		s.buttons[0] = 1;
		s.axes[0] = 0.5;
		clearInputs(s);
		expect(s.held.size).toBe(0);
		expect(s.mouseDX).toBe(0);
		expect(s.mouseDY).toBe(0);
		// outputs untouched
		expect(s.buttons[0]).toBe(1);
		expect(s.axes[0]).toBe(0.5);
		expect(s.connected).toBe(true);
	});

	it('resetGamepadState also zeroes button + axis outputs', () => {
		const s = createGamepadState();
		s.held.add('KeyW');
		s.mouseDX = 10;
		s.buttons[3] = 1;
		s.axes[2] = 0.9;
		resetGamepadState(s);
		expect(s.held.size).toBe(0);
		expect(s.mouseDX).toBe(0);
		expect(s.buttons.every((v) => v === 0)).toBe(true);
		expect(Array.from(s.axes)).toEqual([0, 0, 0, 0]);
	});
});

describe('snapshot', () => {
	it('has 17 buttons, 4 axes, standard mapping, correct id', () => {
		const s = createGamepadState();
		const g = snapshot(s, 0);
		expect(g.id).toBe(GAMEPAD_ID);
		expect(g.mapping).toBe('standard');
		expect(g.buttons).toHaveLength(BUTTON_COUNT);
		expect(g.axes).toHaveLength(AXIS_COUNT);
		expect(g.index).toBe(0);
	});

	it('reflects current button/axis state at call time', () => {
		const s = createGamepadState();
		s.connected = true;
		s.buttons[0] = 1;
		s.axes[0] = 0.5;
		s.timestamp = 42;
		const g = snapshot(s, 2);
		expect(g.index).toBe(2);
		expect(g.connected).toBe(true);
		expect(g.timestamp).toBe(42);
		expect(g.buttons[0].pressed).toBe(true);
		expect(g.buttons[0].touched).toBe(true);
		expect(g.buttons[0].value).toBe(1);
		expect(g.buttons[1].pressed).toBe(false);
		expect(g.axes[0]).toBe(0.5);
	});

	it('touched is true for any nonzero value, pressed only above 0.5', () => {
		const s = createGamepadState();
		s.buttons[5] = 0.3;
		const g = snapshot(s, 0);
		expect(g.buttons[5].touched).toBe(true);
		expect(g.buttons[5].pressed).toBe(false);
	});

	it('returns a FRESH snapshot each call so consumers can edge-detect presses', () => {
		// Regression guard: xCloud's GamepadNavigation caches the previous poll's
		// button objects and fires on `cur.pressed && !prev.pressed`. If snapshot()
		// reused/mutated the same objects, prev===cur and the edge never fires —
		// A/select silently breaks in the xCloud UI. Each call must be independent.
		const s = createGamepadState();
		s.connected = true;

		// frame 1: A released
		s.buttons[0] = 0;
		const prev = snapshot(s, 0);
		expect(prev.buttons[0].pressed).toBe(false);

		// frame 2: A pressed
		s.buttons[0] = 1;
		const cur = snapshot(s, 0);

		// distinct object graphs (gamepad, buttons array, button wrappers, axes)
		expect(cur).not.toBe(prev);
		expect(cur.buttons).not.toBe(prev.buttons);
		expect(cur.buttons[0]).not.toBe(prev.buttons[0]);
		expect(cur.axes).not.toBe(prev.axes);

		// the earlier snapshot must NOT retroactively reflect the new state
		expect(prev.buttons[0].pressed).toBe(false);
		expect(cur.buttons[0].pressed).toBe(true);
		// => the press edge is observable
		expect(cur.buttons[0].pressed && !prev.buttons[0].pressed).toBe(true);
	});

	it('vibrationActuator stub is dual-rumble and playEffect resolves', async () => {
		const s = createGamepadState();
		const g = snapshot(s, 0);
		const act = g.vibrationActuator as unknown as {
			type: string;
			playEffect: () => Promise<string>;
			reset: () => Promise<string>;
		};
		expect(act.type).toBe('dual-rumble');
		await expect(act.playEffect()).resolves.toBe('complete');
		await expect(act.reset()).resolves.toBe('complete');
	});
});

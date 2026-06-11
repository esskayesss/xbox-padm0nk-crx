import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/core/config';
import { createGamepadState } from '../src/core/gamepad-state';
import { aimResponse, step } from '../src/core/mapper';
import type { Config } from '../src/core/types';

function cfg(overrides: Partial<Config> = {}): Config {
	return { ...DEFAULT_CONFIG, ...overrides };
}

describe('mapper.step — left stick', () => {
	it('holding KeyW deflects LY to -1', () => {
		const s = createGamepadState();
		s.held.add('KeyW');
		step(cfg(), s, 1);
		expect(s.axes[1]).toBeCloseTo(-1, 6);
		expect(s.axes[0]).toBe(0);
	});

	it('opposing W+S cancels to 0', () => {
		const s = createGamepadState();
		s.held.add('KeyW');
		s.held.add('KeyS');
		step(cfg(), s, 1);
		expect(s.axes[1]).toBe(0);
	});

	it('diagonal W+D is radially clamped: magnitude <= 1 and ~0.707 per axis', () => {
		const s = createGamepadState();
		s.held.add('KeyW'); // LY -1
		s.held.add('KeyD'); // LX +1
		step(cfg(), s, 1);
		const ax0 = s.axes[0];
		const ax1 = s.axes[1];
		const magnitude = Math.hypot(ax0, ax1);
		// headline fix: vector magnitude must not exceed 1 (legacy reached √2)
		expect(magnitude).toBeLessThanOrEqual(1 + 1e-9);
		expect(magnitude).toBeCloseTo(1, 6);
		expect(Math.abs(ax0)).toBeCloseTo(Math.SQRT1_2, 6); // ~0.707
		expect(Math.abs(ax1)).toBeCloseTo(Math.SQRT1_2, 6);
	});

	it('button binding sets the mapped button to 1', () => {
		const s = createGamepadState();
		s.held.add('Space'); // A = index 0
		step(cfg(), s, 1);
		expect(s.buttons[0]).toBe(1);
		expect(s.buttons[1]).toBe(0);
	});
});

describe('mapper.step — right stick (mouse)', () => {
	it('invertY flips the ryTarget sign', () => {
		const a = createGamepadState();
		a.mouseDY = 100;
		step(cfg({ smoothing: 0, invertY: false }), a, 1);
		const normal = a.axes[3];

		const b = createGamepadState();
		b.mouseDY = 100;
		step(cfg({ smoothing: 0, invertY: true }), b, 1);
		const inverted = b.axes[3];

		expect(Math.sign(normal)).toBe(-Math.sign(inverted));
		expect(normal).toBeCloseTo(-inverted, 6);
	});

	it('smoothing interpolates toward the target over successive steps', () => {
		const s = createGamepadState();
		const c = cfg({ smoothing: 0.5 });
		// constant rightward mouse delta each frame
		const vals: number[] = [];
		for (let i = 0; i < 4; i++) {
			s.mouseDX = 100;
			step(c, s, i);
			vals.push(s.axes[2]);
		}
		// monotonically increasing toward a positive target, not instant
		expect(vals[0]).toBeGreaterThan(0);
		expect(vals[1]).toBeGreaterThan(vals[0]);
		expect(vals[2]).toBeGreaterThan(vals[1]);
		expect(vals[3]).toBeGreaterThan(vals[2]);
	});

	it('deadzone snap: residue < 0.005 collapses to 0', () => {
		const s = createGamepadState();
		// seed a tiny residual right-stick value, then tick with no mouse input
		s.axes[2] = 0.004;
		s.axes[3] = -0.004;
		step(cfg({ smoothing: 0.9 }), s, 1);
		expect(s.axes[2]).toBe(0);
		expect(s.axes[3]).toBe(0);
	});

	it('consumes (zeroes) mouse delta each tick', () => {
		const s = createGamepadState();
		s.mouseDX = 50;
		s.mouseDY = -50;
		step(cfg(), s, 1);
		expect(s.mouseDX).toBe(0);
		expect(s.mouseDY).toBe(0);
	});

	it('sets timestamp to now', () => {
		const s = createGamepadState();
		step(cfg(), s, 1234);
		expect(s.timestamp).toBe(1234);
	});
});

describe('aimResponse', () => {
	it('returns 0 for 0 input', () => {
		expect(aimResponse(0)).toBe(0);
	});

	it('is sign-preserving', () => {
		expect(aimResponse(0.5)).toBeGreaterThan(0);
		expect(aimResponse(-0.5)).toBeLessThan(0);
	});

	it('is monotonic over [0,1]', () => {
		let prev = -Infinity;
		for (let r = 0.01; r <= 1; r += 0.01) {
			const v = aimResponse(r);
			expect(v).toBeGreaterThanOrEqual(prev);
			prev = v;
		}
	});

	it('applies the aimMin floor for any nonzero input', () => {
		// curve clamps to >=0.25; even a tiny input lands at/above the floor
		const tiny = aimResponse(0.0001, 0.2, 0.75);
		expect(Math.abs(tiny)).toBeGreaterThanOrEqual(0.2 - 1e-9);
	});

	it('curve < 1 boosts small inputs vs linear', () => {
		const boosted = aimResponse(0.25, 0, 0.5);
		const linear = aimResponse(0.25, 0, 1);
		expect(boosted).toBeGreaterThan(linear);
	});

	it('clamps raw input to [-1,1]', () => {
		expect(aimResponse(5)).toBeCloseTo(aimResponse(1), 6);
		expect(aimResponse(-5)).toBeCloseTo(aimResponse(-1), 6);
	});
});

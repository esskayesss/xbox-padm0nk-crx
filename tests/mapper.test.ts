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

	it('diagonal W+D clamps each axis independently to full deflection (legacy feel)', () => {
		const s = createGamepadState();
		s.held.add('KeyW'); // LY -1
		s.held.add('KeyD'); // LX +1
		step(cfg(), s, 1);
		// legacy parity: each axis reaches its full ±1 (diagonal magnitude ~1.41),
		// NOT radially clamped to ~0.707 — restores the original movement feel.
		expect(s.axes[0]).toBeCloseTo(1, 6); // LX +1
		expect(s.axes[1]).toBeCloseTo(-1, 6); // LY -1
		expect(Math.hypot(s.axes[0], s.axes[1])).toBeCloseTo(Math.SQRT2, 6);
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

	it('consumes mouse delta within full deflection (no leftover for normal aim)', () => {
		const s = createGamepadState();
		// 50px * 0.018 sens = 0.9 deflection (< 1) → fully consumed, nothing carried
		s.mouseDX = 50;
		s.mouseDY = -50;
		step(cfg(), s, 1);
		expect(s.mouseDX).toBe(0);
		expect(s.mouseDY).toBe(0);
	});

	it('carries over delta beyond full deflection so fast flicks are not clipped', () => {
		const s = createGamepadState();
		const c = cfg({ smoothing: 0 });
		// a fast flick: 200px * 0.018 = 3.6 deflection → stick pins at max (1) and the
		// overflow stays queued so the next frames keep delivering the motion.
		s.mouseDX = 200;
		step(c, s, 1);
		expect(s.axes[2]).toBeCloseTo(1, 6); // pinned at full deflection
		expect(s.mouseDX).toBeGreaterThan(0); // overflow carried, not discarded
		// overflow = (3.6 - 1) / 0.018 px
		expect(s.mouseDX).toBeCloseTo((3.6 - 1) / 0.018, 4);

		// draining with no new input keeps the stick pinned until consumed
		step(c, s, 2);
		expect(s.axes[2]).toBeCloseTo(1, 6);
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
